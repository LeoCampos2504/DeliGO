import { NextRequest, NextResponse } from "next/server"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"

function noStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "private, no-store")
  return response
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value

    if (!token) {
      return noStore(
        NextResponse.json(
          { error: "No autenticado" },
          { status: 401 }
        )
      )
    }

    const user = await getUserFromToken(token)

    if (!user) {
      const res = NextResponse.json(
        { error: "Sesión expirada" },
        { status: 401 }
      )
      res.cookies.delete(SESSION_COOKIE_NAME)
      return noStore(res)
    }

    return noStore(NextResponse.json({ ok: true, user }))
  } catch (error) {
    console.error("Me error:", error)
    return noStore(
      NextResponse.json(
        { error: "Error interno del servidor" },
        { status: 500 }
      )
    )
  }
}
