// ============================================
// P2-T56-R3A-I3 — autoridad de Caja y Movimientos manuales con reservas ACTIVA
// ============================================
// Contra el fake en memoria de la autoridad (rollback real por snapshot en
// $transaction). Las reservas se siembran en memoria — nunca en una DB real —
// porque el modo de TESTING sigue en OFF y la certificación con reservas
// reales es de I5. Cubre: disponible = max(0, físico − ACTIVA), CONSUMIDA y
// LIBERADA no cuentan, agregación por clave en Caja (Decisión C), 409
// STOCK_RESERVED_FOR_ORDERS vs STOCK_INSUFFICIENT (Decisión B), ENTRADA,
// SALIDA bloqueada por reservas, AJUSTE con confirmación previa por huella
// (Decisión A) e independencia del modo.
import { describe, expect, test } from "bun:test"
import { Prisma } from "@prisma/client"
import {
  huellaAjusteDeficitario,
  leerDisponibilidadStock,
  mapStockLifecycleError,
  planificarMovimientoManual,
  planificarStockVentaCaja,
  registrarMovimientoManual,
  registrarStockVentaCaja,
  runStockSerializable,
  StockPhysicalInsufficientError,
  StockReservedForOrdersError,
  type MovimientoManualTipo,
  type VentaCajaStockLine,
} from "./stock-lifecycle"
import { createFakeDb, p2034, type FakeDb, type FakeReserva, type FakeState } from "./stock-lifecycle-test-fake"

const N = "negocio-a"
const OTRO = "negocio-b"
type Tx = Prisma.TransactionClient

function reserva(overrides: Partial<FakeReserva>): FakeReserva {
  return {
    id: `r-${Math.random().toString(36).slice(2)}`,
    negocioId: N,
    pedidoId: "pedido-1",
    pedidoItemId: `pi-${Math.random().toString(36).slice(2)}`,
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

/** Escenario de la tarea: físico 10, reservas ACTIVA 7 → disponible 3. */
function seed(extra: Partial<FakeState> = {}, mode: unknown = "OFF"): FakeDb {
  return createFakeDb({
    config: { clave: "platform", stockReservaModo: mode },
    productos: [
      { id: "p-base", negocioId: N, controlStock: true, stockCantidad: 10 },
      { id: "p-remera", negocioId: N, controlStock: false, stockCantidad: 0 },
      { id: "p-libre", negocioId: N, controlStock: false, stockCantidad: 0 },
      { id: "p-ajeno", negocioId: OTRO, controlStock: true, stockCantidad: 100 },
    ],
    variantes: [
      { id: "v-a", productoId: "p-remera", controlStock: true, stockCantidad: 6 },
      { id: "v-b", productoId: "p-remera", controlStock: true, stockCantidad: 2 },
    ],
    reservas: [reserva({ cantidad: 4 }), reserva({ cantidad: 3, pedidoId: "pedido-2" })],
    ...extra,
  })
}

const stockOf = (fake: FakeDb, id: string) =>
  fake.state.productos.find((p) => p.id === id)?.stockCantidad ?? fake.state.variantes.find((v) => v.id === id)?.stockCantidad

const cajaLine = (overrides: Partial<VentaCajaStockLine> = {}): VentaCajaStockLine => ({
  productoId: "p-base",
  productoVarianteId: null,
  cantidad: 1,
  controlStock: true,
  nombre: "Coca-Cola",
  ...overrides,
})

/** Simula el route de Caja: plan + Venta (fake: sin tabla) + descuento/movimiento, en una tx. */
async function vender(fake: FakeDb, lines: VentaCajaStockLine[], negocioId = N) {
  return runStockSerializable(fake.client as never, async (tx: Tx) => {
    const plan = await planificarStockVentaCaja(tx, { negocioId, lines })
    await registrarStockVentaCaja(tx, { negocioId, ventaId: "venta-1", plan })
    return plan
  })
}

/** Simula el route de Movimientos: plan + escritura sólo si corresponde. */
async function mover(
  fake: FakeDb,
  tipo: MovimientoManualTipo,
  cantidad: number,
  opts: { key?: { productoId: string; productoVarianteId: string | null }; huella?: string | null; negocioId?: string } = {}
) {
  const negocioId = opts.negocioId ?? N
  const key = opts.key ?? { productoId: "p-base", productoVarianteId: null }
  return runStockSerializable(fake.client as never, async (tx: Tx) => {
    const plan = await planificarMovimientoManual(tx, { negocioId, key, tipo, cantidad, huellaConfirmada: opts.huella ?? null })
    if (plan.kind === "confirm") return plan
    await registrarMovimientoManual(tx, { negocioId, key, tipo, cantidad, motivo: null, plan })
    return plan
  })
}

describe("disponibilidad (I3) — una sola autoridad", () => {
  test("disponible = max(0, físico − ACTIVA); déficit separado; CONSUMIDA y LIBERADA no cuentan", async () => {
    const fake = seed({
      reservas: [
        reserva({ cantidad: 4 }),
        reserva({ cantidad: 3 }),
        reserva({ cantidad: 50, estado: "CONSUMIDA" }),
        reserva({ cantidad: 50, estado: "LIBERADA" }),
      ],
    })
    const d = await runStockSerializable(fake.client as never, (tx: Tx) =>
      leerDisponibilidadStock(tx, { negocioId: N, key: { productoId: "p-base", productoVarianteId: null } })
    )
    expect(d).toEqual(expect.objectContaining({ physical: 10, activeReserved: 7, available: 3, deficit: 0, controlStock: true }))
  })

  test("las reservas de una variante no restan al producto base ni a otra variante (claves exactas)", async () => {
    const fake = seed({ reservas: [reserva({ productoId: "p-remera", productoVarianteId: "v-a", cantidad: 5 })] })
    const [base, va, vb] = await runStockSerializable(fake.client as never, (tx: Tx) =>
      Promise.all([
        leerDisponibilidadStock(tx, { negocioId: N, key: { productoId: "p-base", productoVarianteId: null } }),
        leerDisponibilidadStock(tx, { negocioId: N, key: { productoId: "p-remera", productoVarianteId: "v-a" } }),
        leerDisponibilidadStock(tx, { negocioId: N, key: { productoId: "p-remera", productoVarianteId: "v-b" } }),
      ])
    )
    expect(base?.available).toBe(10)
    expect(va?.available).toBe(1)
    expect(vb?.available).toBe(2)
  })

  test("tenant: la autoridad de otro negocio no se resuelve (null) ni con sus reservas", async () => {
    const fake = seed()
    const d = await runStockSerializable(fake.client as never, (tx: Tx) =>
      leerDisponibilidadStock(tx, { negocioId: N, key: { productoId: "p-ajeno", productoVarianteId: null } })
    )
    expect(d).toBeNull()
  })
})

describe("Caja (I3) — reservas, agregación por clave, atomicidad", () => {
  test("stock suficiente sin reservas (OFF típico): descuenta y registra 1 movimiento VENTA", async () => {
    const fake = seed({ reservas: [] })
    const plan = await vender(fake, [cajaLine({ cantidad: 4 })])
    expect(plan).toEqual([{ productoId: "p-base", productoVarianteId: null, cantidad: 4, stockAntes: 10, stockDespues: 6 }])
    expect(stockOf(fake, "p-base")).toBe(6)
    expect(fake.state.movimientos).toEqual([expect.objectContaining({ tipo: "VENTA", cantidad: 4, stockAntes: 10, stockDespues: 6 })])
  })

  test("físico insuficiente SIN reservas → 409 STOCK_INSUFFICIENT con el mensaje de siempre, nada escrito", async () => {
    const fake = seed({ reservas: [] })
    const error = await vender(fake, [cajaLine({ cantidad: 11 })]).catch((e) => e)
    expect(error).toBeInstanceOf(StockPhysicalInsufficientError)
    expect(mapStockLifecycleError(error)).toEqual({
      status: 409,
      body: expect.objectContaining({ code: "STOCK_INSUFFICIENT", error: '"Coca-Cola" no tiene stock suficiente' }),
    })
    expect(stockOf(fake, "p-base")).toBe(10)
    expect(fake.state.movimientos).toHaveLength(0)
  })

  test("con reservas: vender 5 con disponible 3 → 409 STOCK_RESERVED_FOR_ORDERS que dice cuántas quedan; nada escrito", async () => {
    const fake = seed()
    const error = await vender(fake, [cajaLine({ cantidad: 5 })]).catch((e) => e)
    expect(error).toBeInstanceOf(StockReservedForOrdersError)
    const mapped = mapStockLifecycleError(error)!
    expect(mapped.status).toBe(409)
    expect(mapped.body.code).toBe("STOCK_RESERVED_FOR_ORDERS")
    expect(mapped.body.error).toContain("sólo quedan 3 disponibles")
    expect(mapped.body.error).toContain("7 están reservadas")
    expect(mapped.body.details).toEqual({ productoId: "p-base", productoVarianteId: null, solicitado: 5, stockFisico: 10, reservasActivas: 7, disponible: 3 })
    expect(stockOf(fake, "p-base")).toBe(10)
    expect(fake.state.movimientos).toHaveLength(0)
    expect(fake.state.reservas.filter((r) => r.estado === "ACTIVA")).toHaveLength(2)
  })

  test("con reservas: vender 2 → físico 8, reservas 7 intactas, disponible final 1", async () => {
    const fake = seed()
    await vender(fake, [cajaLine({ cantidad: 2 })])
    expect(stockOf(fake, "p-base")).toBe(8)
    const d = await runStockSerializable(fake.client as never, (tx: Tx) =>
      leerDisponibilidadStock(tx, { negocioId: N, key: { productoId: "p-base", productoVarianteId: null } })
    )
    expect(d).toEqual(expect.objectContaining({ physical: 8, activeReserved: 7, available: 1 }))
    expect(fake.state.reservas.every((r) => r.estado === "ACTIVA")).toBe(true)
  })

  test("todo reservado (disponible 0) → mensaje 'no quedan unidades disponibles'", async () => {
    const fake = seed({ reservas: [reserva({ cantidad: 10 })] })
    const error = await vender(fake, [cajaLine({ cantidad: 1 })]).catch((e) => e)
    expect((error as Error).message).toContain("no quedan unidades disponibles para vender")
  })

  test("Decisión C: Coca-Cola x2 + x3 → se valida y descuenta 5 UNA vez, 1 movimiento de 5", async () => {
    const fake = seed({ reservas: [] })
    const plan = await vender(fake, [cajaLine({ cantidad: 2 }), cajaLine({ cantidad: 3 })])
    expect(plan).toHaveLength(1)
    expect(stockOf(fake, "p-base")).toBe(5)
    expect(fake.state.movimientos).toEqual([expect.objectContaining({ tipo: "VENTA", cantidad: 5, stockAntes: 10, stockDespues: 5, ventaId: "venta-1" })])
  })

  test("Decisión C con reservas: x2 + x2 con disponible 3 → rechazada por el TOTAL (antes cada línea pasaba sola)", async () => {
    const fake = seed()
    const error = await vender(fake, [cajaLine({ cantidad: 2 }), cajaLine({ cantidad: 2 })]).catch((e) => e)
    expect((error as StockReservedForOrdersError).details).toEqual(expect.objectContaining({ solicitado: 4, disponible: 3 }))
    expect(stockOf(fake, "p-base")).toBe(10)
  })

  test("variante: descuenta SÓLO la variante (líneas repetidas agregadas); hermana y padre intactos", async () => {
    const fake = seed({ reservas: [reserva({ productoId: "p-remera", productoVarianteId: "v-a", cantidad: 2 })] })
    await vender(fake, [
      cajaLine({ productoId: "p-remera", productoVarianteId: "v-a", cantidad: 1, nombre: "Remera — Roja" }),
      cajaLine({ productoId: "p-remera", productoVarianteId: "v-a", cantidad: 3, nombre: "Remera — Roja" }),
    ])
    expect(stockOf(fake, "v-a")).toBe(2)
    expect(stockOf(fake, "v-b")).toBe(2)
    expect(fake.state.productos.find((p) => p.id === "p-remera")!.stockCantidad).toBe(0)
    expect(fake.state.movimientos).toEqual([expect.objectContaining({ productoVarianteId: "v-a", cantidad: 4, stockAntes: 6, stockDespues: 2 })])
  })

  test("variante con reservas: superar el disponible de la variante → 409 STOCK_RESERVED_FOR_ORDERS con su etiqueta", async () => {
    const fake = seed({ reservas: [reserva({ productoId: "p-remera", productoVarianteId: "v-b", cantidad: 2 })] })
    const error = await vender(fake, [cajaLine({ productoId: "p-remera", productoVarianteId: "v-b", cantidad: 1, nombre: "Remera — Azul" })]).catch((e) => e)
    expect((error as Error).message).toContain('"Remera — Azul"')
    expect((error as StockReservedForOrdersError).code).toBe("STOCK_RESERVED_FOR_ORDERS")
  })

  test("sin controlStock: nunca se descuenta ni valida (sin doble descuento)", async () => {
    const fake = seed()
    const plan = await vender(fake, [cajaLine({ productoId: "p-libre", cantidad: 999, controlStock: false })])
    expect(plan).toEqual([])
    expect(fake.state.movimientos).toHaveLength(0)
  })

  test("venta con varias claves: si UNA no alcanza, ninguna se descuenta (atomicidad)", async () => {
    const fake = seed()
    const error = await vender(fake, [
      cajaLine({ productoId: "p-remera", productoVarianteId: "v-a", cantidad: 1, nombre: "Remera — Roja" }),
      cajaLine({ cantidad: 9 }),
    ]).catch((e) => e)
    expect(error).toBeInstanceOf(StockReservedForOrdersError)
    expect(stockOf(fake, "v-a")).toBe(6)
    expect(stockOf(fake, "p-base")).toBe(10)
    expect(fake.state.movimientos).toHaveLength(0)
  })

  test("rollback: si falla la escritura del movimiento, el descuento ya hecho se revierte", async () => {
    const fake = seed({ reservas: [] })
    const original = (fake.client as unknown as { movimientoInventario: { create: unknown } }).movimientoInventario.create
    ;(fake.client as unknown as { movimientoInventario: { create: unknown } }).movimientoInventario.create = async () => {
      throw new Error("movimiento falló")
    }
    await expect(vender(fake, [cajaLine({ cantidad: 2 })])).rejects.toThrow("movimiento falló")
    expect(stockOf(fake, "p-base")).toBe(10)
    ;(fake.client as unknown as { movimientoInventario: { create: unknown } }).movimientoInventario.create = original
  })

  test("independiente del modo: con OFF, ON o DRAINING las reservas ACTIVA se respetan igual (nunca se lee el modo)", async () => {
    for (const mode of ["OFF", "ON", "DRAINING", "garbage"]) {
      const fake = seed({}, mode)
      const error = await vender(fake, [cajaLine({ cantidad: 4 })]).catch((e) => e)
      expect((error as StockReservedForOrdersError).code).toBe("STOCK_RESERVED_FOR_ORDERS")
    }
  })

  test("venta contra venta: la segunda (tras commit de la primera) ve el físico nuevo — sin doble descuento", async () => {
    const fake = seed()
    await vender(fake, [cajaLine({ cantidad: 3 })])
    const error = await vender(fake, [cajaLine({ cantidad: 1 })]).catch((e) => e)
    expect((error as StockReservedForOrdersError).details).toEqual(expect.objectContaining({ stockFisico: 7, reservasActivas: 7, disponible: 0 }))
    expect(stockOf(fake, "p-base")).toBe(7)
    expect(fake.state.movimientos).toHaveLength(1)
  })
})

describe("Movimientos manuales (I3) — ENTRADA / SALIDA / AJUSTE", () => {
  test("ENTRADA con reservas: suma al físico, reservas intactas", async () => {
    const fake = seed()
    const plan = await mover(fake, "ENTRADA", 5)
    expect(plan).toEqual(expect.objectContaining({ kind: "apply", stockAntes: 10, stockDespues: 15 }))
    expect(stockOf(fake, "p-base")).toBe(15)
    expect(fake.state.reservas.map((r) => r.estado)).toEqual(["ACTIVA", "ACTIVA"])
  })

  test("SALIDA de 3 con disponible 3 → permitida (físico 7 = reservado 7)", async () => {
    const fake = seed()
    await mover(fake, "SALIDA", 3)
    expect(stockOf(fake, "p-base")).toBe(7)
    expect(fake.state.movimientos).toEqual([expect.objectContaining({ tipo: "SALIDA", cantidad: 3, stockAntes: 10, stockDespues: 7 })])
  })

  test("SALIDA de 4 con disponible 3 → 409 STOCK_RESERVED_FOR_ORDERS, nada escrito", async () => {
    const fake = seed()
    const error = await mover(fake, "SALIDA", 4).catch((e) => e)
    const mapped = mapStockLifecycleError(error)!
    expect(mapped.status).toBe(409)
    expect(mapped.body.code).toBe("STOCK_RESERVED_FOR_ORDERS")
    expect(mapped.body.error).toContain("sólo podés retirar hasta 3")
    expect(stockOf(fake, "p-base")).toBe(10)
    expect(fake.state.movimientos).toHaveLength(0)
  })

  test("SALIDA que deja el físico negativo sigue siendo 400 (mismo error de resolveNextStock)", async () => {
    const fake = seed({ reservas: [] })
    const error = await mover(fake, "SALIDA", 11).catch((e) => e)
    expect(mapStockLifecycleError(error)).toEqual({ status: 400, body: expect.objectContaining({ code: "STOCK_MOVEMENT_INVALID", error: "El movimiento dejaría el stock en negativo" }) })
  })

  test("AJUSTE sin déficit (10 → 8 con 7 reservadas) → se aplica directo", async () => {
    const fake = seed()
    const plan = await mover(fake, "AJUSTE", 8)
    expect(plan).toEqual(expect.objectContaining({ kind: "apply", stockDespues: 8, deficitResultante: 0 }))
    expect(stockOf(fake, "p-base")).toBe(8)
  })

  test("AJUSTE deficitario (10 → 5 con 7 reservadas) → pide confirmación con los 4 valores y NO escribe nada", async () => {
    const fake = seed()
    const plan = await mover(fake, "AJUSTE", 5)
    expect(plan).toEqual({
      kind: "confirm",
      vencida: false,
      confirmacion: { stockActual: 10, stockPropuesto: 5, reservasActivas: 7, deficitResultante: 2, huella: expect.stringMatching(/^[0-9a-f]{64}$/) },
    })
    expect(stockOf(fake, "p-base")).toBe(10)
    expect(fake.state.movimientos).toHaveLength(0)
  })

  test("cancelar la advertencia = no reenviar: el estado queda exactamente igual", async () => {
    const fake = seed()
    const before = structuredClone(fake.state)
    await mover(fake, "AJUSTE", 5)
    expect(fake.state).toEqual(before)
  })

  test("confirmar con la huella vigente → aplica el ajuste a 5, registra el movimiento, reservas ACTIVA intactas", async () => {
    const fake = seed()
    const first = await mover(fake, "AJUSTE", 5)
    if (first.kind !== "confirm") throw new Error("expected confirm")
    const second = await mover(fake, "AJUSTE", 5, { huella: first.confirmacion.huella })
    expect(second).toEqual(expect.objectContaining({ kind: "apply", stockDespues: 5, deficitResultante: 2 }))
    expect(stockOf(fake, "p-base")).toBe(5)
    expect(fake.state.movimientos).toEqual([expect.objectContaining({ tipo: "AJUSTE", cantidad: 5, stockAntes: 10, stockDespues: 5 })])
    expect(fake.state.reservas.map((r) => [r.estado, r.cantidad])).toEqual([["ACTIVA", 4], ["ACTIVA", 3]])
  })

  test("las reservas cambian entre advertencia y confirmación → NO aplica: nueva confirmación vencida con valores nuevos", async () => {
    const fake = seed()
    const first = await mover(fake, "AJUSTE", 5)
    if (first.kind !== "confirm") throw new Error("expected confirm")
    fake.state.reservas.push(reserva({ cantidad: 1, pedidoId: "pedido-3" }))
    const second = await mover(fake, "AJUSTE", 5, { huella: first.confirmacion.huella })
    expect(second).toEqual(expect.objectContaining({ kind: "confirm", vencida: true }))
    expect(second.kind === "confirm" && second.confirmacion).toEqual(expect.objectContaining({ reservasActivas: 8, deficitResultante: 3 }))
    expect(stockOf(fake, "p-base")).toBe(10)
    expect(fake.state.movimientos).toHaveLength(0)
  })

  test("el stock físico cambia entre advertencia y confirmación → NO aplica: confirmación vencida", async () => {
    const fake = seed()
    const first = await mover(fake, "AJUSTE", 5)
    if (first.kind !== "confirm") throw new Error("expected confirm")
    fake.state.productos.find((p) => p.id === "p-base")!.stockCantidad = 9
    const second = await mover(fake, "AJUSTE", 5, { huella: first.confirmacion.huella })
    expect(second).toEqual(expect.objectContaining({ kind: "confirm", vencida: true }))
    expect(second.kind === "confirm" && second.confirmacion.stockActual).toBe(9)
    expect(fake.state.movimientos).toHaveLength(0)
  })

  test("la huella de otro producto, de otra cantidad o de otro negocio nunca confirma", async () => {
    const fake = seed({
      productos: [
        { id: "p-base", negocioId: N, controlStock: true, stockCantidad: 10 },
        { id: "p-otro", negocioId: N, controlStock: true, stockCantidad: 10 },
      ],
      reservas: [reserva({ cantidad: 7 }), reserva({ productoId: "p-otro", cantidad: 7 })],
    })
    const deOtroProducto = await mover(fake, "AJUSTE", 5, { key: { productoId: "p-otro", productoVarianteId: null } })
    if (deOtroProducto.kind !== "confirm") throw new Error("expected confirm")
    const conHuellaAjena = await mover(fake, "AJUSTE", 5, { huella: deOtroProducto.confirmacion.huella })
    expect(conHuellaAjena).toEqual(expect.objectContaining({ kind: "confirm", vencida: true }))

    const de4 = await mover(fake, "AJUSTE", 4)
    if (de4.kind !== "confirm") throw new Error("expected confirm")
    const a5ConHuellaDe4 = await mover(fake, "AJUSTE", 5, { huella: de4.confirmacion.huella })
    expect(a5ConHuellaDe4).toEqual(expect.objectContaining({ kind: "confirm", vencida: true }))

    const huellaOtroNegocio = huellaAjusteDeficitario({
      negocioId: OTRO,
      key: { productoId: "p-base", productoVarianteId: null },
      stockActual: 10,
      stockPropuesto: 5,
      reservasActivas: 7,
    })
    const conHuellaDeOtroNegocio = await mover(fake, "AJUSTE", 5, { huella: huellaOtroNegocio })
    expect(conHuellaDeOtroNegocio).toEqual(expect.objectContaining({ kind: "confirm", vencida: true }))
    expect(fake.state.movimientos).toHaveLength(0)
  })

  test("un ajuste que MANTIENE un déficit preexistente también pide confirmación", async () => {
    const fake = seed({ reservas: [reserva({ cantidad: 12 })] })
    const plan = await mover(fake, "AJUSTE", 11)
    expect(plan).toEqual(expect.objectContaining({ kind: "confirm", confirmacion: expect.objectContaining({ deficitResultante: 1 }) }))
  })

  test("AJUSTE en variante: déficit calculado con las reservas de ESA variante", async () => {
    const fake = seed({ reservas: [reserva({ productoId: "p-remera", productoVarianteId: "v-a", cantidad: 4 })] })
    const plan = await mover(fake, "AJUSTE", 1, { key: { productoId: "p-remera", productoVarianteId: "v-a" } })
    expect(plan).toEqual(expect.objectContaining({ kind: "confirm", confirmacion: expect.objectContaining({ stockActual: 6, reservasActivas: 4, deficitResultante: 3 }) }))
  })

  test("rollback: si falla el movimiento, el stock confirmado no queda escrito", async () => {
    const fake = seed()
    const first = await mover(fake, "AJUSTE", 5)
    if (first.kind !== "confirm") throw new Error("expected confirm")
    ;(fake.client as unknown as { movimientoInventario: { create: unknown } }).movimientoInventario.create = async () => {
      throw new Error("movimiento falló")
    }
    await expect(mover(fake, "AJUSTE", 5, { huella: first.confirmacion.huella })).rejects.toThrow("movimiento falló")
    expect(stockOf(fake, "p-base")).toBe(10)
  })
})

describe("retry acotado (I3 reutiliza runStockSerializable)", () => {
  test("P2034 en la venta se reintenta y luego confirma con datos frescos", async () => {
    const fake = seed({ reservas: [] })
    const realTx = fake.client.$transaction
    let calls = 0
    fake.client.$transaction = async (fn, options) => {
      calls++
      if (calls === 1) throw p2034()
      return realTx(fn, options)
    }
    await vender(fake, [cajaLine({ cantidad: 2 })])
    expect(calls).toBe(2)
    expect(stockOf(fake, "p-base")).toBe(8)
  })
})
