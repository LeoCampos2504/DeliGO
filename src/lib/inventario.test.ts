import { describe, expect, test } from "bun:test"
import {
  computeStockStatus,
  isProductSellable,
  isValidMovimientoTipo,
  isValidUnidadMedida,
  resolveNextStock,
  summarizeVariantes,
  validateProductoMinimo,
  validateVarianteMinimo,
  type VarianteResumenInput,
} from "./inventario"

describe("computeStockStatus", () => {
  test("uncontrolled products are always NO_CONTROLADO regardless of quantity", () => {
    expect(computeStockStatus(false, 0, 0)).toBe("NO_CONTROLADO")
    expect(computeStockStatus(false, -5, 10)).toBe("NO_CONTROLADO")
  })

  test("controlled product at zero or below is SIN_STOCK", () => {
    expect(computeStockStatus(true, 0, 5)).toBe("SIN_STOCK")
    expect(computeStockStatus(true, -1, 5)).toBe("SIN_STOCK")
  })

  test("controlled product at or under its minimum is STOCK_BAJO", () => {
    expect(computeStockStatus(true, 5, 5)).toBe("STOCK_BAJO")
    expect(computeStockStatus(true, 3, 5)).toBe("STOCK_BAJO")
  })

  test("controlled product above its minimum is EN_STOCK", () => {
    expect(computeStockStatus(true, 6, 5)).toBe("EN_STOCK")
  })

  test("a zero/undefined minimum never triggers STOCK_BAJO", () => {
    expect(computeStockStatus(true, 1, 0)).toBe("EN_STOCK")
  })
})

describe("isProductSellable", () => {
  test("inactive product is never sellable", () => {
    expect(isProductSellable({ activo: false, controlStock: false, stockCantidad: 999 })).toBe(false)
  })

  test("uncontrolled active product is always sellable", () => {
    expect(isProductSellable({ activo: true, controlStock: false, stockCantidad: 0 })).toBe(true)
  })

  test("controlled active product needs stock > 0", () => {
    expect(isProductSellable({ activo: true, controlStock: true, stockCantidad: 1 })).toBe(true)
    expect(isProductSellable({ activo: true, controlStock: true, stockCantidad: 0 })).toBe(false)
  })
})

describe("validateProductoMinimo", () => {
  test("requires only nombre + precio (section 8 MVP minimum)", () => {
    expect(validateProductoMinimo({ nombre: "Coca Cola 2.25L", precio: 3500 })).toEqual({ ok: true })
  })

  test("rejects empty/missing nombre", () => {
    expect(validateProductoMinimo({ nombre: "  ", precio: 100 }).ok).toBe(false)
    expect(validateProductoMinimo({ precio: 100 }).ok).toBe(false)
  })

  test("rejects non-positive or missing precio", () => {
    expect(validateProductoMinimo({ nombre: "X", precio: 0 }).ok).toBe(false)
    expect(validateProductoMinimo({ nombre: "X", precio: -5 }).ok).toBe(false)
    expect(validateProductoMinimo({ nombre: "X" }).ok).toBe(false)
  })
})

describe("isValidUnidadMedida / isValidMovimientoTipo", () => {
  test("accepts every documented unit and rejects garbage", () => {
    expect(isValidUnidadMedida("kg")).toBe(true)
    expect(isValidUnidadMedida("litro")).toBe(true)
    expect(isValidUnidadMedida("gramos")).toBe(false)
  })

  test("accepts every documented movement type and rejects garbage", () => {
    expect(isValidMovimientoTipo("ENTRADA")).toBe(true)
    expect(isValidMovimientoTipo("VENTA")).toBe(true)
    expect(isValidMovimientoTipo("BORRADO")).toBe(false)
  })
})

describe("resolveNextStock", () => {
  test("ENTRADA adds to current stock", () => {
    expect(resolveNextStock(10, "ENTRADA", 5)).toEqual({ ok: true, nextStock: 15 })
  })

  test("SALIDA and VENTA subtract from current stock", () => {
    expect(resolveNextStock(10, "SALIDA", 4)).toEqual({ ok: true, nextStock: 6 })
    expect(resolveNextStock(10, "VENTA", 10)).toEqual({ ok: true, nextStock: 0 })
  })

  test("AJUSTE sets an absolute recount, not a delta", () => {
    expect(resolveNextStock(999, "AJUSTE", 7)).toEqual({ ok: true, nextStock: 7 })
    expect(resolveNextStock(0, "AJUSTE", 0)).toEqual({ ok: true, nextStock: 0 })
  })

  test("never allows stock to go negative for ENTRADA/SALIDA/VENTA", () => {
    expect(resolveNextStock(3, "SALIDA", 5).ok).toBe(false)
    expect(resolveNextStock(3, "VENTA", 10).ok).toBe(false)
  })

  test("rejects a non-positive cantidad for ENTRADA/SALIDA/VENTA", () => {
    expect(resolveNextStock(10, "ENTRADA", 0).ok).toBe(false)
    expect(resolveNextStock(10, "SALIDA", -1).ok).toBe(false)
  })

  test("rejects a negative cantidad even for AJUSTE", () => {
    expect(resolveNextStock(10, "AJUSTE", -1).ok).toBe(false)
  })
})

// P2-T56-R2C: product variants (section 7)
describe("validateVarianteMinimo", () => {
  test("requires only nombre + precio, same minimum contract as a product", () => {
    expect(validateVarianteMinimo({ nombre: "500 ml", precio: 2000 })).toEqual({ ok: true })
  })

  test("rejects empty/missing nombre", () => {
    expect(validateVarianteMinimo({ nombre: "  ", precio: 100 }).ok).toBe(false)
    expect(validateVarianteMinimo({ precio: 100 }).ok).toBe(false)
  })

  test("rejects non-positive or missing precio", () => {
    expect(validateVarianteMinimo({ nombre: "X", precio: 0 }).ok).toBe(false)
    expect(validateVarianteMinimo({ nombre: "X" }).ok).toBe(false)
  })
})

describe("summarizeVariantes (Inventario collapsed-listing summary, sections 15/16/17)", () => {
  const variante = (overrides: Partial<VarianteResumenInput>): VarianteResumenInput => ({
    precio: 2000,
    controlStock: true,
    stockCantidad: 10,
    stockMinimo: 2,
    activo: true,
    ...overrides,
  })

  test("counts only active variants, ignores inactive ones entirely", () => {
    const result = summarizeVariantes([variante({}), variante({ activo: false })])
    expect(result.cantidadActivas).toBe(1)
  })

  test("precioDesde is the minimum price across active variants", () => {
    const result = summarizeVariantes([variante({ precio: 3200 }), variante({ precio: 2000 }), variante({ precio: 4500 })])
    expect(result.precioDesde).toBe(2000)
  })

  test("stockTotal sums only stock-controlled active variants", () => {
    const result = summarizeVariantes([
      variante({ stockCantidad: 4 }),
      variante({ stockCantidad: 8 }),
      variante({ controlStock: false, stockCantidad: 999 }), // never summed — uncontrolled
    ])
    expect(result.stockTotal).toBe(12)
  })

  test("stockTotal is null when no active variant controls stock", () => {
    expect(summarizeVariantes([variante({ controlStock: false })]).stockTotal).toBeNull()
  })

  test("a single depleted variant among others is NOT 'todas sin stock' — other variants stay sellable (section 16)", () => {
    const result = summarizeVariantes([variante({ stockCantidad: 0 }), variante({ stockCantidad: 5 })])
    expect(result.todasSinStock).toBe(false)
    expect(result.variantesConStockBajo).toBe(1) // the depleted one counts as low/out
  })

  test("todasSinStock is true only when every stock-controlled active variant is depleted", () => {
    expect(summarizeVariantes([variante({ stockCantidad: 0 }), variante({ stockCantidad: 0 })]).todasSinStock).toBe(true)
  })

  test("variantesConStockBajo counts STOCK_BAJO and SIN_STOCK, not EN_STOCK", () => {
    const result = summarizeVariantes([
      variante({ stockCantidad: 1, stockMinimo: 2 }), // STOCK_BAJO
      variante({ stockCantidad: 0, stockMinimo: 2 }), // SIN_STOCK
      variante({ stockCantidad: 10, stockMinimo: 2 }), // EN_STOCK
    ])
    expect(result.variantesConStockBajo).toBe(2)
  })

  test("an empty variant list summarizes to zero/null, never throws", () => {
    expect(summarizeVariantes([])).toEqual({
      cantidadActivas: 0,
      precioDesde: null,
      stockTotal: null,
      variantesConStockBajo: 0,
      todasSinStock: false,
    })
  })
})
