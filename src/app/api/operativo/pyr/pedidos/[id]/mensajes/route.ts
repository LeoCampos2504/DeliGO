import { NextRequest, NextResponse } from "next/server"
import { OPERATIONAL_SESSION_COOKIE_NAME } from "@/lib/auth"
import { db } from "@/lib/db"
import { noStore, resolveOperativoAreaForSlug } from "@/lib/operativo-mozo"
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit"
import { createNotification, chatMessageNotification } from "@/lib/push"

// ============================================
// DeliGO Operaciones - PyR personal: mensajes de un pedido activo
// ============================================
// Identidad: EXCLUSIVAMENTE cuenta personal (deligo_operativo_session) via
// resolveOperativoAreaForSlug(..., "pyr"). No usa cookie/APIs/scopes de terminal
// (requireOperacionesScope/hasTerminalScope quedan fuera). Con slug como query param
// tecnico, mismo patron que el resto de los endpoints personales de PyR. El negocio se
// deriva SIEMPRE del contexto seguro (auth.negocio.id); el slug/id nunca autorizan por si
// solos. Alcance de pedido IDENTICO al listado (GET /api/operativo/pyr/pedidos): mismo
// negocioId, metodoEntrega != "mesa", mismo conjunto de estados activos. Un pedido fuera de
// ese alcance responde 404 generico (no revela si existe en otro negocio, es de mesa o ya
// esta finalizado).
//
// GET: solo lectura de la conversacion cliente<->negocio (nunca "repartidor"), orden
// estable ascendente (fecha, id), limite fijo de mensajes devueltos. Los adjuntos se
// exponen SOLO como metadata (disponible/tipo/nombre); la URL cruda de storage nunca se
// devuelve - ver route.ts de mensajes/[messageId]/adjunto para el acceso autorizado.
//
// POST: unica mutacion permitida, mensaje de texto plano del personal PyR hacia el
// cliente (remitente "vendedor", igual que ya usa el negocio de cuenta completa y la
// Terminal Operativa - no es un valor nuevo de negocio). Reutiliza EXACTAMENTE, sin
// reimplementar: el rate limit "chat" existente (src/lib/rate-limit.ts), la notificacion
// push existente al cliente (chatMessageNotification/createNotification de src/lib/push.ts)
// y las mismas reglas de saneamiento de texto plano (escape HTML + filtro de telefonos) ya
// usadas por el chat de cuenta completa y por la Terminal Operativa PyR - duplicadas aqui
// localmente porque son funciones privadas de esos modulos, no exportadas, siguiendo la
// misma convencion ya usada en este proyecto (ver src/app/api/chat/mensajes/[pedidoId]/route.ts
// y src/app/api/operaciones/pyr/mensajes/[pedidoId]/route.ts). Sin actualizacion optimista:
// la transicion de estado del pedido se revalida ATOMICAMENTE (SELECT ... FOR UPDATE) en la
// misma transaccion que crea el mensaje, igual que ya hace la Terminal Operativa, para que
// un pedido que se finaliza entre la lectura y la escritura no permita crear un mensaje.

// Mismos estados activos no-mesa que GET /api/operativo/pyr/pedidos.
const ESTADOS_ACTIVOS_NO_MESA = ["recibido", "preparando", "en_camino", "listo_para_retirar"] as const

// Limite fijo y seguro de mensajes devueltos (sin paginacion de cliente en esta etapa).
// Mismo valor que ya usa la Terminal Operativa PyR para esta misma conversacion.
const MENSAJES_LIMIT = 200

// El chat de cuenta completa (cliente/negocio) no define un maximo real de longitud; la
// Terminal Operativa PyR introdujo este tope seguro para esta misma conversacion. Se
// reutiliza el mismo valor para el personal PyR, por ser la misma conversacion.
const MAX_TEXTO_LEN = 2000

// Mismas reglas de texto plano que el chat existente (escape HTML + filtro de telefonos
// argentinos), replicadas localmente porque son funciones privadas de esos modulos.
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

function badRequest(error = "Solicitud invalida") {
  return noStore(NextResponse.json({ ok: false, error }, { status: 400 }))
}

function notFound() {
  return noStore(NextResponse.json({ ok: false, error: "Pedido no disponible" }, { status: 404 }))
}

// Deriva el tipo de adjunto SOLO desde los campos ya almacenados (nunca desde el cliente).
// "nombre" es un texto de presentacion, nunca una ruta ni una URL.
function toAdjuntoDTO(m: {
  imagenUrl: string | null
  archivoUrl: string | null
  archivoNombre: string | null
  archivoTipo: string | null
}): { disponible: true; tipo: "imagen" | "pdf" | "archivo"; nombre: string } | null {
  if (m.imagenUrl) {
    return { disponible: true, tipo: "imagen", nombre: "Imagen" }
  }
  if (m.archivoUrl) {
    const esPdf = m.archivoTipo === "application/pdf"
    return {
      disponible: true,
      tipo: esPdf ? "pdf" : "archivo",
      nombre: m.archivoNombre || "Comprobante",
    }
  }
  return null
}

// GET - Lee la conversacion de un pedido PyR activo no-mesa (solo lectura).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: pedidoId } = await params
    const slug = req.nextUrl.searchParams.get("slug")?.trim()
    if (!slug) return badRequest("Slug requerido")

    // 401 sin sesion - 403 area_no_habilitada (area efectiva != pyr) - 403 acceso_no_disponible.
    const auth = await resolveOperativoAreaForSlug(req, slug, "pyr")
    if (!auth.ok) {
      const response = NextResponse.json(
        {
          ok: false,
          estado: auth.state,
          error: auth.status === 401 ? "No autenticado" : "Acceso no disponible",
        },
        { status: auth.status }
      )
      if (auth.clearSession) {
        response.cookies.delete(OPERATIONAL_SESSION_COOKIE_NAME)
      }
      return noStore(response)
    }

    const negocioId = auth.negocio.id

    // Mismo alcance exacto que el listado de pedidos activos: fuera de ese alcance, 404
    // generico sin distinguir motivo (otro negocio, de mesa, o ya no activo).
    const pedido = await db.pedido.findFirst({
      where: {
        id: pedidoId,
        negocioId,
        metodoEntrega: { not: "mesa" },
        estado: { in: [...ESTADOS_ACTIVOS_NO_MESA] },
      },
      select: { id: true, estado: true, metodoEntrega: true, clienteNombre: true },
    })
    if (!pedido) return notFound()

    // Conversacion cliente<->negocio unicamente (nunca "repartidor"). Se traen los mas
    // recientes (orden desc + limite) y se revierte a ascendente para mostrar - mismo
    // patron ya usado por la Terminal Operativa PyR para esta misma conversacion.
    const rows = await db.chatMensaje.findMany({
      where: { pedidoId, remitente: { in: ["cliente", "vendedor"] } },
      orderBy: [{ fecha: "desc" }, { id: "desc" }],
      take: MENSAJES_LIMIT,
      select: {
        id: true,
        remitente: true,
        texto: true,
        imagenUrl: true,
        archivoUrl: true,
        archivoNombre: true,
        archivoTipo: true,
        fecha: true,
        leido: true,
      },
    })
    const mensajes = rows.reverse().map((m) => ({
      id: m.id,
      emisor: (m.remitente === "cliente" ? "cliente" : "negocio") as "cliente" | "negocio",
      contenido: m.texto ? m.texto : null,
      fecha: m.fecha,
      adjunto: toAdjuntoDTO(m),
    }))

    // Marcar como leidos SOLO los mensajes de cliente realmente devueltos (best-effort; un
    // fallo no impide mostrar la conversacion).
    const clienteMsgIds = rows.filter((m) => m.remitente === "cliente" && !m.leido).map((m) => m.id)
    if (clienteMsgIds.length > 0) {
      try {
        await db.chatMensaje.updateMany({
          where: { id: { in: clienteMsgIds }, pedidoId, remitente: "cliente", leido: false },
          data: { leido: true },
        })
      } catch {
        console.error("[OperativoPyR] Fallo al marcar mensajes como leidos")
      }
    }

    return noStore(
      NextResponse.json({
        ok: true,
        pedido: {
          id: pedido.id,
          estado: pedido.estado,
          metodoEntrega: pedido.metodoEntrega,
          clienteNombre: pedido.clienteNombre,
        },
        mensajes,
      })
    )
  } catch (error) {
    console.error("[OperativoPyR] Error loading mensajes:", error)
    return noStore(NextResponse.json({ ok: false, error: "Error del servidor" }, { status: 500 }))
  }
}

// POST - Envia un mensaje de texto como negocio en un pedido PyR activo no-mesa. Unica
// mutacion permitida en este archivo: no hay envio de archivos por parte del personal.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: pedidoId } = await params
    const slug = req.nextUrl.searchParams.get("slug")?.trim()
    if (!slug) return badRequest("Slug requerido")

    const auth = await resolveOperativoAreaForSlug(req, slug, "pyr")
    if (!auth.ok) {
      const response = NextResponse.json(
        {
          ok: false,
          estado: auth.state,
          error: auth.status === 401 ? "No autenticado" : "Acceso no disponible",
        },
        { status: auth.status }
      )
      if (auth.clearSession) {
        response.cookies.delete(OPERATIONAL_SESSION_COOKIE_NAME)
      }
      return noStore(response)
    }

    const negocioId = auth.negocio.id

    // Body estricto: solo { mensaje: string }. Cualquier clave extra -> 400. El emisor
    // nunca se acepta del cliente: el servidor siempre crea el mensaje como "vendedor".
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object" || Array.isArray(body)) return badRequest()
    const ALLOWED_KEYS = new Set(["mensaje"])
    if (Object.keys(body as Record<string, unknown>).some((key) => !ALLOWED_KEYS.has(key))) {
      return badRequest()
    }
    const rawMensaje = (body as Record<string, unknown>).mensaje
    if (typeof rawMensaje !== "string") return badRequest()
    const trimmed = rawMensaje.trim()
    if (!trimmed) return badRequest("El mensaje no puede estar vacio")
    if (trimmed.length > MAX_TEXTO_LEN) return badRequest("El mensaje es demasiado largo")

    const texto = filterPhoneNumbers(sanitizeHtml(trimmed))
    if (!texto) return badRequest("El mensaje no puede estar vacio")

    // Rate limit reutilizando el tipo existente "chat" (30/min), clave por cuenta personal
    // + pedido (equivalente a la clave por terminal + pedido que ya usa la Terminal
    // Operativa para esta misma conversacion).
    const rl = checkRateLimit("chat", `${auth.cuenta.id}:${pedidoId}`)
    if (!rl.allowed) {
      return noStore(rateLimitResponse(rl, "Estas enviando mensajes muy rapido. Espera un momento."))
    }

    // Creacion ATOMICA respecto del estado del pedido (mismo patron que la Terminal
    // Operativa PyR): se bloquea la fila del pedido con SELECT ... FOR UPDATE acotada a
    // negocio + no-mesa + estado activo, y el mensaje se crea dentro de la MISMA
    // transaccion. pedidoId/negocioId van parametrizados (tagged template); los
    // estados/'mesa' son literales fijos del codigo, nunca datos del cliente.
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
          leido: false,
          fecha: new Date(),
          clienteId: null,
        },
        select: { id: true },
      })
      return { mensajeId: mensaje.id, clienteId: locked[0].clienteId, negocioNombre: locked[0].negocioNombre }
    })

    // Pedido inexistente / ajeno / de mesa / ya finalizado en el momento del bloqueo -> 404
    // generico, sin distinguir motivo.
    if (!created) return notFound()

    // Notificacion al cliente reutilizando EXACTAMENTE el mismo flujo de chat existente
    // (best-effort, nunca bloquea la respuesta ya confirmada).
    if (created.clienteId) {
      try {
        const cliente = await db.cliente.findUnique({
          where: { id: created.clienteId },
          select: { pushSubscription: true },
        })
        const payload = chatMessageNotification(pedidoId, created.negocioNombre, texto.slice(0, 100))
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
        console.error("[OperativoPyR] Fallo una notificacion de chat")
      }
    }

    return noStore(NextResponse.json({ ok: true, mensaje: { id: created.mensajeId } }))
  } catch (error) {
    console.error("[OperativoPyR] Error al enviar mensaje:", error)
    return noStore(NextResponse.json({ ok: false, error: "Error del servidor" }, { status: 500 }))
  }
}
