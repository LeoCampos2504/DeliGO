import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getAuthenticatedCliente } from "@/lib/cliente-auth"
import { comparePassword, hashPassword } from "@/lib/auth"
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit"

// PUT /api/cliente/password - Change password
export async function PUT(req: NextRequest) {
  try {
    const cliente = await getAuthenticatedCliente(req)
    if (!cliente) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    // Rate limit password changes
    const ip = getClientIp(req)
    const rl = checkRateLimit("password", `${ip}:${cliente.id}`)
    if (!rl.allowed) {
      return rateLimitResponse(rl, "Demasiados intentos. Esperá un momento.")
    }

    // Google OAuth users can't change password (they don't have one)
    if (!cliente.password) {
      return NextResponse.json(
        { error: "Tu cuenta usa Google. No tenés contraseña configurada." },
        { status: 400 }
      )
    }

    const body = await req.json()
    const { passwordActual, passwordNueva } = body

    if (!passwordActual || !passwordNueva) {
      return NextResponse.json(
        { error: "Debés ingresar la contraseña actual y la nueva" },
        { status: 400 }
      )
    }

    if (passwordNueva.length < 6) {
      return NextResponse.json(
        { error: "La nueva contraseña debe tener al menos 6 caracteres" },
        { status: 400 }
      )
    }

    // Verify current password
    const isValid = await comparePassword(passwordActual, cliente.password)
    if (!isValid) {
      return NextResponse.json(
        { error: "La contraseña actual es incorrecta" },
        { status: 400 }
      )
    }

    // Hash and save new password
    const hashedPassword = await hashPassword(passwordNueva)
    await db.cliente.update({
      where: { id: cliente.id },
      data: { password: hashedPassword },
    })

    return NextResponse.json({ ok: true, message: "Contraseña actualizada correctamente" })
  } catch (error) {
    console.error("Password PUT error:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
