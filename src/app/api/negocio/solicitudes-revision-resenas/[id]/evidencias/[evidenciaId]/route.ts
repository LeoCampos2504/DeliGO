import { NextRequest } from "next/server"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { PrivateEvidenceStorageNotConfiguredError, getPrivateEvidenceStorage } from "@/lib/private-evidence-storage-runtime"
import { ReviewModerationEvidenceNotFoundError, getBusinessReviewModerationEvidence } from "@/lib/review-moderation-evidence"
import { reviewModerationEvidenceDownloadHeaders } from "@/lib/review-moderation-evidence-download"

function error(message: string, status: number) { return Response.json({ error: message }, { status, headers: { "Cache-Control": "private, no-store" } }) }

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; evidenciaId: string }> }) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) return error("No autenticado", 401)
    const user = await getUserFromToken(token)
    if (!user || user.type !== "negocio" || !user.aprobado || user.suspendido) return error("No autenticado", 401)
    const { id: solicitudId, evidenciaId } = await params
    const evidencia = await getBusinessReviewModerationEvidence({ negocioId: user.id, solicitudId, evidenciaId })
    const bytes = await getPrivateEvidenceStorage().get({ storageKey: evidencia.storageKey })
    return new Response(new Uint8Array(bytes).buffer, { headers: reviewModerationEvidenceDownloadHeaders(evidencia) })
  } catch (cause) {
    if (cause instanceof PrivateEvidenceStorageNotConfiguredError) return error("Storage no configurado", 503)
    if (cause instanceof ReviewModerationEvidenceNotFoundError) return error("Evidencia no encontrada", 404)
    console.error("Private review evidence business download failed")
    return error("Error interno del servidor", 500)
  }
}
