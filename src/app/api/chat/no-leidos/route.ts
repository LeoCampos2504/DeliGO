import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { validateSession } from "@/lib/auth"

// GET /api/chat/no-leidos — Get unread message count for current user
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

    let noLeidos = 0
    let pedidosActivos = 0

    if (userType === "cliente") {
      // Count unread messages from vendedor/repartidor across all active orders
      pedidosActivos = await db.pedido.count({
        where: {
          clienteId: userId,
          estado: { notIn: ["entregado", "cancelado"] },
        },
      })

      noLeidos = await db.chatMensaje.count({
        where: {
          pedido: {
            clienteId: userId,
            estado: { notIn: ["entregado", "cancelado"] },
          },
          remitente: { in: ["vendedor", "repartidor"] },
          leido: false,
        },
      })
    } else if (userType === "negocio") {
      // Count unread messages from cliente/repartidor across all active orders (excluding mesa/invitado)
      pedidosActivos = await db.pedido.count({
        where: {
          negocioId: userId,
          estado: { notIn: ["entregado", "cancelado"] },
          metodoEntrega: { not: "mesa" }, // Excluir pedidos de mesa (invitados)
        },
      })

      noLeidos = await db.chatMensaje.count({
        where: {
          pedido: {
            negocioId: userId,
            estado: { notIn: ["entregado", "cancelado"] },
            metodoEntrega: { not: "mesa" }, // Excluir pedidos de mesa (invitados)
          },
          remitente: { in: ["cliente", "repartidor"] },
          leido: false,
        },
      })
    } else if (userType === "repartidor") {
      // Repartidores don't participate in chat
      noLeidos = 0
      pedidosActivos = 0
    }

    return NextResponse.json({ noLeidos, pedidosActivos })
  } catch (error) {
    console.error("[Chat NoLeidos] Error:", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
