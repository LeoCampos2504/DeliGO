"use client"

import { useCallback, useEffect, useState } from "react"
import { getPwaCapabilities, type PwaCapabilities } from "@/lib/pwa-capabilities"
import { urlBase64ToUint8Array } from "@/lib/push-subscription-key"
import { getCurrentOperativePushSubscription } from "@/lib/operativo-logout"

export type OperativoSalonPushState =
  | "checking"
  | "unsupported"
  | "needs-install"
  | "idle"
  | "activating"
  | "active"
  | "blocked"
  | "error"

const INITIAL_PWA_CAPABILITIES: PwaCapabilities = {
  platform: "other",
  isIos: false,
  isIosSafari: false,
  isStandalone: false,
  supportsServiceWorker: false,
  supportsPushManager: false,
  supportsNotification: false,
  notificationPermission: "unsupported",
  secureContext: false,
}

// Hook pequeño y exclusivo para la suscripción de avisos push del panel
// personal de Salón (Operaciones). No existe un hook compartido para este
// flujo — el panel de Mozo lo tiene inline en su propia página — así que
// este hook mirroriza esa misma lógica (capacidades → permiso → VAPID → SW →
// subscribe) contra el endpoint dedicado de Salón.
export function useOperativoSalonPush(slug: string) {
  const [state, setState] = useState<OperativoSalonPushState>("checking")
  const [error, setError] = useState<string | null>(null)
  const [pwaInfo, setPwaInfo] = useState<PwaCapabilities>(INITIAL_PWA_CAPABILITIES)

  const endpoint = `/api/operativo/salon/panel/${encodeURIComponent(slug)}/push-subscription`

  const refreshPwaInfo = useCallback(() => {
    const next = getPwaCapabilities()
    setPwaInfo(next)
    return next
  }, [])

  const checkSubscription = useCallback(async () => {
    setError(null)
    const capabilities = refreshPwaInfo()

    if (
      !capabilities.supportsServiceWorker ||
      !capabilities.supportsPushManager ||
      !capabilities.supportsNotification
    ) {
      setState("unsupported")
      return
    }

    if (capabilities.isIos && !capabilities.isStandalone) {
      setState("needs-install")
      return
    }

    if (capabilities.notificationPermission === "denied") {
      setState("blocked")
      return
    }

    try {
      setState("checking")
      const res = await fetch(endpoint, { cache: "no-store" })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data.error || "No se pudo consultar la suscripcion")
      }

      const serverSubscribed = data.subscribed === true
      setState(
        capabilities.notificationPermission === "granted" && serverSubscribed ? "active" : "idle"
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo consultar la suscripcion")
      setState("error")
    }
  }, [endpoint, refreshPwaInfo])

  useEffect(() => {
    void checkSubscription()
  }, [checkSubscription])

  const subscribe = useCallback(async () => {
    setError(null)
    const capabilities = refreshPwaInfo()

    if (
      !capabilities.supportsServiceWorker ||
      !capabilities.supportsPushManager ||
      !capabilities.supportsNotification
    ) {
      setState("unsupported")
      return false
    }

    if (capabilities.isIos && !capabilities.isStandalone) {
      setState("needs-install")
      return false
    }

    if (capabilities.notificationPermission === "denied") {
      setState("blocked")
      return false
    }

    try {
      setState("activating")
      const permission = await Notification.requestPermission()
      if (permission === "denied") {
        setState("blocked")
        refreshPwaInfo()
        return false
      }
      if (permission !== "granted") {
        setState("idle")
        refreshPwaInfo()
        return false
      }

      const keyResponse = await fetch("/api/push/vapid-key", { cache: "no-store" })
      const keyData = await keyResponse.json().catch(() => ({}))
      const publicKey = typeof keyData.publicKey === "string" ? keyData.publicKey : ""
      if (!keyResponse.ok || !publicKey) {
        throw new Error("No se pudo activar la suscripcion")
      }

      await navigator.serviceWorker.register("/sw.js")
      const registration = await navigator.serviceWorker.ready
      let subscription = await registration.pushManager.getSubscription()
      let createdSubscription = false

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        })
        createdSubscription = true
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ subscription: JSON.stringify(subscription) }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok || data.subscribed !== true) {
        if (createdSubscription) {
          await subscription.unsubscribe().catch(() => undefined)
        }
        throw new Error(data.error || "No se pudo guardar la suscripcion")
      }

      setState("active")
      refreshPwaInfo()
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo activar la suscripcion")
      setState("error")
      return false
    }
  }, [endpoint, refreshPwaInfo])

  const unsubscribe = useCallback(async () => {
    setError(null)

    try {
      setState("activating")
      // Logout-B1: O1 exige coincidencia exacta contra el endpoint almacenado —
      // sin la suscripcion capturada de este navegador no se envia el DELETE.
      const subscription = await getCurrentOperativePushSubscription()
      if (!subscription) {
        throw new Error("No pudimos identificar la suscripcion de este dispositivo")
      }

      const res = await fetch(endpoint, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ subscription }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data.error || "No se pudo desactivar la suscripcion")
      }

      setState("idle")
      refreshPwaInfo()
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo desactivar la suscripcion")
      setState("error")
      return false
    }
  }, [endpoint, refreshPwaInfo])

  return { state, error, pwaInfo, subscribe, unsubscribe, refresh: checkSubscription }
}
