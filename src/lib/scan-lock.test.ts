// ============================================
// F9 — continuous-scan lock (pure, synthetic time)
// ============================================
import { describe, expect, test } from "bun:test"
import { createScanLock, DEFAULT_SCAN_LOCK_CONFIG } from "./scan-lock"

const FRAME_MS = 100 // ~10 analyzed frames per second

/** Feeds `frames` (each an array of codes) at FRAME_MS spacing; returns accepted codes with their time. */
function run(lock: ReturnType<typeof createScanLock>, frames: string[][], startAt = 0, acceptNew = true) {
  const accepted: Array<{ code: string; at: number }> = []
  frames.forEach((codes, i) => {
    const at = startAt + i * FRAME_MS
    const code = lock.observe(codes, at, { acceptNew })
    if (code) accepted.push({ code, at })
  })
  return accepted
}

const repeat = (codes: string[], n: number) => Array.from({ length: n }, () => codes)

describe("scan lock", () => {
  test("defaults match the audited starting point", () => {
    expect(DEFAULT_SCAN_LOCK_CONFIG).toEqual({ confirmFrames: 2, rearmAbsenceMs: 700, sameCodeMinIntervalMs: 1200 })
  })

  test("a code held still for 10 seconds adds exactly ONE unit", () => {
    const lock = createScanLock()
    const accepted = run(lock, repeat(["SOPA"], 100))
    expect(accepted).toHaveLength(1)
    expect(accepted[0].code).toBe("SOPA")
  })

  test("needs two consecutive frames (single-frame misreads are ignored)", () => {
    const lock = createScanLock()
    expect(run(lock, [["X"], [], ["X"], []])).toHaveLength(0)
    expect(run(lock, [["X"], ["X"]], 1000)).toHaveLength(1)
  })

  test("brief decode dropouts while the product stays in view never re-add", () => {
    const lock = createScanLock()
    // seen, then flickers: 600 ms gaps (< 700 ms re-arm) repeated for 10 s
    const frames: string[][] = []
    for (let i = 0; i < 10; i++) frames.push(["SOPA"], ["SOPA"], ["SOPA"], ["SOPA"], [], [], [], [], [], [])
    expect(run(lock, frames)).toHaveLength(1)
  })

  test("taking the product out and presenting it again adds another unit", () => {
    const lock = createScanLock()
    const frames = [...repeat(["SOPA"], 5), ...repeat([], 10), ...repeat(["SOPA"], 5)]
    const accepted = run(lock, frames)
    expect(accepted.map((a) => a.code)).toEqual(["SOPA", "SOPA"])
  })

  test("alternating different codes works without waiting", () => {
    const lock = createScanLock()
    const frames = [...repeat(["SOPA"], 3), ...repeat(["ARROZ"], 3), ...repeat(["FIDEOS"], 3)]
    expect(run(lock, frames).map((a) => a.code)).toEqual(["SOPA", "ARROZ", "FIDEOS"])
  })

  test("two codes in the same frame are both accepted, one per frame", () => {
    const lock = createScanLock()
    expect(run(lock, repeat(["A", "B"], 4)).map((a) => a.code)).toEqual(["A", "B"])
  })

  test("same-code safety floor: re-presentation faster than 1.2 s waits for it", () => {
    const lock = createScanLock({ rearmAbsenceMs: 200 })
    const frames = [...repeat(["X"], 2), ...repeat([], 3), ...repeat(["X"], 12)]
    const accepted = run(lock, frames)
    expect(accepted).toHaveLength(2)
    expect(accepted[1].at - accepted[0].at).toBeGreaterThanOrEqual(1200)
  })

  test("paused (variant selector open): nothing is accepted and codes in view stay locked after resuming", () => {
    const lock = createScanLock()
    expect(run(lock, repeat(["SOPA"], 5), 0, false)).toHaveLength(0)
    // resume with SOPA still in view → still no unit
    expect(run(lock, repeat(["SOPA"], 20), 500)).toHaveLength(0)
    // it leaves and comes back → accepted
    expect(run(lock, [...repeat([], 10), ...repeat(["SOPA"], 3)], 2500)).toHaveLength(1)
  })

  test("an unknown code is locked like any other: one message, not one per frame", () => {
    const lock = createScanLock()
    expect(run(lock, repeat(["NO-EXISTE"], 50))).toHaveLength(1)
  })

  test("manual lock: the camera doesn't re-add a code just typed while it is in view", () => {
    const lock = createScanLock()
    lock.lock("SOPA", 0)
    expect(run(lock, repeat(["SOPA"], 20), 50)).toHaveLength(0)
  })

  test("a fresh lock per session carries nothing from the previous one", () => {
    const first = createScanLock()
    run(first, repeat(["SOPA"], 5))
    expect(first.isLocked("SOPA")).toBe(true)
    const second = createScanLock()
    expect(second.isLocked("SOPA")).toBe(false)
    expect(run(second, repeat(["SOPA"], 2))).toHaveLength(1)
    first.reset()
    expect(first.isLocked("SOPA")).toBe(false)
  })
})
