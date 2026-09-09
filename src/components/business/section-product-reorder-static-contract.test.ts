import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const seccionesSection = readFileSync(join(process.cwd(), "src/components/business/secciones-section.tsx"), "utf8")
const reorderRoute = readFileSync(join(process.cwd(), "src/app/api/negocio/secciones/[id]/productos/orden/route.ts"), "utf8")
const updateRoute = readFileSync(join(process.cwd(), "src/app/api/negocio/secciones/[id]/route.ts"), "utf8")

describe("CATALOG-SECTION-PRODUCT-REORDER-R1 — static contracts", () => {
  test("the reorder dialog is separate from the membership checkboxes and shows the section's complete member list", () => {
    expect(seccionesSection).toContain("function SectionProductReorderDialog")
    expect(seccionesSection).toContain("onReorderProducts")
    expect(seccionesSection).toContain("productCount >= 2")
    // Reads directly from the section's own products array — never a filtered/searched subset.
    expect(seccionesSection).toContain("seccion ? [...seccion.productos].sort((a, b) => a.orden - b.orden) : []")
  })

  test("one move triggers exactly one PATCH with the section's complete reordered product ID list", () => {
    expect(seccionesSection).toContain("fetch(`/api/negocio/secciones/${seccionId}/productos/orden`")
    expect(seccionesSection).toContain('method: "PATCH"')
    expect(seccionesSection).toContain("body: JSON.stringify({ productIds })")
  })

  test("move handlers guard against double-submit while a reorder is in flight", () => {
    expect(seccionesSection).toContain("index === 0 || reorderMutation.isPending")
    expect(seccionesSection).toContain("index === products.length - 1 || reorderMutation.isPending")
    expect(seccionesSection).toContain("disabled={index === 0 || reorderMutation.isPending}")
    expect(seccionesSection).toContain("disabled={index === products.length - 1 || reorderMutation.isPending}")
  })

  test("optimistic reorder snapshots the query cache and rolls back on error, then always refetches", () => {
    expect(seccionesSection).toContain("onMutate: async ({ seccionId, productIds })")
    expect(seccionesSection).toContain('queryClient.cancelQueries({ queryKey: ["negocio-secciones", negocioId] })')
    expect(seccionesSection).toContain("return { previous }")
    expect(seccionesSection).toContain("if (context?.previous)")
    expect(seccionesSection).toContain("onSettled: () => {")
  })

  test("server: section ownership checked first, full member-set validated, transaction serializable, 409 on conflict", () => {
    expect(reorderRoute).toContain('user.type !== "negocio"')
    expect(reorderRoute).toContain("seccion.negocioId !== user.id")
    expect(reorderRoute).toContain("Sección no encontrada")
    expect(reorderRoute).toContain("where: { seccionId }")
    expect(reorderRoute).toContain("new Set(productIds)")
    expect(reorderRoute).toContain("Prisma.TransactionIsolationLevel.Serializable")
    expect(reorderRoute).toContain("seccionId_productoId")
    expect(reorderRoute).toContain("status: 409")
    // Never touches the other two order scopes.
    expect(reorderRoute).not.toContain("seccionCatalogo.update")
    expect(reorderRoute).not.toContain("tx.producto.update")
  })

  test("generic membership PUT treats the submitted array as a SET, never as a reorder instruction — retained members keep their DB order, new ones append", () => {
    expect(updateRoute).toContain("newSet.has(sp.productoId)")
    expect(updateRoute).toContain(".sort((a, b) => a.orden - b.orden)")
    expect(updateRoute).toContain("const added = validProductoIds.ids.filter((productoId) => !currentIds.has(productoId))")
    expect(updateRoute).toContain("const finalOrder = [...retainedInOrder, ...added]")
    // The whole membership diff (basic fields + junction changes) is one transaction.
    expect(updateRoute).toContain("await db.$transaction(async (tx) => {")
  })
})
