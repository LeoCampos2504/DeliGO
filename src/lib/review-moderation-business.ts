import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import {
  canUseReviewModerationInformationExtension,
  getReviewModerationExpiry,
} from "@/lib/review-moderation-policy"

export const REVIEW_MODERATION_BUSINESS_INFORMATION_MAX_LENGTH = 2000
const MAX_ATTEMPTS = 3

export class ReviewModerationBusinessNotFoundError extends Error {}
export class ReviewModerationBusinessConflictError extends Error {}

export function parseBusinessModerationInformationBody(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const body = value as Record<string, unknown>
  if (Object.keys(body).length !== 1 || typeof body.mensaje !== "string") return null
  const mensaje = body.mensaje.trim()
  if (!mensaje || mensaje.length > REVIEW_MODERATION_BUSINESS_INFORMATION_MAX_LENGTH || mensaje.includes("\0")) return null
  return mensaje
}

export async function getBusinessReviewModerationHistory(input: { negocioId: string; resenaId: string }) {
  const review = await db.resena.findFirst({
    where: { id: input.resenaId, negocioId: input.negocioId },
    select: {
      id: true,
      solicitudesRevision: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true, estado: true, motivo: true, explicacionOriginal: true, venceEn: true, resueltaEn: true,
          motivoDecision: true, createdAt: true, updatedAt: true,
          eventos: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: { tipo: true, actorTipo: true, mensaje: true, createdAt: true },
          },
        },
      },
    },
  })
  if (!review) throw new ReviewModerationBusinessNotFoundError()
  return { resenaId: review.id, solicitudes: review.solicitudesRevision }
}

function isSerializationConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034"
}

export async function addBusinessReviewModerationInformation(input: {
  negocioId: string
  solicitudId: string
  mensaje: string
}) {
  const mensaje = input.mensaje.trim()
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        const solicitud = await tx.solicitudRevisionResena.findFirst({
          where: { id: input.solicitudId, negocioId: input.negocioId },
          select: {
            id: true, negocioId: true, resenaId: true, estado: true, activeKey: true,
            prorrogaInformacionUsada: true, venceEn: true,
            resena: { select: { id: true, negocioId: true, estadoModeracion: true } },
          },
        })
        if (!solicitud) throw new ReviewModerationBusinessNotFoundError()
        if (solicitud.estado !== "REQUIERE_INFORMACION" || solicitud.activeKey !== solicitud.resenaId) throw new ReviewModerationBusinessConflictError()
        if (!solicitud.resena || solicitud.resena.negocioId !== input.negocioId || solicitud.resena.estadoModeracion !== "OCULTA_EN_REVISION") {
          throw new ReviewModerationBusinessConflictError()
        }

        const now = new Date()
        const prorrogaAplicada = canUseReviewModerationInformationExtension(solicitud.estado, solicitud.prorrogaInformacionUsada)
        const venceEn = prorrogaAplicada ? getReviewModerationExpiry(now) : solicitud.venceEn
        const changed = await tx.solicitudRevisionResena.updateMany({
          where: {
            id: solicitud.id,
            negocioId: input.negocioId,
            estado: "REQUIERE_INFORMACION",
            activeKey: solicitud.resenaId,
          },
          data: {
            estado: "EN_REVISION",
            activeKey: solicitud.resenaId,
            prorrogaInformacionUsada: prorrogaAplicada ? true : solicitud.prorrogaInformacionUsada,
            venceEn,
          },
        })
        if (changed.count !== 1) throw new ReviewModerationBusinessConflictError()

        await tx.solicitudRevisionResenaEvento.create({
          data: {
            solicitudId: solicitud.id,
            tipo: "INFORMACION_APORTADA",
            actorTipo: "NEGOCIO",
            actorId: input.negocioId,
            mensaje,
            metadata: JSON.stringify({ estadoAnterior: "REQUIERE_INFORMACION", estadoNuevo: "EN_REVISION", prorrogaAplicada }),
          },
        })
        await tx.auditLog.create({
          data: {
            userId: input.negocioId,
            userType: "negocio",
            accion: "resena.moderacion_informacion_aportada",
            recurso: "solicitud_revision_resena",
            recursoId: solicitud.id,
            detalle: JSON.stringify({ solicitudId: solicitud.id, resenaId: solicitud.resenaId, estadoAnterior: "REQUIERE_INFORMACION", estadoNuevo: "EN_REVISION", prorrogaAplicada }),
          },
        })

        return { solicitud: { id: solicitud.id, estado: "EN_REVISION" as const, venceEn, updatedAt: now } }
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 })
    } catch (error) {
      if (isSerializationConflict(error) && attempt < MAX_ATTEMPTS - 1) continue
      if (isSerializationConflict(error)) throw new ReviewModerationBusinessConflictError()
      throw error
    }
  }
  throw new ReviewModerationBusinessConflictError()
}

export function isReviewModerationBusinessConflict(error: unknown): boolean {
  return error instanceof ReviewModerationBusinessConflictError || isSerializationConflict(error)
}
