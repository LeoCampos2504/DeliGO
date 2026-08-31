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

// OWN-PRODUCT-OPTIONS-REGRESSION-FIX / highlight-fill fix: the persistent
// highlight is a pure `outline` (a real CSS outline — not Tailwind's
// composed ring / offset-ring box-shadow utilities, and not a CSS
// `filter`-based glow). Outline paints ONLY a line around the box edge —
// it can never fill the interior, never tints a nested card's own
// background, and (unlike the offset-ring utility, which paints a solid
// offset-color rectangle to fake a gap) never leaves a mismatched-color
// "stain" when the highlighted block's own local background differs from
// the page background. The filter-based glow was also removed: applied
// to a container with real children (icons, nested cards, semi-
// transparent panels), a CSS filter shadow follows the alpha shape of
// ALL that content and is rasterized as a bitmap layer by mobile
// browsers — exactly the "leftover tinted patches inside the block" the
// operator saw on mobile. `outline` and `box-shadow` are independent,
// non-compositing CSS properties, so the pulse below (which animates
// `box-shadow` only) can never fight or smear into this static outline.
// Deliberately no `bg-*` class here: `outline`/`box-shadow` never fill a
// box regardless of its background, so forcing one isn't needed to keep
// the interior clean — and this class is also applied directly to real
// elements with their OWN meaningful background (e.g. the solid-orange
// "Agregar producto" button) via useCatalogTutorialTargetRing, where a
// `bg-*` utility here could win the cascade and blank out that real
// background.
export const CATALOG_TUTORIAL_TARGET_RING_CLASSNAME = "outline-2 outline-primary outline-offset-2"

const PULSE_GLOW = "0 0 14px 2px rgba(251,140,0,0.55)"
const PULSE_NONE = "0 0 0 0 rgba(251,140,0,0)"

// Exactly 2 pulse cycles (none -> glow -> none, twice) — starts AND ends
// on the same "no shadow at all" value, so there is nothing left to
// clean up: once the animation finishes, box-shadow is already `none`.
// ~900ms total, inside the ~0.8-1.5s attention-phase window.
const ATTENTION_PULSE_KEYFRAMES: Keyframe[] = [
  { boxShadow: PULSE_NONE },
  { boxShadow: PULSE_GLOW },
  { boxShadow: PULSE_NONE },
  { boxShadow: PULSE_GLOW },
  { boxShadow: PULSE_NONE },
]
// `fill: "none"` is passed EXPLICITLY (rather than relying on it being
// the default) so a lingering animation-fill-mode can never be the
// reason a stale frame (a filled-looking box-shadow) survives after the
// pulse ends — once finished, this Animation's effect stops applying
// entirely and box-shadow falls back to the CSS cascade, which never
// declares one (no shadow class on the static ring above) — genuinely
// `none`, not just visually similar to it.
const ATTENTION_PULSE_OPTIONS: KeyframeAnimationOptions = {
  duration: 900,
  iterations: 1,
  easing: "ease-in-out",
  fill: "none",
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
      className={cn("rounded-lg", isActive && CATALOG_TUTORIAL_TARGET_RING_CLASSNAME, className)}
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
