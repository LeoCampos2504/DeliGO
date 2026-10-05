// P2-T56-R3A-I2 — autoridad transaccional del lifecycle de stock.
// Fake Prisma en memoria con rollback real (stock-lifecycle-test-fake.ts). La
// concurrencia SSI real de Postgres queda para la integración en TESTING.
import { describe, expect, test } from "bun:test"
import { Prisma } from "@prisma/client"
import {
  aplicarEfectosCancelacion,
  consumirReservasPedido,
  contarReservasActivasProducto,
  isStockSerializationConflict,
  liberarReservasPedido,
  mapStockLifecycleError,
  planificarReservaStockPedido,
  readStockReservationMode,
  reservarStockPedido,
  runStockSerializable,
  STOCK_SERIALIZABLE_MAX_ATTEMPTS,
  StockInsufficientError,
  StockReservationDeficitError,
  StockReservationModeInvalidError,
  StockReservationsDrainingError,
  transicionarAPreparandoConStock,
  type StockOrderLine,
} from "./stock-lifecycle"
import { createFakeDb, p2034, type FakeDb, type FakeState } from "./stock-lifecycle-test-fake"
import { isGenericBusinessStockScope } from "./stock-authority"
import { isValidMovimientoTipo, resolveNextStock } from "./inventario"

const N = "negocio-a"
const OTRO = "negocio-b"
type Tx = Prisma.TransactionClient

function seed(mode: unknown = "ON", extra: Partial<FakeState> = {}): FakeDb {
  return createFakeDb({
    config: { clave: "platform", stockReservaModo: mode },
    productos: [
      { id: "p-base", negocioId: N, controlStock: true, stockCantidad: 5 },
      { id: "p-remera", negocioId: N, controlStock: false, stockCantidad: 0 },
      { id: "p-libre", negocioId: N, controlStock: false, stockCantidad: 0 },
      { id: "p-ajeno", negocioId: OTRO, controlStock: true, stockCantidad: 100 },
    ],
    variantes: [
      { id: "v-a", productoId: "p-remera", controlStock: true, stockCantidad: 5 },
      { id: "v-b", productoId: "p-remera", controlStock: true, stockCantidad: 2 },
      { id: "v-ajena", productoId: "p-ajeno", controlStock: true, stockCantidad: 100 },
    ],
    ...extra,
  })
}

function line(overrides: Partial<StockOrderLine> & { pedidoItemId: string }): StockOrderLine {
  return { productoId: "p-base", productoVarianteId: null, cantidad: 1, controlStock: true, ...overrides }
}

/** Simula la creación del route: plan + Pedido con ids pre-generados + reservas, en una tx. */
async function crearPedido(fake: FakeDb, pedidoId: string, lines: StockOrderLine[], negocioId = N) {
  return runStockSerializable(fake.client as never, async (tx: Tx) => {
    const plan = await planificarReservaStockPedido(tx, { negocioId, lines })
    await tx.pedido.create({
      data: { id: pedidoId, negocioId, estado: "recibido", items: { create: lines.map((l) => ({ id: l.pedidoItemId })) } } as never,
    })
    const reservas = await reservarStockPedido(tx, { negocioId, pedidoId, lines, plan })
    return { plan, reservas }
  })
}

async function preparar(fake: FakeDb, pedidoId: string, from = "recibido", negocioId = N) {
  return runStockSerializable(fake.client as never, (tx: Tx) =>
    transicionarAPreparandoConStock(tx, { pedidoId, negocioId, casWhere: { estado: from }, data: { estado: "preparando" } })
  )
}

async function cancelar(fake: FakeDb, pedidoId: string, motivo: "CANCELADO_CLIENTE" | "CANCELADO_SISTEMA" = "CANCELADO_CLIENTE", negocioId = N) {
  return (fake.client.$transaction as (fn: (tx: Tx) => Promise<unknown>) => Promise<unknown>)(async (tx: Tx) => {
    const cas = await tx.pedido.updateMany({ where: { id: pedidoId, negocioId, estado: { in: ["recibido", "aceptado", "preparando"] } }, data: { estado: "cancelado" } })
    if (cas.count !== 1) return { won: false as const }
    const r = await aplicarEfectosCancelacion(tx, { pedidoId, negocioId, motivo })
    return { won: true as const, ...r }
  }) as Promise<{ won: false } | { won: true; reservasLiberadas: number }>
}

const stockOf = (fake: FakeDb, id: string) =>
  fake.state.productos.find((p) => p.id === id)?.stockCantidad ?? fake.state.variantes.find((v) => v.id === id)?.stockCantidad

describe("runStockSerializable (I2-A … I2-D)", () => {
  test("I2-A: éxito al primer intento, con isolationLevel Serializable", async () => {
    const fake = seed()
    const r = await runStockSerializable(fake.client as never, async () => "ok")
    expect(r).toBe("ok")
    expect(fake.transactionCount).toBe(1)
    expect(fake.isolationLevels).toEqual([Prisma.TransactionIsolationLevel.Serializable])
  })

  test("I2-B: P2034 → reintenta y tiene éxito", async () => {
    let calls = 0
    const client = { $transaction: async (fn: (tx: unknown) => Promise<unknown>) => { calls++; if (calls < 3) throw p2034(); return fn({}) } }
    expect(await runStockSerializable(client as never, async () => "ok")).toBe("ok")
    expect(calls).toBe(3)
  })

  test("I2-C: agotados los intentos relanza el P2034 (traducible a 409), sin retry infinito", async () => {
    let calls = 0
    const client = { $transaction: async () => { calls++; throw p2034() } }
    const error = await runStockSerializable(client as never, async () => "x").catch((e) => e)
    expect(isStockSerializationConflict(error)).toBe(true)
    expect(calls).toBe(STOCK_SERIALIZABLE_MAX_ATTEMPTS)
    expect(mapStockLifecycleError(error)).toEqual({ status: 409, body: expect.objectContaining({ code: "STOCK_SERIALIZATION_CONFLICT" }) })
  })

  test("I2-D: un error de negocio no se reintenta; uno desconocido se propaga", async () => {
    let calls = 0
    const businessClient = { $transaction: async () => { calls++; throw new StockInsufficientError([]) } }
    await expect(runStockSerializable(businessClient as never, async () => 1)).rejects.toBeInstanceOf(StockInsufficientError)
    expect(calls).toBe(1)
    calls = 0
    const unknownClient = { $transaction: async () => { calls++; throw new Error("boom") } }
    await expect(runStockSerializable(unknownClient as never, async () => 1)).rejects.toThrow("boom")
    expect(calls).toBe(1)
    expect(mapStockLifecycleError(new Error("boom"))).toBeNull()
  })
})

describe("modo fail-closed (I2-AF) y scope (I2-E, I2-F)", () => {
  test("I2-AF: modo inválido / fila ausente → error explícito, nunca OFF", async () => {
    for (const invalid of ["garbage", "off", "", null, 3]) {
      const fake = seed(invalid)
      await expect(readStockReservationMode(fake.client as never)).rejects.toBeInstanceOf(StockReservationModeInvalidError)
      await expect(crearPedido(fake, "p1", [line({ pedidoItemId: "i1" })])).rejects.toBeInstanceOf(StockReservationModeInvalidError)
      expect(fake.state.pedidos).toHaveLength(0)
      expect(fake.state.reservas).toHaveLength(0)
    }
    const sinConfig = createFakeDb({ config: null })
    await expect(readStockReservationMode(sinConfig.client as never)).rejects.toBeInstanceOf(StockReservationModeInvalidError)
    expect(mapStockLifecycleError(new StockReservationModeInvalidError())?.body.code).toBe("STOCK_RESERVATION_MODE_INVALID")
  })

  test("I2-E / I2-F: restaurante y ropa quedan fuera del scope (el route nunca entra al camino de stock)", () => {
    expect(isGenericBusinessStockScope("restaurante")).toBe(false)
    expect(isGenericBusinessStockScope("ropa")).toBe(false)
    expect(isGenericBusinessStockScope("negocio")).toBe(true)
  })
})

describe("reserva al crear (I2-G … I2-Q)", () => {
  test("I2-G: modo OFF → pedido creado SIN reserva y sin validación nueva (aunque no haya stock)", async () => {
    const fake = seed("OFF")
    const r = await crearPedido(fake, "p1", [line({ pedidoItemId: "i1", cantidad: 999 })])
    expect(r.plan.reservar).toBe(false)
    expect(r.reservas).toBe(0)
    expect(fake.state.pedidos).toHaveLength(1)
    expect(fake.state.reservas).toHaveLength(0)
    expect(stockOf(fake, "p-base")).toBe(5)
  })

  test("I2-H: modo DRAINING + línea controlada → 409 STOCK_RESERVATIONS_DRAINING, cero pedido", async () => {
    const fake = seed("DRAINING")
    const error = await crearPedido(fake, "p1", [line({ pedidoItemId: "i1" })]).catch((e) => e)
    expect(error).toBeInstanceOf(StockReservationsDrainingError)
    expect(mapStockLifecycleError(error)).toEqual({ status: 409, body: expect.objectContaining({ code: "STOCK_RESERVATIONS_DRAINING" }) })
    expect(fake.state.pedidos).toHaveLength(0)
  })

  test("I2-I + I2-J: modo ON + stock suficiente (producto base) → reserva ACTIVA; físico intacto; sin movimiento", async () => {
    const fake = seed("ON")
    await crearPedido(fake, "p1", [line({ pedidoItemId: "i1", cantidad: 3 })])
    expect(fake.state.reservas).toEqual([expect.objectContaining({ pedidoId: "p1", pedidoItemId: "i1", productoId: "p-base", productoVarianteId: null, cantidad: 3, estado: "ACTIVA", negocioId: N })])
    expect(stockOf(fake, "p-base")).toBe(5)
    expect(fake.state.movimientos).toHaveLength(0)
  })

  test("I2-K: variante controlada → reserva con productoVarianteId", async () => {
    const fake = seed("ON")
    await crearPedido(fake, "p1", [line({ pedidoItemId: "i1", productoId: "p-remera", productoVarianteId: "v-a", cantidad: 2 })])
    expect(fake.state.reservas[0]).toEqual(expect.objectContaining({ productoId: "p-remera", productoVarianteId: "v-a", cantidad: 2 }))
  })

  test("I2-L: controlStock=false → sin reserva (en la misma orden que una línea controlada)", async () => {
    const fake = seed("ON")
    await crearPedido(fake, "p1", [line({ pedidoItemId: "i1", productoId: "p-libre", controlStock: false, cantidad: 50 }), line({ pedidoItemId: "i2" })])
    expect(fake.state.reservas.map((r) => r.pedidoItemId)).toEqual(["i2"])
  })

  test("I2-M: líneas duplicadas de la misma clave se validan por el TOTAL (3 + 3 > 5 → 409)", async () => {
    const fake = seed("ON")
    const error = await crearPedido(fake, "p1", [line({ pedidoItemId: "i1", cantidad: 3 }), line({ pedidoItemId: "i2", cantidad: 3 })]).catch((e) => e)
    expect(error).toBeInstanceOf(StockInsufficientError)
    expect(fake.state.pedidos).toHaveLength(0)
    const ok = seed("ON")
    await crearPedido(ok, "p1", [line({ pedidoItemId: "i1", cantidad: 2 }), line({ pedidoItemId: "i2", cantidad: 3 })])
    expect(ok.state.reservas.map((r) => [r.pedidoItemId, r.cantidad])).toEqual([["i1", 2], ["i2", 3]])
  })

  test("I2-N: dos variantes distintas se validan por separado (A=5 ok, B=2 ok)", async () => {
    const fake = seed("ON")
    await crearPedido(fake, "p1", [
      line({ pedidoItemId: "i1", productoId: "p-remera", productoVarianteId: "v-a", cantidad: 5 }),
      line({ pedidoItemId: "i2", productoId: "p-remera", productoVarianteId: "v-b", cantidad: 2 }),
    ])
    expect(fake.state.reservas).toHaveLength(2)
  })

  test("I2-O: disponible insuficiente considerando reservas ACTIVA previas → 409, cero Pedido y cero ReservaStock", async () => {
    const fake = seed("ON")
    await crearPedido(fake, "p1", [line({ pedidoItemId: "i1", cantidad: 4 })])
    const error = await crearPedido(fake, "p2", [line({ pedidoItemId: "i2", cantidad: 2 })]).catch((e) => e)
    expect(error).toBeInstanceOf(StockInsufficientError)
    expect((error as StockInsufficientError).keys).toEqual([{ productoId: "p-base", productoVarianteId: null }])
    expect(fake.state.pedidos.map((p) => p.id)).toEqual(["p1"])
    expect(fake.state.reservas.map((r) => r.pedidoId)).toEqual(["p1"])
  })

  test("I2-P: si falla la creación de la reserva, el Pedido hace rollback", async () => {
    const fake = seed("ON")
    fake.failNextReservaCreate = true
    await expect(crearPedido(fake, "p1", [line({ pedidoItemId: "i1" })])).rejects.toThrow("SIMULATED_RESERVA_CREATE_FAILURE")
    expect(fake.state.pedidos).toHaveLength(0)
    expect(fake.state.reservas).toHaveLength(0)
  })

  test("I2-Q: una reserva duplicada para el mismo PedidoItem es imposible (@@unique pedidoItemId) y revierte todo", async () => {
    const fake = seed("ON")
    await crearPedido(fake, "p1", [line({ pedidoItemId: "i1" })])
    await expect(crearPedido(fake, "p2", [line({ pedidoItemId: "i1" })])).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError)
    expect(fake.state.reservas).toHaveLength(1)
    expect(fake.state.pedidos.map((p) => p.id)).toEqual(["p1"])
  })

  test("mapeo determinista: cada reserva apunta al PedidoItem.id pre-generado de SU línea, aunque las líneas sean idénticas", async () => {
    const fake = seed("ON")
    await crearPedido(fake, "p1", [line({ pedidoItemId: "uuid-1", cantidad: 1 }), line({ pedidoItemId: "uuid-2", cantidad: 1 })])
    expect(fake.state.reservas.map((r) => r.pedidoItemId).sort()).toEqual(["uuid-1", "uuid-2"])
    expect(fake.state.pedidos[0].items.map((i) => i.id).sort()).toEqual(["uuid-1", "uuid-2"])
  })
})

describe("consumo al pasar a preparando (I2-R … I2-X)", () => {
  test("I2-R: si el CAS pierde → won=false y CERO efecto de stock", async () => {
    const fake = seed("ON")
    await crearPedido(fake, "p1", [line({ pedidoItemId: "i1", cantidad: 2 })])
    const r = await preparar(fake, "p1", "aceptado")
    expect(r.won).toBe(false)
    expect(stockOf(fake, "p-base")).toBe(5)
    expect(fake.state.reservas[0].estado).toBe("ACTIVA")
    expect(fake.state.movimientos).toHaveLength(0)
  })

  test("I2-S / I2-AB: pedido sin reservas (histórico / creado en OFF) → transición normal", async () => {
    const fake = seed("OFF")
    await crearPedido(fake, "p1", [line({ pedidoItemId: "i1", cantidad: 2 })])
    const r = await preparar(fake, "p1")
    expect(r).toEqual({ won: true, consumidas: 0, movimientos: 0, huerfanasLiberadas: 0 })
    expect(fake.state.pedidos[0].estado).toBe("preparando")
    expect(stockOf(fake, "p-base")).toBe(5)
  })

  test("I2-T + I2-U + I2-V: consumo decrementa físico una vez, un MovimientoInventario PEDIDO por clave, ACTIVA→CONSUMIDA", async () => {
    const fake = seed("ON")
    await crearPedido(fake, "p1", [
      line({ pedidoItemId: "i1", cantidad: 2 }),
      line({ pedidoItemId: "i2", cantidad: 1 }),
      line({ pedidoItemId: "i3", productoId: "p-remera", productoVarianteId: "v-a", cantidad: 3 }),
    ])
    const r = await preparar(fake, "p1")
    expect(r).toEqual({ won: true, consumidas: 3, movimientos: 2, huerfanasLiberadas: 0 })
    expect(stockOf(fake, "p-base")).toBe(2)
    expect(stockOf(fake, "v-a")).toBe(2)
    expect(fake.state.movimientos).toEqual([
      { negocioId: N, productoId: "p-base", productoVarianteId: null, tipo: "PEDIDO", cantidad: 3, stockAntes: 5, stockDespues: 2, motivo: "Pedido → preparando", pedidoId: "p1" },
      { negocioId: N, productoId: "p-remera", productoVarianteId: "v-a", tipo: "PEDIDO", cantidad: 3, stockAntes: 5, stockDespues: 2, motivo: "Pedido → preparando", pedidoId: "p1" },
    ])
    expect(fake.state.reservas.every((res) => res.estado === "CONSUMIDA" && res.consumidaEn instanceof Date)).toBe(true)
    expect(fake.isolationLevels.at(-1)).toBe(Prisma.TransactionIsolationLevel.Serializable)
  })

  test("I2-W: físico insuficiente al preparar → 409 STOCK_RESERVATION_DEFICIT y rollback de estado/stock/reserva/movimiento", async () => {
    const fake = seed("ON")
    await crearPedido(fake, "p1", [line({ pedidoItemId: "i1", cantidad: 4 })])
    fake.state.productos.find((p) => p.id === "p-base")!.stockCantidad = 1 // AJUSTE manual a la verdad física
    const error = await preparar(fake, "p1").catch((e) => e)
    expect(error).toBeInstanceOf(StockReservationDeficitError)
    expect(mapStockLifecycleError(error)).toEqual({ status: 409, body: expect.objectContaining({ code: "STOCK_RESERVATION_DEFICIT" }) })
    expect(fake.state.pedidos[0].estado).toBe("recibido")
    expect(stockOf(fake, "p-base")).toBe(1)
    expect(fake.state.reservas[0].estado).toBe("ACTIVA")
    expect(fake.state.movimientos).toHaveLength(0)
  })

  test("I2-X: doble → preparando → un solo consumo (el segundo CAS pierde)", async () => {
    const fake = seed("ON")
    await crearPedido(fake, "p1", [line({ pedidoItemId: "i1", cantidad: 2 })])
    const [a, b] = [await preparar(fake, "p1"), await preparar(fake, "p1")]
    expect([a.won, b.won]).toEqual([true, false])
    expect(stockOf(fake, "p-base")).toBe(3)
    expect(fake.state.movimientos).toHaveLength(1)
  })

  test("reserva huérfana (producto borrado → productoId null) se libera PRODUCTO_ELIMINADO, sin movimiento", async () => {
    const fake = seed("ON")
    await crearPedido(fake, "p1", [line({ pedidoItemId: "i1", cantidad: 2 })])
    fake.state.reservas[0].productoId = null
    const r = await preparar(fake, "p1")
    expect(r).toEqual({ won: true, consumidas: 0, movimientos: 0, huerfanasLiberadas: 1 })
    expect(fake.state.reservas[0]).toEqual(expect.objectContaining({ estado: "LIBERADA", motivoLiberacion: "PRODUCTO_ELIMINADO" }))
    expect(fake.state.movimientos).toHaveLength(0)
  })

  test("control de stock desactivado después de reservar: se consume la reserva sin descontar físico", async () => {
    const fake = seed("ON")
    await crearPedido(fake, "p1", [line({ pedidoItemId: "i1", cantidad: 2 })])
    fake.state.productos.find((p) => p.id === "p-base")!.controlStock = false
    const r = await preparar(fake, "p1")
    expect(r).toEqual({ won: true, consumidas: 1, movimientos: 0, huerfanasLiberadas: 0 })
    expect(stockOf(fake, "p-base")).toBe(5)
  })
})

describe("liberación / cancelación (I2-Y … I2-AA)", () => {
  test("I2-Y: cancelación antes de preparar → ACTIVA→LIBERADA con motivo, físico intacto, sin movimiento", async () => {
    const fake = seed("ON")
    await crearPedido(fake, "p1", [line({ pedidoItemId: "i1", cantidad: 3 })])
    const r = await cancelar(fake, "p1", "CANCELADO_CLIENTE")
    expect(r).toEqual({ won: true, reservasLiberadas: 1 })
    expect(fake.state.reservas[0]).toEqual(expect.objectContaining({ estado: "LIBERADA", motivoLiberacion: "CANCELADO_CLIENTE" }))
    expect(fake.state.reservas[0].liberadaEn).toBeInstanceOf(Date)
    expect(stockOf(fake, "p-base")).toBe(5)
    expect(fake.state.movimientos).toHaveLength(0)
    // El disponible vuelve a 5: un pedido nuevo de 5 entra.
    await crearPedido(fake, "p2", [line({ pedidoItemId: "i2", cantidad: 5 })])
  })

  test("I2-Z: doble cancelación → liberación exactly-once", async () => {
    const fake = seed("ON")
    await crearPedido(fake, "p1", [line({ pedidoItemId: "i1", cantidad: 3 })])
    const a = await cancelar(fake, "p1")
    const b = await cancelar(fake, "p1")
    expect(a).toEqual({ won: true, reservasLiberadas: 1 })
    expect(b).toEqual({ won: false })
    expect(await liberarReservasPedido(fake.client as never, { negocioId: N, pedidoId: "p1", motivo: "CANCELADO_CLIENTE" })).toBe(0)
  })

  test("I2-AA: cancelación después del consumo (incl. auto-cancel del sistema) → sin restock", async () => {
    const fake = seed("ON")
    await crearPedido(fake, "p1", [line({ pedidoItemId: "i1", cantidad: 3 })])
    await preparar(fake, "p1")
    expect(stockOf(fake, "p-base")).toBe(2)
    const r = await cancelar(fake, "p1", "CANCELADO_SISTEMA")
    expect(r).toEqual({ won: true, reservasLiberadas: 0 })
    expect(stockOf(fake, "p-base")).toBe(2)
    expect(fake.state.reservas[0].estado).toBe("CONSUMIDA")
    expect(fake.state.movimientos.map((m) => m.tipo)).toEqual(["PEDIDO"])
  })

  test("I2-AB: pedido histórico sin reservas → cancelar mantiene compatibilidad (deuda sí, liberación 0)", async () => {
    const fake = seed("OFF")
    await crearPedido(fake, "p1", [line({ pedidoItemId: "i1" })])
    expect(await cancelar(fake, "p1")).toEqual({ won: true, reservasLiberadas: 0 })
  })
})

describe("guard de borrado de producto (I2-AC, I2-AD)", () => {
  test("I2-AC: producto con reserva ACTIVA → cuenta > 0 (el route responde 409)", async () => {
    const fake = seed("ON")
    await crearPedido(fake, "p1", [line({ pedidoItemId: "i1" })])
    expect(await contarReservasActivasProducto(fake.client as never, { negocioId: N, productoId: "p-base" })).toBe(1)
  })

  test("I2-AD: sólo reservas históricas (CONSUMIDA/LIBERADA) no bloquean", async () => {
    const fake = seed("ON")
    await crearPedido(fake, "p1", [line({ pedidoItemId: "i1" })])
    await crearPedido(fake, "p2", [line({ pedidoItemId: "i2" })])
    await preparar(fake, "p1")
    await cancelar(fake, "p2")
    expect(await contarReservasActivasProducto(fake.client as never, { negocioId: N, productoId: "p-base" })).toBe(0)
  })
})

describe("PEDIDO system-only (I2-AE) y tenant isolation", () => {
  test("I2-AE: PEDIDO resta en resolveNextStock pero sigue inválido para el endpoint manual", () => {
    expect(resolveNextStock(5, "PEDIDO", 2)).toEqual({ ok: true, nextStock: 3 })
    expect(resolveNextStock(1, "PEDIDO", 2)).toEqual({ ok: false, error: "El movimiento dejaría el stock en negativo" })
    expect(isValidMovimientoTipo("PEDIDO")).toBe(false)
  })

  test("tenant: el negocio A no puede reservar producto ni variante del negocio B", async () => {
    const fake = seed("ON")
    await expect(crearPedido(fake, "p1", [line({ pedidoItemId: "i1", productoId: "p-ajeno" })])).rejects.toBeInstanceOf(StockInsufficientError)
    await expect(crearPedido(fake, "p2", [line({ pedidoItemId: "i2", productoId: "p-remera", productoVarianteId: "v-ajena" })])).rejects.toBeInstanceOf(StockInsufficientError)
    expect(fake.state.reservas).toHaveLength(0)
  })

  test("tenant: la disponibilidad nunca suma reservas de otro negocio", async () => {
    const fake = seed("ON", {
      reservas: [{ id: "r-x", negocioId: OTRO, pedidoId: "px", pedidoItemId: "ix", productoId: "p-base", productoVarianteId: null, cantidad: 5, estado: "ACTIVA", motivoLiberacion: null, consumidaEn: null, liberadaEn: null }],
    })
    await crearPedido(fake, "p1", [line({ pedidoItemId: "i1", cantidad: 5 })])
    expect(fake.state.reservas.filter((r) => r.negocioId === N)).toHaveLength(1)
  })

  test("tenant: preparar/cancelar un pedido de otro negocio no gana el CAS ni toca reservas ajenas", async () => {
    const fake = seed("ON")
    await crearPedido(fake, "p1", [line({ pedidoItemId: "i1", cantidad: 2 })])
    expect((await preparar(fake, "p1", "recibido", OTRO)).won).toBe(false)
    expect((await cancelar(fake, "p1", "CANCELADO_CLIENTE", OTRO)).won).toBe(false)
    expect(await liberarReservasPedido(fake.client as never, { negocioId: OTRO, pedidoId: "p1", motivo: "CANCELADO_CLIENTE" })).toBe(0)
    expect(fake.state.reservas[0].estado).toBe("ACTIVA")
    expect(stockOf(fake, "p-base")).toBe(5)
  })

  test("consumirReservasPedido sin reservas es no-op", async () => {
    const fake = seed("ON")
    expect(await consumirReservasPedido(fake.client as never, { negocioId: N, pedidoId: "nada" })).toEqual({ consumidas: 0, movimientos: 0, huerfanasLiberadas: 0 })
  })
})
