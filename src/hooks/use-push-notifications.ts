"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"

interface UsePushNotificationsReturn {
  isSupported: boolean
  isSubscribed: boolean
  permission: NotificationPermission | "default"
  subscribe: () => Promise<void>
  unsubscribe: () => Promise<void>
  loading: boolean
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const [isSupported, setIsSupported] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission | "default">("default")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Check if push is supported
    const supported = "serviceWorker" in navigator && "PushManager" in window
    setIsSupported(supported)

    if (supported) {
      setPermission(Notification.permission)
      checkSubscription()
    }
  }, [])

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      setIsSubscribed(!!subscription)
    } catch {
      setIsSubscribed(false)
    }
  }

  const getVapidKey = async (): Promise<string | null> => {
    try {
      const res = await fetch("/api/push/vapid-key")
      if (!res.ok) return null
      const data = await res.json()
      return data.publicKey
    } catch {
      return null
    }
  }

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
      const registration = await navigator.serviceWorker.register("/sw.js")
      await navigator.serviceWorker.ready

      // Get VAPID key
      const vapidKey = await getVapidKey()
      if (!vapidKey) {
        toast.error("Las notificaciones push no están configuradas")
        return
      }

      // Subscribe
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey,
      })

      // Save to server
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
  }, [isSupported, loading])

  const unsubscribe = useCallback(async () => {
    if (!isSupported || loading) return

    setLoading(true)
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        await subscription.unsubscribe()
      }

      // Remove from server
      await fetch("/api/push/unsubscribe", {
        method: "POST",
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
  }, [isSupported, loading])

  return {
    isSupported,
    isSubscribed,
    permission,
    subscribe,
    unsubscribe,
    loading,
  }
}
