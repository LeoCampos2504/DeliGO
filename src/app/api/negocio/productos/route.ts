import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { auditLog } from "@/lib/audit"

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

// GET - List all products for the negocio
export async function GET(req: NextRequest) {
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

    const productos = await db.producto.findMany({
      where: { negocioId, eliminado: false },
      include: {
        agregados: { include: { agregado: true } },
        ingredientes: { include: { ingrediente: true } },
      },
      orderBy: { orden: "asc" },
    })

    // Parse JSON fields for each product
    const productosParsed = productos.map((p) => ({
      ...p,
      talles: safeParseJSON(p.talles, []),
      colores: safeParseJSON(p.colores, []),
      secciones: safeParseJSON(p.secciones, []),
      recomendados: safeParseJSON(p.recomendados, []),
      imagenesExtra: safeParseJSON(p.imagenesExtra, []),
      opcionesCompartidasIds: normalizeOpcionesCompartidasIds(p.opcionesCompartidasIds),
    }))

    return NextResponse.json(productosParsed)
  } catch (error) {
    console.error("Error listing productos:", error)
    return NextResponse.json(
      { error: "Error al obtener productos" },
      { status: 500 }
    )
  }
}

// POST - Create a new product
export async function POST(req: NextRequest) {
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
    if (!nombre?.trim()) {
      return NextResponse.json(
        { error: "El nombre es obligatorio" },
        { status: 400 }
      )
    }

    if (!precio || precio <= 0) {
      return NextResponse.json(
        { error: "El precio debe ser mayor a 0" },
        { status: 400 }
      )
    }

    // Calculate precioPromo if descuentoActivo
    let precioPromo: number | null = null
    if (descuentoActivo && valorDescuento > 0) {
      if (tipoDescuento === "porcentaje") {
        precioPromo = precio * (1 - valorDescuento / 100)
      } else {
        precioPromo = precio - valorDescuento
      }
      if (precioPromo < 0) precioPromo = 0
    }

    // Create product
    const producto = await db.producto.create({
      data: {
        nombre: nombre.trim(),
        precio,
        categoria: categoria || "Sin Categoria",
        imagenUrl: imagenUrl || null,
        stock: stock !== undefined ? stock : true,
        descuentoActivo: descuentoActivo || false,
        tipoDescuento: tipoDescuento || "porcentaje",
        valorDescuento: valorDescuento || 0,
        descripcion: descripcion || null,
        talles: JSON.stringify(talles || []),
        colores: JSON.stringify(colores || []),
        material: material || "",
        genero: genero || "",
        secciones: JSON.stringify(secciones || []),
        recomendados: JSON.stringify([]),
        imagenesExtra: JSON.stringify(imagenesExtra || []),
        opcionesCompartidasIds: opcionesCompartidasIds ? JSON.stringify(opcionesCompartidasIds) : "[]",
        orden: orden || 0,
        negocioId,
      },
    })

    // Create junction records for agregados
    if (agregadoIds && Array.isArray(agregadoIds) && agregadoIds.length > 0) {
      await db.productoAgregado.createMany({
        data: agregadoIds.map((agregadoId: string) => ({
          productoId: producto.id,
          agregadoId,
        })),
      })
    }

    // Create junction records for ingredientes
    if (ingredienteIds && Array.isArray(ingredienteIds) && ingredienteIds.length > 0) {
      await db.productoIngrediente.createMany({
        data: ingredienteIds.map((ingredienteId: string) => ({
          productoId: producto.id,
          ingredienteId,
        })),
      })
    }

    // Update or create Promocion if discount active
    if (descuentoActivo && precioPromo !== null) {
      const negocio = await db.negocio.findUnique({
        where: { id: negocioId },
        select: { slug: true, nombre: true },
      })

      await db.promocion.upsert({
        where: { productoId: producto.id },
        update: {
          negocioId,
          negocioSlug: negocio?.slug || "",
          negocioNombre: negocio?.nombre || "",
          precioOriginal: precio,
          precioPromo,
          descuento: tipoDescuento === "porcentaje" ? `${valorDescuento}%` : `$${valorDescuento}`,
          activa: true,
        },
        create: {
          productoId: producto.id,
          negocioId,
          negocioSlug: negocio?.slug || "",
          negocioNombre: negocio?.nombre || "",
          precioOriginal: precio,
          precioPromo,
          descuento: tipoDescuento === "porcentaje" ? `${valorDescuento}%` : `$${valorDescuento}`,
          activa: true,
        },
      })
    }

    // Audit log
    await auditLog({ userId: negocioId, userType: "negocio", accion: "producto.creado", recurso: "producto", recursoId: producto.id, detalle: { nombre: producto.nombre, precio: producto.precio } })

    // Fetch the created product with relations
    const created = await db.producto.findUnique({
      where: { id: producto.id },
      include: {
        agregados: { include: { agregado: true } },
        ingredientes: { include: { ingrediente: true } },
      },
    })

    return NextResponse.json({
      ...created,
      talles: safeParseJSON(created?.talles, []),
      colores: safeParseJSON(created?.colores, []),
      secciones: safeParseJSON(created?.secciones, []),
      recomendados: safeParseJSON(created?.recomendados, []),
      imagenesExtra: safeParseJSON(created?.imagenesExtra, []),
      opcionesCompartidasIds: normalizeOpcionesCompartidasIds(created?.opcionesCompartidasIds),
      precioPromo,
    }, { status: 201 })
  } catch (error) {
    console.error("Error creating producto:", error)
    return NextResponse.json(
      { error: "Error al crear producto" },
      { status: 500 }
    )
  }
}
