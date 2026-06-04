import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { sendPushNotification, negocioSuspendedNotification } from "@/lib/push"
import { auditLog } from "@/lib/audit"

async function verifySuperAdmin(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null
  const user = await getUserFromToken(token)
  if (!user || user.type !== "superadmin") return null
  return user
}

// POST - Suspend negocio
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
      data: { suspendido: true },
    })

    // Audit log
    await auditLog({ userId: user.id, userType: "superadmin", accion: "negocio.suspendido", recurso: "negocio", recursoId: id, detalle: { suspendido: true } })

    // Notify negocio that they were suspended
    try {
      if (negocio.pushSubscription) {
        await sendPushNotification(
          negocio.pushSubscription,
          negocioSuspendedNotification(negocio.nombre)
        )
      }
    } catch (pushError) {
      console.error("[Push] Failed to send suspension notification:", pushError)
    }

    return NextResponse.json({ ok: true, mensaje: `${negocio.nombre} suspendido` })
  } catch (error) {
    console.error("Error suspending negocio:", error)
    return NextResponse.json({ error: "Error al suspender" }, { status: 500 })
  }
}
