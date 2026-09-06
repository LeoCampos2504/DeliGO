"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { toast } from "sonner"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { useAuthStore } from "@/store/auth-store"
import { createLatestOperationGate } from "./push-operation-guard"
import { checkPersonalPushStatus } from "./push-personal-status-check"
import {
  registerInFlightPersonalPushMutation,
  waitForInFlightPersonalPushMutation,
} from "./push-mutation-in-flight-registry"
import {
  applicationServerKeyMatches,
  unsubscribeStalePushSubscription,
  urlBase64ToUint8Array,
} from "@/lib/push-subscription-key"
import {
  fingerprintPushEndpoint,
  recordPushDebugEvent,
  setPushDebugTraceContext,
} from "@/lib/push-debug-trace"

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

// P2-T31-R8 (PUSH-RATE-LIMIT-429-STATE-CONSISTENCY-FIX): F-P2-T31-R8-04 —
// physical evidence showed subscribe()/unsubscribe() failing silently-feeling
// under a real 429 from the shared rate limiter: the generic "Error al
// activar/desactivar notificaciones" toast fired (FAILURE_FEEDBACK_PRESENT
// was already SI structurally), but gave no indication of WHY, or that
// retrying shortly would work — easy to miss during a rapid toggle burst.
// Carries the real HTTP status through the existing throw/catch flow (no new
// control paths) so the catch block can choose a specific, honest message
// for a rate-limit rejection without exposing any internal detail.
export class PushMutationHttpError extends Error {
  readonly httpStatus: number
  constructor(message: string, httpStatus: number) {
    super(message)
    this.httpStatus = httpStatus
  }
}

export function pushMutationFailureMessage(error: unknown, fallback: string): string {
  if (error instanceof PushMutationHttpError && error.httpStatus === 429) {
    return "Demasiados intentos. Esperá unos segundos e intentá nuevamente."
  }
  return fallback
}

interface UsePushNotificationsReturn {
  isSupported: boolean
  isSubscribed: boolean
  // P2-T31-R7 (PUSH-INITIAL-UNKNOWN-STATE-FLICKER-FIX): `false` is used as
  // the initial value of `isSubscribed` for BOTH "authoritatively not
  // subscribed" and "no authoritative result yet" — those are not the same
  // thing, and a consumer that renders `isSubscribed` directly during the
  // unresolved window shows a false OFF that then flips to ON once the real
  // (already-true) result lands moments later. `statusResolved` disambiguates
  // this explicitly: `false` until the FIRST authoritative conclusion has
  // actually been applied (initial mount check, or — once mounted — any
  // subscribe()/unsubscribe() completion), `true` from then on. Consumers
  // must treat `isSubscribed` as meaningless while `statusResolved` is
  // `false` — render a neutral/loading state instead of ON or OFF. See
  // F-P2-T31-INITIAL-STATE-FLICKER-01 (physical evidence: Leonardo's C4
  // cold-launch traces on iPhone, ~300-430ms mount→resolve window).
  statusResolved: boolean
  // P2-T31-R8 (PUSH-RATE-LIMIT-429-STATE-CONSISTENCY-FIX): `true` when the
  // most recent status check reached an INCONCLUSIVE outcome (network
  // exception, or the backend responding non-2xx — most notably a 429 from
  // the shared rate limiter) rather than a real answer. Distinct from
  // `!statusResolved` alone: that covers BOTH "still actively checking for
  // the first time" and "checked, but couldn't get an answer" — consumers
  // that want to show a different neutral message for the latter ("No se
  // pudo comprobar" vs "Comprobando estado...") can do so via this flag.
  // Cleared back to `false` the moment any real conclusion (true or false)
  // is applied, or on actor change. Never true at the same time as
  // `statusResolved` — an inconclusive check never resolves.
  statusCheckError: boolean
  permission: NotificationPermission | "default"
  subscribe: () => Promise<PushMutationResult>
  unsubscribe: () => Promise<PushMutationResult>
  loading: boolean
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const [isSupported, setIsSupported] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  // P2-T31-R7: starts unresolved on every fresh mount (and again on every
  // actor change) — becomes `true` only once an authoritative conclusion
  // (from the initial status check OR a completed subscribe()/unsubscribe())
  // has actually been applied for the CURRENT operation/actor. Never flips
  // back to `false` on its own after that point — see finishMutation and
  // applyStatusResult below for the only two places that set it `true`, and
  // the actor-change effect for the only place that resets it.
  const [statusResolved, setStatusResolved] = useState(false)
  // P2-T31-R8: see UsePushNotificationsReturn.statusCheckError doc above.
  const [statusCheckError, setStatusCheckError] = useState(false)
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
    // P2-T31-R6A: purely observational — fires only on an actual change,
    // never influences the assignment itself.
    if (isSubscribedRef.current !== value) {
      recordPushDebugEvent("HOOK_IS_SUBSCRIBED_CHANGED", { oldValue: isSubscribedRef.current, newValue: value })
    }
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

  // P2-T31-R6A (PUSH-LIFECYCLE-TIMELINE-DIAGNOSTIC): purely observational —
  // feeds the diagnostic tracer so a physical capture can show exactly when
  // auth hydration finished relative to the first status check. NEVER read
  // by any branch below that decides subscribe/unsubscribe/status behavior
  // — see AUTH_HYDRATION_PUSH_RACE in the R6 report, which this exists to
  // help confirm or rule out with real evidence, not to fix yet.
  const authHasHydrated = useAuthStore((s) => s._hasHydrated)

  useEffect(() => {
    recordPushDebugEvent("PUSH_HOOK_MOUNT")
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
      recordPushDebugEvent("PUSH_HOOK_UNMOUNT")
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
    recordPushDebugEvent("ACTOR_KEY_CHANGED", { actorFamily: actorType })
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
    // P2-T31-R7: a new actor has no authoritative result yet — back to
    // unresolved until THIS actor's own check (triggered below) concludes.
    // Consumers must go back to a neutral/loading render, not OFF, for this
    // new actor's own initial window.
    setStatusResolved(false)
    // P2-T31-R8: a stale "couldn't check" from the PREVIOUS actor is
    // meaningless for this new one — clear it so the new actor's own check
    // gets a clean neutral "checking" render, not a leftover error message.
    setStatusCheckError(false)
    setLoading(false)
    if (isSupported) {
      checkSubscription()
    }
  }, [actorKey])

  // P2-T31-R6A: purely observational context sync for the tracer — never
  // used by any decision logic. Kept as its own effect, entirely AFTER the
  // two effects above, so it never changes their timing/ordering.
  useEffect(() => {
    setPushDebugTraceContext({ actorFamily: actorType, authHasHydrated })
  }, [actorType, authHasHydrated])

  const wasHydratedRef = useRef(false)
  useEffect(() => {
    if (authHasHydrated && !wasHydratedRef.current) {
      wasHydratedRef.current = true
      recordPushDebugEvent("AUTH_HYDRATED", { actorFamily: actorType, source: "hook" })
    }
  }, [authHasHydrated, actorType])

  // P2-T31-R7: the ONLY place that resolves the initial/actor-scoped status
  // check into a UI-visible conclusion. Deliberately distinct from the bare
  // `applySubscribed` (used by finishMutation for subscribe()/unsubscribe())
  // so a status check and a mutation both drive `statusResolved` from their
  // own call sites, without either one needing to know about the other's
  // existence. `checkPersonalPushStatus` only ever invokes its
  // `applyIsSubscribed` dependency from a branch it has ALREADY confirmed is
  // still the current operation (see STATUS_APPLY vs STATUS_DISCARDED_STALE
  // in push-personal-status-check.ts) — so this can never mark `resolved`
  // for a stale/superseded check.
  const applyStatusResult = useCallback(
    (value: boolean) => {
      applySubscribed(value)
      setStatusResolved(true)
      // P2-T31-R8: a real conclusion (true OR false) clears any leftover
      // "couldn't check" flag from an earlier inconclusive attempt.
      setStatusCheckError(false)
    },
    [applySubscribed]
  )

  // P2-T31-R8 (PUSH-RATE-LIMIT-429-STATE-CONSISTENCY-FIX): the counterpart
  // to `applyStatusResult` for the INCONCLUSIVE case — see
  // push-personal-status-check.ts's `applyStatusUnresolved` dependency.
  // Deliberately never touches `isSubscribed`/`statusResolved`: an
  // inconclusive check (network exception, non-2xx backend response — most
  // notably a 429 from the shared rate limiter) is not evidence of
  // anything, so the UI must stay exactly as unresolved as it already was.
  // No retry is scheduled here — the next real attempt is the next mount or
  // actor change, matching the existing (non-polling) lifecycle.
  const handleStatusUnresolved = useCallback(() => {
    setStatusCheckError(true)
  }, [])

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
    recordPushDebugEvent("AUTH_STATE_OBSERVED", { actorFamily: actorType, authHasHydrated, source: "hook" })
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
        if (!res.ok) {
          // P2-T31-R8: forward httpStatus/Retry-After for diagnostics only —
          // checkPersonalPushStatus never treats a non-ok response as
          // "not subscribed" (see applyStatusUnresolved below).
          const retryAfterHeader = res.headers.get("Retry-After")
          const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : undefined
          return { ok: false, subscribed: false, httpStatus: res.status, retryAfterMs }
        }
        const data = await res.json()
        return { ok: true, subscribed: data.subscribed === true, httpStatus: res.status }
      },
      applyIsSubscribed: applyStatusResult,
      applyStatusUnresolved: handleStatusUnresolved,
      // P2-T31-R2 (FIRST-SUBSCRIBE-REMOUNT-STATE): antes de leer el estado
      // físico, espera cualquier subscribe()/unsubscribe() todavía en vuelo
      // para ESTE actor — incluida una mutación arrancada por una instancia
      // de este mismo hook YA DESMONTADA (navegación Perfil<->Favoritos u
      // homólogas en Negocio/Repartidor). Sin esto, un check de un montaje
      // nuevo puede leer `getSubscription()===null` genuinamente cierto EN
      // ESE INSTANTE — no porque el usuario nunca haya activado nada, sino
      // porque la primera activación real (la única que hace SW register +
      // fetch de VAPID + handshake nuevo con el push service, mucho más
      // lenta que activaciones posteriores que reusan la subscription física
      // ya existente) todavía no terminó — y esa conclusión "false" queda
      // permanente: el propio gate de la instancia vieja ya está invalidado
      // (por el cleanup del unmount), así que cuando esa mutación huérfana
      // finalmente sí resuelve, su propio finishMutation ve current:false y
      // no aplica nada que ningún componente vivo pueda observar.
      waitForInFlightMutation: () => waitForInFlightPersonalPushMutation(actorKey),
      trace: recordPushDebugEvent,
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
        // P2-T31-R7: a completed mutation is itself an authoritative
        // conclusion — if the initial status check hadn't resolved yet for
        // some reason, a live subscribe()/unsubscribe() the user just
        // performed is at least as authoritative. Idempotent once already
        // `true` (the overwhelmingly common case, since mutations are
        // user-triggered well after Perfil has mounted).
        setStatusResolved(true)
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
    recordPushDebugEvent("SUBSCRIBE_START", { opId })

    // P2-T31-R2 (FIRST-SUBSCRIBE-REMOUNT-STATE): el cuerpo real vive en este
    // `run` interno para poder registrar la promesa (síncronamente, antes de
    // cualquier `await`) en el registro compartido — ver
    // push-mutation-in-flight-registry.ts. Si el usuario navega fuera y esta
    // instancia se desmonta a mitad del `try` de abajo, un checkSubscription()
    // de la instancia NUEVA (montaje fresco, gate propio) puede esperar esta
    // misma promesa antes de leer el estado físico, en vez de concluir
    // prematuramente que nunca hubo ninguna activación.
    const run = async (): Promise<PushMutationResult> => {
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
        recordPushDebugEvent("VAPID_FETCH_START", { opId })
        const vapidKey = await getVapidKey()
        recordPushDebugEvent("VAPID_FETCH_RESULT", { opId, fetched: !!vapidKey })
        if (!vapidKey) {
          if (gateRef.current.isCurrent(opId)) {
            toast.error("Las notificaciones push no están configuradas")
          }
          return finishMutation(opId, false)
        }

        // P2-T31-R3 (ANDROID-WEB-PUSH-DELIVERY-CROSS-ENV-AUDIT): reusar la
        // subscription física existente SOLO si sigue atada a la VAPID
        // public key VIGENTE del servidor. Reproducido en vivo contra
        // TESTING: una subscription física vieja (nunca destruida por
        // SERVER_DETACH_ONLY) seguía siendo reusada acá indefinidamente pese
        // a que el servidor ya firma con una key distinta — el proveedor Web
        // Push la rechaza para siempre (Apple: `VapidPkHashMismatch`,
        // statusCode 400), aunque `subscribe()` reporte éxito y el switch de
        // la UI quede mostrando "activado" sin que ningún push real vuelva a
        // llegar. Ver push-subscription-key.ts::applicationServerKeyMatches.
        const applicationServerKey = urlBase64ToUint8Array(vapidKey)
        const existingSubscription = await registration.pushManager.getSubscription()
        const existingKeyIsCurrent = applicationServerKeyMatches(
          existingSubscription?.options.applicationServerKey ?? null,
          applicationServerKey
        )
        recordPushDebugEvent("SUBSCRIBE_PHYSICAL_EXISTING", {
          opId,
          existingPresent: !!existingSubscription,
          endpointFingerprint: existingSubscription ? fingerprintPushEndpoint(existingSubscription.endpoint) : null,
        })
        recordPushDebugEvent("VAPID_MATCH_RESULT", { opId, existingKeyIsCurrent })

        let subscription: PushSubscription
        if (existingSubscription && !existingKeyIsCurrent) {
          // P2-T31-R5A (PUSH-SUBSCRIPTION-FAILURE-CONTRACT-HARDENING): no
          // basta con `await existingSubscription.unsubscribe()` — el
          // booleano que resuelve es ambiguo entre navegadores (¿"no había
          // nada que remover" vs "la operación en sí falló"?), y este call
          // site ya SABE que había una subscription viva. Confirmar la
          // remoción de verdad (re-leer getSubscription()) antes de crear
          // una nueva encima — si no se puede confirmar, se aborta (throw,
          // capturado por el catch de abajo -> finishMutation(opId, false))
          // en vez de arriesgar dos subscriptions físicas simultáneas o
          // reportar éxito sin poder probarlo.
          recordPushDebugEvent("SUBSCRIBE_STALE_REMOVE_START", { opId })
          const removed = await unsubscribeStalePushSubscription(existingSubscription, () =>
            registration.pushManager.getSubscription()
          )
          recordPushDebugEvent("SUBSCRIBE_STALE_REMOVE_RESULT", { opId, removed })
          if (!removed) {
            throw new Error("No se pudo confirmar la eliminación de la subscription obsoleta")
          }
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: applicationServerKey as BufferSource,
          })
        } else if (existingSubscription && existingKeyIsCurrent) {
          subscription = existingSubscription
        } else {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            // P2-T31-R3: cast needed only for a pre-existing TS/lib.dom
            // strictness gap already tolerated elsewhere in this repo —
            // `Uint8Array<ArrayBufferLike>` vs the DOM `BufferSource` union.
            // Runtime behavior is unaffected: the browser accepts a
            // Uint8Array here regardless.
            applicationServerKey: applicationServerKey as BufferSource,
          })
        }
        recordPushDebugEvent("SUBSCRIBE_NEW_PHYSICAL_RESULT", {
          opId,
          endpointFingerprint: fingerprintPushEndpoint(subscription.endpoint),
          reused: !!(existingSubscription && existingKeyIsCurrent),
        })

        // Save to server
        // P2-T18-BLOCKER-AUTH2-R13-R2 (F-P2-T18-AUTH02): selector explícito
        // de familia — mismo transporte ?actorFamily= ya certificado en
        // Fase 2, requerido para que /api/push/subscribe resuelva sin
        // ambigüedad bajo 2+ cookies de familia coexistiendo.
        const subscribeUrl = actorType ? `/api/push/subscribe?actorFamily=${actorType}` : "/api/push/subscribe"
        recordPushDebugEvent("SUBSCRIBE_BACKEND_START", { opId })
        const res = await fetch(subscribeUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subscription: JSON.stringify(subscription),
          }),
        })
        recordPushDebugEvent("SUBSCRIBE_BACKEND_RESULT", { opId, httpStatus: res.status, ok: res.ok })

        if (!res.ok) {
          throw new PushMutationHttpError("Error saving subscription", res.status)
        }

        if (gateRef.current.isCurrent(opId)) {
          toast.success("Notificaciones activadas 🔔")
        }
        recordPushDebugEvent("SUBSCRIBE_FINISH", { opId, current: gateRef.current.isCurrent(opId), subscribed: true })
        return finishMutation(opId, true)
      } catch (error) {
        console.error("Push subscribe error:", safeErrorForLog(error))
        if (gateRef.current.isCurrent(opId)) {
          toast.error(pushMutationFailureMessage(error, "Error al activar notificaciones"))
        }
        recordPushDebugEvent("SUBSCRIBE_FINISH", {
          opId,
          current: gateRef.current.isCurrent(opId),
          subscribed: false,
          errorClass: error instanceof Error ? error.name : "unknown",
        })
        return finishMutation(opId, false)
      } finally {
        // Cierra `loading` incluso en un `return` temprano de más arriba —
        // `finishMutation` ya lo hace cuando la operación sigue vigente, pero
        // dejarlo también acá (idempotente, protegido por el mismo gate) es
        // la red de seguridad ante cualquier camino de salida futuro que se
        // agregue sin pasar por `finishMutation`.
        if (gateRef.current.isCurrent(opId)) setLoading(false)
      }
    }

    const mutationPromise = run()
    registerInFlightPersonalPushMutation(actorKey, mutationPromise)
    return mutationPromise
  }, [isSupported, loading, finishMutation, actorType, actorKey])

  const unsubscribe = useCallback(async (): Promise<PushMutationResult> => {
    if (!isSupported || loading) return { current: false, subscribed: isSubscribedRef.current }

    // P2-T05 Stage3R2 (F-P2-T05-14, Race A): mismo principio — invalida
    // cualquier checkSubscription() pendiente de forma síncrona, antes de
    // que el detach server-side siquiera empiece.
    const opId = gateRef.current.begin()
    setLoading(true)
    recordPushDebugEvent("UNSUBSCRIBE_START", { opId })

    // P2-T31-R2: mismo motivo que en subscribe() — registrar la promesa
    // real en el registro compartido requiere separarla en un `run` interno
    // para poder capturarla ANTES de devolverla.
    const run = async (): Promise<PushMutationResult> => {
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
          recordPushDebugEvent("UNSUBSCRIBE_BACKEND_RESULT", { opId, httpStatus: res.status, ok: res.ok })

          if (!res.ok) {
            throw new PushMutationHttpError("Error removing subscription", res.status)
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
        recordPushDebugEvent("UNSUBSCRIBE_FINISH", { opId, current: gateRef.current.isCurrent(opId), subscribed: false })
        return finishMutation(opId, false)
      } catch (error) {
        console.error("Push unsubscribe error:", safeErrorForLog(error))
        if (gateRef.current.isCurrent(opId)) {
          toast.error(pushMutationFailureMessage(error, "Error al desactivar notificaciones"))
        }
        recordPushDebugEvent("UNSUBSCRIBE_FINISH", {
          opId,
          current: gateRef.current.isCurrent(opId),
          errorClass: error instanceof Error ? error.name : "unknown",
        })
        // Un detach fallido no cambió nada server-side — se reporta la verdad
        // vigente (ref siempre fresco) tal cual estaba, sin forzar ningún
        // valor nuevo.
        return finishMutation(opId, isSubscribedRef.current)
      } finally {
        if (gateRef.current.isCurrent(opId)) setLoading(false)
      }
    }

    const mutationPromise = run()
    registerInFlightPersonalPushMutation(actorKey, mutationPromise)
    return mutationPromise
  }, [isSupported, loading, finishMutation, actorType, actorKey])

  return {
    isSupported,
    isSubscribed,
    statusResolved,
    statusCheckError,
    permission,
    subscribe,
    unsubscribe,
    loading,
  }
}
