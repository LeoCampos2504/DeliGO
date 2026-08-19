import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const fromSrc = (relativePath: string) => resolve(import.meta.dir, "..", relativePath)
const chatSheet = () => readFileSync(fromSrc("components/chat/chat-sheet.tsx"), "utf8")
const chatView = () => readFileSync(fromSrc("components/chat/chat-view.tsx"), "utf8")
const chatProvider = () => readFileSync(fromSrc("providers/chat-provider.tsx"), "utf8")
const chatFab = () => readFileSync(fromSrc("components/chat/chat-fab.tsx"), "utf8")
const conversationList = () => readFileSync(fromSrc("components/chat/conversation-list.tsx"), "utf8")

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
