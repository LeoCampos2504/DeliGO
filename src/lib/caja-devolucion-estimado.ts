// ============================================
// F4-A — display-only preview of the return amount (shared by the sale
// detail and «Gestionar venta»). The server always computes the real amount
// from what was actually charged; this only mirrors its rule for the screen.
// ============================================

export interface LineaDevolvible {
  cantidad: number
  subtotal: number
  cantidadDevuelta: number
  importeDevuelto: number
}

const round2 = (value: number) => Math.round(value * 100) / 100

/** Display-only preview of the server rule (cumulative, proportional to what was charged). */
export function importeEstimado<T extends LineaDevolvible>(item: T, cantidad: number): number {
  if (cantidad <= 0) return 0
  const acumulada = item.cantidadDevuelta + cantidad
  const objetivo = acumulada >= item.cantidad ? item.subtotal : round2((item.subtotal * acumulada) / item.cantidad)
  return Math.max(0, round2(objetivo - item.importeDevuelto))
}
