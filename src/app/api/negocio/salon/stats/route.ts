import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"

// GET /api/negocio/salon/stats — Get salon statistics for the business panel
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

    // ── Date filters ──────────────────────────────────────────
    const now = new Date()
    let startDate: Date | null = null

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
      case "todo":
        startDate = null // no start filter
        break
      case "hoy":
      default:
        startDate = new Date(now)
        startDate.setHours(0, 0, 0, 0)
        break
    }

    const dateFilter = startDate ? { gte: startDate } : undefined

    // ── 1. Revenue by period (only entregado orders count for revenue) ──

    // All delivered orders in the period
    const allDeliveredOrders = await db.pedido.findMany({
      where: {
        negocioId,
        fecha: dateFilter,
        estado: "entregado",
      },
      select: {
        id: true,
        total: true,
        metodoEntrega: true,
        empleadoId: true,
      },
    })

    const mesaDeliveredOrders = allDeliveredOrders.filter((o) => o.metodoEntrega === "mesa")

    const totalAllRevenue = allDeliveredOrders.reduce((sum, o) => sum + o.total, 0)
    const totalMesaRevenue = mesaDeliveredOrders.reduce((sum, o) => sum + o.total, 0)
    const totalAllOrders = allDeliveredOrders.length
    const totalMesaOrders = mesaDeliveredOrders.length

    const resumen = {
      totalMesaRevenue: Math.round(totalMesaRevenue * 100) / 100,
      totalMesaOrders,
      totalAllRevenue: Math.round(totalAllRevenue * 100) / 100,
      totalAllOrders,
    }

    // ── 2. Per-employee (mozo) stats ──────────────────────────

    // Get all mozos for this negocio
    const mozos = await db.empleado.findMany({
      where: { negocioId, rol: "mozo" },
      orderBy: { nombre: "asc" },
      select: {
        id: true,
        nombre: true,
        codigo: true,
        activo: true,
      },
    })

    // Count mesas currently assigned to each mozo
    const mesasAssignments = await db.mesa.groupBy({
      by: ["empleadoId"],
      where: {
        negocioId,
        empleadoId: { not: null },
        activa: true,
      },
      _count: { id: true },
    })

    const mesasPerMozo = new Map<string, number>()
    for (const row of mesasAssignments) {
      if (row.empleadoId) {
        mesasPerMozo.set(row.empleadoId, row._count.id)
      }
    }

    // Get delivered orders attributed to mozos in the period
    const mozoIds = mozos.map((m) => m.id)

    const mozoPedidos = mozoIds.length > 0
      ? await db.pedido.findMany({
          where: {
            negocioId,
            empleadoId: { in: mozoIds },
            fecha: dateFilter,
            estado: "entregado",
          },
          select: {
            empleadoId: true,
            total: true,
            metodoEntrega: true,
          },
        })
      : []

    const mozosStats = mozos.map((mozo) => {
      const ownPedidos = mozoPedidos.filter((p) => p.empleadoId === mozo.id)

      return {
        id: mozo.id,
        nombre: mozo.nombre,
        codigo: mozo.codigo,
        activo: mozo.activo,
        mesasAsignadas: mesasPerMozo.get(mozo.id) || 0,
        pedidosHoy: ownPedidos.length,
        montoHoy: Math.round(ownPedidos.reduce((s, p) => s + p.total, 0) * 100) / 100,
      }
    })

    return NextResponse.json({ resumen, mozos: mozosStats, periodo })
  } catch (error) {
    console.error("Error getting salon stats:", error)
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 })
  }
}
