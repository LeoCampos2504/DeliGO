import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { parseAuthorizationBearer } from "@/lib/access-tokens"

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" }

export async function POST(req: NextRequest) {
  try {
    const token = parseAuthorizationBearer(req.headers.get("authorization"))
    if (!token) {
      return NextResponse.json({ error: "token es obligatorio" }, { status: 401, headers: NO_STORE_HEADERS })
    }

    const negocio = await db.negocio.findFirst({
      where: { tokenEmpleados: token },
      select: { id: true },
    })

    if (!negocio) {
      return NextResponse.json({ error: "Token de empleados invalido" }, { status: 401, headers: NO_STORE_HEADERS })
    }

    await db.negocio.update({
      where: { id: negocio.id },
      data: { pushSubscriptionEmpleados: null },
    })

    return NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS })
  } catch (error) {
    console.error("Error removing empleados push subscription:", error)
    return NextResponse.json({ error: "Error al eliminar la suscripcion" }, { status: 500, headers: NO_STORE_HEADERS })
  }
}
