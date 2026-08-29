/// <reference types="bun-types" />
// P2-T18-BLOCKER-AUTH2-R13-R2 (F-P2-T18-AUTH02): static-contract test — no
// React Testing Library exists in this repository's test stack (see
// chat-sheet.test.tsx's module comment for the established rationale), so
// this file proves the actorFamily selector propagation structurally
// against the actual source text, same strategy as every other component
// contract test in this directory.
//
// Root cause this covers: /api/chat/no-leidos has no family derivable from
// its own path — under 2+ family cookies coexisting in the same browser,
// src/proxy.ts's resolveActorSession() cannot resolve it without an
// explicit ?actorFamily= selector. ChatFab is mounted from the ROOT layout
// (src/app/layout.tsx, via ChatProvider) — active on any route, not only
// /cliente or /negocio — so window.location.pathname is NOT a reliable
// family source here (unlike the 4 endpoints Fase 2 originally covered).
// The trusted source is the authenticated actor already in memory:
// useAuthStore().user?.type.
import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

// .replace normalizes CRLF -> LF so multi-line toContain() assertions below
// are insensitive to this file's on-disk line-ending convention.
const chatFabSource = () => readFileSync(resolve(import.meta.dir, "chat-fab.tsx"), "utf8").replace(/\r\n/g, "\n")

describe("ChatFab — F-P2-T18-AUTH02 actorFamily selector propagation", () => {
  test("the no-leidos fetch URL carries an explicit actorFamily selector derived from the authenticated user type", () => {
    const source = chatFabSource()
    expect(source).toContain(
      'const url = user?.type\n        ? `/api/chat/no-leidos?actorFamily=${user.type}`\n        : "/api/chat/no-leidos"',
    )
    expect(source).toContain("const res = await fetch(url, { signal: controller.signal })")
  })

  test("the family source is the authenticated user type, never window.location.pathname (ChatFab is mounted from the root layout)", () => {
    const source = chatFabSource()
    expect(source).toContain("const user = useAuthStore((s) => s.user)")
    expect(source).not.toContain("activeSessionFamily(")
    expect(source).not.toContain("window.location.pathname")
  })

  test("fetchUnread depends on user?.type — a fresh actor after login/switch never reuses a stale selector", () => {
    const source = chatFabSource()
    expect(source).toContain("}, [setUnreadCount, user?.type])")
  })

  test("no other behavior of fetchUnread (single-flight guard, abort handling, unread-count application) is disturbed", () => {
    const source = chatFabSource()
    expect(source).toContain("if (fetchingRef.current) return")
    expect(source).toContain("setUnreadCount(data.noLeidos || 0)")
    expect(source).toContain("if (abortRef.current === controller) {")
  })
})
