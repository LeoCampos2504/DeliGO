// P2-T56-R2B — no DOM/jsdom environment exists in this repo (same
// constraint documented in delivery-navigation-static-contract.test.ts and
// caja-tab-responsive-static-contract.test.ts), so the "managed categories"
// wiring is expressed as source-level assertions rather than a mounted
// render.
import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const INVENTARIO = readFileSync(resolve(import.meta.dir, "inventario-tab.tsx"), "utf8")
const CAJA = readFileSync(resolve(import.meta.dir, "caja-tab.tsx"), "utf8")
const DIALOG = readFileSync(resolve(import.meta.dir, "administrar-categorias-dialog.tsx"), "utf8")

describe("P2-T56-R2B — Inventario and Caja share ONE managed-category authority", () => {
  test("both fetch Negocio.categorias via the SAME query key (no independent lists)", () => {
    expect(INVENTARIO).toContain('queryKey: ["negocio-categorias", negocio.id]')
    // F10-B1: the owner's Caja query key now lives in ownerCajaSource (same
    // literal key, same endpoint); the selling view reads it from its source.
    expect(CAJA).toContain('categoriasQueryKey: ["negocio-categorias", negocioId],')
    expect(CAJA).toContain('categoriasUrl: "/api/negocio/categorias",')
    expect(CAJA).toContain("queryKey: source.categoriasQueryKey,")
    expect(CAJA).toContain("const source = sourceProp ?? ownerCajaSource(negocioId)")
  })

  test("both derive their filter list via mergeManagedCategories, never an ad-hoc Set", () => {
    expect(INVENTARIO).toContain("mergeManagedCategories(categoriasManaged, activos.map((p) => p.categoria))")
    expect(CAJA).toContain("mergeManagedCategories(categoriasManaged, activos.map((p) => p.categoria))")
    // The old, independent derivation this round replaces must be gone.
    expect(INVENTARIO).not.toContain("const set = new Set(activos.map((p) => p.categoria")
    expect(CAJA).not.toContain("Array.from(new Set(activos.map((p) => p.categoria")
  })

  test("Inventario's product form uses a managed-list Select, not a free-text Input with a datalist", () => {
    expect(INVENTARIO).toContain('<SelectTrigger id="inv-categoria"')
    expect(INVENTARIO).toContain('<SelectItem value="Sin Categoria">Sin categoría</SelectItem>')
    expect(INVENTARIO).not.toContain('<Input id="inv-categoria"')
    expect(INVENTARIO).not.toContain("inv-categorias-list")
  })

  test("category is never forced on a new product — the form defaults to 'Sin Categoria', not the first managed category", () => {
    expect(INVENTARIO).toContain('useState(producto?.categoria ?? "Sin Categoria")')
  })

  test("Inventario exposes an entry point to the category manager", () => {
    expect(INVENTARIO).toContain("AdministrarCategoriasDialog")
    expect(INVENTARIO).toContain("Administrar categorías")
    expect(INVENTARIO).toContain("categoriasDialogOpen")
  })
})

describe("P2-T56-R2B — AdministrarCategoriasDialog: reuses the existing category authority, never a new model", () => {
  test("create/rename/delete all call the pre-existing /api/negocio/categorias endpoint — no new API route", () => {
    expect(DIALOG).toContain('fetch("/api/negocio/categorias"')
    expect((DIALOG.match(/fetch\("\/api\/negocio\/categorias"/g) ?? []).length).toBe(4)
  })

  test("create and rename use the shared case/space-insensitive dedup authority, not a raw .includes() check", () => {
    expect(DIALOG).toContain('import { findEquivalentCategory } from "@/lib/category-normalization"')
    expect(DIALOG).toContain("findEquivalentCategory(categorias, trimmed)")
    expect(DIALOG).toContain("findEquivalentCategory(categorias.filter((c) => c !== renameTarget), trimmed)")
  })

  test("deleting a category never deletes a product — it sends the remaining array via PUT, same safe reassignment behavior as products-tab.tsx", () => {
    expect(DIALOG).toContain("categorias: categorias.filter((c) => c !== name)")
    expect(DIALOG).not.toContain("db.producto.delete")
    expect(DIALOG).not.toContain("DELETE")
  })

  test("the delete confirmation surfaces the real product count before removing", () => {
    expect(DIALOG).toContain("Esta categoría tiene")
    expect(DIALOG).toContain("countProductos(deleteTarget)")
  })

  test("tenant is never sent from the client — negocioId is only used for React Query cache keys, never in a request body", () => {
    expect(DIALOG).not.toMatch(/JSON\.stringify\(\{[^}]*negocioId/)
  })
})
