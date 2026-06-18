import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit"

// POST /api/salon/push/subscribe — Save a push subscription for the shared
// salon display (/s/[token]). The subscription is stored on the Negocio model
// in `pushSubscriptionSalon` (separate from the owner's personal
// `pushSubscription`) so multiple devices can each receive notifications.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    // Accept both `token` (generic, sent by useSharedPushNotifications hook)
    // and `salonToken` (legacy field name) for backward compatibility.
    const { token, salonToken, subscription } = body as {
      token?: string
      salonToken?: string
      subscription: string
    }
    const resolvedToken = token || salonToken

    if (!resolvedToken || !subscription) {
      return NextResponse.json(
        { error: "token y subscription son obligatorios" },
        { status: 400 }
      )
    }

    // Rate limit
    const ip = getClientIp(req)
    const rl = checkRateLimit("push", `${ip}:salon:${resolvedToken}`)
    if (!rl.allowed) {
      return rateLimitResponse(rl)
    }

    // Validate salon token
    const negocio = await db.negocio.findFirst({
      where: { tokenSalon: resolvedToken },
      select: { id: true },
    })

    if (!negocio) {
      return NextResponse.json({ error: "Token de salón inválido" }, { status: 401 })
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

    // Save push subscription on the Negocio model (dedicated salon field)
    await db.negocio.update({
      where: { id: negocio.id },
      data: { pushSubscriptionSalon: subscription },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Error saving salon push subscription:", error)
    return NextResponse.json(
      { error: "Error al guardar la suscripción" },
      { status: 500 }
    )
  }
}
