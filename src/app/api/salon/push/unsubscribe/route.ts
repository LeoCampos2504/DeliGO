import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

// POST /api/salon/push/unsubscribe — Remove the shared salon display's push
// subscription. Only requires the salonToken (no empleadoId anymore since the
// subscription lives on the Negocio model itself).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    // Accept both `token` (generic, sent by useSharedPushNotifications hook)
    // and `salonToken` (legacy field name) for backward compatibility.
    const { token, salonToken } = body as {
      token?: string
      salonToken?: string
    }
    const resolvedToken = token || salonToken

    if (!resolvedToken) {
      return NextResponse.json(
        { error: "token es obligatorio" },
        { status: 400 }
      )
    }

    // Validate salon token
    const negocio = await db.negocio.findFirst({
      where: { tokenSalon: resolvedToken },
      select: { id: true },
    })

    if (!negocio) {
      return NextResponse.json({ error: "Token de salón inválido" }, { status: 401 })
    }

    // Remove push subscription from the Negocio model
    await db.negocio.update({
      where: { id: negocio.id },
      data: { pushSubscriptionSalon: null },
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
