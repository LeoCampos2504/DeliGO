import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { parsePushSubscriptionShape } from "@/lib/push-subscription-http"
import { hasPushSubscriptionForOwnerEndpoint, type PushSubscriptionOwnerType } from "@/lib/push-subscription-repository"

// P2-T05 Stage3R1 (F-P2-T05-12/F-P2-T05-13): fuente de verdad server-side
// para "¿la PushSubscription física actual de este browser está vinculada al
// actor autenticado actual?" — nunca "¿el actor tiene alguna subscription en
// cualquier dispositivo?". Read-only: no crea, actualiza ni borra nada.
const NORMALIZED_OWNER_TYPES: Partial<Record<"cliente" | "negocio" | "repartidor" | "superadmin", PushSubscriptionOwnerType>> = {
  cliente: "cliente",
  negocio: "negocio",
  repartidor: "repartidor",
}

// POST /api/push/status — Read-only check: is the current browser's physical
// PushSubscription bound server-side to the current authenticated actor?
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

    // Mismo bucket que subscribe/unsubscribe — este endpoint es read-only
    // pero comparte la autoridad de abuso existente en vez de introducir un
    // bucket nuevo para un uso acotado a mounts, no a polling.
    const ip = getClientIp(req)
    const rl = checkRateLimit("push", `${ip}:${user.id}`)
    if (!rl.allowed) {
      return rateLimitResponse(rl)
    }

    const body = await req.json().catch(() => ({}))
    const { subscription } = body as { subscription?: unknown }

    if (!subscription || typeof subscription !== "string") {
      return NextResponse.json(
        { error: "subscription es obligatorio" },
        { status: 400 }
      )
    }

    // Reutiliza el parser completo — nunca uno paralelo. El endpoint
    // validado (https, no vacío) es lo único que esta ruta necesita; el
    // mismo string RAW se usa además para el fallback legacy exact-match
    // (idéntico contrato de input que /api/push/subscribe|unsubscribe).
    const parsedShape = parsePushSubscriptionShape(subscription)
    if (!parsedShape) {
      return NextResponse.json(
        { error: "subscription debe ser un JSON válido" },
        { status: 400 }
      )
    }
    const endpoint = parsedShape.endpoint

    let subscribed = false

    // P2-T05 Stage3R1 (§10 mixed-rollout): la binding se considera activa si
    // existe el exact match NORMALIZADO (ownerType+ownerId+channel+endpoint)
    // O el exact match LEGACY (mismo raw string ya almacenado para este
    // actor) — nunca una búsqueda global por endpoint, nunca otro actor.
    switch (user.type) {
      case "cliente":
      case "negocio":
      case "repartidor": {
        const ownerType = NORMALIZED_OWNER_TYPES[user.type]!
        const normalizedMatch = await hasPushSubscriptionForOwnerEndpoint(
          { ownerType, ownerId: user.id, channel: "default" },
          endpoint
        )
        if (normalizedMatch) {
          subscribed = true
        } else if (user.type === "cliente") {
          subscribed = !!(await db.cliente.findFirst({
            where: { id: user.id, pushSubscription: subscription },
            select: { id: true },
          }))
        } else if (user.type === "negocio") {
          subscribed = !!(await db.negocio.findFirst({
            where: { id: user.id, pushSubscription: subscription },
            select: { id: true },
          }))
        } else {
          subscribed = !!(await db.repartidor.findFirst({
            where: { id: user.id, pushSubscription: subscription },
            select: { id: true },
          }))
        }
        break
      }
      case "superadmin":
        // P2-T17: sin owner normalizado — únicamente legacy exact-match,
        // igual que sus propias rutas de subscribe/unsubscribe.
        subscribed = !!(await db.superAdmin.findFirst({
          where: { id: user.id, pushSubscription: subscription },
          select: { id: true },
        }))
        break
      default:
        return NextResponse.json(
          { error: "Tipo de usuario no soportado para push" },
          { status: 400 }
        )
    }

    return NextResponse.json({ subscribed })
  } catch (error) {
    console.error("Error checking push subscription status:", safeErrorForLog(error))
    return NextResponse.json(
      { error: "Error al consultar la suscripción" },
      { status: 500 }
    )
  }
}
