import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

// GET /api/mozo?token=xxx — Validate mozo token and return mozo info + negocio + available mesas
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token")

    if (!token) {
      return NextResponse.json({ error: "Token requerido" }, { status: 400 })
    }

    const empleado = await db.empleado.findFirst({
      where: { token },
      include: {
        negocio: {
          select: {
            id: true,
            nombre: true,
            slug: true,
            colorPrincipal: true,
            logoUrl: true,
            salonActivo: true,
          },
        },
        mesas: {
          where: { activa: true },
          select: {
            id: true,
            numero: true,
            nombre: true,
            zona: true,
            capacidad: true,
          },
          orderBy: { numero: "asc" },
        },
      },
      // Also select pushSubscription
    })

    if (!empleado) {
      return NextResponse.json({ error: "Token inválido" }, { status: 404 })
    }

    if (!empleado.activo) {
      return NextResponse.json({ error: "Empleado inactivo" }, { status: 403 })
    }

    // Get all active mesas for this negocio (not just the ones assigned to this mozo)
    const allMesas = await db.mesa.findMany({
      where: {
        negocioId: empleado.negocioId,
        activa: true,
      },
      select: {
        id: true,
        numero: true,
        nombre: true,
        zona: true,
        capacidad: true,
        empleadoId: true,
        empleado: {
          select: { id: true, nombre: true, codigo: true },
        },
      },
      orderBy: { numero: "asc" },
    })

    // Get active orders for mesas to show status
    const activeMesaOrders = await db.pedido.findMany({
      where: {
        negocioId: empleado.negocioId,
        metodoEntrega: "mesa",
        estado: { in: ["recibido", "preparando", "listo_para_retirar"] },
      },
      select: {
        id: true,
        mesaNumero: true,
        estado: true,
        total: true,
      },
    })

    // Build mesa order map
    const mesaOrdersMap = new Map<number, typeof activeMesaOrders>()
    for (const order of activeMesaOrders) {
      if (!order.mesaNumero) continue
      if (!mesaOrdersMap.has(order.mesaNumero)) mesaOrdersMap.set(order.mesaNumero, [])
      mesaOrdersMap.get(order.mesaNumero)!.push(order)
    }

    // Enrich mesas with order status
    const enrichedMesas = allMesas.map((mesa) => ({
      ...mesa,
      orders: mesaOrdersMap.get(mesa.numero) ?? [],
      hasActiveOrders: (mesaOrdersMap.get(mesa.numero) ?? []).length > 0,
      isAssignedToMe: mesa.empleadoId === empleado.id,
    }))

    return NextResponse.json({
      id: empleado.id,
      nombre: empleado.nombre,
      codigo: empleado.codigo,
      rol: empleado.rol,
      token: empleado.token,
      hasPushSubscription: !!empleado.pushSubscription,
      negocio: empleado.negocio,
      mesas: enrichedMesas,
      myAssignedMesas: empleado.mesas,
    })
  } catch (error) {
    console.error("Error validating mozo token:", error)
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 })
  }
}
