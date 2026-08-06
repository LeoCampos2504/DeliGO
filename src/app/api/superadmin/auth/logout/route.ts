import { NextRequest, NextResponse } from "next/server"
import { getClientIp } from "@/lib/rate-limit"
import {
  SUPERADMIN_SESSION_COOKIE_NAME,
  revokeSuperadminSession,
  validateSuperadminSession,
  auditSuperadminLogout,
} from "@/lib/superadmin-auth"

// ============================================
// DeliGO Superadmin — Logout (24-A)
// ============================================
// POST /api/superadmin/auth/logout — revoca la sesión server-side (no solo
// borra la cookie del navegador) e idempotente: llamarlo sin sesión válida
// también responde ok, sin filtrar si el token era válido o no. Nunca cierra
// sesiones de cliente/negocio/operaciones (cookie distinta).

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" } as const

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SUPERADMIN_SESSION_COOKIE_NAME)?.value

  if (token) {
    try {
      const admin = await validateSuperadminSession(token)
      await revokeSuperadminSession(token)
      if (admin) {
        await auditSuperadminLogout(admin.id, getClientIp(req))
      }
    } catch (error) {
      console.error("[SuperadminLogout] Error:", error instanceof Error ? error.message : "unknown")
    }
  }

  const res = NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS })
  res.cookies.delete(SUPERADMIN_SESSION_COOKIE_NAME)
  return res
}
