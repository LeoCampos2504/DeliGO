/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test"
import {
  buildExportPayload,
  buildTextSummary,
  computeDerivedGeometry,
  createRingBuffer,
  DEBUG_EVENT_BUFFER_MAX,
  DOCK_ELEMENT_ALLOWED_KEYS,
  GEOMETRY_SNAPSHOT_ALLOWED_KEYS,
  RECT_ALLOWED_KEYS,
  isIosDebugFlagEnabled,
  type BrowserModeInfo,
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
  test("computes all fields when every element is present", () => {
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
    })
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
    })
    expect(derived.navBottomDistance).toBeNull()
    expect(derived.fabBottomDistance).toBeNull()
    expect(derived.fabNavGap).toBeNull()
    expect(derived.visualLayoutHeightDelta).toBeNull()
    expect(derived.keyboardOffsetCandidate).toBeNull()
    expect(derived.sheetVisibleGapBottom).toBeNull()
    expect(derived.overlayVisibleGapBottom).toBeNull()
  })

  test("fabNavGap is null when only one of the two dock elements is present", () => {
    const derived = computeDerivedGeometry({
      windowInnerHeight: 800,
      visualViewport: null,
      bottomNav: dockGeom(42),
      chatFab: null,
      chatSheet: null,
      chatOverlay: null,
    })
    expect(derived.fabNavGap).toBeNull()
    expect(derived.navBottomDistance).not.toBeNull()
  })

  test("sheet/overlay gap uses the visual viewport's visible bottom (offsetTop + height), not window.innerHeight", () => {
    const chatSheet: SheetElementGeometry = {
      rect: { top: 0, left: 100, right: 500, bottom: 500, width: 400, height: 500 },
      computedPosition: "fixed",
      computedTop: "0px",
      computedBottom: "0px",
      computedHeight: "500px",
      computedTransform: "none",
    }
    const chatOverlay: OverlayElementGeometry = {
      rect: { top: 0, left: 0, right: 600, bottom: 520, width: 600, height: 520 },
      computedPosition: "fixed",
      computedInset: "0px",
      computedHeight: "520px",
    }
    const derived = computeDerivedGeometry({
      windowInnerHeight: 800,
      visualViewport: { width: 600, height: 520, offsetTop: 10, offsetLeft: 0, scale: 1 },
      bottomNav: null,
      chatFab: null,
      chatSheet,
      chatOverlay,
    })
    // visible bottom = offsetTop(10) + height(520) = 530
    expect(derived.sheetVisibleGapBottom).toBe(530 - 500)
    expect(derived.overlayVisibleGapBottom).toBe(530 - 520)
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
        navBottomDistance: 1,
        fabBottomDistance: 1,
        fabNavGap: 1,
        visualLayoutHeightDelta: null,
        keyboardOffsetCandidate: null,
        sheetVisibleGapBottom: null,
        overlayVisibleGapBottom: null,
      },
    }
    expect(Object.keys(snapshot).sort()).toEqual(GEOMETRY_SNAPSHOT_ALLOWED_KEYS)
  })

  test("a dock element geometry has exactly the documented keys (rect + a fixed whitelist of computed styles) — no input/text fields", () => {
    const geom = dockGeom(42)
    expect(Object.keys(geom).sort()).toEqual(DOCK_ELEMENT_ALLOWED_KEYS)
    expect(Object.keys(geom.rect).sort()).toEqual(RECT_ALLOWED_KEYS)
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
