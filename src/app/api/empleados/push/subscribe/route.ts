import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit"
import { parseAuthorizationBearer } from "@/lib/access-tokens"

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" }

export async function POST(req: NextRequest) {
  try {
    const token = parseAuthorizationBearer(req.headers.get("authorization"))
    const body = await req.json()
    const { subscription } = body as { subscription?: string }

    if (!token || !subscription) {
      return NextResponse.json({ error: "token y subscription son obligatorios" }, { status: 401, headers: NO_STORE_HEADERS })
    }

    const ip = getClientIp(req)
    const rl = checkRateLimit("push", `${ip}:empleados:${token}`)
    if (!rl.allowed) {
      const response = rateLimitResponse(rl)
      response.headers.set("Cache-Control", NO_STORE_HEADERS["Cache-Control"])
      return response
    }

    const negocio = await db.negocio.findFirst({
      where: { tokenEmpleados: token },
      select: { id: true },
    })

    if (!negocio) {
      return NextResponse.json({ error: "Token de empleados invalido" }, { status: 401, headers: NO_STORE_HEADERS })
    }

    try {
      JSON.parse(subscription)
    } catch {
      return NextResponse.json({ error: "subscription debe ser un JSON valido" }, { status: 400, headers: NO_STORE_HEADERS })
    }

    await db.negocio.update({
      where: { id: negocio.id },
      data: { pushSubscriptionEmpleados: subscription },
    })

    return NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS })
  } catch (error) {
    console.error("Error saving empleados push subscription:", error)
    return NextResponse.json({ error: "Error al guardar la suscripcion" }, { status: 500, headers: NO_STORE_HEADERS })
  }
}
