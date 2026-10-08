// ============================================
// F9 — barcode authority (pure): normalization, GTIN, equivalence, matching
// ============================================
import { describe, expect, test } from "bun:test"
import {
  barcodeLookupKey,
  describeBarcodeConflict,
  describeScanStockWarning,
  expandUpcE,
  findBarcodeConflict,
  findBarcodeMatches,
  findRepeatedBarcodes,
  isPlausibleCameraRead,
  isValidGtin,
  normalizeBarcodeForStorage,
  resolveBarcodeMatch,
  resolveScannedBarcode,
  type ScanCatalogProducto,
  type ScanCatalogVariante,
} from "./barcode"

// Real, check-digit-valid codes.
const EAN13 = "7791234567898" // 779 = Argentina prefix
const UPCA = "036000291452"
const UPCA_AS_EAN13 = "0036000291452"
const EAN8 = "96385074"

type V = ScanCatalogVariante & { precio: number }
type P = ScanCatalogProducto<V> & { precio: number }

function producto(overrides: Partial<P> = {}): P {
  return {
    id: "p1",
    nombre: "Sopa",
    precio: 1200,
    codigoBarras: null,
    eliminado: false,
    controlStock: false,
    stockCantidad: 0,
    variantes: [],
    ...overrides,
  }
}

function variante(overrides: Partial<V> = {}): V {
  return { id: "v1", nombre: "500 ml", precio: 900, codigoBarras: null, activo: true, controlStock: false, stockCantidad: 0, ...overrides }
}

describe("normalizeBarcodeForStorage", () => {
  test("trims, keeps leading zeros and stays a string", () => {
    expect(normalizeBarcodeForStorage("  0036000291452 ")).toEqual({ ok: true, value: "0036000291452" })
  })
  test("null / empty / whitespace → null", () => {
    expect(normalizeBarcodeForStorage(null)).toEqual({ ok: true, value: null })
    expect(normalizeBarcodeForStorage("")).toEqual({ ok: true, value: null })
    expect(normalizeBarcodeForStorage("   ")).toEqual({ ok: true, value: null })
  })
  test("rejects non-strings (never converts numbers), control chars and oversize", () => {
    expect(normalizeBarcodeForStorage(7791234567898).ok).toBe(false)
    expect(normalizeBarcodeForStorage("ab\u0007c").ok).toBe(false)
    expect(normalizeBarcodeForStorage("x".repeat(65)).ok).toBe(false)
    expect(normalizeBarcodeForStorage("x".repeat(64)).ok).toBe(true)
  })
  test("manual alphanumeric internal codes are accepted as typed", () => {
    expect(normalizeBarcodeForStorage("INT-0042/b")).toEqual({ ok: true, value: "INT-0042/b" })
  })
})

describe("GTIN check digits", () => {
  test("valid EAN-13 / UPC-A / EAN-8", () => {
    expect(isValidGtin(EAN13)).toBe(true)
    expect(isValidGtin(UPCA)).toBe(true)
    expect(isValidGtin(UPCA_AS_EAN13)).toBe(true)
    expect(isValidGtin(EAN8)).toBe(true)
  })
  test("wrong check digit / wrong length / non-digits are invalid", () => {
    expect(isValidGtin("7791234567890")).toBe(false)
    expect(isValidGtin("12345")).toBe(false)
    expect(isValidGtin("77912345678A8")).toBe(false)
  })
  test("UPC-E expands to its UPC-A form", () => {
    expect(expandUpcE("04252614")).toBe("042100005264")
    expect(isValidGtin(expandUpcE("04252614")!)).toBe(true)
    expect(expandUpcE("94252614")).toBeNull()
  })
})

describe("camera read plausibility (check digit per detected format)", () => {
  test("accepts valid reads", () => {
    expect(isPlausibleCameraRead(EAN13, "ean_13")).toBe(true)
    expect(isPlausibleCameraRead(EAN8, "ean_8")).toBe(true)
    expect(isPlausibleCameraRead(UPCA, "upc_a")).toBe(true)
    expect(isPlausibleCameraRead("04252614", "upc_e")).toBe(true)
    expect(isPlausibleCameraRead("ABC-123", "code_128")).toBe(true)
  })
  test("rejects misreads, wrong-length values and unknown formats", () => {
    expect(isPlausibleCameraRead("7791234567890", "ean_13")).toBe(false)
    expect(isPlausibleCameraRead(UPCA, "ean_13")).toBe(false)
    expect(isPlausibleCameraRead("04252615", "upc_e")).toBe(false)
    expect(isPlausibleCameraRead("https://x", "qr_code")).toBe(false)
  })
})

describe("barcodeLookupKey — equivalences", () => {
  test("a valid UPC-A equals its EAN-13 form with a leading 0", () => {
    expect(barcodeLookupKey(UPCA)).toBe(barcodeLookupKey(UPCA_AS_EAN13))
  })
  test("no equivalence for invalid 12-digit codes or short internal numbers", () => {
    expect(isValidGtin("123456789013")).toBe(false)
    expect(barcodeLookupKey("123456789013")).toBe("123456789013")
    expect(barcodeLookupKey("0123")).not.toBe(barcodeLookupKey("123"))
  })
  test("leading zeros are significant, never numeric", () => {
    expect(barcodeLookupKey("00012")).toBe("00012")
  })
  test("alphanumeric codes compare case-insensitively and trimmed", () => {
    expect(barcodeLookupKey(" abc-1 ")).toBe(barcodeLookupKey("ABC-1"))
  })
  test("empty → null", () => {
    expect(barcodeLookupKey("  ")).toBeNull()
    expect(barcodeLookupKey(null)).toBeNull()
  })
})

describe("findBarcodeMatches / findBarcodeConflict", () => {
  const catalog: P[] = [
    producto({ id: "p1", nombre: "Sopa", codigoBarras: EAN13 }),
    producto({ id: "p2", nombre: "Gaseosa", variantes: [variante({ id: "v1", nombre: "500 ml", codigoBarras: UPCA }), variante({ id: "v2", nombre: "1 L", codigoBarras: "INT-9", activo: false })] }),
    producto({ id: "p3", nombre: "Borrado", codigoBarras: "DEL-1", eliminado: true, variantes: [variante({ id: "v3", codigoBarras: "DEL-2" })] }),
  ]
  test("exact product and variant matches, with UPC/EAN equivalence", () => {
    expect(findBarcodeMatches(catalog, EAN13).map((m) => m.producto.id)).toEqual(["p1"])
    const [m] = findBarcodeMatches(catalog, UPCA_AS_EAN13)
    expect(m.kind).toBe("variante")
  })
  test("never substring matching", () => {
    expect(findBarcodeMatches(catalog, EAN13.slice(0, 8))).toEqual([])
  })
  test("deleted products and their variants are excluded; inactive variants count", () => {
    expect(findBarcodeMatches(catalog, "DEL-1")).toEqual([])
    expect(findBarcodeMatches(catalog, "DEL-2")).toEqual([])
    expect(findBarcodeConflict(catalog, "int-9")).toEqual({ productoId: "p2", productoNombre: "Gaseosa", varianteId: "v2", varianteNombre: "1 L" })
  })
  test("the row being edited is not its own conflict", () => {
    expect(findBarcodeConflict(catalog, EAN13, { productoId: "p1" })).toBeNull()
    expect(findBarcodeConflict(catalog, UPCA, { varianteId: "v1" })).toBeNull()
    expect(findBarcodeConflict(catalog, UPCA, { productoId: "p2" })).not.toBeNull() // a product's variants still conflict
  })
  test("conflict message names the article", () => {
    expect(describeBarcodeConflict({ productoId: "p2", productoNombre: "Gaseosa", varianteId: "v1", varianteNombre: "500 ml" })).toContain('"Gaseosa — 500 ml"')
  })
  test("findRepeatedBarcodes detects repeats inside one form (equivalent codes too)", () => {
    expect(findRepeatedBarcodes([UPCA, null, "x", UPCA_AS_EAN13])).toEqual([UPCA])
    expect(findRepeatedBarcodes(["a", "b", ""])).toEqual([])
  })
})

describe("resolveScannedBarcode — Caja rules", () => {
  test("simple product → add_producto", () => {
    const r = resolveScannedBarcode([producto({ codigoBarras: EAN13 })], EAN13)
    expect(r.kind).toBe("add_producto")
  })
  test("exact variant code → that variant", () => {
    const p = producto({ variantes: [variante({ id: "v1", codigoBarras: "A" }), variante({ id: "v2", codigoBarras: "B" })] })
    const r = resolveScannedBarcode([p], "B")
    expect(r.kind === "add_variante" && r.variante.id).toBe("v2")
  })
  test("D4: parent code with ONE active sellable variant adds it", () => {
    const p = producto({ codigoBarras: "PARENT", variantes: [variante({ id: "v1" }), variante({ id: "v2", activo: false })] })
    const r = resolveScannedBarcode([p], "PARENT")
    expect(r.kind === "add_variante" && r.variante.id).toBe("v1")
  })
  test("D4: parent code with several sellable variants never auto-picks", () => {
    const p = producto({ codigoBarras: "PARENT", variantes: [variante({ id: "v1" }), variante({ id: "v2" })] })
    expect(resolveScannedBarcode([p], "PARENT").kind).toBe("choose_variante")
  })
  test("D4: parent code with no eligible variant → unavailable", () => {
    const sinActivas = producto({ codigoBarras: "PARENT", variantes: [variante({ activo: false })] })
    expect(resolveScannedBarcode([sinActivas], "PARENT")).toMatchObject({ kind: "unavailable", reason: "sin_variantes_disponibles" })
    const agotadas = producto({ codigoBarras: "PARENT", variantes: [variante({ controlStock: true, stockCantidad: 0 })] })
    expect(resolveScannedBarcode([agotadas], "PARENT")).toMatchObject({ kind: "unavailable", reason: "sin_stock" })
  })
  test("inactive variant code → unavailable (never added)", () => {
    const p = producto({ variantes: [variante({ codigoBarras: "X", activo: false })] })
    expect(resolveScannedBarcode([p], "X")).toMatchObject({ kind: "unavailable", reason: "variante_inactiva" })
  })
  test("controlled product with 0 physical stock → sin_stock (existing Caja rule)", () => {
    const p = producto({ codigoBarras: "X", controlStock: true, stockCantidad: 0 })
    expect(resolveScannedBarcode([p], "X")).toMatchObject({ kind: "unavailable", reason: "sin_stock" })
  })
  test("deleted product → not_found", () => {
    expect(resolveScannedBarcode([producto({ codigoBarras: "X", eliminado: true })], "X").kind).toBe("not_found")
  })
  test("unknown code → not_found", () => {
    expect(resolveScannedBarcode([producto({ codigoBarras: EAN13 })], "999").kind).toBe("not_found")
  })
  test("historical duplicates → ambiguous with every match, never auto-picked", () => {
    const r = resolveScannedBarcode([producto({ id: "a", codigoBarras: "DUP" }), producto({ id: "b", codigoBarras: "dup" })], "DUP")
    expect(r.kind).toBe("ambiguous")
    if (r.kind === "ambiguous") {
      expect(r.matches.map((m) => m.producto.id)).toEqual(["a", "b"])
      expect(resolveBarcodeMatch(r.matches[1]).kind).toBe("add_producto")
    }
  })
  test("tenant isolation: resolution only sees the catalog it is given", () => {
    const negocioA = [producto({ id: "a1", codigoBarras: EAN13 })]
    const negocioB = [producto({ id: "b1", codigoBarras: "OTRO" })]
    expect(resolveScannedBarcode(negocioB, EAN13).kind).toBe("not_found")
    expect(resolveScannedBarcode(negocioA, EAN13).kind).toBe("add_producto")
  })
})

describe("describeScanStockWarning — D5", () => {
  test("no warning without stock control or within the known stock", () => {
    expect(describeScanStockWarning({ controlStock: false, stockCantidad: 0, cantidadEnCarrito: 9 })).toBeNull()
    expect(describeScanStockWarning({ controlStock: true, stockCantidad: 5, stockDisponible: 5, cantidadEnCarrito: 5 })).toBeNull()
  })
  test("reserved units: warns with the real available and mentions reservations", () => {
    const w = describeScanStockWarning({ controlStock: true, stockCantidad: 5, stockDisponible: 2, cantidadEnCarrito: 3 })
    expect(w).toContain("Sólo 2 disponibles")
    expect(w).toContain("reservadas")
    expect(w).toContain("se valida al cobrar")
  })
  test("without availability info: physical stock, never presented as guaranteed", () => {
    const w = describeScanStockWarning({ controlStock: true, stockCantidad: 1, cantidadEnCarrito: 2 })
    expect(w).toContain("stock registrado")
    expect(w).not.toContain("disponible")
  })
})
