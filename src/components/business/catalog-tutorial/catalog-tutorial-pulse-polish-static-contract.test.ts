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

describe("TUTORIAL_STATIC_RING_PRESERVED: the outline is permanent, never part of the animated phase, and never fills the interior", () => {
  test("the persistent highlight is a real CSS outline (not Tailwind ring/ring-offset, not filter:drop-shadow) — outline can never fill a box's interior regardless of its own background", () => {
    expect(TARGET).toMatch(/export const CATALOG_TUTORIAL_TARGET_RING_CLASSNAME = "outline-2 outline-primary outline-offset-2"/)
  })

  test("no ring-offset and no drop-shadow anywhere — both were the actual root cause of tinted/stained interiors on mobile (ring-offset paints a solid color rectangle; drop-shadow follows child content's alpha shape)", () => {
    expect(TARGET).not.toMatch(/ring-offset/)
    expect(TARGET).not.toMatch(/drop-shadow/)
  })

  test("the static class carries no bg-* utility — the highlight must never override a real target's own background (e.g. a solid-color button) when applied directly via useCatalogTutorialTargetRing", () => {
    const classLine = TARGET.match(/export const CATALOG_TUTORIAL_TARGET_RING_CLASSNAME = "[^"]*"/)
    expect(classLine).not.toBeNull()
    expect(classLine![0]).not.toMatch(/\bbg-/)
  })

  test("the outline is never part of the WAAPI keyframes — outline and box-shadow (the animated property) are independent CSS properties, so the outline can never be interrupted or hidden mid-pulse", () => {
    const keyframesBlock = TARGET.match(/const ATTENTION_PULSE_KEYFRAMES: Keyframe\[\] = \[[\s\S]*?\]/)
    expect(keyframesBlock).not.toBeNull()
    expect(keyframesBlock![0]).not.toMatch(/outline/)
    expect(keyframesBlock![0]).toMatch(/boxShadow:/)
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

describe("TUTORIAL_ATTENTION_PULSE_ITERATIONS=1_OR_2: exactly 2 pulse cycles, finite duration, zero residue", () => {
  test("the keyframe list encodes exactly 2 none->glow->none cycles (5 keyframes: none, glow, none, glow, none)", () => {
    const keyframesBlock = TARGET.match(/const ATTENTION_PULSE_KEYFRAMES: Keyframe\[\] = \[([\s\S]*?)\]/)
    expect(keyframesBlock).not.toBeNull()
    const entries = keyframesBlock![1].match(/\{ boxShadow: (PULSE_NONE|PULSE_GLOW) \}/g) ?? []
    expect(entries).toEqual([
      "{ boxShadow: PULSE_NONE }",
      "{ boxShadow: PULSE_GLOW }",
      "{ boxShadow: PULSE_NONE }",
      "{ boxShadow: PULSE_GLOW }",
      "{ boxShadow: PULSE_NONE }",
    ])
  })

  test("total animation duration is within the suggested ~0.8-1.5s window (task §27)", () => {
    const durationMatch = TARGET.match(/duration:\s*(\d+)/)
    expect(durationMatch).not.toBeNull()
    const durationMs = Number(durationMatch![1])
    expect(durationMs).toBeGreaterThanOrEqual(800)
    expect(durationMs).toBeLessThanOrEqual(1500)
  })

  test("the pulse starts AND ends on a fully-zero box-shadow — nothing is left to clean up, and the static ring class declares no box-shadow of its own to conflict with it", () => {
    expect(TARGET).toMatch(/const PULSE_NONE = "0 0 0 0 rgba\(251,140,0,0\)"/)
    const classLine = TARGET.match(/export const CATALOG_TUTORIAL_TARGET_RING_CLASSNAME = "[^"]*"/)
    expect(classLine![0]).not.toMatch(/shadow/)
  })

  test("fill is explicitly set to 'none' — an animation-fill-mode that preserved the final frame was one of the failure modes this fix must rule out", () => {
    expect(TARGET).toMatch(/fill:\s*"none"/)
  })

  test("no opacity and no background-color is touched by the pulse (task §27: 'do not make strong opacity changes'; the operator's bug: tinted/stained interior)", () => {
    const keyframesBlock = TARGET.match(/const ATTENTION_PULSE_KEYFRAMES: Keyframe\[\] = \[[\s\S]*?\]/)
    expect(keyframesBlock![0]).not.toMatch(/opacity/)
    expect(keyframesBlock![0]).not.toMatch(/background/)
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
