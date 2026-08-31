// ============================================
// IOS-STANDALONE-POST-KEYBOARD-VIEWPORT-RECOVERY-R7 — pure decision logic
// ============================================
// R6's complete real-device JSON proved `visualViewport.height` never
// returns to its pre-keyboard baseline (797) for the rest of a standalone
// PWA session after the FIRST keyboard close — it stays permanently at 729
// through a full bounded settling window and a second complete keyboard
// cycle (155/157 real captures). `window.scrollY` and
// `visualViewport.offsetTop` DO recover correctly — this is a genuine,
// independently-documented WebKit standalone-PWA bug (soft keyboard shrinks
// visualViewport.height and it never grows back until the app is
// force-quit), distinct from the offsetTop residual R3-R5 already fixed.
//
// This module decides WHETHER a bounded recovery attempt should run — never
// performs the DOM mutation itself (that impure part lives in
// ios-keyboard-fix.tsx, exactly like decideScrollRestore/performRestore are
// split). Kept as an opt-in TESTING experiment (never default-on): no real
// device was available to verify the recovery technique actually works
// before shipping it, so it must be gated behind an explicit toggle the
// operator arms before testing, not silently applied to every user.

export interface ViewportRecoveryDecisionInput {
  experimentEnabled: boolean
  isStandalone: boolean
  keyboardJustClosed: boolean
  baselineViewportHeight: number | null
  currentViewportHeight: number | null
  toleranceViewportHeightPx: number
}

export type ViewportRecoverySkipReason =
  | "experiment-disabled"
  | "not-standalone"
  | "keyboard-not-just-closed"
  | "no-baseline"
  | "already-restored"

export interface ViewportRecoveryDecision {
  shouldAttemptRecovery: boolean
  reason: ViewportRecoverySkipReason | null
  heightDeficit: number | null
}

// A few px of slack — WebKit's own sub-pixel visualViewport values (already
// observed as real, e.g. 41.34/42.34 in R3-R5 data) must never themselves
// look like a "deficit" worth acting on.
export const VIEWPORT_RECOVERY_HEIGHT_TOLERANCE_PX = 4

export function decideViewportRecovery(input: ViewportRecoveryDecisionInput): ViewportRecoveryDecision {
  const {
    experimentEnabled,
    isStandalone,
    keyboardJustClosed,
    baselineViewportHeight,
    currentViewportHeight,
    toleranceViewportHeightPx,
  } = input

  if (!experimentEnabled) {
    return { shouldAttemptRecovery: false, reason: "experiment-disabled", heightDeficit: null }
  }
  if (!isStandalone) {
    return { shouldAttemptRecovery: false, reason: "not-standalone", heightDeficit: null }
  }
  if (!keyboardJustClosed) {
    return { shouldAttemptRecovery: false, reason: "keyboard-not-just-closed", heightDeficit: null }
  }
  if (baselineViewportHeight === null || currentViewportHeight === null) {
    return { shouldAttemptRecovery: false, reason: "no-baseline", heightDeficit: null }
  }

  const heightDeficit = baselineViewportHeight - currentViewportHeight
  if (heightDeficit <= toleranceViewportHeightPx) {
    return { shouldAttemptRecovery: false, reason: "already-restored", heightDeficit }
  }

  return { shouldAttemptRecovery: true, reason: null, heightDeficit }
}
