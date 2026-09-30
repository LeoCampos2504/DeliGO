// ============================================
// P2-T56-R2C-F2 — pure Cliente-side ProductoVariante helpers
// ============================================
// No DOM, no Prisma, no React — same separation convention already used by
// src/lib/inventario.ts (Inventario/Caja) and src/lib/mesa-cuenta.ts.
// Scoped specifically to what Cliente (normal + Mesa) needs to decide
// whether a product-with-variants is sellable, what to show as its price,
// and whether a single active variant can be auto-selected — never an
// authority for Caja/Inventario, which keep using their own helpers.

export interface ClientProductoVariante {
  id: string
  nombre: string
  precio: number
  controlStock: boolean
  stockCantidad: number
}

/** A variant not controlling stock is always available; a controlled one needs stockCantidad > 0. */
export function isVarianteDisponible(variante: ClientProductoVariante): boolean {
  return !variante.controlStock || variante.stockCantidad > 0
}

/**
 * Section 5: a product with variants is only unavailable when it has zero
 * active variants, or every active variant is out of stock. A single
 * depleted variant among several available ones never marks the whole
 * product as agotado.
 */
export function isProductoConVariantesDisponible(
  variantesActivas: ReadonlyArray<ClientProductoVariante>
): boolean {
  return variantesActivas.length > 0 && variantesActivas.some(isVarianteDisponible)
}

/** Section 4: minimum price across active variants, for the "Desde $X" card label. */
export function precioDesdeVariantes(
  variantesActivas: ReadonlyArray<ClientProductoVariante>
): number | null {
  if (variantesActivas.length === 0) return null
  return Math.min(...variantesActivas.map((v) => v.precio))
}

/**
 * Section 7: when exactly one active variant exists, it can be
 * auto-selected — the caller is still responsible for showing which one was
 * chosen (name/price), this never hides the selection.
 */
export function resolveSingleActiveVariant(
  variantesActivas: ReadonlyArray<ClientProductoVariante>
): ClientProductoVariante | null {
  return variantesActivas.length === 1 ? variantesActivas[0] : null
}
