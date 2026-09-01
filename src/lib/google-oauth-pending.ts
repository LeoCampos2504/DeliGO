// ============================================
// GOOGLE-OAUTH-TERMS-ACCEPTANCE-GATE-R1 — pending Google identity
// ============================================
// A brand-new Google identity (or an existing account with zero persisted
// LegalAcceptance evidence) must not get an account/session until the user
// explicitly accepts Terms/Privacy on a real consent screen. This token is
// how that verified-but-not-yet-consented identity survives the one
// redirect from /api/auth/google/callback to /auth/google/consentimiento
// and back to /api/auth/google/consent — signed and short-lived so the
// client can never spoof sub/email/accountType/existingAccountId, following
// the same jose HS256 short-TTL pattern already used for realtime tokens in
// src/lib/realtime-auth.ts. Dedicated secret, never reused across domains —
// same rationale as REGISTRATION_LIMIT_SECRET in
// src/lib/operativo-registration-limit.ts.

import { randomUUID } from "crypto"
import { jwtVerify, SignJWT, type JWTPayload } from "jose"
import type { NextResponse } from "next/server"

export const GOOGLE_OAUTH_PENDING_ISSUER = "deligo-google-oauth-pending"
export const GOOGLE_OAUTH_PENDING_AUDIENCE = "deligo-google-oauth-pending"
// Same 10-minute window already used for google_oauth_state/google_oauth_role
// in src/app/api/auth/google/route.ts — one consistent OAuth-flow TTL.
export const GOOGLE_OAUTH_PENDING_TTL_SECONDS = 600
export const GOOGLE_OAUTH_PENDING_COOKIE_NAME = "google_oauth_pending"
const PENDING_KIND = "google-oauth-pending-consent"

export type GoogleOAuthAccountType = "cliente" | "repartidor"

export interface GoogleOAuthPendingClaims extends JWTPayload {
  kind: typeof PENDING_KIND
  sub: string
  email: string
  name: string
  accountType: GoogleOAuthAccountType
  // Cuenta DeliGO ya existente (encontrada por googleId o por email en el
  // callback) a la que sólo falta escribir LegalAcceptance — null cuando la
  // identidad de Google es enteramente nueva y todavía no existe cuenta.
  existingAccountId: string | null
}

function getSecret(): Uint8Array {
  const secret = process.env.GOOGLE_OAUTH_PENDING_SECRET?.trim()
  if (!secret || secret.length < 32) {
    throw new Error("GOOGLE_OAUTH_PENDING_SECRET is missing or too short")
  }
  return new TextEncoder().encode(secret)
}

export async function signGoogleOAuthPendingIdentity(input: {
  sub: string
  email: string
  name: string
  accountType: GoogleOAuthAccountType
  existingAccountId: string | null
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({
    kind: PENDING_KIND,
    sub: input.sub,
    email: input.email,
    name: input.name,
    accountType: input.accountType,
    existingAccountId: input.existingAccountId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(GOOGLE_OAUTH_PENDING_ISSUER)
    .setAudience(GOOGLE_OAUTH_PENDING_AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + GOOGLE_OAUTH_PENDING_TTL_SECONDS)
    .setJti(randomUUID())
    .sign(getSecret())
}

// Nunca lanza — cualquier problema (firma inválida, vencido, forma
// incorrecta) resuelve a null, para que el caller siempre trate un token
// inválido igual que "no hay identidad pendiente".
export async function verifyGoogleOAuthPendingIdentity(
  token: string | undefined
): Promise<GoogleOAuthPendingClaims | null> {
  if (typeof token !== "string" || token.length < 32 || token.length > 4096) return null

  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ["HS256"],
      issuer: GOOGLE_OAUTH_PENDING_ISSUER,
      audience: GOOGLE_OAUTH_PENDING_AUDIENCE,
    })

    if (payload.kind !== PENDING_KIND) return null
    if (typeof payload.sub !== "string" || !payload.sub) return null
    if (typeof payload.email !== "string" || !payload.email) return null
    if (typeof payload.name !== "string") return null
    if (payload.accountType !== "cliente" && payload.accountType !== "repartidor") return null
    if (payload.existingAccountId !== null && typeof payload.existingAccountId !== "string") return null

    return payload as GoogleOAuthPendingClaims
  } catch {
    return null
  }
}

function cookieFlags(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  }
}

export function setGoogleOAuthPendingCookie(response: NextResponse, token: string): void {
  response.cookies.set(GOOGLE_OAUTH_PENDING_COOKIE_NAME, token, cookieFlags(GOOGLE_OAUTH_PENDING_TTL_SECONDS))
}

export function clearGoogleOAuthPendingCookie(response: NextResponse): void {
  response.cookies.set(GOOGLE_OAUTH_PENDING_COOKIE_NAME, "", cookieFlags(0))
}
