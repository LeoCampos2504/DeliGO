import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const seccionesSection = readFileSync(join(process.cwd(), "src/components/business/secciones-section.tsx"), "utf8")
const reorderRoute = readFileSync(join(process.cwd(), "src/app/api/negocio/secciones/orden/route.ts"), "utf8")
const createRoute = readFileSync(join(process.cwd(), "src/app/api/negocio/secciones/route.ts"), "utf8")
const updateRoute = readFileSync(join(process.cwd(), "src/app/api/negocio/secciones/[id]/route.ts"), "utf8")

describe("CATALOG-SECTION-REORDER-ATOMICITY-R1 — static contracts", () => {
  test("one user move triggers exactly one PATCH request with the complete reordered ID list — never two independent PUTs", () => {
    expect(seccionesSection).toContain('fetch(`/api/negocio/secciones/orden`')
    expect(seccionesSection).toContain('method: "PATCH"')
    expect(seccionesSection).toContain("body: JSON.stringify({ sectionIds })")
    // The old two-PUT swap must be fully gone.
    expect(seccionesSection).not.toContain('body: JSON.stringify({ orden: above.orden })')
    expect(seccionesSection).not.toContain('body: JSON.stringify({ orden: below.orden })')
    expect(seccionesSection).not.toContain('body: JSON.stringify({ orden: current.orden })')
  })

  test("move handlers build the full ordered ID array locally and guard against double-submit while a reorder is in flight", () => {
    expect(seccionesSection).toContain("reorderMutation.mutate(next.map((seccion) => seccion.id))")
    expect(seccionesSection).toContain("index === 0 || reorderMutation.isPending")
    expect(seccionesSection).toContain("index === sortedSecciones.length - 1 || reorderMutation.isPending")
    expect(seccionesSection).toContain("reorderPending={reorderMutation.isPending}")
    expect(seccionesSection).toContain("disabled={index === 0 || reorderPending}")
    expect(seccionesSection).toContain("disabled={index === total - 1 || reorderPending}")
  })

  test("optimistic reorder snapshots the query cache and rolls back on error, then always refetches", () => {
    expect(seccionesSection).toContain("onMutate: async (sectionIds)")
    expect(seccionesSection).toContain('queryClient.cancelQueries({ queryKey: ["negocio-secciones", negocio.id] })')
    expect(seccionesSection).toContain("return { previous }")
    expect(seccionesSection).toContain("if (context?.previous)")
    expect(seccionesSection).toContain('queryClient.setQueryData(["negocio-secciones", negocio.id], context.previous)')
    expect(seccionesSection).toContain("onSettled: () => {")
  })

  test("client no longer owns SeccionCatalogo.orden on create/edit — dropped from the form's own state", () => {
    expect(seccionesSection).not.toContain("orden: sortedSecciones.length")
    expect(seccionesSection).not.toContain("orden: seccion.orden,")
  })

  test("server authenticates from the session, validates the complete section set, and reindexes transactionally", () => {
    expect(reorderRoute).toContain('user.type !== "negocio"')
    expect(reorderRoute).toContain("where: { negocioId: user.id }")
    expect(reorderRoute).toContain("new Set(sectionIds)")
    expect(reorderRoute).toContain("Prisma.TransactionIsolationLevel.Serializable")
    expect(reorderRoute).toContain("data: { orden }")
    // Never conflates SeccionCatalogo.orden with SeccionProducto.orden.
    expect(reorderRoute).not.toContain("seccionProducto")
  })

  test("conflicting concurrent reorders surface as 409, never a silent partial write", () => {
    expect(reorderRoute).toContain("40P01")
    expect(reorderRoute).toContain("status: 409")
  })

  test("normal section create appends server-side and generic PUT cannot write order", () => {
    expect(createRoute).toContain("maxOrder._max.orden ?? -1")
    expect(createRoute).not.toContain("orden: orden || 0")
    expect(updateRoute).toContain("El orden se modifica únicamente desde el endpoint dedicado")
    expect(updateRoute).not.toContain("updateData.orden = orden")
  })
})
