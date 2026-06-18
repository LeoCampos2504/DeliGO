import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { createNotification, orderUpdateNotification, newDeliveryNotification, empleadosOrderCancelledNotification, salonOrderCancelledNotification } from "@/lib/push"

function safeParseJSON(value: unknown, fallback: unknown = []) {
  if (!value) return fallback
  if (typeof value === "string") {
    try { return JSON.parse(value) } catch { return fallback }
  }
  return value
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  recibido: ["preparando", "cancelado"],
  preparando: ["en_camino", "listo_para_retirar", "cancelado"],
  en_camino: ["cancelado"],
  listo_para_retirar: ["entregado", "cancelado"],
}

const SERVICE_FEE_FIXED = 250

// Validate token — supports shared empleados token and legacy empleado tokens
async function validateAccess(token: string, type?: string | null): Promise<{ negocioId: string } | null> {
  if (!token) return null

  // Shared employee token (for /e/[token] page)
  if (type === "empleados") {
    const negocio = await db.negocio.findFirst({
      where: { tokenEmpleados: token },
      select: { id: true },
    })
    return negocio ? { negocioId: negocio.id } : null
  }

  // Legacy: empleado token (for /m/[token] mozo page)
  const empleado = await db.empleado.findFirst({
    where: { token, activo: true },
    select: { id: true, nombre: true, negocioId: true },
  })
  return empleado ? { negocioId: empleado.negocioId } : null
}

// PATCH /api/empleado/pedidos/[id]/estado — Update order status via token
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: pedidoId } = await params
    const body = await req.json()
    const { token, type, estado, motivo } = body

    if (!token) {
      return NextResponse.json({ error: "Token requerido" }, { status: 400 })
    }
    if (!estado) {
      return NextResponse.json({ error: "estado es obligatorio" }, { status: 400 })
    }

    // Validate access
    const access = await validateAccess(token, type)
    if (!access) {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 })
    }

    const negocioId = access.negocioId

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

    // Validate: preparando → en_camino only for delivery
    if (currentEstado === "preparando" && estado === "en_camino" && pedido.metodoEntrega !== "domicilio") {
      return NextResponse.json({ error: "Solo pedidos con delivery pueden pasar a 'en camino'" }, { status: 400 })
    }

    // Validate: listo_para_retirar → entregado requires client confirmation (except mesa)
    if (currentEstado === "listo_para_retirar" && estado === "entregado" && pedido.metodoEntrega !== "mesa" && !pedido.clienteConfirmaRecibido) {
      return NextResponse.json({ error: "El cliente aún no confirmó la recepción del pedido" }, { status: 400 })
    }

    // Validate: cancelado requires motivo
    if (estado === "cancelado" && !motivo?.trim()) {
      return NextResponse.json({ error: "Debe indicar el motivo de cancelación" }, { status: 400 })
    }

    // Build update data
    const updateData: Record<string, unknown> = { estado }

    if (estado === "cancelado") {
      updateData.canceladoPor = "vendedor"
      updateData.canceladoMotivo = motivo?.trim()
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
    // When an employee cancels from /e/[token], other shared display devices
    // (and the /s/[token] salon display for mesa orders) need to know so the
    // order disappears from their active queues too.
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
              datos: { mesaNumero: pedido.mesaNumero ?? null, canceladoPor: "vendedor", motivo: motivo ?? null },
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
              datos: { canceladoPor: "vendedor", motivo: motivo ?? null },
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

    // Notify repartidores when order goes to en_camino (delivery)
    if (estado === "en_camino" && pedido.metodoEntrega === "domicilio") {
      try {
        const repartidores = await db.repartidorNegocio.findMany({
          where: { negocioId },
          include: {
            repartidor: { select: { id: true, pushSubscription: true, activo: true } },
          },
        })
        for (const rn of repartidores) {
          if (rn.repartidor.activo) {
            const payload = newDeliveryNotification(pedidoId, pedido.negocioNombre, pedido.direccion || "")
            await createNotification({
              userId: rn.repartidor.id,
              userType: "repartidor",
              tipo: "new_delivery",
              titulo: payload.title,
              cuerpo: payload.body,
              pedidoId: pedidoId,
              negocioId: negocioId,
              pushSubscription: rn.repartidor.pushSubscription,
              pushPayload: payload,
              cleanupExpired: { model: "repartidor", id: rn.repartidor.id },
            })
          }
        }
      } catch (pushError) {
        console.error("[Push] Failed to send delivery notification to repartidores:", pushError)
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
    console.error("Error updating pedido estado (empleado):", error)
    return NextResponse.json({ error: "Error al actualizar estado del pedido" }, { status: 500 })
  }
}
