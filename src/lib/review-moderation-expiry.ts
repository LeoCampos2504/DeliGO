import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import {
  REVIEW_MODERATION_ACTIVE_REQUEST_STATUSES,
  REVIEW_MODERATION_REQUEST_STATUSES,
  isReviewModerationExpiryCandidate,
  type ReviewModerationRequestStatus,
} from "@/lib/review-moderation-policy"
import { recomputePublicReviewRating } from "@/lib/review-moderation-server"
import { notifyReviewModerationBusiness } from "@/lib/review-moderation-notifications"

// ============================================
// DeliGO — 19-G: vencimiento automático de solicitudes de revisión
// ============================================
// Mismo principio que src/lib/mesa-occupancy-expiration.ts (P0-D.3C): el
// barrido inicial NUNCA autoriza por sí solo — sólo acota candidatas. Cada
// una se revalida por completo (estado, activeKey y `venceEn` persistido)
// dentro de su propia transacción Serializable antes de escribir nada, con
// el mismo motor de reintento P2034 acotado que ya usan
// review-moderation-server.ts/business.ts/superadmin.ts (nunca un loop
// infinito). Si otro actor humano gana la carrera, Postgres deshace esta
// transacción vía conflicto de serialización; el reintento vuelve a leer y
// esta vez `isReviewModerationExpiryCandidate` ya no la acepta — pierde
// limpiamente, sin evento/AuditLog/notificación/rating huérfanos.

export const REVIEW_MODERATION_EXPIRY_BATCH_LIMIT = 50
const MAX_ATTEMPTS = 3

function isSerializationConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034"
}

function isKnownRequestStatus(value: string): value is ReviewModerationRequestStatus {
  return REVIEW_MODERATION_REQUEST_STATUSES.includes(value as ReviewModerationRequestStatus)
}

// Invariante interno: si ya confirmamos DENTRO de la misma transacción que la
// solicitud sigue activa, con el `activeKey` esperado y vencida, el
// `updateMany` inmediato con esas mismas condiciones bajo aislamiento
// Serializable debería afectar siempre exactamente una fila. Que no lo haga
// indicaría una inconsistencia que este proceso nunca debe intentar reparar
// en silencio — se cuenta como error, nunca como "expired".
class ReviewModerationExpiryInconsistentError extends Error {}

export type ReviewModerationExpiryOutcome = "expired" | "not_due" | "conflict"

interface ExpiryCandidate {
  id: string
}

/**
 * Revalida y, si corresponde, vence UNA solicitud dentro de su propia
 * transacción. Nunca confía en el barrido inicial como autorización.
 */
async function expireOneCandidate(candidate: ExpiryCandidate, now: Date): Promise<ReviewModerationExpiryOutcome> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        const current = await tx.solicitudRevisionResena.findUnique({
          where: { id: candidate.id },
          select: { id: true, resenaId: true, negocioId: true, estado: true, activeKey: true, venceEn: true },
        })
        if (!current || !isKnownRequestStatus(current.estado)) return "not_due"
        if (!isReviewModerationExpiryCandidate({ estado: current.estado, venceEn: current.venceEn }, now)) return "not_due"
        if (current.activeKey !== current.resenaId) return "not_due"

        // CAS: condiciona por id, estado todavía activo, activeKey todavía
        // esperado y `venceEn` persistido todavía vencido — exactamente lo
        // que se acaba de leer en esta misma transacción.
        const changed = await tx.solicitudRevisionResena.updateMany({
          where: { id: current.id, estado: current.estado, activeKey: current.resenaId, venceEn: { lte: now } },
          data: { estado: "RESTAURADA_AUTOMATICAMENTE", activeKey: null, resueltaEn: now },
        })
        if (changed.count !== 1) throw new ReviewModerationExpiryInconsistentError("No se pudo vencer la solicitud esperada")

        const reviewChanged = await tx.resena.updateMany({
          where: { id: current.resenaId, negocioId: current.negocioId, estadoModeracion: "OCULTA_EN_REVISION" },
          data: { estadoModeracion: "PUBLICADA", moderadaEn: null },
        })
        if (reviewChanged.count !== 1) throw new ReviewModerationExpiryInconsistentError("No se pudo restaurar la reseña esperada")

        // Misma política de rating pública que RECHAZAR (superadmin.ts): la
        // reseña vuelve a contar en el promedio publicado. No se duplica la
        // fórmula — se reutiliza el helper transaccional existente.
        await recomputePublicReviewRating(tx, current.negocioId)

        await tx.solicitudRevisionResenaEvento.create({
          data: {
            solicitudId: current.id,
            tipo: "RESTAURADA_AUTOMATICAMENTE",
            actorTipo: "SISTEMA",
            actorId: null,
            metadata: JSON.stringify({ estadoAnterior: current.estado, estadoNuevo: "RESTAURADA_AUTOMATICAMENTE" }),
          },
        })
        await tx.auditLog.create({
          data: {
            userId: "sistema",
            userType: "sistema",
            accion: "resena.moderacion_vencimiento_automatico",
            recurso: "solicitud_revision_resena",
            recursoId: current.id,
            detalle: JSON.stringify({ solicitudId: current.id, resenaId: current.resenaId, estadoAnterior: current.estado, estadoNuevo: "RESTAURADA_AUTOMATICAMENTE" }),
          },
        })
        await notifyReviewModerationBusiness(tx, {
          negocioId: current.negocioId,
          solicitudId: current.id,
          titulo: "Solicitud de revisión vencida",
          cuerpo: "La solicitud de revisión venció y la reseña fue restaurada.",
        })

        return "expired"
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 })
    } catch (error) {
      if (isSerializationConflict(error) && attempt < MAX_ATTEMPTS - 1) continue
      if (isSerializationConflict(error)) return "conflict"
      throw error
    }
  }
  return "conflict"
}

export interface ExpireReviewModerationRequestsOptions {
  /** Instante de referencia — inyectable para pruebas deterministas. Por defecto, `new Date()`. */
  now?: Date
  /** Tope de candidatas procesadas en esta corrida — nunca se cargan todas las solicitudes activas en memoria. */
  batchLimit?: number
}

export interface ExpireReviewModerationRequestsResult {
  scanned: number
  expired: number
  notDue: number
  conflicts: number
  errors: number
}

/**
 * Barre solicitudes activas cuyo `venceEn` persistido ya llegó o pasó, y
 * vence cada una de forma segura tras revalidarla en su propia transacción
 * Serializable. Pensado para ejecutarse una vez por invocación (ver
 * scripts/expire-review-moderation.ts, Start Command de un Railway Cron
 * Service) — no programa ningún temporizador ni queda corriendo en segundo
 * plano.
 */
export async function expireReviewModerationRequests(
  options?: ExpireReviewModerationRequestsOptions
): Promise<ExpireReviewModerationRequestsResult> {
  const now = options?.now ?? new Date()
  const batchLimit =
    typeof options?.batchLimit === "number" && Number.isInteger(options.batchLimit) && options.batchLimit > 0
      ? options.batchLimit
      : REVIEW_MODERATION_EXPIRY_BATCH_LIMIT

  const result: ExpireReviewModerationRequestsResult = { scanned: 0, expired: 0, notDue: 0, conflicts: 0, errors: 0 }

  // El barrido inicial NUNCA autoriza por sí solo — sólo acota el universo a
  // revalidar. Orden determinístico (vencimiento más antiguo primero, luego
  // id) y sólo los campos necesarios; nunca toda la tabla en memoria.
  const candidatas = await db.solicitudRevisionResena.findMany({
    where: { estado: { in: [...REVIEW_MODERATION_ACTIVE_REQUEST_STATUSES] }, venceEn: { lte: now } },
    orderBy: [{ venceEn: "asc" }, { id: "asc" }],
    take: batchLimit,
    select: { id: true },
  })
  result.scanned = candidatas.length

  for (const candidata of candidatas) {
    try {
      const outcome = await expireOneCandidate(candidata, now)
      if (outcome === "expired") result.expired += 1
      else if (outcome === "conflict") result.conflicts += 1
      else result.notDue += 1
    } catch {
      // Nunca se detiene el lote por un error puntual — se sigue con la
      // próxima candidata. Nunca se loguea por candidata (ni sanitizado);
      // el único punto de logging es el resumen agregado del caller.
      result.errors += 1
    }
  }

  return result
}
