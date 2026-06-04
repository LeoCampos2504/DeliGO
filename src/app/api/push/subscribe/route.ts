import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit"

// POST /api/push/subscribe — Save a push subscription for the current user
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

    // Rate limit
    const ip = getClientIp(req)
    const rl = checkRateLimit("push", `${ip}:${user.id}`)
    if (!rl.allowed) {
      return rateLimitResponse(rl)
    }

    const body = await req.json()
    const { subscription } = body as { subscription: string }

    if (!subscription) {
      return NextResponse.json(
        { error: "subscription es obligatorio" },
        { status: 400 }
      )
    }

    // Validate it's valid JSON
    try {
      JSON.parse(subscription)
    } catch {
      return NextResponse.json(
        { error: "subscription debe ser un JSON válido" },
        { status: 400 }
      )
    }

    // Save subscription based on user type
    switch (user.type) {
      case "cliente":
        await db.cliente.update({
          where: { id: user.id },
          data: { pushSubscription: subscription },
        })
        break
      case "negocio":
        await db.negocio.update({
          where: { id: user.id },
          data: { pushSubscription: subscription },
        })
        break
      case "repartidor":
        await db.repartidor.update({
          where: { id: user.id },
          data: { pushSubscription: subscription },
        })
        break
      case "superadmin":
        await db.superAdmin.update({
          where: { id: user.id },
          data: { pushSubscription: subscription },
        })
        break
      default:
        return NextResponse.json(
          { error: "Tipo de usuario no soportado para push" },
          { status: 400 }
        )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Error saving push subscription:", error)
    return NextResponse.json(
      { error: "Error al guardar la suscripción" },
      { status: 500 }
    )
  }
}
