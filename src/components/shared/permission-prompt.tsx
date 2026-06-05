"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Bell, MapPin, Check, X, Shield, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/store/auth-store"

const STORAGE_KEY = "deligo-permissions-prompted"

type PromptState = "idle" | "showing" | "requesting" | "done"

interface PermissionStatus {
  notifications: NotificationPermission | "default"
  location: PermissionState | "prompt"
}

/**
 * PermissionPrompt — Auto-requests notification & location permissions
 *
 * Shows a friendly dialog after login when the user hasn't granted
 * permissions yet. Only prompts once per device (tracked via localStorage).
 *
 * - Cliente: notifications only
 * - Repartidor: notifications + location
 * - Negocio: notifications only
 */
export function PermissionPrompt() {
  const [state, setState] = useState<PromptState>("idle")
  const [permissions, setPermissions] = useState<PermissionStatus>({
    notifications: "default",
    location: "prompt",
  })

  const isAuth = useAuthStore((s) => s.token !== null && s.user !== null)
  const uType = useAuthStore((s) => s.user?.type ?? null)

  // Check current permission states
  const checkPermissions = useCallback(async () => {
    const notifPerm: NotificationPermission | "default" =
      typeof window !== "undefined" && "Notification" in window
        ? Notification.permission
        : "default"

    let locPerm: PermissionState | "prompt" = "prompt"
    try {
      if (typeof window !== "undefined" && navigator.permissions) {
        const result = await navigator.permissions.query({ name: "geolocation" })
        locPerm = result.state
      }
    } catch {
      // permissions.query not supported for geolocation in some browsers
    }

    setPermissions({ notifications: notifPerm, location: locPerm })
    return { notifications: notifPerm, location: locPerm }
  }, [])

  useEffect(() => {
    if (!isAuth || !uType) {
      setState("idle")
      return
    }

    // Only prompt once per device
    const alreadyPrompted = localStorage.getItem(STORAGE_KEY)
    if (alreadyPrompted) return

    // Delay showing the prompt so it doesn't clash with login animation
    const timer = setTimeout(async () => {
      const perms = await checkPermissions()

      // Determine if we need to prompt
      const needsNotif = perms.notifications === "default"
      const needsLocation =
        uType === "repartidor" && perms.location === "prompt"

      if (needsNotif || needsLocation) {
        setState("showing")
      } else {
        // Already granted or denied, mark as prompted
        localStorage.setItem(STORAGE_KEY, "true")
      }
    }, 2000)

    return () => clearTimeout(timer)
  }, [isAuth, uType, checkPermissions])

  const handleAccept = async () => {
    setState("requesting")

    try {
      // Request notification permission
      if (permissions.notifications === "default") {
        const result = await Notification.requestPermission()
        setPermissions((prev) => ({ ...prev, notifications: result }))

        // If granted, also subscribe to push
        if (result === "granted") {
          try {
            const registration = await navigator.serviceWorker.ready
            const sub = await registration.pushManager.getSubscription()
            if (!sub) {
              // Get VAPID key and subscribe
              const vapidRes = await fetch("/api/push/vapid-key")
              if (vapidRes.ok) {
                const { publicKey } = await vapidRes.json()
                if (publicKey) {
                  const subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: publicKey,
                  })
                  await fetch("/api/push/subscribe", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      subscription: JSON.stringify(subscription),
                    }),
                  })
                }
              }
            }
          } catch (err) {
            console.error("Push subscription error:", err)
          }
        }
      }

      // Request location permission (repartidor only)
      if (uType === "repartidor" && permissions.location === "prompt") {
        try {
          await new Promise<void>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              () => resolve(),
              () => resolve() // Don't reject on denial
            )
          })
        } catch {
          // Silently handle
        }
      }
    } catch (err) {
      console.error("Permission request error:", err)
    } finally {
      localStorage.setItem(STORAGE_KEY, "true")
      setState("done")
    }
  }

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, "true")
    setState("done")
  }

  // Determine what we need to ask for
  const needsNotif = permissions.notifications === "default"
  const needsLocation = uType === "repartidor" && permissions.location === "prompt"

  return (
    <AnimatePresence>
      {state === "showing" && (needsNotif || needsLocation) && (
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
                <span className="text-2xl">
                  {needsLocation ? "📍" : "🔔"}
                </span>
              </motion.div>

              <h2 className="text-lg font-extrabold">
                {needsLocation
                  ? "Activá notificaciones y ubicación"
                  : "Activá las notificaciones"}
              </h2>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                {needsLocation
                  ? "Para recibir pedidos y que los clientes vean tu ubicación en tiempo real, necesitamos estos permisos."
                  : uType === "repartidor"
                  ? "Para recibir pedidos nuevos necesitás tener las notificaciones activadas."
                  : uType === "negocio"
                  ? "Recibí alertas de nuevos pedidos y mensajes de tus clientes."
                  : "Recibí alertas de tus pedidos y promociones exclusivas."}
              </p>
            </div>

            {/* Permission items */}
            <div className="px-5 py-4 space-y-3">
              {needsNotif && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border/30">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Bell className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">Notificaciones</p>
                    <p className="text-xs text-muted-foreground">
                      Alertas de pedidos y mensajes
                    </p>
                  </div>
                  <div className="shrink-0">
                    <Check className="w-4 h-4 text-primary opacity-50" />
                  </div>
                </div>
              )}

              {needsLocation && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border/30">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5 text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">Ubicación</p>
                    <p className="text-xs text-muted-foreground">
                      Seguimiento en vivo de entregas
                    </p>
                  </div>
                  <div className="shrink-0">
                    <Check className="w-4 h-4 text-blue-500 opacity-50" />
                  </div>
                </div>
              )}

              {/* Privacy note */}
              <div className="flex items-start gap-2 px-1 pt-1">
                <Shield className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Tu ubicación solo se comparte durante las entregas activas. Podés cambiar los permisos en cualquier momento desde la configuración.
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
                  <>
                    Activar permisos
                  </>
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
