import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"

// GET /api/negocio/empleados/stats — Get mozo statistics
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user || user.type !== "negocio") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }

    const negocioId = user.id
    const periodo = req.nextUrl.searchParams.get("periodo") || "hoy"

    // Determine date filter
    const now = new Date()
    let startDate: Date

    switch (periodo) {
      case "semana":
        startDate = new Date(now)
        startDate.setDate(now.getDate() - 7)
        startDate.setHours(0, 0, 0, 0)
        break
      case "mes":
        startDate = new Date(now)
        startDate.setMonth(now.getMonth() - 1)
        startDate.setHours(0, 0, 0, 0)
        break
      case "hoy":
      default:
        startDate = new Date(now)
        startDate.setHours(0, 0, 0, 0)
        break
    }

    // Get all mozos for this negocio
    const mozos = await db.empleado.findMany({
      where: { negocioId, rol: "mozo" },
      orderBy: { nombre: "asc" },
    })

    // Get orders for these mozos in the period
    const mozoIds = mozos.map((m) => m.id)

    // Get all orders with empleadoId in the period
    const pedidos = await db.pedido.findMany({
      where: {
        negocioId,
        empleadoId: { in: mozoIds },
        fecha: { gte: startDate },
        estado: { notIn: ["cancelado"] },
      },
      select: {
        id: true,
        empleadoId: true,
        total: true,
        estado: true,
        fecha: true,
      },
    })

    // Build stats per mozo
    const stats = mozos.map((mozo) => {
      const mozoPedidos = pedidos.filter((p) => p.empleadoId === mozo.id)
      const totalPedidos = mozoPedidos.length
      const totalMonto = mozoPedidos.reduce((sum, p) => sum + p.total, 0)
      const entregados = mozoPedidos.filter((p) => p.estado === "entregado").length
      const activos = mozoPedidos.filter((p) =>
        ["recibido", "preparando", "listo_para_retirar"].includes(p.estado)
      ).length

      return {
        id: mozo.id,
        nombre: mozo.nombre,
        codigo: mozo.codigo,
        token: mozo.token,
        activo: mozo.activo,
        totalPedidos,
        totalMonto,
        entregados,
        activos,
      }
    })

    return NextResponse.json({ stats, periodo })
  } catch (error) {
    console.error("Error getting mozo stats:", error)
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 })
  }
}
