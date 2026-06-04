import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { validateSession } from "@/lib/auth"
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit"
import { sendPushNotification, chatMessageNotification } from "@/lib/push"

// Phone number filtering regex (Argentine phone patterns)
const PHONE_PATTERN = /(?:(?:\+?54|0)?(?:11|[2-9]\d{2,4})[\s\-]?\d{4,}[\s\-]?\d{0,4})|(?:whatsapp\.com|wa\.me|\/send\?phone)/gi

function filterPhoneNumbers(text: string): { filtered: string; hadPhone: boolean } {
  const filtered = text.replace(PHONE_PATTERN, "[***]")
  return { filtered, hadPhone: filtered !== text }
}

// Simple HTML sanitization
function sanitizeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
}

// Verify user has access to this pedido's chat
async function verifyChatAccess(
  userId: string,
  userType: string,
  pedidoId: string
): Promise<{ access: boolean; reason?: string }> {
  const pedido = await db.pedido.findUnique({
    where: { id: pedidoId },
    select: {
      id: true,
      clienteId: true,
      negocioId: true,
      estado: true,
      metodoEntrega: true,
    },
  })

  if (!pedido) return { access: false, reason: "Pedido no encontrado" }

  // Mesa orders (invitados) don't have chat
  if (pedido.metodoEntrega === "mesa") {
    return { access: false, reason: "Los pedidos de mesa no tienen chat" }
  }

  if (userType === "cliente") {
    return { access: pedido.clienteId === userId }
  } else if (userType === "negocio") {
    return { access: pedido.negocioId === userId }
  } else if (userType === "repartidor") {
    // Check if repartidor is assigned to the negocio of this order
    const assignment = await db.repartidorNegocio.findFirst({
      where: {
        repartidorId: userId,
        negocioId: pedido.negocioId,
      },
    })
    return { access: !!assignment }
  }

  return { access: false }
}

// GET /api/chat/mensajes/[pedidoId] — Fetch messages for an order chat
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ pedidoId: string }> }
) {
  try {
    const { pedidoId } = await params
    const token = req.cookies.get("deligo_session")?.value
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const session = await validateSession(token)
    if (!session) {
      return NextResponse.json({ error: "Sesión inválida" }, { status: 401 })
    }

    const { userId, userType } = session

    // Verify access
    const { access, reason } = await verifyChatAccess(userId, userType, pedidoId)
    if (!access) {
      return NextResponse.json({ error: reason || "Sin acceso a este chat" }, { status: 403 })
    }

    // Get pedido info
    const pedido = await db.pedido.findUnique({
      where: { id: pedidoId },
      select: {
        id: true,
        negocioNombre: true,
        negocioSlug: true,
        clienteNombre: true,
        estado: true,
        total: true,
        metodoEntrega: true,
        metodoPago: true,
      },
    })

    if (!pedido) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 })
    }

    // Get messages
    const mensajes = await db.chatMensaje.findMany({
      where: { pedidoId },
      orderBy: { fecha: "asc" },
      select: {
        id: true,
        pedidoId: true,
        remitente: true,
        texto: true,
        imagenUrl: true,
        archivoUrl: true,
        archivoNombre: true,
        archivoTipo: true,
        leido: true,
        fecha: true,
        clienteId: true,
      },
    })

    // Mark messages from other parties as read
    const otherRemitentes =
      userType === "cliente"
        ? ["vendedor", "repartidor"]
        : userType === "negocio"
        ? ["cliente", "repartidor"]
        : ["cliente", "vendedor"]

    await db.chatMensaje.updateMany({
      where: {
        pedidoId,
        remitente: { in: otherRemitentes },
        leido: false,
      },
      data: { leido: true },
    })

    return NextResponse.json({
      mensajes,
      pedido: {
        id: pedido.id,
        negocioNombre: pedido.negocioNombre,
        negocioSlug: pedido.negocioSlug,
        clienteNombre: pedido.clienteNombre,
        estado: pedido.estado,
        total: pedido.total,
        metodoEntrega: pedido.metodoEntrega,
        metodoPago: pedido.metodoPago,
      },
    })
  } catch (error) {
    console.error("[Chat Mensajes GET] Error:", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

// POST /api/chat/mensajes/[pedidoId] — Send a message
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ pedidoId: string }> }
) {
  try {
    const { pedidoId } = await params
    const token = req.cookies.get("deligo_session")?.value
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const session = await validateSession(token)
    if (!session) {
      return NextResponse.json({ error: "Sesión inválida" }, { status: 401 })
    }

    const { userId, userType } = session

    // Verify access
    const { access: hasAccess, reason: accessReason } = await verifyChatAccess(userId, userType, pedidoId)
    if (!hasAccess) {
      return NextResponse.json({ error: accessReason || "Sin acceso a este chat" }, { status: 403 })
    }

    // Get the pedido to check if it's still active
    const pedido = await db.pedido.findUnique({
      where: { id: pedidoId },
      select: {
        id: true,
        estado: true,
        clienteId: true,
        negocioId: true,
        negocioNombre: true,
        clienteNombre: true,
        metodoEntrega: true,
      },
    })

    if (!pedido) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 })
    }

    if (pedido.estado === "entregado" || pedido.estado === "cancelado") {
      return NextResponse.json(
        { error: "No se puede chatear en un pedido finalizado" },
        { status: 400 }
      )
    }

    // Rate limit chat messages
    const ip = getClientIp(req)
    const rl = checkRateLimit("chat", `${ip}:${userId}`)
    if (!rl.allowed) {
      return rateLimitResponse(rl, "Estás enviando mensajes muy rápido. Esperá un momento.")
    }

    const body = await req.json()
    let { texto, imagenUrl, archivoUrl, archivoNombre, archivoTipo } = body as {
      texto?: string
      imagenUrl?: string
      archivoUrl?: string
      archivoNombre?: string
      archivoTipo?: string
    }

    if (!texto && !imagenUrl && !archivoUrl) {
      return NextResponse.json(
        { error: "El mensaje no puede estar vacío" },
        { status: 400 }
      )
    }

    // Validate file attachment fields
    if (archivoUrl) {
      // Validate archivoTipo (only allow PDF and common image formats)
      const ALLOWED_FILE_TYPES = [
        "application/pdf",
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/gif",
        "image/webp",
      ]
      if (archivoTipo && !ALLOWED_FILE_TYPES.includes(archivoTipo)) {
        return NextResponse.json(
          { error: "Tipo de archivo no permitido. Solo PDF e imágenes." },
          { status: 400 }
        )
      }

      // Rate limit uploads
      const uploadRl = checkRateLimit("upload", `${ip}:${userId}`)
      if (!uploadRl.allowed) {
        return rateLimitResponse(uploadRl, "Estás subiendo archivos muy rápido. Esperá un momento.")
      }

      // Ensure archivoNombre is provided with archivoUrl
      if (!archivoNombre) {
        archivoNombre = "archivo"
      }
      if (!archivoTipo) {
        archivoTipo = "application/octet-stream"
      }
    }

    // Sanitize and filter text
    let telefonoFiltrado = false
    if (texto) {
      texto = sanitizeHtml(texto)
      const filterResult = filterPhoneNumbers(texto)
      texto = filterResult.filtered
      telefonoFiltrado = filterResult.hadPhone
    }

    // Determine remitente
    const remitente = userType === "cliente" ? "cliente" : userType === "negocio" ? "vendedor" : "repartidor"

    // Create message
    const mensaje = await db.chatMensaje.create({
      data: {
        pedidoId,
        remitente,
        texto: texto || "",
        imagenUrl: imagenUrl || null,
        archivoUrl: archivoUrl || null,
        archivoNombre: archivoNombre || null,
        archivoTipo: archivoTipo || null,
        leido: false,
        fecha: new Date(),
        clienteId: userType === "cliente" ? userId : null,
      },
      select: {
        id: true,
        pedidoId: true,
        remitente: true,
        texto: true,
        imagenUrl: true,
        archivoUrl: true,
        archivoNombre: true,
        archivoTipo: true,
        leido: true,
        fecha: true,
        clienteId: true,
      },
    })

    // Note: Real-time broadcast is handled by the client via Socket.IO
    // After this API returns success, the client emits 'message-sent' event

    // Send push notification to the other party
    try {
      const senderName = userType === "cliente" ? pedido.clienteNombre : pedido.negocioNombre
      const messagePreview = texto
        ? texto.slice(0, 100)
        : archivoUrl
          ? `📄 ${archivoNombre || "Archivo"}`
          : "📷 Imagen"

      if (userType === "cliente" && pedido.negocioId) {
        // Client sent message → notify negocio
        const negocioData = await db.negocio.findUnique({
          where: { id: pedido.negocioId },
          select: { pushSubscription: true },
        })
        if (negocioData?.pushSubscription) {
          const notification = chatMessageNotification(pedidoId, senderName, messagePreview)
          await sendPushNotification(negocioData.pushSubscription, notification)
        }
      } else if (userType === "negocio" && pedido.clienteId) {
        // Negocio sent message → notify cliente
        const clienteData = await db.cliente.findUnique({
          where: { id: pedido.clienteId },
          select: { pushSubscription: true },
        })
        if (clienteData?.pushSubscription) {
          const notification = chatMessageNotification(pedidoId, senderName, messagePreview)
          await sendPushNotification(clienteData.pushSubscription, notification)
        }
      }

      // Repartidor chat notifications (both as sender and receiver)
      if (userType === "repartidor") {
        // Repartidor sent message → notify cliente and negocio
        if (pedido.clienteId) {
          const clienteData = await db.cliente.findUnique({
            where: { id: pedido.clienteId },
            select: { pushSubscription: true },
          })
          if (clienteData?.pushSubscription) {
            const notification = chatMessageNotification(pedidoId, `Repartidor`, messagePreview)
            await sendPushNotification(clienteData.pushSubscription, notification)
          }
        }
        if (pedido.negocioId) {
          const negocioData = await db.negocio.findUnique({
            where: { id: pedido.negocioId },
            select: { pushSubscription: true },
          })
          if (negocioData?.pushSubscription) {
            const notification = chatMessageNotification(pedidoId, `Repartidor`, messagePreview)
            await sendPushNotification(negocioData.pushSubscription, notification)
          }
        }
      } else if (pedido.metodoEntrega === "domicilio" && pedido.negocioId) {
        // If cliente or negocio sends a message on a delivery order → also notify repartidores
        const repartidores = await db.repartidorNegocio.findMany({
          where: { negocioId: pedido.negocioId },
          include: {
            repartidor: { select: { id: true, pushSubscription: true, activo: true } },
          },
        })
        const chatSenderName = userType === "cliente" ? pedido.clienteNombre : pedido.negocioNombre
        for (const rn of repartidores) {
          if (rn.repartidor.activo && rn.repartidor.pushSubscription && rn.repartidor.id !== userId) {
            await sendPushNotification(
              rn.repartidor.pushSubscription,
              chatMessageNotification(pedidoId, chatSenderName, messagePreview)
            )
          }
        }
      }
    } catch (pushError) {
      console.error("[Push] Failed to send chat notification:", pushError)
    }

    return NextResponse.json({
      ok: true,
      mensaje,
      telefonoFiltrado,
    })
  } catch (error) {
    console.error("[Chat Mensajes POST] Error:", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
