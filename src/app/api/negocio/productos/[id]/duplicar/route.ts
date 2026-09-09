import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
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

// PRODUCT-DUPLICATION-SECTION-POSITION-R1: same P2034/40P01 -> 409 mapping
// already certified for productos/orden, secciones/orden and
// secciones/[id]/productos/orden.
function isTransactionConflict(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) return error.code === "P2034"
  return error instanceof Prisma.PrismaClientUnknownRequestError && String(error).includes("40P01")
}

type JsonArrayResult =
  | { ok: true; value: unknown[] }
  | { ok: false; error: string }

function readStoredJsonArray(value: unknown, fieldName: string): JsonArrayResult {
  if (typeof value !== "string") {
    return { ok: false, error: `${fieldName} inválido` }
  }

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed)
      ? { ok: true, value: parsed }
      : { ok: false, error: `${fieldName} inválido` }
  } catch {
    return { ok: false, error: `${fieldName} inválido` }
  }
}

function nextCopyName(originalName: string, existingNames: string[]) {
  const base = `${originalName} (copia)`
  const used = new Set(existingNames)
  if (!used.has(base)) return base

  let suffix = 2
  while (used.has(`${base} ${suffix}`)) suffix += 1
  return `${base} ${suffix}`
}

function calculatePromotionPrice(product: {
  precio: number
  descuentoActivo: boolean
  tipoDescuento: string
  valorDescuento: number
}) {
  if (!product.descuentoActivo || product.valorDescuento <= 0) return null
  if (!Number.isFinite(product.valorDescuento)) return null

  if (product.tipoDescuento === "porcentaje") {
    return Math.max(0, product.precio * (1 - product.valorDescuento / 100))
  }
  return Math.max(0, product.precio - product.valorDescuento)
}

function parsedProduct(product: {
  talles: string
  colores: string
  secciones: string
  recomendados: string
  imagenesExtra: string
  opcionesCompartidasIds: string
}) {
  const arrays = [
    ["talles", product.talles],
    ["colores", product.colores],
    ["secciones", product.secciones],
    ["recomendados", product.recomendados],
    ["imagenesExtra", product.imagenesExtra],
    ["opcionesCompartidasIds", product.opcionesCompartidasIds],
  ] as const

  const parsed = new Map<string, unknown[]>()
  for (const [fieldName, raw] of arrays) {
    const result = readStoredJsonArray(raw, fieldName)
    if (!result.ok) return result
    parsed.set(fieldName, result.value)
  }

  return { ok: true as const, value: parsed }
}

// POST /api/negocio/productos/[id]/duplicar
// The request body is intentionally ignored: the source product and every
// copied field are read from the database inside the authenticated business
// scope. This prevents a client-reconstructed product from becoming the
// duplication source of truth.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = _req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user || user.type !== "negocio") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }

    const negocioId = user.id
    const { id } = await params

    const source = await db.producto.findFirst({
      where: { id, negocioId, eliminado: false },
      include: {
        agregados: { select: { agregadoId: true } },
        ingredientes: { select: { ingredienteId: true } },
        seccionItems: {
          select: { seccionId: true, orden: true, seccion: { select: { negocioId: true } } },
        },
      },
    })

    // The scoped lookup intentionally returns the same fail-closed response
    // for a missing product and a product belonging to another business.
    if (!source) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 })
    }

    if (!Number.isFinite(source.precio) || source.precio <= 0) {
      return NextResponse.json({ error: "Producto fuente inválido" }, { status: 400 })
    }
    if (!Number.isFinite(source.valorDescuento) || source.valorDescuento < 0) {
      return NextResponse.json({ error: "Descuento del producto fuente inválido" }, { status: 400 })
    }
    if (source.descuentoActivo && source.valorDescuento > 0) {
      if (source.tipoDescuento === "porcentaje" && (source.valorDescuento < 1 || source.valorDescuento > 100)) {
        return NextResponse.json({ error: "Descuento del producto fuente inválido" }, { status: 400 })
      }
      if (source.tipoDescuento !== "porcentaje" && source.valorDescuento >= source.precio) {
        return NextResponse.json({ error: "Descuento del producto fuente inválido" }, { status: 400 })
      }
    }

    const raw = parsedProduct(source)
    if (!raw.ok) {
      return NextResponse.json({ error: raw.error }, { status: 400 })
    }

    const validImagenUrl = validateOptionalImageUrl(source.imagenUrl)
    if (!validImagenUrl.ok) {
      return NextResponse.json({ error: validImagenUrl.error }, { status: 400 })
    }

    const validImagenesExtra = validateImageUrlArray(raw.value.get("imagenesExtra"))
    if (!validImagenesExtra.ok) {
      return NextResponse.json({ error: validImagenesExtra.error }, { status: 400 })
    }

    const validTalles = raw.value.get("talles")!
    const validColores = raw.value.get("colores")!
    const validRecomendados = readStringIdList(raw.value.get("recomendados"), "recomendados")
    if (!validRecomendados.ok) {
      return NextResponse.json({ error: validRecomendados.error }, { status: 400 })
    }

    const validSecciones = validateProductSectionsForSave(raw.value.get("secciones"))
    if (!validSecciones.ok) {
      return NextResponse.json({ error: validSecciones.error }, { status: 400 })
    }

    const validSharedOptions = readSharedOptionConfigList(
      raw.value.get("opcionesCompartidasIds"),
      "opcionesCompartidasIds"
    )
    if (!validSharedOptions.ok) {
      return NextResponse.json({ error: validSharedOptions.error }, { status: 400 })
    }

    const agregadoIds = source.agregados.map((item) => item.agregadoId)
    const ingredienteIds = source.ingredientes.map((item) => item.ingredienteId)
    const ownsCatalogRefs = await validateNegocioResourceOwnership(negocioId, {
      productos: validRecomendados.ids,
      agregados: agregadoIds,
      ingredientes: ingredienteIds,
      opcionesCompartidas: validSharedOptions.ids,
    })
    if (!ownsCatalogRefs || source.seccionItems.some((item) => item.seccion.negocioId !== negocioId)) {
      return NextResponse.json({ error: "Sin acceso a este recurso" }, { status: 403 })
    }

    const precioPromo = calculatePromotionPrice(source)
    if (source.descuentoActivo && source.valorDescuento > 0 && precioPromo === null) {
      return NextResponse.json({ error: "Descuento del producto fuente inválido" }, { status: 400 })
    }

    const duplicated = await db.$transaction(async (tx) => {
      const existingNames = await tx.producto.findMany({
        where: { negocioId, nombre: { startsWith: `${source.nombre} (copia)` } },
        select: { nombre: true },
      })
      const maxOrder = await tx.producto.aggregate({
        where: { negocioId, eliminado: false },
        _max: { orden: true },
      })
      const negocio = await tx.negocio.findUnique({
        where: { id: negocioId },
        select: { slug: true, nombre: true },
      })
      if (!negocio) throw new Error("Negocio no encontrado")

      const producto = await tx.producto.create({
        data: {
          nombre: nextCopyName(source.nombre, existingNames.map((item) => item.nombre)),
          precio: source.precio,
          categoria: source.categoria,
          imagenUrl: validImagenUrl.value,
          imagenesExtra: JSON.stringify(validImagenesExtra.value),
          negocioId,
          stock: source.stock,
          eliminado: false,
          descuentoActivo: source.descuentoActivo,
          tipoDescuento: source.tipoDescuento,
          valorDescuento: source.valorDescuento,
          descripcion: source.descripcion,
          talles: JSON.stringify(validTalles),
          colores: JSON.stringify(validColores),
          material: source.material,
          genero: source.genero,
          secciones: JSON.stringify(validSecciones.value),
          recomendados: JSON.stringify(validRecomendados.ids),
          opcionesCompartidasIds: JSON.stringify(validSharedOptions.configs),
          orden: (maxOrder._max.orden ?? -1) + 1,
        },
      })

      if (agregadoIds.length > 0) {
        await tx.productoAgregado.createMany({
          data: agregadoIds.map((agregadoId) => ({ productoId: producto.id, agregadoId })),
        })
      }
      if (ingredienteIds.length > 0) {
        await tx.productoIngrediente.createMany({
          data: ingredienteIds.map((ingredienteId) => ({ productoId: producto.id, ingredienteId })),
        })
      }
      if (source.seccionItems.length > 0) {
        // PRODUCT-DUPLICATION-SECTION-POSITION-R1: never copy the source's
        // own SeccionProducto.orden — that creates a tie with the source
        // itself. Each section has its own order namespace, so the copy's
        // position inside a section is computed independently, from a
        // fresh max read INSIDE this transaction (never the value read
        // before the transaction started, and never Producto.orden or any
        // other section's max). Serializable isolation (see $transaction
        // options below) is what actually prevents two concurrent
        // duplications from both computing the same "next" value.
        const uniqueSeccionIds = [...new Set(source.seccionItems.map((item) => item.seccionId))]
        const maxOrders = await Promise.all(
          uniqueSeccionIds.map((seccionId) =>
            tx.seccionProducto.aggregate({
              where: { seccionId },
              _max: { orden: true },
            })
          )
        )
        const maxOrderBySeccion = new Map(
          uniqueSeccionIds.map((seccionId, index) => [seccionId, maxOrders[index]._max.orden ?? -1])
        )
        await tx.seccionProducto.createMany({
          data: source.seccionItems.map((item) => ({
            productoId: producto.id,
            seccionId: item.seccionId,
            orden: (maxOrderBySeccion.get(item.seccionId) ?? -1) + 1,
          })),
        })
      }
      if (precioPromo !== null) {
        await tx.promocion.create({
          data: {
            productoId: producto.id,
            negocioId,
            negocioSlug: negocio.slug,
            negocioNombre: negocio.nombre,
            precioOriginal: source.precio,
            precioPromo,
            descuento: source.tipoDescuento === "porcentaje"
              ? `${source.valorDescuento}%`
              : `$${source.valorDescuento}`,
            activa: true,
          },
        })
      }

      return tx.producto.findUniqueOrThrow({
        where: { id: producto.id },
        include: {
          agregados: { include: { agregado: true } },
          ingredientes: { include: { ingrediente: true } },
          seccionItems: { select: { seccionId: true, orden: true } },
          promociones: true,
        },
      })
    }, { timeout: 30_000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

    await auditLog({
      userId: negocioId,
      userType: "negocio",
      accion: "producto.creado",
      recurso: "producto",
      recursoId: duplicated.id,
      detalle: { nombre: duplicated.nombre, precio: duplicated.precio, duplicadoDesdeId: source.id },
    })

    return NextResponse.json({
      ...duplicated,
      talles: JSON.parse(duplicated.talles),
      colores: JSON.parse(duplicated.colores),
      secciones: JSON.parse(duplicated.secciones),
      recomendados: JSON.parse(duplicated.recomendados),
      imagenesExtra: JSON.parse(duplicated.imagenesExtra),
      opcionesCompartidasIds: JSON.parse(duplicated.opcionesCompartidasIds),
      precioPromo,
    }, { status: 201 })
  } catch (error) {
    if (isTransactionConflict(error)) {
      return NextResponse.json(
        { error: "El catálogo cambió mientras se duplicaba. Volvé a intentar." },
        { status: 409 }
      )
    }
    console.error("Error duplicating producto:", safeErrorForLog(error))
    return NextResponse.json(
      { error: "Error al duplicar producto" },
      { status: 500 }
    )
  }
}
