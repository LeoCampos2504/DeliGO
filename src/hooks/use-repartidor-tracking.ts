"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import { io, Socket } from "socket.io-client"

interface ActiveDelivery {
  id: string
  estado: string
}

type PermissionStatus = "unknown" | "granted" | "denied" | "prompting"

/**
 * Automatically sends GPS location to the server for real-time tracking.
 *
 * - Uses watchPosition for continuous real-time location updates
 * - Falls back to getCurrentPosition on interval if watchPosition fails
 * - Pauses when the tab is hidden (document.visibilityState)
 * - Provides permission status for UI feedback
 * - Emits location-update via Socket.IO for instant client updates
 * - Also persists via HTTP POST for polling fallback
 */
export function useRepartidorTracking(activeDeliveries: ActiveDelivery[]) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const deliveriesRef = useRef<ActiveDelivery[]>(activeDeliveries)
  const socketRef = useRef<Socket | null>(null)
  const userIdRef = useRef<string | null>(null)
  const lastHttpSendRef = useRef<number>(0)
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>("unknown")
  const [lastLocationTime, setLastLocationTime] = useState<Date | null>(null)

  // Keep the ref in sync so the interval callback always has fresh data
  useEffect(() => {
    deliveriesRef.current = activeDeliveries
  }, [activeDeliveries])

  // Check initial permission status
  useEffect(() => {
    if (!navigator.geolocation) {
      setPermissionStatus("denied")
      return
    }

    // Try to check permission via Permissions API
    if (navigator.permissions) {
      navigator.permissions.query({ name: "geolocation" }).then((result) => {
        if (result.state === "granted") {
          setPermissionStatus("granted")
        } else if (result.state === "denied") {
          setPermissionStatus("denied")
        } else {
          setPermissionStatus("unknown")
        }

        // Listen for permission changes
        result.addEventListener("change", () => {
          if (result.state === "granted") {
            setPermissionStatus("granted")
          } else if (result.state === "denied") {
            setPermissionStatus("denied")
          } else {
            setPermissionStatus("unknown")
          }
        })
      }).catch(() => {
        // Permissions API not available — status stays unknown
      })
    }
  }, [])

  // Connect to Socket.IO for real-time location broadcasting
  useEffect(() => {
    const enCamino = activeDeliveries.filter((d) => d.estado === "en_camino")

    if (enCamino.length === 0) {
      // No active deliveries — disconnect socket
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
      return
    }

    // Connect or reuse existing socket
    if (socketRef.current?.connected) return

    // Get user info from auth store (lazy import to avoid circular deps)
    import("@/store/auth-store").then(({ useAuthStore }) => {
      const user = useAuthStore.getState().user
      if (!user) return
      userIdRef.current = user.id

      const chatUrl = process.env.NODE_ENV === 'development'
        ? 'http://localhost:3003'
        : undefined

      const socket = io(chatUrl, {
        transports: ["websocket", "polling"],
        auth: {
          userId: user.id,
          userType: "repartidor",
          userName: user.nombre || "Repartidor",
        },
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        timeout: 10000,
      })

      socket.on("connect", () => {
        // Join rooms for all active deliveries
        const current = deliveriesRef.current.filter((d) => d.estado === "en_camino")
        current.forEach((d) => {
          socket.emit("join-room", d.id)
        })
      })

      socketRef.current = socket
    })

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
    }
  }, [activeDeliveries])

  // Join new rooms when deliveries change
  useEffect(() => {
    if (!socketRef.current?.connected) return
    const enCamino = activeDeliveries.filter((d) => d.estado === "en_camino")
    enCamino.forEach((d) => {
      socketRef.current?.emit("join-room", d.id)
    })
  }, [activeDeliveries])

  const sendLocation = useCallback(async (lat: number, lng: number) => {
    const deliveries = deliveriesRef.current.filter(
      (d) => d.estado === "en_camino"
    )

    if (deliveries.length === 0) return

    const timestamp = new Date().toISOString()
    setLastLocationTime(new Date())

    // 1. Send via HTTP (persists to DB for polling fallback) — throttle to every 3s
    const now = Date.now()
    if (now - lastHttpSendRef.current > 3000) {
      lastHttpSendRef.current = now

      Promise.allSettled(
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
    }

    // 2. Emit via Socket.IO for real-time client tracking (always, no throttle)
    if (socketRef.current?.connected) {
      deliveries.forEach((delivery) => {
        socketRef.current?.emit("location-update", {
          pedidoId: delivery.id,
          lat,
          lng,
          timestamp,
        })
      })
    }
  }, [])

  // Request geolocation permission explicitly — to be called from a user gesture
  const requestPermission = useCallback(() => {
    if (!navigator.geolocation) {
      setPermissionStatus("denied")
      return
    }

    setPermissionStatus("prompting")

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPermissionStatus("granted")
        // Send initial location immediately
        sendLocation(position.coords.latitude, position.coords.longitude)
      },
      (error) => {
        if (error.code === 1) {
          setPermissionStatus("denied")
        } else {
          setPermissionStatus("unknown")
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    )
  }, [sendLocation])

  // Start watchPosition for real-time tracking when permission is granted
  useEffect(() => {
    const enCamino = activeDeliveries.filter((d) => d.estado === "en_camino")

    // Clean up if no active deliveries
    if (enCamino.length === 0) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    // Only start tracking if permission is granted
    if (permissionStatus !== "granted") return

    // Use watchPosition for real-time continuous tracking
    if (watchIdRef.current === null && navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude: lat, longitude: lng } = position.coords
          // Only send when tab is visible
          if (document.visibilityState === "visible") {
            sendLocation(lat, lng)
          }
        },
        () => {
          // watchPosition failed — fall back to interval polling
          if (intervalRef.current === null) {
            const tick = () => {
              if (document.visibilityState !== "visible") return
              const hasActive = deliveriesRef.current.some(
                (d) => d.estado === "en_camino"
              )
              if (!hasActive) return
              if (!navigator.geolocation) return

              navigator.geolocation.getCurrentPosition(
                (position) => {
                  const { latitude: lat, longitude: lng } = position.coords
                  sendLocation(lat, lng)
                },
                () => {
                  // Silently skip
                },
                {
                  enableHighAccuracy: false,
                  timeout: 4000,
                  maximumAge: 3000,
                }
              )
            }
            tick()
            intervalRef.current = setInterval(tick, 5000)
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 2000,
        }
      )
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [activeDeliveries, permissionStatus, sendLocation])

  // Also auto-request permission when deliveries become active
  useEffect(() => {
    const enCamino = activeDeliveries.filter((d) => d.estado === "en_camino")
    if (enCamino.length > 0 && permissionStatus === "unknown") {
      // Auto-request — browsers may show the prompt on first geolocation call
      requestPermission()
    }
  }, [activeDeliveries, permissionStatus, requestPermission])

  const trackingActive = permissionStatus === "granted" && activeDeliveries.some(
    (d) => d.estado === "en_camino"
  )

  return {
    trackingActive,
    permissionStatus,
    lastLocationTime,
    requestPermission,
  }
}
