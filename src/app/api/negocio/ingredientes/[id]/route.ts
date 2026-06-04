import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"

// PUT - Update ingrediente
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user || user.type !== "negocio") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }

    const negocioId = user.id
    const { id } = await params

    // Verify ownership
    const existing = await db.ingrediente.findUnique({ where: { id } })
    if (!existing || existing.negocioId !== negocioId) {
      return NextResponse.json(
        { error: "Ingrediente no encontrado" },
        { status: 404 }
      )
    }

    const body = await req.json()
    const { nombre, categoria, imagenUrl } = body

    if (nombre !== undefined && !nombre?.trim()) {
      return NextResponse.json(
        { error: "El nombre es obligatorio" },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = {}
    if (nombre !== undefined) updateData.nombre = nombre.trim()
    if (categoria !== undefined) updateData.categoria = categoria
    if (imagenUrl !== undefined) updateData.imagenUrl = imagenUrl || null

    const updated = await db.ingrediente.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error updating ingrediente:", error)
    return NextResponse.json(
      { error: "Error al actualizar ingrediente" },
      { status: 500 }
    )
  }
}

// DELETE - Delete ingrediente
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user || user.type !== "negocio") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }

    const negocioId = user.id
    const { id } = await params

    // Verify ownership
    const existing = await db.ingrediente.findUnique({ where: { id } })
    if (!existing || existing.negocioId !== negocioId) {
      return NextResponse.json(
        { error: "Ingrediente no encontrado" },
        { status: 404 }
      )
    }

    // Delete related junction records first
    await db.productoIngrediente.deleteMany({ where: { ingredienteId: id } })

    // Delete the ingrediente
    await db.ingrediente.delete({ where: { id } })

    return NextResponse.json({ ok: true, message: "Ingrediente eliminado" })
  } catch (error) {
    console.error("Error deleting ingrediente:", error)
    return NextResponse.json(
      { error: "Error al eliminar ingrediente" },
      { status: 500 }
    )
  }
}
