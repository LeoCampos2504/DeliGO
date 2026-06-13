import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"

// Helper to parse JSON fields safely
function safeParseJSON(value: unknown, fallback: unknown = []) {
  if (!value) return fallback
  if (typeof value === "string") {
    try {
      return JSON.parse(value)
    } catch {
      return fallback
    }
  }
  return value
}

// Helper to normalize opcionesCompartidasIds (old: string[], new: {id, obligatorio, maximo}[])
function normalizeOpcionesCompartidasIds(raw: unknown): Array<{ id: string; obligatorio: boolean; maximo: number }> {
  const parsed = safeParseJSON(raw, [])
  if (!Array.isArray(parsed)) return []
  return parsed.map((item: unknown) => {
    if (typeof item === "string") return { id: item, obligatorio: false, maximo: 0 }
    const obj = item as { id?: string; obligatorio?: boolean; maximo?: number }
    return { id: obj.id ?? "", obligatorio: obj.obligatorio ?? false, maximo: obj.maximo ?? 0 }
  }).filter((c) => c.id)
}

// PUT - Update a product
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
    const existing = await db.producto.findUnique({ where: { id } })
    if (!existing || existing.negocioId !== negocioId) {
      return NextResponse.json(
        { error: "Producto no encontrado" },
        { status: 404 }
      )
    }

    const body = await req.json()
    const {
      nombre,
      precio,
      categoria,
      imagenUrl,
      imagenesExtra,
      stock,
      descuentoActivo,
      tipoDescuento,
      valorDescuento,
      descripcion,
      talles,
      colores,
      material,
      genero,
      secciones,
      agregadoIds,
      ingredienteIds,
      opcionesCompartidasIds,
      orden,
    } = body

    // Validation
    if (nombre !== undefined && !nombre?.trim()) {
      return NextResponse.json(
        { error: "El nombre es obligatorio" },
        { status: 400 }
      )
    }

    if (precio !== undefined && precio <= 0) {
      return NextResponse.json(
        { error: "El precio debe ser mayor a 0" },
        { status: 400 }
      )
    }

    // Build update data
    const finalPrecio = precio !== undefined ? precio : existing.precio
    const finalDescuentoActivo = descuentoActivo !== undefined ? descuentoActivo : existing.descuentoActivo
    const finalTipoDescuento = tipoDescuento || existing.tipoDescuento
    const finalValorDescuento = valorDescuento !== undefined ? valorDescuento : existing.valorDescuento

    // Validate discount limits
    if (finalDescuentoActivo && finalValorDescuento > 0) {
      if (finalTipoDescuento === "porcentaje") {
        if (finalValorDescuento < 1 || finalValorDescuento > 100) {
          return NextResponse.json(
            { error: "El descuento por porcentaje debe estar entre 1% y 100%" },
            { status: 400 }
          )
        }
      } else {
        if (finalValorDescuento >= finalPrecio) {
          return NextResponse.json(
            { error: "El descuento en monto no puede ser igual o superior al precio del producto" },
            { status: 400 }
          )
        }
      }
    }

    // Calculate precioPromo if descuentoActivo
    let precioPromo: number | null = null
    if (finalDescuentoActivo && finalValorDescuento > 0) {
      if (finalTipoDescuento === "porcentaje") {
        precioPromo = finalPrecio * (1 - finalValorDescuento / 100)
      } else {
        precioPromo = finalPrecio - finalValorDescuento
      }
      if (precioPromo < 0) precioPromo = 0
    }

    const updateData: Record<string, unknown> = {}

    if (nombre !== undefined) updateData.nombre = nombre.trim()
    if (precio !== undefined) updateData.precio = precio
    if (categoria !== undefined) updateData.categoria = categoria
    if (imagenUrl !== undefined) updateData.imagenUrl = imagenUrl || null
    if (imagenesExtra !== undefined) updateData.imagenesExtra = JSON.stringify(imagenesExtra || [])
    if (stock !== undefined) updateData.stock = stock
    if (descuentoActivo !== undefined) updateData.descuentoActivo = descuentoActivo
    if (tipoDescuento !== undefined) updateData.tipoDescuento = tipoDescuento
    if (valorDescuento !== undefined) updateData.valorDescuento = valorDescuento
    if (descripcion !== undefined) updateData.descripcion = descripcion || null
    if (talles !== undefined) updateData.talles = JSON.stringify(talles)
    if (colores !== undefined) updateData.colores = JSON.stringify(colores)
    if (material !== undefined) updateData.material = material
    if (genero !== undefined) updateData.genero = genero
    if (secciones !== undefined) updateData.secciones = JSON.stringify(secciones)
    if (opcionesCompartidasIds !== undefined) updateData.opcionesCompartidasIds = JSON.stringify(opcionesCompartidasIds)
    if (orden !== undefined) updateData.orden = orden

    // Update product
    const producto = await db.producto.update({
      where: { id },
      data: updateData,
    })

    // Sync agregadoIds (delete old, create new)
    if (agregadoIds !== undefined) {
      await db.productoAgregado.deleteMany({
        where: { productoId: id },
      })
      if (Array.isArray(agregadoIds) && agregadoIds.length > 0) {
        await db.productoAgregado.createMany({
          data: agregadoIds.map((agregadoId: string) => ({
            productoId: id,
            agregadoId,
          })),
        })
      }
    }

    // Sync ingredienteIds (delete old, create new)
    if (ingredienteIds !== undefined) {
      await db.productoIngrediente.deleteMany({
        where: { productoId: id },
      })
      if (Array.isArray(ingredienteIds) && ingredienteIds.length > 0) {
        await db.productoIngrediente.createMany({
          data: ingredienteIds.map((ingredienteId: string) => ({
            productoId: id,
            ingredienteId,
          })),
        })
      }
    }

    // Update Promocion
    if (finalDescuentoActivo && precioPromo !== null) {
      const negocio = await db.negocio.findUnique({
        where: { id: negocioId },
        select: { slug: true, nombre: true },
      })

      await db.promocion.upsert({
        where: { productoId: id },
        update: {
          negocioId,
          negocioSlug: negocio?.slug || "",
          negocioNombre: negocio?.nombre || "",
          precioOriginal: finalPrecio,
          precioPromo,
          descuento: finalTipoDescuento === "porcentaje" ? `${finalValorDescuento}%` : `$${finalValorDescuento}`,
          activa: true,
        },
        create: {
          productoId: id,
          negocioId,
          negocioSlug: negocio?.slug || "",
          negocioNombre: negocio?.nombre || "",
          precioOriginal: finalPrecio,
          precioPromo,
          descuento: finalTipoDescuento === "porcentaje" ? `${finalValorDescuento}%` : `$${finalValorDescuento}`,
          activa: true,
        },
      })
    } else {
      // Deactivate promotion if discount is no longer active
      await db.promocion.updateMany({
        where: { productoId: id },
        data: { activa: false },
      })
    }

    // Fetch updated product with relations
    const updated = await db.producto.findUnique({
      where: { id },
      include: {
        agregados: { include: { agregado: true } },
        ingredientes: { include: { ingrediente: true } },
      },
    })

    return NextResponse.json({
      ...updated,
      talles: safeParseJSON(updated?.talles, []),
      colores: safeParseJSON(updated?.colores, []),
      secciones: safeParseJSON(updated?.secciones, []),
      recomendados: safeParseJSON(updated?.recomendados, []),
      imagenesExtra: safeParseJSON(updated?.imagenesExtra, []),
      opcionesCompartidasIds: normalizeOpcionesCompartidasIds(updated?.opcionesCompartidasIds),
      precioPromo,
    })
  } catch (error) {
    console.error("Error updating producto:", error)
    return NextResponse.json(
      { error: "Error al actualizar producto" },
      { status: 500 }
    )
  }
}

// DELETE - Delete a product
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
    const existing = await db.producto.findUnique({ where: { id } })
    if (!existing || existing.negocioId !== negocioId) {
      return NextResponse.json(
        { error: "Producto no encontrado" },
        { status: 404 }
      )
    }

    // Delete related junction records first (cascade should handle this but be explicit)
    await db.productoAgregado.deleteMany({ where: { productoId: id } })
    await db.productoIngrediente.deleteMany({ where: { productoId: id } })
    await db.seccionProducto.deleteMany({ where: { productoId: id } })

    // Deactivate any promotions
    await db.promocion.updateMany({
      where: { productoId: id },
      data: { activa: false },
    })

    // Delete the product
    await db.producto.delete({ where: { id } })

    return NextResponse.json({ ok: true, message: "Producto eliminado" })
  } catch (error) {
    console.error("Error deleting producto:", error)
    return NextResponse.json(
      { error: "Error al eliminar producto" },
      { status: 500 }
    )
  }
}
