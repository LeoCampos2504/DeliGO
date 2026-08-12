import { NextRequest, NextResponse } from "next/server"
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit"
import { isReviewModerationSuperadminConflict, mutateReviewModerationRequest, parseReviewModerationDecisionBody, ReviewModerationSuperadminNotFoundError } from "@/lib/review-moderation-superadmin"
import { requireSuperadminSession } from "@/lib/superadmin-auth"
import { safeErrorForLog } from "@/lib/log-safe-error"

function response(data: unknown, init?: ResponseInit) { const result = NextResponse.json(data, init); result.headers.set("Cache-Control", "private, no-store"); return result }

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireSuperadminSession(req)
    if (!auth.ok) return response({ error: "No autenticado" }, { status: 401 })
    const raw = await req.json().catch(() => null)
    const motivoDecision = parseReviewModerationDecisionBody(raw, "motivoDecision")
    if (!motivoDecision) return response({ error: "Body inválido" }, { status: 400 })
    const limit = checkRateLimit("superadminReviewModerationAction", auth.admin.id)
    if (!limit.allowed) return rateLimitResponse(limit)
    const { id } = await params
    if (!id) return response({ error: "Solicitud no encontrada" }, { status: 404 })
    return response({ ok: true, ...(await mutateReviewModerationRequest({ solicitudId: id, superadminId: auth.admin.id, action: "RECHAZAR", text: motivoDecision })) })
  } catch (error) {
    if (error instanceof ReviewModerationSuperadminNotFoundError) return response({ error: "Solicitud no encontrada" }, { status: 404 })
    if (isReviewModerationSuperadminConflict(error)) return response({ error: "La solicitud cambió durante la revisión." }, { status: 409 })
    console.error("Error rejecting review moderation request:", safeErrorForLog(error))
    return response({ error: "Error interno del servidor" }, { status: 500 })
  }
}
