import { NextRequest, NextResponse } from "next/server"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value

    if (!token) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      )
    }

    const user = await getUserFromToken(token)

    if (!user) {
      const res = NextResponse.json(
        { error: "Sesión expirada" },
        { status: 401 }
      )
      res.cookies.delete(SESSION_COOKIE_NAME)
      return res
    }

    return NextResponse.json({ ok: true, user })
  } catch (error) {
    console.error("Me error:", error)
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
