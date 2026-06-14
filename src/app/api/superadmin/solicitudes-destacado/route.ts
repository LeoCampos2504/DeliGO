import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"

// GET - List all destacado solicitudes (superadmin)
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user || user.type !== "superadmin") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }

    const url = new URL(req.url)
    const estado = url.searchParams.get("estado") || undefined
    const page = Number(url.searchParams.get("page")) || 1
    const pageSize = 20

    const where = estado ? { estado } : {}

    const [solicitudes, total] = await Promise.all([
      db.destacadoSolicitud.findMany({
        where,
        include: {
          negocio: {
            select: {
              id: true,
              nombre: true,
              slug: true,
              logoUrl: true,
              colorPrincipal: true,
              destacadoHasta: true,
              promocionado: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.destacadoSolicitud.count({ where }),
    ])

    // Count by estado
    const [pendientesCount, aprobadasCount, rechazadasCount] = await Promise.all([
      db.destacadoSolicitud.count({ where: { estado: "pendiente" } }),
      db.destacadoSolicitud.count({ where: { estado: "aprobada" } }),
      db.destacadoSolicitud.count({ where: { estado: "rechazada" } }),
    ])

    return NextResponse.json({
      solicitudes,
      total,
      page,
      pageSize,
      stats: {
        pendientes: pendientesCount,
        aprobadas: aprobadasCount,
        rechazadas: rechazadasCount,
      },
    })
  } catch (error) {
    console.error("Error getting destacado solicitudes:", error)
    return NextResponse.json(
      { error: "Error al obtener solicitudes" },
      { status: 500 }
    )
  }
}
