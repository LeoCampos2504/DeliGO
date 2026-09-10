"use client"

import { useCallback, useEffect, useRef } from "react"

interface WakeLockSentinelLike {
  released: boolean
  release: () => Promise<void>
  addEventListener?: (type: "release", listener: () => void) => void
}

interface WakeLockNavigatorShape {
  wakeLock?: {
    request: (type: "screen") => Promise<WakeLockSentinelLike>
  }
}

/** Best-effort Screen Wake Lock lifecycle for an active, visible navigation. */
export function useScreenWakeLock(enabled: boolean): void {
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null)
  const requestInFlightRef = useRef<Promise<void> | null>(null)
  const activeRef = useRef(false)

  const release = useCallback(() => {
    const sentinel = sentinelRef.current
    sentinelRef.current = null
    if (!sentinel || sentinel.released) return
    void sentinel.release().catch(() => undefined)
  }, [])

  const request = useCallback(async () => {
    if (!enabled || document.visibilityState !== "visible" || sentinelRef.current) return
    const wakeLockNavigator = navigator as unknown as WakeLockNavigatorShape
    if (!("wakeLock" in navigator) || !wakeLockNavigator.wakeLock) return
    if (requestInFlightRef.current) return requestInFlightRef.current

    const requestPromise = wakeLockNavigator.wakeLock.request("screen")
      .then((sentinel) => {
        if (!activeRef.current || !enabled || document.visibilityState !== "visible") {
          void sentinel.release().catch(() => undefined)
          return
        }
        sentinelRef.current = sentinel
        sentinel.addEventListener?.("release", () => {
          if (sentinelRef.current === sentinel) sentinelRef.current = null
        })
      })
      .catch(() => undefined)
      .finally(() => {
        requestInFlightRef.current = null
      })

    requestInFlightRef.current = requestPromise
    return requestPromise
  }, [enabled])

  useEffect(() => {
    activeRef.current = enabled
    if (!enabled) {
      release()
      return
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void request()
      else release()
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    void request()
    return () => {
      activeRef.current = false
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      release()
    }
  }, [enabled, release, request])
}
