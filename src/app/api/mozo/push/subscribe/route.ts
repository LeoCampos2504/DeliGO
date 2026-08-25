import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { esAreaMozoEfectiva } from "@/lib/area-operativa"
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit"
import { safeErrorForLog } from "@/lib/log-safe-error"
import {
  parsePushSubscriptionShape,
  toLegacyPushSubscriptionString,
  toNormalizedPushSubscriptionInput,
} from "@/lib/push-subscription-http"
import { registerPushSubscription } from "@/lib/push-subscription-repository"

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
      where: { token: mozoToken, activo: true, eliminado: false },
      select: { id: true, rol: true, areaOperativa: true },
    })

    // Guard de transición (Operaciones-1F): solo área efectiva Mozo.
    if (!empleado || !esAreaMozoEfectiva({ areaOperativa: empleado.areaOperativa, rol: empleado.rol })) {
      return NextResponse.json({ error: "Token de mozo inválido" }, { status: 401 })
    }

    // P2-T05 Stage3 (F-P2-T05-01): validación de forma completa unificada.
    const parsedShape = parsePushSubscriptionShape(subscription)
    if (!parsedShape) {
      return NextResponse.json(
        { error: "subscription debe ser un JSON válido" },
        { status: 400 }
      )
    }
    const normalizedInput = toNormalizedPushSubscriptionInput(parsedShape)
    if (!normalizedInput) {
      return NextResponse.json(
        { error: "subscription debe ser un JSON válido" },
        { status: 400 }
      )
    }

    // P2-T05 Stage3H3 (F-P2-T05-16): ver push-subscription-http.ts —
    // string original se persiste exacto, objeto original se canonicaliza.
    const legacyValue = toLegacyPushSubscriptionString(subscription, parsedShape)

    // Save push subscription on the Empleado model + normalizada, en la
    // MISMA transacción (P2-T05 Stage3, F-P0-03 dual-write atómico).
    await db.$transaction(async (tx) => {
      await tx.empleado.update({
        where: { id: empleado.id },
        data: { pushSubscription: legacyValue },
      })

      await registerPushSubscription(
        { ownerType: "empleado", ownerId: empleado.id, channel: "default" },
        normalizedInput,
        tx
      )
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Error saving mozo push subscription:", safeErrorForLog(error))
    return NextResponse.json(
      { error: "Error al guardar la suscripción" },
      { status: 500 }
    )
  }
}
