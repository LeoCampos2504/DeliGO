// P2-T47-R1: autoridad compartida y mínima para tratar nombres de
// categoría (Agregado.categoria / Ingrediente.categoria / categorías de
// catálogo) como equivalentes cuando sólo difieren en mayúsculas/
// minúsculas o espacios. Nunca normaliza los datos guardados — sólo
// agrupamiento/comparación en memoria, del lado del cliente.

/** Clave de comparación case/espacio-insensible para un nombre de categoría. */
export function normalizeCategoryKey(value: string): string {
  return value.trim().toLocaleLowerCase()
}

/**
 * Busca, dentro de una lista de categorías existentes, una que sea
 * equivalente (misma clave normalizada) a `candidate`. Devuelve el
 * string EXISTENTE (nunca `candidate`) para que el llamador reutilice
 * la grafía ya persistida en vez de introducir una variante nueva.
 */
export function findEquivalentCategory(categories: string[], candidate: string): string | undefined {
  const key = normalizeCategoryKey(candidate)
  return categories.find((category) => normalizeCategoryKey(category) === key)
}

export interface NormalizedCategoryGroup<T> {
  /** Primer label no vacío (trimmed) visto para este grupo — nunca se reescribe. */
  label: string
  items: T[]
}

/**
 * Agrupa `items` por una categoría case/espacio-insensible, preservando
 * el primer label no vacío encontrado como texto visible del grupo y
 * sin perder ningún item (categorías equivalentes con distinta grafía
 * se consolidan en un único grupo). El orden de los grupos es el orden
 * de primera aparición, igual que el `Map` que reemplaza.
 */
export function groupByNormalizedCategory<T>(
  items: readonly T[],
  getCategoria: (item: T) => string | null | undefined,
  fallbackLabel: string
): NormalizedCategoryGroup<T>[] {
  const order: string[] = []
  const groups = new Map<string, NormalizedCategoryGroup<T>>()

  for (const item of items) {
    const raw = (getCategoria(item) || "").trim()
    const label = raw || fallbackLabel
    const key = normalizeCategoryKey(label)

    let group = groups.get(key)
    if (!group) {
      group = { label, items: [] }
      groups.set(key, group)
      order.push(key)
    }
    group.items.push(item)
  }

  return order.map((key) => groups.get(key)!)
}
