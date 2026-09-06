"use client"

// P2-T31-R6B (STANDALONE-PWA-DEBUG-ACCESS-AND-COLD-BOOTSTRAP): mounted once
// per role layout (Cliente/Negocio/Repartidor — see the three `layout.tsx`
// files), which are part of the EAGERLY-loaded route bundle for `/cliente`,
// `/negocio`, `/repartidor` (the exact `start_url` each PWA manifest opens
// to on a cold Home-Screen launch). This is deliberately NOT placed inside
// Perfil/Configuración: those panels are `dynamic()`-imported and only ever
// load once the user taps that tab — by then, a cold-launch race (auth
// hydration, the first paint's actual auth state) may have already resolved
// with nothing watching. Mounting here instead means `push-debug-trace.ts`
// (and, if a previous TESTING session already armed it, actual recording)
// starts from the very first render of the app shell, not from the first
// tap into Perfil.
//
// Read-only/observational, always renders null:
//   - never calls subscribe/unsubscribe/status;
//   - never awaits or delays auth;
//   - never mutates auth state or actor identity;
//   - never fetches anything Push-related;
//   - never writes to any backend;
//   - never renders any UI (business or otherwise).
//
// Safe to mount unconditionally in every environment (Production included):
// `recordPushDebugEvent`/`isPushDebugTraceArmed` are already no-ops unless a
// previous confirmed-TESTING session explicitly armed tracing on this exact
// origin (see push-debug-trace.ts) — mounting this component changes no
// visible behavior anywhere (`USER_VISIBLE_PRODUCTION_BEHAVIOR_CHANGED=NO`).
import { useEffect, useRef } from "react"
import { useAuthStore } from "@/store/auth-store"
import { isPushDebugTraceArmed, recordPushDebugEvent, setPushDebugTraceContext } from "@/lib/push-debug-trace"

export function PushDebugTraceBootstrap() {
  const actorType = useAuthStore((s) => s.user?.type ?? null)
  const authHasHydrated = useAuthStore((s) => s._hasHydrated)
  const hasObservedInitialRef = useRef(false)
  const wasHydratedRef = useRef(false)

  useEffect(() => {
    // Cheap no-op for every real user outside an active TESTING diagnostic
    // session — a single boolean check, no context write, no event push.
    if (!isPushDebugTraceArmed()) return

    setPushDebugTraceContext({ actorFamily: actorType, authHasHydrated })

    if (!hasObservedInitialRef.current) {
      hasObservedInitialRef.current = true
      recordPushDebugEvent("AUTH_STATE_OBSERVED", { actorFamily: actorType, authHasHydrated, source: "bootstrap" })
    }

    if (authHasHydrated && !wasHydratedRef.current) {
      wasHydratedRef.current = true
      recordPushDebugEvent("AUTH_HYDRATED", { actorFamily: actorType, source: "bootstrap" })
    }
  }, [actorType, authHasHydrated])

  return null
}
