"use client"

import { useEffect, useRef, useCallback } from "react"

interface ActiveDelivery {
  id: string
  estado: string
  repartidorId?: string | null
  // P2-T01: eligibilidad resuelta server-side con la misma política central
  // (isTrackingCoreEligible) que GET tracking y realtime authorize —
  // snapshot inmutable del pedido AND flag vivo del negocio AND
  // estado/metodoEntrega. Ausente o false => este hook nunca produce GPS
  // para ese pedido, sin importar estado/repartidorId locales.
  trackingEligibleNow?: boolean
}

// Condición base compartida por las 3 decisiones que este hook debe tomar
// (iniciar productor, tick, deliveries objetivo de sendLocation — P2-T01
// sección 16): elegible server-side, no marcada localmente como ineligible
// por un rechazo/error previo, y sin un POST de ubicación ya en vuelo para
// ese mismo pedido.
function isLocallyEligible(
  delivery: ActiveDelivery,
  knownIneligible: Set<string>,
  pendingLocationRequests: Set<string>
): boolean {
  return (
    delivery.estado === "en_camino" &&
    Boolean(delivery.repartidorId) &&
    delivery.trackingEligibleNow === true &&
    !knownIneligible.has(delivery.id) &&
    !pendingLocationRequests.has(delivery.id)
  )
}

/**
 * Automatically sends GPS location to the server every 5 seconds
 * for all active deliveries (en_camino) that the repartidor has ACCEPTED
 * AND that the server has confirmed as tracking-eligible right now
 * (trackingEligibleNow — P2-T01 core eligibility: immutable pedido snapshot
 * AND live negocio flag AND estado/metodoEntrega).
 *
 * Server-authoritative producer: POST /api/repartidor/ubicacion persists the
 * location and publishes the realtime `tracking.location.updated` event
 * itself (see route.ts) — this hook no longer emits anything productively
 * over the shared realtime transport, so it holds no room lease.
 *
 * P2-T01 Stage 1B in-flight guard: `tick()` does not await `sendLocation()`
 * before the next setInterval fire, so local privacy suppression cannot
 * depend on network latency alone. `knownIneligibleRef` remembers any
 * pedido whose last POST was rejected (any non-2xx) or failed at the
 * transport level, until a fresh, successful "mios" reports
 * trackingEligibleNow again. `pendingLocationRequestsRef` prevents starting
 * a new GPS acquisition/POST for a pedido whose previous one hasn't
 * resolved yet.
 *
 * - Uses getCurrentPosition on an interval (battery-friendly)
 * - Pauses when the tab is hidden (document.visibilityState)
 * - Silently handles geolocation errors / denied permissions
 */
export function useRepartidorTracking(activeDeliveries: ActiveDelivery[]) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const deliveriesRef = useRef<ActiveDelivery[]>(activeDeliveries)
  const knownIneligibleRef = useRef<Set<string>>(new Set())
  const pendingLocationRequestsRef = useRef<Set<string>>(new Set())

  // Keep the ref in sync so the interval callback always has fresh data.
  useEffect(() => {
    deliveriesRef.current = activeDeliveries
    // A fresh, successful "mios" reporting trackingEligibleNow===true is the
    // only thing that can clear a previously-known-ineligible pedido — a
    // false/absent flag must never be treated as eligible even once the Set
    // no longer contains it (P2-T01 section 17).
    for (const delivery of activeDeliveries) {
      if (delivery.trackingEligibleNow === true) {
        knownIneligibleRef.current.delete(delivery.id)
      }
    }
  }, [activeDeliveries])

  const sendLocation = useCallback(async (lat: number, lng: number) => {
    // Re-filter against CURRENT refs at the moment GPS actually resolved —
    // a delivery removed/changed while GPS was in flight must never POST.
    const deliveries = deliveriesRef.current.filter((d) =>
      isLocallyEligible(d, knownIneligibleRef.current, pendingLocationRequestsRef.current)
    )

    await Promise.allSettled(
      deliveries.map(async (delivery) => {
        pendingLocationRequestsRef.current.add(delivery.id)
        try {
          const res = await fetch("/api/repartidor/ubicacion", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pedidoId: delivery.id, lat, lng }),
          })
          if (!res.ok) {
            // Any non-2xx — the early tracking-disabled gate (400) and the
            // atomic zero-row race fallback (403) are both status/transport
            // outcomes only, never parsed from response text (P2-T01 Stage
            // 1B correction #2, generalized).
            knownIneligibleRef.current.add(delivery.id)
          }
        } catch {
          // Network error / abort — fail-closed exactly like a non-2xx: if
          // connectivity isn't even enough to confirm this pedido's server
          // authority, there's no point re-acquiring GPS for it every tick
          // until a fresh "mios" can reconcile it.
          knownIneligibleRef.current.add(delivery.id)
        } finally {
          pendingLocationRequestsRef.current.delete(delivery.id)
        }
      })
    )
  }, [])

  const tick = useCallback(() => {
    // Don't send if tab is hidden
    if (document.visibilityState !== "visible") return

    const hasEligible = deliveriesRef.current.some((d) =>
      isLocallyEligible(d, knownIneligibleRef.current, pendingLocationRequestsRef.current)
    )
    if (!hasEligible) return

    if (!navigator.geolocation) return

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude: lat, longitude: lng } = position.coords
        sendLocation(lat, lng)
      },
      () => {
        // Permission denied, position unavailable, timeout — silently skip
      },
      {
        enableHighAccuracy: false,
        timeout: 4000,
        maximumAge: 3000,
      }
    )
  }, [sendLocation])

  useEffect(() => {
    const hasEligible = activeDeliveries.some((d) =>
      isLocallyEligible(d, knownIneligibleRef.current, pendingLocationRequestsRef.current)
    )

    if (hasEligible && !intervalRef.current) {
      tick()
      intervalRef.current = setInterval(tick, 5000)
    }

    if (!hasEligible && intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [activeDeliveries, tick])

  const trackingActive = activeDeliveries.some((d) =>
    isLocallyEligible(d, knownIneligibleRef.current, pendingLocationRequestsRef.current)
  )

  return { trackingActive }
}
