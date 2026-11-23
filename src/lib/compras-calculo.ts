// ============================================
// F10-C2a — cálculo PURO del costo de una recepción (diseño v2 §6)
// ============================================
// Sin base de datos ni efectos: recibe cantidades y costos exactos (Decimal) y devuelve la
// instantánea que la aprobación congela en cada línea y la obligación que nace en F5.
//
//   subtotal(l)        = round2(aceptada × costoUnitario)
//   descuentoLinea(l)  = round2(subtotal × descuentoPct / 100)          (bonificación del renglón)
//   descuentoGlobal(l) = reparto del descuento del comprobante por VALOR (subtotal − descuentoLinea)
//   neto(l)            = subtotal − descuentoLinea − descuentoGlobal
//   impuestos(l)       = round2(neto × alícuota / 100)
//   percepción(l)      = reparto de las percepciones por VALOR (neto)    (no recuperables: integran costo)
//   cargos(l)          = reparto de cada cargo ATRIBUIBLE por VALOR (neto) o por CANTIDAD (aceptada)
//   costoInventario(l) = neto + percepción + cargos + (impuestos si IMPUESTOS_INTEGRAN_COSTO)
//   costoUnitarioInv   = costoInventario / aceptada   (4 decimales, HALF_UP)
//
//   obligación de la recepción = Σ(neto + impuestos) + percepciones + Σ cargos ATRIBUIBLES del MISMO proveedor
//   obligación por cargo       = cada cargo ATRIBUIBLE de OTRO proveedor y cada cargo NO_ATRIBUIBLE (gasto)
//
// Los repartos son por resto mayor en centavos: la suma repartida es EXACTAMENTE el total
// (ningún centavo se crea ni se pierde). Un cargo NO_ATRIBUIBLE nunca entra al inventario.

import { Prisma } from "@prisma/client"

const D = Prisma.Decimal
type Dec = Prisma.Decimal
const CERO = new D(0)
const CIEN = new D(100)
const HALF_UP = Prisma.Decimal.ROUND_HALF_UP

export const TRATAMIENTOS_IMPUESTOS = ["IMPUESTOS_INTEGRAN_COSTO", "IMPUESTOS_RECUPERABLES"] as const
export type TratamientoImpuestos = (typeof TRATAMIENTOS_IMPUESTOS)[number]

export const r2 = (v: Dec) => v.toDecimalPlaces(2, HALF_UP)
export const r4 = (v: Dec) => v.toDecimalPlaces(4, HALF_UP)

export class CalculoCompraError extends Error {
  constructor(readonly code: string, message: string) {
    super(message)
  }
}

/**
 * Reparte `total` (2 decimales) entre `pesos` proporcionalmente, por resto mayor en centavos.
 * Desempate estable por índice. La suma devuelta es exactamente `total`.
 */
export function repartir(total: Dec, pesos: ReadonlyArray<Dec>): Dec[] {
  if (total.isZero()) return pesos.map(() => CERO)
  if (total.isNegative()) throw new CalculoCompraError("REPARTO_INVALIDO", "No se puede repartir un importe negativo.")
  const suma = pesos.reduce((a, p) => a.plus(p), CERO)
  if (!suma.gt(0)) throw new CalculoCompraError("REPARTO_SIN_BASE", "No hay base para repartir el importe (todas las líneas valen cero).")
  const centavos = total.times(100)
  const exactos = pesos.map((p) => centavos.times(p).dividedBy(suma))
  const base = exactos.map((e) => e.floor())
  let resto = centavos.minus(base.reduce((a, b) => a.plus(b), CERO)).toNumber()
  const orden = exactos.map((e, i) => ({ i, frac: e.minus(e.floor()) })).sort((a, b) => b.frac.comparedTo(a.frac) || a.i - b.i)
  const extra = new Array<number>(pesos.length).fill(0)
  for (const { i } of orden) {
    if (resto <= 0) break
    if (!pesos[i].gt(0)) continue
    extra[i] += 1
    resto -= 1
  }
  return base.map((b, i) => b.plus(extra[i]).dividedBy(100))
}

export interface LineaCalculo {
  id: string
  aceptada: Dec
  costoUnitario: Dec
  descuentoPct: Dec
  alicuotaPct: Dec
}

export interface CargoCalculo {
  id: string
  tipo: "ATRIBUIBLE" | "NO_ATRIBUIBLE"
  mismoProveedor: boolean
  importe: Dec
  distribucion: "VALOR" | "CANTIDAD" | null
}

export interface ResultadoLinea {
  id: string
  subtotal: Dec
  descuentoLinea: Dec
  descuentoGlobal: Dec
  neto: Dec
  impuestos: Dec
  percepcion: Dec
  cargos: Dec
  costoInventarioTotal: Dec
  costoUnitarioInventario: Dec | null
}

export interface ResultadoRecepcion {
  lineas: ResultadoLinea[]
  neto: Dec
  descuentos: Dec
  impuestos: Dec
  percepciones: Dec
  /** Cargos ATRIBUIBLES del mismo proveedor (van en la obligación de la recepción). */
  cargosMismoProveedor: Dec
  /** Cargos que entran al costo de inventario (todos los ATRIBUIBLES). */
  cargosInventario: Dec
  totalObligacion: Dec
  /** Cargos con obligación propia: ATRIBUIBLE de otro proveedor o NO_ATRIBUIBLE (gasto). */
  cargosConObligacionPropia: Array<{ id: string; importe: Dec; gasto: boolean }>
  costoInventarioTotal: Dec
}

export function calcularRecepcion(input: {
  lineas: ReadonlyArray<LineaCalculo>
  descuentoGlobal: Dec
  percepciones: Dec
  cargos: ReadonlyArray<CargoCalculo>
  tratamientoImpuestos: TratamientoImpuestos
}): ResultadoRecepcion {
  const { lineas, tratamientoImpuestos } = input
  const subtotales = lineas.map((l) => r2(l.aceptada.times(l.costoUnitario)))
  const descLinea = lineas.map((l, i) => r2(subtotales[i].times(l.descuentoPct).dividedBy(CIEN)))
  const netoLinea = subtotales.map((s, i) => s.minus(descLinea[i]))
  const sumaNetoLinea = netoLinea.reduce((a, b) => a.plus(b), CERO)
  if (input.descuentoGlobal.gt(sumaNetoLinea)) {
    throw new CalculoCompraError("DESCUENTO_SUPERA_NETO", "El descuento del comprobante supera el importe de la mercadería aceptada.")
  }
  const descGlobal = input.descuentoGlobal.isZero() ? lineas.map(() => CERO) : repartir(input.descuentoGlobal, netoLinea)
  const neto = netoLinea.map((n, i) => n.minus(descGlobal[i]))
  const impuestos = lineas.map((l, i) => r2(neto[i].times(l.alicuotaPct).dividedBy(CIEN)))
  const percepcion = input.percepciones.isZero() ? lineas.map(() => CERO) : repartir(input.percepciones, neto)
  const cargosLinea = lineas.map(() => CERO)
  let cargosMismoProveedor = CERO
  let cargosInventario = CERO
  const cargosConObligacionPropia: ResultadoRecepcion["cargosConObligacionPropia"] = []
  for (const c of input.cargos) {
    if (c.tipo === "ATRIBUIBLE") {
      const pesos = c.distribucion === "CANTIDAD" ? lineas.map((l) => l.aceptada) : neto
      const partes = repartir(c.importe, pesos)
      partes.forEach((p, i) => { cargosLinea[i] = cargosLinea[i].plus(p) })
      cargosInventario = cargosInventario.plus(c.importe)
      if (c.mismoProveedor) cargosMismoProveedor = cargosMismoProveedor.plus(c.importe)
      else cargosConObligacionPropia.push({ id: c.id, importe: c.importe, gasto: false })
    } else {
      cargosConObligacionPropia.push({ id: c.id, importe: c.importe, gasto: true })
    }
  }
  const integran = tratamientoImpuestos === "IMPUESTOS_INTEGRAN_COSTO"
  const resultado: ResultadoLinea[] = lineas.map((l, i) => {
    const costoInventarioTotal = neto[i].plus(percepcion[i]).plus(cargosLinea[i]).plus(integran ? impuestos[i] : CERO)
    return {
      id: l.id,
      subtotal: subtotales[i],
      descuentoLinea: descLinea[i],
      descuentoGlobal: descGlobal[i],
      neto: neto[i],
      impuestos: impuestos[i],
      percepcion: percepcion[i],
      cargos: cargosLinea[i],
      costoInventarioTotal,
      costoUnitarioInventario: l.aceptada.gt(0) ? r4(costoInventarioTotal.dividedBy(l.aceptada)) : null,
    }
  })
  const suma = (k: keyof Pick<ResultadoLinea, "neto" | "impuestos" | "descuentoLinea" | "descuentoGlobal" | "costoInventarioTotal">) =>
    resultado.reduce((a, r) => a.plus(r[k]), CERO)
  const netoTotal = suma("neto")
  const impuestosTotal = suma("impuestos")
  return {
    lineas: resultado,
    neto: netoTotal,
    descuentos: suma("descuentoLinea").plus(suma("descuentoGlobal")),
    impuestos: impuestosTotal,
    percepciones: input.percepciones,
    cargosMismoProveedor,
    cargosInventario,
    totalObligacion: netoTotal.plus(impuestosTotal).plus(input.percepciones).plus(cargosMismoProveedor),
    cargosConObligacionPropia,
    costoInventarioTotal: suma("costoInventarioTotal"),
  }
}

/** «tipo|número» normalizado para detectar comprobantes repetidos (D-5). */
export function claveComprobante(tipo: string | null | undefined, numero: string | null | undefined): string | null {
  const n = (numero ?? "").toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "").replace(/^0+(?=\d)/, "")
  if (!n) return null
  const t = (tipo ?? "").toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "")
  return `${t}|${n}`
}

/** Clave de stock (misma forma que stock-authority: variante si existe, si no producto). */
export const claveStock = (productoId: string, productoVarianteId: string | null) => `${productoId}|${productoVarianteId ?? ""}`

/** Orden real de las recepciones para el «último costo»: fecha de recepción, luego aprobación, luego id. */
export function esMasReciente(a: { fechaRecepcion: Date; aprobadaEn: Date; recepcionLineaId: string }, b: { fechaRecepcion: Date; aprobadaEn: Date; recepcionLineaId: string }): boolean {
  const f = a.fechaRecepcion.getTime() - b.fechaRecepcion.getTime()
  if (f !== 0) return f > 0
  const ap = a.aprobadaEn.getTime() - b.aprobadaEn.getTime()
  if (ap !== 0) return ap > 0
  return a.recepcionLineaId > b.recepcionLineaId
}

/** Diferencia porcentual |a − ref| / ref × 100 (null si no hay referencia útil). */
export function diferenciaPct(costo: Dec, referencia: Dec | null): Dec | null {
  if (!referencia || !referencia.gt(0)) return null
  return costo.minus(referencia).abs().times(CIEN).dividedBy(referencia).toDecimalPlaces(2, HALF_UP)
}
