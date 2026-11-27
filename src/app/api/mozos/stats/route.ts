import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { EMPLEADO_NOMBRE_SELECT, nombreVisibleEmpleado } from "@/lib/empleado-identidad"
import { requireNegocioOwnerSession } from "@/lib/actor-family-session"
import { safeErrorForLog } from "@/lib/log-safe-error"

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

// Seguridad-6B.4: ingresos y pedidos por mozo — dato de rendimiento por empleado, nunca cacheable.
// Nota: este archivo es la implementación real detrás de /api/mozos/stats Y de
// /api/negocio/mozos/stats (que solo hace `export { GET } from "@/app/api/mozos/stats/route"`),
// así que este único cambio corrige ambas rutas.
const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" } as const

// GET — Mozo order statistics for the authenticated negocio
export async function GET(req: NextRequest) {
  try {
    // T3: credencial explícita del dueño (cookie de familia `negocio`); con una cuenta operativa en el mismo
    // navegador la cookie legacy queda vacía y esta ruta respondía 401 aunque el dueño estuviera conectado.
    const auth = await requireNegocioOwnerSession(req)
    if (!auth.ok) return NextResponse.json({ error: auth.status === 401 ? "No autenticado" : "Acceso denegado" }, { status: auth.status, headers: NO_STORE_HEADERS })

    const negocioId = auth.user.id

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
    const empleadosFilas = await db.empleado.findMany({
      where: {
        negocioId,
        OR: [
          { rol: "mozo" },
          ...(pedidoEmpleadoIds.length > 0 ? [{ id: { in: pedidoEmpleadoIds } }] : []),
        ],
      },
      select: {
        id: true,
        ...EMPLEADO_NOMBRE_SELECT,
        codigo: true,
        rol: true,
        activo: true,
        eliminado: true,
      },
    })

    // BUG-001: nombre visible (regla única): la cuenta operativa vinculada gana; sin vínculo, Empleado.nombre.
    const empleados = empleadosFilas.map(({ cuentaOperativa, ...e }) => ({ ...e, nombre: nombreVisibleEmpleado({ nombre: e.nombre, cuentaOperativa }) }))
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

    return NextResponse.json({ stats }, { headers: NO_STORE_HEADERS })
  } catch (error) {
    console.error("Error getting mozo stats:", safeErrorForLog(error))
    return NextResponse.json({ error: "Error al obtener estadísticas" }, { status: 500, headers: NO_STORE_HEADERS })
  }
}
