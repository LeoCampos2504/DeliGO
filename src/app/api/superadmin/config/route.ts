import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"

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
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
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
    })
  } catch (error) {
    console.error("Error getting platform config:", error)
    return NextResponse.json(
      { error: "Error al obtener configuración" },
      { status: 500 }
    )
  }
}

// PUT - Update platform config (toggle promocionadosActivos)
export async function PUT(req: NextRequest) {
  try {
    const user = await verifySuperAdmin(req)
    if (!user) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }

    const body = await req.json()
    const { promocionadosActivos } = body

    if (typeof promocionadosActivos !== "boolean") {
      return NextResponse.json(
        { error: "promocionadosActivos debe ser un valor booleano" },
        { status: 400 }
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
    })
  } catch (error) {
    console.error("Error updating platform config:", error)
    return NextResponse.json(
      { error: "Error al actualizar configuración" },
      { status: 500 }
    )
  }
}
