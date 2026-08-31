/// <reference types="bun-types" />

// ============================================
// TUTORIAL-HIGHLIGHT-PULSE-POLISH-R1 — finite attention pulse contract
// ============================================
// The operator liked the R3 contextual guide but reported the highlight
// kept pulsing/titillating indefinitely (Tailwind's `animate-pulse` has
// `animation-iteration-count: infinite` by default). This file proves the
// fix at the source level: the static ring is permanent for as long as a
// target is active, the attention glow animates a bounded number of
// times via the Web Animations API (not an infinite CSS animation), the
// pulse is gated by prefers-reduced-motion, and its lifecycle is tied to
// target IDENTITY (restarts on a new target, never on an unrelated
// rerender of the same active target). Matches this codebase's
// established static-contract convention (no RTL anywhere in this repo).

import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const TARGET = readFileSync(
  join(process.cwd(), "src", "components", "business", "catalog-tutorial", "catalog-tutorial-target.tsx"),
  "utf8"
)

describe("TUTORIAL_STATIC_RING_PRESERVED: the outline is permanent, never part of the animated phase", () => {
  test("ring-2/ring-offset classes are applied unconditionally whenever isActive — not gated by an animation-finished flag", () => {
    expect(TARGET).toMatch(/CATALOG_TUTORIAL_TARGET_RING_CLASSNAME =\s*\n\s*"ring-2 ring-primary ring-offset-2 ring-offset-background/)
  })

  test("the ring/outline classes are never part of the WAAPI keyframes — filter (the animated property) and the ring (box-shadow) are independent CSS properties, so the ring can never be interrupted or hidden mid-pulse", () => {
    const keyframesBlock = TARGET.match(/const ATTENTION_PULSE_KEYFRAMES: Keyframe\[\] = \[[\s\S]*?\]/)
    expect(keyframesBlock).not.toBeNull()
    expect(keyframesBlock![0]).not.toMatch(/ring|boxShadow/)
    expect(keyframesBlock![0]).toMatch(/filter:/)
  })
})

describe("TUTORIAL_INFINITE_PULSE=NO: no infinite animation anywhere in the target file", () => {
  test("Tailwind's animate-pulse utility (infinite by default) is completely gone from this file", () => {
    expect(TARGET).not.toMatch(/animate-pulse/)
  })

  test("no CSS animation-iteration-count: infinite, and the WAAPI options never set iterations to Infinity", () => {
    expect(TARGET).not.toMatch(/iterations:\s*Infinity/)
    expect(TARGET).not.toMatch(/animation-iteration-count/)
  })
})

describe("TUTORIAL_ATTENTION_PULSE_ITERATIONS=1_OR_2: exactly 2 pulse cycles, finite duration", () => {
  test("the keyframe list encodes exactly 2 static->peak->static cycles (5 keyframes: static, peak, static, peak, static)", () => {
    const keyframesBlock = TARGET.match(/const ATTENTION_PULSE_KEYFRAMES: Keyframe\[\] = \[([\s\S]*?)\]/)
    expect(keyframesBlock).not.toBeNull()
    const entries = keyframesBlock![1].match(/\{ filter: (STATIC_GLOW|PEAK_GLOW) \}/g) ?? []
    expect(entries).toEqual([
      "{ filter: STATIC_GLOW }",
      "{ filter: PEAK_GLOW }",
      "{ filter: STATIC_GLOW }",
      "{ filter: PEAK_GLOW }",
      "{ filter: STATIC_GLOW }",
    ])
  })

  test("total animation duration is within the suggested ~0.8-1.5s window (task §27)", () => {
    const durationMatch = TARGET.match(/duration:\s*(\d+)/)
    expect(durationMatch).not.toBeNull()
    const durationMs = Number(durationMatch![1])
    expect(durationMs).toBeGreaterThanOrEqual(800)
    expect(durationMs).toBeLessThanOrEqual(1500)
  })

  test("the animation ends on exactly the same filter value as the persistent static class — no visible jump when WAAPI releases control back to CSS", () => {
    expect(TARGET).toMatch(/const STATIC_GLOW = "drop-shadow\(0 0 8px rgba\(251,140,0,0\.45\)\)"/)
    expect(TARGET).toMatch(/\[filter:drop-shadow\(0_0_8px_rgba\(251,140,0,0\.45\)\)\]/)
  })

  test("no opacity is touched by the pulse (task §27: 'do not make strong opacity changes that make the form look like it is disappearing')", () => {
    const keyframesBlock = TARGET.match(/const ATTENTION_PULSE_KEYFRAMES: Keyframe\[\] = \[[\s\S]*?\]/)
    expect(keyframesBlock![0]).not.toMatch(/opacity/)
  })
})

describe("TUTORIAL_REDUCED_MOTION_PASS: reduced motion skips the pulse, static ring shows immediately", () => {
  test("prefers-reduced-motion is checked and short-circuits before the animate() call", () => {
    const block = TARGET.match(/const prefersReducedMotion[\s\S]*?ref\.current\.animate\(/)
    expect(block).not.toBeNull()
    expect(block![0]).toMatch(/if \(prefersReducedMotion\) return/)
  })

  test("the static ring class itself has no reduced-motion conditional — it renders identically regardless of motion preference (only the animate() call is skipped)", () => {
    expect(TARGET).not.toMatch(/motion-reduce/)
  })
})

describe("TUTORIAL_SAME_TARGET_RERENDER_RESTARTS_PULSE=NO / TUTORIAL_NEW_TARGET_RESTARTS_PULSE=SI (task §29)", () => {
  test("a ref tracks which target identity has already pulsed, guarding the animate() call — not just an isActive boolean", () => {
    expect(TARGET).toMatch(/const pulsedForTargetRef = useRef<CatalogTutorialTargetKey \| null>\(null\)/)
    expect(TARGET).toMatch(/if \(pulsedForTargetRef\.current === target\) return/)
    expect(TARGET).toMatch(/pulsedForTargetRef\.current = target/)
  })

  test("the guard is keyed by target identity, so switching to a different active target (a fresh identity) is never blocked by the same-target guard", () => {
    // The guard only ever compares against `target` (this instance's own,
    // constant target key) — a DIFFERENT CatalogTutorialTarget instance
    // (a different target prop) has its OWN pulsedForTargetRef starting
    // at null, so it always pulses on its own first activation.
    expect(TARGET).toMatch(/pulsedForTargetRef\.current === target/)
  })

  test("becoming inactive resets the guard, so the SAME target pulses again if the guide returns to it later", () => {
    const block = TARGET.match(/useEffect\(\(\) => \{\s*\n\s*if \(!isActive\) pulsedForTargetRef\.current = null\s*\n\s*\}, \[isActive\]\)/)
    expect(block).not.toBeNull()
  })

  test("the animate() effect's dependency array is [isActive, target] — a rerender that changes neither never re-runs the effect, so it can never restart an in-flight or completed pulse", () => {
    expect(TARGET).toMatch(/\}, \[isActive, target\]\)/)
  })
})

describe("no infinite rAF/DOM-polling loop introduced by this fix — WAAPI handles timing natively", () => {
  test("no requestAnimationFrame or setInterval anywhere in the target file", () => {
    expect(TARGET).not.toMatch(/requestAnimationFrame/)
    expect(TARGET).not.toMatch(/setInterval/)
  })

  test("the animation is cancelled on cleanup (effect unmount / re-run) so no orphaned animation keeps running against a stale ref", () => {
    expect(TARGET).toMatch(/return \(\) => animation\.cancel\(\)/)
  })
})

describe("no paused iOS R8 file was touched by this animation change", () => {
  test("globals.css is never referenced and no new global CSS/keyframes were added — the animation is entirely local, driven by the Web Animations API on this one element", () => {
    expect(TARGET).not.toContain("globals.css")
    expect(TARGET).not.toMatch(/@keyframes/)
    expect(TARGET).not.toMatch(/ios-dock|ios-keyboard-open|ios-bottom-nav|visualViewport/)
  })
})
