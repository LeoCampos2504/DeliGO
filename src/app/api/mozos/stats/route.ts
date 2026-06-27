import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"

type EstadoMozoHistorico = "activo" | "suspendido" | "desvinculado" | "historico_sin_registro"

interface MozoStatsAccum {
  totalPedidos: number
  pedidosHoy: number
  totalRevenue: number
  nombreHistorico: string | null
}

function getEstadoMozo(empleado?: { activo: boolean; eliminado: boolean } | null): EstadoMozoHistorico {
  if (!empleado) return "historico_sin_registro"
  if (empleado.eliminado) return "desvinculado"
  if (!empleado.activo) return "suspendido"
  return "activo"
}

// GET — Mozo order statistics for the authenticated negocio
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    const user = await getUserFromToken(token)
    if (!user || user.type !== "negocio") return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })

    const negocioId = user.id

    // Today's date range
    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())

    const pedidos = await db.pedido.findMany({
      where: {
        negocioId,
        empleadoId: { not: null },
      },
      select: {
        empleadoId: true,
        empleadoNombre: true,
        total: true,
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
        pedidosHoy: 0,
        totalRevenue: 0,
        nombreHistorico: null,
      }
      current.totalPedidos += 1
      current.totalRevenue += pedido.total
      if (pedido.fecha >= startOfDay) current.pedidosHoy += 1
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
        pedidosHoy: 0,
        totalRevenue: 0,
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
        totalPedidos: accum.totalPedidos,
        pedidosHoy: accum.pedidosHoy,
        totalRevenue: accum.totalRevenue,
      }
    }).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))

    return NextResponse.json({ stats })
  } catch (error) {
    console.error("Error getting mozo stats:", error)
    return NextResponse.json({ error: "Error al obtener estadísticas" }, { status: 500 })
  }
}
