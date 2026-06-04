import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"

// Helper to parse JSON fields safely
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

// Valid state transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  recibido: ["preparando", "cancelado"],
  preparando: ["en_camino", "listo_para_retirar", "cancelado"],
  en_camino: ["cancelado"], // business cannot mark entregado for delivery
  listo_para_retirar: ["entregado", "cancelado"],
}

const ESTADOS_ACTIVOS = ["recibido", "preparando", "en_camino", "listo_para_retirar"]

// GET - List orders for the negocio
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
    const { searchParams } = new URL(req.url)
    const estado = searchParams.get("estado")
    const metodoEntrega = searchParams.get("metodoEntrega")
    const mesaNumero = searchParams.get("mesaNumero")
    const periodo = searchParams.get("periodo")
    const page = parseInt(searchParams.get("page") || "1", 10)
    const limit = parseInt(searchParams.get("limit") || "20", 10)

    const where: Record<string, unknown> = { negocioId }

    if (estado === "activos") {
      where.estado = { in: ESTADOS_ACTIVOS }
    } else if (estado === "historial") {
      where.estado = { notIn: ESTADOS_ACTIVOS }
    } else if (estado) {
      where.estado = estado
    }

    if (metodoEntrega) {
      where.metodoEntrega = metodoEntrega
    }

    if (mesaNumero) {
      where.mesaNumero = parseInt(mesaNumero, 10)
    }

    // Apply periodo date filter
    if (periodo) {
      const now = new Date()
      let startDate: Date
      if (periodo === "hoy") {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      } else if (periodo === "semana") {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        startDate.setDate(startDate.getDate() - 7)
      } else if (periodo === "mes") {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        startDate.setDate(startDate.getDate() - 30)
      } else {
        startDate = new Date(0) // fallback: all time
      }
      where.fecha = { gte: startDate }
    }

    const skip = (page - 1) * limit

    const [pedidos, total] = await Promise.all([
      db.pedido.findMany({
        where,
        include: {
          items: {
            include: {
              producto: {
                select: { id: true, nombre: true, imagenUrl: true },
              },
            },
          },
        },
        orderBy: { fecha: "desc" },
        skip,
        take: limit,
      }),
      db.pedido.count({ where }),
    ])

    // Parse JSON fields in items & strip clienteTelefono
    const pedidosParsed = pedidos.map(({ clienteTelefono, ...p }) => ({
      ...p,
      items: p.items.map((item) => {
        const parsed = {
          ...item,
          agregados: safeParseJSON(item.agregados, []),
          secciones: safeParseJSON(item.secciones, {}),
          seccionesPrecios: safeParseJSON(item.seccionesPrecios, {}),
          ingredientes: safeParseJSON(item.ingredientes, []),
          ingredientesQuitados: safeParseJSON(item.ingredientesQuitados, []),
        }
        return parsed
      }),
    }))

    return NextResponse.json({
      pedidos: pedidosParsed,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    })
  } catch (error) {
    console.error("Error listing pedidos:", error)
    return NextResponse.json(
      { error: "Error al obtener pedidos" },
      { status: 500 }
    )
  }
}

// PUT - Update order status
export async function PUT(req: NextRequest) {
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
    const body = await req.json()
    const { pedidoId, estado, canceladoMotivo } = body

    if (!pedidoId || !estado) {
      return NextResponse.json(
        { error: "pedidoId y estado son obligatorios" },
        { status: 400 }
      )
    }

    // Get the pedido
    const pedido = await db.pedido.findUnique({ where: { id: pedidoId } })

    if (!pedido || pedido.negocioId !== negocioId) {
      return NextResponse.json(
        { error: "Pedido no encontrado" },
        { status: 404 }
      )
    }

    // Validate state transition
    const currentEstado = pedido.estado
    if (currentEstado === estado) {
      return NextResponse.json(
        { error: "El pedido ya está en ese estado" },
        { status: 400 }
      )
    }

    // Already in terminal state
    if (currentEstado === "entregado" || currentEstado === "cancelado") {
      return NextResponse.json(
        { error: "No se puede cambiar el estado de un pedido ya finalizado" },
        { status: 400 }
      )
    }

    const allowedTransitions = VALID_TRANSITIONS[currentEstado]
    if (!allowedTransitions || !allowedTransitions.includes(estado)) {
      return NextResponse.json(
        { error: `Transición no válida: ${currentEstado} → ${estado}` },
        { status: 400 }
      )
    }

    // Validate: preparando → en_camino only for delivery
    if (currentEstado === "preparando" && estado === "en_camino" && pedido.metodoEntrega !== "domicilio") {
      return NextResponse.json(
        { error: "Solo pedidos con delivery pueden pasar a 'en camino'" },
        { status: 400 }
      )
    }

    // Validate: listo_para_retirar → entregado requires client confirmation (except mesa orders)
    if (currentEstado === "listo_para_retirar" && estado === "entregado" && pedido.metodoEntrega !== "mesa" && !pedido.clienteConfirmaRecibido) {
      return NextResponse.json(
        { error: "El cliente aún no confirmó la recepción del pedido" },
        { status: 400 }
      )
    }

    // Validate: cancelado requires motivo
    if (estado === "cancelado" && !canceladoMotivo?.trim()) {
      return NextResponse.json(
        { error: "Debe indicar el motivo de cancelación" },
        { status: 400 }
      )
    }

    // Build update data
    const updateData: Record<string, unknown> = { estado }

    if (estado === "cancelado") {
      updateData.canceladoPor = "vendedor"
      updateData.canceladoMotivo = canceladoMotivo?.trim()
      updateData.canceladoFecha = new Date()
    }

    if (estado === "entregado") {
      updateData.entregadoFecha = new Date()
    }

    const updated = await db.pedido.update({
      where: { id: pedidoId },
      data: updateData,
      include: {
        items: {
          include: {
            producto: {
              select: { id: true, nombre: true, imagenUrl: true },
            },
          },
        },
      },
    })

    const { clienteTelefono: _ct, ...updatedSafe } = updated
    return NextResponse.json({
      ...updatedSafe,
      items: updated.items.map((item) => ({
        ...item,
        agregados: safeParseJSON(item.agregados, []),
        secciones: safeParseJSON(item.secciones, {}),
        seccionesPrecios: safeParseJSON(item.seccionesPrecios, {}),
        ingredientes: safeParseJSON(item.ingredientes, []),
        ingredientesQuitados: safeParseJSON(item.ingredientesQuitados, []),
      })),
    })
  } catch (error) {
    console.error("Error updating pedido:", error)
    return NextResponse.json(
      { error: "Error al actualizar pedido" },
      { status: 500 }
    )
  }
}
