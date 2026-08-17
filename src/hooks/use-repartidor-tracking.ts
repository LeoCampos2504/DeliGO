"use client"

import { useEffect, useRef, useCallback, useMemo } from "react"
import { useRealtime } from "@/hooks/use-realtime"
import type { RealtimeRoomLease } from "@/lib/realtime-types"

interface ActiveDelivery {
  id: string
  estado: string
  repartidorId?: string | null
}

// Bounded backoff for retrying a failed tracking:publish lease acquisition
// (e.g. a transient network/authorize blip) without polling on every render.
// Mirrors RealtimeManager's own capability-refresh retry bounds.
const LEASE_RETRY_BASE_MS = 1000
const LEASE_RETRY_MAX_MS = 30000

/**
 * Automatically sends GPS location to the server every 5 seconds
 * for all active deliveries (en_camino) that the repartidor has ACCEPTED.
 *
 * KEY: Only shares location for orders where repartidorId is set (accepted).
 * Pending available orders (no repartidorId) are NOT tracked.
 *
 * Broadcasts via the shared realtime transport (RealtimeManager) for
 * real-time client tracking — no socket is owned by this hook.
 *
 * - Uses getCurrentPosition on an interval (battery-friendly)
 * - Pauses when the tab is hidden (document.visibilityState)
 * - Silently handles geolocation errors / denied permissions
 * - Publishes location via a shared tracking:publish room lease per pedido
 */
export function useRepartidorTracking(activeDeliveries: ActiveDelivery[]) {
  const { client } = useRealtime()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const deliveriesRef = useRef<ActiveDelivery[]>(activeDeliveries)
  const leasesRef = useRef<Map<string, RealtimeRoomLease>>(new Map())

  // Keep the ref in sync so the interval callback always has fresh data
  useEffect(() => {
    deliveriesRef.current = activeDeliveries
  }, [activeDeliveries])

  // Stable key for the current set of accepted en_camino delivery ids.
  // activeDeliveries gets a new array reference on every polling refetch
  // even when its content is unchanged; keying the lease effect on this
  // content-derived string (rather than the raw array) avoids re-acquiring
  // a shared room lease for a pedido that is already held.
  const enCaminoKey = useMemo(() => {
    return activeDeliveries
      .filter((d) => d.estado === "en_camino" && d.repartidorId)
      .map((d) => d.id)
      .sort()
      .join(",")
  }, [activeDeliveries])

  // Acquire/release shared tracking:publish room leases to match the
  // current set of accepted deliveries. RealtimeManager owns the socket,
  // token, and capability — no raw socket is created here.
  //
  // A failed acquisition (e.g. a transient network/authorize blip) is
  // retried with bounded backoff instead of being left dead: this effect
  // only re-runs when the *set* of accepted delivery ids changes, so
  // without this retry a failure would never be revisited until an
  // unrelated delivery is accepted or completed.
  useEffect(() => {
    const currentIds = new Set(
      deliveriesRef.current
        .filter((d) => d.estado === "en_camino" && d.repartidorId)
        .map((d) => d.id)
    )

    for (const [id, lease] of [...leasesRef.current]) {
      if (!currentIds.has(id)) {
        lease.release()
        leasesRef.current.delete(id)
      }
    }

    let cancelled = false
    const controller = new AbortController()
    const retryTimers = new Set<ReturnType<typeof setTimeout>>()

    const isStillWanted = (id: string) =>
      deliveriesRef.current.some(
        (d) => d.id === id && d.estado === "en_camino" && d.repartidorId
      )

    const acquire = (id: string, attempt: number) => {
      void client.acquireOrderRoom(id, ["tracking:publish"], { signal: controller.signal })
        .then((lease) => {
          if (cancelled || !isStillWanted(id)) {
            lease.release()
            return
          }
          leasesRef.current.set(id, lease)
        })
        .catch(() => {
          if (cancelled || leasesRef.current.has(id) || !isStillWanted(id)) return
          const delay = Math.min(LEASE_RETRY_MAX_MS, LEASE_RETRY_BASE_MS * 2 ** attempt)
          const timer = setTimeout(() => {
            retryTimers.delete(timer)
            if (cancelled) return
            acquire(id, attempt + 1)
          }, delay)
          retryTimers.add(timer)
        })
    }

    for (const id of currentIds) {
      if (leasesRef.current.has(id)) continue
      acquire(id, 0)
    }

    return () => {
      cancelled = true
      controller.abort()
      for (const timer of retryTimers) clearTimeout(timer)
      retryTimers.clear()
    }
  }, [enCaminoKey, client])

  // Release every held lease on unmount (tab switch, navigation, etc.)
  useEffect(() => {
    return () => {
      for (const lease of leasesRef.current.values()) lease.release()
      leasesRef.current.clear()
    }
  }, [client])

  const sendLocation = useCallback(async (lat: number, lng: number) => {
    // Only send location for accepted deliveries (repartidorId is set)
    const deliveries = deliveriesRef.current.filter(
      (d) => d.estado === "en_camino" && d.repartidorId
    )

    const timestamp = new Date().toISOString()

    // 1. Send via HTTP (persists to DB for polling fallback)
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

    // 2. Publish via the shared realtime transport for instant client updates
    deliveries
      .filter((delivery) => leasesRef.current.has(delivery.id))
      .forEach((delivery) => {
        client.sendTrackingLocation(delivery.id, { lat, lng, timestamp })
      })
  }, [client])

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
