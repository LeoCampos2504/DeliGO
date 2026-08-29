"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { toast } from "sonner"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { useAuthStore } from "@/store/auth-store"
import { createLatestOperationGate } from "./push-operation-guard"
import { checkPersonalPushStatus } from "./push-personal-status-check"

/**
 * P2-T05 Hardening H3B (F-P2-T05-23): resultado explícito y autoritativo de
 * una mutación (`subscribe`/`unsubscribe`). Reemplaza el patrón anterior
 * donde un consumidor leía `push.isSubscribed` DESPUÉS de un `await` — ese
 * valor pertenece al closure/render donde la mutación arrancó, nunca se
 * actualiza aunque el hook internamente sí aplique un `setIsSubscribed`
 * más nuevo, así que un consumidor que lo lee así SIEMPRE ve el valor
 * viejo (F-P2-T05-23: revierte una activación genuinamente exitosa).
 *
 * `current=false` significa que una operación MÁS NUEVA (otra mutación, un
 * cambio de actor, o un unmount) invalidó ésta antes de terminar — el
 * consumidor debe ignorar `subscribed` por completo y no tocar su UI en
 * absoluto (ni éxito, ni fallo: sencillamente no le pertenece a esta
 * operación decidir nada).
 */
export interface PushMutationResult {
  current: boolean
  subscribed: boolean
}

interface UsePushNotificationsReturn {
  isSupported: boolean
  isSubscribed: boolean
  permission: NotificationPermission | "default"
  subscribe: () => Promise<PushMutationResult>
  unsubscribe: () => Promise<PushMutationResult>
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

  // P2-T05 Hardening H3B (F-P2-T05-23): espejo SIEMPRE-fresco del último
  // `isSubscribed` aplicado — a diferencia de la variable de estado
  // `isSubscribed` capturada por un closure de render, un `ref` se lee
  // fresco en cualquier punto, incluso dentro del propio `subscribe()`/
  // `unsubscribe()` tras un `await`. Se usa exclusivamente para reportar la
  // verdad vigente en el `PushMutationResult` de un camino de fallo (donde
  // el estado en sí no cambia), nunca para decidir si aplicar un nuevo
  // valor — esa decisión sigue siendo 100% del gate.
  const isSubscribedRef = useRef(false)
  const applySubscribed = useCallback((value: boolean) => {
    isSubscribedRef.current = value
    setIsSubscribed(value)
  }, [])

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
    // decidir el estado visible del actor nuevo. Invalidar el gate ya evita
    // que esa mutación en vuelo aplique su propio `isSubscribed` (F-P2-T05-23)
    // — pero por diseño (`createLatestOperationGate.invalidate()` NO acuña un
    // nuevo id "current") esa misma invalidación es la razón por la que el
    // `finally`/`finishMutation` de la operación vieja tampoco podrá volver a
    // apagar `loading` (su `isCurrent(opId)` ya da `false`). Sin este reset
    // explícito, `loading` queda atascado en `true` para el actor NUEVO
    // — con el Switch deshabilitado mientras `loading` sea `true`, el actor
    // nuevo ni siquiera podría disparar su propia mutación para destrabarlo
    // (P2-T05 Hardening H3B precommit review, F-P2-T05-15 — hallazgo real).
    gateRef.current.invalidate()
    applySubscribed(false)
    setLoading(false)
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
  // ver push-personal-status-check.ts. Un status check nunca toca `loading`
  // — sólo las mutaciones (subscribe/unsubscribe) lo hacen — así que no
  // existe ninguna interacción posible entre un status check y la
  // titularidad de `loading` de una mutación en vuelo (F-P2-T05-15,
  // STATUS_CHECK_CAN_STEAL_MUTATION_LOADING_OWNERSHIP=NO estructuralmente).
  const checkSubscription = async () => {
    await checkPersonalPushStatus({
      gate: gateRef.current,
      getCurrentSubscription: async () => {
        const registration = await navigator.serviceWorker.ready
        return registration.pushManager.getSubscription()
      },
      fetchStatus: async (subscriptionJson) => {
        // P2-T18-BLOCKER-AUTH2-R13-R2 (F-P2-T18-AUTH02): selector explícito
        // de familia — mismo transporte ?actorFamily= ya certificado en
        // Fase 2, requerido para que /api/push/status resuelva sin
        // ambigüedad bajo 2+ cookies de familia coexistiendo.
        const statusUrl = actorType ? `/api/push/status?actorFamily=${actorType}` : "/api/push/status"
        const res = await fetch(statusUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: subscriptionJson }),
        })
        if (!res.ok) return { ok: false, subscribed: false }
        const data = await res.json()
        return { ok: true, subscribed: data.subscribed === true }
      },
      applyIsSubscribed: applySubscribed,
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

  // P2-T05 Hardening H3B (F-P2-T05-15 + F-P2-T05-23): único punto de salida
  // para subscribe()/unsubscribe() — decide, con el gate SIEMPRE fresco
  // (nunca un closure stale), si esta operación sigue siendo la vigente.
  // Si lo es: aplica el nuevo `isSubscribed`, apaga `loading` y devuelve
  // `current:true` con la verdad recién aplicada. Si no lo es (superada por
  // una operación/actor más nuevo): NO toca `isSubscribed` ni `loading`
  // (esa operación más nueva ya es dueña de ambos) y devuelve
  // `current:false` — el consumidor debe no hacer absolutamente nada con
  // el resultado.
  const finishMutation = useCallback(
    (opId: number, subscribed: boolean): PushMutationResult => {
      const current = gateRef.current.isCurrent(opId)
      if (current) {
        applySubscribed(subscribed)
        setLoading(false)
      }
      return { current, subscribed: current ? subscribed : isSubscribedRef.current }
    },
    [applySubscribed]
  )

  const subscribe = useCallback(async (): Promise<PushMutationResult> => {
    if (!isSupported || loading) return { current: false, subscribed: isSubscribedRef.current }

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
        if (gateRef.current.isCurrent(opId)) {
          toast.error("Necesitás permitir las notificaciones en tu navegador")
        }
        return finishMutation(opId, false)
      }

      // Register service worker
      const registration = await navigator.serviceWorker.register("/sw.js")
      await navigator.serviceWorker.ready

      // Get VAPID key
      const vapidKey = await getVapidKey()
      if (!vapidKey) {
        if (gateRef.current.isCurrent(opId)) {
          toast.error("Las notificaciones push no están configuradas")
        }
        return finishMutation(opId, false)
      }

      // Reuse the browser subscription when it already exists on this origin.
      const existingSubscription = await registration.pushManager.getSubscription()
      const subscription = existingSubscription ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey,
      })

      // Save to server
      // P2-T18-BLOCKER-AUTH2-R13-R2 (F-P2-T18-AUTH02): selector explícito
      // de familia — mismo transporte ?actorFamily= ya certificado en
      // Fase 2, requerido para que /api/push/subscribe resuelva sin
      // ambigüedad bajo 2+ cookies de familia coexistiendo.
      const subscribeUrl = actorType ? `/api/push/subscribe?actorFamily=${actorType}` : "/api/push/subscribe"
      const res = await fetch(subscribeUrl, {
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
        toast.success("Notificaciones activadas 🔔")
      }
      return finishMutation(opId, true)
    } catch (error) {
      console.error("Push subscribe error:", safeErrorForLog(error))
      if (gateRef.current.isCurrent(opId)) {
        toast.error("Error al activar notificaciones")
      }
      return finishMutation(opId, false)
    } finally {
      // Cierra `loading` incluso en un `return` temprano de más arriba —
      // `finishMutation` ya lo hace cuando la operación sigue vigente, pero
      // dejarlo también acá (idempotente, protegido por el mismo gate) es
      // la red de seguridad ante cualquier camino de salida futuro que se
      // agregue sin pasar por `finishMutation`.
      if (gateRef.current.isCurrent(opId)) setLoading(false)
    }
  }, [isSupported, loading, finishMutation, actorType])

  const unsubscribe = useCallback(async (): Promise<PushMutationResult> => {
    if (!isSupported || loading) return { current: false, subscribed: isSubscribedRef.current }

    // P2-T05 Stage3R2 (F-P2-T05-14, Race A): mismo principio — invalida
    // cualquier checkSubscription() pendiente de forma síncrona, antes de
    // que el detach server-side siquiera empiece.
    const opId = gateRef.current.begin()
    setLoading(true)
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        // P2-T18-BLOCKER-AUTH2-R13-R2 (F-P2-T18-AUTH02): selector explícito
        // de familia — mismo transporte ?actorFamily= ya certificado en
        // Fase 2, requerido para que /api/push/unsubscribe resuelva sin
        // ambigüedad bajo 2+ cookies de familia coexistiendo. `actorType`
        // sigue siendo el del actor autenticado en este momento (esta
        // acción es explícita del usuario, nunca disparada tras logout).
        const unsubscribeUrl = actorType ? `/api/push/unsubscribe?actorFamily=${actorType}` : "/api/push/unsubscribe"
        const res = await fetch(unsubscribeUrl, {
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
        setPermission("default")
        toast.success("Notificaciones desactivadas")
      }
      return finishMutation(opId, false)
    } catch (error) {
      console.error("Push unsubscribe error:", safeErrorForLog(error))
      if (gateRef.current.isCurrent(opId)) {
        toast.error("Error al desactivar notificaciones")
      }
      // Un detach fallido no cambió nada server-side — se reporta la verdad
      // vigente (ref siempre fresco) tal cual estaba, sin forzar ningún
      // valor nuevo.
      return finishMutation(opId, isSubscribedRef.current)
    } finally {
      if (gateRef.current.isCurrent(opId)) setLoading(false)
    }
  }, [isSupported, loading, finishMutation, actorType])

  return {
    isSupported,
    isSubscribed,
    permission,
    subscribe,
    unsubscribe,
    loading,
  }
}
