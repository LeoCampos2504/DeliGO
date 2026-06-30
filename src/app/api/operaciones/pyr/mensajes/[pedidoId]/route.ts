import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireOperacionesScope, hasTerminalScope } from "@/lib/operaciones-terminal-access"
import { createNotification, chatMessageNotification } from "@/lib/push"
import { checkRateLimit } from "@/lib/rate-limit"

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" }

// Mensaje genérico de no-disponibilidad: no revela existencia, pertenencia ni estado interno.
const UNAVAILABLE_MESSAGE = "Este pedido ya no está disponible para mensajes. Volvé a Pedidos y reseñas."

// Estados activos no-mesa con conversación habilitada.
const ESTADOS_ACTIVOS = ["recibido", "preparando", "en_camino", "listo_para_retirar"] as const

// Límite fijo de mensajes devueltos (más recientes, en orden ascendente). El chat legacy no
// pagina; aquí se acota por seguridad/rendimiento. Documentado en CODEX_REPORT.
const MENSAJES_LIMIT = 200

// El chat legacy NO define un máximo real de longitud de texto; se introduce un tope seguro
// nuevo para la Terminal Operativa. Documentado en CODEX_REPORT.
const MAX_TEXTO_LEN = 2000

// Mismas reglas de texto plano que el chat actual (replicadas localmente porque son privadas
// del módulo legacy y no se pueden importar sin tocar archivos fuera de alcance).
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

function forbidden() {
  return NextResponse.json(
    { ok: false, error: "Esta terminal no tiene permiso para realizar esa acción." },
    { status: 403, headers: NO_STORE_HEADERS }
  )
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

// Normaliza el remitente real al contrato permitido (cliente | vendedor).
function normalizeRemitente(value: string): "cliente" | "vendedor" {
  return value === "cliente" ? "cliente" : "vendedor"
}

// GET — Lee la conversación de un pedido PyR activo no-mesa. Marca como leídos los mensajes
// del cliente (best-effort). Negocio SIEMPRE desde el contexto seguro.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ pedidoId: string }> }
) {
  try {
    // 401 sin sesión válida · 403 sin scope `pyr.mensajes.ver` (que implica área `pyr`).
    const auth = await requireOperacionesScope(req, "pyr.mensajes.ver")
    if (!auth.ok) return auth.response
    const ctx = auth.context
    const negocioId = ctx.negocio.id

    const { pedidoId } = await params

    // Pedido elegible: del negocio, no-mesa y activo. Cualquier otro caso → 409 genérico.
    const pedido = await db.pedido.findFirst({
      where: { id: pedidoId, negocioId, metodoEntrega: { not: "mesa" }, estado: { in: [...ESTADOS_ACTIVOS] } },
      select: { clienteNombre: true, estado: true, metodoEntrega: true },
    })
    if (!pedido) return conflict()

    // Mensajes: solo conversación cliente↔negocio (NUNCA `repartidor`), los más recientes
    // (límite fijo), devueltos en orden ascendente.
    const rows = await db.chatMensaje.findMany({
      where: { pedidoId, remitente: { in: ["cliente", "vendedor"] } },
      orderBy: [{ fecha: "desc" }, { id: "desc" }],
      take: MENSAJES_LIMIT,
      select: { id: true, remitente: true, texto: true, imagenUrl: true, archivoUrl: true, fecha: true },
    })
    const mensajes = rows
      .reverse()
      .map((m) => ({
        id: m.id,
        remitente: normalizeRemitente(m.remitente),
        texto: m.texto ? m.texto : null,
        fecha: m.fecha,
        // Solo un booleano: nunca URL ni metadatos de adjunto.
        tieneAdjunto: !!m.imagenUrl || !!m.archivoUrl,
      }))

    // Marcar como leídos SOLO los mensajes de cliente realmente devueltos (por `id`), para no
    // marcar mensajes llegados después del findMany que aún no se mostraron. Best-effort: un
    // fallo no impide mostrar la conversación.
    const clienteMsgIds = mensajes.filter((m) => m.remitente === "cliente").map((m) => m.id)
    if (clienteMsgIds.length > 0) {
      try {
        await db.chatMensaje.updateMany({
          where: { id: { in: clienteMsgIds }, pedidoId, remitente: "cliente", leido: false },
          data: { leido: true },
        })
      } catch {
        console.error("[OperacionesPyR] Falló al marcar mensajes como leídos")
      }
    }

    return NextResponse.json(
      {
        ok: true,
        terminal: { nombre: ctx.terminal.nombre },
        negocio: { nombre: ctx.negocio.nombre, colorPrincipal: ctx.negocio.colorPrincipal },
        pedido: {
          clienteNombre: pedido.clienteNombre,
          estado: pedido.estado,
          metodoEntrega: pedido.metodoEntrega,
        },
        capacidades: {
          puedeResponderMensajes: hasTerminalScope(ctx, "pyr.mensajes.responder"),
        },
        mensajes,
      },
      { headers: NO_STORE_HEADERS }
    )
  } catch {
    console.error("[OperacionesPyR] Falló la carga de mensajes")
    return NextResponse.json(
      { ok: false, error: "Error del servidor" },
      { status: 500, headers: NO_STORE_HEADERS }
    )
  }
}

// POST — Envía un mensaje de texto como negocio en un pedido PyR activo no-mesa.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ pedidoId: string }> }
) {
  try {
    // 401 / 403 con scope de respuesta (que implica área `pyr`). Nunca confía en la UI.
    const auth = await requireOperacionesScope(req, "pyr.mensajes.responder")
    if (!auth.ok) return auth.response
    const ctx = auth.context
    if (!hasTerminalScope(ctx, "pyr.mensajes.responder")) return forbidden()
    const negocioId = ctx.negocio.id

    const { pedidoId } = await params

    // Body estricto: solo `{ texto: string }`. Cualquier clave extra → 400.
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object" || Array.isArray(body)) return badRequest()
    const ALLOWED_KEYS = new Set(["texto"])
    if (Object.keys(body as Record<string, unknown>).some((key) => !ALLOWED_KEYS.has(key))) {
      return badRequest()
    }
    const rawTexto = (body as Record<string, unknown>).texto
    if (typeof rawTexto !== "string") return badRequest()
    const trimmed = rawTexto.trim()
    if (!trimmed) return badRequest("El mensaje no puede estar vacío")
    if (trimmed.length > MAX_TEXTO_LEN) return badRequest("El mensaje es demasiado largo")

    // Texto plano: escape de HTML + filtro de teléfonos (mismas reglas que el chat actual).
    const texto = filterPhoneNumbers(sanitizeHtml(trimmed))
    if (!texto) return badRequest("El mensaje no puede estar vacío")

    // Rate limit reutilizando el tipo existente `chat`, con clave por terminal + pedido.
    const rl = checkRateLimit("chat", `${ctx.terminal.id}:${pedidoId}`)
    if (!rl.allowed) return tooManyRequests()

    // Creación ATÓMICA respecto del estado del pedido (provider PostgreSQL). Se bloquea la
    // fila del pedido con `SELECT … FOR UPDATE` acotado a negocio + no-mesa + estado activo, y
    // el mensaje se crea dentro de la MISMA transacción:
    //   - Si una transición de estado ganó antes (pedido entregado/cancelado), el SELECT no
    //     devuelve filas → 409 y NO se crea mensaje.
    //   - Si gana el POST, la fila queda bloqueada y la transición de estado espera al commit;
    //     el mensaje se crea con el pedido aún activo. Nunca se crea tras finalizar el pedido.
    // `pedidoId` y `negocioId` van parametrizados (tagged template); los estados/'mesa' son
    // literales fijos del código, no datos del cliente. No es un `findFirst + create` simple.
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

    // Pedido inexistente / ajeno / mesa / finalizado al momento del bloqueo → 409 genérico.
    if (!created) return conflict()

    // Notificación al cliente reutilizando el flujo de chat existente (best-effort), SOLO
    // después de confirmar la creación del mensaje.
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
        console.error("[OperacionesPyR] Falló una notificación de chat")
      }
    }

    return NextResponse.json({ ok: true, mensaje: { id: created.mensajeId } }, { headers: NO_STORE_HEADERS })
  } catch {
    console.error("[OperacionesPyR] Falló el envío de mensaje")
    return NextResponse.json(
      { ok: false, error: "Error del servidor" },
      { status: 500, headers: NO_STORE_HEADERS }
    )
  }
}
