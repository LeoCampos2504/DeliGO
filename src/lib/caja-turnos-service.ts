// ============================================
// F10-B2.1 — physical cash registers and cash shifts (server only)
// ============================================
// The ONE place that creates/configures CajaFisica rows and opens TurnoCaja
// rows. Identity always comes from the caller's verified session (owner
// session → NEGOCIO; personal operational session with área caja →
// EMPLEADO); nothing in a request body chooses the business, the responsible
// person or the actor.
//
// Concurrency is decided by PostgreSQL (migration 20261011120000):
//   - one open shift per register / per employee / per owner → partial unique
//     indexes; a losing concurrent opening gets a controlled 409 (or the
//     original shift when it is an exact idempotent replay);
//   - one active default register per business → partial unique index;
//   - opening a shift and deactivating its register both take the register
//     row lock (SELECT … FOR UPDATE), so a register can never end up inactive
//     with an open shift.
// The opening cash (fondo inicial) is DECLARED money already in the drawer:
// exact NUMERIC(12,2), never a sale, never a financial operation, never a
// ledger leg. Closing a shift, blind count, differences and fund hand-over are
// F10-B2.2 — not here.

import { createHash } from "node:crypto"
import { Prisma, type PrismaClient } from "@prisma/client"
import { isValidVentaIdempotencyKey } from "@/lib/caja-venta"
import { resolveAreaOperativaEfectiva } from "@/lib/area-operativa"
import { MONEY_MAX, MoneyError, toDecimalExact } from "@/lib/money"
import { calcularSnapshotEfectivoTurno } from "@/lib/caja-turnos-snapshot"

export const CAJA_PREDETERMINADA_NOMBRE = "Caja principal"
export const TURNO_ESTADO_ABIERTO = "ABIERTO"
export const TURNO_ESTADO_CERRADO_DECLARADO = "CERRADO_DECLARADO"
export const CAJA_TURNOS_MODO_OPCIONAL = "OPCIONAL"
export const CAJA_TURNOS_MODO_OBLIGATORIO = "OBLIGATORIO"
export const CAJA_NOMBRE_MAX = 60
export const CAJA_DESCRIPCION_MAX = 200

/** Who acts — ALWAYS derived from the verified session by the caller. */
export type CajaActor = { tipo: "NEGOCIO" } | { tipo: "EMPLEADO"; empleadoId: string }

export type CajaResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: 400 | 403 | 404 | 409; error: string; code?: string }

type Db = PrismaClient
type Tx = Prisma.TransactionClient
const TX_OPTIONS = { maxWait: 5_000, timeout: 15_000 } as const

const fail = (status: 400 | 403 | 404 | 409, error: string, code?: string) => ({ ok: false as const, status, error, ...(code ? { code } : {}) })

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

function isSerializationConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false
  if (error.code === "P2034") return true
  // PostgreSQL 40001 from a raw SELECT ... FOR UPDATE is surfaced by Prisma as
  // P2010 (raw-query failure), while model writes surface the same conflict as
  // P2034. Retry only the exact serialization SQLSTATE; other P2010 errors are
  // not transient and must keep failing.
  return error.code === "P2010" && typeof error.meta?.code === "string" && error.meta.code === "40001"
}

async function withSerializableRetry<T>(db: Db, fn: (tx: Tx) => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await db.$transaction(fn, { ...TX_OPTIONS, isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    } catch (error) {
      // Closing requests with the same idempotency key can arrive as a burst.
      // Each losing Serializable snapshot must retry far enough to observe the
      // committed idempotency record and return the original close response.
      if (!isSerializationConflict(error) || attempt >= 8) throw error
      await new Promise((resolve) => setTimeout(resolve, Math.min(attempt * 15, 100)))
    }
  }
}

function actorResponsable(negocioId: string, actor: CajaActor) {
  return actor.tipo === "EMPLEADO"
    ? { responsableTipo: "EMPLEADO" as const, responsableId: actor.empleadoId, empleadoId: actor.empleadoId }
    : { responsableTipo: "NEGOCIO" as const, responsableId: negocioId, empleadoId: null }
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

const FONDO_PATTERN = /^\d{1,10}(\.\d{1,2})?$/

/** Opening cash: a non-negative exact amount with at most 2 decimals, within NUMERIC(12,2). Never rounded silently. */
export function parseFondoInicial(value: unknown): { ok: true; value: Prisma.Decimal } | { ok: false; error: string } {
  const invalid = { ok: false as const, error: "El fondo inicial debe ser un importe válido, sin negativos y con hasta 2 decimales." }
  if (typeof value === "string" && !FONDO_PATTERN.test(value.trim())) return invalid
  if (typeof value !== "string" && typeof value !== "number") return invalid
  let d: Prisma.Decimal
  try {
    d = toDecimalExact(typeof value === "string" ? value.trim() : value)
  } catch (error) {
    if (error instanceof MoneyError) return invalid
    throw error
  }
  if (d.isNegative() || d.decimalPlaces() > 2 || d.gt(MONEY_MAX)) return invalid
  return { ok: true, value: d }
}

export function parseNombreCaja(value: unknown): { ok: true; value: string } | { ok: false; error: string } {
  const nombre = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : ""
  if (!nombre || nombre.length > CAJA_NOMBRE_MAX) return { ok: false, error: `El nombre de la caja es obligatorio (máximo ${CAJA_NOMBRE_MAX} caracteres).` }
  return { ok: true, value: nombre }
}

export function parseDescripcionCaja(value: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (value === undefined || value === null || value === "") return { ok: true, value: null }
  if (typeof value !== "string" || value.trim().length > CAJA_DESCRIPCION_MAX) {
    return { ok: false, error: `La descripción admite hasta ${CAJA_DESCRIPCION_MAX} caracteres.` }
  }
  return { ok: true, value: value.trim() || null }
}

// ---------------------------------------------------------------------------
// Registers
// ---------------------------------------------------------------------------

/**
 * Returns the active default register of a generic business, creating
 * "Caja principal" (or promoting the oldest active register) when there is
 * none. Idempotent and safe under concurrency: the partial unique index
 * decides, losers just re-read. The CALLER guarantees the business is generic
 * (rubro "negocio") — never call this for other rubros.
 */
export async function asegurarCajaPredeterminada(db: Db, negocioId: string) {
  const where = { negocioId, esPredeterminada: true, activa: true }
  const existing = await db.cajaFisica.findFirst({ where })
  if (existing) return existing

  const oldestActive = await db.cajaFisica.findFirst({ where: { negocioId, activa: true }, orderBy: { createdAt: "asc" } })
  if (oldestActive) {
    try {
      await db.cajaFisica.updateMany({ where: { id: oldestActive.id, activa: true, esPredeterminada: false }, data: { esPredeterminada: true } })
    } catch (error) {
      if (!isUniqueViolation(error)) throw error
    }
  } else {
    // "Caja principal", or a numbered variant when an INACTIVE register already holds the name.
    for (const nombre of [CAJA_PREDETERMINADA_NOMBRE, ...[2, 3, 4, 5].map((n) => `${CAJA_PREDETERMINADA_NOMBRE} ${n}`)]) {
      await db.cajaFisica.createMany({ data: [{ negocioId, nombre, esPredeterminada: true }], skipDuplicates: true })
      const created = await db.cajaFisica.findFirst({ where })
      if (created) return created
    }
  }
  const result = await db.cajaFisica.findFirst({ where })
  if (!result) throw new Error("No se pudo asegurar la caja predeterminada")
  return result
}

export async function listarCajasFisicas(db: Db, negocioId: string) {
  return db.cajaFisica.findMany({ where: { negocioId }, orderBy: [{ esPredeterminada: "desc" }, { createdAt: "asc" }] })
}

export async function crearCajaFisica(db: Db, negocioId: string, input: { nombre: unknown; descripcion?: unknown }) {
  const nombre = parseNombreCaja(input.nombre)
  if (!nombre.ok) return fail(400, nombre.error)
  const descripcion = parseDescripcionCaja(input.descripcion)
  if (!descripcion.ok) return fail(400, descripcion.error)
  await asegurarCajaPredeterminada(db, negocioId)
  try {
    const caja = await db.cajaFisica.create({ data: { negocioId, nombre: nombre.value, descripcion: descripcion.value } })
    return { ok: true as const, value: caja }
  } catch (error) {
    if (isUniqueViolation(error)) return fail(409, "Ya existe una caja con ese nombre.", "CAJA_NOMBRE_DUPLICADO")
    throw error
  }
}

async function lockCaja(tx: Tx, negocioId: string, cajaFisicaId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string; activa: boolean; esPredeterminada: boolean }>>`
    SELECT "id", "activa", "esPredeterminada" FROM "cajas_fisicas"
    WHERE "id" = ${cajaFisicaId} AND "negocioId" = ${negocioId}
    FOR UPDATE`
  return rows[0] ?? null
}

export type FondoRemanenteDisponible = {
  turnoOrigenId: string
  entregaOrigenId: string
  cajaFisicaId: string
  cajaNombre: string
  fondoRemanenteDecimal: Prisma.Decimal
  confirmadoEn: Date
  cerradoEn: Date
  responsableTipo: string
  responsableNombre: string
}

/** Only the newest closed shift in an active register may offer its latest positive E remainder. */
export async function listarFondosRemanentesTransferibles(db: Db, negocioId: string, cajaFisicaIds?: string[]): Promise<FondoRemanenteDisponible[]> {
  if (cajaFisicaIds && cajaFisicaIds.length === 0) return []
  const registerFilter = cajaFisicaIds ? Prisma.sql`AND t."cajaFisicaId" IN (${Prisma.join(cajaFisicaIds)})` : Prisma.empty
  return db.$queryRaw<FondoRemanenteDisponible[]>`
    SELECT
      t."id" AS "turnoOrigenId",
      e."id" AS "entregaOrigenId",
      t."cajaFisicaId",
      c."nombre" AS "cajaNombre",
      e."fondoRemanenteDecimal",
      e."confirmadoEn",
      t."cerradoEn",
      t."responsableTipo",
      CASE WHEN t."responsableTipo" = 'EMPLEADO' THEN COALESCE(emp."nombre", 'Empleado') ELSE 'Dueño' END AS "responsableNombre"
    FROM "turnos_caja" t
    JOIN "cajas_fisicas" c ON c."id" = t."cajaFisicaId" AND c."negocioId" = t."negocioId" AND c."activa" = TRUE
    LEFT JOIN "empleados" emp ON emp."id" = t."empleadoId"
    JOIN LATERAL (
      SELECT event."id", event."fondoRemanenteDecimal", event."confirmadoEn", event."estado"
      FROM "entregas_custodia_turnos_caja" event
      WHERE event."negocioId" = t."negocioId" AND event."turnoCajaId" = t."id"
      ORDER BY event."secuencia" DESC
      LIMIT 1
    ) e ON TRUE
    WHERE t."negocioId" = ${negocioId}
      AND t."estado" = 'CERRADO_DECLARADO'
      AND t."cerradoEn" IS NOT NULL
      AND e."estado" = 'CONFIRMADA'
      AND e."fondoRemanenteDecimal" > 0
      AND NOT EXISTS (
        SELECT 1 FROM "traspasos_fondo_turnos_caja" transfer
        WHERE transfer."negocioId" = t."negocioId" AND transfer."turnoOrigenId" = t."id"
      )
      AND NOT EXISTS (
        SELECT 1 FROM "turnos_caja" newer
        WHERE newer."negocioId" = t."negocioId" AND newer."cajaFisicaId" = t."cajaFisicaId"
          AND (newer."abiertoEn" > t."abiertoEn" OR (newer."abiertoEn" = t."abiertoEn" AND newer."id" > t."id"))
      )
      ${registerFilter}
    ORDER BY t."abiertoEn" DESC, t."id" DESC`
}

/**
 * Rename / describe / activate / deactivate / make default. A register with an
 * open shift, or the default register, cannot be deactivated. Registers are
 * never deleted (their shifts and sales are history).
 */
export async function actualizarCajaFisica(
  db: Db,
  negocioId: string,
  cajaFisicaId: string,
  patch: { nombre?: unknown; descripcion?: unknown; activa?: unknown; esPredeterminada?: unknown }
) {
  const data: Prisma.CajaFisicaUpdateManyMutationInput = {}
  if (patch.nombre !== undefined) {
    const nombre = parseNombreCaja(patch.nombre)
    if (!nombre.ok) return fail(400, nombre.error)
    data.nombre = nombre.value
  }
  if (patch.descripcion !== undefined) {
    const descripcion = parseDescripcionCaja(patch.descripcion)
    if (!descripcion.ok) return fail(400, descripcion.error)
    data.descripcion = descripcion.value
  }
  if (patch.activa !== undefined && typeof patch.activa !== "boolean") return fail(400, "activa debe ser verdadero o falso.")
  if (patch.esPredeterminada !== undefined && patch.esPredeterminada !== true) {
    return fail(400, "Para cambiar la caja predeterminada marcá otra caja como predeterminada.")
  }

  try {
    return await db.$transaction(async (tx) => {
      const caja = await lockCaja(tx, negocioId, cajaFisicaId)
      if (!caja) return fail(404, "Caja no encontrada.")
      const activaFinal = patch.activa === undefined ? caja.activa : (patch.activa as boolean)

      if (activaFinal === false && caja.activa) {
        if (caja.esPredeterminada) {
          return fail(409, "No se puede desactivar la caja predeterminada. Elegí otra como predeterminada primero.", "CAJA_PREDETERMINADA")
        }
        const abiertos = await tx.turnoCaja.count({ where: { cajaFisicaId, negocioId, estado: TURNO_ESTADO_ABIERTO } })
        if (abiertos > 0) return fail(409, "La caja tiene un turno abierto y no se puede desactivar.", "CAJA_CON_TURNO_ABIERTO")
      }
      if (patch.activa !== undefined) data.activa = activaFinal

      if (patch.esPredeterminada === true && !caja.esPredeterminada) {
        if (!activaFinal) return fail(409, "Sólo una caja activa puede ser la predeterminada.", "CAJA_INACTIVA")
        await tx.$queryRaw`SELECT "id" FROM "cajas_fisicas" WHERE "negocioId" = ${negocioId} AND "esPredeterminada" AND "activa" FOR UPDATE`
        await tx.cajaFisica.updateMany({ where: { negocioId, esPredeterminada: true, activa: true, NOT: { id: cajaFisicaId } }, data: { esPredeterminada: false } })
        data.esPredeterminada = true
      }

      if (Object.keys(data).length > 0) await tx.cajaFisica.updateMany({ where: { id: cajaFisicaId, negocioId }, data })
      const value = await tx.cajaFisica.findFirstOrThrow({ where: { id: cajaFisicaId, negocioId } })
      return { ok: true as const, value }
    }, TX_OPTIONS)
  } catch (error) {
    if (isUniqueViolation(error)) return fail(409, "Ya existe una caja con ese nombre.", "CAJA_NOMBRE_DUPLICADO")
    throw error
  }
}

// ---------------------------------------------------------------------------
// Shifts
// ---------------------------------------------------------------------------

export function fingerprintAperturaTurno(negocioId: string, cajaFisicaId: string, fondo: Prisma.Decimal, actor: CajaActor, transferenciaOrigenTurnoId?: string): string {
  const r = actorResponsable(negocioId, actor)
  const canonical = `${negocioId}\n${cajaFisicaId}\n${fondo.toFixed(2)}\n${r.responsableTipo}:${r.responsableId}`
  return createHash("sha256").update(transferenciaOrigenTurnoId ? `${canonical}\nTRANSFERENCIA:${transferenciaOrigenTurnoId}` : canonical).digest("hex")
}

export interface AbrirTurnoInput {
  negocioId: string
  actor: CajaActor
  /** null/undefined = the business's default register. */
  cajaFisicaId?: string | null
  fondoInicial: unknown
  transferirDesdeTurnoCajaId?: unknown
  confirmoRecepcionFondo?: unknown
  idempotencyKey: string
}

type TurnoConCaja = Prisma.TurnoCajaGetPayload<{ include: { cajaFisica: { select: { id: true; nombre: true } } } }>

type TransferOpenResult = CajaResult<{ turno: TurnoConCaja; replayed: boolean }>

async function replayTransferOpen(db: Pick<PrismaClient, "traspasoFondoTurnoCaja">, input: AbrirTurnoInput, existing: TurnoConCaja, sourceShiftId: string, idempotencyKey: string): Promise<TransferOpenResult> {
  const transfer = await db.traspasoFondoTurnoCaja.findFirst({ where: { turnoDestinoId: existing.id, negocioId: input.negocioId, cajaFisicaId: existing.cajaFisicaId } })
  const responsible = actorResponsable(input.negocioId, input.actor)
  const requestedFund = parseFondoInicial(input.fondoInicial)
  const fingerprint = fingerprintAperturaTurno(input.negocioId, existing.cajaFisicaId, existing.fondoInicialDecimal, input.actor, sourceShiftId)
  if ((!input.cajaFisicaId || input.cajaFisicaId === existing.cajaFisicaId)
      && requestedFund.ok && requestedFund.value.equals(existing.fondoInicialDecimal)
      && transfer?.turnoOrigenId === sourceShiftId && transfer.montoDecimal.equals(existing.fondoInicialDecimal)
      && transfer.idempotencyKey === idempotencyKey && transfer.idempotencyFingerprint === fingerprint
      && existing.idempotencyFingerprint === fingerprint && existing.responsableTipo === responsible.responsableTipo && existing.responsableId === responsible.responsableId) {
    return { ok: true, value: { turno: existing, replayed: true } }
  }
  return fail(409, "Este intento de apertura ya se usó con otros datos. Volvé a intentar.", "IDEMPOTENCY_KEY_REUSED")
}

async function abrirTurnoConFondoTransferido(db: Db, input: AbrirTurnoInput, sourceShiftId: string): Promise<TransferOpenResult> {
  const { negocioId, actor } = input
  if (input.confirmoRecepcionFondo !== true) return fail(400, "Confirmá que recibiste físicamente el fondo para comenzar el turno.", "CONFIRMACION_RECEPCION_REQUERIDA")
  if (!isValidVentaIdempotencyKey(input.idempotencyKey)) return fail(400, "Falta una Idempotency-Key válida para abrir el turno.", "IDEMPOTENCY_KEY_REQUIRED")
  const idempotencyKey = input.idempotencyKey.toLowerCase()
  if (actor.tipo === "EMPLEADO") {
    const empleado = await db.empleado.findFirst({
      where: { id: actor.empleadoId, negocioId, activo: true, eliminado: false },
      select: { areaOperativa: true, rol: true },
    })
    if (!empleado || resolveAreaOperativaEfectiva(empleado) !== "caja") return fail(403, "Acceso denegado")
  }
  const cajaFisicaId = input.cajaFisicaId ?? (await asegurarCajaPredeterminada(db, negocioId)).id
  const include = { cajaFisica: { select: { id: true, nombre: true } } } as const
  const previous = await db.turnoCaja.findUnique({ where: { negocioId_idempotencyKey: { negocioId, idempotencyKey } }, include })
  if (previous) return replayTransferOpen(db, input, previous, sourceShiftId, idempotencyKey)

  try {
    return await db.$transaction(async (tx): Promise<TransferOpenResult> => {
      const caja = await lockCaja(tx, negocioId, cajaFisicaId)
      if (!caja) return fail(404, "Caja no encontrada.")
      if (!caja.activa) return fail(409, "La caja está desactivada.", "CAJA_INACTIVA")

      const sameKey = await tx.turnoCaja.findUnique({ where: { negocioId_idempotencyKey: { negocioId, idempotencyKey } }, include })
      if (sameKey) return replayTransferOpen(tx, input, sameKey, sourceShiftId, idempotencyKey)

      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "turnos_caja" WHERE "id" = ${sourceShiftId} AND "negocioId" = ${negocioId} FOR UPDATE`
      if (!locked.length) return fail(409, "El fondo del turno anterior ya no está disponible.", "FONDO_REMANENTE_NO_DISPONIBLE")

      const latestShift = await tx.turnoCaja.findFirst({
        where: { negocioId, cajaFisicaId },
        orderBy: [{ abiertoEn: "desc" }, { id: "desc" }],
        select: { id: true, estado: true, cerradoEn: true },
      })
      if (!latestShift || latestShift.id !== sourceShiftId || latestShift.estado !== TURNO_ESTADO_CERRADO_DECLARADO || !latestShift.cerradoEn) {
        return fail(409, "El fondo del turno anterior ya no está disponible.", "FONDO_REMANENTE_NO_DISPONIBLE")
      }
      const origen = await tx.turnoCaja.findFirst({
        where: { id: sourceShiftId, negocioId, cajaFisicaId, estado: TURNO_ESTADO_CERRADO_DECLARADO },
        include: { entregasCustodia: { orderBy: { secuencia: "desc" }, take: 1 } },
      })
      const entrega = origen?.entregasCustodia[0]
      if (!origen || !entrega || entrega.estado !== "CONFIRMADA" || !entrega.fondoRemanenteDecimal.gt(0)) {
        return fail(409, "No hay un remanente confirmado para transferir desde ese turno.", "FONDO_REMANENTE_NO_DISPONIBLE")
      }
      const alreadyTransferred = await tx.traspasoFondoTurnoCaja.findFirst({ where: { turnoOrigenId: sourceShiftId, negocioId, cajaFisicaId }, select: { id: true } })
      if (alreadyTransferred) return fail(409, "Ese fondo ya fue recibido por otro turno.", "FONDO_REMANENTE_YA_TRANSFERIDO")

      const fondo = entrega.fondoRemanenteDecimal
      const requestedFund = parseFondoInicial(input.fondoInicial)
      if (!requestedFund.ok || !requestedFund.value.equals(fondo)) return fail(409, "El importe debe coincidir exactamente con el remanente confirmado.", "IMPORTE_TRASPASO_NO_COINCIDE")
      const responsable = actorResponsable(negocioId, actor)
      const fingerprint = fingerprintAperturaTurno(negocioId, cajaFisicaId, fondo, actor, sourceShiftId)
      const turno = await tx.turnoCaja.create({
        data: { negocioId, cajaFisicaId, ...responsable, estado: TURNO_ESTADO_ABIERTO, fondoInicialDecimal: fondo, idempotencyKey, idempotencyFingerprint: fingerprint },
        include,
      })
      await tx.traspasoFondoTurnoCaja.create({
        data: {
          negocioId,
          cajaFisicaId,
          turnoOrigenId: sourceShiftId,
          entregaOrigenId: entrega.id,
          turnoDestinoId: turno.id,
          montoDecimal: fondo,
          recibidoPorTipo: responsable.responsableTipo,
          recibidoPorId: responsable.responsableId,
          confirmadoEn: new Date(),
          estado: "CONFIRMADO",
          idempotencyKey,
          idempotencyFingerprint: fingerprint,
        },
      })
      return { ok: true, value: { turno, replayed: false } }
    }, TX_OPTIONS)
  } catch (error) {
    if (!isUniqueViolation(error)) throw error
    const sameKey = await db.turnoCaja.findUnique({ where: { negocioId_idempotencyKey: { negocioId, idempotencyKey } }, include })
    if (sameKey) return replayTransferOpen(db, input, sameKey, sourceShiftId, idempotencyKey)
    const alreadyTransferred = await db.traspasoFondoTurnoCaja.findFirst({ where: { turnoOrigenId: sourceShiftId, negocioId, cajaFisicaId }, select: { id: true } })
    if (alreadyTransferred) return fail(409, "Ese fondo ya fue recibido por otro turno.", "FONDO_REMANENTE_YA_TRANSFERIDO")
    const occupied = await db.turnoCaja.findFirst({ where: { cajaFisicaId, estado: TURNO_ESTADO_ABIERTO }, select: { id: true } })
    if (occupied) return fail(409, "Esta caja ya tiene un turno abierto.", "CAJA_CON_TURNO_ABIERTO")
    return fail(409, "Ya tenés un turno abierto en otra caja.", "TURNO_YA_ABIERTO")
  }
}

/**
 * Opens a shift for the session's actor on a register of THEIR business.
 * Idempotent: the same key + same content from the same actor returns the
 * original shift (replayed); the same key with other content → 409.
 * Concurrent openings of one register → exactly one shift (partial unique
 * index), the others → 409 CAJA_CON_TURNO_ABIERTO.
 */
export async function abrirTurnoCaja(db: Db, input: AbrirTurnoInput): Promise<CajaResult<{ turno: TurnoConCaja; replayed: boolean }>> {
  const { negocioId, actor } = input
  if (input.transferirDesdeTurnoCajaId !== undefined) {
    if (typeof input.transferirDesdeTurnoCajaId !== "string" || !input.transferirDesdeTurnoCajaId.trim()) return fail(400, "El turno de origen del fondo no es válido.", "TURNO_ORIGEN_INVALIDO")
    return abrirTurnoConFondoTransferido(db, input, input.transferirDesdeTurnoCajaId.trim())
  }
  if (!isValidVentaIdempotencyKey(input.idempotencyKey)) {
    return fail(400, "Falta una Idempotency-Key válida para abrir el turno.", "IDEMPOTENCY_KEY_REQUIRED")
  }
  const idempotencyKey = input.idempotencyKey.toLowerCase()
  const fondo = parseFondoInicial(input.fondoInicial)
  if (!fondo.ok) return fail(400, fondo.error)

  // Defense in depth: an EMPLEADO must be an active employee of THIS business with área caja.
  if (actor.tipo === "EMPLEADO") {
    const empleado = await db.empleado.findFirst({
      where: { id: actor.empleadoId, negocioId, activo: true, eliminado: false },
      select: { areaOperativa: true, rol: true },
    })
    if (!empleado || resolveAreaOperativaEfectiva(empleado) !== "caja") return fail(403, "Acceso denegado")
  }

  const cajaFisicaId = input.cajaFisicaId ?? (await asegurarCajaPredeterminada(db, negocioId)).id
  const responsable = actorResponsable(negocioId, actor)
  const fingerprint = fingerprintAperturaTurno(negocioId, cajaFisicaId, fondo.value, actor)
  const include = { cajaFisica: { select: { id: true, nombre: true } } } as const

  const replayOrConflict = (existing: TurnoConCaja): CajaResult<{ turno: TurnoConCaja; replayed: boolean }> =>
    existing.idempotencyFingerprint === fingerprint && existing.responsableTipo === responsable.responsableTipo && existing.responsableId === responsable.responsableId
      ? { ok: true, value: { turno: existing, replayed: true } }
      : fail(409, "Este intento de apertura ya se usó con otros datos. Volvé a intentar.", "IDEMPOTENCY_KEY_REUSED")

  const previous = await db.turnoCaja.findUnique({ where: { negocioId_idempotencyKey: { negocioId, idempotencyKey } }, include })
  if (previous) return replayOrConflict(previous)

  try {
    return await db.$transaction(async (tx) => {
      const caja = await lockCaja(tx, negocioId, cajaFisicaId)
      if (!caja) return fail(404, "Caja no encontrada.")
      if (!caja.activa) return fail(409, "La caja está desactivada.", "CAJA_INACTIVA")
      const turno = await tx.turnoCaja.create({
        data: {
          negocioId,
          cajaFisicaId,
          ...responsable,
          estado: TURNO_ESTADO_ABIERTO,
          fondoInicialDecimal: fondo.value,
          idempotencyKey,
          idempotencyFingerprint: fingerprint,
        },
        include,
      })
      return { ok: true as const, value: { turno, replayed: false } }
    }, TX_OPTIONS)
  } catch (error) {
    if (!isUniqueViolation(error)) throw error
    // Decide by the committed state, not by the index name.
    const sameKey = await db.turnoCaja.findUnique({ where: { negocioId_idempotencyKey: { negocioId, idempotencyKey } }, include })
    if (sameKey) return replayOrConflict(sameKey)
    const cajaOcupada = await db.turnoCaja.findFirst({ where: { cajaFisicaId, estado: TURNO_ESTADO_ABIERTO }, select: { id: true } })
    if (cajaOcupada) return fail(409, "Esta caja ya tiene un turno abierto.", "CAJA_CON_TURNO_ABIERTO")
    return fail(409, "Ya tenés un turno abierto en otra caja.", "TURNO_YA_ABIERTO")
  }
}

/** The single open shift of the session's actor in this business (or null). */
export async function turnoAbiertoDeActor(db: Pick<Db, "turnoCaja">, negocioId: string, actor: CajaActor) {
  const r = actorResponsable(negocioId, actor)
  return db.turnoCaja.findFirst({
    where: { negocioId, estado: TURNO_ESTADO_ABIERTO, responsableTipo: r.responsableTipo, responsableId: r.responsableId },
    include: { cajaFisica: { select: { id: true, nombre: true } } },
  })
}

export interface CerrarTurnoInput {
  negocioId: string
  turnoCajaId: string
  actor: CajaActor
  efectivoContado: unknown
  idempotencyKey: string
}

type TurnoCerradoPayload = { id: string; estado: typeof TURNO_ESTADO_CERRADO_DECLARADO; cerradoEn: Date; efectivoContadoDecimal: Prisma.Decimal; efectivoEsperadoDecimal: Prisma.Decimal | null }
type CerrarTurnoResult = CajaResult<{ turno: TurnoCerradoPayload; replayed: boolean }>

/** F10-B2.2-G: who really closed a shift (persisted in turnos_caja.cierreOrigen). */
export const CIERRE_ORIGEN_RESPONSABLE = "RESPONSABLE"
export const CIERRE_ORIGEN_RECUPERACION = "RECUPERACION_ADMINISTRATIVA"
export const MOTIVO_RECUPERACION_MAX = 500

function actorPuedeCerrar(negocioId: string, actor: CajaActor, turno: { responsableTipo: string; responsableId: string }) {
  return actor.tipo === "EMPLEADO"
    ? turno.responsableTipo === "EMPLEADO" && turno.responsableId === actor.empleadoId
    : turno.responsableTipo === "NEGOCIO" && turno.responsableId === negocioId
}

function fingerprintCierre(negocioId: string, turnoCajaId: string, efectivoContado: Prisma.Decimal, actor: CajaActor) {
  const actorId = actor.tipo === "EMPLEADO" ? actor.empleadoId : negocioId
  return createHash("sha256").update(`${negocioId}\n${turnoCajaId}\n${efectivoContado.toFixed(2)}\n${actor.tipo}:${actorId}`).digest("hex")
}

const CIERRE_REPLAY_SELECT = {
  id: true, responsableTipo: true, responsableId: true, estado: true, cerradoEn: true,
  efectivoContadoDecimal: true, efectivoEsperadoDecimal: true, cierreIdempotencyFingerprint: true, cierreOrigen: true,
} as const
type CierreReplayRow = Prisma.TurnoCajaGetPayload<{ select: typeof CIERRE_REPLAY_SELECT }>
type CierreTarget = { id: string; cajaFisicaId: string; responsableTipo: string; responsableId: string; estado: string }

/**
 * The ONE close transaction, shared by the responsible person's blind close
 * (C) and the owner's administrative recovery (G). The physical-register lock
 * is shared with the sale engine, and this Serializable transaction makes a
 * sale racing the close either commit first (and enter the expected-cash
 * snapshot) or retry against the closed state.
 */
interface CierreCoreInput {
  negocioId: string
  turnoCajaId: string
  idempotencyKey: string
  fingerprint: string
  efectivoContado: Prisma.Decimal
  /** The row already holding this key belongs to this exact operation. */
  replayMatches: (row: CierreReplayRow) => boolean
  /** Authorization / expectation checks on the target before locking. */
  authorize: (target: CierreTarget) => CerrarTurnoResult | null
  cierre: { cierreOrigen: string; cierreActorTipo: string; cierreActorId: string; cierreMotivo: string | null }
}

function replayCierre(input: CierreCoreInput, row: CierreReplayRow): CerrarTurnoResult {
  if (!input.replayMatches(row) || row.id !== input.turnoCajaId || row.cierreIdempotencyFingerprint !== input.fingerprint || !row.cerradoEn || !row.efectivoContadoDecimal) {
    return fail(409, "Este intento de cierre ya se usó con otros datos.", "IDEMPOTENCY_KEY_REUSED")
  }
  return { ok: true, value: { turno: { id: row.id, estado: TURNO_ESTADO_CERRADO_DECLARADO, cerradoEn: row.cerradoEn, efectivoContadoDecimal: row.efectivoContadoDecimal, efectivoEsperadoDecimal: row.efectivoEsperadoDecimal }, replayed: true } }
}

async function resolverCierreConcurrente(db: Db, input: CierreCoreInput): Promise<CerrarTurnoResult | null> {
  const sameKey = await db.turnoCaja.findUnique({
    where: { negocioId_cierreIdempotencyKey: { negocioId: input.negocioId, cierreIdempotencyKey: input.idempotencyKey } },
    select: CIERRE_REPLAY_SELECT,
  })
  return sameKey ? replayCierre(input, sameKey) : null
}

async function cerrarTurnoCore(db: Db, input: CierreCoreInput): Promise<CerrarTurnoResult> {
  const { negocioId, turnoCajaId, idempotencyKey, fingerprint } = input
  let result: CerrarTurnoResult
  try {
    result = await withSerializableRetry<CerrarTurnoResult>(db, async (tx): Promise<CerrarTurnoResult> => {
    const sameKey = await tx.turnoCaja.findUnique({
      where: { negocioId_cierreIdempotencyKey: { negocioId, cierreIdempotencyKey: idempotencyKey } },
      select: CIERRE_REPLAY_SELECT,
    })
    if (sameKey) return replayCierre(input, sameKey)

    const target = await tx.turnoCaja.findFirst({
      where: { id: turnoCajaId, negocioId },
      select: { id: true, cajaFisicaId: true, responsableTipo: true, responsableId: true, estado: true },
    })
    if (!target) return fail(404, "Turno no encontrado.", "TURNO_NO_ENCONTRADO")
    const denied = input.authorize(target)
    if (denied) return denied

    const register = await lockCaja(tx, negocioId, target.cajaFisicaId)
    if (!register) return fail(404, "Caja no encontrada.", "CAJA_NO_ENCONTRADA")
    if (target.estado !== TURNO_ESTADO_ABIERTO) return fail(409, "El turno ya no está abierto.", "TURNO_NO_ABIERTO")

    // A real row version change is required: merely taking FOR UPDATE would
    // let an older Serializable sale snapshot wait, then keep seeing the old
    // ABIERTO state. The increment makes that waiter abort/retry against the
    // committed close.
    const touchedRegister = await tx.cajaFisica.updateMany({
      where: { id: target.cajaFisicaId, negocioId },
      data: { turnoLockRevision: { increment: 1 } },
    })
    if (touchedRegister.count !== 1) return fail(404, "Caja no encontrada.", "CAJA_NO_ENCONTRADA")

    const closedAt = new Date()
    const snapshotCierre = await calcularSnapshotEfectivoTurno(tx, negocioId, turnoCajaId)
    if (!snapshotCierre) return fail(404, "Turno no encontrado.", "TURNO_NO_ENCONTRADO")
    const updated = await tx.turnoCaja.updateMany({
      where: { id: turnoCajaId, negocioId, cajaFisicaId: target.cajaFisicaId, estado: TURNO_ESTADO_ABIERTO },
      data: {
        estado: TURNO_ESTADO_CERRADO_DECLARADO,
        cerradoEn: closedAt,
        efectivoContadoDecimal: input.efectivoContado,
        efectivoEsperadoDecimal: snapshotCierre.esperado,
        cierreIdempotencyKey: idempotencyKey,
        cierreIdempotencyFingerprint: fingerprint,
        ...input.cierre,
      },
    })
    if (updated.count !== 1) return fail(409, "El turno ya no está abierto.", "TURNO_NO_ABIERTO")
    return {
      ok: true as const,
      value: { turno: { id: turnoCajaId, estado: TURNO_ESTADO_CERRADO_DECLARADO, cerradoEn: closedAt, efectivoContadoDecimal: input.efectivoContado, efectivoEsperadoDecimal: snapshotCierre.esperado }, replayed: false },
    }
    })
  } catch (error) {
    if (isSerializationConflict(error) || isUniqueViolation(error)) {
      const concurrent = await resolverCierreConcurrente(db, input)
      if (concurrent) return concurrent
    }
    throw error
  }
  if (!result.ok && result.code === "TURNO_NO_ABIERTO") {
    const concurrent = await resolverCierreConcurrente(db, input)
    if (concurrent) return concurrent
  }
  return result
}

/**
 * Closes the responsible actor's own shift as a terminal declaration only
 * (blind close: the response carries no expected cash or difference).
 */
export async function cerrarTurnoCaja(db: Db, input: CerrarTurnoInput): Promise<CerrarTurnoResult> {
  const { negocioId, turnoCajaId, actor } = input
  if (!turnoCajaId?.trim()) return fail(400, "Turno inválido.", "TURNO_INVALIDO")
  if (!isValidVentaIdempotencyKey(input.idempotencyKey)) return fail(400, "Falta una Idempotency-Key válida para cerrar el turno.", "IDEMPOTENCY_KEY_REQUIRED")
  const idempotencyKey = input.idempotencyKey.toLowerCase()
  const count = parseFondoInicial(input.efectivoContado)
  if (!count.ok) return fail(400, "El efectivo contado debe ser válido, sin negativos y con hasta 2 decimales.", "EFECTIVO_CONTADO_INVALIDO")
  const fingerprint = fingerprintCierre(negocioId, turnoCajaId, count.value, actor)

  if (actor.tipo === "EMPLEADO") {
    const employee = await db.empleado.findFirst({
      where: { id: actor.empleadoId, negocioId, activo: true, eliminado: false },
      select: { areaOperativa: true, rol: true },
    })
    if (!employee || resolveAreaOperativaEfectiva(employee) !== "caja") return fail(403, "Acceso denegado")
  }

  const responsable = actorResponsable(negocioId, actor)
  return cerrarTurnoCore(db, {
    negocioId,
    turnoCajaId,
    idempotencyKey,
    fingerprint,
    efectivoContado: count.value,
    replayMatches: (row) => actorPuedeCerrar(negocioId, actor, row) && (row.cierreOrigen ?? CIERRE_ORIGEN_RESPONSABLE) === CIERRE_ORIGEN_RESPONSABLE,
    authorize: (target) => actorPuedeCerrar(negocioId, actor, target) ? null : fail(403, "Sólo la persona responsable puede cerrar este turno.", "TURNO_RESPONSABLE_REQUERIDO"),
    cierre: { cierreOrigen: CIERRE_ORIGEN_RESPONSABLE, cierreActorTipo: responsable.responsableTipo, cierreActorId: responsable.responsableId, cierreMotivo: null },
  })
}

export function parseMotivoRecuperacion(value: unknown): { ok: true; value: string } | { ok: false; error: string } {
  const motivo = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : ""
  if (!motivo) return { ok: false, error: "Indicá el motivo de la recuperación del turno." }
  if (motivo.length > MOTIVO_RECUPERACION_MAX) return { ok: false, error: `El motivo admite hasta ${MOTIVO_RECUPERACION_MAX} caracteres.` }
  return { ok: true, value: motivo }
}

export interface RecuperarTurnoInput {
  /** ALWAYS the owner session's business; the owner is the closing actor. */
  negocioId: string
  turnoCajaId: string
  /** Register the owner saw the shift in; a mismatch is a stale screen (409). */
  cajaFisicaId?: unknown
  efectivoContado: unknown
  motivo: unknown
  confirmo: unknown
  idempotencyKey: string
}

function fingerprintRecuperacion(negocioId: string, turnoCajaId: string, efectivoContado: Prisma.Decimal, motivo: string) {
  return createHash("sha256").update(`${CIERRE_ORIGEN_RECUPERACION}\n${negocioId}\n${turnoCajaId}\n${efectivoContado.toFixed(2)}\nNEGOCIO:${negocioId}\n${motivo}`).digest("hex")
}

/**
 * F10-B2.2-G — the business owner closes an EMPLOYEE's open shift
 * administratively to free its physical register. Same close transaction as
 * the blind close: exact expected-cash snapshot, shared register lock and
 * Serializable retries. The responsible employee is kept; the real closing
 * actor (owner), the explicit physical count and the reason are recorded as a
 * RECUPERACION_ADMINISTRATIVA close — never as the employee's declaration. It
 * never opens the next shift nor creates a carryover, sale or ledger movement.
 */
export async function recuperarTurnoCaja(db: Db, input: RecuperarTurnoInput): Promise<CerrarTurnoResult> {
  const { negocioId } = input
  const turnoCajaId = typeof input.turnoCajaId === "string" ? input.turnoCajaId.trim() : ""
  if (!turnoCajaId) return fail(400, "Turno inválido.", "TURNO_INVALIDO")
  if (input.cajaFisicaId !== undefined && input.cajaFisicaId !== null && typeof input.cajaFisicaId !== "string") return fail(400, "Caja inválida.", "CAJA_INVALIDA")
  if (!isValidVentaIdempotencyKey(input.idempotencyKey)) return fail(400, "Falta una Idempotency-Key válida para recuperar el turno.", "IDEMPOTENCY_KEY_REQUIRED")
  const idempotencyKey = input.idempotencyKey.toLowerCase()
  const count = parseFondoInicial(input.efectivoContado)
  if (!count.ok) return fail(400, "Ingresá el efectivo contado físicamente: un importe válido, sin negativos y con hasta 2 decimales.", "EFECTIVO_CONTADO_INVALIDO")
  const motivo = parseMotivoRecuperacion(input.motivo)
  if (!motivo.ok) return fail(400, motivo.error, "MOTIVO_RECUPERACION_REQUERIDO")
  if (input.confirmo !== true) return fail(400, "Confirmá explícitamente que querés cerrar administrativamente este turno.", "CONFIRMACION_RECUPERACION_REQUERIDA")
  const expectedRegister = typeof input.cajaFisicaId === "string" && input.cajaFisicaId.trim() ? input.cajaFisicaId.trim() : null

  return cerrarTurnoCore(db, {
    negocioId,
    turnoCajaId,
    idempotencyKey,
    fingerprint: fingerprintRecuperacion(negocioId, turnoCajaId, count.value, motivo.value),
    efectivoContado: count.value,
    replayMatches: (row) => row.cierreOrigen === CIERRE_ORIGEN_RECUPERACION,
    authorize: (target) => {
      if (expectedRegister && target.cajaFisicaId !== expectedRegister) return fail(409, "El turno ya no corresponde a esa caja. Actualizá el panel.", "CAJA_NO_COINCIDE")
      if (target.responsableTipo !== "EMPLEADO") return fail(409, "Tu propio turno se cierra con el cierre normal, no con una recuperación.", "TURNO_PROPIO_DEL_DUENO")
      if (target.estado !== TURNO_ESTADO_ABIERTO) return fail(409, "El turno ya fue cerrado.", "TURNO_NO_ABIERTO")
      return null
    },
    cierre: { cierreOrigen: CIERRE_ORIGEN_RECUPERACION, cierreActorTipo: "NEGOCIO", cierreActorId: negocioId, cierreMotivo: motivo.value },
  })
}

