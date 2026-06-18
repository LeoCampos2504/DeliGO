import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { createNotification, orderUpdateNotification, mesaOrderReadyNotification, empleadosOrderCancelledNotification, salonOrderCancelledNotification } from "@/lib/push"

function safeParseJSON(value: unknown, fallback: unknown = []) {
  if (!value) return fallback
  if (typeof value === "string") {
    try { return JSON.parse(value) } catch { return fallback }
  }
  return value
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  recibido: ["preparando", "cancelado"],
  preparando: ["listo_para_retirar", "cancelado"],
  listo_para_retirar: ["entregado", "cancelado"],
}

const SERVICE_FEE_FIXED = 250

// PATCH /api/salon/pedidos/[id]/estado — Update order status via salon token
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: pedidoId } = await params
    const body = await req.json()
    const { token, estado } = body

    if (!token) {
      return NextResponse.json({ error: "Token requerido" }, { status: 400 })
    }
    if (!estado) {
      return NextResponse.json({ error: "estado es obligatorio" }, { status: 400 })
    }

    // Validate salon token
    const negocio = await db.negocio.findFirst({
      where: { tokenSalon: token },
      select: { id: true },
    })

    if (!negocio) {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 })
    }

    const negocioId = negocio.id

    // Get the pedido
    const pedido = await db.pedido.findUnique({ where: { id: pedidoId } })

    if (!pedido || pedido.negocioId !== negocioId) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 })
    }

    // Validate state transition
    const currentEstado = pedido.estado

    if (currentEstado === estado) {
      return NextResponse.json({ error: "El pedido ya está en ese estado" }, { status: 400 })
    }

    if (currentEstado === "entregado" || currentEstado === "cancelado") {
      return NextResponse.json({ error: "No se puede cambiar el estado de un pedido ya finalizado" }, { status: 400 })
    }

    const allowedTransitions = VALID_TRANSITIONS[currentEstado]
    if (!allowedTransitions || !allowedTransitions.includes(estado)) {
      return NextResponse.json({ error: `Transición no válida: ${currentEstado} → ${estado}` }, { status: 400 })
    }

    // Build update data
    const updateData: Record<string, unknown> = { estado }

    if (estado === "cancelado") {
      updateData.canceladoPor = "vendedor"
      updateData.canceladoMotivo = "Cancelado desde salón"
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
            producto: { select: { id: true, nombre: true, imagenUrl: true } },
          },
        },
      },
    })

    // Accumulate service fee debt when status becomes "entregado"
    if (estado === "entregado" && !pedido.deudaAcumulada) {
      await db.negocio.update({
        where: { id: negocioId },
        data: { deudaTarifa: { increment: SERVICE_FEE_FIXED } },
      })
    }

    // Send notification to the client
    if (pedido.clienteId) {
      try {
        const cliente = await db.cliente.findUnique({
          where: { id: pedido.clienteId },
          select: { pushSubscription: true },
        })
        const payload = orderUpdateNotification(pedidoId, pedido.negocioNombre, estado)
        await createNotification({
          userId: pedido.clienteId,
          userType: "cliente",
          tipo: "order_update",
          titulo: payload.title,
          cuerpo: payload.body,
          pedidoId: pedidoId,
          negocioId: negocioId,
          pushSubscription: cliente?.pushSubscription ?? null,
          pushPayload: payload,
          cleanupExpired: { model: "cliente", id: pedido.clienteId },
        })
      } catch (pushError) {
        console.error("[Push] Failed to send order update notification:", pushError)
      }
    }

    // Notify shared-display PWAs (empleados / salon) when an order is cancelled.
    // When the salon display cancels a mesa order, other salon devices and the
    // empleados panel need to know so the order disappears from their queues.
    if (estado === "cancelado") {
      try {
        const sharedPush = await db.negocio.findUnique({
          where: { id: negocioId },
          select: { pushSubscriptionSalon: true, pushSubscriptionEmpleados: true },
        })
        const isMesaOrder = pedido.metodoEntrega === "mesa"

        if (isMesaOrder) {
          if (sharedPush?.pushSubscriptionSalon) {
            const salonPayload = salonOrderCancelledNotification(
              pedidoId,
              pedido.mesaNumero ?? null,
              pedido.clienteNombre,
              "vendedor"
            )
            await createNotification({
              userId: negocioId,
              userType: "negocio",
              tipo: "salon_order_cancelled",
              titulo: salonPayload.title,
              cuerpo: salonPayload.body,
              pedidoId: pedidoId,
              negocioId: negocioId,
              datos: { mesaNumero: pedido.mesaNumero ?? null, canceladoPor: "vendedor", motivo: "Cancelado desde salón" },
              pushSubscription: sharedPush.pushSubscriptionSalon,
              pushPayload: salonPayload,
              cleanupExpired: { model: "negocio", id: negocioId, field: "pushSubscriptionSalon" },
            })
          }
        } else {
          if (sharedPush?.pushSubscriptionEmpleados) {
            const empPayload = empleadosOrderCancelledNotification(
              pedidoId,
              pedido.clienteNombre,
              "vendedor"
            )
            await createNotification({
              userId: negocioId,
              userType: "negocio",
              tipo: "empleados_order_cancelled",
              titulo: empPayload.title,
              cuerpo: empPayload.body,
              pedidoId: pedidoId,
              negocioId: negocioId,
              datos: { canceladoPor: "vendedor", motivo: "Cancelado desde salón" },
              pushSubscription: sharedPush.pushSubscriptionEmpleados,
              pushPayload: empPayload,
              cleanupExpired: { model: "negocio", id: negocioId, field: "pushSubscriptionEmpleados" },
            })
          }
        }
      } catch (sharedPushError) {
        console.error("[Push] Failed to send shared-display cancellation notification:", sharedPushError)
      }
    }

    // Send push notification to the assigned mozo when order is ready (listo_para_retirar)
    // Primary source: pedido.empleadoId (the mozo who took the order)
    // Fallback: mesa.empleadoId (the mozo currently assigned to the mesa)
    if (estado === "listo_para_retirar" && pedido.mesaId) {
      try {
        console.log(`[Push/Mozo] Pedido ${pedidoId} → listo_para_retirar. Resolviendo mozo (empleadoId=${pedido.empleadoId}, mesaId=${pedido.mesaId})`)

        // Try the mozo who took the order first (pedido.empleadoId)
        let mozo: { id: string; nombre: string; pushSubscription: string | null } | null = null

        if (pedido.empleadoId) {
          mozo = await db.empleado.findUnique({
            where: { id: pedido.empleadoId },
            select: { id: true, nombre: true, pushSubscription: true },
          })
          console.log(`[Push/Mozo] Mozo del pedido (empleadoId=${pedido.empleadoId}):`, mozo ? `${mozo.nombre} (push=${mozo.pushSubscription ? "sí" : "no"})` : "no encontrado")
        }

        // Fallback: mozo currently assigned to the mesa
        if (!mozo?.pushSubscription) {
          const mesa = await db.mesa.findUnique({
            where: { id: pedido.mesaId },
            include: {
              empleado: { select: { id: true, nombre: true, pushSubscription: true } },
            },
          })
          console.log(`[Push/Mozo] Mesa ${pedido.mesaId}:`, mesa ? `empleadoId=${mesa.empleadoId}, push=${mesa.empleado?.pushSubscription ? "sí" : "no"}` : "no encontrada")
          if (mesa?.empleado?.pushSubscription) {
            mozo = mesa.empleado
          }
        }

        if (mozo?.pushSubscription) {
          const mesa = await db.mesa.findUnique({
            where: { id: pedido.mesaId },
            select: { numero: true },
          })
          const mesaNumero = mesa?.numero ?? pedido.mesaNumero ?? 0
          const mozoPayload = mesaOrderReadyNotification(
            pedidoId,
            mesaNumero,
            pedido.clienteNombre
          )
          console.log(`[Push/Mozo] Enviando push a mozo ${mozo.id} (${mozo.nombre}) para mesa ${mesaNumero}`)
          await createNotification({
            userId: mozo.id,
            userType: "empleado",
            tipo: "mesa_order_ready",
            titulo: mozoPayload.title,
            cuerpo: mozoPayload.body,
            pedidoId: pedidoId,
            negocioId: negocioId,
            datos: { mesaNumero },
            pushSubscription: mozo.pushSubscription,
            pushPayload: mozoPayload,
            cleanupExpired: { model: "empleado", id: mozo.id },
            // Wait for the push to actually be sent so errors surface in logs
            awaitPush: true,
          })
          console.log(`[Push/Mozo] Push enviado para pedido ${pedidoId}`)
        } else {
          console.warn(`[Push/Mozo] No se encontró mozo con push subscription para pedido ${pedidoId} (empleadoId=${pedido.empleadoId}, mesaId=${pedido.mesaId})`)
        }
      } catch (mozoPushError) {
        console.error(`[Push/Mozo] Failed to send mozo notification for pedido ${pedidoId}:`, mozoPushError)
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
        ingredientesQuitados: safeParseJSON(item.ingredientesQuitados, []),
      })),
    })
  } catch (error) {
    console.error("Error updating pedido estado (salon):", error)
    return NextResponse.json({ error: "Error al actualizar estado del pedido" }, { status: 500 })
  }
}
