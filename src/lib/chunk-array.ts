// ============================================
// DeliGO — Chunking genérico de arrays (T20-DK2B)
// ============================================
// Pura, sin dependencias — divide un array en grupos de tamaño máximo
// `size`, preservando orden y sin duplicar/perder elementos. `size <= 0` se
// trata como "no dividir" (devuelve el array completo como un único chunk)
// para nunca entrar en loop infinito.

export function chunkArray<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return []
  if (size <= 0) return [items]

  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}
