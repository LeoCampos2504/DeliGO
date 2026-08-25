import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit"
import { safeErrorForLog } from "@/lib/log-safe-error"
import {
  parsePushSubscriptionShape,
  toLegacyPushSubscriptionString,
  toNormalizedPushSubscriptionInput,
} from "@/lib/push-subscription-http"
import { registerPushSubscription, type PushSubscriptionOwnerType } from "@/lib/push-subscription-repository"

// P2-T05 Stage3 (F-P2-T05-03): mapping server-derived — el enum normalizado
// NO incluye `superadmin` (rama legacy dead/inert bajo la sesión aislada
// actual de SuperAdmin, P2-T17). El owner/channel jamás se aceptan del body.
const NORMALIZED_OWNER_TYPES: Partial<Record<"cliente" | "negocio" | "repartidor" | "superadmin", PushSubscriptionOwnerType>> = {
  cliente: "cliente",
  negocio: "negocio",
  repartidor: "repartidor",
}

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

    // P2-T05 Stage3 (F-P2-T05-01): validación de forma completa — antes sólo
    // se comprobaba que fuera JSON válido.
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

    // P2-T05 Stage3H3 (F-P2-T05-16): el campo legacy es `String?` — un
    // string original se persiste EXACTO (byte-for-byte, compatibilidad de
    // exact-match con unsubscribe), un objeto original se canonicaliza a
    // JSON usando sólo los campos ya validados.
    const legacyValue = toLegacyPushSubscriptionString(subscription, parsedShape)

    // Save subscription based on user type
    switch (user.type) {
      case "cliente":
      case "negocio":
      case "repartidor": {
        const ownerType = NORMALIZED_OWNER_TYPES[user.type]!
        // P2-T05 Stage3 (F-P0-03, dual-write atómico): legacy + normalizado
        // en la MISMA transacción — si cualquiera falla, ninguno queda
        // committed. El registro normalizado nunca borra otros dispositivos
        // del mismo owner (multi-device) ni de otro owner (MODEL-C1).
        await db.$transaction(async (tx) => {
          if (user.type === "cliente") {
            await tx.cliente.update({
              where: { id: user.id },
              data: { pushSubscription: legacyValue },
            })
          } else if (user.type === "negocio") {
            await tx.negocio.update({
              where: { id: user.id },
              data: { pushSubscription: legacyValue },
            })
          } else {
            await tx.repartidor.update({
              where: { id: user.id },
              data: { pushSubscription: legacyValue },
            })
          }

          await registerPushSubscription(
            { ownerType, ownerId: user.id, channel: "default" },
            normalizedInput,
            tx
          )
        })
        break
      }
      case "superadmin":
        // P2-T17: rama legacy dead/inert — sin owner normalizado, sin
        // dual-write, sin transacción (comportamiento sin cambios).
        await db.superAdmin.update({
          where: { id: user.id },
          data: { pushSubscription: legacyValue },
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
    console.error("Error saving push subscription:", safeErrorForLog(error))
    return NextResponse.json(
      { error: "Error al guardar la suscripción" },
      { status: 500 }
    )
  }
}
