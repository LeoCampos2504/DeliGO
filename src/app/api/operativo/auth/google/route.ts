import { NextRequest, NextResponse } from "next/server"
import { getOperationalAccountFromRequest } from "@/lib/auth"

// ============================================
// Bugfix-5C: Google OAuth para CuentaOperativa (empleado/mozo personal)
// ============================================
// Ruta DEDICADA — no comparte código con /api/auth/google (Cliente/Repartidor).
// Motivo (ver CLAUDE_REPORT.md sección 4): esta cuenta necesita un modo
// adicional (`mode=link`, vinculación autenticada) y reglas de account-linking
// deliberadamente distintas (nunca auto-link silencioso por email) — mezclar
// esa lógica dentro de las ramas existentes de Cliente/Repartidor arriesgaba
// ese código que hoy funciona. Cero líneas de /api/auth/google/* se tocaron.

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ""
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ""

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.APP_URL ||
  process.env.NEXTAUTH_URL ||
  "http://localhost:3000"

// Mismo cálculo en route.ts y callback/route.ts — Google exige que el
// `redirect_uri` de la autorización y el del intercambio de token coincidan
// exactamente. Deliberadamente NO reutiliza `GOOGLE_REDIRECT_URI` (esa
// variable, si está configurada, apunta al callback de Cliente/Repartidor).
function operativoRedirectUri(): string {
  return `${APP_URL}/api/operativo/auth/google/callback`
}

const OAUTH_STATE_COOKIE = "operativo_google_oauth_state"
const OAUTH_MODE_COOKIE = "operativo_google_oauth_mode"

function errorRedirect(reason: string) {
  const redirectUrl = new URL("/operaciones/ingresar", APP_URL)
  redirectUrl.searchParams.set("google", reason)
  return NextResponse.redirect(redirectUrl.toString())
}

// GET /api/operativo/auth/google[?mode=login|link]
// mode=login (default): inicia sesión con una CuentaOperativa existente, o
//   crea una nueva si el email de Google no pertenece a ninguna cuenta.
// mode=link: exige una sesión operativa YA autenticada y solo agrega Google
//   a esa cuenta puntual — nunca crea ni inicia sesión con otra identidad.
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

  const { searchParams } = new URL(req.url)
  const mode = searchParams.get("mode") === "link" ? "link" : "login"

  // La vinculación exige sesión operativa personal válida ANTES de mandar al
  // usuario a Google — nunca sesión de Cliente/Negocio/Repartidor, nunca
  // sesión de terminal (getOperationalAccountFromRequest solo lee la cookie
  // deligo_operativo_session).
  if (mode === "link") {
    const account = await getOperationalAccountFromRequest(req)
    if (!account) {
      return errorRedirect("error")
    }
  }

  const state = crypto.randomUUID()
  const redirectUri = operativoRedirectUri()

  const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth")
  googleAuthUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID)
  googleAuthUrl.searchParams.set("redirect_uri", redirectUri)
  googleAuthUrl.searchParams.set("response_type", "code")
  googleAuthUrl.searchParams.set("scope", "openid email profile")
  googleAuthUrl.searchParams.set("state", state)
  googleAuthUrl.searchParams.set("access_type", "offline")
  googleAuthUrl.searchParams.set("prompt", "consent")

  const response = NextResponse.redirect(googleAuthUrl.toString())

  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutos
  })

  // mode nunca se confía desde el callback vía query string — solo desde esta
  // cookie httpOnly, protegida por el mismo `state` de un solo uso.
  response.cookies.set(OAUTH_MODE_COOKIE, mode, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  })

  return response
}
