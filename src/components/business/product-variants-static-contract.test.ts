// P2-T56-R2C — product variants UI wiring in Inventario/Caja. No DOM/jsdom
// environment exists in this repo (same constraint as every other
// *-static-contract.test.ts here), so this is expressed as source-level
// assertions.
import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const INVENTARIO = readFileSync(resolve(import.meta.dir, "inventario-tab.tsx"), "utf8")
const CAJA = readFileSync(resolve(import.meta.dir, "caja-tab.tsx"), "utf8")

describe("P2-T56-R2C — Inventario: a product with variants collapses into ONE row (section 15)", () => {
  test("both the desktop table and mobile card branch on p.variantes.length before rendering per-variant summaries", () => {
    expect(INVENTARIO).toContain("if (p.variantes.length > 0) {")
    expect(INVENTARIO).toContain("if (producto.variantes.length > 0) {")
  })

  test("the collapsed row uses summarizeVariantes for price-from/stock-total/low-stock, never a raw product price", () => {
    expect(INVENTARIO).toContain("const resumen = summarizeVariantes(p.variantes)")
    expect(INVENTARIO).toContain("const resumen = summarizeVariantes(producto.variantes)")
  })

  test("a single depleted variant never marks the whole product as agotado — todasSinStock gates that badge, not variantesConStockBajo alone", () => {
    expect(INVENTARIO).toContain("resumen.todasSinStock")
  })
})

describe("P2-T56-R2C — Inventario: variant management lives in the product's own detail (section 13)", () => {
  test("ProductoDetailDialog renders a variant list with rename/edit and a soft-deactivate control, never a hard delete", () => {
    expect(INVENTARIO).toContain('setVarianteForm({ mode: "edit", variante: v })')
    expect(INVENTARIO).toContain("toggleVarianteActivoMutation.mutate(v)")
    expect(INVENTARIO).toContain("activo: !variante.activo")
  })

  test("base precio/costo/stock info is hidden once the product has variants — it's dormant, not double-shown", () => {
    expect(INVENTARIO).toContain("{!hasVariantes && <InfoRow label=\"Precio\"")
  })

  test("AjusteStockDialog accepts an optional variante and sends productoVarianteId, targeting ONE variant's stock, never a fictitious total (section 25)", () => {
    expect(INVENTARIO).toContain("variante?: InventarioVariante")
    expect(INVENTARIO).toContain("productoVarianteId: variante?.id")
  })

  test("the base product's own 'Ajustar stock' button is hidden once it has variants", () => {
    expect(INVENTARIO).toContain("{!hasVariantes && producto.controlStock && (")
  })
})

describe("P2-T56-R2C — Inventario: creating a product with variants (sections 11/12)", () => {
  test("the 'tiene variantes' toggle only appears for a brand-new product, never when editing an existing one", () => {
    expect(INVENTARIO).toContain("Este producto tiene variantes")
    expect(INVENTARIO).toContain("<Switch checked={hasVariantes} onCheckedChange={toggleHasVariantes} />")
  })

  test("each draft variant row is validated with validateVarianteMinimo before being sent, never trusted as-is", () => {
    expect(INVENTARIO).toContain("const rowValidation = validateVarianteMinimo({ nombre: row.nombre, precio: rowPrecio })")
  })

  test("the base product's own stock/controlStock section is hidden while creating with variants", () => {
    expect(INVENTARIO).toContain("{!productoHasVariantes && !hasVariantes && (")
  })
})

describe("P2-T56-R2C — Caja: variant selection never auto-picks an arbitrary variant (sections 19/20)", () => {
  test("a product with zero variants keeps the exact one-tap add it always had", () => {
    expect(CAJA).toContain("if (p.variantes.length === 0) {\n      addProduct(p)")
  })

  test("more than one active variant opens a selector — it never silently adds one for you", () => {
    expect(CAJA).toContain("setVarianteSelector(p)")
  })

  test("exactly one active AND sellable variant adds directly, same one-tap feel — no forced selector for an unambiguous case", () => {
    expect(CAJA).toContain("if (activas.length === 1) {\n      addVariante(p, activas[0])")
  })

  test("VarianteSelectorDialog shows every active variant, disabling (not hiding) any that's out of stock", () => {
    expect(CAJA).toContain("function VarianteSelectorDialog(")
    expect(CAJA).toContain('{!sellable && <span className="text-[10px] font-semibold text-red-600">Sin stock</span>}')
    expect(CAJA).toContain("disabled={!sellable}")
  })

  test("zero active variants shows 'No hay variantes disponibles', never an empty/broken selector", () => {
    expect(CAJA).toContain("No hay variantes disponibles")
  })
})

describe("P2-T56-R2C — Caja: cart line identity and price authority (sections 21/22)", () => {
  test("addVariante builds a cart line keyed by BOTH productoId and varianteId, with the variant's own precio — never the product's", () => {
    expect(CAJA).toContain("varianteId: variante.id,")
    expect(CAJA).toContain("precio: variante.precio,")
  })

  test("the sale POST forwards varianteId per line — server resolves price, client value is never trusted", () => {
    expect(CAJA).toContain("varianteId: l.varianteId ?? undefined")
  })

  test("cart rows are keyed by producto+variante so two variants of the same product never collide in React's list reconciliation", () => {
    expect(CAJA).toContain('key={`${line.productoId}-${line.varianteId ?? \"\"}`}')
  })

  test("quantity/remove controls in the cart pass the line's own varianteId through, never just productoId", () => {
    expect(CAJA).toContain("onUpdateQuantity(line.productoId, line.cantidad - 1, line.varianteId)")
    expect(CAJA).toContain("onRemove(line.productoId, line.varianteId)")
  })

  test("cart and detail views render the variant name alongside the product name, never the variant name alone", () => {
    expect(CAJA).toContain('{line.nombre}{line.varianteNombre ? ` — ${line.varianteNombre}` : ""}')
    expect(CAJA).toContain('{item.nombre}{item.varianteNombre ? ` — ${item.varianteNombre}` : ""}')
  })
})

describe("P2-T56-R2C — Caja: category filtering is unchanged by variants (section 28)", () => {
  test("the product grid still filters by the base product's own categoria — categories are never per-variant", () => {
    expect(CAJA).toContain("!matchesCategoryFilter(p.categoria, effectiveCategoria)")
  })
})
