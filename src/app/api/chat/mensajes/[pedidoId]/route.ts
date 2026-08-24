import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { validateSession } from "@/lib/auth"
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit"
import { createNotification, chatMessageNotification } from "@/lib/push"
import { validateChatImageUrl, validateChatPdfUrl } from "@/lib/resource-url"
import { sanitizeDeletedClientChatMessageForRead } from "@/lib/chat-attachment-deletion"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { publishRealtimeEvent } from "@/lib/realtime-publish"

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

type ChatAccessPedido = {
  id: string
  clienteId: string | null
  negocioId: string
  estado: string
  metodoEntrega: string
  chatRevision: number
}

// Verify user has access to this pedido's chat. Also returns the same
// Pedido read used for the access check — P2-T04 (MODEL_R) reuses its
// `chatRevision` field directly for GET's safety probe instead of a second,
// dedicated query (see SAFETY_UNCHANGED_TOUCHES_CHAT_MENSAJES=NO).
async function verifyChatAccess(
  userId: string,
  userType: string,
  pedidoId: string
): Promise<{ access: boolean; reason?: string; pedido: ChatAccessPedido | null }> {
  if (userType !== "cliente" && userType !== "negocio") {
    return { access: false, reason: "Sin acceso a este chat", pedido: null }
  }

  const pedido = await db.pedido.findUnique({
    where: { id: pedidoId },
    select: {
      id: true,
      clienteId: true,
      negocioId: true,
      estado: true,
      metodoEntrega: true,
      chatRevision: true,
    },
  })

  if (!pedido) return { access: false, reason: "Pedido no encontrado", pedido: null }

  // Mesa orders (invitados) don't have chat
  if (pedido.metodoEntrega === "mesa") {
    return { access: false, reason: "Los pedidos de mesa no tienen chat", pedido: null }
  }

  if (userType === "cliente") {
    return { access: pedido.clienteId === userId, pedido }
  } else if (userType === "negocio") {
    return { access: pedido.negocioId === userId, pedido }
  }

  return { access: false, pedido: null }
}

// P2-T04 MODEL_R: `knownRevision` is untrusted client input — never used as
// a cursor, a WHERE clause, or an authority of any kind, only ever compared
// by strict equality against the server-authoritative `chatRevision`. Only
// an exact non-negative integer within Postgres's `integer` (int4) range is
// "comparable" — anything else (missing, empty, NaN, decimal, negative,
// out-of-range) must fail closed to a FULL response, never to
// `unchanged: true`. A syntactically valid but merely stale/newer value
// (greater than current) is not rejected here — it simply will not match
// the equality check below and falls through to the same FULL path.
const POSTGRES_INT4_MAX = 2_147_483_647

function parseKnownRevision(raw: string | null): number | null {
  if (raw === null) return null
  if (!/^\d+$/.test(raw)) return null
  const parsed = Number(raw)
  if (!Number.isSafeInteger(parsed)) return null
  if (parsed < 0 || parsed > POSTGRES_INT4_MAX) return null
  return parsed
}

const CHAT_MENSAJE_INFO_SELECT = {
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
} as const

async function loadFullPedidoInfo(pedidoId: string) {
  return db.pedido.findUnique({
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

    // Verify access — this single Pedido read also carries the
    // server-authoritative chatRevision (P2-T04 MODEL_R): no extra query is
    // issued just to read it.
    const { access, reason, pedido: accessPedido } = await verifyChatAccess(userId, userType, pedidoId)
    if (!access || !accessPedido) {
      return NextResponse.json({ error: reason || "Sin acceso a este chat" }, { status: 403 })
    }

    // P2-T04 MODEL_R: explicit `mode=safety` is the ONLY safety signal —
    // exact match, never inferred from the mere presence of knownRevision.
    // Any other request (including one with no `mode` param at all — old
    // clients, or ChatView's own semantic triggers) is SEMANTIC and always
    // gets the full authoritative snapshot below.
    const isSafetyRequest = req.nextUrl.searchParams.get("mode") === "safety"
    // Captured HERE — from the access-check read, before any history SELECT
    // and before any mark-read mutation — so it can only ever UNDERSTATE the
    // coverage of the snapshot this response ends up returning (safe: causes
    // one redundant future full fetch), never OVERSTATE it (which could hide
    // a real mutation behind a false `unchanged: true`).
    const responseCoverageRevision = accessPedido.chatRevision

    if (isSafetyRequest) {
      const knownRevision = parseKnownRevision(req.nextUrl.searchParams.get("knownRevision"))
      if (knownRevision !== null && knownRevision === responseCoverageRevision) {
        // Equality fast path: zero ChatMensaje queries, zero mark-read,
        // zero realtime, zero additional Pedido read.
        return NextResponse.json({
          unchanged: true,
          historyRevision: responseCoverageRevision,
          mensajes: [],
        })
      }

      // Mismatch, or knownRevision missing/invalid/incomparable — fail-safe
      // to a FULL authoritative snapshot. Never mark-read on a safety path.
      const pedidoInfo = await loadFullPedidoInfo(pedidoId)
      if (!pedidoInfo) {
        return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 })
      }
      const mensajesRaw = await db.chatMensaje.findMany({
        where: { pedidoId },
        orderBy: { fecha: "asc" },
        select: CHAT_MENSAJE_INFO_SELECT,
      })
      const mensajes = mensajesRaw.map(sanitizeDeletedClientChatMessageForRead)

      return NextResponse.json({
        unchanged: false,
        historyRevision: responseCoverageRevision,
        mensajes,
        pedido: {
          id: pedidoInfo.id,
          negocioNombre: pedidoInfo.negocioNombre,
          negocioSlug: pedidoInfo.negocioSlug,
          clienteNombre: pedidoInfo.clienteNombre,
          estado: pedidoInfo.estado,
          total: pedidoInfo.total,
          metodoEntrega: pedidoInfo.metodoEntrega,
          metodoPago: pedidoInfo.metodoPago,
        },
      })
    }

    // Semantic — always full, unconditionally (mount, coverage-token,
    // online, room-rejoin post-coverage, local foreground, and every old
    // client that never sends `mode=safety` at all).
    const pedidoInfo = await loadFullPedidoInfo(pedidoId)
    if (!pedidoInfo) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 })
    }

    const mensajesRaw = await db.chatMensaje.findMany({
      where: { pedidoId },
      orderBy: { fecha: "asc" },
      select: CHAT_MENSAJE_INFO_SELECT,
    })
    // Defensa en profundidad (19-B0.2D1): enmascara cualquier mensaje de
    // Cliente ya eliminado que aún conserve contenido sin sanitizar (p. ej.
    // cuentas eliminadas antes de que esta sanitización existiera).
    const mensajes = mensajesRaw.map(sanitizeDeletedClientChatMessageForRead)

    // Mark messages from other parties as read — semantic only, never on a
    // safety path. P2-T04: atomic with the chatRevision bump, and ONLY
    // bumped when something actually changed (updateMany.count > 0) — a
    // no-op mark-read (nothing was unread) must never advance the revision.
    const otherRemitentes =
      userType === "cliente"
        ? ["vendedor"]
        : ["cliente"]

    await db.$transaction(async (tx) => {
      const markReadResult = await tx.chatMensaje.updateMany({
        where: {
          pedidoId,
          remitente: { in: otherRemitentes },
          leido: false,
        },
        data: { leido: true },
      })
      if (markReadResult.count > 0) {
        await tx.pedido.update({
          where: { id: pedidoId },
          data: { chatRevision: { increment: 1 } },
        })
      }
    })

    return NextResponse.json({
      mensajes,
      historyRevision: responseCoverageRevision,
      pedido: {
        id: pedidoInfo.id,
        negocioNombre: pedidoInfo.negocioNombre,
        negocioSlug: pedidoInfo.negocioSlug,
        clienteNombre: pedidoInfo.clienteNombre,
        estado: pedidoInfo.estado,
        total: pedidoInfo.total,
        metodoEntrega: pedidoInfo.metodoEntrega,
        metodoPago: pedidoInfo.metodoPago,
      },
    })
  } catch (error) {
    console.error("[Chat Mensajes GET] Error:", safeErrorForLog(error))
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

    // Create message + bump chatRevision atomically (P2-T04 MODEL_R,
    // R-MUT-01): if the create fails, the revision never advances; if the
    // increment fails, the message never persists — same transaction, same
    // commit. Never added to the realtime payload (see
    // CHAT_REALTIME_REVISION_PAYLOAD_CHANGED=NO) — publish/push below are
    // unchanged and still run strictly after this commits.
    const mensaje = await db.$transaction(async (tx) => {
      const created = await tx.chatMensaje.create({
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
      await tx.pedido.update({
        where: { id: pedidoId },
        data: { chatRevision: { increment: 1 } },
      })
      return created
    })

    // Server-authoritative realtime broadcast: the message is already
    // persisted at this point, so a publish failure/timeout never turns an
    // already-successful send into an HTTP error (see publishRealtimeEvent's
    // typed, non-throwing result — its outcome is intentionally not
    // inspected below). The legacy `message-sent` relay in the Chat service
    // remains untouched as a fallback for stale PWAs/tabs still running the
    // browser-producer code path; both paths share the same dedupe key
    // (`chat.message.created:<mensaje.id>`), so at most one delivers.
    await publishRealtimeEvent({
      version: 1,
      type: "chat.message.created",
      eventId: mensaje.id,
      resourceId: pedidoId,
      occurredAt: mensaje.fecha.toISOString(),
      payload: { ...mensaje, remitente, fecha: mensaje.fecha.toISOString() },
    })

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
        const chatPayload = chatMessageNotification(pedidoId, senderName, messagePreview, mensaje.id)
        await createNotification({
          userId: pedido.negocioId,
          userType: "negocio",
          tipo: "chat",
          titulo: chatPayload.title,
          cuerpo: chatPayload.body,
          pedidoId,
          negocioId: pedido.negocioId,
          // 19-B0.2E1: título/cuerpo embeben el nombre del Cliente y un
          // fragmento real de su mensaje — pedido.clienteId es el emisor real
          // (userType === "cliente" en esta rama).
          sourceClienteId: pedido.clienteId,
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
        const chatPayload = chatMessageNotification(pedidoId, senderName, messagePreview, mensaje.id)
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
      console.error("[Push] Failed to send chat notification:", safeErrorForLog(pushError))
    }

    return NextResponse.json({
      ok: true,
      mensaje,
      telefonoFiltrado,
    })
  } catch (error) {
    console.error("[Chat Mensajes POST] Error:", safeErrorForLog(error))
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
