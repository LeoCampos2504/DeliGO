import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getAuthenticatedCliente } from "@/lib/cliente-auth"
import { sendPushNotification, orderCancelledByClienteNotification, clientConfirmedNotification, reviewRequestNotification } from "@/lib/push"

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
        if (negocioData?.pushSubscription) {
          await sendPushNotification(
            negocioData.pushSubscription,
            orderCancelledByClienteNotification(id, pedido.clienteNombre)
          )
        }
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
        if (negocioData?.pushSubscription) {
          await sendPushNotification(
            negocioData.pushSubscription,
            clientConfirmedNotification(id, pedido.clienteNombre)
          )
        }

        // Notify repartidor (if delivery order, find associated repartidores)
        if (pedido.metodoEntrega === "domicilio") {
          const repartidores = await db.repartidorNegocio.findMany({
            where: { negocioId: pedido.negocioId },
            include: {
              repartidor: { select: { id: true, pushSubscription: true, activo: true } },
            },
          })
          for (const rn of repartidores) {
            if (rn.repartidor.activo && rn.repartidor.pushSubscription) {
              await sendPushNotification(
                rn.repartidor.pushSubscription,
                clientConfirmedNotification(id, pedido.clienteNombre)
              )
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
              if (clienteForReview?.pushSubscription) {
                await sendPushNotification(
                  clienteForReview.pushSubscription,
                  reviewRequestNotification(id, negocioNombre)
                )
              }
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
