import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { createSession, SESSION_COOKIE_NAME, SESSION_DURATION_HOURS } from "@/lib/auth"

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ""
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ""
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || ""

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
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const code = searchParams.get("code")
    const state = searchParams.get("state")
    const error = searchParams.get("error")

    // Handle user denial
    if (error) {
      return NextResponse.redirect(new URL(`/?auth_error=access_denied`, req.url))
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL("/?auth_error=missing_params", req.url))
    }

    // Verify state for CSRF protection
    const savedState = req.cookies.get("google_oauth_state")?.value
    if (!savedState || savedState !== state) {
      return NextResponse.redirect(new URL("/?auth_error=invalid_state", req.url))
    }

    // Build redirect URI
    const host = req.headers.get("host") || "localhost:3000"
    const protocol = req.headers.get("x-forwarded-proto") || "https"
    const redirectUri = GOOGLE_REDIRECT_URI || `${protocol}://${host}/api/auth/google/callback`

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
      console.error("Google token exchange failed:", await tokenResponse.text())
      return NextResponse.redirect(new URL("/?auth_error=token_exchange", req.url))
    }

    const tokens: GoogleTokenResponse = await tokenResponse.json()

    // Get user info from Google
    const userResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })

    if (!userResponse.ok) {
      console.error("Google user info failed:", await userResponse.text())
      return NextResponse.redirect(new URL("/?auth_error=user_info", req.url))
    }

    const googleUser: GoogleUserInfo = await userResponse.json()

    if (!googleUser.email_verified) {
      return NextResponse.redirect(new URL("/?auth_error=email_not_verified", req.url))
    }

    // Try to find existing cliente by googleId or email
    let cliente = await db.cliente.findUnique({
      where: { googleId: googleUser.sub },
    })

    if (!cliente) {
      // Try to find by email and link the Google account
      cliente = await db.cliente.findUnique({
        where: { email: googleUser.email.toLowerCase() },
      })

      if (cliente) {
        // Link Google account to existing email account
        cliente = await db.cliente.update({
          where: { id: cliente.id },
          data: { googleId: googleUser.sub },
        })
      } else {
        // Create new cliente with Google account (no password)
        // Google already verified the email, so set emailVerified automatically
        cliente = await db.cliente.create({
          data: {
            nombre: googleUser.name,
            email: googleUser.email.toLowerCase(),
            password: null, // Google users don't have passwords
            googleId: googleUser.sub,
            telefono: "",
            emailVerified: new Date(), // Google already verified the email
          },
        })
      }
    }

    // Create session
    const sessionToken = await createSession(cliente.id, "cliente")

    // Build redirect URL with user data
    const redirectUrl = new URL("/", req.url)
    redirectUrl.searchParams.set("auth_success", "google")
    redirectUrl.searchParams.set("user_id", cliente.id)
    redirectUrl.searchParams.set("user_name", cliente.nombre)
    redirectUrl.searchParams.set("user_email", cliente.email)
    redirectUrl.searchParams.set("user_type", "cliente")
    redirectUrl.searchParams.set("token", sessionToken)

    const response = NextResponse.redirect(redirectUrl.toString())

    // Set session cookie
    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DURATION_HOURS * 60 * 60,
    })

    // Clear the OAuth state cookie
    response.cookies.set("google_oauth_state", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    })

    return response
  } catch (error) {
    console.error("Google OAuth callback error:", error)
    return NextResponse.redirect(new URL("/?auth_error=server_error", req.url))
  }
}
