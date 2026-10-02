// ============================================
// P2-T56-R3A-P0-F1 — variante visible de un PedidoItem
// ============================================
// Pura (sin DOM, React ni Prisma). Única regla de display para la variante
// de una línea de pedido en Operaciones, Negocio/Salón y el ticket: se lee
// SIEMPRE del snapshot persistido `PedidoItem.varianteNombre` (nunca de la
// ProductoVariante viva, que puede haberse renombrado o borrado después) y
// nunca se concatena dentro de `PedidoItem.nombre`. Un producto sin variante
// (null / "" / espacios / tipo inesperado) devuelve null, para que ningún
// renderer muestre separadores vacíos, "undefined" ni "-".

export function getPedidoItemVarianteNombre(item: { varianteNombre?: unknown }): string | null {
  if (typeof item.varianteNombre !== "string") return null
  const trimmed = item.varianteNombre.trim()
  return trimmed.length > 0 ? trimmed : null
}
