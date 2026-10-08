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
import { isValidUnidadMedida, validateVarianteMinimo } from "@/lib/inventario"
import { normalizeBarcodeForStorage } from "@/lib/barcode"
import { isGenericBusinessStockScope, leerReservasActivasPorClave, resolvePublicProductAvailability } from "@/lib/stock-lifecycle"
import { mapBarcodeWriteError, runBarcodeGuardedWrite, type BarcodeClaim } from "@/lib/barcode-uniqueness"
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
        // P2-T56-R2C: every variant (active AND inactive) — Inventario needs
        // both to manage them; Caja/Inventario's own client-side derivations
        // filter to activo (and sellable) as needed. Empty array for every
        // product that has none (the overwhelming majority) — no behavior
        // change for any consumer that doesn't read this field.
        variantes: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { orden: "asc" },
    })

    // F9 (D5): read-only R3A context so Caja can warn against the real
    // available stock (físico − reservas ACTIVA) instead of the physical one.
    // One groupBy for the whole business (no N+1), only for a generic business
    // that actually controls stock; Restaurante/Ropa responses are unchanged.
    // The checkout stays the authority — this is only a preview input.
    const controlsStock = productos.some((p) => p.controlStock || p.variantes.some((v) => v.controlStock))
    const negocioScope = controlsStock
      ? await db.negocio.findUnique({ where: { id: negocioId }, select: { rubro: true } })
      : null
    const reservedByKey = negocioScope && isGenericBusinessStockScope(negocioScope.rubro)
      ? await leerReservasActivasPorClave(db, [negocioId])
      : null
    // Same R3A authority as the public catalog (resolvePublicProductAvailability),
    // evaluated with the manual `stock` toggle forced on: Caja only needs the
    // number, never the public visibility decision. stockDisponible is added
    // only to controlled rows; an active controlled variant missing from
    // variantesVisibles has 0 available.
    const withDisponible = (p: (typeof productos)[number]) => {
      if (!reservedByKey) return p
      const availability = resolvePublicProductAvailability({ ...p, stock: true }, reservedByKey)
      const variantDisponible = new Map(availability.variantesVisibles.map((v) => [v.id, v.stockDisponible]))
      return {
        ...p,
        ...(p.controlStock && p.variantes.length === 0 ? { stockDisponible: availability.stockDisponible } : {}),
        variantes: p.variantes.map((v) =>
          v.controlStock && v.activo ? { ...v, stockDisponible: variantDisponible.get(v.id) ?? 0 } : v
        ),
      }
    }

    // Parse JSON fields for each product
    const productosParsed = productos.map((p) => ({
      ...withDisponible(p),
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
      sku,
      codigoBarras,
      costo,
      marca,
      unidadMedida,
      controlStock,
      stockCantidad,
      stockMinimo,
      variantes,
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

    // P2-T56-R1 Inventario fields: all optional and additive. Restaurante/
    // Ropa never send these; controlStock defaults to false (identical to
    // today's behavior) unless explicitly opted into.
    if (unidadMedida !== undefined && !isValidUnidadMedida(unidadMedida)) {
      return NextResponse.json({ error: "Unidad de medida inválida" }, { status: 400 })
    }
    if (costo !== undefined && costo !== null && (typeof costo !== "number" || !Number.isFinite(costo) || costo < 0)) {
      return NextResponse.json({ error: "El costo no puede ser negativo" }, { status: 400 })
    }
    if (stockCantidad !== undefined && (typeof stockCantidad !== "number" || !Number.isFinite(stockCantidad) || stockCantidad < 0)) {
      return NextResponse.json({ error: "El stock inicial no puede ser negativo" }, { status: 400 })
    }
    if (stockMinimo !== undefined && (typeof stockMinimo !== "number" || !Number.isFinite(stockMinimo) || stockMinimo < 0)) {
      return NextResponse.json({ error: "El stock mínimo no puede ser negativo" }, { status: 400 })
    }
    // F9: one storage normalization (trimmed string, never a number).
    const validCodigoBarras = normalizeBarcodeForStorage(codigoBarras)
    if (!validCodigoBarras.ok) {
      return NextResponse.json({ error: validCodigoBarras.error }, { status: 400 })
    }

    // P2-T56-R2C §11/12: optional inline variant creation. Every entry gets
    // the same minimum-required validation as a standalone variant
    // (nombre + precio); everything else defaults exactly like a bare
    // Producto would (costo null, controlStock false, stock/stockMinimo 0).
    const validVariantes: Array<{
      nombre: string; precio: number; costo: number | null; sku: string | null
      codigoBarras: string | null; controlStock: boolean; stockCantidad: number; stockMinimo: number
    }> = []
    if (variantes !== undefined) {
      if (!Array.isArray(variantes)) {
        return NextResponse.json({ error: "variantes debe ser un array" }, { status: 400 })
      }
      for (const raw of variantes as unknown[]) {
        const v = raw as Record<string, unknown>
        const validation = validateVarianteMinimo({ nombre: v.nombre, precio: v.precio })
        if (!validation.ok) {
          return NextResponse.json({ error: validation.error }, { status: 400 })
        }
        if (v.costo !== undefined && v.costo !== null && (typeof v.costo !== "number" || !Number.isFinite(v.costo) || v.costo < 0)) {
          return NextResponse.json({ error: "El costo de la variante no puede ser negativo" }, { status: 400 })
        }
        if (v.stockCantidad !== undefined && (typeof v.stockCantidad !== "number" || !Number.isFinite(v.stockCantidad) || v.stockCantidad < 0)) {
          return NextResponse.json({ error: "El stock de la variante no puede ser negativo" }, { status: 400 })
        }
        if (v.stockMinimo !== undefined && (typeof v.stockMinimo !== "number" || !Number.isFinite(v.stockMinimo) || v.stockMinimo < 0)) {
          return NextResponse.json({ error: "El stock mínimo de la variante no puede ser negativo" }, { status: 400 })
        }
        const varianteCodigo = normalizeBarcodeForStorage(v.codigoBarras)
        if (!varianteCodigo.ok) {
          return NextResponse.json({ error: varianteCodigo.error }, { status: 400 })
        }
        validVariantes.push({
          nombre: (v.nombre as string).trim(),
          precio: v.precio as number,
          costo: v.costo === undefined || v.costo === null ? null : (v.costo as number),
          sku: typeof v.sku === "string" && v.sku.trim() ? v.sku.trim() : null,
          codigoBarras: varianteCodigo.value,
          controlStock: v.controlStock === true,
          stockCantidad: typeof v.stockCantidad === "number" ? v.stockCantidad : 0,
          stockMinimo: typeof v.stockMinimo === "number" ? v.stockMinimo : 0,
        })
      }
    }

    const ownsCatalogRefs = await validateNegocioResourceOwnership(negocioId, {
      agregados: validAgregadoIds.ids,
      ingredientes: validIngredienteIds.ids,
      opcionesCompartidas: validOpcionesCompartidasIds.ids,
    })
    if (!ownsCatalogRefs) {
      return NextResponse.json({ error: "Sin acceso a este recurso" }, { status: 403 })
    }

    // F9 (D3): the base code and every inline variant code are claimed
    // atomically with the insert — see src/lib/barcode-uniqueness.ts.
    const barcodeClaims: BarcodeClaim[] = [
      ...(validCodigoBarras.value ? [{ code: validCodigoBarras.value }] : []),
      ...validVariantes.flatMap((v) => (v.codigoBarras ? [{ code: v.codigoBarras }] : [])),
    ]

    // Product.orden is server-owned. New products append after every active
    // product in the business; the max read and all related writes share one
    // serializable transaction so concurrent creates cannot choose position 0.
    // F9: that transaction is now runBarcodeGuardedWrite's (still Serializable,
    // plus the shared bounded P2034 retry).
    const producto = await runBarcodeGuardedWrite(db, { negocioId, claims: barcodeClaims }, async (tx) => {
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
          sku: sku || null,
          codigoBarras: validCodigoBarras.value,
          costo: costo === undefined || costo === null ? null : costo,
          marca: marca || null,
          unidadMedida: unidadMedida || "unidad",
          controlStock: controlStock === true,
          stockCantidad: stockCantidad !== undefined ? stockCantidad : 0,
          stockMinimo: stockMinimo !== undefined ? stockMinimo : 0,
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
      if (validVariantes.length > 0) {
        await tx.productoVariante.createMany({
          data: validVariantes.map((v) => ({ ...v, productoId: created.id })),
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
    })

    // Audit log
    await auditLog({ userId: negocioId, userType: "negocio", accion: "producto.creado", recurso: "producto", recursoId: producto.id, detalle: { nombre: producto.nombre, precio: producto.precio } })

    // Fetch the created product with relations
    const created = await db.producto.findUnique({
      where: { id: producto.id },
      include: {
        agregados: { include: { agregado: true } },
        ingredientes: { include: { ingrediente: true } },
        variantes: { orderBy: { createdAt: "asc" } },
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
    const barcodeError = mapBarcodeWriteError(error)
    if (barcodeError && barcodeError.body.code !== "CONFLICTO_CONCURRENTE") {
      return NextResponse.json(barcodeError.body, { status: barcodeError.status })
    }
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
