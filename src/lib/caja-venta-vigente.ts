// ============================================
// F4-B — current ("vigente") lines of a Caja sale
// ============================================
// A sale's own rows (VentaItem) are never edited. An owner correction (F4-B)
// stores the full state of every line; the latest correction is the current
// state. Without corrections the current state IS the original VentaItem, so
// every reader (F4-A returns, sale history) behaves exactly as before.

import { Prisma, type CorreccionVentaLinea, type VentaItem } from "@prisma/client"
import { storedMoney } from "@/lib/money"

export interface LineaVigente {
  ventaItemId: string
  productoId: string | null
  productoVarianteId: string | null
  nombre: string
  varianteNombre: string | null
  /** Unit price actually charged (always the original VentaItem.precio). */
  precio: number
  cantidad: number
  subtotal: Prisma.Decimal
  corregida: boolean
}

/** Prisma include for the latest correction of a sale (enough to resolve current lines). */
export const ULTIMA_CORRECCION_INCLUDE = {
  orderBy: { secuencia: "desc" },
  take: 1,
  include: { lineas: true },
} satisfies Prisma.Venta$correccionesArgs

type ItemRow = Pick<VentaItem, "id" | "productoId" | "productoVarianteId" | "nombre" | "varianteNombre" | "precio" | "cantidad" | "subtotal" | "subtotalDecimal">
type LineaRow = Pick<CorreccionVentaLinea, "ventaItemId" | "productoId" | "productoVarianteId" | "nombre" | "varianteNombre" | "precio" | "cantidad" | "subtotalDecimal">

export function lineaVigente(item: ItemRow, ultima: ReadonlyArray<LineaRow> | null | undefined): LineaVigente {
  const corregida = ultima?.find((linea) => linea.ventaItemId === item.id)
  if (corregida) {
    return {
      ventaItemId: item.id,
      productoId: corregida.productoId,
      productoVarianteId: corregida.productoVarianteId,
      nombre: corregida.nombre,
      varianteNombre: corregida.varianteNombre,
      precio: item.precio,
      cantidad: corregida.cantidad,
      subtotal: corregida.subtotalDecimal,
      corregida: true,
    }
  }
  return {
    ventaItemId: item.id,
    productoId: item.productoId,
    productoVarianteId: item.productoVarianteId,
    nombre: item.nombre,
    varianteNombre: item.varianteNombre,
    precio: item.precio,
    cantidad: item.cantidad,
    subtotal: storedMoney(item.subtotalDecimal, item.subtotal),
    corregida: false,
  }
}

export function nombreLinea(linea: { nombre: string; varianteNombre: string | null }): string {
  return linea.varianteNombre ? `${linea.nombre} — ${linea.varianteNombre}` : linea.nombre
}
