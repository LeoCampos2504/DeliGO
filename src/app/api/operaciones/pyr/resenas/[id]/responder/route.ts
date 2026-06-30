import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireOperacionesScope, hasTerminalScope } from "@/lib/operaciones-terminal-access"
import { auditLog } from "@/lib/audit"
import { createNotification, reviewReplyNotification } from "@/lib/push"
import { checkRateLimit } from "@/lib/rate-limit"

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" }

// Mensaje genérico de conflicto: no revela existencia, pertenencia ni estado interno.
const CONFLICT_MESSAGE = "La reseña ya fue respondida o cambió en otro dispositivo. Actualizá el panel."

// Límite nuevo de seguridad para Terminal Operativa (el proyecto no define un máximo real).
const MAX_RESPUESTA_LEN = 1000

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
  return NextResponse.json({ ok: false, error: CONFLICT_MESSAGE }, { status: 409, headers: NO_STORE_HEADERS })
}

function tooManyRequests() {
  return NextResponse.json(
    { ok: false, error: "Demasiados intentos. Esperá un momento antes de volver a intentar." },
    { status: 429, headers: NO_STORE_HEADERS }
  )
}

// PATCH — Responde (una sola vez) una reseña del negocio desde una Terminal Operativa.
// Negocio SIEMPRE desde el contexto seguro. Respuesta atómica vía CAS (`respuestaNegocio: null`).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1) Sesión válida de terminal + scope de respuesta (401 / 403). Nunca confía en la UI.
    //    `pyr.resenas.responder` solo existe junto al área `pyr` + `pyr.ver` (grant normalizado).
    const auth = await requireOperacionesScope(req, "pyr.resenas.responder")
    if (!auth.ok) return auth.response
    const ctx = auth.context
    if (!hasTerminalScope(ctx, "pyr.resenas.responder")) return forbidden()
    const negocioId = ctx.negocio.id

    const { id } = await params

    // 2) Body estricto: solo `{ respuesta: string }`. Cualquier clave extra → 400.
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object" || Array.isArray(body)) return badRequest()
    const ALLOWED_KEYS = new Set(["respuesta"])
    if (Object.keys(body as Record<string, unknown>).some((key) => !ALLOWED_KEYS.has(key))) {
      return badRequest()
    }
    const rawRespuesta = (body as Record<string, unknown>).respuesta
    if (typeof rawRespuesta !== "string") return badRequest()
    const respuesta = rawRespuesta.trim()
    if (!respuesta) return badRequest("La respuesta no puede estar vacía")
    if (respuesta.length > MAX_RESPUESTA_LEN) return badRequest("La respuesta es demasiado larga")

    // 3) Rate limit reutilizando el tipo existente `review`, con clave por terminal.
    const rl = checkRateLimit("review", ctx.terminal.id)
    if (!rl.allowed) return tooManyRequests()

    // 4) Lectura mínima acotada al negocio (para notificación y early-conflict). El CAS es la
    //    autoridad. Inexistente / de otro negocio / ya respondida → 409 genérico.
    const resena = await db.resena.findFirst({
      where: { id, negocioId },
      select: { clienteId: true, respuestaNegocio: true },
    })
    if (!resena || resena.respuestaNegocio !== null) return conflict()

    // 5) CAS atómico: solo gana si la reseña sigue sin respuesta. Nunca sobrescribe.
    const result = await db.resena.updateMany({
      where: { id, negocioId, respuestaNegocio: null },
      data: { respuestaNegocio: respuesta, fechaRespuesta: new Date() },
    })
    if (result.count !== 1) return conflict()

    // 6) Auditoría best-effort (actor terminal). Un fallo no revierte la respuesta confirmada.
    try {
      await auditLog({
        userId: ctx.terminal.id,
        userType: "terminal_operativa",
        accion: "resena.respondida",
        recurso: "resena",
        recursoId: id,
      })
    } catch {
      console.error("[OperacionesPyR] Falló la auditoría de respuesta de reseña")
    }

    // 7) Notificación al cliente reutilizando el flujo existente (mismo que el legacy de empleado).
    if (resena.clienteId) {
      try {
        const cliente = await db.cliente.findUnique({
          where: { id: resena.clienteId },
          select: { pushSubscription: true },
        })
        const payload = reviewReplyNotification(ctx.negocio.nombre)
        await createNotification({
          userId: resena.clienteId,
          userType: "cliente",
          tipo: "review",
          titulo: payload.title,
          cuerpo: payload.body,
          negocioId,
          pushSubscription: cliente?.pushSubscription ?? null,
          pushPayload: payload,
          cleanupExpired: { model: "cliente", id: resena.clienteId },
        })
      } catch {
        console.error("[OperacionesPyR] Falló una notificación de respuesta de reseña")
      }
    }

    return NextResponse.json({ ok: true, resena: { id } }, { headers: NO_STORE_HEADERS })
  } catch {
    console.error("[OperacionesPyR] Falló la respuesta a una reseña")
    return NextResponse.json(
      { ok: false, error: "Error del servidor" },
      { status: 500, headers: NO_STORE_HEADERS }
    )
  }
}
