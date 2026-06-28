import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { createNotification, orderUpdateNotification, newDeliveryNotification, reviewRequestNotification } from "@/lib/push"
import { acquireLock, releaseLock } from "@/lib/concurrency"
import { logPedidoEstadoChange } from "@/lib/audit"
import { notifyMesaOrderReadyForMozo } from "@/lib/mesa-order-ready-notification"

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
  en_camino: ["cancelado"], // business cannot mark entregado for delivery — client + repartidor handle that
  listo_para_retirar: ["entregado", "cancelado"], // entregado only if clienteConfirmaRecibido
}

const SERVICE_FEE_FIXED = 250 // $250 fixed service fee

// PATCH - Update order status
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Concurrency protection: compute lock key before try so it's accessible in finally
  const { id: pedidoId } = await params
  const estadoLockKey = `pedido-estado:${pedidoId}`

  // Concurrency protection: prevent double status updates on the same order
  if (!acquireLock(estadoLockKey)) {
    return NextResponse.json(
      { error: "El estado de este pedido se está actualizando. Intentá de nuevo." },
      { status: 409 }
    )
  }

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
    const { estado, motivo } = body

    if (!estado) {
      return NextResponse.json(
        { error: "estado es obligatorio" },
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

    // Validate: preparando → en_camino only for delivery orders
    if (
      currentEstado === "preparando" &&
      estado === "en_camino" &&
      pedido.metodoEntrega !== "domicilio"
    ) {
      return NextResponse.json(
        { error: "Solo pedidos con delivery pueden pasar a 'en camino'" },
        { status: 400 }
      )
    }

    // Validate: listo_para_retirar → entregado requires client confirmation (except mesa orders)
    if (
      currentEstado === "listo_para_retirar" &&
      estado === "entregado" &&
      pedido.metodoEntrega !== "mesa" &&
      !pedido.clienteConfirmaRecibido
    ) {
      return NextResponse.json(
        { error: "El cliente aún no confirmó la recepción del pedido" },
        { status: 400 }
      )
    }

    // Validate: cancelado requires motivo
    if (estado === "cancelado" && !motivo?.trim()) {
      return NextResponse.json(
        { error: "Debe indicar el motivo de cancelación" },
        { status: 400 }
      )
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

    // Update the order
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

    // Audit log
    await logPedidoEstadoChange({
      pedidoId,
      estadoNuevo: estado,
      estadoAnterior: currentEstado,
      userId: negocioId,
      userType: "negocio",
    })

    // Accumulate service fee debt when status becomes "entregado"
    if (estado === "entregado" && !pedido.deudaAcumulada) {
      const fee = SERVICE_FEE_FIXED
      await db.negocio.update({
        where: { id: negocioId },
        data: {
          deudaTarifa: { increment: fee },
        },
      })
    }

    // Send notification to the client about order status update
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

    if (estado === "listo_para_retirar" && pedido.metodoEntrega === "mesa") {
      try {
        await notifyMesaOrderReadyForMozo({
          pedido: {
            id: pedidoId,
            negocioId,
            negocioSlug: pedido.negocioSlug,
            metodoEntrega: pedido.metodoEntrega,
            mesaId: pedido.mesaId,
            mesaNumero: pedido.mesaNumero,
            empleadoId: pedido.empleadoId,
          },
          estadoAnterior: currentEstado,
        })
      } catch (mozoPushError) {
        console.error(`[Push/Mozo] Failed to notify ready mesa order for pedido ${pedidoId}:`, mozoPushError)
      }
    }

    // Send "rate your order" notification when order is delivered (retiro/mesa by negocio)
    if (estado === "entregado" && pedido.clienteId) {
      const negocioNombre = pedido.negocioNombre
      setTimeout(async () => {
        try {
          const existingReview = await db.resena.findUnique({
            where: { pedidoId },
            select: { id: true },
          })
          if (!existingReview) {
            const clienteForReview = await db.cliente.findUnique({
              where: { id: pedido.clienteId! },
              select: { pushSubscription: true },
            })
            const payload = reviewRequestNotification(pedidoId, negocioNombre)
            await createNotification({
              userId: pedido.clienteId!,
              userType: "cliente",
              tipo: "review_request",
              titulo: payload.title,
              cuerpo: payload.body,
              pedidoId: pedidoId,
              negocioId: negocioId,
              pushSubscription: clienteForReview?.pushSubscription ?? null,
              pushPayload: payload,
              cleanupExpired: { model: "cliente", id: pedido.clienteId! },
            })
          }
        } catch (reviewPushError) {
          console.error("[Push] Failed to send review request notification:", reviewPushError)
        }
      }, 2 * 60 * 1000) // 2 minutes
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
    console.error("Error updating pedido estado:", error)
    return NextResponse.json(
      { error: "Error al actualizar estado del pedido" },
      { status: 500 }
    )
  } finally {
    // Always release the lock, even on error
    releaseLock(estadoLockKey)
  }
}
