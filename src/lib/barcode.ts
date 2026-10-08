// ============================================
// F9 — barcode authority (pure: no DOM, no Prisma, no React)
// ============================================
// One shared authority for "what does this barcode mean inside THIS
// business's catalog", used by:
//   - Caja's continuous scanner (exact lookup → cart line),
//   - Inventario's early duplicate warning,
//   - the server-side duplicate guard (src/lib/barcode-uniqueness.ts).
//
// Codes are ALWAYS strings: leading zeros are significant and are never
// lost to a numeric conversion. Storage keeps the trimmed value exactly as
// entered/scanned; comparison uses `barcodeLookupKey`, which only adds two
// deliberate equivalences:
//   1. a valid 12-digit UPC-A equals its 13-digit EAN-13 form with a
//      leading 0 (scanners report the same symbol either way);
//   2. non-numeric codes compare case-insensitively (Code 128 / internal
//      codes typed by hand).
// Short numeric codes, internal codes and anything with an invalid GTIN
// check digit are compared literally — the UPC/EAN equivalence is never
// applied to them.

export const BARCODE_MAX_LENGTH = 64

export type BarcodeStorageResult =
  | { ok: true; value: string | null }
  | { ok: false; error: string }

/**
 * Normalizes a codigoBarras coming from a request body for storage.
 * `undefined` must be handled by the caller (it means "field not sent").
 * null / "" / whitespace → null. Never converts to a number.
 */
export function normalizeBarcodeForStorage(raw: unknown): BarcodeStorageResult {
  if (raw === null || raw === undefined) return { ok: true, value: null }
  if (typeof raw !== "string") return { ok: false, error: "El código de barras es inválido" }
  const value = raw.trim()
  if (!value) return { ok: true, value: null }
  if (value.length > BARCODE_MAX_LENGTH) {
    return { ok: false, error: `El código de barras no puede superar ${BARCODE_MAX_LENGTH} caracteres` }
  }
  if (/[\u0000-\u001f\u007f]/.test(value)) return { ok: false, error: "El código de barras es inválido" }
  return { ok: true, value }
}

const DIGITS = /^\d+$/

/** GS1 mod-10 check digit validation for GTIN-8/12/13/14 (string digits). */
export function isValidGtin(code: string): boolean {
  if (!DIGITS.test(code)) return false
  if (![8, 12, 13, 14].includes(code.length)) return false
  let sum = 0
  // Weights alternate 3,1,3,1… starting from the digit right before the check digit.
  for (let i = code.length - 2, weight = 3; i >= 0; i--, weight = weight === 3 ? 1 : 3) {
    sum += Number(code[i]) * weight
  }
  const check = (10 - (sum % 10)) % 10
  return check === Number(code[code.length - 1])
}

/**
 * Expands an 8-digit UPC-E (number system 0/1 + 6 data digits + check digit)
 * to its 12-digit UPC-A form. Returns null when the input isn't UPC-E shaped.
 */
export function expandUpcE(code: string): string | null {
  if (!/^[01]\d{7}$/.test(code)) return null
  const ns = code[0]
  const d = code.slice(1, 7)
  const check = code[7]
  const last = d[5]
  let body: string
  if (last === "0" || last === "1" || last === "2") body = `${d[0]}${d[1]}${last}0000${d[2]}${d[3]}${d[4]}`
  else if (last === "3") body = `${d[0]}${d[1]}${d[2]}00000${d[3]}${d[4]}`
  else if (last === "4") body = `${d[0]}${d[1]}${d[2]}${d[3]}00000${d[4]}`
  else body = `${d[0]}${d[1]}${d[2]}${d[3]}${d[4]}0000${last}`
  return `${ns}${body}${check}`
}

/** BarcodeDetector format names (W3C Shape Detection spec) used by F9. */
export const SCANNER_BARCODE_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] as const
export type ScannerBarcodeFormat = (typeof SCANNER_BARCODE_FORMATS)[number]

/**
 * Validates a CAMERA read before it is acted upon. EAN/UPC symbols carry a
 * check digit, so a misread that slipped through the decoder is rejected
 * here. Code 128 has its own symbol checksum already verified by the
 * decoder — only basic sanity is checked. Manual entries never go through
 * this (internal codes can have any structure).
 */
export function isPlausibleCameraRead(rawValue: string, format: string): boolean {
  const value = rawValue.trim()
  if (!value || value.length > BARCODE_MAX_LENGTH) return false
  switch (format) {
    case "ean_13":
      return value.length === 13 && isValidGtin(value)
    case "ean_8":
      return value.length === 8 && isValidGtin(value)
    case "upc_a":
      return value.length === 12 && isValidGtin(value)
    case "upc_e": {
      const expanded = expandUpcE(value)
      return expanded !== null && isValidGtin(expanded)
    }
    case "code_128":
      return !/[\u0000-\u001f\u007f]/.test(value)
    default:
      return false
  }
}

/**
 * Canonical comparison key. null for empty input. Two codes refer to the
 * same article inside a business iff their keys are equal.
 */
export function barcodeLookupKey(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null
  const value = raw.trim()
  if (!value) return null
  if (DIGITS.test(value)) {
    // UPC-A (12) ↔ EAN-13 with leading 0 — only for valid GTINs.
    if (value.length === 12 && isValidGtin(value)) return `0${value}`
    return value
  }
  return value.toUpperCase()
}

// ---------------------------------------------------------------------------
// Catalog matching
// ---------------------------------------------------------------------------

export interface BarcodeCatalogVariante {
  id: string
  nombre: string
  codigoBarras: string | null
  activo: boolean
}

export interface BarcodeCatalogProducto<V extends BarcodeCatalogVariante = BarcodeCatalogVariante> {
  id: string
  nombre: string
  codigoBarras: string | null
  eliminado: boolean
  variantes: ReadonlyArray<V>
}

export type BarcodeMatch<P, V> =
  | { kind: "producto"; producto: P }
  | { kind: "variante"; producto: P; variante: V }

/**
 * Every article of the catalog whose code has the same lookup key. Deleted
 * products (eliminado) and their variants are excluded; inactive variants
 * are INCLUDED here (callers decide sellability — the duplicate guard
 * counts them, Caja reports them as not available).
 */
export function findBarcodeMatches<V extends BarcodeCatalogVariante, P extends BarcodeCatalogProducto<V>>(
  catalog: ReadonlyArray<P>,
  raw: string
): Array<BarcodeMatch<P, V>> {
  const key = barcodeLookupKey(raw)
  if (!key) return []
  const matches: Array<BarcodeMatch<P, V>> = []
  for (const producto of catalog) {
    if (producto.eliminado) continue
    if (barcodeLookupKey(producto.codigoBarras) === key) matches.push({ kind: "producto", producto })
    for (const variante of producto.variantes) {
      if (barcodeLookupKey(variante.codigoBarras) === key) matches.push({ kind: "variante", producto, variante })
    }
  }
  return matches
}

export interface BarcodeConflictExclusion {
  /** The Producto row being edited (its own base code is not a conflict). */
  productoId?: string | null
  /** The variant row being edited (its own code is not a conflict). */
  varianteId?: string | null
}

export interface BarcodeConflict {
  productoId: string
  productoNombre: string
  varianteId: string | null
  varianteNombre: string | null
}

/** First article (other than the excluded row) already using this code. */
export function findBarcodeConflict<V extends BarcodeCatalogVariante, P extends BarcodeCatalogProducto<V>>(
  catalog: ReadonlyArray<P>,
  raw: string,
  exclude: BarcodeConflictExclusion = {}
): BarcodeConflict | null {
  for (const match of findBarcodeMatches<V, P>(catalog, raw)) {
    if (match.kind === "producto") {
      if (exclude.productoId && match.producto.id === exclude.productoId) continue
      return { productoId: match.producto.id, productoNombre: match.producto.nombre, varianteId: null, varianteNombre: null }
    }
    if (exclude.varianteId && match.variante.id === exclude.varianteId) continue
    return {
      productoId: match.producto.id,
      productoNombre: match.producto.nombre,
      varianteId: match.variante.id,
      varianteNombre: match.variante.nombre,
    }
  }
  return null
}

export function describeBarcodeConflict(conflict: BarcodeConflict): string {
  const label = conflict.varianteNombre
    ? `"${conflict.productoNombre} — ${conflict.varianteNombre}"`
    : `"${conflict.productoNombre}"`
  return `Ese código de barras ya está asignado a ${label}`
}

/** Codes repeated inside one submitted list (e.g. inline variant rows). */
export function findRepeatedBarcodes(codes: ReadonlyArray<string | null | undefined>): string[] {
  const seen = new Map<string, string>()
  const repeated: string[] = []
  for (const code of codes) {
    const key = barcodeLookupKey(code)
    if (!key) continue
    if (seen.has(key)) {
      if (!repeated.includes(seen.get(key)!)) repeated.push(seen.get(key)!)
    } else {
      seen.set(key, (code as string).trim())
    }
  }
  return repeated
}

// ---------------------------------------------------------------------------
// Caja scan resolution
// ---------------------------------------------------------------------------

export interface ScanCatalogVariante extends BarcodeCatalogVariante {
  controlStock: boolean
  stockCantidad: number
}

export interface ScanCatalogProducto<V extends ScanCatalogVariante = ScanCatalogVariante> extends BarcodeCatalogProducto<V> {
  controlStock: boolean
  stockCantidad: number
}

/** Same rule as src/lib/inventario.ts#isProductSellable, kept local so this file stays dependency-free. */
function sellable(activo: boolean, controlStock: boolean, stockCantidad: number): boolean {
  if (!activo) return false
  if (!controlStock) return true
  return stockCantidad > 0
}

export type ScanResolution<P, V> =
  | { kind: "not_found" }
  /** Add this product (no variants). */
  | { kind: "add_producto"; producto: P }
  /** Add this exact variant. */
  | { kind: "add_variante"; producto: P; variante: V }
  /** Parent code of a product with several sellable variants (D4) — never auto-pick. */
  | { kind: "choose_variante"; producto: P }
  /** Several different articles share this code (historical duplicates) — never auto-pick. */
  | { kind: "ambiguous"; matches: Array<BarcodeMatch<P, V>> }
  | { kind: "unavailable"; reason: "variante_inactiva" | "sin_variantes_disponibles" | "sin_stock"; label: string }

/** A resolution for one identified article (no lookup outcome). */
export type ResolvedScan<P, V> = Exclude<ScanResolution<P, V>, { kind: "not_found" } | { kind: "ambiguous" }>

/**
 * Exact-match resolution for a scanned/typed code against the catalog of
 * the authenticated business (the caller only ever holds its own catalog).
 * Mirrors Caja's existing tap rules (caja-tab.tsx handleProductTap /
 * addProduct / addVariante): physical-stock sellability, a product with
 * exactly one active variant adds it directly, several open the selector.
 */
export function resolveScannedBarcode<V extends ScanCatalogVariante, P extends ScanCatalogProducto<V>>(
  catalog: ReadonlyArray<P>,
  raw: string
): ScanResolution<P, V> {
  const matches = findBarcodeMatches<V, P>(catalog, raw)
  if (matches.length === 0) return { kind: "not_found" }
  if (matches.length > 1) return { kind: "ambiguous", matches }
  return resolveBarcodeMatch<V, P>(matches[0])
}

/**
 * Resolution of ONE identified article — used for an unambiguous scan and
 * for the article the cashier picked among historical duplicates.
 */
export function resolveBarcodeMatch<V extends ScanCatalogVariante, P extends ScanCatalogProducto<V>>(
  match: BarcodeMatch<P, V>
): ResolvedScan<P, V> {
  const producto = match.producto
  if (match.kind === "variante") {
    const variante = match.variante
    const label = `${producto.nombre} — ${variante.nombre}`
    if (!variante.activo) return { kind: "unavailable", reason: "variante_inactiva", label }
    if (!sellable(true, variante.controlStock, variante.stockCantidad)) return { kind: "unavailable", reason: "sin_stock", label }
    return { kind: "add_variante", producto, variante }
  }

  if (producto.variantes.length === 0) {
    if (!sellable(!producto.eliminado, producto.controlStock, producto.stockCantidad)) {
      return { kind: "unavailable", reason: "sin_stock", label: producto.nombre }
    }
    return { kind: "add_producto", producto }
  }

  // D4: parent code on a product with variants.
  const activas = producto.variantes.filter((v) => v.activo)
  const vendibles = activas.filter((v) => sellable(true, v.controlStock, v.stockCantidad))
  if (vendibles.length === 0) {
    return {
      kind: "unavailable",
      reason: activas.length === 0 ? "sin_variantes_disponibles" : "sin_stock",
      label: producto.nombre,
    }
  }
  if (activas.length === 1) return { kind: "add_variante", producto, variante: activas[0] }
  return { kind: "choose_variante", producto }
}

/**
 * D5 — a scan never stops because the cart exceeds the known stock; it
 * warns. `stockDisponible` (físico − reservas ACTIVA, computed server-side by
 * the R3A authority) is present only when the catalog carries it; without it
 * the number shown is the physical stock and is never presented as
 * guaranteed availability. Either way the checkout remains the authority.
 * Returns null when there is nothing to warn about.
 */
export function describeScanStockWarning(params: {
  controlStock: boolean
  stockCantidad: number
  stockDisponible?: number | null
  cantidadEnCarrito: number
}): string | null {
  if (!params.controlStock) return null
  const disponible = typeof params.stockDisponible === "number" ? Math.max(0, params.stockDisponible) : null
  const conocido = disponible ?? params.stockCantidad
  if (params.cantidadEnCarrito <= conocido) return null
  if (disponible === null) {
    return `Superás el stock registrado (${formatQty(conocido)}). Revisá la cantidad: se valida al cobrar.`
  }
  if (disponible < params.stockCantidad) {
    return `Sólo ${formatQty(conocido)} disponible${conocido === 1 ? "" : "s"} (hay unidades reservadas para pedidos). Revisá la cantidad: se valida al cobrar.`
  }
  return `Superás el stock disponible (${formatQty(conocido)}). Revisá la cantidad: se valida al cobrar.`
}

function formatQty(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "")
}
