import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"

// Seguridad-6B.2: configuración global de la plataforma — nunca cacheable.
const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" } as const

async function verifySuperAdmin(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null
  const user = await getUserFromToken(token)
  if (!user || user.type !== "superadmin") return null
  return user
}

// GET - Get platform config
export async function GET(req: NextRequest) {
  try {
    const user = await verifySuperAdmin(req)
    if (!user) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403, headers: NO_STORE_HEADERS })
    }

    let config = await db.configPlataforma.findFirst()

    if (!config) {
      config = await db.configPlataforma.create({
        data: {
          promocionadosActivos: false,
        },
      })
    }

    return NextResponse.json({
      promocionadosActivos: config.promocionadosActivos,
    }, { headers: NO_STORE_HEADERS })
  } catch (error) {
    console.error("Error getting platform config:", error)
    return NextResponse.json(
      { error: "Error al obtener configuración" },
      { status: 500, headers: NO_STORE_HEADERS }
    )
  }
}

// PUT - Update platform config (toggle promocionadosActivos)
export async function PUT(req: NextRequest) {
  try {
    const user = await verifySuperAdmin(req)
    if (!user) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403, headers: NO_STORE_HEADERS })
    }

    const body = await req.json()
    const { promocionadosActivos } = body

    if (typeof promocionadosActivos !== "boolean") {
      return NextResponse.json(
        { error: "promocionadosActivos debe ser un valor booleano" },
        { status: 400, headers: NO_STORE_HEADERS }
      )
    }

    let config = await db.configPlataforma.findFirst()

    if (!config) {
      config = await db.configPlataforma.create({
        data: {
          promocionadosActivos,
        },
      })
    } else {
      config = await db.configPlataforma.update({
        where: { id: config.id },
        data: { promocionadosActivos },
      })
    }

    return NextResponse.json({
      promocionadosActivos: config.promocionadosActivos,
    }, { headers: NO_STORE_HEADERS })
  } catch (error) {
    console.error("Error updating platform config:", error)
    return NextResponse.json(
      { error: "Error al actualizar configuración" },
      { status: 500, headers: NO_STORE_HEADERS }
    )
  }
}
