import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireOperacionesScope } from "@/lib/operaciones-terminal-access"
import { validateChatImageUrl, validateChatPdfUrl } from "@/lib/resource-url"
import { resolveAdjuntoBytes } from "@/lib/chat-adjunto-stream"

// ============================================
// DeliGO Operaciones - Terminal PyR: adjunto de un mensaje (SOLO LECTURA, proxy autorizado)
// ============================================
// Identidad: EXCLUSIVAMENTE sesion de Terminal Operativa
// (requireOperacionesScope(req, "pyr.mensajes.ver")) - mismo modelo de seguridad exacto
// que GET /api/operaciones/pyr/mensajes/[pedidoId]. Nunca usa cookie/sesion/scopes del
// panel personal PyR (resolveOperativoAreaForSlug queda fuera de este archivo). El
// negocio SIEMPRE sale de auth.context.negocio.id; nunca del pedidoId, messageId, query
// param o body. Mismo alcance de pedido que el listado de mensajes de Terminal:
// negocio autorizado, no-mesa, estado dentro de ESTADOS_ACTIVOS. El mensaje debe
// pertenecer a ESE pedido y ser de la conversacion cliente<->vendedor (nunca
// "repartidor"). Cualquier eslabon que falle responde un error generico seguro, sin
// revelar cual eslabon fallo.
//
// Este endpoint NUNCA redirige ni devuelve la URL cruda de Cloudinary/almacenamiento
// local: revalida la URL almacenada con validateChatImageUrl/validateChatPdfUrl
// (src/lib/resource-url.ts) y delega la lectura/fetch + Content-Type/Content-Disposition
// al helper compartido sin autorizacion src/lib/chat-adjunto-stream.ts (mismo usado por
// el proxy personal PyR, para no duplicar esa logica sensible dos veces). No mezcla
// cookies, scopes ni endpoints entre personal y Terminal.

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" } as const

// Mismo conjunto de estados activos que GET /api/operaciones/pyr/mensajes/[pedidoId].
const ESTADOS_ACTIVOS = ["recibido", "preparando", "en_camino", "listo_para_retirar"] as const

function notFound() {
  return NextResponse.json(
    { ok: false, error: "Adjunto no disponible" },
    { status: 404, headers: NO_STORE_HEADERS }
  )
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ pedidoId: string; messageId: string }> }
) {
  try {
    // 401 sin sesión válida de terminal · 403 sin scope `pyr.mensajes.ver`.
    const auth = await requireOperacionesScope(req, "pyr.mensajes.ver")
    if (!auth.ok) return notFound()
    const negocioId = auth.context.negocio.id

    const { pedidoId, messageId } = await params

    const pedido = await db.pedido.findFirst({
      where: {
        id: pedidoId,
        negocioId,
        metodoEntrega: { not: "mesa" },
        estado: { in: [...ESTADOS_ACTIVOS] },
      },
      select: { id: true },
    })
    if (!pedido) return notFound()

    const mensaje = await db.chatMensaje.findFirst({
      where: { id: messageId, pedidoId, remitente: { in: ["cliente", "vendedor"] } },
      select: { imagenUrl: true, archivoUrl: true, archivoNombre: true, archivoTipo: true },
    })
    if (!mensaje) return notFound()

    let storedUrl: string
    let kind: "imagen" | "pdf"
    if (mensaje.imagenUrl) {
      const valid = validateChatImageUrl(mensaje.imagenUrl, pedidoId)
      if (!valid.ok) return notFound()
      storedUrl = valid.value
      kind = "imagen"
    } else if (mensaje.archivoUrl && mensaje.archivoTipo === "application/pdf") {
      const valid = validateChatPdfUrl(mensaje.archivoUrl, pedidoId)
      if (!valid.ok) return notFound()
      storedUrl = valid.value
      kind = "pdf"
    } else {
      // Sin adjunto, o tipo de archivo no reconocido como permitido (defensivo): no se
      // renderiza inline ningun tipo desconocido.
      return notFound()
    }

    const resource = await resolveAdjuntoBytes({
      url: storedUrl,
      kind,
      nombreDescarga: kind === "pdf" ? mensaje.archivoNombre || "comprobante" : "imagen",
    })
    if (!resource) return notFound()

    return new NextResponse(new Uint8Array(resource.bytes), { status: 200, headers: resource.headers })
  } catch (error) {
    console.error("[OperacionesPyR] Error loading adjunto:", error)
    return notFound()
  }
}
