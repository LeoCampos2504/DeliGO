import { describe, expect, test } from "bun:test"
import {
  addCartLine,
  cartItemCount,
  cartLineSubtotal,
  cartTotal,
  computeSaleFromAuthoritativeProducts,
  isValidMetodoPagoVenta,
  removeCartLine,
  setCartLineQuantity,
  type CartLine,
} from "./caja-venta"

const cocaCola: CartLine = { productoId: "p1", nombre: "Coca Cola 2.25L", precio: 3500, cantidad: 2 }
const cuaderno: CartLine = { productoId: "p2", nombre: "Cuaderno A4", precio: 1200, cantidad: 1 }

describe("cart math", () => {
  test("line subtotal and cart total", () => {
    expect(cartLineSubtotal(cocaCola)).toBe(7000)
    expect(cartTotal([cocaCola, cuaderno])).toBe(8200)
  })

  test("cart item count sums quantities, not line count", () => {
    expect(cartItemCount([cocaCola, cuaderno])).toBe(3)
  })

  test("rounds to cents", () => {
    expect(cartLineSubtotal({ precio: 10.005, cantidad: 3 })).toBe(30.02)
  })
})

describe("addCartLine", () => {
  test("adds a new product as its own line", () => {
    const result = addCartLine([], cocaCola)
    expect(result).toEqual([cocaCola])
  })

  test("merges quantity into an existing line for the same product", () => {
    const result = addCartLine([cocaCola], { ...cocaCola, cantidad: 1 })
    expect(result).toEqual([{ ...cocaCola, cantidad: 3 }])
  })
})

describe("setCartLineQuantity / removeCartLine", () => {
  test("sets an exact quantity", () => {
    const result = setCartLineQuantity([cocaCola], "p1", 5)
    expect(result[0].cantidad).toBe(5)
  })

  test("a quantity of 0 or less removes the line", () => {
    expect(setCartLineQuantity([cocaCola, cuaderno], "p1", 0)).toEqual([cuaderno])
    expect(setCartLineQuantity([cocaCola, cuaderno], "p1", -3)).toEqual([cuaderno])
  })

  test("removeCartLine drops only the targeted product", () => {
    expect(removeCartLine([cocaCola, cuaderno], "p1")).toEqual([cuaderno])
  })
})

describe("isValidMetodoPagoVenta", () => {
  test("accepts the three MVP methods and rejects anything else", () => {
    expect(isValidMetodoPagoVenta("EFECTIVO")).toBe(true)
    expect(isValidMetodoPagoVenta("TRANSFERENCIA")).toBe(true)
    expect(isValidMetodoPagoVenta("OTRO")).toBe(true)
    expect(isValidMetodoPagoVenta("MERCADOPAGO")).toBe(false)
    expect(isValidMetodoPagoVenta("efectivo")).toBe(false)
  })
})

describe("computeSaleFromAuthoritativeProducts (server-side total authority)", () => {
  const products = new Map([
    ["p1", { nombre: "Coca Cola 2.25L", precio: 3500 }],
    ["p2", { nombre: "Cuaderno A4", precio: 1200 }],
  ])

  test("recomputes every line and the total from the authoritative map, ignoring any client price", () => {
    const result = computeSaleFromAuthoritativeProducts(
      [{ productoId: "p1", cantidad: 2 }, { productoId: "p2", cantidad: 1 }],
      products,
    )
    expect(result).toEqual({
      ok: true,
      items: [
        { productoId: "p1", nombre: "Coca Cola 2.25L", precio: 3500, cantidad: 2, subtotal: 7000 },
        { productoId: "p2", nombre: "Cuaderno A4", precio: 1200, cantidad: 1, subtotal: 1200 },
      ],
      total: 8200,
      cantidadItems: 2,
    })
  })

  test("rejects an empty sale", () => {
    expect(computeSaleFromAuthoritativeProducts([], products).ok).toBe(false)
  })

  test("rejects a non-positive quantity", () => {
    expect(computeSaleFromAuthoritativeProducts([{ productoId: "p1", cantidad: 0 }], products).ok).toBe(false)
    expect(computeSaleFromAuthoritativeProducts([{ productoId: "p1", cantidad: -1 }], products).ok).toBe(false)
  })

  test("rejects a product missing from the authoritative map (deleted/inactive/foreign tenant)", () => {
    const result = computeSaleFromAuthoritativeProducts([{ productoId: "unknown", cantidad: 1 }], products)
    expect(result.ok).toBe(false)
  })
})
