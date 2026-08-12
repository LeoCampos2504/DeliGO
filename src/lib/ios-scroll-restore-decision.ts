// ============================================
// IOS-24-POSITION-FIX — pure decision logic
// ============================================
// Extracted out of src/components/pwa/ios-keyboard-fix.tsx so the decision
// of "should we restore document scroll, and to what value" can be unit
// tested without DOM/jsdom. The effect in ios-keyboard-fix.tsx stays the
// only place that touches window/document — this file is pure.

export type ScrollRestoreDecision =
  | { shouldRestore: true; target: number }
  | { shouldRestore: false; reason: string }

export function decideScrollRestore(params: {
  preFocusScrollY: number | null
  currentScrollY: number
  userScrolledDuringCycle: boolean
  hasEditableFocus: boolean
  keyboardOpen: boolean
  toleranceRestorePx: number
}): ScrollRestoreDecision {
  const { preFocusScrollY, currentScrollY, userScrolledDuringCycle, hasEditableFocus, keyboardOpen, toleranceRestorePx } = params

  if (preFocusScrollY === null) return { shouldRestore: false, reason: "no-prefocus-captured" }
  if (keyboardOpen) return { shouldRestore: false, reason: "keyboard-still-open" }
  if (hasEditableFocus) return { shouldRestore: false, reason: "editable-still-focused" }
  if (userScrolledDuringCycle) return { shouldRestore: false, reason: "user-scrolled-intentionally" }
  if (Math.abs(currentScrollY - preFocusScrollY) <= toleranceRestorePx) {
    return { shouldRestore: false, reason: "already-within-tolerance" }
  }
  return { shouldRestore: true, target: preFocusScrollY }
}

/**
 * Decides the preFocusScrollY for a keyboard cycle that is starting (or
 * continuing, on an editable-to-editable focus transition without the
 * keyboard ever fully closing). The first editable focus of a cycle
 * captures the real position; later ones within the same cycle must NOT
 * overwrite it with an already-displaced value.
 */
export function resolveCycleStart(params: {
  keyboardCycleActive: boolean
  preFocusScrollY: number | null
  currentScrollY: number
}): { keyboardCycleActive: true; preFocusScrollY: number } {
  if (params.keyboardCycleActive && params.preFocusScrollY !== null) {
    return { keyboardCycleActive: true, preFocusScrollY: params.preFocusScrollY }
  }
  return { keyboardCycleActive: true, preFocusScrollY: params.currentScrollY }
}
