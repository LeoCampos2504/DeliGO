import { describe, expect, test } from "bun:test"
import { formatPedidoItemSecciones } from "./pedido-item-personalizacion"

describe("formatPedidoItemSecciones", () => {
  test("preserves a single selection without adding x1", () => {
    expect(formatPedidoItemSecciones(JSON.stringify({ Toppings: { Queso: 1 } }))).toEqual([
      "Toppings: Queso",
    ])
  })

  test("preserves repeated selections with their quantity", () => {
    expect(formatPedidoItemSecciones(JSON.stringify({ Toppings: { Queso: 2 } }))).toEqual([
      "Toppings: Queso x2",
    ])
  })

  test("preserves section context, order and mixed quantities", () => {
    expect(formatPedidoItemSecciones({
      Toppings: { Queso: 2, Bacon: 1 },
      Tamaño: "Grande",
    })).toEqual([
      "Toppings: Queso x2, Bacon",
      "Tamaño: Grande",
    ])
  })

  test("supports the legacy simple string value", () => {
    expect(formatPedidoItemSecciones(JSON.stringify({ Tamaño: "Grande" }))).toEqual([
      "Tamaño: Grande",
    ])
  })

  test("omits empty and non-positive selections", () => {
    expect(formatPedidoItemSecciones({ Toppings: { Queso: 0, Bacon: -1 } })).toEqual([])
    expect(formatPedidoItemSecciones(null)).toEqual([])
    expect(formatPedidoItemSecciones("{}")).toEqual([])
  })

  test("returns an empty presentation for malformed JSON", () => {
    expect(formatPedidoItemSecciones(undefined)).toEqual([])
    expect(formatPedidoItemSecciones("{not-json")).toEqual([])
  })
})
