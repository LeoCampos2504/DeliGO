import { NextRequest, NextResponse } from "next/server"
import { requireSuperadminSession } from "@/lib/superadmin-auth"

// ============================================
// DeliGO Superadmin — Identidad actual (24-A)
// ============================================
// GET /api/superadmin/auth/me — usado por /admin para saber si ya hay una
// sesión Superadmin válida sin volver a iniciar OAuth. Nunca expone el
// googleSub ni ningún dato de sesión de otro rol.

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" } as const

export async function GET(req: NextRequest) {
  const result = await requireSuperadminSession(req)
  if (!result.ok) {
    return NextResponse.json({ ok: false }, { status: 401, headers: NO_STORE_HEADERS })
  }

  return NextResponse.json(
    { ok: true, admin: { id: result.admin.id, email: result.admin.email } },
    { headers: NO_STORE_HEADERS }
  )
}
