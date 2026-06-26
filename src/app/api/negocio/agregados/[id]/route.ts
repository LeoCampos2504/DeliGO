import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { validateOptionalImageUrl } from "@/lib/resource-url"

// PUT - Update agregado
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
    const existing = await db.agregado.findUnique({ where: { id } })
    if (!existing || existing.negocioId !== negocioId) {
      return NextResponse.json(
        { error: "Agregado no encontrado" },
        { status: 404 }
      )
    }

    const body = await req.json()
    const { nombre, precio, categoria, imagenUrl } = body

    if (nombre !== undefined && !nombre?.trim()) {
      return NextResponse.json(
        { error: "El nombre es obligatorio" },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = {}
    if (nombre !== undefined) updateData.nombre = nombre.trim()
    if (precio !== undefined) updateData.precio = precio
    if (categoria !== undefined) updateData.categoria = categoria
    if (imagenUrl !== undefined) {
      const validImagenUrl = validateOptionalImageUrl(imagenUrl)
      if (!validImagenUrl.ok) return NextResponse.json({ error: validImagenUrl.error }, { status: 400 })
      updateData.imagenUrl = validImagenUrl.value
    }

    const updated = await db.agregado.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error updating agregado:", error)
    return NextResponse.json(
      { error: "Error al actualizar agregado" },
      { status: 500 }
    )
  }
}

// DELETE - Delete agregado
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
    const existing = await db.agregado.findUnique({ where: { id } })
    if (!existing || existing.negocioId !== negocioId) {
      return NextResponse.json(
        { error: "Agregado no encontrado" },
        { status: 404 }
      )
    }

    // Delete related junction records first
    await db.productoAgregado.deleteMany({ where: { agregadoId: id } })

    // Delete the agregado
    await db.agregado.delete({ where: { id } })

    return NextResponse.json({ ok: true, message: "Agregado eliminado" })
  } catch (error) {
    console.error("Error deleting agregado:", error)
    return NextResponse.json(
      { error: "Error al eliminar agregado" },
      { status: 500 }
    )
  }
}
