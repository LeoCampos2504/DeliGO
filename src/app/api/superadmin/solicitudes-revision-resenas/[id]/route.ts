import { NextRequest, NextResponse } from "next/server"
import { getReviewModerationRequestDetail, ReviewModerationSuperadminNotFoundError } from "@/lib/review-moderation-superadmin"
import { requireSuperadminSession } from "@/lib/superadmin-auth"

function response(data: unknown, init?: ResponseInit) {
  const result = NextResponse.json(data, init)
  result.headers.set("Cache-Control", "private, no-store")
  return result
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireSuperadminSession(req)
    if (!auth.ok) return response({ error: "No autenticado" }, { status: 401 })
    const { id } = await params
    if (!id) return response({ error: "Solicitud no encontrada" }, { status: 404 })
    return response(await getReviewModerationRequestDetail(id))
  } catch (error) {
    if (error instanceof ReviewModerationSuperadminNotFoundError) return response({ error: "Solicitud no encontrada" }, { status: 404 })
    console.error("Error getting review moderation request:", error)
    return response({ error: "Error interno del servidor" }, { status: 500 })
  }
}
