import { NextRequest, NextResponse } from "next/server"
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit"
import { isReviewModerationSuperadminConflict, mutateReviewModerationRequest, ReviewModerationSuperadminNotFoundError } from "@/lib/review-moderation-superadmin"
import { requireSuperadminSession } from "@/lib/superadmin-auth"

function response(data: unknown, init?: ResponseInit) {
  const result = NextResponse.json(data, init)
  result.headers.set("Cache-Control", "private, no-store")
  return result
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireSuperadminSession(req)
    if (!auth.ok) return response({ error: "No autenticado" }, { status: 401 })
    let body: unknown = {}
    try { body = await req.json() } catch {}
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body as object).length !== 0) return response({ error: "Body inválido" }, { status: 400 })
    const limit = checkRateLimit("superadminReviewModerationAction", auth.admin.id)
    if (!limit.allowed) return rateLimitResponse(limit)
    const { id } = await params
    if (!id) return response({ error: "Solicitud no encontrada" }, { status: 404 })
    return response({ ok: true, ...(await mutateReviewModerationRequest({ solicitudId: id, superadminId: auth.admin.id, action: "TOMAR_EN_REVISION" })) })
  } catch (error) {
    if (error instanceof ReviewModerationSuperadminNotFoundError) return response({ error: "Solicitud no encontrada" }, { status: 404 })
    if (isReviewModerationSuperadminConflict(error)) return response({ error: "La solicitud cambió durante la revisión." }, { status: 409 })
    console.error("Error taking review moderation request:", error)
    return response({ error: "Error interno del servidor" }, { status: 500 })
  }
}
