import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { createNotification, negocioReactivatedNotification } from "@/lib/push"

async function verifySuperAdmin(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null
  const user = await getUserFromToken(token)
  if (!user || user.type !== "superadmin") return null
  return user
}

// POST - Reactivate negocio
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifySuperAdmin(req)
    if (!user) return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })

    const { id } = await params
    const negocio = await db.negocio.findUnique({ where: { id } })
    if (!negocio) return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 })

    await db.negocio.update({
      where: { id },
      data: { suspendido: false },
    })

    // Notify negocio that they were reactivated
    try {
      const payload = negocioReactivatedNotification(negocio.nombre)
      await createNotification({
        userId: id,
        userType: "negocio",
        tipo: "account_update",
        titulo: payload.title,
        cuerpo: payload.body,
        negocioId: id,
        pushSubscription: negocio.pushSubscription,
        pushPayload: payload,
        cleanupExpired: { model: "negocio", id },
      })
    } catch (pushError) {
      console.error("[Push] Failed to send reactivation notification:", pushError)
    }

    return NextResponse.json({ ok: true, mensaje: `${negocio.nombre} reactivado` })
  } catch (error) {
    console.error("Error reactivating negocio:", error)
    return NextResponse.json({ error: "Error al reactivar" }, { status: 500 })
  }
}
