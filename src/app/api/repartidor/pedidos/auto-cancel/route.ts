import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"

// POST - Auto-cancel old unclaimed delivery orders
// Called by the repartidor app periodically or manually
// Cancels orders that are "en_camino" + delivery + no repartidor assigned + older than threshold
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user || user.type !== "repartidor") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const maxMinutes = body.maxMinutes || 30 // default: 30 minutes

    // Only cancel orders from negocios the repartidor is associated with
    const asociaciones = await db.repartidorNegocio.findMany({
      where: { repartidorId: user.id },
      select: { negocioId: true },
    })
    const negocioIds = asociaciones.map((a) => a.negocioId)

    if (negocioIds.length === 0) {
      return NextResponse.json({ cancelled: 0 })
    }

    // Find old unclaimed delivery orders
    const threshold = new Date(Date.now() - maxMinutes * 60 * 1000)

    const oldUnclaimed = await db.pedido.findMany({
      where: {
        negocioId: { in: negocioIds },
        estado: "en_camino",
        metodoEntrega: "domicilio",
        repartidorId: null,
        fecha: { lt: threshold },
      },
      select: { id: true },
    })

    if (oldUnclaimed.length === 0) {
      return NextResponse.json({ cancelled: 0, message: "No hay pedidos viejos sin responder" })
    }

    // Cancel them
    const ids = oldUnclaimed.map((p) => p.id)

    await db.pedido.updateMany({
      where: { id: { in: ids } },
      data: {
        estado: "cancelado",
        canceladoPor: "sistema",
        canceladoMotivo: `Pedido cancelado automáticamente: sin respuesta de repartidor por más de ${maxMinutes} minutos`,
        canceladoFecha: new Date(),
      },
    })

    // Log events for each cancelled order
    await db.pedidoEvento.createMany({
      data: ids.map((pedidoId) => ({
        pedidoId,
        estado: "cancelado",
        estadoAnterior: "en_camino",
        userType: "sistema",
        nota: `Auto-cancelado: sin respuesta por ${maxMinutes} min`,
      })),
    })

    return NextResponse.json({
      cancelled: ids.length,
      message: `${ids.length} pedido(s) cancelado(s) automáticamente`,
    })
  } catch (error) {
    console.error("Error auto-cancelling pedidos:", error)
    return NextResponse.json(
      { error: "Error al cancelar pedidos viejos" },
      { status: 500 }
    )
  }
}
