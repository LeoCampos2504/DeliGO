// P2-T47-R1: contrato focal puro de la autoridad compartida de
// normalización de categorías (Aderezos/aderezos). Sin DOM, sin React,
// sin DB — helpers puros usados por ProductDetailSheet
// (src/app/n/[slug]/page.tsx) y por el catálogo de Negocio
// (agregados-section.tsx / ingredientes-section.tsx).
import { describe, expect, test } from "bun:test"
import {
  findEquivalentCategory,
  groupByNormalizedCategory,
  matchesCategoryFilter,
  mergeManagedCategories,
  normalizeCategoryKey,
  SIN_CATEGORIA,
} from "./category-normalization"

describe("normalizeCategoryKey", () => {
  test("case-insensible", () => {
    expect(normalizeCategoryKey("Aderezos")).toBe(normalizeCategoryKey("aderezos"))
  })
  test("espacio-insensible (trim)", () => {
    expect(normalizeCategoryKey(" ADEREZOS ")).toBe(normalizeCategoryKey("aderezos"))
  })
  test("categorías realmente distintas producen claves distintas", () => {
    expect(normalizeCategoryKey("Aderezos")).not.toBe(normalizeCategoryKey("Salsas"))
  })
})

describe("groupByNormalizedCategory — casos A-F del task spec", () => {
  type Item = { id: string; nombre: string; categoria: string }
  const item = (id: string, categoria: string): Item => ({ id, nombre: id, categoria })

  test("A. 'Aderezos' + 'aderezos' => 1 solo grupo", () => {
    const items = [item("mayo", "Aderezos"), item("ketchup", "aderezos")]
    const groups = groupByNormalizedCategory(items, (i) => i.categoria, "Sin categoría")
    expect(groups).toHaveLength(1)
  })

  test("B. 'Aderezos' + ' ADEREZOS ' => 1 solo grupo", () => {
    const items = [item("mayo", "Aderezos"), item("mostaza", " ADEREZOS ")]
    const groups = groupByNormalizedCategory(items, (i) => i.categoria, "Sin categoría")
    expect(groups).toHaveLength(1)
  })

  test("C. el grupo conserva el PRIMER label visible encontrado (trimmed)", () => {
    const items = [item("mayo", "Aderezos"), item("ketchup", "aderezos"), item("mostaza", " ADEREZOS ")]
    const groups = groupByNormalizedCategory(items, (i) => i.categoria, "Sin categoría")
    expect(groups[0].label).toBe("Aderezos")
  })

  test("C2. si el primero viene con espacios, el label preservado ya está trimmed", () => {
    const items = [item("mostaza", "  aderezos  "), item("mayo", "Aderezos")]
    const groups = groupByNormalizedCategory(items, (i) => i.categoria, "Sin categoría")
    expect(groups[0].label).toBe("aderezos")
  })

  test("D. los items de AMBOS grupos originales se conservan (nunca se pierden)", () => {
    const items = [item("mayo", "Aderezos"), item("ketchup", "Aderezos"), item("mostaza", "aderezos")]
    const groups = groupByNormalizedCategory(items, (i) => i.categoria, "Sin categoría")
    expect(groups).toHaveLength(1)
    expect(groups[0].items.map((i) => i.id).sort()).toEqual(["ketchup", "mayo", "mostaza"])
  })

  test("E. categorías realmente distintas siguen separadas", () => {
    const items = [item("mayo", "Aderezos"), item("provolone", "Quesos")]
    const groups = groupByNormalizedCategory(items, (i) => i.categoria, "Sin categoría")
    expect(groups).toHaveLength(2)
    expect(groups.map((g) => g.label).sort()).toEqual(["Aderezos", "Quesos"])
  })

  test("F. categoría vacía mantiene el comportamiento histórico (fallback definido)", () => {
    const items = [item("a", ""), item("b", "   ")]
    const groups = groupByNormalizedCategory(items, (i) => i.categoria, "Sin categoría")
    expect(groups).toHaveLength(1)
    expect(groups[0].label).toBe("Sin categoría")
    expect(groups[0].items).toHaveLength(2)
  })

  test("orden de grupos = orden de primera aparición (sin regresión de orden)", () => {
    const items = [item("a", "Quesos"), item("b", "Aderezos"), item("c", "quesos")]
    const groups = groupByNormalizedCategory(items, (i) => i.categoria, "Sin categoría")
    expect(groups.map((g) => g.label)).toEqual(["Quesos", "Aderezos"])
  })
})

describe("findEquivalentCategory — dedup del catálogo de Negocio (§22)", () => {
  test("A. existe 'Aderezos', buscar 'aderezos' => encuentra la existente", () => {
    expect(findEquivalentCategory(["Aderezos", "Salsas"], "aderezos")).toBe("Aderezos")
  })

  test("B. existe 'Aderezos', buscar ' ADEREZOS ' => encuentra la existente", () => {
    expect(findEquivalentCategory(["Aderezos", "Salsas"], " ADEREZOS ")).toBe("Aderezos")
  })

  test("C. 'Salsas' es realmente distinta de 'Aderezos' => no encuentra nada", () => {
    expect(findEquivalentCategory(["Aderezos"], "Salsas")).toBeUndefined()
  })

  test("devuelve el string EXISTENTE, nunca el candidato nuevo", () => {
    const result = findEquivalentCategory(["Aderezos"], "ADEREZOS")
    expect(result).toBe("Aderezos")
    expect(result).not.toBe("ADEREZOS")
  })

  test("lista vacía nunca encuentra equivalente", () => {
    expect(findEquivalentCategory([], "Aderezos")).toBeUndefined()
  })
})

describe("mergeManagedCategories — reconciliación Inventario/Caja con Negocio.categorias (P2-T56-R2B)", () => {
  test("categorías administradas se devuelven en su orden persistido", () => {
    expect(mergeManagedCategories(["Bebidas", "Limpieza"], [])).toEqual(["Bebidas", "Limpieza"])
  })

  test("una categoría de producto huérfana (no administrada) se agrega al final", () => {
    expect(mergeManagedCategories(["Bebidas"], ["Bebidas", "Electrónica"])).toEqual(["Bebidas", "Electrónica"])
  })

  test("una variante de casing/espacios de una categoría YA administrada no se duplica", () => {
    expect(mergeManagedCategories(["Bebidas"], [" bebidas ", "BEBIDAS"])).toEqual(["Bebidas"])
  })

  test("dos productos huérfanos equivalentes entre sí sólo aportan una entrada (primera grafía vista)", () => {
    expect(mergeManagedCategories([], ["electronica", "Electronica"])).toEqual(["electronica"])
  })

  test("'Sin Categoria' en productos nunca se lista como una categoría propia", () => {
    expect(mergeManagedCategories(["Bebidas"], ["Sin Categoria"])).toEqual(["Bebidas"])
  })

  test("una categoría administrada recién creada, sin productos todavía, sigue apareciendo", () => {
    expect(mergeManagedCategories(["Bebidas", "Limpieza"], ["Bebidas"])).toEqual(["Bebidas", "Limpieza"])
  })

  test("listas vacías producen una lista vacía", () => {
    expect(mergeManagedCategories([], [])).toEqual([])
  })
})

describe("matchesCategoryFilter — comparación de filtro operativo (P2-T56-R2B-F1)", () => {
  test("coincidencia exacta", () => {
    expect(matchesCategoryFilter("Bebidas", "Bebidas")).toBe(true)
  })

  test("case-insensible", () => {
    expect(matchesCategoryFilter("bebidas", "Bebidas")).toBe(true)
  })

  test("espacio-insensible", () => {
    expect(matchesCategoryFilter(" Bebidas ", "Bebidas")).toBe(true)
  })

  test("categorías realmente distintas no coinciden", () => {
    expect(matchesCategoryFilter("Limpieza", "Bebidas")).toBe(false)
  })

  test("SIN_CATEGORIA coincide con la grafía canónica del producto por defecto", () => {
    expect(matchesCategoryFilter("Sin Categoria", SIN_CATEGORIA)).toBe(true)
  })
})
