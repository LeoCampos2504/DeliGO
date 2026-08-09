// DeliGO — Tarea 19-A: contrato puro de moderación de reseñas.
// Sin DB, Prisma, cookies, fetch, entorno ni estado mutable. Las rutas de 19-B/C
// deberán usar estas reglas junto con CAS y transacciones; este módulo no autoriza.

export const REVIEW_MODERATION_TTL_DAYS = 14
export const REVIEW_MODERATION_TTL_MS = REVIEW_MODERATION_TTL_DAYS * 24 * 60 * 60 * 1000

export const REVIEW_MODERATION_STATUSES = ["PUBLICADA", "OCULTA_EN_REVISION", "ELIMINADA_POR_MODERACION"] as const
export type ReviewModerationStatus = (typeof REVIEW_MODERATION_STATUSES)[number]

export const REVIEW_MODERATION_REQUEST_STATUSES = [
  "PENDIENTE", "EN_REVISION", "REQUIERE_INFORMACION", "APROBADA", "RECHAZADA", "RESTAURADA_AUTOMATICAMENTE",
] as const
export type ReviewModerationRequestStatus = (typeof REVIEW_MODERATION_REQUEST_STATUSES)[number]

export const REVIEW_MODERATION_ACTIVE_REQUEST_STATUSES = ["PENDIENTE", "EN_REVISION", "REQUIERE_INFORMACION"] as const satisfies readonly ReviewModerationRequestStatus[]
export const REVIEW_MODERATION_TERMINAL_REQUEST_STATUSES = ["APROBADA", "RECHAZADA", "RESTAURADA_AUTOMATICAMENTE"] as const satisfies readonly ReviewModerationRequestStatus[]

export const REVIEW_MODERATION_REASONS = ["FALSA", "ILEGAL", "OFENSIVA", "DISCRIMINATORIA", "OTRA_INFRACCION"] as const
export type ReviewModerationReason = (typeof REVIEW_MODERATION_REASONS)[number]

export type ReviewModerationAction = "CREAR" | "TOMAR_EN_REVISION" | "PEDIR_INFORMACION" | "APORTAR_INFORMACION" | "APROBAR" | "RECHAZAR" | "EXPIRAR"

const ACTIVE_REQUEST_STATUSES = new Set<string>(REVIEW_MODERATION_ACTIVE_REQUEST_STATUSES)
const TERMINAL_REQUEST_STATUSES = new Set<string>(REVIEW_MODERATION_TERMINAL_REQUEST_STATUSES)

export function isReviewPublic(status: ReviewModerationStatus): boolean {
  return status === "PUBLICADA"
}

export function isReviewModerationRequestActive(status: ReviewModerationRequestStatus): boolean {
  return ACTIVE_REQUEST_STATUSES.has(status)
}

export function isReviewModerationRequestTerminal(status: ReviewModerationRequestStatus): boolean {
  return TERMINAL_REQUEST_STATUSES.has(status)
}

export function getReviewModerationTransition(
  from: ReviewModerationRequestStatus | null,
  action: ReviewModerationAction
): ReviewModerationRequestStatus | null {
  if (action === "CREAR") return from === null ? "PENDIENTE" : null
  if (from === null || isReviewModerationRequestTerminal(from)) return null
  if (action === "TOMAR_EN_REVISION") return from === "PENDIENTE" ? "EN_REVISION" : null
  if (action === "PEDIR_INFORMACION") return from === "PENDIENTE" || from === "EN_REVISION" ? "REQUIERE_INFORMACION" : null
  if (action === "APORTAR_INFORMACION") return from === "REQUIERE_INFORMACION" ? "EN_REVISION" : null
  if (action === "APROBAR") return "APROBADA"
  if (action === "RECHAZAR") return "RECHAZADA"
  if (action === "EXPIRAR") return "RESTAURADA_AUTOMATICAMENTE"
  return null
}

export function canReviewModerationTransition(from: ReviewModerationRequestStatus | null, action: ReviewModerationAction): boolean {
  return getReviewModerationTransition(from, action) !== null
}

/** Valor que 19-B debe persistir junto al estado, dentro de la misma transacción. */
export function getReviewModerationActiveKey(reviewId: string, status: ReviewModerationRequestStatus): string | null {
  return isReviewModerationRequestActive(status) ? reviewId : null
}

/** Vencimiento inicial fijo; una futura prórroga controlada no debe exceder una vez. */
export function getReviewModerationExpiry(createdAt: Date): Date {
  return new Date(createdAt.getTime() + REVIEW_MODERATION_TTL_MS)
}

export function canUseReviewModerationInformationExtension(status: ReviewModerationRequestStatus, alreadyUsed: boolean): boolean {
  return status === "REQUIERE_INFORMACION" && !alreadyUsed
}

/**
 * 19-G: una solicitud es candidata a vencimiento automático únicamente si
 * sigue activa Y su `venceEn` persistido (la autoridad — nunca
 * `createdAt + TTL` recalculado, porque 19-D puede haber aplicado la única
 * prórroga) ya llegó o pasó. `<=` para que el instante exacto cuente como
 * vencido.
 */
export function isReviewModerationExpiryCandidate(
  input: { estado: ReviewModerationRequestStatus; venceEn: Date },
  now: Date
): boolean {
  return isReviewModerationRequestActive(input.estado) && input.venceEn.getTime() <= now.getTime()
}

export interface PublicReviewRatingInput {
  puntuacion: number
  estadoModeracion: ReviewModerationStatus
}

export interface PublicReviewRatingSummary {
  total: number
  promedio: number
  distribucion: Record<1 | 2 | 3 | 4 | 5, number>
}

/**
 * Conserva la semántica actual del cache de Negocio: promedio aritmético sin
 * redondeo de persistencia; la UI existente decide su presentación decimal.
 */
export function summarizePublicReviewRating(reviews: readonly PublicReviewRatingInput[]): PublicReviewRatingSummary {
  const distribucion: PublicReviewRatingSummary["distribucion"] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  let total = 0
  let suma = 0
  for (const review of reviews) {
    if (!isReviewPublic(review.estadoModeracion)) continue
    total += 1
    suma += review.puntuacion
    if (Number.isInteger(review.puntuacion) && review.puntuacion >= 1 && review.puntuacion <= 5) {
      distribucion[review.puntuacion as 1 | 2 | 3 | 4 | 5] += 1
    }
  }
  return { total, promedio: total === 0 ? 0 : suma / total, distribucion }
}
