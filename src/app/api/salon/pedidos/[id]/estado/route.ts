import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { createNotification, orderUpdateNotification, mesaOrderReadyNotification } from "@/lib/push"

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

    // Send push notification to the assigned mozo when order is ready (listo_para_retirar)
    if (estado === "listo_para_retirar" && pedido.mesaId) {
      try {
        const mesa = await db.mesa.findUnique({
          where: { id: pedido.mesaId },
          include: { empleado: { select: { id: true, nombre: true, pushSubscription: true } } },
        })

        if (mesa?.empleado?.pushSubscription) {
          const mozoPayload = mesaOrderReadyNotification(
            pedidoId,
            mesa.numero,
            pedido.clienteNombre
          )
          await createNotification({
            userId: mesa.empleado.id,
            userType: "empleado",
            tipo: "mesa_order_ready",
            titulo: mozoPayload.title,
            cuerpo: mozoPayload.body,
            pedidoId: pedidoId,
            negocioId: negocioId,
            datos: { mesaNumero: mesa.numero },
            pushSubscription: mesa.empleado.pushSubscription,
            pushPayload: mozoPayload,
            cleanupExpired: { model: "empleado", id: mesa.empleado.id },
          })
        }
      } catch (mozoPushError) {
        console.error("[Push] Failed to send mozo notification:", mozoPushError)
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
