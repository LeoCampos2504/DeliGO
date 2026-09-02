/// <reference types="bun-types" />

// ============================================
// P2-T22 — Hero background edge-to-edge + safe-area protected controls
// ============================================
// viewport-fit=cover is already global (src/app/layout.tsx), so no global
// viewport change was needed here. The hero's outer container already sat
// at the true top of the page (no ancestor padding pushed it down) — what
// was missing was that its INTERACTIVE content (back/share row, and the
// amber preview banner) used a flat pixel top offset that ignores
// env(safe-area-inset-top), unlike the app's own established pattern for
// this exact problem at the bottom of the screen (bottom-nav.tsx's
// `bottom-[calc(env(safe-area-inset-bottom,0px)+8px)]`) and at the top in
// mesa-cuenta-dialog.tsx (`top: calc(1rem + env(safe-area-inset-top, 0px))`).
// This file asserts the same calc()-with-env() idiom is now used here too.
//
// NOT covered by this fix (deliberately, documented in the P2-T22 report as
// requiring a separate, global, STOP-flagged decision): making the hero
// background visually render BEHIND a translucent iOS status bar requires
// changing `appleWebApp.statusBarStyle` from "default" to
// "black-translucent" in the ROOT layout — an app-wide change affecting
// every installed PWA surface (Cliente/Negocio/Operaciones/Repartidor/
// SuperAdmin), not something this file's narrow scope should assert.

import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const PAGE = readFileSync(join(process.cwd(), "src", "app", "n", "[slug]", "page.tsx"), "utf8")

describe("Hero back/share row clears the notch/Dynamic Island via env(safe-area-inset-top)", () => {
  test("the back/share row's top offset is safe-area-aware, not a flat pixel value", () => {
    expect(PAGE).toContain(
      'className="absolute top-[calc(env(safe-area-inset-top,0px)+0.75rem)] left-3 right-3 flex items-center justify-between z-10"'
    )
    expect(PAGE).not.toMatch(/className="absolute top-3 left-3 right-3/)
  })

  test("the preview banner's top padding is safe-area-aware — it can still be sticky at the visual top edge while its content clears the notch", () => {
    expect(PAGE).toContain("pt-[calc(env(safe-area-inset-top,0px)+0.625rem)]")
  })

  test("env(...) always carries an explicit 0px fallback — desktop/non-notched devices get exactly the original flat offset, never an exaggerated gap", () => {
    // Scoped to actual calc() CSS usages (className attributes), not prose
    // comments that happen to mention the technique by name.
    const calcUsages = PAGE.match(/calc\(env\(safe-area-inset-top[^)]*\)[^)]*\)/g) ?? []
    expect(calcUsages.length).toBe(2)
    for (const usage of calcUsages) {
      expect(usage).toContain(",0px)")
    }
  })

  test("the hero image/banner container itself is untouched — the fix protects interactive content, it does not push the background down", () => {
    expect(PAGE).toContain('<div className="relative h-44 sm:h-52 lg:h-64">')
  })
})
