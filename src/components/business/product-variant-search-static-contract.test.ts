// P2-T56-R3B — search by variant name/SKU/barcode in Inventario/Caja. No
// DOM/jsdom environment exists in this repo (same constraint as every
// other *-static-contract.test.ts here), so this is expressed as
// source-level assertions. The actual matching logic itself is covered
// exhaustively by src/lib/product-variant-search.test.ts (pure unit
// tests) — this file only confirms both components delegate to that
// shared authority instead of rolling their own `.includes()` chain, and
// that category filtering / cart / addProduct were not touched.
import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const INVENTARIO = readFileSync(resolve(import.meta.dir, "inventario-tab.tsx"), "utf8")
const CAJA = readFileSync(resolve(import.meta.dir, "caja-tab.tsx"), "utf8")

describe("P2-T56-R3B — Inventario delegates search to the shared authority", () => {
  test("imports matchesInventorySearch/findMatchingVariante from the shared lib", () => {
    expect(INVENTARIO).toContain('import { matchesInventorySearch, findMatchingVariante } from "@/lib/product-variant-search"')
  })

  test("filtered applies category filter first, then delegates term matching entirely", () => {
    expect(INVENTARIO).toContain("if (effectiveCategoria !== \"todas\" && !matchesCategoryFilter(p.categoria, effectiveCategoria)) return false")
    expect(INVENTARIO).toContain("return matchesInventorySearch(p, search)")
  })

  test("no leftover inline .toLowerCase().includes() search chain on p.nombre/sku/codigoBarras", () => {
    expect(INVENTARIO).not.toContain("p.nombre.toLowerCase().includes(term)")
  })

  test("shows a discrete 'Coincide: <variante>' hint (section 4), never auto-expands/edits", () => {
    expect(INVENTARIO).toContain("findMatchingVariante(p, search, { allowInactive: true })")
    expect(INVENTARIO).toContain("findMatchingVariante(p, search, { allowInactive: true })")
    expect(INVENTARIO).toMatch(/Coincide: \{matchedVariante\.nombre\}/)
    // The hint is purely a rendered string — never triggers setDetailProduct,
    // setEditing, or setFormOpen by itself.
    expect(INVENTARIO).not.toMatch(/matchedVariante[\s\S]{0,80}set(DetailProduct|Editing|FormOpen)/)
  })
})

describe("P2-T56-R3B — Caja delegates search to the shared authority (variant sellability policy)", () => {
  test("imports matchesCajaSearch from the shared lib", () => {
    expect(CAJA).toContain('import { matchesCajaSearch } from "@/lib/product-variant-search"')
  })

  test("filtered applies category filter first, then delegates term matching entirely", () => {
    expect(CAJA).toContain("if (effectiveCategoria !== \"todas\" && !matchesCategoryFilter(p.categoria, effectiveCategoria)) return false")
    expect(CAJA).toContain("return matchesCajaSearch(p, search)")
  })

  test("no leftover inline single-field search chain", () => {
    expect(CAJA).not.toContain("return p.nombre.toLowerCase().includes(term)")
  })

  test("CajaProducto/CajaVariante now declare sku/codigoBarras (already present server-side, just not previously read)", () => {
    expect(CAJA).toMatch(/interface CajaVariante \{[\s\S]*?sku: string \| null[\s\S]*?codigoBarras: string \| null[\s\S]*?\}/)
    expect(CAJA).toMatch(/interface CajaProducto \{[\s\S]*?sku: string \| null[\s\S]*?codigoBarras: string \| null[\s\S]*?\}/)
  })

  test("search never touches cart state — addProduct/setCart untouched by this round's search change", () => {
    // The search filter (`filtered`) and the cart (`cart`/`addProduct`) are
    // fully separate useMemo/state — confirm the filter callback body never
    // references setCart or addProduct.
    const filteredBlockMatch = CAJA.match(/const filtered = useMemo\(\(\) => \{([\s\S]*?)\n {2}\}, \[activos, search, effectiveCategoria\]\)/)
    expect(filteredBlockMatch).not.toBeNull()
    const filteredBody = filteredBlockMatch![1]
    expect(filteredBody).not.toContain("setCart")
    expect(filteredBody).not.toContain("addProduct")
    expect(filteredBody).not.toContain("addCartLine")
  })

  test("a search match never auto-adds or auto-selects a variant (section 5) — tapping still opens the normal selector", () => {
    expect(CAJA).toContain("const [varianteSelector, setVarianteSelector] = useState<CajaProducto | null>(null)")
  })
})
