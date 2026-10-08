// ============================================
// P2-T56-R3A-I4 — disponibilidad pública en el carrito (lib pura)
// ============================================
import { describe, expect, test } from "bun:test"
import {
  buildCatalogAvailability,
  cantidadEnCarrito,
  cartStockKey,
  nombresDeLineasRechazadas,
  puedeAgregarAlCarrito,
  STOCK_LIMIT_MESSAGE,
  unidadesAgregables,
  validarCarritoDisponibilidad,
  type CartStockLine,
} from "./cart-stock-availability"

const negocio = {
  rubro: "negocio",
  productos: [
    { id: "p-base", tieneVariantes: false, stockDisponible: 3, variantes: [] },
    { id: "p-libre", tieneVariantes: false, stockDisponible: null, variantes: [] },
    {
      id: "p-remera",
      tieneVariantes: true,
      stockDisponible: null,
      variantes: [
        { id: "v-a", stockDisponible: 2 },
        { id: "v-libre", stockDisponible: null },
      ],
    },
  ],
}

function cartLine(overrides: Partial<CartStockLine> & { key: string }): CartStockLine {
  return { productoId: "p-base", varianteId: null, cantidad: 1, nombre: "Gaseosa", varianteNombre: null, ...overrides }
}

describe("buildCatalogAvailability", () => {
  test("rubro fuera de R3A (restaurante/ropa) o sin catálogo → null (sin límites)", () => {
    expect(buildCatalogAvailability({ ...negocio, rubro: "restaurante" })).toBeNull()
    expect(buildCatalogAvailability({ ...negocio, rubro: "ropa" })).toBeNull()
    expect(buildCatalogAvailability(null)).toBeNull()
    expect(buildCatalogAvailability({ rubro: "negocio", productos: null })).toBeNull()
  })

  test("negocio genérico: una entrada por clave de stock (producto base o variante; nunca el padre con variantes)", () => {
    const av = buildCatalogAvailability(negocio)!
    expect([...av.entries()]).toEqual([
      [cartStockKey("p-base", null), 3],
      [cartStockKey("p-libre", null), null],
      [cartStockKey("p-remera", "v-a"), 2],
      [cartStockKey("p-remera", "v-libre"), null],
    ])
    expect(av.has(cartStockKey("p-remera", null))).toBe(false)
  })
})

describe("límite al agregar / sumar", () => {
  const av = buildCatalogAvailability(negocio)

  test("suma todas las líneas del carrito de la misma clave (distintos agregados = mismo stock)", () => {
    const items = [cartLine({ key: "a", cantidad: 1 }), cartLine({ key: "b", cantidad: 1 })]
    expect(cantidadEnCarrito(items, "p-base", null)).toBe(2)
    expect(unidadesAgregables(av, items, "p-base", null)).toBe(1)
    expect(puedeAgregarAlCarrito(av, items, { productoId: "p-base", cantidad: 1 })).toBe(true)
    expect(puedeAgregarAlCarrito(av, items, { productoId: "p-base", cantidad: 2 })).toBe(false)
  })

  test("variante: límite propio; otras variantes no se mezclan", () => {
    const items = [cartLine({ key: "a", productoId: "p-remera", varianteId: "v-a", cantidad: 2 })]
    expect(puedeAgregarAlCarrito(av, items, { productoId: "p-remera", varianteId: "v-a", cantidad: 1 })).toBe(false)
    expect(puedeAgregarAlCarrito(av, items, { productoId: "p-remera", varianteId: "v-libre", cantidad: 50 })).toBe(true)
  })

  test("sin límite (null) y rubro fuera de alcance → siempre se puede", () => {
    expect(unidadesAgregables(av, [], "p-libre", null)).toBeNull()
    expect(puedeAgregarAlCarrito(null, [], { productoId: "p-base", cantidad: 999 })).toBe(true)
  })

  test("clave que el catálogo ya no publica (agotada/oculta) → 0 agregables", () => {
    expect(unidadesAgregables(av, [], "p-oculto", null)).toBe(0)
    expect(unidadesAgregables(av, [], "p-remera", null)).toBe(0)
    expect(puedeAgregarAlCarrito(av, [], { productoId: "p-oculto", cantidad: 1 })).toBe(false)
  })

  test("mensaje simple, sin cantidades", () => {
    expect(STOCK_LIMIT_MESSAGE).toBe("No hay suficientes unidades disponibles")
    expect(STOCK_LIMIT_MESSAGE).not.toMatch(/\d/)
  })
})

describe("validarCarritoDisponibilidad (carrito desactualizado)", () => {
  test("carrito válido → sin problemas", () => {
    const av = buildCatalogAvailability(negocio)
    expect(validarCarritoDisponibilidad([cartLine({ key: "a", cantidad: 3 })], av)).toEqual([])
  })

  test("exceso agregado por clave → EXCEDE_DISPONIBLE con todas las líneas involucradas", () => {
    const av = buildCatalogAvailability(negocio)
    const items = [cartLine({ key: "a", cantidad: 2 }), cartLine({ key: "b", cantidad: 2 }), cartLine({ key: "c", productoId: "p-libre", nombre: "Pan", cantidad: 40 })]
    expect(validarCarritoDisponibilidad(items, av)).toEqual([
      { tipo: "EXCEDE_DISPONIBLE", productoId: "p-base", varianteId: null, nombre: "Gaseosa", itemKeys: ["a", "b"] },
    ])
  })

  test("producto/variante que ya no se publica → SIN_STOCK, identificado por nombre y variante", () => {
    const av = buildCatalogAvailability({ ...negocio, productos: negocio.productos.filter((p) => p.id !== "p-base") })
    const items = [
      cartLine({ key: "a" }),
      cartLine({ key: "b", productoId: "p-remera", varianteId: "v-vieja", nombre: "Remera", varianteNombre: "XL" }),
    ]
    expect(validarCarritoDisponibilidad(items, av)).toEqual([
      { tipo: "SIN_STOCK", productoId: "p-base", varianteId: null, nombre: "Gaseosa", itemKeys: ["a"] },
      { tipo: "SIN_STOCK", productoId: "p-remera", varianteId: "v-vieja", nombre: "Remera — XL", itemKeys: ["b"] },
    ])
  })

  test("nunca modifica el carrito recibido", () => {
    const av = buildCatalogAvailability(negocio)
    const items = [cartLine({ key: "a", cantidad: 9 })]
    const before = structuredClone(items)
    validarCarritoDisponibilidad(items, av)
    expect(items).toEqual(before)
  })

  test("rubro fuera de alcance → sin problemas", () => {
    expect(validarCarritoDisponibilidad([cartLine({ key: "a", cantidad: 99 })], null)).toEqual([])
  })
})

describe("nombresDeLineasRechazadas (409 del servidor)", () => {
  test("resuelve details.lineas contra el carrito, sin duplicados", () => {
    const items = [
      cartLine({ key: "a" }),
      cartLine({ key: "b" }),
      cartLine({ key: "c", productoId: "p-remera", varianteId: "v-a", nombre: "Remera", varianteNombre: "M" }),
    ]
    expect(
      nombresDeLineasRechazadas(items, [
        { productoId: "p-base", productoVarianteId: null },
        { productoId: "p-remera", productoVarianteId: "v-a" },
        { productoId: "p-otro", productoVarianteId: null },
        { productoId: null },
      ])
    ).toEqual(["Gaseosa", "Remera — M"])
    expect(nombresDeLineasRechazadas(items, undefined)).toEqual([])
  })
})
