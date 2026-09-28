import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

// P2-T56-R2A — no DOM/jsdom environment exists in this repo (same
// constraint documented in delivery-navigation-static-contract.test.ts and
// deliveries-tab.test.tsx), so the responsive/quantity-semantics contract is
// expressed as source-level assertions rather than a mounted render — same
// established convention, not a fragile pixel-dependent test.
const SOURCE = readFileSync(resolve(import.meta.dir, "caja-tab.tsx"), "utf8")

describe("P2-T56-R2A — Caja checkout responsive contract (finding A)", () => {
  test("checkout/success/detail dialogs bound their width at the SAME responsive slot the shared DialogContent uses, not just an unscoped override", () => {
    // The shared DialogContent ships its own unscoped max-w AND a
    // `sm:max-w-lg` — tailwind-merge only overrides a slot that's actually
    // present in the override string. An unscoped-only override (the R1 bug)
    // leaves `sm:max-w-lg` in effect on any viewport >= 640px.
    expect(SOURCE).toContain("sm:max-w-sm")
  })

  test("desktop cart column is a compact fixed width, not a wide fraction of the viewport", () => {
    expect(SOURCE).toContain("lg:grid-cols-[1fr_440px]")
    expect(SOURCE).not.toContain("lg:grid-cols-[1fr_360px]")
  })

  test("the mobile cart sheet's body is padded and width-capped, not edge-to-edge", () => {
    expect(SOURCE).toContain("mx-auto w-full max-w-md px-4")
  })
})

describe("P2-T56-R2A — sale quantity semantics (findings B, sections 7/10/11)", () => {
  test("the success screen and sale history use the real unit-count helper, never the raw line-count field alone", () => {
    expect(SOURCE).toContain("totalUnidadesVenta(venta.items)")
    expect(SOURCE).toContain("formatUnidadesVenta(unidades)")
    // The old, misleading "N producto(s)" wording driven straight off
    // cantidadItems must be gone from both the success screen and the
    // recent-sales list.
    expect(SOURCE).not.toContain('{venta.cantidadItems} producto')
    expect(SOURCE).not.toContain('{v.cantidadItems} producto')
  })

  test("sale detail renders each line from its own VentaItem snapshot fields, never a live Producto lookup", () => {
    expect(SOURCE).toContain("venta.items.map((item) =>")
    expect(SOURCE).toContain("item.nombre")
    expect(SOURCE).toContain("item.cantidad")
    expect(SOURCE).toContain("item.precio")
    expect(SOURCE).toContain("item.subtotal")
    expect(SOURCE).not.toContain("db.producto.findUnique")
  })

  test("recent sales are tap-to-expand, not all rendered open at once", () => {
    expect(SOURCE).toContain("setDetailSale(v)")
    expect(SOURCE).toContain("VentaDetailDialog")
  })
})
