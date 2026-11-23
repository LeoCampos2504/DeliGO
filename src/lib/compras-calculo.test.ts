// ============================================
// F10-C2a — cálculo puro de costos de una recepción (sin base de datos)
// ============================================
import { describe, expect, test } from "bun:test"
import { Prisma } from "@prisma/client"
import { calcularRecepcion, claveComprobante, diferenciaPct, esMasReciente, repartir, CalculoCompraError } from "@/lib/compras-calculo"

const d = (v: string | number) => new Prisma.Decimal(v)
const s = (v: Prisma.Decimal | null) => (v === null ? null : v.toFixed(v.decimalPlaces() > 2 ? 4 : 2))

// Caso completo calculado a mano (ver §13 del diseño):
//   A: 10 × 100, desc 10 %, IVA 21 % · B: recibidas 5, aceptadas 4 (1 dañada) × 50, IVA 10,5 %
//   descuento global 55 · percepciones 21,45 · flete del mismo proveedor 104,50 (por valor)
//   transportista (otro proveedor) 20,90 (por cantidad) · gasto no atribuible 40
const caso = (tratamiento: "IMPUESTOS_INTEGRAN_COSTO" | "IMPUESTOS_RECUPERABLES") =>
  calcularRecepcion({
    lineas: [
      { id: "A", aceptada: d(10), costoUnitario: d(100), descuentoPct: d(10), alicuotaPct: d(21) },
      { id: "B", aceptada: d(4), costoUnitario: d(50), descuentoPct: d(0), alicuotaPct: d("10.5") },
    ],
    descuentoGlobal: d(55),
    percepciones: d("21.45"),
    cargos: [
      { id: "flete", tipo: "ATRIBUIBLE", mismoProveedor: true, importe: d("104.5"), distribucion: "VALOR" },
      { id: "transporte", tipo: "ATRIBUIBLE", mismoProveedor: false, importe: d("20.9"), distribucion: "CANTIDAD" },
      { id: "gasto", tipo: "NO_ATRIBUIBLE", mismoProveedor: true, importe: d(40), distribucion: null },
    ],
    tratamientoImpuestos: tratamiento,
  })

describe("F10-C2a — reparto exacto", () => {
  test("resto mayor en centavos: la suma es exactamente el total, nunca se crea ni se pierde un centavo", () => {
    expect(repartir(d("20.9"), [d(10), d(4)]).map((x) => x.toFixed(2))).toEqual(["14.93", "5.97"])
    expect(repartir(d("0.01"), [d(1), d(1), d(1)]).map((x) => x.toFixed(2))).toEqual(["0.01", "0.00", "0.00"])
    expect(repartir(d(100), [d(1), d(0), d(1)]).map((x) => x.toFixed(2))).toEqual(["50.00", "0.00", "50.00"])
    for (let i = 0; i < 300; i++) {
      const total = d((Math.floor(Math.random() * 10_000_000) / 100).toFixed(2))
      const pesos = Array.from({ length: 1 + (i % 7) }, () => d((Math.random() * 1000).toFixed(3)))
      if (!pesos.some((p) => p.gt(0))) continue
      const partes = repartir(total, pesos)
      expect(partes.reduce((a, b) => a.plus(b), d(0)).toFixed(2)).toBe(total.toFixed(2))
      expect(partes.every((p) => p.decimalPlaces() <= 2 && !p.isNegative())).toBe(true)
    }
    expect(() => repartir(d(1), [d(0), d(0)])).toThrow(CalculoCompraError)
  })
})

describe("F10-C2a — costo de una recepción (§6)", () => {
  test("descuentos de línea y global, impuestos, percepciones y cargos: costo por línea y obligación", () => {
    const r = caso("IMPUESTOS_INTEGRAN_COSTO")
    const [a, b] = r.lineas
    expect([s(a.subtotal), s(a.descuentoLinea), s(a.descuentoGlobal), s(a.neto), s(a.impuestos), s(a.percepcion), s(a.cargos), s(a.costoInventarioTotal)])
      .toEqual(["1000.00", "100.00", "45.00", "855.00", "179.55", "17.55", "100.43", "1152.53"])
    expect([s(b.subtotal), s(b.descuentoLinea), s(b.descuentoGlobal), s(b.neto), s(b.impuestos), s(b.percepcion), s(b.cargos), s(b.costoInventarioTotal)])
      .toEqual(["200.00", "0.00", "10.00", "190.00", "19.95", "3.90", "24.97", "238.82"])
    expect(a.costoUnitarioInventario!.toFixed(4)).toBe("115.2530")
    expect(b.costoUnitarioInventario!.toFixed(4)).toBe("59.7050")
    expect(r.totalObligacion.toFixed(2)).toBe("1370.45") // 1045 neto + 199,50 IVA + 21,45 percepciones + 104,50 flete
    expect(r.cargosConObligacionPropia.map((c) => [c.id, c.importe.toFixed(2), c.gasto])).toEqual([["transporte", "20.90", false], ["gasto", "40.00", true]])
    // el gasto NO atribuible nunca entra al inventario; cada peso se cuenta una sola vez
    expect(r.cargosInventario.toFixed(2)).toBe("125.40")
    expect(r.costoInventarioTotal.toFixed(2)).toBe("1391.35") // 1045 + 199,50 + 21,45 + 125,40
  })

  test("impuestos recuperables: el IVA no integra el costo, pero la deuda es la misma", () => {
    const r = caso("IMPUESTOS_RECUPERABLES")
    expect(r.lineas[0].costoUnitarioInventario!.toFixed(4)).toBe("97.2980")
    expect(r.lineas[1].costoUnitarioInventario!.toFixed(4)).toBe("54.7175")
    expect(r.totalObligacion.toFixed(2)).toBe("1370.45")
  })

  test("líneas totalmente rechazadas no generan costo ni deuda; un descuento mayor a la mercadería se rechaza", () => {
    const r = calcularRecepcion({ lineas: [{ id: "x", aceptada: d(0), costoUnitario: d(10), descuentoPct: d(0), alicuotaPct: d(21) }], descuentoGlobal: d(0), percepciones: d(0), cargos: [], tratamientoImpuestos: "IMPUESTOS_INTEGRAN_COSTO" })
    expect(r.totalObligacion.toFixed(2)).toBe("0.00")
    expect(r.lineas[0].costoUnitarioInventario).toBeNull()
    expect(() => calcularRecepcion({ lineas: [{ id: "x", aceptada: d(1), costoUnitario: d(10), descuentoPct: d(0), alicuotaPct: d(0) }], descuentoGlobal: d("10.01"), percepciones: d(0), cargos: [], tratamientoImpuestos: "IMPUESTOS_INTEGRAN_COSTO" })).toThrow("supera")
    expect(() => calcularRecepcion({ lineas: [{ id: "x", aceptada: d(0), costoUnitario: d(10), descuentoPct: d(0), alicuotaPct: d(0) }], descuentoGlobal: d(0), percepciones: d(0), cargos: [{ id: "f", tipo: "ATRIBUIBLE", mismoProveedor: true, importe: d(5), distribucion: "VALOR" }], tratamientoImpuestos: "IMPUESTOS_INTEGRAN_COSTO" })).toThrow(CalculoCompraError)
  })
})

describe("F10-C2a — comprobantes y último costo", () => {
  test("comprobante normalizado: mismo tipo y número con otro formato es el mismo", () => {
    expect(claveComprobante("Factura A", "0001-00001234")).toBe(claveComprobante("factura a", "1-00001234"))
    expect(claveComprobante("Factura A", "0001-00001234")).not.toBe(claveComprobante("Remito", "0001-00001234"))
    expect(claveComprobante("Factura", "")).toBeNull()
  })

  test("orden real de las recepciones: fecha de recepción, luego aprobación, luego id", () => {
    const base = { fechaRecepcion: new Date("2026-11-10T12:00:00Z"), aprobadaEn: new Date("2026-11-11T10:00:00Z"), recepcionLineaId: "b" }
    expect(esMasReciente({ ...base, fechaRecepcion: new Date("2026-11-05T12:00:00Z"), aprobadaEn: new Date("2026-11-20T10:00:00Z") }, base)).toBe(false)
    expect(esMasReciente({ ...base, fechaRecepcion: new Date("2026-11-12T12:00:00Z") }, base)).toBe(true)
    expect(esMasReciente({ ...base, aprobadaEn: new Date("2026-11-12T10:00:00Z") }, base)).toBe(true)
    expect(esMasReciente({ ...base, recepcionLineaId: "c" }, base)).toBe(true)
    expect(diferenciaPct(d(125), d(100))!.toFixed(2)).toBe("25.00")
    expect(diferenciaPct(d(125), null)).toBeNull()
  })
})
