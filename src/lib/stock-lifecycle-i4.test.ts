// ============================================
// P2-T56-R3A-I4 — autoridad de disponibilidad pública
// ============================================
// - planificarReservaStockPedido con `validarDisponibleEnOff` (decisión 1):
//   en OFF valida el disponible sin crear reservas; sin el flag (Mozo) el OFF
//   de I2 queda intacto. ON/DRAINING sin cambios.
// - StockInsufficientError con detalle por clave (solicitado / disponible).
// - leerReservasActivasPorClave: UNA lectura agrupada (groupBy), sin N+1.
// - resolvePublicProductAvailability: visibilidad de catálogo (decisiones 2/3).
import { describe, expect, test } from "bun:test"
import { Prisma } from "@prisma/client"
import {
  leerReservasActivasPorClave,
  mapStockLifecycleError,
  planificarReservaStockPedido,
  runStockSerializable,
  StockInsufficientError,
  StockReservationsDrainingError,
  type StockOrderLine,
} from "./stock-lifecycle"
import { resolvePublicProductAvailability, stockKey, type PublicStockProductInput } from "./stock-authority"
import { createFakeDb, type FakeDb, type FakeReserva, type FakeState } from "./stock-lifecycle-test-fake"

const N = "negocio-a"
type Tx = Prisma.TransactionClient

function seed(mode: unknown, extra: Partial<FakeState> = {}): FakeDb {
  return createFakeDb({
    config: { clave: "platform", stockReservaModo: mode },
    productos: [
      { id: "p-base", negocioId: N, controlStock: true, stockCantidad: 5 },
      { id: "p-remera", negocioId: N, controlStock: false, stockCantidad: 0 },
      { id: "p-libre", negocioId: N, controlStock: false, stockCantidad: 0 },
    ],
    variantes: [
      { id: "v-a", productoId: "p-remera", controlStock: true, stockCantidad: 5 },
      { id: "v-b", productoId: "p-remera", controlStock: true, stockCantidad: 2 },
    ],
    ...extra,
  })
}

function reserva(overrides: Partial<FakeReserva>): FakeReserva {
  return {
    id: `r-${Math.random()}`,
    negocioId: N,
    pedidoId: "pedido-viejo",
    pedidoItemId: `item-${Math.random()}`,
    productoId: "p-base",
    productoVarianteId: null,
    cantidad: 1,
    estado: "ACTIVA",
    motivoLiberacion: null,
    consumidaEn: null,
    liberadaEn: null,
    ...overrides,
  }
}

function line(overrides: Partial<StockOrderLine> = {}): StockOrderLine {
  return { pedidoItemId: `item-${Math.random()}`, productoId: "p-base", productoVarianteId: null, cantidad: 1, controlStock: true, ...overrides }
}

function plan(fake: FakeDb, lines: StockOrderLine[], validarDisponibleEnOff?: boolean) {
  return runStockSerializable(fake.client as never, (tx: Tx) =>
    planificarReservaStockPedido(tx, { negocioId: N, lines, validarDisponibleEnOff })
  )
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error("se esperaba un rechazo")
}

describe("I4 — planificarReservaStockPedido en modo OFF", () => {
  test("sin el flag (Mozo): OFF de I2 intacto — no valida y no reserva aunque se pida de más", async () => {
    const fake = seed("OFF")
    expect(await plan(fake, [line({ cantidad: 99 })])).toEqual({ reservar: false, mode: "OFF" })
    expect(fake.state.reservas).toHaveLength(0)
  })

  test("con el flag y disponible suficiente: { reservar: false } y cero reservas", async () => {
    const fake = seed("OFF")
    expect(await plan(fake, [line({ cantidad: 5 })], true)).toEqual({ reservar: false, mode: "OFF" })
    expect(fake.state.reservas).toHaveLength(0)
  })

  test("con el flag y cantidad > disponible: StockInsufficientError con claves y detalle", async () => {
    const error = await rejection(plan(seed("OFF"), [line({ cantidad: 6 })], true))
    expect(error).toBeInstanceOf(StockInsufficientError)
    const e = error as StockInsufficientError
    expect(e.keys).toEqual([{ productoId: "p-base", productoVarianteId: null }])
    expect(e.details).toEqual({ lineas: [{ productoId: "p-base", productoVarianteId: null, solicitado: 6, disponible: 5 }] })
  })

  test("variante: la autoridad es la variante (v-b = 2), nunca el producto padre", async () => {
    const error = (await rejection(
      plan(seed("OFF"), [line({ productoId: "p-remera", productoVarianteId: "v-b", cantidad: 3 })], true)
    )) as StockInsufficientError
    expect(error.details).toEqual({
      lineas: [{ productoId: "p-remera", productoVarianteId: "v-b", solicitado: 3, disponible: 2 }],
    })
    expect(await plan(seed("OFF"), [line({ productoId: "p-remera", productoVarianteId: "v-a", cantidad: 5 })], true)).toEqual({
      reservar: false,
      mode: "OFF",
    })
  })

  test("agrega líneas de la misma clave antes de comparar (3 + 3 > 5)", async () => {
    const error = (await rejection(plan(seed("OFF"), [line({ cantidad: 3 }), line({ cantidad: 3 })], true))) as StockInsufficientError
    expect(error.details).toEqual({ lineas: [{ productoId: "p-base", productoVarianteId: null, solicitado: 6, disponible: 5 }] })
  })

  test("sólo las reservas ACTIVA descuentan; CONSUMIDA y LIBERADA no", async () => {
    const fake = seed("OFF", {
      reservas: [
        reserva({ cantidad: 3, estado: "ACTIVA" }),
        reserva({ cantidad: 4, estado: "CONSUMIDA" }),
        reserva({ cantidad: 4, estado: "LIBERADA" }),
      ],
    })
    expect(await plan(fake, [line({ cantidad: 2 })], true)).toEqual({ reservar: false, mode: "OFF" })
    const error = (await rejection(plan(fake, [line({ cantidad: 3 })], true))) as StockInsufficientError
    expect(error.details).toEqual({ lineas: [{ productoId: "p-base", productoVarianteId: null, solicitado: 3, disponible: 2 }] })
  })

  test("líneas sin control de stock nunca se limitan", async () => {
    expect(await plan(seed("OFF"), [line({ productoId: "p-libre", controlStock: false, cantidad: 999 })], true)).toEqual({
      reservar: false,
      mode: "OFF",
    })
  })

  test("producto inexistente/ajeno con el flag → insuficiente con disponible 0", async () => {
    const error = (await rejection(plan(seed("OFF"), [line({ productoId: "p-fantasma" })], true))) as StockInsufficientError
    expect(error.details).toEqual({ lineas: [{ productoId: "p-fantasma", productoVarianteId: null, solicitado: 1, disponible: 0 }] })
  })
})

describe("I4 — ON y DRAINING sin cambios", () => {
  test("ON: reserva las claves controladas validadas (con o sin flag)", async () => {
    for (const flag of [undefined, true]) {
      const result = await plan(seed("ON"), [line({ cantidad: 2 }), line({ productoId: "p-libre", controlStock: false })], flag)
      expect(result).toEqual({ reservar: true, mode: "ON", reservedKeys: new Set([stockKey("p-base", null)]) })
    }
  })

  test("ON: el 409 ahora también trae el detalle por clave", async () => {
    const error = (await rejection(plan(seed("ON"), [line({ cantidad: 6 })]))) as StockInsufficientError
    expect(error.keys).toEqual([{ productoId: "p-base", productoVarianteId: null }])
    expect(error.details).toEqual({ lineas: [{ productoId: "p-base", productoVarianteId: null, solicitado: 6, disponible: 5 }] })
  })

  test("DRAINING: sigue rechazando aunque se pase el flag", async () => {
    expect(await rejection(plan(seed("DRAINING"), [line()], true))).toBeInstanceOf(StockReservationsDrainingError)
  })
})

describe("I4 — StockInsufficientError / mapStockLifecycleError", () => {
  test("sin detalle (compatibilidad): body sin `details`", () => {
    const mapped = mapStockLifecycleError(new StockInsufficientError([{ productoId: "p", productoVarianteId: null }]))
    expect(mapped).toEqual({
      status: 409,
      body: { error: "No hay stock suficiente para uno o más productos del pedido", code: "STOCK_INSUFFICIENT" },
    })
  })

  test("con detalle: body.details.lineas sólo con claves y cantidades (sin reservas ni pedidos)", () => {
    const mapped = mapStockLifecycleError(
      new StockInsufficientError(
        [{ productoId: "p", productoVarianteId: "v" }],
        [{ productoId: "p", productoVarianteId: "v", solicitado: 4, disponible: 1 }]
      )
    )
    expect(mapped?.body.details).toEqual({ lineas: [{ productoId: "p", productoVarianteId: "v", solicitado: 4, disponible: 1 }] })
  })
})

describe("I4 — leerReservasActivasPorClave (una lectura agrupada)", () => {
  function reader(rows: Array<{ productoId: string | null; productoVarianteId: string | null; _sum: { cantidad: number | null } }>) {
    const calls: unknown[] = []
    return {
      calls,
      client: {
        reservaStock: {
          groupBy: async (args: unknown) => {
            calls.push(args)
            return rows
          },
        },
      },
    }
  }

  test("sin negocios → no consulta", async () => {
    const r = reader([])
    expect((await leerReservasActivasPorClave(r.client as never, [])).size).toBe(0)
    expect(r.calls).toHaveLength(0)
  })

  test("una sola consulta groupBy por request, sólo ACTIVA, keyed por stockKey", async () => {
    const r = reader([
      { productoId: "p1", productoVarianteId: null, _sum: { cantidad: 3 } },
      { productoId: "p2", productoVarianteId: "v1", _sum: { cantidad: 1.5 } },
      { productoId: null, productoVarianteId: null, _sum: { cantidad: 9 } },
      { productoId: "p3", productoVarianteId: null, _sum: { cantidad: null } },
    ])
    const map = await leerReservasActivasPorClave(r.client as never, ["n1", "n2"])
    expect(r.calls).toEqual([
      {
        by: ["productoId", "productoVarianteId"],
        where: { negocioId: { in: ["n1", "n2"] }, estado: "ACTIVA", productoId: { not: null } },
        _sum: { cantidad: true },
      },
    ])
    expect([...map.entries()]).toEqual([
      [stockKey("p1", null), 3],
      [stockKey("p2", "v1"), 1.5],
      [stockKey("p3", null), 0],
    ])
  })
})

describe("I4 — resolvePublicProductAvailability (catálogo público, negocio genérico)", () => {
  const base = (overrides: Partial<PublicStockProductInput> = {}): PublicStockProductInput => ({
    id: "p",
    stock: true,
    controlStock: true,
    stockCantidad: 5,
    variantes: [],
    ...overrides,
  })
  const none = new Map<string, number>()

  test("producto base controlado: disponible = físico − ACTIVA; agotado → oculto", () => {
    expect(resolvePublicProductAvailability(base(), new Map([[stockKey("p", null), 2]]))).toEqual({
      visible: true,
      stockDisponible: 3,
      variantesVisibles: [],
    })
    expect(resolvePublicProductAvailability(base(), new Map([[stockKey("p", null), 5]])).visible).toBe(false)
    expect(resolvePublicProductAvailability(base({ stockCantidad: 0 }), none).visible).toBe(false)
  })

  test("sin control de stock: visible con stockDisponible null (sin límite)", () => {
    expect(resolvePublicProductAvailability(base({ controlStock: false, stockCantidad: 0 }), none)).toEqual({
      visible: true,
      stockDisponible: null,
      variantesVisibles: [],
    })
  })

  test("deshabilitado manualmente (stock=false) → oculto aunque tenga unidades", () => {
    expect(resolvePublicProductAvailability(base({ stock: false }), none).visible).toBe(false)
    expect(resolvePublicProductAvailability(base({ stock: false, controlStock: false }), none).visible).toBe(false)
  })

  test("variantes: se ocultan inactivas y agotadas; nunca se mezcla el stock del padre", () => {
    const product = base({
      controlStock: true,
      stockCantidad: 0, // padre dormido: no debe ocultar ni limitar
      variantes: [
        { id: "v-ok", activo: true, controlStock: true, stockCantidad: 4 },
        { id: "v-agotada", activo: true, controlStock: true, stockCantidad: 2 },
        { id: "v-inactiva", activo: false, controlStock: true, stockCantidad: 9 },
        { id: "v-libre", activo: true, controlStock: false, stockCantidad: 0 },
      ],
    })
    const reserved = new Map([
      [stockKey("p", "v-agotada"), 2],
      [stockKey("p", null), 100],
    ])
    expect(resolvePublicProductAvailability(product, reserved)).toEqual({
      visible: true,
      stockDisponible: null,
      variantesVisibles: [
        { id: "v-ok", stockDisponible: 4 },
        { id: "v-libre", stockDisponible: null },
      ],
    })
  })

  test("todas las variantes no disponibles → producto oculto", () => {
    const product = base({
      variantes: [
        { id: "v1", activo: false, controlStock: false, stockCantidad: 0 },
        { id: "v2", activo: true, controlStock: true, stockCantidad: 0 },
      ],
    })
    expect(resolvePublicProductAvailability(product, none)).toEqual({ visible: false, stockDisponible: null, variantesVisibles: [] })
  })
})
