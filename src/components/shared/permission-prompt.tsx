"use client"

import { useState, useEffect, useCallback } from "react"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Bell, X, Shield, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/store/auth-store"
import { safeErrorForLog } from "@/lib/log-safe-error"

const STORAGE_KEY = "deligo-permissions-prompted"

type PromptState = "idle" | "showing" | "requesting" | "done"

function isMozoRoute(pathname: string) {
  return pathname === "/mozo" || pathname.startsWith("/mozo/")
}

async function savePushSubscription(subscription: PushSubscription): Promise<void> {
  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subscription: JSON.stringify(subscription),
    }),
  })
}

// P2-T05 Stage3R1 (F-P2-T05-12): read-only — NUNCA muta el binding
// server-side. Antes del físico-detach de SERVER_DETACH_ONLY (F-P2-T05-02)
// una PushSubscription física sólo existía si el actor seguía suscripto, así
// que re-enviarla en cada mount era inofensivo. Ahora una subscription
// física puede sobrevivir a un detach manual explícito — volver a postearla
// automáticamente revertiría ese disable sin ninguna acción del usuario. Por
// eso este chequeo es puramente informativo: rebind de un actor detached
// exige siempre USER_EXPLICIT_ENABLE (el toggle de perfil/config).
async function checkExistingPushSubscriptionStatus(subscription: PushSubscription): Promise<boolean> {
  try {
    const res = await fetch("/api/push/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscription: JSON.stringify(subscription),
      }),
    })
    if (!res.ok) return false
    const data = await res.json()
    return data.subscribed === true
  } catch {
    return false
  }
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

  const isAuth = useAuthStore((s) => s.user !== null)
  const uType = useAuthStore((s) => s.user?.type ?? null)

  // Check current notification permission
  const checkPermission = useCallback(() => {
    const perm =
      typeof window !== "undefined" && "Notification" in window
        ? Notification.permission
        : "default"
    setNotifPerm(perm)
    return perm
  }, [])

  const syncExistingPushSubscription = useCallback(async () => {
    if (isMozo) return

    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window) ||
      Notification.permission !== "granted"
    ) {
      return
    }

    const registration = await navigator.serviceWorker.getRegistration("/")
    const subscription = await registration?.pushManager.getSubscription()
    if (!subscription) return

    // Read-only status probe — never re-registers automatically (see
    // checkExistingPushSubscriptionStatus above, F-P2-T05-12).
    await checkExistingPushSubscriptionStatus(subscription)
  }, [isMozo])

  useEffect(() => {
    if (isMozo) {
      setState("idle")
      return
    }

    if (!isAuth || !uType) {
      setState("idle")
      return
    }

    const perm = checkPermission()
    if (perm === "granted") {
      void syncExistingPushSubscription()
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
  }, [isMozo, isAuth, uType, checkPermission, syncExistingPushSubscription])

  const handleAccept = async () => {
    if (isMozo) return

    setState("requesting")

    try {
      const result = await Notification.requestPermission()
      setNotifPerm(result)

      // If granted, also subscribe to push
      if (result === "granted") {
        try {
          const registration = await navigator.serviceWorker.ready
          const existingSubscription = await registration.pushManager.getSubscription()
          let subscription = existingSubscription

          if (!subscription) {
            const vapidRes = await fetch("/api/push/vapid-key")
            if (vapidRes.ok) {
              const { publicKey } = await vapidRes.json()
              if (publicKey) {
                subscription = await registration.pushManager.subscribe({
                  userVisibleOnly: true,
                  applicationServerKey: publicKey,
                })
              }
            }
          }

          if (subscription) {
            await savePushSubscription(subscription)
          }
        } catch (err) {
          console.error("Push subscription error:", safeErrorForLog(err))
        }
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
  )
}
