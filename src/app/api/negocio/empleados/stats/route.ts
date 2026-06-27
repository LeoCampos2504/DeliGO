import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"

type EstadoMozoHistorico = "activo" | "suspendido" | "desvinculado" | "historico_sin_registro"

interface MozoStatsAccum {
  totalPedidos: number
  totalMonto: number
  entregados: number
  activos: number
  nombreHistorico: string | null
}

function getEstadoMozo(empleado?: { activo: boolean; eliminado: boolean } | null): EstadoMozoHistorico {
  if (!empleado) return "historico_sin_registro"
  if (empleado.eliminado) return "desvinculado"
  if (!empleado.activo) return "suspendido"
  return "activo"
}

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

    // Get all attributed orders in the period first, so historical mozos are not
    // lost if their Empleado row was soft-deleted or removed before this stage.
    const pedidos = await db.pedido.findMany({
      where: {
        negocioId,
        empleadoId: { not: null },
        fecha: { gte: startDate },
        estado: { notIn: ["cancelado"] },
      },
      select: {
        id: true,
        empleadoId: true,
        empleadoNombre: true,
        total: true,
        estado: true,
        fecha: true,
      },
    })

    const pedidoEmpleadoIds = [...new Set(pedidos.map((p) => p.empleadoId).filter((id): id is string => Boolean(id)))]
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

    const empleadosById = new Map(empleados.map((empleado) => [empleado.id, empleado]))
    const statsByEmpleadoId = new Map<string, MozoStatsAccum>()
    for (const pedido of pedidos) {
      if (!pedido.empleadoId) continue
      const current = statsByEmpleadoId.get(pedido.empleadoId) ?? {
        totalPedidos: 0,
        totalMonto: 0,
        entregados: 0,
        activos: 0,
        nombreHistorico: null,
      }
      current.totalPedidos += 1
      current.totalMonto += pedido.total
      if (pedido.estado === "entregado") current.entregados += 1
      if (["recibido", "preparando", "listo_para_retirar"].includes(pedido.estado)) {
        current.activos += 1
      }
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

    const stats = [...statsIds].map((empleadoId) => {
      const empleado = empleadosById.get(empleadoId)
      const accum = statsByEmpleadoId.get(empleadoId) ?? {
        totalPedidos: 0,
        totalMonto: 0,
        entregados: 0,
        activos: 0,
        nombreHistorico: null,
      }
      const nombreHistorico = accum.nombreHistorico
      const estadoHistorico = getEstadoMozo(empleado)

      return {
        id: empleadoId,
        nombre: empleado?.nombre || nombreHistorico || "Mozo histórico",
        codigo: empleado?.codigo || "",
        activo: empleado?.activo ?? false,
        eliminado: empleado?.eliminado ?? true,
        rol: empleado?.rol ?? null,
        estadoHistorico,
        nombreActual: empleado?.nombre ?? null,
        nombreHistorico,
        totalPedidos: accum.totalPedidos,
        totalMonto: accum.totalMonto,
        entregados: accum.entregados,
        activos: accum.activos,
      }
    }).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))

    return NextResponse.json({ stats, periodo })
  } catch (error) {
    console.error("Error getting mozo stats:", error)
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 })
  }
}
