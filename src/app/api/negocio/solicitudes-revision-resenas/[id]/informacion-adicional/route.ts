import { NextRequest, NextResponse } from "next/server"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit"
import {
  addBusinessReviewModerationInformation,
  isReviewModerationBusinessConflict,
  parseBusinessModerationInformationBody,
  ReviewModerationBusinessNotFoundError,
} from "@/lib/review-moderation-business"

function noStoreJson<T>(data: T, init?: ResponseInit) {
  const response = NextResponse.json(data, init)
  response.headers.set("Cache-Control", "private, no-store")
  return response
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) return noStoreJson({ error: "No autenticado" }, { status: 401 })
    const user = await getUserFromToken(token)
    if (!user || user.type !== "negocio") return noStoreJson({ error: "No autenticado" }, { status: 401 })
    if (!user.aprobado || user.suspendido) return noStoreJson({ error: "Acceso denegado" }, { status: 403 })

    const raw = await req.json().catch(() => null)
    const mensaje = parseBusinessModerationInformationBody(raw)
    if (!mensaje) return noStoreJson({ error: "Body inválido" }, { status: 400 })
    const rate = checkRateLimit("reviewModerationBusinessInformation", user.id)
    if (!rate.allowed) return rateLimitResponse(rate, "Demasiados aportes de información. Intentá más tarde.")

    const { id } = await params
    if (!id) return noStoreJson({ error: "Solicitud no encontrada" }, { status: 404 })
    return noStoreJson({ ok: true, ...(await addBusinessReviewModerationInformation({ negocioId: user.id, solicitudId: id, mensaje })) })
  } catch (error) {
    if (error instanceof ReviewModerationBusinessNotFoundError) return noStoreJson({ error: "Solicitud no encontrada" }, { status: 404 })
    if (isReviewModerationBusinessConflict(error)) return noStoreJson({ error: "La solicitud cambió durante la revisión." }, { status: 409 })
    console.error("Error adding business review moderation information:", error)
    return noStoreJson({ error: "Error interno del servidor" }, { status: 500 })
  }
}
