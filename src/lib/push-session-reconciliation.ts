// P2-T40-R1 — orquestación cliente compartida de la reconciliación de Push
// posterior a un login/mount de sesión válida. Implementa el diseño
// corregido de P2_T40_A1 (nunca el auto-rebind inseguro original de A0):
//
// 1. SIEMPRE intenta la limpieza de stale-owner (independiente de cualquier
//    opt-out local — es una corrección de seguridad, no una preferencia del
//    owner actual) vía /api/push/reconcile-stale-owner, que consume el
//    handoff de un solo uso dejado por el login (ver src/lib/push-owner-handoff.ts).
//    Esa misma llamada devuelve `newSession`, la única señal fiable
//    (server-derivada, tamper-proof, nunca localStorage/sessionStorage con
//    el token de sesión) de "esto es una autenticación recién completada".
// 2. Sólo si NO hay opt-out manual local para este owner, y el permiso ya
//    es "granted" y existe subscription física, hace auto-rebind
//    SILENCIOSO (nunca Notification.requestPermission()) reusando
//    /api/push/subscribe — la misma ruta que ya usa el toggle manual.
// 3. Si SÍ hay opt-out manual local y esto es una sesión nueva, señala que
//    corresponde mostrar la oferta de reactivación M2 (máximo una vez por
//    sesión — garantizado por el consumo de un solo uso del handoff, nunca
//    por un guard client-side adicional que pudiera perder ese estado).
//
// Nunca bloquea el login: cualquier error de red se traga (catch) y esta
// función simplemente no hace nada esa vez — se reintenta en el próximo
// mount/reconciliación relevante (LOGIN_SUCCESS_INDEPENDENT_OF_PUSH_REPAIR).
import { hasPushManualOptOut } from "@/lib/push-manual-optout"
import type { PushSubscriptionOwnerType } from "@/lib/push-subscription-repository"
import {
  applicationServerKeyMatches,
  unsubscribeStalePushSubscription,
  urlBase64ToUint8Array,
} from "@/lib/push-subscription-key"
import { safeErrorForLog } from "@/lib/log-safe-error"

export type PushReconciliationFamily = PushSubscriptionOwnerType

async function getPhysicalPushSubscriptionJson(): Promise<string | null> {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window)
  ) {
    return null
  }
  try {
    const registration = await navigator.serviceWorker.getRegistration("/")
    const subscription = await registration?.pushManager.getSubscription()
    return subscription ? JSON.stringify(subscription) : null
  } catch {
    return null
  }
}

interface ReconcileStaleOwnerResult {
  newSession: boolean
  staleCleanupPerformed: boolean
}

async function reconcileStaleOwner(
  family: PushReconciliationFamily,
  subscriptionJson: string | null
): Promise<ReconcileStaleOwnerResult> {
  try {
    const res = await fetch(`/api/push/reconcile-stale-owner?actorFamily=${family}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: subscriptionJson }),
    })
    if (!res.ok) return { newSession: false, staleCleanupPerformed: false }
    const data = await res.json().catch(() => ({}))
    return {
      newSession: data.newSession === true,
      staleCleanupPerformed: data.staleCleanupPerformed === true,
    }
  } catch {
    return { newSession: false, staleCleanupPerformed: false }
  }
}

/**
 * Auto-rebind silencioso del owner actual, reusando /api/push/subscribe
 * (misma ruta que ya usa el toggle manual de Ajustes) — nunca crea una
 * subscription física nueva ni pide permiso, sólo persiste la ya existente.
 */
export async function silentlyRebindCurrentOwner(
  family: PushReconciliationFamily,
  subscriptionJson: string
): Promise<boolean> {
  try {
    const res = await fetch(`/api/push/subscribe?actorFamily=${family}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: subscriptionJson }),
    })
    if (!res.ok) return false
    const data = await res.json().catch(() => ({}))
    return data.ok === true
  } catch {
    return false
  }
}

/**
 * Suscripción física real tras un gesto explícito del usuario (botón
 * "Activar notificaciones", ya sea desde PermissionPrompt o desde la oferta
 * de reactivación M2) con `Notification.permission === "granted"` — nunca
 * llama `Notification.requestPermission()` (eso es responsabilidad del
 * caller, sólo cuando el permiso todavía es "default", CASE C de
 * P2-T40-R1 §3). Extraído sin cambios de comportamiento del bloque que ya
 * certificaron P2-T31-R3/R5A en PermissionPrompt — misma detección de key
 * VAPID stale, mismo rollback si el backend no confirma, para que Ajustes y
 * la nueva oferta post-login compartan EXACTAMENTE la misma lógica (nunca
 * dos implementaciones divergentes).
 */
export async function activatePushAfterGesture(family: PushReconciliationFamily): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready

    const vapidRes = await fetch("/api/push/vapid-key")
    const vapidData = vapidRes.ok ? await vapidRes.json().catch(() => ({})) : {}
    const publicKey = typeof vapidData.publicKey === "string" ? vapidData.publicKey : null
    if (!publicKey) return false

    const applicationServerKey = urlBase64ToUint8Array(publicKey)
    let subscription = await registration.pushManager.getSubscription()
    let createdSubscription = false

    if (subscription && !applicationServerKeyMatches(subscription.options.applicationServerKey, applicationServerKey)) {
      const removed = await unsubscribeStalePushSubscription(subscription, () =>
        registration.pushManager.getSubscription()
      )
      if (!removed) return false

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as BufferSource,
      })
      createdSubscription = true
    } else if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as BufferSource,
      })
      createdSubscription = true
    }

    const saved = await silentlyRebindCurrentOwner(family, JSON.stringify(subscription))
    if (!saved && createdSubscription) {
      await subscription.unsubscribe().catch(() => undefined)
    }
    return saved
  } catch (err) {
    console.error("Push activation error:", safeErrorForLog(err))
    return false
  }
}

export interface PushSessionReconciliationResult {
  /** Debe mostrarse, como máximo una vez, la oferta de reactivación M2. */
  shouldOfferReenable: boolean
}

export async function runPushSessionReconciliation(
  ownerType: PushReconciliationFamily,
  ownerId: string
): Promise<PushSessionReconciliationResult> {
  const permission =
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "default"
  const optedOut = hasPushManualOptOut(ownerType, ownerId)

  const subscriptionJson = permission === "granted" ? await getPhysicalPushSubscriptionJson() : null

  // Paso 1 — siempre, independiente del opt-out: limpiar cualquier fila
  // stale de un owner anterior en este mismo slot de sesión/family.
  const { newSession } = await reconcileStaleOwner(ownerType, subscriptionJson)

  if (optedOut) {
    // Nunca auto-rebind mientras el opt-out esté vigente. Sólo se ofrece
    // reactivar, y sólo una vez por sesión nueva.
    return { shouldOfferReenable: newSession }
  }

  if (permission === "granted" && subscriptionJson) {
    // Auto-rebind silencioso — idempotente, seguro de llamar aunque ya
    // exista la fila (upsert), nunca muestra ningún prompt nativo.
    await silentlyRebindCurrentOwner(ownerType, subscriptionJson)
  }

  return { shouldOfferReenable: false }
}
