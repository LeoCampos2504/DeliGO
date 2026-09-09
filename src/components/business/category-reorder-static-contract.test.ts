import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const PRODUCTS_TAB = readFileSync(join(process.cwd(), "src/components/business/products-tab.tsx"), "utf8")
const REORDER_ROUTE = readFileSync(join(process.cwd(), "src/app/api/negocio/categorias/orden/route.ts"), "utf8")
const CATEGORIAS_ROUTE = readFileSync(join(process.cwd(), "src/app/api/negocio/categorias/route.ts"), "utf8")
const PUBLIC_PAGE = readFileSync(join(process.cwd(), "src/app/n/[slug]/page.tsx"), "utf8")
const PUBLIC_API = readFileSync(join(process.cwd(), "src/app/api/negocios/[slug]/route.ts"), "utf8")

describe("CATALOG-CATEGORY-PILL-REORDER-R1 — static contracts", () => {
  test("the admin category list no longer alphabetizes — the removed .sort()/Set-then-sort patterns are gone", () => {
    expect(PRODUCTS_TAB).not.toContain("return Array.from(catSet).sort()")
    expect(PRODUCTS_TAB).not.toContain("[...new Set([...configCategorias, trimmed])].sort()")
    expect(PRODUCTS_TAB).not.toContain("[...new Set([...configCategorias, data.categoria])].sort()")
  })

  test("category creation always appends at the end (configCategorias spread, no re-sort)", () => {
    expect(PRODUCTS_TAB).toContain("const updated = [...configCategorias, trimmed]")
    expect(PRODUCTS_TAB).toContain("const updated = [...configCategorias, data.categoria]")
  })

  test("a dedicated, explicit category order mode exists, separate from product reorder mode", () => {
    expect(PRODUCTS_TAB).toContain("const [categoryOrderMode, setCategoryOrderMode] = useState(false)")
    expect(PRODUCTS_TAB).toContain("const [categoryOrderList, setCategoryOrderList] = useState<string[]>([])")
    expect(PRODUCTS_TAB).toContain("Ordenar categorías")
  })

  test("category reorder mode and product reorder mode are mutually exclusive", () => {
    expect(PRODUCTS_TAB).toContain("disabled={reorderMutation.isPending || categoryOrderMode ||")
    expect(PRODUCTS_TAB).toMatch(/disabled=\{categoryReorderMutation\.isPending \|\| reorderMode \|\|/)
  })

  test("moving a category is a single PATCH with the full array, never a per-item write", () => {
    expect(PRODUCTS_TAB).toContain('fetch("/api/negocio/categorias/orden"')
    expect(PRODUCTS_TAB).toContain('method: "PATCH"')
    expect(PRODUCTS_TAB).toContain("body: JSON.stringify({ categorias })")
  })

  test("error path rolls back to the previous snapshot and refetches", () => {
    expect(PRODUCTS_TAB).toContain("setCategoryOrderList(variables.previousCategorias)")
    expect(PRODUCTS_TAB).toContain('queryClient.invalidateQueries({ queryKey: ["negocio-categorias", negocio.id] })')
  })

  test("CategoryOrderList uses arrows, never drag, for category reordering", () => {
    const componentMatch = PRODUCTS_TAB.match(/function CategoryOrderList\([\s\S]*?\r?\n\}\r?\n/)
    expect(componentMatch).not.toBeNull()
    const component = componentMatch![0]
    expect(component).toContain("ArrowUp")
    expect(component).toContain("ArrowDown")
    expect(component).not.toContain("draggable")
    expect(component).not.toContain("onDragStart")
  })

  test("the reorder endpoint derives the business exclusively from session, never a client-sent negocioId", () => {
    expect(REORDER_ROUTE).toContain('user.type !== "negocio"')
    expect(REORDER_ROUTE).toContain("where: { id: user.id }")
    expect(REORDER_ROUTE).not.toContain("body.negocioId")
    expect(REORDER_ROUTE).not.toContain("negocioId,")
  })

  test("the reorder endpoint requires an exact full-set permutation and rejects duplicates", () => {
    expect(REORDER_ROUTE).toContain("new Set(categorias).size !== categorias.length")
    expect(REORDER_ROUTE).toContain("currentSet.size !== categorias.length || categorias.some((c) => !currentSet.has(c))")
  })

  test("the reorder endpoint writes exactly once, inside a Serializable transaction, and maps conflicts to 409", () => {
    expect(REORDER_ROUTE).toContain("db.$transaction(")
    expect(REORDER_ROUTE).toContain("Prisma.TransactionIsolationLevel.Serializable")
    expect(REORDER_ROUTE).toContain('{ error: "Las categorías cambiaron mientras se ordenaban')
    expect((REORDER_ROUTE.match(/tx\.negocio\.update\(/g) ?? []).length).toBe(1)
  })

  test("create/delete/rename on the base route never silently re-sort the array server-side", () => {
    expect(CATEGORIAS_ROUTE).not.toContain(".sort(")
    // PUT persists exactly what's sent; PATCH rename replaces in place via .map(), preserving position.
    expect(CATEGORIAS_ROUTE).toMatch(/data:\s*\{\s*categorias:\s*JSON\.stringify\(categorias\),\s*\},/)
    expect(CATEGORIAS_ROUTE).toContain("c === oldName ? trimmedNew : c")
  })

  test("public catalog pills use the persisted Negocio.categorias order — no sort, no rebuild from Producto.categoria", () => {
    expect(PUBLIC_PAGE).toContain('return ["Todas", ...negocio.categorias]')
    expect(PUBLIC_PAGE).not.toMatch(/negocio\.categorias[\s\S]{0,80}\.sort\(/)
    expect(PUBLIC_API).toContain("categorias: normalizeStringArray(negocio.categorias)")
  })
})
