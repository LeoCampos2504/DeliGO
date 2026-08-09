import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getAuthenticatedCliente } from "@/lib/cliente-auth"
import { getClientReviewVisibility } from "@/lib/review-moderation-policy"

// Seguridad-6B: historial de pedidos del cliente — datos privados, nunca cacheables.
const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" } as const

// GET /api/cliente/pedidos - Get all orders for the authenticated client
export async function GET(req: NextRequest) {
  try {
    const cliente = await getAuthenticatedCliente(req)
    if (!cliente) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401, headers: NO_STORE_HEADERS })
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
        // `estadoModeracion` se lee sólo para derivar `estadoVisibilidad`
        // server-side (19-H1) — nunca se devuelve tal cual al Cliente.
        resena: { select: { id: true, puntuacion: true, estadoModeracion: true } },
        negocio: {
          select: {
            logoUrl: true,
            colorPrincipal: true,
            lat: true,
            lng: true,
            seguimientoDeliveryActivo: true,
            toleranciaCancelacion: true,
          },
        },
      },
      orderBy: { fecha: "desc" },
      take: 20,
    })

    // Flatten negocio data into each pedido for client consumption
    const pedidosFlat = pedidos.map((p) => {
      const { negocio, resena, ...rest } = p
      return {
        ...rest,
        // 19-H1: nunca se expone `estadoModeracion` (ni ningún otro dato del
        // expediente de moderación) al Cliente — sólo el estado neutral
        // derivado. Una reseña sin moderación en curso es "publicada".
        resena: resena ? { id: resena.id, puntuacion: resena.puntuacion, estadoVisibilidad: getClientReviewVisibility(resena.estadoModeracion) } : null,
        lat: rest.lat,
        lng: rest.lng,
        direccion: rest.direccion,
        negocioLat: rest.negocioLat ?? negocio?.lat ?? null,
        negocioLng: rest.negocioLng ?? negocio?.lng ?? null,
        logoUrl: negocio?.logoUrl ?? null,
        colorPrincipal: negocio?.colorPrincipal ?? null,
        seguimientoDeliveryActivo: negocio?.seguimientoDeliveryActivo ?? true,
        toleranciaCancelacion: negocio?.toleranciaCancelacion ?? 5,
      }
    })

    return NextResponse.json({ ok: true, pedidos: pedidosFlat }, { headers: NO_STORE_HEADERS })
  } catch (error) {
    console.error("Cliente pedidos GET error:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500, headers: NO_STORE_HEADERS })
  }
}
