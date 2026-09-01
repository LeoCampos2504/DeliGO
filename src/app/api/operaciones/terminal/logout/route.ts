import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import {
  clearTerminalSessionCookie,
  sha256Hex,
  TERMINAL_SESSION_COOKIE_NAME,
} from "@/lib/operaciones-terminal-auth"
import { safeErrorForLog } from "@/lib/log-safe-error"

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" } as const

/** Revokes only the session represented by the current terminal cookie. */
export async function POST(req: NextRequest) {
  const response = NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS })
  const rawToken = req.cookies.get(TERMINAL_SESSION_COOKIE_NAME)?.value

  if (rawToken) {
    try {
      await db.sesionTerminalOperativa.updateMany({
        where: { tokenHash: sha256Hex(rawToken), revokedAt: null },
        data: { revokedAt: new Date() },
      })
    } catch (error) {
      // Cookie clearing is still applied below. The operation is idempotent and
      // protected terminal requests fail closed if persistence failed.
      console.error("[TerminalLogout] Error revoking session:", safeErrorForLog(error))
    }
  }

  return clearTerminalSessionCookie(response)
}
