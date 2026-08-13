import { NextRequest, NextResponse } from "next/server"
import {
  evaluatePasswordHash,
  createOperationalSession,
  OPERATIONAL_SESSION_COOKIE_NAME,
  SESSION_DURATION_HOURS,
} from "@/lib/auth"
import { db } from "@/lib/db"
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit"
import {
  checkLoginAccountThrottle,
  clearLoginFailures,
  LOGIN_THROTTLE_MESSAGE,
  loginThrottleKey,
  recordLoginFailure,
} from "@/lib/auth-login-throttle"
import { maybeUpgradePasswordHash } from "@/lib/password-hash-upgrade"
import { safeErrorForLog } from "@/lib/log-safe-error"

// AUTH-LOGIN-THROTTLE-HARDENING: mismo helper que src/app/api/auth/login/route.ts
// — no se extrajo a un módulo compartido porque cada ruta ya tiene su propio
// mensaje 401 genérico distinto; la lógica en sí (registrar fallo, decidir
// 429 vs 401) es la única parte reutilizable y es trivial. PRE-COMMIT FINAL
// CORRECTION: el mensaje 429 (LOGIN_THROTTLE_MESSAGE) se importa de
// auth-login-throttle.ts y es idéntico al usado por la dimensión IP de abajo
// y por la ruta de Cliente/Negocio/Repartidor — nunca un string local propio.
async function accountLoginFailureResponse(throttleKey: string, genericMessage: string) {
  const result = await recordLoginFailure(throttleKey)
  if (result?.throttled) {
    return rateLimitResponse({ retryAfterMs: result.retryAfterMs }, LOGIN_THROTTLE_MESSAGE)
  }
  return NextResponse.json({ error: genericMessage }, { status: 401 })
}

function noStore<T extends Response>(response: T): T {
  response.headers.set("Cache-Control", "private, no-store")
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

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req)
    const rl = checkRateLimit("login", ip)
    if (!rl.allowed) {
      return noStore(rateLimitResponse(rl, LOGIN_THROTTLE_MESSAGE))
    }

    const body = await req.json()
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    const password = typeof body.password === "string" ? body.password : ""

    if (!email || !password) {
      return noStore(
        NextResponse.json(
          { error: "Email y contraseña son obligatorios" },
          { status: 400 }
        )
      )
    }

    // AUTH-LOGIN-THROTTLE-HARDENING: throttleKey usa exactamente el mismo
    // `email` ya normalizado arriba (trim + lowercase) — el mismo valor que
    // el lookup de abajo, nunca una normalización distinta.
    const throttleKey = loginThrottleKey("cuenta_operativa", email)

    const throttle = await checkLoginAccountThrottle(throttleKey)
    if (!throttle.allowed) {
      return noStore(
        rateLimitResponse({ retryAfterMs: throttle.retryAfterMs }, LOGIN_THROTTLE_MESSAGE)
      )
    }

    const account = await db.cuentaOperativa.findUnique({
      where: { email },
      select: {
        id: true,
        nombre: true,
        email: true,
        password: true,
        activo: true,
        eliminado: true,
      },
    })

    // Nota: a diferencia de Cliente/Negocio/Repartidor, esta ruta ya
    // combinaba "cuenta inexistente" con "inactiva/eliminada" en la MISMA
    // rama 401 genérica ANTES de este hardening — comparePassword nunca se
    // ejecuta para una cuenta inactiva/eliminada aunque la contraseña sea
    // correcta. Se preserva esa secuencia real tal cual (no se reordena el
    // chequeo activo/eliminado a después de comparePassword, que sería un
    // cambio de comportamiento fuera de este alcance) — el throttle
    // simplemente registra un fallo en la misma rama que ya respondía 401
    // genérico, sin introducir ninguna distinción nueva observable.
    if (!account || !account.password || account.eliminado || !account.activo) {
      return noStore(await accountLoginFailureResponse(throttleKey, "Email o contraseña incorrectos"))
    }

    const evaluation = await evaluatePasswordHash(password, account.password)
    if (!evaluation.valid) {
      return noStore(await accountLoginFailureResponse(throttleKey, "Email o contraseña incorrectos"))
    }

    if (throttle.hadActiveFailures) {
      await clearLoginFailures(throttleKey)
    }

    // PASSWORD-HASH-WORKFACTOR-MIGRATION: sin más gates después del password
    // acá — activo/eliminado ya se filtraron en el lookup, antes de comparar.
    await maybeUpgradePasswordHash({
      accountType: "cuenta_operativa",
      accountId: account.id,
      plainPassword: password,
      oldStoredHash: account.password,
      needsUpgrade: evaluation.needsUpgrade,
    })

    const sessionToken = await createOperationalSession(account.id)
    const response = NextResponse.json({
      ok: true,
      cuenta: {
        id: account.id,
        nombre: account.nombre,
        email: account.email,
        activo: account.activo,
      },
    })
    setOperationalCookie(response, sessionToken)
    return noStore(response)
  } catch (error) {
    console.error("[OperativoLogin] Error:", safeErrorForLog(error))
    return noStore(
      NextResponse.json(
        { error: "Error interno del servidor" },
        { status: 500 }
      )
    )
  }
}
