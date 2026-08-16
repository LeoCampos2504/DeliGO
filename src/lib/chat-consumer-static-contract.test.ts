import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const fromSrc = (relativePath: string) => resolve(import.meta.dir, "..", relativePath)
const chatSheet = () => readFileSync(fromSrc("components/chat/chat-sheet.tsx"), "utf8")
const chatView = () => readFileSync(fromSrc("components/chat/chat-view.tsx"), "utf8")
const chatProvider = () => readFileSync(fromSrc("providers/chat-provider.tsx"), "utf8")

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
    expect(source).toContain("client.sendLegacyChatMessage(pedidoId, data.mensaje)")
    expect(source).toContain("const isCurrentActor = useCallback")
    expect(source).toContain("controller.abort()")
    expect(source).toContain("{ signal: controller.signal }")
    expect(source).toContain('method: "POST"')
    expect(source).toContain("/api/chat/mensajes/${pedidoId}")
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
