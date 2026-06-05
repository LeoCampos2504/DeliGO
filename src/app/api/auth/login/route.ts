import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { comparePassword, createSession, SESSION_COOKIE_NAME, SESSION_DURATION_HOURS } from "@/lib/auth"
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit"

function setCookie(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
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
      return rateLimitResponse(rl, "Demasiados intentos. Intentá de nuevo en 5 minutos.")
    }

    const body = await req.json()
    const { tipo } = body

    switch (tipo) {
      case "cliente":
        return await loginCliente(body)
      case "negocio":
        return await loginNegocio(body)
      case "repartidor":
        return await loginRepartidor(body)
      case "superadmin":
        return await loginSuperAdmin(body)
      default:
        return NextResponse.json(
          { error: "Tipo de login inválido" },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}

async function loginCliente(data: { email: string; password: string }) {
  const { email, password } = data

  if (!email?.trim() || !password) {
    return NextResponse.json(
      { error: "Email y contraseña son obligatorios" },
      { status: 400 }
    )
  }

  const cliente = await db.cliente.findUnique({
    where: { email: email.toLowerCase().trim() },
  })

  if (!cliente || !cliente.password) {
    return NextResponse.json(
      { error: "Email o contraseña incorrectos" },
      { status: 401 }
    )
  }

  const valid = await comparePassword(password, cliente.password)
  if (!valid) {
    return NextResponse.json(
      { error: "Email o contraseña incorrectos" },
      { status: 401 }
    )
  }

  // Check email verification
  if (!cliente.emailVerified) {
    return NextResponse.json(
      { ok: false, needsVerification: true, email: cliente.email, userType: "cliente" },
      { status: 403 }
    )
  }

  const token = await createSession(cliente.id, "cliente")
  const res = NextResponse.json({
    ok: true,
    user: {
      id: cliente.id,
      type: "cliente",
      nombre: cliente.nombre,
      email: cliente.email,
      telefono: cliente.telefono,
    },
    token,
  })
  setCookie(res, token)
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

  const negocio = await db.negocio.findUnique({
    where: { usuario: usuario.trim() },
  })

  if (!negocio) {
    return NextResponse.json(
      { error: "Usuario o contraseña incorrectos" },
      { status: 401 }
    )
  }

  const valid = await comparePassword(password, negocio.password)
  if (!valid) {
    return NextResponse.json(
      { error: "Usuario o contraseña incorrectos" },
      { status: 401 }
    )
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
      token,
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
    token,
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

  const repartidor = await db.repartidor.findUnique({
    where: { email: email.toLowerCase().trim() },
  })

  if (!repartidor || !repartidor.password) {
    return NextResponse.json(
      { error: "Email o contraseña incorrectos" },
      { status: 401 }
    )
  }

  const valid = await comparePassword(password, repartidor.password)
  if (!valid) {
    return NextResponse.json(
      { error: "Email o contraseña incorrectos" },
      { status: 401 }
    )
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
    token,
  })
  setCookie(res, token)
  return res
}

async function loginSuperAdmin(data: { password: string }) {
  const { password } = data

  if (!password) {
    return NextResponse.json(
      { error: "Contraseña requerida" },
      { status: 400 }
    )
  }

  const admin = await db.superAdmin.findFirst()

  if (!admin) {
    return NextResponse.json(
      { error: "No existe una cuenta de administrador" },
      { status: 401 }
    )
  }

  const valid = await comparePassword(password, admin.password)
  if (!valid) {
    return NextResponse.json(
      { error: "Contraseña incorrecta" },
      { status: 401 }
    )
  }

  const token = await createSession(admin.id, "superadmin")
  const res = NextResponse.json({
    ok: true,
    user: {
      id: admin.id,
      type: "superadmin",
      nombre: "SuperAdmin",
    },
    token,
  })
  setCookie(res, token)
  return res
}
