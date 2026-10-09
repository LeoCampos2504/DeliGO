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
  type MetodoPagoVenta,
  type ServerSaleLineInput,
} from "@/lib/caja-venta"
import { isMoneyInRange, MoneyError, moneyToNumber, saleAmountsExact, type SaleAmountsExact } from "@/lib/money"
import { CAJA_TURNOS_MODO_OBLIGATORIO, TURNO_ESTADO_ABIERTO } from "@/lib/caja-turnos-service"
import {
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

export interface RegistrarVentaCajaInput {
  negocioId: string
  actor: VentaCajaActor
  metodoPago: MetodoPagoVenta
  lines: ServerSaleLineInput[]
  /** null = legacy client without Idempotency-Key (owner route transition only). */
  idempotencyKey: string | null
  /**
   * F10-B2.1: the actor's open shift, resolved by the caller from the verified
   * session (turnoAbiertoDeActor) — NEVER taken from the request body. The
   * engine re-validates it. null/undefined = sale without shift.
   */
  turnoCajaId?: string | null
}

export type VentaCajaConItems = Prisma.VentaGetPayload<{ include: { items: true } }>

export type RegistrarVentaCajaResult =
  | { ok: true; replayed: boolean; venta: VentaCajaConItems }
  | { ok: false; status: 400 | 403 | 409; error: string; code?: string }

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
export type VentaCajaRespuesta = Omit<VentaCajaConItems, "totalDecimal" | "items"> & {
  items: Array<Omit<VentaCajaConItems["items"][number], "subtotalDecimal">>
}

export function ventaCajaParaRespuesta(venta: VentaCajaConItems): VentaCajaRespuesta {
  const { totalDecimal: _totalDecimal, items, ...rest } = venta
  void _totalDecimal
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
export function fingerprintVentaCaja(negocioId: string, metodoPago: string, lines: ServerSaleLineInput[]): string {
  return createHash("sha256").update(`${negocioId}\n${canonicalVentaCajaRequest(metodoPago, lines)}`).digest("hex")
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
 * Ensures the negocio's system cash account exists, OUTSIDE the sale
 * transaction (INSERT … ON CONFLICT DO NOTHING in autocommit) so concurrent
 * first sales never fight over it and the Serializable sale transaction that
 * follows always sees it committed.
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
 * F10-B2.1 — the cash account of ONE physical register (created outside the
 * sale transaction with ON CONFLICT DO NOTHING, like the system account).
 * Separate per register: cash sold at one register never increases another's.
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

export async function registrarVentaCaja(db: SaleDb, input: RegistrarVentaCajaInput): Promise<RegistrarVentaCajaResult> {
  const { negocioId, actor, metodoPago, lines: requestedLines, idempotencyKey } = input
  const turnoCajaId = input.turnoCajaId ?? null
  const fingerprint = idempotencyKey ? fingerprintVentaCaja(negocioId, metodoPago, requestedLines) : null
  // F10-B2.1: the register of the shift (tenant-scoped) decides the cash account.
  let cajaFisicaIdDelTurno: string | null = null
  if (turnoCajaId) {
    const turnoPre = await db.turnoCaja.findFirst({ where: { id: turnoCajaId, negocioId }, select: { cajaFisicaId: true } })
    if (!turnoPre) return TURNO_NO_DISPONIBLE
    cajaFisicaIdDelTurno = turnoPre.cajaFisicaId
  }
  const cuentaEfectivoId =
    metodoPago !== "EFECTIVO"
      ? null
      : cajaFisicaIdDelTurno
        ? await asegurarCuentaEfectivoCajaFisica(db, negocioId, cajaFisicaIdDelTurno)
        : await asegurarCuentaEfectivoCaja(db, negocioId)

  try {
    return await runStockSerializable(db, async (tx) => {
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

      // F10-B2.1: the shift must still be OPEN, of THIS negocio, on the same
      // register, and the actor must be its responsible person — a shift id
      // the actor does not own is never accepted.
      if (turnoCajaId) {
        const turno = await tx.turnoCaja.findFirst({
          where: { id: turnoCajaId, negocioId, estado: TURNO_ESTADO_ABIERTO, cajaFisicaId: cajaFisicaIdDelTurno!, responsableTipo: actor.tipo, responsableId: actorId },
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

      const venta = await tx.venta.create({
        data: {
          negocioId,
          total: moneyToNumber(totalExacto),
          totalDecimal: totalExacto,
          metodoPago,
          cantidadItems: computed.cantidadItems,
          idempotencyKey,
          idempotencyFingerprint: fingerprint,
          actorTipo: actor.tipo,
          actorId,
          empleadoId,
          turnoCajaId,
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
    })
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
