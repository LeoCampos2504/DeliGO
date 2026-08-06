import { NextRequest, NextResponse } from "next/server"
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit"
import {
  isSuperadminGoogleConfigured,
  buildSuperadminGoogleAuthUrl,
  generateOAuthState,
  generateOAuthNonce,
  generatePkcePair,
} from "@/lib/superadmin-google-oauth"
import {
  SUPERADMIN_OAUTH_STATE_COOKIE,
  SUPERADMIN_OAUTH_NONCE_COOKIE,
  SUPERADMIN_OAUTH_PKCE_COOKIE,
  SUPERADMIN_OAUTH_COOKIE_MAX_AGE_SECONDS,
} from "@/lib/superadmin-auth"

// ============================================
// DeliGO Superadmin — Inicio de OAuth Google (24-A)
// ============================================
// GET /api/superadmin/auth/google — redirige a Google. Flujo completamente
// aislado de /api/auth/google y /api/operativo/auth/google: cookies, sesión
// y lógica de identidad propias, nunca compartidas.

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" } as const

// Cookie temporal restringida al propio flujo OAuth Superadmin — nunca se
// envía a otras rutas de la aplicación.
const OAUTH_COOKIE_PATH = "/api/superadmin/auth/google"

function setOAuthCookie(res: NextResponse, name: string, value: string): void {
  res.cookies.set(name, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: OAUTH_COOKIE_PATH,
    maxAge: SUPERADMIN_OAUTH_COOKIE_MAX_AGE_SECONDS,
  })
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = checkRateLimit("superadminOAuthStart", ip)
  if (!rl.allowed) {
    const res = rateLimitResponse(rl, "Demasiados intentos. Intentá de nuevo más tarde.")
    res.headers.set("Cache-Control", "private, no-store")
    return res
  }

  if (!isSuperadminGoogleConfigured()) {
    // Mensaje genérico — nunca revela qué variable falta.
    return NextResponse.json(
      { ok: false, error: "El acceso de administración no está disponible en este momento." },
      { status: 500, headers: NO_STORE_HEADERS }
    )
  }

  const state = generateOAuthState()
  const nonce = generateOAuthNonce()
  const { codeVerifier, codeChallenge } = generatePkcePair()

  const authUrl = buildSuperadminGoogleAuthUrl({ state, nonce, codeChallenge })

  const response = NextResponse.redirect(authUrl, { headers: NO_STORE_HEADERS })
  setOAuthCookie(response, SUPERADMIN_OAUTH_STATE_COOKIE, state)
  setOAuthCookie(response, SUPERADMIN_OAUTH_NONCE_COOKIE, nonce)
  setOAuthCookie(response, SUPERADMIN_OAUTH_PKCE_COOKIE, codeVerifier)

  return response
}
