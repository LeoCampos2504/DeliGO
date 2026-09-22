// P2-T47-R1: contrato estático de la protección contra categorías
// duplicadas por case/espacios en el catálogo de Negocio (Agregados +
// Ingredientes). La lógica de equivalencia en sí está cubierta a fondo
// por `src/lib/category-normalization.test.ts` (findEquivalentCategory,
// casos A-C del §22); este archivo confirma que AMBOS formularios usan
// esa autoridad compartida en los 5 puntos de creación/renombrado
// identificados en la auditoría A0, y que no quedó ningún
// `.includes(trimmed)` case-sensitive residual. Montar los formularios
// completos (con sus queries/mutaciones/drawers) sería desproporcionado
// para verificar una única condición de dedup.
import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const agregadosSource = readFileSync(join(process.cwd(), "src/components/business/agregados-section.tsx"), "utf8")
const ingredientesSource = readFileSync(join(process.cwd(), "src/components/business/ingredientes-section.tsx"), "utf8")

describe("P2-T47-R1 — agregados-section.tsx: 3 puntos de creación/renombrado protegidos", () => {
  test("importa findEquivalentCategory desde la autoridad compartida", () => {
    expect(agregadosSource).toContain('import { findEquivalentCategory } from "@/lib/category-normalization"')
  })

  test("A. renombrar categoría excluye la propia entrada (permite recapitalizar la MISMA)", () => {
    expect(agregadosSource).toContain(
      "findEquivalentCategory(categories.filter((c) => c !== editingCategory), trimmed)"
    )
  })

  test("B. agregar categoría desde la barra de pills usa el chequeo equivalente", () => {
    expect(agregadosSource).toContain("if (findEquivalentCategory(categories, trimmed)) {")
  })

  test("C. agregar categoría inline en el formulario reutiliza la EXISTENTE (no crea una nueva)", () => {
    expect(agregadosSource).toContain("const existing = findEquivalentCategory(categories, trimmed)")
    expect(agregadosSource).toContain("setFormData((p) => ({ ...p, categoria: existing }))")
  })

  test("no queda ningún dedup case-sensitive residual (`categories.includes(trimmed)`)", () => {
    expect(agregadosSource).not.toContain("categories.includes(trimmed)")
  })
})

describe("P2-T47-R1 — ingredientes-section.tsx: 2 puntos de creación/renombrado protegidos", () => {
  test("importa findEquivalentCategory desde la autoridad compartida", () => {
    expect(ingredientesSource).toContain('import { findEquivalentCategory } from "@/lib/category-normalization"')
  })

  test("D. renombrar categoría excluye la propia entrada (permite recapitalizar la MISMA)", () => {
    expect(ingredientesSource).toContain(
      "findEquivalentCategory(allCategories.filter((c) => c !== editingCategory), trimmed)"
    )
  })

  test("E. agregar categoría desde la barra de pills usa el chequeo equivalente", () => {
    expect(ingredientesSource).toContain("if (findEquivalentCategory(allCategories, trimmed)) {")
  })

  test("no queda ningún dedup case-sensitive residual (`allCategories.includes(trimmed)`)", () => {
    expect(ingredientesSource).not.toContain("allCategories.includes(trimmed)")
  })
})

describe("P2-T47-R1 — no backfill: guardado de una categoría nueva válida no cambió", () => {
  test("agregados-section.tsx sigue persistiendo el texto tal cual (trimmed) cuando es genuinamente nuevo", () => {
    expect(agregadosSource).toContain("const updatedCats = [...categories, trimmed]")
  })

  test("ingredientes-section.tsx sigue persistiendo el texto tal cual (trimmed) cuando es genuinamente nuevo", () => {
    expect(ingredientesSource).toContain("const newCategorias = [...configCategorias, trimmed]")
  })
})
