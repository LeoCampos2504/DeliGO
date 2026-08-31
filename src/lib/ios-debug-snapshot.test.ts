/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test"
import {
  advanceMilestoneTracker,
  buildExportPayload,
  buildTextSummary,
  classifyKeyboardMilestone,
  computeDerivedGeometry,
  createInitialMilestoneTrackerState,
  createRingBuffer,
  DEBUG_EVENT_BUFFER_MAX,
  DERIVED_GEOMETRY_ALLOWED_KEYS,
  DOCK_ELEMENT_ALLOWED_KEYS,
  GEOMETRY_SNAPSHOT_ALLOWED_KEYS,
  RECT_ALLOWED_KEYS,
  SCROLL_RESTORE_DEBUG_ALLOWED_KEYS,
  isIosDebugFlagEnabled,
  type BrowserModeInfo,
  type ComposerElementGeometry,
  type DockElementGeometry,
  type GeometrySnapshot,
  type OverlayElementGeometry,
  type SheetElementGeometry,
} from "./ios-debug-snapshot"

function rect(bottom: number, top = bottom - 56) {
  return { top, left: 0, right: 56, bottom, width: 56, height: bottom - top }
}

function dockGeom(bottom: number, top?: number): DockElementGeometry {
  return {
    rect: rect(bottom, top),
    computedPosition: "fixed",
    computedBottom: `${bottom}px`,
    computedVisibility: "visible",
    computedPointerEvents: "auto",
    computedTransform: "none",
  }
}

const browserMode: BrowserModeInfo = {
  standalone: false,
  displayModeStandalone: false,
  visualViewportAvailable: true,
  userAgent: null,
}

describe("computeDerivedGeometry", () => {
  test("computes all fields when every element is present and offsetTop is 0 (no correction needed)", () => {
    const nav = dockGeom(42, 42 - 64) // bottom=42 → rect.top = -22 (bottom - height); construct explicitly below
    const navRect = { top: 42 - 64, left: 12, right: 500, bottom: 42, width: 488, height: 64 }
    const fabRect = { top: 200, left: 320, right: 376, bottom: 300, width: 56, height: 56 }
    const derived = computeDerivedGeometry({
      windowInnerHeight: 800,
      visualViewport: { width: 400, height: 700, offsetTop: 0, offsetLeft: 0, scale: 1 },
      bottomNav: { ...nav, rect: navRect },
      chatFab: { ...nav, rect: fabRect },
      chatSheet: null,
      chatOverlay: null,
      chatComposer: null,
    })
    expect(derived.fixedViewportBottom).toBe(800)
    expect(derived.navBottomDistance).toBe(800 - 42)
    expect(derived.fabBottomDistance).toBe(800 - 300)
    expect(derived.fabNavGap).toBe(navRect.top - fabRect.bottom)
    expect(derived.visualLayoutHeightDelta).toBe(100)
    expect(derived.keyboardOffsetCandidate).toBe(100)
  })

  test("never fabricates a value for a missing element — returns null instead", () => {
    const derived = computeDerivedGeometry({
      windowInnerHeight: 800,
      visualViewport: null,
      bottomNav: null,
      chatFab: null,
      chatSheet: null,
      chatOverlay: null,
      chatComposer: null,
    })
    expect(derived.fixedViewportBottom).toBe(800) // always computable — not "missing"
    expect(derived.navBottomDistance).toBeNull()
    expect(derived.fabBottomDistance).toBeNull()
    expect(derived.fabNavGap).toBeNull()
    expect(derived.visualLayoutHeightDelta).toBeNull()
    expect(derived.keyboardOffsetCandidate).toBeNull()
    expect(derived.sheetVisibleGapBottom).toBeNull()
    expect(derived.overlayVisibleGapBottom).toBeNull()
    expect(derived.composerBottomGap).toBeNull()
  })

  test("fabNavGap is null when only one of the two dock elements is present", () => {
    const derived = computeDerivedGeometry({
      windowInnerHeight: 800,
      visualViewport: null,
      bottomNav: dockGeom(42),
      chatFab: null,
      chatSheet: null,
      chatOverlay: null,
      chatComposer: null,
    })
    expect(derived.fabNavGap).toBeNull()
    expect(derived.navBottomDistance).not.toBeNull()
  })

  // IOS-MOBILE-REAL-DEVICE-R2-PWA-PREPARATION regression coverage — a real
  // iPhone Safari capture (18.7, Safari 26.0.1) proved the R1 formulas
  // below were wrong whenever visualViewport.offsetTop was non-zero: they
  // used window.innerHeight (or offsetTop + height for sheet/overlay)
  // directly, but getBoundingClientRect() on that WebKit build reports
  // `fixed` elements relative to a frame shifted by offsetTop. See
  // codex-reports/IOS_MOBILE_REAL_DEVICE_R2_PWA_PREPARATION.md for the full
  // dataset (165/165 real BottomNav snapshots match the corrected formula,
  // only 131/165 matched the old one).
  test("REGRESSION — real chrome-collapsed example: offsetTop=10 must be subtracted from innerHeight before comparing to rect.bottom", () => {
    // Real captured values: innerHeight=739, visualViewport.offsetTop=10,
    // BottomNav computedBottom=42px (static CSS, unaffected by this bug),
    // real getBoundingClientRect().bottom=687.
    const bottomNav: DockElementGeometry = {
      rect: { top: 623, left: 12, right: 378, bottom: 687, width: 366, height: 64 },
      computedPosition: "fixed",
      computedBottom: "42px",
      computedVisibility: "visible",
      computedPointerEvents: "auto",
      computedTransform: "none",
    }
    const derived = computeDerivedGeometry({
      windowInnerHeight: 739,
      visualViewport: { width: 390, height: 729, offsetTop: 10, offsetLeft: 0, scale: 1 },
      bottomNav,
      chatFab: null,
      chatSheet: null,
      chatOverlay: null,
      chatComposer: null,
    })
    expect(derived.fixedViewportBottom).toBe(729) // 739 - 10
    // Corrected: fixedViewportBottom(729) - rect.bottom(687) = 42, matching the CSS bottom.
    expect(derived.navBottomDistance).toBe(42)
    // The OLD (buggy) formula would have produced innerHeight(739) - rect.bottom(687) = 52 ≠ 42.
    expect(739 - 687).not.toBe(42)
  })

  test("REGRESSION — real keyboard-open example: sheet/overlay/composer gap must resolve to ~0, not ~359", () => {
    // Real captured values during Chat's keyboard-open state: innerHeight=739,
    // visualViewport.height=380, visualViewport.offsetTop=359 — and
    // ChatOverlay/ChatSheet/ChatComposer rect.bottom were ALL exactly 380
    // (146/146 real paired Overlay+Sheet snapshots had 0px difference).
    const chatSheet: SheetElementGeometry = {
      rect: { top: -359, left: 0, right: 390, bottom: 380, width: 390, height: 739 },
      computedPosition: "fixed",
      computedTop: "0px",
      computedBottom: "0px",
      computedHeight: "739px",
      computedTransform: "none",
    }
    const chatOverlay: OverlayElementGeometry = {
      rect: { top: -359, left: 0, right: 390, bottom: 380, width: 390, height: 739 },
      computedPosition: "fixed",
      computedInset: "0px 0px 0px 0px",
      computedHeight: "739px",
    }
    const chatComposer: ComposerElementGeometry = {
      rect: { top: 320, left: 0, right: 390, bottom: 380, width: 390, height: 60 },
      computedPosition: "static",
      computedBottom: "auto",
      computedTransform: "none",
    }
    const derived = computeDerivedGeometry({
      windowInnerHeight: 739,
      visualViewport: { width: 390, height: 380, offsetTop: 359, offsetLeft: 0, scale: 1 },
      bottomNav: null,
      chatFab: null,
      chatSheet,
      chatOverlay,
      chatComposer,
    })
    expect(derived.fixedViewportBottom).toBe(380) // 739 - 359
    expect(derived.sheetVisibleGapBottom).toBe(0)
    expect(derived.overlayVisibleGapBottom).toBe(0)
    expect(derived.composerBottomGap).toBe(0)
    // The OLD (buggy) formula used offsetTop + height = 359 + 380 = 739,
    // which would have reported a fabricated ~359px gap instead of 0.
    const oldBuggyVisibleBottom = 359 + 380
    expect(oldBuggyVisibleBottom - chatSheet.rect.bottom).toBe(359)
  })
})

describe("createRingBuffer", () => {
  test("never exceeds the configured max size", () => {
    const buf = createRingBuffer<number>(3)
    for (let i = 0; i < 10; i++) buf.push(i)
    expect(buf.length).toBe(3)
    expect(buf.toArray()).toEqual([7, 8, 9])
  })

  test("clear empties the buffer", () => {
    const buf = createRingBuffer<number>(5)
    buf.push(1)
    buf.push(2)
    buf.clear()
    expect(buf.length).toBe(0)
    expect(buf.toArray()).toEqual([])
  })

  test("DEBUG_EVENT_BUFFER_MAX is within the suggested 100-200 range", () => {
    expect(DEBUG_EVENT_BUFFER_MAX).toBeGreaterThanOrEqual(100)
    expect(DEBUG_EVENT_BUFFER_MAX).toBeLessThanOrEqual(200)
  })
})

describe("isIosDebugFlagEnabled", () => {
  test("true only for exactly iosDebug=1", () => {
    expect(isIosDebugFlagEnabled("?iosDebug=1")).toBe(true)
    expect(isIosDebugFlagEnabled("?foo=bar&iosDebug=1")).toBe(true)
  })
  test("false when absent, empty, or any other value", () => {
    expect(isIosDebugFlagEnabled("")).toBe(false)
    expect(isIosDebugFlagEnabled("?foo=bar")).toBe(false)
    expect(isIosDebugFlagEnabled("?iosDebug=0")).toBe(false)
    expect(isIosDebugFlagEnabled("?iosDebug=true")).toBe(false)
  })
})

describe("classifyKeyboardMilestone / advanceMilestoneTracker — automatic milestone capture", () => {
  test("classification: closed / normal-keyboard / chat-keyboard", () => {
    expect(classifyKeyboardMilestone({ keyboardOpen: false, hasChatSheet: false })).toBe("closed")
    expect(classifyKeyboardMilestone({ keyboardOpen: false, hasChatSheet: true })).toBe("closed")
    expect(classifyKeyboardMilestone({ keyboardOpen: true, hasChatSheet: false })).toBe("normal-keyboard")
    expect(classifyKeyboardMilestone({ keyboardOpen: true, hasChatSheet: true })).toBe("chat-keyboard")
  })

  const geom = (vvHeight: number | null, vvOffsetTop: number | null) => ({ vvHeight, vvOffsetTop })
  const NO_VV = geom(null, null)

  test("fires AUTO_BASELINE_STABLE once, after 2 consecutive closed observations with stable geometry, never again", () => {
    let state = createInitialMilestoneTrackerState()
    let r = advanceMilestoneTracker(state, "closed", geom(797, 0))
    expect(r.fire).toBeNull() // 1st observation — not yet stable
    state = r.state
    r = advanceMilestoneTracker(state, "closed", geom(797, 0))
    expect(r.fire).toBe("AUTO_BASELINE_STABLE") // 2nd consecutive, same geometry — stable
    state = r.state
    r = advanceMilestoneTracker(state, "closed", geom(797, 0))
    expect(r.fire).toBeNull() // already fired once — never repeats
  })

  test("fires AUTO_KEYBOARD_OPEN_STABLE on normal-keyboard, AUTO_CHAT_KEYBOARD_OPEN_STABLE on chat-keyboard, each re-armed on the next cycle", () => {
    let state = createInitialMilestoneTrackerState()
    state = advanceMilestoneTracker(state, "closed", geom(797, 0)).state
    let r = advanceMilestoneTracker(state, "closed", geom(797, 0)) // baseline fires here
    state = r.state
    r = advanceMilestoneTracker(state, "normal-keyboard", geom(394, 403))
    expect(r.fire).toBeNull()
    state = r.state
    r = advanceMilestoneTracker(state, "normal-keyboard", geom(394, 403))
    expect(r.fire).toBe("AUTO_KEYBOARD_OPEN_STABLE")
    state = r.state
    r = advanceMilestoneTracker(state, "chat-keyboard", geom(394, 403))
    state = r.state
    r = advanceMilestoneTracker(state, "chat-keyboard", geom(394, 403))
    expect(r.fire).toBe("AUTO_CHAT_KEYBOARD_OPEN_STABLE")
  })

  test("fires AUTO_AFTER_KEYBOARD_CLOSE immediately on the edge back to closed from either keyboard class", () => {
    let state = createInitialMilestoneTrackerState()
    state = advanceMilestoneTracker(state, "normal-keyboard", geom(394, 403)).state
    const r = advanceMilestoneTracker(state, "closed", geom(729, 68))
    expect(r.fire).toBe("AUTO_AFTER_KEYBOARD_CLOSE")
  })

  test("does not fire AUTO_AFTER_KEYBOARD_CLOSE on the very first observation (no prior class to close from)", () => {
    const state = createInitialMilestoneTrackerState()
    const r = advanceMilestoneTracker(state, "closed", geom(797, 0))
    expect(r.fire).toBeNull()
  })

  // IOS-STANDALONE-REAL-DEVICE-FIX-R3 §19 regression — reproduces the real
  // false-early-fire: class flips to chat-keyboard and STAYS chat-keyboard
  // for 2 observations, but the geometry is still mid-transition between
  // them (vv.height 729->394, offsetTop 49->403, the exact real numbers
  // from the payload). Must NOT fire until geometry itself stops changing.
  test("REGRESSION — does not fire AUTO_CHAT_KEYBOARD_OPEN_STABLE while class is stable but geometry is still transitioning", () => {
    let state = createInitialMilestoneTrackerState()
    state = advanceMilestoneTracker(state, "closed", geom(797, 0)).state
    state = advanceMilestoneTracker(state, "closed", geom(797, 0)).state // baseline fires
    let r = advanceMilestoneTracker(state, "chat-keyboard", geom(729, 49)) // real: false-early value
    expect(r.fire).toBeNull()
    state = r.state
    // Same CLASS, but geometry actually changed to the real settled value —
    // must reset stability, not treat this as "2nd stable observation".
    r = advanceMilestoneTracker(state, "chat-keyboard", geom(394, 403)) // real: true settled value, ~161ms later
    expect(r.fire).toBeNull() // only 1 observation at the NEW geometry so far
    state = r.state
    r = advanceMilestoneTracker(state, "chat-keyboard", geom(394, 403)) // now genuinely stable
    expect(r.fire).toBe("AUTO_CHAT_KEYBOARD_OPEN_STABLE")
  })

  test("fires AUTO_VIEWPORT_RESTORED_TO_BASELINE only when closed AND geometry actually matches the recorded baseline — not merely 'stable in time'", () => {
    let state = createInitialMilestoneTrackerState()
    state = advanceMilestoneTracker(state, "closed", geom(797, 0)).state
    state = advanceMilestoneTracker(state, "closed", geom(797, 0)).state // baseline fires, baseline geometry = (797,0)
    state = advanceMilestoneTracker(state, "normal-keyboard", geom(394, 403)).state
    // Keyboard closes but leaves a STALE residual (the real R3 68px bug) —
    // this is "stable in time" (2 identical observations) but NOT restored.
    let r = advanceMilestoneTracker(state, "closed", geom(729, 68)) // AUTO_AFTER_KEYBOARD_CLOSE edge
    expect(r.fire).toBe("AUTO_AFTER_KEYBOARD_CLOSE")
    state = r.state
    r = advanceMilestoneTracker(state, "closed", geom(729, 68))
    expect(r.fire).toBeNull() // stable, but NOT AUTO_VIEWPORT_RESTORED_TO_BASELINE — geometry doesn't match (797,0)
    state = r.state
    // Now it genuinely resolves back to the real baseline geometry.
    r = advanceMilestoneTracker(state, "closed", geom(797, 0))
    expect(r.fire).toBeNull() // 1st observation at the new (correct) geometry
    state = r.state
    r = advanceMilestoneTracker(state, "closed", geom(797, 0))
    expect(r.fire).toBe("AUTO_VIEWPORT_RESTORED_TO_BASELINE")
  })

  test("geometry stability tolerates sub-pixel jitter (<= 1px) without resetting the stable count", () => {
    let state = createInitialMilestoneTrackerState()
    state = advanceMilestoneTracker(state, "closed", geom(797, 0)).state
    const r = advanceMilestoneTracker(state, "closed", geom(797.6, 0.4)) // real device: sub-pixel jitter observed
    expect(r.fire).toBe("AUTO_BASELINE_STABLE")
  })

  test("without visualViewport (NO_VV), falls back to class-only stability instead of blocking forever", () => {
    let state = createInitialMilestoneTrackerState()
    state = advanceMilestoneTracker(state, "closed", NO_VV).state
    const r = advanceMilestoneTracker(state, "closed", NO_VV)
    expect(r.fire).toBe("AUTO_BASELINE_STABLE")
  })
})

describe("buildExportPayload", () => {
  test("produces the exact documented shape (version, capturedAt, browserMode, manualCaptures, events)", () => {
    const payload = buildExportPayload({
      browserMode,
      manualCaptures: [],
      events: [],
      now: 123,
    })
    expect(Object.keys(payload).sort()).toEqual(
      ["version", "capturedAt", "browserMode", "manualCaptures", "events"].sort()
    )
    expect(payload.version).toBe(1)
    expect(payload.capturedAt).toBe(123)
  })
})

describe("buildTextSummary", () => {
  test("does not throw on an empty payload and mentions the manual capture count", () => {
    const payload = buildExportPayload({ browserMode, manualCaptures: [], events: [], now: 1 })
    const summary = buildTextSummary(payload)
    expect(summary).toContain("0 manual captures")
  })
})

describe("no sensitive data can silently enter the schema (whitelist lock)", () => {
  test("a GeometrySnapshot has exactly the documented top-level keys — nothing else, ever", () => {
    const snapshot: GeometrySnapshot = {
      timestamp: 1,
      captureLabel: "BASELINE",
      eventType: "manual",
      pathname: "/cliente",
      window: { innerWidth: 400, innerHeight: 800, scrollX: 0, scrollY: 0 },
      documentElement: { clientWidth: 400, clientHeight: 800, className: "ios-device" },
      body: {
        className: "ios-device",
        computedPosition: "relative",
        computedTop: "auto",
        computedOverflow: "visible",
        computedOverflowY: "auto",
        computedHeight: "auto",
        computedMinHeight: "100dvh",
      },
      visualViewport: { width: 400, height: 700, offsetTop: 0, offsetLeft: 0, scale: 1 },
      bottomNav: dockGeom(42),
      chatFab: dockGeom(126),
      chatOverlay: null,
      chatSheet: null,
      chatComposer: null,
      browserMode,
      derived: {
        fixedViewportBottom: 800,
        navBottomDistance: 1,
        fabBottomDistance: 1,
        fabNavGap: 1,
        visualLayoutHeightDelta: null,
        keyboardOffsetCandidate: null,
        sheetVisibleGapBottom: null,
        overlayVisibleGapBottom: null,
        composerBottomGap: null,
      },
      scrollRestoreDebug: {
        preFocusScrollY: 100,
        currentScrollYAtDecision: 100,
        shouldRestore: false,
        restoreReason: "already-within-tolerance",
        restoreTargetScrollY: null,
        decidedAt: 1,
      },
    }
    expect(Object.keys(snapshot).sort()).toEqual(GEOMETRY_SNAPSHOT_ALLOWED_KEYS)
  })

  test("a ScrollRestoreDebugSnapshot has exactly the documented keys — no input/message fields, only scroll numbers and a fixed reason string", () => {
    const snap = {
      preFocusScrollY: 100,
      currentScrollYAtDecision: 100,
      shouldRestore: false,
      restoreReason: "already-within-tolerance",
      restoreTargetScrollY: null,
      decidedAt: 1,
    }
    expect(Object.keys(snap).sort()).toEqual(SCROLL_RESTORE_DEBUG_ALLOWED_KEYS)
  })

  test("a dock element geometry has exactly the documented keys (rect + a fixed whitelist of computed styles) — no input/text fields", () => {
    const geom = dockGeom(42)
    expect(Object.keys(geom).sort()).toEqual(DOCK_ELEMENT_ALLOWED_KEYS)
    expect(Object.keys(geom.rect).sort()).toEqual(RECT_ALLOWED_KEYS)
  })

  test("a DerivedGeometry result has exactly the documented keys — no raw input echoed back beyond the fixed reference frame", () => {
    const derived = computeDerivedGeometry({
      windowInnerHeight: 800,
      visualViewport: null,
      bottomNav: null,
      chatFab: null,
      chatSheet: null,
      chatOverlay: null,
      chatComposer: null,
    })
    expect(Object.keys(derived).sort()).toEqual(DERIVED_GEOMETRY_ALLOWED_KEYS)
  })

  test("none of the allowed keys anywhere in the schema resemble input value/message/token/credential fields", () => {
    const forbidden = /value|message|token|password|credential|cookie|localstorage|email/i
    for (const key of GEOMETRY_SNAPSHOT_ALLOWED_KEYS) {
      expect(key).not.toMatch(forbidden)
    }
    for (const key of DOCK_ELEMENT_ALLOWED_KEYS) {
      expect(key).not.toMatch(forbidden)
    }
  })
})
