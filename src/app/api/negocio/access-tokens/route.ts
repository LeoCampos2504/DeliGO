import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { generateToken } from "@/lib/access-tokens"

function maskToken(token?: string | null) {
  if (!token) return null
  if (token.length <= 8) return "********"
  return `${token.slice(0, 4)}...${token.slice(-4)}`
}

// GET /api/negocio/access-tokens — Get or create the shared access tokens
export async function GET(req: NextRequest) {
  try {
    const sessionToken = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!sessionToken) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const user = await getUserFromToken(sessionToken)
    if (!user || user.type !== "negocio") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }

    const negocio = await db.negocio.findUnique({
      where: { id: user.id },
      select: { tokenEmpleados: true, tokenSalon: true },
    })

    let tokenEmpleados = negocio?.tokenEmpleados
    let tokenSalon = negocio?.tokenSalon

    // Create tokens if they don't exist
    if (!tokenEmpleados) {
      tokenEmpleados = generateToken()
      await db.negocio.update({
        where: { id: user.id },
        data: { tokenEmpleados },
      })
    }

    if (!tokenSalon) {
      tokenSalon = generateToken()
      await db.negocio.update({
        where: { id: user.id },
        data: { tokenSalon },
      })
    }

    return NextResponse.json({
      tokenEmpleados: null,
      tokenEmpleadosMasked: maskToken(tokenEmpleados),
      tokenEmpleadosRevealed: false,
      tokenSalon: null,
      tokenSalonMasked: maskToken(tokenSalon),
      tokenSalonRevealed: false,
    })
  } catch (error) {
    console.error("Error getting access tokens:", error)
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 })
  }
}

// POST /api/negocio/access-tokens?type=empleados|salon — Regenerate a specific token
export async function POST(req: NextRequest) {
  try {
    const sessionToken = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!sessionToken) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const user = await getUserFromToken(sessionToken)
    if (!user || user.type !== "negocio") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }

    const type = req.nextUrl.searchParams.get("type") || "empleados"
    const newToken = generateToken()

    if (type === "salon") {
      await db.negocio.update({
        where: { id: user.id },
        data: { tokenSalon: newToken },
      })
      return NextResponse.json({
        tokenSalon: newToken,
        tokenSalonMasked: maskToken(newToken),
        tokenSalonRevealed: true,
      })
    }

    // Default: regenerate empleados token
    await db.negocio.update({
      where: { id: user.id },
      data: { tokenEmpleados: newToken },
    })

    return NextResponse.json({
      tokenEmpleados: newToken,
      tokenEmpleadosMasked: maskToken(newToken),
      tokenEmpleadosRevealed: true,
    })
  } catch (error) {
    console.error("Error regenerating access token:", error)
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 })
  }
}
