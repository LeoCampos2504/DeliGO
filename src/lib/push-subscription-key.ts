export function urlBase64ToUint8Array(value: string): Uint8Array {
  const padding = "=".repeat((4 - (value.length % 4)) % 4)
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/")
  const rawData = globalThis.atob(base64)
  const output = new Uint8Array(rawData.length)

  for (let index = 0; index < rawData.length; index += 1) {
    output[index] = rawData.charCodeAt(index)
  }

  return output
}

/**
 * P2-T31-R3 (ANDROID-WEB-PUSH-DELIVERY-CROSS-ENV-AUDIT): compara la
 * `applicationServerKey` (VAPID public key) que un `PushSubscription` físico
 * ya existente registró en el browser contra la key vigente del servidor.
 *
 * Por qué esto importa: `SERVER_DETACH_ONLY` (P2-T05) nunca destruye la
 * subscription física al desactivar, y `subscribe()` reusa esa misma
 * subscription indefinidamente vía `PushManager.getSubscription()`. Si la
 * VAPID public key del servidor cambió DESPUÉS de que esa subscription se
 * creó (rotación de env vars, o el browser la creó contra otro despliegue),
 * el navegador sigue devolviendo la MISMA subscription física para
 * siempre — pero el proveedor Web Push la asociará permanentemente con la
 * key VIEJA. El servidor firma cada envío con la key NUEVA — el proveedor
 * rechaza el envío (reproducido en vivo contra TESTING: Apple respondió
 * `{"reason":"VapidPkHashMismatch"}`, statusCode 400) — y el switch de la UI
 * queda mostrando "activado" para siempre, sin que ningún push real vuelva a
 * llegar jamás, porque la subscription física reusada nunca puede volver a
 * ser válida por sí sola.
 *
 * `existing` es `PushSubscriptionOptions.applicationServerKey` tal cual lo
 * expone el browser (`ArrayBuffer | null`); `expected` es la key vigente ya
 * convertida vía `urlBase64ToUint8Array`. `null`/longitud distinta se tratan
 * como "no coincide" (fail-closed: nunca se asume compatibilidad sin poder
 * confirmarla byte a byte).
 */
export function applicationServerKeyMatches(existing: ArrayBuffer | null, expected: Uint8Array): boolean {
  if (!existing) return false
  const existingBytes = new Uint8Array(existing)
  if (existingBytes.length !== expected.length) return false
  for (let index = 0; index < expected.length; index += 1) {
    if (existingBytes[index] !== expected[index]) return false
  }
  return true
}

/**
 * P2-T31-R5A (PUSH-SUBSCRIPTION-FAILURE-CONTRACT-HARDENING): physically
 * removes a stale `PushSubscription` and CONFIRMS the removal actually took
 * effect, rather than trusting `PushSubscription.unsubscribe()`'s own
 * boolean return value alone.
 *
 * Why the boolean alone isn't enough: `unsubscribe()` resolving `false` is
 * ambiguous across browsers — it can mean "there was nothing to
 * unsubscribe" (not the case here, since the caller already holds a live
 * `existing` subscription) or "the operation itself did not succeed". A
 * call site that already confirmed a subscription is STALE (via
 * `applicationServerKeyMatches`) cannot safely tell these apart from the
 * boolean alone, and creating a brand-new subscription on top of one that
 * might still be physically present would leave the browser holding two
 * live subscriptions for no reason, or mask a genuine removal failure as
 * success.
 *
 * This resolves `true` only when BOTH conditions hold: `unsubscribe()`
 * itself resolved `true`, AND a fresh `getCurrentSubscription()` read
 * confirms no subscription remains (`null`). Any other outcome — the
 * `unsubscribe()` promise resolving `false`, rejecting, or a subscription
 * still being present afterwards — resolves `false` (fail-closed): the
 * caller must NOT proceed to create a replacement or report success in
 * that case.
 *
 * `existing`/`getCurrentSubscription` are narrow structural types (not the
 * full `PushSubscription`/`PushManager` DOM types) purely so this stays
 * unit-testable without a real browser — a real `PushSubscription` and
 * `() => registration.pushManager.getSubscription()` both satisfy them.
 */
export async function unsubscribeStalePushSubscription(
  existing: { unsubscribe(): Promise<boolean> },
  getCurrentSubscription: () => Promise<{ endpoint: string } | null>
): Promise<boolean> {
  const removed = await existing.unsubscribe()
  if (!removed) return false
  const stillPresent = await getCurrentSubscription()
  return stillPresent === null
}
