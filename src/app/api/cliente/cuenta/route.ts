import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getAuthenticatedCliente } from "@/lib/cliente-auth"
import { SESSION_COOKIE_NAME } from "@/lib/auth"
import {
  ClientAccountDeletionConflictError,
  ClientHasActiveOrdersError,
  deleteClientAccount,
} from "@/lib/client-account-deletion"
import { safeErrorForLog } from "@/lib/log-safe-error"

// Seguridad-6B: eliminación y exportación de cuenta manejan datos personales
// completos — nunca cacheables.
const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" } as const

// DELETE /api/cliente/cuenta - Delete account permanently
export async function DELETE(req: NextRequest) {
  try {
    const cliente = await getAuthenticatedCliente(req)
    if (!cliente) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401, headers: NO_STORE_HEADERS })
    }

    const body = await req.json()
    const { confirmacion } = body

    if (confirmacion !== "ELIMINAR") {
      return NextResponse.json(
        { error: "Debés escribir ELIMINAR para confirmar" },
        { status: 400, headers: NO_STORE_HEADERS }
      )
    }

    const clienteId = cliente.id

    await deleteClientAccount(clienteId)

    // Delete the session (outside transaction — it's independent)
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (token) {
      // Delete ALL sessions for this user, not just the current one
      await db.sesion.deleteMany({ where: { userId: clienteId } }).catch(() => {})
    }

    const response = NextResponse.json({
      ok: true,
      message: "Cuenta eliminada permanentemente",
    }, { headers: NO_STORE_HEADERS })
    response.cookies.delete(SESSION_COOKIE_NAME)

    return response
  } catch (error) {
    if (error instanceof ClientHasActiveOrdersError) {
      return NextResponse.json(
        {
          error: "Tenés un pedido en curso. Podrás eliminar tu cuenta cuando finalice.",
          code: "CLIENT_HAS_ACTIVE_ORDERS",
        },
        { status: 409, headers: NO_STORE_HEADERS }
      )
    }
    if (error instanceof ClientAccountDeletionConflictError) {
      return NextResponse.json(
        { error: "La cuenta cambió durante la eliminación. Intentá nuevamente." },
        { status: 409, headers: NO_STORE_HEADERS }
      )
    }
    console.error("Cuenta DELETE error:", safeErrorForLog(error))
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500, headers: NO_STORE_HEADERS })
  }
}

// GET /api/cliente/cuenta/exportar - Export all user data
export async function GET(req: NextRequest) {
  try {
    const cliente = await getAuthenticatedCliente(req)
    if (!cliente) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401, headers: NO_STORE_HEADERS })
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
        ...NO_STORE_HEADERS,
      },
    })
  } catch (error) {
    console.error("Export GET error:", safeErrorForLog(error))
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500, headers: NO_STORE_HEADERS })
  }
}
