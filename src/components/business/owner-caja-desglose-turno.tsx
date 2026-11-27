"use client"

// F10-C1c — owner only: the cash of one shift by type, reconciled with the expected cash.
// Kept apart from owner-caja-egresos.tsx so the closed-shift review can use it without an import cycle.

import { formatoArs } from "@/components/business/caja-salidas-cajero"

export type DesgloseEfectivo = {
  fondoInicial: number
  ventasEfectivo: number
  reintegros: number
  gastos: number
  pagosProveedor: number
  retirosDueno: number
  compensaciones: number
  compensacionesPorNaturaleza?: { GASTO: number; PAGO_PROVEEDOR: number; RETIRO_DUENO: number }
  /** F10-D1: cash of an earlier outflow that came back into this shift (not a sale). */
  recuperosEgresos?: number
  otrosIngresos: number
  otrasSalidas: number
  esperadoCalculado: number
  cuadra: boolean | null
}

/** Cash of one shift by type, reconciled with the expected cash (owner only). */
export function DesgloseEfectivoTurno({ desglose: d }: { desglose: DesgloseEfectivo }) {
  const filas: Array<[string, number, "+" | "−" | "="]> = [
    ["Fondo inicial", d.fondoInicial, "+"],
    ["Ventas en efectivo", d.ventasEfectivo, "+"],
    ["Reintegros", d.reintegros, "−"],
    ["Gastos operativos", d.gastos, "−"],
    ["Pagos a proveedores", d.pagosProveedor, "−"],
    ["Retiros del dueño", d.retirosDueno, "−"],
    ...(d.compensaciones ? [["Compensaciones de egresos", d.compensaciones, "+"] as [string, number, "+"]] : []),
    ...(d.recuperosEgresos ? [["Recuperos de egresos (no es venta)", d.recuperosEgresos, "+"] as [string, number, "+"]] : []),
    ...(d.otrosIngresos ? [["Otros ingresos", d.otrosIngresos, "+"] as [string, number, "+"]] : []),
    ...(d.otrasSalidas ? [["Otras salidas", d.otrasSalidas, "−"] as [string, number, "−"]] : []),
  ]
  return (
    <div className="rounded-lg border p-2.5" data-testid="desglose-efectivo-turno">
      <p className="text-sm font-semibold">Efectivo del turno por tipo</p>
      <dl className="mt-1 space-y-0.5 text-sm">
        {filas.map(([k, v, s]) => <div key={k} className="flex justify-between gap-2"><dt className="text-muted-foreground">{s} {k}</dt><dd className="tabular-nums">{formatoArs(v)}</dd></div>)}
        <div className="flex justify-between gap-2 border-t pt-1 font-semibold"><dt>= Efectivo esperado</dt><dd className="tabular-nums">{formatoArs(d.esperadoCalculado)}</dd></div>
      </dl>
      {d.cuadra === false
        ? <p role="alert" className="mt-1 text-xs font-semibold text-destructive">El desglose no coincide con el efectivo esperado registrado. Revisá el turno.</p>
        : d.cuadra === true && <p className="mt-1 text-xs text-muted-foreground">Coincide con el libro financiero{d.pagosProveedor ? ". Los pagos a proveedores no se cuentan como gasto de rentabilidad" : ""}.</p>}
    </div>
  )
}
