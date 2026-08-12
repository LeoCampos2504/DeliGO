import { NextRequest, NextResponse } from "next/server"
import {
  deleteOperationalSession,
  OPERATIONAL_SESSION_COOKIE_NAME,
} from "@/lib/auth"
import { safeErrorForLog } from "@/lib/log-safe-error"

function noStore<T extends Response>(response: T): T {
  response.headers.set("Cache-Control", "private, no-store")
  return response
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(OPERATIONAL_SESSION_COOKIE_NAME)?.value
    if (token) {
      await deleteOperationalSession(token)
    }

    const response = NextResponse.json({ ok: true })
    response.cookies.delete(OPERATIONAL_SESSION_COOKIE_NAME)
    return noStore(response)
  } catch (error) {
    console.error("[OperativoLogout] Error:", safeErrorForLog(error))
    const response = NextResponse.json({ ok: true })
    response.cookies.delete(OPERATIONAL_SESSION_COOKIE_NAME)
    return noStore(response)
  }
}
