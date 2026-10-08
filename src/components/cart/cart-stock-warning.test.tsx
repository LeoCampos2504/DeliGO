// ============================================
// P2-T56-R3A-I4 — aviso de carrito desactualizado (render)
// ============================================
// Render real de CartStockWarning: identifica cada producto afectado, explica
// qué corregir y nunca muestra cantidades exactas de stock.
import { describe, expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { createElement } from "react"
import { CartStockWarning } from "./cart-panel"

describe("CartStockWarning", () => {
  test("sin problemas → no renderiza nada", () => {
    expect(renderToStaticMarkup(createElement(CartStockWarning, { issues: [] }))).toBe("")
  })

  test("identifica cada producto y la acción, como alerta accesible y sin números", () => {
    const html = renderToStaticMarkup(
      createElement(CartStockWarning, {
        issues: [
          { tipo: "SIN_STOCK", productoId: "p1", varianteId: null, nombre: "Gaseosa", itemKeys: ["a"] },
          { tipo: "EXCEDE_DISPONIBLE", productoId: "p2", varianteId: "v", nombre: "Remera — XL", itemKeys: ["b", "c"] },
        ],
      })
    )
    expect(html).toContain('role="alert"')
    expect(html).toContain("Tu carrito necesita cambios")
    expect(html).toContain("Gaseosa")
    expect(html).toContain("sin stock: quitalo del carrito")
    expect(html).toContain("Remera — XL")
    expect(html).toContain("no hay suficientes unidades: reducí la cantidad")
    expect(html.replace(/<[^>]+>/g, "")).not.toMatch(/\d/)
  })
})
