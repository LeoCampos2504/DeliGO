import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import {
  createOperationalSession,
  getOperationalAccountFromRequest,
  OPERATIONAL_SESSION_COOKIE_NAME,
  SESSION_DURATION_HOURS,
} from "@/lib/auth"
import { auditLog } from "@/lib/audit"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"

// ============================================
// Bugfix-5C: callback de Google OAuth para CuentaOperativa
// ============================================
// Ver src/app/api/operativo/auth/google/route.ts para la justificación de
// por qué esta es una ruta dedicada y no una rama agregada al callback de
// Cliente/Repartidor (src/app/api/auth/google/callback/route.ts, sin tocar).
//
// Reglas de seguridad centrales de esta etapa (no negociables):
//   - Nunca auto-link silencioso: si el email de Google ya existe en
//     CuentaOperativa sin googleId, NO se vincula ni se inicia sesión acá —
//     se redirige a un mensaje explícito para que el usuario entre con su
//     contraseña y vincule Google desde su cuenta ya autenticada.
//   - mode=link siempre revalida la sesión operativa real (cookie), nunca
//     confía en un id que hubiera podido viajar por query string.
//   - mode=link exige que el email de Google coincida exactamente con el
//     email de la cuenta autenticada, y nunca sobrescribe un googleId ya
//     distinto guardado en esa cuenta.
//   - Crear una cuenta nueva por Google nunca la vincula a ningún negocio.

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ""
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ""

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.APP_URL ||
  process.env.NEXTAUTH_URL ||
  "http://localhost:3000"

function operativoRedirectUri(): string {
  return `${APP_URL}/api/operativo/auth/google/callback`
}

const OAUTH_STATE_COOKIE = "operativo_google_oauth_state"
const OAUTH_MODE_COOKIE = "operativo_google_oauth_mode"

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
}

function clearOAuthCookies(response: NextResponse) {
  response.cookies.set(OAUTH_STATE_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })
  response.cookies.set(OAUTH_MODE_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })
}

// Redirige a una ruta interna fija (nunca tomada del request) con un único
// parámetro `google=<reason>` — nunca IDs, tokens ni datos de otra cuenta.
function redirectWithReason(path: string, reason: string): NextResponse {
  const redirectUrl = new URL(path, APP_URL)
  redirectUrl.searchParams.set("google", reason)
  const response = NextResponse.redirect(redirectUrl.toString())
  clearOAuthCookies(response)
  return response
}

// Login/creación exitosa: va directo al panel personal, sin parámetro —
// mismo destino y mismo silencio que ya usa el login por contraseña
// (router.replace("/operaciones/mi-panel") en /operaciones/ingresar, sin
// ningún banner de éxito tampoco ahí).
function redirectToPanel(): NextResponse {
  const redirectUrl = new URL("/operaciones/mi-panel", APP_URL)
  const response = NextResponse.redirect(redirectUrl.toString())
  clearOAuthCookies(response)
  return response
}

function setOperationalCookie(response: NextResponse, token: string) {
  response.cookies.set(OPERATIONAL_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_HOURS * 60 * 60,
  })
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req)
  try {
    // Mismo tipo de límite que ya usa el login por contraseña de CuentaOperativa
    // — no se deja este intercambio de token sin ningún límite.
    const rl = checkRateLimit("login", ip)
    if (!rl.allowed) {
      return redirectWithReason("/operaciones/ingresar", "error")
    }

    const { searchParams } = new URL(req.url)
    const code = searchParams.get("code")
    const state = searchParams.get("state")
    const oauthError = searchParams.get("error")

    // mode nunca se lee de la query string — solo de la cookie httpOnly que
    // esta misma ruta puso antes de mandar al usuario a Google.
    const mode = req.cookies.get(OAUTH_MODE_COOKIE)?.value === "link" ? "link" : "login"

    if (oauthError) {
      return redirectWithReason("/operaciones/ingresar", "error")
    }
    if (!code || !state) {
      return redirectWithReason("/operaciones/ingresar", "error")
    }

    const savedState = req.cookies.get(OAUTH_STATE_COOKIE)?.value
    if (!savedState || savedState !== state) {
      return redirectWithReason("/operaciones/ingresar", "error")
    }

    // mode=link: revalidar AHORA que sigue existiendo una sesión operativa
    // válida (pudo cerrarse/vencer durante el ida y vuelta a Google).
    let linkingAccountId: string | null = null
    let linkingAccountEmail: string | null = null
    if (mode === "link") {
      const account = await getOperationalAccountFromRequest(req)
      if (!account) {
        return redirectWithReason("/operaciones/ingresar", "error")
      }
      linkingAccountId = account.id
      linkingAccountEmail = account.email
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: operativoRedirectUri(),
        grant_type: "authorization_code",
      }),
    })

    if (!tokenResponse.ok) {
      console.error("[OperativoGoogle] Token exchange failed")
      return redirectWithReason("/operaciones/ingresar", "error")
    }

    const tokens: GoogleTokenResponse = await tokenResponse.json()

    const userResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })

    if (!userResponse.ok) {
      console.error("[OperativoGoogle] User info failed")
      return redirectWithReason("/operaciones/ingresar", "error")
    }

    const googleUser: GoogleUserInfo = await userResponse.json()

    if (!googleUser.email_verified) {
      return redirectWithReason("/operaciones/ingresar", "error")
    }

    const googleEmail = googleUser.email.toLowerCase().trim()

    // ============================================
    // mode = link — vinculación autenticada
    // ============================================
    if (mode === "link" && linkingAccountId && linkingAccountEmail) {
      if (googleEmail !== linkingAccountEmail.toLowerCase().trim()) {
        await auditLog({
          userId: linkingAccountId,
          userType: "cuenta_operativa",
          accion: "operativo.google_error",
          recurso: "cuenta_operativa",
          recursoId: linkingAccountId,
          detalle: { motivo: "email_no_coincide" },
          ip,
        })
        return redirectWithReason("/operaciones/cuenta", "email-mismatch")
      }

      // ¿Ese googleId ya pertenece a OTRA cuenta?
      const googleIdOwner = await db.cuentaOperativa.findUnique({
        where: { googleId: googleUser.sub },
        select: { id: true },
      })
      if (googleIdOwner && googleIdOwner.id !== linkingAccountId) {
        await auditLog({
          userId: linkingAccountId,
          userType: "cuenta_operativa",
          accion: "operativo.google_error",
          recurso: "cuenta_operativa",
          recursoId: linkingAccountId,
          detalle: { motivo: "google_id_en_uso" },
          ip,
        })
        return redirectWithReason("/operaciones/cuenta", "error")
      }

      const current = await db.cuentaOperativa.findFirst({
        where: { id: linkingAccountId, activo: true, eliminado: false },
        select: { id: true, googleId: true, emailVerified: true },
      })
      if (!current) {
        return redirectWithReason("/operaciones/ingresar", "error")
      }

      if (current.googleId && current.googleId !== googleUser.sub) {
        // Ya tiene otro Google vinculado — nunca sobrescribir silenciosamente.
        await auditLog({
          userId: current.id,
          userType: "cuenta_operativa",
          accion: "operativo.google_error",
          recurso: "cuenta_operativa",
          recursoId: current.id,
          detalle: { motivo: "cuenta_con_otro_google" },
          ip,
        })
        return redirectWithReason("/operaciones/cuenta", "error")
      }

      if (!current.googleId) {
        await db.cuentaOperativa.update({
          where: { id: current.id },
          data: {
            googleId: googleUser.sub,
            emailVerified: current.emailVerified ?? new Date(),
          },
        })
        await auditLog({
          userId: current.id,
          userType: "cuenta_operativa",
          accion: "operativo.google_vinculado",
          recurso: "cuenta_operativa",
          recursoId: current.id,
          detalle: {},
          ip,
        })
      }
      // Si ya era exactamente ese mismo googleId: éxito idempotente, sin re-escribir nada.

      const sessionToken = await createOperationalSession(current.id)
      const response = redirectWithReason("/operaciones/cuenta", "linked")
      setOperationalCookie(response, sessionToken)
      return response
    }

    // ============================================
    // mode = login — inicio de sesión o creación de cuenta
    // ============================================
    const byGoogleId = await db.cuentaOperativa.findUnique({
      where: { googleId: googleUser.sub },
    })

    if (byGoogleId) {
      if (!byGoogleId.activo || byGoogleId.eliminado) {
        await auditLog({
          userId: byGoogleId.id,
          userType: "cuenta_operativa",
          accion: "operativo.google_error",
          recurso: "cuenta_operativa",
          recursoId: byGoogleId.id,
          detalle: { motivo: "cuenta_inactiva" },
          ip,
        })
        return redirectWithReason("/operaciones/ingresar", "account-disabled")
      }

      const sessionToken = await createOperationalSession(byGoogleId.id)
      const response = redirectToPanel()
      setOperationalCookie(response, sessionToken)
      await auditLog({
        userId: byGoogleId.id,
        userType: "cuenta_operativa",
        accion: "operativo.google_login",
        recurso: "cuenta_operativa",
        recursoId: byGoogleId.id,
        detalle: {},
        ip,
      })
      return response
    }

    // No existe por googleId — buscar por email. NUNCA vincular acá.
    const byEmail = await db.cuentaOperativa.findUnique({
      where: { email: googleEmail },
    })

    if (byEmail) {
      await auditLog({
        userId: byEmail.id,
        userType: "cuenta_operativa",
        accion: "operativo.google_error",
        recurso: "cuenta_operativa",
        recursoId: byEmail.id,
        detalle: { motivo: "email_existente_sin_google" },
        ip,
      })
      return redirectWithReason("/operaciones/ingresar", "existing-password-account")
    }

    // No existe ni por googleId ni por email — crear cuenta nueva. Nunca
    // queda vinculada a ningún negocio: eso sigue requiriendo el código de
    // incorporación que emite el negocio, después de este login.
    try {
      const created = await db.cuentaOperativa.create({
        data: {
          nombre: googleUser.name || googleEmail,
          email: googleEmail,
          password: null,
          googleId: googleUser.sub,
          emailVerified: new Date(),
        },
      })

      const sessionToken = await createOperationalSession(created.id)
      const response = redirectToPanel()
      setOperationalCookie(response, sessionToken)
      await auditLog({
        userId: created.id,
        userType: "cuenta_operativa",
        accion: "operativo.google_cuenta_creada",
        recurso: "cuenta_operativa",
        recursoId: created.id,
        detalle: {},
        ip,
      })
      return response
    } catch (createError) {
      // Condición de carrera: otra request creó la misma cuenta (mismo email
      // o mismo googleId) entre el findUnique y el create. Reconsultar de
      // forma segura en vez de devolver el error crudo de Prisma.
      console.error("[OperativoGoogle] Race al crear cuenta:", createError)
      const retryAccount = await db.cuentaOperativa.findFirst({
        where: { OR: [{ googleId: googleUser.sub }, { email: googleEmail }] },
      })
      if (retryAccount && retryAccount.googleId === googleUser.sub && retryAccount.activo && !retryAccount.eliminado) {
        const sessionToken = await createOperationalSession(retryAccount.id)
        const response = redirectToPanel()
        setOperationalCookie(response, sessionToken)
        return response
      }
      return redirectWithReason("/operaciones/ingresar", "error")
    }
  } catch (error) {
    console.error("[OperativoGoogle] Callback error:", error)
    return redirectWithReason("/operaciones/ingresar", "error")
  }
}
