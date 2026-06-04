import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { sendPushNotification, orderDeliveredNotification, reviewRequestNotification } from "@/lib/push"

// PUT - Mark order as delivered by repartidor
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: pedidoId } = await params
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user || user.type !== "repartidor") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }

    // Verify repartidor is active
    const repartidor = await db.repartidor.findUnique({
      where: { id: user.id },
    })

    if (!repartidor || !repartidor.activo) {
      return NextResponse.json(
        { error: "Tu cuenta está desactivada" },
        { status: 403 }
      )
    }

    // Get the pedido
    const pedido = await db.pedido.findUnique({
      where: { id: pedidoId },
      include: {
        negocio: {
          select: {
            id: true,
            nombre: true,
            deudaTarifa: true,
            limiteDeuda: true,
          },
        },
      },
    })

    if (!pedido) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 })
    }

    // Validate: must be en_camino
    if (pedido.estado !== "en_camino") {
      return NextResponse.json(
        { error: "El pedido no está en camino" },
        { status: 400 }
      )
    }

    // Validate: must be a delivery order
    if (pedido.metodoEntrega !== "domicilio") {
      return NextResponse.json(
        { error: "Solo se pueden entregar pedidos con delivery" },
        { status: 400 }
      )
    }

    // Validate: repartidor must be associated with this negocio
    const asociacion = await db.repartidorNegocio.findUnique({
      where: {
        repartidorId_negocioId: {
          repartidorId: user.id,
          negocioId: pedido.negocioId,
        },
      },
    })

    if (!asociacion) {
      return NextResponse.json(
        { error: "No estás asociado a este local" },
        { status: 403 }
      )
    }

    // Validate: client must have confirmed receipt (key business rule from Flask)
    if (!pedido.clienteConfirmaRecibido) {
      return NextResponse.json(
        { error: "El cliente aún no confirmó la recepción del pedido" },
        { status: 400 }
      )
    }

    // Mark as delivered
    const updated = await db.pedido.update({
      where: { id: pedidoId },
      data: {
        estado: "entregado",
        entregadoPorRepartidor: true,
        entregadoFecha: new Date(),
      },
    })

    // Accumulate service fee debt (from Flask: _acumular_deuda_tarifa)
    // Only if not already accumulated (prevent double-charging)
    if (!pedido.deudaAcumulada && pedido.tarifaServicio > 0) {
      try {
        await db.pedido.update({
          where: { id: pedidoId },
          data: { deudaAcumulada: true },
        })

        await db.negocio.update({
          where: { id: pedido.negocioId },
          data: {
            deudaTarifa: { increment: pedido.tarifaServicio },
          },
        })
      } catch (debtError) {
        console.error("Error acumulating debt:", debtError)
        // Don't fail the delivery if debt accumulation fails
      }
    }

    // Send push notifications
    try {
      // Notify cliente that order was delivered
      if (pedido.clienteId) {
        const cliente = await db.cliente.findUnique({
          where: { id: pedido.clienteId },
          select: { pushSubscription: true },
        })
        if (cliente?.pushSubscription) {
          await sendPushNotification(
            cliente.pushSubscription,
            orderDeliveredNotification(pedidoId, pedido.negocioNombre)
          )
        }

        // Schedule "rate your order" notification (2 minutes delay)
        setTimeout(async () => {
          try {
            // Check if client already left a review for this order
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
                  reviewRequestNotification(pedidoId, pedido.negocioNombre)
                )
              }
            }
          } catch (reviewPushError) {
            console.error("[Push] Failed to send review request notification:", reviewPushError)
          }
        }, 2 * 60 * 1000) // 2 minutes
      }

      // Notify negocio that order was delivered by repartidor
      const negocio = await db.negocio.findUnique({
        where: { id: pedido.negocioId },
        select: { pushSubscription: true },
      })
      if (negocio?.pushSubscription) {
        await sendPushNotification(
          negocio.pushSubscription,
          {
            title: "Pedido entregado por repartidor ✅",
            body: `El pedido de ${pedido.clienteNombre} fue entregado`,
            tag: `order-delivered-${pedidoId}`,
            data: {
              type: "order_update",
              pedidoId,
            },
          }
        )
      }
    } catch (pushError) {
      console.error("[Push] Failed to send delivery notifications:", pushError)
    }

    return NextResponse.json({
      ok: true,
      pedido: {
        id: updated.id,
        estado: updated.estado,
        entregadoPorRepartidor: updated.entregadoPorRepartidor,
        entregadoFecha: updated.entregadoFecha,
      },
    })
  } catch (error) {
    console.error("Error marking pedido as delivered:", error)
    return NextResponse.json({ error: "Error al marcar como entregado" }, { status: 500 })
  }
}
