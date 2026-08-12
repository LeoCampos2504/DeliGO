import { NextRequest, NextResponse } from "next/server"
import { OPERATIONAL_SESSION_COOKIE_NAME } from "@/lib/auth"
import { db } from "@/lib/db"
import { auditLog } from "@/lib/audit"
import { createNotification, reviewReplyNotification } from "@/lib/push"
import { checkRateLimit } from "@/lib/rate-limit"
import { noStore, resolveOperativoAreaForSlug } from "@/lib/operativo-mozo"
import { safeErrorForLog } from "@/lib/log-safe-error"

// ============================================
// DeliGO Operaciones — PyR personal: responder reseña (Operaciones-1N)
// ============================================
// Acción FIJA (no un endpoint genérico): responder UNA sola vez una reseña sin respuesta
// del negocio autorizado. Identidad: EXCLUSIVAMENTE cuenta personal
// (deligo_operativo_session) con área efectiva "pyr". No usa cookie/APIs/scopes de
// terminal. Sin editar ni borrar respuestas existentes.
//
// El `id` de la reseña viene SOLO del parámetro de ruta. El `slug` (query) solo
// selecciona el negocio a autorizar; no autoriza por sí solo. Body estricto: únicamente
// `{ respuesta: string }`, cualquier otra clave → 400. Nunca se aceptan negocioId/
// clienteId/estado/respuestaNegocio/fechaRespuesta/terminalId/empleadoId desde el
// cliente.
//
// Reutiliza EXACTAMENTE el mismo patrón que el flujo terminal de PyR
// (src/app/api/operaciones/pyr/resenas/[id]/responder/route.ts): mismo CAS
// (`respuestaNegocio: null` → respuesta + fechaRespuesta), mismo helper de auditoría
// (`auditLog`, acción "resena.respondida"), mismo helper de notificación
// (`createNotification` + `reviewReplyNotification`, tipo "review"), mismo tipo de rate
// limit ("review"). La única diferencia es la clave de rate limit (cuenta personal en
// vez de terminal) y el actor de auditoría (`cuenta_operativa` en vez de
// `terminal_operativa`).

const CONFLICT_MESSAGE = "La reseña ya no está disponible para responder"
// Mismo límite ya confirmado y usado por el flujo terminal de PyR (el proyecto no define
// un máximo real en el schema; este es el límite de seguridad ya adoptado).
const MAX_RESPUESTA_LEN = 1000

function badRequest(error = "Solicitud inválida") {
  return noStore(NextResponse.json({ ok: false, error }, { status: 400 }))
}

function conflict() {
  return noStore(NextResponse.json({ ok: false, error: CONFLICT_MESSAGE }, { status: 409 }))
}

function tooManyRequests() {
  return noStore(
    NextResponse.json(
      { ok: false, error: "Demasiados intentos. Esperá un momento antes de volver a intentar." },
      { status: 429 }
    )
  )
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const slug = req.nextUrl.searchParams.get("slug") ?? ""

    // 1) Autorización ANTES de tocar reseñas.
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

    // 2) Negocio SIEMPRE del contexto seguro.
    const negocioId = auth.negocio.id

    // 3) Body estricto: solo `{ respuesta: string }`. Cualquier clave extra → 400. Esta
    // única comprobación de allowlist cubre, por construcción, negocioId/clienteId/
    // estado/respuestaNegocio/fechaRespuesta/terminalId/empleadoId y cualquier otro campo.
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
    // No se loguea el contenido de `respuesta` en ningún punto de este archivo.

    // 4) Rate limit reutilizando el tipo existente `review`, con clave derivada
    // EXCLUSIVAMENTE de la cuenta personal autorizada (prefijo seguro + auth.cuenta.id).
    // Nunca IP, body, clienteId, id de reseña ni parámetros enviados por el cliente.
    const rl = checkRateLimit("review", `cuenta_operativa:${auth.cuenta.id}`)
    if (!rl.allowed) return tooManyRequests()

    // 5) Lectura mínima acotada al negocio: SOLO para obtener clienteId (necesario para
    // notificar) y un early-conflict de presentación. Nunca decide la mutación final —
    // esa decisión es exclusivamente del CAS del paso 6.
    const resena = await db.resena.findFirst({
      where: { id, negocioId },
      select: { clienteId: true, respuestaNegocio: true },
    })
    if (!resena || resena.respuestaNegocio !== null) return conflict()

    // 6) CAS atómico: solo gana si la reseña sigue sin respuesta. Nunca sobrescribe una
    // respuesta existente, nunca edita, nunca borra.
    const result = await db.resena.updateMany({
      where: { id, negocioId, respuestaNegocio: null },
      data: { respuestaNegocio: respuesta, fechaRespuesta: new Date() },
    })
    if (result.count !== 1) return conflict()

    // 7) Auditoría best-effort (mismo helper y acción que el flujo terminal). Un fallo no
    // revierte la respuesta ya confirmada. Actor = cuenta operativa (nunca terminal).
    try {
      await auditLog({
        userId: auth.cuenta.id,
        userType: "cuenta_operativa",
        accion: "resena.respondida",
        recurso: "resena",
        recursoId: id,
      })
    } catch {
      console.error("[OperativoPyR] Falló la auditoría de respuesta de reseña")
    }

    // 8) Notificación al cliente, best-effort, reutilizando exactamente el mismo canal y
    // tipo que el flujo terminal/legacy. No crea helpers ni tipos nuevos, no notifica a
    // mozos/terminales/negocio, no envía datos de empleados ni expone tokens.
    if (resena.clienteId) {
      try {
        const cliente = await db.cliente.findUnique({
          where: { id: resena.clienteId },
          select: { pushSubscription: true },
        })
        const payload = reviewReplyNotification(auth.negocio.nombre)
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
        console.error("[OperativoPyR] Falló una notificación de respuesta de reseña")
      }
    }

    return noStore(NextResponse.json({ ok: true, resena: { id } }))
  } catch (error) {
    console.error("[OperativoPyR] Falló la respuesta a una reseña:", safeErrorForLog(error))
    return noStore(NextResponse.json({ ok: false, error: "Error del servidor" }, { status: 500 }))
  }
}
