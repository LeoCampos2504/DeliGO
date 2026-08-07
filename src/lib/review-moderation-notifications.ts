import type { Prisma } from "@prisma/client"

type Tx = Prisma.TransactionClient

function datos(solicitudId: string, target: "negocio" | "superadmin") {
  return JSON.stringify({ solicitudId, navigateTo: { [target]: target === "negocio" ? "resenas" : "moderacion-resenas" } })
}

export async function notifyReviewModerationSuperadmins(
  tx: Tx,
  input: { solicitudId: string; titulo: string; cuerpo: string; reviewerId?: string | null },
) {
  const preferred = input.reviewerId
    ? await tx.superAdmin.findFirst({ where: { id: input.reviewerId, activo: true }, select: { id: true } })
    : null
  const admins = preferred ? [preferred] : await tx.superAdmin.findMany({ where: { activo: true }, select: { id: true } })
  if (!admins.length) return 0
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
  return admins.length
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
