import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getAuthenticatedCliente } from "@/lib/cliente-auth"

// GET /api/cliente/pedidos - Get all orders for the authenticated client
export async function GET(req: NextRequest) {
  try {
    const cliente = await getAuthenticatedCliente(req)
    if (!cliente) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const estado = searchParams.get("estado") // "activos" or "historial"

    const activeStatuses = ["recibido", "confirmado", "preparando", "en_camino", "listo_para_retirar"]

    const where: Record<string, unknown> = {
      clienteId: cliente.id,
    }

    if (estado === "activos") {
      where.estado = { in: activeStatuses }
    } else if (estado === "historial") {
      where.estado = { in: ["entregado", "cancelado"] }
    }

    const pedidos = await db.pedido.findMany({
      where,
      include: {
        items: true,
        resena: { select: { id: true, puntuacion: true } },
        negocio: {
          select: {
            logoUrl: true,
            colorPrincipal: true,
            lat: true,
            lng: true,
            seguimientoDeliveryActivo: true,
          },
        },
      },
      orderBy: { fecha: "desc" },
      take: 20,
    })

    // Flatten negocio data into each pedido for client consumption
    const pedidosFlat = pedidos.map((p) => {
      const { negocio, ...rest } = p
      return {
        ...rest,
        lat: rest.lat,
        lng: rest.lng,
        direccion: rest.direccion,
        negocioLat: rest.negocioLat ?? negocio?.lat ?? null,
        negocioLng: rest.negocioLng ?? negocio?.lng ?? null,
        logoUrl: negocio?.logoUrl ?? null,
        colorPrincipal: negocio?.colorPrincipal ?? null,
        seguimientoDeliveryActivo: negocio?.seguimientoDeliveryActivo ?? true,
      }
    })

    return NextResponse.json({ ok: true, pedidos: pedidosFlat })
  } catch (error) {
    console.error("Cliente pedidos GET error:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
