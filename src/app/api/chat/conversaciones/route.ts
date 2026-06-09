import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { validateSession } from "@/lib/auth"

// GET /api/chat/conversaciones — Get active order conversations for current user
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("deligo_session")?.value
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const session = await validateSession(token)
    if (!session) {
      return NextResponse.json({ error: "Sesión inválida" }, { status: 401 })
    }

    const { userId, userType } = session

    // Get active orders (not entregado or cancelado) with their last message and unread count
    let conversations: Array<{
      pedidoId: string
      negocioNombre: string
      negocioSlug: string
      clienteNombre: string
      estado: string
      total: number
      metodoEntrega: string
      metodoPago: string
      fecha: Date
      lastMessage: string | null
      lastMessageDate: Date | null
      lastMessageRemitente: string | null
      unreadCount: number
      negocioLogoUrl: string | null
    }> = []

    if (userType === "cliente") {
      // Get active orders for this client
      const pedidos = await db.pedido.findMany({
        where: {
          clienteId: userId,
          estado: { notIn: ["entregado", "cancelado"] },
        },
        select: {
          id: true,
          negocioNombre: true,
          negocioSlug: true,
          clienteNombre: true,
          estado: true,
          total: true,
          metodoEntrega: true,
          metodoPago: true,
          fecha: true,
          negocio: {
            select: { logoUrl: true },
          },
          mensajes: {
            orderBy: { fecha: "desc" },
            take: 1,
            select: {
              texto: true,
              fecha: true,
              remitente: true,
            },
          },
        },
        orderBy: { fecha: "desc" },
      })

      // Count unread messages (from vendedor or repartidor)
      for (const pedido of pedidos) {
        const unreadCount = await db.chatMensaje.count({
          where: {
            pedidoId: pedido.id,
            remitente: { in: ["vendedor", "repartidor"] },
            leido: false,
          },
        })

        conversations.push({
          pedidoId: pedido.id,
          negocioNombre: pedido.negocioNombre,
          negocioSlug: pedido.negocioSlug,
          clienteNombre: pedido.clienteNombre,
          estado: pedido.estado,
          total: pedido.total,
          metodoEntrega: pedido.metodoEntrega,
          metodoPago: pedido.metodoPago,
          fecha: pedido.fecha,
          lastMessage: pedido.mensajes[0]?.texto || null,
          lastMessageDate: pedido.mensajes[0]?.fecha || null,
          lastMessageRemitente: pedido.mensajes[0]?.remitente || null,
          unreadCount,
          negocioLogoUrl: pedido.negocio.logoUrl,
        })
      }
    } else if (userType === "negocio") {
      // Get active orders for this business
      const negocio = await db.negocio.findUnique({
        where: { id: userId },
        select: { slug: true },
      })
      if (!negocio) {
        return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 })
      }

      const pedidos = await db.pedido.findMany({
        where: {
          negocioId: userId,
          estado: { notIn: ["entregado", "cancelado"] },
          metodoEntrega: { not: "mesa" }, // Excluir pedidos de mesa (invitados) — no tienen chat
        },
        select: {
          id: true,
          negocioNombre: true,
          negocioSlug: true,
          clienteNombre: true,
          estado: true,
          total: true,
          metodoEntrega: true,
          metodoPago: true,
          fecha: true,
          mensajes: {
            orderBy: { fecha: "desc" },
            take: 1,
            select: {
              texto: true,
              fecha: true,
              remitente: true,
            },
          },
        },
        orderBy: { fecha: "desc" },
      })

      for (const pedido of pedidos) {
        const unreadCount = await db.chatMensaje.count({
          where: {
            pedidoId: pedido.id,
            remitente: { in: ["cliente", "repartidor"] },
            leido: false,
          },
        })

        conversations.push({
          pedidoId: pedido.id,
          negocioNombre: pedido.negocioNombre,
          negocioSlug: pedido.negocioSlug,
          clienteNombre: pedido.clienteNombre,
          estado: pedido.estado,
          total: pedido.total,
          metodoEntrega: pedido.metodoEntrega,
          metodoPago: pedido.metodoPago,
          fecha: pedido.fecha,
          lastMessage: pedido.mensajes[0]?.texto || null,
          lastMessageDate: pedido.mensajes[0]?.fecha || null,
          lastMessageRemitente: pedido.mensajes[0]?.remitente || null,
          unreadCount,
          negocioLogoUrl: null,
        })
      }
    } else if (userType === "repartidor") {
      // Repartidores don't participate in chat — they only receive
      // location updates via Socket.IO for orders assigned to them.
      // Return empty conversations list.
      return NextResponse.json({ conversations: [] })
    }

    return NextResponse.json({ conversations })
  } catch (error) {
    console.error("[Chat Conversaciones] Error:", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
