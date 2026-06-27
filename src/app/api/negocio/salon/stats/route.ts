import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"

type EstadoMozoHistorico = "activo" | "suspendido" | "desvinculado" | "historico_sin_registro"

interface MozoSalonStatsAccum {
  pedidosHoy: number
  montoHoy: number
  nombreHistorico: string | null
}

function getEstadoMozo(empleado?: { activo: boolean; eliminado: boolean } | null): EstadoMozoHistorico {
  if (!empleado) return "historico_sin_registro"
  if (empleado.eliminado) return "desvinculado"
  if (!empleado.activo) return "suspendido"
  return "activo"
}

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
        empleadoNombre: true,
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

    const pedidoEmpleadoIds = [
      ...new Set(allDeliveredOrders.map((pedido) => pedido.empleadoId).filter((id): id is string => Boolean(id))),
    ]

    const empleados = await db.empleado.findMany({
      where: {
        negocioId,
        OR: [
          { rol: "mozo" },
          ...(pedidoEmpleadoIds.length > 0 ? [{ id: { in: pedidoEmpleadoIds } }] : []),
        ],
      },
      orderBy: { nombre: "asc" },
      select: {
        id: true,
        nombre: true,
        codigo: true,
        rol: true,
        activo: true,
        eliminado: true,
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

    const empleadosById = new Map(empleados.map((empleado) => [empleado.id, empleado]))
    const statsByEmpleadoId = new Map<string, MozoSalonStatsAccum>()
    for (const pedido of allDeliveredOrders) {
      if (!pedido.empleadoId) continue
      const current = statsByEmpleadoId.get(pedido.empleadoId) ?? {
        pedidosHoy: 0,
        montoHoy: 0,
        nombreHistorico: null,
      }
      current.pedidosHoy += 1
      current.montoHoy += pedido.total
      if (!current.nombreHistorico && pedido.empleadoNombre) {
        current.nombreHistorico = pedido.empleadoNombre
      }
      statsByEmpleadoId.set(pedido.empleadoId, current)
    }

    const mozoEmpleadoIds = empleados.filter((empleado) => empleado.rol === "mozo").map((empleado) => empleado.id)
    const historicoSinRegistroIds = pedidoEmpleadoIds.filter((empleadoId) => !empleadosById.has(empleadoId))
    const statsIds = new Set<string>([
      ...mozoEmpleadoIds,
      ...historicoSinRegistroIds,
    ])

    const mozosStats = [...statsIds].map((empleadoId) => {
      const empleado = empleadosById.get(empleadoId)
      const accum = statsByEmpleadoId.get(empleadoId) ?? {
        pedidosHoy: 0,
        montoHoy: 0,
        nombreHistorico: null,
      }
      const nombreHistorico = accum.nombreHistorico

      return {
        id: empleadoId,
        nombre: empleado?.nombre || nombreHistorico || "Mozo histórico",
        codigo: empleado?.codigo || "",
        activo: empleado?.activo ?? false,
        eliminado: empleado?.eliminado ?? true,
        rol: empleado?.rol ?? null,
        estadoHistorico: getEstadoMozo(empleado),
        nombreActual: empleado?.nombre ?? null,
        nombreHistorico,
        mesasAsignadas: mesasPerMozo.get(empleadoId) || 0,
        pedidosHoy: accum.pedidosHoy,
        montoHoy: Math.round(accum.montoHoy * 100) / 100,
      }
    }).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))

    return NextResponse.json({ resumen, mozos: mozosStats, periodo })
  } catch (error) {
    console.error("Error getting salon stats:", error)
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 })
  }
}
