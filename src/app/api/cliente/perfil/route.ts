import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getAuthenticatedCliente } from "@/lib/cliente-auth"

// GET /api/cliente/perfil - Get full profile data with stats
export async function GET(req: NextRequest) {
  try {
    const cliente = await getAuthenticatedCliente(req)
    if (!cliente) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    // Get total orders count
    const totalPedidos = await db.pedido.count({
      where: { clienteId: cliente.id },
    })

    // Get recent orders (last 5)
    const pedidosRecientes = await db.pedido.findMany({
      where: { clienteId: cliente.id },
      orderBy: { fecha: "desc" },
      take: 5,
      select: {
        id: true,
        negocioNombre: true,
        total: true,
        estado: true,
        fecha: true,
        metodoEntrega: true,
      },
    })

    return NextResponse.json({
      ok: true,
      perfil: {
        id: cliente.id,
        nombre: cliente.nombre,
        email: cliente.email,
        telefono: cliente.telefono,
        googleId: cliente.googleId,
        fechaRegistro: cliente.fechaRegistro,
        pushSubscription: !!cliente.pushSubscription,
        direcciones: cliente.direcciones,
        favoritos: cliente.favoritos.map((f) => f.negocio),
        totalPedidos,
        totalFavoritos: cliente.favoritos.length,
        totalResenas: cliente._count.resenas,
        pedidosRecientes,
      },
    })
  } catch (error) {
    console.error("Profile GET error:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

// PUT /api/cliente/perfil - Update name and phone
export async function PUT(req: NextRequest) {
  try {
    const cliente = await getAuthenticatedCliente(req)
    if (!cliente) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const body = await req.json()
    const { nombre, telefono } = body

    // Validation
    if (nombre !== undefined && (!nombre || nombre.trim().length < 2)) {
      return NextResponse.json(
        { error: "El nombre debe tener al menos 2 caracteres" },
        { status: 400 }
      )
    }

    const updateData: { nombre?: string; telefono?: string } = {}
    if (nombre !== undefined) updateData.nombre = nombre.trim()
    if (telefono !== undefined) updateData.telefono = telefono.trim()

    const updated = await db.cliente.update({
      where: { id: cliente.id },
      data: updateData,
      select: { id: true, nombre: true, email: true, telefono: true },
    })

    return NextResponse.json({ ok: true, perfil: updated })
  } catch (error) {
    console.error("Profile PUT error:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
