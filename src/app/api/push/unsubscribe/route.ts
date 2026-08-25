import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { extractEndpointForDetach } from "@/lib/push-subscription-http"
import { detachPushSubscriptionByEndpoint, type PushSubscriptionOwnerType } from "@/lib/push-subscription-repository"

const NORMALIZED_OWNER_TYPES: Partial<Record<"cliente" | "negocio" | "repartidor" | "superadmin", PushSubscriptionOwnerType>> = {
  cliente: "cliente",
  negocio: "negocio",
  repartidor: "repartidor",
}

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

    // Seguridad-6A: mismo tipo/clave que /api/push/subscribe (ya lo tenía),
    // para que ninguno de los dos quede sin límite de intentos.
    const ip = getClientIp(req)
    const rl = checkRateLimit("push", `${ip}:${user.id}`)
    if (!rl.allowed) {
      return rateLimitResponse(rl)
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

    // P2-T05 Stage3 (F-P2-T05-03, MODEL-C1): el detach normalizado retira
    // ÚNICAMENTE la fila propia de este owner+channel+endpoint — nunca exige
    // que el exact-match legacy haya encontrado nada (multi-device: legacy
    // puede tener otro dispositivo más reciente mientras este endpoint sigue
    // vivo en la tabla normalizada). Ambas escrituras ocurren en la MISMA
    // transacción; nunca se llama al barrido global de endpoints muertos
    // desde un detach de usuario.
    const endpoint = extractEndpointForDetach(subscription)

    // Remove only this browser subscription for the authenticated user.
    switch (user.type) {
      case "cliente":
      case "negocio":
      case "repartidor": {
        const ownerType = NORMALIZED_OWNER_TYPES[user.type]!
        removed = await db.$transaction(async (tx) => {
          let legacyRemoved = false
          if (user.type === "cliente") {
            legacyRemoved = (await tx.cliente.updateMany({
              where: { id: user.id, pushSubscription: subscription },
              data: { pushSubscription: null },
            })).count > 0
          } else if (user.type === "negocio") {
            legacyRemoved = (await tx.negocio.updateMany({
              where: { id: user.id, pushSubscription: subscription },
              data: { pushSubscription: null },
            })).count > 0
          } else {
            legacyRemoved = (await tx.repartidor.updateMany({
              where: { id: user.id, pushSubscription: subscription },
              data: { pushSubscription: null },
            })).count > 0
          }

          let normalizedRemoved = false
          if (endpoint) {
            const result = await detachPushSubscriptionByEndpoint(
              { ownerType, ownerId: user.id, channel: "default" },
              endpoint,
              tx
            )
            normalizedRemoved = result.detached
          }

          return legacyRemoved || normalizedRemoved
        })
        break
      }
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
    console.error("Error removing push subscription:", safeErrorForLog(error))
    return NextResponse.json(
      { error: "Error al eliminar la suscripción" },
      { status: 500 }
    )
  }
}
