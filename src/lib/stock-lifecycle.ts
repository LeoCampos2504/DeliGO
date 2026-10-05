// ============================================
// P2-T56-R3A-I2 — autoridad TRANSACCIONAL del lifecycle de stock de Pedidos
// ============================================
// Diseño: codex-reports/P2_T56_R3A_ORDER_STOCK_LIFECYCLE_DESIGN.md (A0.1-3,
// A0.1-8, A0.1-9, A0.1-10, A0.1-11, A0.1-12, A0.1-13, A0.1-18).
//
// Reglas que este módulo encapsula para que NINGÚN route las recalcule:
//   - Reserva (al crear): sólo negocio genérico + línea controlada + modo ON.
//     Una reserva nunca cambia stock físico ni crea MovimientoInventario.
//   - Consumo (al pasar a `preparando`): CAS + consumo en la MISMA transacción
//     Serializable; si el físico no alcanza para ESTE pedido, rollback completo
//     (409 STOCK_RESERVATION_DEFICIT) y el Pedido queda en su estado anterior.
//   - Liberación (al cancelar antes del consumo): ACTIVA → LIBERADA, sin tocar
//     el físico. Después del consumo no hay nada ACTIVA → sin restock (I8).
//   - Deuda + liberación viajan juntas en aplicarEfectosCancelacion.
//   - El modo persistido se lee FAIL-CLOSED: un valor inválido nunca es OFF.
//
// Todas las lecturas/escrituras se acotan por negocioId resuelto server-side.

import { Prisma, type PrismaClient } from "@prisma/client"
import { MOVIMIENTO_TIPO_PEDIDO, resolveNextStock } from "@/lib/inventario"
import { PLATFORM_CONFIG_KEY } from "@/lib/platform-settings"
import { revertirTarifaSiCorresponde } from "@/lib/pedido-cancelacion-financiera"
import {
  agregarCantidadesPorClave,
  computeAvailableStock,
  parseStockReservationMode,
  stockKey,
  type ReservaMotivoLiberacion,
  type StockReservationMode,
} from "@/lib/stock-authority"

type Tx = Prisma.TransactionClient

// ---------------------------------------------------------------------------
// Errores de dominio (cada uno se traduce a una respuesta HTTP en
// mapStockLifecycleError; nunca se reintentan).
// ---------------------------------------------------------------------------

export interface StockKeyRef {
  productoId: string
  productoVarianteId: string | null
}

export class StockLifecycleError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string
  ) {
    super(message)
    this.name = "StockLifecycleError"
  }
}

/** Modo ON: lo pedido supera el disponible (físico − reservado) de alguna clave. */
export class StockInsufficientError extends StockLifecycleError {
  constructor(readonly keys: StockKeyRef[]) {
    super("STOCK_INSUFFICIENT", 409, "No hay stock suficiente para uno o más productos del pedido")
  }
}

/** Modo DRAINING: no se aceptan pedidos nuevos con líneas de stock controlado. */
export class StockReservationsDrainingError extends StockLifecycleError {
  constructor() {
    super(
      "STOCK_RESERVATIONS_DRAINING",
      409,
      "Por el momento no se pueden tomar pedidos de productos con stock controlado. Intentá más tarde."
    )
  }
}

/** Valor persistido de ConfigPlataforma.stockReservaModo inválido o ausente: fail-closed. */
export class StockReservationModeInvalidError extends StockLifecycleError {
  constructor() {
    super(
      "STOCK_RESERVATION_MODE_INVALID",
      503,
      "No se pudo validar el stock en este momento. Intentá más tarde."
    )
  }
}

/** Al pasar a preparando, el físico no alcanza para las reservas de ESTE pedido. */
export class StockReservationDeficitError extends StockLifecycleError {
  constructor(readonly keys: StockKeyRef[]) {
    super(
      "STOCK_RESERVATION_DEFICIT",
      409,
      "No hay stock físico suficiente para preparar este pedido. Ajustá el stock e intentá de nuevo."
    )
  }
}

/** Una escritura de reservas no afectó la cantidad esperada de filas (carrera): rollback. */
export class StockReservationIntegrityError extends StockLifecycleError {
  constructor() {
    super("STOCK_RESERVATION_CONFLICT", 409, "El pedido cambió mientras se procesaba. Intentá de nuevo.")
  }
}

// ---------------------------------------------------------------------------
// runStockSerializable — retry acotado sobre conflictos de serialización
// (generaliza el withSerializableRetry del route de Mozo; mismo límite: 3).
// ---------------------------------------------------------------------------

export const STOCK_SERIALIZABLE_MAX_ATTEMPTS = 3

export function isStockSerializationConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034"
}

export interface StockSerializableOptions {
  maxWait?: number
  timeout?: number
}

/**
 * Ejecuta `fn` en una transacción Serializable y la reintenta SÓLO ante un
 * conflicto de serialización (P2034), hasta STOCK_SERIALIZABLE_MAX_ATTEMPTS
 * intentos. Cualquier otro error (de negocio o desconocido) se propaga en el
 * primer intento. Agotados los intentos, se relanza el P2034 original para que
 * el llamador lo traduzca a 409 (mapStockLifecycleError).
 */
export async function runStockSerializable<T>(
  client: Pick<PrismaClient, "$transaction">,
  fn: (tx: Tx) => Promise<T>,
  options: StockSerializableOptions = {}
): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= STOCK_SERIALIZABLE_MAX_ATTEMPTS; attempt++) {
    try {
      return await client.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        ...options,
      })
    } catch (error) {
      if (!isStockSerializationConflict(error)) throw error
      lastError = error
    }
  }
  throw lastError
}

/**
 * Traduce los errores del lifecycle (y el P2034 agotado) a {status, body}. null =
 * no es un error de stock: el llamador conserva su manejo existente.
 */
export function mapStockLifecycleError(
  error: unknown
): { status: number; body: { error: string; code: string } } | null {
  if (error instanceof StockLifecycleError) {
    return { status: error.status, body: { error: error.message, code: error.code } }
  }
  if (isStockSerializationConflict(error)) {
    return {
      status: 409,
      body: { error: "No se pudo completar la operación por un conflicto concurrente. Intentá nuevamente.", code: "STOCK_SERIALIZATION_CONFLICT" },
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Modo (fail-closed)
// ---------------------------------------------------------------------------

type ConfigReader = { configPlataforma: Pick<Tx["configPlataforma"], "findUnique"> }

/**
 * Lee ConfigPlataforma.stockReservaModo. Fila ausente o valor inválido →
 * StockReservationModeInvalidError (nunca OFF).
 */
export async function readStockReservationMode(reader: ConfigReader): Promise<StockReservationMode> {
  const config = await reader.configPlataforma.findUnique({
    where: { clave: PLATFORM_CONFIG_KEY },
    select: { stockReservaModo: true },
  })
  const mode = parseStockReservationMode(config?.stockReservaModo)
  if (mode === null) throw new StockReservationModeInvalidError()
  return mode
}

// ---------------------------------------------------------------------------
// Autoridad física de una clave
// ---------------------------------------------------------------------------

interface StockAuthorityRow {
  controlStock: boolean
  stockCantidad: number
}

async function loadStockAuthority(tx: Tx, negocioId: string, key: StockKeyRef): Promise<StockAuthorityRow | null> {
  if (key.productoVarianteId) {
    return tx.productoVariante.findFirst({
      where: { id: key.productoVarianteId, productoId: key.productoId, producto: { negocioId } },
      select: { controlStock: true, stockCantidad: true },
    })
  }
  return tx.producto.findFirst({
    where: { id: key.productoId, negocioId },
    select: { controlStock: true, stockCantidad: true },
  })
}

async function sumActiveReserved(tx: Tx, negocioId: string, key: StockKeyRef): Promise<number> {
  const agg = await tx.reservaStock.aggregate({
    where: {
      negocioId,
      estado: "ACTIVA",
      productoId: key.productoId,
      productoVarianteId: key.productoVarianteId,
    },
    _sum: { cantidad: true },
  })
  return agg._sum.cantidad ?? 0
}

// ---------------------------------------------------------------------------
// Reserva al crear (A0.1-3)
// ---------------------------------------------------------------------------

/** Una línea del pedido a crear, con su PedidoItem.id ya pre-generado server-side. */
export interface StockOrderLine {
  pedidoItemId: string
  productoId: string
  productoVarianteId: string | null
  cantidad: number
  /** controlStock de la autoridad al validar el pedido (variante si existe, si no Producto). */
  controlStock: boolean
}

export type StockReservationPlan =
  | { reservar: false; mode: StockReservationMode }
  | { reservar: true; mode: "ON"; reservedKeys: ReadonlySet<string> }

/**
 * Pasos 6–7 de A0.1-3, dentro de la transacción del llamador (Serializable
 * cuando puede reservar). Lee el modo (fail-closed): OFF → sin reserva;
 * DRAINING → StockReservationsDrainingError; ON → relee cada autoridad, suma
 * reservas ACTIVA de la clave y valida available >= total agregado; si alguna
 * clave no alcanza → StockInsufficientError. Sólo se llama para negocio
 * genérico con al menos una línea controlada.
 */
export async function planificarReservaStockPedido(
  tx: Tx,
  params: { negocioId: string; lines: ReadonlyArray<StockOrderLine> }
): Promise<StockReservationPlan> {
  const mode = await readStockReservationMode(tx)
  if (mode === "OFF") return { reservar: false, mode }
  if (mode === "DRAINING") throw new StockReservationsDrainingError()

  const totals = agregarCantidadesPorClave(params.lines.filter((line) => line.controlStock))
  const reservedKeys = new Set<string>()
  const insufficient: StockKeyRef[] = []

  for (const total of totals) {
    const key = { productoId: total.productoId, productoVarianteId: total.productoVarianteId }
    const authority = await loadStockAuthority(tx, params.negocioId, key)
    if (!authority) {
      insufficient.push(key)
      continue
    }
    // Lectura fresca: si el control se desactivó entre la validación y esta
    // transacción, la clave ya no tiene límite de inventario → no se reserva.
    if (!authority.controlStock) continue
    const activeReserved = await sumActiveReserved(tx, params.negocioId, key)
    const available = computeAvailableStock(authority.stockCantidad, activeReserved)
    if (total.cantidad > available) {
      insufficient.push(key)
      continue
    }
    reservedKeys.add(stockKey(key.productoId, key.productoVarianteId))
  }

  if (insufficient.length > 0) throw new StockInsufficientError(insufficient)
  return { reservar: true, mode: "ON", reservedKeys }
}

/**
 * Paso 10 de A0.1-3: una ReservaStock ACTIVA por PedidoItem controlado de las
 * claves validadas, en la MISMA transacción que acaba de crear el Pedido.
 * Mapeo determinista por el PedidoItem.id pre-generado (nunca por el orden del
 * array devuelto por Prisma). Devuelve la cantidad de reservas creadas.
 */
export async function reservarStockPedido(
  tx: Tx,
  params: { negocioId: string; pedidoId: string; lines: ReadonlyArray<StockOrderLine>; plan: StockReservationPlan }
): Promise<number> {
  if (!params.plan.reservar) return 0
  const { reservedKeys } = params.plan
  const rows = params.lines
    .filter((line) => line.controlStock && reservedKeys.has(stockKey(line.productoId, line.productoVarianteId)))
    .map((line) => ({
      negocioId: params.negocioId,
      pedidoId: params.pedidoId,
      pedidoItemId: line.pedidoItemId,
      productoId: line.productoId,
      productoVarianteId: line.productoVarianteId,
      cantidad: line.cantidad,
      estado: "ACTIVA",
    }))
  if (rows.length === 0) return 0
  const created = await tx.reservaStock.createMany({ data: rows })
  if (created.count !== rows.length) throw new StockReservationIntegrityError()
  return created.count
}

// ---------------------------------------------------------------------------
// Consumo al pasar a preparando (A0.1-11, A0.1-13)
// ---------------------------------------------------------------------------

export interface ConsumoResultado {
  /** Reservas ACTIVA del pedido pasadas a CONSUMIDA. */
  consumidas: number
  /** Claves cuyo stock físico bajó (una fila MovimientoInventario PEDIDO por clave). */
  movimientos: number
  /** Reservas huérfanas (producto/autoridad inexistente) liberadas sin movimiento. */
  huerfanasLiberadas: number
}

/**
 * Consume las reservas ACTIVA de un pedido. Debe llamarse DESPUÉS de ganar el CAS
 * a `preparando` y dentro de la misma transacción Serializable. Sin reservas
 * (histórico, sin control, creado en OFF) → no-op. Si el físico de una clave no
 * cubre lo reservado por ESTE pedido → StockReservationDeficitError (el llamador
 * hace rollback de todo, CAS incluido). Nunca deja físico negativo.
 */
export async function consumirReservasPedido(
  tx: Tx,
  params: { negocioId: string; pedidoId: string; now?: Date }
): Promise<ConsumoResultado> {
  const now = params.now ?? new Date()
  const reservas = await tx.reservaStock.findMany({
    where: { negocioId: params.negocioId, pedidoId: params.pedidoId, estado: "ACTIVA" },
    select: { id: true, productoId: true, productoVarianteId: true, cantidad: true },
  })
  if (reservas.length === 0) return { consumidas: 0, movimientos: 0, huerfanasLiberadas: 0 }

  // A0.1-8 (defensa): una reserva cuyo Producto ya no existe (productoId SET NULL)
  // se libera sin inventar un movimiento físico para una autoridad inexistente.
  const huerfanas = reservas.filter((r) => r.productoId === null)
  const conProducto = reservas.filter((r): r is typeof r & { productoId: string } => r.productoId !== null)

  const deficit: StockKeyRef[] = []
  const plan: Array<{ key: StockKeyRef; total: number; authority: StockAuthorityRow | null }> = []
  for (const total of agregarCantidadesPorClave(conProducto)) {
    const key = { productoId: total.productoId, productoVarianteId: total.productoVarianteId }
    const authority = await loadStockAuthority(tx, params.negocioId, key)
    if (authority && authority.controlStock && authority.stockCantidad < total.cantidad) deficit.push(key)
    plan.push({ key, total: total.cantidad, authority })
  }
  if (deficit.length > 0) throw new StockReservationDeficitError(deficit)

  let movimientos = 0
  const consumibles: string[] = []
  const sinAutoridad: string[] = huerfanas.map((r) => r.id)
  for (const item of plan) {
    const ids = conProducto
      .filter((r) => stockKey(r.productoId, r.productoVarianteId) === stockKey(item.key.productoId, item.key.productoVarianteId))
      .map((r) => r.id)
    if (!item.authority) {
      // Autoridad desaparecida (p. ej. variante del producto ya no existe): se
      // libera como huérfana, sin movimiento.
      sinAutoridad.push(...ids)
      continue
    }
    consumibles.push(...ids)
    // Control de stock desactivado después de reservar: la reserva se consume
    // (el pedido ya estaba comprometido) pero no hay físico que descontar.
    if (!item.authority.controlStock) continue

    const next = resolveNextStock(item.authority.stockCantidad, MOVIMIENTO_TIPO_PEDIDO, item.total)
    if (!next.ok) throw new StockReservationDeficitError([item.key])

    if (item.key.productoVarianteId) {
      await tx.productoVariante.update({ where: { id: item.key.productoVarianteId }, data: { stockCantidad: next.nextStock } })
    } else {
      await tx.producto.update({ where: { id: item.key.productoId }, data: { stockCantidad: next.nextStock } })
    }
    await tx.movimientoInventario.create({
      data: {
        negocioId: params.negocioId,
        productoId: item.key.productoId,
        productoVarianteId: item.key.productoVarianteId,
        tipo: MOVIMIENTO_TIPO_PEDIDO,
        cantidad: item.total,
        stockAntes: item.authority.stockCantidad,
        stockDespues: next.nextStock,
        motivo: "Pedido → preparando",
        pedidoId: params.pedidoId,
      },
    })
    movimientos++
  }

  if (consumibles.length > 0) {
    const updated = await tx.reservaStock.updateMany({
      where: { id: { in: consumibles }, negocioId: params.negocioId, estado: "ACTIVA" },
      data: { estado: "CONSUMIDA", consumidaEn: now },
    })
    if (updated.count !== consumibles.length) throw new StockReservationIntegrityError()
  }
  if (sinAutoridad.length > 0) {
    const released = await tx.reservaStock.updateMany({
      where: { id: { in: sinAutoridad }, negocioId: params.negocioId, estado: "ACTIVA" },
      data: { estado: "LIBERADA", liberadaEn: now, motivoLiberacion: "PRODUCTO_ELIMINADO" },
    })
    if (released.count !== sinAutoridad.length) throw new StockReservationIntegrityError()
  }

  return { consumidas: consumibles.length, movimientos, huerfanasLiberadas: sinAutoridad.length }
}

/**
 * Autoridad única para TODA transición a `preparando` (los 6 escritores):
 *   1. CAS updateMany({ where: { ...casWhere, id, negocioId }, data }) — id y
 *      negocioId siempre los del servidor, nunca los de casWhere.
 *   2. Si no gana (count !== 1) → { won: false } SIN ningún efecto de stock.
 *   3. Si gana → consumirReservasPedido en la misma transacción.
 * Debe ejecutarse dentro de runStockSerializable.
 */
export async function transicionarAPreparandoConStock(
  tx: Tx,
  params: {
    pedidoId: string
    negocioId: string
    casWhere?: Prisma.PedidoWhereInput
    data: Prisma.PedidoUpdateManyMutationInput
    now?: Date
  }
): Promise<{ won: false } | ({ won: true } & ConsumoResultado)> {
  const cas = await tx.pedido.updateMany({
    where: { ...(params.casWhere ?? {}), id: params.pedidoId, negocioId: params.negocioId },
    data: params.data,
  })
  if (cas.count !== 1) return { won: false }
  const consumo = await consumirReservasPedido(tx, { negocioId: params.negocioId, pedidoId: params.pedidoId, now: params.now })
  return { won: true, ...consumo }
}

// ---------------------------------------------------------------------------
// Liberación y cancelación (A0.1-12)
// ---------------------------------------------------------------------------

/**
 * ReservaStock ACTIVA del pedido → LIBERADA. count = 0 es válido (sin control,
 * histórico, creado en OFF, o ya consumido). Nunca toca el físico ni crea
 * MovimientoInventario.
 */
export async function liberarReservasPedido(
  tx: Tx,
  params: { negocioId: string; pedidoId: string; motivo: ReservaMotivoLiberacion; now?: Date }
): Promise<number> {
  const result = await tx.reservaStock.updateMany({
    where: { negocioId: params.negocioId, pedidoId: params.pedidoId, estado: "ACTIVA" },
    data: { estado: "LIBERADA", liberadaEn: params.now ?? new Date(), motivoLiberacion: params.motivo },
  })
  return result.count
}

/**
 * Autoridad única de los efectos de una cancelación ya ganada por CAS (los 6
 * sitios): reversión de deuda existente + liberación de reservas ACTIVA, en la
 * misma transacción. Después del consumo no queda nada ACTIVA → no hay restock
 * automático (NO_AUTOMATIC_RESTOCK_AFTER_CONSUMPTION).
 */
export async function aplicarEfectosCancelacion(
  tx: Tx,
  params: { pedidoId: string; negocioId: string; motivo: ReservaMotivoLiberacion }
): Promise<{ reservasLiberadas: number }> {
  await revertirTarifaSiCorresponde(tx, { id: params.pedidoId, negocioId: params.negocioId })
  const reservasLiberadas = await liberarReservasPedido(tx, {
    negocioId: params.negocioId,
    pedidoId: params.pedidoId,
    motivo: params.motivo,
  })
  return { reservasLiberadas }
}

// ---------------------------------------------------------------------------
// Guard de borrado de Producto (A0.1-8)
// ---------------------------------------------------------------------------

/** Cantidad de reservas ACTIVA que todavía referencian un Producto del negocio. */
export async function contarReservasActivasProducto(
  reader: { reservaStock: Pick<Tx["reservaStock"], "count"> },
  params: { negocioId: string; productoId: string }
): Promise<number> {
  return reader.reservaStock.count({
    where: { negocioId: params.negocioId, productoId: params.productoId, estado: "ACTIVA" },
  })
}
