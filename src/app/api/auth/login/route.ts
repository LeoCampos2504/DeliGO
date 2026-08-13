import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { comparePassword, createSession, SESSION_COOKIE_NAME, SESSION_DURATION_HOURS } from "@/lib/auth"
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit"
import {
  checkLoginAccountThrottle,
  clearLoginFailures,
  LOGIN_THROTTLE_MESSAGE,
  loginThrottleKey,
  recordLoginFailure,
} from "@/lib/auth-login-throttle"
import { getOrCreateDeviceIdentity, setDeviceCookie } from "@/lib/device-identity"
import { ensureClienteBloqueadoRecordForDevice } from "@/lib/client-block-security"
import { safeErrorForLog } from "@/lib/log-safe-error"

function setCookie(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_HOURS * 60 * 60,
  })
}

// AUTH-LOGIN-THROTTLE-HARDENING: dimensión por cuenta, compartida vía
// PostgreSQL (src/lib/auth-login-throttle.ts) — independiente del límite por
// IP de arriba. Se llama SOLO cuando la cuenta no existe o la contraseña es
// incorrecta (nunca en estados posteriores como email no verificado/negocio
// no aprobado/etc. — ver §25 del hardening). PRE-COMMIT FINAL CORRECTION:
// ambas dimensiones reutilizan el mismo LOGIN_THROTTLE_MESSAGE (importado de
// auth-login-throttle.ts, nunca duplicado localmente) para que el body de un
// 429 nunca revele cuál de las dos lo disparó. Retry-After sí puede diferir
// legítimamente entre dimensiones (reflejan ventanas distintas, 5min vs
// 10min) — eso no es una fuga, es el tiempo real de espera.
async function accountLoginFailureResponse(throttleKey: string, genericMessage: string) {
  const result = await recordLoginFailure(throttleKey)
  if (result?.throttled) {
    return rateLimitResponse({ retryAfterMs: result.retryAfterMs }, LOGIN_THROTTLE_MESSAGE)
  }
  return NextResponse.json({ error: genericMessage }, { status: 401 })
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req)
    const rl = checkRateLimit("login", ip)
    if (!rl.allowed) {
      return rateLimitResponse(rl, LOGIN_THROTTLE_MESSAGE)
    }

    const body = await req.json()
    const { tipo } = body

    switch (tipo) {
      case "cliente":
        return await loginCliente(body, req)
      case "negocio":
        return await loginNegocio(body)
      case "repartidor":
        return await loginRepartidor(body)
      // 24-A: el acceso Superadmin por clave común queda retirado por
      // completo — "superadmin" ya no es un `tipo` reconocido acá. El único
      // camino de autenticación es Google OAuth vía
      // /api/superadmin/auth/google (ver src/lib/superadmin-auth.ts).
      default:
        return NextResponse.json(
          { error: "Tipo de login inválido" },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error("Login error:", safeErrorForLog(error))
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}

async function loginCliente(data: { email: string; password: string }, req: NextRequest) {
  const { email, password } = data

  if (!email?.trim() || !password) {
    return NextResponse.json(
      { error: "Email y contraseña son obligatorios" },
      { status: 400 }
    )
  }

  const normalizedEmail = email.toLowerCase().trim()
  const throttleKey = loginThrottleKey("cliente", normalizedEmail)

  const throttle = await checkLoginAccountThrottle(throttleKey)
  if (!throttle.allowed) {
    return rateLimitResponse({ retryAfterMs: throttle.retryAfterMs }, LOGIN_THROTTLE_MESSAGE)
  }

  const cliente = await db.cliente.findUnique({
    where: { email: normalizedEmail },
  })

  if (!cliente || !cliente.password) {
    return accountLoginFailureResponse(throttleKey, "Email o contraseña incorrectos")
  }

  const valid = await comparePassword(password, cliente.password)
  if (!valid) {
    return accountLoginFailureResponse(throttleKey, "Email o contraseña incorrectos")
  }

  if (throttle.hadActiveFailures) {
    await clearLoginFailures(throttleKey)
  }

  // Check email verification
  if (!cliente.emailVerified) {
    return NextResponse.json(
      { ok: false, needsVerification: true, email: cliente.email, userType: "cliente" },
      { status: 403 }
    )
  }

  const token = await createSession(cliente.id, "cliente")

  // SEC-DEVICE-1: sólo rellena el device id si la cuenta todavía no tiene
  // ninguno (cuentas creadas antes de esta tarea, o cuya cookie se perdió
  // antes del primer registro/pedido) — nunca sobrescribe un valor ya
  // presente en cada login. Una cuenta usada legítimamente desde varios
  // dispositivos no debe perder silenciosamente la señal de un dispositivo
  // anterior sólo por loguearse de nuevo desde otro; el checkout (acción
  // menos frecuente y más relevante para seguridad) sigue actualizando el
  // valor en cada pedido, igual que ya hace con `ultimoIp`.
  const deviceIdentity = getOrCreateDeviceIdentity(req)
  if (!cliente.dispositivoFingerprint) {
    await db.cliente.updateMany({
      where: { id: cliente.id, dispositivoFingerprint: "" },
      data: { dispositivoFingerprint: deviceIdentity.deviceId },
    })
  }

  // SEC-BLOCK-1: el login de una cuenta ya bloqueada sigue permitido sin
  // cambios (nunca se rechaza acá, nunca se invalida la sesión) — solo se
  // enriquece el registro ClienteBloqueado con el dispositivo actual, para
  // que una futura cuenta nueva creada desde este mismo dispositivo sea
  // detectada como evasión (ver findForeignDeviceBlockMatch en
  // src/lib/client-block-security.ts). La IP nunca decide esto.
  if (cliente.bloqueado) {
    await ensureClienteBloqueadoRecordForDevice(db, {
      clienteId: cliente.id,
      clienteNombre: cliente.nombre,
      deviceId: deviceIdentity.deviceId,
      ip: getClientIp(req),
    })
  }

  const res = NextResponse.json({
    ok: true,
    user: {
      id: cliente.id,
      type: "cliente",
      nombre: cliente.nombre,
      email: cliente.email,
      telefono: cliente.telefono,
    },
  })
  setCookie(res, token)
  if (deviceIdentity.isNew) {
    setDeviceCookie(res, deviceIdentity.token)
  }
  return res
}

async function loginNegocio(data: { usuario: string; password: string }) {
  const { usuario, password } = data

  if (!usuario?.trim() || !password) {
    return NextResponse.json(
      { error: "Usuario y contraseña son obligatorios" },
      { status: 400 }
    )
  }

  const normalizedUsuario = usuario.trim()
  const throttleKey = loginThrottleKey("negocio", normalizedUsuario)

  const throttle = await checkLoginAccountThrottle(throttleKey)
  if (!throttle.allowed) {
    return rateLimitResponse({ retryAfterMs: throttle.retryAfterMs }, LOGIN_THROTTLE_MESSAGE)
  }

  const negocio = await db.negocio.findUnique({
    where: { usuario: normalizedUsuario },
  })

  if (!negocio) {
    return accountLoginFailureResponse(throttleKey, "Usuario o contraseña incorrectos")
  }

  const valid = await comparePassword(password, negocio.password)
  if (!valid) {
    return accountLoginFailureResponse(throttleKey, "Usuario o contraseña incorrectos")
  }

  if (throttle.hadActiveFailures) {
    await clearLoginFailures(throttleKey)
  }

  // Check email verification BEFORE aprobado check
  if (!negocio.emailVerified) {
    return NextResponse.json(
      { ok: false, needsVerification: true, email: negocio.email, userType: "negocio" },
      { status: 403 }
    )
  }

  if (!negocio.aprobado) {
    return NextResponse.json({
      ok: true,
      needsApproval: true,
      negocio: {
        id: negocio.id,
        slug: negocio.slug,
        nombre: negocio.nombre,
        aprobado: false,
      },
    })
  }

  if (negocio.suspendido) {
    // Allow login but mark as suspended so the frontend shows a contact banner
    const token = await createSession(negocio.id, "negocio")
    const res = NextResponse.json({
      ok: true,
      suspended: true,
      user: {
        id: negocio.id,
        type: "negocio",
        nombre: negocio.nombre,
        slug: negocio.slug,
        rubro: negocio.rubro,
        aprobado: negocio.aprobado,
        suspendido: true,
      },
    })
    setCookie(res, token)
    return res
  }

  const token = await createSession(negocio.id, "negocio")
  const res = NextResponse.json({
    ok: true,
    user: {
      id: negocio.id,
      type: "negocio",
      nombre: negocio.nombre,
      slug: negocio.slug,
      rubro: negocio.rubro,
      aprobado: negocio.aprobado,
    },
  })
  setCookie(res, token)
  return res
}

async function loginRepartidor(data: { email: string; password: string }) {
  const { email, password } = data

  if (!email?.trim() || !password) {
    return NextResponse.json(
      { error: "Email y contraseña son obligatorios" },
      { status: 400 }
    )
  }

  const normalizedEmail = email.toLowerCase().trim()
  const throttleKey = loginThrottleKey("repartidor", normalizedEmail)

  const throttle = await checkLoginAccountThrottle(throttleKey)
  if (!throttle.allowed) {
    return rateLimitResponse({ retryAfterMs: throttle.retryAfterMs }, LOGIN_THROTTLE_MESSAGE)
  }

  const repartidor = await db.repartidor.findUnique({
    where: { email: normalizedEmail },
  })

  if (!repartidor || !repartidor.password) {
    return accountLoginFailureResponse(throttleKey, "Email o contraseña incorrectos")
  }

  const valid = await comparePassword(password, repartidor.password)
  if (!valid) {
    return accountLoginFailureResponse(throttleKey, "Email o contraseña incorrectos")
  }

  if (throttle.hadActiveFailures) {
    await clearLoginFailures(throttleKey)
  }

  // Check email verification
  if (!repartidor.emailVerified) {
    return NextResponse.json(
      { ok: false, needsVerification: true, email: repartidor.email, userType: "repartidor" },
      { status: 403 }
    )
  }

  if (!repartidor.activo) {
    return NextResponse.json(
      { error: "Tu cuenta está desactivada. Contactá al administrador." },
      { status: 403 }
    )
  }

  const token = await createSession(repartidor.id, "repartidor")
  const res = NextResponse.json({
    ok: true,
    user: {
      id: repartidor.id,
      type: "repartidor",
      nombre: repartidor.nombre,
      email: repartidor.email,
      activo: repartidor.activo,
    },
  })
  setCookie(res, token)
  return res
}
