// ============================================
// IOS-STANDALONE-DEGRADED-VIEWPORT-DOCK-FALLBACK-R8 — pure decision logic
// ============================================
// R7's complete real-device JSON certified that the tested WebKit recovery
// technique fails deterministically (heightBeforeAttempt=729,
// heightAfterAttempt=729, recovered=false, reproduced across the whole
// session) — visualViewport.height cannot be reliably forced back to
// baseline after the first keyboard cycle on the affected iOS/WebKit
// build. R6's hit-testing already proved the visible clipping is not a DOM
// occluder, not z-index, not backdrop/filter compositing. The only
// remaining, evidence-grounded explanation is that the lower ~68px of the
// LAYOUT viewport falls outside the region WebKit is currently treating as
// paintable — so the fix is not another position formula chasing the
// broken viewport, but keeping the dock entirely inside whatever region IS
// currently paintable.
//
// This module is the single, pure authority for two questions:
// 1. Which mode is the dock currently in? (resolveIosDockViewportMode)
// 2. Where, in physical/fixed-position coordinates, should the nav/FAB sit
//    while in the degraded mode? (resolveIosDockPlacement)
// The impure DOM shell (ios-keyboard-fix.tsx) only ever calls these with
// freshly-read values and applies the result — it never encodes its own
// competing formula.

export type DockViewportMode = "HEALTHY" | "KEYBOARD_OPEN" | "DEGRADED_POST_KEYBOARD"

// Reuses the same 4px tolerance R7's (now-removed) recovery experiment
// used — small enough to never mask a real 68px-class deficit, large
// enough to absorb WebKit's own observed sub-pixel visualViewport jitter
// (41.34/42.34-style values already seen throughout R3-R7's real data).
export const DOCK_VIEWPORT_DEGRADED_TOLERANCE_PX = 4

export interface DockViewportModeInput {
  keyboardOpen: boolean
  isStandalone: boolean
  baselineViewportHeight: number | null
  currentViewportHeight: number | null
}

// KEYBOARD_OPEN always wins — the existing, unrelated keyboard-open policy
// (nav/FAB hidden via visibility:hidden) is untouched by this task and
// takes priority regardless of any viewport-height deficit computed while
// the keyboard itself is still open (that height reduction IS the keyboard,
// not the degraded-viewport bug).
// Never returns DEGRADED_POST_KEYBOARD outside standalone: R6/R7 never
// observed this residual in Safari-tab mode (only the standalone build),
// and there is no evidence justifying the fallback there.
export function resolveIosDockViewportMode(input: DockViewportModeInput): DockViewportMode {
  const { keyboardOpen, isStandalone, baselineViewportHeight, currentViewportHeight } = input

  if (keyboardOpen) return "KEYBOARD_OPEN"
  if (!isStandalone) return "HEALTHY"
  if (baselineViewportHeight === null || currentViewportHeight === null) return "HEALTHY"

  const deficit = baselineViewportHeight - currentViewportHeight
  if (deficit > DOCK_VIEWPORT_DEGRADED_TOLERANCE_PX) return "DEGRADED_POST_KEYBOARD"
  return "HEALTHY"
}

// IOS-STANDALONE-DEGRADED-VIEWPORT-DOCK-FALLBACK-R8 §11: no additional
// env(safe-area-max-inset-bottom, 34px) in degraded mode — the reduced
// visualViewport.height already excludes the lower native/compositor
// region that the safe-area inset was originally meant to clear, so
// re-adding it on top would double-count and push the dock unnecessarily
// higher (confirmed against the task's own real-number example: R7's
// deficit=68, and the task's own target of nav.rect.bottom≈721 for
// vv.height=729 only reconciles with an 8px gap, not 42px).
export const DEGRADED_DOCK_GAP_PX = 8

// Same 12px clearance already established (and real-device certified) for
// the healthy dock in globals.css's --ios-chat-fab-gap-above-nav — reused,
// not reinvented, so FAB/Nav spacing looks identical whether healthy or
// degraded.
export const DEGRADED_FAB_GAP_ABOVE_NAV_PX = 12

export interface DockPlacementInput {
  // visualViewport.offsetTop, read from the SAME synchronously-updated
  // signal R5 already built (--ios-dock-visual-offset-top) — never a
  // separately-polled value, so this carries the identical, already-
  // certified error characteristics (self-terminating rAF window, max
  // ~52px transient error self-correcting within ~103ms).
  offsetTop: number
  // visualViewport.height — proven stable (155/155 real degraded samples
  // identical) so, unlike offsetTop, it needs no polling/freshness
  // machinery of its own.
  visualViewportHeight: number
  navHeightPx: number
  fabHeightPx: number
}

export interface DockPlacement {
  navTopPx: number
  fabTopPx: number
}

// Derivation (verified against real R7 numbers, offsetTop swept from -58
// to +68): for a `position:fixed` element, `top: Tpx` maps directly and
// LINEARLY to rect.top (no innerHeight/offsetTop inversion needed — that
// inversion is specifically a `bottom`-property quirk this WebKit build
// has, which is exactly why R3-R5's `bottom`-based compensation needed a
// live-offsetTop-dependent formula in the first place). Anchoring off
// `top` instead sidesteps that inversion entirely: the paintable region's
// own bottom edge, in the same physical coordinate frame
// getBoundingClientRect() already uses, is simply
// `offsetTop + visualViewportHeight` — no inversion, no double-counting,
// no quadratic term. Verified: at offsetTop=0, height=729, navHeight=64,
// gap=8 → navTopPx=657 → rect.bottom=721, exactly matching the task's own
// worked example. At offsetTop=68 → rect.bottom=789, paintable
// bottom=797, gap=8 (preserved). At offsetTop=-58 (real observed
// overscroll) → rect.bottom=663, paintable bottom=671, gap=8 (preserved)
// — the gap stays exactly DEGRADED_DOCK_GAP_PX across the entire observed
// offsetTop range, with only a first-order (not amplified) dependency on
// the live offsetTop signal.
export function resolveIosDockPlacement(input: DockPlacementInput): DockPlacement {
  const { offsetTop, visualViewportHeight, navHeightPx, fabHeightPx } = input
  const paintableViewportBottom = offsetTop + visualViewportHeight
  const navTopPx = paintableViewportBottom - navHeightPx - DEGRADED_DOCK_GAP_PX
  const fabTopPx = navTopPx - DEGRADED_FAB_GAP_ABOVE_NAV_PX - fabHeightPx
  return { navTopPx, fabTopPx }
}
