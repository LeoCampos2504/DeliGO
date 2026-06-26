import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { validateSession } from "@/lib/auth"
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit"
import { createNotification, chatMessageNotification } from "@/lib/push"
import { validateChatImageUrl, validateChatPdfUrl } from "@/lib/resource-url"

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

function hasBodyValue(value: unknown): boolean {
  return value !== undefined && value !== null && !(typeof value === "string" && value.trim() === "")
}

function validateArchivoNombre(value: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (value === undefined || value === null || value === "") return { ok: true, value: "archivo" }
  if (typeof value !== "string") return { ok: false, error: "Nombre de archivo invalido" }

  const trimmed = value.trim()
  if (!trimmed) return { ok: true, value: "archivo" }
  if (/[/\\]/.test(trimmed) || /[\u0000-\u001f\u007f]/.test(trimmed)) {
    return { ok: false, error: "Nombre de archivo invalido" }
  }

  return { ok: true, value: trimmed.slice(0, 120) }
}

// Verify user has access to this pedido's chat
async function verifyChatAccess(
  userId: string,
  userType: string,
  pedidoId: string
): Promise<{ access: boolean; reason?: string }> {
  if (userType !== "cliente" && userType !== "negocio") {
    return { access: false, reason: "Sin acceso a este chat" }
  }

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
        ? ["vendedor"]
        : ["cliente"]

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

    const body = await req.json() as {
      texto?: string
      imagenUrl?: unknown
      archivoUrl?: unknown
      archivoNombre?: unknown
      archivoTipo?: unknown
    }
    let { texto } = body
    let imagenUrl: string | null = null
    let archivoUrl: string | null = null
    let archivoNombre: string | null = null
    let archivoTipo: string | null = null

    if (texto !== undefined && typeof texto !== "string") {
      return NextResponse.json({ error: "Texto invalido" }, { status: 400 })
    }

    const hasImagenUrl = hasBodyValue(body.imagenUrl)
    const hasArchivoUrl = hasBodyValue(body.archivoUrl)

    if (!texto && !hasImagenUrl && !hasArchivoUrl) {
      return NextResponse.json(
        { error: "El mensaje no puede estar vacío" },
        { status: 400 }
      )
    }

    if (hasImagenUrl && hasArchivoUrl) {
      return NextResponse.json({ error: "Solo se permite un adjunto por mensaje" }, { status: 400 })
    }

    if (hasImagenUrl) {
      const validImagenUrl = validateChatImageUrl(body.imagenUrl, pedidoId)
      if (!validImagenUrl.ok) return NextResponse.json({ error: validImagenUrl.error }, { status: 400 })
      imagenUrl = validImagenUrl.value
    }

    // Validate file attachment fields
    if (hasArchivoUrl) {
      if (body.archivoTipo !== "application/pdf") {
        return NextResponse.json(
          { error: "Tipo de archivo no permitido. Solo PDF." },
          { status: 400 }
        )
      }

      const validArchivoUrl = validateChatPdfUrl(body.archivoUrl, pedidoId)
      if (!validArchivoUrl.ok) return NextResponse.json({ error: validArchivoUrl.error }, { status: 400 })

      const validArchivoNombre = validateArchivoNombre(body.archivoNombre)
      if (!validArchivoNombre.ok) return NextResponse.json({ error: validArchivoNombre.error }, { status: 400 })

      // Rate limit uploads
      const uploadRl = checkRateLimit("upload", `${ip}:${userId}`)
      if (!uploadRl.allowed) {
        return rateLimitResponse(uploadRl, "Estás subiendo archivos muy rápido. Esperá un momento.")
      }

      archivoUrl = validArchivoUrl.value
      archivoNombre = validArchivoNombre.value
      archivoTipo = "application/pdf"
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
    const remitente = userType === "cliente" ? "cliente" : "vendedor"

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
        const chatPayload = chatMessageNotification(pedidoId, senderName, messagePreview)
        await createNotification({
          userId: pedido.negocioId,
          userType: "negocio",
          tipo: "chat",
          titulo: chatPayload.title,
          cuerpo: chatPayload.body,
          pedidoId,
          negocioId: pedido.negocioId,
          pushSubscription: negocioData?.pushSubscription ?? null,
          pushPayload: chatPayload,
          cleanupExpired: { model: "negocio", id: pedido.negocioId },
        })
      } else if (userType === "negocio" && pedido.clienteId) {
        // Negocio sent message → notify cliente
        const clienteData = await db.cliente.findUnique({
          where: { id: pedido.clienteId },
          select: { pushSubscription: true },
        })
        const chatPayload = chatMessageNotification(pedidoId, senderName, messagePreview)
        await createNotification({
          userId: pedido.clienteId,
          userType: "cliente",
          tipo: "chat",
          titulo: chatPayload.title,
          cuerpo: chatPayload.body,
          pedidoId,
          negocioId: pedido.negocioId,
          pushSubscription: clienteData?.pushSubscription ?? null,
          pushPayload: chatPayload,
          cleanupExpired: { model: "cliente", id: pedido.clienteId },
        })
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
