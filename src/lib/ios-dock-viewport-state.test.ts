/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test"
import {
  DEGRADED_DOCK_GAP_PX,
  DEGRADED_FAB_GAP_ABOVE_NAV_PX,
  DOCK_VIEWPORT_DEGRADED_TOLERANCE_PX,
  resolveIosDockPlacement,
  resolveIosDockViewportMode,
  type DockViewportModeInput,
} from "./ios-dock-viewport-state"

function modeInput(over: Partial<DockViewportModeInput> = {}): DockViewportModeInput {
  return {
    keyboardOpen: false,
    isStandalone: true,
    baselineViewportHeight: 797,
    currentViewportHeight: 797,
    ...over,
  }
}

describe("resolveIosDockViewportMode (§25)", () => {
  test("baseline 797 / current 797 => HEALTHY", () => {
    expect(resolveIosDockViewportMode(modeInput())).toBe("HEALTHY")
  })

  test("keyboard open => KEYBOARD_OPEN, regardless of any viewport deficit", () => {
    expect(resolveIosDockViewportMode(modeInput({ keyboardOpen: true }))).toBe("KEYBOARD_OPEN")
    expect(
      resolveIosDockViewportMode(modeInput({ keyboardOpen: true, currentViewportHeight: 729 }))
    ).toBe("KEYBOARD_OPEN")
  })

  test("baseline 797 / current 729 / keyboard closed / standalone => DEGRADED_POST_KEYBOARD (real R6/R7 numbers)", () => {
    expect(resolveIosDockViewportMode(modeInput({ currentViewportHeight: 729 }))).toBe(
      "DEGRADED_POST_KEYBOARD"
    )
  })

  test("same 729 deficit outside standalone (Safari tab) => HEALTHY, no fallback", () => {
    expect(
      resolveIosDockViewportMode(modeInput({ currentViewportHeight: 729, isStandalone: false }))
    ).toBe("HEALTHY")
  })

  test("deficit <= tolerance => HEALTHY (sub-pixel jitter never triggers the fallback)", () => {
    expect(
      resolveIosDockViewportMode(
        modeInput({ currentViewportHeight: 797 - DOCK_VIEWPORT_DEGRADED_TOLERANCE_PX })
      )
    ).toBe("HEALTHY")
  })

  test("deficit one px past tolerance => DEGRADED_POST_KEYBOARD", () => {
    expect(
      resolveIosDockViewportMode(
        modeInput({ currentViewportHeight: 797 - DOCK_VIEWPORT_DEGRADED_TOLERANCE_PX - 1 })
      )
    ).toBe("DEGRADED_POST_KEYBOARD")
  })

  test("no baseline recorded yet => HEALTHY (never fabricates degraded state before AUTO_BASELINE_STABLE)", () => {
    expect(resolveIosDockViewportMode(modeInput({ baselineViewportHeight: null }))).toBe("HEALTHY")
    expect(resolveIosDockViewportMode(modeInput({ currentViewportHeight: null }))).toBe("HEALTHY")
  })

  test("a current height ABOVE baseline (negative deficit) never triggers degraded mode", () => {
    expect(resolveIosDockViewportMode(modeInput({ currentViewportHeight: 800 }))).toBe("HEALTHY")
  })
})

describe("resolveIosDockPlacement (§9-10) — verified against real R6/R7 numbers", () => {
  test("at rest (offsetTop=0, height=729) matches the task's own worked example: rect.bottom ≈ 721", () => {
    const placement = resolveIosDockPlacement({
      offsetTop: 0,
      visualViewportHeight: 729,
      navHeightPx: 64,
      fabHeightPx: 56,
    })
    expect(placement.navTopPx).toBe(729 - 64 - DEGRADED_DOCK_GAP_PX)
    expect(placement.navTopPx + 64).toBe(721) // rect.bottom
  })

  test("the gap to the paintable bottom stays exactly DEGRADED_DOCK_GAP_PX across the full observed offsetTop range (-58..68)", () => {
    for (const offsetTop of [-58, -39.66, -9, 0, 20, 26, 33, 68]) {
      const placement = resolveIosDockPlacement({
        offsetTop,
        visualViewportHeight: 729,
        navHeightPx: 64,
        fabHeightPx: 56,
      })
      const navRectBottom = placement.navTopPx + 64
      const paintableViewportBottom = offsetTop + 729
      expect(paintableViewportBottom - navRectBottom).toBeCloseTo(DEGRADED_DOCK_GAP_PX, 5)
    }
  })

  test("negative overscroll (offsetTop=-58, real observed value) never places the nav below the shrunken paintable bottom", () => {
    const placement = resolveIosDockPlacement({
      offsetTop: -58,
      visualViewportHeight: 729,
      navHeightPx: 64,
      fabHeightPx: 56,
    })
    const navRectBottom = placement.navTopPx + 64
    const paintableViewportBottom = -58 + 729
    expect(navRectBottom).toBeLessThanOrEqual(paintableViewportBottom)
  })

  test("FAB sits exactly DEGRADED_FAB_GAP_ABOVE_NAV_PX above the nav's top, same as the healthy 12px contract", () => {
    const placement = resolveIosDockPlacement({
      offsetTop: 0,
      visualViewportHeight: 729,
      navHeightPx: 64,
      fabHeightPx: 56,
    })
    const fabRectBottom = placement.fabTopPx + 56
    expect(placement.navTopPx - fabRectBottom).toBe(DEGRADED_FAB_GAP_ABOVE_NAV_PX)
  })

  test("no double-counting: the 34px safe-area constant never appears in the degraded gap", () => {
    const placement = resolveIosDockPlacement({
      offsetTop: 0,
      visualViewportHeight: 729,
      navHeightPx: 64,
      fabHeightPx: 56,
    })
    const gapFromPaintableBottom = 729 - (placement.navTopPx + 64)
    expect(gapFromPaintableBottom).toBe(DEGRADED_DOCK_GAP_PX)
    expect(gapFromPaintableBottom).not.toBe(34 + DEGRADED_DOCK_GAP_PX)
  })
})
