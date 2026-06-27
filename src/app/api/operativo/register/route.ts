import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { hashPassword } from "@/lib/auth"
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit"

const EMAIL_REGEX = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/

function noStore<T extends Response>(response: T): T {
  response.headers.set("Cache-Control", "private, no-store")
  return response
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req)
    const rl = checkRateLimit("register", ip)
    if (!rl.allowed) {
      return noStore(rateLimitResponse(rl, "Demasiados intentos de registro. Intentá de nuevo en 1 hora."))
    }

    const body = await req.json()
    const nombre = typeof body.nombre === "string" ? body.nombre.trim() : ""
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    const password = typeof body.password === "string" ? body.password : ""

    if (!nombre || !email || !password) {
      return noStore(
        NextResponse.json(
          { error: "Nombre, email y contraseña son obligatorios" },
          { status: 400 }
        )
      )
    }

    if (!EMAIL_REGEX.test(email)) {
      return noStore(NextResponse.json({ error: "Email inválido" }, { status: 400 }))
    }

    if (password.length < 6) {
      return noStore(
        NextResponse.json(
          { error: "La contraseña debe tener al menos 6 caracteres" },
          { status: 400 }
        )
      )
    }

    const existing = await db.cuentaOperativa.findUnique({
      where: { email },
      select: { id: true },
    })
    if (existing) {
      return noStore(
        NextResponse.json(
          { error: "No se pudo crear la cuenta" },
          { status: 409 }
        )
      )
    }

    const hashedPassword = await hashPassword(password)
    const account = await db.cuentaOperativa.create({
      data: {
        nombre,
        email,
        password: hashedPassword,
      },
      select: {
        id: true,
        nombre: true,
        email: true,
        activo: true,
      },
    })

    return noStore(NextResponse.json({ ok: true, cuenta: account }, { status: 201 }))
  } catch (error) {
    console.error("[OperativoRegister] Error:", error)
    return noStore(
      NextResponse.json(
        { error: "No se pudo crear la cuenta" },
        { status: 500 }
      )
    )
  }
}
