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

export const CAJA_PREDETERMINADA_NOMBRE = "Caja principal"
export const TURNO_ESTADO_ABIERTO = "ABIERTO"
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

export function fingerprintAperturaTurno(negocioId: string, cajaFisicaId: string, fondo: Prisma.Decimal, actor: CajaActor): string {
  const r = actorResponsable(negocioId, actor)
  return createHash("sha256").update(`${negocioId}\n${cajaFisicaId}\n${fondo.toFixed(2)}\n${r.responsableTipo}:${r.responsableId}`).digest("hex")
}

export interface AbrirTurnoInput {
  negocioId: string
  actor: CajaActor
  /** null/undefined = the business's default register. */
  cajaFisicaId?: string | null
  fondoInicial: unknown
  idempotencyKey: string
}

type TurnoConCaja = Prisma.TurnoCajaGetPayload<{ include: { cajaFisica: { select: { id: true; nombre: true } } } }>

/**
 * Opens a shift for the session's actor on a register of THEIR business.
 * Idempotent: the same key + same content from the same actor returns the
 * original shift (replayed); the same key with other content → 409.
 * Concurrent openings of one register → exactly one shift (partial unique
 * index), the others → 409 CAJA_CON_TURNO_ABIERTO.
 */
export async function abrirTurnoCaja(db: Db, input: AbrirTurnoInput): Promise<CajaResult<{ turno: TurnoConCaja; replayed: boolean }>> {
  const { negocioId, actor } = input
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
