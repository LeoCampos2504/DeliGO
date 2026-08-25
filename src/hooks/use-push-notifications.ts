"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { toast } from "sonner"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { useAuthStore } from "@/store/auth-store"
import { createLatestOperationGate } from "./push-operation-guard"
import { checkPersonalPushStatus } from "./push-personal-status-check"

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

  // P2-T05 Stage3R2 (F-P2-T05-14, PERSONAL_PUSH_ASYNC_MODEL=
  // LATEST_RELEVANT_OPERATION_WINS): un único gate por instancia del hook,
  // compartido por checkSubscription/subscribe/unsubscribe/actor-change/
  // unmount. Cada operación que puede eventualmente llamar setIsSubscribed
  // obtiene su propio id vía `gate.begin()` — arrancar una operación más
  // nueva invalida inmediatamente cualquier id anterior, aunque su trabajo
  // async todavía no haya resuelto. Antes de aplicar cualquier resultado se
  // exige `gate.isCurrent(id)`.
  const gateRef = useRef(createLatestOperationGate())

  // Identidad de actor NO-autoritativa — usada ÚNICAMENTE para invalidar
  // operaciones pendientes cuando el actor autenticado cambia (Race C). La
  // autoridad de seguridad sigue siendo exclusivamente el servidor
  // (`/api/push/status`, que deriva el owner de la sesión) — este valor
  // nunca se envía al servidor ni participa en ninguna decisión de owner.
  const actorId = useAuthStore((s) => s.user?.id ?? null)
  const actorType = useAuthStore((s) => s.user?.type ?? null)
  const actorKey = actorId && actorType ? `${actorType}:${actorId}` : null
  const isFirstActorKeyRef = useRef(true)

  useEffect(() => {
    // Check if push is supported
    const supported = "serviceWorker" in navigator && "PushManager" in window
    setIsSupported(supported)

    if (supported) {
      setPermission(Notification.permission)
      checkSubscription()
    }

    // P2-T05 Stage3R2: al desmontar, cualquier lectura pendiente queda
    // invalidada — ninguna respuesta tardía puede aplicar sobre un
    // componente que ya no representa el estado actual.
    return () => {
      gateRef.current.invalidate()
    }
  }, [])

  useEffect(() => {
    // Primer render: actorKey ya refleja el actor con el que este hook
    // arrancó — no hay ninguna operación previa que invalidar todavía (el
    // efecto de montaje de arriba ya dispara el primer checkSubscription).
    if (isFirstActorKeyRef.current) {
      isFirstActorKeyRef.current = false
      return
    }
    // P2-T05 Stage3R2 (Race C): el actor autenticado cambió — cualquier
    // lectura/mutación en vuelo pertenecía al actor anterior y nunca puede
    // decidir el estado visible del actor nuevo.
    gateRef.current.invalidate()
    setIsSubscribed(false)
    if (isSupported) {
      checkSubscription()
    }
  }, [actorKey])

  // P2-T05 Stage3R1 (F-P2-T05-13): la existencia física de la subscription
  // ya NO es, por sí sola, la fuente de verdad de "activado" — desde
  // SERVER_DETACH_ONLY (F-P2-T05-02) la subscription física puede seguir
  // viva sin que el servidor tenga ningún binding para este actor. La
  // autoridad es siempre: physical subscription actual + binding server-side
  // confirmado para ESTE actor+endpoint. Cualquier fallo (sin physical
  // subscription, o el status check falla) cierra en `false` — nunca se
  // asume "activado" únicamente por la existencia física.
  //
  // P2-T05 Stage3R2 (F-P2-T05-14): la orquestación real (incluida la
  // protección contra respuestas stale) vive en `checkPersonalPushStatus`,
  // compartiendo el mismo `gateRef` que subscribe()/unsubscribe() —
  // ver push-personal-status-check.ts.
  const checkSubscription = async () => {
    await checkPersonalPushStatus({
      gate: gateRef.current,
      getCurrentSubscription: async () => {
        const registration = await navigator.serviceWorker.ready
        return registration.pushManager.getSubscription()
      },
      fetchStatus: async (subscriptionJson) => {
        const res = await fetch("/api/push/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: subscriptionJson }),
        })
        if (!res.ok) return { ok: false, subscribed: false }
        const data = await res.json()
        return { ok: true, subscribed: data.subscribed === true }
      },
      applyIsSubscribed: setIsSubscribed,
    })
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

    // P2-T05 Stage3R2 (F-P2-T05-14, Race B): begin() se llama de forma
    // SÍNCRONA antes de cualquier `await` — cualquier checkSubscription()
    // pendiente queda stale desde este mismo instante, no recién cuando el
    // POST a /api/push/subscribe termine.
    const opId = gateRef.current.begin()
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

      // Reuse the browser subscription when it already exists on this origin.
      const existingSubscription = await registration.pushManager.getSubscription()
      const subscription = existingSubscription ?? await registration.pushManager.subscribe({
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

      if (gateRef.current.isCurrent(opId)) {
        setIsSubscribed(true)
      }
      toast.success("Notificaciones activadas 🔔")
    } catch (error) {
      console.error("Push subscribe error:", safeErrorForLog(error))
      toast.error("Error al activar notificaciones")
    } finally {
      setLoading(false)
    }
  }, [isSupported, loading])

  const unsubscribe = useCallback(async () => {
    if (!isSupported || loading) return

    // P2-T05 Stage3R2 (F-P2-T05-14, Race A): mismo principio — invalida
    // cualquier checkSubscription() pendiente de forma síncrona, antes de
    // que el detach server-side siquiera empiece.
    const opId = gateRef.current.begin()
    setLoading(true)
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        const res = await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subscription: JSON.stringify(subscription),
          }),
        })

        if (!res.ok) {
          throw new Error("Error removing subscription")
        }

        // P2-T05 Stage3 (F-P2-T05-02, PHYSICAL_UNSUBSCRIBE_POLICY_FINAL=
        // SERVER_DETACH_ONLY): deliberadamente NO se destruye la
        // PushSubscription física del browser acá — el endpoint físico
        // puede estar legítimamente asociado a otro binding
        // Personal/Operativo en este mismo origin (multi-bind, MODEL-C1). El
        // detach del lado del servidor ya ocurrió arriba; el estado local
        // simplemente deja de considerarse "suscrito" en esta sesión de UI.
      }

      if (gateRef.current.isCurrent(opId)) {
        setIsSubscribed(false)
        setPermission("default")
      }
      toast.success("Notificaciones desactivadas")
    } catch (error) {
      console.error("Push unsubscribe error:", safeErrorForLog(error))
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
