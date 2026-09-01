import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { createSession, SESSION_COOKIE_NAME, SESSION_DURATION_HOURS } from "@/lib/auth"
import { safeErrorForLog } from "@/lib/log-safe-error"
import {
  type GoogleOAuthAccountType,
  signGoogleOAuthPendingIdentity,
  setGoogleOAuthPendingCookie,
} from "@/lib/google-oauth-pending"

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ""
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ""
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || ""

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.APP_URL ||
  process.env.NEXTAUTH_URL ||
  "http://localhost:3000"

interface GoogleTokenResponse {
  access_token: string
  id_token: string
  token_type: string
  expires_in: number
}

interface GoogleUserInfo {
  sub: string
  email: string
  email_verified: boolean
  name: string
  picture: string
  given_name: string
  family_name: string
}

// GET /api/auth/google/callback — Handle Google OAuth callback
// Supports both cliente and repartidor roles (determined by google_oauth_role cookie)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const code = searchParams.get("code")
    const state = searchParams.get("state")
    const error = searchParams.get("error")

    // Determine role from cookie (default to cliente)
    const role =
      req.cookies.get("google_oauth_role")?.value === "repartidor"
        ? "repartidor"
        : "cliente"

    // Error redirect helper.
    // IMPORTANT: use APP_URL, not req.url, to avoid redirects to 0.0.0.0 on Railway.
    const errorRedirect = (errorType: string) => {
      const basePath = role === "repartidor" ? "/repartidor" : "/cliente/"
      const redirectUrl = new URL(basePath, APP_URL)
      redirectUrl.searchParams.set("auth_error", errorType)
      return NextResponse.redirect(redirectUrl.toString())
    }

    // GOOGLE-OAUTH-TERMS-ACCEPTANCE-GATE-R1: redirect used for a brand-new
    // Google identity, or an existing one with zero persisted
    // LegalAcceptance evidence, instead of creating an account/session here.
    // The signed pending cookie is the only place sub/email/accountType/
    // existingAccountId travel — never a query param, never the URL.
    const redirectToConsentGate = async (identity: {
      sub: string
      email: string
      name: string
      accountType: GoogleOAuthAccountType
      existingAccountId: string | null
    }) => {
      const token = await signGoogleOAuthPendingIdentity(identity)
      const consentUrl = new URL("/auth/google/consentimiento", APP_URL)
      const response = NextResponse.redirect(consentUrl.toString())
      setGoogleOAuthPendingCookie(response, token)
      // These one-time cookies are already consumed by this callback — clear
      // them exactly like the normal success path does below.
      response.cookies.set("google_oauth_state", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      })
      response.cookies.set("google_oauth_role", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      })
      return response
    }

    // Handle user denial
    if (error) {
      return errorRedirect("access_denied")
    }

    if (!code || !state) {
      return errorRedirect("missing_params")
    }

    // Verify state for CSRF protection
    const savedState = req.cookies.get("google_oauth_state")?.value
    if (!savedState || savedState !== state) {
      return errorRedirect("invalid_state")
    }

    // Build redirect URI from the public app URL, not from HOSTNAME or request headers.
    const redirectUri =
      GOOGLE_REDIRECT_URI || `${APP_URL}/api/auth/google/callback`

    // Exchange code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    })

    if (!tokenResponse.ok) {
      // GLOBAL-LOGS-PII-1: nunca el body crudo de la respuesta de Google
      // (mismo criterio ya aplicado en operativo/auth/google/callback) — sólo
      // el status, suficiente para diagnosticar sin arriesgar datos echoed
      // por el proveedor.
      console.error(`Google token exchange failed (status=${tokenResponse.status})`)
      return errorRedirect("token_exchange")
    }

    const tokens: GoogleTokenResponse = await tokenResponse.json()

    // Get user info from Google
    const userResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })

    if (!userResponse.ok) {
      // GLOBAL-LOGS-PII-1: idem — nunca el body crudo (podría incluir datos
      // de perfil parcialmente ecoados por Google en el error).
      console.error(`Google user info failed (status=${userResponse.status})`)
      return errorRedirect("user_info")
    }

    const googleUser: GoogleUserInfo = await userResponse.json()

    if (!googleUser.email_verified) {
      return errorRedirect("email_not_verified")
    }

    // Create session and redirect URL based on role
    let userId: string

    if (role === "repartidor") {
      // Try to find existing repartidor by googleId or email
      let repartidor = await db.repartidor.findUnique({
        where: { googleId: googleUser.sub },
      })

      if (!repartidor) {
        // Try to find by email and link the Google account. Linking alone
        // never writes legal evidence — it only adds a sign-in method to an
        // account that already exists.
        const byEmail = await db.repartidor.findUnique({
          where: { email: googleUser.email.toLowerCase() },
        })
        if (byEmail) {
          repartidor = await db.repartidor.update({
            where: { id: byEmail.id },
            data: { googleId: googleUser.sub },
          })
        }
      }

      if (!repartidor) {
        return redirectToConsentGate({
          sub: googleUser.sub,
          email: googleUser.email,
          name: googleUser.name,
          accountType: "repartidor",
          existingAccountId: null,
        })
      }

      const hasAcceptance = await db.legalAcceptance.findFirst({
        where: { userId: repartidor.id, userType: "repartidor" },
      })
      if (!hasAcceptance) {
        return redirectToConsentGate({
          sub: googleUser.sub,
          email: googleUser.email,
          name: googleUser.name,
          accountType: "repartidor",
          existingAccountId: repartidor.id,
        })
      }

      userId = repartidor.id
    } else {
      // Cliente flow
      let cliente = await db.cliente.findUnique({
        where: { googleId: googleUser.sub },
      })

      if (!cliente) {
        // Try to find by email and link the Google account. Linking alone
        // never writes legal evidence — it only adds a sign-in method to an
        // account that already exists.
        const byEmail = await db.cliente.findUnique({
          where: { email: googleUser.email.toLowerCase() },
        })
        if (byEmail) {
          cliente = await db.cliente.update({
            where: { id: byEmail.id },
            data: { googleId: googleUser.sub },
          })
        }
      }

      if (!cliente) {
        return redirectToConsentGate({
          sub: googleUser.sub,
          email: googleUser.email,
          name: googleUser.name,
          accountType: "cliente",
          existingAccountId: null,
        })
      }

      const hasAcceptance = await db.legalAcceptance.findFirst({
        where: { userId: cliente.id, userType: "cliente" },
      })
      if (!hasAcceptance) {
        return redirectToConsentGate({
          sub: googleUser.sub,
          email: googleUser.email,
          name: googleUser.name,
          accountType: "cliente",
          existingAccountId: cliente.id,
        })
      }

      userId = cliente.id
    }

    // Create session
    const sessionToken = await createSession(userId, role)

    // Build redirect URL based on role.
    // IMPORTANT: use APP_URL, not req.url, to avoid redirects to 0.0.0.0 on Railway.
    const redirectBase = role === "repartidor" ? "/repartidor" : "/cliente/"
    const redirectUrl = new URL(redirectBase, APP_URL)

    redirectUrl.searchParams.set("auth_success", "google")

    const response = NextResponse.redirect(redirectUrl.toString())

    // Set session cookie
    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DURATION_HOURS * 60 * 60,
    })

    // Clear the OAuth state and role cookies
    response.cookies.set("google_oauth_state", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    })

    response.cookies.set("google_oauth_role", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    })

    return response
  } catch (error) {
    console.error("Google OAuth callback error:", safeErrorForLog(error))

    const role =
      req.cookies.get("google_oauth_role")?.value === "repartidor"
        ? "repartidor"
        : "cliente"
    const redirectUrl = new URL(role === "repartidor" ? "/repartidor" : "/cliente/", APP_URL)
    redirectUrl.searchParams.set("auth_error", "server_error")

    return NextResponse.redirect(redirectUrl.toString())
  }
}
