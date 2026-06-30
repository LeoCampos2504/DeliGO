import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireOperacionesScope } from "@/lib/operaciones-terminal-access"

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" }

// Estados FINALES reales de un pedido de mesa (los únicos no-activos alcanzables para mesa,
// mismos que usa el historial operativo). Las estadísticas nunca cuentan pedidos activos.
const ESTADOS_FINALES_MESA = ["entregado", "cancelado"] as const

// Períodos permitidos (mismo criterio que el historial operativo): medianoche local del
// servidor y resta de días. No se aceptan fechas libres del cliente.
const PERIODOS = { hoy: 0, "7d": 7, "30d": 30 } as const
type Periodo = keyof typeof PERIODOS

function resolvePeriodo(value: string | null): Periodo {
  if (value === "hoy" || value === "7d" || value === "30d") return value
  // Default seguro ante período ausente o inválido (igual que historial).
  return "hoy"
}

function startDateForPeriodo(periodo: Periodo): Date {
  const now = new Date()
  // Medianoche local del servidor (mismo patrón que /api/operaciones/salon/historial).
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const days = PERIODOS[periodo]
  if (days > 0) start.setDate(start.getDate() - days)
  return start
}

// GET — Estadísticas operativas de Salón (solo lectura, sin montos) para una Terminal
// Operativa con `salon.estadisticas.ver`. El negocio sale EXCLUSIVAMENTE del contexto seguro.
export async function GET(req: NextRequest) {
  try {
    // 401 sin sesión válida de terminal · 403 sin scope `salon.estadisticas.ver`.
    const auth = await requireOperacionesScope(req, "salon.estadisticas.ver")
    if (!auth.ok) return auth.response

    // El negocio se deriva del contexto seguro: nunca del cliente.
    const negocioId = auth.context.negocio.id

    // Único parámetro aceptado: período (hoy | 7d | 30d). Cualquier otro filtro se ignora.
    const { searchParams } = new URL(req.url)
    const periodo = resolvePeriodo(searchParams.get("periodo"))
    const startDate = startDateForPeriodo(periodo)

    // Agregación en base de datos por estado (patrón groupBy ya usado en el proyecto).
    // Una sola consulta, sin traer filas ni ítems ni montos. Conteos exactos (sin límite).
    const grouped = await db.pedido.groupBy({
      by: ["estado"],
      where: {
        negocioId,
        metodoEntrega: "mesa",
        estado: { in: [...ESTADOS_FINALES_MESA] },
        fecha: { gte: startDate },
      },
      _count: { id: true },
    })

    let pedidosEntregados = 0
    let pedidosCancelados = 0
    for (const row of grouped) {
      if (row.estado === "entregado") pedidosEntregados = row._count.id
      else if (row.estado === "cancelado") pedidosCancelados = row._count.id
    }

    const pedidosFinalizados = pedidosEntregados + pedidosCancelados
    const porcentajeEntregados =
      pedidosFinalizados > 0 ? Math.round((pedidosEntregados / pedidosFinalizados) * 100) : 0

    return NextResponse.json(
      {
        ok: true,
        periodo,
        // Datos seguros del encabezado (sin IDs internos, scopes crudos ni tokens).
        terminal: { nombre: auth.context.terminal.nombre },
        negocio: {
          nombre: auth.context.negocio.nombre,
          colorPrincipal: auth.context.negocio.colorPrincipal,
        },
        // Solo conteos operativos. Sin montos, clientes, empleados ni datos administrativos.
        resumen: {
          pedidosFinalizados,
          pedidosEntregados,
          pedidosCancelados,
          porcentajeEntregados,
        },
      },
      { headers: NO_STORE_HEADERS }
    )
  } catch {
    console.error("[OperacionesSalon] Falló la carga de estadísticas de salón")
    return NextResponse.json(
      { ok: false, error: "Error del servidor" },
      { status: 500, headers: NO_STORE_HEADERS }
    )
  }
}
