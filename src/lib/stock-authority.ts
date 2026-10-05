// ============================================
// P2-T56-R3A-I1 — autoridad PURA del lifecycle de stock de Pedidos
// ============================================
// Diseño: codex-reports/P2_T56_R3A_ORDER_STOCK_LIFECYCLE_DESIGN.md
// (A0.1-2 scope por rubro, A0.1-5 agregación, A0.1-6 fórmulas, A0.1-9 modos,
// A0.1-12 motivos, A0.1-17 estados).
//
// Pura: sin Prisma, sin db, sin fetch, sin env, sin efectos. Recibe números y
// valores ya leídos; nunca consulta ni escribe nada. En I1 NO tiene ningún
// caller productivo: R3A-I2 la cablea (creación de pedido, →preparando,
// cancelación), I3 en Caja/Movimientos e I4 en visibilidad/modos. Mientras
// tanto ConfigPlataforma.stockReservaModo queda en "OFF" y el comportamiento
// del sistema es idéntico al previo.

// ---------------------------------------------------------------------------
// Scope por rubro (A0.1-2)
// ---------------------------------------------------------------------------

/** Único rubro alcanzado por el lifecycle de stock de Pedidos: el negocio genérico. */
export const STOCK_LIFECYCLE_RUBRO = "negocio" as const

/**
 * true SOLAMENTE para el negocio genérico ("negocio"). Restaurante, ropa,
 * null/undefined/"" y cualquier otro valor → false: para ellos la creación de
 * pedidos no cambia en nada (I15).
 */
export function isGenericBusinessStockScope(rubro: unknown): boolean {
  return rubro === STOCK_LIFECYCLE_RUBRO
}

// ---------------------------------------------------------------------------
// Agregación de cantidades por clave (A0.1-5)
// ---------------------------------------------------------------------------

export interface StockLineInput {
  productoId: string
  /** null/undefined = producto base (sin variante). */
  productoVarianteId?: string | null
  cantidad: number
}

export interface StockKeyTotal {
  productoId: string
  productoVarianteId: string | null
  cantidad: number
}

/**
 * Clave lógica de stock (productoId, productoVarianteId | null). Producto base
 * y cada variante son claves distintas (I12). El separador "\u0000" no puede
 * aparecer en un id real, así que ninguna combinación de ids colisiona.
 */
export function stockKey(productoId: string, productoVarianteId: string | null | undefined): string {
  return `${productoId}\u0000${productoVarianteId ?? ""}`
}

/**
 * Agrupa líneas por (productoId, productoVarianteId) y suma cantidades
 * (Float). Nunca muta el input; conserva el orden de primera aparición de
 * cada clave. La validación de disponibilidad (I2/I3) se hace SIEMPRE sobre
 * estos totales, nunca línea por línea.
 */
export function agregarCantidadesPorClave(items: ReadonlyArray<StockLineInput>): StockKeyTotal[] {
  const totals = new Map<string, StockKeyTotal>()
  for (const item of items) {
    const productoVarianteId = item.productoVarianteId ?? null
    const key = stockKey(item.productoId, productoVarianteId)
    const current = totals.get(key)
    if (current) {
      current.cantidad += item.cantidad
    } else {
      totals.set(key, { productoId: item.productoId, productoVarianteId, cantidad: item.cantidad })
    }
  }
  return [...totals.values()]
}

// ---------------------------------------------------------------------------
// Disponible / déficit (A0.1-6) — única autoridad de las fórmulas
// ---------------------------------------------------------------------------

export interface StockAvailabilityInput {
  /** controlStock de la autoridad (variante si existe, si no Producto). */
  controlStock: boolean
  /** stockCantidad físico de esa autoridad. */
  physical: number
  /** SUM(ReservaStock.cantidad) ACTIVA de esa clave y negocio (leída por el llamador). */
  activeReserved: number
}

export interface StockAvailability {
  /** null = sin control de stock (sin límite de inventario). */
  available: number | null
  deficit: number
}

/** available = max(0, physical − activeReserved). Nunca negativo. */
export function computeAvailableStock(physical: number, activeReserved: number): number {
  return Math.max(0, physical - activeReserved)
}

/** deficit = max(0, activeReserved − physical). Nunca negativo. */
export function computeReservationDeficit(physical: number, activeReserved: number): number {
  return Math.max(0, activeReserved - physical)
}

/**
 * Disponibilidad comercial de una clave. Con controlStock=false no hay límite
 * de inventario: available=null y deficit=0. Una reserva nunca cambia
 * `physical` (I5): esta función sólo lo lee.
 */
export function resolveStockAvailability(input: StockAvailabilityInput): StockAvailability {
  if (!input.controlStock) return { available: null, deficit: 0 }
  return {
    available: computeAvailableStock(input.physical, input.activeReserved),
    deficit: computeReservationDeficit(input.physical, input.activeReserved),
  }
}

// ---------------------------------------------------------------------------
// Estados y motivos de ReservaStock (A0.1-12, A0.1-17) — strings, sin enum Prisma
// ---------------------------------------------------------------------------

export const RESERVA_ESTADOS = ["ACTIVA", "CONSUMIDA", "LIBERADA"] as const
export type ReservaEstado = (typeof RESERVA_ESTADOS)[number]

export function isReservaEstado(value: unknown): value is ReservaEstado {
  return typeof value === "string" && (RESERVA_ESTADOS as readonly string[]).includes(value)
}

export const RESERVA_MOTIVOS_LIBERACION = [
  "CANCELADO_CLIENTE",
  "CANCELADO_VENDEDOR",
  "CANCELADO_MESA",
  "CANCELADO_SISTEMA",
  "ROLLBACK",
  "PRODUCTO_ELIMINADO",
] as const
export type ReservaMotivoLiberacion = (typeof RESERVA_MOTIVOS_LIBERACION)[number]

export function isReservaMotivoLiberacion(value: unknown): value is ReservaMotivoLiberacion {
  return typeof value === "string" && (RESERVA_MOTIVOS_LIBERACION as readonly string[]).includes(value)
}

// ---------------------------------------------------------------------------
// Modos ON / DRAINING / OFF (A0.1-9) — semántica pura, sin persistencia
// ---------------------------------------------------------------------------

export const STOCK_RESERVATION_MODES = ["ON", "DRAINING", "OFF"] as const
export type StockReservationMode = (typeof STOCK_RESERVATION_MODES)[number]

/**
 * Valor por defecto del schema (ConfigPlataforma.stockReservaModo @default("OFF")):
 * sólo para creación/default explícito. NUNCA es el resultado de leer un valor
 * persistido inválido (ver parseStockReservationMode).
 */
export const DEFAULT_STOCK_RESERVATION_MODE: StockReservationMode = "OFF"

export function isStockReservationMode(value: unknown): value is StockReservationMode {
  return typeof value === "string" && (STOCK_RESERVATION_MODES as readonly string[]).includes(value)
}

/**
 * P2-T56-R3A-I1-F1 — lectura FAIL-CLOSED del valor persistido: sólo "ON",
 * "DRAINING" u "OFF" exactos son modos válidos; cualquier otro valor (incluidos
 * null, undefined, "", minúsculas o basura) devuelve null = INVÁLIDO. Nunca se
 * degrada a OFF: OFF sólo es seguro con 0 reservas ACTIVA y ON→OFF directo está
 * prohibido (A0.1-9), así que tratar un valor corrupto como OFF permitiría
 * saltarse esa semántica. Los callers futuros (I2/I4) deben tratar null como
 * error explícito — nunca como OFF ni como ausencia de reservas.
 */
export function parseStockReservationMode(value: unknown): StockReservationMode | null {
  return isStockReservationMode(value) ? value : null
}

/** ON: los pedidos controlados nuevos de negocio genérico reservan (R3A-I2). */
export function modeCreatesReservations(mode: StockReservationMode): boolean {
  return mode === "ON"
}

/** DRAINING: los pedidos controlados nuevos se rechazan (409 STOCK_RESERVATIONS_DRAINING en I2). */
export function modeRejectsNewControlledOrders(mode: StockReservationMode): boolean {
  return mode === "DRAINING"
}

export type StockModeTransitionResult =
  | { allowed: true }
  | { allowed: false; reason: "SAME_MODE" | "ON_TO_OFF_FORBIDDEN" | "ACTIVE_RESERVATIONS_PRESENT" | "INVALID_TRANSITION" }

/**
 * Reglas de transición diseñadas (A0.1-9). Pura: el llamador de I4 deberá
 * contar las reservas ACTIVA DENTRO de la misma transacción Serializable que
 * persiste el modo. I1 no persiste ninguna transición.
 *   ON → DRAINING: permitido.
 *   DRAINING → OFF: sólo con activeReservations == 0.
 *   ON → OFF: prohibido (siempre pasar por DRAINING).
 *   OFF → ON: permitido conceptualmente (habilitación en I4).
 *   Cualquier otra (DRAINING → ON, OFF → DRAINING): no definida por A0.1 →
 *   INVALID_TRANSITION hasta que I4 lo decida explícitamente.
 */
export function evaluateStockModeTransition(
  from: StockReservationMode,
  to: StockReservationMode,
  activeReservations: number
): StockModeTransitionResult {
  if (from === to) return { allowed: false, reason: "SAME_MODE" }
  if (from === "ON" && to === "OFF") return { allowed: false, reason: "ON_TO_OFF_FORBIDDEN" }
  if (from === "DRAINING" && to === "OFF") {
    return activeReservations === 0 ? { allowed: true } : { allowed: false, reason: "ACTIVE_RESERVATIONS_PRESENT" }
  }
  if (from === "ON" && to === "DRAINING") return { allowed: true }
  if (from === "OFF" && to === "ON") return { allowed: true }
  return { allowed: false, reason: "INVALID_TRANSITION" }
}
