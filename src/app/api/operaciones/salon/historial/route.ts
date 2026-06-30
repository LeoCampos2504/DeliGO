import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireOperacionesScope } from "@/lib/operaciones-terminal-access"

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" }

// Estados FINALES reales de un pedido de mesa (los únicos no-activos alcanzables para mesa,
// según las transiciones del proyecto). El historial nunca incluye pedidos activos.
const ESTADOS_FINALES_MESA = ["entregado", "cancelado"] as const

// Períodos permitidos (etapa 1). El criterio de fechas replica el del Salón del negocio:
// medianoche local del servidor y resta de días. No se aceptan fechas libres del cliente.
const PERIODOS = { hoy: 0, "7d": 7, "30d": 30 } as const
type Periodo = keyof typeof PERIODOS

// Límite fijo y seguro (mismo valor que el historial del panel administrador). Sin cursores
// ni paginación controlada por el cliente en esta etapa.
const HISTORIAL_LIMIT = 50

function resolvePeriodo(value: string | null): Periodo {
  if (value === "hoy" || value === "7d" || value === "30d") return value
  // Default seguro ante período ausente o inválido.
  return "hoy"
}

function startDateForPeriodo(periodo: Periodo): Date {
  const now = new Date()
  // Medianoche local del servidor (mismo patrón que /api/negocio/pedidos).
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const days = PERIODOS[periodo]
  if (days > 0) start.setDate(start.getDate() - days)
  return start
}

function safeParseJSON(value: unknown, fallback: unknown = []) {
  if (!value) return fallback
  if (typeof value === "string") {
    try {
      return JSON.parse(value)
    } catch {
      return fallback
    }
  }
  return value
}

// GET — Historial operativo de Salón (solo lectura) para una Terminal Operativa con
// `salon.historial.ver`. El negocio sale EXCLUSIVAMENTE del contexto seguro de la terminal.
export async function GET(req: NextRequest) {
  try {
    // 401 sin sesión válida de terminal · 403 sin scope `salon.historial.ver`.
    const auth = await requireOperacionesScope(req, "salon.historial.ver")
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
        metodoEntrega: "mesa",
        estado: { in: [...ESTADOS_FINALES_MESA] },
        fecha: { gte: startDate },
      },
      // Orden estable: más reciente primero, con `id` como desempate determinista.
      orderBy: [{ fecha: "desc" }, { id: "desc" }],
      take: HISTORIAL_LIMIT,
      select: {
        id: true,
        mesaNumero: true,
        estado: true,
        fecha: true,
        entregadoFecha: true,
        total: true,
        // Solo nombres visibles (no IDs de empleado/cliente, ni teléfonos/contacto).
        clienteNombre: true,
        empleadoNombre: true,
        items: {
          select: {
            id: true,
            nombre: true,
            cantidad: true,
            precio: true,
            agregados: true,
            secciones: true,
            seccionesPrecios: true,
            ingredientes: true,
            ingredientesQuitados: true,
            talle: true,
            color: true,
          },
        },
      },
    })

    const pedidosOut = pedidos.map((p) => ({
      id: p.id,
      mesaNumero: p.mesaNumero,
      estado: p.estado,
      fecha: p.fecha,
      entregadoFecha: p.entregadoFecha,
      total: p.total,
      clienteNombre: p.clienteNombre,
      empleadoNombre: p.empleadoNombre,
      items: p.items.map((item) => ({
        id: item.id,
        nombre: item.nombre,
        cantidad: item.cantidad,
        precio: item.precio,
        agregados: safeParseJSON(item.agregados, []),
        secciones: safeParseJSON(item.secciones, {}),
        seccionesPrecios: safeParseJSON(item.seccionesPrecios, {}),
        ingredientes: safeParseJSON(item.ingredientes, []),
        ingredientesQuitados: safeParseJSON(item.ingredientesQuitados, []),
        talle: item.talle,
        color: item.color,
      })),
    }))

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
        pedidos: pedidosOut,
      },
      { headers: NO_STORE_HEADERS }
    )
  } catch {
    console.error("[OperacionesSalon] Falló la carga del historial de salón")
    return NextResponse.json(
      { ok: false, error: "Error del servidor" },
      { status: 500, headers: NO_STORE_HEADERS }
    )
  }
}
