import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getAuthenticatedCliente } from "@/lib/cliente-auth"
import { SESSION_COOKIE_NAME } from "@/lib/auth"

// DELETE /api/cliente/cuenta - Delete account permanently
export async function DELETE(req: NextRequest) {
  try {
    const cliente = await getAuthenticatedCliente(req)
    if (!cliente) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const body = await req.json()
    const { confirmacion } = body

    if (confirmacion !== "ELIMINAR") {
      return NextResponse.json(
        { error: "Debés escribir ELIMINAR para confirmar" },
        { status: 400 }
      )
    }

    // Delete the cliente (cascade will handle relations)
    await db.cliente.delete({ where: { id: cliente.id } })

    // Also delete the session
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (token) {
      await db.sesion.delete({ where: { token } }).catch(() => {})
    }

    const response = NextResponse.json({
      ok: true,
      message: "Cuenta eliminada permanentemente",
    })
    response.cookies.delete(SESSION_COOKIE_NAME)

    return response
  } catch (error) {
    console.error("Cuenta DELETE error:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}

// GET /api/cliente/cuenta/exportar - Export all user data
export async function GET(req: NextRequest) {
  try {
    const cliente = await getAuthenticatedCliente(req)
    if (!cliente) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    // Gather all user data
    const [pedidos, resenas, direcciones, favoritos] = await Promise.all([
      db.pedido.findMany({
        where: { clienteId: cliente.id },
        include: { items: true },
        orderBy: { fecha: "desc" },
      }),
      db.resena.findMany({
        where: { clienteId: cliente.id },
        orderBy: { fecha: "desc" },
      }),
      db.direccion.findMany({
        where: { clienteId: cliente.id },
      }),
      db.favorito.findMany({
        where: { clienteId: cliente.id },
        include: { negocio: { select: { nombre: true, slug: true } } },
      }),
    ])

    const exportData = {
      usuario: {
        nombre: cliente.nombre,
        email: cliente.email,
        telefono: cliente.telefono,
        fechaRegistro: cliente.fechaRegistro,
      },
      direcciones,
      favoritos: favoritos.map((f) => f.negocio),
      pedidos: pedidos.map((p) => ({
        id: p.id,
        negocio: p.negocioNombre,
        total: p.total,
        estado: p.estado,
        metodoEntrega: p.metodoEntrega,
        metodoPago: p.metodoPago,
        fecha: p.fecha,
        items: p.items,
      })),
      resenas,
      exportDate: new Date().toISOString(),
    }

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="deligo-datos-${cliente.nombre.replace(/\s+/g, "-").toLowerCase()}.json"`,
      },
    })
  } catch (error) {
    console.error("Export GET error:", error)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
