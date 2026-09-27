import { describe, expect, test } from "bun:test"
import { getTabItems, type PanelTab } from "./business-panel"

function ids(rubro: string) {
  return getTabItems(rubro).map((t) => t.id)
}

describe("P2-T56-R1 — generic-business ('negocio') dashboard tab gating", () => {
  test("negocio gets Caja + Inventario instead of Productos", () => {
    const tabs = ids("negocio")
    expect(tabs).toContain("caja")
    expect(tabs).toContain("inventario")
    expect(tabs).not.toContain("productos")
  })

  test("negocio now also gets Salón (previously hidden, now confirmed compatible)", () => {
    expect(ids("negocio")).toContain("salon")
  })

  test("negocio keeps Pedidos, Ventas, Reseñas, Config unchanged", () => {
    const tabs = ids("negocio")
    const expectedTabs: PanelTab[] = ["dashboard", "ventas", "pedidos", "resenas", "config"]
    for (const expected of expectedTabs) {
      expect(tabs).toContain(expected)
    }
  })
})

describe("restaurante / ropa — no regression from P2-T56-R1", () => {
  test("restaurante keeps Productos and Salón, never gets Caja/Inventario", () => {
    const tabs = ids("restaurante")
    expect(tabs).toContain("productos")
    expect(tabs).toContain("salon")
    expect(tabs).not.toContain("caja")
    expect(tabs).not.toContain("inventario")
  })

  test("ropa keeps Productos (labeled Prendas), never gets Salón/Caja/Inventario", () => {
    const tabs = ids("ropa")
    expect(tabs).toContain("productos")
    expect(tabs).not.toContain("salon")
    expect(tabs).not.toContain("caja")
    expect(tabs).not.toContain("inventario")
    const productosTab = getTabItems("ropa").find((t) => t.id === "productos")
    expect(productosTab?.label).toBe("Prendas")
  })
})
