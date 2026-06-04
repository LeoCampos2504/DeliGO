"use client"

import { useEffect, useRef } from "react"
import { useAuthStore } from "@/store/auth-store"
import { useQueryClient } from "@tanstack/react-query"

/**
 * Hook that periodically checks if the authenticated negocio has been
 * suspended or reactivated by a superadmin (real-time detection).
 * Only active when the authenticated user is a negocio.
 */
export function useSuspensionCheck() {
  const user = useAuthStore((s) => s.user)
  const setSuspendido = useAuthStore((s) => s.setSuspendido)
  const queryClient = useQueryClient()
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Only run for authenticated negocios
    if (!user || user.type !== "negocio") return

    const checkSuspension = async () => {
      try {
        const res = await fetch("/api/auth/me")
        if (!res.ok) return

        const data = await res.json()
        if (!data.ok || !data.user) return

        const serverSuspendido = data.user.suspendido ?? false
        const localSuspendido = user.suspendido ?? false

        // If suspension status changed on server
        if (serverSuspendido !== localSuspendido) {
          setSuspendido(serverSuspendido)
          queryClient.invalidateQueries({ queryKey: ["negocio-profile"] })

          if (serverSuspendido) {
            // Business was suspended while logged in
          } else {
            // Business was reactivated
          }
        }
      } catch {
        // Silently fail
      }
    }

    // Check every 30 seconds
    intervalRef.current = setInterval(checkSuspension, 30_000)

    // Also check immediately
    checkSuspension()

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [user, setSuspendido, queryClient])
}
