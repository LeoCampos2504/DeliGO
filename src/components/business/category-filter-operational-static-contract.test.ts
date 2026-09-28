// P2-T56-R2B-F1 — categories as OPERATIONAL FILTERS in Inventario/Caja, not
// just a product field. No DOM/jsdom environment exists in this repo (same
// constraint as every other *-static-contract.test.ts here), so this is
// expressed as source-level assertions.
import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const INVENTARIO = readFileSync(resolve(import.meta.dir, "inventario-tab.tsx"), "utf8")
const CAJA = readFileSync(resolve(import.meta.dir, "caja-tab.tsx"), "utf8")

describe("P2-T56-R2B-F1 — category comparison uses the normalized authority, not a fragile exact match", () => {
  test("Inventario filters with matchesCategoryFilter, never a raw !== comparison", () => {
    expect(INVENTARIO).toContain("!matchesCategoryFilter(p.categoria, effectiveCategoria)")
    expect(INVENTARIO).not.toContain("p.categoria !== categoria")
  })

  test("Caja filters with matchesCategoryFilter, never a raw !== comparison", () => {
    expect(CAJA).toContain("!matchesCategoryFilter(p.categoria, effectiveCategoria)")
    expect(CAJA).not.toContain("p.categoria !== categoria")
  })

  test("both import matchesCategoryFilter and SIN_CATEGORIA from the shared authority", () => {
    for (const source of [INVENTARIO, CAJA]) {
      expect(source).toContain('import { matchesCategoryFilter, mergeManagedCategories, SIN_CATEGORIA } from "@/lib/category-normalization"')
    }
  })
})

describe("P2-T56-R2B-F1 — 'Sin categoría' is a real, selectable filter (section 7)", () => {
  test("Inventario computes whether any product is uncategorized and offers a pill for it", () => {
    expect(INVENTARIO).toContain("const hasSinCategoria = useMemo(")
    expect(INVENTARIO).toContain('label="Sin categoría"')
    expect(INVENTARIO).toContain("onClick={() => setCategoria(SIN_CATEGORIA)}")
  })

  test("Caja computes whether any product is uncategorized and offers a pill for it", () => {
    expect(CAJA).toContain("const hasSinCategoria = useMemo(")
    expect(CAJA).toContain("Sin categoría")
    expect(CAJA).toContain("onClick={() => setCategoria(SIN_CATEGORIA)}")
  })

  test("the pill row's visibility threshold counts the Sin categoría pill as a real option", () => {
    expect(INVENTARIO).toContain("categorias.length + (hasSinCategoria ? 1 : 0) > 1")
    expect(CAJA).toContain("categorias.length + (hasSinCategoria ? 1 : 0) > 1")
  })
})

describe("P2-T56-R2B-F1 — a stale filter selection is reconciled, never left silently broken (section 11)", () => {
  test("Inventario derives an effectiveCategoria fallback during render, never a setState-in-effect", () => {
    expect(INVENTARIO).toContain("const effectiveCategoria = useMemo(() => {")
    expect(INVENTARIO).toContain("return stillValid ? categoria : \"todas\"")
    expect(INVENTARIO).not.toMatch(/useEffect\(\(\) => \{[\s\S]{0,120}setCategoria/)
  })

  test("Caja derives an effectiveCategoria fallback during render, never a setState-in-effect", () => {
    expect(CAJA).toContain("const effectiveCategoria = useMemo(() => {")
    expect(CAJA).toContain("return stillValid ? categoria : \"todas\"")
    expect(CAJA).not.toMatch(/useEffect\(\(\) => \{[\s\S]{0,120}setCategoria/)
  })

  test("filtering, pill highlighting and the empty-state check all read the reconciled effectiveCategoria, not the raw (possibly stale) categoria", () => {
    for (const source of [INVENTARIO, CAJA]) {
      expect(source).toContain("effectiveCategoria !== \"todas\" && !matchesCategoryFilter(p.categoria, effectiveCategoria)")
    }
    expect(INVENTARIO).toContain("active={effectiveCategoria === \"todas\"}")
    expect(CAJA).toContain("effectiveCategoria === \"todas\" ? \"bg-primary text-primary-foreground\"")
  })
})

describe("P2-T56-R2B-F1 — search and category filters accumulate, neither resets the other (sections 5/9)", () => {
  test("Inventario's search state and category state are independent useState hooks with no cross-reset", () => {
    expect(INVENTARIO).toContain('const [search, setSearch] = useState("")')
    expect(INVENTARIO).toContain('const [categoria, setCategoria] = useState<string>("todas")')
    expect(INVENTARIO).not.toContain("setSearch(\"\")")
  })

  test("Caja's search state and category state are independent useState hooks with no cross-reset", () => {
    expect(CAJA).toContain('const [search, setSearch] = useState("")')
    expect(CAJA).toContain('const [categoria, setCategoria] = useState("todas")')
  })
})

describe("P2-T56-R2B-F1 — category-aware empty state (section 14)", () => {
  test("Inventario distinguishes an empty managed category from a no-search-match", () => {
    expect(INVENTARIO).toContain('title="No hay productos en esta categoría"')
    expect(INVENTARIO).toContain("effectiveCategoria !== \"todas\" && !search.trim()")
  })

  test("Caja distinguishes an empty managed category from a no-search-match", () => {
    expect(CAJA).toContain("No hay productos en esta categoría")
    expect(CAJA).toContain("effectiveCategoria !== \"todas\" && !search.trim()")
  })
})

describe("P2-T56-R2B-F1 — changing Caja's category filter never touches the cart (section 8)", () => {
  test("cart state is declared once and never reset/cleared from the category filter code path", () => {
    expect(CAJA).toContain("const [cart, setCart] = useState<CartLine[]>([])")
    // The only setCart calls must be cart mutations (add/update/remove/clear-on-sale),
    // never something reacting to a category change.
    const setCartCalls = CAJA.match(/setCart\(/g) ?? []
    expect(setCartCalls.length).toBeGreaterThan(0)
    expect(CAJA).not.toMatch(/setCategoria\([^)]*\)[\s\S]{0,80}setCart\(/)
  })
})
