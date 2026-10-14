import { createHash } from "node:crypto"
import { Prisma, type PrismaClient } from "@prisma/client"
import { isValidVentaIdempotencyKey } from "@/lib/caja-venta"

const TX_OPTIONS = { maxWait: 5_000, timeout: 15_000 } as const
const OBSERVACION_MAX = 1000

export type ResultadoDiferencia = "COINCIDE" | "FALTANTE" | "SOBRANTE"

export function clasificarDiferencia(diferencia: Prisma.Decimal): ResultadoDiferencia {
  if (diferencia.isZero()) return "COINCIDE"
  return diferencia.isNegative() ? "FALTANTE" : "SOBRANTE"
}

export function normalizarObservacion(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === "") return null
  if (typeof value !== "string") return undefined
  const normalized = value.trim()
  return normalized.length <= OBSERVACION_MAX ? normalized || null : undefined
}

export function fingerprintRevision(negocioId: string, turnoCajaId: string, observacion: string | null) {
  return createHash("sha256").update(`${negocioId}\n${turnoCajaId}\n${observacion ?? ""}`).digest("hex")
}

function esConflictoSerializacion(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034"
}

function esViolacionUnica(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

export type RevisionResultado =
  | { ok: true; revision: { id: string; turnoCajaId: string; accion: string; observacion: string | null; efectivoEsperadoDecimal: Prisma.Decimal; efectivoContadoDecimal: Prisma.Decimal; diferenciaDecimal: Prisma.Decimal; createdAt: Date }; replayed: boolean }
  | { ok: false; status: 400 | 404 | 409; code: string; error: string }

const fail = (status: 400 | 404 | 409, code: string, error: string): RevisionResultado => ({ ok: false, status, code, error })

/** Owner-only, append-only review. It records a snapshot and never edits a closure or the cash ledger. */
export async function registrarRevisionTurnoCaja(
  db: PrismaClient,
  input: { negocioId: string; turnoCajaId: string; idempotencyKey: string; observacion: string | null },
): Promise<RevisionResultado> {
  const { negocioId, turnoCajaId } = input
  if (!turnoCajaId.trim()) return fail(400, "TURNO_INVALIDO", "Turno inválido.")
  if (!isValidVentaIdempotencyKey(input.idempotencyKey)) return fail(400, "IDEMPOTENCY_KEY_REQUIRED", "Falta una Idempotency-Key válida para registrar la revisión.")
  if (input.observacion !== null && input.observacion.length > OBSERVACION_MAX) return fail(400, "OBSERVACION_INVALIDA", "La observación admite hasta 1000 caracteres.")

  const idempotencyKey = input.idempotencyKey.toLowerCase()
  const fingerprint = fingerprintRevision(negocioId, turnoCajaId, input.observacion)

  for (let attempt = 1; ; attempt++) {
    try {
      return await db.$transaction(async (tx): Promise<RevisionResultado> => {
        const previous = await tx.revisionTurnoCaja.findUnique({
          where: { negocioId_idempotencyKey: { negocioId, idempotencyKey } },
        })
        if (previous) {
          if (previous.turnoCajaId !== turnoCajaId || previous.actorId !== negocioId || previous.idempotencyFingerprint !== fingerprint) {
            return fail(409, "IDEMPOTENCY_KEY_REUSED", "Este intento de revisión ya se usó con otros datos.")
          }
          return { ok: true, revision: previous, replayed: true }
        }

        const locked = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "turnos_caja"
          WHERE "id" = ${turnoCajaId} AND "negocioId" = ${negocioId}
          FOR UPDATE`
        if (!locked.length) return fail(404, "TURNO_NO_ENCONTRADO", "Turno no encontrado.")

        const turno = await tx.turnoCaja.findFirst({
          where: { id: turnoCajaId, negocioId },
          select: { id: true, estado: true, cerradoEn: true, efectivoContadoDecimal: true, efectivoEsperadoDecimal: true },
        })
        if (!turno) return fail(404, "TURNO_NO_ENCONTRADO", "Turno no encontrado.")
        if (turno.estado !== "CERRADO_DECLARADO" || !turno.cerradoEn || !turno.efectivoContadoDecimal || !turno.efectivoEsperadoDecimal) {
          return fail(409, "TURNO_NO_CERRADO", "Sólo se pueden revisar turnos cerrados con declaración registrada.")
        }
        const diferencia = turno.efectivoContadoDecimal.minus(turno.efectivoEsperadoDecimal)
        if (!diferencia.isZero() && !input.observacion?.trim()) {
          return fail(400, "OBSERVACION_REQUERIDA", "Agregá una observación para registrar la diferencia.")
        }

        const revision = await tx.revisionTurnoCaja.create({
          data: {
            negocioId,
            turnoCajaId,
            actorId: negocioId,
            accion: "REVISION_ADMINISTRATIVA",
            observacion: input.observacion,
            efectivoEsperadoDecimal: turno.efectivoEsperadoDecimal,
            efectivoContadoDecimal: turno.efectivoContadoDecimal,
            diferenciaDecimal: diferencia,
            idempotencyKey,
            idempotencyFingerprint: fingerprint,
          },
        })
        return { ok: true, revision, replayed: false }
      }, { ...TX_OPTIONS, isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    } catch (error) {
      if (esConflictoSerializacion(error) && attempt < 3) continue
      if (esViolacionUnica(error)) {
        const previous = await db.revisionTurnoCaja.findUnique({ where: { negocioId_idempotencyKey: { negocioId, idempotencyKey } } })
        if (previous && previous.turnoCajaId === turnoCajaId && previous.actorId === negocioId && previous.idempotencyFingerprint === fingerprint) {
          return { ok: true, revision: previous, replayed: true }
        }
        if (previous) return fail(409, "IDEMPOTENCY_KEY_REUSED", "Este intento de revisión ya se usó con otros datos.")
      }
      throw error
    }
  }
}
