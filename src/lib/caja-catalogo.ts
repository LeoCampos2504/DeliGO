// ============================================
// F10-B1 — Caja catalog: ONE availability rule for the owner and the cashier
// ============================================
// Extracted verbatim from GET /api/negocio/productos (F9-D5) so the cashier
// catalog never re-implements availability:
//   stockDisponible = físico − reservas ACTIVA, computed by the R3A authority
//   (leerReservasActivasPorClave: ONE grouped read per business, no N+1 +
//   resolvePublicProductAvailability with the manual `stock` toggle forced on),
//   added only to controlled rows of a GENERIC business. Restaurante/Ropa or a
//   business without controlled rows: no extra reads, rows returned untouched.
// Read-only: never writes stock, prices or reservations. The checkout stays
// the authority.

import type { PrismaClient } from "@prisma/client"
import { isGenericBusinessStockScope, leerReservasActivasPorClave, resolvePublicProductAvailability } from "@/lib/stock-lifecycle"

interface CatalogVariant {
  id: string
  activo: boolean
  controlStock: boolean
  stockCantidad: number
}

interface CatalogProduct<V extends CatalogVariant> {
  id: string
  controlStock: boolean
  stockCantidad: number
  variantes: V[]
}

type CatalogReader = Pick<PrismaClient, "negocio" | "reservaStock">

export async function anotarDisponibilidadCaja<V extends CatalogVariant, P extends CatalogProduct<V>>(
  db: CatalogReader,
  negocioId: string,
  productos: P[],
  options: { rubro?: string | null } = {}
): Promise<Array<P & { stockDisponible?: number | null; variantes: Array<V & { stockDisponible?: number | null }> }>> {
  const controlsStock = productos.some((p) => p.controlStock || p.variantes.some((v) => v.controlStock))
  if (!controlsStock) return productos
  const rubro =
    options.rubro !== undefined
      ? options.rubro
      : (await db.negocio.findUnique({ where: { id: negocioId }, select: { rubro: true } }))?.rubro
  if (!isGenericBusinessStockScope(rubro)) return productos
  const reservedByKey = await leerReservasActivasPorClave(db, [negocioId])
  // Same R3A authority as the public catalog, evaluated with the manual `stock`
  // toggle forced on: Caja only needs the number, never the public visibility
  // decision. An active controlled variant missing from variantesVisibles has 0.
  return productos.map((p) => {
    const availability = resolvePublicProductAvailability({ ...p, stock: true }, reservedByKey)
    const variantDisponible = new Map(availability.variantesVisibles.map((v) => [v.id, v.stockDisponible]))
    return {
      ...p,
      ...(p.controlStock && p.variantes.length === 0 ? { stockDisponible: availability.stockDisponible } : {}),
      variantes: p.variantes.map((v) =>
        v.controlStock && v.activo ? { ...v, stockDisponible: variantDisponible.get(v.id) ?? 0 } : v
      ),
    }
  })
}

/** Fields a cashier needs to SELL — nothing administrative (no cost, discounts, internal config). */
export const CAJERO_PRODUCTO_SELECT = {
  id: true,
  nombre: true,
  precio: true,
  categoria: true,
  imagenUrl: true,
  eliminado: true,
  marca: true,
  sku: true,
  codigoBarras: true,
  controlStock: true,
  stockCantidad: true,
  stockMinimo: true,
  variantes: {
    orderBy: { createdAt: "asc" as const },
    select: {
      id: true,
      nombre: true,
      precio: true,
      activo: true,
      sku: true,
      codigoBarras: true,
      controlStock: true,
      stockCantidad: true,
    },
  },
} as const
