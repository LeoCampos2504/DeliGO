"use client"

import { useEffect, useRef, useCallback } from "react"
import { io, Socket } from "socket.io-client"
import { authorizeRealtimeRoom, fetchRealtimeToken, getRealtimeSocketUrl } from "@/lib/realtime-client"

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
 * Also broadcasts via Socket.IO for real-time client tracking.
 *
 * - Uses getCurrentPosition on an interval (battery-friendly)
 * - Pauses when the tab is hidden (document.visibilityState)
 * - Silently handles geolocation errors / denied permissions
 * - Emits location-update via Socket.IO for instant client updates
 */
export function useRepartidorTracking(activeDeliveries: ActiveDelivery[]) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const deliveriesRef = useRef<ActiveDelivery[]>(activeDeliveries)
  const socketRef = useRef<Socket | null>(null)
  const userIdRef = useRef<string | null>(null)
  const authorizedDeliveryIdsRef = useRef<Set<string>>(new Set())

  // Keep the ref in sync so the interval callback always has fresh data
  useEffect(() => {
    deliveriesRef.current = activeDeliveries
  }, [activeDeliveries])

  // Connect to Socket.IO for real-time location broadcasting
  // ONLY for accepted deliveries (repartidorId is set)
  useEffect(() => {
    const enCamino = activeDeliveries.filter(
      (d) => d.estado === "en_camino" && d.repartidorId
    )

    if (enCamino.length === 0) {
      // No accepted deliveries — disconnect socket
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
      return
    }

    // Connect or reuse existing socket
    if (socketRef.current?.connected) return

    let cancelled = false

    // Get user info from auth store (lazy import to avoid circular deps)
    import("@/store/auth-store").then(({ useAuthStore }) => {
      const user = useAuthStore.getState().user
      if (!user) return
      userIdRef.current = user.id

      const connect = async () => {
        try {
          const token = await fetchRealtimeToken()
          if (cancelled) return
          const socket = io(getRealtimeSocketUrl(), {
            transports: ["websocket", "polling"],
            path: "/socket.io",
            auth: { token },
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            timeout: 10000,
          })

          const authorizeDelivery = (deliveryId: string) => {
            void authorizeRealtimeRoom(deliveryId, ["tracking:publish"])
              .then((capability) => {
                if (cancelled || !socket.connected) return
                socket.emit("join-order-room", capability, (ack: { ok?: boolean }) => {
                  if (ack?.ok) authorizedDeliveryIdsRef.current.add(deliveryId)
                })
              })
              .catch(() => {
                authorizedDeliveryIdsRef.current.delete(deliveryId)
              })
          }

          socket.on("connect", () => {
            authorizedDeliveryIdsRef.current.clear()
            const current = deliveriesRef.current.filter(
              (d) => d.estado === "en_camino" && d.repartidorId
            )
            current.forEach((d) => authorizeDelivery(d.id))
          })

          socket.on("disconnect", () => {
            authorizedDeliveryIdsRef.current.clear()
          })

          socketRef.current = socket
        } catch {
          // HTTP GPS persistence remains unchanged in this foundation phase.
        }
      }

      void connect()
    })

    return () => {
      cancelled = true
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
      authorizedDeliveryIdsRef.current.clear()
    }
  }, [activeDeliveries])

  // Join new rooms when accepted deliveries change
  useEffect(() => {
    if (!socketRef.current?.connected) return
    const enCamino = activeDeliveries.filter(
      (d) => d.estado === "en_camino" && d.repartidorId
    )
    enCamino.forEach((d) => {
      void authorizeRealtimeRoom(d.id, ["tracking:publish"])
        .then((capability) => {
          if (!socketRef.current?.connected) return
          socketRef.current.emit("join-order-room", capability, (ack: { ok?: boolean }) => {
            if (ack?.ok) authorizedDeliveryIdsRef.current.add(d.id)
          })
        })
        .catch(() => authorizedDeliveryIdsRef.current.delete(d.id))
    })
  }, [activeDeliveries])

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

    // 2. Emit via Socket.IO for real-time client tracking
    if (socketRef.current?.connected) {
        deliveries.filter((delivery) => authorizedDeliveryIdsRef.current.has(delivery.id)).forEach((delivery) => {
          socketRef.current?.emit("location-update", {
          pedidoId: delivery.id,
          lat,
          lng,
          timestamp,
        })
      })
    }
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
