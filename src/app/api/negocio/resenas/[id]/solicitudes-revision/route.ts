import { NextRequest, NextResponse } from "next/server"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit"
import {
  ReviewModerationNotFoundError,
  createReviewModerationRequest,
  isReviewModerationConflict,
  parseCreateReviewModerationRequestBody,
} from "@/lib/review-moderation-server"
import {
  getBusinessReviewModerationHistory,
  ReviewModerationBusinessNotFoundError,
} from "@/lib/review-moderation-business"

function noStoreJson<T>(data: T, init?: ResponseInit) {
  const response = NextResponse.json(data, init)
  response.headers.set("Cache-Control", "private, no-store")
  return response
}

// GET /api/negocio/resenas/[id]/solicitudes-revision - historial propio y sanitizado.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) return noStoreJson({ error: "No autenticado" }, { status: 401 })
    const user = await getUserFromToken(token)
    if (!user || user.type !== "negocio") return noStoreJson({ error: "No autenticado" }, { status: 401 })
    if (!user.aprobado || user.suspendido) return noStoreJson({ error: "Acceso denegado" }, { status: 403 })

    const { id } = await params
    if (!id) return noStoreJson({ error: "Reseña no encontrada" }, { status: 404 })
    return noStoreJson(await getBusinessReviewModerationHistory({ negocioId: user.id, resenaId: id }))
  } catch (error) {
    if (error instanceof ReviewModerationBusinessNotFoundError) return noStoreJson({ error: "Reseña no encontrada" }, { status: 404 })
    console.error("Error getting business review moderation history:", error)
    return noStoreJson({ error: "Error interno del servidor" }, { status: 500 })
  }
}

// POST /api/negocio/resenas/[id]/solicitudes-revision
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) return noStoreJson({ error: "No autenticado" }, { status: 401 })

    const user = await getUserFromToken(token)
    if (!user || user.type !== "negocio") return noStoreJson({ error: "No autenticado" }, { status: 401 })
    if (!user.aprobado || user.suspendido) return noStoreJson({ error: "Acceso denegado" }, { status: 403 })

    let rawBody: unknown
    try {
      rawBody = await req.json()
    } catch {
      return noStoreJson({ error: "Body inválido" }, { status: 400 })
    }
    const body = parseCreateReviewModerationRequestBody(rawBody)
    if (!body) return noStoreJson({ error: "Body inválido" }, { status: 400 })

    const { id: resenaId } = await params
    if (!resenaId) return noStoreJson({ error: "Reseña no encontrada" }, { status: 404 })

    // Las claves son del actor autenticado; no dependen sólo de IP ni del body.
    const negocioLimit = checkRateLimit("reviewModerationBusiness", user.id)
    if (!negocioLimit.allowed) return rateLimitResponse(negocioLimit, "Demasiadas solicitudes de revisión. Intentá más tarde.")

    const solicitud = await createReviewModerationRequest({
      negocioId: user.id,
      resenaId,
      motivo: body.motivo,
      explicacion: body.explicacion,
    })

    // La protección específica se contabiliza sólo para una creación efectiva.
    // El estado/unique/CAS deben conservar precedencia para que un duplicado
    // (incluido uno concurrente) reciba el 409 semántico y nunca un 429.
    checkRateLimit("reviewModerationReview", `${user.id}:${resenaId}`)

    return noStoreJson({
      ok: true,
      solicitud: {
        id: solicitud.id,
        estado: solicitud.estado,
        motivo: solicitud.motivo,
        venceEn: solicitud.venceEn,
        createdAt: solicitud.createdAt,
      },
    }, { status: 201 })
  } catch (error) {
    if (error instanceof ReviewModerationNotFoundError) {
      return noStoreJson({ error: "Reseña no encontrada" }, { status: 404 })
    }
    if (isReviewModerationConflict(error)) {
      return noStoreJson({ error: "La reseña cambió o ya tiene una solicitud activa." }, { status: 409 })
    }
    console.error("Error creating review moderation request:", error)
    return noStoreJson({ error: "Error interno del servidor" }, { status: 500 })
  }
}
