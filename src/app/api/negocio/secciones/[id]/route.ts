import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { readStringIdList, validateNegocioResourceOwnership } from "@/lib/access-control"
import { safeErrorForLog } from "@/lib/log-safe-error"

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

    // SeccionCatalogo.orden is owned exclusively by the dedicated reorder
    // endpoint (src/app/api/negocio/secciones/orden/route.ts), which
    // validates the full section set inside one atomic transaction. This
    // generic PUT must fail explicitly rather than silently accept a
    // client-supplied position that bypasses that validation.
    if (Object.prototype.hasOwnProperty.call(body, "orden")) {
      return NextResponse.json(
        { error: "El orden se modifica únicamente desde el endpoint dedicado de reordenamiento" },
        { status: 400 }
      )
    }

    const { nombre, orientacion, color, productoIds } = body

    if (nombre !== undefined && !nombre?.trim()) {
      return NextResponse.json(
        { error: "El nombre es obligatorio" },
        { status: 400 }
      )
    }

    const validProductoIds = readStringIdList(productoIds, "productoIds")
    if (!validProductoIds.ok) {
      return NextResponse.json({ error: validProductoIds.error }, { status: 400 })
    }

    const ownsProductos = await validateNegocioResourceOwnership(negocioId, {
      productos: validProductoIds.ids,
    })
    if (!ownsProductos) {
      return NextResponse.json({ error: "Sin acceso a este recurso" }, { status: 403 })
    }

    const updateData: Record<string, unknown> = {}
    if (nombre !== undefined) updateData.nombre = nombre.trim()
    if (orientacion !== undefined) updateData.orientacion = orientacion
    if (color !== undefined) updateData.color = color

    await db.$transaction(async (tx) => {
      await tx.seccionCatalogo.update({
        where: { id },
        data: updateData,
      })

      if (productoIds === undefined) return

      // SeccionProducto.orden is owned by the dedicated reorder endpoint
      // (src/app/api/negocio/secciones/[id]/productos/orden/route.ts). This
      // generic membership update must never treat the submitted array's
      // ORDER as an instruction — only as a SET. Retained products keep
      // their existing relative order (read from the DB, not from the
      // body); genuinely new products append after them. This is the only
      // way a name/color-only save, or an add/remove, can never silently
      // undo an explicit reorder.
      const current = await tx.seccionProducto.findMany({
        where: { seccionId: id },
        select: { productoId: true, orden: true },
      })
      const newSet = new Set(validProductoIds.ids)
      const currentIds = new Set(current.map((sp) => sp.productoId))

      const toRemove = current.filter((sp) => !newSet.has(sp.productoId)).map((sp) => sp.productoId)
      if (toRemove.length > 0) {
        await tx.seccionProducto.deleteMany({ where: { seccionId: id, productoId: { in: toRemove } } })
      }

      const retainedInOrder = current
        .filter((sp) => newSet.has(sp.productoId))
        .sort((a, b) => a.orden - b.orden)
        .map((sp) => sp.productoId)
      const added = validProductoIds.ids.filter((productoId) => !currentIds.has(productoId))
      const finalOrder = [...retainedInOrder, ...added]

      for (const [orden, productoId] of finalOrder.entries()) {
        if (currentIds.has(productoId)) {
          await tx.seccionProducto.update({
            where: { seccionId_productoId: { seccionId: id, productoId } },
            data: { orden },
          })
        } else {
          await tx.seccionProducto.create({ data: { seccionId: id, productoId, orden } })
        }
      }
    })

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
    console.error("Error updating seccion:", safeErrorForLog(error))
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
    console.error("Error deleting seccion:", safeErrorForLog(error))
    return NextResponse.json(
      { error: "Error al eliminar sección" },
      { status: 500 }
    )
  }
}
