"use client"

import { useState } from "react"
import { Loader2, Receipt, Printer, Lock, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn, formatPrice } from "@/lib/utils"
import { fetchMesaOccupancyStatus } from "@/lib/mesa-occupancy-client"
import type { CuentaMesaResult } from "@/lib/mesa-cuenta"

// ============================================
// DeliGO — Cuenta de mesa y ticket imprimible (P2)
// ============================================
// Componente compartido, autocontenido (mismo patrón que
// MesaOccupancyControl, P0-D.3B): consulta la ocupación activa de la mesa,
// pide la cuenta server-side (GET /api/operaciones/ocupaciones/[id]/cuenta),
// muestra vista previa + ticket, y cierra la cuenta (POST a la misma ruta)
// con confirmación explícita. Nunca calcula el total en el cliente — el
// total mostrado es siempre el que devuelve el servidor. Impresión vía
// `window.print()` del navegador (ver @media print en globals.css); nunca
// WebUSB/Web Serial/ESC-POS (eso queda para P3).

type CuentaResponse = CuentaMesaResult & {
  ok: true
  closed: boolean
  ocupacion: { id: string; estado: string; iniciadaEn: string; cerradaEn: string | null }
  mesa: { numero: number }
  negocio: { nombre: string }
}

type Status = "idle" | "loading" | "ready" | "empty" | "unauthorized" | "forbidden" | "error"

interface MesaCuentaDialogProps {
  mesaId: string
  mesaNumero: number
  className?: string
}

function formatFechaHora(iso: string): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })
}

async function parseErrorCode(res: Response): Promise<{ code?: string; error?: string; pedidosPendientes?: number }> {
  const data = await res.json().catch(() => null)
  if (!data || typeof data !== "object") return {}
  const record = data as Record<string, unknown>
  return {
    code: typeof record.code === "string" ? record.code : undefined,
    error: typeof record.error === "string" ? record.error : undefined,
    pedidosPendientes: typeof record.pedidosPendientes === "number" ? record.pedidosPendientes : undefined,
  }
}

export function MesaCuentaDialog({ mesaId, mesaNumero, className }: MesaCuentaDialogProps) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<Status>("idle")
  const [cuenta, setCuenta] = useState<CuentaResponse | null>(null)
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  // P2 corrección (Bloqueo 4): id de la última ocupación CERRADA de esta
  // mesa (si existe), informado por el mismo endpoint técnico de estado
  // (P0-D.3A, extendido). Permite ofrecer "Ver último ticket cerrado" de
  // forma real — nunca se afirma esta capacidad sin que exista.
  const [lastClosedOcupacionId, setLastClosedOcupacionId] = useState<string | null>(null)

  async function fetchCuentaByOcupacionId(ocupacionId: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/operaciones/ocupaciones/${ocupacionId}/cuenta`, {
        cache: "no-store",
      })
      if (res.status === 401) {
        setStatus("unauthorized")
        return false
      }
      if (res.status === 403) {
        setStatus("forbidden")
        return false
      }
      if (!res.ok) {
        setStatus("error")
        return false
      }

      const data = (await res.json().catch(() => null)) as CuentaResponse | null
      if (!data || data.ok !== true) {
        setStatus("error")
        return false
      }
      setCuenta(data)
      setStatus("ready")
      return true
    } catch {
      setStatus("error")
      return false
    }
  }

  async function loadCuenta() {
    setStatus("loading")
    setCuenta(null)
    setLastClosedOcupacionId(null)

    const occupancyStatus = await fetchMesaOccupancyStatus(mesaId).catch(() => ({ kind: "error" as const }))
    if (occupancyStatus.kind === "unauthorized") return setStatus("unauthorized")
    if (occupancyStatus.kind === "forbidden") return setStatus("forbidden")
    if (occupancyStatus.kind === "error") return setStatus("error")
    if (occupancyStatus.kind === "none") {
      setLastClosedOcupacionId(occupancyStatus.lastClosedOcupacionId)
      return setStatus("empty")
    }

    await fetchCuentaByOcupacionId(occupancyStatus.occupancy.id)
  }

  async function handleViewLastClosed() {
    if (!lastClosedOcupacionId) return
    setStatus("loading")
    await fetchCuentaByOcupacionId(lastClosedOcupacionId)
  }

  function handleOpen() {
    setOpen(true)
    void loadCuenta()
  }

  async function handleConfirmClose() {
    if (!cuenta || closing) return
    setClosing(true)
    try {
      const res = await fetch(`/api/operaciones/ocupaciones/${cuenta.ocupacion.id}/cuenta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })

      if (res.status === 401) {
        toast.error("Tu sesión expiró. Iniciá sesión nuevamente.")
        setStatus("unauthorized")
        setConfirmCloseOpen(false)
        return
      }
      if (res.status === 403) {
        toast.error("No tenés permiso para cerrar esta cuenta")
        setStatus("forbidden")
        setConfirmCloseOpen(false)
        return
      }
      if (res.status === 409) {
        const { code, pedidosPendientes } = await parseErrorCode(res)
        if (code === "MESA_CUENTA_PEDIDOS_PENDIENTES") {
          toast.error(
            pedidosPendientes
              ? `Todavía hay ${pedidosPendientes} pedido(s) sin entregar ni cancelar.`
              : "Todavía hay pedidos sin entregar ni cancelar."
          )
        } else {
          toast.warning("La ocupación de esta mesa cambió. Volvemos a cargar la cuenta.")
          setConfirmCloseOpen(false)
          void loadCuenta()
          return
        }
        setConfirmCloseOpen(false)
        return
      }
      if (!res.ok) {
        toast.error("No se pudo cerrar la cuenta. Intentá de nuevo.")
        setConfirmCloseOpen(false)
        return
      }

      const data = (await res.json().catch(() => null)) as CuentaResponse | null
      if (!data || data.ok !== true) {
        toast.error("No se pudo cerrar la cuenta. Intentá de nuevo.")
        setConfirmCloseOpen(false)
        return
      }

      setCuenta(data)
      setConfirmCloseOpen(false)
      toast.success("Cuenta cerrada. La mesa quedó libre.")
    } catch {
      toast.error("No se pudo cerrar la cuenta. Intentá de nuevo.")
      setConfirmCloseOpen(false)
    } finally {
      setClosing(false)
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className={cn("rounded-xl gap-1.5 h-8 text-xs", className)}
        onClick={handleOpen}
      >
        <Receipt className="h-3.5 w-3.5" />
        Ver cuenta
      </Button>

      <Dialog open={open} onOpenChange={(next) => !closing && setOpen(next)}>
        <DialogContent className="max-w-lg print:max-w-full print:border-0 print:shadow-none">
          <DialogHeader className="print:hidden">
            <DialogTitle>Cuenta — Mesa {mesaNumero}</DialogTitle>
            <DialogDescription>
              {cuenta?.closed
                ? "Cuenta cerrada. La mesa ya está libre."
                : "Vista previa de la cuenta de esta ocupación."}
            </DialogDescription>
          </DialogHeader>

          {status === "loading" && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground print:hidden">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando cuenta…
            </div>
          )}

          {status === "empty" && (
            <div className="py-8 flex flex-col items-center gap-3 text-center print:hidden">
              <p className="text-sm text-muted-foreground">Esta mesa no tiene una ocupación activa.</p>
              {lastClosedOcupacionId && (
                <Button size="sm" variant="outline" className="rounded-xl gap-1.5" onClick={() => void handleViewLastClosed()}>
                  <Receipt className="h-3.5 w-3.5" />
                  Ver último ticket cerrado
                </Button>
              )}
            </div>
          )}

          {(status === "unauthorized" || status === "error") && (
            <p className="py-8 text-center text-sm text-muted-foreground print:hidden">
              No se pudo cargar la cuenta de esta mesa.
            </p>
          )}

          {status === "forbidden" && (
            <p className="py-8 text-center text-sm text-muted-foreground print:hidden">
              No tenés permiso para ver la cuenta de esta mesa.
            </p>
          )}

          {status === "ready" && cuenta && (
            <div id="ticket-print-root" className="space-y-4">
              <div className="space-y-0.5 text-center">
                <p className="font-semibold">{cuenta.negocio.nombre}</p>
                <p className="text-sm text-muted-foreground">Mesa {cuenta.mesa.numero}</p>
                <p className="text-xs text-muted-foreground">
                  Apertura: {formatFechaHora(cuenta.ocupacion.iniciadaEn)}
                </p>
                {cuenta.closed && cuenta.ocupacion.cerradaEn && (
                  <p className="text-xs text-muted-foreground">
                    Cierre: {formatFechaHora(cuenta.ocupacion.cerradaEn)}
                  </p>
                )}
              </div>

              {!cuenta.puedeCerrar && !cuenta.closed && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-800 print:hidden">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>
                    Hay {cuenta.pedidosPendientesCount} pedido(s) todavía no entregados ni cancelados. No se puede
                    cerrar la cuenta hasta resolverlos.
                  </span>
                </div>
              )}

              {cuenta.pedidos.length === 0 && (
                <p className="text-center text-sm text-muted-foreground">Esta ocupación no tiene pedidos.</p>
              )}

              <div className="space-y-3">
                {cuenta.pedidos.map((pedido, index) => (
                  <div key={pedido.id} className="space-y-1 border-b pb-2 last:border-b-0">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Pedido {index + 1} · {formatFechaHora(pedido.fecha)}</span>
                      {pedido.excluido && <Badge variant="outline">Cancelado</Badge>}
                      {pedido.pendiente && <Badge variant="outline">Pendiente</Badge>}
                    </div>
                    {pedido.items.map((item) => (
                      <div key={item.id} className="text-sm">
                        <div className="flex items-baseline justify-between gap-2">
                          <span>
                            {item.cantidad}x {item.nombre}
                          </span>
                          <span className="shrink-0">{formatPrice(item.subtotalLineaAprox)}</span>
                        </div>
                        {item.agregados.length > 0 && (
                          <p className="pl-3 text-xs text-muted-foreground">
                            + {item.agregados.map((agregado) => agregado.nombre).join(", ")}
                          </p>
                        )}
                        {item.secciones.map((seccion) => (
                          <p key={seccion} className="pl-3 text-xs text-muted-foreground">
                            {seccion}
                          </p>
                        ))}
                        {item.ingredientesQuitados.length > 0 && (
                          <p className="pl-3 text-xs text-muted-foreground">
                            Sin: {item.ingredientesQuitados.join(", ")}
                          </p>
                        )}
                        {(item.talle || item.color) && (
                          <p className="pl-3 text-xs text-muted-foreground">
                            {[item.talle, item.color].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </div>
                    ))}
                    <div className="flex items-baseline justify-between text-xs font-medium">
                      <span>Subtotal pedido</span>
                      <span>{pedido.excluido ? formatPrice(0) : formatPrice(pedido.subtotalPedido)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-baseline justify-between border-t pt-2 text-base font-semibold">
                <span>Total</span>
                <span>{formatPrice(cuenta.totalGeneral)}</span>
              </div>

              <p className="text-center text-xs text-muted-foreground">
                {cuenta.closed ? "Cuenta cerrada" : "Vista previa — todavía no se cerró la cuenta"}
              </p>
            </div>
          )}

          <DialogFooter className="print:hidden">
            {status === "ready" && cuenta && (
              <>
                <Button
                  variant="outline"
                  className="rounded-xl gap-1.5"
                  onClick={() => window.print()}
                >
                  <Printer className="h-4 w-4" />
                  Imprimir
                </Button>
                {!cuenta.closed && (
                  <Button
                    className="rounded-xl gap-1.5"
                    disabled={!cuenta.puedeCerrar}
                    onClick={() => setConfirmCloseOpen(true)}
                  >
                    <Lock className="h-4 w-4" />
                    Cerrar cuenta
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmCloseOpen} onOpenChange={(next) => !closing && setConfirmCloseOpen(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cerrar cuenta — Mesa {mesaNumero}</AlertDialogTitle>
            <AlertDialogDescription>
              {cuenta && (
                <>
                  Total: {formatPrice(cuenta.totalGeneral)} · {cuenta.pedidosIncluidosCount} pedido(s) incluido(s).{" "}
                </>
              )}
              La ocupación de esta mesa se cerrará, no se aceptarán más pedidos con esa credencial y la mesa quedará
              libre. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={closing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              disabled={closing}
              onClick={(event) => {
                event.preventDefault()
                void handleConfirmClose()
              }}
            >
              {closing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Cerrando…
                </>
              ) : (
                "Cerrar cuenta"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
