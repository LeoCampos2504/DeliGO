import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { auditLog } from "@/lib/audit"
import { validateImageUrlArray, validateOptionalImageUrl } from "@/lib/resource-url"
import { safeErrorForLog } from "@/lib/log-safe-error"
import {
  readSharedOptionConfigList,
  readStringIdList,
  validateNegocioResourceOwnership,
} from "@/lib/access-control"
import { validateProductSectionsForSave } from "@/lib/product-own-sections"
import { Prisma } from "@prisma/client"

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
    console.error("Error listing productos:", safeErrorForLog(error))
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

    // Validate discount limits
    if (descuentoActivo && valorDescuento > 0) {
      if (tipoDescuento === "porcentaje") {
        if (valorDescuento < 1 || valorDescuento > 100) {
          return NextResponse.json(
            { error: "El descuento por porcentaje debe estar entre 1% y 100%" },
            { status: 400 }
          )
        }
      } else {
        if (valorDescuento >= precio) {
          return NextResponse.json(
            { error: "El descuento en monto no puede ser igual o superior al precio del producto" },
            { status: 400 }
          )
        }
      }
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

    const validImagenUrl = validateOptionalImageUrl(imagenUrl)
    if (!validImagenUrl.ok) {
      return NextResponse.json({ error: validImagenUrl.error }, { status: 400 })
    }

    const validImagenesExtra = validateImageUrlArray(imagenesExtra)
    if (!validImagenesExtra.ok) {
      return NextResponse.json({ error: validImagenesExtra.error }, { status: 400 })
    }

    const validAgregadoIds = readStringIdList(agregadoIds, "agregadoIds")
    if (!validAgregadoIds.ok) {
      return NextResponse.json({ error: validAgregadoIds.error }, { status: 400 })
    }

    const validIngredienteIds = readStringIdList(ingredienteIds, "ingredienteIds")
    if (!validIngredienteIds.ok) {
      return NextResponse.json({ error: validIngredienteIds.error }, { status: 400 })
    }

    const validOpcionesCompartidasIds = readSharedOptionConfigList(
      opcionesCompartidasIds,
      "opcionesCompartidasIds"
    )
    if (!validOpcionesCompartidasIds.ok) {
      return NextResponse.json({ error: validOpcionesCompartidasIds.error }, { status: 400 })
    }

    // OWN-PRODUCT-OPTION-PRICES-R1 §50: reject a malformed/negative option
    // price outright rather than silently coercing it.
    const validSecciones = validateProductSectionsForSave(secciones)
    if (!validSecciones.ok) {
      return NextResponse.json({ error: validSecciones.error }, { status: 400 })
    }

    const ownsCatalogRefs = await validateNegocioResourceOwnership(negocioId, {
      agregados: validAgregadoIds.ids,
      ingredientes: validIngredienteIds.ids,
      opcionesCompartidas: validOpcionesCompartidasIds.ids,
    })
    if (!ownsCatalogRefs) {
      return NextResponse.json({ error: "Sin acceso a este recurso" }, { status: 403 })
    }

    // Product.orden is server-owned. New products append after every active
    // product in the business; the max read and all related writes share one
    // serializable transaction so concurrent creates cannot choose position 0.
    const producto = await db.$transaction(async (tx) => {
      const maxOrder = await tx.producto.aggregate({
        where: { negocioId, eliminado: false },
        _max: { orden: true },
      })
      const created = await tx.producto.create({
        data: {
          nombre: nombre.trim(),
          precio,
          categoria: categoria || "Sin Categoria",
          imagenUrl: validImagenUrl.value,
          stock: stock !== undefined ? stock : true,
          descuentoActivo: descuentoActivo || false,
          tipoDescuento: tipoDescuento || "porcentaje",
          valorDescuento: valorDescuento || 0,
          descripcion: descripcion || null,
          talles: JSON.stringify(talles || []),
          colores: JSON.stringify(colores || []),
          material: material || "",
          genero: genero || "",
          secciones: JSON.stringify(validSecciones.value),
          recomendados: JSON.stringify([]),
          imagenesExtra: JSON.stringify(validImagenesExtra.value),
          opcionesCompartidasIds: opcionesCompartidasIds !== undefined
            ? JSON.stringify(validOpcionesCompartidasIds.configs)
            : "[]",
          orden: (maxOrder._max.orden ?? -1) + 1,
          negocioId,
        },
      })

      if (validAgregadoIds.ids.length > 0) {
        await tx.productoAgregado.createMany({
          data: validAgregadoIds.ids.map((agregadoId) => ({ productoId: created.id, agregadoId })),
        })
      }
      if (validIngredienteIds.ids.length > 0) {
        await tx.productoIngrediente.createMany({
          data: validIngredienteIds.ids.map((ingredienteId) => ({ productoId: created.id, ingredienteId })),
        })
      }
      if (descuentoActivo && precioPromo !== null) {
        const negocio = await tx.negocio.findUnique({
          where: { id: negocioId },
          select: { slug: true, nombre: true },
        })
        await tx.promocion.create({
          data: {
            productoId: created.id,
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
      return created
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

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
    const isSerializationConflict =
      (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") ||
      (error instanceof Prisma.PrismaClientUnknownRequestError && String(error).includes("40P01"))
    if (isSerializationConflict) {
      return NextResponse.json(
        { error: "El catálogo cambió mientras se creaba el producto. Intentá de nuevo." },
        { status: 409 }
      )
    }
    console.error("Error creating producto:", safeErrorForLog(error))
    return NextResponse.json(
      { error: "Error al crear producto" },
      { status: 500 }
    )
  }
}
