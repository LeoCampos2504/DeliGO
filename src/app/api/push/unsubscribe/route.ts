import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"

// POST /api/push/unsubscribe — Remove push subscription for the current user
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user) {
      return NextResponse.json({ error: "Sesión inválida" }, { status: 401 })
    }

    let subscription: string | null = null
    try {
      const body = await req.json()
      subscription = typeof body?.subscription === "string" ? body.subscription : null
    } catch {
      subscription = null
    }

    if (!subscription) {
      return NextResponse.json({ ok: true, removed: false })
    }

    try {
      JSON.parse(subscription)
    } catch {
      return NextResponse.json(
        { error: "subscription debe ser un JSON vÃ¡lido" },
        { status: 400 }
      )
    }

    let removed = false

    // Remove only this browser subscription for the authenticated user.
    switch (user.type) {
      case "cliente":
        removed = (await db.cliente.updateMany({
          where: { id: user.id, pushSubscription: subscription },
          data: { pushSubscription: null },
        })).count > 0
        break
      case "negocio":
        removed = (await db.negocio.updateMany({
          where: { id: user.id, pushSubscription: subscription },
          data: { pushSubscription: null },
        })).count > 0
        break
      case "repartidor":
        removed = (await db.repartidor.updateMany({
          where: { id: user.id, pushSubscription: subscription },
          data: { pushSubscription: null },
        })).count > 0
        break
      case "superadmin":
        removed = (await db.superAdmin.updateMany({
          where: { id: user.id, pushSubscription: subscription },
          data: { pushSubscription: null },
        })).count > 0
        break
      default:
        return NextResponse.json(
          { error: "Tipo de usuario no soportado" },
          { status: 400 }
        )
    }

    return NextResponse.json({ ok: true, removed })
  } catch (error) {
    console.error("Error removing push subscription:", error)
    return NextResponse.json(
      { error: "Error al eliminar la suscripción" },
      { status: 500 }
    )
  }
}
