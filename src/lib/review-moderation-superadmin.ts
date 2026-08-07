import {
  Prisma,
  type EstadoSolicitudRevisionResena,
  type TipoEventoSolicitudRevisionResena,
} from "@prisma/client"
import { db } from "@/lib/db"
import {
  REVIEW_MODERATION_ACTIVE_REQUEST_STATUSES,
  REVIEW_MODERATION_REQUEST_STATUSES,
  getReviewModerationTransition,
  type ReviewModerationRequestStatus,
} from "@/lib/review-moderation-policy"
import { recomputePublicReviewRating } from "@/lib/review-moderation-server"
import { notifyReviewModerationBusiness } from "@/lib/review-moderation-notifications"

export const REVIEW_MODERATION_DECISION_MAX_LENGTH = 2000
export const REVIEW_MODERATION_LIST_DEFAULT_LIMIT = 20
export const REVIEW_MODERATION_LIST_MAX_LIMIT = 50
const MUTATION_MAX_ATTEMPTS = 3

export class ReviewModerationSuperadminNotFoundError extends Error {}
export class ReviewModerationSuperadminConflictError extends Error {}

export type ReviewModerationSuperadminAction = "TOMAR_EN_REVISION" | "PEDIR_INFORMACION" | "APROBAR" | "RECHAZAR"

export function parseReviewModerationDecisionBody(value: unknown, key: "motivoDecision" | "mensaje"): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const body = value as Record<string, unknown>
  if (Object.keys(body).length !== 1 || typeof body[key] !== "string") return null
  const text = body[key].trim()
  if (!text || text.length > REVIEW_MODERATION_DECISION_MAX_LENGTH || text.includes("\0")) return null
  return text
}

export function parseReviewModerationListParams(params: URLSearchParams): {
  estado?: EstadoSolicitudRevisionResena
  page: number
  limit: number
} | null {
  const estado = params.get("estado") ?? undefined
  const pageText = params.get("page") ?? "1"
  const limitText = params.get("limit") ?? String(REVIEW_MODERATION_LIST_DEFAULT_LIMIT)
  if (estado && !REVIEW_MODERATION_REQUEST_STATUSES.includes(estado as ReviewModerationRequestStatus)) return null
  if (!/^\d+$/.test(pageText) || !/^\d+$/.test(limitText)) return null
  const page = Number(pageText)
  const limit = Number(limitText)
  if (!Number.isSafeInteger(page) || !Number.isSafeInteger(limit) || page < 1 || limit < 1 || limit > REVIEW_MODERATION_LIST_MAX_LIMIT) return null
  return { estado: estado as EstadoSolicitudRevisionResena | undefined, page, limit }
}

export async function listReviewModerationRequests(input: { estado?: EstadoSolicitudRevisionResena; page: number; limit: number }) {
  const where = input.estado ? { estado: input.estado } : undefined
  const [items, total] = await Promise.all([
    db.solicitudRevisionResena.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (input.page - 1) * input.limit,
      take: input.limit,
      select: {
        id: true, estado: true, motivo: true, venceEn: true, resueltaEn: true, createdAt: true, updatedAt: true,
        negocio: { select: { nombre: true, slug: true } },
        resena: { select: { id: true, puntuacion: true, comentario: true, fecha: true, estadoModeracion: true } },
      },
    }),
    db.solicitudRevisionResena.count({ where }),
  ])
  return { items, total, page: input.page, limit: input.limit }
}

export async function getReviewModerationRequestDetail(id: string) {
  const item = await db.solicitudRevisionResena.findUnique({
    where: { id },
    select: {
      id: true, estado: true, motivo: true, explicacionOriginal: true, venceEn: true, resueltaEn: true, motivoDecision: true, createdAt: true, updatedAt: true,
      negocio: { select: { nombre: true, slug: true } },
      resena: {
        select: {
          id: true, puntuacion: true, rapidez: true, calidad: true, precio: true, comentario: true,
          respuestaNegocio: true, fecha: true, fechaRespuesta: true, estadoModeracion: true,
        },
      },
      eventos: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { tipo: true, actorTipo: true, mensaje: true, createdAt: true },
      },
    },
  })
  if (!item) throw new ReviewModerationSuperadminNotFoundError()
  return item
}

function isSerializationConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034"
}

function isKnownRequestStatus(value: string): value is ReviewModerationRequestStatus {
  return REVIEW_MODERATION_REQUEST_STATUSES.includes(value as ReviewModerationRequestStatus)
}

function auditAction(action: ReviewModerationSuperadminAction) {
  return {
    TOMAR_EN_REVISION: "resena.moderacion_tomada",
    PEDIR_INFORMACION: "resena.moderacion_informacion_requerida",
    APROBAR: "resena.moderacion_aprobada",
    RECHAZAR: "resena.moderacion_rechazada",
  }[action]
}

function eventType(action: ReviewModerationSuperadminAction) {
  const types: Record<ReviewModerationSuperadminAction, TipoEventoSolicitudRevisionResena> = {
    TOMAR_EN_REVISION: "TOMADA_EN_REVISION",
    PEDIR_INFORMACION: "INFORMACION_REQUERIDA",
    APROBAR: "APROBADA",
    RECHAZAR: "RECHAZADA",
  }
  return types[action]
}

export async function mutateReviewModerationRequest(input: {
  solicitudId: string
  superadminId: string
  action: ReviewModerationSuperadminAction
  text?: string
}) {
  const text = input.text?.trim()
  for (let attempt = 0; attempt < MUTATION_MAX_ATTEMPTS; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        const current = await tx.solicitudRevisionResena.findUnique({
          where: { id: input.solicitudId },
          select: { id: true, resenaId: true, negocioId: true, estado: true, activeKey: true },
        })
        if (!current) throw new ReviewModerationSuperadminNotFoundError()
        if (!isKnownRequestStatus(current.estado)) throw new ReviewModerationSuperadminConflictError()

        const next = getReviewModerationTransition(current.estado, input.action)
        if (!next || current.activeKey !== current.resenaId) throw new ReviewModerationSuperadminConflictError()
        const now = new Date()
        const terminal = next === "APROBADA" || next === "RECHAZADA"
        const changed = await tx.solicitudRevisionResena.updateMany({
          where: { id: current.id, estado: current.estado, activeKey: current.resenaId },
          data: {
            estado: next,
            activeKey: terminal ? null : current.resenaId,
            resueltaEn: terminal ? now : null,
            revisadaPorSuperadminId: input.superadminId,
            motivoDecision: terminal ? text : null,
          },
        })
        if (changed.count !== 1) throw new ReviewModerationSuperadminConflictError()

        if (input.action === "APROBAR" || input.action === "RECHAZAR") {
          const reviewChanged = await tx.resena.updateMany({
            where: { id: current.resenaId, negocioId: current.negocioId, estadoModeracion: "OCULTA_EN_REVISION" },
            data: input.action === "APROBAR"
              ? { estadoModeracion: "ELIMINADA_POR_MODERACION", moderadaEn: now }
              : { estadoModeracion: "PUBLICADA", moderadaEn: null },
          })
          if (reviewChanged.count !== 1) throw new ReviewModerationSuperadminConflictError()
          if (input.action === "RECHAZAR") await recomputePublicReviewRating(tx, current.negocioId)
        } else {
          const review = await tx.resena.findFirst({
            where: { id: current.resenaId, negocioId: current.negocioId },
            select: { estadoModeracion: true },
          })
          if (review?.estadoModeracion !== "OCULTA_EN_REVISION") throw new ReviewModerationSuperadminConflictError()
        }

        await tx.solicitudRevisionResenaEvento.create({
          data: {
            solicitudId: current.id,
            tipo: eventType(input.action),
            actorTipo: "SUPERADMIN",
            actorId: input.superadminId,
            mensaje: input.action === "PEDIR_INFORMACION" ? text : undefined,
            metadata: JSON.stringify({ estadoAnterior: current.estado, estadoNuevo: next }),
          },
        })
        await tx.auditLog.create({
          data: {
            userId: input.superadminId,
            userType: "superadmin",
            accion: auditAction(input.action),
            recurso: "solicitud_revision_resena",
            recursoId: current.id,
            detalle: JSON.stringify({ solicitudId: current.id, resenaId: current.resenaId, estadoAnterior: current.estado, estadoNuevo: next }),
          },
        })

        if (input.action === "PEDIR_INFORMACION") {
          await notifyReviewModerationBusiness(tx, {
            negocioId: current.negocioId,
            solicitudId: current.id,
            titulo: "Se necesita información adicional",
            cuerpo: "Se solicitó información adicional para continuar con la revisión de una reseña.",
          })
        }
        if (input.action === "APROBAR") {
          await notifyReviewModerationBusiness(tx, {
            negocioId: current.negocioId,
            solicitudId: current.id,
            titulo: "Solicitud de revisión aprobada",
            cuerpo: "La solicitud fue aprobada y la reseña dejó de publicarse.",
          })
        }
        if (input.action === "RECHAZAR") {
          await notifyReviewModerationBusiness(tx, {
            negocioId: current.negocioId,
            solicitudId: current.id,
            titulo: "Solicitud de revisión rechazada",
            cuerpo: "La solicitud fue rechazada y la reseña volvió a publicarse.",
          })
        }

        return {
          solicitud: { id: current.id, estado: next, resueltaEn: terminal ? now : null, updatedAt: now },
          resena: { estadoModeracion: input.action === "APROBAR" ? "ELIMINADA_POR_MODERACION" : input.action === "RECHAZAR" ? "PUBLICADA" : "OCULTA_EN_REVISION" },
        }
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 })
    } catch (error) {
      if (isSerializationConflict(error) && attempt < MUTATION_MAX_ATTEMPTS - 1) continue
      if (isSerializationConflict(error)) throw new ReviewModerationSuperadminConflictError()
      throw error
    }
  }
  throw new ReviewModerationSuperadminConflictError()
}

export function isReviewModerationSuperadminConflict(error: unknown): boolean {
  return error instanceof ReviewModerationSuperadminConflictError || isSerializationConflict(error)
}
