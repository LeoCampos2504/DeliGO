import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auditLog } from "@/lib/audit"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"

function noStore<T extends Response>(response: T): T {
  response.headers.set("Cache-Control", "private, no-store")
  return response
}

async function getNegocioAuth(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null

  const user = await getUserFromToken(token)
  if (!user || user.type !== "negocio") return null

  return user
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getNegocioAuth(req)
    if (!user) {
      return noStore(NextResponse.json({ error: "No autenticado" }, { status: 401 }))
    }

    const { id } = await params
    const existing = await db.codigoIncorporacionMozo.findFirst({
      where: {
        id,
        negocioId: user.id,
      },
      select: {
        id: true,
        usedAt: true,
        revokedAt: true,
        expiresAt: true,
        empleadoObjetivoId: true,
      },
    })

    if (!existing) {
      return noStore(
        NextResponse.json(
          { error: "Invitación no encontrada" },
          { status: 404 }
        )
      )
    }

    if (existing.usedAt || existing.revokedAt || existing.expiresAt <= new Date()) {
      return noStore(
        NextResponse.json(
          { error: "La invitación ya no está pendiente" },
          { status: 400 }
        )
      )
    }

    const result = await db.codigoIncorporacionMozo.updateMany({
      where: {
        id,
        negocioId: user.id,
        usedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: {
        revokedAt: new Date(),
      },
    })

    if (result.count === 0) {
      return noStore(
        NextResponse.json(
          { error: "La invitación ya no está pendiente" },
          { status: 400 }
        )
      )
    }

    await auditLog({
      userId: user.id,
      userType: "negocio",
      accion: "mozo.invitacion_revocada",
      recurso: "codigo_incorporacion_mozo",
      recursoId: id,
      detalle: {
        empleadoObjetivoId: existing.empleadoObjetivoId,
      },
    })

    return noStore(NextResponse.json({ ok: true }))
  } catch (error) {
    console.error("[MozoInvitaciones] Error revoking:", error)
    return noStore(
      NextResponse.json(
        { error: "Error al revocar invitación" },
        { status: 500 }
      )
    )
  }
}
