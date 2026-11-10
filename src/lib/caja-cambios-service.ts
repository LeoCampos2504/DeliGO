// ============================================
// F4-C4 — commercial exchanges and linked additional sales (server only)
// ============================================
// Specification: codex-reports/F4_C_SALE_EXCHANGES.md (D1–D14, T1–T9) and the
// operator decisions of 2026-11-09 (D1 retry policy, D2 returns of CAMBIO
// sales, D3 informative warnings, D4 no additional sale on a voided or fully
// returned sale, D5 F10-B2.1 untouched).
//
// An EXCHANGE is ONE Serializable transaction (ejecutarSerializableCambio)
// that composes the two existing single writers, never a second engine:
//   1. replay by Idempotency-Key (+ content fingerprint, same actor);
//   2. lock of the origin sale row (the same no-op UPDATE as F4-A);
//   3. V_ent priced from the authoritative catalog in this same transaction;
//   4. the return of what goes out (registrarDevolucionVentaEnTx) with the
//      compensation C = min(V_sal, V_ent): its apt units re-enter stock BEFORE
//      what comes in is planned (T7), its refund is D− only (now or PENDIENTE);
//   5. the linked CAMBIO sale of what comes in (registrarVentaCajaEnTx): stock
//      against physical − ACTIVE reservations, shift/register rules, and ONE
//      real cobro of D+ (with its cash leg when EFECTIVO);
//   6. the CambioVenta row (five exact amounts, informative warnings);
//   7. the internal credit C as a CREDITO_CAMBIO cobro (never money, never in
//      the ledger) — registrarCreditoCambioEnTx, in the sale engine file;
//   8. the owner notice (employee only) and the audit record.
// Any refusal or error in any step rolls EVERYTHING back. SQL (migrations
// 20261106120000 / 20261109120000) enforces the same invariants again.
//
// A LINKED ADDITIONAL SALE is a normal Caja sale (its own method, one cobro)
// linked to the origin sale, refused when that sale was voided or every unit
// was already returned (then a new independent sale is the way).

import { createHash, randomUUID } from "node:crypto"
import { Prisma, type PrismaClient } from "@prisma/client"
import { auditLogWithClient } from "@/lib/audit"
import { exigirResultadoOk, resolverAbortoCompartido, TransaccionCompartidaAbortada } from "@/lib/caja-transaccion-compartida"
import {
  ConflictoCambioAgotado,
  ejecutarSerializableCambio,
  esTimeoutTransaccion,
  type ContextoIntento,
  type OpcionesEjecutorCambio,
} from "@/lib/caja-ejecutor-cambio"
import {
  parseVentaCajaRequestBody,
  registrarCreditoCambioEnTx,
  registrarVentaCajaEnTx,
  type VentaCajaConItems,
} from "@/lib/caja-venta-service"
import {
  DEVOLUCION_TIPO_ANULACION,
  DEVOLUCION_TIPO_PARCIAL,
  describirReintegro,
  mapDevolucionDbError,
  parseDevolucionBody,
  parseReintegro,
  referenciaVenta,
  registrarDevolucionVentaEnTx,
  type DevolucionLineaSolicitada,
  type ReintegroMedio,
} from "@/lib/caja-devoluciones-service"
import {
  canonicalVentaCajaRequest,
  computeSaleFromAuthoritativeProducts,
  isValidMetodoPagoVenta,
  METODO_PAGO_VENTA_CAMBIO,
  type MetodoPagoVenta,
  type ServerSaleLineInput,
} from "@/lib/caja-venta"
import { isMoneyInRange, MoneyError, moneyToNumber, saleAmountsExact } from "@/lib/money"
import { lineaVigente, nombreLinea, ULTIMA_CORRECCION_INCLUDE } from "@/lib/caja-venta-vigente"
import { mapStockLifecycleError } from "@/lib/stock-lifecycle"
import { TURNO_ESTADO_ABIERTO, type CajaActor } from "@/lib/caja-turnos-service"

type Db = PrismaClient
type Tx = Prisma.TransactionClient

export const NOTIFICACION_TIPO_CAMBIO = "caja_cambio"
export const NOTIFICACION_TIPO_VENTA_ADICIONAL = "caja_venta_adicional"
export const CAMBIO_ITEMS_MAX = 200
export const UMBRAL_ANTIGUEDAD_DIAS_PREDETERMINADO = 30
export const UMBRAL_CADENA_CAMBIOS_PREDETERMINADO = 3

export type CambioResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: 400 | 403 | 404 | 409 | 503; error: string; code?: string }

type Rechazo = Extract<CambioResult<never>, { ok: false }>
const fail = (status: Rechazo["status"], error: string, code?: string): Rechazo => ({ ok: false, status, error, ...(code ? { code } : {}) })
/** Inside a transaction: refuse and roll back everything already written. */
const abortar = (status: Rechazo["status"], error: string, code?: string): never => {
  throw new TransaccionCompartidaAbortada(fail(status, error, code))
}

const D = (value: number | string) => new Prisma.Decimal(String(value))
const MONEY_PATTERN = /^\d{1,10}(\.\d{1,2})?$/
const IMPORTES_CAMBIARON_TEXTO = "Los importes del cambio ya no coinciden con la cotización (cambió un precio o lo devuelto). No se registró nada: pedí una nueva cotización."

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------

export type ReintegroCambio = { modo: "REALIZADO"; medio: ReintegroMedio } | { modo: "PENDIENTE" }

export interface CambioSolicitud {
  motivo: string
  /** What goes out (lines of the origin sale; same rules as an F4-A partial return). */
  salen: DevolucionLineaSolicitada[]
  /** What comes in (priced by the server, like a Caja sale). */
  entran: ServerSaleLineInput[]
  /** Real method of the charged difference D+ (required only when D+ > 0). */
  medioDiferencia: MetodoPagoVenta | null
  /** What happens with D− (required only when D− > 0): refunded now or PENDING. */
  reintegro: ReintegroCambio | null
  /** Owner only: register for cash (null = automatic, like a sale). */
  cajaFisicaId: string | null
  /** Optional amounts the client showed (quote): any drift refuses the exchange. */
  esperado: { salida: Prisma.Decimal; entrada: Prisma.Decimal } | null
}

/**
 * An exact money amount from the client (the quote returns strings "2000.00").
 * A JS number is accepted only when its own decimal text already has at most
 * two decimals ("2000", "2000.5"): it is never rounded (0.30000000000000004 is
 * refused, not silently turned into 0.30). Compared later with Decimal.equals.
 */
function parseImporte(value: unknown): Prisma.Decimal | null {
  const text = typeof value === "number" && Number.isFinite(value) ? String(value) : typeof value === "string" ? value.trim() : ""
  return MONEY_PATTERN.test(text) ? D(text) : null
}

/**
 * Body of POST …/ventas/[id]/cambios (and of its quote). The client chooses
 * WHICH lines go out and come in, quantities, the stock decision and how the
 * money difference is settled — never prices, amounts, business or actor.
 */
export function parseCambioBody(body: unknown, modo: "REGISTRAR" | "COTIZAR"): CambioResult<CambioSolicitud> {
  const raw = (body ?? {}) as Record<string, unknown>
  if (!Array.isArray(raw.salen) || raw.salen.length === 0) return fail(400, "Elegí al menos un producto que sale.", "SALEN_INVALIDOS")
  if (!Array.isArray(raw.entran) || raw.entran.length === 0) return fail(400, "Elegí al menos un producto que entra.", "ENTRAN_INVALIDOS")
  if (raw.entran.length > CAMBIO_ITEMS_MAX) return fail(400, "Demasiados productos en la operación.", "ENTRAN_INVALIDOS")
  // What goes out: exactly the F4-A partial-return rules (lines, quantities, stock decision, motive).
  const devolucion = parseDevolucionBody({
    tipo: DEVOLUCION_TIPO_PARCIAL,
    items: raw.salen,
    motivo: modo === "COTIZAR" && raw.motivo === undefined ? "Cotización" : raw.motivo,
    reintegro: { modo: "PENDIENTE" },
    confirmo: true,
    cajaFisicaId: raw.cajaFisicaId,
  })
  if (!devolucion.ok) return devolucion
  // What comes in: exactly the Caja sale line rules (the method is irrelevant here).
  const venta = parseVentaCajaRequestBody({ metodoPago: "EFECTIVO", items: raw.entran })
  if (!venta.ok) return fail(400, venta.error, "ENTRAN_INVALIDOS")

  let medioDiferencia: MetodoPagoVenta | null = null
  if (raw.medioDiferencia !== undefined && raw.medioDiferencia !== null) {
    if (!isValidMetodoPagoVenta(raw.medioDiferencia)) return fail(400, "Elegí cómo se cobra la diferencia.", "MEDIO_DIFERENCIA_INVALIDO")
    medioDiferencia = raw.medioDiferencia
  }
  let reintegro: ReintegroCambio | null = null
  if (raw.reintegro !== undefined && raw.reintegro !== null) {
    const parsed = parseReintegro(raw.reintegro)
    // D4: the difference in favor of the customer is refunded now or stays PENDING — never "not applicable".
    if (!parsed || parsed.modo === "NO_CORRESPONDE") return fail(400, "Indicá si devolvés la diferencia ahora o queda pendiente.", "REINTEGRO_INVALIDO")
    reintegro = parsed
  }
  let esperado: CambioSolicitud["esperado"] = null
  if (raw.esperado !== undefined && raw.esperado !== null) {
    const e = raw.esperado as { salida?: unknown; entrada?: unknown }
    const salida = parseImporte(e?.salida)
    const entrada = parseImporte(e?.entrada)
    if (!salida || !entrada) return fail(400, "Los importes de la cotización son inválidos. Pedí una nueva cotización.", "ESPERADO_INVALIDO")
    esperado = { salida, entrada }
  }
  // H1 (operator, 2026-11-09): a confirmation must carry the amounts the
  // cashier was shown (the quote). Any difference with the amounts recomputed
  // inside the confirmation transaction refuses the exchange (409).
  if (modo === "REGISTRAR" && !esperado) {
    return fail(400, "Falta confirmar los importes de la cotización. Pedí una cotización y confirmá esos importes.", "ESPERADO_REQUERIDO")
  }
  if (modo === "REGISTRAR" && raw.confirmo !== true) return fail(400, "Confirmá el cambio para continuar.", "CONFIRMACION_CAMBIO_REQUERIDA")
  return {
    ok: true,
    value: { motivo: devolucion.value.motivo, salen: devolucion.value.lineas, entran: venta.lines, medioDiferencia, reintegro, cajaFisicaId: devolucion.value.cajaFisicaId, esperado },
  }
}

export function fingerprintCambio(negocioId: string, ventaId: string, s: CambioSolicitud, actor: CajaActor): string {
  const canonical = JSON.stringify({
    negocioId,
    ventaId,
    actor: actor.tipo === "EMPLEADO" ? `EMPLEADO:${actor.empleadoId}` : "NEGOCIO",
    motivo: s.motivo,
    caja: actor.tipo === "NEGOCIO" ? s.cajaFisicaId : null,
    medioDiferencia: s.medioDiferencia,
    reintegro: s.reintegro,
    esperado: s.esperado ? [s.esperado.salida.toFixed(2), s.esperado.entrada.toFixed(2)] : null,
    salen: [...s.salen]
      .sort((a, b) => (a.ventaItemId < b.ventaItemId ? -1 : a.ventaItemId > b.ventaItemId ? 1 : 0))
      .map((l) => [l.ventaItemId, l.cantidad?.toString() ?? null, l.reingresaStock]),
    entran: canonicalVentaCajaRequest(METODO_PAGO_VENTA_CAMBIO, s.entran),
  })
  return createHash("sha256").update(`F4-C4-CAMBIO\n${canonical}`).digest("hex")
}

// Deterministic RFC 4122 v5 keys of the inner return and sale of ONE exchange
// (derived from its Idempotency-Key), so the inner rows never collide with a
// client key and a retried attempt reuses exactly the same keys.
const NAMESPACE_CLAVES_CAMBIO = "6f1c2c4e-8a1b-4d3e-9f2a-4b7c0d1e2f30"

export function uuidV5(nombre: string, namespace = NAMESPACE_CLAVES_CAMBIO): string {
  const ns = Buffer.from(namespace.replace(/-/g, ""), "hex")
  const hash = createHash("sha1").update(Buffer.concat([ns, Buffer.from(nombre, "utf8")])).digest()
  const b = Buffer.from(hash.subarray(0, 16))
  b[6] = (b[6] & 0x0f) | 0x50
  b[8] = (b[8] & 0x3f) | 0x80
  const h = b.toString("hex")
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

export function clavesInternasCambio(negocioId: string, idempotencyKey: string) {
  return {
    devolucion: uuidV5(`${negocioId}:${idempotencyKey}:devolucion`),
    venta: uuidV5(`${negocioId}:${idempotencyKey}:venta`),
  }
}

// ---------------------------------------------------------------------------
// P1 — informative warnings (never block)
// ---------------------------------------------------------------------------

export type CodigoAdvertencia = "VENTA_ANTIGUA" | "CADENA_LARGA" | "PRECIO_HEREDADO" | "VENTA_CORREGIDA" | "VENTA_DE_TURNO_CERRADO"
export interface AdvertenciaCambio {
  codigo: CodigoAdvertencia
  nivel: "INFO"
  datos: Record<string, string | number | boolean | string[]>
  umbral?: number
}
export interface AdvertenciasCambio {
  version: 1
  items: AdvertenciaCambio[]
}

export function umbralesAvisoCambio(negocio: { cambioAvisoAntiguedadDias: number | null; cambioAvisoCadenaCambios: number | null } | null) {
  return {
    antiguedadDias: negocio?.cambioAvisoAntiguedadDias ?? UMBRAL_ANTIGUEDAD_DIAS_PREDETERMINADO,
    cadenaCambios: negocio?.cambioAvisoCadenaCambios ?? UMBRAL_CADENA_CAMBIOS_PREDETERMINADO,
  }
}

/** Pure rule (unit-tested): which informative warnings an exchange carries. */
export function calcularAdvertenciasCambio(p: {
  ahora: Date
  ventaCreadaEn: Date
  cambiosPrevios: number
  umbralAntiguedadDias: number
  umbralCadenaCambios: number
  lineasPrecioHeredado: string[]
  ventaCorregida: boolean
  turnoOrigenCerrado: boolean
}): AdvertenciasCambio {
  const items: AdvertenciaCambio[] = []
  const dias = Math.floor((p.ahora.getTime() - p.ventaCreadaEn.getTime()) / 86_400_000)
  if (dias > p.umbralAntiguedadDias) items.push({ codigo: "VENTA_ANTIGUA", nivel: "INFO", datos: { dias }, umbral: p.umbralAntiguedadDias })
  if (p.cambiosPrevios >= p.umbralCadenaCambios) items.push({ codigo: "CADENA_LARGA", nivel: "INFO", datos: { cambiosPrevios: p.cambiosPrevios }, umbral: p.umbralCadenaCambios })
  if (p.lineasPrecioHeredado.length > 0) items.push({ codigo: "PRECIO_HEREDADO", nivel: "INFO", datos: { productos: p.lineasPrecioHeredado } })
  if (p.ventaCorregida) items.push({ codigo: "VENTA_CORREGIDA", nivel: "INFO", datos: {} })
  if (p.turnoOrigenCerrado) items.push({ codigo: "VENTA_DE_TURNO_CERRADO", nivel: "INFO", datos: {} })
  return { version: 1, items }
}

const TEXTO_ADVERTENCIA: Record<CodigoAdvertencia, (a: AdvertenciaCambio) => string> = {
  VENTA_ANTIGUA: (a) => `venta de hace ${a.datos.dias} días`,
  CADENA_LARGA: (a) => `${a.datos.cambiosPrevios} cambios anteriores en la cadena`,
  PRECIO_HEREDADO: () => "precio heredado de una corrección anterior",
  VENTA_CORREGIDA: () => "venta con correcciones",
  VENTA_DE_TURNO_CERRADO: () => "venta de un turno ya cerrado",
}

export function describirAdvertencias(advertencias: AdvertenciasCambio): string[] {
  return advertencias.items.map((a) => TEXTO_ADVERTENCIA[a.codigo](a))
}

/** Exchanges already registered in the whole chain linked by CAMBIO sales (before this one). */
async function contarCambiosDeLaCadena(tx: Tx, negocioId: string, ventaId: string): Promise<number> {
  const rows = await tx.$queryRaw<Array<{ cantidad: number }>>`
    WITH RECURSIVE arriba AS (
      SELECT "id", "ventaOrigenId", "vinculoTipo", 0 AS nivel FROM "ventas_caja" WHERE "id" = ${ventaId} AND "negocioId" = ${negocioId}
      UNION ALL
      SELECT v."id", v."ventaOrigenId", v."vinculoTipo", a.nivel + 1
        FROM "ventas_caja" v JOIN arriba a ON v."id" = a."ventaOrigenId"
       WHERE a."vinculoTipo" = 'CAMBIO' AND a.nivel < 1000
    ),
    raiz AS (SELECT "id" FROM arriba ORDER BY nivel DESC LIMIT 1),
    abajo AS (
      SELECT "id", 0 AS nivel FROM raiz
      UNION ALL
      SELECT v."id", b.nivel + 1
        FROM "ventas_caja" v JOIN abajo b ON v."ventaOrigenId" = b."id"
       WHERE v."vinculoTipo" = 'CAMBIO' AND b.nivel < 1000
    )
    SELECT COUNT(*)::int AS cantidad FROM "cambios_venta"
     WHERE "negocioId" = ${negocioId} AND "ventaOrigenId" IN (SELECT "id" FROM abajo)`
  return rows[0]?.cantidad ?? 0
}

// ---------------------------------------------------------------------------
// Shared steps
// ---------------------------------------------------------------------------

type ActorCambio = { tipo: "NEGOCIO" | "EMPLEADO"; actorId: string; empleadoId: string | null; nombre: string }

async function resolverActorCambio(tx: Tx, negocioId: string, actor: CajaActor): Promise<ActorCambio | null> {
  if (actor.tipo === "NEGOCIO") return { tipo: "NEGOCIO", actorId: negocioId, empleadoId: null, nombre: "Dueño" }
  const empleado = await tx.empleado.findFirst({ where: { id: actor.empleadoId, negocioId, activo: true, eliminado: false }, select: { id: true, nombre: true } })
  return empleado ? { tipo: "EMPLEADO", actorId: empleado.id, empleadoId: empleado.id, nombre: empleado.nombre } : null
}

/** The same no-op row lock as F4-A: concurrent operations on this sale serialize (40001 → retry). */
async function bloquearVenta(tx: Tx, negocioId: string, ventaId: string): Promise<boolean> {
  const locked = await tx.$queryRaw<Array<{ id: string }>>`
    UPDATE "ventas_caja" SET "cantidadItems" = "cantidadItems"
    WHERE "id" = ${ventaId} AND "negocioId" = ${negocioId}
    RETURNING "id"`
  return Boolean(locked[0])
}

/**
 * V_ent from the authoritative catalog, in this transaction — the same read,
 * pricing and exact amounts as the sale engine (which re-checks them: any
 * drift writes nothing).
 */
async function precioEntradaEnTx(tx: Tx, negocioId: string, lines: ServerSaleLineInput[]): Promise<Prisma.Decimal> {
  const productos = await tx.producto.findMany({
    where: { id: { in: lines.map((l) => l.productoId) }, negocioId, eliminado: false },
    include: { variantes: true },
  })
  const productsById = new Map(
    productos.map((p) => [
      p.id,
      { nombre: p.nombre, precio: p.precio, variantes: new Map(p.variantes.filter((v) => v.activo).map((v) => [v.id, { nombre: v.nombre, precio: v.precio }])) },
    ])
  )
  const computed = computeSaleFromAuthoritativeProducts(lines, productsById)
  if (!computed.ok) return abortar(400, computed.error, "ENTRAN_INVALIDOS")
  try {
    const importes = saleAmountsExact(computed.items)
    if (!isMoneyInRange(importes.total)) return abortar(400, "El importe de la venta está fuera del rango permitido", "ENTRAN_INVALIDOS")
    return importes.total
  } catch (error) {
    if (error instanceof MoneyError) return abortar(400, "El importe de la venta está fuera del rango permitido", "ENTRAN_INVALIDOS")
    throw error
  }
}

const money = (value: Prisma.Decimal) => `$${moneyToNumber(value).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
const auditActor = (actor: ActorCambio) => (actor.tipo === "EMPLEADO" ? { userId: actor.actorId, userType: "empleado" } : { userId: actor.actorId, userType: "negocio" })

// ---------------------------------------------------------------------------
// Exchange
// ---------------------------------------------------------------------------

export interface RegistrarCambioInput {
  negocioId: string
  actor: CajaActor
  /** Origin sale (URL), always resolved inside the session's negocio. */
  ventaId: string
  solicitud: CambioSolicitud
  idempotencyKey: string
  /** Employee only: the open shift resolved from the session (re-validated by the sale engine). */
  turnoCajaId?: string | null
}

export type CambioRegistrado = Prisma.CambioVentaGetPayload<Record<string, never>>

export interface ResumenCambio {
  importes: { salida: string; entrada: string; credito: string; diferenciaCobrada: string; diferenciaReintegro: string }
  liquidacion: "SIN_DIFERENCIA" | "COBRO" | "REINTEGRO"
  advertencias: AdvertenciasCambio
  salen: Array<{ ventaItemId: string; nombre: string; cantidad: number; importe: string }>
  entran: Array<{ productoId: string | null; productoVarianteId: string | null; nombre: string; varianteNombre: string | null; precio: number; cantidad: number; subtotal: string }>
}

/** Thrown by a quote after computing everything: the whole transaction is rolled back. */
class SimulacionCambio extends Error {
  readonly resumen: ResumenCambio
  constructor(resumen: ResumenCambio) {
    super("Simulación de cambio (rollback)")
    this.name = "SimulacionCambio"
    this.resumen = resumen
  }
}

async function replayCambio(reader: Pick<Tx, "cambioVenta">, negocioId: string, key: string, fingerprint: string, actor: CajaActor): Promise<CambioResult<{ cambio: CambioRegistrado; replayed: boolean }> | null> {
  const existing = await reader.cambioVenta.findUnique({ where: { negocioId_idempotencyKey: { negocioId, idempotencyKey: key } } })
  if (!existing) return null
  const actorId = actor.tipo === "EMPLEADO" ? actor.empleadoId : negocioId
  if (existing.idempotencyFingerprint === fingerprint && existing.actorTipo === actor.tipo && existing.actorId === actorId) {
    return { ok: true, value: { cambio: existing, replayed: true } }
  }
  return fail(409, "Este intento ya se usó para otra operación. Volvé a intentarlo.", "IDEMPOTENCY_KEY_REUSED")
}

/**
 * The in-transaction exchange. `simular` (quote) computes everything with
 * the real engines and then rolls the transaction back (SimulacionCambio).
 */
export async function registrarCambioVentaEnTx(
  tx: Tx,
  input: RegistrarCambioInput,
  contexto: ContextoIntento,
  simular = false
): Promise<CambioResult<{ cambio: CambioRegistrado; replayed: boolean }>> {
  const { negocioId, actor, ventaId, solicitud: s, idempotencyKey } = input
  if (typeof ventaId !== "string" || !ventaId.trim()) return fail(400, "Venta inválida.", "VENTA_INVALIDA")
  const fingerprint = fingerprintCambio(negocioId, ventaId, s, actor)
  if (!simular) {
    const replay = await replayCambio(tx, negocioId, idempotencyKey, fingerprint, actor)
    if (replay) return replay
  }

  const actorResuelto = await resolverActorCambio(tx, negocioId, actor)
  if (!actorResuelto) return fail(403, "Acceso denegado")
  if (!(await bloquearVenta(tx, negocioId, ventaId))) return fail(404, "Venta no encontrada.")
  const origen = await tx.venta.findFirstOrThrow({
    where: { id: ventaId, negocioId },
    include: { items: true, correcciones: ULTIMA_CORRECCION_INCLUDE },
  })

  const entrada = await precioEntradaEnTx(tx, negocioId, s.entran)
  // H1: the quoted amounts are mandatory to confirm; the value of what comes
  // in is checked before anything is written, the returned value right after
  // the return engine computes it (both exact Decimal comparisons).
  if (!simular) {
    if (!s.esperado) return abortar(400, "Falta confirmar los importes de la cotización. Pedí una cotización y confirmá esos importes.", "ESPERADO_REQUERIDO")
    if (!s.esperado.entrada.equals(entrada)) return abortar(409, IMPORTES_CAMBIARON_TEXTO, "IMPORTES_CAMBIARON")
  }
  const claves = clavesInternasCambio(negocioId, idempotencyKey)
  const cajaOwner = actor.tipo === "NEGOCIO" ? s.cajaFisicaId : null

  // 4. What goes out: the F4-A return engine, compensating C and refunding D− only.
  const devolucionRes = exigirResultadoOk(
    await registrarDevolucionVentaEnTx(tx, {
      negocioId,
      actor,
      ventaId,
      solicitud: { tipo: DEVOLUCION_TIPO_PARCIAL, motivo: s.motivo, reintegro: s.reintegro ?? { modo: "PENDIENTE" }, lineas: s.salen, cajaFisicaId: cajaOwner },
      idempotencyKey: claves.devolucion,
      compensacion: { importeEntrada: entrada },
      omitirAviso: true,
    })
  )
  const devolucion = devolucionRes.value.devolucion
  if (devolucionRes.value.replayed) throw new Error("F4-C4: clave interna de devolución ya usada")
  const salida = devolucion.importeDecimal
  const credito = devolucion.importeCompensadoDecimal
  const diferenciaReintegro = salida.minus(credito)
  const diferenciaCobrada = entrada.minus(credito)

  if (!simular) {
    if (diferenciaReintegro.gt(0) && !s.reintegro) abortar(400, "Indicá si devolvés la diferencia ahora o queda pendiente.", "REINTEGRO_REQUERIDO")
    if (diferenciaCobrada.gt(0) && !s.medioDiferencia) abortar(400, "Indicá cómo se cobra la diferencia.", "MEDIO_DIFERENCIA_REQUERIDO")
    if (!s.esperado || !s.esperado.salida.equals(salida) || !s.esperado.entrada.equals(entrada)) {
      abortar(409, IMPORTES_CAMBIARON_TEXTO, "IMPORTES_CAMBIARON")
    }
  }
  // A quote never moves real money: without a chosen method it uses a non-cash placeholder.
  const medioDiferencia = diferenciaCobrada.gt(0) ? (s.medioDiferencia ?? (simular ? "TRANSFERENCIA" : null)) : null

  // 5. What comes in: the single sale engine, linked as CAMBIO, real cobro = D+.
  const ventaRes = exigirResultadoOk(
    await registrarVentaCajaEnTx(tx, {
      negocioId,
      actor: actor.tipo === "EMPLEADO" ? { tipo: "EMPLEADO", empleadoId: actor.empleadoId } : { tipo: "NEGOCIO" },
      metodoPago: METODO_PAGO_VENTA_CAMBIO,
      lines: s.entran,
      idempotencyKey: claves.venta,
      turnoCajaId: actor.tipo === "EMPLEADO" ? input.turnoCajaId ?? null : undefined,
      ownerCajaFisicaId: actor.tipo === "NEGOCIO" ? cajaOwner : undefined,
      vinculo: { tipo: "CAMBIO", ventaOrigenId: ventaId, credito, diferencia: diferenciaCobrada, medioDiferencia },
    })
  )
  if (ventaRes.replayed) throw new Error("F4-C4: clave interna de venta ya usada")
  const ventaNueva: VentaCajaConItems = ventaRes.venta

  // 6. Informative warnings (P1) — never block.
  const negocio = await tx.negocio.findUnique({ where: { id: negocioId }, select: { cambioAvisoAntiguedadDias: true, cambioAvisoCadenaCambios: true } })
  const umbrales = umbralesAvisoCambio(negocio)
  const ultimaCorreccion = origen.correcciones[0]?.lineas
  const salenIds = new Set(s.salen.map((l) => l.ventaItemId))
  const turnoOrigen = origen.turnoCajaId ? await tx.turnoCaja.findUnique({ where: { id: origen.turnoCajaId }, select: { estado: true } }) : null
  const advertencias = calcularAdvertenciasCambio({
    ahora: new Date(),
    ventaCreadaEn: origen.createdAt,
    cambiosPrevios: await contarCambiosDeLaCadena(tx, negocioId, ventaId),
    umbralAntiguedadDias: umbrales.antiguedadDias,
    umbralCadenaCambios: umbrales.cadenaCambios,
    lineasPrecioHeredado: origen.items
      .filter((item) => salenIds.has(item.id))
      .map((item) => lineaVigente(item, ultimaCorreccion))
      .filter((linea) => linea.precioHeredado)
      .map((linea) => nombreLinea(linea)),
    ventaCorregida: origen.correcciones.length > 0,
    turnoOrigenCerrado: Boolean(turnoOrigen && turnoOrigen.estado !== TURNO_ESTADO_ABIERTO),
  })

  const liquidacion: ResumenCambio["liquidacion"] = diferenciaCobrada.gt(0) ? "COBRO" : diferenciaReintegro.gt(0) ? "REINTEGRO" : "SIN_DIFERENCIA"
  const resumen: ResumenCambio = {
    importes: { salida: salida.toFixed(2), entrada: entrada.toFixed(2), credito: credito.toFixed(2), diferenciaCobrada: diferenciaCobrada.toFixed(2), diferenciaReintegro: diferenciaReintegro.toFixed(2) },
    liquidacion,
    advertencias,
    salen: devolucion.items.map((item) => ({ ventaItemId: item.ventaItemId, nombre: nombreLinea(item.ventaItem.correcciones[0] ?? item.ventaItem), cantidad: item.cantidad, importe: item.importeDecimal.toFixed(2) })),
    entran: ventaNueva.items.map((item) => ({
      productoId: item.productoId,
      productoVarianteId: item.productoVarianteId,
      nombre: item.nombre,
      varianteNombre: item.varianteNombre,
      precio: item.precio,
      cantidad: item.cantidad,
      subtotal: (item.subtotalDecimal ?? D(item.subtotal)).toFixed(2),
    })),
  }

  // 7. The exchange row (SQL re-checks every amount, business and shift).
  const cambio = await tx.cambioVenta.create({
    data: {
      negocioId,
      ventaOrigenId: ventaId,
      devolucionId: devolucion.id,
      ventaNuevaId: ventaNueva.id,
      importeSalidaDecimal: salida,
      importeEntradaDecimal: entrada,
      creditoAplicadoDecimal: credito,
      diferenciaCobradaDecimal: diferenciaCobrada,
      diferenciaReintegroDecimal: diferenciaReintegro,
      liquidacion,
      actorTipo: actorResuelto.tipo,
      actorId: actorResuelto.actorId,
      empleadoId: actorResuelto.empleadoId,
      turnoCajaId: ventaNueva.turnoCajaId,
      motivo: s.motivo,
      advertencias: advertencias as unknown as Prisma.InputJsonValue,
      idempotencyKey: simular ? randomUUID() : idempotencyKey,
      idempotencyFingerprint: fingerprint,
    },
  })
  // 8. The internal credit: never money, never in the ledger.
  if (credito.gt(0)) await registrarCreditoCambioEnTx(tx, { negocioId, ventaId: ventaNueva.id, cambioVentaId: cambio.id, importe: credito })

  if (simular) throw new SimulacionCambio(resumen)

  const reintegroTexto = diferenciaReintegro.gt(0) ? describirReintegro(devolucion.reintegroEstado as "PENDIENTE" | "REALIZADO", devolucion.reintegroMedio) : null
  const dinero = liquidacion === "COBRO"
    ? `cobró ${money(diferenciaCobrada)} de diferencia (${medioDiferencia})`
    : liquidacion === "REINTEGRO"
      ? `diferencia a favor del cliente ${money(diferenciaReintegro)}: ${reintegroTexto}`
      : "sin diferencia de dinero"
  const avisos = describirAdvertencias(advertencias)

  // 9. Owner notice: every exchange made by an employee (D8).
  if (actorResuelto.tipo === "EMPLEADO") {
    const salenTexto = resumen.salen.map((l) => `${l.cantidad} × ${l.nombre}`).join(", ")
    const entranTexto = resumen.entran.map((l) => `${l.cantidad} × ${l.varianteNombre ? `${l.nombre} — ${l.varianteNombre}` : l.nombre}`).join(", ")
    await tx.notificacion.create({
      data: {
        userId: negocioId,
        userType: "negocio",
        tipo: NOTIFICACION_TIPO_CAMBIO,
        titulo: "Cambio de productos",
        cuerpo: `${actorResuelto.nombre} registró un cambio de la venta #${referenciaVenta(ventaId)}: salen ${salenTexto}; entran ${entranTexto}. Dinero: ${dinero}. Motivo: ${s.motivo}.${avisos.length ? ` Avisos: ${avisos.join("; ")}.` : ""}`,
        negocioId,
        datos: JSON.stringify({
          navigateTo: { negocio: "caja" },
          cambioId: cambio.id,
          ventaId,
          ventaRef: referenciaVenta(ventaId),
          ventaNuevaId: ventaNueva.id,
          empleadoNombre: actorResuelto.nombre,
          importes: resumen.importes,
          liquidacion,
          medioDiferencia,
          reintegroEstado: diferenciaReintegro.gt(0) ? devolucion.reintegroEstado : null,
          reintegroMedio: diferenciaReintegro.gt(0) ? devolucion.reintegroMedio : null,
          advertencias: advertencias.items.map((a) => a.codigo),
          motivo: s.motivo,
          fecha: cambio.createdAt.toISOString(),
        }),
      },
    })
  }

  // 10. Audit, in the same transaction (§10 minimum fields).
  await auditLogWithClient(tx, {
    ...auditActor(actorResuelto),
    accion: "venta.cambio",
    recurso: "venta",
    recursoId: ventaId,
    detalle: {
      negocioId,
      cambioId: cambio.id,
      devolucionId: devolucion.id,
      ventaNuevaId: ventaNueva.id,
      ...resumen.importes,
      liquidacion,
      medioDiferencia,
      reintegroEstado: devolucion.reintegroEstado,
      reintegroMedio: devolucion.reintegroMedio,
      reintegroTurnoCajaId: devolucion.reintegroTurnoCajaId,
      turnoCajaId: ventaNueva.turnoCajaId,
      motivo: s.motivo,
      salen: devolucion.items.map((i) => ({ ventaItemId: i.ventaItemId, cantidad: i.cantidad, importe: i.importeDecimal.toString(), stockResultado: i.stockResultado, movimientoInventarioId: i.movimientoInventarioId })),
      entran: resumen.entran,
      advertencias: advertencias.items,
      intento: contexto.intento,
    },
  })

  return { ok: true, value: { cambio, replayed: false } }
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

/** Maps the SQL guards specific to exchanges / linked sales (defense in depth). */
export function mapCambioDbError(error: unknown): Rechazo | null {
  const text = error instanceof Error ? error.message : String(error)
  if (text.includes("additional sale cannot be linked to a voided sale")) {
    return fail(409, "La venta original fue anulada: registrá una venta nueva e independiente.", "VENTA_ORIGEN_ANULADA")
  }
  if (text.includes("additional sale cannot be linked to a fully returned sale")) {
    return fail(409, "Todos los productos de la venta original ya fueron devueltos: registrá una venta nueva e independiente.", "VENTA_ORIGEN_DEVUELTA")
  }
  if (/sale exchange|exchange credit|exchange sale|linked sale|internal exchange credit|sale return payment method/.test(text)) {
    return fail(409, "No se pudo registrar el cambio porque los datos dejaron de ser consistentes. Actualizá la venta e intentá de nuevo.", "CAMBIO_INCONSISTENTE")
  }
  return null
}

/** Common translation of the errors of an exchange operation into a controlled refusal. */
function traducirError(error: unknown): Rechazo | null {
  if (error instanceof ConflictoCambioAgotado) {
    return fail(409, "No se pudo completar la operación por otra simultánea. No se registró nada: intentá de nuevo.", "CAMBIO_CONFLICTO_CONCURRENTE")
  }
  if (esTimeoutTransaccion(error)) {
    return fail(503, "No pudimos confirmar la operación a tiempo. Reintentá con el mismo pedido: si ya se registró, vas a ver el mismo resultado.", "CAMBIO_RESULTADO_INCIERTO")
  }
  const devolucion = mapDevolucionDbError(error)
  if (devolucion) return fail(devolucion.status, devolucion.error, devolucion.code)
  const stock = mapStockLifecycleError(error)
  if (stock) return fail(stock.status as Rechazo["status"], stock.body.error, stock.body.code)
  return mapCambioDbError(error)
}

export interface OpcionesCambio extends OpcionesEjecutorCambio {
  /** Test seam: replaces the executor (e.g. to force exhausted conflicts). */
  ejecutor?: typeof ejecutarSerializableCambio
}

/** Registers an exchange (owner and cashier routes). */
export async function registrarCambioVenta(db: Db, input: RegistrarCambioInput, opciones: OpcionesCambio = {}): Promise<CambioResult<{ cambio: CambioRegistrado; replayed: boolean }>> {
  const ejecutar = opciones.ejecutor ?? ejecutarSerializableCambio
  const fingerprint = fingerprintCambio(input.negocioId, input.ventaId, input.solicitud, input.actor)
  try {
    const result = await resolverAbortoCompartido(() => ejecutar(db, (tx, contexto) => registrarCambioVentaEnTx(tx, input, contexto), opciones))
    return result as CambioResult<{ cambio: CambioRegistrado; replayed: boolean }>
  } catch (error) {
    // A concurrent request with the same key committed first (unique key of the
    // exchange or of its derived inner rows) or kept winning: answer with that
    // exchange, never a second one.
    if (isUniqueViolation(error) || error instanceof ConflictoCambioAgotado) {
      const replay = await replayCambio(db, input.negocioId, input.idempotencyKey, fingerprint, input.actor)
      if (replay) return replay
    }
    const traducido = traducirError(error)
    if (traducido) return traducido
    throw error
  }
}

/** Quote: the exact amounts, lines and warnings of an exchange, without writing anything. */
export async function cotizarCambioVenta(
  db: Db,
  input: Omit<RegistrarCambioInput, "idempotencyKey">,
  opciones: OpcionesCambio = {}
): Promise<CambioResult<ResumenCambio>> {
  const ejecutar = opciones.ejecutor ?? ejecutarSerializableCambio
  try {
    const result = await resolverAbortoCompartido(() =>
      ejecutar(db, (tx, contexto) => registrarCambioVentaEnTx(tx, { ...input, idempotencyKey: randomUUID() }, contexto, true), opciones)
    )
    // A quote that reaches the end always throws SimulacionCambio; anything else is a refusal.
    return result.ok ? fail(409, "No se pudo cotizar el cambio.") : (result as Rechazo)
  } catch (error) {
    if (error instanceof SimulacionCambio) return { ok: true, value: error.resumen }
    const traducido = traducirError(error)
    if (traducido) return traducido
    throw error
  }
}

// ---------------------------------------------------------------------------
// Linked additional sale
// ---------------------------------------------------------------------------

export interface RegistrarVentaAdicionalInput {
  negocioId: string
  actor: CajaActor
  /** Origin sale (URL). */
  ventaId: string
  metodoPago: MetodoPagoVenta
  lines: ServerSaleLineInput[]
  idempotencyKey: string
  turnoCajaId?: string | null
  cajaFisicaId?: string | null
}

/** P2/D4 — the origin must not be voided and must keep units not returned (current lines). */
async function rechazoOrigenAdicional(tx: Tx, negocioId: string, ventaId: string): Promise<Rechazo | null> {
  const origen = await tx.venta.findFirst({
    where: { id: ventaId, negocioId },
    include: {
      items: { include: { devoluciones: { select: { cantidad: true } } } },
      devoluciones: { select: { tipo: true } },
      correcciones: ULTIMA_CORRECCION_INCLUDE,
    },
  })
  if (!origen) return fail(404, "Venta no encontrada.")
  if (origen.devoluciones.some((d) => d.tipo === DEVOLUCION_TIPO_ANULACION)) {
    return fail(409, "La venta original fue anulada: registrá una venta nueva e independiente.", "VENTA_ORIGEN_ANULADA")
  }
  const ultima = origen.correcciones[0]?.lineas
  const quedan = origen.items.some((original) => {
    const vendida = D(lineaVigente(original, ultima).cantidad)
    const devuelta = original.devoluciones.reduce((acc, d) => acc.plus(D(d.cantidad)), new Prisma.Decimal(0))
    return vendida.minus(devuelta).gt(0)
  })
  if (!quedan) return fail(409, "Todos los productos de la venta original ya fueron devueltos: registrá una venta nueva e independiente.", "VENTA_ORIGEN_DEVUELTA")
  return null
}

export async function registrarVentaAdicionalEnTx(
  tx: Tx,
  input: RegistrarVentaAdicionalInput,
  contexto: ContextoIntento
): Promise<CambioResult<{ venta: VentaCajaConItems; replayed: boolean }>> {
  const { negocioId, actor, ventaId, idempotencyKey } = input
  if (typeof ventaId !== "string" || !ventaId.trim()) return fail(400, "Venta inválida.", "VENTA_INVALIDA")
  const motor = () =>
    registrarVentaCajaEnTx(tx, {
      negocioId,
      actor: actor.tipo === "EMPLEADO" ? { tipo: "EMPLEADO", empleadoId: actor.empleadoId } : { tipo: "NEGOCIO" },
      metodoPago: input.metodoPago,
      lines: input.lines,
      idempotencyKey,
      turnoCajaId: actor.tipo === "EMPLEADO" ? input.turnoCajaId ?? null : undefined,
      ownerCajaFisicaId: actor.tipo === "NEGOCIO" ? input.cajaFisicaId ?? null : undefined,
      vinculo: { tipo: "ADICIONAL", ventaOrigenId: ventaId },
    })

  // Replay first: an already registered additional sale is returned even if
  // its origin was voided afterwards (the engine compares fingerprint + actor).
  const existente = await tx.venta.findUnique({ where: { negocioId_idempotencyKey: { negocioId, idempotencyKey } }, select: { id: true } })
  if (existente) {
    const replay = await motor()
    return replay.ok ? { ok: true, value: { venta: replay.venta, replayed: replay.replayed } } : (replay as Rechazo)
  }

  const actorResuelto = await resolverActorCambio(tx, negocioId, actor)
  if (!actorResuelto) return fail(403, "Acceso denegado")
  if (!(await bloquearVenta(tx, negocioId, ventaId))) return fail(404, "Venta no encontrada.")
  const rechazo = await rechazoOrigenAdicional(tx, negocioId, ventaId)
  if (rechazo) return rechazo

  const res = await motor()
  if (!res.ok) return res as Rechazo
  const venta = res.venta
  const total = venta.totalDecimal ?? D(venta.total)

  if (actorResuelto.tipo === "EMPLEADO") {
    await tx.notificacion.create({
      data: {
        userId: negocioId,
        userType: "negocio",
        tipo: NOTIFICACION_TIPO_VENTA_ADICIONAL,
        titulo: "Venta adicional vinculada",
        cuerpo: `${actorResuelto.nombre} registró una venta adicional de ${money(total)} (${venta.metodoPago}) vinculada a la venta #${referenciaVenta(ventaId)}: ${venta.items.map((i) => `${i.cantidad} × ${i.varianteNombre ? `${i.nombre} — ${i.varianteNombre}` : i.nombre}`).join(", ")}.`,
        negocioId,
        datos: JSON.stringify({
          navigateTo: { negocio: "caja" },
          ventaId: venta.id,
          ventaOrigenId: ventaId,
          ventaRef: referenciaVenta(ventaId),
          empleadoNombre: actorResuelto.nombre,
          importe: moneyToNumber(total),
          metodoPago: venta.metodoPago,
          fecha: venta.createdAt.toISOString(),
        }),
      },
    })
  }

  await auditLogWithClient(tx, {
    ...auditActor(actorResuelto),
    accion: "venta.adicional_vinculada",
    recurso: "venta",
    recursoId: ventaId,
    detalle: {
      negocioId,
      ventaAdicionalId: venta.id,
      total: total.toFixed(2),
      metodoPago: venta.metodoPago,
      turnoCajaId: venta.turnoCajaId,
      items: venta.items.map((i) => ({ productoId: i.productoId, productoVarianteId: i.productoVarianteId, nombre: i.nombre, precio: i.precio, cantidad: i.cantidad })),
      intento: contexto.intento,
    },
  })
  return { ok: true, value: { venta, replayed: false } }
}

export async function registrarVentaAdicional(
  db: Db,
  input: RegistrarVentaAdicionalInput,
  opciones: OpcionesCambio = {}
): Promise<CambioResult<{ venta: VentaCajaConItems; replayed: boolean }>> {
  const ejecutar = opciones.ejecutor ?? ejecutarSerializableCambio
  const correr = () => resolverAbortoCompartido(() => ejecutar(db, (tx, contexto) => registrarVentaAdicionalEnTx(tx, input, contexto), opciones))
  try {
    return (await correr()) as CambioResult<{ venta: VentaCajaConItems; replayed: boolean }>
  } catch (error) {
    // A concurrent request with the same key committed first: one more pass
    // resolves to its replay (or to the controlled reused-key conflict).
    if (isUniqueViolation(error)) {
      try {
        return (await correr()) as CambioResult<{ venta: VentaCajaConItems; replayed: boolean }>
      } catch (again) {
        const traducido = traducirError(again)
        if (traducido) return traducido
        throw again
      }
    }
    const traducido = traducirError(error)
    if (traducido) return traducido
    throw error
  }
}
