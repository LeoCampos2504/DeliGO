// ============================================
// F4-A — anulación completa y devolución parcial de ventas de Caja (server only)
// ============================================
// The ONE writer of sale returns, shared by the owner and cashier routes.
// A return is an immutable compensation event; it never edits the original
// Venta / VentaItem / CobroVenta / VENTA_COBRO operation, nor any closed shift.
//
// One Serializable transaction (bounded retry) does everything or nothing:
//   - idempotency (Idempotency-Key + content fingerprint, same actor);
//   - the sale row is locked with a no-op UPDATE, so a concurrent return of the
//     same sale fails its own lock with 40001 and is retried against fresh data
//     (plus the SQL trigger cap: accumulated quantity/amount ≤ what was sold);
//   - amounts come from the line subtotal actually charged, proportionally and
//     cumulatively (round2(subtotal × devuelto/vendido) − ya devuelto), so the
//     last unit closes the line exactly and nothing is refunded twice;
//   - money: NO_CORRESPONDE | PENDIENTE | REALIZADO. Only a REALIZADO cash
//     refund moves the ledger: one DEVOLUCION_VENTA operation with a negative
//     leg on the cash account of the register that hands the money back,
//     attributed to the shift OPEN at that moment (the actor's own shift; the
//     owner's selected/sole open register), or to the unassigned cash account
//     without a shift (OPCIONAL mode). The expected cash of that open shift goes
//     down; closed shifts keep their frozen snapshot. TRANSFERENCIA / OTRO are
//     recorded as DECLARED (no bank integration confirms them);
//   - stock: an explicit per-line decision. "Returns to stock" on a controlled
//     product adds exactly the returned quantity to the physical stock with one
//     DEVOLUCION inventory movement (active order reservations untouched);
//   - an employee's operation leaves a persistent in-app notice for the owner.

import { createHash } from "node:crypto"
import { Prisma, type PrismaClient } from "@prisma/client"
import { round2, storedMoney, moneyToNumber } from "@/lib/money"
import { CAJA_TURNOS_MODO_OBLIGATORIO, TURNO_ESTADO_ABIERTO, type CajaActor } from "@/lib/caja-turnos-service"
import { CUENTA_EFECTIVO_CAJA_FISICA_PREFIX, CUENTA_EFECTIVO_CAJA_SIN_ASIGNAR } from "@/lib/caja-venta-service"
import { isStockSerializationConflict, leerDisponibilidadStock } from "@/lib/stock-lifecycle"
import { resolveNextStock } from "@/lib/inventario"

type Db = PrismaClient
type Tx = Prisma.TransactionClient

export const DEVOLUCION_TIPO_ANULACION = "ANULACION"
export const DEVOLUCION_TIPO_PARCIAL = "DEVOLUCION_PARCIAL"
export type DevolucionTipo = typeof DEVOLUCION_TIPO_ANULACION | typeof DEVOLUCION_TIPO_PARCIAL
export const REINTEGRO_MEDIOS = ["EFECTIVO", "TRANSFERENCIA", "OTRO"] as const
export type ReintegroMedio = (typeof REINTEGRO_MEDIOS)[number]
export type ReintegroEstado = "NO_CORRESPONDE" | "PENDIENTE" | "REALIZADO"
export type ReintegroSolicitud = { modo: "REALIZADO"; medio: ReintegroMedio } | { modo: "PENDIENTE" } | { modo: "NO_CORRESPONDE" }
export type StockResultado = "REINGRESADO" | "NO_REINGRESA" | "SIN_CONTROL_STOCK" | "PRODUCTO_NO_DISPONIBLE"

export const MOTIVO_DEVOLUCION_MAX = 500
export const DEVOLUCION_ITEMS_MAX = 200
export const TIPO_OPERACION_DEVOLUCION_VENTA = "DEVOLUCION_VENTA"
export const MOVIMIENTO_TIPO_DEVOLUCION = "DEVOLUCION"
export const NOTIFICACION_TIPO_DEVOLUCION = "caja_devolucion"

export type DevolucionResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: 400 | 403 | 404 | 409; error: string; code?: string }

const fail = (status: 400 | 403 | 404 | 409, error: string, code?: string) => ({ ok: false as const, status, error, ...(code ? { code } : {}) })

/** Short public reference of a sale — the same "#xxxxxxxx" the Caja already shows. */
export function referenciaVenta(ventaId: string): string {
  return ventaId.slice(0, 8)
}

const D = (value: number | string) => new Prisma.Decimal(String(value))

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface DevolucionLineaSolicitada {
  ventaItemId: string
  /** null for ANULACION: the server returns every unit still not returned. */
  cantidad: Prisma.Decimal | null
  reingresaStock: boolean
}

export interface DevolucionSolicitud {
  tipo: DevolucionTipo
  motivo: string
  reintegro: ReintegroSolicitud
  lineas: DevolucionLineaSolicitada[]
  /** Owner only: register that hands back the cash (null = automatic). */
  cajaFisicaId: string | null
}

export function parseMotivoDevolucion(value: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof value !== "string" || !value.trim()) return { ok: false, error: "Indicá el motivo de la operación." }
  const motivo = value.trim()
  if (motivo.length > MOTIVO_DEVOLUCION_MAX) return { ok: false, error: `El motivo no puede superar ${MOTIVO_DEVOLUCION_MAX} caracteres.` }
  return { ok: true, value: motivo }
}

export function parseReintegro(value: unknown): ReintegroSolicitud | null {
  const raw = (value ?? null) as { modo?: unknown; medio?: unknown } | null
  if (!raw || typeof raw !== "object") return null
  if (raw.modo === "PENDIENTE") return { modo: "PENDIENTE" }
  if (raw.modo === "NO_CORRESPONDE") return { modo: "NO_CORRESPONDE" }
  if (raw.modo === "REALIZADO" && typeof raw.medio === "string" && (REINTEGRO_MEDIOS as readonly string[]).includes(raw.medio)) {
    return { modo: "REALIZADO", medio: raw.medio as ReintegroMedio }
  }
  return null
}

const QUANTITY_PATTERN = /^\d{1,7}(\.\d{1,3})?$/

/**
 * Body of POST …/ventas/[id]/devoluciones. The client only chooses WHICH lines,
 * how many units and what happens to them — never prices or amounts.
 */
export function parseDevolucionBody(body: unknown): DevolucionResult<DevolucionSolicitud> {
  const raw = (body ?? {}) as Record<string, unknown>
  const tipo = raw.tipo
  if (tipo !== DEVOLUCION_TIPO_ANULACION && tipo !== DEVOLUCION_TIPO_PARCIAL) return fail(400, "Elegí anular la venta o devolver productos.", "TIPO_DEVOLUCION_INVALIDO")
  if (!Array.isArray(raw.items) || raw.items.length === 0) {
    return fail(400, tipo === DEVOLUCION_TIPO_PARCIAL ? "Elegí al menos un producto a devolver." : "Indicá qué pasa con cada producto.", "ITEMS_DEVOLUCION_INVALIDOS")
  }
  if (raw.items.length > DEVOLUCION_ITEMS_MAX) return fail(400, "Demasiados productos en la operación.", "ITEMS_DEVOLUCION_INVALIDOS")
  const lineas: DevolucionLineaSolicitada[] = []
  const vistos = new Set<string>()
  for (const item of raw.items as unknown[]) {
    const line = (item ?? {}) as { ventaItemId?: unknown; cantidad?: unknown; reingresaStock?: unknown }
    if (typeof line.ventaItemId !== "string" || !line.ventaItemId.trim() || vistos.has(line.ventaItemId)) {
      return fail(400, "Producto de la venta inválido o repetido.", "ITEMS_DEVOLUCION_INVALIDOS")
    }
    if (typeof line.reingresaStock !== "boolean") {
      return fail(400, "Indicá si cada producto vuelve al stock.", "STOCK_DECISION_REQUERIDA")
    }
    let cantidad: Prisma.Decimal | null = null
    if (tipo === DEVOLUCION_TIPO_PARCIAL) {
      const text = typeof line.cantidad === "number" && Number.isFinite(line.cantidad) ? String(line.cantidad) : typeof line.cantidad === "string" ? line.cantidad.trim() : ""
      if (!QUANTITY_PATTERN.test(text) || D(text).lte(0)) return fail(400, "Ingresá una cantidad mayor a cero para cada producto.", "CANTIDAD_DEVOLUCION_INVALIDA")
      cantidad = D(text)
    }
    vistos.add(line.ventaItemId)
    lineas.push({ ventaItemId: line.ventaItemId, cantidad, reingresaStock: line.reingresaStock })
  }
  const motivo = parseMotivoDevolucion(raw.motivo)
  if (!motivo.ok) return fail(400, motivo.error, "MOTIVO_DEVOLUCION_REQUERIDO")
  const reintegro = parseReintegro(raw.reintegro)
  if (!reintegro) return fail(400, "Indicá si corresponde devolver el dinero y cómo.", "REINTEGRO_INVALIDO")
  if (raw.confirmo !== true) return fail(400, "Confirmá la operación para continuar.", "CONFIRMACION_DEVOLUCION_REQUERIDA")
  const caja = raw.cajaFisicaId
  if (caja !== undefined && caja !== null && (typeof caja !== "string" || !caja.trim())) return fail(400, "Caja inválida.", "CAJA_INVALIDA")
  return { ok: true, value: { tipo, motivo: motivo.value, reintegro, lineas, cajaFisicaId: typeof caja === "string" ? caja : null } }
}

export function fingerprintDevolucion(negocioId: string, ventaId: string, solicitud: DevolucionSolicitud, actor: CajaActor): string {
  const canonical = JSON.stringify({
    negocioId,
    ventaId,
    actor: actor.tipo === "EMPLEADO" ? `EMPLEADO:${actor.empleadoId}` : "NEGOCIO",
    tipo: solicitud.tipo,
    motivo: solicitud.motivo,
    reintegro: solicitud.reintegro,
    caja: actor.tipo === "NEGOCIO" ? solicitud.cajaFisicaId : null,
    lineas: [...solicitud.lineas]
      .sort((a, b) => (a.ventaItemId < b.ventaItemId ? -1 : a.ventaItemId > b.ventaItemId ? 1 : 0))
      .map((l) => [l.ventaItemId, l.cantidad?.toString() ?? null, l.reingresaStock]),
  })
  return createHash("sha256").update(`F4-A\n${canonical}`).digest("hex")
}

// ---------------------------------------------------------------------------
// Pure amount rule (exported for unit tests)
// ---------------------------------------------------------------------------

/**
 * Amount of returning `cantidad` more units of a line: cumulative and
 * proportional to the subtotal actually charged. The sum over successive
 * partial returns never exceeds the subtotal and the last unit closes it.
 */
export function importeDevolucionLinea(params: {
  subtotal: Prisma.Decimal
  vendida: Prisma.Decimal
  devueltaAntes: Prisma.Decimal
  importeDevueltoAntes: Prisma.Decimal
  cantidad: Prisma.Decimal
}): Prisma.Decimal {
  const acumulada = params.devueltaAntes.plus(params.cantidad)
  const objetivo = acumulada.gte(params.vendida) ? params.subtotal : round2(params.subtotal.times(acumulada).dividedBy(params.vendida))
  const importe = objetivo.minus(params.importeDevueltoAntes)
  return importe.isNegative() ? new Prisma.Decimal(0) : importe
}

// ---------------------------------------------------------------------------
// Serializable runner (bounded retry with backoff, like the shift services)
// ---------------------------------------------------------------------------

const TX_OPTIONS = { maxWait: 5_000, timeout: 15_000 } as const

async function runSerializable<T>(db: Db, fn: (tx: Tx) => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await db.$transaction(fn, { ...TX_OPTIONS, isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    } catch (error) {
      if (!isStockSerializationConflict(error) || attempt >= 8) throw error
      await new Promise((resolve) => setTimeout(resolve, Math.min(attempt * 15, 100)))
    }
  }
}

function isUniqueViolation(error: unknown, fragment: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false
  const target = (error.meta as { target?: unknown } | undefined)?.target
  const text = Array.isArray(target) ? target.join(",") : String(target ?? "")
  return text.includes(fragment) || text.includes("devoluciones_venta")
}

/** Maps the SQL guard messages (defense in depth) to controlled answers. */
export function mapDevolucionDbError(error: unknown): { status: 409; error: string; code: string } | null {
  const text = error instanceof Error ? error.message : String(error)
  if (text.includes("sale return quantity exceeds") || text.includes("sale return amount exceeds")) {
    return { status: 409, error: "Esa cantidad ya fue devuelta. Actualizá la venta e intentá de nuevo.", code: "CANTIDAD_DEVOLUCION_EXCEDIDA" }
  }
  if (text.includes("sale return cash refund requires an open shift")) {
    return { status: 409, error: "Tu turno de Caja ya no está abierto. Actualizá la pantalla.", code: "TURNO_NO_DISPONIBLE" }
  }
  if (text.includes("sale return is immutable")) {
    return { status: 409, error: "El reintegro de esta devolución ya fue registrado.", code: "REINTEGRO_YA_REGISTRADO" }
  }
  return null
}

// ---------------------------------------------------------------------------
// Actor + cash destination
// ---------------------------------------------------------------------------

type ActorResuelto = { tipo: "NEGOCIO" | "EMPLEADO"; actorId: string; empleadoId: string | null; nombre: string }

async function resolverActor(tx: Tx, negocioId: string, actor: CajaActor): Promise<ActorResuelto | null> {
  if (actor.tipo === "NEGOCIO") return { tipo: "NEGOCIO", actorId: negocioId, empleadoId: null, nombre: "Dueño" }
  const empleado = await tx.empleado.findFirst({
    where: { id: actor.empleadoId, negocioId, activo: true, eliminado: false },
    select: { id: true, nombre: true },
  })
  return empleado ? { tipo: "EMPLEADO", actorId: empleado.id, empleadoId: empleado.id, nombre: empleado.nombre } : null
}

type DestinoEfectivo = { turnoCajaId: string | null; cuentaId: string; cajaNombre: string | null }

const TURNO_NO_DISPONIBLE = fail(409, "Tu turno de Caja ya no está disponible. Actualizá la pantalla.", "TURNO_NO_DISPONIBLE")

async function cuentaEfectivo(tx: Tx, negocioId: string, cajaFisicaId: string | null): Promise<string> {
  if (cajaFisicaId) {
    const clave = `${CUENTA_EFECTIVO_CAJA_FISICA_PREFIX}${cajaFisicaId}`
    await tx.cuentaFinanciera.createMany({ data: [{ negocioId, clave, tipo: "EFECTIVO", nombre: "Efectivo de caja física", cajaFisicaId }], skipDuplicates: true })
    return (await tx.cuentaFinanciera.findFirstOrThrow({ where: { negocioId, clave, cajaFisicaId }, select: { id: true } })).id
  }
  await tx.cuentaFinanciera.createMany({ data: [{ negocioId, clave: CUENTA_EFECTIVO_CAJA_SIN_ASIGNAR, tipo: "EFECTIVO", nombre: "Efectivo de Caja (sin caja física asignada)" }], skipDuplicates: true })
  return (await tx.cuentaFinanciera.findUniqueOrThrow({ where: { negocioId_clave: { negocioId, clave: CUENTA_EFECTIVO_CAJA_SIN_ASIGNAR } }, select: { id: true } })).id
}

async function lockCaja(tx: Tx, negocioId: string, cajaFisicaId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string; activa: boolean; nombre: string }>>`
    SELECT "id", "activa", "nombre" FROM "cajas_fisicas"
    WHERE "id" = ${cajaFisicaId} AND "negocioId" = ${negocioId}
    FOR UPDATE`
  return rows[0] ?? null
}

/**
 * Where the refunded cash physically leaves from — same rules as a sale:
 * an employee only from their OWN open shift; the owner from the selected or
 * the sole open register (several open → explicit choice); no open shift →
 * unassigned cash account (OPCIONAL), except an employee in OBLIGATORIO mode.
 * The register row lock serializes against a concurrent shift close.
 */
async function resolverDestinoEfectivo(tx: Tx, negocioId: string, actor: ActorResuelto, cajaElegida: string | null): Promise<DevolucionResult<DestinoEfectivo>> {
  if (actor.tipo === "EMPLEADO") {
    const turno = await tx.turnoCaja.findFirst({
      where: { negocioId, estado: TURNO_ESTADO_ABIERTO, responsableTipo: "EMPLEADO", responsableId: actor.actorId },
      select: { id: true, cajaFisicaId: true },
    })
    if (!turno) {
      const negocio = await tx.negocio.findUnique({ where: { id: negocioId }, select: { cajaTurnosModo: true } })
      if (negocio?.cajaTurnosModo === CAJA_TURNOS_MODO_OBLIGATORIO) {
        return fail(409, "Para devolver efectivo tenés que tener un turno de Caja abierto.", "TURNO_REQUERIDO")
      }
      return { ok: true, value: { turnoCajaId: null, cuentaId: await cuentaEfectivo(tx, negocioId, null), cajaNombre: null } }
    }
    const caja = await lockCaja(tx, negocioId, turno.cajaFisicaId)
    if (!caja?.activa) return TURNO_NO_DISPONIBLE
    const vigente = await tx.turnoCaja.findFirst({ where: { id: turno.id, negocioId, estado: TURNO_ESTADO_ABIERTO, responsableId: actor.actorId }, select: { id: true } })
    if (!vigente) return TURNO_NO_DISPONIBLE
    return { ok: true, value: { turnoCajaId: turno.id, cuentaId: await cuentaEfectivo(tx, negocioId, caja.id), cajaNombre: caja.nombre } }
  }

  if (cajaElegida) {
    const caja = await lockCaja(tx, negocioId, cajaElegida)
    if (!caja) return fail(404, "Caja no encontrada.")
    if (!caja.activa) return fail(409, "La caja está desactivada.", "CAJA_INACTIVA")
    const turno = await tx.turnoCaja.findFirst({ where: { negocioId, cajaFisicaId: caja.id, estado: TURNO_ESTADO_ABIERTO }, select: { id: true } })
    if (!turno) return fail(409, "Esa caja ya no tiene un turno abierto. Actualizá la pantalla.", "TURNO_NO_DISPONIBLE")
    return { ok: true, value: { turnoCajaId: turno.id, cuentaId: await cuentaEfectivo(tx, negocioId, caja.id), cajaNombre: caja.nombre } }
  }
  await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "cajas_fisicas" WHERE "negocioId" = ${negocioId} ORDER BY "id" FOR UPDATE`
  const abiertos = await tx.turnoCaja.findMany({ where: { negocioId, estado: TURNO_ESTADO_ABIERTO }, select: { id: true, cajaFisicaId: true }, take: 2 })
  if (abiertos.length > 1) return fail(409, "Hay varias cajas abiertas. Elegí desde qué caja devolvés el efectivo.", "CAJA_SELECCION_REQUERIDA")
  if (abiertos.length === 0) return { ok: true, value: { turnoCajaId: null, cuentaId: await cuentaEfectivo(tx, negocioId, null), cajaNombre: null } }
  const caja = await tx.cajaFisica.findFirst({ where: { id: abiertos[0].cajaFisicaId, negocioId }, select: { id: true, activa: true, nombre: true } })
  if (!caja?.activa) return TURNO_NO_DISPONIBLE
  return { ok: true, value: { turnoCajaId: abiertos[0].id, cuentaId: await cuentaEfectivo(tx, negocioId, caja.id), cajaNombre: caja.nombre } }
}

async function crearOperacionReintegro(tx: Tx, negocioId: string, actor: ActorResuelto, destino: DestinoEfectivo, importe: Prisma.Decimal) {
  const salida = importe.negated()
  return tx.operacionFinanciera.create({
    data: {
      negocioId,
      tipo: TIPO_OPERACION_DEVOLUCION_VENTA,
      actorTipo: actor.tipo,
      actorId: actor.actorId,
      turnoCajaId: destino.turnoCajaId,
      movimientos: { create: [{ negocioId, cuentaId: destino.cuentaId, importe: moneyToNumber(salida), importeDecimal: salida }] },
    },
    select: { id: true },
  })
}

// ---------------------------------------------------------------------------
// Owner notice (persistent, in-app; created inside the same transaction)
// ---------------------------------------------------------------------------

const money = (value: Prisma.Decimal) => `$${moneyToNumber(value).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

export function describirReintegro(estado: ReintegroEstado, medio: string | null): string {
  if (estado === "PENDIENTE") return "reintegro pendiente"
  if (estado === "NO_CORRESPONDE") return "sin devolución de dinero"
  if (medio === "EFECTIVO") return "reintegrado en efectivo"
  if (medio === "TRANSFERENCIA") return "reintegro por transferencia declarado (sin verificación bancaria)"
  return "reintegro por otro medio declarado"
}

export function textoNotificacionDevolucion(params: {
  tipo: string
  empleadoNombre: string
  ventaId: string
  importe: Prisma.Decimal
  motivo: string
  reintegroEstado: ReintegroEstado
  reintegroMedio: string | null
  lineas: Array<{ nombre: string; cantidad: number }>
}) {
  const productos = params.lineas.map((l) => `${l.cantidad} × ${l.nombre}`).join(", ")
  const accion = params.tipo === DEVOLUCION_TIPO_ANULACION ? "anuló la venta" : "registró una devolución parcial de la venta"
  return {
    titulo: params.tipo === DEVOLUCION_TIPO_ANULACION ? "Venta anulada" : "Devolución parcial",
    cuerpo: `${params.empleadoNombre} ${accion} #${referenciaVenta(params.ventaId)} por ${money(params.importe)} (${productos}). Motivo: ${params.motivo}. Dinero: ${describirReintegro(params.reintegroEstado, params.reintegroMedio)}.`,
  }
}

// ---------------------------------------------------------------------------
// Register a return / void
// ---------------------------------------------------------------------------

const DEVOLUCION_INCLUDE = {
  items: { include: { ventaItem: { select: { nombre: true, varianteNombre: true } } }, orderBy: { createdAt: "asc" } },
} satisfies Prisma.DevolucionVentaInclude
export type DevolucionConItems = Prisma.DevolucionVentaGetPayload<{ include: typeof DEVOLUCION_INCLUDE }>

export interface RegistrarDevolucionInput {
  negocioId: string
  actor: CajaActor
  ventaId: string
  solicitud: DevolucionSolicitud
  idempotencyKey: string
}

function mismoActor(row: { actorTipo: string; actorId: string }, actor: CajaActor, negocioId: string) {
  return row.actorTipo === actor.tipo && row.actorId === (actor.tipo === "EMPLEADO" ? actor.empleadoId : negocioId)
}

async function replayDevolucion(db: Pick<Tx, "devolucionVenta">, negocioId: string, key: string, fingerprint: string, actor: CajaActor) {
  const existing = await db.devolucionVenta.findUnique({ where: { negocioId_idempotencyKey: { negocioId, idempotencyKey: key } }, include: DEVOLUCION_INCLUDE })
  if (!existing) return null
  if (existing.idempotencyFingerprint === fingerprint && mismoActor(existing, actor, negocioId)) {
    return { ok: true as const, value: { devolucion: existing, replayed: true } }
  }
  return fail(409, "Este intento ya se usó para otra operación. Volvé a intentarlo.", "IDEMPOTENCY_KEY_REUSED")
}

export async function registrarDevolucionVenta(db: Db, input: RegistrarDevolucionInput): Promise<DevolucionResult<{ devolucion: DevolucionConItems; replayed: boolean }>> {
  const { negocioId, actor, ventaId, solicitud, idempotencyKey } = input
  if (typeof ventaId !== "string" || !ventaId.trim()) return fail(400, "Venta inválida.", "VENTA_INVALIDA")
  const fingerprint = fingerprintDevolucion(negocioId, ventaId, solicitud, actor)
  try {
    return await runSerializable(db, async (tx) => {
      const replay = await replayDevolucion(tx, negocioId, idempotencyKey, fingerprint, actor)
      if (replay) return replay

      const actorResuelto = await resolverActor(tx, negocioId, actor)
      if (!actorResuelto) return fail(403, "Acceso denegado")

      // Lock the sale with a real (no-op) row version: a concurrent return of the
      // same sale fails its own lock with 40001 and retries on fresh data.
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        UPDATE "ventas_caja" SET "cantidadItems" = "cantidadItems"
        WHERE "id" = ${ventaId} AND "negocioId" = ${negocioId}
        RETURNING "id"`
      if (!locked[0]) return fail(404, "Venta no encontrada.")

      const venta = await tx.venta.findFirstOrThrow({
        where: { id: ventaId, negocioId },
        include: { items: { include: { devoluciones: { select: { cantidad: true, importeDecimal: true } } } } },
      })
      const estadoItems = new Map(venta.items.map((item) => {
        const vendida = D(item.cantidad)
        const devuelta = item.devoluciones.reduce((acc, d) => acc.plus(D(d.cantidad)), new Prisma.Decimal(0))
        const importeDevuelto = item.devoluciones.reduce((acc, d) => acc.plus(d.importeDecimal), new Prisma.Decimal(0))
        return [item.id, { item, vendida, devuelta, importeDevuelto, restante: vendida.minus(devuelta), subtotal: storedMoney(item.subtotalDecimal, item.subtotal) }]
      }))
      const decision = new Map(solicitud.lineas.map((l) => [l.ventaItemId, l]))

      const lineas: Array<{ ventaItemId: string; cantidad: Prisma.Decimal; importe: Prisma.Decimal; reingresaStock: boolean }> = []
      if (solicitud.tipo === DEVOLUCION_TIPO_ANULACION) {
        for (const linea of solicitud.lineas) {
          if (!estadoItems.has(linea.ventaItemId)) return fail(400, "Ese producto no pertenece a esta venta.", "ITEMS_DEVOLUCION_INVALIDOS")
        }
        for (const [id, estado] of estadoItems) {
          if (!estado.restante.gt(0)) continue
          const elegido = decision.get(id)
          if (!elegido) return fail(400, "Indicá si cada producto vuelve al stock.", "STOCK_DECISION_REQUERIDA")
          lineas.push({ ventaItemId: id, cantidad: estado.restante, importe: estado.subtotal.minus(estado.importeDevuelto), reingresaStock: elegido.reingresaStock })
        }
        if (lineas.length === 0) return fail(409, "Esta venta ya fue anulada o devuelta por completo.", "VENTA_SIN_SALDO_DEVOLVIBLE")
      } else {
        for (const linea of solicitud.lineas) {
          const estado = estadoItems.get(linea.ventaItemId)
          if (!estado) return fail(400, "Ese producto no pertenece a esta venta.", "ITEMS_DEVOLUCION_INVALIDOS")
          const cantidad = linea.cantidad!
          if (cantidad.gt(estado.restante)) {
            const nombre = estado.item.varianteNombre ? `${estado.item.nombre} — ${estado.item.varianteNombre}` : estado.item.nombre
            return fail(409, estado.restante.gt(0)
              ? `"${nombre}": sólo quedan ${estado.restante.toString()} sin devolver.`
              : `"${nombre}" ya fue devuelto por completo.`, "CANTIDAD_DEVOLUCION_EXCEDIDA")
          }
          lineas.push({
            ventaItemId: linea.ventaItemId,
            cantidad,
            importe: importeDevolucionLinea({ subtotal: estado.subtotal, vendida: estado.vendida, devueltaAntes: estado.devuelta, importeDevueltoAntes: estado.importeDevuelto, cantidad }),
            reingresaStock: linea.reingresaStock,
          })
        }
      }
      const importeTotal = lineas.reduce((acc, l) => acc.plus(l.importe), new Prisma.Decimal(0))

      // Money: a zero-value return has nothing to refund.
      const reintegro: ReintegroSolicitud = importeTotal.isZero() ? { modo: "NO_CORRESPONDE" } : solicitud.reintegro
      let operacionId: string | null = null
      let turnoReintegroId: string | null = null
      if (reintegro.modo === "REALIZADO" && reintegro.medio === "EFECTIVO") {
        const destino = await resolverDestinoEfectivo(tx, negocioId, actorResuelto, actor.tipo === "NEGOCIO" ? solicitud.cajaFisicaId : null)
        if (!destino.ok) return destino
        operacionId = (await crearOperacionReintegro(tx, negocioId, actorResuelto, destino.value, importeTotal)).id
        turnoReintegroId = destino.value.turnoCajaId
      }
      const ahora = new Date()
      const realizado = reintegro.modo === "REALIZADO"

      const devolucion = await tx.devolucionVenta.create({
        data: {
          negocioId,
          ventaId,
          tipo: solicitud.tipo,
          motivo: solicitud.motivo,
          actorTipo: actorResuelto.tipo,
          actorId: actorResuelto.actorId,
          empleadoId: actorResuelto.empleadoId,
          importeDecimal: importeTotal,
          metodoPagoVenta: venta.metodoPago,
          reintegroEstado: reintegro.modo,
          reintegroMedio: realizado ? reintegro.medio : null,
          reintegroRegistradoEn: realizado ? ahora : null,
          reintegroActorTipo: realizado ? actorResuelto.tipo : null,
          reintegroActorId: realizado ? actorResuelto.actorId : null,
          reintegroOperacionId: operacionId,
          reintegroTurnoCajaId: turnoReintegroId,
          idempotencyKey,
          idempotencyFingerprint: fingerprint,
        },
        select: { id: true },
      })

      for (const linea of lineas) {
        const item = estadoItems.get(linea.ventaItemId)!.item
        const cantidad = linea.cantidad.toNumber()
        let stockResultado: StockResultado = "NO_REINGRESA"
        let movimientoInventarioId: string | null = null
        if (linea.reingresaStock) {
          // A deleted product/variant cannot take units back (never the parent
          // product in place of a deleted variant).
          const varianteBorrada = item.varianteNombre !== null && item.productoVarianteId === null
          const key = item.productoId && !varianteBorrada ? { productoId: item.productoId, productoVarianteId: item.productoVarianteId } : null
          const disponibilidad = key ? await leerDisponibilidadStock(tx, { negocioId, key }) : null
          if (!key || !disponibilidad) {
            stockResultado = "PRODUCTO_NO_DISPONIBLE"
          } else if (!disponibilidad.controlStock) {
            stockResultado = "SIN_CONTROL_STOCK"
          } else {
            const next = resolveNextStock(disponibilidad.physical, "ENTRADA", cantidad)
            if (!next.ok) throw new Error(next.error)
            if (key.productoVarianteId) await tx.productoVariante.update({ where: { id: key.productoVarianteId }, data: { stockCantidad: next.nextStock } })
            else await tx.producto.update({ where: { id: key.productoId }, data: { stockCantidad: next.nextStock } })
            const movimiento = await tx.movimientoInventario.create({
              data: {
                negocioId,
                productoId: key.productoId,
                productoVarianteId: key.productoVarianteId,
                tipo: MOVIMIENTO_TIPO_DEVOLUCION,
                cantidad,
                stockAntes: disponibilidad.physical,
                stockDespues: next.nextStock,
                motivo: `${solicitud.tipo === DEVOLUCION_TIPO_ANULACION ? "Anulación" : "Devolución"} de venta #${referenciaVenta(ventaId)}`,
                ventaId,
              },
              select: { id: true },
            })
            movimientoInventarioId = movimiento.id
            stockResultado = "REINGRESADO"
          }
        }
        await tx.devolucionVentaItem.create({
          data: { devolucionId: devolucion.id, negocioId, ventaId, ventaItemId: linea.ventaItemId, cantidad, importeDecimal: linea.importe, stockResultado, movimientoInventarioId },
        })
      }

      if (actorResuelto.tipo === "EMPLEADO") {
        const lineasAviso = lineas.map((l) => {
          const item = estadoItems.get(l.ventaItemId)!.item
          return { nombre: item.varianteNombre ? `${item.nombre} — ${item.varianteNombre}` : item.nombre, cantidad: l.cantidad.toNumber() }
        })
        const texto = textoNotificacionDevolucion({ tipo: solicitud.tipo, empleadoNombre: actorResuelto.nombre, ventaId, importe: importeTotal, motivo: solicitud.motivo, reintegroEstado: reintegro.modo, reintegroMedio: realizado ? reintegro.medio : null, lineas: lineasAviso })
        await tx.notificacion.create({
          data: {
            userId: negocioId,
            userType: "negocio",
            tipo: NOTIFICACION_TIPO_DEVOLUCION,
            titulo: texto.titulo,
            cuerpo: texto.cuerpo,
            negocioId,
            datos: JSON.stringify({
              navigateTo: { negocio: "caja" },
              devolucionId: devolucion.id,
              ventaId,
              ventaRef: referenciaVenta(ventaId),
              tipo: solicitud.tipo,
              empleadoNombre: actorResuelto.nombre,
              importe: moneyToNumber(importeTotal),
              motivo: solicitud.motivo,
              reintegroEstado: reintegro.modo,
              reintegroMedio: realizado ? reintegro.medio : null,
              productos: lineasAviso,
              fecha: ahora.toISOString(),
            }),
          },
        })
      }

      const creada = await tx.devolucionVenta.findUniqueOrThrow({ where: { id: devolucion.id }, include: DEVOLUCION_INCLUDE })
      return { ok: true as const, value: { devolucion: creada, replayed: false } }
    })
  } catch (error) {
    if (isUniqueViolation(error, "idempotencyKey")) {
      const replay = await replayDevolucion(db, negocioId, idempotencyKey, fingerprint, actor)
      if (replay) return replay
    }
    const mapped = mapDevolucionDbError(error)
    if (mapped) return fail(mapped.status, mapped.error, mapped.code)
    throw error
  }
}

// ---------------------------------------------------------------------------
// Register a pending refund later (PENDIENTE → REALIZADO, once)
// ---------------------------------------------------------------------------

export interface RegistrarReintegroInput {
  negocioId: string
  actor: CajaActor
  devolucionId: string
  medio: unknown
  cajaFisicaId?: string | null
  idempotencyKey: string
}

export async function registrarReintegroDevolucion(db: Db, input: RegistrarReintegroInput): Promise<DevolucionResult<{ devolucion: DevolucionConItems; replayed: boolean }>> {
  const { negocioId, actor, devolucionId, idempotencyKey } = input
  if (typeof devolucionId !== "string" || !devolucionId.trim()) return fail(400, "Operación inválida.", "DEVOLUCION_INVALIDA")
  if (typeof input.medio !== "string" || !(REINTEGRO_MEDIOS as readonly string[]).includes(input.medio)) {
    return fail(400, "Indicá cómo devolviste el dinero.", "REINTEGRO_INVALIDO")
  }
  const medio = input.medio as ReintegroMedio
  const cajaElegida = actor.tipo === "NEGOCIO" ? input.cajaFisicaId ?? null : null
  const actorId = actor.tipo === "EMPLEADO" ? actor.empleadoId : negocioId

  const replayOrConflict = async (reader: Pick<Tx, "devolucionVenta">) => {
    const existing = await reader.devolucionVenta.findUnique({ where: { negocioId_reintegroIdempotencyKey: { negocioId, reintegroIdempotencyKey: idempotencyKey } }, include: DEVOLUCION_INCLUDE })
    if (!existing) return null
    if (existing.id === devolucionId && existing.reintegroMedio === medio && existing.reintegroActorTipo === actor.tipo && existing.reintegroActorId === actorId) {
      return { ok: true as const, value: { devolucion: existing, replayed: true } }
    }
    return fail(409, "Este intento ya se usó para otra operación. Volvé a intentarlo.", "IDEMPOTENCY_KEY_REUSED")
  }

  try {
    return await runSerializable(db, async (tx) => {
      const replay = await replayOrConflict(tx)
      if (replay) return replay
      const actorResuelto = await resolverActor(tx, negocioId, actor)
      if (!actorResuelto) return fail(403, "Acceso denegado")
      const rows = await tx.$queryRaw<Array<{ id: string; reintegroEstado: string }>>`
        SELECT "id", "reintegroEstado" FROM "devoluciones_venta"
        WHERE "id" = ${devolucionId} AND "negocioId" = ${negocioId}
        FOR UPDATE`
      const row = rows[0]
      if (!row) return fail(404, "Operación no encontrada.")
      if (row.reintegroEstado !== "PENDIENTE") {
        return fail(409, row.reintegroEstado === "REALIZADO" ? "El reintegro de esta devolución ya fue registrado." : "Esta operación no tiene dinero a devolver.", "REINTEGRO_YA_REGISTRADO")
      }
      const devolucion = await tx.devolucionVenta.findUniqueOrThrow({ where: { id: devolucionId }, include: DEVOLUCION_INCLUDE })

      let operacionId: string | null = null
      let turnoReintegroId: string | null = null
      if (medio === "EFECTIVO") {
        const destino = await resolverDestinoEfectivo(tx, negocioId, actorResuelto, cajaElegida)
        if (!destino.ok) return destino
        operacionId = (await crearOperacionReintegro(tx, negocioId, actorResuelto, destino.value, devolucion.importeDecimal)).id
        turnoReintegroId = destino.value.turnoCajaId
      }
      const ahora = new Date()
      const updated = await tx.devolucionVenta.updateMany({
        where: { id: devolucionId, negocioId, reintegroEstado: "PENDIENTE" },
        data: {
          reintegroEstado: "REALIZADO",
          reintegroMedio: medio,
          reintegroRegistradoEn: ahora,
          reintegroActorTipo: actorResuelto.tipo,
          reintegroActorId: actorResuelto.actorId,
          reintegroOperacionId: operacionId,
          reintegroTurnoCajaId: turnoReintegroId,
          reintegroIdempotencyKey: idempotencyKey,
        },
      })
      if (updated.count !== 1) return fail(409, "El reintegro de esta devolución ya fue registrado.", "REINTEGRO_YA_REGISTRADO")

      if (actorResuelto.tipo === "EMPLEADO") {
        await tx.notificacion.create({
          data: {
            userId: negocioId,
            userType: "negocio",
            tipo: NOTIFICACION_TIPO_DEVOLUCION,
            titulo: "Reintegro registrado",
            cuerpo: `${actorResuelto.nombre} registró el reintegro de ${money(devolucion.importeDecimal)} de la venta #${referenciaVenta(devolucion.ventaId)}: ${describirReintegro("REALIZADO", medio)}.`,
            negocioId,
            datos: JSON.stringify({
              navigateTo: { negocio: "caja" },
              devolucionId,
              ventaId: devolucion.ventaId,
              ventaRef: referenciaVenta(devolucion.ventaId),
              empleadoNombre: actorResuelto.nombre,
              importe: moneyToNumber(devolucion.importeDecimal),
              reintegroEstado: "REALIZADO",
              reintegroMedio: medio,
              fecha: ahora.toISOString(),
            }),
          },
        })
      }
      const final = await tx.devolucionVenta.findUniqueOrThrow({ where: { id: devolucionId }, include: DEVOLUCION_INCLUDE })
      return { ok: true as const, value: { devolucion: final, replayed: false } }
    })
  } catch (error) {
    if (isUniqueViolation(error, "reintegroIdempotencyKey")) {
      const replay = await replayOrConflict(db)
      if (replay) return replay
    }
    const mapped = mapDevolucionDbError(error)
    if (mapped) return fail(mapped.status, mapped.error, mapped.code)
    throw error
  }
}

// ---------------------------------------------------------------------------
// Reads (sale history with returns; owner operations history)
// ---------------------------------------------------------------------------

export type EstadoDevolucionVenta = "VIGENTE" | "DEVOLUCION_PARCIAL" | "ANULADA" | "DEVUELTA_TOTAL"

const VENTA_HISTORIAL_INCLUDE = {
  items: { include: { devoluciones: { select: { cantidad: true, importeDecimal: true } } } },
  devoluciones: { include: DEVOLUCION_INCLUDE, orderBy: { createdAt: "asc" } },
} satisfies Prisma.VentaInclude
type VentaHistorialRow = Prisma.VentaGetPayload<{ include: typeof VENTA_HISTORIAL_INCLUDE }>

/**
 * Public shape of a sale with its returns. `vista` decides privacy: the owner
 * sees who did each operation; a cashier only sees whether it was them. No
 * expected cash, shift totals, ledger data or other business data — ever.
 */
export function ventaConDevolucionesParaRespuesta(
  venta: VentaHistorialRow,
  vista: { tipo: "NEGOCIO"; nombres: Map<string, string> } | { tipo: "EMPLEADO"; empleadoId: string }
) {
  const total = storedMoney(venta.totalDecimal, venta.total)
  const items = venta.items.map((item) => {
    const vendida = D(item.cantidad)
    const devuelta = item.devoluciones.reduce((acc, d) => acc.plus(D(d.cantidad)), new Prisma.Decimal(0))
    const importeDevuelto = item.devoluciones.reduce((acc, d) => acc.plus(d.importeDecimal), new Prisma.Decimal(0))
    return {
      id: item.id,
      nombre: item.nombre,
      varianteNombre: item.varianteNombre,
      precio: item.precio,
      cantidad: item.cantidad,
      subtotal: moneyToNumber(storedMoney(item.subtotalDecimal, item.subtotal)),
      cantidadDevuelta: devuelta.toNumber(),
      cantidadRestante: vendida.minus(devuelta).toNumber(),
      importeDevuelto: moneyToNumber(importeDevuelto),
    }
  })
  const totalDevuelto = venta.devoluciones.reduce((acc, d) => acc.plus(d.importeDecimal), new Prisma.Decimal(0))
  const restan = items.some((item) => item.cantidadRestante > 0)
  const estado: EstadoDevolucionVenta = venta.devoluciones.length === 0
    ? "VIGENTE"
    : venta.devoluciones.some((d) => d.tipo === DEVOLUCION_TIPO_ANULACION)
      ? "ANULADA"
      : restan ? "DEVOLUCION_PARCIAL" : "DEVUELTA_TOTAL"
  return {
    id: venta.id,
    referencia: referenciaVenta(venta.id),
    createdAt: venta.createdAt,
    metodoPago: venta.metodoPago,
    total: moneyToNumber(total),
    totalDevuelto: moneyToNumber(totalDevuelto),
    totalNeto: moneyToNumber(total.minus(totalDevuelto)),
    estadoDevolucion: estado,
    items,
    devoluciones: venta.devoluciones.map((d) => devolucionParaRespuesta(d, vista)),
  }
}

export function devolucionParaRespuesta(
  d: DevolucionConItems,
  vista: { tipo: "NEGOCIO"; nombres: Map<string, string> } | { tipo: "EMPLEADO"; empleadoId: string }
) {
  const quien = (tipo: string | null, id: string | null) => {
    if (!tipo || !id) return null
    if (vista.tipo === "NEGOCIO") return tipo === "NEGOCIO" ? "Dueño" : vista.nombres.get(id) ?? "Empleado"
    return tipo === "EMPLEADO" && id === vista.empleadoId ? "Vos" : tipo === "NEGOCIO" ? "Responsable del negocio" : "Otro empleado"
  }
  return {
    id: d.id,
    ventaId: d.ventaId,
    ventaReferencia: referenciaVenta(d.ventaId),
    tipo: d.tipo,
    motivo: d.motivo,
    createdAt: d.createdAt,
    importe: moneyToNumber(d.importeDecimal),
    registradaPor: quien(d.actorTipo, d.actorId),
    metodoPagoVenta: d.metodoPagoVenta,
    reintegroEstado: d.reintegroEstado,
    reintegroMedio: d.reintegroMedio,
    reintegroRegistradoEn: d.reintegroRegistradoEn,
    reintegroRegistradoPor: quien(d.reintegroActorTipo, d.reintegroActorId),
    reintegroDescripcion: describirReintegro(d.reintegroEstado as ReintegroEstado, d.reintegroMedio),
    items: d.items.map((item) => ({
      ventaItemId: item.ventaItemId,
      nombre: item.ventaItem.varianteNombre ? `${item.ventaItem.nombre} — ${item.ventaItem.varianteNombre}` : item.ventaItem.nombre,
      cantidad: item.cantidad,
      importe: moneyToNumber(item.importeDecimal),
      stockResultado: item.stockResultado,
    })),
  }
}

async function nombresEmpleados(db: Pick<Db, "empleado">, negocioId: string, ids: Iterable<string>) {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return new Map<string, string>()
  const rows = await db.empleado.findMany({ where: { negocioId, id: { in: unique } }, select: { id: true, nombre: true } })
  return new Map(rows.map((r) => [r.id, r.nombre]))
}

function empleadoIdsDe(ventas: Array<{ devoluciones: Array<{ actorTipo: string; actorId: string; reintegroActorTipo: string | null; reintegroActorId: string | null }> }>) {
  return ventas.flatMap((v) => v.devoluciones.flatMap((d) => [
    ...(d.actorTipo === "EMPLEADO" ? [d.actorId] : []),
    ...(d.reintegroActorTipo === "EMPLEADO" && d.reintegroActorId ? [d.reintegroActorId] : []),
  ]))
}

export const HISTORIAL_RANGO_MAX_DIAS = 31
export const HISTORIAL_LIMITE = 50

export type FiltroHistorial = { ok: true; desde: Date | null; hasta: Date | null; ref: string | null } | { ok: false; error: string }

/** ?desde=ISO&hasta=ISO (≤ 31 days) or ?ref=<first chars of the sale id>. */
export function parseFiltroHistorial(params: URLSearchParams): FiltroHistorial {
  const ref = params.get("ref")?.trim().replace(/^#/, "").toLowerCase() ?? ""
  if (ref) {
    if (!/^[a-z0-9]{4,30}$/.test(ref)) return { ok: false, error: "Ingresá al menos 4 caracteres de la referencia de la venta." }
    return { ok: true, desde: null, hasta: null, ref }
  }
  const desde = new Date(params.get("desde") ?? "")
  const hasta = new Date(params.get("hasta") ?? "")
  if (Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime()) || hasta <= desde) return { ok: false, error: "Rango de fechas inválido." }
  if (hasta.getTime() - desde.getTime() > HISTORIAL_RANGO_MAX_DIAS * 86_400_000) return { ok: false, error: `El rango no puede superar ${HISTORIAL_RANGO_MAX_DIAS} días.` }
  return { ok: true, desde, hasta, ref: null }
}

export async function listarVentasConDevoluciones(
  db: Db,
  negocioId: string,
  filtro: Extract<FiltroHistorial, { ok: true }>,
  vista: { tipo: "NEGOCIO" } | { tipo: "EMPLEADO"; empleadoId: string }
) {
  const ventas = await db.venta.findMany({
    where: { negocioId, ...(filtro.ref ? { id: { startsWith: filtro.ref } } : { createdAt: { gte: filtro.desde!, lt: filtro.hasta! } }) },
    include: VENTA_HISTORIAL_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: HISTORIAL_LIMITE,
  })
  const v = vista.tipo === "NEGOCIO" ? { tipo: "NEGOCIO" as const, nombres: await nombresEmpleados(db, negocioId, empleadoIdsDe(ventas)) } : vista
  return ventas.map((venta) => ventaConDevolucionesParaRespuesta(venta, v))
}

export async function detalleVentaConDevoluciones(db: Db, negocioId: string, ventaId: string, vista: { tipo: "NEGOCIO" } | { tipo: "EMPLEADO"; empleadoId: string }) {
  const venta = await db.venta.findFirst({ where: { id: ventaId, negocioId }, include: VENTA_HISTORIAL_INCLUDE })
  if (!venta) return null
  const v = vista.tipo === "NEGOCIO" ? { tipo: "NEGOCIO" as const, nombres: await nombresEmpleados(db, negocioId, empleadoIdsDe([venta])) } : vista
  return ventaConDevolucionesParaRespuesta(venta, v)
}

/** Owner-only operations history (every return/void, newest first). */
export async function listarDevolucionesNegocio(db: Db, negocioId: string, filtro: { desde: Date; hasta: Date }) {
  const rows = await db.devolucionVenta.findMany({
    where: { negocioId, createdAt: { gte: filtro.desde, lt: filtro.hasta } },
    include: DEVOLUCION_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: 200,
  })
  const nombres = await nombresEmpleados(db, negocioId, empleadoIdsDe([{ devoluciones: rows }]))
  return rows.map((d) => devolucionParaRespuesta(d, { tipo: "NEGOCIO", nombres }))
}
