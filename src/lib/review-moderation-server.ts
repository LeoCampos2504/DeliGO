import { Prisma, type MotivoSolicitudRevisionResena } from "@prisma/client";
import { db } from "@/lib/db";
import {
  REVIEW_MODERATION_REASONS,
  getReviewModerationActiveKey,
  getReviewModerationExpiry,
  type ReviewModerationReason,
} from "@/lib/review-moderation-policy";
import { notifyReviewModerationSuperadmins } from "@/lib/review-moderation-notifications";

export const REVIEW_MODERATION_EXPLANATION_MAX_LENGTH = 2000;

export class ReviewModerationNotFoundError extends Error {}
export class ReviewModerationConflictError extends Error {}

export type CreateReviewModerationRequestBody = {
  motivo: ReviewModerationReason;
  explicacion: string;
};

export function parseCreateReviewModerationRequestBody(
  value: unknown,
): CreateReviewModerationRequestBody | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const body = value as Record<string, unknown>;
  const keys = Object.keys(body);
  if (
    keys.length !== 2 ||
    keys.some((key) => key !== "motivo" && key !== "explicacion")
  )
    return null;

  if (
    typeof body.motivo !== "string" ||
    !REVIEW_MODERATION_REASONS.includes(body.motivo as ReviewModerationReason)
  )
    return null;
  if (typeof body.explicacion !== "string" || body.explicacion.includes("\0"))
    return null;

  const explicacion = body.explicacion.trim();
  if (
    !explicacion ||
    explicacion.length > REVIEW_MODERATION_EXPLANATION_MAX_LENGTH
  )
    return null;

  return { motivo: body.motivo as ReviewModerationReason, explicacion };
}

/** Recalcula exclusivamente la representación pública persistida del rating. */
export async function recomputePublicReviewRating(
  tx: Prisma.TransactionClient,
  negocioId: string,
) {
  const stats = await tx.resena.aggregate({
    where: { negocioId, estadoModeracion: "PUBLICADA" },
    _avg: { puntuacion: true },
    _count: true,
  });

  const totalResenas = stats._count;
  const puntuacionPromedio = stats._avg.puntuacion ?? 0;

  await tx.negocio.update({
    where: { id: negocioId },
    data: { totalResenas, puntuacionPromedio },
  });

  return { totalResenas, puntuacionPromedio };
}

export async function createReviewModerationRequest(input: {
  negocioId: string;
  resenaId: string;
  motivo: ReviewModerationReason;
  explicacion: string;
}) {
  // PostgreSQL puede abortar una Serializable válida (P2034). Reintentamos
  // pocas veces el trabajo completo; el CAS/unique siguen siendo la autoridad.
  for (let attempt = 0; attempt < 3; attempt++) {
    const now = new Date();
    const venceEn = getReviewModerationExpiry(now);
    try {
      return await db.$transaction(
        async (tx) => {
          const resena = await tx.resena.findFirst({
            where: { id: input.resenaId, negocioId: input.negocioId },
            select: { id: true, estadoModeracion: true },
          });

          // La existencia ajena e inexistente son indistinguibles para el actor.
          if (!resena) throw new ReviewModerationNotFoundError();
          if (resena.estadoModeracion !== "PUBLICADA")
            throw new ReviewModerationConflictError();

          const solicitud = await tx.solicitudRevisionResena.create({
            data: {
              resenaId: resena.id,
              negocioId: input.negocioId,
              motivo: input.motivo as MotivoSolicitudRevisionResena,
              explicacionOriginal: input.explicacion,
              estado: "PENDIENTE",
              activeKey: getReviewModerationActiveKey(resena.id, "PENDIENTE"),
              venceEn,
            },
            select: {
              id: true,
              estado: true,
              motivo: true,
              venceEn: true,
              createdAt: true,
            },
          });

          // CAS: aun con lecturas concurrentes, sólo la reseña todavía pública puede ocultarse.
          const changed = await tx.resena.updateMany({
            where: {
              id: resena.id,
              negocioId: input.negocioId,
              estadoModeracion: "PUBLICADA",
            },
            data: { estadoModeracion: "OCULTA_EN_REVISION", moderadaEn: now },
          });
          if (changed.count !== 1) throw new ReviewModerationConflictError();

          const evento = await tx.solicitudRevisionResenaEvento.create({
            data: {
              solicitudId: solicitud.id,
              tipo: "SOLICITUD_CREADA",
              actorTipo: "NEGOCIO",
              actorId: input.negocioId,
            },
          });

          // Este audit es crítico: no usa el helper best-effort porque debe rollbackear junto al expediente.
          await tx.auditLog.create({
            data: {
              userId: input.negocioId,
              userType: "negocio",
              accion: "resena.moderacion_solicitada",
              recurso: "solicitud_revision_resena",
              recursoId: solicitud.id,
              detalle: JSON.stringify({
                solicitudId: solicitud.id,
                resenaId: resena.id,
                motivo: input.motivo,
                estado: "PENDIENTE",
              }),
            },
          });

          await notifyReviewModerationSuperadmins(tx, {
            solicitudId: solicitud.id,
            titulo: "Nueva solicitud de revisión",
            cuerpo: "Un negocio solicitó la revisión de una reseña.",
          });

          await recomputePublicReviewRating(tx, input.negocioId);
          return { ...solicitud, eventoId: evento.id };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 15_000,
        },
      );
    } catch (error) {
      if (isSerializationConflict(error) && attempt < 2) continue;
      throw error;
    }
  }

  throw new ReviewModerationConflictError();
}

function isSerializationConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

export function isReviewModerationConflict(error: unknown): boolean {
  if (error instanceof ReviewModerationConflictError) return true;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2002" || error.code === "P2034";
  }
  return false;
}
