"use client"

// ============================================
// BUSINESS-CATALOG-INAPP-TUTORIAL-R3 §7-8 — real in-place highlight
// ============================================
// Replaces R2's detached, fixed-position, portaled ring (bounding-rect
// measurement + a body-level portal) with a highlight on the ACTUAL React
// element — no duplicated geometry, no separate overlay, no DOM query. A
// target mounts/unmounts with React's own lifecycle (registering itself
// with the guide context, see catalog-tutorial-guide-context.tsx), and
// scrolls itself into view via a plain element ref when it becomes the
// active target — never a raw DOM query for a matching selector.
//
// Two ways to consume this, sharing the same core logic:
// - <CatalogTutorialTarget target="..."> wraps children in a thin div and
//   applies the ring itself — the right fit for a block-level area
//   (a button, a whole form-step container).
// - useCatalogTutorialTargetRing("...") returns {ref, isActive, className}
//   to spread directly onto an existing real element (a flex-row tab
//   button, a Radix Switch) when adding a wrapper div would change that
//   element's own layout.

import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { useCatalogTutorialGuide } from "./catalog-tutorial-guide-context"
import type { CatalogTutorialTargetKey } from "./catalog-tutorial-targets"

// TUTORIAL-HIGHLIGHT-PULSE-POLISH-R1 §25-27: the outline itself (Tailwind
// `ring-*`, box-shadow based — zero layout impact) is permanent for as
// long as a target is active — it never animates, never disappears. Only
// a SEPARATE `filter: drop-shadow(...)` glow pulses briefly on
// activation, via the Web Animations API in the effect below (never the
// Tailwind utility this file used before, whose default `infinite`
// iteration count was the operator's actual complaint — it also toggles
// `opacity` on the
// whole element, which visually looks like the real control is fading
// out, exactly what §27 says to avoid). `filter` and `box-shadow` are
// independent CSS properties, so animating one never fights the other —
// the ring drawn by `ring-2`/`ring-offset-2` is untouched throughout.
const STATIC_GLOW = "drop-shadow(0 0 8px rgba(251,140,0,0.45))"
const PEAK_GLOW = "drop-shadow(0 0 15px rgba(251,140,0,0.8))"

export const CATALOG_TUTORIAL_TARGET_RING_CLASSNAME =
  "ring-2 ring-primary ring-offset-2 ring-offset-background [filter:drop-shadow(0_0_8px_rgba(251,140,0,0.45))]"

// Exactly 2 pulse cycles (static -> peak -> static, twice), ending on the
// SAME value as the persistent static class above so releasing control
// back to CSS after the animation ends is seamless — no jump/pop. ~900ms
// total, inside the task's suggested ~0.8-1.5s attention-phase window.
const ATTENTION_PULSE_KEYFRAMES: Keyframe[] = [
  { filter: STATIC_GLOW },
  { filter: PEAK_GLOW },
  { filter: STATIC_GLOW },
  { filter: PEAK_GLOW },
  { filter: STATIC_GLOW },
]
// `fill: "none"` (the default — deliberately not overridden) means once
// the animation ends, the inline `filter` this Animation applied is
// released and the element falls back to its CSS class's static
// drop-shadow (CATALOG_TUTORIAL_TARGET_RING_CLASSNAME above) — no manual
// cleanup of the settled state is needed, and no visible jump since the
// last keyframe already matches that static value.
const ATTENTION_PULSE_OPTIONS: KeyframeAnimationOptions = {
  duration: 900,
  iterations: 1,
  easing: "ease-in-out",
}

function useTargetRegistration<T extends HTMLElement>(target: CatalogTutorialTargetKey) {
  const guide = useCatalogTutorialGuide()
  const ref = useRef<T>(null)
  const isActive = guide.activeTargetKey === target
  // §29: the pulse restarts when the tutorial moves to a NEW target, never
  // merely because this same active target re-rendered (a rerender, a
  // scroll, an unrelated state change). Tracked by target identity, not
  // by isActive alone.
  const pulsedForTargetRef = useRef<CatalogTutorialTargetKey | null>(null)

  useEffect(() => {
    guide.registerTarget(target)
    return () => guide.unregisterTarget(target)
  }, [target])

  useEffect(() => {
    if (!isActive || !ref.current) return
    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
    ref.current.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "center" })

    // §28: reduced motion skips the pulse entirely — the static ring
    // (already applied via CATALOG_TUTORIAL_TARGET_RING_CLASSNAME,
    // unconditionally whenever isActive) is shown immediately with no
    // animation at all.
    if (prefersReducedMotion) return
    // Already pulsed for this exact target activation — a rerender of the
    // same active target must never restart it.
    if (pulsedForTargetRef.current === target) return
    pulsedForTargetRef.current = target

    const animation = ref.current.animate(ATTENTION_PULSE_KEYFRAMES, ATTENTION_PULSE_OPTIONS)
    return () => animation.cancel()
  }, [isActive, target])

  // A target that stops being active (guide moved on, or was cleared)
  // must pulse again if it becomes active a second time later.
  useEffect(() => {
    if (!isActive) pulsedForTargetRef.current = null
  }, [isActive])

  return { ref, isActive }
}

export function CatalogTutorialTarget({
  target,
  className,
  children,
}: {
  target: CatalogTutorialTargetKey
  className?: string
  children: React.ReactNode
}) {
  const { ref, isActive } = useTargetRegistration<HTMLDivElement>(target)
  return (
    <div
      ref={ref}
      className={cn("rounded-lg transition-shadow", isActive && CATALOG_TUTORIAL_TARGET_RING_CLASSNAME, className)}
    >
      {children}
    </div>
  )
}

export function useCatalogTutorialTargetRing<T extends HTMLElement = HTMLElement>(
  target: CatalogTutorialTargetKey
): { ref: React.RefObject<T | null>; isActive: boolean; className: string | undefined } {
  const { ref, isActive } = useTargetRegistration<T>(target)
  return { ref, isActive, className: isActive ? CATALOG_TUTORIAL_TARGET_RING_CLASSNAME : undefined }
}
