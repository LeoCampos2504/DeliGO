import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { createNotification, orderUpdateNotification } from "@/lib/push"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { isAvailableForDriverAcceptance, type MetodoEntrega } from "@/lib/order-transitions"

// POST - Repartidor accepts a pending delivery order
// This uses optimistic concurrency: only accept if no other repartidor has claimed it yet
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user || user.type !== "repartidor") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }

    const { id: pedidoId } = await params

    // Check the repartidor is associated with the negocio of this order
    const pedido = await db.pedido.findUnique({
      where: { id: pedidoId },
      select: {
        id: true,
        estado: true,
        metodoEntrega: true,
        negocioId: true,
        repartidorId: true,
        negocioNombre: true,
      },
    })

    if (!pedido) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 })
    }

    // Verify the repartidor is associated with this negocio
    const asociacion = await db.repartidorNegocio.findFirst({
      where: {
        repartidorId: user.id,
        negocioId: pedido.negocioId,
      },
    })

    if (!asociacion) {
      return NextResponse.json({ error: "No estás asociado a este negocio" }, { status: 403 })
    }

    // Check order is eligible for acceptance:
    // - Must be waiting for a driver: `esperando_repartidor` (canónico) o,
    //   por compatibilidad legacy durante el rollout de T29C,
    //   `en_camino`+repartidorId=null (ver isAvailableForDriverAcceptance)
    // - Must be a delivery order (domicilio)
    // - Must NOT already have a repartidor assigned
    const metodoEntregaTipado = pedido.metodoEntrega as MetodoEntrega
    if (!isAvailableForDriverAcceptance(pedido.estado, metodoEntregaTipado)) {
      return NextResponse.json(
        { error: "El pedido no está disponible para aceptar (estado: " + pedido.estado + ")" },
        { status: 400 }
      )
    }

    if (pedido.repartidorId) {
      return NextResponse.json(
        { error: "El pedido ya fue aceptado por otro repartidor" },
        { status: 409 }
      )
    }

    // Get repartidor name for denormalization
    const repartidor = await db.repartidor.findUnique({
      where: { id: user.id },
      select: { nombre: true },
    })

    // P2-T29C: el CAS compara contra el ÚNICO valor exacto de `estado` leído
    // arriba (nunca un `estado: { in: [...] }` ambiguo en la escritura) —
    // canónico y legacy son ramas explícitas por construcción, no una unión
    // ambigua: `pedido.estado` ya es uno solo de los dos valores permitidos
    // por `isAvailableForDriverAcceptance`, y el WHERE lo compara tal cual.
    const estadoOrigen = pedido.estado

    // Optimistic concurrency: update only if repartidorId is still null
    const updated = await db.pedido.updateMany({
      where: {
        id: pedidoId,
        negocioId: pedido.negocioId,
        estado: estadoOrigen,
        metodoEntrega: "domicilio",
        repartidorId: null, // Only if nobody claimed it yet
      },
      data: {
        estado: "en_camino",
        repartidorId: user.id,
        repartidorNombre: repartidor?.nombre || "Repartidor",
        repartidorAceptaFecha: new Date(),
      },
    })

    if (updated.count === 0) {
      // Another repartidor beat us to it (or the order changed state/was cancelled)
      return NextResponse.json(
        { error: "El pedido ya fue aceptado por otro repartidor" },
        { status: 409 }
      )
    }

    // Log the acceptance event
    await db.pedidoEvento.create({
      data: {
        pedidoId,
        estado: "en_camino",
        estadoAnterior: estadoOrigen,
        userId: user.id,
        userType: "repartidor",
        nota: "Pedido aceptado por repartidor",
      },
    })

    // Notify the cliente that a repartidor was assigned
    const pedidoConCliente = await db.pedido.findUnique({
      where: { id: pedidoId },
      select: {
        clienteId: true,
        clienteNombre: true,
        negocioNombre: true,
      },
    })

    if (pedidoConCliente?.clienteId) {
      const cliente = await db.cliente.findUnique({
        where: { id: pedidoConCliente.clienteId },
        select: { id: true, pushSubscription: true },
      })

      if (cliente) {
        const payload = orderUpdateNotification(pedidoId, pedidoConCliente.negocioNombre, "en_camino")
        await createNotification({
          userId: cliente.id,
          userType: "cliente",
          tipo: "order_update",
          titulo: "Repartidor asignado 🛵",
          cuerpo: `Tu pedido de ${pedidoConCliente.negocioNombre} ya tiene repartidor`,
          pedidoId,
          pushSubscription: cliente.pushSubscription,
          pushPayload: payload,
          cleanupExpired: { model: "cliente", id: cliente.id },
        })
      }
    }

    // Bugfix-1 [11]: no notificar al negocio en este evento — "repartidor en
    // camino" debe avisar únicamente al cliente (ya notificado arriba). El
    // negocio sigue recibiendo el resto de notificaciones propias del pedido
    // (nuevo pedido, cancelación, reseña, etc.) sin cambios.

    // Return the updated pedido
    const pedidoActualizado = await db.pedido.findUnique({
      where: { id: pedidoId },
      include: {
        items: {
          include: {
            producto: {
              select: { id: true, nombre: true, imagenUrl: true },
            },
          },
        },
        negocio: {
          select: {
            id: true,
            nombre: true,
            slug: true,
            logoUrl: true,
            colorPrincipal: true,
          },
        },
      },
    })

    return NextResponse.json({
      pedido: pedidoActualizado,
      message: "Pedido aceptado correctamente",
    })
  } catch (error) {
    console.error("Error accepting pedido:", safeErrorForLog(error))
    return NextResponse.json(
      { error: "Error al aceptar el pedido" },
      { status: 500 }
    )
  }
}
