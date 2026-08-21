import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { esAreaMozoEfectiva } from "@/lib/area-operativa"
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit"
import { safeErrorForLog } from "@/lib/log-safe-error"

// Ownership-B2: `subscription`, cuando se pasa, exige coincidencia EXACTA
// contra el valor ya almacenado antes de limpiar — nunca un blind clear por
// sólo empleado.id. Mismo patrón ya certificado en /api/push/unsubscribe y en
// /api/operativo/{mozo,salon}/panel/[slug]/push-subscription DELETE.
function parseUnsubscribeSubscription(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) return null
  return value
}

// POST /api/mozo/push/unsubscribe - Remove push subscription for a mozo
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { mozoToken } = body as { mozoToken: string }

    if (!mozoToken) {
      return NextResponse.json(
        { error: "mozoToken es obligatorio" },
        { status: 400 }
      )
    }

    // Seguridad-6A: mismo tipo/clave que /api/mozo/push/subscribe (ya lo
    // tenía) — evita fuerza bruta de mozoToken vía este endpoint, que antes
    // quedaba sin ningún límite de intentos.
    const ip = getClientIp(req)
    const rl = checkRateLimit("push", `${ip}:${mozoToken}`)
    if (!rl.allowed) {
      return rateLimitResponse(rl)
    }

    const empleado = await db.empleado.findFirst({
      where: { token: mozoToken, activo: true, eliminado: false },
      select: { id: true, rol: true, areaOperativa: true },
    })

    // Guard de transición (Operaciones-1F): solo área efectiva Mozo.
    if (!empleado || !esAreaMozoEfectiva({ areaOperativa: empleado.areaOperativa, rol: empleado.rol })) {
      return NextResponse.json({ error: "Token de mozo invalido" }, { status: 401 })
    }

    const subscription = parseUnsubscribeSubscription((body as { subscription?: unknown }).subscription)
    if (!subscription) {
      return NextResponse.json(
        { error: "subscription es obligatorio" },
        { status: 400 }
      )
    }

    // Ownership-B2: coincidencia exacta contra la subscription almacenada —
    // si otro dispositivo de este mismo mozoToken es hoy el dueño real, no
    // se toca nada (removed:false, no es un error de autorización).
    const result = await db.empleado.updateMany({
      where: { id: empleado.id, pushSubscription: subscription },
      data: { pushSubscription: null },
    })

    return NextResponse.json({ ok: true, removed: result.count > 0 })
  } catch (error) {
    console.error("Error removing mozo push subscription:", safeErrorForLog(error))
    return NextResponse.json(
      { error: "Error al eliminar la suscripcion" },
      { status: 500 }
    )
  }
}
