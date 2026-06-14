import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getAuthenticatedCliente } from "@/lib/cliente-auth"
import { createNotification, orderCancelledByClienteNotification, clientConfirmedNotification, reviewRequestNotification } from "@/lib/push"

// PUT /api/cliente/pedidos/[id] - Order actions (cancel, confirm receipt, repeat)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cliente = await getAuthenticatedCliente(req)
    if (!cliente) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const body = await req.json()
    const { action } = body // "cancelar" | "confirmar"

    const pedido = await db.pedido.findUnique({
      where: { id },
      include: { items: true, negocio: true },
    })

    if (!pedido || pedido.clienteId !== cliente.id) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 })
    }

    if (action === "cancelar") {
      // Can only cancel if still in early stages
      const cancellableStatuses = ["recibido", "confirmado"]
      if (!cancellableStatuses.includes(pedido.estado)) {
        return NextResponse.json(
          { error: "Este pedido ya no se puede cancelar" },
          { status: 400 }
        )
      }

      // Check cancellation tolerance time
      const tolerancia = pedido.negocio.toleranciaCancelacion ?? 5
      if (tolerancia > 0) {
        const tiempoTranscurrido = Date.now() - new Date(pedido.fecha).getTime()
        const toleranciaMs = tolerancia * 60 * 1000
        if (tiempoTranscurrido > toleranciaMs) {
          return NextResponse.json(
            { error: `El tiempo de cancelación de ${tolerancia} min ya pasó` },
            { status: 400 }
          )
        }
      } else {
        // tolerancia = 0 means no cancellation allowed
        return NextResponse.json(
          { error: "Este negocio no permite cancelaciones" },
          { status: 400 }
        )
      }

      const updated = await db.pedido.update({
        where: { id },
        data: {
          estado: "cancelado",
          canceladoPor: "cliente",
          canceladoFecha: new Date(),
        },
      })

      // Reverse debt from negocio
      if (pedido.tarifaServicio > 0) {
        await db.negocio.update({
          where: { id: pedido.negocioId },
          data: { deudaTarifa: { decrement: pedido.tarifaServicio } },
        })
      }

      // Notify negocio that the order was cancelled by the client
      try {
        const negocioData = await db.negocio.findUnique({
          where: { id: pedido.negocioId },
          select: { pushSubscription: true },
        })
        const payload = orderCancelledByClienteNotification(id, pedido.clienteNombre)
        await createNotification({
          userId: pedido.negocioId,
          userType: "negocio",
          tipo: "order_update",
          titulo: payload.title,
          cuerpo: payload.body,
          pedidoId: id,
          pushSubscription: negocioData?.pushSubscription ?? null,
          pushPayload: payload,
          cleanupExpired: { model: "negocio", id: pedido.negocioId },
        })
      } catch (pushError) {
        console.error("[Push] Failed to send cancellation notification:", pushError)
      }

      return NextResponse.json({ ok: true, pedido: updated })
    }

    if (action === "confirmar") {
      // Can only confirm if ready for pickup or in delivery
      const confirmableStatuses = ["listo_para_retirar", "en_camino"]
      if (!confirmableStatuses.includes(pedido.estado)) {
        return NextResponse.json(
          { error: "Este pedido no se puede confirmar todavía" },
          { status: 400 }
        )
      }

      const updated = await db.pedido.update({
        where: { id },
        data: {
          clienteConfirmaRecibido: true,
          clienteConfirmaFecha: new Date(),
        },
      })

      // Notify negocio and repartidor that client confirmed receipt
      try {
        // Notify negocio
        const negocioData = await db.negocio.findUnique({
          where: { id: pedido.negocioId },
          select: { pushSubscription: true },
        })
        const confirmedPayload = clientConfirmedNotification(id, pedido.clienteNombre)
        await createNotification({
          userId: pedido.negocioId,
          userType: "negocio",
          tipo: "order_update",
          titulo: confirmedPayload.title,
          cuerpo: confirmedPayload.body,
          pedidoId: id,
          pushSubscription: negocioData?.pushSubscription ?? null,
          pushPayload: confirmedPayload,
          cleanupExpired: { model: "negocio", id: pedido.negocioId },
        })

        // Notify repartidor (if delivery order, find associated repartidores)
        if (pedido.metodoEntrega === "domicilio") {
          const repartidores = await db.repartidorNegocio.findMany({
            where: { negocioId: pedido.negocioId },
            include: {
              repartidor: { select: { id: true, pushSubscription: true, activo: true } },
            },
          })
          for (const rn of repartidores) {
            if (rn.repartidor.activo) {
              const repPayload = clientConfirmedNotification(id, pedido.clienteNombre)
              await createNotification({
                userId: rn.repartidor.id,
                userType: "repartidor",
                tipo: "order_update",
                titulo: repPayload.title,
                cuerpo: repPayload.body,
                pedidoId: id,
                pushSubscription: rn.repartidor.pushSubscription,
                pushPayload: repPayload,
                cleanupExpired: { model: "repartidor", id: rn.repartidor.id },
              })
            }
          }
        }
      } catch (pushError) {
        console.error("[Push] Failed to send confirmation notification:", pushError)
      }

      // Send "rate your order" notification after delay (for retiro/mesa orders delivered by negocio)
      if (pedido.estado === "listo_para_retirar") {
        const negocioNombre = pedido.negocioNombre
        setTimeout(async () => {
          try {
            const existingReview = await db.resena.findUnique({
              where: { pedidoId: id },
              select: { id: true },
            })
            if (!existingReview && pedido.clienteId) {
              const clienteForReview = await db.cliente.findUnique({
                where: { id: pedido.clienteId! },
                select: { pushSubscription: true },
              })
              const reviewPayload = reviewRequestNotification(id, negocioNombre)
              await createNotification({
                userId: pedido.clienteId!,
                userType: "cliente",
                tipo: "review_request",
                titulo: reviewPayload.title,
                cuerpo: reviewPayload.body,
                pedidoId: id,
                pushSubscription: clienteForReview?.pushSubscription ?? null,
                pushPayload: reviewPayload,
                cleanupExpired: { model: "cliente", id: pedido.clienteId! },
              })
            }
          } catch (reviewPushError) {
            console.error("[Push] Failed to send review request notification:", reviewPushError)
          }
        }, 2 * 60 * 1000) // 2 minutes
      }

      return NextResponse.json({ ok: true, pedido: updated })
    }

    return NextResponse.json({ error: "Acción no válida" }, { status: 400 })
  } catch (error) {
    console.error("Cliente pedido PUT error:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
