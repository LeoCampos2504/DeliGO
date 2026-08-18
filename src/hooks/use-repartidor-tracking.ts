"use client"

import { useEffect, useRef, useCallback } from "react"

interface ActiveDelivery {
  id: string
  estado: string
  repartidorId?: string | null
}

/**
 * Automatically sends GPS location to the server every 5 seconds
 * for all active deliveries (en_camino) that the repartidor has ACCEPTED.
 *
 * KEY: Only shares location for orders where repartidorId is set (accepted).
 * Pending available orders (no repartidorId) are NOT tracked.
 *
 * Server-authoritative producer: POST /api/repartidor/ubicacion persists the
 * location and publishes the realtime `tracking.location.updated` event
 * itself (see route.ts) — this hook no longer emits anything productively
 * over the shared realtime transport, so it holds no room lease.
 *
 * - Uses getCurrentPosition on an interval (battery-friendly)
 * - Pauses when the tab is hidden (document.visibilityState)
 * - Silently handles geolocation errors / denied permissions
 */
export function useRepartidorTracking(activeDeliveries: ActiveDelivery[]) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const deliveriesRef = useRef<ActiveDelivery[]>(activeDeliveries)

  // Keep the ref in sync so the interval callback always has fresh data
  useEffect(() => {
    deliveriesRef.current = activeDeliveries
  }, [activeDeliveries])

  const sendLocation = useCallback(async (lat: number, lng: number) => {
    // Only send location for accepted deliveries (repartidorId is set)
    const deliveries = deliveriesRef.current.filter(
      (d) => d.estado === "en_camino" && d.repartidorId
    )

    // Persists to DB and publishes the realtime update server-side.
    await Promise.allSettled(
      deliveries.map(async (delivery) => {
        try {
          const res = await fetch("/api/repartidor/ubicacion", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pedidoId: delivery.id, lat, lng }),
          })
          if (!res.ok) {
            // Silently ignore — we'll retry next interval
          }
        } catch {
          // Network error — silently skip
        }
      })
    )
  }, [])

  const tick = useCallback(() => {
    // Don't send if tab is hidden
    if (document.visibilityState !== "visible") return

    const hasActive = deliveriesRef.current.some(
      (d) => d.estado === "en_camino" && d.repartidorId
    )
    if (!hasActive) return

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
    const enCamino = activeDeliveries.filter(
      (d) => d.estado === "en_camino" && d.repartidorId
    )

    if (enCamino.length > 0 && !intervalRef.current) {
      tick()
      intervalRef.current = setInterval(tick, 5000)
    }

    if (enCamino.length === 0 && intervalRef.current) {
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

  const trackingActive = activeDeliveries.some(
    (d) => d.estado === "en_camino" && d.repartidorId
  )

  return { trackingActive }
}
