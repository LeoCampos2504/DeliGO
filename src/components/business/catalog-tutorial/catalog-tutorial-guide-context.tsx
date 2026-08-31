"use client"

// ============================================
// BUSINESS-CATALOG-INAPP-TUTORIAL-R3 §9 — contextual guide authority
// ============================================
// Small, dedicated React context tracking which real workflow AREA (if
// any) the contextual guide is currently pointing at. Deliberately not a
// generic event bus or a state machine over every possible input (task
// §9) — just: which guide is running, which target it's currently on,
// and which real <CatalogTutorialTarget> components are mounted right
// now (so a stale/impossible target can be detected without any DOM
// polling — see catalog-tutorial-target.tsx, which registers/unregisters
// itself on mount/unmount).
//
// Mounted once, above <ProductsTab> (business-panel.tsx) — never inside
// it — because ProductsTab's own subtab switch (Productos/Ingredientes/
// Agregados/Secciones/Opciones) is an early-return re-render, and the
// guide must survive a "Ir a Ingredientes" navigation that changes which
// of those branches renders.

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react"
import type { CatalogTutorialTargetKey } from "./catalog-tutorial-targets"

interface CatalogTutorialGuideContextValue {
  activeGuideId: string | null
  activeTargetKey: CatalogTutorialTargetKey | null
  isGuideActive: boolean
  isTargetMounted: (key: CatalogTutorialTargetKey) => boolean
  startGuide: (guideId: string, firstTargetKey: CatalogTutorialTargetKey) => void
  // Moves the active target ONLY when `guideId` is still the guide that's
  // running — this is what lets a host component (ProductsTab, an "add
  // X" section) report its own real state changes (form opened, real
  // Siguiente pressed) without risking clobbering a *different* guide
  // that might be active for a completely different area (task §23).
  advanceIfActive: (guideId: string, targetKey: CatalogTutorialTargetKey) => void
  stopGuide: () => void
  // Same "only if this guide is still the one running" guard as
  // advanceIfActive — for a form's own close/cancel handler to end its
  // guide without risking stopping a *different* guide that took over in
  // the meantime.
  stopGuideIfActive: (guideId: string) => void
  registerTarget: (key: CatalogTutorialTargetKey) => void
  unregisterTarget: (key: CatalogTutorialTargetKey) => void
  // task §21: "Volver al tutorial" must reopen the main Sheet at the
  // origin step — logic that only <CatalogTutorial> itself owns (its own
  // open/view/progress state). It registers its handler here on mount so
  // any coach card, wherever it's rendered, can trigger the same real
  // behavior without <CatalogTutorial> needing to be an ancestor of it.
  setReturnHandler: (handler: (() => void) | null) => void
  requestReturn: () => void
}

const CatalogTutorialGuideContext = createContext<CatalogTutorialGuideContextValue | null>(null)

export function CatalogTutorialGuideProvider({ children }: { children: React.ReactNode }) {
  const [activeGuideId, setActiveGuideId] = useState<string | null>(null)
  const [activeTargetKey, setActiveTargetKey] = useState<CatalogTutorialTargetKey | null>(null)
  // A Set mutated in place (never triggers its own render) — mount/unmount
  // registration must not cascade a render of every subscriber on every
  // unrelated target mounting. Only `isTargetMounted` reads it, and only
  // the small fallback-indicator consumer calls that per its own render.
  const mountedTargetsRef = useRef<Set<CatalogTutorialTargetKey>>(new Set())
  // Bumped on every register/unregister so isTargetMounted's callers
  // (namely the small fail-safe indicator) re-render when a target's
  // mount state actually changes — the Set itself is mutated in place and
  // wouldn't otherwise be a React dependency.
  const [mountedVersion, setMountedVersion] = useState(0)

  const startGuide = useCallback((guideId: string, firstTargetKey: CatalogTutorialTargetKey) => {
    setActiveGuideId(guideId)
    setActiveTargetKey(firstTargetKey)
  }, [])

  const advanceIfActive = useCallback((guideId: string, targetKey: CatalogTutorialTargetKey) => {
    setActiveGuideId((current) => {
      if (current !== guideId) return current
      setActiveTargetKey(targetKey)
      return current
    })
  }, [])

  const stopGuide = useCallback(() => {
    setActiveGuideId(null)
    setActiveTargetKey(null)
  }, [])

  const stopGuideIfActive = useCallback((guideId: string) => {
    setActiveGuideId((current) => {
      if (current !== guideId) return current
      setActiveTargetKey(null)
      return null
    })
  }, [])

  const registerTarget = useCallback((key: CatalogTutorialTargetKey) => {
    mountedTargetsRef.current.add(key)
    setMountedVersion((v) => v + 1)
  }, [])

  const unregisterTarget = useCallback((key: CatalogTutorialTargetKey) => {
    mountedTargetsRef.current.delete(key)
    setMountedVersion((v) => v + 1)
  }, [])

  const isTargetMounted = useCallback(
    (key: CatalogTutorialTargetKey) => mountedTargetsRef.current.has(key),
    [mountedVersion]
  )

  const returnHandlerRef = useRef<(() => void) | null>(null)
  const setReturnHandler = useCallback((handler: (() => void) | null) => {
    returnHandlerRef.current = handler
  }, [])
  const requestReturn = useCallback(() => {
    returnHandlerRef.current?.()
  }, [])

  const value = useMemo<CatalogTutorialGuideContextValue>(
    () => ({
      activeGuideId,
      activeTargetKey,
      isGuideActive: activeGuideId !== null,
      isTargetMounted,
      startGuide,
      advanceIfActive,
      stopGuide,
      stopGuideIfActive,
      registerTarget,
      unregisterTarget,
      setReturnHandler,
      requestReturn,
    }),
    [
      activeGuideId,
      activeTargetKey,
      isTargetMounted,
      startGuide,
      advanceIfActive,
      stopGuide,
      stopGuideIfActive,
      registerTarget,
      unregisterTarget,
      setReturnHandler,
      requestReturn,
    ]
  )

  return <CatalogTutorialGuideContext.Provider value={value}>{children}</CatalogTutorialGuideContext.Provider>
}

// Fails soft (a no-op authority) when no provider is mounted, rather than
// throwing — a target/coach rendered outside the provider (e.g. a future
// stray import) simply never highlights anything, instead of crashing the
// real business UI around it.
const NOOP_GUIDE: CatalogTutorialGuideContextValue = {
  activeGuideId: null,
  activeTargetKey: null,
  isGuideActive: false,
  isTargetMounted: () => false,
  startGuide: () => {},
  advanceIfActive: () => {},
  stopGuide: () => {},
  stopGuideIfActive: () => {},
  registerTarget: () => {},
  unregisterTarget: () => {},
  setReturnHandler: () => {},
  requestReturn: () => {},
}

export function useCatalogTutorialGuide(): CatalogTutorialGuideContextValue {
  return useContext(CatalogTutorialGuideContext) ?? NOOP_GUIDE
}
