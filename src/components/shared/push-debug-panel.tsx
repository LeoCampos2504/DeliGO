"use client"

// P2-T31-R6 (INTERMITTENT-IPHONE-PUSH-LIFECYCLE-DIAGNOSTIC): TESTING-only
// diagnostic panel, invisible by default. Nothing renders — not even a
// discreet entry link — unless the server confirms (`GET
// /api/push/debug-guard`) this is Railway TESTING — see
// push-testing-guard.ts. Production returns a plain 404 for that route, so
// nothing about this surface's existence is discoverable there.
//
// P2-T31-R6B (STANDALONE-PWA-DEBUG-ACCESS-AND-COLD-BOOTSTRAP): an iPhone
// Home-Screen PWA has no address bar to edit — physical certification can't
// depend on Leonardo typing `?pushDebug=1`. The guard check now runs
// UNCONDITIONALLY on mount (this component only ever mounts inside
// Perfil/Configuración, not globally), and once it confirms TESTING, a
// discreet "Diagnóstico Push (TESTING)" entry is shown — tapping it opens
// the full panel, no URL editing required. `?pushDebug=1` still works as an
// alternate auto-open shortcut (developer convenience), but is no longer
// required for physical use.
//
// P2-T31-R6A (PUSH-LIFECYCLE-TIMELINE-DIAGNOSTIC): extends the R6 snapshot
// with a chronological TIMELINE (push-debug-trace.ts) and ARMAR/DESARMAR/
// BORRAR controls. The timeline's passive recording (recordPushDebugEvent
// calls sprinkled through the real lifecycle code) is gated by its OWN
// "armed" flag, independent of this panel's guard above — arming here only
// ever happens after the guard already confirmed TESTING.
//
// Purely a READ surface: it calls the exact same real endpoints
// (`/api/push/vapid-key`, `/api/push/status`) the real hook uses, but never
// calls `subscribe()`/`unsubscribe()`/`PushManager.subscribe()` — it cannot
// create, change, or remove any subscription, physical or server-side.
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/store/auth-store"
import {
  collectPushDebugSnapshot,
  formatPushDebugSnapshot,
  type PushDebugSnapshot,
} from "@/lib/push-debug-snapshot"
import { applicationServerKeyMatches, urlBase64ToUint8Array } from "@/lib/push-subscription-key"
import { hasInFlightPersonalPushMutationForDebug } from "@/hooks/push-mutation-in-flight-registry"
import {
  armPushDebugTrace,
  buildFullPushDebugDiagnosticText,
  clearPushDebugTraceHistory,
  disarmPushDebugTrace,
  formatPushDebugTraceEvent,
  getPushDebugTraceEvents,
  getPushDebugTraceMeta,
  isPushDebugTraceArmed,
} from "@/lib/push-debug-trace"

export interface PushDebugPanelProps {
  actorFamily: "cliente" | "negocio" | "repartidor"
  hookIsSubscribed: boolean
  hookLoading: boolean
  uiSwitch: boolean
}

export function PushDebugPanel({ actorFamily, hookIsSubscribed, hookLoading, uiSwitch }: PushDebugPanelProps) {
  // P2-T31-R6B: the guard is the ONLY thing gating visibility now — it runs
  // on every mount of this component (Perfil/Configuración only, not
  // site-wide), independent of any query param. Defaults to false
  // (fail-closed) until the server explicitly confirms TESTING.
  const [allowed, setAllowed] = useState(false)
  // `?pushDebug=1` remains a legacy alternate path that auto-opens the panel
  // — never required (QUERY_PARAM_REQUIRED_FOR_PHYSICAL_USE=NO), useful for
  // local/desktop debugging where editing the URL is trivial.
  const [panelOpen, setPanelOpen] = useState(false)
  const [snapshot, setSnapshot] = useState<PushDebugSnapshot | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  // Bumped after every arm/disarm/clear action to force a fresh read of the
  // trace module's own state (armed flag, events, meta) — that state lives
  // outside React, so a plain re-render trigger is all this needs.
  const [, setTraceVersion] = useState(0)
  const authUserId = useAuthStore((s) => s.user?.id ?? null)
  const authHasHydrated = useAuthStore((s) => s._hasHydrated)

  useEffect(() => {
    let cancelled = false
    fetch("/api/push/debug-guard")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setAllowed(data?.allowed === true)
      })
      .catch(() => {
        if (!cancelled) setAllowed(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (new URLSearchParams(window.location.search).get("pushDebug") === "1") {
      setPanelOpen(true)
    }
  }, [])

  // Invisible unless the server confirms TESTING — no entry, no button, no
  // residual empty space. This is the ONLY gate; `panelOpen` below only
  // decides entry-vs-full-panel, never visibility itself.
  if (!allowed) return null

  const actorKey = authUserId ? `${actorFamily}:${authUserId}` : null
  const traceMeta = getPushDebugTraceMeta()
  const traceEvents = getPushDebugTraceEvents()
  const armed = isPushDebugTraceArmed()

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const result = await collectPushDebugSnapshot({
        now: () => new Date().toISOString(),
        actorFamily: actorKey,
        authHasHydrated,
        pathname: window.location.pathname,
        visibilityState: document.visibilityState,
        permission: "Notification" in window ? Notification.permission : "unsupported",
        serviceWorkerSupported: "serviceWorker" in navigator,
        pushManagerSupported: "PushManager" in window,
        getRegistrationInfo: async () => {
          const registration = await navigator.serviceWorker.getRegistration()
          if (!registration) return { exists: false, activeState: null }
          return { exists: true, activeState: registration.active?.state ?? null }
        },
        getCurrentSubscription: async () => {
          const registration = await navigator.serviceWorker.ready
          return registration.pushManager.getSubscription()
        },
        fetchVapidKey: async () => {
          const res = await fetch("/api/push/vapid-key")
          if (!res.ok) return null
          const data = await res.json().catch(() => ({}))
          return typeof data.publicKey === "string" ? data.publicKey : null
        },
        applicationServerKeyMatches: (existing, expectedKey) =>
          applicationServerKeyMatches(existing, urlBase64ToUint8Array(expectedKey)),
        fetchBackendStatus: async (subscriptionJson) => {
          const statusUrl = `/api/push/status?actorFamily=${actorFamily}`
          const res = await fetch(statusUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subscription: subscriptionJson }),
          })
          const data = await res.json().catch(() => ({}))
          return { httpStatus: res.status, subscribed: data.subscribed === true }
        },
        mutationInFlight: hasInFlightPersonalPushMutationForDebug(actorKey),
        hookIsSubscribed,
        hookLoading,
        uiSwitch,
      })
      setSnapshot(result)
    } finally {
      setRefreshing(false)
      setTraceVersion((v) => v + 1)
    }
  }

  const handleCopy = async () => {
    if (!snapshot) return
    try {
      const text = buildFullPushDebugDiagnosticText(formatPushDebugSnapshot(snapshot), traceMeta, traceEvents)
      await navigator.clipboard.writeText(text)
      toast.success("Diagnóstico completo copiado")
    } catch {
      toast.error("No se pudo copiar el diagnóstico")
    }
  }

  const handleArm = () => {
    armPushDebugTrace()
    setTraceVersion((v) => v + 1)
  }

  const handleDisarm = () => {
    disarmPushDebugTrace()
    setTraceVersion((v) => v + 1)
  }

  const handleClearHistory = () => {
    clearPushDebugTraceHistory()
    setTraceVersion((v) => v + 1)
  }

  // P2-T31-R6B: discreet entry point — a normal-looking row Leonardo can tap
  // from the installed PWA, no URL editing. Only reachable at all once
  // `allowed` is true (server-confirmed TESTING), same as the full panel.
  if (!panelOpen) {
    return (
      <button
        type="button"
        onClick={() => setPanelOpen(true)}
        className="mt-3 text-xs text-amber-700 dark:text-amber-400 underline underline-offset-2"
      >
        Diagnóstico Push (TESTING)
      </button>
    )
  }

  return (
    <div className="mt-3 rounded-xl border border-dashed border-amber-400 bg-amber-50 dark:bg-amber-950/20 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
          Diagnóstico Push (solo TESTING)
        </p>
        <button
          type="button"
          onClick={() => setPanelOpen(false)}
          className="text-xs text-amber-700 dark:text-amber-400 underline underline-offset-2"
        >
          cerrar
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={handleRefresh} disabled={refreshing}>
          {refreshing ? "Actualizando..." : "ACTUALIZAR ESTADO"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={handleCopy} disabled={!snapshot}>
          COPIAR DIAGNÓSTICO COMPLETO
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={handleClearHistory} disabled={traceMeta.eventCount === 0}>
          BORRAR HISTORIAL
        </Button>
        {armed ? (
          <Button type="button" size="sm" variant="outline" onClick={handleDisarm}>
            DESARMAR TRAZA
          </Button>
        ) : (
          <Button type="button" size="sm" variant="outline" onClick={handleArm}>
            ARMAR TRAZA
          </Button>
        )}
      </div>

      <div>
        <p className="text-xs font-medium text-amber-700 dark:text-amber-400">ESTADO ACTUAL</p>
        {snapshot ? (
          <pre className="text-[10px] leading-tight whitespace-pre-wrap break-all bg-background/60 rounded-md p-2 max-h-64 overflow-auto">
            {formatPushDebugSnapshot(snapshot)}
          </pre>
        ) : (
          <p className="text-[10px] text-muted-foreground">Sin snapshot todavía — tocá ACTUALIZAR ESTADO.</p>
        )}
      </div>

      <div>
        <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
          TIMELINE ({traceMeta.eventCount} eventos, más antiguo primero) —{" "}
          {armed ? "traza ARMADA" : "traza DESARMADA"}
        </p>
        {traceEvents.length > 0 ? (
          <pre className="text-[10px] leading-tight whitespace-pre-wrap break-all bg-background/60 rounded-md p-2 max-h-64 overflow-auto">
            {traceEvents.map(formatPushDebugTraceEvent).join("\n")}
          </pre>
        ) : (
          <p className="text-[10px] text-muted-foreground">
            {armed ? "Sin eventos todavía." : "Traza desarmada — tocá ARMAR TRAZA para empezar a registrar."}
          </p>
        )}
      </div>
    </div>
  )
}
