"use client"

import { useState, useEffect, useCallback } from "react"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Bell, X, Shield, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/store/auth-store"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { PushReenableOffer } from "@/components/shared/push-reenable-offer"
import { activatePushAfterGesture, runPushSessionReconciliation } from "@/lib/push-session-reconciliation"
import type { PushSubscriptionOwnerType } from "@/lib/push-subscription-repository"

// P2-T40-A1 §23/§29: esta key representa EXCLUSIVAMENTE "¿ya se
// mostró/decidió el prompt nativo del navegador en este dispositivo?" —
// nunca un proxy de si el backend está vinculado (eso lo responde la
// reconciliación real, server-side) ni de si el usuario lo apagó a
// propósito (eso lo responde el marcador local de src/lib/push-manual-optout.ts).
const STORAGE_KEY = "deligo-permissions-prompted"

type PromptState = "idle" | "showing" | "requesting" | "done"

function isMozoRoute(pathname: string) {
  return pathname === "/mozo" || pathname.startsWith("/mozo/")
}

/**
 * PermissionPrompt — Auto-requests notification permissions after login
 *
 * Shows a friendly dialog after login when the user hasn't granted
 * notification permission yet. Only prompts once per device (tracked via localStorage).
 *
 * Permission strategy:
 * - Notifications: requested here for ALL roles (cliente, negocio, repartidor)
 * - Location (cliente): requested contextually when adding a delivery address
 * - Location (negocio): requested contextually when adding business location
 * - Real-time GPS (repartidor): requested contextually when starting delivery tracking
 */
export function PermissionPrompt() {
  const pathname = usePathname()
  const isMozo = isMozoRoute(pathname)
  const [state, setState] = useState<PromptState>("idle")
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | "default">("default")
  const [showReenableOffer, setShowReenableOffer] = useState(false)

  const isAuth = useAuthStore((s) => s.user !== null)
  const uType = useAuthStore((s) => s.user?.type ?? null)
  const ownerId = useAuthStore((s) => s.user?.id ?? null)

  // Check current notification permission
  const checkPermission = useCallback(() => {
    const perm =
      typeof window !== "undefined" && "Notification" in window
        ? Notification.permission
        : "default"
    setNotifPerm(perm)
    return perm
  }, [])

  // P2-T40-R1: reemplaza el antiguo `syncExistingPushSubscription` (telemetría
  // pura, nunca reparaba nada — BUG-2 de P2_T40_A0). Corre SIEMPRE que hay un
  // actor autenticado conocido (independiente de si el permiso ya es
  // "granted"), porque la limpieza de stale-owner (STALE_PREVIOUS_OWNER_RULE,
  // ver P2_T40_A1 §5/§20) es una corrección de seguridad, no una preferencia
  // — nunca debe depender de si ESTE actor específico quiere Push. Nunca
  // llama a Notification.requestPermission() acá (sólo el flujo explícito de
  // handleAccept/PushReenableOffer, con gesto de usuario, puede hacerlo).
  const reconcile = useCallback(
    async (ownerType: PushSubscriptionOwnerType, id: string) => {
      const { shouldOfferReenable } = await runPushSessionReconciliation(ownerType, id)
      if (shouldOfferReenable) setShowReenableOffer(true)
    },
    []
  )

  useEffect(() => {
    if (isMozo) {
      setState("idle")
      return
    }

    // SUPERADMIN_PUSH_LIFECYCLE_APPLICABLE=NO (P2_T40_A0 §11) — rama legacy
    // inerte, sin tabla normalizada ni reconciliación: se excluye acá para
    // no generar una llamada de red que sólo puede resolver 401.
    const isReconcilableActor = uType === "cliente" || uType === "negocio" || uType === "repartidor"

    if (!isAuth || !isReconcilableActor || !ownerId) {
      setState("idle")
      return
    }

    const perm = checkPermission()
    void reconcile(uType as PushSubscriptionOwnerType, ownerId)

    if (perm === "granted") {
      localStorage.setItem(STORAGE_KEY, "true")
      return
    }

    // Only prompt once per device
    const alreadyPrompted = localStorage.getItem(STORAGE_KEY)
    if (alreadyPrompted) return

    // Delay showing the prompt so it doesn't clash with login animation
    const timer = setTimeout(() => {
      if (perm === "default") {
        setState("showing")
      } else {
        // Already granted or denied, mark as prompted
        localStorage.setItem(STORAGE_KEY, "true")
      }
    }, 2000)

    return () => clearTimeout(timer)
  }, [isMozo, isAuth, uType, ownerId, checkPermission, reconcile])

  const handleAccept = async () => {
    if (isMozo) return

    setState("requesting")

    try {
      const result = await Notification.requestPermission()
      setNotifPerm(result)

      // If granted, also subscribe to push — misma lógica compartida que
      // usa PushReenableOffer (P2-T40-R1 §26: nunca dos implementaciones
      // divergentes de "activar Push tras un gesto explícito").
      if (result === "granted" && uType) {
        await activatePushAfterGesture(uType as PushSubscriptionOwnerType)
      }
    } catch (err) {
      console.error("Permission request error:", safeErrorForLog(err))
    } finally {
      localStorage.setItem(STORAGE_KEY, "true")
      setState("done")
    }
  }

  const handleDismiss = () => {
    if (isMozo) return

    localStorage.setItem(STORAGE_KEY, "true")
    setState("done")
  }

  // Role-specific descriptions
  const getDescription = () => {
    switch (uType) {
      case "repartidor":
        return "Para recibir pedidos nuevos necesitás tener las notificaciones activadas."
      case "negocio":
        return "Recibí alertas de nuevos pedidos y mensajes de tus clientes."
      default:
        return "Recibí alertas de tus pedidos y promociones exclusivas."
    }
  }

  if (isMozo) return null

  return (
    <>
      {showReenableOffer && uType && ownerId && (
        <PushReenableOffer
          ownerType={uType as PushSubscriptionOwnerType}
          ownerId={ownerId}
          onDismissed={() => setShowReenableOffer(false)}
        />
      )}
      <AnimatePresence>
      {state === "showing" && notifPerm === "default" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={handleDismiss}
          />

          {/* Dialog */}
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="relative w-full sm:max-w-sm bg-background rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header decoration */}
            <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-5 pt-6 pb-4">
              {/* Close button */}
              <button
                onClick={handleDismiss}
                className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-muted/50 transition-colors"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>

              {/* Icon */}
              <motion.div
                initial={{ scale: 0, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", damping: 15, stiffness: 200, delay: 0.1 }}
                className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3"
              >
                <span className="text-2xl">🔔</span>
              </motion.div>

              <h2 className="text-lg font-extrabold">Activá las notificaciones</h2>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                {getDescription()}
              </p>
            </div>

            {/* Permission items */}
            <div className="px-5 py-4 space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border/30">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Bell className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">Notificaciones push</p>
                  <p className="text-xs text-muted-foreground">
                    {uType === "repartidor"
                      ? "Alertas de pedidos nuevos y mensajes"
                      : uType === "negocio"
                      ? "Nuevos pedidos, mensajes y estado de entregas"
                      : "Estado de tus pedidos y promociones"}
                  </p>
                </div>
              </div>

              {/* Privacy note */}
              <div className="flex items-start gap-2 px-1 pt-1">
                <Shield className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Solo recibís notificaciones importantes. Podés desactivarlas en cualquier momento desde la configuración.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="px-5 pb-5 space-y-2">
              <Button
                onClick={handleAccept}
                className="w-full h-11 rounded-xl font-bold text-sm gap-2"
                disabled={state === "requesting"}
              >
                {state === "requesting" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Activando...
                  </>
                ) : (
                  "Activar notificaciones"
                )}
              </Button>
              <Button
                variant="ghost"
                onClick={handleDismiss}
                className="w-full h-9 rounded-xl text-xs text-muted-foreground hover:text-foreground"
              >
                Ahora no
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </>
  )
}
