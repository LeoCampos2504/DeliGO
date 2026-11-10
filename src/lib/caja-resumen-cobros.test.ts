/// <reference types="bun-types" />

// F4-C2 — money by method from the real cobros (unit, no database).
// The reference below is the formula the owner and shift summaries used before
// F4-C2 (Venta.total grouped by Venta.metodoPago); for every sale shape that
// exists today the new reading must give exactly the same figures.

import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { Prisma } from "@prisma/client"
import { addMoney, storedMoney } from "@/lib/money"
import { agruparCobrosPorVenta, COBRO_RESUMEN_SELECT, cobrosDeVenta, resumirCobrosCaja, type VentaParaResumen } from "@/lib/caja-resumen-cobros"
import { importeReintegrableDevolucion } from "@/lib/caja-devoluciones-service"

const D = (v: string) => new Prisma.Decimal(v)

/** The pre-F4-C2 formula (route + resumenVentasTurno), kept here as the equivalence reference. */
function resumenAnterior(ventas: ReadonlyArray<VentaParaResumen>) {
  const sumar = (metodo?: string) => addMoney(...ventas.filter((v) => !metodo || v.metodoPago === metodo).map((v) => storedMoney(v.totalDecimal, v.total)))
  return { total: sumar().toFixed(2), EFECTIVO: sumar("EFECTIVO").toFixed(2), TRANSFERENCIA: sumar("TRANSFERENCIA").toFixed(2), OTRO: sumar("OTRO").toFixed(2) }
}
function resumenNuevo(ventas: ReadonlyArray<VentaParaResumen>) {
  const r = resumirCobrosCaja(ventas)
  return { total: r.ventasBrutas.toFixed(2), EFECTIVO: r.cobradoPorMedio.EFECTIVO.toFixed(2), TRANSFERENCIA: r.cobradoPorMedio.TRANSFERENCIA.toFixed(2), OTRO: r.cobradoPorMedio.OTRO.toFixed(2) }
}

// A sale exactly as the engine writes it today: one cobro of its method for its total.
const venta = (metodo: string, total: string): VentaParaResumen => ({
  metodoPago: metodo,
  total: Number(total),
  totalDecimal: D(total),
  cobros: [{ metodo, importe: Number(total), importeDecimal: D(total) }],
})
// A sale created before F10-B0: no CobroVenta rows.
const legacy = (metodo: string, total: number, totalDecimal: string | null = null): VentaParaResumen => ({
  metodoPago: metodo,
  total,
  totalDecimal: totalDecimal === null ? null : D(totalDecimal),
  cobros: [],
})

describe("F4-C2 — resumirCobrosCaja", () => {
  test("current sales (one cobro each): identical to the former Venta.metodoPago grouping, exact cents", () => {
    const ventas = [venta("EFECTIVO", "0.10"), venta("EFECTIVO", "0.20"), venta("TRANSFERENCIA", "0.70"), venta("OTRO", "1500.55"), venta("EFECTIVO", "10500.00")]
    expect(resumenNuevo(ventas)).toEqual(resumenAnterior(ventas))
    expect(resumenNuevo(ventas)).toEqual({ total: "12001.55", EFECTIVO: "10500.30", TRANSFERENCIA: "0.70", OTRO: "1500.55" })
  })

  test("legacy sales without cobros (pre-F10-B0) are read from their own metodoPago, Float quantized to cents", () => {
    const ventas = [legacy("TRANSFERENCIA", 0.7), legacy("EFECTIVO", 30.3, "30.30"), legacy("OTRO", 0.105), venta("EFECTIVO", "5.00")]
    expect(resumenNuevo(ventas)).toEqual(resumenAnterior(ventas))
    const r = resumirCobrosCaja(ventas)
    expect(r.ventasSinCobros).toBe(3)
    expect(r.cantidadVentas).toBe(4)
    // absent cobros (e.g. a query that did not select them) is the same legacy reading
    expect(resumenNuevo([{ metodoPago: "EFECTIVO", total: 10, totalDecimal: D("10.00") }])).toEqual(resumenAnterior([{ metodoPago: "EFECTIVO", total: 10, totalDecimal: null }]))
  })

  test("a cobro written before the Decimal backfill (Float only) is quantized like the sale", () => {
    const ventas: VentaParaResumen[] = [{ metodoPago: "EFECTIVO", total: 30.3, totalDecimal: null, cobros: [{ metodo: "EFECTIVO", importe: 30.3, importeDecimal: null }] }]
    expect(resumenNuevo(ventas)).toEqual(resumenAnterior(ventas))
    expect(resumenNuevo(ventas).EFECTIVO).toBe("30.30")
  })

  test("deterministic sweep: 300 current + legacy sales of every method give the same figures as before", () => {
    const metodos = ["EFECTIVO", "TRANSFERENCIA", "OTRO"]
    const ventas: VentaParaResumen[] = []
    for (let i = 0; i < 300; i++) {
      const total = ((i * 7919) % 100000) / 100
      const metodo = metodos[i % 3]
      ventas.push(i % 5 === 0 ? legacy(metodo, total) : venta(metodo, total.toFixed(2)))
    }
    expect(resumenNuevo(ventas)).toEqual(resumenAnterior(ventas))
  })

  test("no double counting: Σ money + non-money cobros = Σ cobros; each sale's cobros counted once", () => {
    const ventas = [venta("EFECTIVO", "100.00"), venta("TRANSFERENCIA", "50.00"), legacy("OTRO", 25)]
    const r = resumirCobrosCaja(ventas)
    expect(r.cobradoTotal.toFixed(2)).toBe("175.00")
    expect(r.cobradoTotal.plus(r.noDinero).toFixed(2)).toBe(r.ventasBrutas.toFixed(2))
    expect(r.noDinero.toFixed(2)).toBe("0.00")
    // the same cobro rows, grouped by sale, never leak to another sale
    const grouped = agruparCobrosPorVenta([
      { ventaId: "a", metodo: "EFECTIVO", importe: 100, importeDecimal: D("100.00") },
      { ventaId: "b", metodo: "TRANSFERENCIA", importe: 50, importeDecimal: D("50.00") },
    ])
    expect(grouped.get("a")!.map((c) => c.metodo)).toEqual(["EFECTIVO"])
    expect(grouped.get("b")!.map((c) => c.metodo)).toEqual(["TRANSFERENCIA"])
    expect(grouped.get("c")).toBeUndefined()
  })

  test("prepared for F4-C: a cobro of a non-money method (future internal credit) is never money", () => {
    // Hypothetical linked exchange sale of $3.500: $2.000 internal credit + $1.500 cash (method name illustrative).
    const cambio: VentaParaResumen = {
      metodoPago: "CAMBIO",
      total: 3500,
      totalDecimal: D("3500.00"),
      cobros: [
        { metodo: "CREDITO_INTERNO_DE_PRUEBA", importe: 2000, importeDecimal: D("2000.00") },
        { metodo: "EFECTIVO", importe: 1500, importeDecimal: D("1500.00") },
      ],
    }
    const r = resumirCobrosCaja([cambio])
    expect(r.ventasBrutas.toFixed(2)).toBe("3500.00")
    expect(r.cobradoPorMedio.EFECTIVO.toFixed(2)).toBe("1500.00")
    expect(r.cobradoTotal.toFixed(2)).toBe("1500.00")
    expect(r.noDinero.toFixed(2)).toBe("2000.00")
    expect(cobrosDeVenta(cambio).every((c) => !c.legacy)).toBe(true)
  })

  test("a declared transfer is never presented as reconciled: no reconciliation state is read or reported", () => {
    expect(Object.keys(COBRO_RESUMEN_SELECT).sort()).toEqual(["importe", "importeDecimal", "metodo"])
    const r = resumirCobrosCaja([venta("TRANSFERENCIA", "700.00")])
    expect(Object.keys(r).sort()).toEqual(["cantidadVentas", "cobradoPorMedio", "cobradoTotal", "noDinero", "ventasBrutas", "ventasSinCobros"])
    expect(JSON.stringify(Object.keys(r))).not.toMatch(/concilia|verific|acredit/i)
    expect(r.cobradoPorMedio.TRANSFERENCIA.toFixed(2)).toBe("700.00")
  })

  test("empty day / empty shift: all zero", () => {
    const r = resumirCobrosCaja([])
    expect([r.cantidadVentas, r.ventasBrutas.toFixed(2), r.cobradoTotal.toFixed(2), r.noDinero.toFixed(2), r.ventasSinCobros]).toEqual([0, "0.00", "0.00", "0.00", 0])
  })
})

describe("F4-C2/F4-C3 — importe reintegrable de una devolución (conectado en F4-C3)", () => {
  test("without compensation it is the whole returned amount (today's behaviour)", () => {
    expect(importeReintegrableDevolucion({ importeDevuelto: D("2000.00") }).toFixed(2)).toBe("2000.00")
    expect(importeReintegrableDevolucion({ importeDevuelto: D("2000.00"), importeCompensado: null }).toFixed(2)).toBe("2000.00")
  })
  test("a compensated part is subtracted exactly; out-of-range compensation is rejected", () => {
    expect(importeReintegrableDevolucion({ importeDevuelto: D("2000.00"), importeCompensado: D("1000.00") }).toFixed(2)).toBe("1000.00")
    expect(importeReintegrableDevolucion({ importeDevuelto: D("2000.00"), importeCompensado: D("2000.00") }).toFixed(2)).toBe("0.00")
    expect(() => importeReintegrableDevolucion({ importeDevuelto: D("2000.00"), importeCompensado: D("2000.01") })).toThrow()
    expect(() => importeReintegrableDevolucion({ importeDevuelto: D("2000.00"), importeCompensado: D("-0.01") })).toThrow()
  })
  test("F4-C3/F4-C4: both refund paths use it, and the cash outflow is always the refundable amount", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/caja-devoluciones-service.ts"), "utf8").replace(/\r\n/g, "\n")
    expect(src.match(/importeReintegrableDevolucion\(/g)).toHaveLength(3) // definition + return + later refund
    // F4-C4: compensated = 0 for every F4-A return; only an exchange passes compensacion.
    expect(src).toContain("const importeCompensado = input.compensacion ? Prisma.Decimal.min(importeTotal, input.compensacion.importeEntrada) : new Prisma.Decimal(0)")
    expect(src).toContain("const importeReintegrable = importeReintegrableDevolucion({ importeDevuelto: importeTotal, importeCompensado })")
    expect(src).toContain("importeReintegrableDevolucion({ importeDevuelto: devolucion.importeDecimal, importeCompensado: devolucion.importeCompensadoDecimal })")
    expect(src.match(/crearOperacionReintegro\(tx, negocioId, actorResuelto, destino\.value, importeReintegrable\)/g)).toHaveLength(2)
    expect(src).not.toMatch(/crearOperacionReintegro\([^)]*importeTotal\)|crearOperacionReintegro\([^)]*devolucion\.importeDecimal\)/)
  })
})

describe("F4-C2 — blind close: the summary helper is owner-only", () => {
  test("no cashier code imports the cobro summary", () => {
    const root = process.cwd()
    const walk = (dir: string): string[] =>
      readdirSync(join(root, dir)).flatMap((entry) => {
        const rel = `${dir}/${entry}`
        return statSync(join(root, rel)).isDirectory() ? walk(rel) : /\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry) ? [rel] : []
      })
    const cashier = [...walk("src/app/api/operativo"), ...walk("src/app/operaciones"), "src/lib/operativo-caja.ts"]
    const importers = cashier.filter((path) => /caja-resumen-cobros|caja-turnos-admin/.test(readFileSync(join(root, path), "utf8")))
    expect(importers).toEqual([])
  })
})
