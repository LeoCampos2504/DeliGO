// ============================================
// P2-T56-R1 — pure Inventario helpers (generic-business stock tracking)
// ============================================
// No DOM, no Prisma, no React, no fetch — every function here is a pure,
// synchronous computation over plain data, kept separate from the API
// routes/UI so stock-status/validation logic can be tested directly (see
// src/lib/inventario.test.ts). Mirrors the same separation already
// established by src/lib/tracking-movement.ts and
// src/lib/delivery-navigation-ux.ts for other DeliGO features.

export type UnidadMedida =
  | "unidad"
  | "kg"
  | "g"
  | "litro"
  | "ml"
  | "metro"
  | "caja"
  | "paquete"
  | "otro"

export const UNIDADES_MEDIDA: ReadonlyArray<{ value: UnidadMedida; label: string }> = [
  { value: "unidad", label: "Unidad" },
  { value: "kg", label: "Kilogramo (kg)" },
  { value: "g", label: "Gramo (g)" },
  { value: "litro", label: "Litro (L)" },
  { value: "ml", label: "Mililitro (ml)" },
  { value: "metro", label: "Metro (m)" },
  { value: "caja", label: "Caja" },
  { value: "paquete", label: "Paquete" },
  { value: "otro", label: "Otro" },
]

export function isValidUnidadMedida(value: unknown): value is UnidadMedida {
  return typeof value === "string" && UNIDADES_MEDIDA.some((u) => u.value === value)
}

export type StockStatus = "NO_CONTROLADO" | "SIN_STOCK" | "STOCK_BAJO" | "EN_STOCK"

/**
 * MVP stock states (section 10): a product that doesn't opt into stock
 * control is always NO_CONTROLADO (never blocks a sale on quantity). A
 * controlled product is SIN_STOCK at zero-or-below, STOCK_BAJO at or under
 * its own configured minimum (but still sellable), else EN_STOCK.
 */
export function computeStockStatus(
  controlStock: boolean,
  stockCantidad: number,
  stockMinimo: number,
): StockStatus {
  if (!controlStock) return "NO_CONTROLADO"
  if (!Number.isFinite(stockCantidad) || stockCantidad <= 0) return "SIN_STOCK"
  if (Number.isFinite(stockMinimo) && stockMinimo > 0 && stockCantidad <= stockMinimo) return "STOCK_BAJO"
  return "EN_STOCK"
}

/**
 * Caja sellability gate (sections 18/26): a controlled product with no
 * stock cannot be sold; an uncontrolled product is always sellable while
 * active. `activo` mirrors Producto.eliminado inverted (see the API layer).
 */
export function isProductSellable(params: {
  activo: boolean
  controlStock: boolean
  stockCantidad: number
}): boolean {
  if (!params.activo) return false
  if (!params.controlStock) return true
  return Number.isFinite(params.stockCantidad) && params.stockCantidad > 0
}

export interface ProductoMinimoInput {
  nombre?: unknown
  precio?: unknown
}

export type ValidationResult = { ok: true } | { ok: false; error: string }

/** MVP required fields (section 8): only name + sale price. Everything else is optional. */
export function validateProductoMinimo(input: ProductoMinimoInput): ValidationResult {
  if (typeof input.nombre !== "string" || !input.nombre.trim()) {
    return { ok: false, error: "El nombre es obligatorio" }
  }
  if (typeof input.precio !== "number" || !Number.isFinite(input.precio) || input.precio <= 0) {
    return { ok: false, error: "El precio debe ser mayor a 0" }
  }
  return { ok: true }
}

export interface VarianteMinimoInput {
  nombre?: unknown
  precio?: unknown
}

/** Same minimum-required-fields contract as validateProductoMinimo, for a ProductoVariante (P2-T56-R2C section 7). */
export function validateVarianteMinimo(input: VarianteMinimoInput): ValidationResult {
  if (typeof input.nombre !== "string" || !input.nombre.trim()) {
    return { ok: false, error: "El nombre de la variante es obligatorio" }
  }
  if (typeof input.precio !== "number" || !Number.isFinite(input.precio) || input.precio <= 0) {
    return { ok: false, error: "El precio de la variante debe ser mayor a 0" }
  }
  return { ok: true }
}

export interface VarianteResumenInput {
  precio: number
  controlStock: boolean
  stockCantidad: number
  stockMinimo: number
  activo: boolean
}

export interface VariantesResumen {
  cantidadActivas: number
  precioDesde: number | null
  /** Sum of stockCantidad across active, stock-controlled variants; null when none control stock (nothing meaningful to sum — section 16: never an "authority", just a visual summary). */
  stockTotal: number | null
  /** Active, stock-controlled variants currently at/under their own minimum (STOCK_BAJO) or at zero (SIN_STOCK) — section 17. */
  variantesConStockBajo: number
  /** True only when every active, stock-controlled variant is at SIN_STOCK — section 16: a single depleted variant must never mark the whole product as agotado. */
  todasSinStock: boolean
}

/**
 * Pure summary for Inventario's collapsed product-with-variants listing row
 * (sections 15/16/17) — never used as a stock-decrement authority, only for
 * display. Ignores inactive variants entirely (an inactivated variant is
 * neither sellable nor counted toward any of these figures).
 */
export function summarizeVariantes(variantes: ReadonlyArray<VarianteResumenInput>): VariantesResumen {
  const activas = variantes.filter((v) => v.activo)
  const controladas = activas.filter((v) => v.controlStock)
  const estados = controladas.map((v) => computeStockStatus(v.controlStock, v.stockCantidad, v.stockMinimo))

  return {
    cantidadActivas: activas.length,
    precioDesde: activas.length > 0 ? Math.min(...activas.map((v) => v.precio)) : null,
    stockTotal: controladas.length > 0 ? controladas.reduce((sum, v) => sum + v.stockCantidad, 0) : null,
    variantesConStockBajo: estados.filter((s) => s === "STOCK_BAJO" || s === "SIN_STOCK").length,
    todasSinStock: controladas.length > 0 && estados.every((s) => s === "SIN_STOCK"),
  }
}

export const MOVIMIENTO_TIPOS = ["ENTRADA", "SALIDA", "AJUSTE", "VENTA"] as const
export type MovimientoTipo = (typeof MOVIMIENTO_TIPOS)[number]

export function isValidMovimientoTipo(value: unknown): value is MovimientoTipo {
  return typeof value === "string" && (MOVIMIENTO_TIPOS as readonly string[]).includes(value)
}

/**
 * Resolves the next stockCantidad for a movement (section 11/25/26).
 * ENTRADA adds `cantidad`; SALIDA/VENTA subtract it (never below 0). AJUSTE
 * is a physical recount: `cantidad` is the new absolute stock, not a delta
 * (matching how "ajuste de inventario" is used in practice — you correct
 * the recorded stock to match what you counted, not add/subtract blindly).
 */
export function resolveNextStock(
  currentStock: number,
  tipo: MovimientoTipo,
  cantidad: number,
): { ok: true; nextStock: number } | { ok: false; error: string } {
  if (!Number.isFinite(cantidad) || cantidad < 0) {
    return { ok: false, error: "La cantidad del movimiento no puede ser negativa" }
  }
  if (tipo === "AJUSTE") {
    return { ok: true, nextStock: cantidad }
  }
  if (cantidad <= 0) {
    return { ok: false, error: "La cantidad del movimiento debe ser mayor a 0" }
  }
  const delta = tipo === "ENTRADA" ? cantidad : -cantidad // SALIDA | VENTA
  const nextStock = currentStock + delta
  if (nextStock < 0) {
    return { ok: false, error: "El movimiento dejaría el stock en negativo" }
  }
  return { ok: true, nextStock }
}
