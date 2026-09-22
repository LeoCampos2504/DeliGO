import type { Prisma } from "@prisma/client"

type Tx = Prisma.TransactionClient

function datos(solicitudId: string, target: "negocio" | "superadmin") {
  return JSON.stringify({ solicitudId, navigateTo: { [target]: target === "negocio" ? "resenas" : "moderacion-resenas" } })
}

export interface NotifyReviewModerationSuperadminsResult {
  count: number
  /** P2-T39-R3: para el dispatch de Push POST-COMMIT (nunca dentro de la
   * misma transacción de moderación). */
  recipientIds: string[]
}

export async function notifyReviewModerationSuperadmins(
  tx: Tx,
  input: { solicitudId: string; titulo: string; cuerpo: string; reviewerId?: string | null },
): Promise<NotifyReviewModerationSuperadminsResult> {
  const preferred = input.reviewerId
    ? await tx.superAdmin.findFirst({ where: { id: input.reviewerId, activo: true }, select: { id: true } })
    : null
  const admins = preferred ? [preferred] : await tx.superAdmin.findMany({ where: { activo: true }, select: { id: true } })
  if (!admins.length) return { count: 0, recipientIds: [] }
  await tx.notificacion.createMany({
    data: admins.map((admin) => ({
      userId: admin.id,
      userType: "superadmin",
      tipo: "review_moderation",
      titulo: input.titulo,
      cuerpo: input.cuerpo,
      datos: datos(input.solicitudId, "superadmin"),
    })),
  })
  const recipientIds = admins.map((admin) => admin.id)
  return { count: recipientIds.length, recipientIds }
}

export async function notifyReviewModerationBusiness(
  tx: Tx,
  input: { negocioId: string; solicitudId: string; titulo: string; cuerpo: string },
) {
  await tx.notificacion.create({
    data: {
      userId: input.negocioId,
      userType: "negocio",
      tipo: "review_moderation",
      titulo: input.titulo,
      cuerpo: input.cuerpo,
      negocioId: input.negocioId,
      datos: datos(input.solicitudId, "negocio"),
    },
  })
}
