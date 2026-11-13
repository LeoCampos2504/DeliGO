// ============================================
// F10-B0 — single Caja sale engine (server only)
// ============================================
// The ONE place where a Caja sale is written. Today it is called by
// POST /api/negocio/caja/ventas (owner session); the future cashier route
// (F10-B1) must call this same function — never a second sales engine.
//
// Guarantees preserved verbatim from the original route (P2-T56-R1/R2C/R3A-I3):
//   - tenant-scoped product/variant read (negocioId from the caller's session),
//   - server-side prices and totals (computeSaleFromAuthoritativeProducts),
//   - R3A stock: plan aggregated per key against físico − ACTIVA
//     (planificarStockVentaCaja) BEFORE creating the Venta, then the single
//     write path (registrarStockVentaCaja),
//   - one Serializable transaction with the shared bounded P2034 retry.
// F4-C1: the work done inside that transaction is exposed as
// registrarVentaCajaEnTx so a future F4-C operation can run it together with
// the return engine in ONE transaction; registrarVentaCaja keeps opening its
// own transaction and behaves exactly as before.
// Added by F10-B0, inside that same transaction (all-or-nothing):
//   - idempotency (Idempotency-Key + content fingerprint, unique per negocio):
//     exact replay returns the original sale, a reused key with different
//     content is a 409, concurrent duplicates resolve to one sale;
//   - actor authorship derived by the caller from the verified session;
//   - exactly one CobroVenta per new sale (D7: multi-payment-ready);
//   - EFECTIVO only: one VENTA_COBRO operation + one +importe leg on the
//     negocio's system cash account (no physical register exists yet).
// Added by F10-B2.0 (same transaction, dual write): every money amount is
// computed exactly (src/lib/money.ts: round2 HALF_UP per line, exact sum) and
// written to BOTH the legacy Float column and its NUMERIC(12,2) *Decimal
// column — Venta.total/totalDecimal, VentaItem.subtotal/subtotalDecimal,
// CobroVenta.importe/importeDecimal, MovimientoFinanciero.importe/importeDecimal.
// The Float is the transport form of the exact Decimal, so both always carry
// the same cents amount. Decimal objects never leave the server as-is
// (ventaCajaParaRespuesta strips them from the owner's JSON contract).
// Added by F10-B2.1 (same transaction): shift attribution. The caller passes
// the turnoCajaId it resolved FROM THE SESSION (never from the body); the
// engine re-validates inside its transaction that the shift is ABIERTO, of
// THIS negocio and that the actor IS its responsible person, then records it
// on the Venta and on the cash operation, and books the cash leg on THAT
// register's cash account (one account per physical register). Without a
// shift, cash keeps going to the historical efectivo_caja_sin_asignar account
// (identifiable, never mixed with a register). When the business switched
// cajaTurnosModo to OBLIGATORIO, a cashier (EMPLEADO) without a shift cannot
// sell (enforced here too, not only in the route).
// Not done here on purpose: no Mercado Pago account or balance, no closing,
// no mixed payments.

import { createHash } from "node:crypto"
import { Prisma, type PrismaClient } from "@prisma/client"
import {
  canonicalVentaCajaRequest,
  computeSaleFromAuthoritativeProducts,
  estadoConciliacionInicial,
  isValidMetodoPagoVenta,
  METODO_COBRO_CREDITO_CAMBIO,
  METODO_PAGO_VENTA_CAMBIO,
  type MetodoPagoVenta,
  type ServerSaleLineInput,
} from "@/lib/caja-venta"
import { isMoneyInRange, MoneyError, moneyToNumber, saleAmountsExact, type SaleAmountsExact } from "@/lib/money"
import { CAJA_TURNOS_MODO_OBLIGATORIO, TURNO_ESTADO_ABIERTO } from "@/lib/caja-turnos-service"
import {
  isStockSerializationConflict,
  planificarStockVentaCaja,
  registrarStockVentaCaja,
  runStockSerializable,
  type VentaCajaStockLine,
} from "@/lib/stock-lifecycle"

/** System cash account used until physical registers exist (F10-B2). */
export const CUENTA_EFECTIVO_CAJA_SIN_ASIGNAR = "efectivo_caja_sin_asignar"
export const TIPO_OPERACION_VENTA_COBRO = "VENTA_COBRO"

/**
 * Who registers the sale — ALWAYS derived from the verified server session by
 * the caller, never from the request body.
 *   NEGOCIO  = owner (negocio session): actorId = negocioId.
 *   EMPLEADO = cashier (F10-B1+): must belong to this negocio, active.
 */
export type VentaCajaActor = { tipo: "NEGOCIO" } | { tipo: "EMPLEADO"; empleadoId: string }

/**
 * F4-C4 — link of a sale to an earlier one, written ONLY by the exchange
 * service (caja-cambios-service.ts); a normal Caja sale never carries it.
 *   ADICIONAL: a normal sale (its own method, one cobro for its total) linked
 *              to the origin sale.
 *   CAMBIO:    the new sale of an exchange. Venta.metodoPago = "CAMBIO"; its
 *              cobros are the internal credit (written after the CambioVenta
 *              by registrarCreditoCambioEnTx) plus, when the charged difference
 *              D+ > 0, ONE real cobro of D+ with `medioDiferencia` (and the
 *              cash ledger leg when EFECTIVO). `credito` + `diferencia` must be
 *              exactly the sale total computed here, or nothing is written.
 */
export type VinculoVentaCaja =
  | { tipo: "ADICIONAL"; ventaOrigenId: string }
  | { tipo: "CAMBIO"; ventaOrigenId: string; credito: Prisma.Decimal; diferencia: Prisma.Decimal; medioDiferencia: MetodoPagoVenta | null }

export interface RegistrarVentaCajaInput {
  negocioId: string
  actor: VentaCajaActor
  /** "CAMBIO" only together with vinculo.tipo = "CAMBIO" (F4-C4). */
  metodoPago: MetodoPagoVenta | typeof METODO_PAGO_VENTA_CAMBIO
  lines: ServerSaleLineInput[]
  /** null = legacy client without Idempotency-Key (owner route transition only). */
  idempotencyKey: string | null
  /**
   * F10-B2.1: the actor's open shift, resolved by the caller from the verified
   * session (turnoAbiertoDeActor) — NEVER taken from the request body. The
   * engine re-validates it. null/undefined = sale without shift.
   */
  turnoCajaId?: string | null
  /** Owner-only register choice. null/undefined means: resolve the sole open shift, if any. */
  ownerCajaFisicaId?: string | null
  /** F4-C4: linked sale (exchange service only). Absent for every normal sale. */
  vinculo?: VinculoVentaCaja
}

export type VentaCajaConItems = Prisma.VentaGetPayload<{ include: { items: true } }>

export type RegistrarVentaCajaResult =
  | { ok: true; replayed: boolean; venta: VentaCajaConItems }
  | { ok: false; status: 400 | 403 | 404 | 409; error: string; code?: string }

export const IDEMPOTENCY_KEY_REUSED_CODE = "IDEMPOTENCY_KEY_REUSED"
export const IMPORTE_FUERA_DE_RANGO = "El importe de la venta está fuera del rango permitido"
export const TURNO_NO_DISPONIBLE_CODE = "TURNO_NO_DISPONIBLE"
export const TURNO_REQUERIDO_CODE = "TURNO_REQUERIDO"
export const CUENTA_EFECTIVO_CAJA_FISICA_PREFIX = "efectivo_caja_fisica:"

/**
 * F10-B2.0 — the owner's existing JSON contract for a sale (POST 201/200 and
 * GET ventasHoy): the same fields as before, without the internal exact
 * *Decimal columns (Prisma Decimal objects would otherwise serialize as
 * strings). The numeric `total` / `subtotal` already carry the exact cents.
 */
export type VentaCajaRespuesta = Omit<VentaCajaConItems, "totalDecimal" | "items" | "ventaOrigenId" | "vinculoTipo"> & {
  items: Array<Omit<VentaCajaConItems["items"][number], "subtotalDecimal">>
}

export function ventaCajaParaRespuesta(venta: VentaCajaConItems): VentaCajaRespuesta {
  // F4-C3: the sale-link columns (always NULL for a normal sale) stay out of the
  // owner's existing JSON contract until the exchange screens need them (F4-C5).
  const { totalDecimal: _totalDecimal, ventaOrigenId: _ventaOrigenId, vinculoTipo: _vinculoTipo, items, ...rest } = venta
  void _totalDecimal
  void _ventaOrigenId
  void _vinculoTipo
  return {
    ...rest,
    items: items.map(({ subtotalDecimal: _subtotalDecimal, ...item }) => {
      void _subtotalDecimal
      return item
    }),
  }
}

type SaleDb = Pick<PrismaClient, "$transaction" | "venta" | "cuentaFinanciera" | "turnoCaja">

/** sha256 of the canonical request, namespaced by negocio. */
export function fingerprintVentaCaja(negocioId: string, metodoPago: string, lines: ServerSaleLineInput[], ownerCajaFisicaId?: string | null): string {
  const cajaIntent = ownerCajaFisicaId ? `\nCAJA_FISICA:${ownerCajaFisicaId}` : ""
  return createHash("sha256").update(`${negocioId}\n${canonicalVentaCajaRequest(metodoPago, lines)}${cajaIntent}`).digest("hex")
}

// F10-B1: a replay is returned only to the SAME actor that created the sale
// (owner → actorId = negocioId; cashier → actorId = empleadoId). The same key
// presented by a different person of the same negocio is a controlled 409 —
// never another person's sale. The content fingerprint is unchanged.
function sameActor(existing: VentaCajaConItems, actor: VentaCajaActor, negocioId: string): boolean {
  const actorId = actor.tipo === "EMPLEADO" ? actor.empleadoId : negocioId
  return existing.actorTipo === actor.tipo && existing.actorId === actorId
}

function replayOrConflict(
  existing: VentaCajaConItems,
  fingerprint: string | null,
  actor: VentaCajaActor,
  negocioId: string
): RegistrarVentaCajaResult {
  if (existing.idempotencyFingerprint && existing.idempotencyFingerprint === fingerprint && sameActor(existing, actor, negocioId)) {
    return { ok: true, replayed: true, venta: existing }
  }
  return {
    ok: false,
    status: 409,
    code: IDEMPOTENCY_KEY_REUSED_CODE,
    error: "Este intento de cobro ya se usó para otra venta. Volvé a intentar el cobro.",
  }
}

function isIdempotencyUniqueViolation(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false
  const target = (error.meta as { target?: unknown } | undefined)?.target
  const text = Array.isArray(target) ? target.join(",") : String(target ?? "")
  return text.includes("idempotencyKey") || text.includes("ventas_caja_negocioId_idempotencyKey_key")
}

/**
 * Ensures the negocio's legacy unassigned cash account exists. The sale engine
 * now calls the equivalent write inside its Serializable transaction, after
 * idempotency replay and live register resolution.
 */
export async function asegurarCuentaEfectivoCaja(db: Pick<PrismaClient, "cuentaFinanciera">, negocioId: string): Promise<string> {
  await db.cuentaFinanciera.createMany({
    data: [
      {
        negocioId,
        clave: CUENTA_EFECTIVO_CAJA_SIN_ASIGNAR,
        tipo: "EFECTIVO",
        nombre: "Efectivo de Caja (sin caja física asignada)",
      },
    ],
    skipDuplicates: true,
  })
  const cuenta = await db.cuentaFinanciera.findUniqueOrThrow({
    where: { negocioId_clave: { negocioId, clave: CUENTA_EFECTIVO_CAJA_SIN_ASIGNAR } },
    select: { id: true },
  })
  return cuenta.id
}

/**
 * F10-B2.1 — ensures the separate cash account of ONE physical register.
 * Cash sold at one register never increases another's.
 */
export async function asegurarCuentaEfectivoCajaFisica(
  db: Pick<PrismaClient, "cuentaFinanciera">,
  negocioId: string,
  cajaFisicaId: string
): Promise<string> {
  const clave = `${CUENTA_EFECTIVO_CAJA_FISICA_PREFIX}${cajaFisicaId}`
  await db.cuentaFinanciera.createMany({
    data: [{ negocioId, clave, tipo: "EFECTIVO", nombre: "Efectivo de caja física", cajaFisicaId }],
    skipDuplicates: true,
  })
  const cuenta = await db.cuentaFinanciera.findFirstOrThrow({ where: { negocioId, clave, cajaFisicaId }, select: { id: true } })
  return cuenta.id
}

const TURNO_NO_DISPONIBLE = {
  ok: false as const,
  status: 409 as const,
  code: TURNO_NO_DISPONIBLE_CODE,
  error: "Tu turno de Caja ya no está disponible. Actualizá la pantalla.",
}

/** Pure pre-check of a sale request (no database access). null = acceptable. */
function rechazoEntradaVentaCaja(input: RegistrarVentaCajaInput): RegistrarVentaCajaResult | null {
  if (input.actor.tipo === "NEGOCIO" && input.ownerCajaFisicaId !== undefined && input.ownerCajaFisicaId !== null && !input.ownerCajaFisicaId.trim()) {
    return { ok: false, status: 400, error: "Caja inválida" }
  }
  // F4-C4: "CAMBIO" is the summary method of an exchange sale and nothing else.
  if ((input.metodoPago === METODO_PAGO_VENTA_CAMBIO) !== (input.vinculo?.tipo === "CAMBIO")) {
    return { ok: false, status: 400, error: "Método de pago inválido" }
  }
  if (input.vinculo?.tipo === "CAMBIO") {
    const { credito, diferencia, medioDiferencia } = input.vinculo
    if (credito.isNegative() || diferencia.isNegative() || (diferencia.gt(0) && !medioDiferencia)) {
      return { ok: false, status: 400, error: "Indicá cómo se cobra la diferencia.", code: "MEDIO_DIFERENCIA_REQUERIDO" }
    }
  }
  return null
}

// F4-C5: exported (pure) so the verification of a linked additional sale
// compares exactly the fingerprint this engine stores.
export function fingerprintEntradaVentaCaja(input: RegistrarVentaCajaInput): string | null {
  if (!input.idempotencyKey) return null
  const base = fingerprintVentaCaja(input.negocioId, input.metodoPago, input.lines, input.actor.tipo === "NEGOCIO" ? input.ownerCajaFisicaId : undefined)
  // F4-C4: a linked sale also fingerprints its link (a normal sale is unchanged).
  if (!input.vinculo) return base
  const v = input.vinculo
  const detalle = v.tipo === "CAMBIO" ? `${v.credito.toFixed(2)}:${v.diferencia.toFixed(2)}:${v.medioDiferencia ?? ""}` : ""
  return createHash("sha256").update(`${base}\nVINCULO:${v.tipo}:${v.ventaOrigenId}:${detalle}`).digest("hex")
}

// E2/E3 (QA 2026-11-12): transient concurrency conflicts of a Caja sale.
/** Rounds of runStockSerializable (3 attempts each) → at most 9 attempts. */
export const VENTA_CAJA_RONDAS_REINTENTO = 3
export const VENTA_CONFLICTO_CONCURRENTE_CODE = "VENTA_CONFLICTO_CONCURRENTE"
export const VENTA_CONFLICTO_CONCURRENTE_MENSAJE = "No pudimos completar la venta porque la caja estaba procesando otras operaciones al mismo tiempo. No se registró nada: podés volver a intentarla."
/** Serialization failure (P2034 / raw 40001) or deadlock (40P01): transient, the transaction was rolled back. */
export function esConflictoConcurrenteVenta(error: unknown): boolean {
  return isStockSerializationConflict(error) || (error instanceof Prisma.PrismaClientUnknownRequestError && String(error).includes("40P01"))
}
/** Growing, randomized pause between rounds (40–80 ms, then 80–120 ms). */
const esperaEntreRondasVenta = (ronda: number) => 40 * ronda + Math.floor(Math.random() * 40)

/**
 * Registers a Caja sale in its OWN Serializable transaction (the behaviour of
 * both Caja routes): runStockSerializable + the in-transaction core below, and
 * the concurrent-duplicate replay after a unique violation of the key.
 */
export async function registrarVentaCaja(db: SaleDb, input: RegistrarVentaCajaInput): Promise<RegistrarVentaCajaResult> {
  const rechazo = rechazoEntradaVentaCaja(input)
  if (rechazo) return rechazo
  const { negocioId, actor, idempotencyKey } = input
  const fingerprint = fingerprintEntradaVentaCaja(input)

  try {
    // E2 (QA 2026-11-12): runStockSerializable (the shared stock authority and
    // its timeout policy, unchanged) retries a serialization conflict 3 times
    // back to back. Concurrent FIRST cash sales of new registers all insert the
    // same ledger account and could exhaust those 3 immediate attempts (409).
    // A bounded number of extra rounds, each after a growing randomized pause,
    // lets the committed winner become visible. Only transient conflicts are
    // retried (refusals are RETURNED, stock errors are other exceptions), the
    // whole transaction rolls back each time and the idempotency check runs
    // first in every attempt, so nothing can be written twice.
    for (let ronda = 1; ; ronda++) {
      try {
        return await runStockSerializable(db, async (tx) => {
          return registrarVentaCajaEnTx(tx, input)
        })
      } catch (error) {
        if (!esConflictoConcurrenteVenta(error) || ronda >= VENTA_CAJA_RONDAS_REINTENTO) throw error
        await new Promise((resolve) => setTimeout(resolve, esperaEntreRondasVenta(ronda)))
      }
    }
  } catch (error) {
    // A concurrent request with the same key committed first: return that
    // sale (exact replay) or the controlled conflict — never a second sale.
    if (idempotencyKey && isIdempotencyUniqueViolation(error)) {
      const existing = await db.venta.findUnique({
        where: { negocioId_idempotencyKey: { negocioId, idempotencyKey } },
        include: { items: true },
      })
      if (existing) return replayOrConflict(existing, fingerprint, actor, negocioId)
    }
    throw error
  }
}

/**
 * F4-C1 — the in-transaction core of the single sale engine: everything
 * registrarVentaCaja does INSIDE its transaction, unchanged (idempotent
 * replay, actor and shift validation, authoritative prices, exact amounts,
 * stock against physical − ACTIVA reservations, Venta/VentaItem, stock write,
 * one CobroVenta, the cash ledger leg). It must run inside a Serializable
 * transaction opened by an existing runner. A refusal is RETURNED, never
 * thrown: a caller composing it with another engine in the same transaction
 * must turn it into a rollback (exigirResultadoOk, caja-transaccion-compartida).
 * Stock errors still throw (StockLifecycleError) and roll everything back.
 * Not here: the unique-violation replay of a concurrent duplicate, which needs
 * a fresh read after the failed transaction (see registrarVentaCaja).
 */
export async function registrarVentaCajaEnTx(tx: Prisma.TransactionClient, input: RegistrarVentaCajaInput): Promise<RegistrarVentaCajaResult> {
  const rechazo = rechazoEntradaVentaCaja(input)
  if (rechazo) return rechazo
  const { negocioId, actor, lines: requestedLines, idempotencyKey } = input
  const fingerprint = fingerprintEntradaVentaCaja(input)
  // F4-C4: in an exchange sale the only REAL cobro is the charged difference
  // D+, with its own method (none when D+ = 0); every other sale charges its
  // whole total with its own method, exactly as before.
  const cambio = input.vinculo?.tipo === "CAMBIO" ? input.vinculo : null
  const metodoPago: MetodoPagoVenta | null = cambio ? (cambio.diferencia.gt(0) ? cambio.medioDiferencia : null) : (input.metodoPago as MetodoPagoVenta)

  // F10-B0: exact replay / reused key — BEFORE any validation or side
  // effect, so a retry of an already-committed sale never re-validates
  // stock and never writes anything.
  if (idempotencyKey) {
    const existing = await tx.venta.findUnique({
      where: { negocioId_idempotencyKey: { negocioId, idempotencyKey } },
      include: { items: true },
    })
    if (existing) return replayOrConflict(existing, fingerprint, actor, negocioId)
  }

  // Actor: derived from the session by the caller; an EMPLEADO must be an
  // active employee of THIS negocio (defense in depth for F10-B1).
  let actorId: string = negocioId
  let empleadoId: string | null = null
  if (actor.tipo === "EMPLEADO") {
    const empleado = await tx.empleado.findFirst({
      where: { id: actor.empleadoId, negocioId, activo: true, eliminado: false },
      select: { id: true },
    })
    if (!empleado) return { ok: false as const, status: 403 as const, error: "Acceso denegado" }
    actorId = empleado.id
    empleadoId = empleado.id
  }
  let turnoCajaId = input.turnoCajaId ?? null

  // F10-B2.2-A: an owner is a permitted actor for the selected active
  // physical register's open shift, even when an employee is responsible.
  // Replay above deliberately precedes this live destination resolution.
  let cajaFisicaIdDelTurno: string | null = null
  if (actor.tipo === "NEGOCIO" && input.ownerCajaFisicaId !== undefined) {
    const cajaIdSeleccionada = input.ownerCajaFisicaId
    if (cajaIdSeleccionada) {
      const cajaRows = await tx.$queryRaw<Array<{ id: string; activa: boolean }>>`
        SELECT "id", "activa" FROM "cajas_fisicas"
        WHERE "id" = ${cajaIdSeleccionada} AND "negocioId" = ${negocioId}
        FOR UPDATE`
      const caja = cajaRows[0]
      if (!caja) return { ok: false as const, status: 404 as const, error: "Caja no encontrada." }
      if (!caja.activa) return { ok: false as const, status: 409 as const, code: "CAJA_INACTIVA", error: "La caja está desactivada." }
      const turno = await tx.turnoCaja.findFirst({
        where: { negocioId, cajaFisicaId: caja.id, estado: TURNO_ESTADO_ABIERTO },
        select: { id: true, cajaFisicaId: true },
      })
      if (!turno) return TURNO_NO_DISPONIBLE
      turnoCajaId = turno.id
      cajaFisicaIdDelTurno = turno.cajaFisicaId
    } else {
      // Opening a shift locks its register row too. Lock all existing
      // registers before counting so a concurrent opening cannot turn a
      // previously unique automatic destination into an ambiguous one.
      await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "cajas_fisicas"
        WHERE "negocioId" = ${negocioId}
        ORDER BY "id"
        FOR UPDATE`
      const abiertos = await tx.turnoCaja.findMany({
        where: { negocioId, estado: TURNO_ESTADO_ABIERTO },
        select: { id: true, cajaFisicaId: true },
        take: 2,
      })
      if (abiertos.length > 1) {
        return { ok: false as const, status: 409 as const, code: "CAJA_SELECCION_REQUERIDA", error: "Hay varias cajas abiertas. Seleccioná en cuál cobrar." }
      }
      if (abiertos.length === 1) {
        const selected = abiertos[0]
        const cajaRows = await tx.$queryRaw<Array<{ id: string; activa: boolean }>>`
          SELECT "id", "activa" FROM "cajas_fisicas"
          WHERE "id" = ${selected.cajaFisicaId} AND "negocioId" = ${negocioId}
          FOR UPDATE`
        const caja = cajaRows[0]
        if (!caja || !caja.activa) return TURNO_NO_DISPONIBLE
        const turno = await tx.turnoCaja.findFirst({
          where: { id: selected.id, negocioId, cajaFisicaId: caja.id, estado: TURNO_ESTADO_ABIERTO },
          select: { id: true, cajaFisicaId: true },
        })
        if (!turno) return TURNO_NO_DISPONIBLE
        turnoCajaId = turno.id
        cajaFisicaIdDelTurno = turno.cajaFisicaId
      }
    }
  }

  if (turnoCajaId && !(actor.tipo === "NEGOCIO" && input.ownerCajaFisicaId !== undefined)) {
    const turno = await tx.turnoCaja.findFirst({ where: { id: turnoCajaId, negocioId }, select: { cajaFisicaId: true } })
    if (!turno) return TURNO_NO_DISPONIBLE
    const cajaRows = await tx.$queryRaw<Array<{ id: string; activa: boolean }>>`
      SELECT "id", "activa" FROM "cajas_fisicas"
      WHERE "id" = ${turno.cajaFisicaId} AND "negocioId" = ${negocioId}
      FOR UPDATE`
    if (!cajaRows[0]?.activa) return TURNO_NO_DISPONIBLE
    cajaFisicaIdDelTurno = turno.cajaFisicaId
  }

  // F10-B2.2-A: employees must remain the shift's responsible person.
  // Owner is separately authorized for their selected/automatic register
  // above, while its employee responsibility remains unchanged.
  if (turnoCajaId) {
    const ownerSharesEmployeeShift = actor.tipo === "NEGOCIO" && input.ownerCajaFisicaId !== undefined
    const turno = await tx.turnoCaja.findFirst({
      where: {
        id: turnoCajaId,
        negocioId,
        estado: TURNO_ESTADO_ABIERTO,
        cajaFisicaId: cajaFisicaIdDelTurno!,
        ...(!ownerSharesEmployeeShift ? { responsableTipo: actor.tipo, responsableId: actorId } : {}),
      },
      select: { id: true },
    })
    if (!turno) return TURNO_NO_DISPONIBLE
  } else if (actor.tipo === "EMPLEADO") {
    const negocio = await tx.negocio.findUnique({ where: { id: negocioId }, select: { cajaTurnosModo: true } })
    if (negocio?.cajaTurnosModo === CAJA_TURNOS_MODO_OBLIGATORIO) {
      return {
        ok: false as const,
        status: 409 as const,
        code: TURNO_REQUERIDO_CODE,
        error: "Para vender tenés que abrir un turno de Caja.",
      }
    }
  }

  // Tenant-scoped, authoritative product+variant read — a productoId
  // that doesn't belong to this negocio (or is inactive) simply won't
  // be in this map, and computeSaleFromAuthoritativeProducts rejects
  // any requested line that isn't in it. Every active AND inactive
  // variant is fetched (never trust "activo" from the client either) so
  // an inactive variant is resolvable-but-rejectable below, not just
  // silently missing.
  const productos = await tx.producto.findMany({
    where: { id: { in: requestedLines.map((l) => l.productoId) }, negocioId, eliminado: false },
    include: { variantes: true },
  })
  const productsById = new Map(
    productos.map((p) => [
      p.id,
      {
        nombre: p.nombre,
        precio: p.precio,
        variantes: new Map(
          p.variantes.filter((v) => v.activo).map((v) => [v.id, { nombre: v.nombre, precio: v.precio }])
        ),
      },
    ])
  )

  const computed = computeSaleFromAuthoritativeProducts(requestedLines, productsById)
  if (!computed.ok) {
    return { ok: false as const, status: 400 as const, error: computed.error }
  }

  // F10-B2.0 — exact amounts: the single authority for every money column
  // written below (Float = transport form of the same exact cents).
  let importes: SaleAmountsExact
  try {
    importes = saleAmountsExact(computed.items)
  } catch (error) {
    if (error instanceof MoneyError) return { ok: false as const, status: 400 as const, error: IMPORTE_FUERA_DE_RANGO }
    throw error
  }
  if (!isMoneyInRange(importes.total) || !importes.subtotales.every((s) => isMoneyInRange(s))) {
    return { ok: false as const, status: 400 as const, error: IMPORTE_FUERA_DE_RANGO }
  }
  const totalExacto = importes.total
  // F4-C4: the exchange service computed credit + difference from the same
  // authoritative prices in this transaction; any drift writes nothing.
  if (cambio && !cambio.credito.plus(cambio.diferencia).equals(totalExacto)) {
    return { ok: false as const, status: 409 as const, code: "IMPORTES_CAMBIARON", error: "Los precios cambiaron mientras se procesaba el cambio. Revisá los importes e intentá de nuevo." }
  }

  // P2-T56-R3A-I3: stock por clave AGREGADA (Decisión C: líneas repetidas
  // del mismo producto/variante suman antes de validar) contra el DISPONIBLE
  // = físico − reservas ACTIVA (Decisión B), leído en esta misma tx
  // Serializable por la autoridad compartida. Lanza 409
  // STOCK_RESERVED_FOR_ORDERS / STOCK_INSUFFICIENT antes de crear nada.
  const productsByIdFull = new Map(productos.map((p) => [p.id, p]))
  const variantesById = new Map(productos.flatMap((p) => p.variantes.map((v) => [v.id, v] as const)))
  const stockLines: VentaCajaStockLine[] = computed.items.map((line) => {
    const producto = productsByIdFull.get(line.productoId)!
    const variante = line.varianteId ? variantesById.get(line.varianteId)! : null
    return {
      productoId: line.productoId,
      productoVarianteId: line.varianteId ?? null,
      cantidad: line.cantidad,
      controlStock: variante ? variante.controlStock : producto.controlStock,
      nombre: variante ? `${producto.nombre} — ${variante.nombre}` : producto.nombre,
    }
  })
  const stockPlan = await planificarStockVentaCaja(tx, { negocioId, lines: stockLines })

  // Resolve/create the ledger account only after idempotency, shift
  // authorization AND every validation above (E1, QA 2026-11-12): a refused
  // sale is RETURNED — its transaction commits — so an account created before
  // a refusal survived it. Here nothing can refuse any more (stock errors
  // throw and roll everything back). Same transaction, same statements.
  const cuentaEfectivoId = metodoPago !== "EFECTIVO"
    ? null
    : cajaFisicaIdDelTurno
      ? await (async () => {
          await tx.cuentaFinanciera.createMany({ data: [{ negocioId, clave: `${CUENTA_EFECTIVO_CAJA_FISICA_PREFIX}${cajaFisicaIdDelTurno}`, tipo: "EFECTIVO", nombre: "Efectivo de caja física", cajaFisicaId: cajaFisicaIdDelTurno }], skipDuplicates: true })
          const cuenta = await tx.cuentaFinanciera.findFirstOrThrow({ where: { negocioId, clave: `${CUENTA_EFECTIVO_CAJA_FISICA_PREFIX}${cajaFisicaIdDelTurno}`, cajaFisicaId: cajaFisicaIdDelTurno }, select: { id: true } })
          return cuenta.id
        })()
      : await (async () => {
          await tx.cuentaFinanciera.createMany({ data: [{ negocioId, clave: CUENTA_EFECTIVO_CAJA_SIN_ASIGNAR, tipo: "EFECTIVO", nombre: "Efectivo de Caja (sin caja física asignada)" }], skipDuplicates: true })
          const cuenta = await tx.cuentaFinanciera.findUniqueOrThrow({ where: { negocioId_clave: { negocioId, clave: CUENTA_EFECTIVO_CAJA_SIN_ASIGNAR } }, select: { id: true } })
          return cuenta.id
        })()

  const venta = await tx.venta.create({
    data: {
      negocioId,
      total: moneyToNumber(totalExacto),
      totalDecimal: totalExacto,
      metodoPago: input.metodoPago,
      cantidadItems: computed.cantidadItems,
      idempotencyKey,
      idempotencyFingerprint: fingerprint,
      actorTipo: actor.tipo,
      actorId,
      empleadoId,
      turnoCajaId,
      // F4-C4: NULL for every normal sale (SQL: link complete-or-none, immutable).
      ventaOrigenId: input.vinculo?.ventaOrigenId ?? null,
      vinculoTipo: input.vinculo?.tipo ?? null,
      items: {
        create: computed.items.map((item, index) => ({
          productoId: item.productoId,
          productoVarianteId: item.varianteId ?? null,
          nombre: item.nombre,
          varianteNombre: item.varianteNombre ?? null,
          precio: item.precio,
          cantidad: item.cantidad,
          subtotal: moneyToNumber(importes.subtotales[index]),
          subtotalDecimal: importes.subtotales[index],
        })),
      },
    },
    include: { items: true },
  })

  // Un descuento + un MovimientoInventario VENTA por clave agregada, en la
  // misma tx: si algo falla no queda Venta, VentaItem, stock ni movimiento.
  await registrarStockVentaCaja(tx, { negocioId, ventaId: venta.id, plan: stockPlan })

  if (cambio) {
    // F4-C4: an exchange sale's ONLY real cobro is its charged difference D+
    // (none when D+ = 0), with the same cash ledger rule as any sale; its
    // internal credit is written by registrarCreditoCambioEnTx once the
    // CambioVenta exists. The normal-sale path below is unchanged.
    if (metodoPago && cambio.diferencia.gt(0)) {
      const cobroDiferencia = await tx.cobroVenta.create({
        data: {
          negocioId,
          ventaId: venta.id,
          metodo: metodoPago,
          importe: moneyToNumber(cambio.diferencia),
          importeDecimal: cambio.diferencia,
          estadoConciliacion: estadoConciliacionInicial(metodoPago),
        },
        select: { id: true },
      })
      if (cuentaEfectivoId) {
        await tx.operacionFinanciera.create({
          data: {
            negocioId,
            tipo: TIPO_OPERACION_VENTA_COBRO,
            cobroVentaId: cobroDiferencia.id,
            actorTipo: actor.tipo,
            actorId,
            turnoCajaId,
            movimientos: {
              create: [{ negocioId, cuentaId: cuentaEfectivoId, importe: moneyToNumber(cambio.diferencia), importeDecimal: cambio.diferencia }],
            },
          },
          select: { id: true },
        })
      }
    }
    return { ok: true as const, replayed: false, venta }
  }
  if (!metodoPago) throw new Error("A normal Caja sale always has its payment method")

  // F10-B0 — exactly one cobro for the whole sale (single method in the UI).
  const cobro = await tx.cobroVenta.create({
    data: {
      negocioId,
      ventaId: venta.id,
      metodo: metodoPago,
      importe: moneyToNumber(totalExacto),
      importeDecimal: totalExacto,
      estadoConciliacion: estadoConciliacionInicial(metodoPago),
    },
    select: { id: true },
  })

  // F10-B0 — minimal ledger: only cash enters it (one operation, one leg).
  // TRANSFERENCIA/OTRO: no financial movement (no MP account, no balance).
  if (cuentaEfectivoId) {
    await tx.operacionFinanciera.create({
      data: {
        negocioId,
        tipo: TIPO_OPERACION_VENTA_COBRO,
        cobroVentaId: cobro.id,
        actorTipo: actor.tipo,
        actorId,
        turnoCajaId,
        movimientos: {
          create: [{ negocioId, cuentaId: cuentaEfectivoId, importe: moneyToNumber(totalExacto), importeDecimal: totalExacto }],
        },
      },
      select: { id: true },
    })
  }

  return { ok: true as const, replayed: false, venta }
}

/**
 * F4-C4 — the internal exchange credit of an exchange sale: ONE CobroVenta
 * "CREDITO_CAMBIO" for exactly the applied credit, tied to its CambioVenta.
 * It is never money: no reconciliation, no ledger operation (SQL refuses one),
 * never counted as cash. Called only by the exchange service, inside the same
 * transaction, right after the CambioVenta row (SQL requires it to exist).
 */
export async function registrarCreditoCambioEnTx(
  tx: Prisma.TransactionClient,
  params: { negocioId: string; ventaId: string; cambioVentaId: string; importe: Prisma.Decimal }
): Promise<{ id: string }> {
  if (!params.importe.gt(0)) throw new Error("El crédito interno de un cambio debe ser mayor a cero.")
  return tx.cobroVenta.create({
    data: {
      negocioId: params.negocioId,
      ventaId: params.ventaId,
      cambioVentaId: params.cambioVentaId,
      metodo: METODO_COBRO_CREDITO_CAMBIO,
      importe: moneyToNumber(params.importe),
      importeDecimal: params.importe,
      estadoConciliacion: "NO_APLICA",
    },
    select: { id: true },
  })
}

// ============================================
// F10-B1 — request body parsing shared by the owner and cashier routes
// ============================================
// Same validation and messages the owner route always had; the client only
// chooses WHICH products/variants and quantities — never prices or totals.
export type ParsedVentaCajaBody =
  | { ok: true; metodoPago: MetodoPagoVenta; lines: ServerSaleLineInput[] }
  | { ok: false; error: string }

export function parseVentaCajaRequestBody(body: unknown): ParsedVentaCajaBody {
  const { metodoPago, items } = (body ?? {}) as { metodoPago?: unknown; items?: unknown }
  if (!isValidMetodoPagoVenta(metodoPago)) return { ok: false, error: "Método de pago inválido" }
  if (!Array.isArray(items) || items.length === 0) return { ok: false, error: "La venta no tiene productos" }
  const lines: ServerSaleLineInput[] = []
  for (const raw of items as unknown[]) {
    // P2-T56-R2C: varianteId is optional and, like price/name, NEVER trusted
    // beyond "which variant was picked" — its precio always comes from the DB.
    const line = raw as { productoId?: unknown; varianteId?: unknown; cantidad?: unknown }
    if (typeof line?.productoId !== "string" || !line.productoId || typeof line.cantidad !== "number") {
      return { ok: false, error: "Cada línea requiere productoId y cantidad" }
    }
    if (line.varianteId !== undefined && line.varianteId !== null && typeof line.varianteId !== "string") {
      return { ok: false, error: "varianteId inválido" }
    }
    lines.push({
      productoId: line.productoId,
      varianteId: (line.varianteId as string | null | undefined) ?? undefined,
      cantidad: line.cantidad,
    })
  }
  return { ok: true, metodoPago, lines }
}
