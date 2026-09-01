import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { hashPassword } from "@/lib/auth"
import { generateSlug } from "@/lib/utils"
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit"
import { sendVerificationEmail, generateVerificationToken } from "@/lib/email"
import { getOrCreateDeviceIdentity, setDeviceCookie } from "@/lib/device-identity"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { validatePassword } from "@/lib/password-policy"
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from "@/lib/legal-versions"

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req)
    const rl = checkRateLimit("register", ip)
    if (!rl.allowed) {
      return rateLimitResponse(rl, "Demasiados intentos de registro. Intentá de nuevo en 1 hora.")
    }

    const body = await req.json()
    const { tipo, termsAccepted } = body

    // Verify terms acceptance (legal requirement)
    if (!termsAccepted || termsAccepted !== "true") {
      return NextResponse.json(
        { error: "Debés aceptar los Términos y Condiciones y la Política de Privacidad para registrarte" },
        { status: 400 }
      )
    }

    switch (tipo) {
      case "cliente":
        return await registerCliente(body, req)
      case "negocio":
        return await registerNegocio(body)
      case "repartidor":
        return await registerRepartidor(body)
      default:
        return NextResponse.json(
          { error: "Tipo de registro inválido" },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error("Register error:", safeErrorForLog(error))
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}

async function registerCliente(data: {
  nombre: string
  email: string
  password: string
  telefono?: string
}, req: NextRequest) {
  const { nombre, email, password, telefono } = data

  if (!nombre?.trim() || !email?.trim() || !password) {
    return NextResponse.json(
      { error: "Nombre, email y contraseña son obligatorios" },
      { status: 400 }
    )
  }

  const emailRegex = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: "Email inválido" }, { status: 400 })
  }

  const passwordCheck = validatePassword(password)
  if (!passwordCheck.ok) {
    return NextResponse.json({ error: passwordCheck.error }, { status: 400 })
  }

  const existing = await db.cliente.findUnique({ where: { email: email.toLowerCase() } })
  if (existing) {
    return NextResponse.json(
      { error: "Ya existe una cuenta con ese email" },
      { status: 409 }
    )
  }

  // SEC-DEVICE-1: identidad técnica de dispositivo server-managed — el
  // registro no rechaza ni consulta ClienteBloqueado (eso es SEC-BLOCK-1),
  // sólo asegura que la cuenta nazca con la señal ya disponible en vez de
  // esperar al primer pedido.
  const deviceIdentity = getOrCreateDeviceIdentity(req)

  const hashedPassword = await hashPassword(password)
  const verificationToken = generateVerificationToken()
  // Account creation and its legal-acceptance evidence are atomic: if the
  // acceptance record fails to write, the account must not exist either.
  const cliente = await db.$transaction(async (tx) => {
    const created = await tx.cliente.create({
      data: {
        nombre: nombre.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        telefono: telefono?.trim() || "",
        verificationToken,
        dispositivoFingerprint: deviceIdentity.deviceId,
      },
    })
    await tx.legalAcceptance.create({
      data: {
        userId: created.id,
        userType: "cliente",
        termsVersion: CURRENT_TERMS_VERSION,
        privacyVersion: CURRENT_PRIVACY_VERSION,
        source: "register",
      },
    })
    return created
  })

  // Send verification email (non-blocking)
  sendVerificationEmail(cliente.email, cliente.nombre, verificationToken, "cliente").catch((err) => {
    console.error("[Register] Failed to send verification email:", safeErrorForLog(err))
  })

  const response = NextResponse.json({
    ok: true,
    needsVerification: true,
    email: cliente.email,
    userType: "cliente",
  })
  if (deviceIdentity.isNew) {
    setDeviceCookie(response, deviceIdentity.token)
  }
  return response
}

async function registerNegocio(data: {
  nombre_local: string
  usuario: string
  email: string
  password: string
  rubro: string
}) {
  const { nombre_local, usuario, email, password, rubro } = data

  if (!nombre_local?.trim() || !usuario?.trim() || !email?.trim() || !password || !rubro) {
    return NextResponse.json(
      { error: "Todos los campos son obligatorios" },
      { status: 400 }
    )
  }

  const emailRegex = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: "Email inválido" }, { status: 400 })
  }

  const existingEmail = await db.negocio.findUnique({ where: { email: email.toLowerCase().trim() } })
  if (existingEmail) {
    return NextResponse.json(
      { error: "Ya existe una cuenta con ese email" },
      { status: 409 }
    )
  }

  const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/
  if (!usernameRegex.test(usuario)) {
    return NextResponse.json(
      { error: "El usuario debe tener 3-30 caracteres (letras, números y _)" },
      { status: 400 }
    )
  }

  const passwordCheck = validatePassword(password)
  if (!passwordCheck.ok) {
    return NextResponse.json({ error: passwordCheck.error }, { status: 400 })
  }

  const rubrosValidos = ["restaurante", "ropa", "negocio"]
  if (!rubrosValidos.includes(rubro)) {
    return NextResponse.json({ error: "Rubro inválido" }, { status: 400 })
  }

  const existingName = await db.negocio.findUnique({ where: { nombre: nombre_local.trim() } })
  if (existingName) {
    return NextResponse.json(
      { error: "Ya existe un local con ese nombre. Elegí otro nombre para tu local." },
      { status: 409 }
    )
  }

  const existingUser = await db.negocio.findUnique({ where: { usuario } })
  if (existingUser) {
    return NextResponse.json(
      { error: "Ese nombre de usuario ya está en uso" },
      { status: 409 }
    )
  }

  let slug = generateSlug(nombre_local)
  const existingSlug = await db.negocio.findUnique({ where: { slug } })
  if (existingSlug) {
    slug = `${slug}-${Date.now().toString(36)}`
  }

  const hashedPassword = await hashPassword(password)
  const verificationToken = generateVerificationToken()
  // Account creation and its legal-acceptance evidence are atomic: if the
  // acceptance record fails to write, the account must not exist either.
  const negocio = await db.$transaction(async (tx) => {
    const created = await tx.negocio.create({
      data: {
        slug,
        nombre: nombre_local.trim(),
        usuario: usuario.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        rubro,
        aprobado: false,
        categorias: JSON.stringify(["Destacados"]),
        verificationToken,
      },
    })
    await tx.legalAcceptance.create({
      data: {
        userId: created.id,
        userType: "negocio",
        termsVersion: CURRENT_TERMS_VERSION,
        privacyVersion: CURRENT_PRIVACY_VERSION,
        source: "register",
      },
    })
    return created
  })

  // Send verification email (non-blocking)
  sendVerificationEmail(negocio.email, negocio.nombre, verificationToken, "negocio").catch((err) => {
    console.error("[Register] Failed to send verification email:", safeErrorForLog(err))
  })

  return NextResponse.json({
    ok: true,
    needsVerification: true,
    email: negocio.email,
    userType: "negocio",
  })
}

async function registerRepartidor(data: {
  nombre: string
  email: string
  password: string
  telefono?: string
}) {
  const { nombre, email, password, telefono } = data

  if (!nombre?.trim() || !email?.trim() || !password) {
    return NextResponse.json(
      { error: "Nombre, email y contraseña son obligatorios" },
      { status: 400 }
    )
  }

  const emailRegex = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: "Email inválido" }, { status: 400 })
  }

  const passwordCheck = validatePassword(password)
  if (!passwordCheck.ok) {
    return NextResponse.json({ error: passwordCheck.error }, { status: 400 })
  }

  const existing = await db.repartidor.findUnique({ where: { email: email.toLowerCase() } })
  if (existing) {
    return NextResponse.json(
      { error: "Ya existe una cuenta con ese email" },
      { status: 409 }
    )
  }

  const hashedPassword = await hashPassword(password)
  const verificationToken = generateVerificationToken()
  // Account creation and its legal-acceptance evidence are atomic: if the
  // acceptance record fails to write, the account must not exist either.
  const repartidor = await db.$transaction(async (tx) => {
    const created = await tx.repartidor.create({
      data: {
        nombre: nombre.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        telefono: telefono?.trim() || "",
        verificationToken,
      },
    })
    await tx.legalAcceptance.create({
      data: {
        userId: created.id,
        userType: "repartidor",
        termsVersion: CURRENT_TERMS_VERSION,
        privacyVersion: CURRENT_PRIVACY_VERSION,
        source: "register",
      },
    })
    return created
  })

  // Send verification email (non-blocking)
  sendVerificationEmail(repartidor.email, repartidor.nombre, verificationToken, "repartidor").catch((err) => {
    console.error("[Register] Failed to send verification email:", safeErrorForLog(err))
  })

  return NextResponse.json({
    ok: true,
    needsVerification: true,
    email: repartidor.email,
    userType: "repartidor",
  })
}
