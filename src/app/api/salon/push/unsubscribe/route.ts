import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

// POST /api/salon/push/unsubscribe — Remove push subscription for an employee via salon token
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { salonToken, empleadoId } = body as {
      salonToken: string
      empleadoId: string
    }

    if (!salonToken || !empleadoId) {
      return NextResponse.json(
        { error: "salonToken y empleadoId son obligatorios" },
        { status: 400 }
      )
    }

    // Validate salon token
    const negocio = await db.negocio.findFirst({
      where: { tokenSalon: salonToken },
      select: { id: true },
    })

    if (!negocio) {
      return NextResponse.json({ error: "Token de salón inválido" }, { status: 401 })
    }

    // Remove push subscription
    await db.empleado.update({
      where: { id: empleadoId },
      data: { pushSubscription: null },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Error removing salon push subscription:", error)
    return NextResponse.json(
      { error: "Error al eliminar la suscripción" },
      { status: 500 }
    )
  }
}
