import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { auditLog } from "@/lib/audit"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { computeSaleFromAuthoritativeProducts, isValidMetodoPagoVenta, type ServerSaleLineInput } from "@/lib/caja-venta"

// GET - Today's sales list + payment-method summary (section 21 "Caja —
// resumen simple"). Scoped strictly to the authenticated negocio's own day
// in its own timezone-agnostic sense (UTC calendar day is acceptable for an
// MVP summary — no negocio-level timezone dependency exists for this yet).
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    const user = await getUserFromToken(token)
    if (!user || user.type !== "negocio") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }
    const negocioId = user.id

    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    const ventasHoy = await db.venta.findMany({
      where: { negocioId, createdAt: { gte: startOfDay } },
      include: { items: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    })

    const resumenHoy = {
      cantidadVentas: ventasHoy.length,
      totalVendido: round(ventasHoy.reduce((sum, v) => sum + v.total, 0)),
      totalEfectivo: round(ventasHoy.filter((v) => v.metodoPago === "EFECTIVO").reduce((sum, v) => sum + v.total, 0)),
      totalTransferencia: round(ventasHoy.filter((v) => v.metodoPago === "TRANSFERENCIA").reduce((sum, v) => sum + v.total, 0)),
      totalOtro: round(ventasHoy.filter((v) => v.metodoPago === "OTRO").reduce((sum, v) => sum + v.total, 0)),
    }

    return NextResponse.json({ ventasHoy, resumenHoy })
  } catch (error) {
    console.error("Error listing ventas de caja:", safeErrorForLog(error))
    return NextResponse.json({ error: "Error al obtener las ventas" }, { status: 500 })
  }
}

function round(value: number) {
  return Math.round(value * 100) / 100
}

interface VentaRequestBody {
  metodoPago?: unknown
  items?: unknown
}

// POST - Finalize a Caja sale (section 19): atomically creates the Venta +
// VentaItem snapshot rows, decrements stock for every controlStock=true
// product, and records one MovimientoInventario per affected product — all
// inside a single Serializable transaction so two concurrent sales can
// never oversell the same controlled product (section 25). Total/prices are
// always recomputed server-side from the DB; the client only supplies
// productoId + cantidad per line, never a price or total (section 19).
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    const user = await getUserFromToken(token)
    if (!user || user.type !== "negocio") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }
    const negocioId = user.id

    const body = (await req.json()) as VentaRequestBody
    const { metodoPago, items } = body

    if (!isValidMetodoPagoVenta(metodoPago)) {
      return NextResponse.json({ error: "Método de pago inválido" }, { status: 400 })
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "La venta no tiene productos" }, { status: 400 })
    }

    const requestedLines: ServerSaleLineInput[] = []
    for (const raw of items as unknown[]) {
      // P2-T56-R2C: varianteId is optional and, like price/name, NEVER
      // trusted beyond "which variant was picked" — its precio always comes
      // from the DB row fetched below (section 22).
      const line = raw as { productoId?: unknown; varianteId?: unknown; cantidad?: unknown }
      if (typeof line.productoId !== "string" || !line.productoId || typeof line.cantidad !== "number") {
        return NextResponse.json({ error: "Cada línea requiere productoId y cantidad" }, { status: 400 })
      }
      if (line.varianteId !== undefined && line.varianteId !== null && typeof line.varianteId !== "string") {
        return NextResponse.json({ error: "varianteId inválido" }, { status: 400 })
      }
      requestedLines.push({
        productoId: line.productoId,
        varianteId: (line.varianteId as string | null | undefined) ?? undefined,
        cantidad: line.cantidad,
      })
    }

    const result = await db.$transaction(async (tx) => {
      // Tenant-scoped, authoritative product+variant read — a productoId
      // that doesn't belong to this negocio (or is inactive) simply won't
      // be in this map, and computeSaleFromAuthoritativeProducts rejects
      // any requested line that isn't in it. Every active AND inactive
      // variant is fetched (never trust "activo" from the client either) so
      // an inactive variant is resolvable-but-rejectable below, not just
      // silently missing.
      const productos = await tx.producto.findMany({
        where: { id: { in: requestedLines.map((l) => l.productoId) }, negocioId, eliminado: false },
        include: { variantes: true },
      })
      const productsById = new Map(
        productos.map((p) => [
          p.id,
          {
            nombre: p.nombre,
            precio: p.precio,
            variantes: new Map(
              p.variantes.filter((v) => v.activo).map((v) => [v.id, { nombre: v.nombre, precio: v.precio }])
            ),
          },
        ])
      )

      const computed = computeSaleFromAuthoritativeProducts(requestedLines, productsById)
      if (!computed.ok) {
        return { ok: false as const, status: 400, error: computed.error }
      }

      // Sellability + stock gate (sections 25/26): reject the whole sale if
      // any controlled line doesn't have enough stock, rather than
      // partially selling and leaving an inconsistent cart. Variant lines
      // check the VARIANT's own stock, never the parent Producto's
      // (section 8/9 — dormant once a product has variants).
      const productsByIdFull = new Map(productos.map((p) => [p.id, p]))
      const variantesById = new Map(productos.flatMap((p) => p.variantes.map((v) => [v.id, v] as const)))
      for (const line of computed.items) {
        const producto = productsByIdFull.get(line.productoId)!
        if (line.varianteId) {
          const variante = variantesById.get(line.varianteId)!
          if (variante.controlStock && variante.stockCantidad < line.cantidad) {
            return { ok: false as const, status: 409, error: `"${producto.nombre} — ${variante.nombre}" no tiene stock suficiente` }
          }
        } else if (producto.controlStock && producto.stockCantidad < line.cantidad) {
          return { ok: false as const, status: 409, error: `"${producto.nombre}" no tiene stock suficiente` }
        }
      }

      const venta = await tx.venta.create({
        data: {
          negocioId,
          total: computed.total,
          metodoPago,
          cantidadItems: computed.cantidadItems,
          items: {
            create: computed.items.map((item) => ({
              productoId: item.productoId,
              productoVarianteId: item.varianteId ?? null,
              nombre: item.nombre,
              varianteNombre: item.varianteNombre ?? null,
              precio: item.precio,
              cantidad: item.cantidad,
              subtotal: item.subtotal,
            })),
          },
        },
        include: { items: true },
      })

      // Stock decrement + traceable movement, only for controlStock=true
      // products/variants — never a double-discount when nothing is
      // controlled. A variant line decrements ONLY that variant's own
      // stock, never the parent Producto's (section 24).
      for (const line of computed.items) {
        if (line.varianteId) {
          const variante = variantesById.get(line.varianteId)!
          if (!variante.controlStock) continue
          const nextStock = variante.stockCantidad - line.cantidad
          await tx.productoVariante.update({ where: { id: variante.id }, data: { stockCantidad: nextStock } })
          await tx.movimientoInventario.create({
            data: {
              negocioId,
              productoId: line.productoId,
              productoVarianteId: variante.id,
              tipo: "VENTA",
              cantidad: line.cantidad,
              stockAntes: variante.stockCantidad,
              stockDespues: nextStock,
              ventaId: venta.id,
            },
          })
          continue
        }
        const producto = productsByIdFull.get(line.productoId)!
        if (!producto.controlStock) continue
        const nextStock = producto.stockCantidad - line.cantidad
        await tx.producto.update({ where: { id: producto.id }, data: { stockCantidad: nextStock } })
        await tx.movimientoInventario.create({
          data: {
            negocioId,
            productoId: producto.id,
            tipo: "VENTA",
            cantidad: line.cantidad,
            stockAntes: producto.stockCantidad,
            stockDespues: nextStock,
            ventaId: venta.id,
          },
        })
      }

      return { ok: true as const, venta }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    await auditLog({
      userId: negocioId,
      userType: "negocio",
      accion: "venta.creada",
      recurso: "venta",
      recursoId: result.venta.id,
      detalle: { total: result.venta.total, metodoPago: result.venta.metodoPago, cantidadItems: result.venta.cantidadItems },
    })

    return NextResponse.json(result.venta, { status: 201 })
  } catch (error) {
    const isSerializationConflict =
      (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") ||
      (error instanceof Prisma.PrismaClientUnknownRequestError && String(error).includes("40P01"))
    if (isSerializationConflict) {
      return NextResponse.json(
        { error: "El stock cambió mientras se procesaba la venta. Volvé a intentar." },
        { status: 409 }
      )
    }
    console.error("Error creating venta:", safeErrorForLog(error))
    return NextResponse.json({ error: "Error al registrar la venta" }, { status: 500 })
  }
}
