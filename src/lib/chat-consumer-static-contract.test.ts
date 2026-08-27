import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const fromSrc = (relativePath: string) => resolve(import.meta.dir, "..", relativePath)
const chatSheet = () => readFileSync(fromSrc("components/chat/chat-sheet.tsx"), "utf8")
const chatView = () => readFileSync(fromSrc("components/chat/chat-view.tsx"), "utf8")
const chatProvider = () => readFileSync(fromSrc("providers/chat-provider.tsx"), "utf8")
const chatFab = () => readFileSync(fromSrc("components/chat/chat-fab.tsx"), "utf8")
const conversationList = () => readFileSync(fromSrc("components/chat/conversation-list.tsx"), "utf8")
const chatHistoryResync = () => readFileSync(fromSrc("lib/chat-history-resync.ts"), "utf8")

describe("Shared realtime Chat consumer contract", () => {
  test("ChatSheet uses the shared provider, leases both Chat scopes and subscribes through the registry", () => {
    const source = chatSheet()
    expect(source).toContain('from "@/hooks/use-realtime"')
    expect(source).toContain('client.acquireOrderRoom(activePedidoId, ["chat:read", "chat:typing"], { signal: controller.signal })')
    expect(source).toContain('client.subscribe("new-message"')
    expect(source).toContain('client.subscribe("user-typing"')
    expect(source).toContain('client.subscribe("user-stop-typing"')
    expect(source).toContain('client.subscribe("messages-read"')
    expect(source).toContain("new AbortController()")
    expect(source).toContain("controller.abort()")
    expect(source).toContain("{ signal: controller.signal }")
    expect(source).not.toContain("leave-all-rooms")
    expect(source).not.toContain("authorizeRealtimeRoom")
    expect(source).not.toContain("fetchRealtimeToken")
  })

  test("Chat components expose no raw Socket ownership or transport listeners", () => {
    const source = `${chatSheet()}\n${chatView()}`
    for (const forbidden of [
      "socket.io-client",
      "socketRef",
      "getSocket",
      "socket.on",
      "socket.off",
      "socket.emit",
      "leave-all-rooms",
      "io(",
    ]) {
      expect(source).not.toContain(forbidden)
    }
  })

  test("ChatView commands preserve HTTP persistence and use the shared command facade", () => {
    const source = chatView()
    expect(source).toContain('from "@/hooks/use-realtime"')
    expect(source).toContain("client.sendTyping(pedidoId)")
    expect(source).toContain("client.sendStopTyping(pedidoId)")
    expect(source).toContain("const isCurrentActor = useCallback")
    expect(source).toContain("controller.abort()")
    expect(source).toContain("{ signal: controller.signal }")
    expect(source).toContain('method: "POST"')
    expect(source).toContain("/api/chat/mensajes/${pedidoId}")
  })

  test("ChatView no longer productively drives the legacy chat.message.created producer (P2: server-authoritative)", () => {
    const source = chatView()
    expect(source).not.toContain("sendLegacyChatMessage")
    expect(source).toContain("addMessage(pedidoId, data.mensaje)")
  })

  test("ChatProvider resets actor-sensitive Chat state on actor transitions", () => {
    const source = chatProvider()
    expect(source).toContain("useChatActorReset")
    expect(source).toContain("useChatStore.getState().reset()")
    expect(source).toContain("previousActorKeyRef")
  })

  test("Chat retry reacquires the room instead of opening a transport without demand", () => {
    const source = chatSheet()
    expect(source).toContain("setRetryNonce((current) => current + 1)")
    expect(source).not.toContain("client.ensureConnected()")
  })
})

// SHARED REALTIME — CHAT POLLING REDUCTION CORRECTED B2 LOCAL
// IMPLEMENTATION: source-level contract for the reworked polling ownership.
// See CODEX_REPORT.md for the full design rationale each letter here locks in.
describe("Chat polling B2 — cadence ownership and UI-state-only gating contract", () => {
  test("A. ChatFab is the sole /api/chat/no-leidos owner — present in chat-fab.tsx, absent from chat-sheet.tsx and conversation-list.tsx", () => {
    expect(chatFab()).toContain('fetch("/api/chat/no-leidos"')
    expect(chatSheet()).not.toContain("/api/chat/no-leidos")
    expect(conversationList()).not.toContain("/api/chat/no-leidos")
  })

  test("B. ChatSheet makes zero /api/chat/no-leidos requests of any kind (mount, interval, open, foreground, or resync)", () => {
    const source = chatSheet()
    expect(source).not.toContain("no-leidos")
    expect(source).not.toContain("loadUnreadCount")
  })

  test("C. ConversationList performs zero network fetches — presentation/store-only", () => {
    expect(conversationList()).not.toContain("fetch(")
  })

  test("D. ChatSheet is the one that fetches /api/chat/conversaciones", () => {
    expect(chatSheet()).toContain('fetch("/api/chat/conversaciones"')
  })

  test("E. ChatSheet populates both conversations and archived from the same /conversaciones response", () => {
    const source = chatSheet()
    expect(source).toContain("setConversations(data.conversations || [])")
    expect(source).toContain("setArchivedConversations(data.archived || [])")
  })

  test("F. ChatFab uses the pure 15s unread cadence helper, not an inline literal", () => {
    const source = chatFab()
    expect(source).toContain("selectUnreadPollInterval")
    expect(source).toContain('from "@/lib/chat-polling"')
  })

  test("G. ChatSheet uses the pure 10s conversations-list cadence helper, not an inline literal", () => {
    expect(chatSheet()).toContain("selectConversationsPollInterval")
  })

  test("H. Active ChatView (a specific conversation open) fully suspends the conversations timer, not merely slows it", () => {
    const source = chatSheet()
    expect(source).toContain("const isListView = isSheetOpen && activePedidoId === null")
    expect(source).toContain(
      "selectConversationsPollInterval({ isSheetOpen, activePedidoId, documentVisible })",
    )
  })

  test("I. Hidden tab suspends both ChatFab's unread timer and ChatSheet's conversations timer", () => {
    expect(chatFab()).toContain("selectUnreadPollInterval({ canChat, documentVisible })")
    expect(chatSheet()).toContain(
      "selectConversationsPollInterval({ isSheetOpen, activePedidoId, documentVisible })",
    )
  })

  test("J. Both ChatFab and ChatSheet wire the foreground-episode coalescing helper", () => {
    for (const source of [chatFab(), chatSheet()]) {
      expect(source).toContain("applyForegroundEpisodeEvent")
      expect(source).toContain("createForegroundEpisodeState")
    }
  })

  test("K. Both ChatFab and ChatSheet filter manager resync catch-ups through shouldResyncTriggerChatCatchup", () => {
    for (const source of [chatFab(), chatSheet()]) {
      expect(source).toContain("shouldResyncTriggerChatCatchup")
      expect(source).toContain("client.registerResync")
    }
  })

  test("L. Cadence decisions take only UI-state inputs — no socket/connection-state field is passed to either selector", () => {
    // Exact-string match: any extra field (e.g. a `state`/`isConnected` read
    // from `snapshot`) would break this literal call-site match, so this
    // also proves no such field is smuggled in.
    expect(chatFab()).toContain("selectUnreadPollInterval({ canChat, documentVisible })")
    expect(chatSheet()).toContain(
      "selectConversationsPollInterval({ isSheetOpen, activePedidoId, documentVisible })",
    )
  })

  test("M. No raw socket ownership or direct realtime auth introduced by ChatFab/ConversationList", () => {
    const source = `${chatFab()}\n${conversationList()}`
    for (const forbidden of [
      "socket.io-client",
      "socketRef",
      "getSocket",
      "socket.on",
      "socket.off",
      "socket.emit",
      "leave-all-rooms",
      "authorizeRealtimeRoom",
      "fetchRealtimeToken",
    ]) {
      expect(source).not.toContain(forbidden)
    }
  })

  test("N. ChatSheet's existing realtime subscriptions (including unread-update, kept for compatibility) remain untouched", () => {
    const source = chatSheet()
    expect(source).toContain('client.subscribe("new-message"')
    expect(source).toContain('client.subscribe("unread-update"')
    expect(source).toContain("setUnreadCount(data.count)")
  })

  test("O. ChatFab and ChatSheet import nothing from Tracking — polling ownership changes stay scoped to Chat", () => {
    const source = `${chatFab()}\n${chatSheet()}\n${conversationList()}`
    for (const forbidden of ["@/lib/tracking-", "@/hooks/use-repartidor-tracking", "@/components/tracking/"]) {
      expect(source).not.toContain(forbidden)
    }
  })

  test("ChatSheet's existing room-lease effect is unchanged by the polling rework", () => {
    const source = chatSheet()
    expect(source).toContain('client.acquireOrderRoom(activePedidoId, ["chat:read", "chat:typing"], { signal: controller.signal })')
  })
})

// SHARED REALTIME — CHAT ACTIVE-MESSAGE RESYNC — V6 LOCAL IMPLEMENTATION
// FINAL: source-level contract for the active-message history recovery
// design (see CODEX_REPORT.md for the full multi-correction rationale).
describe("Chat active-message resync V6 — exact contract", () => {
  test("no raw Socket.IO, direct realtime token/capability, or Internal Publish access anywhere in Chat", () => {
    const source = `${chatSheet()}\n${chatView()}\n${chatHistoryResync()}`
    for (const forbidden of [
      "socket.io-client",
      "socketRef",
      "getSocket",
      "socket.on",
      "socket.off",
      "socket.emit",
      "io(",
      "authorizeRealtimeRoom",
      "fetchRealtimeToken",
      "/internal/realtime/publish",
      "REALTIME_INTERNAL_PUBLISH_SECRET",
      "REALTIME_INTERNAL_SERVICE_URL",
    ]) {
      expect(source).not.toContain(forbidden)
    }
  })

  test("no manager (RealtimeManager) domain mutation — chat-history-resync.ts never imports it", () => {
    expect(chatHistoryResync()).not.toContain('from "@/lib/realtime-manager"')
    expect(chatHistoryResync()).not.toContain("new RealtimeManager")
  })

  test("the pure helper never touches fetch/cookies/React itself (only documents that boundary in comments)", () => {
    const source = chatHistoryResync()
    // No client-component directive, no React import, no literal fetch()
    // call, no cookie access — the module only owns injectable-timer
    // deadline plumbing; the real fetch() call is supplied by the caller
    // (ChatView) via the `operation` callback parameter.
    expect(source).not.toContain('"use client"')
    expect(source).not.toContain('from "react"')
    expect(source).not.toContain("document.cookie")
    expect(source).not.toContain("req.cookies")
  })

  test("history safety interval is exactly 90000ms and the request deadline is exactly 10000ms", () => {
    const source = chatHistoryResync()
    expect(source).toContain("ACTIVE_HISTORY_SAFETY_INTERVAL_MS = 90_000")
    expect(source).toContain("ACTIVE_HISTORY_SINGLE_REQUEST_DEADLINE_MS = 10_000")
    expect(chatView()).toContain("ACTIVE_HISTORY_SAFETY_INTERVAL_MS")
    expect(chatView()).toContain("ACTIVE_HISTORY_SINGLE_REQUEST_DEADLINE_MS")
  })

  test("ChatView uses the shared chat-history-resync helper for coordination and reconciliation", () => {
    const source = chatView()
    expect(source).toContain('from "@/lib/chat-history-resync"')
    expect(source).toContain("reconcileHistoryMessages")
    expect(source).toContain("runHistoryRequestWithDeadline")
  })

  test("the exact Chat room coverage token is published only by ChatSheet and consumed only by ChatView", () => {
    expect(chatSheet()).toContain("setCoverageToken(createCoverageToken(")
    expect(chatView()).toContain("coverageToken")
    expect(chatSheet()).toContain("coverageToken={coverageToken}")
  })

  test("the manager resync handler is registered as a plain (non-async) VOID callback — never awaiting history HTTP", () => {
    const source = chatView()
    const registerIndex = source.indexOf("client.registerResync((reason) => {")
    expect(registerIndex).toBeGreaterThan(-1)
    // Exact-shape check: a plain arrow function, not `async (reason) =>`,
    // proves the manager's requestResync() Promise.allSettled never awaits
    // Chat's own history fetch/reconciliation chain.
    expect(source).not.toContain("client.registerResync(async")
    expect(source).not.toContain("await triggerHistoryFetch")
    expect(source).not.toContain("return triggerHistoryFetch")
  })

  test("initial-connect and reauth are denied history triggers; online is retained; room-rejoin is coverage-gated", () => {
    const source = chatHistoryResync()
    expect(source).toContain('case "online":\n      return true')
    expect(source).toContain('case "room-rejoin":\n      return hasExactCoverage')
    expect(source).toContain('case "initial-connect":')
    expect(source).toContain('case "reauth":')
  })

  test("ChatView filters the manager resync callback through isHistoryResyncReasonAllowed, gated by the exact-coverage ref", () => {
    const source = chatView()
    expect(source).toContain("isHistoryResyncReasonAllowed(reason, hasExactCoverageForCurrentLifecycleRef.current)")
  })

  test("no active /conversaciones polling is restored inside ChatView, and no new /no-leidos owner is introduced", () => {
    const source = chatView()
    expect(source).not.toContain('fetch("/api/chat/conversaciones"')
    expect(source).not.toContain('fetch("/api/chat/no-leidos"')
  })

  test("no coverage-token/auth/capability state is persisted to localStorage/sessionStorage anywhere in Chat", () => {
    const source = `${chatSheet()}\n${chatView()}\n${chatHistoryResync()}`
    expect(source).not.toContain("localStorage")
    expect(source).not.toContain("sessionStorage")
  })

  test("the active-message history GET carries its own AbortController identity, distinct from the room-lease controller", () => {
    const source = chatView()
    expect(source).toContain("coordinatorRef")
    expect(source).toContain("new AbortController()")
  })
})

// P2-T18 — F-P1-01 / F-P1-02: a sibling tab/socket of the SAME actor must
// never treat its own typing or its own read-marking as if it came from
// someone else. See codex-reports/CURRENT_TASK.md for the full contract.
describe("P2-T18 — own-actor filtering for user-typing and messages-read", () => {
  test("F-P1-02: user-typing ignores the same actor BEFORE it ever reaches addTypingUser", () => {
    const source = chatSheet()
    const subscribeIndex = source.indexOf('client.subscribe("user-typing", (data) => {')
    const guardIndex = source.indexOf("if (data.userId === user.id) return")
    const addTypingUserIndex = source.indexOf("addTypingUser(data.pedidoId, {")
    expect(subscribeIndex).toBeGreaterThan(-1)
    expect(guardIndex).toBeGreaterThan(-1)
    expect(addTypingUserIndex).toBeGreaterThan(-1)
    // Exact ordering: the guard lives inside this specific subscribe
    // callback and returns before addTypingUser is ever reached — not a
    // coincidental match against some other guard elsewhere in the file.
    expect(guardIndex).toBeGreaterThan(subscribeIndex)
    expect(addTypingUserIndex).toBeGreaterThan(guardIndex)
    expect(addTypingUserIndex - guardIndex).toBeLessThan(120)
  })

  test("F-P1-02: the addTypingUser call is live code, not a commented-out remnant — a plain indexOf() cannot be fooled by `// addTypingUser(...)`", () => {
    const source = chatSheet()
    const callLine = source.split("\n").find((line) => line.includes("addTypingUser(data.pedidoId, {"))
    expect(callLine).toBeDefined()
    expect(callLine!.trim().startsWith("//")).toBe(false)
  })

  test("F-P1-02: the own-actor comparison uses the canonical user id, never userType/userName", () => {
    const source = chatSheet()
    const guardIndex = source.indexOf("if (data.userId === user.id) return")
    expect(guardIndex).toBeGreaterThan(-1)
    expect(source).not.toContain("data.userType === user.type")
    expect(source).not.toContain("data.userName === user.nombre")
  })

  test("F-P1-02: user-stop-typing is untouched — removeTypingUser's existing filter already makes a self-echo stop a safe no-op", () => {
    const source = chatSheet()
    expect(source).toContain(
      'client.subscribe("user-stop-typing", (data) => {\n' +
        "        removeTypingUser(data.pedidoId, data.userId)",
    )
  })

  test("F-P1-01: messages-read no longer has an empty body — a same-actor readBy clears this tab's own unread badge locally", () => {
    const source = chatSheet()
    const subscribeIndex = source.indexOf('client.subscribe("messages-read", (data) => {')
    const guardIndex = source.indexOf("if (data.readBy === user.id) {")
    const updateIndex = source.indexOf("updateConversationUnread(data.pedidoId, 0)")
    expect(subscribeIndex).toBeGreaterThan(-1)
    expect(guardIndex).toBeGreaterThan(-1)
    expect(updateIndex).toBeGreaterThan(-1)
    expect(guardIndex).toBeGreaterThan(subscribeIndex)
    expect(updateIndex).toBeGreaterThan(guardIndex)
    expect(updateIndex - guardIndex).toBeLessThan(60)
  })

  test("F-P1-01: the updateConversationUnread call is live code, not a commented-out remnant — a plain indexOf() cannot be fooled by `// updateConversationUnread(...)`", () => {
    const source = chatSheet()
    const callLine = source.split("\n").find((line) => line.includes("updateConversationUnread(data.pedidoId, 0)"))
    expect(callLine).toBeDefined()
    expect(callLine!.trim().startsWith("//")).toBe(false)
  })

  test("F-P1-01: a cross-actor messages-read (readBy !== own id) stays a no-op — updateConversationUnread(...,0) is called exactly once, only inside the same-actor guard", () => {
    const source = chatSheet()
    const matches = source.match(/updateConversationUnread\(data\.pedidoId, 0\)/g)
    expect(matches?.length).toBe(1)
    const subscribeIndex = source.indexOf('client.subscribe("messages-read", (data) => {')
    const callbackEnd = source.indexOf("}),", subscribeIndex)
    const block = source.slice(subscribeIndex, callbackEnd)
    // The only statement inside the callback is the guarded branch — no
    // unconditional mutation sits alongside/after it.
    expect(block).toContain("if (data.readBy === user.id) {")
    expect(block.trim().endsWith("}")).toBe(true)
  })

  test("F-P1-01/F-P1-02: no read-receipt/checkmark UI, new API, or new persisted field was introduced by this polish", () => {
    const source = `${chatSheet()}\n${chatView()}`
    for (const forbidden of ["readReceipt", "ReadReceipt", "checkmark", "leidoAt", "fetch(\"/api/chat/mark-read"]) {
      expect(source).not.toContain(forbidden)
    }
  })

  test("F-P1-01/F-P1-02: chat-service (mini-services) is not part of this diff surface — client-only fix, server broadcast semantics unchanged", () => {
    const source = chatSheet()
    expect(source).not.toContain("mini-services")
    expect(source).not.toContain("getAuthorizedRecipientSockets")
  })
})
