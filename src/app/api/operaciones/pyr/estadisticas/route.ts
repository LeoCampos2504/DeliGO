import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireOperacionesScope } from "@/lib/operaciones-terminal-access"

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" }

// Estados FINALES reales de un pedido PyR no-mesa.
const ESTADOS_FINALES = ["entregado", "cancelado"] as const

// Períodos permitidos (mismo criterio que Salón Operaciones).
const PERIODOS = { hoy: 0, "7d": 7, "30d": 30 } as const
type Periodo = keyof typeof PERIODOS

function resolvePeriodo(value: string | null): Periodo {
  if (value === "hoy" || value === "7d" || value === "30d") return value
  return "hoy"
}

function startDateForPeriodo(periodo: Periodo): Date {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const days = PERIODOS[periodo]
  if (days > 0) start.setDate(start.getDate() - days)
  return start
}

// GET — Estadísticas operativas PyR (solo conteos, sin montos) de pedidos no-mesa finalizados
// para una Terminal Operativa con `pyr.pedidos.ver`. Negocio EXCLUSIVO del contexto seguro.
export async function GET(req: NextRequest) {
  try {
    // 401 sin sesión válida de terminal · 403 sin scope `pyr.pedidos.ver`.
    const auth = await requireOperacionesScope(req, "pyr.pedidos.ver")
    if (!auth.ok) return auth.response

    const negocioId = auth.context.negocio.id

    const { searchParams } = new URL(req.url)
    const periodo = resolvePeriodo(searchParams.get("periodo"))
    const startDate = startDateForPeriodo(periodo)

    // Agregación en base de datos por estado (sin traer filas ni montos). Conteos exactos.
    const grouped = await db.pedido.groupBy({
      by: ["estado"],
      where: {
        negocioId,
        metodoEntrega: { not: "mesa" },
        estado: { in: [...ESTADOS_FINALES] },
        fecha: { gte: startDate },
      },
      _count: { id: true },
    })

    let entregados = 0
    let cancelados = 0
    for (const row of grouped) {
      if (row.estado === "entregado") entregados = row._count.id
      else if (row.estado === "cancelado") cancelados = row._count.id
    }

    const pedidosFinalizados = entregados + cancelados
    const porcentajeEntregados =
      pedidosFinalizados > 0 ? Math.round((entregados / pedidosFinalizados) * 100) : 0

    return NextResponse.json(
      {
        ok: true,
        periodo,
        terminal: { nombre: auth.context.terminal.nombre },
        negocio: {
          nombre: auth.context.negocio.nombre,
          colorPrincipal: auth.context.negocio.colorPrincipal,
        },
        // Solo conteos operativos. Sin montos, clientes, empleados ni datos administrativos.
        resumen: {
          pedidosFinalizados,
          entregados,
          cancelados,
          porcentajeEntregados,
        },
      },
      { headers: NO_STORE_HEADERS }
    )
  } catch {
    console.error("[OperacionesPyR] Falló la carga de estadísticas PyR")
    return NextResponse.json(
      { ok: false, error: "Error del servidor" },
      { status: 500, headers: NO_STORE_HEADERS }
    )
  }
}
