// P2-T56-R3A-P0 — identidad de línea del carrito de Mozo (P0-D).
import { describe, expect, test } from "bun:test"
import { buildOrderItemKey } from "./mozo-order-item-key"

function line(overrides: Partial<Parameters<typeof buildOrderItemKey>[0]> = {}) {
  return {
    productoId: "producto-1",
    varianteId: null,
    agregados: [],
    secciones: {},
    ingredientesQuitados: [],
    talle: "",
    color: "",
    ...overrides,
  }
}

describe("P2-T56-R3A-P0 — buildOrderItemKey (carrito Mozo)", () => {
  test("P0-D: variantes A y B del mismo producto son líneas independientes", () => {
    const a = buildOrderItemKey(line({ varianteId: "variante-a" }))
    const b = buildOrderItemKey(line({ varianteId: "variante-b" }))
    expect(a).not.toBe(b)
  })

  test("misma variante con la misma personalización produce la misma key (el carrito incrementa cantidad)", () => {
    expect(buildOrderItemKey(line({ varianteId: "variante-a" }))).toBe(
      buildOrderItemKey(line({ varianteId: "variante-a" }))
    )
  })

  test("producto con variante y el mismo producto sin variante nunca comparten key", () => {
    expect(buildOrderItemKey(line({ varianteId: "variante-a" }))).not.toBe(buildOrderItemKey(line()))
  })

  test("producto sin variantes: key estable e independiente del orden de agregados/ingredientes", () => {
    const one = buildOrderItemKey(
      line({ agregados: [{ id: "ag-2" }, { id: "ag-1" }], ingredientesQuitados: ["Cebolla", "Ajo"] })
    )
    const two = buildOrderItemKey(
      line({ agregados: [{ id: "ag-1" }, { id: "ag-2" }], ingredientesQuitados: ["Ajo", "Cebolla"] })
    )
    expect(one).toBe(two)
  })

  test("P0-O: la variante no reemplaza las dimensiones de opciones existentes — misma variante con distinta sección = líneas distintas", () => {
    const grande = buildOrderItemKey(line({ varianteId: "variante-a", secciones: { Tamano: "Grande" } }))
    const chico = buildOrderItemKey(line({ varianteId: "variante-a", secciones: { Tamano: "Chico" } }))
    expect(grande).not.toBe(chico)
  })

  test("talle/color siguen formando parte de la identidad", () => {
    expect(buildOrderItemKey(line({ varianteId: "variante-a", talle: "M" }))).not.toBe(
      buildOrderItemKey(line({ varianteId: "variante-a", talle: "L" }))
    )
  })
})
