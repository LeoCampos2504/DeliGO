import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { createNotification, subscriptionRenewedNotification } from "@/lib/push"

async function verifySuperAdmin(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null
  const user = await getUserFromToken(token)
  if (!user || user.type !== "superadmin") return null
  return user
}

// POST - Renew subscription
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifySuperAdmin(req)
    if (!user) return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })

    const { id } = await params
    const body = await req.json()
    const { periodo, planTipo, fechaVencimientoCustom } = body

    const negocio = await db.negocio.findUnique({ where: { id } })
    if (!negocio) return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 })

    // Calculate new expiration date
    let nuevoVencimiento: Date

    if (fechaVencimientoCustom) {
      nuevoVencimiento = new Date(fechaVencimientoCustom)
    } else {
      const dias = parseInt(String(periodo || 30), 10)
      // Stack on top of current expiration if it's still in the future
      const base = negocio.planVencimiento && new Date(negocio.planVencimiento) > new Date()
        ? new Date(negocio.planVencimiento)
        : new Date()
      nuevoVencimiento = new Date(base)
      nuevoVencimiento.setDate(nuevoVencimiento.getDate() + dias)
    }

    await db.negocio.update({
      where: { id },
      data: {
        planTipo: planTipo || "mensual",
        planVencimiento: nuevoVencimiento.toISOString(),
        planFechaRenovacion: new Date().toISOString(),
        suspendido: false,
      },
    })

    // Notify negocio about subscription renewal
    try {
      const updatedNegocio = await db.negocio.findUnique({
        where: { id },
        select: { pushSubscription: true, nombre: true },
      })
      if (updatedNegocio) {
        const payload = subscriptionRenewedNotification(updatedNegocio.nombre, nuevoVencimiento.toISOString())
        await createNotification({
          userId: id,
          userType: "negocio",
          tipo: "account_update",
          titulo: payload.title,
          cuerpo: payload.body,
          negocioId: id,
          pushSubscription: updatedNegocio.pushSubscription,
          pushPayload: payload,
          cleanupExpired: { model: "negocio", id },
        })
      }
    } catch (pushError) {
      console.error("[Push] Failed to send renewal notification:", pushError)
    }

    return NextResponse.json({
      ok: true,
      mensaje: `Suscripción renovada hasta ${nuevoVencimiento.toLocaleDateString("es-AR")}`,
      nuevoVencimiento: nuevoVencimiento.toISOString(),
    })
  } catch (error) {
    console.error("Error renewing subscription:", error)
    return NextResponse.json({ error: "Error al renovar" }, { status: 500 })
  }
}
