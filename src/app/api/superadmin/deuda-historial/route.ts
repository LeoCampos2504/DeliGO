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

// GET - Debt payment history
export async function GET(req: NextRequest) {
  try {
    const user = await verifySuperAdmin(req)
    if (!user) return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get("page") || "1", 10)
    const limit = parseInt(searchParams.get("limit") || "20", 10)
    const negocioId = searchParams.get("negocioId")

    const where: Record<string, unknown> = {}
    if (negocioId) where.negocioId = negocioId

    const skip = (page - 1) * limit

    const [historial, total] = await Promise.all([
      db.deudaHistorial.findMany({
        where,
        orderBy: { fechaAbono: "desc" },
        skip,
        take: limit,
      }),
      db.deudaHistorial.count({ where }),
    ])

    return NextResponse.json({
      historial,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Error getting debt history:", error)
    return NextResponse.json({ error: "Error al obtener historial" }, { status: 500 })
  }
}
