import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { generatePrivateEvidenceStorageKey } from "@/lib/private-evidence-storage"
import {
  REVIEW_MODERATION_EVIDENCE_MAX_PER_EVENT,
  REVIEW_MODERATION_EVIDENCE_MAX_PER_REQUEST,
} from "@/lib/review-moderation-evidence-file"

const ACTIVE_STATUSES = new Set(["PENDIENTE", "EN_REVISION", "REQUIERE_INFORMACION"])
const ELIGIBLE_EVENT_TYPES = new Set(["SOLICITUD_CREADA", "INFORMACION_APORTADA"])
const MAX_ATTEMPTS = 3

export type ReviewModerationEvidenceStorage = {
  put(input: { bytes: Uint8Array; storageKey: string; mimeType: string }): Promise<{ storageKey: string }>
  get(input: { storageKey: string }): Promise<Uint8Array>
  delete(input: { storageKey: string }): Promise<void>
}

export class ReviewModerationEvidenceNotFoundError extends Error {}
export class ReviewModerationEvidenceConflictError extends Error {}

function isSerializationConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034"
}

async function compensate(storage: ReviewModerationEvidenceStorage, storageKey: string) {
  try {
    await storage.delete({ storageKey })
  } catch {
    console.error("Private review evidence compensation failed")
  }
}

export async function createReviewModerationEvidence(input: {
  negocioId: string
  uploaderId: string
  solicitudId: string
  eventoId: string
  file: { bytes: Uint8Array; mimeType: string; nombrePresentacion: string; sha256: string }
  storage: ReviewModerationEvidenceStorage
  generateStorageKey?: () => string
}) {
  const storageKey = (input.generateStorageKey ?? generatePrivateEvidenceStorageKey)()
  await input.storage.put({ bytes: input.file.bytes, storageKey, mimeType: input.file.mimeType })

  try {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      try {
        return await db.$transaction(async (tx) => {
          const solicitud = await tx.solicitudRevisionResena.findFirst({
            where: { id: input.solicitudId, negocioId: input.negocioId },
            select: { id: true, estado: true, resena: { select: { estadoModeracion: true } } },
          })
          if (!solicitud) throw new ReviewModerationEvidenceNotFoundError()
          if (!ACTIVE_STATUSES.has(solicitud.estado) || solicitud.resena.estadoModeracion !== "OCULTA_EN_REVISION") {
            throw new ReviewModerationEvidenceConflictError()
          }

          const evento = await tx.solicitudRevisionResenaEvento.findFirst({
            where: { id: input.eventoId, solicitudId: solicitud.id },
            select: { id: true, tipo: true, actorTipo: true, actorId: true },
          })
          if (!evento) throw new ReviewModerationEvidenceNotFoundError()
          if (evento.actorTipo !== "NEGOCIO" || evento.actorId !== input.negocioId || !ELIGIBLE_EVENT_TYPES.has(evento.tipo)) {
            throw new ReviewModerationEvidenceConflictError()
          }

          const [eventCount, bytes] = await Promise.all([
            tx.evidenciaSolicitudRevisionResena.count({ where: { eventoId: evento.id } }),
            tx.evidenciaSolicitudRevisionResena.aggregate({ where: { solicitudId: solicitud.id }, _sum: { bytes: true } }),
          ])
          if (eventCount >= REVIEW_MODERATION_EVIDENCE_MAX_PER_EVENT || (bytes._sum.bytes ?? 0) + input.file.bytes.byteLength > REVIEW_MODERATION_EVIDENCE_MAX_PER_REQUEST) {
            throw new ReviewModerationEvidenceConflictError()
          }

          const evidencia = await tx.evidenciaSolicitudRevisionResena.create({
            data: {
              solicitudId: solicitud.id,
              eventoId: evento.id,
              uploaderTipo: "NEGOCIO",
              uploaderId: input.uploaderId,
              storageKey,
              mimeType: input.file.mimeType,
              bytes: input.file.bytes.byteLength,
              sha256: input.file.sha256,
              nombrePresentacion: input.file.nombrePresentacion,
            },
            select: { id: true, eventoId: true, nombrePresentacion: true, mimeType: true, bytes: true, createdAt: true },
          })
          return { evidencia }
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 })
      } catch (error) {
        if (isSerializationConflict(error) && attempt < MAX_ATTEMPTS - 1) continue
        if (isSerializationConflict(error)) throw new ReviewModerationEvidenceConflictError()
        throw error
      }
    }
    throw new ReviewModerationEvidenceConflictError()
  } catch (error) {
    await compensate(input.storage, storageKey)
    throw error
  }
}

export async function getBusinessReviewModerationEvidence(input: { negocioId: string; solicitudId: string; evidenciaId: string }) {
  const evidencia = await db.evidenciaSolicitudRevisionResena.findFirst({
    where: { id: input.evidenciaId, solicitudId: input.solicitudId, solicitud: { negocioId: input.negocioId } },
    select: { storageKey: true, mimeType: true, nombrePresentacion: true },
  })
  if (!evidencia) throw new ReviewModerationEvidenceNotFoundError()
  return evidencia
}

export async function getSuperadminReviewModerationEvidence(input: { solicitudId: string; evidenciaId: string }) {
  const evidencia = await db.evidenciaSolicitudRevisionResena.findFirst({
    where: { id: input.evidenciaId, solicitudId: input.solicitudId },
    select: { storageKey: true, mimeType: true, nombrePresentacion: true },
  })
  if (!evidencia) throw new ReviewModerationEvidenceNotFoundError()
  return evidencia
}
