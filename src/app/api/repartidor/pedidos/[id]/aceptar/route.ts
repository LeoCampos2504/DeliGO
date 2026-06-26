import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { createNotification, orderUpdateNotification } from "@/lib/push"

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
    // - Must be "en_camino" (business already approved it for delivery)
    // - Must be a delivery order (domicilio)
    // - Must NOT already have a repartidor assigned
    if (pedido.estado !== "en_camino") {
      return NextResponse.json(
        { error: "El pedido no está disponible para aceptar (estado: " + pedido.estado + ")" },
        { status: 400 }
      )
    }

    if (pedido.metodoEntrega !== "domicilio") {
      return NextResponse.json(
        { error: "El pedido no es de delivery" },
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

    // Optimistic concurrency: update only if repartidorId is still null
    const updated = await db.pedido.updateMany({
      where: {
        id: pedidoId,
        negocioId: pedido.negocioId,
        estado: "en_camino",
        metodoEntrega: "domicilio",
        repartidorId: null, // Only if nobody claimed it yet
      },
      data: {
        repartidorId: user.id,
        repartidorNombre: repartidor?.nombre || "Repartidor",
        repartidorAceptaFecha: new Date(),
      },
    })

    if (updated.count === 0) {
      // Another repartidor beat us to it
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
        estadoAnterior: "en_camino",
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

    // Notify the negocio that a repartidor accepted
    const negocio = await db.negocio.findUnique({
      where: { id: pedido.negocioId },
      select: { id: true, pushSubscription: true },
    })

    if (negocio) {
      const payload = orderUpdateNotification(pedidoId, pedido.negocioNombre, "en_camino")
      await createNotification({
        userId: negocio.id,
        userType: "negocio",
        tipo: "order_update",
        titulo: "Repartidor aceptó el delivery 🛵",
        cuerpo: `${repartidor?.nombre || "Repartidor"} aceptó el pedido de delivery`,
        pedidoId,
        negocioId: negocio.id,
        pushSubscription: negocio.pushSubscription,
        pushPayload: payload,
        cleanupExpired: { model: "negocio", id: negocio.id },
      })
    }

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
    console.error("Error accepting pedido:", error)
    return NextResponse.json(
      { error: "Error al aceptar el pedido" },
      { status: 500 }
    )
  }
}
