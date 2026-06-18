import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

// POST /api/empleados/push/unsubscribe — Remove the shared empleados panel's
// push subscription. Only requires the empleadosToken.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { empleadosToken } = body as { empleadosToken: string }

    if (!empleadosToken) {
      return NextResponse.json(
        { error: "empleadosToken es obligatorio" },
        { status: 400 }
      )
    }

    // Validate empleados token
    const negocio = await db.negocio.findFirst({
      where: { tokenEmpleados: empleadosToken },
      select: { id: true },
    })

    if (!negocio) {
      return NextResponse.json({ error: "Token de empleados inválido" }, { status: 401 })
    }

    // Remove push subscription from the Negocio model
    await db.negocio.update({
      where: { id: negocio.id },
      data: { pushSubscriptionEmpleados: null },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Error removing empleados push subscription:", error)
    return NextResponse.json(
      { error: "Error al eliminar la suscripción" },
      { status: 500 }
    )
  }
}
