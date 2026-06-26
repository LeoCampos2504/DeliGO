"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"

interface UseSharedPushNotificationsParams {
  /** The shared-display token (salonToken or empleadosToken) */
  token: string
  /** Subscribe endpoint (POST) — receives { token, subscription } */
  subscribeEndpoint: string
  /** Unsubscribe endpoint (POST) — receives { token } */
  unsubscribeEndpoint: string
  /** Whether the server reports an active subscription already exists */
  initialSubscribed: boolean
}

interface UseSharedPushNotificationsReturn {
  isSupported: boolean
  isSubscribed: boolean
  permission: NotificationPermission | "default"
  subscribe: () => Promise<void>
  unsubscribe: () => Promise<void>
  loading: boolean
}

/**
 * Reusable push notification hook for the shared-display PWAs
 * (salon /s/[token] and empleados /e/[token]).
 *
 * Unlike the personal usePushNotifications hook (which relies on the session
 * cookie), this one authenticates with a shared token and stores the
 * subscription on the Negocio model in a dedicated field.
 */
export function useSharedPushNotifications({
  token,
  subscribeEndpoint,
  unsubscribeEndpoint,
  initialSubscribed,
}: UseSharedPushNotificationsParams): UseSharedPushNotificationsReturn {
  const [isSupported, setIsSupported] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission | "default">("default")
  const [loading, setLoading] = useState(false)

  // Check the browser's push manager and reconcile with the server-reported
  // subscription state.
  const checkSubscription = useCallback(async (serverSaysSubscribed: boolean) => {
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      const localSubscribed = !!subscription
      // Subscribed if either the browser has a local subscription OR the
      // server has one registered (covers cases where the SW was just
      // registered but the push subscription hasn't been created yet).
      setIsSubscribed(localSubscribed || serverSaysSubscribed)
    } catch {
      setIsSubscribed(serverSaysSubscribed)
    }
  }, [])

  useEffect(() => {
    const supported = "serviceWorker" in navigator && "PushManager" in window
    setIsSupported(supported)

    if (supported) {
      setPermission(Notification.permission)
      // Seed initial state from the server, then verify against the browser's
      // own push manager (the subscription may have been cleared locally).
      checkSubscription(initialSubscribed)
    } else {
      setIsSubscribed(initialSubscribed)
    }
  }, [initialSubscribed, checkSubscription])

  const subscribe = useCallback(async () => {
    if (!isSupported || loading) return

    setLoading(true)
    try {
      // Request permission
      const result = await Notification.requestPermission()
      setPermission(result)

      if (result !== "granted") {
        toast.error("Necesitás permitir las notificaciones en tu navegador")
        return
      }

      // Register service worker
      await navigator.serviceWorker.register("/sw.js")
      await navigator.serviceWorker.ready

      // Get VAPID key
      const vapidRes = await fetch("/api/push/vapid-key", {
        referrerPolicy: "no-referrer",
      })
      if (!vapidRes.ok) {
        toast.error("Las notificaciones push no están configuradas")
        return
      }
      const { publicKey } = await vapidRes.json()
      if (!publicKey) {
        toast.error("Las notificaciones push no están configuradas")
        return
      }

      // Subscribe
      const registration = await navigator.serviceWorker.ready
      const existingSubscription = await registration.pushManager.getSubscription()
      const subscription = existingSubscription ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: publicKey,
      })

      // Save to server with the shared token
      const res = await fetch(subscribeEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        referrerPolicy: "no-referrer",
        body: JSON.stringify({
          subscription: JSON.stringify(subscription),
        }),
      })

      if (!res.ok) {
        throw new Error("Error saving subscription")
      }

      setIsSubscribed(true)
      toast.success("Notificaciones activadas 🔔")
    } catch (error) {
      console.error("Push subscribe error:", error)
      toast.error("Error al activar notificaciones")
    } finally {
      setLoading(false)
    }
  }, [isSupported, loading, token, subscribeEndpoint])

  const unsubscribe = useCallback(async () => {
    if (!isSupported || loading) return

    setLoading(true)
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        await subscription.unsubscribe()
      }

      await fetch(unsubscribeEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        referrerPolicy: "no-referrer",
      })

      setIsSubscribed(false)
      setPermission("default")
      toast.success("Notificaciones desactivadas")
    } catch (error) {
      console.error("Push unsubscribe error:", error)
      toast.error("Error al desactivar notificaciones")
    } finally {
      setLoading(false)
    }
  }, [isSupported, loading, token, unsubscribeEndpoint])

  return {
    isSupported,
    isSubscribed,
    permission,
    subscribe,
    unsubscribe,
    loading,
  }
}
