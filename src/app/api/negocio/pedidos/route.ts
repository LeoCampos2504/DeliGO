import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { notifyMesaOrderReadyForMozo } from "@/lib/mesa-order-ready-notification"
import { createNotification, orderUpdateNotification } from "@/lib/push"
import { notifyOperationsOrderCancelled } from "@/lib/operations-cancellation-notification"
import { revertirTarifaSiCorresponde, DeudaReversionError } from "@/lib/pedido-cancelacion-financiera"
import { getIngredientesQuitadosNombres } from "@/lib/pedido-item-personalizacion"
import { safeErrorForLog } from "@/lib/log-safe-error"

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
        // Orden estable (P1-B): se conserva la dirección existente (más recientes
        // primero, usada tanto por la vista de "activos" como por "historial" de este
        // mismo endpoint) y se agrega `id` como desempate determinista. Sin este
        // desempate, dos pedidos con `fecha` idéntica podían intercambiar posición
        // entre polls (orders-tab.tsx refetchInterval=15s, salon-tab.tsx=5s).
        orderBy: [{ fecha: "desc" }, { id: "desc" }],
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
          // P1-A.2A-ii: contrato plano estable (orders-tab.tsx/salon-tab.tsx ya lo
          // consumen como string[] vía getIngredientesQuitadosNombres) — nunca un
          // objeto crudo, sin importar el formato persistido.
          ingredientesQuitados: getIngredientesQuitadosNombres(item.ingredientesQuitados),
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
    console.error("Error listing pedidos:", safeErrorForLog(error))
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

    // Get the pedido. Esta ruta es exclusiva de Salón/mesa (Seguridad-2B): el `where`
    // exige metodoEntrega:"mesa" en servidor, nunca solo en la UI, para que no pueda
    // usarse para operar pedidos de retiro/domicilio (que tienen su propio endpoint con
    // sus propias reglas financieras y de confirmación).
    const pedido = await db.pedido.findFirst({
      where: { id: pedidoId, negocioId, metodoEntrega: "mesa" },
      select: {
        id: true,
        negocioId: true,
        negocioNombre: true,
        clienteId: true,
        direccion: true,
        metodoEntrega: true,
        mesaId: true,
        mesaNumero: true,
        empleadoId: true,
        estado: true,
        clienteConfirmaRecibido: true,
        negocio: {
          select: { slug: true },
        },
      },
    })

    if (!pedido) {
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

    // La transición a "cancelado" usa CAS + transacción con reversión de deuda
    // condicional (Seguridad-2C). Esta ruta es exclusiva de mesa (tarifaServicio=0 al
    // crearse), por lo que en la práctica nunca revierte nada, pero aplica la misma
    // regla uniforme (deudaAcumulada=true && tarifaServicio>0) que el resto de rutas.
    let updated
    if (estado === "cancelado") {
      let outcome: { kind: "conflict" } | { kind: "cancelled" }
      try {
        outcome = await db.$transaction(async (tx) => {
          const cas = await tx.pedido.updateMany({
            where: { id: pedidoId, negocioId, metodoEntrega: "mesa", estado: currentEstado },
            data: updateData,
          })
          if (cas.count !== 1) return { kind: "conflict" as const }

          // El helper relee tarifaServicio/deudaAcumulada frescos DESPUÉS de este CAS,
          // dentro de la misma transacción (Seguridad-2C.1) — nunca usa el `pedido`
          // leído antes de la transacción.
          await revertirTarifaSiCorresponde(tx, {
            id: pedidoId,
            negocioId,
          })

          return { kind: "cancelled" as const }
        })
      } catch (error) {
        if (error instanceof DeudaReversionError) {
          return NextResponse.json(
            { error: "No se pudo cancelar este pedido en este momento." },
            { status: 400 }
          )
        }
        throw error
      }

      if (outcome.kind === "conflict") {
        return NextResponse.json(
          { error: "No se puede cambiar el estado de un pedido ya finalizado" },
          { status: 400 }
        )
      }

      updated = await db.pedido.findUniqueOrThrow({
        where: { id: pedidoId },
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
    } else {
      updated = await db.pedido.update({
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
    }

    const cancellationPushEndpoints = estado === "cancelado" ? new Set<string>() : undefined

    if (estado === "listo_para_retirar" && pedido.metodoEntrega === "mesa") {
      try {
        await notifyMesaOrderReadyForMozo({
          pedido: {
            id: pedido.id,
            negocioId: pedido.negocioId,
            negocioSlug: pedido.negocio.slug,
            metodoEntrega: pedido.metodoEntrega,
            mesaId: pedido.mesaId,
            mesaNumero: pedido.mesaNumero,
            empleadoId: pedido.empleadoId,
          },
          estadoAnterior: currentEstado,
        })
      } catch (mozoPushError) {
        console.error(`[Push/Mozo] Failed to notify ready mesa order for pedido ${pedidoId}:`, safeErrorForLog(mozoPushError))
      }
    }

    if (estado === "cancelado") {
      try {
        if (pedido.clienteId) {
          const cliente = await db.cliente.findUnique({
            where: { id: pedido.clienteId },
            select: { pushSubscription: true },
          })
          const payload = orderUpdateNotification(pedidoId, pedido.negocioNombre, "cancelado")
          await createNotification({
            userId: pedido.clienteId,
            userType: "cliente",
            tipo: "order_update",
            titulo: payload.title,
            cuerpo: payload.body,
            pedidoId,
            negocioId,
            pushSubscription: cliente?.pushSubscription ?? null,
            pushPayload: payload,
            reservedPushEndpoints: cancellationPushEndpoints,
            cleanupExpired: { model: "cliente", id: pedido.clienteId },
          })
        }

        await notifyOperationsOrderCancelled({
          pedidoId,
          negocioId,
          metodoEntrega: pedido.metodoEntrega,
          mesaNumero: pedido.mesaNumero,
          canceladoPor: "vendedor",
          reservedPushEndpoints: cancellationPushEndpoints,
        })
      } catch (pushError) {
        console.error("[Push] Failed to send mesa cancellation notifications:", safeErrorForLog(pushError))
      }
    }

    const { clienteTelefono: _ct, ...updatedSafe } = updated
    return NextResponse.json({
      ...updatedSafe,
      items: updated.items.map((item) => ({
        ...item,
        agregados: safeParseJSON(item.agregados, []),
        secciones: safeParseJSON(item.secciones, {}),
        seccionesPrecios: safeParseJSON(item.seccionesPrecios, {}),
        ingredientes: safeParseJSON(item.ingredientes, []),
        ingredientesQuitados: getIngredientesQuitadosNombres(item.ingredientesQuitados),
      })),
    })
  } catch (error) {
    console.error("Error updating pedido:", safeErrorForLog(error))
    return NextResponse.json(
      { error: "Error al actualizar pedido" },
      { status: 500 }
    )
  }
}
