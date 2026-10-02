// P2-T56-R3A-P0-F1 — regla única de display de la variante de un PedidoItem.
import { describe, expect, test } from "bun:test"
import { getPedidoItemVarianteNombre } from "./pedido-item-variante"

describe("P2-T56-R3A-P0-F1 — getPedidoItemVarianteNombre", () => {
  test("devuelve el snapshot varianteNombre cuando existe", () => {
    expect(getPedidoItemVarianteNombre({ varianteNombre: "600ml" })).toBe("600ml")
  })

  test("recorta espacios del snapshot", () => {
    expect(getPedidoItemVarianteNombre({ varianteNombre: "  Doble carne  " })).toBe("Doble carne")
  })

  test("F1-D: producto simple (null / ausente / vacío / espacios) → null, nunca texto vacío ni 'undefined'", () => {
    expect(getPedidoItemVarianteNombre({ varianteNombre: null })).toBeNull()
    expect(getPedidoItemVarianteNombre({})).toBeNull()
    expect(getPedidoItemVarianteNombre({ varianteNombre: "" })).toBeNull()
    expect(getPedidoItemVarianteNombre({ varianteNombre: "   " })).toBeNull()
  })

  test("tipo inesperado → null (nunca '[object Object]' ni excepción)", () => {
    expect(getPedidoItemVarianteNombre({ varianteNombre: 42 })).toBeNull()
    expect(getPedidoItemVarianteNombre({ varianteNombre: { nombre: "x" } })).toBeNull()
  })

  test("F1-E: no incluye ni repite el nombre del producto — sólo la variante", () => {
    const item = { nombre: "Coca Cola", varianteNombre: "600ml" }
    const variante = getPedidoItemVarianteNombre(item)
    expect(variante).toBe("600ml")
    expect(variante).not.toContain(item.nombre)
  })

  test("F1-F: lee sólo el snapshot del PedidoItem — no necesita ninguna ProductoVariante viva", () => {
    // Sin productoVariante, sin productoVarianteId: el snapshot alcanza.
    expect(getPedidoItemVarianteNombre({ varianteNombre: "Rojo (descontinuado)" })).toBe("Rojo (descontinuado)")
  })
})
