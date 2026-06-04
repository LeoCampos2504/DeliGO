import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { sendPushNotification, orderUpdateNotification, newDeliveryNotification, reviewRequestNotification } from "@/lib/push"

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
    const { id: pedidoId } = await params
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

    // Send push notification to the client about order status update
    if (pedido.clienteId) {
      try {
        const cliente = await db.cliente.findUnique({
          where: { id: pedido.clienteId },
          select: { pushSubscription: true },
        })
        if (cliente?.pushSubscription) {
          const notification = orderUpdateNotification(
            pedidoId,
            pedido.negocioNombre,
            estado
          )
          await sendPushNotification(cliente.pushSubscription, notification)
        }
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
          if (rn.repartidor.activo && rn.repartidor.pushSubscription) {
            await sendPushNotification(
              rn.repartidor.pushSubscription,
              newDeliveryNotification(pedidoId, pedido.negocioNombre, pedido.direccion || "")
            )
          }
        }
      } catch (pushError) {
        console.error("[Push] Failed to send delivery notification to repartidores:", pushError)
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
            if (clienteForReview?.pushSubscription) {
              await sendPushNotification(
                clienteForReview.pushSubscription,
                reviewRequestNotification(pedidoId, negocioNombre)
              )
            }
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
  }
}
