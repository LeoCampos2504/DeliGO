// ============================================
// P2-T56-R3A-P0 — identidad de línea del carrito de pedido manual de Mozo
// ============================================
// Extraído verbatim de src/app/mozo/panel/[slug]/pedido/[mesaId]/page.tsx
// (un page.tsx de Next no puede exportar helpers) para poder probarlo de
// forma aislada. Pura: sin DOM, sin React, sin Prisma.
//
// La identidad de una línea es producto + variante + todas las dimensiones
// de personalización que ya existían (agregados/opciones compartidas,
// secciones propias, ingredientes quitados, talle, color). Dos variantes
// distintas del mismo producto son SIEMPRE líneas distintas; la misma
// variante con la misma personalización vuelve a la misma línea (el
// carrito incrementa la cantidad, igual que antes para productos idénticos).
// La variante nunca se mezcla con las opciones del producto: es una
// dimensión propia de la key.

export type MozoSectionSelection = string | Record<string, number>

export function buildOrderItemKey(item: {
  productoId: string
  varianteId: string | null
  agregados: Array<{ id: string }>
  secciones: Record<string, MozoSectionSelection>
  ingredientesQuitados: string[]
  talle: string
  color: string
}) {
  const sectionKey = Object.entries(item.secciones)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => {
      if (typeof value === "string") return `${name}:${value}`
      return `${name}:${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([option, quantity]) => `${option}x${quantity}`).join(",")}`
    })
    .join("|")
  return [
    item.productoId,
    item.varianteId ?? "",
    item.agregados.map((agregado) => agregado.id).sort().join(","),
    sectionKey,
    item.ingredientesQuitados.slice().sort().join(","),
    item.talle,
    item.color,
  ].join("::")
}
