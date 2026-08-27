import { NextRequest, NextResponse } from "next/server"
import { isSesionActiveById } from "@/lib/auth"
import { createInternalSessionCheckAuth } from "@/lib/internal-session-check-auth"

// Autoridad interna de validación de sesión (P2-T11 Phase A) — consumida
// exclusivamente por el chat-service en connect-time (Phase B). Inerte
// hasta que Phase B exista: ningún código de producto llama esta ruta
// todavía. Nunca acepta identidad de actor del cliente, sólo `sid`
// (Sesion.id) — el chat-service ya verificó criptográficamente ese `sid`
// contra el JWT antes de preguntar.

const SID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/

const auth = createInternalSessionCheckAuth()

function noStore<T extends NextResponse>(response: T): T {
  response.headers.set("Cache-Control", "private, no-store")
  return response
}

export async function POST(req: NextRequest) {
  let rawBody: string
  try {
    rawBody = await req.text()
  } catch {
    return noStore(NextResponse.json({ error: "Invalid request body" }, { status: 400 }))
  }

  const authResult = auth.verify(req.headers, rawBody)
  if (!authResult.ok) {
    console.warn("[Realtime Internal Session] rejected category=" + authResult.code)
    const status = authResult.code === "AUTH_UNAVAILABLE" ? 503 : 401
    return noStore(NextResponse.json({ error: "Unauthorized" }, { status }))
  }

  let sid: unknown
  try {
    const parsed = JSON.parse(rawBody) as { sid?: unknown } | null
    sid = parsed?.sid
  } catch {
    return noStore(NextResponse.json({ error: "Invalid request body" }, { status: 400 }))
  }

  if (typeof sid !== "string" || !SID_PATTERN.test(sid)) {
    return noStore(NextResponse.json({ error: "Invalid request body" }, { status: 400 }))
  }

  try {
    const valid = await isSesionActiveById(sid)
    return noStore(NextResponse.json({ valid }))
  } catch {
    console.warn("[Realtime Internal Session] error category=session_lookup_failed")
    return noStore(NextResponse.json({ error: "Internal error" }, { status: 500 }))
  }
}
