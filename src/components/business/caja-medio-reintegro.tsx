"use client"

// ============================================
// Refund method: always an EXPLICIT choice of the merchant
// ============================================
// Manual test (2026-11-11): a $100 refund meant to be paid in cash was recorded
// as a TRANSFER because the form preselected the method the sale was charged
// with. The server recorded exactly what it received; the risk was the default.
// Rule, for every place where money is handed back (immediate return, exchange
// difference paid now, later payment of a pending refund):
// - nothing is preselected; the sale's own method is shown only as a reference;
// - nothing can be confirmed until Efectivo / Transferencia / Otro is chosen;
// - the choice is never changed automatically afterwards;
// - each method says what it does to the register (cash leaves it; a transfer
//   or another method is only recorded, DeliGO never moves that money).
// No amounts of the register are shown here (blind close: the cashier never
// sees expected cash).

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export type MedioReintegro = "EFECTIVO" | "TRANSFERENCIA" | "OTRO"

export const MEDIOS_REINTEGRO: ReadonlyArray<readonly [MedioReintegro, string]> = [
  ["EFECTIVO", "Efectivo"],
  ["TRANSFERENCIA", "Transferencia"],
  ["OTRO", "Otro medio"],
]

/** How the sale was charged, as a reference only (never used as the refund method). */
export function etiquetaCobroVenta(metodo: string | null | undefined): string | null {
  if (!metodo) return null
  if (metodo === "EFECTIVO") return "efectivo"
  if (metodo === "TRANSFERENCIA") return "transferencia"
  if (metodo === "OTRO") return "otro medio"
  if (metodo === "CAMBIO") return "un cambio (sin cobro propio)"
  return metodo.toLowerCase()
}

export function MedioReintegroSelector({ value, onChange, disabled, label = "Medio de devolución", metodoVenta, destinoEfectivo }: {
  value: MedioReintegro | null
  onChange: (medio: MedioReintegro) => void
  disabled: boolean
  label?: string
  /** The method the sale was charged with: shown as secondary information only. */
  metodoVenta?: string | null
  /** Where the cash leaves from (register / shift), shown only when EFECTIVO is chosen. */
  destinoEfectivo?: ReactNode
}) {
  const cobro = etiquetaCobroVenta(metodoVenta)
  return (
    <div className="min-w-0 space-y-1.5" data-testid="medio-reintegro">
      <p className="text-sm font-medium">¿Cómo devolvés el dinero?</p>
      {cobro && <p className="break-words text-[11px] text-muted-foreground" data-testid="cobro-original">La venta se cobró con {cobro}. Es solo una referencia: elegí cómo devolvés el dinero.</p>}
      <div role="group" aria-label={label} className="grid grid-cols-3 gap-2">
        {MEDIOS_REINTEGRO.map(([medio, texto]) => (
          <button
            key={medio}
            type="button"
            aria-pressed={value === medio}
            disabled={disabled}
            onClick={() => onChange(medio)}
            className={cn("min-h-10 min-w-0 whitespace-normal rounded-xl border px-2 py-1.5 text-xs font-semibold", value === medio ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground")}
          >
            {texto}
          </button>
        ))}
      </div>
      <div className="min-w-0 space-y-1 text-xs" data-testid="consecuencia-reintegro">
        {value === null && <p className="break-words font-medium text-amber-700 dark:text-amber-300">Elegí un medio para continuar.</p>}
        {value === "EFECTIVO" && <>
          <p className="break-words font-medium">Sale efectivo de Caja: se registra la salida de dinero. Los cierres anteriores no cambian.</p>
          {destinoEfectivo}
        </>}
        {value === "TRANSFERENCIA" && <p className="break-words text-muted-foreground">No se descuenta efectivo de Caja. DeliGO registra la transferencia, pero no la realiza: hacela vos desde tu banco o billetera.</p>}
        {value === "OTRO" && <p className="break-words text-muted-foreground">No se descuenta efectivo de Caja. DeliGO sólo registra que devolviste el dinero por ese medio.</p>}
      </div>
    </div>
  )
}

/**
 * Where the cash leaves from. Owner: the open registers (one → named; several →
 * the caller renders the choice; none → no register assigned). Cashier: always
 * their own open shift (the server enforces OBLIGATORIO / OPCIONAL).
 */
export function DestinoEfectivo({ owner, registros }: { owner: boolean; registros?: ReadonlyArray<{ nombre: string; responsable: string }> }) {
  const texto = !owner
    ? "Sale de la caja de tu turno abierto. Sin turno abierto: si el negocio exige turnos no se puede registrar; si no, queda sin caja asignada."
    : registros === undefined
      ? "Buscando las cajas abiertas…"
      : registros.length === 1
        ? `Sale de ${registros[0].nombre} (turno de ${registros[0].responsable || "su responsable"}).`
        : registros.length === 0
          ? "No hay turnos abiertos: la salida se registra en el efectivo sin caja asignada."
          : "Hay varias cajas abiertas: elegí de cuál sale el efectivo."
  return <p className="break-words text-muted-foreground" data-testid="destino-efectivo">{texto}</p>
}
