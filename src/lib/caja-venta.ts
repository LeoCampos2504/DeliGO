// ============================================
// P2-T56-R1 — pure Caja (POS) cart + sale-total helpers
// ============================================
// No DOM, no Prisma, no React, no fetch. The cart lives client-side as
// plain data; the server independently recomputes totals from its own
// DB-fetched product prices (src/app/api/negocio/caja/ventas/route.ts) and
// never trusts a client-supplied total — same principle as
// src/app/api/pedidos/route.ts for Cliente checkout. This module is shared
// by both sides so the arithmetic itself is defined exactly once and
// tested directly (see src/lib/caja-venta.test.ts).

export const METODOS_PAGO_VENTA = ["EFECTIVO", "TRANSFERENCIA", "OTRO"] as const
export type MetodoPagoVenta = (typeof METODOS_PAGO_VENTA)[number]

export function isValidMetodoPagoVenta(value: unknown): value is MetodoPagoVenta {
  return typeof value === "string" && (METODOS_PAGO_VENTA as readonly string[]).includes(value)
}

export interface CartLine {
  productoId: string
  nombre: string
  precio: number
  cantidad: number
}

export function cartLineSubtotal(line: Pick<CartLine, "precio" | "cantidad">): number {
  return roundMoney(line.precio * line.cantidad)
}

export function cartTotal(lines: ReadonlyArray<Pick<CartLine, "precio" | "cantidad">>): number {
  return roundMoney(lines.reduce((sum, line) => sum + line.precio * line.cantidad, 0))
}

export function cartItemCount(lines: ReadonlyArray<Pick<CartLine, "cantidad">>): number {
  return lines.reduce((sum, line) => sum + line.cantidad, 0)
}

/** Adds a product to the cart, merging into an existing line by productoId. */
export function addCartLine(lines: readonly CartLine[], product: CartLine): CartLine[] {
  const existingIndex = lines.findIndex((l) => l.productoId === product.productoId)
  if (existingIndex === -1) return [...lines, product]
  return lines.map((line, index) =>
    index === existingIndex ? { ...line, cantidad: line.cantidad + product.cantidad } : line
  )
}

/** Sets an exact quantity for a line; a quantity <= 0 removes it. */
export function setCartLineQuantity(lines: readonly CartLine[], productoId: string, cantidad: number): CartLine[] {
  if (cantidad <= 0) return removeCartLine(lines, productoId)
  return lines.map((line) => (line.productoId === productoId ? { ...line, cantidad } : line))
}

export function removeCartLine(lines: readonly CartLine[], productoId: string): CartLine[] {
  return lines.filter((line) => line.productoId !== productoId)
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

export interface ServerSaleLineInput {
  productoId: string
  cantidad: number
}

export interface ResolvedSaleLine {
  productoId: string
  nombre: string
  precio: number
  cantidad: number
  subtotal: number
}

// ============================================
// P2-T56-R2A — sale-summary quantity semantics (section 7)
// ============================================
// A Venta's `cantidadItems` field counts DISTINCT LINES, not units sold — 3
// units of one product is 1 line. The "how many were sold" figure shown to
// the merchant must always be SUM(item.cantidad) over the sale's real
// VentaItem snapshots, never item count and never the persisted
// `cantidadItems` field (kept as-is in the schema; simply not used for this
// display — see the R2A report for why no schema/migration change is
// needed).

export function totalUnidadesVenta(items: ReadonlyArray<Pick<CartLine, "cantidad">>): number {
  return items.reduce((sum, item) => sum + item.cantidad, 0)
}

/** Renders a unit count without truncating a fractional quantity (section 10). */
export function formatUnidadesVenta(totalUnidades: number): string {
  const isWhole = Number.isInteger(totalUnidades)
  const formatted = isWhole
    ? String(totalUnidades)
    : totalUnidades.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 3 })
  const label = totalUnidades === 1 ? "unidad" : "unidades"
  return `${formatted} ${label}`
}

export type ComputeSaleResult =
  | { ok: true; items: ResolvedSaleLine[]; total: number; cantidadItems: number }
  | { ok: false; error: string }

/**
 * Server-side sale-total authority (section 19): given the requested lines
 * and a map of authoritative product data freshly read from the DB (never
 * client-supplied price/name), rebuilds every line's snapshot and the sale
 * total from scratch. Rejects a request with no lines, a non-positive
 * quantity, or a product missing from the authoritative map (deleted,
 * inactive, or not owned by this tenant — the caller is expected to have
 * already scoped that map to the authenticated negocioId).
 */
export function computeSaleFromAuthoritativeProducts(
  requested: ReadonlyArray<ServerSaleLineInput>,
  productsById: ReadonlyMap<string, { nombre: string; precio: number }>,
): ComputeSaleResult {
  if (requested.length === 0) {
    return { ok: false, error: "La venta no tiene productos" }
  }

  const items: ResolvedSaleLine[] = []
  for (const line of requested) {
    if (!Number.isFinite(line.cantidad) || line.cantidad <= 0) {
      return { ok: false, error: "La cantidad debe ser mayor a 0" }
    }
    const product = productsById.get(line.productoId)
    if (!product) {
      return { ok: false, error: "Uno de los productos ya no está disponible" }
    }
    const subtotal = roundMoney(product.precio * line.cantidad)
    items.push({ productoId: line.productoId, nombre: product.nombre, precio: product.precio, cantidad: line.cantidad, subtotal })
  }

  return {
    ok: true,
    items,
    total: roundMoney(items.reduce((sum, item) => sum + item.subtotal, 0)),
    cantidadItems: items.length,
  }
}
