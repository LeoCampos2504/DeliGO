// P2-T56-R3A-I1 — autoridad pura del lifecycle de stock (I1-A … I1-O).
import { describe, expect, test } from "bun:test"
import {
  agregarCantidadesPorClave,
  computeAvailableStock,
  computeReservationDeficit,
  DEFAULT_STOCK_RESERVATION_MODE,
  evaluateStockModeTransition,
  isGenericBusinessStockScope,
  isReservaEstado,
  isReservaMotivoLiberacion,
  isStockReservationMode,
  modeCreatesReservations,
  modeRejectsNewControlledOrders,
  parseStockReservationMode,
  RESERVA_ESTADOS,
  RESERVA_MOTIVOS_LIBERACION,
  resolveStockAvailability,
  stockKey,
  STOCK_RESERVATION_MODES,
} from "./stock-authority"

describe("I1-A — isGenericBusinessStockScope (A0.1-2)", () => {
  test("true sólo para 'negocio'", () => {
    expect(isGenericBusinessStockScope("negocio")).toBe(true)
  })
  test("false para restaurante, ropa, vacíos y cualquier otro valor", () => {
    for (const rubro of ["restaurante", "ropa", "", "Negocio", " negocio", "negocio ", "kiosco", null, undefined, 0, {}]) {
      expect(isGenericBusinessStockScope(rubro)).toBe(false)
    }
  })
})

describe("agregarCantidadesPorClave (A0.1-5)", () => {
  test("I1-B: producto simple duplicado se suma", () => {
    expect(agregarCantidadesPorClave([
      { productoId: "p", cantidad: 2 },
      { productoId: "p", cantidad: 3 },
    ])).toEqual([{ productoId: "p", productoVarianteId: null, cantidad: 5 }])
  })

  test("I1-C: misma variante duplicada se suma (3 + 3 = 6)", () => {
    expect(agregarCantidadesPorClave([
      { productoId: "p", productoVarianteId: "a", cantidad: 3 },
      { productoId: "p", productoVarianteId: "a", cantidad: 3 },
    ])).toEqual([{ productoId: "p", productoVarianteId: "a", cantidad: 6 }])
  })

  test("I1-D: dos variantes distintas del mismo producto quedan separadas", () => {
    expect(agregarCantidadesPorClave([
      { productoId: "p", productoVarianteId: "a", cantidad: 3 },
      { productoId: "p", productoVarianteId: "b", cantidad: 2 },
      { productoId: "p", productoVarianteId: "a", cantidad: 3 },
    ])).toEqual([
      { productoId: "p", productoVarianteId: "a", cantidad: 6 },
      { productoId: "p", productoVarianteId: "b", cantidad: 2 },
    ])
  })

  test("I1-E: producto base y variante son claves distintas (null y undefined = base)", () => {
    const totals = agregarCantidadesPorClave([
      { productoId: "p", productoVarianteId: "a", cantidad: 1 },
      { productoId: "p", productoVarianteId: null, cantidad: 1 },
      { productoId: "p", cantidad: 1 },
    ])
    expect(totals).toEqual([
      { productoId: "p", productoVarianteId: "a", cantidad: 1 },
      { productoId: "p", productoVarianteId: null, cantidad: 2 },
    ])
    expect(stockKey("p", "a")).not.toBe(stockKey("p", null))
  })

  test("I1-F: cantidades Float se suman correctamente", () => {
    const [total] = agregarCantidadesPorClave([
      { productoId: "p", cantidad: 0.25 },
      { productoId: "p", cantidad: 1.5 },
    ])
    expect(total.cantidad).toBeCloseTo(1.75, 10)
  })

  test("no mezcla productos distintos ni colisiona ids concatenados", () => {
    const totals = agregarCantidadesPorClave([
      { productoId: "p1", productoVarianteId: "x", cantidad: 1 },
      { productoId: "p", productoVarianteId: "1x", cantidad: 1 },
      { productoId: "q", cantidad: 4 },
    ])
    expect(totals).toHaveLength(3)
  })

  test("no muta el input", () => {
    const input = [
      { productoId: "p", productoVarianteId: "a", cantidad: 3 },
      { productoId: "p", productoVarianteId: "a", cantidad: 3 },
    ]
    const snapshot = JSON.stringify(input)
    agregarCantidadesPorClave(input)
    expect(JSON.stringify(input)).toBe(snapshot)
  })

  test("lista vacía → []", () => {
    expect(agregarCantidadesPorClave([])).toEqual([])
  })
})

describe("available / deficit (A0.1-6)", () => {
  test("I1-G: available normal (10 / 3 → 7, deficit 0)", () => {
    expect(resolveStockAvailability({ controlStock: true, physical: 10, activeReserved: 3 })).toEqual({ available: 7, deficit: 0 })
  })

  test("borde exacto (3 / 3 → 0, deficit 0)", () => {
    expect(resolveStockAvailability({ controlStock: true, physical: 3, activeReserved: 3 })).toEqual({ available: 0, deficit: 0 })
  })

  test("I1-H + I1-I: físico menor a reservado → available 0 (clamp), deficit 3", () => {
    expect(resolveStockAvailability({ controlStock: true, physical: 2, activeReserved: 5 })).toEqual({ available: 0, deficit: 3 })
  })

  test("Float: 2.5 / 1.25 → available 1.25", () => {
    expect(computeAvailableStock(2.5, 1.25)).toBeCloseTo(1.25, 10)
    expect(computeReservationDeficit(2.5, 1.25)).toBe(0)
  })

  test("I1-J: controlStock=false → available null (sin límite), deficit 0", () => {
    expect(resolveStockAvailability({ controlStock: false, physical: 0, activeReserved: 99 })).toEqual({ available: null, deficit: 0 })
  })

  test("invariantes: available y deficit nunca negativos; una reserva no cambia physical", () => {
    for (const [physical, reserved] of [[0, 0], [0, 5], [5, 0], [1.5, 7.25], [100, 100]]) {
      const input = { controlStock: true, physical, activeReserved: reserved }
      const r = resolveStockAvailability(input)
      expect(r.available!).toBeGreaterThanOrEqual(0)
      expect(r.deficit).toBeGreaterThanOrEqual(0)
      expect(input.physical).toBe(physical)
    }
  })
})

describe("modos ON / DRAINING / OFF (A0.1-9)", () => {
  test("I1-K: modos válidos y default OFF sólo como default explícito", () => {
    expect([...STOCK_RESERVATION_MODES]).toEqual(["ON", "DRAINING", "OFF"])
    for (const m of STOCK_RESERVATION_MODES) expect(isStockReservationMode(m)).toBe(true)
    for (const m of ["on", "", "PAUSED", null, undefined]) expect(isStockReservationMode(m)).toBe(false)
    expect(DEFAULT_STOCK_RESERVATION_MODE).toBe("OFF")
  })

  test("I1-F1: parseStockReservationMode acepta exactamente ON / DRAINING / OFF", () => {
    expect(parseStockReservationMode("ON")).toBe("ON")
    expect(parseStockReservationMode("DRAINING")).toBe("DRAINING")
    expect(parseStockReservationMode("OFF")).toBe("OFF")
  })

  test("I1-F1: valor persistido inválido es FAIL-CLOSED (null), nunca OFF", () => {
    for (const value of ["garbage", "off", "On", " OFF", "OFF ", "", "PAUSED", 0, 1, true, {}, []]) {
      const parsed = parseStockReservationMode(value)
      expect(parsed).toBeNull()
      expect(parsed).not.toBe("OFF")
    }
  })

  test("I1-F1: null y undefined NO se leen como OFF válido", () => {
    expect(parseStockReservationMode(null)).toBeNull()
    expect(parseStockReservationMode(undefined)).toBeNull()
    expect(parseStockReservationMode(null)).not.toBe(DEFAULT_STOCK_RESERVATION_MODE)
    expect(parseStockReservationMode(undefined)).not.toBe(DEFAULT_STOCK_RESERVATION_MODE)
  })

  test("semántica: sólo ON reserva; sólo DRAINING rechaza pedidos controlados nuevos; OFF ninguna", () => {
    expect(modeCreatesReservations("ON")).toBe(true)
    expect(modeCreatesReservations("DRAINING")).toBe(false)
    expect(modeCreatesReservations("OFF")).toBe(false)
    expect(modeRejectsNewControlledOrders("DRAINING")).toBe(true)
    expect(modeRejectsNewControlledOrders("ON")).toBe(false)
    expect(modeRejectsNewControlledOrders("OFF")).toBe(false)
  })

  test("I1-L: ON → DRAINING permitido", () => {
    expect(evaluateStockModeTransition("ON", "DRAINING", 5)).toEqual({ allowed: true })
  })

  test("I1-M: ON → OFF prohibido (incluso con 0 reservas)", () => {
    expect(evaluateStockModeTransition("ON", "OFF", 0)).toEqual({ allowed: false, reason: "ON_TO_OFF_FORBIDDEN" })
  })

  test("I1-N: DRAINING → OFF con reservas activas > 0 prohibido", () => {
    expect(evaluateStockModeTransition("DRAINING", "OFF", 1)).toEqual({ allowed: false, reason: "ACTIVE_RESERVATIONS_PRESENT" })
  })

  test("I1-O: DRAINING → OFF con 0 reservas activas permitido", () => {
    expect(evaluateStockModeTransition("DRAINING", "OFF", 0)).toEqual({ allowed: true })
  })

  test("OFF → ON permitido conceptualmente; mismo modo y transiciones no definidas rechazadas", () => {
    expect(evaluateStockModeTransition("OFF", "ON", 0)).toEqual({ allowed: true })
    expect(evaluateStockModeTransition("OFF", "OFF", 0)).toEqual({ allowed: false, reason: "SAME_MODE" })
    expect(evaluateStockModeTransition("DRAINING", "ON", 0)).toEqual({ allowed: false, reason: "INVALID_TRANSITION" })
    expect(evaluateStockModeTransition("OFF", "DRAINING", 0)).toEqual({ allowed: false, reason: "INVALID_TRANSITION" })
  })
})

describe("estados y motivos de ReservaStock (A0.1-12/17)", () => {
  test("estados ACTIVA/CONSUMIDA/LIBERADA", () => {
    expect([...RESERVA_ESTADOS]).toEqual(["ACTIVA", "CONSUMIDA", "LIBERADA"])
    expect(isReservaEstado("ACTIVA")).toBe(true)
    expect(isReservaEstado("activa")).toBe(false)
  })
  test("motivos de liberación previstos", () => {
    expect([...RESERVA_MOTIVOS_LIBERACION]).toEqual([
      "CANCELADO_CLIENTE", "CANCELADO_VENDEDOR", "CANCELADO_MESA", "CANCELADO_SISTEMA", "ROLLBACK", "PRODUCTO_ELIMINADO",
    ])
    expect(isReservaMotivoLiberacion("ROLLBACK")).toBe(true)
    expect(isReservaMotivoLiberacion("OTRO")).toBe(false)
  })
})
