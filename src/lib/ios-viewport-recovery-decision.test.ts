/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test"
import {
  decideViewportRecovery,
  VIEWPORT_RECOVERY_HEIGHT_TOLERANCE_PX,
  type ViewportRecoveryDecisionInput,
} from "./ios-viewport-recovery-decision"

function baseInput(over: Partial<ViewportRecoveryDecisionInput> = {}): ViewportRecoveryDecisionInput {
  return {
    experimentEnabled: true,
    isStandalone: true,
    keyboardJustClosed: true,
    baselineViewportHeight: 797,
    currentViewportHeight: 729,
    toleranceViewportHeightPx: VIEWPORT_RECOVERY_HEIGHT_TOLERANCE_PX,
    ...over,
  }
}

describe("decideViewportRecovery", () => {
  test("attempts recovery when every condition holds and a real deficit exists (real R6 numbers: 797 -> 729)", () => {
    const result = decideViewportRecovery(baseInput())
    expect(result.shouldAttemptRecovery).toBe(true)
    expect(result.reason).toBeNull()
    expect(result.heightDeficit).toBe(68)
  })

  test("skips when the experiment flag is off — never runs for a normal user", () => {
    const result = decideViewportRecovery(baseInput({ experimentEnabled: false }))
    expect(result.shouldAttemptRecovery).toBe(false)
    expect(result.reason).toBe("experiment-disabled")
  })

  test("skips outside standalone (Safari tab) even with the experiment on", () => {
    const result = decideViewportRecovery(baseInput({ isStandalone: false }))
    expect(result.shouldAttemptRecovery).toBe(false)
    expect(result.reason).toBe("not-standalone")
  })

  test("skips when the keyboard did not just close (never runs mid-keyboard-open or on unrelated events)", () => {
    const result = decideViewportRecovery(baseInput({ keyboardJustClosed: false }))
    expect(result.shouldAttemptRecovery).toBe(false)
    expect(result.reason).toBe("keyboard-not-just-closed")
  })

  test("skips when there is no recorded baseline yet (first load, before any stable closed state)", () => {
    const result = decideViewportRecovery(baseInput({ baselineViewportHeight: null }))
    expect(result.shouldAttemptRecovery).toBe(false)
    expect(result.reason).toBe("no-baseline")
    const result2 = decideViewportRecovery(baseInput({ currentViewportHeight: null }))
    expect(result2.shouldAttemptRecovery).toBe(false)
    expect(result2.reason).toBe("no-baseline")
  })

  test("skips when height is already within tolerance of baseline — never fires on a no-op", () => {
    const result = decideViewportRecovery(baseInput({ currentViewportHeight: 795 })) // deficit=2, tolerance=4
    expect(result.shouldAttemptRecovery).toBe(false)
    expect(result.reason).toBe("already-restored")
    expect(result.heightDeficit).toBe(2)
  })

  test("boundary: deficit exactly at tolerance does not attempt (uses <=, not <)", () => {
    const result = decideViewportRecovery(baseInput({ currentViewportHeight: 793 })) // deficit=4=tolerance
    expect(result.shouldAttemptRecovery).toBe(false)
    expect(result.reason).toBe("already-restored")
  })

  test("boundary: deficit one px past tolerance does attempt", () => {
    const result = decideViewportRecovery(baseInput({ currentViewportHeight: 792.9 })) // deficit=4.1
    expect(result.shouldAttemptRecovery).toBe(true)
  })

  test("a currentViewportHeight ABOVE baseline (negative deficit) never attempts recovery", () => {
    const result = decideViewportRecovery(baseInput({ currentViewportHeight: 800 }))
    expect(result.shouldAttemptRecovery).toBe(false)
    expect(result.heightDeficit).toBe(-3)
  })
})
