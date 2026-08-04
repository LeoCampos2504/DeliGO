"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, Lock, LockOpen } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { buttonVariants } from "@/components/ui/button"
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
import { cn } from "@/lib/utils"
import {
  closeMesaOccupancyWithRevalidation,
  fetchMesaOccupancyStatus,
  type MesaOccupancyInfo,
} from "@/lib/mesa-occupancy-client"

// ============================================
// DeliGO — Control compartido de ocupación de mesa (P0-D.3B)
// ============================================
// Único control reutilizable para Negocio, Salón y Mozo: consulta el estado
// técnico de ocupación de una mesa y permite cerrarla con confirmación. Es
// autocontenido (maneja su propio estado/fetch) para poder integrarse en
// hosts con arquitecturas de estado distintas (react-query, fetch manual +
// generación, etc.) sin acoplarse a ninguna. Nunca abre ocupaciones, nunca
// toca pedidos/pagos/tickets/QR/asignación de mozo. La autorización real es
// exclusiva del servidor (P0-D.3A); este control solo refleja sus resultados.

type Status = "loading" | "active" | "none" | "unauthorized" | "forbidden" | "error"

interface MesaOccupancyControlProps {
  mesaId: string
  mesaNumero: number
  onClosed?: () => void
  // Neutral: se dispara ante un 403 (GET o POST) para que el host refresque su
  // propia vista y deje de mostrar un control con estado desactualizado. Nunca
  // recibe ni transporta datos de autorización (actor/negocio/empleado).
  onAccessDenied?: () => void
  className?: string
}

function formatHora(iso: string): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
}

export function MesaOccupancyControl({ mesaId, mesaNumero, onClosed, onAccessDenied, className }: MesaOccupancyControlProps) {
  const [status, setStatus] = useState<Status>("loading")
  const [occupancy, setOccupancy] = useState<MesaOccupancyInfo | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const mountedRef = useRef(true)
  // Evita notificar "acceso denegado" más de una vez por mesa: sin esto, un
  // host que refresca su panel al recibir el aviso podría volver a montar el
  // mismo control con el mismo resultado 403 y generar un ciclo. Se rearma
  // solo cuando `mesaId` cambia (nueva mesa = contexto legítimamente distinto).
  const accessDeniedNotifiedRef = useRef(false)

  function notifyAccessDenied() {
    if (accessDeniedNotifiedRef.current) return
    accessDeniedNotifiedRef.current = true
    onAccessDenied?.()
  }

  useEffect(() => {
    mountedRef.current = true
    accessDeniedNotifiedRef.current = false
    const controller = new AbortController()

    fetchMesaOccupancyStatus(mesaId, controller.signal)
      .then((result) => {
        if (!mountedRef.current) return
        if (result.kind === "active") {
          setStatus("active")
          setOccupancy(result.occupancy)
        } else {
          setStatus(result.kind)
          setOccupancy(null)
          if (result.kind === "forbidden") notifyAccessDenied()
        }
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return
        if (!mountedRef.current) return
        setStatus("error")
      })

    return () => {
      mountedRef.current = false
      controller.abort()
    }
  }, [mesaId])

  async function handleConfirmClose() {
    if (closing) return
    setClosing(true)
    try {
      const result = await closeMesaOccupancyWithRevalidation(mesaId)
      if (!mountedRef.current) return

      switch (result.kind) {
        case "closed":
          toast.success("Ocupación cerrada correctamente")
          setStatus("none")
          setOccupancy(null)
          setConfirmOpen(false)
          onClosed?.()
          break
        case "no_active":
          toast.info("Esta mesa ya no tenía una ocupación activa")
          setStatus("none")
          setOccupancy(null)
          setConfirmOpen(false)
          onClosed?.()
          break
        case "changed":
          toast.warning("La ocupación cambió. Actualizamos el estado de la mesa.")
          setConfirmOpen(false)
          setStatus("loading")
          try {
            const fresh = await fetchMesaOccupancyStatus(mesaId)
            if (!mountedRef.current) return
            if (fresh.kind === "active") {
              setStatus("active")
              setOccupancy(fresh.occupancy)
            } else {
              setStatus(fresh.kind)
              setOccupancy(null)
            }
          } catch {
            if (mountedRef.current) setStatus("error")
          }
          break
        case "unauthorized":
          toast.error("Tu sesión expiró. Iniciá sesión nuevamente.")
          setConfirmOpen(false)
          setStatus("unauthorized")
          break
        case "forbidden":
          toast.error("No tenés permiso para administrar esta mesa")
          setConfirmOpen(false)
          setStatus("forbidden")
          notifyAccessDenied()
          break
        case "bad_request":
        case "error":
          toast.error("No se pudo cerrar la ocupación. Intentá de nuevo.")
          setConfirmOpen(false)
          break
      }
    } finally {
      if (mountedRef.current) setClosing(false)
    }
  }

  if (status === "loading") {
    return (
      <div className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
        <Loader2 className="h-3 w-3 animate-spin" />
        Consultando ocupación…
      </div>
    )
  }

  if (status === "unauthorized" || status === "error") {
    return (
      <div className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
        No se pudo consultar la ocupación de la mesa.
      </div>
    )
  }

  if (status === "forbidden") {
    return (
      <div className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
        No tenés permiso para administrar la ocupación de esta mesa.
      </div>
    )
  }

  if (status === "none") {
    return (
      <div className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
        <LockOpen className="h-3 w-3" />
        Sin ocupación activa
      </div>
    )
  }

  const inicio = occupancy ? formatHora(occupancy.startedAt) : null
  const actividad = occupancy ? formatHora(occupancy.lastActivityAt) : null

  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Lock className="h-3 w-3" />
        <span>
          Ocupación activa
          {inicio ? ` · desde ${inicio}` : ""}
          {actividad ? ` · última actividad ${actividad}` : ""}
        </span>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="rounded-xl gap-1.5 h-8 text-xs"
        onClick={() => setConfirmOpen(true)}
      >
        <LockOpen className="h-3.5 w-3.5" />
        Cerrar ocupación
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={(open) => !closing && setConfirmOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cerrar ocupación de la mesa {mesaNumero}</AlertDialogTitle>
            <AlertDialogDescription>
              Se revocará el acceso de los dispositivos vinculados a esta ocupación. Los pedidos históricos no se eliminarán.
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
                "Cerrar ocupación"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
