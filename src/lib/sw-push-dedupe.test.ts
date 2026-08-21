import { beforeEach, describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import vm from "node:vm"

// Loads the REAL public/sw.js (not a reimplementation) into a minimal
// sandboxed VM context, so this test exercises the actual production
// Service Worker code for the D2 push-suppression registry. Only the
// `push` and `message` event handlers are exercised here — every other
// listener (install/activate/fetch/notificationclick) is registered but
// never invoked by this file, and is covered by the repo's existing SW
// tests (unchanged by D2).

interface SwHarness {
  listeners: Map<string, (event: unknown) => void>
  showNotificationCalls: Array<{ title: string; options: Record<string, unknown> }>
  skipWaitingCalls: number
  setNow: (ms: number) => void
}

function loadServiceWorker(): SwHarness {
  const source = readFileSync(resolve(import.meta.dir, "..", "..", "public", "sw.js"), "utf8")

  const listeners = new Map<string, (event: unknown) => void>()
  const showNotificationCalls: Array<{ title: string; options: Record<string, unknown> }> = []
  let skipWaitingCalls = 0
  let fakeNow = Date.now()

  class FakeDate extends Date {
    static now() {
      return fakeNow
    }
  }

  const selfObj: Record<string, unknown> = {
    addEventListener: (type: string, handler: (event: unknown) => void) => {
      listeners.set(type, handler)
    },
    skipWaiting: () => {
      skipWaitingCalls += 1
    },
    clients: { claim: async () => {}, matchAll: async () => [] },
    registration: {
      showNotification: (title: string, options: Record<string, unknown>) => {
        showNotificationCalls.push({ title, options })
        return Promise.resolve()
      },
    },
    crypto: globalThis.crypto,
    location: { origin: "https://example.test" },
  }
  selfObj.self = selfObj

  const context = vm.createContext({
    self: selfObj,
    Date: FakeDate,
    console,
    caches: {
      open: async () => ({
        keys: async () => [],
        addAll: async () => {},
        delete: async () => {},
        match: async () => undefined,
        put: async () => {},
      }),
    },
  })

  vm.runInContext(source, context, { filename: "sw.js" })

  return {
    listeners,
    showNotificationCalls,
    get skipWaitingCalls() {
      return skipWaitingCalls
    },
    setNow: (ms: number) => {
      fakeNow = ms
    },
  } as SwHarness
}

function fireMessage(sw: SwHarness, data: unknown) {
  const handler = sw.listeners.get("message")
  if (!handler) throw new Error("message listener was not registered")
  handler({ data })
}

function firePush(sw: SwHarness, payload: unknown) {
  const handler = sw.listeners.get("push")
  if (!handler) throw new Error("push listener was not registered")
  handler({
    data: { json: () => payload },
    waitUntil: (p: Promise<unknown>) => p,
  })
}

function chatPushPayload(messageId?: string, pedidoId = "pedido-1") {
  return {
    title: `Mensaje de Juan`,
    body: "hola",
    tag: `chat-${pedidoId}`,
    data: {
      type: "chat",
      pedidoId,
      ...(messageId ? { messageId } : {}),
    },
  }
}

let sw: SwHarness

beforeEach(() => {
  sw = loadServiceWorker()
})

describe("SW push-suppression registry (D2) — real public/sw.js", () => {
  test("T1: a chat push with no messageId at all is shown (fail-open default)", () => {
    firePush(sw, chatPushPayload(undefined))
    expect(sw.showNotificationCalls.length).toBe(1)
  })

  test("T2: a chat push for a messageId that was never marked presented is shown", () => {
    firePush(sw, chatPushPayload("msg-1"))
    expect(sw.showNotificationCalls.length).toBe(1)
  })

  test("T3: marking a messageId presented, then pushing for that SAME id, suppresses it", () => {
    fireMessage(sw, { type: "CHAT_MESSAGE_PRESENTED", messageId: "msg-1" })
    firePush(sw, chatPushPayload("msg-1"))
    expect(sw.showNotificationCalls.length).toBe(0)
  })

  test("T4: marking msg-1 presented does not suppress a push for a DIFFERENT messageId", () => {
    fireMessage(sw, { type: "CHAT_MESSAGE_PRESENTED", messageId: "msg-1" })
    firePush(sw, chatPushPayload("msg-2"))
    expect(sw.showNotificationCalls.length).toBe(1)
  })

  test("T5: suppression only ever applies to notifType === 'chat' — a non-chat type with the same messageId is always shown", () => {
    fireMessage(sw, { type: "CHAT_MESSAGE_PRESENTED", messageId: "msg-1" })
    firePush(sw, {
      title: "Nuevo pedido",
      body: "...",
      data: { type: "new_order", messageId: "msg-1" },
    })
    expect(sw.showNotificationCalls.length).toBe(1)
  })

  test("T6: TTL expiry — after 45001ms, a previously-marked message is no longer suppressed", () => {
    sw.setNow(1_000_000)
    fireMessage(sw, { type: "CHAT_MESSAGE_PRESENTED", messageId: "msg-1" })
    sw.setNow(1_000_000 + 45001)
    firePush(sw, chatPushPayload("msg-1"))
    expect(sw.showNotificationCalls.length).toBe(1)
  })

  test("T7: just under the TTL boundary, suppression still holds", () => {
    sw.setNow(2_000_000)
    fireMessage(sw, { type: "CHAT_MESSAGE_PRESENTED", messageId: "msg-1" })
    sw.setNow(2_000_000 + 44999)
    firePush(sw, chatPushPayload("msg-1"))
    expect(sw.showNotificationCalls.length).toBe(0)
  })

  test("T8: re-marking the same messageId refreshes its TTL rather than duplicating an entry", () => {
    sw.setNow(3_000_000)
    fireMessage(sw, { type: "CHAT_MESSAGE_PRESENTED", messageId: "msg-1" })
    sw.setNow(3_000_000 + 40000)
    fireMessage(sw, { type: "CHAT_MESSAGE_PRESENTED", messageId: "msg-1" })
    sw.setNow(3_000_000 + 40000 + 40000)
    firePush(sw, chatPushPayload("msg-1"))
    expect(sw.showNotificationCalls.length).toBe(0)
  })

  test("T9: malformed CHAT_MESSAGE_PRESENTED (missing messageId) is silently ignored and never throws", () => {
    expect(() => fireMessage(sw, { type: "CHAT_MESSAGE_PRESENTED" })).not.toThrow()
    firePush(sw, chatPushPayload("msg-1"))
    expect(sw.showNotificationCalls.length).toBe(1)
  })

  test("T10: malformed CHAT_MESSAGE_PRESENTED (non-string messageId) is silently ignored and never throws", () => {
    expect(() => fireMessage(sw, { type: "CHAT_MESSAGE_PRESENTED", messageId: 12345 })).not.toThrow()
  })

  test("T11: SKIP_WAITING messages still call skipWaiting(), unaffected by the D2 branch", () => {
    fireMessage(sw, { type: "SKIP_WAITING" })
    expect(sw.skipWaitingCalls).toBe(1)
  })

  test("T12: non-JSON push data still falls back to the existing generic notification", () => {
    const handler = sw.listeners.get("push")
    if (!handler) throw new Error("push listener missing")
    handler({
      data: {
        json: () => {
          throw new Error("not json")
        },
        text: () => "plain text body",
      },
      waitUntil: (p: Promise<unknown>) => p,
    })
    expect(sw.showNotificationCalls.length).toBe(1)
    expect(sw.showNotificationCalls[0].title).toBe("DeliGO")
  })

  test("T13: cap eviction — the 201st distinct presented message evicts the oldest (msg-0), which becomes suppressible again as 'not presented'", () => {
    for (let i = 0; i < 200; i++) {
      fireMessage(sw, { type: "CHAT_MESSAGE_PRESENTED", messageId: `msg-${i}` })
    }
    // All 200 are currently suppressed.
    firePush(sw, chatPushPayload("msg-0"))
    expect(sw.showNotificationCalls.length).toBe(0)

    // One more distinct id pushes the registry over its cap.
    fireMessage(sw, { type: "CHAT_MESSAGE_PRESENTED", messageId: "msg-200" })

    // msg-0 was the oldest insertion — it must have been evicted, so a push
    // for it is shown again (fail-open: eviction never silently keeps
    // suppressing past the cap).
    firePush(sw, chatPushPayload("msg-0"))
    expect(sw.showNotificationCalls.length).toBe(1)

    // The newest entries, including the 201st, remain suppressed.
    firePush(sw, chatPushPayload("msg-200"))
    firePush(sw, chatPushPayload("msg-199"))
    expect(sw.showNotificationCalls.length).toBe(1)
  })

  // T27 (frozen contract, exact sequence): a push for message E arrives
  // BEFORE any presentation marker — it must show (the OS push can
  // legitimately win the race against the socket-delivered, foreground-
  // committed message). The page later marks E as presented; that late
  // marker can NEVER retroactively hide the already-shown first Push (no
  // such SW API exists), but it MAY suppress a genuine SAME-message
  // redelivery arriving later within TTL. A different message F is
  // completely unaffected. Same sw instance throughout (no reset/
  // reinstantiation), interacting only through real SW events.
  test("T27: push-first -> late same-message marker -> same-message redelivery suppressed -> different-message fail-open", () => {
    // A. Push E arrives before any marker — must show.
    firePush(sw, chatPushPayload("msg-E"))
    expect(sw.showNotificationCalls.length).toBe(1)

    // B. The page marks E as presented AFTER that first Push already
    // fired. Nothing about this call can reduce the count above — there
    // is no SW API that retroactively hides an already-shown Push.
    fireMessage(sw, { type: "CHAT_MESSAGE_PRESENTED", messageId: "msg-E" })
    expect(sw.showNotificationCalls.length).toBe(1)

    // C. A second Push for the SAME message E, within TTL, is suppressed
    // — the legitimate case of a genuine redelivery.
    firePush(sw, chatPushPayload("msg-E"))
    expect(sw.showNotificationCalls.length).toBe(1)

    // D. A push for a DIFFERENT message F is completely unaffected by
    // E's marker — cross-message suppression must never happen.
    firePush(sw, chatPushPayload("msg-F"))
    expect(sw.showNotificationCalls.length).toBe(2)
  })
})
