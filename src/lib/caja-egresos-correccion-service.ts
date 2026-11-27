// ============================================
// F10-D1 — corrections of cash outflows discovered AFTER the shift closed (server only, owner only)
// ============================================
// Design: codex-reports/F10_D1_CONCILIACION_EGRESOS_DISENO.md (operator decisions DF-1, DF-2 and DF-3 of
// 2026-11-27). Two facts that are NEVER mixed:
//
//   CONCILIACIÓN — the cash did NOT leave (SIN_SALIDA: the whole outflow) or left LESS than recorded
//     (IMPORTE_EXCEDENTE: a part). That cash already showed up as a SURPLUS in the frozen close. The
//     correction only EXPLAINS that part of the surplus: no operation, no leg, no change to the register
//     account, the closed shift, its deliveries or its reviews. Turn-level cap: what every outflow of the
//     shift conciliates together never exceeds the shift's surplus (counted − expected, both frozen). A
//     shift without surplus admits nothing: the case where another difference hid it cannot be represented
//     without inventing money, so it is reported (409) and left to the existing observation.
//   RECUPERO — the cash DID leave and comes back later. A NEW inflow (RECUPERO_EGRESO) with ONE positive
//     leg on the cash account of the register that receives it, attributed to that register's OPEN shift
//     (its expected cash goes up through the existing formula). It is not a sale nor a collection, and it
//     counts on the day the money enters (DF-3): the original outflow keeps its history.
//
// Shared rules:
//   - owner only (NEGOCIO session; the business always comes from the session);
//   - the outflow's own shift must be CLOSED (while it is open the existing compensation applies → 409
//     USAR_COMPENSACION); a compensated outflow admits no correction;
//   - per-outflow cap: Σ conciliated + Σ recovered ≤ the outflow amount (also enforced by the database);
//   - a PAGO_PROVEEDOR linked to a supplier (PAGO_CAJA credit in force) gets, IN THE SAME transaction, its
//     debt adjustment through the single F5 writer (AJUSTE_DEUDA: ERROR_DE_CARGA for a conciliation,
//     DIFERENCIA_ACORDADA for a recovery — DF-2). Afterwards the payment cannot be linked, unlinked, nor its
//     adjustment cancelled (no duplicate or orphan adjustment). An unlinked payment gets no adjustment;
//   - a withdrawal the owner CONFIRMED as received keeps some real outflow: only a partial conciliation or a
//     recovery (409 RETIRO_CONFIRMADO otherwise);
//   - idempotency (Idempotency-Key + content fingerprint), one Serializable transaction with bounded retry,
//     lock order register row → outflow row → (closed shift row) → supplier row, the same order as the
//     compensation and the F5 link; the SQL guards repeat every rule;
//   - R1: the audits (caja.egreso_conciliado / caja.egreso_recuperado, plus the F5 event) are written INSIDE
//     the transaction; a rejected request writes nothing (no money, supplier or audit effect).
// Out of scope (DF-1): an outflow recorded for LESS than what left (the close showed a shortage).

import { createHash } from "node:crypto"
import { Prisma, type PrismaClient } from "@prisma/client"
import { moneyToNumber } from "@/lib/money"
import { isValidVentaIdempotencyKey } from "@/lib/caja-venta"
import { TURNO_ESTADO_ABIERTO, TURNO_ESTADO_CERRADO_DECLARADO } from "@/lib/caja-turnos-service"
import { runSerializable } from "@/lib/caja-devoluciones-service"
import {
  EGRESO_INCLUDE,
  MOTIVO_EGRESO_MAX,
  correccionesDeEgreso,
  cuentaEfectivoCaja,
  lockCaja,
  parseImporteEgreso,
  type EgresoConDetalle,
  type EgresoResult,
} from "@/lib/caja-egresos-service"
import { mapCuentaProveedorDbError, registrarAjusteCorreccionEgresoEnTx, type AuditoriaEnTx } from "@/lib/cuenta-proveedor-service"

type Db = PrismaClient
type Tx = Prisma.TransactionClient
const D = Prisma.Decimal
const CERO = new D(0)

export const TIPOS_CONCILIACION_EGRESO = ["SIN_SALIDA", "IMPORTE_EXCEDENTE"] as const
export type TipoConciliacionEgreso = (typeof TIPOS_CONCILIACION_EGRESO)[number]
export const TIPO_OPERACION_RECUPERO_EGRESO = "RECUPERO_EGRESO"

const fail = (status: 400 | 403 | 404 | 409, error: string, code?: string, detalle?: Record<string, unknown>) =>
  ({ ok: false as const, status, error, ...(code ? { code } : {}), ...(detalle ? { detalle } : {}) })

export type ConciliacionCreada = { id: string; tipo: string; importeDecimal: Prisma.Decimal; motivo: string; turnoCajaId: string; obligacionAjusteId: string | null }
export type RecuperoCreado = { id: string; operacionId: string; importeDecimal: Prisma.Decimal; motivo: string; turnoCajaId: string; cajaFisicaId: string; obligacionAjusteId: string | null }
type Resultado = EgresoResult<{ egreso: EgresoConDetalle; replayed: boolean }>

export const USAR_COMPENSACION_TEXTO =
  "El turno de esta salida sigue abierto: si el efectivo nunca salió o ya volvió, usá «Corregir con compensación» en este mismo turno."
const NO_ENCONTRADO = fail(404, "Egreso no encontrado.", "EGRESO_NO_ENCONTRADO")
const COMPENSADO = fail(409, "Esta salida fue compensada: ya no admite correcciones.", "EGRESO_COMPENSADO")
const CLAVE_REUSADA = fail(409, "Este intento ya se usó con otros datos.", "IDEMPOTENCY_KEY_REUSED")

function texto(value: unknown, max: number): string | null | false {
  if (value === undefined || value === null) return null
  if (typeof value !== "string") return false
  const t = value.trim().replace(/\s+/g, " ")
  if (!t) return null
  return t.length <= max ? t : false
}

const huella = (partes: unknown[]) => createHash("sha256").update(JSON.stringify(partes)).digest("hex")

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

/** Maps the F10-D1 SQL guard messages (defense in depth) to controlled answers. */
export function mapCorreccionDbError(error: unknown): { status: 409; error: string; code: string } | null {
  const t = error instanceof Error ? error.message : String(error)
  const tabla: Array<[string, string, string]> = [
    ["cash outflow corrections exceed the outflow amount", "La corrección supera lo que queda por corregir de esta salida. Actualizá la pantalla.", "EXCEDE_PENDIENTE"],
    ["exceeds the closed shift surplus", "La conciliación supera el sobrante disponible del cierre de ese turno. Actualizá la pantalla.", "EXCEDE_SOBRANTE_TURNO"],
    ["a compensated cash outflow cannot be corrected", "Esta salida fue compensada: ya no admite correcciones.", "EGRESO_COMPENSADO"],
    ["a confirmed withdrawal can only be partially conciliated", "Confirmaste que recibiste este retiro: sólo podés conciliar una parte (si recibiste menos) o registrar un recupero.", "RETIRO_CONFIRMADO"],
    ["conciliation without outflow must cover the whole outflow", "«El dinero no salió» corrige la salida completa y sólo antes de otra corrección.", "SIN_SALIDA_NO_DISPONIBLE"],
    ["cash outflow recovery requires an open shift", "El turno de la caja que recibe el efectivo ya no está abierto. Actualizá la pantalla.", "TURNO_NO_DISPONIBLE"],
    ["requires the outflow shift to be closed", USAR_COMPENSACION_TEXTO, "USAR_COMPENSACION"],
    ["conciliation requires its closed shift", USAR_COMPENSACION_TEXTO, "USAR_COMPENSACION"],
    ["correction requires its supplier adjustment", "El pago está vinculado a un proveedor y cambió mientras corregías. Actualizá la pantalla.", "VINCULO_PROVEEDOR_CAMBIO"],
    ["correction supplier adjustment is inconsistent", "El pago está vinculado a un proveedor y cambió mientras corregías. Actualizá la pantalla.", "VINCULO_PROVEEDOR_CAMBIO"],
  ]
  for (const [frag, mensaje, code] of tabla) if (t.includes(frag)) return { status: 409, error: mensaje, code }
  return mapCuentaProveedorDbError(error)
}

type FilaEgreso = { id: string; turnoCajaId: string; cajaFisicaId: string; importeDecimal: Prisma.Decimal; naturaleza: string; confirmacionRetiroEstado: string | null }

/** Register row → outflow row (same order as the compensation and the F5 link). */
async function bloquearEgreso(tx: Tx, negocioId: string, egresoId: string, cajaYaBloqueada = false): Promise<FilaEgreso | null> {
  const base = await tx.egresoCaja.findFirst({ where: { id: egresoId, negocioId }, select: { cajaFisicaId: true } })
  if (!base) return null
  // A recovery already holds the RECEIVING register row; locking a second register here could invert the
  // order of two recoveries between two registers, so only the outflow row is locked after it.
  if (!cajaYaBloqueada) await lockCaja(tx, negocioId, base.cajaFisicaId)
  const filas = await tx.$queryRaw<FilaEgreso[]>`
    SELECT "id", "turnoCajaId", "cajaFisicaId", "importeDecimal", "naturaleza", "confirmacionRetiroEstado" FROM "egresos_caja"
    WHERE "id" = ${egresoId} AND "negocioId" = ${negocioId}
    FOR UPDATE`
  const fila = filas[0]
  return fila ? { ...fila, importeDecimal: new D(fila.importeDecimal) } : null
}

async function sumasDelEgreso(tx: Tx, negocioId: string, egresoId: string) {
  const [c, r] = await Promise.all([
    tx.conciliacionEgresoCaja.aggregate({ where: { negocioId, egresoId }, _sum: { importeDecimal: true } }),
    tx.recuperoEgresoCaja.aggregate({ where: { negocioId, egresoId }, _sum: { importeDecimal: true } }),
  ])
  return { conciliado: c._sum.importeDecimal ?? CERO, recuperado: r._sum.importeDecimal ?? CERO }
}

/**
 * The closed shift's surplus that is still unexplained (exact): counted − expected (frozen at the close)
 * minus what the conciliations of ANY of its outflows already explain. Never written anywhere.
 */
export async function sobranteDisponibleTurno(db: Pick<Tx, "turnoCaja" | "conciliacionEgresoCaja">, negocioId: string, turnoCajaId: string) {
  const turno = await db.turnoCaja.findFirst({ where: { id: turnoCajaId, negocioId }, select: { estado: true, efectivoContadoDecimal: true, efectivoEsperadoDecimal: true } })
  if (!turno || turno.estado !== TURNO_ESTADO_CERRADO_DECLARADO || !turno.efectivoContadoDecimal || !turno.efectivoEsperadoDecimal) return null
  const diferencia = turno.efectivoContadoDecimal.minus(turno.efectivoEsperadoDecimal)
  const conciliado = (await db.conciliacionEgresoCaja.aggregate({ where: { negocioId, turnoCajaId }, _sum: { importeDecimal: true } }))._sum.importeDecimal ?? CERO
  return { diferencia, conciliado, disponible: D.max(CERO, diferencia.minus(conciliado)), sinExplicar: diferencia.minus(conciliado) }
}

/** Common checks once the outflow row is locked. */
async function verificarCorregible(tx: Tx, negocioId: string, egreso: FilaEgreso) {
  if (await tx.compensacionEgresoCaja.findUnique({ where: { egresoId_negocioId: { egresoId: egreso.id, negocioId } }, select: { id: true } })) return COMPENSADO
  const turno = await tx.turnoCaja.findFirst({ where: { id: egreso.turnoCajaId, negocioId }, select: { estado: true } })
  if (!turno || turno.estado === TURNO_ESTADO_ABIERTO) return fail(409, USAR_COMPENSACION_TEXTO, "USAR_COMPENSACION")
  return null
}

const vinculoVigente = (tx: Tx, negocioId: string, egresoId: string) =>
  tx.creditoProveedor.findFirst({ where: { negocioId, egresoCajaId: egresoId, origen: "PAGO_CAJA", estado: "VIGENTE" }, select: { id: true, proveedorId: true } })

async function conErrores(fn: () => Promise<Resultado>, replay: () => Promise<Resultado | null>, alDuplicar: Resultado): Promise<Resultado> {
  try {
    return await fn()
  } catch (error) {
    if (isUniqueViolation(error)) return (await replay()) ?? alDuplicar
    const mapped = mapCorreccionDbError(error)
    if (mapped) return fail(mapped.status, mapped.error, mapped.code)
    throw error
  }
}

// ---------------------------------------------------------------------------
// Conciliation (no money)
// ---------------------------------------------------------------------------

export interface ConciliarEgresoInput {
  negocioId: string
  egresoId: string
  tipo: unknown
  /** IMPORTE_EXCEDENTE only: the part that did NOT leave the drawer. SIN_SALIDA always covers the whole outflow. */
  importe: unknown
  motivo: unknown
  /** The owner asserts that this cash never left the drawer (it stayed in the closed shift's count). */
  confirmoSinSalida: unknown
  idempotencyKey: string
}

export async function conciliarEgresoCerrado(
  db: Db,
  input: ConciliarEgresoInput,
  opciones: { auditar?: (tx: Tx, r: { egreso: EgresoConDetalle; conciliacion: ConciliacionCreada; sobrante: { diferencia: Prisma.Decimal; conciliadoAntes: Prisma.Decimal } }) => Promise<void>; auditarProveedor?: AuditoriaEnTx } = {}
): Promise<Resultado> {
  const { negocioId, egresoId } = input
  if (!egresoId?.trim()) return fail(400, "Egreso inválido.", "EGRESO_INVALIDO")
  if (!isValidVentaIdempotencyKey(input.idempotencyKey)) return fail(400, "Falta una Idempotency-Key válida.", "IDEMPOTENCY_KEY_REQUIRED")
  const key = input.idempotencyKey.toLowerCase()
  if (typeof input.tipo !== "string" || !(TIPOS_CONCILIACION_EGRESO as readonly string[]).includes(input.tipo)) {
    return fail(400, "Elegí si el dinero no salió o si salió menos de lo registrado.", "TIPO_CONCILIACION_INVALIDO")
  }
  const tipo = input.tipo as TipoConciliacionEgreso
  let importeSolicitado: Prisma.Decimal | null = null
  if (tipo === "IMPORTE_EXCEDENTE") {
    const p = parseImporteEgreso(input.importe)
    if (!p.ok) return fail(400, "Indicá el importe que no salió de la caja: mayor a cero, con hasta 2 decimales.", "IMPORTE_INVALIDO")
    importeSolicitado = p.value
  } else if (input.importe !== undefined && input.importe !== null && input.importe !== "") {
    return fail(400, "«El dinero no salió» corrige la salida completa: no lleva importe.", "IMPORTE_INVALIDO")
  }
  const motivo = texto(input.motivo, MOTIVO_EGRESO_MAX)
  if (!motivo) return fail(400, "Indicá el motivo de la corrección (hasta 500 caracteres).", "MOTIVO_REQUERIDO")
  if (input.confirmoSinSalida !== true) return fail(400, "Confirmá que ese efectivo nunca salió de la caja.", "CONFIRMACION_REQUERIDA")
  const fp = huella([negocioId, egresoId, "CONCILIACION", tipo, importeSolicitado?.toFixed(2) ?? null, motivo])

  const replay = async (client: Pick<Tx, "conciliacionEgresoCaja" | "egresoCaja">): Promise<Resultado | null> => {
    const previa = await client.conciliacionEgresoCaja.findUnique({ where: { negocioId_idempotencyKey: { negocioId, idempotencyKey: key } }, select: { egresoId: true, idempotencyFingerprint: true } })
    if (!previa) return null
    if (previa.egresoId !== egresoId || previa.idempotencyFingerprint !== fp) return CLAVE_REUSADA
    const egreso = await client.egresoCaja.findFirst({ where: { id: egresoId, negocioId }, include: EGRESO_INCLUDE })
    return egreso ? { ok: true, value: { egreso, replayed: true } } : NO_ENCONTRADO
  }

  return conErrores(() => runSerializable(db, async (tx): Promise<Resultado> => {
    const previa = await replay(tx)
    if (previa) return previa
    const egreso = await bloquearEgreso(tx, negocioId, egresoId)
    if (!egreso) return NO_ENCONTRADO
    const bloqueo = await verificarCorregible(tx, negocioId, egreso)
    if (bloqueo) return bloqueo
    // The closed shift row is locked (never modified) so two conciliations of the same shift are ordered.
    await tx.$queryRaw`SELECT "id" FROM "turnos_caja" WHERE "id" = ${egreso.turnoCajaId} AND "negocioId" = ${negocioId} FOR UPDATE`
    const { conciliado, recuperado } = await sumasDelEgreso(tx, negocioId, egresoId)
    const pendiente = egreso.importeDecimal.minus(conciliado).minus(recuperado)
    const retiroConfirmado = egreso.naturaleza === "RETIRO_DUENO" && egreso.confirmacionRetiroEstado === "CONFIRMADO"
    let importe: Prisma.Decimal
    if (tipo === "SIN_SALIDA") {
      if (retiroConfirmado) return fail(409, "Confirmaste que recibiste este retiro: no se puede registrar que el dinero no salió. Si recibiste menos, conciliá sólo la diferencia; si lo devolviste a la caja, registrá un recupero.", "RETIRO_CONFIRMADO")
      if (!conciliado.isZero() || !recuperado.isZero()) return fail(409, "Esta salida ya tiene correcciones: usá «Salió menos de lo registrado» por lo que falta.", "SIN_SALIDA_NO_DISPONIBLE")
      importe = egreso.importeDecimal
    } else {
      importe = importeSolicitado!
      if (importe.gt(pendiente)) return fail(409, `Lo que queda por corregir de esta salida es ${moneyToNumber(D.max(CERO, pendiente)).toLocaleString("es-AR")}.`, "EXCEDE_PENDIENTE", { pendiente: moneyToNumber(D.max(CERO, pendiente)) })
      if (retiroConfirmado && conciliado.plus(importe).gte(egreso.importeDecimal)) {
        return fail(409, "Confirmaste que recibiste este retiro: una parte tiene que haber salido. Si lo devolviste completo a la caja, registrá un recupero.", "RETIRO_CONFIRMADO")
      }
    }
    const sobrante = await sobranteDisponibleTurno(tx, negocioId, egreso.turnoCajaId)
    if (!sobrante) return fail(409, USAR_COMPENSACION_TEXTO, "USAR_COMPENSACION")
    const detalleSobrante = { diferenciaCierre: moneyToNumber(sobrante.diferencia), conciliadoEnTurno: moneyToNumber(sobrante.conciliado), sobranteDisponible: moneyToNumber(sobrante.disponible) }
    if (sobrante.diferencia.lte(0)) {
      return fail(409, "El cierre de ese turno no tuvo sobrante: si el dinero no hubiera salido, el conteo lo habría mostrado. Si otra diferencia lo ocultó, no se puede conciliar sin inventar dinero; dejá una observación en la salida.", "SIN_SOBRANTE_EN_CIERRE", detalleSobrante)
    }
    if (importe.gt(sobrante.disponible)) {
      return fail(409, `El sobrante sin explicar del cierre de ese turno es ${detalleSobrante.sobranteDisponible.toLocaleString("es-AR")}: no se puede conciliar más que eso (otras conciliaciones ya explican el resto o el cierre no lo muestra).`, "EXCEDE_SOBRANTE_TURNO", detalleSobrante)
    }
    let obligacionAjusteId: string | null = null
    const vinculo = await vinculoVigente(tx, negocioId, egresoId)
    if (vinculo) {
      const ajuste = await registrarAjusteCorreccionEgresoEnTx(tx, {
        negocioId, proveedorId: vinculo.proveedorId, egresoCajaId: egresoId, origen: "CONCILIACION", importe, motivo,
        idempotencyKey: `f10d1-conciliacion:${key}`, fingerprint: fp,
      }, { auditar: opciones.auditarProveedor })
      if (!ajuste.ok) return ajuste
      obligacionAjusteId = ajuste.value.obligacionId
    }
    const conciliacion = await tx.conciliacionEgresoCaja.create({
      data: {
        negocioId, egresoId, turnoCajaId: egreso.turnoCajaId, cajaFisicaId: egreso.cajaFisicaId, tipo, importeDecimal: importe, motivo,
        obligacionAjusteId, actorId: negocioId, idempotencyKey: key, idempotencyFingerprint: fp,
      },
      select: { id: true, tipo: true, importeDecimal: true, motivo: true, turnoCajaId: true, obligacionAjusteId: true },
    })
    const actualizado = await tx.egresoCaja.findFirstOrThrow({ where: { id: egresoId, negocioId }, include: EGRESO_INCLUDE })
    if (opciones.auditar) await opciones.auditar(tx, { egreso: actualizado, conciliacion, sobrante: { diferencia: sobrante.diferencia, conciliadoAntes: sobrante.conciliado } })
    return { ok: true, value: { egreso: actualizado, replayed: false } }
  }), () => replay(db), fail(409, "La corrección cambió mientras la registrabas. Actualizá la pantalla.", "CORRECCION_CONCURRENTE"))
}

// ---------------------------------------------------------------------------
// Recovery (real money back into an OPEN shift)
// ---------------------------------------------------------------------------

/** Owner body → recovery request fields (the business and the actor never come from it). */
export function solicitudRecupero(body: unknown): Pick<RecuperoEgresoInput, "cajaFisicaId" | "turnoCajaId" | "importe" | "motivo" | "confirmoEfectivoRecibido"> {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>
  return { cajaFisicaId: b.cajaFisicaId, turnoCajaId: b.turnoCajaId, importe: b.importe, motivo: b.motivo, confirmoEfectivoRecibido: b.confirmoEfectivoRecibido }
}

export interface RecuperoEgresoInput {
  negocioId: string
  egresoId: string
  /** The register that physically receives the cash (explicit choice, never automatic). */
  cajaFisicaId: unknown
  /** The open shift the owner SAW on that register (closed and reopened meanwhile → 409 TURNO_CAMBIO). */
  turnoCajaId: unknown
  importe: unknown
  motivo: unknown
  /** The owner asserts the cash is physically handed into that register. */
  confirmoEfectivoRecibido: unknown
  idempotencyKey: string
}

export async function registrarRecuperoEgreso(
  db: Db,
  input: RecuperoEgresoInput,
  opciones: { auditar?: (tx: Tx, r: { egreso: EgresoConDetalle; recupero: RecuperoCreado }) => Promise<void>; auditarProveedor?: AuditoriaEnTx } = {}
): Promise<Resultado> {
  const { negocioId, egresoId } = input
  if (!egresoId?.trim()) return fail(400, "Egreso inválido.", "EGRESO_INVALIDO")
  if (!isValidVentaIdempotencyKey(input.idempotencyKey)) return fail(400, "Falta una Idempotency-Key válida.", "IDEMPOTENCY_KEY_REQUIRED")
  const key = input.idempotencyKey.toLowerCase()
  if (typeof input.cajaFisicaId !== "string" || !input.cajaFisicaId.trim() || typeof input.turnoCajaId !== "string" || !input.turnoCajaId.trim()) {
    return fail(400, "Elegí la caja con turno abierto que recibe el efectivo.", "CAJA_REQUERIDA")
  }
  const cajaFisicaId = input.cajaFisicaId.trim()
  const turnoVisto = input.turnoCajaId.trim()
  const p = parseImporteEgreso(input.importe)
  if (!p.ok) return fail(400, "Indicá el importe que vuelve a la caja: mayor a cero, con hasta 2 decimales.", "IMPORTE_INVALIDO")
  const importe = p.value
  const motivo = texto(input.motivo, MOTIVO_EGRESO_MAX)
  if (!motivo) return fail(400, "Indicá el motivo del recupero (hasta 500 caracteres).", "MOTIVO_REQUERIDO")
  if (input.confirmoEfectivoRecibido !== true) return fail(400, "Confirmá que el efectivo se entrega físicamente en esa caja.", "CONFIRMACION_REQUERIDA")
  const fp = huella([negocioId, egresoId, "RECUPERO", cajaFisicaId, turnoVisto, importe.toFixed(2), motivo])

  const replay = async (client: Pick<Tx, "recuperoEgresoCaja" | "egresoCaja">): Promise<Resultado | null> => {
    const previo = await client.recuperoEgresoCaja.findUnique({ where: { negocioId_idempotencyKey: { negocioId, idempotencyKey: key } }, select: { egresoId: true, idempotencyFingerprint: true } })
    if (!previo) return null
    if (previo.egresoId !== egresoId || previo.idempotencyFingerprint !== fp) return CLAVE_REUSADA
    const egreso = await client.egresoCaja.findFirst({ where: { id: egresoId, negocioId }, include: EGRESO_INCLUDE })
    return egreso ? { ok: true, value: { egreso, replayed: true } } : NO_ENCONTRADO
  }

  return conErrores(() => runSerializable(db, async (tx): Promise<Resultado> => {
    const previo = await replay(tx)
    if (previo) return previo
    if (!(await tx.egresoCaja.findFirst({ where: { id: egresoId, negocioId }, select: { id: true } }))) return NO_ENCONTRADO
    // The RECEIVING register row first (the same lock its sales, outflows and blind close take): a recovery
    // racing that close either commits first (and the frozen expected cash includes it) or writes nothing.
    const caja = await lockCaja(tx, negocioId, cajaFisicaId)
    if (!caja) return fail(404, "Caja no encontrada.", "CAJA_NO_ENCONTRADA")
    const turno = await tx.turnoCaja.findFirst({ where: { negocioId, cajaFisicaId, estado: TURNO_ESTADO_ABIERTO }, select: { id: true } })
    if (!turno) return fail(409, "Esa caja no tiene un turno abierto. El efectivo tiene que entrar en una caja con turno abierto.", "TURNO_REQUERIDO")
    if (turno.id !== turnoVisto) return fail(409, "El turno de esa caja cambió mientras registrabas el recupero. Revisá la caja y confirmá de nuevo.", "TURNO_CAMBIO")
    const egreso = await bloquearEgreso(tx, negocioId, egresoId, true)
    if (!egreso) return NO_ENCONTRADO
    const bloqueo = await verificarCorregible(tx, negocioId, egreso)
    if (bloqueo) return bloqueo
    const { conciliado, recuperado } = await sumasDelEgreso(tx, negocioId, egresoId)
    const pendiente = egreso.importeDecimal.minus(conciliado).minus(recuperado)
    if (importe.gt(pendiente)) return fail(409, `Lo que queda por corregir de esta salida es ${moneyToNumber(D.max(CERO, pendiente)).toLocaleString("es-AR")}.`, "EXCEDE_PENDIENTE", { pendiente: moneyToNumber(D.max(CERO, pendiente)) })
    let obligacionAjusteId: string | null = null
    const vinculo = await vinculoVigente(tx, negocioId, egresoId)
    if (vinculo) {
      const ajuste = await registrarAjusteCorreccionEgresoEnTx(tx, {
        negocioId, proveedorId: vinculo.proveedorId, egresoCajaId: egresoId, origen: "RECUPERO", importe, motivo,
        idempotencyKey: `f10d1-recupero:${key}`, fingerprint: fp,
      }, { auditar: opciones.auditarProveedor })
      if (!ajuste.ok) return ajuste
      obligacionAjusteId = ajuste.value.obligacionId
    }
    const cuentaId = await cuentaEfectivoCaja(tx, negocioId, cajaFisicaId)
    const operacion = await tx.operacionFinanciera.create({
      data: {
        negocioId,
        tipo: TIPO_OPERACION_RECUPERO_EGRESO,
        actorTipo: "NEGOCIO",
        actorId: negocioId,
        turnoCajaId: turno.id,
        movimientos: { create: [{ negocioId, cuentaId, importe: moneyToNumber(importe), importeDecimal: importe }] },
      },
      select: { id: true },
    })
    const recupero = await tx.recuperoEgresoCaja.create({
      data: {
        negocioId, egresoId, operacionId: operacion.id, turnoCajaId: turno.id, cajaFisicaId, importeDecimal: importe, motivo,
        obligacionAjusteId, actorId: negocioId, idempotencyKey: key, idempotencyFingerprint: fp,
      },
      select: { id: true, operacionId: true, importeDecimal: true, motivo: true, turnoCajaId: true, cajaFisicaId: true, obligacionAjusteId: true },
    })
    const actualizado = await tx.egresoCaja.findFirstOrThrow({ where: { id: egresoId, negocioId }, include: EGRESO_INCLUDE })
    if (opciones.auditar) await opciones.auditar(tx, { egreso: actualizado, recupero })
    return { ok: true, value: { egreso: actualizado, replayed: false } }
  }), () => replay(db), fail(409, "La corrección cambió mientras la registrabas. Actualizá la pantalla.", "CORRECCION_CONCURRENTE"))
}

// ---------------------------------------------------------------------------
// Owner read: what the guided correction needs to know (never for the cashier)
// ---------------------------------------------------------------------------

/**
 * The closed shift's surplus (original difference, already conciliated, still unexplained) and its custody
 * record. The delivery is shown as recorded: a counted surplus is NOT assumed to have been delivered.
 */
export async function contextoCorreccionEgreso(db: Pick<Db, "turnoCaja" | "conciliacionEgresoCaja" | "entregaCustodiaTurnoCaja">, negocioId: string, e: Pick<EgresoConDetalle, "turnoCajaId" | "importeDecimal" | "conciliaciones" | "recuperos" | "turno">) {
  if (e.turno.estado === TURNO_ESTADO_ABIERTO) return null
  const [sobrante, entrega] = await Promise.all([
    sobranteDisponibleTurno(db, negocioId, e.turnoCajaId),
    db.entregaCustodiaTurnoCaja.findFirst({ where: { negocioId, turnoCajaId: e.turnoCajaId }, orderBy: { secuencia: "desc" }, select: { tipo: true, efectivoEntregadoDecimal: true, fondoRemanenteDecimal: true, destinoTipo: true, confirmadoEn: true } }),
  ])
  const c = correccionesDeEgreso(e)
  return {
    turnoCerrado: sobrante ? {
      diferenciaOriginal: moneyToNumber(sobrante.diferencia),
      conciliadoPorEgresos: moneyToNumber(sobrante.conciliado),
      sinExplicar: moneyToNumber(sobrante.sinExplicar),
      sobranteDisponible: moneyToNumber(sobrante.disponible),
    } : null,
    entrega: entrega ? { tipo: entrega.tipo, efectivoEntregado: moneyToNumber(entrega.efectivoEntregadoDecimal), fondoRemanente: moneyToNumber(entrega.fondoRemanenteDecimal), destinoTipo: entrega.destinoTipo, confirmadoEn: entrega.confirmadoEn } : null,
    // What a conciliation can explain right now: the outflow's own pending part, capped by the shift surplus.
    conciliacionPosible: moneyToNumber(sobrante ? D.max(CERO, D.min(c.pendiente, sobrante.disponible)) : CERO),
  }
}

/** Conciliated amount per closed shift (owner reports: «diferencia original · conciliada por egresos · sin explicar»). */
export async function conciliadoPorTurnos(db: Pick<Db, "conciliacionEgresoCaja">, negocioId: string, turnoIds: string[]) {
  const acc = new Map(turnoIds.map((id) => [id, { cantidad: 0, importe: CERO }]))
  if (turnoIds.length === 0) return acc
  const filas = await db.conciliacionEgresoCaja.groupBy({ by: ["turnoCajaId"], where: { negocioId, turnoCajaId: { in: turnoIds } }, _sum: { importeDecimal: true }, _count: { _all: true } })
  for (const f of filas) acc.set(f.turnoCajaId, { cantidad: f._count._all, importe: f._sum.importeDecimal ?? CERO })
  return acc
}
