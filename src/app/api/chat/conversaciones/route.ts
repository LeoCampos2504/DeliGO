import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { validateSession } from "@/lib/auth"
import { sanitizeDeletedClientChatMessageForRead } from "@/lib/chat-attachment-deletion"

// ============================================
// Conversation type shared between active & archived
// ============================================
type ConversationItem = {
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
}

// Shared select for messages
const mensajeSelect = {
  orderBy: { fecha: "desc" as const },
  take: 1,
  select: {
    texto: true,
    fecha: true,
    remitente: true,
    imagenUrl: true,
    archivoUrl: true,
    archivoNombre: true,
    clienteId: true,
  },
}

// Build a preview string from the last message. Defensa en profundidad
// (19-B0.2D1): enmascara el preview si el último mensaje es de un Cliente ya
// eliminado que aún conserve contenido sin sanitizar (cuentas eliminadas
// antes de que esta sanitización existiera).
function buildLastMessagePreview(lastMsg: {
  texto: string | null
  imagenUrl: string | null
  archivoUrl: string | null
  archivoNombre: string | null
  remitente: string
  clienteId: string | null
} | undefined): string | null {
  if (!lastMsg) return null
  const safe = sanitizeDeletedClientChatMessageForRead(lastMsg)
  if (safe.texto) return safe.texto
  if (safe.imagenUrl) return "📷 Imagen"
  if (safe.archivoUrl) return `📄 ${safe.archivoNombre || "Archivo"}`
  return null
}

// Bugfix-1 [14]: ordena por la actividad más reciente (último mensaje si
// existe, si no la fecha del pedido) en vez de solo la fecha de creación del
// pedido — así una conversación con mensajes nuevos no queda enterrada
// debajo de un pedido más nuevo sin actividad de chat.
function byMostRecentActivity(a: ConversationItem, b: ConversationItem): number {
  const aTime = (a.lastMessageDate ?? a.fecha).getTime()
  const bTime = (b.lastMessageDate ?? b.fecha).getTime()
  return bTime - aTime
}

// Map a pedido + unreadCount into a ConversationItem
function toConversation(
  pedido: {
    id: string
    negocioNombre: string
    negocioSlug: string
    clienteNombre: string
    estado: string
    total: number
    metodoEntrega: string
    metodoPago: string
    fecha: Date
    mensajes: Array<{
      texto: string | null
      fecha: Date
      remitente: string
      imagenUrl: string | null
      archivoUrl: string | null
      archivoNombre: string | null
      clienteId: string | null
    }>
    negocio?: { logoUrl: string | null }
  },
  unreadCount: number
): ConversationItem {
  const lastMsg = pedido.mensajes[0]
  return {
    pedidoId: pedido.id,
    negocioNombre: pedido.negocioNombre,
    negocioSlug: pedido.negocioSlug,
    clienteNombre: pedido.clienteNombre,
    estado: pedido.estado,
    total: pedido.total,
    metodoEntrega: pedido.metodoEntrega,
    metodoPago: pedido.metodoPago,
    fecha: pedido.fecha,
    lastMessage: buildLastMessagePreview(lastMsg),
    lastMessageDate: lastMsg?.fecha || null,
    lastMessageRemitente: lastMsg?.remitente || null,
    unreadCount,
    negocioLogoUrl: pedido.negocio?.logoUrl ?? null,
  }
}

// ============================================
// GET /api/chat/conversaciones
// Returns { conversations: [...], archived: [...] }
// - conversations: active orders (not entregado/cancelado)
// - archived: completed/cancelled orders within the last 10 days
// ============================================
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

    // 10 days ago cutoff for archived chats
    const archivedCutoff = new Date()
    archivedCutoff.setDate(archivedCutoff.getDate() - 10)

    const conversations: ConversationItem[] = []
    const archived: ConversationItem[] = []

    if (userType === "cliente") {
      // ── Active conversations ──
      const activePedidos = await db.pedido.findMany({
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
          negocio: { select: { logoUrl: true } },
          mensajes: mensajeSelect,
        },
        orderBy: { fecha: "desc" },
      })

      for (const pedido of activePedidos) {
        const unreadCount = await db.chatMensaje.count({
          where: {
            pedidoId: pedido.id,
            remitente: { in: ["vendedor", "repartidor"] },
            leido: false,
          },
        })
        conversations.push(toConversation(pedido, unreadCount))
      }

      // ── Archived conversations (completed/cancelled within last 10 days) ──
      const archivedPedidos = await db.pedido.findMany({
        where: {
          clienteId: userId,
          estado: { in: ["entregado", "cancelado"] },
          fecha: { gte: archivedCutoff },
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
          negocio: { select: { logoUrl: true } },
          mensajes: mensajeSelect,
        },
        orderBy: { fecha: "desc" },
      })

      for (const pedido of archivedPedidos) {
        archived.push(toConversation(pedido, 0))
      }

    } else if (userType === "negocio") {
      const negocio = await db.negocio.findUnique({
        where: { id: userId },
        select: { slug: true },
      })
      if (!negocio) {
        return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 })
      }

      // ── Active conversations ──
      const activePedidos = await db.pedido.findMany({
        where: {
          negocioId: userId,
          estado: { notIn: ["entregado", "cancelado"] },
          metodoEntrega: { not: "mesa" },
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
          mensajes: mensajeSelect,
        },
        orderBy: { fecha: "desc" },
      })

      for (const pedido of activePedidos) {
        const unreadCount = await db.chatMensaje.count({
          where: {
            pedidoId: pedido.id,
            remitente: { in: ["cliente", "repartidor"] },
            leido: false,
          },
        })
        conversations.push(toConversation(pedido, unreadCount))
      }

      // ── Archived conversations ──
      const archivedPedidos = await db.pedido.findMany({
        where: {
          negocioId: userId,
          estado: { in: ["entregado", "cancelado"] },
          metodoEntrega: { not: "mesa" },
          fecha: { gte: archivedCutoff },
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
          mensajes: mensajeSelect,
        },
        orderBy: { fecha: "desc" },
      })

      for (const pedido of archivedPedidos) {
        archived.push(toConversation(pedido, 0))
      }

    } else if (userType === "repartidor") {
      return NextResponse.json({ conversations: [], archived: [] })
    }

    conversations.sort(byMostRecentActivity)
    archived.sort(byMostRecentActivity)

    return NextResponse.json({ conversations, archived })
  } catch (error) {
    console.error("[Chat Conversaciones] Error:", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
