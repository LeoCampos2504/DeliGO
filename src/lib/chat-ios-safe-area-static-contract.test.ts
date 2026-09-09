/// <reference types="bun-types" />

// ============================================
// P2-T31-R24 — Chat interactive header controls clear the iOS safe area
// ============================================
// Root cause (PROVEN by direct code reading): the Chat Sheet's own two
// in-flow headers (the conversation-list header in chat-sheet.tsx and the
// individual-conversation header in chat-view.tsx) used a flat `py-*`
// offset that ignores env(safe-area-inset-top) — unlike the app's own
// established pattern for this exact problem (mesa-cuenta-dialog.tsx,
// hero-safe-area, client-*-panel.tsx, cliente/page.tsx). The Sheet's own
// built-in close (X) button (Radix's default `top-4 right-4` inside
// sheet.tsx) has the same problem — fixed here with a CSS rule scoped
// ONLY to the chat Sheet via the pre-existing `data-ios-debug-role=
// "chat-sheet"` marker, so no other Sheet in the app is affected.
//
// viewport-fit=cover is already global (src/app/layout.tsx) — no global
// viewport change was needed. The Sheet's own full-bleed container
// (`h-dvh`, `overflow-hidden`, side="right") is UNCHANGED — this fix only
// moves interactive header content, never the background/visual layer.

import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const CHAT_SHEET = readFileSync(join(process.cwd(), "src", "components", "chat", "chat-sheet.tsx"), "utf8")
const CHAT_VIEW = readFileSync(join(process.cwd(), "src", "components", "chat", "chat-view.tsx"), "utf8")
const SHEET_UI = readFileSync(join(process.cwd(), "src", "components", "ui", "sheet.tsx"), "utf8")
const GLOBALS_CSS = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8")
const ROOT_LAYOUT = readFileSync(join(process.cwd(), "src", "app", "layout.tsx"), "utf8")

describe("P2-T31-R24 — conversation-list header clears the safe area", () => {
  test("the list header's top padding is safe-area-aware, not a flat py-4", () => {
    expect(CHAT_SHEET).toContain(
      'className="px-4 pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-4 border-b border-border/50"'
    )
    expect(CHAT_SHEET).not.toMatch(/className="px-4 py-4 border-b border-border\/50"/)
  })

  test("the Sheet's own full-bleed container is untouched by this fix", () => {
    expect(CHAT_SHEET).toContain(
      'className="w-full sm:max-w-md p-0 flex flex-col overflow-hidden h-dvh"'
    )
    expect(CHAT_SHEET).toContain('data-ios-debug-role="chat-sheet"')
  })
})

describe("P2-T31-R24 — individual conversation header clears the safe area", () => {
  test("the conversation header's top padding is safe-area-aware, not a flat py-3", () => {
    expect(CHAT_VIEW).toContain(
      'className="shrink-0 px-4 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] pb-3 border-b border-border/50 bg-card"'
    )
    expect(CHAT_VIEW).not.toMatch(/className="shrink-0 px-4 py-3 border-b border-border\/50 bg-card"/)
  })

  test("the back button (ArrowLeft) is still the direct interactive control inside that header — the fix only repositions the header, never removes the control", () => {
    expect(CHAT_VIEW).toContain("<ArrowLeft")
    expect(CHAT_VIEW).toContain("onClick={onBack}")
  })
})

describe("P2-T31-R24 — the Sheet's built-in close (X) button clears the safe area, scoped to chat only", () => {
  test("SheetPrimitive.Close carries a data-slot hook (inert everywhere else, matches dialog.tsx's own data-slot=\"dialog-close\" convention)", () => {
    expect(SHEET_UI).toContain('data-slot="sheet-close"')
  })

  test("globals.css repositions it ONLY under the chat Sheet's own data-ios-debug-role marker — no other Sheet consumer in the app is selected", () => {
    expect(GLOBALS_CSS).toContain(
      '[data-ios-debug-role="chat-sheet"] [data-slot="sheet-close"] {'
    )
    expect(GLOBALS_CSS).toContain("top: calc(1rem + env(safe-area-inset-top, 0px));")
  })

  test("sheet.tsx's default top-4 right-4 positioning is unchanged for every OTHER Sheet consumer in the app", () => {
    expect(SHEET_UI).toContain("absolute top-4 right-4")
  })
})

describe("P2-T31-R24 — every env(safe-area-inset-top) usage added by this fix carries an explicit 0px fallback (Android/no-notch is a no-op, not an exaggerated gap)", () => {
  test("chat-sheet.tsx", () => {
    const usages = CHAT_SHEET.match(/calc\(env\(safe-area-inset-top[^)]*\)[^)]*\)/g) ?? []
    expect(usages.length).toBeGreaterThan(0)
    for (const usage of usages) expect(usage).toContain(",0px)")
  })

  test("chat-view.tsx", () => {
    const usages = CHAT_VIEW.match(/calc\(env\(safe-area-inset-top[^)]*\)[^)]*\)/g) ?? []
    expect(usages.length).toBeGreaterThan(0)
    for (const usage of usages) expect(usage).toContain(",0px)")
  })
})

describe("P2-T31-R24 — no platform branching, no global layout/viewport change", () => {
  test("no user-agent/platform sniffing was introduced in any file touched by this fix", () => {
    for (const source of [CHAT_SHEET, CHAT_VIEW, SHEET_UI]) {
      expect(source).not.toMatch(/navigator\.userAgent/)
      expect(source.toLowerCase()).not.toMatch(/if\s*\(\s*(is)?android/)
      expect(source.toLowerCase()).not.toMatch(/if\s*\(\s*(is)?i(os|phone)/)
    }
  })

  test("the root layout's viewport policy (viewportFit: \"cover\", already global) is untouched by this fix", () => {
    expect(ROOT_LAYOUT).toContain('viewportFit: "cover"')
  })

  test("no new global top-safe-area padding was added to the root layout itself", () => {
    expect(ROOT_LAYOUT).not.toMatch(/safe-area-inset-top/)
  })
})
