import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { parseAuthorizationBearer } from "@/lib/access-tokens"

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" }

async function validateAccess(token: string): Promise<{ negocioId: string } | null> {
  if (!token) return null
  const negocio = await db.negocio.findFirst({
    where: { tokenEmpleados: token },
    select: { id: true },
  })
  return negocio ? { negocioId: negocio.id } : null
}

export async function GET(req: NextRequest) {
  try {
    const token = parseAuthorizationBearer(req.headers.get("authorization"))
    if (!token) return NextResponse.json({ error: "Token requerido" }, { status: 401, headers: NO_STORE_HEADERS })

    const access = await validateAccess(token)
    if (!access) return NextResponse.json({ error: "Token invalido" }, { status: 401, headers: NO_STORE_HEADERS })

    const negocioId = access.negocioId
    const filtro = req.nextUrl.searchParams.get("filtro") || "todas"
    const page = parseInt(req.nextUrl.searchParams.get("page") || "1", 10)
    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "20", 10)

    const where: Record<string, unknown> = { negocioId }

    if (filtro === "sin_respuesta") {
      where.respuestaNegocio = null
    } else if (filtro === "con_respuesta") {
      where.respuestaNegocio = { not: null }
    }

    const skip = (page - 1) * limit

    const [resenas, total] = await Promise.all([
      db.resena.findMany({
        where,
        orderBy: { fecha: "desc" },
        skip,
        take: limit,
      }),
      db.resena.count({ where }),
    ])

    const stats = await db.resena.aggregate({
      where: { negocioId },
      _avg: { puntuacion: true },
      _count: { id: true },
    })

    const sinRespuesta = await db.resena.count({
      where: { negocioId, respuestaNegocio: null },
    })

    const distribucion: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    const allResenas = await db.resena.findMany({
      where: { negocioId },
      select: { puntuacion: true },
    })
    for (const r of allResenas) {
      if (distribucion[r.puntuacion] !== undefined) {
        distribucion[r.puntuacion]++
      }
    }

    return NextResponse.json({
      resenas,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      stats: {
        promedio: Math.round((stats._avg.puntuacion || 0) * 10) / 10,
        total: stats._count.id,
        sinRespuesta,
        distribucion,
      },
    }, { headers: NO_STORE_HEADERS })
  } catch (error) {
    console.error("Error listing empleado resenas:", error)
    return NextResponse.json({ error: "Error del servidor" }, { status: 500, headers: NO_STORE_HEADERS })
  }
}
