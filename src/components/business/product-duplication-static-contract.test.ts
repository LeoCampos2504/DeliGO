/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const PRODUCTS_TAB = readFileSync(
  join(process.cwd(), "src", "components", "business", "products-tab.tsx"),
  "utf8"
)

describe("PRODUCT-DUPLICATION-R1 — catalog card UX contract", () => {
  test("offers duplication in both desktop and mobile card action surfaces", () => {
    expect(PRODUCTS_TAB).toContain('aria-label="Duplicar producto"')
    expect(PRODUCTS_TAB).toContain('title="Duplicar producto"')
    expect(PRODUCTS_TAB).toContain('isDuplicating ? "Duplicando…" : "Duplicar"')
  })

  test("uses the server duplication endpoint and does not reconstruct a product payload", () => {
    expect(PRODUCTS_TAB).toContain('fetch(`/api/negocio/productos/${id}/duplicar`, { method: "POST" })')
    expect(PRODUCTS_TAB).not.toContain('fetch(`/api/negocio/productos/${id}/duplicar`, { method: "POST",')
    expect(PRODUCTS_TAB).toContain('duplicateMutation.mutate(product.id)')
  })

  test("pending state disables the card action and success refreshes products and catalog sections", () => {
    expect(PRODUCTS_TAB).toContain('disabled={isDuplicating}')
    expect(PRODUCTS_TAB).toContain('duplicateMutation.isPending && duplicateMutation.variables === product.id')
    expect(PRODUCTS_TAB).toContain('queryClient.invalidateQueries({ queryKey: ["negocio-productos", negocio.id] })')
    expect(PRODUCTS_TAB).toContain('queryClient.invalidateQueries({ queryKey: ["negocio-secciones", negocio.id] })')
    expect(PRODUCTS_TAB).toContain('toast.success(result.nombre ? `Producto duplicado: ${result.nombre}` : "Producto duplicado correctamente")')
  })

  test("keeps the existing unsaved-changes guard path intact", () => {
    expect(PRODUCTS_TAB).toContain("useUnsavedChangesGuard(productIsDirty)")
    expect(PRODUCTS_TAB).toContain("useUnsavedChangesGuard(productIsDirty || otherFormIsDirty, { beforeUnload: false })")
    expect(PRODUCTS_TAB).toContain("productGuard.guardedClose(closeForm)")
  })
})
