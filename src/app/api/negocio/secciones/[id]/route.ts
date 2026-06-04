import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"

// PUT - Update seccion (including products assignment)
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
    const existing = await db.seccionCatalogo.findUnique({ where: { id } })
    if (!existing || existing.negocioId !== negocioId) {
      return NextResponse.json(
        { error: "Sección no encontrada" },
        { status: 404 }
      )
    }

    const body = await req.json()
    const { nombre, orientacion, orden, color, productoIds } = body

    if (nombre !== undefined && !nombre?.trim()) {
      return NextResponse.json(
        { error: "El nombre es obligatorio" },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = {}
    if (nombre !== undefined) updateData.nombre = nombre.trim()
    if (orientacion !== undefined) updateData.orientacion = orientacion
    if (orden !== undefined) updateData.orden = orden
    if (color !== undefined) updateData.color = color

    // Update basic fields
    await db.seccionCatalogo.update({
      where: { id },
      data: updateData,
    })

    // If productoIds is provided, update the junction table
    if (productoIds !== undefined) {
      // Delete existing junction records
      await db.seccionProducto.deleteMany({ where: { seccionId: id } })

      // Create new junction records
      if (Array.isArray(productoIds) && productoIds.length > 0) {
        await db.seccionProducto.createMany({
          data: productoIds.map((productoId: string, index: number) => ({
            seccionId: id,
            productoId,
            orden: index,
          })),
        })
      }
    }

    // Return updated seccion with products
    const updated = await db.seccionCatalogo.findUnique({
      where: { id },
      include: {
        productos: {
          include: {
            producto: {
              select: { id: true, nombre: true, imagenUrl: true, precio: true, categoria: true },
            },
          },
          orderBy: { orden: "asc" },
        },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Error updating seccion:", error)
    return NextResponse.json(
      { error: "Error al actualizar sección" },
      { status: 500 }
    )
  }
}

// DELETE - Delete seccion
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
    const existing = await db.seccionCatalogo.findUnique({ where: { id } })
    if (!existing || existing.negocioId !== negocioId) {
      return NextResponse.json(
        { error: "Sección no encontrada" },
        { status: 404 }
      )
    }

    // Delete related junction records first
    await db.seccionProducto.deleteMany({ where: { seccionId: id } })

    // Delete the seccion
    await db.seccionCatalogo.delete({ where: { id } })

    return NextResponse.json({ ok: true, message: "Sección eliminada" })
  } catch (error) {
    console.error("Error deleting seccion:", error)
    return NextResponse.json(
      { error: "Error al eliminar sección" },
      { status: 500 }
    )
  }
}
