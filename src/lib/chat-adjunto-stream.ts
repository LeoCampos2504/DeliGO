import { readFile } from "fs/promises"
import { join } from "path"

// ============================================
// DeliGO - Streaming seguro de adjuntos de chat (sin autorizacion)
// ============================================
// Helper puro y pequeño, compartido entre el proxy personal PyR
// (src/app/api/operativo/pyr/pedidos/[id]/mensajes/[messageId]/adjunto/route.ts) y el
// proxy de Terminal Operativa PyR
// (src/app/api/operaciones/pyr/mensajes/[pedidoId]/[messageId]/adjunto/route.ts).
//
// Este modulo NO consulta la base de datos, NO valida sesiones, NO decide scopes ni
// areas, y NO acepta pedidoId/messageId crudos como autorizacion. Cada endpoint hace su
// propia autorizacion completa (personal: resolveOperativoAreaForSlug; Terminal:
// requireOperacionesScope) y su propia revalidacion de la URL almacenada con
// validateChatImageUrl/validateChatPdfUrl (src/lib/resource-url.ts) ANTES de llamar a
// este helper. Este helper solo recibe un recurso YA VALIDADO y devuelve bytes +
// headers seguros - nunca la URL cruda de storage.

export type AdjuntoKind = "imagen" | "pdf"

export interface AdjuntoRecurso {
  /** URL ya validada por validateChatImageUrl/validateChatPdfUrl. */
  url: string
  kind: AdjuntoKind
  /** Nombre de presentacion sugerido (nunca una ruta ni una URL). */
  nombreDescarga: string
}

export interface AdjuntoBytes {
  bytes: Uint8Array
  headers: {
    "Content-Type": string
    "Content-Disposition": string
    "X-Content-Type-Options": string
    "Cache-Control": string
  }
}

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  pdf: "application/pdf",
}

function extensionOf(pathname: string): string {
  const filename = pathname.split("/").filter(Boolean).pop() || ""
  return filename.includes(".") ? filename.split(".").pop()!.toLowerCase() : ""
}

function sanitizeDownloadName(name: string, extension: string): string {
  const base = name.replace(/[^a-zA-Z0-9 _.-]/g, "").trim().slice(0, 80) || "comprobante"
  return base.toLowerCase().endsWith(`.${extension}`) ? base : `${base}.${extension}`
}

// Lectura local: solo se invoca con una URL que ya pasó por
// validateLocalChatUploadUrl (dentro de validateChatImageUrl/validateChatPdfUrl),
// por lo que ya está acotada a uploads/chat/<pedidoId>/ con extensión permitida.
async function readLocalBytes(url: string): Promise<Buffer | null> {
  try {
    const absolutePath = join(process.cwd(), "public", url)
    return await readFile(absolutePath)
  } catch {
    return null
  }
}

// Fetch remoto (Cloudinary): nunca sigue redirecciones — un intermediario o una
// respuesta de redirección se descarta como si el adjunto no existiera.
async function fetchRemoteBytes(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { redirect: "error" })
    if (!res.ok) return null
    const arrayBuffer = await res.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch {
    return null
  }
}

/**
 * Resuelve los bytes y headers seguros de un adjunto ya validado. Devuelve `null` si
 * la extensión no está permitida o si la lectura/fetch falla — en ambos casos, el
 * endpoint llamante debe responder un error genérico (nunca revelar el motivo exacto).
 */
export async function resolveAdjuntoBytes(recurso: AdjuntoRecurso): Promise<AdjuntoBytes | null> {
  const extension = recurso.kind === "pdf"
    ? "pdf"
    : extensionOf(recurso.url.startsWith("/") ? recurso.url : new URL(recurso.url).pathname)
  const contentType = CONTENT_TYPE_BY_EXTENSION[extension]
  if (!contentType) return null

  const bytes = recurso.url.startsWith("/")
    ? await readLocalBytes(recurso.url)
    : await fetchRemoteBytes(recurso.url)
  if (!bytes) return null

  const filename = sanitizeDownloadName(recurso.nombreDescarga, extension)

  return {
    bytes: new Uint8Array(bytes),
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${filename}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  }
}
