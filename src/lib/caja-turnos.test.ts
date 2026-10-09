// ============================================
// F10-B2.1 — registers / shifts: pure validation + expected cash math (no DB)
// ============================================
import { describe, expect, test } from "bun:test"
import { Prisma } from "@prisma/client"
import { fingerprintAperturaTurno, parseDescripcionCaja, parseFondoInicial, parseNombreCaja } from "@/lib/caja-turnos-service"
import { calcularEfectivoEsperadoTurno, resumenVentasTurno } from "@/lib/caja-turnos-admin"

const D = (v: string) => new Prisma.Decimal(v)

describe("F10-B2.1 — opening cash validation (exact, never rounded silently)", () => {
  test("accepts non-negative amounts with up to 2 decimals, as number or string", () => {
    for (const [input, expected] of [[20000, "20000.00"], ["20000.00", "20000.00"], ["0.10", "0.10"], [0, "0.00"], [" 15.5 ", "15.50"], ["9999999999.99", "9999999999.99"]] as const) {
      const r = parseFondoInicial(input)
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.value.toFixed(2)).toBe(expected)
    }
  })

  test("rejects negatives, >2 decimals, non-numeric, exponent forms, out of range, non-finite and other types", () => {
    for (const input of [-1, "-1", "1.234", 1.234, "abc", "", "1e5", 1e10, "10000000000", Number.NaN, Number.POSITIVE_INFINITY, null, undefined, true, {}, []]) {
      expect(parseFondoInicial(input).ok).toBe(false)
    }
  })
})

describe("F10-B2.1 — register name / description", () => {
  test("names are trimmed, inner spaces collapsed, 1..60 chars", () => {
    expect(parseNombreCaja("  Caja   secundaria ")).toEqual({ ok: true, value: "Caja secundaria" })
    expect(parseNombreCaja("").ok).toBe(false)
    expect(parseNombreCaja("   ").ok).toBe(false)
    expect(parseNombreCaja(5).ok).toBe(false)
    expect(parseNombreCaja("x".repeat(60)).ok).toBe(true)
    expect(parseNombreCaja("x".repeat(61)).ok).toBe(false)
  })
  test("description optional, ≤200 chars", () => {
    expect(parseDescripcionCaja(undefined)).toEqual({ ok: true, value: null })
    expect(parseDescripcionCaja("  Mostrador del fondo ")).toEqual({ ok: true, value: "Mostrador del fondo" })
    expect(parseDescripcionCaja("x".repeat(201)).ok).toBe(false)
    expect(parseDescripcionCaja(3).ok).toBe(false)
  })
})

describe("F10-B2.1 — opening idempotency fingerprint", () => {
  test("same business/register/fund/actor → same fingerprint; any change → different", () => {
    const base = fingerprintAperturaTurno("n1", "c1", D("100.00"), { tipo: "EMPLEADO", empleadoId: "e1" })
    expect(fingerprintAperturaTurno("n1", "c1", D("100"), { tipo: "EMPLEADO", empleadoId: "e1" })).toBe(base)
    expect(fingerprintAperturaTurno("n1", "c2", D("100"), { tipo: "EMPLEADO", empleadoId: "e1" })).not.toBe(base)
    expect(fingerprintAperturaTurno("n1", "c1", D("100.01"), { tipo: "EMPLEADO", empleadoId: "e1" })).not.toBe(base)
    expect(fingerprintAperturaTurno("n1", "c1", D("100"), { tipo: "EMPLEADO", empleadoId: "e2" })).not.toBe(base)
    expect(fingerprintAperturaTurno("n1", "c1", D("100"), { tipo: "NEGOCIO" })).not.toBe(base)
    expect(fingerprintAperturaTurno("n2", "c1", D("100"), { tipo: "EMPLEADO", empleadoId: "e1" })).not.toBe(base)
  })
})

// In-memory fake of the four delegates the admin module reads.
function fakeDb() {
  const turnos = [
    { id: "t1", negocioId: "n1", cajaFisicaId: "c1", fondoInicialDecimal: D("20000.00") },
    { id: "t2", negocioId: "n1", cajaFisicaId: "c2", fondoInicialDecimal: D("0.10") },
    { id: "t3", negocioId: "n1", cajaFisicaId: "c3", fondoInicialDecimal: D("50.00") },
  ]
  const cuentas = [
    { id: "a1", negocioId: "n1", cajaFisicaId: "c1", tipo: "EFECTIVO" },
    { id: "a2", negocioId: "n1", cajaFisicaId: "c2", tipo: "EFECTIVO" },
  ]
  const legs = [
    { cuentaId: "a1", negocioId: "n1", turnoCajaId: "t1", importe: 5000, importeDecimal: D("5000.00") },
    { cuentaId: "a1", negocioId: "n1", turnoCajaId: "t1", importe: 0.1, importeDecimal: D("0.10") },
    { cuentaId: "a1", negocioId: "n1", turnoCajaId: "t1", importe: -200, importeDecimal: D("-200.00") }, // future outflow (signed)
    { cuentaId: "a1", negocioId: "n1", turnoCajaId: "tOld", importe: 999, importeDecimal: D("999.00") }, // another shift of the same register
    { cuentaId: "a2", negocioId: "n1", turnoCajaId: "t2", importe: 0.2, importeDecimal: null }, // legacy row without Decimal
    { cuentaId: "a2", negocioId: "n1", turnoCajaId: "t2", importe: 0.1, importeDecimal: D("0.10") },
  ]
  const ventas = [
    { negocioId: "n1", turnoCajaId: "t1", metodoPago: "EFECTIVO", total: 5000, totalDecimal: D("5000.00") },
    { negocioId: "n1", turnoCajaId: "t1", metodoPago: "TRANSFERENCIA", total: 8000, totalDecimal: D("8000.00") },
    { negocioId: "n1", turnoCajaId: "t2", metodoPago: "EFECTIVO", total: 0.1, totalDecimal: null },
  ]
  type Where = Record<string, unknown>
  const match = (row: Record<string, unknown>, where: Where) => Object.entries(where).every(([k, v]) => row[k] === v)
  return {
    turnoCaja: { findFirst: async ({ where }: { where: Where }) => turnos.find((t) => match(t, where)) ?? null },
    cuentaFinanciera: { findFirst: async ({ where }: { where: Where }) => cuentas.find((c) => match(c, where)) ?? null },
    movimientoFinanciero: {
      findMany: async ({ where }: { where: { negocioId: string; cuentaId: string; operacion: { turnoCajaId: string; negocioId: string } } }) =>
        legs.filter((l) => l.negocioId === where.negocioId && l.cuentaId === where.cuentaId && l.turnoCajaId === where.operacion.turnoCajaId),
    },
    venta: { findMany: async ({ where }: { where: Where }) => ventas.filter((v) => match(v, where)) },
  }
}

describe("F10-B2.1 — expected cash (owner-only, exact)", () => {
  test("fund + cash legs of THIS shift − outflows; transfers never count; other shifts never count", async () => {
    const r = await calcularEfectivoEsperadoTurno(fakeDb() as never, "n1", "t1")
    expect(r).not.toBeNull()
    expect(r!.fondoInicial.toFixed(2)).toBe("20000.00")
    expect(r!.ingresosEfectivo.toFixed(2)).toBe("5000.10")
    expect(r!.salidasEfectivo.toFixed(2)).toBe("200.00")
    expect(r!.esperado.toFixed(2)).toBe("24800.10")
  })

  test("registers are isolated; legacy Float legs are quantized; 0.10 + 0.20 + 0.10 = 0.40 exactly", async () => {
    const r = await calcularEfectivoEsperadoTurno(fakeDb() as never, "n1", "t2")
    expect(r!.esperado.toFixed(2)).toBe("0.40")
  })

  test("a shift with no cash account yet → expected = fund; unknown / foreign shift → null", async () => {
    const db = fakeDb()
    expect((await calcularEfectivoEsperadoTurno(db as never, "n1", "t3"))!.esperado.toFixed(2)).toBe("50.00")
    expect(await calcularEfectivoEsperadoTurno(db as never, "n1", "nope")).toBeNull()
    expect(await calcularEfectivoEsperadoTurno(db as never, "otro-negocio", "t1")).toBeNull()
  })

  test("sales summary per shift by method (exact)", async () => {
    const r = await resumenVentasTurno(fakeDb() as never, "n1", "t1")
    expect(r.cantidadVentas).toBe(2)
    expect(r.totalEfectivo.toFixed(2)).toBe("5000.00")
    expect(r.totalTransferencia.toFixed(2)).toBe("8000.00")
    expect(r.totalOtro.toFixed(2)).toBe("0.00")
  })
})
