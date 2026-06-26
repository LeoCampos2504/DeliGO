import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit"

// POST /api/mozo/push/subscribe — Save push subscription for a mozo via their personal token
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { mozoToken, subscription } = body as {
      mozoToken: string
      subscription: string
    }

    if (!mozoToken || !subscription) {
      return NextResponse.json(
        { error: "mozoToken y subscription son obligatorios" },
        { status: 400 }
      )
    }

    // Rate limit
    const ip = getClientIp(req)
    const rl = checkRateLimit("push", `${ip}:${mozoToken}`)
    if (!rl.allowed) {
      return rateLimitResponse(rl)
    }

    // Validate mozo token
    const empleado = await db.empleado.findFirst({
      where: { token: mozoToken, rol: "mozo", activo: true, eliminado: false },
      select: { id: true },
    })

    if (!empleado) {
      return NextResponse.json({ error: "Token de mozo inválido" }, { status: 401 })
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

    // Save push subscription on the Empleado model
    await db.empleado.update({
      where: { id: empleado.id },
      data: { pushSubscription: subscription },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Error saving mozo push subscription:", error)
    return NextResponse.json(
      { error: "Error al guardar la suscripción" },
      { status: 500 }
    )
  }
}
