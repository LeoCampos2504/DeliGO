/// <reference types="bun-types" />
// P2-T18-BLOCKER-AUTH2-R13-R2 (F-P2-T18-AUTH02): static-contract test — same
// source-level assertion strategy as chat-sheet.test.tsx/chat-fab.test.tsx
// (no React Testing Library exists in this repository's test stack).
//
// ChatView owns 2 of the 11 productive AUTH02 call sites: the history GET
// (/api/chat/mensajes/[pedidoId], with an optional `mode=safety`/
// `knownRevision` query already built by chat-history-resync.ts's
// buildHistoryRequestQuery) and the send POST. Both need an explicit
// actorFamily selector because this path has no family derivable from
// itself — under 2+ family cookies coexisting, src/proxy.ts's
// resolveActorSession() cannot resolve it otherwise. Family source:
// useAuthStore().user?.type (ChatView, like ChatFab/ChatSheet, is reachable
// from the root-layout-mounted ChatProvider, never guaranteed to be on a
// /cliente or /negocio pathname at fetch time).
import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

// .replace normalizes CRLF -> LF so multi-line toContain() assertions below
// are insensitive to this file's on-disk line-ending convention.
const chatViewSource = () => readFileSync(resolve(import.meta.dir, "chat-view.tsx"), "utf8").replace(/\r\n/g, "\n")

describe("ChatView — F-P2-T18-AUTH02 actorFamily selector propagation (history GET)", () => {
  test("the history URL derives the selector from the authenticated user type", () => {
    const source = chatViewSource()
    expect(source).toContain('const familyParam = user?.type ? `actorFamily=${user.type}` : ""')
  })

  test("the selector preserves the existing `query` (mode=safety/knownRevision) unchanged — appended with & when query is present, ? otherwise", () => {
    const source = chatViewSource()
    expect(source).toContain(
      'const historyUrl = familyParam\n        ? `/api/chat/mensajes/${pedidoId}${query}${query ? "&" : "?"}${familyParam}`\n        : `/api/chat/mensajes/${pedidoId}${query}`',
    )
  })

  test("the history fetch call site uses historyUrl, not a bare pedidoId template", () => {
    const source = chatViewSource()
    expect(source).toContain("const res = await fetch(historyUrl, { signal: controller.signal })")
    expect(source).not.toContain("fetch(`/api/chat/mensajes/${pedidoId}${query}`")
  })

  test("runFetchFor depends on user?.type — a fresh actor after login/switch never reuses a stale selector", () => {
    const source = chatViewSource()
    expect(source).toContain(
      "[pedidoId, setLoadingMessages, setMessages, setPedidoInfo, updateConversationUnread, user?.type]",
    )
  })
})

describe("ChatView — F-P2-T18-AUTH02 actorFamily selector propagation (send POST)", () => {
  test("the send URL carries an explicit actorFamily selector derived from the authenticated user type", () => {
    const source = chatViewSource()
    expect(source).toContain(
      'const sendUrl = user?.type\n        ? `/api/chat/mensajes/${pedidoId}?actorFamily=${user.type}`\n        : `/api/chat/mensajes/${pedidoId}`',
    )
    expect(source).toContain("const res = await fetch(sendUrl, {")
  })

  test("sendMessage depends on user?.type in its useCallback deps array", () => {
    const source = chatViewSource()
    expect(source).toContain(
      "}, [messageText, pendingAttachment, isSending, isUploading, pedidoId, addMessage, client, isCurrentActor, updateConversationLastMessage, setSending, user?.type])",
    )
  })

  test("the send request body/method/headers are unchanged — only the URL gained the selector", () => {
    const source = chatViewSource()
    expect(source).toContain('method: "POST"')
    expect(source).toContain('headers: { "Content-Type": "application/json" }')
    expect(source).toContain("body: JSON.stringify(body)")
  })
})

describe("ChatView — family source is never pathname-derived", () => {
  test("neither call site uses activeSessionFamily() or window.location.pathname (ChatView is reachable from the root-layout ChatProvider, not guaranteed on a family-prefixed route)", () => {
    const source = chatViewSource()
    expect(source).not.toContain("activeSessionFamily(")
    expect(source).not.toContain("window.location.pathname")
  })
})
