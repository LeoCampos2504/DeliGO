import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"

// Seguridad-6B: historial de pagos de deuda de la plataforma — nunca cacheable.
const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" } as const

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
    if (!user) return NextResponse.json({ error: "Acceso denegado" }, { status: 403, headers: NO_STORE_HEADERS })

    const { searchParams } = new URL(req.url)

    const rawPage = searchParams.get("page")
    const page = rawPage === null ? 1 : parseInt(rawPage, 10)
    if (!Number.isFinite(page) || !Number.isInteger(page) || page < 1) {
      return NextResponse.json(
        { error: "page debe ser un entero mayor o igual a 1" },
        { status: 400, headers: NO_STORE_HEADERS }
      )
    }

    const MAX_LIMIT = 100
    const rawLimit = searchParams.get("limit")
    const parsedLimit = rawLimit === null ? 20 : parseInt(rawLimit, 10)
    if (!Number.isFinite(parsedLimit) || !Number.isInteger(parsedLimit) || parsedLimit < 1) {
      return NextResponse.json(
        { error: "limit debe ser un entero mayor o igual a 1" },
        { status: 400, headers: NO_STORE_HEADERS }
      )
    }
    const limit = Math.min(parsedLimit, MAX_LIMIT)

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
    }, { headers: NO_STORE_HEADERS })
  } catch (error) {
    console.error("Error getting debt history:", error)
    return NextResponse.json({ error: "Error al obtener historial" }, { status: 500, headers: NO_STORE_HEADERS })
  }
}
