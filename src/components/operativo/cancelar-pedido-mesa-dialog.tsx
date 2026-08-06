"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, XCircle } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
  MOTIVO_CANCELACION_MAX_LEN,
  MOTIVO_CANCELACION_MIN_LEN,
  puedeConfirmarCancelacionPedidoMesa,
  puedeMostrarCancelacionPedidoMesa,
  validarMotivoCancelacionMesa,
} from "@/lib/mesa-pedido-cancelacion-contract"
import {
  cancelarPedidoMesaRequest,
  esErrorRecuperable,
  mensajeCancelarPedidoMesa,
  type CancelarPedidoMesaExito,
} from "@/lib/mesa-pedido-cancelacion-client"

// ============================================
// DeliGO Operaciones — Diálogo compartido de cancelación de pedidos de mesa (23-A2)
// ============================================
// Único componente reutilizado por las CUATRO superficies autorizadas por
// 23-A1 (Mozo, Salón personal, Salón terminal, Negocio/admin) — mismo
// espíritu "autocontenido" que MesaOccupancyControl/MesaCuentaDialog: cada
// host solo pasa pedidoId/estado/metodoEntrega + un callback `onCancelled`
// para refrescar SU propia arquitectura de datos (React Query, fetch+estado
// local, lo que sea) — este componente nunca decide cómo se refresca el
// host, ni asume negocioId/rol/mesaId/identidad. La UI nunca es la
// autoridad: la visibilidad acá es solo una mejora de experiencia — la
// autorización real vuelve a resolverse siempre en el servidor.
//
// Deny-by-default: si `puedeMostrarCancelacionPedidoMesa` da `false` (estado
// fuera de la allowlist, o metodoEntrega !== "mesa"), el componente no
// renderiza nada — ni trigger propio ni trigger custom.

export interface CancelarPedidoMesaDialogProps {
  pedidoId: string
  estado: string
  metodoEntrega: string
  /** Referencia visual del pedido para el título/descripción (ej. "Mesa 5"). */
  referencia?: string
  onCancelled?: (pedido: CancelarPedidoMesaExito) => void
  /** Trigger opcional (ej. para insertarlo en un menú de acciones existente). Si no se pasa, se renderiza un botón propio. */
  trigger?: (props: { onClick: () => void; disabled: boolean }) => React.ReactNode
  className?: string
}

export function CancelarPedidoMesaDialog({
  pedidoId,
  estado,
  metodoEntrega,
  referencia,
  onCancelled,
  trigger,
  className,
}: CancelarPedidoMesaDialogProps) {
  const [open, setOpen] = useState(false)
  const [motivo, setMotivo] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Defensa adicional: si el host reutiliza esta misma posición del árbol
  // para OTRO pedido mientras el diálogo estaba abierto, nunca debe quedar
  // un motivo/estado de un pedido distinto flotando.
  useEffect(() => {
    setOpen(false)
    setMotivo("")
    setSubmitting(false)
  }, [pedidoId])

  const elegible = puedeMostrarCancelacionPedidoMesa({ estado, metodoEntrega })
  const validacion = validarMotivoCancelacionMesa(motivo)
  const puedeConfirmar = puedeConfirmarCancelacionPedidoMesa({
    pedidoId,
    motivo,
    submitting,
    elegible,
  })

  if (!elegible) return null

  function closeAndReset() {
    setOpen(false)
    setMotivo("")
  }

  function handleOpenChange(next: boolean) {
    if (submitting) return // nunca cerrar accidentalmente durante la petición
    if (next) {
      setOpen(true)
      return
    }
    closeAndReset()
  }

  async function handleConfirm() {
    if (submitting) return // ignora un segundo clic mientras hay una solicitud en curso
    if (!validacion.ok) return
    setSubmitting(true)
    try {
      const outcome = await cancelarPedidoMesaRequest(pedidoId, validacion.motivo)
      if (!mountedRef.current) return

      if (outcome.kind === "ok") {
        toast.success("Pedido cancelado correctamente.")
        closeAndReset()
        onCancelled?.(outcome.pedido)
        return
      }

      toast.error(mensajeCancelarPedidoMesa(outcome))
      if (esErrorRecuperable(outcome)) {
        // Diálogo permanece abierto, motivo conservado para corregir o
        // reintentar manualmente — nunca reintento automático.
        return
      }
      // 401/403/404: no hay nada que reintentar en este diálogo.
      closeAndReset()
    } finally {
      if (mountedRef.current) setSubmitting(false)
    }
  }

  const contadorId = `cancelar-pedido-contador-${pedidoId}`
  const motivoId = `cancelar-pedido-motivo-${pedidoId}`
  const mostrarErrorMotivo = !validacion.ok && motivo.trim().length > 0

  return (
    <>
      {trigger ? (
        trigger({ onClick: () => handleOpenChange(true), disabled: submitting })
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "rounded-xl gap-1.5 h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive",
            className
          )}
          onClick={() => handleOpenChange(true)}
          disabled={submitting}
        >
          <XCircle className="h-3.5 w-3.5" />
          Cancelar pedido
        </Button>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="max-h-[85vh] overflow-y-auto"
          onEscapeKeyDown={(event) => {
            if (submitting) event.preventDefault()
          }}
          onPointerDownOutside={(event) => {
            if (submitting) event.preventDefault()
          }}
        >
          <DialogHeader>
            <DialogTitle>Cancelar pedido</DialogTitle>
            <DialogDescription>
              {referencia ? `${referencia}. ` : ""}
              Esta acción no puede deshacerse desde esta pantalla. Contanos el motivo para dejarlo registrado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <label htmlFor={motivoId} className="text-sm font-medium">
              Motivo de la cancelación
            </label>
            <Textarea
              id={motivoId}
              value={motivo}
              onChange={(event) => setMotivo(event.target.value)}
              placeholder="Ej: pedido cargado a la mesa equivocada"
              maxLength={MOTIVO_CANCELACION_MAX_LEN}
              disabled={submitting}
              autoFocus
              aria-invalid={mostrarErrorMotivo}
              aria-describedby={contadorId}
              className="min-h-24 resize-none"
            />
            <div id={contadorId} className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className={cn(mostrarErrorMotivo && "text-destructive")} role={mostrarErrorMotivo ? "alert" : undefined}>
                {mostrarErrorMotivo && !validacion.ok
                  ? validacion.error
                  : `Mínimo ${MOTIVO_CANCELACION_MIN_LEN} caracteres.`}
              </span>
              <span aria-hidden="true" className="shrink-0 tabular-nums">
                {motivo.length}/{MOTIVO_CANCELACION_MAX_LEN}
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => handleOpenChange(false)}
              disabled={submitting}
            >
              No cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="rounded-xl gap-1.5"
              onClick={() => void handleConfirm()}
              disabled={!puedeConfirmar}
              aria-busy={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Cancelando…
                </>
              ) : (
                "Confirmar cancelación"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
