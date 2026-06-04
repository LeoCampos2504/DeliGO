"use client"

import { useSyncExternalStore } from "react"

// A no-op subscribe function since hydration state never changes after initial render
const emptySubscribe = () => () => {}

/**
 * Returns true only on the client after hydration.
 * Uses useSyncExternalStore with different server/client snapshots
 * to prevent hydration mismatches with Zustand persist stores.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,   // client snapshot: always hydrated
    () => false   // server snapshot: never hydrated
  )
}
