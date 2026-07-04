import { NextRequest, NextResponse } from "next/server"
import { OPERATIONAL_SESSION_COOKIE_NAME } from "@/lib/auth"
import { db } from "@/lib/db"
import { noStore, resolveOperativoAreaForSlug } from "@/lib/operativo-mozo"
import { validateChatImageUrl, validateChatPdfUrl } from "@/lib/resource-url"
import { resolveAdjuntoBytes } from "@/lib/chat-adjunto-stream"

// ============================================
// DeliGO Operaciones - PyR personal: adjunto de un mensaje (SOLO LECTURA, proxy autorizado)
// ============================================
// Identidad: EXCLUSIVAMENTE cuenta personal (deligo_operativo_session) via
// resolveOperativoAreaForSlug(..., "pyr"). Mismo alcance de pedido que
// GET /api/operativo/pyr/pedidos/[id]/mensajes: negocioId del contexto seguro,
// metodoEntrega != "mesa", estado dentro de ESTADOS_ACTIVOS_NO_MESA. El mensaje debe
// pertenecer a ESE pedido y ser de la conversacion cliente<->negocio (nunca "repartidor").
// Cualquier eslabon que falle (sesion, area, negocio, pedido, mensaje, adjunto) responde
// 404 generico - nunca revela cual eslabon fallo.
//
// Este endpoint NUNCA redirige ni devuelve la URL cruda de Cloudinary/almacenamiento local:
// revalida la URL almacenada con validateChatImageUrl/validateChatPdfUrl
// (src/lib/resource-url.ts, ya usado por el chat existente para validar adjuntos
// entrantes) y delega la lectura/fetch + Content-Type/Content-Disposition al helper
// compartido sin autorizacion src/lib/chat-adjunto-stream.ts (mismo usado por el proxy
// de Terminal Operativa PyR, para no duplicar esa logica sensible dos veces). No se
// modifico el sistema de subida/almacenamiento existente: este endpoint solo lee lo que
// ya esta guardado.

const ESTADOS_ACTIVOS_NO_MESA = ["recibido", "preparando", "en_camino", "listo_para_retirar"] as const

function notFound() {
  return noStore(NextResponse.json({ ok: false, error: "Adjunto no disponible" }, { status: 404 }))
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  try {
    const { id: pedidoId, messageId } = await params
    const slug = req.nextUrl.searchParams.get("slug")?.trim()
    if (!slug) return notFound()

    // 401/403 se devuelven como 404 genérico en este endpoint de adjunto: abrir un
    // adjunto no debe filtrar, ni siquiera por status code, si el problema fue de sesión,
    // área o del pedido puntual — todos son "no disponible" desde este endpoint. El GET de
    // listado (que sí distingue 401/403) es el que gobierna la navegación de la pantalla.
    const auth = await resolveOperativoAreaForSlug(req, slug, "pyr")
    if (!auth.ok) return notFound()

    const negocioId = auth.negocio.id

    const pedido = await db.pedido.findFirst({
      where: {
        id: pedidoId,
        negocioId,
        metodoEntrega: { not: "mesa" },
        estado: { in: [...ESTADOS_ACTIVOS_NO_MESA] },
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
    console.error("[OperativoPyR] Error loading adjunto:", error)
    return notFound()
  }
}
