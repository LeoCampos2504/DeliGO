"use client"

import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react"
import { useAuthStore } from "@/store/auth-store"
import { RealtimeManager } from "@/lib/realtime-manager"
import type { RealtimeActorIdentity, RealtimeClient, RealtimeConnectionSnapshot, RealtimeUserType } from "@/lib/realtime-types"

export interface RealtimeContextValue {
  client: RealtimeClient
  snapshot: RealtimeConnectionSnapshot
}

export const RealtimeContext = createContext<RealtimeContextValue | null>(null)

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [manager] = useState(() => new RealtimeManager())
  const user = useAuthStore((state) => state.user)
  const actorId = user && user.type !== "superadmin" ? user.id : null
  const actorType: RealtimeUserType | null = user && user.type !== "superadmin" ? user.type : null
  const snapshot = useSyncExternalStore(
    (listener) => manager.subscribeState(listener),
    () => manager.getConnectionSnapshot(),
    () => manager.getConnectionSnapshot(),
  )

  useEffect(() => {
    const actor: RealtimeActorIdentity | null = actorId && actorType
      ? { userId: actorId, userType: actorType }
      : null
    manager.setActor(actor)
  }, [actorId, actorType, manager])

  useEffect(() => {
    const handleOnline = () => manager.handleOnline()
    const handleOffline = () => manager.handleOffline()
    const handleVisibility = () => manager.handleVisibilityChange(document.visibilityState === "visible")
    const handlePageShow = () => manager.handleVisibilityChange(true)
    const handlePageHide = () => manager.handleVisibilityChange(false)
    const handleFocus = () => manager.handleVisibilityChange(document.visibilityState === "visible")

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    window.addEventListener("pageshow", handlePageShow)
    window.addEventListener("pagehide", handlePageHide)
    window.addEventListener("focus", handleFocus)
    document.addEventListener("visibilitychange", handleVisibility)
    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
      window.removeEventListener("pageshow", handlePageShow)
      window.removeEventListener("pagehide", handlePageHide)
      window.removeEventListener("focus", handleFocus)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [manager])

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== "deligo-auth") return
      if (!event.newValue) return
      let parsed: unknown
      try {
        parsed = JSON.parse(event.newValue)
      } catch {
        return
      }
      const nextUser = (parsed as { state?: { user?: unknown } } | null)?.state?.user
      if (nextUser === null) {
        useAuthStore.getState().logout()
      }
    }

    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [])

  useEffect(() => () => manager.stop("provider-unmount"), [manager])

  const value = useMemo(() => ({ client: manager.getClient(), snapshot }), [manager, snapshot])
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
}

export function useRealtimeContext(): RealtimeContextValue {
  const context = useContext(RealtimeContext)
  if (!context) throw new Error("useRealtime must be used within RealtimeProvider")
  return context
}
