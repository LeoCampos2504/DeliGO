import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireSuperadminSession } from "@/lib/superadmin-auth"
import { createNotification, subscriptionRenewedNotification } from "@/lib/push"
import { safeErrorForLog } from "@/lib/log-safe-error"

// Seguridad-6B.4: renovación de suscripción de un negocio por superadmin — expone la
// nueva fecha de vencimiento; nunca cacheable.
const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" } as const

async function verifySuperAdmin(req: NextRequest) {
  const auth = await requireSuperadminSession(req)
  if (!auth.ok) return null
  return auth.admin
}

// POST - Renew subscription
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifySuperAdmin(req)
    if (!user) return NextResponse.json({ error: "Acceso denegado" }, { status: 403, headers: NO_STORE_HEADERS })

    const { id } = await params
    const body = await req.json()
    const { periodo, planTipo, fechaVencimientoCustom } = body

    const negocio = await db.negocio.findUnique({ where: { id } })
    if (!negocio) return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404, headers: NO_STORE_HEADERS })

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
      console.error("[Push] Failed to send renewal notification:", safeErrorForLog(pushError))
    }

    return NextResponse.json({
      ok: true,
      mensaje: `Suscripción renovada hasta ${nuevoVencimiento.toLocaleDateString("es-AR")}`,
      nuevoVencimiento: nuevoVencimiento.toISOString(),
    }, { headers: NO_STORE_HEADERS })
  } catch (error) {
    console.error("Error renewing subscription:", safeErrorForLog(error))
    return NextResponse.json({ error: "Error al renovar" }, { status: 500, headers: NO_STORE_HEADERS })
  }
}
