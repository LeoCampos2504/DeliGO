import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit"

// POST /api/salon/push/subscribe — Save a push subscription for an employee via salon token
// This is used by the salon shared link page (no session cookie required)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { salonToken, empleadoId, subscription } = body as {
      salonToken: string
      empleadoId: string
      subscription: string
    }

    if (!salonToken || !empleadoId || !subscription) {
      return NextResponse.json(
        { error: "salonToken, empleadoId y subscription son obligatorios" },
        { status: 400 }
      )
    }

    // Rate limit
    const ip = getClientIp(req)
    const rl = checkRateLimit("push", `${ip}:${empleadoId}`)
    if (!rl.allowed) {
      return rateLimitResponse(rl)
    }

    // Validate salon token
    const negocio = await db.negocio.findFirst({
      where: { tokenSalon: salonToken },
      select: { id: true },
    })

    if (!negocio) {
      return NextResponse.json({ error: "Token de salón inválido" }, { status: 401 })
    }

    // Validate the empleado belongs to this negocio
    const empleado = await db.empleado.findFirst({
      where: { id: empleadoId, negocioId: negocio.id, activo: true, eliminado: false },
      select: { id: true },
    })

    if (!empleado) {
      return NextResponse.json({ error: "Empleado no encontrado o no pertenece a este negocio" }, { status: 404 })
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
      where: { id: empleadoId },
      data: { pushSubscription: subscription },
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
