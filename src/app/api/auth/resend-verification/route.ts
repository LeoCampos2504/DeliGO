import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { sendVerificationEmail, generateVerificationToken } from "@/lib/email"

// Simple in-memory rate limiting: max 1 resend per email per 60 seconds
const resendTimestamps = new Map<string, number>()
const RATE_LIMIT_MS = 60_000

// Cleanup old entries every 10 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, timestamp] of resendTimestamps.entries()) {
    if (now - timestamp > RATE_LIMIT_MS * 2) {
      resendTimestamps.delete(key)
    }
  }
}, 10 * 60_000)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, userType } = body

    if (!email?.trim() || !userType) {
      return NextResponse.json(
        { error: "Email y tipo de usuario son obligatorios" },
        { status: 400 }
      )
    }

    const validTypes = ["cliente", "negocio", "repartidor"]
    if (!validTypes.includes(userType)) {
      return NextResponse.json(
        { error: "Tipo de usuario inválido" },
        { status: 400 }
      )
    }

    // Rate limit check
    const rateKey = `${email.toLowerCase().trim()}:${userType}`
    const lastSent = resendTimestamps.get(rateKey)
    if (lastSent && Date.now() - lastSent < RATE_LIMIT_MS) {
      return NextResponse.json(
        { error: "Esperá un minuto antes de reenviar el email." },
        { status: 429 }
      )
    }

    // Find user by email and type
    let user: { id: string; nombre: string; email: string; emailVerified: Date | null } | null = null

    switch (userType) {
      case "cliente": {
        const found = await db.cliente.findUnique({
          where: { email: email.toLowerCase().trim() },
          select: { id: true, nombre: true, email: true, emailVerified: true },
        })
        user = found
        break
      }
      case "negocio": {
        const found = await db.negocio.findUnique({
          where: { email: email.toLowerCase().trim() },
          select: { id: true, nombre: true, email: true, emailVerified: true },
        })
        user = found
        break
      }
      case "repartidor": {
        const found = await db.repartidor.findUnique({
          where: { email: email.toLowerCase().trim() },
          select: { id: true, nombre: true, email: true, emailVerified: true },
        })
        user = found
        break
      }
    }

    if (!user) {
      // Don't reveal if email exists for security
      return NextResponse.json({ ok: true })
    }

    if (user.emailVerified) {
      return NextResponse.json(
        { error: "El email ya fue verificado" },
        { status: 400 }
      )
    }

    // Generate new token and update user
    const verificationToken = generateVerificationToken()

    switch (userType) {
      case "cliente":
        await db.cliente.update({
          where: { id: user.id },
          data: { verificationToken },
        })
        break
      case "negocio":
        await db.negocio.update({
          where: { id: user.id },
          data: { verificationToken },
        })
        break
      case "repartidor":
        await db.repartidor.update({
          where: { id: user.id },
          data: { verificationToken },
        })
        break
    }

    // Update rate limit
    resendTimestamps.set(rateKey, Date.now())

    // Send verification email (non-blocking)
    sendVerificationEmail(user.email, user.nombre, verificationToken, userType as "cliente" | "negocio" | "repartidor").catch((err) => {
      console.error("[Resend] Failed to send verification email:", err)
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Resend verification error:", error)
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
