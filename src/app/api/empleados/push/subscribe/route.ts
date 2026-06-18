import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit"

// POST /api/empleados/push/subscribe — Save a push subscription for the shared
// empleados panel (/e/[token]). Stored on the Negocio model in
// `pushSubscriptionEmpleados` so the owner's personal subscription on
// `pushSubscription` is not affected.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { empleadosToken, subscription } = body as {
      empleadosToken: string
      subscription: string
    }

    if (!empleadosToken || !subscription) {
      return NextResponse.json(
        { error: "empleadosToken y subscription son obligatorios" },
        { status: 400 }
      )
    }

    // Rate limit
    const ip = getClientIp(req)
    const rl = checkRateLimit("push", `${ip}:empleados:${empleadosToken}`)
    if (!rl.allowed) {
      return rateLimitResponse(rl)
    }

    // Validate empleados token (stored on Negocio.tokenEmpleados)
    const negocio = await db.negocio.findFirst({
      where: { tokenEmpleados: empleadosToken },
      select: { id: true },
    })

    if (!negocio) {
      return NextResponse.json({ error: "Token de empleados inválido" }, { status: 401 })
    }

    // Validate subscription is valid JSON
    try {
      JSON.parse(subscription)
    } catch {
      return NextResponse.json(
        { error: "subscription debe ser un JSON válido" },
        { status: 400 }
      )
    }

    // Save push subscription on the Negocio model (dedicated empleados field)
    await db.negocio.update({
      where: { id: negocio.id },
      data: { pushSubscriptionEmpleados: subscription },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Error saving empleados push subscription:", error)
    return NextResponse.json(
      { error: "Error al guardar la suscripción" },
      { status: 500 }
    )
  }
}
