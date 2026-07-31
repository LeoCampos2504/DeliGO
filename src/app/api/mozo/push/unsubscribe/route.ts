import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { esAreaMozoEfectiva } from "@/lib/area-operativa"
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit"

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

    await db.empleado.update({
      where: { id: empleado.id },
      data: { pushSubscription: null },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Error removing mozo push subscription:", error)
    return NextResponse.json(
      { error: "Error al eliminar la suscripcion" },
      { status: 500 }
    )
  }
}
