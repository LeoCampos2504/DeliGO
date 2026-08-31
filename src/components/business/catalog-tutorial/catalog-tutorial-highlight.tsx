"use client"

// ============================================
// BUSINESS-CATALOG-INAPP-TUTORIAL-R2 §5-15 — visual field highlighting
// ============================================
// Impure DOM-query shell + presentational overlay for "Mostrarme". The
// target lookup (`document.querySelector('[data-catalog-tutorial-target]')`)
// is used ONLY for visual discovery — scrollIntoView + bounding-rect
// measurement — never to click, submit, focus, or mutate anything (task
// §7). The highlight itself is a separate, `pointer-events: none`,
// portaled overlay positioned over the real field — the field's own DOM
// node and className are never touched, so React's own reconciliation of
// that element can never conflict with this.

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { buildTargetSelector, type CatalogTutorialTargetKey } from "./catalog-tutorial-targets"

// Bounded mount-wait: up to this many animation frames (~a few hundred ms
// at 60fps) waiting for a just-navigated-to target to mount, before
// failing safe (task §15: "no infinite retries").
const TARGET_MOUNT_WAIT_MAX_FRAMES = 45
// While a highlight is active, resync its position at most this often —
// bounded by the highlight's own lifecycle (always cleared on step/view/
// open change — see useEffect below in CatalogTutorial), never a
// standing/unbounded loop.
const HIGHLIGHT_RESYNC_INTERVAL_MS = 200

export interface CatalogTutorialHighlightState {
  activeTargetKey: CatalogTutorialTargetKey | null
  rect: DOMRect | null
  failed: boolean
}

export interface UseCatalogTutorialHighlightResult extends CatalogTutorialHighlightState {
  showMe: (targetKey: CatalogTutorialTargetKey) => void
  clearHighlight: () => void
}

export function useCatalogTutorialHighlight(): UseCatalogTutorialHighlightResult {
  const [state, setState] = useState<CatalogTutorialHighlightState>({
    activeTargetKey: null,
    rect: null,
    failed: false,
  })
  const mountWaitRafRef = useRef(0)
  const mountWaitAttemptsRef = useRef(0)

  const clearHighlight = useCallback(() => {
    if (mountWaitRafRef.current) window.cancelAnimationFrame(mountWaitRafRef.current)
    mountWaitRafRef.current = 0
    mountWaitAttemptsRef.current = 0
    setState({ activeTargetKey: null, rect: null, failed: false })
  }, [])

  const showMe = useCallback((targetKey: CatalogTutorialTargetKey) => {
    if (mountWaitRafRef.current) window.cancelAnimationFrame(mountWaitRafRef.current)
    mountWaitAttemptsRef.current = 0
    setState({ activeTargetKey: targetKey, rect: null, failed: false })

    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false

    const tryFind = () => {
      mountWaitRafRef.current = 0
      mountWaitAttemptsRef.current += 1
      const el = document.querySelector(buildTargetSelector(targetKey))
      if (el) {
        el.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "center" })
        setState({ activeTargetKey: targetKey, rect: el.getBoundingClientRect(), failed: false })
        return
      }
      if (mountWaitAttemptsRef.current >= TARGET_MOUNT_WAIT_MAX_FRAMES) {
        // task §15: fails safe, never crashes, never retries forever.
        setState({ activeTargetKey: targetKey, rect: null, failed: true })
        return
      }
      mountWaitRafRef.current = window.requestAnimationFrame(tryFind)
    }
    mountWaitRafRef.current = window.requestAnimationFrame(tryFind)
  }, [])

  // Resync position while active (scroll/resize/layout shifts) and detect
  // target unmount — a single bounded rAF loop, throttled, that stops the
  // moment activeTargetKey is cleared (by this effect's own cleanup).
  useEffect(() => {
    const targetKey = state.activeTargetKey
    if (!targetKey || state.failed) return
    let rafId = 0
    let lastCheck = 0
    const tick = (time: number) => {
      if (time - lastCheck >= HIGHLIGHT_RESYNC_INTERVAL_MS) {
        lastCheck = time
        const el = document.querySelector(buildTargetSelector(targetKey))
        if (!el) {
          // task §12: target unmounted — clear, never show a stale ring.
          setState({ activeTargetKey: null, rect: null, failed: false })
          return
        }
        setState((prev) => ({ ...prev, rect: el.getBoundingClientRect() }))
      }
      rafId = window.requestAnimationFrame(tick)
    }
    rafId = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(rafId)
  }, [state.activeTargetKey, state.failed])

  useEffect(() => clearHighlight, [clearHighlight])

  return { ...state, showMe, clearHighlight }
}

const HIGHLIGHT_RING_PADDING_PX = 4

export function CatalogTutorialHighlightRing({ rect }: { rect: DOMRect | null }) {
  if (!rect || typeof document === "undefined") return null
  return createPortal(
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        top: rect.top - HIGHLIGHT_RING_PADDING_PX,
        left: rect.left - HIGHLIGHT_RING_PADDING_PX,
        width: rect.width + HIGHLIGHT_RING_PADDING_PX * 2,
        height: rect.height + HIGHLIGHT_RING_PADDING_PX * 2,
        pointerEvents: "none",
        zIndex: 60,
      }}
      className="rounded-lg ring-2 ring-primary ring-offset-2 ring-offset-background shadow-[0_0_16px_rgba(251,140,0,0.35)] animate-pulse motion-reduce:animate-none"
    >
      <span className="absolute -top-6 left-0 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground shadow">
        Paso del tutorial
      </span>
    </div>,
    document.body
  )
}
