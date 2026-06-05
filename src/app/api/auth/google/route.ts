import { NextRequest, NextResponse } from "next/server"

// Google OAuth configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ""
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ""
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || ""

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.APP_URL ||
  process.env.NEXTAUTH_URL ||
  "http://localhost:3000"

// GET /api/auth/google — Redirect to Google OAuth consent screen
// Supports ?role=repartidor to indicate repartidor login (defaults to cliente)
export async function GET(req: NextRequest) {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return NextResponse.json(
      {
        error:
          "Google OAuth no está configurado. Agregá GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET a las variables de entorno.",
      },
      { status: 500 }
    )
  }

  // Determine the role (cliente or repartidor)
  const { searchParams } = new URL(req.url)
  const role =
    searchParams.get("role") === "repartidor" ? "repartidor" : "cliente"

  // Build the redirect URI from the public app URL.
  // IMPORTANT: do not use req.headers host/protocol here,
  // because Railway may expose internal values like 0.0.0.0.
  const redirectUri =
    GOOGLE_REDIRECT_URI || `${APP_URL}/api/auth/google/callback`

  // Generate a random state for CSRF protection
  const state = crypto.randomUUID()

  const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth")
  googleAuthUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID)
  googleAuthUrl.searchParams.set("redirect_uri", redirectUri)
  googleAuthUrl.searchParams.set("response_type", "code")
  googleAuthUrl.searchParams.set("scope", "openid email profile")
  googleAuthUrl.searchParams.set("state", state)
  googleAuthUrl.searchParams.set("access_type", "offline")
  googleAuthUrl.searchParams.set("prompt", "consent")

  const response = NextResponse.redirect(googleAuthUrl.toString())

  response.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes
  })

  // Store the role so the callback knows which user type to create
  response.cookies.set("google_oauth_role", role, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes
  })

  return response
}