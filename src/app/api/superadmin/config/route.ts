import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireSuperadminSession } from "@/lib/superadmin-auth"
import { safeErrorForLog } from "@/lib/log-safe-error"

// Seguridad-6B.2: configuración global de la plataforma — nunca cacheable.
const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" } as const

async function verifySuperAdmin(req: NextRequest) {
  const auth = await requireSuperadminSession(req)
  if (!auth.ok) return null
  return auth.admin
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
    console.error("Error getting platform config:", safeErrorForLog(error))
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

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "JSON inválido" }, { status: 400, headers: NO_STORE_HEADERS })
    }
    const { promocionadosActivos } = (body as { promocionadosActivos?: unknown } | null) ?? {}

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
    console.error("Error updating platform config:", safeErrorForLog(error))
    return NextResponse.json(
      { error: "Error al actualizar configuración" },
      { status: 500, headers: NO_STORE_HEADERS }
    )
  }
}
