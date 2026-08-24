import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireOperacionesScope } from "@/lib/operaciones-terminal-access"
import { createNotification, chatMessageNotification } from "@/lib/push"
import { checkRateLimit } from "@/lib/rate-limit"
import { validateChatImageUrl, validateChatPdfUrl } from "@/lib/resource-url"
import { uploadImage, uploadFile } from "@/lib/cloudinary"
import { writeFile, mkdir } from "fs/promises"
import { existsSync } from "fs"
import { join } from "path"

// ============================================
// Bugfix-4 [16]: adjuntar PDF/imagen al chat de un pedido PyR desde
// DeliGO Operaciones (Terminal). Antes el POST de texto
// (`.../mensajes/[pedidoId]/route.ts`) solo aceptaba `{ texto }` — no había
// forma de mandar un comprobante desde una terminal operativa.
//
// Reutiliza exactamente las mismas piezas de seguridad que ya existen para
// el chat cliente↔negocio (`/api/upload`, `/api/chat/mensajes/[pedidoId]`):
//   - Mismo allowlist de MIME + firma real de archivo (magic bytes).
//   - Mismos límites de tamaño.
//   - Misma tabla ChatMensaje y mismas columnas (imagenUrl/archivoUrl/...).
//   - Misma revalidación de URL por pedidoId (validateChatImageUrl/PdfUrl)
//     antes de guardar, aunque la URL se generó en este mismo request.
//   - Mismo lock transaccional que el POST de texto para no crear el mensaje
//     si el pedido dejó de estar activo justo antes de guardar.
// ============================================

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" }
const UNAVAILABLE_MESSAGE = "Este pedido ya no está disponible para mensajes. Volvé a Pedidos y reseñas."
const ESTADOS_ACTIVOS = ["recibido", "preparando", "en_camino", "listo_para_retirar"] as const
const MAX_TEXTO_LEN = 2000
const MAX_CHAT_IMAGE_SIZE = 10 * 1024 * 1024 // 10MB, igual que /api/upload
const MAX_CHAT_FILE_SIZE = 5 * 1024 * 1024 // 5MB, igual que /api/upload

const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"])
const ALLOWED_FILE_TYPES = new Set(["application/pdf"])

const PHONE_PATTERN =
  /(?:(?:\+?54|0)?(?:11|[2-9]\d{2,4})[\s\-]?\d{4,}[\s\-]?\d{0,4})|(?:whatsapp\.com|wa\.me|\/send\?phone)/gi

function sanitizeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
}

function filterPhoneNumbers(text: string): string {
  return text.replace(PHONE_PATTERN, "[***]")
}

function badRequest(error = "Solicitud inválida") {
  return NextResponse.json({ ok: false, error }, { status: 400, headers: NO_STORE_HEADERS })
}

function conflict() {
  return NextResponse.json({ ok: false, error: UNAVAILABLE_MESSAGE }, { status: 409, headers: NO_STORE_HEADERS })
}

function tooManyRequests() {
  return NextResponse.json(
    { ok: false, error: "Demasiados intentos. Esperá un momento antes de volver a intentar." },
    { status: 429, headers: NO_STORE_HEADERS }
  )
}

async function readHeader(file: File): Promise<Uint8Array> {
  const buffer = await file.slice(0, 16).arrayBuffer()
  return new Uint8Array(buffer)
}

function hasPngSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
}

function hasJpegSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
}

function hasWebpSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
}

function hasPdfSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 5 &&
    bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d
}

async function hasAllowedSignature(file: File, kind: "imagen" | "pdf"): Promise<boolean> {
  const bytes = await readHeader(file)
  if (kind === "pdf") return hasPdfSignature(bytes)
  if (file.type === "image/png") return hasPngSignature(bytes)
  if (file.type === "image/jpeg") return hasJpegSignature(bytes)
  if (file.type === "image/webp") return hasWebpSignature(bytes)
  return false
}

// Fallback local: mismo layout exacto que /api/upload (uploadToLocal) y que
// exige validateLocalChatUploadUrl: /uploads/chat/<pedidoId>/<archivo>.
async function uploadToLocal(file: File, pedidoId: string, ext: string): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer())
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  const filename = `${timestamp}_${random}.${ext}`
  const relativePath = `uploads/chat/${pedidoId}`
  const absolutePath = join(process.cwd(), "public", relativePath)
  if (!existsSync(absolutePath)) {
    await mkdir(absolutePath, { recursive: true })
  }
  await writeFile(join(absolutePath, filename), buffer)
  return `/${relativePath}/${filename}`
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ pedidoId: string }> }
) {
  try {
    const auth = await requireOperacionesScope(req, "pyr.mensajes.responder")
    if (!auth.ok) return auth.response
    const ctx = auth.context
    const negocioId = ctx.negocio.id

    const { pedidoId } = await params

    // Chequeo temprano (sin lock) para no gastar una subida entera en un
    // pedido obviamente ajeno/inactivo. La verificación real y atómica
    // ocurre después de subir el archivo, justo antes de crear el mensaje.
    const pedidoPrevio = await db.pedido.findFirst({
      where: { id: pedidoId, negocioId, metodoEntrega: { not: "mesa" }, estado: { in: [...ESTADOS_ACTIVOS] } },
      select: { id: true },
    })
    if (!pedidoPrevio) return conflict()

    const rl = checkRateLimit("upload", `${ctx.terminal.id}:${pedidoId}`)
    if (!rl.allowed) return tooManyRequests()

    const formData = await req.formData().catch(() => null)
    if (!formData) return badRequest()

    const file = formData.get("file")
    if (!(file instanceof File) || file.size <= 0) {
      return badRequest("Archivo requerido")
    }

    const rawTexto = formData.get("texto")
    let texto = ""
    if (typeof rawTexto === "string" && rawTexto.trim()) {
      if (rawTexto.length > MAX_TEXTO_LEN) return badRequest("El mensaje es demasiado largo")
      texto = filterPhoneNumbers(sanitizeHtml(rawTexto.trim()))
    }

    const isImage = ALLOWED_IMAGE_TYPES.has(file.type)
    const isPdf = ALLOWED_FILE_TYPES.has(file.type)
    if (!isImage && !isPdf) {
      return badRequest("Tipo de archivo no permitido. Solo imágenes (PNG, JPG, WEBP) o PDF.")
    }

    const maxSize = isPdf ? MAX_CHAT_FILE_SIZE : MAX_CHAT_IMAGE_SIZE
    if (file.size > maxSize) {
      return NextResponse.json(
        { ok: false, error: `El archivo es muy grande. Máximo ${Math.round(maxSize / (1024 * 1024))}MB.` },
        { status: 413, headers: NO_STORE_HEADERS }
      )
    }

    if (!(await hasAllowedSignature(file, isPdf ? "pdf" : "imagen"))) {
      return badRequest("Contenido de archivo inválido")
    }

    // Subida (Cloudinary si está configurado, si no fallback local controlado).
    let rawUrl: string | null = null
    const cloudinaryConfigured =
      !!process.env.CLOUDINARY_CLOUD_NAME && !!process.env.CLOUDINARY_API_KEY && !!process.env.CLOUDINARY_API_SECRET
    if (cloudinaryConfigured) {
      const folder = `chat/${pedidoId}`
      const result = isPdf
        ? await uploadFile(file, folder, "comprobante.pdf")
        : await uploadImage(file, folder)
      rawUrl = result?.url ?? null
    }
    if (!rawUrl) {
      const ext = isPdf ? "pdf" : file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg"
      rawUrl = await uploadToLocal(file, pedidoId, ext).catch(() => null)
    }
    if (!rawUrl) {
      return NextResponse.json({ ok: false, error: "No se pudo subir el archivo" }, { status: 500, headers: NO_STORE_HEADERS })
    }

    // Revalidación defensiva de la URL recién generada (misma regla que usa
    // el chat cliente↔negocio para cualquier adjunto antes de persistirlo).
    const validated = isPdf ? validateChatPdfUrl(rawUrl, pedidoId) : validateChatImageUrl(rawUrl, pedidoId)
    if (!validated.ok) {
      return NextResponse.json({ ok: false, error: "No se pudo procesar el archivo" }, { status: 500, headers: NO_STORE_HEADERS })
    }

    // Mismo lock transaccional que el POST de texto: crea el mensaje solo si
    // el pedido sigue activo justo en este instante.
    const created = await db.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ clienteId: string | null; negocioNombre: string }>>`
        SELECT "clienteId", "negocioNombre"
        FROM "pedidos"
        WHERE "id" = ${pedidoId}
          AND "negocioId" = ${negocioId}
          AND "metodoEntrega" <> 'mesa'
          AND "estado" IN ('recibido', 'preparando', 'en_camino', 'listo_para_retirar')
        FOR UPDATE
      `
      if (locked.length === 0) return null

      const mensaje = await tx.chatMensaje.create({
        data: {
          pedidoId,
          remitente: "vendedor",
          texto,
          imagenUrl: isPdf ? null : validated.value,
          archivoUrl: isPdf ? validated.value : null,
          archivoNombre: isPdf ? "Comprobante" : null,
          archivoTipo: isPdf ? "application/pdf" : null,
          leido: false,
          fecha: new Date(),
          clienteId: null,
        },
        select: { id: true },
      })
      // P2-T04 Stage 3B (R-MUT-06): mismo lock/transacción que ya crea el mensaje — si el
      // create falla, el bump nunca corre; si el bump fallara, Postgres revierte el create
      // también (misma transacción).
      await tx.pedido.update({
        where: { id: pedidoId },
        data: { chatRevision: { increment: 1 } },
      })
      return { mensajeId: mensaje.id, clienteId: locked[0].clienteId, negocioNombre: locked[0].negocioNombre }
    })

    if (!created) return conflict()

    if (created.clienteId) {
      try {
        const cliente = await db.cliente.findUnique({
          where: { id: created.clienteId },
          select: { pushSubscription: true },
        })
        const preview = texto || (isPdf ? "📄 Comprobante" : "📷 Imagen")
        const payload = chatMessageNotification(pedidoId, created.negocioNombre, preview)
        await createNotification({
          userId: created.clienteId,
          userType: "cliente",
          tipo: "chat",
          titulo: payload.title,
          cuerpo: payload.body,
          pedidoId,
          negocioId,
          pushSubscription: cliente?.pushSubscription ?? null,
          pushPayload: payload,
          cleanupExpired: { model: "cliente", id: created.clienteId },
        })
      } catch {
        console.error("[OperacionesPyR] Falló una notificación de adjunto")
      }
    }

    return NextResponse.json({ ok: true, mensaje: { id: created.mensajeId } }, { headers: NO_STORE_HEADERS })
  } catch {
    console.error("[OperacionesPyR] Falló el envío de adjunto")
    return NextResponse.json({ ok: false, error: "Error del servidor" }, { status: 500, headers: NO_STORE_HEADERS })
  }
}
