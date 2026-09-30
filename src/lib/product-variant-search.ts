// ============================================
// P2-T56-R3B — pure Inventario/Caja search authority (variant-aware)
// ============================================
// No DOM, no Prisma, no React — same separation convention already used by
// src/lib/inventario.ts and src/lib/category-normalization.ts. A single
// shared authority for "does this search term match this product,
// considering its variants" — Inventario and Caja each call one exported
// function here rather than each rolling their own `.includes()` chain.
//
// Normalization matches the existing convention (category-normalization.ts:
// trim + toLowerCase) — no accent-folding is introduced here because none
// exists in that shared authority either (never two competing
// normalization systems for the same kind of text).

export interface SearchableVariante {
  nombre: string
  sku: string | null
  codigoBarras: string | null
  activo: boolean
}

export interface SearchableProducto {
  nombre: string
  marca?: string | null
  sku?: string | null
  codigoBarras?: string | null
  variantes: ReadonlyArray<SearchableVariante>
}

function normalizeSearchTerm(value: string): string {
  return value.trim().toLowerCase()
}

function fieldIncludes(value: string | null | undefined, term: string): boolean {
  if (!value) return false
  return value.trim().toLowerCase().includes(term)
}

function matchesBaseFields(producto: SearchableProducto, term: string): boolean {
  return (
    fieldIncludes(producto.nombre, term) ||
    fieldIncludes(producto.marca, term) ||
    fieldIncludes(producto.sku, term) ||
    fieldIncludes(producto.codigoBarras, term)
  )
}

function matchesVariante(variante: SearchableVariante, term: string): boolean {
  return (
    fieldIncludes(variante.nombre, term) ||
    fieldIncludes(variante.sku, term) ||
    fieldIncludes(variante.codigoBarras, term)
  )
}

/**
 * Inventario: an admin managing stock needs to find the parent Producto by
 * ANY variant, active or inactive (section 9) — an inactivated variant
 * still needs to be reachable to review/reactivate it.
 */
export function matchesInventorySearch(producto: SearchableProducto, rawTerm: string): boolean {
  const term = normalizeSearchTerm(rawTerm)
  if (!term) return true
  if (matchesBaseFields(producto, term)) return true
  return producto.variantes.some((v) => matchesVariante(v, term))
}

/**
 * Caja: a variant that is inactive is never sellable, so a search term that
 * only matches an inactive variant must not surface a product with nothing
 * actually purchasable through that match (section 9). Base-product fields
 * always match regardless — this never changes availability/sellability,
 * only whether the product is found (section 10).
 */
export function matchesCajaSearch(producto: SearchableProducto, rawTerm: string): boolean {
  const term = normalizeSearchTerm(rawTerm)
  if (!term) return true
  if (matchesBaseFields(producto, term)) return true
  return producto.variantes.some((v) => v.activo && matchesVariante(v, term))
}

/**
 * Section 4 (Inventario UX): when a search term matched via a variant
 * rather than any base-product field, the caller can show a discrete
 * "Coincide: <nombre>" hint. Returns the first matching variant allowed by
 * `allowInactive` (Inventario passes true, mirroring matchesInventorySearch's
 * own policy), or null when the term matched a base field, matched nothing,
 * or is empty.
 */
export function findMatchingVariante(
  producto: SearchableProducto,
  rawTerm: string,
  options: { allowInactive: boolean } = { allowInactive: true }
): SearchableVariante | null {
  const term = normalizeSearchTerm(rawTerm)
  if (!term) return null
  if (matchesBaseFields(producto, term)) return null
  const candidate = producto.variantes.find(
    (v) => (options.allowInactive || v.activo) && matchesVariante(v, term)
  )
  return candidate ?? null
}
