import { NextRequest, NextResponse } from "next/server"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"
import {
  isSuperadminGoogleConfigured,
  exchangeSuperadminGoogleCode,
  verifySuperadminGoogleIdToken,
} from "@/lib/superadmin-google-oauth"
import {
  SUPERADMIN_SESSION_COOKIE_NAME,
  SUPERADMIN_OAUTH_STATE_COOKIE,
  SUPERADMIN_OAUTH_NONCE_COOKIE,
  SUPERADMIN_OAUTH_PKCE_COOKIE,
  SUPERADMIN_SESSION_DURATION_HOURS,
  createSuperadminSession,
  bootstrapOrAuthenticateSuperadmin,
} from "@/lib/superadmin-auth"

// ============================================
// DeliGO Superadmin — Callback OAuth Google (24-A)
// ============================================
// GET /api/superadmin/auth/google/callback
//
// No confía en NADA del frontend más allá de `code`/`state`/`error` de la
// query string de Google. El `sub` nunca llega desde el cliente: se obtiene
// exclusivamente al validar el id_token server-side (issuer, audience,
// expiración, nonce, email_verified) contra el endpoint oficial de Google.
// Destino de redirect siempre fijo (`/admin`) — nunca acepta un parámetro de
// retorno del cliente, así que no existe superficie de open redirect.
//
// 24-A-CORRECCIÓN-1: runtime Node.js explícito — verifySuperadminGoogleIdToken
// usa `google-auth-library`, que depende del módulo `crypto` de Node
// (verificación RSA/EC real) y no corre en Edge. Ya era el default de
// Next.js para esta ruta (no hay `export const runtime = "edge"` en ningún
// ancestro), pero se declara explícito para que quede documentado y no se
// rompa si alguien intenta moverla a Edge más adelante.
export const runtime = "nodejs"

const OAUTH_COOKIE_PATH = "/api/superadmin/auth/google"

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.APP_URL ||
  process.env.NEXTAUTH_URL ||
  "http://localhost:3000"

type ErrorCode = "access_denied" | "invalid_request" | "not_authorized" | "server_error"

function redirectWithError(code: ErrorCode): NextResponse {
  const url = new URL("/admin", APP_URL)
  url.searchParams.set("superadmin_auth_error", code)
  const res = NextResponse.redirect(url.toString())
  res.headers.set("Cache-Control", "private, no-store")
  clearOAuthCookies(res)
  return res
}

function clearOAuthCookies(res: NextResponse): void {
  for (const name of [
    SUPERADMIN_OAUTH_STATE_COOKIE,
    SUPERADMIN_OAUTH_NONCE_COOKIE,
    SUPERADMIN_OAUTH_PKCE_COOKIE,
  ]) {
    res.cookies.set(name, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: OAUTH_COOKIE_PATH,
      maxAge: 0,
    })
  }
}

const NOT_AUTHORIZED_REASONS = new Set([
  "sub_ausente",
  "sub_no_coincide",
  "email_no_verificado",
  "bootstrap_deshabilitado",
  "bootstrap_email_no_coincide",
  "ya_vinculado_a_otro_sub",
  "superadmin_inactivo",
  "multiples_registros_incompatibles",
])

export async function GET(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = checkRateLimit("superadminOAuthCallback", ip)
  if (!rl.allowed) {
    // No se reutiliza rateLimitResponse() acá: devuelve un Response genérico
    // sin `.cookies`, y este handler necesita limpiar las cookies OAuth
    // temporales aunque la respuesta sea 429.
    const headers: Record<string, string> = { "Cache-Control": "private, no-store" }
    if (rl.retryAfterMs) headers["Retry-After"] = String(Math.ceil(rl.retryAfterMs / 1000))
    const res = NextResponse.json(
      { error: "Demasiados intentos. Intentá de nuevo más tarde." },
      { status: 429, headers }
    )
    clearOAuthCookies(res)
    return res
  }

  try {
    if (!isSuperadminGoogleConfigured()) {
      return redirectWithError("server_error")
    }

    const { searchParams } = new URL(req.url)
    const code = searchParams.get("code")
    const state = searchParams.get("state")
    const googleError = searchParams.get("error")

    if (googleError) {
      return redirectWithError("access_denied")
    }
    if (!code || !state) {
      return redirectWithError("invalid_request")
    }

    // Validación de `state` con comparación de igualdad simple: son tokens
    // aleatorios de 256 bits de un solo uso (la cookie se borra siempre en
    // este handler, sin importar el resultado) — no hay valor en agregar
    // comparación de tiempo constante para un secreto de esta entropía.
    const savedState = req.cookies.get(SUPERADMIN_OAUTH_STATE_COOKIE)?.value
    if (!savedState || savedState !== state) {
      return redirectWithError("invalid_request")
    }

    const nonce = req.cookies.get(SUPERADMIN_OAUTH_NONCE_COOKIE)?.value
    const codeVerifier = req.cookies.get(SUPERADMIN_OAUTH_PKCE_COOKIE)?.value
    if (!nonce || !codeVerifier) {
      return redirectWithError("invalid_request")
    }

    const tokenResult = await exchangeSuperadminGoogleCode({ code, codeVerifier })
    if (!tokenResult.ok) {
      return redirectWithError("invalid_request")
    }

    const verification = await verifySuperadminGoogleIdToken({
      idToken: tokenResult.idToken,
      expectedNonce: nonce,
    })
    if (!verification.ok) {
      return redirectWithError("invalid_request")
    }

    const authResult = await bootstrapOrAuthenticateSuperadmin(
      {
        sub: verification.claims.sub,
        email: verification.claims.email,
        emailVerified: verification.claims.emailVerified,
      },
      { ip }
    )

    if (!authResult.ok) {
      return redirectWithError(
        NOT_AUTHORIZED_REASONS.has(authResult.reason) ? "not_authorized" : "server_error"
      )
    }

    const sessionToken = await createSuperadminSession(authResult.id)

    const successUrl = new URL("/admin", APP_URL)
    const response = NextResponse.redirect(successUrl.toString())
    response.headers.set("Cache-Control", "private, no-store")
    clearOAuthCookies(response)
    response.cookies.set(SUPERADMIN_SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SUPERADMIN_SESSION_DURATION_HOURS * 60 * 60,
    })

    return response
  } catch (error) {
    // Nunca filtrar tokens/respuesta de Google/client secret — solo un
    // código sanitizado a consola.
    console.error("[SuperadminGoogleCallback] Error inesperado:", error instanceof Error ? error.message : "unknown")
    return redirectWithError("server_error")
  }
}
