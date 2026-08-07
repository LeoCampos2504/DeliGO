import { NextRequest, NextResponse } from "next/server"
import { listReviewModerationRequests, parseReviewModerationListParams } from "@/lib/review-moderation-superadmin"
import { requireSuperadminSession } from "@/lib/superadmin-auth"

function response(data: unknown, init?: ResponseInit) {
  const result = NextResponse.json(data, init)
  result.headers.set("Cache-Control", "private, no-store")
  return result
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireSuperadminSession(req)
    if (!auth.ok) return response({ error: "No autenticado" }, { status: 401 })
    const parsed = parseReviewModerationListParams(new URL(req.url).searchParams)
    if (!parsed) return response({ error: "Filtros inválidos" }, { status: 400 })
    return response(await listReviewModerationRequests(parsed))
  } catch (error) {
    console.error("Error listing review moderation requests:", error)
    return response({ error: "Error interno del servidor" }, { status: 500 })
  }
}
