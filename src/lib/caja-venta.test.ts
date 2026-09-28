import { describe, expect, test } from "bun:test"
import {
  addCartLine,
  cartItemCount,
  cartLineSubtotal,
  cartTotal,
  computeSaleFromAuthoritativeProducts,
  formatUnidadesVenta,
  isValidMetodoPagoVenta,
  removeCartLine,
  setCartLineQuantity,
  totalUnidadesVenta,
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

// P2-T56-R2C: cart-line identity is producto + variante, never producto alone (section 21)
describe("variant-aware cart line identity", () => {
  const coca500 = { productoId: "p1", varianteId: "v500", nombre: "Coca Cola", varianteNombre: "500 ml", precio: 2000, cantidad: 1 }
  const coca15L = { productoId: "p1", varianteId: "v15l", nombre: "Coca Cola", varianteNombre: "1,5 L", precio: 3200, cantidad: 1 }

  test("two different variants of the SAME product are two distinct lines, never merged", () => {
    const result = addCartLine([coca500], coca15L)
    expect(result).toHaveLength(2)
  })

  test("adding the SAME variant again merges quantity, not a duplicate line", () => {
    const result = addCartLine([coca500], { ...coca500, cantidad: 2 })
    expect(result).toEqual([{ ...coca500, cantidad: 3 }])
  })

  test("a variant line and a non-variant line for the same productoId never merge", () => {
    const plain = { productoId: "p1", nombre: "Coca Cola", precio: 1800, cantidad: 1 }
    const result = addCartLine([coca500], plain)
    expect(result).toHaveLength(2)
  })

  test("setCartLineQuantity targets only the matching variant", () => {
    const result = setCartLineQuantity([coca500, coca15L], "p1", 5, "v500")
    expect(result.find((l) => l.varianteId === "v500")?.cantidad).toBe(5)
    expect(result.find((l) => l.varianteId === "v15l")?.cantidad).toBe(1)
  })

  test("removeCartLine drops only the matching variant, leaves the sibling variant intact", () => {
    const result = removeCartLine([coca500, coca15L], "p1", "v500")
    expect(result).toEqual([coca15L])
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
        { productoId: "p1", varianteId: null, nombre: "Coca Cola 2.25L", varianteNombre: null, precio: 3500, cantidad: 2, subtotal: 7000 },
        { productoId: "p2", varianteId: null, nombre: "Cuaderno A4", varianteNombre: null, precio: 1200, cantidad: 1, subtotal: 1200 },
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

// P2-T56-R2C: variant-aware price authority — the variant's own precio,
// never the client's, and never the parent product's precio (section 22)
describe("computeSaleFromAuthoritativeProducts — variant price authority", () => {
  const productsWithVariantes = new Map([
    [
      "p1",
      {
        nombre: "Coca Cola",
        precio: 1800, // base product price — must NEVER be used once a varianteId is requested
        variantes: new Map([
          ["v500", { nombre: "500 ml", precio: 2000 }],
          ["v15l", { nombre: "1,5 L", precio: 3200 }],
        ]),
      },
    ],
  ])

  test("resolves price and snapshot name from the VARIANT, ignoring Producto.precio", () => {
    const result = computeSaleFromAuthoritativeProducts([{ productoId: "p1", varianteId: "v500", cantidad: 3 }], productsWithVariantes)
    expect(result).toEqual({
      ok: true,
      items: [{ productoId: "p1", varianteId: "v500", nombre: "Coca Cola", varianteNombre: "500 ml", precio: 2000, cantidad: 3, subtotal: 6000 }],
      total: 6000,
      cantidadItems: 1,
    })
  })

  test("two different variants of the same product produce two distinct resolved lines", () => {
    const result = computeSaleFromAuthoritativeProducts(
      [{ productoId: "p1", varianteId: "v500", cantidad: 1 }, { productoId: "p1", varianteId: "v15l", cantidad: 1 }],
      productsWithVariantes,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("unreachable")
    expect(result.items).toHaveLength(2)
    expect(result.total).toBe(5200)
  })

  test("rejects a varianteId that doesn't belong to (or no longer exists on) the product", () => {
    const result = computeSaleFromAuthoritativeProducts([{ productoId: "p1", varianteId: "unknown-variant", cantidad: 1 }], productsWithVariantes)
    expect(result.ok).toBe(false)
  })

  test("a product WITH variantes can still be sold without a varianteId, using its own precio (backward compatibility)", () => {
    const result = computeSaleFromAuthoritativeProducts([{ productoId: "p1", cantidad: 1 }], productsWithVariantes)
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error("unreachable")
    expect(result.items[0]).toEqual({ productoId: "p1", varianteId: null, nombre: "Coca Cola", varianteNombre: null, precio: 1800, cantidad: 1, subtotal: 1800 })
  })
})

// P2-T56-R2A — section 7/10: sale summary must report SUM(cantidad), never
// line count, and must never truncate a fractional quantity.
describe("totalUnidadesVenta / formatUnidadesVenta (section 7/10)", () => {
  test("3 units of a single product is 3 units, not '1 producto'", () => {
    expect(totalUnidadesVenta([{ cantidad: 3 }])).toBe(3)
    expect(formatUnidadesVenta(3)).toBe("3 unidades")
  })

  test("multiple distinct lines sum their quantities, not their line count", () => {
    // 3 Coca-Cola + 2 Cuadernos = 2 distinct lines, 5 total units
    expect(totalUnidadesVenta([{ cantidad: 3 }, { cantidad: 2 }])).toBe(5)
  })

  test("a single unit is singular: '1 unidad'", () => {
    expect(formatUnidadesVenta(1)).toBe("1 unidad")
  })

  test("fractional quantities are not truncated", () => {
    expect(totalUnidadesVenta([{ cantidad: 1.5 }])).toBe(1.5)
    expect(formatUnidadesVenta(1.5)).toBe("1,5 unidades")
  })

  test("an empty sale has zero units", () => {
    expect(totalUnidadesVenta([])).toBe(0)
  })
})
