"use client"

// P2-T40-R1 — oferta de reactivación M2 ("¿Querés volver a activar las
// notificaciones?"), mostrada como máximo UNA VEZ por sesión recién
// autenticada cuando existe un opt-out manual local vigente para el owner
// (ver codex-reports/P2_T40_A1_STALE_OWNER_AND_MANUAL_OPTOUT_AUTHORITY.md
// §12-§14 y la política MANUAL_OFF_POLICY=
// M2_DEVICE_SCOPED_WITH_NEXT_LOGIN_REENABLE_OFFER autorizada en el prompt
// de R1 §1-§3). Nunca imita un permiso nativo del navegador — es un aviso
// propio de DeliGO, con su propio copy y sus propios botones.
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Bell, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { clearPushManualOptOut } from "@/lib/push-manual-optout"
import { activatePushAfterGesture, type PushReconciliationFamily } from "@/lib/push-session-reconciliation"

interface PushReenableOfferProps {
  ownerType: PushReconciliationFamily
  ownerId: string
  onDismissed: () => void
}

type OfferState = "idle" | "activating" | "denied-guidance" | "error"

export function PushReenableOffer({ ownerType, ownerId, onDismissed }: PushReenableOfferProps) {
  const [state, setState] = useState<OfferState>("idle")

  const handleDismiss = () => {
    // REENABLE_OFFER_DISMISS_BEHAVIOR=KEEP_OFF_UNTIL_FUTURE_LOGIN_OR_PROFILE_ACTION
    // — nunca toca el opt-out local ni hace ningún rebind. Sólo oculta el
    // aviso; DO_NOT_NAG: no vuelve a aparecer esta misma sesión (el padre
    // desmonta este componente vía onDismissed y el handoff de un solo uso
    // ya fue consumido, así que no hay forma de que reaparezca hasta un
    // login futuro).
    onDismissed()
  }

  const handleActivate = async () => {
    const currentPermission =
      typeof window !== "undefined" && "Notification" in window ? Notification.permission : "default"

    // CASE D — denied: nunca requestPermission de nuevo, sólo instrucciones.
    if (currentPermission === "denied") {
      setState("denied-guidance")
      return
    }

    setState("activating")

    // CASE C — default: pedir permiso ahora, con el gesto explícito de este
    // click. CASE A/B (ya granted, con o sin física) no necesitan este paso.
    let permission: NotificationPermission = currentPermission
    if (permission === "default") {
      try {
        permission = await Notification.requestPermission()
      } catch {
        permission = "default"
      }
    }

    if (permission !== "granted") {
      setState("denied-guidance")
      return
    }

    const success = await activatePushAfterGesture(ownerType)
    if (success) {
      // Sólo se borra el opt-out cuando la activación terminó con éxito
      // real — nunca de forma optimista.
      clearPushManualOptOut(ownerType, ownerId)
      onDismissed()
      return
    }

    setState("error")
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-x-0 bottom-0 z-[85] flex justify-center px-4 pb-4 sm:pb-6"
      >
        <div className="w-full sm:max-w-sm bg-background rounded-2xl shadow-2xl border border-border/40 overflow-hidden">
          <div className="flex items-start gap-3 p-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              {state === "denied-guidance" ? (
                <>
                  <p className="text-sm font-semibold">Notificaciones bloqueadas</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    Tu navegador tiene las notificaciones bloqueadas para DeliGO. Activalas desde los ajustes del
                    navegador o del sistema para poder recibirlas.
                  </p>
                </>
              ) : state === "error" ? (
                <>
                  <p className="text-sm font-semibold">No se pudo activar</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    Hubo un problema al activar las notificaciones. Podés intentarlo de nuevo desde tu perfil cuando
                    quieras.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold">Las notificaciones están desactivadas en este dispositivo</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    ¿Querés volver a activarlas?
                  </p>
                </>
              )}
            </div>
            <button
              onClick={handleDismiss}
              className="p-1 rounded-full hover:bg-muted/50 transition-colors shrink-0"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          <div className="px-4 pb-4 flex gap-2">
            <Button
              variant="ghost"
              onClick={handleDismiss}
              className="flex-1 h-9 rounded-xl text-xs text-muted-foreground hover:text-foreground"
            >
              Ahora no
            </Button>
            {state !== "denied-guidance" && (
              <Button
                onClick={handleActivate}
                disabled={state === "activating"}
                className="flex-1 h-9 rounded-xl text-xs font-bold"
              >
                {state === "activating" ? "Activando..." : "Activar notificaciones"}
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
