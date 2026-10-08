// ============================================
// P2-T56-R3A-I4 — disponibilidad pública en el carrito del Cliente (pura)
// ============================================
// Sin DOM, sin Prisma, sin React. Consume el `stockDisponible` que publica
// GET /api/negocios/[slug] (físico − reservas ACTIVA; null = sin límite) para:
//  - impedir agregar / sumar más unidades que las disponibles;
//  - detectar un carrito desactualizado (producto agotado, oculto o con menos
//    unidades) sin modificarlo nunca en silencio.
// Las líneas del carrito se agregan por CLAVE DE STOCK (producto o variante):
// dos líneas del mismo producto con distintos agregados/secciones consumen el
// mismo stock. Sólo aplica al rubro "negocio" (alcance R3A); para cualquier
// otro rubro la disponibilidad es `null` y nada se limita. No es autoridad:
// POST /api/pedidos vuelve a validar dentro de su transacción.

export const STOCK_LIMIT_MESSAGE = "No hay suficientes unidades disponibles"

const GENERIC_BUSINESS_RUBRO = "negocio"

export interface CatalogStockVariant {
  id: string
  stockDisponible?: number | null
}

export interface CatalogStockProduct {
  id: string
  tieneVariantes?: boolean
  stockDisponible?: number | null
  variantes?: ReadonlyArray<CatalogStockVariant>
}

export interface CartStockLine {
  key: string
  productoId: string
  varianteId?: string | null
  cantidad: number
  nombre: string
  varianteNombre?: string | null
}

/**
 * Disponible publicado por clave de stock. Una clave AUSENTE significa que el
 * catálogo ya no la ofrece (agotada, deshabilitada, variante inactiva o
 * eliminada) → 0 disponible. Valor `null` = sin límite.
 */
export type CatalogAvailability = ReadonlyMap<string, number | null>

export function cartStockKey(productoId: string, varianteId?: string | null): string {
  return `${productoId}::${varianteId ?? ""}`
}

/** `null` para rubros fuera del alcance de R3A (sin límites en el carrito). */
export function buildCatalogAvailability(
  negocio: { rubro?: string | null; productos?: ReadonlyArray<CatalogStockProduct> | null } | null | undefined
): CatalogAvailability | null {
  if (!negocio || negocio.rubro !== GENERIC_BUSINESS_RUBRO || !negocio.productos) return null
  const availability = new Map<string, number | null>()
  for (const producto of negocio.productos) {
    const variantes = producto.variantes ?? []
    if (producto.tieneVariantes || variantes.length > 0) {
      for (const variante of variantes) {
        availability.set(cartStockKey(producto.id, variante.id), variante.stockDisponible ?? null)
      }
    } else {
      availability.set(cartStockKey(producto.id, null), producto.stockDisponible ?? null)
    }
  }
  return availability
}

function disponibleDeClave(availability: CatalogAvailability, key: string): number | null {
  return availability.has(key) ? (availability.get(key) ?? null) : 0
}

/** Unidades ya en el carrito para la clave de stock (todas sus líneas). */
export function cantidadEnCarrito(
  items: ReadonlyArray<Pick<CartStockLine, "productoId" | "varianteId" | "cantidad">>,
  productoId: string,
  varianteId?: string | null
): number {
  const key = cartStockKey(productoId, varianteId)
  return items
    .filter((item) => cartStockKey(item.productoId, item.varianteId) === key)
    .reduce((sum, item) => sum + item.cantidad, 0)
}

/**
 * Cuántas unidades MÁS se pueden agregar para la clave, descontando lo que ya
 * está en el carrito. `null` = sin límite (rubro fuera de alcance o clave sin
 * control de stock).
 */
export function unidadesAgregables(
  availability: CatalogAvailability | null,
  items: ReadonlyArray<Pick<CartStockLine, "productoId" | "varianteId" | "cantidad">>,
  productoId: string,
  varianteId?: string | null
): number | null {
  if (!availability) return null
  const disponible = disponibleDeClave(availability, cartStockKey(productoId, varianteId))
  if (disponible === null) return null
  return Math.max(0, disponible - cantidadEnCarrito(items, productoId, varianteId))
}

/** ¿Se puede sumar `cantidad` unidades de la clave sin superar lo disponible? */
export function puedeAgregarAlCarrito(
  availability: CatalogAvailability | null,
  items: ReadonlyArray<Pick<CartStockLine, "productoId" | "varianteId" | "cantidad">>,
  linea: { productoId: string; varianteId?: string | null; cantidad: number }
): boolean {
  const restante = unidadesAgregables(availability, items, linea.productoId, linea.varianteId)
  return restante === null || linea.cantidad <= restante
}

export type CartStockIssueTipo = "SIN_STOCK" | "EXCEDE_DISPONIBLE"

export interface CartStockIssue {
  tipo: CartStockIssueTipo
  productoId: string
  varianteId: string | null
  /** Nombre visible ("Producto — Variante"); nunca se muestran cantidades exactas. */
  nombre: string
  itemKeys: string[]
}

function nombreVisible(line: Pick<CartStockLine, "nombre" | "varianteNombre">): string {
  return line.varianteNombre ? `${line.nombre} — ${line.varianteNombre}` : line.nombre
}

/**
 * Valida el carrito completo contra el catálogo publicado, agregando por clave
 * de stock. Nunca modifica el carrito: devuelve los problemas para advertir y
 * bloquear el checkout hasta que el cliente corrija.
 */
export function validarCarritoDisponibilidad(
  items: ReadonlyArray<CartStockLine>,
  availability: CatalogAvailability | null
): CartStockIssue[] {
  if (!availability) return []
  const groups = new Map<string, { first: CartStockLine; total: number; itemKeys: string[] }>()
  for (const item of items) {
    const key = cartStockKey(item.productoId, item.varianteId)
    const group = groups.get(key)
    if (group) {
      group.total += item.cantidad
      group.itemKeys.push(item.key)
    } else {
      groups.set(key, { first: item, total: item.cantidad, itemKeys: [item.key] })
    }
  }
  const issues: CartStockIssue[] = []
  for (const [key, group] of groups) {
    const disponible = disponibleDeClave(availability, key)
    if (disponible === null || group.total <= disponible) continue
    issues.push({
      tipo: disponible <= 0 ? "SIN_STOCK" : "EXCEDE_DISPONIBLE",
      productoId: group.first.productoId,
      varianteId: group.first.varianteId ?? null,
      nombre: nombreVisible(group.first),
      itemKeys: group.itemKeys,
    })
  }
  return issues
}

/**
 * Nombres visibles de las líneas que el servidor rechazó (409
 * STOCK_INSUFFICIENT, `details.lineas`), resueltos contra el carrito.
 */
export function nombresDeLineasRechazadas(
  items: ReadonlyArray<CartStockLine>,
  lineas: ReadonlyArray<{ productoId?: string | null; productoVarianteId?: string | null }> | null | undefined
): string[] {
  if (!lineas) return []
  const nombres = new Set<string>()
  for (const linea of lineas) {
    if (!linea.productoId) continue
    const key = cartStockKey(linea.productoId, linea.productoVarianteId)
    const item = items.find((i) => cartStockKey(i.productoId, i.varianteId) === key)
    if (item) nombres.add(nombreVisible(item))
  }
  return [...nombres]
}
