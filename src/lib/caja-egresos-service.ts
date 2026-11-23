// ============================================
// F10-C1a — egresos de efectivo de Caja (server only)
// ============================================
// The ONE writer of cash outflows, shared by the owner and cashier routes.
// Identity always comes from the caller's verified session (owner session →
// NEGOCIO; personal operational session with área caja → EMPLEADO); nothing in
// a request body chooses the business, the actor or (for a cashier) the shift.
//
// Three natures that are NEVER added together in a report:
//   - GASTO           real operating expense paid to a third party (with a category);
//   - PAGO_PROVEEDOR  payment to a supplier: it settles a purchase / payable (F5
//                     links it to receptions; it is not a second cost of the goods);
//   - RETIRO_DUENO    cash taken by the owner (or someone the owner authorised):
//                     not an expense. Internal transfers (safe / bank / another
//                     register) are NOT outflows: they belong to F10-D/E.
//
// One Serializable transaction (bounded retry) does everything or nothing:
//   - idempotency (Idempotency-Key + content fingerprint, same actor), checked
//     before anything else: a replay answers the original outflow even after
//     the shift closed; a reused key with other data → 409;
//   - an OPEN shift is always required (also in OPCIONAL mode): a cashier only
//     ever uses their OWN open shift; the owner uses the selected register's
//     open shift (own or an employee's) or the only open one;
//   - the physical register row is locked FOR UPDATE — the same lock the sale
//     engine and the blind close take — so an outflow racing the close either
//     commits first (and enters the close's expected cash) or retries against
//     the closed shift and gets 409 without writing anything;
//   - money: ONE operation (GASTO | PAGO_PROVEEDOR | RETIRO_DUENO) with ONE
//     negative leg on the register's cash account, attributed to that shift.
//     The shift's expected cash goes down through the EXISTING formula (fund +
//     legs of the shift); the close formula is not touched;
//   - insufficient expected cash never blocks. The server stores the exact
//     flag (and the expected cash before the outflow, owner-only data). The
//     owner who registers such an outflow sees the figures and must justify
//     it; a cashier never receives any expected-cash signal (blind close) and
//     the owner gets a priority notice instead;
//   - an employee's outflow always leaves a persistent notice for the owner
//     (priority when it is a withdrawal, exceeds the expected cash or reaches
//     the business threshold);
//   - R1: the audit is written INSIDE the same transaction (only for a new
//     outflow; a replay writes nothing). A failed audit rolls everything back.
// Reviews (REVISADO / OBSERVADO) and the single confirmation of a withdrawal
// registered by an employee (CONFIRMADO / NO_RECIBIDO) never move money; they
// append a history row and are audited in their own transaction.
// F10-C1c — compensation (owner only): ONE total REVERSION of the outflow, in
// its OWN shift while that shift is still OPEN (the owner asserts the cash is
// physically in the drawer: it never left or came back before the close). The
// original outflow, its leg and its history are never modified. After the
// close it is BLOCKED (no write): the closed shift's figures are frozen and a
// shift-less reversion would add cash to the register account that no drawer
// holds (deliveries are not ledger movements). That case belongs to the closing
// reconciliation (F10-D) and is documented, not simulated.

import { createHash } from "node:crypto"
import { Prisma, type PrismaClient } from "@prisma/client"
import { MONEY_MAX, MoneyError, moneyToNumber, toDecimalExact } from "@/lib/money"
import { resolveAreaOperativaEfectiva } from "@/lib/area-operativa"
import { isValidVentaIdempotencyKey } from "@/lib/caja-venta"
import { EMPLEADO_NOMBRE_SELECT, nombreVisibleEmpleado } from "@/lib/caja-nombre-empleado"
import { TURNO_ESTADO_ABIERTO, type CajaActor } from "@/lib/caja-turnos-service"
import { CUENTA_EFECTIVO_CAJA_FISICA_PREFIX } from "@/lib/caja-venta-service"
import { calcularSnapshotEfectivoTurno } from "@/lib/caja-turnos-snapshot"
import { runSerializable } from "@/lib/caja-devoluciones-service"

type Db = PrismaClient
type Tx = Prisma.TransactionClient

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

export const NATURALEZAS_EGRESO = ["GASTO", "PAGO_PROVEEDOR", "RETIRO_DUENO"] as const
export type NaturalezaEgreso = (typeof NATURALEZAS_EGRESO)[number]
export const CATEGORIAS_GASTO = ["INSUMOS", "SERVICIOS", "TRANSPORTE", "MANTENIMIENTO", "OTRO"] as const
export type CategoriaGasto = (typeof CATEGORIAS_GASTO)[number]
export const DESTINATARIOS_RETIRO = ["DUENO", "AUTORIZADO_POR_DUENO"] as const
export type DestinatarioRetiro = (typeof DESTINATARIOS_RETIRO)[number]
export const RESULTADOS_REVISION_EGRESO = ["REVISADO", "OBSERVADO"] as const
export const RESULTADOS_CONFIRMACION_RETIRO = ["CONFIRMADO", "NO_RECIBIDO"] as const
/** Ledger operation types of an outflow — one per nature (never mixed in reports). */
export const TIPOS_OPERACION_EGRESO: Readonly<Record<NaturalezaEgreso, string>> = { GASTO: "GASTO", PAGO_PROVEEDOR: "PAGO_PROVEEDOR", RETIRO_DUENO: "RETIRO_DUENO" }
export const NOTIFICACION_TIPO_EGRESO = "caja_egreso"
/** F10-C1c: ledger type of the total compensation of an outflow. */
export const TIPO_OPERACION_COMPENSACION = "REVERSION"
export const MOTIVO_EGRESO_MAX = 500
const TEXTO_CORTO_MAX = 120
const IDENTIFICACION_MAX = 40

export type EgresoResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: 400 | 403 | 404 | 409; error: string; code?: string; detalle?: Record<string, unknown> }

const fail = (status: 400 | 403 | 404 | 409, error: string, code?: string, detalle?: Record<string, unknown>) =>
  ({ ok: false as const, status, error, ...(code ? { code } : {}), ...(detalle ? { detalle } : {}) })

// ---------------------------------------------------------------------------
// Input validation (pure)
// ---------------------------------------------------------------------------

const IMPORTE_PATTERN = /^\d{1,10}(\.\d{1,2})?$/

export function parseImporteEgreso(value: unknown): { ok: true; value: Prisma.Decimal } | { ok: false; error: string } {
  const invalid = { ok: false as const, error: "El importe debe ser mayor a cero, con hasta 2 decimales." }
  if (typeof value === "string" && !IMPORTE_PATTERN.test(value.trim())) return invalid
  if (typeof value !== "string" && typeof value !== "number") return invalid
  let d: Prisma.Decimal
  try {
    d = toDecimalExact(typeof value === "string" ? value.trim() : value)
  } catch (error) {
    if (error instanceof MoneyError) return invalid
    throw error
  }
  if (!d.isPositive() || d.isZero() || d.decimalPlaces() > 2 || d.gt(MONEY_MAX)) return invalid
  return { ok: true, value: d }
}

/** Trimmed, single-spaced text; undefined/null/"" → null; non-string or too long → error. */
function textoOpcional(value: unknown, max: number): { ok: true; value: string | null } | { ok: false } {
  if (value === undefined || value === null) return { ok: true, value: null }
  if (typeof value !== "string") return { ok: false }
  const text = value.trim().replace(/\s+/g, " ")
  if (!text) return { ok: true, value: null }
  return text.length <= max ? { ok: true, value: text } : { ok: false }
}

export interface EgresoSolicitud {
  naturaleza: NaturalezaEgreso
  categoria: CategoriaGasto | null
  importe: Prisma.Decimal
  motivo: string
  proveedorNombre: string | null
  proveedorIdentificacion: string | null
  comprobanteReferencia: string | null
  destinatarioTipo: DestinatarioRetiro | null
  destinatarioNombre: string | null
  justificacion: string | null
  /** Owner only: the register the cash physically leaves from (null = the only open one). */
  cajaFisicaId: string | null
  /**
   * F10-C1c — owner only: the open shift the owner SAW when choosing the register.
   * If that register's open shift changed meanwhile (closed and reopened), nothing
   * is written (409 TURNO_CAMBIO) instead of landing on a shift nobody chose.
   */
  turnoCajaId: string | null
}

/**
 * Validates a registration body. `actorTipo` decides which fields are even
 * accepted: a cashier never chooses a register and never sends a
 * justification (they never see the expected cash).
 */
export function parseEgresoBody(body: unknown, actorTipo: CajaActor["tipo"]): EgresoResult<EgresoSolicitud> {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>
  const naturaleza = b.naturaleza
  if (typeof naturaleza !== "string" || !(NATURALEZAS_EGRESO as readonly string[]).includes(naturaleza)) {
    return fail(400, "Elegí si es un gasto, un pago a proveedor o un retiro para el dueño.", "NATURALEZA_EGRESO_INVALIDA")
  }
  const nat = naturaleza as NaturalezaEgreso
  let categoria: CategoriaGasto | null = null
  if (nat === "GASTO") {
    if (typeof b.categoria !== "string" || !(CATEGORIAS_GASTO as readonly string[]).includes(b.categoria)) {
      return fail(400, "Elegí la categoría del gasto.", "CATEGORIA_EGRESO_INVALIDA")
    }
    categoria = b.categoria as CategoriaGasto
  } else if (b.categoria !== undefined && b.categoria !== null && b.categoria !== "") {
    return fail(400, "La categoría sólo aplica a los gastos.", "CATEGORIA_EGRESO_INVALIDA")
  }
  const importe = parseImporteEgreso(b.importe)
  if (!importe.ok) return fail(400, importe.error, "IMPORTE_EGRESO_INVALIDO")
  const motivo = textoOpcional(b.motivo, MOTIVO_EGRESO_MAX)
  if (!motivo.ok || !motivo.value) return fail(400, "Indicá el motivo de la salida de efectivo (hasta 500 caracteres).", "MOTIVO_EGRESO_REQUERIDO")

  const proveedorNombre = textoOpcional(b.proveedorNombre, TEXTO_CORTO_MAX)
  const proveedorIdentificacion = textoOpcional(b.proveedorIdentificacion, IDENTIFICACION_MAX)
  const comprobanteReferencia = textoOpcional(b.comprobanteReferencia, TEXTO_CORTO_MAX)
  if (!proveedorNombre.ok || !proveedorIdentificacion.ok || !comprobanteReferencia.ok) {
    return fail(400, "Revisá los datos del proveedor o del comprobante.", "DATOS_PROVEEDOR_INVALIDOS")
  }

  let destinatarioTipo: DestinatarioRetiro | null = null
  let destinatarioNombre: string | null = null
  if (nat === "RETIRO_DUENO") {
    if (proveedorNombre.value || proveedorIdentificacion.value || comprobanteReferencia.value) {
      return fail(400, "Un retiro para el dueño no lleva proveedor ni comprobante.", "DATOS_PROVEEDOR_INVALIDOS")
    }
    if (typeof b.destinatarioTipo !== "string" || !(DESTINATARIOS_RETIRO as readonly string[]).includes(b.destinatarioTipo)) {
      return fail(400, "Indicá quién recibe el efectivo: el dueño o una persona autorizada por el dueño.", "DESTINATARIO_RETIRO_REQUERIDO")
    }
    const nombre = textoOpcional(b.destinatarioNombre, TEXTO_CORTO_MAX)
    if (!nombre.ok || !nombre.value) return fail(400, "Indicá el nombre de quien recibe el efectivo.", "DESTINATARIO_RETIRO_REQUERIDO")
    destinatarioTipo = b.destinatarioTipo as DestinatarioRetiro
    destinatarioNombre = nombre.value
  } else if ((b.destinatarioTipo !== undefined && b.destinatarioTipo !== null) || (b.destinatarioNombre !== undefined && b.destinatarioNombre !== null)) {
    return fail(400, "El destinatario sólo aplica a un retiro para el dueño.", "DESTINATARIO_RETIRO_INVALIDO")
  }

  let justificacion: string | null = null
  let cajaFisicaId: string | null = null
  let turnoCajaId: string | null = null
  if (actorTipo === "NEGOCIO") {
    const j = textoOpcional(b.justificacion, MOTIVO_EGRESO_MAX)
    if (!j.ok) return fail(400, "La justificación admite hasta 500 caracteres.", "JUSTIFICACION_INVALIDA")
    justificacion = j.value
    const caja = b.cajaFisicaId
    if (caja !== undefined && caja !== null && (typeof caja !== "string" || !caja.trim())) return fail(400, "Caja inválida.", "CAJA_INVALIDA")
    cajaFisicaId = typeof caja === "string" ? caja.trim() : null
    const turno = b.turnoCajaId
    if (turno !== undefined && turno !== null && (typeof turno !== "string" || !turno.trim())) return fail(400, "Turno inválido.", "TURNO_INVALIDO")
    turnoCajaId = typeof turno === "string" ? turno.trim() : null
    if (turnoCajaId && !cajaFisicaId) return fail(400, "Elegí la caja de la que sale el efectivo.", "CAJA_SELECCION_REQUERIDA")
  } else if ((b.justificacion !== undefined && b.justificacion !== null) || (b.cajaFisicaId !== undefined && b.cajaFisicaId !== null) || (b.turnoCajaId !== undefined && b.turnoCajaId !== null)) {
    // A cashier registers only on their own shift and never justifies against
    // the expected cash; accepting these fields would invite guessing.
    return fail(400, "Datos no válidos para registrar una salida de efectivo.", "CAMPOS_NO_PERMITIDOS")
  }

  return {
    ok: true,
    value: {
      naturaleza: nat,
      categoria,
      importe: importe.value,
      motivo: motivo.value,
      proveedorNombre: proveedorNombre.value,
      proveedorIdentificacion: proveedorIdentificacion.value,
      comprobanteReferencia: comprobanteReferencia.value,
      destinatarioTipo,
      destinatarioNombre,
      justificacion,
      cajaFisicaId,
      turnoCajaId,
    },
  }
}

const actorIdDe = (negocioId: string, actor: CajaActor) => (actor.tipo === "EMPLEADO" ? actor.empleadoId : negocioId)

export function fingerprintEgreso(negocioId: string, s: EgresoSolicitud, actor: CajaActor): string {
  const canon = [
    negocioId, `${actor.tipo}:${actorIdDe(negocioId, actor)}`, s.naturaleza, s.categoria ?? "", s.importe.toFixed(2), s.motivo,
    s.proveedorNombre ?? "", s.proveedorIdentificacion ?? "", s.comprobanteReferencia ?? "", s.destinatarioTipo ?? "", s.destinatarioNombre ?? "",
    s.justificacion ?? "", s.cajaFisicaId ?? "",
    // F10-C1c: appended only when present, so every C1a fingerprint stays identical.
    ...(s.turnoCajaId ? [`turno:${s.turnoCajaId}`] : []),
  ]
  return createHash("sha256").update(JSON.stringify(canon)).digest("hex")
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

/** Maps the SQL guard messages (defense in depth) to controlled answers. */
export function mapEgresoDbError(error: unknown): { status: 409; error: string; code: string } | null {
  const text = error instanceof Error ? error.message : String(error)
  if (text.includes("cash outflow requires an open shift")) {
    return { status: 409, error: "El turno de Caja ya no está abierto. Actualizá la pantalla.", code: "TURNO_NO_DISPONIBLE" }
  }
  if (text.includes("cash outflow withdrawal confirmation already registered")) {
    return { status: 409, error: "La recepción de este retiro ya fue registrada.", code: "CONFIRMACION_YA_REGISTRADA" }
  }
  if (text.includes("cannot change a closed shift") || text.includes("while the shift is open must use that shift") || text.includes("after the close is blocked")) {
    return { status: 409, error: COMPENSACION_POSTERIOR_TEXTO, code: "COMPENSACION_POSTERIOR_BLOQUEADA" }
  }
  if (text.includes("cash outflow is linked to a supplier credit")) {
    return { status: 409, error: COMPENSACION_VINCULADA_TEXTO, code: "PAGO_VINCULADO_A_PROVEEDOR" }
  }
  return null
}

// F5-A (D-8): a PAGO_PROVEEDOR outflow linked to a supplier account cannot be
// compensated while the link is in force (the supplier credit would keep reducing
// the debt with money that went back to the drawer). Unlink it in Proveedores first.
export const COMPENSACION_VINCULADA_TEXTO =
  "Este pago está vinculado a la cuenta de un proveedor. Primero desvinculalo en Proveedores (con su motivo) y después compensalo."

// ---------------------------------------------------------------------------
// Actor + destination (register / shift)
// ---------------------------------------------------------------------------

type ActorResuelto = { tipo: "NEGOCIO" | "EMPLEADO"; actorId: string; empleadoId: string | null; nombre: string }

async function resolverActor(tx: Tx, negocioId: string, actor: CajaActor): Promise<ActorResuelto | null> {
  if (actor.tipo === "NEGOCIO") return { tipo: "NEGOCIO", actorId: negocioId, empleadoId: null, nombre: "Dueño" }
  const empleado = await tx.empleado.findFirst({
    where: { id: actor.empleadoId, negocioId, activo: true, eliminado: false },
    select: { id: true, areaOperativa: true, rol: true, ...EMPLEADO_NOMBRE_SELECT },
  })
  if (!empleado || resolveAreaOperativaEfectiva(empleado) !== "caja") return null
  return { tipo: "EMPLEADO", actorId: empleado.id, empleadoId: empleado.id, nombre: nombreVisibleEmpleado(empleado) }
}

type Destino = { turnoCajaId: string; cajaFisicaId: string; cajaNombre: string; cuentaId: string }

const TURNO_REQUERIDO_CAJERO = fail(409, "Para registrar una salida de efectivo tenés que tener un turno de Caja abierto.", "TURNO_REQUERIDO")
const TURNO_REQUERIDO_DUENO = fail(409, "Para registrar una salida de efectivo tiene que haber un turno de Caja abierto en esa caja.", "TURNO_REQUERIDO")
const TURNO_NO_DISPONIBLE = fail(409, "El turno de Caja ya no está abierto. Actualizá la pantalla.", "TURNO_NO_DISPONIBLE")

async function lockCaja(tx: Tx, negocioId: string, cajaFisicaId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string; activa: boolean; nombre: string }>>`
    SELECT "id", "activa", "nombre" FROM "cajas_fisicas"
    WHERE "id" = ${cajaFisicaId} AND "negocioId" = ${negocioId}
    FOR UPDATE`
  return rows[0] ?? null
}

async function cuentaEfectivoCaja(tx: Tx, negocioId: string, cajaFisicaId: string): Promise<string> {
  const clave = `${CUENTA_EFECTIVO_CAJA_FISICA_PREFIX}${cajaFisicaId}`
  await tx.cuentaFinanciera.createMany({ data: [{ negocioId, clave, tipo: "EFECTIVO", nombre: "Efectivo de caja física", cajaFisicaId }], skipDuplicates: true })
  return (await tx.cuentaFinanciera.findFirstOrThrow({ where: { negocioId, clave, cajaFisicaId }, select: { id: true } })).id
}

/**
 * Where the cash physically leaves from. Always an OPEN shift (D2): a cashier's
 * own shift; for the owner the selected register's open shift or the only open
 * one (several open → explicit choice). The register row lock serializes
 * against a concurrent close; the shift is re-read after taking it.
 */
async function resolverDestino(tx: Tx, negocioId: string, actor: ActorResuelto, cajaElegida: string | null, turnoVisto: string | null = null): Promise<EgresoResult<Destino>> {
  let turnoId: string
  let cajaId: string
  if (actor.tipo === "EMPLEADO") {
    const turno = await tx.turnoCaja.findFirst({
      where: { negocioId, estado: TURNO_ESTADO_ABIERTO, responsableTipo: "EMPLEADO", responsableId: actor.actorId },
      select: { id: true, cajaFisicaId: true },
    })
    if (!turno) return TURNO_REQUERIDO_CAJERO
    turnoId = turno.id
    cajaId = turno.cajaFisicaId
  } else if (cajaElegida) {
    const caja = await lockCaja(tx, negocioId, cajaElegida)
    if (!caja) return fail(404, "Caja no encontrada.", "CAJA_NO_ENCONTRADA")
    if (!caja.activa) return fail(409, "La caja está desactivada.", "CAJA_INACTIVA")
    const turno = await tx.turnoCaja.findFirst({ where: { negocioId, cajaFisicaId: caja.id, estado: TURNO_ESTADO_ABIERTO }, select: { id: true } })
    if (!turno) return TURNO_REQUERIDO_DUENO
    if (turnoVisto && turno.id !== turnoVisto) {
      return fail(409, "El turno de esa caja cambió desde que la elegiste. Actualizá y volvé a elegir la caja. No se registró nada.", "TURNO_CAMBIO")
    }
    turnoId = turno.id
    cajaId = caja.id
  } else {
    // Lock every register first (same order as the sale engine) so a
    // concurrent opening cannot turn a unique destination into an ambiguous one.
    await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "cajas_fisicas" WHERE "negocioId" = ${negocioId} ORDER BY "id" FOR UPDATE`
    const abiertos = await tx.turnoCaja.findMany({ where: { negocioId, estado: TURNO_ESTADO_ABIERTO }, select: { id: true, cajaFisicaId: true }, take: 2 })
    if (abiertos.length > 1) return fail(409, "Hay varias cajas abiertas. Elegí de qué caja sale el efectivo.", "CAJA_SELECCION_REQUERIDA")
    if (abiertos.length === 0) return fail(409, "Para registrar una salida de efectivo tiene que haber un turno de Caja abierto.", "TURNO_REQUERIDO")
    turnoId = abiertos[0].id
    cajaId = abiertos[0].cajaFisicaId
  }

  const caja = await lockCaja(tx, negocioId, cajaId)
  if (!caja?.activa) return TURNO_NO_DISPONIBLE
  const vigente = await tx.turnoCaja.findFirst({
    where: {
      id: turnoId,
      negocioId,
      cajaFisicaId: caja.id,
      estado: TURNO_ESTADO_ABIERTO,
      ...(actor.tipo === "EMPLEADO" ? { responsableTipo: "EMPLEADO", responsableId: actor.actorId } : {}),
    },
    select: { id: true },
  })
  if (!vigente) return TURNO_NO_DISPONIBLE
  return { ok: true, value: { turnoCajaId: turnoId, cajaFisicaId: caja.id, cajaNombre: caja.nombre, cuentaId: await cuentaEfectivoCaja(tx, negocioId, caja.id) } }
}

// ---------------------------------------------------------------------------
// Owner notice
// ---------------------------------------------------------------------------

const money = (value: Prisma.Decimal) => `$${moneyToNumber(value).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

const ETIQUETA_NATURALEZA: Record<NaturalezaEgreso, string> = { GASTO: "gasto", PAGO_PROVEEDOR: "pago a proveedor", RETIRO_DUENO: "retiro para el dueño" }

export function textoNotificacionEgreso(params: {
  nombre: string
  naturaleza: NaturalezaEgreso
  importe: Prisma.Decimal
  cajaNombre: string
  motivo: string
  destinatarioNombre: string | null
  excedeEsperado: boolean
  superaUmbral: boolean
  umbral: Prisma.Decimal | null
}): { titulo: string; cuerpo: string } {
  const titulo =
    params.naturaleza === "RETIRO_DUENO" ? "Retiro de efectivo: confirmá la recepción"
    : params.naturaleza === "PAGO_PROVEEDOR" ? "Pago a proveedor registrado en Caja"
    : "Gasto registrado en Caja"
  const partes = [`${params.nombre} registró una salida de efectivo de ${money(params.importe)} (${ETIQUETA_NATURALEZA[params.naturaleza]}) en ${params.cajaNombre}.`]
  if (params.naturaleza === "RETIRO_DUENO" && params.destinatarioNombre) partes.push(`Lo recibió: ${params.destinatarioNombre}.`)
  partes.push(`Motivo: ${params.motivo}.`)
  if (params.excedeEsperado) partes.push("Atención: el efectivo esperado del turno quedó negativo.")
  if (params.superaUmbral && params.umbral) partes.push(`Supera el umbral de aviso de ${money(params.umbral)}.`)
  return { titulo, cuerpo: partes.join(" ") }
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export const EGRESO_INCLUDE = {
  revisiones: { orderBy: { createdAt: "asc" as const } },
  compensacion: { select: { id: true, momento: true, createdAt: true, motivo: true, importeDecimal: true, operacionId: true } },
  turno: { select: { cajaFisica: { select: { nombre: true } }, responsableTipo: true, responsableId: true, estado: true } },
  // F5-A: the supplier link in force (at most one: partial unique index); owner view only.
  creditosProveedor: { where: { origen: "PAGO_CAJA", estado: "VIGENTE" }, select: { id: true, proveedor: { select: { id: true, nombre: true } } } },
} satisfies Prisma.EgresoCajaInclude
export type EgresoConDetalle = Prisma.EgresoCajaGetPayload<{ include: typeof EGRESO_INCLUDE }>

/** Must run inside the outflow's transaction; receives the new outflow (never a replay). */
export type AuditoriaEgresoEnTx<T> = (tx: Tx, resultado: T) => Promise<void>

export interface RegistrarEgresoInput {
  negocioId: string
  actor: CajaActor
  solicitud: EgresoSolicitud
  idempotencyKey: string
}

type ResultadoEgreso = EgresoResult<{ egreso: EgresoConDetalle; replayed: boolean }>

function replayEgreso(row: EgresoConDetalle, fingerprint: string, negocioId: string, actor: CajaActor): ResultadoEgreso {
  if (row.idempotencyFingerprint !== fingerprint || row.actorTipo !== actor.tipo || row.actorId !== actorIdDe(negocioId, actor)) {
    return fail(409, "Este intento ya se usó con otros datos.", "IDEMPOTENCY_KEY_REUSED")
  }
  return { ok: true, value: { egreso: row, replayed: true } }
}

async function buscarPorClave(db: Pick<Tx, "egresoCaja">, negocioId: string, key: string) {
  return db.egresoCaja.findUnique({ where: { negocioId_idempotencyKey: { negocioId, idempotencyKey: key } }, include: EGRESO_INCLUDE })
}

export async function registrarEgresoCaja(db: Db, input: RegistrarEgresoInput, opciones: { auditar?: AuditoriaEgresoEnTx<EgresoConDetalle> } = {}): Promise<ResultadoEgreso> {
  const { negocioId, actor, solicitud: s } = input
  if (!isValidVentaIdempotencyKey(input.idempotencyKey)) return fail(400, "Falta una Idempotency-Key válida.", "IDEMPOTENCY_KEY_REQUIRED")
  const key = input.idempotencyKey.toLowerCase()
  const fingerprint = fingerprintEgreso(negocioId, s, actor)
  try {
    return await runSerializable(db, async (tx): Promise<ResultadoEgreso> => {
      const existente = await buscarPorClave(tx, negocioId, key)
      if (existente) return replayEgreso(existente, fingerprint, negocioId, actor)

      const actorResuelto = await resolverActor(tx, negocioId, actor)
      if (!actorResuelto) return fail(403, "Acceso denegado")
      const destino = await resolverDestino(tx, negocioId, actorResuelto, actor.tipo === "NEGOCIO" ? s.cajaFisicaId : null, actor.tipo === "NEGOCIO" ? s.turnoCajaId : null)
      if (!destino.ok) return destino

      const snapshot = await calcularSnapshotEfectivoTurno(tx, negocioId, destino.value.turnoCajaId)
      if (!snapshot) return TURNO_NO_DISPONIBLE
      const esperadoPrevio = snapshot.esperado
      const esperadoResultante = esperadoPrevio.minus(s.importe)
      const excedeEsperado = esperadoResultante.isNegative() && !esperadoResultante.isZero()
      if (actorResuelto.tipo === "NEGOCIO" && excedeEsperado && !s.justificacion) {
        // Owner-only data: the owner sees the figures and justifies; nothing is written.
        return fail(409, "Esta salida deja el efectivo esperado del turno en negativo. Escribí una justificación para registrarla.", "JUSTIFICACION_REQUERIDA", {
          esperadoPrevio: esperadoPrevio.toFixed(2),
          esperadoResultante: esperadoResultante.toFixed(2),
        })
      }
      const negocio = await tx.negocio.findUnique({ where: { id: negocioId }, select: { cajaEgresoAvisoUmbralDecimal: true } })
      const umbral = negocio?.cajaEgresoAvisoUmbralDecimal ?? null
      const superaUmbral = actorResuelto.tipo === "EMPLEADO" && umbral !== null && s.importe.gte(umbral)

      const salida = s.importe.negated()
      const operacion = await tx.operacionFinanciera.create({
        data: {
          negocioId,
          tipo: TIPOS_OPERACION_EGRESO[s.naturaleza],
          actorTipo: actorResuelto.tipo,
          actorId: actorResuelto.actorId,
          turnoCajaId: destino.value.turnoCajaId,
          movimientos: { create: [{ negocioId, cuentaId: destino.value.cuentaId, importe: moneyToNumber(salida), importeDecimal: salida }] },
        },
        select: { id: true },
      })
      const creado = await tx.egresoCaja.create({
        data: {
          negocioId,
          operacionId: operacion.id,
          turnoCajaId: destino.value.turnoCajaId,
          cajaFisicaId: destino.value.cajaFisicaId,
          naturaleza: s.naturaleza,
          categoria: s.categoria,
          importeDecimal: s.importe,
          motivo: s.motivo,
          actorTipo: actorResuelto.tipo,
          actorId: actorResuelto.actorId,
          empleadoId: actorResuelto.empleadoId,
          proveedorNombre: s.proveedorNombre,
          proveedorIdentificacion: s.proveedorIdentificacion,
          comprobanteReferencia: s.comprobanteReferencia,
          destinatarioTipo: s.destinatarioTipo,
          destinatarioNombre: s.destinatarioNombre,
          confirmacionRetiroEstado: s.naturaleza === "RETIRO_DUENO" ? (actorResuelto.tipo === "NEGOCIO" ? "NO_REQUERIDA" : "PENDIENTE") : null,
          esperadoPrevioDecimal: esperadoPrevio,
          excedeEsperado,
          umbralAvisoDecimal: umbral,
          superaUmbral,
          justificacion: actorResuelto.tipo === "NEGOCIO" ? s.justificacion : null,
          idempotencyKey: key,
          idempotencyFingerprint: fingerprint,
        },
        include: EGRESO_INCLUDE,
      })

      if (actorResuelto.tipo === "EMPLEADO") {
        const texto = textoNotificacionEgreso({
          nombre: actorResuelto.nombre,
          naturaleza: s.naturaleza,
          importe: s.importe,
          cajaNombre: destino.value.cajaNombre,
          motivo: s.motivo,
          destinatarioNombre: s.destinatarioNombre,
          excedeEsperado,
          superaUmbral,
          umbral,
        })
        await tx.notificacion.create({
          data: {
            userId: negocioId,
            userType: "negocio",
            tipo: NOTIFICACION_TIPO_EGRESO,
            titulo: texto.titulo,
            cuerpo: texto.cuerpo,
            negocioId,
            datos: JSON.stringify({
              navigateTo: { negocio: "caja" },
              egresoId: creado.id,
              naturaleza: s.naturaleza,
              prioridad: s.naturaleza === "RETIRO_DUENO" || excedeEsperado || superaUmbral ? "ALTA" : "NORMAL",
              alertas: { retiro: s.naturaleza === "RETIRO_DUENO", excedeEsperado, superaUmbral },
            }),
          },
        })
      }

      if (opciones.auditar) await opciones.auditar(tx, creado)
      return { ok: true, value: { egreso: creado, replayed: false } }
    })
  } catch (error) {
    // A concurrent request with the same key committed first: answer its result.
    if (isUniqueViolation(error)) {
      const existente = await buscarPorClave(db, negocioId, key)
      if (existente) return replayEgreso(existente, fingerprint, negocioId, actor)
    }
    const mapped = mapEgresoDbError(error)
    if (mapped) return fail(mapped.status, mapped.error, mapped.code)
    throw error
  }
}

// ---------------------------------------------------------------------------
// Owner review and withdrawal confirmation (never move money)
// ---------------------------------------------------------------------------

export interface DecisionEgresoInput {
  negocioId: string
  egresoId: string
  resultado: unknown
  observacion: unknown
  idempotencyKey: string
}

type Accion = "REVISION" | "CONFIRMACION_RETIRO"

function parseDecision(accion: Accion, input: DecisionEgresoInput): EgresoResult<{ resultado: string; observacion: string | null }> {
  const permitidos: readonly string[] = accion === "REVISION" ? RESULTADOS_REVISION_EGRESO : RESULTADOS_CONFIRMACION_RETIRO
  if (typeof input.resultado !== "string" || !permitidos.includes(input.resultado)) {
    return fail(400, accion === "REVISION" ? "Elegí Revisado u Observado." : "Indicá si recibiste el efectivo.", "RESULTADO_INVALIDO")
  }
  const obs = textoOpcional(input.observacion, MOTIVO_EGRESO_MAX)
  if (!obs.ok) return fail(400, "La observación admite hasta 500 caracteres.", "OBSERVACION_INVALIDA")
  if ((input.resultado === "OBSERVADO" || input.resultado === "NO_RECIBIDO") && !obs.value) {
    return fail(400, "Escribí una observación.", "OBSERVACION_REQUERIDA")
  }
  return { ok: true, value: { resultado: input.resultado, observacion: obs.value } }
}

function fingerprintDecision(negocioId: string, egresoId: string, accion: Accion, resultado: string, observacion: string | null) {
  return createHash("sha256").update(JSON.stringify([negocioId, egresoId, accion, resultado, observacion ?? ""])).digest("hex")
}

async function decidirEgreso(db: Db, accion: Accion, input: DecisionEgresoInput, opciones: { auditar?: AuditoriaEgresoEnTx<EgresoConDetalle> }): Promise<ResultadoEgreso> {
  const { negocioId, egresoId } = input
  if (!egresoId?.trim()) return fail(400, "Egreso inválido.", "EGRESO_INVALIDO")
  if (!isValidVentaIdempotencyKey(input.idempotencyKey)) return fail(400, "Falta una Idempotency-Key válida.", "IDEMPOTENCY_KEY_REQUIRED")
  const key = input.idempotencyKey.toLowerCase()
  const parsed = parseDecision(accion, input)
  if (!parsed.ok) return parsed
  const { resultado, observacion } = parsed.value
  const fingerprint = fingerprintDecision(negocioId, egresoId, accion, resultado, observacion)

  const replay = async (client: Pick<Tx, "revisionEgresoCaja" | "egresoCaja">): Promise<ResultadoEgreso | null> => {
    const previa = await client.revisionEgresoCaja.findUnique({ where: { negocioId_idempotencyKey: { negocioId, idempotencyKey: key } } })
    if (!previa) return null
    if (previa.egresoId !== egresoId || previa.accion !== accion || previa.idempotencyFingerprint !== fingerprint) {
      return fail(409, "Este intento ya se usó con otros datos.", "IDEMPOTENCY_KEY_REUSED")
    }
    const egreso = await client.egresoCaja.findFirst({ where: { id: egresoId, negocioId }, include: EGRESO_INCLUDE })
    return egreso ? { ok: true, value: { egreso, replayed: true } } : fail(404, "Egreso no encontrado.", "EGRESO_NO_ENCONTRADO")
  }

  try {
    return await runSerializable(db, async (tx): Promise<ResultadoEgreso> => {
      const previa = await replay(tx)
      if (previa) return previa
      // Row lock: concurrent decisions on the same outflow are applied one after the other.
      const filas = await tx.$queryRaw<Array<{ id: string; naturaleza: string; confirmacionRetiroEstado: string | null }>>`
        SELECT "id", "naturaleza", "confirmacionRetiroEstado" FROM "egresos_caja"
        WHERE "id" = ${egresoId} AND "negocioId" = ${negocioId}
        FOR UPDATE`
      const fila = filas[0]
      if (!fila) return fail(404, "Egreso no encontrado.", "EGRESO_NO_ENCONTRADO")
      if (accion === "CONFIRMACION_RETIRO") {
        if (fila.naturaleza !== "RETIRO_DUENO" || fila.confirmacionRetiroEstado === "NO_REQUERIDA") {
          return fail(409, "Este egreso no necesita confirmación de recepción.", "CONFIRMACION_NO_REQUERIDA")
        }
        if (fila.confirmacionRetiroEstado !== "PENDIENTE") return fail(409, "La recepción de este retiro ya fue registrada.", "CONFIRMACION_YA_REGISTRADA")
        // F10-C1c: a compensated withdrawal never left the drawer; confirming its receipt would contradict the ledger.
        const compensada = await tx.compensacionEgresoCaja.findUnique({ where: { egresoId_negocioId: { egresoId, negocioId } }, select: { id: true } })
        if (compensada) return fail(409, "Este retiro fue anulado con una compensación: no hay recepción que confirmar.", "EGRESO_COMPENSADO")
      }
      const fecha = new Date()
      await tx.revisionEgresoCaja.create({
        data: { negocioId, egresoId, accion, resultado, observacion, actorTipo: "NEGOCIO", actorId: negocioId, idempotencyKey: key, idempotencyFingerprint: fingerprint, createdAt: fecha },
      })
      const egreso = await tx.egresoCaja.update({
        where: { id: egresoId },
        data: accion === "REVISION"
          ? { estadoRevision: resultado, revisadoEn: fecha, revisadoPorId: negocioId }
          : { confirmacionRetiroEstado: resultado, confirmacionRetiroEn: fecha, confirmacionRetiroActorId: negocioId },
        include: EGRESO_INCLUDE,
      })
      if (opciones.auditar) await opciones.auditar(tx, egreso)
      return { ok: true, value: { egreso, replayed: false } }
    })
  } catch (error) {
    if (isUniqueViolation(error)) {
      const previa = await replay(db)
      if (previa) return previa
      if (accion === "CONFIRMACION_RETIRO") return fail(409, "La recepción de este retiro ya fue registrada.", "CONFIRMACION_YA_REGISTRADA")
    }
    const mapped = mapEgresoDbError(error)
    if (mapped) return fail(mapped.status, mapped.error, mapped.code)
    throw error
  }
}

/** Owner review: REVISADO | OBSERVADO (observation required). Appends history; never moves money. */
export function revisarEgresoCaja(db: Db, input: DecisionEgresoInput, opciones: { auditar?: AuditoriaEgresoEnTx<EgresoConDetalle> } = {}) {
  return decidirEgreso(db, "REVISION", input, opciones)
}

/** Owner confirms, once, a withdrawal an employee registered: CONFIRMADO | NO_RECIBIDO. Never moves money. */
export function confirmarRetiroEgresoCaja(db: Db, input: DecisionEgresoInput, opciones: { auditar?: AuditoriaEgresoEnTx<EgresoConDetalle> } = {}) {
  return decidirEgreso(db, "CONFIRMACION_RETIRO", input, opciones)
}


// ---------------------------------------------------------------------------
// F10-C1c — compensation (owner only; the only correction that moves money)
// ---------------------------------------------------------------------------
// Total and once: a REVERSION operation (revierteOperacionId = the outflow's
// operation, UNIQUE) with ONE positive leg of the same amount on the same
// register cash account, attributed to the outflow's OWN shift while it is
// still OPEN — the shift's expected cash goes back up through the existing
// formula. The original outflow row, its operation and its leg are never
// modified; the history keeps both. To correct an amount or a nature the owner
// compensates and registers the right outflow (a normal registration).
//
// Real cash recovery, analysed before implementing (D-C1c-1):
//   - shift OPEN: the owner asserts the cash is physically in that drawer
//     (it never left, or it came back before the close). The cashier's blind
//     count at the close then matches. Financially exact → implemented;
//   - shift CLOSED: the close froze declared and expected cash and the
//     difference; the cash then went to custody (EntregaCustodia is NOT a
//     ledger movement). A shift-less reversion would add cash to the register
//     account that no drawer holds — fictitious money. Whether the outflow was
//     a typo (the surplus already left with the delivery) or the cash really
//     came back later (a new inflow, in the shift that receives it), both need
//     the closing reconciliation / custody accounts of F10-D → BLOCKED here
//     (409, nothing written). An administrative observation stays available.

export const COMPENSACION_POSTERIOR_TEXTO =
  "El turno de esta salida ya cerró: la corrección posterior al cierre todavía no está habilitada porque el efectivo de un turno cerrado ya se contó y se entregó. No se modificó nada. Podés dejar una observación en la salida."

export interface CompensarEgresoInput {
  negocioId: string
  egresoId: string
  motivo: unknown
  /** The owner asserts the outflow's cash is physically in that register's drawer. */
  confirmoEfectivoEnCaja: unknown
  idempotencyKey: string
}

export type CompensacionCreada = { id: string; operacionId: string; importeDecimal: Prisma.Decimal; momento: string; turnoCajaId: string | null; motivo: string }

function fingerprintCompensacion(negocioId: string, egresoId: string, motivo: string) {
  return createHash("sha256").update(JSON.stringify([negocioId, egresoId, "COMPENSACION", motivo])).digest("hex")
}

export async function compensarEgresoCaja(
  db: Db,
  input: CompensarEgresoInput,
  opciones: { auditar?: (tx: Tx, resultado: { egreso: EgresoConDetalle; compensacion: CompensacionCreada }) => Promise<void> } = {}
): Promise<ResultadoEgreso> {
  const { negocioId, egresoId } = input
  if (!egresoId?.trim()) return fail(400, "Egreso inválido.", "EGRESO_INVALIDO")
  if (!isValidVentaIdempotencyKey(input.idempotencyKey)) return fail(400, "Falta una Idempotency-Key válida.", "IDEMPOTENCY_KEY_REQUIRED")
  const key = input.idempotencyKey.toLowerCase()
  const motivo = textoOpcional(input.motivo, MOTIVO_EGRESO_MAX)
  if (!motivo.ok || !motivo.value) return fail(400, "Indicá el motivo de la compensación (hasta 500 caracteres).", "MOTIVO_COMPENSACION_REQUERIDO")
  const motivoTexto = motivo.value
  if (input.confirmoEfectivoEnCaja !== true) {
    return fail(400, "Confirmá que el efectivo de esta salida está físicamente en la caja.", "CONFIRMACION_EFECTIVO_REQUERIDA")
  }
  const fingerprint = fingerprintCompensacion(negocioId, egresoId, motivoTexto)

  const replay = async (client: Pick<Tx, "compensacionEgresoCaja" | "egresoCaja">): Promise<ResultadoEgreso | null> => {
    const previa = await client.compensacionEgresoCaja.findUnique({ where: { negocioId_idempotencyKey: { negocioId, idempotencyKey: key } } })
    if (!previa) return null
    if (previa.egresoId !== egresoId || previa.idempotencyFingerprint !== fingerprint) return fail(409, "Este intento ya se usó con otros datos.", "IDEMPOTENCY_KEY_REUSED")
    const egreso = await client.egresoCaja.findFirst({ where: { id: egresoId, negocioId }, include: EGRESO_INCLUDE })
    return egreso ? { ok: true, value: { egreso, replayed: true } } : fail(404, "Egreso no encontrado.", "EGRESO_NO_ENCONTRADO")
  }
  const yaCompensado = fail(409, "Esta salida ya fue compensada. El historial conserva la salida original y su compensación.", "EGRESO_YA_COMPENSADO")

  try {
    return await runSerializable(db, async (tx): Promise<ResultadoEgreso> => {
      const previa = await replay(tx)
      if (previa) return previa
      const base = await tx.egresoCaja.findFirst({ where: { id: egresoId, negocioId }, select: { cajaFisicaId: true } })
      if (!base) return fail(404, "Egreso no encontrado.", "EGRESO_NO_ENCONTRADO")
      // Same lock order as a registration and as the blind close (register row
      // first): a compensation racing the close either commits first (and the
      // close counts it) or retries, sees the closed shift and writes nothing.
      await lockCaja(tx, negocioId, base.cajaFisicaId)
      const filas = await tx.$queryRaw<Array<{ id: string; operacionId: string; turnoCajaId: string; cajaFisicaId: string; importeDecimal: Prisma.Decimal }>>`
        SELECT "id", "operacionId", "turnoCajaId", "cajaFisicaId", "importeDecimal" FROM "egresos_caja"
        WHERE "id" = ${egresoId} AND "negocioId" = ${negocioId}
        FOR UPDATE`
      const egreso = filas[0]
      if (!egreso) return fail(404, "Egreso no encontrado.", "EGRESO_NO_ENCONTRADO")
      if (await tx.compensacionEgresoCaja.findUnique({ where: { egresoId_negocioId: { egresoId, negocioId } }, select: { id: true } })) return yaCompensado
      // F5-A (D-8): same egreso row lock as the supplier link (register row → outflow row),
      // so a link and a compensation racing each other are ordered; the SQL trigger repeats it.
      if (await tx.creditoProveedor.findFirst({ where: { negocioId, egresoCajaId: egresoId, origen: "PAGO_CAJA", estado: "VIGENTE" }, select: { id: true } })) {
        return fail(409, COMPENSACION_VINCULADA_TEXTO, "PAGO_VINCULADO_A_PROVEEDOR")
      }
      const turno = await tx.turnoCaja.findFirst({ where: { id: egreso.turnoCajaId, negocioId }, select: { estado: true } })
      if (turno?.estado !== TURNO_ESTADO_ABIERTO) return fail(409, COMPENSACION_POSTERIOR_TEXTO, "COMPENSACION_POSTERIOR_BLOQUEADA")
      const pata = await tx.movimientoFinanciero.findFirst({ where: { operacionId: egreso.operacionId, negocioId }, select: { cuentaId: true, importeDecimal: true } })
      const importe = new Prisma.Decimal(egreso.importeDecimal)
      if (!pata?.importeDecimal || !pata.importeDecimal.negated().equals(importe)) throw new Error("cash outflow ledger leg is inconsistent")
      const operacion = await tx.operacionFinanciera.create({
        data: {
          negocioId,
          tipo: TIPO_OPERACION_COMPENSACION,
          actorTipo: "NEGOCIO",
          actorId: negocioId,
          turnoCajaId: egreso.turnoCajaId,
          revierteOperacionId: egreso.operacionId,
          movimientos: { create: [{ negocioId, cuentaId: pata.cuentaId, importe: moneyToNumber(importe), importeDecimal: importe }] },
        },
        select: { id: true },
      })
      const compensacion = await tx.compensacionEgresoCaja.create({
        data: {
          negocioId,
          egresoId,
          operacionId: operacion.id,
          momento: "TURNO_ABIERTO",
          turnoCajaId: egreso.turnoCajaId,
          cajaFisicaId: egreso.cajaFisicaId,
          importeDecimal: importe,
          motivo: motivoTexto,
          actorId: negocioId,
          idempotencyKey: key,
          idempotencyFingerprint: fingerprint,
        },
        select: { id: true, operacionId: true, importeDecimal: true, momento: true, turnoCajaId: true, motivo: true },
      })
      const actualizado = await tx.egresoCaja.findFirstOrThrow({ where: { id: egresoId, negocioId }, include: EGRESO_INCLUDE })
      if (opciones.auditar) await opciones.auditar(tx, { egreso: actualizado, compensacion })
      return { ok: true, value: { egreso: actualizado, replayed: false } }
    })
  } catch (error) {
    if (isUniqueViolation(error)) {
      const previa = await replay(db)
      if (previa) return previa
      return yaCompensado
    }
    const mapped = mapEgresoDbError(error)
    if (mapped) return fail(mapped.status, mapped.error, mapped.code)
    throw error
  }
}

// ---------------------------------------------------------------------------
// Owner threshold configuration (informative; never blocks)
// ---------------------------------------------------------------------------

export async function leerConfiguracionEgresos(db: Pick<Db, "negocio">, negocioId: string) {
  const negocio = await db.negocio.findUnique({ where: { id: negocioId }, select: { cajaEgresoAvisoUmbralDecimal: true } })
  const umbral = negocio?.cajaEgresoAvisoUmbralDecimal ?? null
  return { umbralAviso: umbral ? moneyToNumber(umbral) : null }
}

export async function actualizarUmbralEgresos(
  db: Db,
  negocioId: string,
  value: unknown,
  opciones: { auditar?: (tx: Tx, cambio: { anterior: Prisma.Decimal | null; nuevo: Prisma.Decimal | null }) => Promise<void> } = {}
): Promise<EgresoResult<{ umbralAviso: number | null }>> {
  let nuevo: Prisma.Decimal | null = null
  if (value !== null && value !== undefined && value !== "") {
    const parsed = parseImporteEgreso(value)
    if (!parsed.ok) return fail(400, "El umbral debe ser un importe mayor a cero, con hasta 2 decimales, o vacío para no usar umbral.", "UMBRAL_INVALIDO")
    nuevo = parsed.value
  }
  return runSerializable(db, async (tx) => {
    const actual = await tx.negocio.findUnique({ where: { id: negocioId }, select: { cajaEgresoAvisoUmbralDecimal: true } })
    if (!actual) return fail(404, "Negocio no encontrado.")
    const anterior = actual.cajaEgresoAvisoUmbralDecimal
    const igual = anterior === null ? nuevo === null : nuevo !== null && anterior.equals(nuevo)
    if (!igual) {
      await tx.negocio.update({ where: { id: negocioId }, data: { cajaEgresoAvisoUmbralDecimal: nuevo } })
      if (opciones.auditar) await opciones.auditar(tx, { anterior, nuevo })
    }
    return { ok: true as const, value: { umbralAviso: nuevo ? moneyToNumber(nuevo) : null } }
  })
}

// ---------------------------------------------------------------------------
// Reads and response shapes
// ---------------------------------------------------------------------------

async function nombresEmpleados(db: Pick<Db, "empleado">, negocioId: string, ids: Iterable<string>) {
  const unicos = [...new Set(ids)]
  if (unicos.length === 0) return new Map<string, string>()
  const empleados = await db.empleado.findMany({ where: { negocioId, id: { in: unicos } }, select: { id: true, ...EMPLEADO_NOMBRE_SELECT } })
  return new Map(empleados.map((e) => [e.id, nombreVisibleEmpleado(e)]))
}

/**
 * F10-C1c — does this outflow still need the owner's attention? A withdrawal an
 * employee registered and nobody confirmed yet, or an unreviewed outflow that an
 * employee registered / that left the expected cash negative / that reached the
 * threshold. A compensated outflow never waits (the compensation was the decision).
 * Same rule as WHERE_PENDIENTE_SUPERVISION below.
 */
export function necesitaSupervision(e: Pick<EgresoConDetalle, "confirmacionRetiroEstado" | "estadoRevision" | "actorTipo" | "excedeEsperado" | "superaUmbral" | "compensacion">) {
  if (e.compensacion) return { confirmacion: false, revision: false }
  return {
    confirmacion: e.confirmacionRetiroEstado === "PENDIENTE",
    revision: e.estadoRevision === "SIN_REVISAR" && (e.actorTipo === "EMPLEADO" || e.excedeEsperado || e.superaUmbral),
  }
}

export const WHERE_PENDIENTE_SUPERVISION = {
  compensacion: { is: null },
  OR: [
    { confirmacionRetiroEstado: "PENDIENTE" },
    { estadoRevision: "SIN_REVISAR", OR: [{ actorTipo: "EMPLEADO" }, { excedeEsperado: true }, { superaUmbral: true }] },
  ],
} satisfies Prisma.EgresoCajaWhereInput

/** Full owner view (owner-only data included: expected cash before the outflow and alert flags). */
export function egresoParaDueno(e: EgresoConDetalle, nombres: Map<string, string>) {
  const esperadoResultante = e.esperadoPrevioDecimal.minus(e.importeDecimal)
  const turnoAbierto = e.turno.estado === TURNO_ESTADO_ABIERTO
  const supervision = necesitaSupervision(e)
  return {
    id: e.id,
    operacionId: e.operacionId,
    naturaleza: e.naturaleza,
    categoria: e.categoria,
    medio: e.medio,
    importe: moneyToNumber(e.importeDecimal),
    motivo: e.motivo,
    turnoCajaId: e.turnoCajaId,
    cajaFisicaId: e.cajaFisicaId,
    cajaNombre: e.turno.cajaFisica.nombre,
    registradoPor: e.actorTipo === "NEGOCIO" ? { tipo: "NEGOCIO", nombre: "Dueño" } : { tipo: "EMPLEADO", empleadoId: e.empleadoId, nombre: (e.empleadoId && nombres.get(e.empleadoId)) || "Empleado" },
    proveedorNombre: e.proveedorNombre,
    proveedorIdentificacion: e.proveedorIdentificacion,
    comprobanteReferencia: e.comprobanteReferencia,
    destinatarioTipo: e.destinatarioTipo,
    destinatarioNombre: e.destinatarioNombre,
    confirmacionRetiro: e.confirmacionRetiroEstado ? { estado: e.confirmacionRetiroEstado, en: e.confirmacionRetiroEn } : null,
    alertas: {
      excedeEsperado: e.excedeEsperado,
      efectivoEsperadoPrevio: moneyToNumber(e.esperadoPrevioDecimal),
      efectivoEsperadoResultante: moneyToNumber(esperadoResultante),
      superaUmbral: e.superaUmbral,
      umbralAviso: e.umbralAvisoDecimal ? moneyToNumber(e.umbralAvisoDecimal) : null,
    },
    justificacion: e.justificacion,
    revision: { estado: e.estadoRevision, en: e.revisadoEn },
    historial: e.revisiones.map((r) => ({ accion: r.accion, resultado: r.resultado, observacion: r.observacion, createdAt: r.createdAt })),
    compensacion: e.compensacion
      ? { id: e.compensacion.id, operacionId: e.compensacion.operacionId, momento: e.compensacion.momento, importe: moneyToNumber(e.compensacion.importeDecimal), motivo: e.compensacion.motivo, createdAt: e.compensacion.createdAt }
      : null,
    // F10-C1c: what the owner can still do. A compensation is possible only while
    // the outflow's own shift is open; after the close it is blocked (F10-D).
    turnoAbierto,
    // F5-A: a payment linked to a supplier account must be unlinked before compensating it.
    vinculoProveedor: e.creditosProveedor[0] ? { creditoId: e.creditosProveedor[0].id, proveedorId: e.creditosProveedor[0].proveedor.id, proveedorNombre: e.creditosProveedor[0].proveedor.nombre } : null,
    compensacionDisponible: !e.compensacion && turnoAbierto && !e.creditosProveedor[0],
    compensacionBloqueada: e.compensacion ? null : !turnoAbierto ? "TURNO_CERRADO" : e.creditosProveedor[0] ? "VINCULADO_A_PROVEEDOR" : null,
    pendienteSupervision: supervision.confirmacion || supervision.revision,
    pendiente: supervision,
    createdAt: e.createdAt,
  }
}

/**
 * F10-C1c — administrative state the cashier may see on THEIR OWN withdrawals
 * (read-only): PENDIENTE | CONFIRMADO | OBSERVADO, and ANULADO for any own outflow
 * the owner compensated (that cash is expected to be in the drawer). Never the
 * owner's observation text, never "not received" as such (shown as OBSERVADO),
 * never alerts or expected cash.
 */
export function estadoAdministrativoCajero(e: Pick<EgresoConDetalle, "naturaleza" | "confirmacionRetiroEstado" | "estadoRevision" | "compensacion" | "actorTipo" | "empleadoId">, empleadoId: string) {
  if (e.actorTipo !== "EMPLEADO" || e.empleadoId !== empleadoId) return null
  if (e.compensacion) return "ANULADO" as const
  if (e.naturaleza !== "RETIRO_DUENO") return null
  if (e.confirmacionRetiroEstado === "NO_RECIBIDO" || e.estadoRevision === "OBSERVADO") return "OBSERVADO" as const
  if (e.confirmacionRetiroEstado === "CONFIRMADO") return "CONFIRMADO" as const
  return "PENDIENTE" as const
}

/** Cashier view: only what the cashier needs to see their own shift's outflows. No alerts, no expected cash, no totals. */
export function egresoParaCajero(e: EgresoConDetalle, empleadoId: string) {
  return {
    id: e.id,
    naturaleza: e.naturaleza,
    categoria: e.categoria,
    importe: moneyToNumber(e.importeDecimal),
    motivo: e.motivo,
    proveedorNombre: e.proveedorNombre,
    comprobanteReferencia: e.comprobanteReferencia,
    destinatarioTipo: e.destinatarioTipo,
    destinatarioNombre: e.destinatarioNombre,
    estadoAdministrativo: estadoAdministrativoCajero(e, empleadoId),
    registradoPor: e.actorTipo === "NEGOCIO" ? "DUENO" : e.empleadoId === empleadoId ? "PROPIO" : "OTRO",
    createdAt: e.createdAt,
  }
}

export interface FiltroEgresos {
  desde: Date | null
  hasta: Date | null
  cajaFisicaId: string | null
  turnoCajaId: string | null
  naturaleza: NaturalezaEgreso | null
  estadoRevision: string | null
  confirmacionPendiente: boolean
  /** F10-C1c */
  empleadoId: string | null
  categoria: CategoriaGasto | null
  registradoPorDueno: boolean
  pendienteSupervision: boolean
  compensado: boolean | null
}

export function parseFiltroEgresos(params: URLSearchParams): EgresoResult<FiltroEgresos> {
  const fecha = (name: string) => {
    const raw = params.get(name)
    if (!raw) return { ok: true as const, value: null }
    const d = new Date(raw)
    return Number.isNaN(d.getTime()) ? { ok: false as const } : { ok: true as const, value: d }
  }
  const desde = fecha("desde")
  const hasta = fecha("hasta")
  if (!desde.ok || !hasta.ok) return fail(400, "Fechas inválidas.", "FILTRO_INVALIDO")
  const naturaleza = params.get("naturaleza")
  if (naturaleza && !(NATURALEZAS_EGRESO as readonly string[]).includes(naturaleza)) return fail(400, "Tipo de egreso inválido.", "FILTRO_INVALIDO")
  const estadoRevision = params.get("estadoRevision")
  if (estadoRevision && !["SIN_REVISAR", "REVISADO", "OBSERVADO"].includes(estadoRevision)) return fail(400, "Estado de revisión inválido.", "FILTRO_INVALIDO")
  const categoria = params.get("categoria")
  if (categoria && !(CATEGORIAS_GASTO as readonly string[]).includes(categoria)) return fail(400, "Categoría inválida.", "FILTRO_INVALIDO")
  const responsable = params.get("empleadoId")
  const compensado = params.get("compensado")
  if (compensado && compensado !== "true" && compensado !== "false") return fail(400, "Filtro inválido.", "FILTRO_INVALIDO")
  return {
    ok: true,
    value: {
      desde: desde.value,
      hasta: hasta.value,
      cajaFisicaId: params.get("cajaFisicaId") || null,
      turnoCajaId: params.get("turnoCajaId") || null,
      naturaleza: (naturaleza as NaturalezaEgreso | null) || null,
      estadoRevision: estadoRevision || null,
      confirmacionPendiente: params.get("confirmacionPendiente") === "true",
      // "DUENO" = registered by the owner; any other value = that employee.
      empleadoId: responsable && responsable !== "DUENO" ? responsable : null,
      registradoPorDueno: responsable === "DUENO",
      categoria: (categoria as CategoriaGasto | null) || null,
      pendienteSupervision: params.get("pendienteSupervision") === "true",
      compensado: compensado === null || compensado === "" ? null : compensado === "true",
    },
  }
}

/** F10-C1c — who registered outflows in this business (filter options): the owner and each employee, by visible name. */
export async function responsablesEgresos(db: Pick<Db, "egresoCaja" | "empleado">, negocioId: string) {
  const [porEmpleado, dueno] = await Promise.all([
    db.egresoCaja.groupBy({ by: ["empleadoId"], where: { negocioId, actorTipo: "EMPLEADO" } }),
    db.egresoCaja.count({ where: { negocioId, actorTipo: "NEGOCIO" } }),
  ])
  const nombres = await nombresEmpleados(db, negocioId, porEmpleado.flatMap((g) => (g.empleadoId ? [g.empleadoId] : [])))
  return [
    ...(dueno > 0 ? [{ id: "DUENO", nombre: "Dueño" }] : []),
    ...[...nombres].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
  ]
}

/** F10-C1c — what still needs the owner, independent of the list filters. */
export async function contarPendientesSupervision(db: Pick<Db, "egresoCaja">, negocioId: string) {
  const base = { negocioId, compensacion: { is: null } } satisfies Prisma.EgresoCajaWhereInput
  const [confirmacion, revision, total] = await Promise.all([
    db.egresoCaja.count({ where: { ...base, confirmacionRetiroEstado: "PENDIENTE" } }),
    db.egresoCaja.count({ where: { ...base, estadoRevision: "SIN_REVISAR", OR: [{ actorTipo: "EMPLEADO" }, { excedeEsperado: true }, { superaUmbral: true }] } }),
    db.egresoCaja.count({ where: { negocioId, ...WHERE_PENDIENTE_SUPERVISION } }),
  ])
  return { confirmacionRetiro: confirmacion, revision, total }
}

export const EGRESOS_LISTA_MAX = 200

export async function listarEgresosDueno(db: Pick<Db, "egresoCaja" | "empleado">, negocioId: string, f: FiltroEgresos) {
  const egresos = await db.egresoCaja.findMany({
    where: {
      negocioId,
      ...(f.desde || f.hasta ? { createdAt: { ...(f.desde ? { gte: f.desde } : {}), ...(f.hasta ? { lt: f.hasta } : {}) } } : {}),
      ...(f.cajaFisicaId ? { cajaFisicaId: f.cajaFisicaId } : {}),
      ...(f.turnoCajaId ? { turnoCajaId: f.turnoCajaId } : {}),
      ...(f.naturaleza ? { naturaleza: f.naturaleza } : {}),
      ...(f.estadoRevision ? { estadoRevision: f.estadoRevision } : {}),
      ...(f.confirmacionPendiente ? { confirmacionRetiroEstado: "PENDIENTE", compensacion: { is: null } } : {}),
      ...(f.empleadoId ? { empleadoId: f.empleadoId } : {}),
      ...(f.registradoPorDueno ? { actorTipo: "NEGOCIO" } : {}),
      ...(f.categoria ? { categoria: f.categoria } : {}),
      ...(f.compensado === null ? {} : f.compensado ? { compensacion: { isNot: null } } : { compensacion: { is: null } }),
      ...(f.pendienteSupervision ? { AND: [WHERE_PENDIENTE_SUPERVISION] } : {}),
    },
    include: EGRESO_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: EGRESOS_LISTA_MAX,
  })
  const nombres = await nombresEmpleados(db, negocioId, egresos.flatMap((e) => (e.empleadoId ? [e.empleadoId] : [])))
  return egresos.map((e) => egresoParaDueno(e, nombres))
}

export async function detalleEgresoDueno(db: Pick<Db, "egresoCaja" | "empleado">, negocioId: string, egresoId: string) {
  const e = await db.egresoCaja.findFirst({ where: { id: egresoId, negocioId }, include: EGRESO_INCLUDE })
  if (!e) return null
  return egresoParaDueno(e, await nombresEmpleados(db, negocioId, e.empleadoId ? [e.empleadoId] : []))
}

export async function respuestaDueno(db: Pick<Db, "empleado">, negocioId: string, e: EgresoConDetalle) {
  return egresoParaDueno(e, await nombresEmpleados(db, negocioId, e.empleadoId ? [e.empleadoId] : []))
}

/** The cashier's OWN open shift outflows (individual amounts only); none when no shift is open. */
export async function egresosDelTurnoCajero(db: Pick<Db, "turnoCaja" | "egresoCaja">, negocioId: string, empleadoId: string) {
  const turno = await db.turnoCaja.findFirst({
    where: { negocioId, estado: TURNO_ESTADO_ABIERTO, responsableTipo: "EMPLEADO", responsableId: empleadoId },
    select: { id: true },
  })
  if (!turno) return { turnoAbierto: false, egresos: [] as ReturnType<typeof egresoParaCajero>[] }
  const egresos = await db.egresoCaja.findMany({ where: { negocioId, turnoCajaId: turno.id }, include: EGRESO_INCLUDE, orderBy: { createdAt: "desc" }, take: EGRESOS_LISTA_MAX })
  return { turnoAbierto: true, egresos: egresos.map((e) => egresoParaCajero(e, empleadoId)) }
}
