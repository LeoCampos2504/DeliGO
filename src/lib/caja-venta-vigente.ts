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
  /**
   * F4-B (2026-11-05): the line names another product than its original row
   * without a recorded price justification — a correction made under the
   * earlier inherited-price rule. Kept as immutable history; flagged in views.
   */
  precioHeredado: boolean
  /**
   * Justification recorded for the current line (MISMO_PRODUCTO | MISMA_VENTA |
   * PRECIO_CATALOGO_ACTUAL); null for an uncorrected line (its own product) or an
   * earlier-rule line.
   */
  criterioPrecio: string | null
}

/** Prisma include for the latest correction of a sale (enough to resolve current lines). */
export const ULTIMA_CORRECCION_INCLUDE = {
  orderBy: { secuencia: "desc" },
  take: 1,
  include: { lineas: true },
} satisfies Prisma.Venta$correccionesArgs

type ItemRow = Pick<VentaItem, "id" | "productoId" | "productoVarianteId" | "nombre" | "varianteNombre" | "precio" | "cantidad" | "subtotal" | "subtotalDecimal">
type LineaRow = Pick<CorreccionVentaLinea, "ventaItemId" | "productoId" | "productoVarianteId" | "nombre" | "varianteNombre" | "precio" | "cantidad" | "subtotalDecimal"> & {
  criterioPrecio?: string | null
}

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
      precioHeredado: !corregida.criterioPrecio && (corregida.productoId !== item.productoId || corregida.productoVarianteId !== item.productoVarianteId),
      criterioPrecio: corregida.criterioPrecio ?? null,
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
    precioHeredado: false,
    criterioPrecio: null,
  }
}

export function nombreLinea(linea: { nombre: string; varianteNombre: string | null }): string {
  return linea.varianteNombre ? `${linea.nombre} — ${linea.varianteNombre}` : linea.nombre
}
