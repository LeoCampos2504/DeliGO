// P2-T47-R1: contrato estático de la migración de ProductDetailSheet a
// `groupByNormalizedCategory` (agrupamiento case/espacio-insensible de
// Agregado.categoria / Ingrediente.categoria). La lógica de
// agrupamiento en sí ya está cubierta exhaustivamente por
// `src/lib/category-normalization.test.ts` (casos A-F puros); este
// archivo sólo confirma que `page.tsx` usa esa autoridad compartida
// (no una implementación paralela) y que nada de selección/precio/
// remoción/CTA cambió de forma al migrar. Montar `ProductDetailSheet`
// completo exigiría un harness de tienda/carrito/auth desproporcionado
// para un cambio de agrupamiento visual puro.
import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const source = readFileSync(join(process.cwd(), "src/app/n/[slug]/page.tsx"), "utf8")

describe("P2-T47-R1 — ProductDetailSheet usa la autoridad compartida de categorías", () => {
  test("importa groupByNormalizedCategory desde la autoridad compartida", () => {
    expect(source).toContain('import { groupByNormalizedCategory } from "@/lib/category-normalization"')
  })

  test("agregadosByCategory delega en el helper compartido (no un Map propio)", () => {
    expect(source).toContain(
      'groupByNormalizedCategory(product.agregados || [], (a) => a.categoria, "Sin categoría")'
    )
    expect(source).not.toContain('new Map<string, ProductoAPI["agregados"]>()')
  })

  test("ingredientesByCategory delega en el helper compartido (no un Map propio)", () => {
    expect(source).toContain(
      'groupByNormalizedCategory(product.ingredientes || [], (i) => i.categoria, "Sin categoría")'
    )
    expect(source).not.toContain('new Map<string, ProductoAPI["ingredientes"]>()')
  })

  test("el render itera el array de grupos (.length / .map), ya no `.size`/`.entries()`", () => {
    expect(source).toContain("agregadosByCategory.length > 0")
    expect(source).toContain("ingredientesByCategory.length > 0")
    expect(source).not.toContain("agregadosByCategory.size")
    expect(source).not.toContain("ingredientesByCategory.size")
    expect(source).not.toContain("Array.from(agregadosByCategory.entries())")
    expect(source).not.toContain("Array.from(ingredientesByCategory.entries())")
  })

  test("el encabezado visible usa group.label (el primer label no vacío visto)", () => {
    expect(source).toMatch(/Agregados\{" "\}\s*<span className="font-normal text-muted-foreground">— \{group\.label\}<\/span>/)
    expect(source).toMatch(/Ingredientes\{" "\}\s*<span className="font-normal text-muted-foreground">— \{group\.label\}<\/span>/)
  })
})

describe("P2-T47-R1 — regresión: selección/precio/remoción/CTA sin cambios de forma", () => {
  test("toggleAgregado y selectedAgregados no se tocaron", () => {
    expect(source).toContain("selectedAgregados.has(a.id)")
    expect(source).toContain("toggleAgregado(a)")
  })

  test("toggleIngrediente y removedIngredientes no se tocaron", () => {
    expect(source).toContain("removedIngredientes.has(i.id)")
    expect(source).toContain("toggleIngrediente(i.id)")
  })

  test("el cálculo de precio (agregadosTotal + opcionesCompartidasTotal + seccionesPricing) sigue igual", () => {
    expect(source).toContain("agregadosTotal + opcionesCompartidasTotal + seccionesPricing.total")
  })

  test("el gate de Vista previa (isPreview) sigue bloqueando el CTA sin cambios", () => {
    expect(source).toContain("if (isPreview) return")
  })
})
