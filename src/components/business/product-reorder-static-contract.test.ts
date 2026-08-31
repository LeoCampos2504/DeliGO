import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const productsTab = readFileSync(join(process.cwd(), "src/components/business/products-tab.tsx"), "utf8")
const reorderRoute = readFileSync(join(process.cwd(), "src/app/api/negocio/productos/orden/route.ts"), "utf8")
const createRoute = readFileSync(join(process.cwd(), "src/app/api/negocio/productos/route.ts"), "utf8")
const updateRoute = readFileSync(join(process.cwd(), "src/app/api/negocio/productos/[id]/route.ts"), "utf8")

describe("CATALOG-PRODUCT-REORDER-R1 — static contracts", () => {
  test("uses an explicit full-list mode and never renders filtered products inside it", () => {
    expect(productsTab).toContain("Ordenar productos")
    expect(productsTab).toContain("setReorderProducts([...productos])")
    expect(productsTab).toContain("products={reorderProducts}")
    expect(productsTab).not.toContain("products={filteredProducts} // reorder")
  })

  test("persists immediately through the dedicated PATCH endpoint with complete IDs", () => {
    expect(productsTab).toContain('fetch("/api/negocio/productos/orden"')
    expect(productsTab).toContain('method: "PATCH"')
    expect(productsTab).toContain("body: JSON.stringify({ productIds })")
    expect(productsTab).toContain("reorderMutation.isPending")
  })

  test("desktop has a separate drag handle and mobile has accessible up/down controls", () => {
    expect(productsTab).toContain("draggable={!isPending}")
    expect(productsTab).toContain("Arrastrar ${product.nombre}")
    expect(productsTab).toContain("Subir ${product.nombre}")
    expect(productsTab).toContain("Bajar ${product.nombre}")
    expect(productsTab).toContain("hidden shrink-0 cursor-grab")
  })

  test("server authenticates from the session, validates the complete active set, and reindexes transactionally", () => {
    expect(reorderRoute).toContain("user.type !== \"negocio\"")
    expect(reorderRoute).toContain("where: { negocioId: user.id, eliminado: false }")
    expect(reorderRoute).toContain("new Set(productIds)")
    expect(reorderRoute).toContain("Prisma.TransactionIsolationLevel.Serializable")
    expect(reorderRoute).toContain("data: { orden }")
  })

  test("normal create appends server-side and generic PUT cannot write order", () => {
    expect(createRoute).toContain("maxOrder._max.orden ?? -1")
    expect(createRoute).not.toContain("orden: orden || 0")
    expect(updateRoute).toContain("El orden se modifica únicamente desde el endpoint dedicado")
    expect(updateRoute).not.toContain("updateData.orden = orden")
  })
})
