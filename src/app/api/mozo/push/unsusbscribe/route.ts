import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

// POST /api/mozo/push/unsubscribe — Remove push subscription for a mozo
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

    // Validate mozo token
    const empleado = await db.empleado.findFirst({
      where: { token: mozoToken, activo: true, eliminado: false },
      select: { id: true },
    })

    if (!empleado) {
      return NextResponse.json({ error: "Token de mozo inválido" }, { status: 401 })
    }

    // Remove push subscription
    await db.empleado.update({
      where: { id: empleado.id },
      data: { pushSubscription: null },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Error removing mozo push subscription:", error)
    return NextResponse.json(
      { error: "Error al eliminar la suscripción" },
      { status: 500 }
    )
  }
}
