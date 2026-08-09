import { NextRequest, NextResponse } from "next/server"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit"
import { PrivateEvidenceStorageNotConfiguredError, getPrivateEvidenceStorage } from "@/lib/private-evidence-storage-runtime"
import { ReviewModerationEvidenceConflictError, ReviewModerationEvidenceNotFoundError, createReviewModerationEvidence } from "@/lib/review-moderation-evidence"
import { ReviewModerationEvidenceFileError, REVIEW_MODERATION_EVIDENCE_MAX_BYTES, validateReviewModerationEvidenceFile } from "@/lib/review-moderation-evidence-file"

function response(data: unknown, init?: ResponseInit) {
  const result = NextResponse.json(data, init)
  result.headers.set("Cache-Control", "private, no-store")
  return result
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; eventoId: string }> }) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) return response({ error: "No autenticado" }, { status: 401 })
    const user = await getUserFromToken(token)
    if (!user || user.type !== "negocio") return response({ error: "No autenticado" }, { status: 401 })
    if (!user.aprobado || user.suspendido) return response({ error: "Acceso denegado" }, { status: 403 })

    const rate = checkRateLimit("reviewModerationEvidenceUpload", user.id)
    if (!rate.allowed) return rateLimitResponse(rate, "Demasiadas evidencias. Intentá más tarde.")
    const contentLength = Number(req.headers.get("content-length"))
    if (Number.isFinite(contentLength) && contentLength > REVIEW_MODERATION_EVIDENCE_MAX_BYTES + 32_768) {
      return response({ error: "El archivo supera el tamaño permitido" }, { status: 413 })
    }
    const form = await req.formData().catch(() => null)
    if (!form || Array.from(form.keys()).length !== 1 || !form.has("archivo")) return response({ error: "Archivo inválido" }, { status: 400 })
    const archivo = form.get("archivo")
    if (!(archivo instanceof File)) return response({ error: "Archivo inválido" }, { status: 400 })
    if (archivo.size > REVIEW_MODERATION_EVIDENCE_MAX_BYTES) return response({ error: "El archivo supera el tamaño permitido" }, { status: 413 })

    const file = validateReviewModerationEvidenceFile({
      bytes: new Uint8Array(await archivo.arrayBuffer()),
      mimeType: archivo.type,
      filename: archivo.name,
    })
    const { id: solicitudId, eventoId } = await params
    if (!solicitudId || !eventoId) return response({ error: "Solicitud no encontrada" }, { status: 404 })
    const result = await createReviewModerationEvidence({
      negocioId: user.id,
      uploaderId: user.id,
      solicitudId,
      eventoId,
      file,
      storage: getPrivateEvidenceStorage(),
    })
    return response(result, { status: 201 })
  } catch (error) {
    if (error instanceof PrivateEvidenceStorageNotConfiguredError) return response({ error: "Storage no configurado" }, { status: 503 })
    if (error instanceof ReviewModerationEvidenceFileError) return response({ error: "Tipo de archivo no permitido" }, { status: error.code === "too_large" ? 413 : 415 })
    if (error instanceof ReviewModerationEvidenceNotFoundError) return response({ error: "Solicitud no encontrada" }, { status: 404 })
    if (error instanceof ReviewModerationEvidenceConflictError) return response({ error: "La solicitud, evento o cuota no permite esta evidencia" }, { status: 409 })
    console.error("Private review evidence upload failed")
    return response({ error: "Error interno del servidor" }, { status: 500 })
  }
}
