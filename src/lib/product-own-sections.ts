// ============================================
// DeliGO — Product-specific option-section pricing (OWN-PRODUCT-OPTION-PRICES-R1)
// ============================================
// `Producto.secciones` is a JSON string column (prisma/schema.prisma) that
// has always stored `opciones` as a plain string array — a "Tamaño"
// section's options were just `["Individual", "Familiar"]`, with no way
// to give "Familiar" a price. Shared Options (`OpcionesCompartidas`)
// already support a per-option price via `{nombre, precio}` objects; this
// module brings the exact same shape to product-specific "own sections",
// without a schema migration (the column is already free-form JSON) and
// without breaking a single existing product: a legacy string option
// normalizes to `{nombre, precio: 0}`, indistinguishable in behavior from
// before this feature existed.
//
// Single shared source for this shape so the business editor, the public
// catalog API, and the order-pricing API can never drift from each other
// (task instruction: "Do not duplicate normalizers across: Business
// editor, Public catalog, Order API").
//
// Pure — no React, no Prisma, no fetch. Safe to import from both server
// route handlers and client components.

export interface OwnSectionOption {
  nombre: string
  precio: number
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * Accepts a raw `opciones` array in either the legacy shape (`string[]`)
 * or the new canonical shape (`{nombre, precio}[]`), even mixed within
 * the same array (defensive — a hand-edited/partially-migrated record
 * should never crash). A legacy string option always normalizes to
 * `precio: 0` — identical behavior to "no price feature" for every
 * product that predates this task. Malformed/negative/non-finite prices
 * fall back to 0 rather than being rejected here — this function is used
 * for DISPLAY/read paths; save-time validation (reject negative/NaN) is
 * the API route's job, not this shared reader. Never throws.
 */
export function normalizeOwnSectionOptions(raw: unknown): OwnSectionOption[] {
  if (!Array.isArray(raw)) return []
  const result: OwnSectionOption[] = []
  for (const item of raw) {
    if (typeof item === "string") {
      const nombre = item.trim()
      if (nombre) result.push({ nombre, precio: 0 })
      continue
    }
    if (isPlainObject(item)) {
      const nombre = typeof item.nombre === "string" ? item.nombre.trim() : ""
      if (!nombre) continue
      const precio =
        typeof item.precio === "number" && Number.isFinite(item.precio) && item.precio >= 0 ? item.precio : 0
      result.push({ nombre, precio })
    }
  }
  return result
}

/**
 * Save-time validation for the business editor's price input: `undefined`
 * normalizes to 0 (task §38 "Empty: normalize to 0"); a finite number
 * >= 0 is accepted as-is; anything else (negative, NaN, Infinity, a
 * non-number) is rejected. Returns `null` on rejection so the caller can
 * produce a clear 400, never silently coerces a bad value to something
 * else.
 */
export function validateOwnSectionOptionPrice(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return 0
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  if (value < 0) return null
  return value
}

export interface ValidatedOwnSection {
  nombre: string
  opciones: OwnSectionOption[]
  obligatorio: boolean
  maximo: number
}

export type ValidateProductSectionsResult =
  | { ok: true; value: ValidatedOwnSection[] }
  | { ok: false; error: string }

/**
 * Save-time (POST/PUT `/api/negocio/productos`) structural validation of
 * the whole `secciones` array a business owner submits — rejects a
 * malformed section/option/price outright (400) rather than silently
 * coercing it, so a bad request never gets a false "guardado
 * correctamente". Legacy string options are still accepted here (a
 * business editing an old product without touching its sections should
 * never be forced to re-enter them) and normalize to `precio: 0`.
 */
export function validateProductSectionsForSave(raw: unknown): ValidateProductSectionsResult {
  if (raw === undefined || raw === null) return { ok: true, value: [] }
  if (!Array.isArray(raw)) return { ok: false, error: "secciones debe ser una lista" }

  const result: ValidatedOwnSection[] = []
  for (const rawSection of raw) {
    if (!isPlainObject(rawSection)) return { ok: false, error: "Sección de opciones inválida" }
    const nombre = typeof rawSection.nombre === "string" ? rawSection.nombre.trim() : ""
    if (!nombre) return { ok: false, error: "Nombre de sección inválido" }
    const obligatorio = rawSection.obligatorio === true
    const maximo =
      typeof rawSection.maximo === "number" && Number.isInteger(rawSection.maximo) && rawSection.maximo >= 0
        ? rawSection.maximo
        : 0

    const rawOpciones = Array.isArray(rawSection.opciones) ? rawSection.opciones : []
    const opciones: OwnSectionOption[] = []
    for (const rawOption of rawOpciones) {
      if (typeof rawOption === "string") {
        const optNombre = rawOption.trim()
        if (optNombre) opciones.push({ nombre: optNombre, precio: 0 })
        continue
      }
      if (!isPlainObject(rawOption)) return { ok: false, error: "Opción de sección inválida" }
      const optNombre = typeof rawOption.nombre === "string" ? rawOption.nombre.trim() : ""
      if (!optNombre) return { ok: false, error: "Nombre de opción inválido" }
      const precio = validateOwnSectionOptionPrice(rawOption.precio)
      if (precio === null) return { ok: false, error: "Precio de opción inválido" }
      opciones.push({ nombre: optNombre, precio })
    }

    result.push({ nombre, opciones, obligatorio, maximo })
  }

  return { ok: true, value: result }
}

export type SectionSelectionValue = string | Record<string, number>

export interface OwnSection {
  nombre: string
  opciones: OwnSectionOption[]
  obligatorio: boolean
  maximo: number
}

export interface ValidatedProductSectionsPricing {
  normalized: Record<string, SectionSelectionValue>
  // OWN-PRODUCT-OPTION-PRICES-R1 §48-51: server-authoritative price per
  // selected option, keyed `sectionName::optionName`, quantity already
  // multiplied in. Derived exclusively from `sections` (the product's own
  // stored config) — `selected` supplies only which option names/
  // quantities were chosen, never a price (CLIENT_SUPPLIED_OWN_OPTION_PRICE_TRUSTED=NO).
  seccionesPrecios: Record<string, number>
  seccionesTotal: number
}

export type ValidateProductSectionsPricingResult =
  | { ok: true; value: ValidatedProductSectionsPricing }
  | { ok: false; error: string }

/**
 * Order-creation-time validation of a customer's own-section selections
 * against the product's REAL stored sections — an unknown section/option
 * name is rejected outright (INVALID_OWN_OPTION_SELECTION_REJECTED), a
 * multi-select's total is capped at `maximo`, and every priced option's
 * contribution is computed here (never trusted from the client). Kept
 * pure (no Prisma, no fetch) and exported so it's directly unit-testable
 * without a live database — the single source POST /api/pedidos and any
 * other order-creation surface (e.g. Mozo manual orders) should call.
 */
export function validateAndPriceProductSections(
  selected: Record<string, SectionSelectionValue>,
  sections: OwnSection[]
): ValidateProductSectionsPricingResult {
  const sectionMap = new Map(sections.map((section) => [section.nombre, section]))
  const normalized: Record<string, SectionSelectionValue> = {}
  const seccionesPrecios: Record<string, number> = {}
  let seccionesTotal = 0

  for (const [sectionName, selection] of Object.entries(selected)) {
    const section = sectionMap.get(sectionName)
    if (!section) return { ok: false, error: "Opcion de producto invalida" }
    const optionMap = new Map(section.opciones.map((option) => [option.nombre, option.precio]))

    if (typeof selection === "string") {
      if (!optionMap.has(selection)) return { ok: false, error: "Opcion de producto invalida" }
      normalized[sectionName] = selection
      const precio = optionMap.get(selection)!
      if (precio > 0) {
        seccionesPrecios[`${sectionName}::${selection}`] = precio
        seccionesTotal += precio
      }
      continue
    }

    const validSelection: Record<string, number> = {}
    let totalSelected = 0
    for (const [optionName, quantity] of Object.entries(selection)) {
      if (!optionMap.has(optionName)) return { ok: false, error: "Opcion de producto invalida" }
      totalSelected += quantity
      validSelection[optionName] = quantity
      const precio = optionMap.get(optionName)!
      if (precio > 0) {
        const delta = precio * quantity
        seccionesPrecios[`${sectionName}::${optionName}`] = delta
        seccionesTotal += delta
      }
    }
    if (section.maximo > 0 && totalSelected > section.maximo) {
      return { ok: false, error: "Seleccion de seccion excede el maximo permitido" }
    }
    if (totalSelected > 0) normalized[sectionName] = validSelection
  }

  for (const section of sections) {
    if (!section.obligatorio) continue
    const selection = normalized[section.nombre]
    const selectedCount =
      typeof selection === "string"
        ? selection ? 1 : 0
        : selection
          ? Object.values(selection).reduce((sum, quantity) => sum + quantity, 0)
          : 0
    if (selectedCount < 1) return { ok: false, error: "Falta seleccionar una opcion obligatoria" }
  }

  return { ok: true, value: { normalized, seccionesPrecios, seccionesTotal } }
}

/**
 * Zero-price display contract (task §32, non-negotiable): a free option
 * renders NO price text at all — never "Gratis", "$0", "+$0". Positive
 * prices use the same Argentine-peso formatter as every other price on
 * this page. Caller passes its own `formatPrice` (from `@/lib/utils`) so
 * this module stays free of a hard dependency on it (kept import-light
 * for the server routes that also use this file).
 */
export function formatOptionalPriceDelta(precio: number, formatPrice: (n: number) => string): string {
  return precio > 0 ? `+${formatPrice(precio)}` : ""
}
