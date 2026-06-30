import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireOperacionesScope } from "@/lib/operaciones-terminal-access"

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" }

// Estados FINALES reales de un pedido PyR no-mesa.
const ESTADOS_FINALES = ["entregado", "cancelado"] as const

// Períodos permitidos (mismo criterio que el historial de Salón Operaciones).
const PERIODOS = { hoy: 0, "7d": 7, "30d": 30 } as const
type Periodo = keyof typeof PERIODOS

// Límite fijo y seguro (sin paginación de cliente).
const HISTORIAL_LIMIT = 50

function resolvePeriodo(value: string | null): Periodo {
  if (value === "hoy" || value === "7d" || value === "30d") return value
  // Default seguro ante período ausente o inválido.
  return "hoy"
}

function startDateForPeriodo(periodo: Periodo): Date {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const days = PERIODOS[periodo]
  if (days > 0) start.setDate(start.getDate() - days)
  return start
}

// GET — Historial operativo PyR (solo lectura) de pedidos no-mesa finalizados para una
// Terminal Operativa con `pyr.pedidos.ver`. El negocio sale EXCLUSIVAMENTE del contexto seguro.
export async function GET(req: NextRequest) {
  try {
    // 401 sin sesión válida de terminal · 403 sin scope `pyr.pedidos.ver`.
    const auth = await requireOperacionesScope(req, "pyr.pedidos.ver")
    if (!auth.ok) return auth.response

    // El negocio se deriva del contexto seguro: nunca del cliente.
    const negocioId = auth.context.negocio.id

    // Único parámetro aceptado: período (hoy | 7d | 30d). Cualquier otro filtro se ignora.
    const { searchParams } = new URL(req.url)
    const periodo = resolvePeriodo(searchParams.get("periodo"))
    const startDate = startDateForPeriodo(periodo)

    const pedidos = await db.pedido.findMany({
      where: {
        negocioId,
        metodoEntrega: { not: "mesa" },
        estado: { in: [...ESTADOS_FINALES] },
        fecha: { gte: startDate },
      },
      orderBy: [{ fecha: "desc" }, { id: "desc" }],
      take: HISTORIAL_LIMIT,
      // Solo datos operativos mínimos: nunca cliente, montos, items, dirección ni motivos.
      select: {
        id: true,
        estado: true,
        metodoEntrega: true,
        fecha: true,
        entregadoFecha: true,
        canceladoFecha: true,
      },
    })

    return NextResponse.json(
      {
        ok: true,
        periodo,
        terminal: { nombre: auth.context.terminal.nombre },
        negocio: {
          nombre: auth.context.negocio.nombre,
          colorPrincipal: auth.context.negocio.colorPrincipal,
        },
        pedidos: pedidos.map((p) => ({
          id: p.id,
          estado: p.estado,
          metodoEntrega: p.metodoEntrega,
          fecha: p.fecha,
          entregadoFecha: p.entregadoFecha,
          canceladoFecha: p.canceladoFecha,
        })),
      },
      { headers: NO_STORE_HEADERS }
    )
  } catch {
    console.error("[OperacionesPyR] Falló la carga del historial PyR")
    return NextResponse.json(
      { ok: false, error: "Error del servidor" },
      { status: 500, headers: NO_STORE_HEADERS }
    )
  }
}
