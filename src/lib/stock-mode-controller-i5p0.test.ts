// ============================================
// P2-T56-R3A-I5-P0 — controlador auditado de modos + recuperación extraordinaria
// ============================================
// Autoridad real (src/lib/stock-lifecycle.ts) contra el fake en memoria con
// ROLLBACK real de $transaction. No toca ninguna base ni el modo global real:
// la certificación con cambios persistentes de modo queda para I5 en TESTING.
import { describe, expect, test } from "bun:test"
import { Prisma } from "@prisma/client"
import {
  aplicarEfectosCancelacion,
  cambiarModoReservaStock,
  evaluarCambioModoReservaStock,
  evaluarRollbackReservas,
  isAllowedStockModeTransition,
  liberarReservasPorRollback,
  mapStockLifecycleError,
  runStockSerializable,
  StockOperationRejectedError,
  StockReservationModeInvalidError,
  STOCK_MODE_ALLOWED_TRANSITIONS,
  STOCK_ROLLBACK_MAX_IDS,
  transicionarAPreparandoConStock,
  type StockModeTransitionRequest,
  type StockReservationRollbackRequest,
} from "./stock-lifecycle"
import { createFakeDb, p2034, type FakeDb, type FakeReserva, type FakeState } from "./stock-lifecycle-test-fake"

type Tx = Prisma.TransactionClient
const N = "negocio-a"
const OTRO = "negocio-b"

function seed(mode: unknown, extra: Partial<FakeState> = {}): FakeDb {
  return createFakeDb({
    config: { clave: "platform", stockReservaModo: mode, id: "cfg-1", updatedAt: new Date(1_000) },
    superadmins: [
      { id: "sa-1", activo: true },
      { id: "sa-off", activo: false },
    ],
    productos: [{ id: "p-base", negocioId: N, controlStock: true, stockCantidad: 5 }],
    ...extra,
  })
}

function req(from: string, to: string, overrides: Partial<StockModeTransitionRequest> = {}): StockModeTransitionRequest {
  return {
    from: from as StockModeTransitionRequest["from"],
    to: to as StockModeTransitionRequest["to"],
    superAdminId: "sa-1",
    reason: "Activación controlada de prueba I5",
    operationRef: "op-1",
    source: "test",
    ...overrides,
  }
}

const cambiar = (fake: FakeDb, r: StockModeTransitionRequest) =>
  runStockSerializable(fake.client as never, (tx: Tx) => cambiarModoReservaStock(tx, r))

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error("se esperaba un rechazo")
}

function reserva(overrides: Partial<FakeReserva> & { id: string; pedidoId: string }): FakeReserva {
  return {
    negocioId: N,
    pedidoItemId: `item-${overrides.id}`,
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

const expectUnchanged = (fake: FakeDb, mode: string) => {
  expect(fake.state.config?.stockReservaModo).toBe(mode)
  expect(fake.state.audits).toHaveLength(0)
}

describe("I5-P0 — transiciones permitidas", () => {
  test("la matriz es exactamente OFF→ON, ON→DRAINING, DRAINING→OFF", () => {
    expect(STOCK_MODE_ALLOWED_TRANSITIONS.map(([a, b]) => `${a}->${b}`)).toEqual(["OFF->ON", "ON->DRAINING", "DRAINING->OFF"])
    for (const [a, b] of [["ON", "OFF"], ["OFF", "DRAINING"], ["DRAINING", "ON"], ["OFF", "OFF"], ["ON", "ON"], ["DRAINING", "DRAINING"]] as const) {
      expect(isAllowedStockModeTransition(a, b)).toBe(false)
    }
  })

  test("OFF → ON: aplica, Serializable, AuditLog atómico con actor/motivo/referencia/resultado", async () => {
    const fake = seed("OFF")
    const result = await cambiar(fake, req("OFF", "ON"))
    expect(fake.state.config?.stockReservaModo).toBe("ON")
    expect(fake.isolationLevels).toEqual(["Serializable"])
    expect(fake.state.audits).toHaveLength(1)
    const audit = fake.state.audits[0]
    expect(audit).toMatchObject({ userId: "sa-1", userType: "superadmin", accion: "stock.reserva_modo_cambiado", recurso: "config_plataforma", recursoId: "cfg-1" })
    expect(JSON.parse(audit.detalle)).toMatchObject({
      from: "OFF",
      to: "ON",
      reason: "Activación controlada de prueba I5",
      operationRef: "op-1",
      source: "test",
      activeReservations: 0,
      result: "APPLIED",
      previousUpdatedAt: new Date(1_000).toISOString(),
    })
    expect(result).toEqual({ from: "OFF", to: "ON", activeReservations: 0, auditLogId: audit.id })
  })

  test("ON → DRAINING: aplica aunque haya reservas ACTIVA (registra cuántas)", async () => {
    const fake = seed("ON", { reservas: [reserva({ id: "r1", pedidoId: "ped-1", cantidad: 2 })] })
    const result = await cambiar(fake, req("ON", "DRAINING"))
    expect(fake.state.config?.stockReservaModo).toBe("DRAINING")
    expect(result.activeReservations).toBe(1)
  })

  test("DRAINING → OFF con 0 ACTIVA: aplica (CONSUMIDA/LIBERADA no bloquean)", async () => {
    const fake = seed("DRAINING", {
      reservas: [reserva({ id: "r1", pedidoId: "p1", estado: "CONSUMIDA" }), reserva({ id: "r2", pedidoId: "p2", estado: "LIBERADA" })],
    })
    await cambiar(fake, req("DRAINING", "OFF"))
    expect(fake.state.config?.stockReservaModo).toBe("OFF")
    expect(fake.state.audits).toHaveLength(1)
  })
})

describe("I5-P0 — transiciones rechazadas sin escribir", () => {
  for (const [from, to] of [["ON", "OFF"], ["OFF", "DRAINING"], ["OFF", "OFF"], ["DRAINING", "ON"]] as const) {
    test(`${from} → ${to}: STOCK_MODE_TRANSITION_FORBIDDEN, modo intacto, sin auditoría`, async () => {
      const fake = seed(from)
      const error = (await rejection(cambiar(fake, req(from, to)))) as StockOperationRejectedError
      expect(error.code).toBe("STOCK_MODE_TRANSITION_FORBIDDEN")
      expectUnchanged(fake, from)
    })
  }

  test("DRAINING → OFF con reservas ACTIVA: STOCK_MODE_ACTIVE_RESERVATIONS (contadas dentro de la tx)", async () => {
    const fake = seed("DRAINING", { reservas: [reserva({ id: "r1", pedidoId: "p1" }), reserva({ id: "r2", pedidoId: "p2", negocioId: OTRO })] })
    const error = (await rejection(cambiar(fake, req("DRAINING", "OFF")))) as StockOperationRejectedError
    expect(error.code).toBe("STOCK_MODE_ACTIVE_RESERVATIONS")
    expect(error.details).toEqual({ activeReservations: 2 })
    expectUnchanged(fake, "DRAINING")
  })

  test("estado previo desactualizado (espera ON, vigente OFF): STOCK_MODE_STALE_EXPECTED", async () => {
    const fake = seed("OFF")
    const error = (await rejection(cambiar(fake, req("ON", "DRAINING")))) as StockOperationRejectedError
    expect(error.code).toBe("STOCK_MODE_STALE_EXPECTED")
    expect(error.details).toEqual({ expected: "ON", current: "OFF" })
    expectUnchanged(fake, "OFF")
  })

  test("dos operadores con la misma expectativa: sólo el primero aplica; el segundo queda desactualizado", async () => {
    const fake = seed("OFF")
    await cambiar(fake, req("OFF", "ON", { operationRef: "op-a" }))
    const error = (await rejection(cambiar(fake, req("OFF", "ON", { operationRef: "op-b" })))) as StockOperationRejectedError
    expect(error.code).toBe("STOCK_MODE_STALE_EXPECTED")
    expect(fake.state.audits.map((a) => JSON.parse(a.detalle).operationRef)).toEqual(["op-a"])
  })

  test("cambio concurrente entre la lectura y el CAS: STOCK_MODE_CONCURRENT_CHANGE y rollback total", async () => {
    const fake = seed("OFF")
    fake.beforeConfigCas = () => {
      fake.state.config!.updatedAt = new Date(9_999)
    }
    const error = (await rejection(cambiar(fake, req("OFF", "ON")))) as StockOperationRejectedError
    expect(error.code).toBe("STOCK_MODE_CONCURRENT_CHANGE")
    expectUnchanged(fake, "OFF")
  })

  test("actor: SuperAdmin inactivo → ACTOR_INVALID; sin actor / motivo corto / modo inválido → REQUEST_INVALID", async () => {
    const fake = seed("OFF")
    expect(((await rejection(cambiar(fake, req("OFF", "ON", { superAdminId: "sa-off" })))) as StockOperationRejectedError).code).toBe("STOCK_MODE_ACTOR_INVALID")
    expect(((await rejection(cambiar(fake, req("OFF", "ON", { superAdminId: "sa-inexistente" })))) as StockOperationRejectedError).code).toBe("STOCK_MODE_ACTOR_INVALID")
    const invalid = (await rejection(cambiar(fake, req("OFF", "FOO", { superAdminId: "", reason: "corto", operationRef: "" })))) as StockOperationRejectedError
    expect(invalid.code).toBe("STOCK_MODE_REQUEST_INVALID")
    expect(invalid.details?.problems).toEqual(["ACTOR_REQUIRED", "REASON_TOO_SHORT", "OPERATION_REF_REQUIRED", "MODE_VALUE_INVALID"])
    expectUnchanged(fake, "OFF")
  })

  test("modo persistido inválido: fail-closed (StockReservationModeInvalidError), sin escribir", async () => {
    const fake = seed("garbage")
    expect(await rejection(cambiar(fake, req("OFF", "ON")))).toBeInstanceOf(StockReservationModeInvalidError)
    expectUnchanged(fake, "garbage")
  })
})

describe("I5-P0 — atomicidad y reintentos", () => {
  test("falla del AuditLog → rollback del cambio de modo (nunca un cambio sin auditoría)", async () => {
    const fake = seed("OFF")
    fake.failNextAuditCreate = true
    expect(String(await rejection(cambiar(fake, req("OFF", "ON"))))).toContain("SIMULATED_AUDIT_FAILURE")
    expectUnchanged(fake, "OFF")
  })

  test("falla de la actualización → sin auditoría de éxito", async () => {
    const fake = seed("OFF")
    fake.failNextConfigUpdate = true
    expect(String(await rejection(cambiar(fake, req("OFF", "ON"))))).toContain("SIMULATED_CONFIG_UPDATE_FAILURE")
    expectUnchanged(fake, "OFF")
  })

  test("P2034 → reintento con relectura: aplica una sola vez, una sola auditoría", async () => {
    const fake = seed("OFF")
    let calls = 0
    const client = {
      $transaction: async (fn: (t: unknown) => Promise<unknown>, options?: { isolationLevel?: string }) => {
        calls++
        if (calls === 1) throw p2034()
        return fake.client.$transaction(fn, options)
      },
    }
    await runStockSerializable(client as never, (tx: Tx) => cambiarModoReservaStock(tx, req("OFF", "ON")))
    expect(calls).toBe(2)
    expect(fake.state.config?.stockReservaModo).toBe("ON")
    expect(fake.state.audits).toHaveLength(1)
  })

  test("P2028 → sin reintento (un intento), modo intacto", async () => {
    const fake = seed("OFF")
    let calls = 0
    const client = {
      $transaction: async () => {
        calls++
        throw new Prisma.PrismaClientKnownRequestError("Transaction not found", { code: "P2028", clientVersion: "test" })
      },
    }
    const error = (await rejection(runStockSerializable(client as never, (tx: Tx) => cambiarModoReservaStock(tx, req("OFF", "ON"))))) as { code?: string }
    expect(error.code).toBe("P2028")
    expect(calls).toBe(1)
    expectUnchanged(fake, "OFF")
  })

  test("mapStockLifecycleError traduce los rechazos a 409 con código", () => {
    const mapped = mapStockLifecycleError(new StockOperationRejectedError("STOCK_MODE_TRANSITION_FORBIDDEN", "x", { from: "ON", to: "OFF" }))
    expect(mapped).toEqual({ status: 409, body: { error: "x", code: "STOCK_MODE_TRANSITION_FORBIDDEN", details: { from: "ON", to: "OFF" } } })
  })
})

describe("I5-P0 — evaluación (dry-run) sin escrituras", () => {
  test("informa modo, transición, reservas y todos los problemas sin tocar el estado", async () => {
    const fake = seed("ON", { reservas: [reserva({ id: "r1", pedidoId: "p1" })] })
    const preview = await evaluarCambioModoReservaStock(fake.client as never, req("ON", "OFF", { superAdminId: "sa-off", reason: "x" }))
    expect(preview).toEqual({
      currentMode: "ON",
      from: "ON",
      to: "OFF",
      allowed: false,
      activeReservations: 1,
      problems: ["REASON_TOO_SHORT", "TRANSITION_FORBIDDEN", "ACTIVE_RESERVATIONS", "ACTOR_INVALID"],
    })
    expect(fake.transactionCount).toBe(0)
    expectUnchanged(fake, "ON")
  })
})

// ---------------------------------------------------------------- recuperación
function seedRollback(mode: string): FakeDb {
  return seed(mode, {
    pedidos: [
      { id: "ped-cancel", negocioId: N, estado: "cancelado", tarifaServicio: 0, deudaAcumulada: false, items: [] },
      { id: "ped-pend", negocioId: N, estado: "recibido", tarifaServicio: 0, deudaAcumulada: false, items: [] },
      { id: "ped-prep", negocioId: N, estado: "preparando", tarifaServicio: 0, deudaAcumulada: false, items: [] },
      { id: "ped-otro", negocioId: OTRO, estado: "cancelado", tarifaServicio: 0, deudaAcumulada: false, items: [] },
    ],
    reservas: [
      reserva({ id: "r-cancel", pedidoId: "ped-cancel", cantidad: 2 }),
      reserva({ id: "r-pend", pedidoId: "ped-pend", cantidad: 1 }),
      reserva({ id: "r-prep", pedidoId: "ped-prep" }),
      reserva({ id: "r-cons", pedidoId: "ped-cancel", estado: "CONSUMIDA" }),
      reserva({ id: "r-lib", pedidoId: "ped-cancel", estado: "LIBERADA", motivoLiberacion: "CANCELADO_CLIENTE" }),
      reserva({ id: "r-otro", pedidoId: "ped-otro", negocioId: OTRO }),
    ],
  })
}

function rb(ids: string[], overrides: Partial<StockReservationRollbackRequest> = {}): StockReservationRollbackRequest {
  return { negocioId: N, reservaIds: ids, superAdminId: "sa-1", reason: "Reserva atascada tras cancelación", operationRef: "rb-1", source: "test", ...overrides }
}

const rollback = (fake: FakeDb, r: StockReservationRollbackRequest) =>
  runStockSerializable(fake.client as never, (tx: Tx) => liberarReservasPorRollback(tx, r, new Date(5_000)))

const reservaEstado = (fake: FakeDb, id: string) => fake.state.reservas.find((r) => r.id === id)!

describe("I5-P0 — recuperación extraordinaria (hard rollback)", () => {
  for (const mode of ["OFF", "ON"]) {
    test(`sólo DRAINING: en ${mode} → MODE_NOT_DRAINING, nada cambia`, async () => {
      const fake = seedRollback(mode)
      const error = (await rejection(rollback(fake, rb(["r-cancel"])))) as StockOperationRejectedError
      expect(error.code).toBe("STOCK_ROLLBACK_REJECTED")
      expect(error.details?.problems).toContain("MODE_NOT_DRAINING")
      expect(reservaEstado(fake, "r-cancel").estado).toBe("ACTIVA")
      expect(fake.state.audits).toHaveLength(0)
    })
  }

  test("pedido cancelado con reserva ACTIVA: ACTIVA → LIBERADA (ROLLBACK), auditada, sin tocar stock ni borrar filas", async () => {
    const fake = seedRollback("DRAINING")
    const before = fake.state.reservas.length
    const result = await rollback(fake, rb(["r-cancel"]))
    expect(result.released).toEqual(["r-cancel"])
    expect(reservaEstado(fake, "r-cancel")).toMatchObject({ estado: "LIBERADA", motivoLiberacion: "ROLLBACK", liberadaEn: new Date(5_000) })
    expect(fake.state.reservas).toHaveLength(before)
    expect(fake.state.productos[0].stockCantidad).toBe(5)
    expect(fake.state.movimientos).toHaveLength(0)
    expect(fake.state.audits).toHaveLength(1)
    expect(fake.state.audits[0]).toMatchObject({ userId: "sa-1", userType: "superadmin", accion: "stock.reservas_liberadas_rollback", recurso: "reserva_stock", recursoId: N })
    expect(JSON.parse(fake.state.audits[0].detalle)).toMatchObject({ reservaIds: ["r-cancel"], pedidoIds: ["ped-cancel"], motivo: "ROLLBACK", operationRef: "rb-1", result: "APPLIED" })
  })

  test("idempotente: ya LIBERADA → no-op; una segunda ejecución no escribe ni audita", async () => {
    const fake = seedRollback("DRAINING")
    const first = await rollback(fake, rb(["r-cancel", "r-lib"]))
    expect(first).toMatchObject({ released: ["r-cancel"], alreadyReleased: ["r-lib"] })
    expect(reservaEstado(fake, "r-lib").motivoLiberacion).toBe("CANCELADO_CLIENTE")
    const second = await rollback(fake, rb(["r-cancel"]))
    expect(second).toEqual({ released: [], alreadyReleased: ["r-cancel"], auditLogId: null })
    expect(fake.state.audits).toHaveLength(1)
  })

  test("pedido PENDIENTE: rechazo (usar el flujo normal); la reserva sigue protegiendo y luego se consume al preparar", async () => {
    const fake = seedRollback("DRAINING")
    const error = (await rejection(rollback(fake, rb(["r-pend"])))) as StockOperationRejectedError
    expect(error.details?.items).toEqual([
      { reservaId: "r-pend", estado: "ACTIVA", pedidoId: "ped-pend", pedidoEstado: "recibido", action: "REJECT", reason: "PEDIDO_NOT_CANCELLED_USE_NORMAL_FLOW" },
    ])
    expect(reservaEstado(fake, "r-pend").estado).toBe("ACTIVA")
    const prep = await runStockSerializable(fake.client as never, (tx: Tx) =>
      transicionarAPreparandoConStock(tx, { pedidoId: "ped-pend", negocioId: N, casWhere: { estado: "recibido" }, data: { estado: "preparando" } })
    )
    expect(prep).toMatchObject({ won: true, consumidas: 1, movimientos: 1 })
    expect(fake.state.productos[0].stockCantidad).toBe(4)
  })

  test("flujo normal recomendado: cancelar libera con su motivo; el rollback posterior es no-op (no pisa el motivo)", async () => {
    const fake = seedRollback("DRAINING")
    fake.state.pedidos.find((p) => p.id === "ped-pend")!.estado = "cancelado"
    await runStockSerializable(fake.client as never, (tx: Tx) => aplicarEfectosCancelacion(tx, { pedidoId: "ped-pend", negocioId: N, motivo: "CANCELADO_VENDEDOR" }))
    expect(reservaEstado(fake, "r-pend")).toMatchObject({ estado: "LIBERADA", motivoLiberacion: "CANCELADO_VENDEDOR" })
    const result = await rollback(fake, rb(["r-pend"]))
    expect(result).toEqual({ released: [], alreadyReleased: ["r-pend"], auditLogId: null })
  })

  test("tras el rollback, el pedido cancelado no puede pasar a preparando (CAS desde recibido no gana): sin preparación insegura", async () => {
    const fake = seedRollback("DRAINING")
    await rollback(fake, rb(["r-cancel"]))
    const prep = await runStockSerializable(fake.client as never, (tx: Tx) =>
      transicionarAPreparandoConStock(tx, { pedidoId: "ped-cancel", negocioId: N, casWhere: { estado: "recibido" }, data: { estado: "preparando" } })
    )
    expect(prep).toEqual({ won: false })
    expect(fake.state.productos[0].stockCantidad).toBe(5)
  })

  test("rechazos: CONSUMIDA, pedido en preparando con ACTIVA (inconsistente), otro negocio, inexistente", async () => {
    const fake = seedRollback("DRAINING")
    const error = (await rejection(rollback(fake, rb(["r-cons", "r-prep", "r-otro", "r-nada"])))) as StockOperationRejectedError
    expect((error.details?.items as Array<{ reservaId: string; reason: string }>).map((i) => [i.reservaId, i.reason])).toEqual([
      ["r-cons", "RESERVA_CONSUMIDA"],
      ["r-prep", "PEDIDO_NOT_CANCELLED_USE_NORMAL_FLOW"],
      ["r-otro", "RESERVA_OTHER_NEGOCIO"],
      ["r-nada", "RESERVA_NOT_FOUND"],
    ])
    expect(fake.state.audits).toHaveLength(0)
  })

  test("lote mixto con un rechazo: no se libera NADA (atómico)", async () => {
    const fake = seedRollback("DRAINING")
    await rejection(rollback(fake, rb(["r-cancel", "r-pend"])))
    expect(reservaEstado(fake, "r-cancel").estado).toBe("ACTIVA")
    expect(fake.state.audits).toHaveLength(0)
  })

  test("falla parcial (AuditLog) → rollback: la reserva sigue ACTIVA", async () => {
    const fake = seedRollback("DRAINING")
    fake.failNextAuditCreate = true
    expect(String(await rejection(rollback(fake, rb(["r-cancel"]))))).toContain("SIMULATED_AUDIT_FAILURE")
    expect(reservaEstado(fake, "r-cancel").estado).toBe("ACTIVA")
    expect(fake.state.audits).toHaveLength(0)
  })

  test("validación de la solicitud: IDs duplicados, demasiados IDs, sin negocio, actor inactivo, motivo corto", async () => {
    const fake = seedRollback("DRAINING")
    const tooMany = Array.from({ length: STOCK_ROLLBACK_MAX_IDS + 1 }, (_, i) => `x-${i}`)
    for (const [request, problem] of [
      [rb(["r-cancel", "r-cancel"]), "DUPLICATE_RESERVA_IDS"],
      [rb(tooMany), "TOO_MANY_RESERVA_IDS"],
      [rb(["r-cancel"], { negocioId: "" }), "NEGOCIO_REQUIRED"],
      [rb(["r-cancel"], { superAdminId: "sa-off" }), "ACTOR_INVALID"],
      [rb(["r-cancel"], { reason: "x" }), "REASON_TOO_SHORT"],
    ] as const) {
      const error = (await rejection(rollback(fake, request))) as StockOperationRejectedError
      expect(error.details?.problems).toContain(problem)
    }
    expect(reservaEstado(fake, "r-cancel").estado).toBe("ACTIVA")
  })

  test("evaluación (dry-run) de la recuperación: clasifica sin escribir", async () => {
    const fake = seedRollback("DRAINING")
    const preview = await evaluarRollbackReservas(fake.client as never, rb(["r-cancel", "r-lib", "r-pend"]))
    expect(preview.items.map((i) => [i.reservaId, i.action])).toEqual([
      ["r-cancel", "RELEASE"],
      ["r-lib", "ALREADY_RELEASED"],
      ["r-pend", "REJECT"],
    ])
    expect(preview.problems).toEqual(["ITEMS_REJECTED"])
    expect(fake.transactionCount).toBe(0)
    expect(reservaEstado(fake, "r-cancel").estado).toBe("ACTIVA")
  })
})
