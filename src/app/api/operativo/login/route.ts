import { NextRequest, NextResponse } from "next/server"
import {
  comparePassword,
  createOperationalSession,
  OPERATIONAL_SESSION_COOKIE_NAME,
  SESSION_DURATION_HOURS,
} from "@/lib/auth"
import { db } from "@/lib/db"
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit"

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
      return noStore(rateLimitResponse(rl, "Demasiados intentos. Intentá de nuevo en 5 minutos."))
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

    if (!account || !account.password || account.eliminado || !account.activo) {
      return noStore(
        NextResponse.json(
          { error: "Email o contraseña incorrectos" },
          { status: 401 }
        )
      )
    }

    const valid = await comparePassword(password, account.password)
    if (!valid) {
      return noStore(
        NextResponse.json(
          { error: "Email o contraseña incorrectos" },
          { status: 401 }
        )
      )
    }

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
    console.error("[OperativoLogin] Error:", error)
    return noStore(
      NextResponse.json(
        { error: "Error interno del servidor" },
        { status: 500 }
      )
    )
  }
}
