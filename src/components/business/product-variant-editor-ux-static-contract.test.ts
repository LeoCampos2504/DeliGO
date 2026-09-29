// P2-T56-R2C-F1 — operator-reported UX findings in the product/variant
// editor (base fields ambiguity, unlabeled stock inputs, tall variant
// forms). No DOM/jsdom environment exists in this repo (same constraint as
// every other *-static-contract.test.ts here), so this is expressed as
// source-level assertions.
import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const INVENTARIO = readFileSync(resolve(import.meta.dir, "inventario-tab.tsx"), "utf8")

describe("P2-T56-R2C-F1 — Finding A: base commercial fields hidden once variants are active (sections 1-5)", () => {
  test("a product WITHOUT variants still shows its own precio field, unchanged", () => {
    expect(INVENTARIO).toContain('{!productoHasVariantes && !hasVariantes && (\n            <div className="space-y-1.5">\n              <Label htmlFor="inv-precio">Precio de venta *</Label>')
  })

  test("activating variants hides the base precio field — it's the same gate for create (hasVariantes) and edit (productoHasVariantes)", () => {
    expect(INVENTARIO).toContain('!productoHasVariantes && !hasVariantes && (\n            <div className="space-y-1.5">\n              <Label htmlFor="inv-precio">')
  })

  test("base SKU/código de barras are hidden once variants are active — each variant has its own", () => {
    expect(INVENTARIO).toMatch(/!productoHasVariantes && !hasVariantes && \(\s*<div className="grid grid-cols-2 gap-2">\s*<div className="space-y-1\.5">\s*<Label htmlFor="inv-sku">/)
  })

  test("base costo is hidden once variants are active, but marca (a general descriptive field) always stays visible", () => {
    expect(INVENTARIO).toContain('{!productoHasVariantes && !hasVariantes && (\n                  <div className="space-y-1.5">\n                    <Label htmlFor="inv-costo">Costo</Label>')
    expect(INVENTARIO).toContain('<Label htmlFor="inv-marca">Marca</Label>')
    expect(INVENTARIO).not.toMatch(/hasVariantes[\s\S]{0,40}<Label htmlFor="inv-marca">/)
  })

  test("base 'Controlar stock' switch + stock fields stay hidden once variants are active (unchanged from R2C)", () => {
    expect(INVENTARIO).toContain("{!productoHasVariantes && !hasVariantes && (\n                <>\n                  <div className=\"flex items-center justify-between rounded-lg bg-background px-3 py-2\">")
  })

  test("editing a product that already has variants shows an explanatory note instead of the dormant fields", () => {
    expect(INVENTARIO).toContain("Este producto usa variantes. El precio, costo y stock se gestionan por variante")
  })

  test("a variant still requires its own nombre+precio — validation authority is unchanged", () => {
    expect(INVENTARIO).toContain("validateVarianteMinimo({ nombre: row.nombre, precio: rowPrecio })")
  })
})

describe("P2-T56-R2C-F1 — Finding B: variant stock inputs have real labels, not just placeholders (sections 7-9)", () => {
  test("the expanded draft row's stock inputs are labeled 'Stock inicial' / 'Stock mínimo', not bare placeholders", () => {
    expect(INVENTARIO).toMatch(/Stock inicial<\/Label>\s*<Input type="number"[^>]*value=\{row\.stockCantidad\}/)
    expect(INVENTARIO).toMatch(/Stock mínimo<\/Label>\s*<Input type="number"[^>]*value=\{row\.stockMinimo\}/)
  })

  test("stock inputs only render when controlStock is on — no unlabeled zeros shown by default", () => {
    expect(INVENTARIO).toContain("{row.controlStock && (\n            <div className=\"grid grid-cols-2 gap-2\">")
  })

  test("editing an existing variant shows a read-only 'Stock actual' reference, directing to Ajustar stock rather than a raw editable field", () => {
    expect(INVENTARIO).toContain("Stock actual")
    expect(INVENTARIO).toContain('usá "Ajustar stock" para cambiarlo')
    expect(INVENTARIO).toContain("{isEdit && controlStock && (")
  })
})

describe("P2-T56-R2C-F1 — Finding C: variant rows are collapsible (sections 10-16)", () => {
  test("VarianteDraftRow tracks expansion per-row, not as one shared/global toggle", () => {
    expect(INVENTARIO).toContain("expanded: boolean")
  })

  test("a new row (from the toggle or '+ Agregar variante') starts expanded", () => {
    expect(INVENTARIO).toContain("expanded: true,\n  }\n}")
  })

  test("collapsed summary shows name, price, and a stock/costo hint — never blank", () => {
    expect(INVENTARIO).toContain('row.nombre.trim() || "Variante sin nombre"')
    expect(INVENTARIO).toContain('summaryBits.push(`Stock ${row.stockCantidad || 0}`)')
    expect(INVENTARIO).toContain('summaryBits.push("Sin control de stock")')
  })

  test("collapsing/expanding a row only patches its `expanded` flag — never resets its other field values", () => {
    expect(INVENTARIO).toContain("onClick={() => onChange({ expanded: true })}")
    expect(INVENTARIO).toContain('onClick={() => onChange({ expanded: false })}')
  })

  test("an invalid variant is force-expanded on save, never left collapsed hiding the error", () => {
    expect(INVENTARIO).toContain("const invalidKeys: string[] = []")
    expect(INVENTARIO).toContain("invalidKeys.includes(r.key) ? { ...r, expanded: true } : r")
    expect(INVENTARIO).toContain('throw new Error(firstError ?? "Revisá las variantes")')
  })

  test("removing a draft row still works from the expanded editor (unchanged mechanism)", () => {
    expect(INVENTARIO).toContain("onClick={onRemove}")
  })
})

describe("P2-T56-R2C-F1 — existing product detail keeps its already-compact variant list untouched (section 17)", () => {
  test("ProductoDetailDialog's variant rows remain a single compact summary line, not the new expand/collapse mechanism", () => {
    expect(INVENTARIO).toContain('{formatPrice(v.precio)}')
    expect(INVENTARIO).not.toContain("v.expanded")
  })
})
