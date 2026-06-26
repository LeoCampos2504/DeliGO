import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"

// GET - Get today's delivered orders (or full history with ?history=true)
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user || user.type !== "repartidor") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }

    // Get associated negocio IDs
    const asociaciones = await db.repartidorNegocio.findMany({
      where: { repartidorId: user.id },
      select: { negocioId: true },
    })

    const negocioIds = asociaciones.map((a) => a.negocioId)

    if (negocioIds.length === 0) {
      return NextResponse.json({ pedidos: [], total: 0 })
    }

    // Today's start (midnight)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { searchParams } = new URL(req.url)
    const history = searchParams.get("history") === "true"
    const page = parseInt(searchParams.get("page") || "1", 10)
    const limit = parseInt(searchParams.get("limit") || "20", 10)

    // Common item select
    const itemSelect = {
      nombre: true,
      cantidad: true,
      precio: true,
    }

    // Common negocio select
    const negocioSelect = {
      id: true,
      nombre: true,
      logoUrl: true,
      colorPrincipal: true,
    }

    if (history) {
      // Full history with pagination
      const skip = (page - 1) * limit
      const [historial, total] = await Promise.all([
        db.pedido.findMany({
          where: {
            negocioId: { in: negocioIds },
            repartidorId: user.id,
            estado: "entregado",
            entregadoPorRepartidor: true,
          },
          include: {
            items: { select: itemSelect },
            negocio: { select: negocioSelect },
          },
          orderBy: { entregadoFecha: "desc" },
          skip,
          take: limit,
        }),
        db.pedido.count({
          where: {
            negocioId: { in: negocioIds },
            repartidorId: user.id,
            estado: "entregado",
            entregadoPorRepartidor: true,
          },
        }),
      ])

      return NextResponse.json({
        pedidos: historial,
        total,
        pagination: {
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      })
    }

    // Today's delivered orders only
    const pedidos = await db.pedido.findMany({
      where: {
        negocioId: { in: negocioIds },
        repartidorId: user.id,
        estado: "entregado",
        entregadoPorRepartidor: true,
        entregadoFecha: { gte: today },
      },
      include: {
        items: { select: itemSelect },
        negocio: { select: negocioSelect },
      },
      orderBy: { entregadoFecha: "desc" },
    })

    return NextResponse.json({
      pedidos,
      total: pedidos.length,
    })
  } catch (error) {
    console.error("Error getting delivered orders:", error)
    return NextResponse.json({ error: "Error al obtener entregas" }, { status: 500 })
  }
}
