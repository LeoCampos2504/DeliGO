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

export const CATALOG_TUTORIAL_TARGET_RING_CLASSNAME =
  "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-[0_0_16px_rgba(251,140,0,0.35)] animate-pulse motion-reduce:animate-none"

function useTargetRegistration<T extends HTMLElement>(target: CatalogTutorialTargetKey) {
  const guide = useCatalogTutorialGuide()
  const ref = useRef<T>(null)
  const isActive = guide.activeTargetKey === target

  useEffect(() => {
    guide.registerTarget(target)
    return () => guide.unregisterTarget(target)
  }, [target])

  useEffect(() => {
    if (!isActive || !ref.current) return
    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
    ref.current.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "center" })
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
