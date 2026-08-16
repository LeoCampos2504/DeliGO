import { describe, expect, test } from "bun:test"
import { RealtimeManager } from "@/lib/realtime-manager"
import type {
  RealtimeActorTokenResult,
  RealtimeCapabilityResult,
  RealtimeManagerDependencies,
  RealtimeSocketLike,
} from "@/lib/realtime-types"

type Listener = (...args: unknown[]) => void

class FakeSocket implements RealtimeSocketLike {
  connected = false
  readonly listeners = new Map<string, Set<Listener>>()
  readonly clientEvents: string[] = []

  on(event: string, handler: Listener): this {
    const handlers = this.listeners.get(event) || new Set<Listener>()
    handlers.add(handler)
    this.listeners.set(event, handlers)
    return this
  }

  off(event: string, handler?: Listener): this {
    if (!handler) {
      this.listeners.delete(event)
      return this
    }
    const handlers = this.listeners.get(event)
    handlers?.delete(handler)
    if (handlers?.size === 0) this.listeners.delete(event)
    return this
  }

  emit(event: string, ...args: unknown[]): boolean {
    this.clientEvents.push(event)
    if (event === "join-order-room") {
      const ack = args[1]
      if (typeof ack === "function") queueMicrotask(() => ack({ ok: true }))
    }
    return true
  }

  connect(): this {
    queueMicrotask(() => {
      this.connected = true
      this.emitFromServer("connect")
    })
    return this
  }

  disconnect(): this {
    const wasConnected = this.connected
    this.connected = false
    if (wasConnected) this.emitFromServer("disconnect")
    return this
  }

  emitFromServer(event: string, ...args: unknown[]): void {
    for (const handler of [...(this.listeners.get(event) || [])]) handler(...args)
  }

  listenerCount(event: string): number {
    return this.listeners.get(event)?.size || 0
  }
}

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function createHarness(overrides: Partial<RealtimeManagerDependencies> = {}) {
  const sockets: FakeSocket[] = []
  let actorTokenCalls = 0
  let capabilityCalls = 0
  const dependencies: RealtimeManagerDependencies = {
    getSocketUrl: () => "http://realtime.test",
    createSocket: () => {
      const socket = new FakeSocket()
      sockets.push(socket)
      return socket
    },
    fetchActorToken: async () => {
      actorTokenCalls += 1
      return { token: `actor-token-${actorTokenCalls}`, expiresIn: 300 }
    },
    authorizeRoom: async (pedidoId, scopes): Promise<RealtimeCapabilityResult> => {
      capabilityCalls += 1
      return { token: `capability-${pedidoId}-${capabilityCalls}`, scopes, expiresIn: 120 }
    },
    isOnline: () => true,
    isVisible: () => true,
    reconnectBaseMs: 1,
    reconnectMaxMs: 10,
    random: () => 0,
    ...overrides,
  }
  return {
    manager: new RealtimeManager(dependencies),
    sockets,
    get actorTokenCalls() { return actorTokenCalls },
    get capabilityCalls() { return capabilityCalls },
  }
}

const actor = { userId: "user-1", userType: "cliente" as const }

describe("RealtimeManager", () => {
  test("shares the actor token request and creates one physical socket", async () => {
    let resolveToken: ((result: RealtimeActorTokenResult) => void) | undefined
    const harness = createHarness({
      fetchActorToken: () => new Promise((resolve) => { resolveToken = resolve }),
    })
    harness.manager.setActor(actor)

    const pending = Array.from({ length: 10 }, () => harness.manager.ensureConnected())
    expect(pending.every((promise) => promise === pending[0])).toBe(true)
    expect(harness.actorTokenCalls).toBe(0)
    resolveToken?.({ token: "actor-token", expiresIn: 300 })
    await Promise.all(pending)

    expect(harness.actorTokenCalls).toBe(0)
    expect(harness.sockets).toHaveLength(1)
    expect(harness.manager.getConnectionState()).toBe("connected")
    harness.manager.stop()
  })

  test("keeps the subscription registry behind one physical listener per event", async () => {
    const harness = createHarness()
    harness.manager.setActor(actor)
    await harness.manager.ensureConnected()
    const socket = harness.sockets[0]
    const received: string[] = []
    const unsubscribeOne = harness.manager.getClient().subscribe("new-message", () => received.push("one"))
    const unsubscribeTwo = harness.manager.getClient().subscribe("new-message", () => received.push("two"))
    const unsubscribeThrowing = harness.manager.getClient().subscribe("new-message", () => { throw new Error("consumer failure") })

    expect(socket.listenerCount("new-message")).toBe(1)
    socket.emitFromServer("new-message", { id: "m1" })
    expect(received).toEqual(["one", "two"])
    unsubscribeOne()
    socket.emitFromServer("new-message", { id: "m2" })
    expect(received).toEqual(["one", "two", "two"])
    unsubscribeTwo()
    unsubscribeThrowing()
    unsubscribeThrowing()
    expect(socket.listenerCount("new-message")).toBe(0)
    harness.manager.stop()
  })

  test("unions room scopes and leaves only after the final lease is released", async () => {
    const harness = createHarness()
    harness.manager.setActor(actor)
    const first = await harness.manager.getClient().acquireOrderRoom("pedido-1", ["chat:read"])
    const second = await harness.manager.getClient().acquireOrderRoom("pedido-1", ["chat:typing"])

    expect(harness.capabilityCalls).toBe(2)
    const socket = harness.sockets[0]
    expect(socket.clientEvents.filter((event) => event === "join-order-room")).toHaveLength(2)
    first.release()
    expect(socket.clientEvents.filter((event) => event === "leave-order-room")).toHaveLength(0)
    second.release()
    expect(socket.clientEvents.filter((event) => event === "leave-order-room")).toHaveLength(1)
    harness.manager.stop()
  })

  test("coalesces duplicate leases in one room generation", async () => {
    let resolveCapability: ((result: RealtimeCapabilityResult) => void) | undefined
    let capabilityCalls = 0
    const harness = createHarness({
      authorizeRoom: () => {
        capabilityCalls += 1
        return new Promise((resolve) => { resolveCapability = resolve })
      },
    })
    harness.manager.setActor(actor)
    const first = harness.manager.getClient().acquireOrderRoom("pedido-2", ["chat:read"])
    await flush()
    const second = harness.manager.getClient().acquireOrderRoom("pedido-2", ["chat:read"])
    expect(capabilityCalls).toBe(1)
    resolveCapability?.({ token: "capability", expiresIn: 120 })
    await Promise.all([first, second])
    expect(capabilityCalls).toBe(1)
    expect(harness.sockets[0].clientEvents.filter((event) => event === "join-order-room")).toHaveLength(1)
    harness.manager.stop()
  })

  test("ignores a stale actor token when the actor epoch changes", async () => {
    let resolveToken: ((result: RealtimeActorTokenResult) => void) | undefined
    const harness = createHarness({
      fetchActorToken: () => new Promise((resolve) => { resolveToken = resolve }),
    })
    harness.manager.setActor(actor)
    const pending = harness.manager.ensureConnected()
    harness.manager.setActor({ userId: "user-2", userType: "negocio" })
    resolveToken?.({ token: "stale-token" })

    await expect(pending).rejects.toThrow("Stale realtime operation")
    expect(harness.sockets).toHaveLength(0)
    expect(harness.manager.getConnectionSnapshot().actor?.userId).toBe("user-2")
    harness.manager.stop()
  })

  test("aborts a pending socket connect when the actor stops", async () => {
    let pendingSocket: FakeSocket | undefined
    const harness = createHarness({
      createSocket: () => {
        pendingSocket = new FakeSocket()
        pendingSocket.connect = () => pendingSocket as FakeSocket
        return pendingSocket
      },
    })
    harness.manager.setActor(actor)
    const pending = harness.manager.ensureConnected()
    await flush()
    harness.manager.stop("logout")

    await expect(pending).rejects.toThrow("Realtime connection aborted")
  })

  test("reauthenticates once and re-establishes the room after auth expiry", async () => {
    const harness = createHarness()
    harness.manager.setActor(actor)
    const lease = await harness.manager.getClient().acquireOrderRoom("pedido-3", ["chat:read"])
    const firstSocket = harness.sockets[0]
    const received: string[] = []
    const unsubscribe = harness.manager.getClient().subscribe("new-message", () => received.push("message"))
    firstSocket.emitFromServer("realtime-auth-expired", { code: "TOKEN_EXPIRED" })
    firstSocket.emitFromServer("realtime-auth-expired", { code: "TOKEN_EXPIRED" })
    firstSocket.emitFromServer("disconnect")
    await flush()
    await flush()

    expect(harness.actorTokenCalls).toBe(2)
    expect(harness.sockets).toHaveLength(2)
    expect(harness.manager.getConnectionState()).toBe("connected")
    expect(harness.sockets[1].clientEvents.filter((event) => event === "join-order-room")).toHaveLength(1)
    firstSocket.emitFromServer("new-message", { id: "stale" })
    expect(received).toEqual([])
    lease.release()
    unsubscribe()
    harness.manager.stop()
  })

  test("rejects token failure without creating a socket", async () => {
    const harness = createHarness({
      fetchActorToken: async () => { throw new Error("token rejected") },
    })
    harness.manager.setActor(actor)

    await expect(harness.manager.ensureConnected()).rejects.toThrow("token rejected")
    expect(harness.sockets).toHaveLength(0)
    expect(harness.manager.getConnectionState()).toBe("error")
    harness.manager.stop()
  })

  test("rejects a failed scope upgrade while preserving the prior lease", async () => {
    const harness = createHarness({
      authorizeRoom: async (pedidoId, scopes) => {
        if (scopes.includes("tracking:watch")) throw new Error("upgrade rejected")
        return { token: `chat-${pedidoId}`, scopes, expiresIn: 120 }
      },
    })
    harness.manager.setActor(actor)
    const chatLease = await harness.manager.getClient().acquireOrderRoom("pedido-upgrade", ["chat:read"])

    await expect(harness.manager.getClient().acquireOrderRoom("pedido-upgrade", ["tracking:watch"]))
      .rejects.toThrow("upgrade rejected")
    const duplicateChatLease = await harness.manager.getClient().acquireOrderRoom("pedido-upgrade", ["chat:read"])
    expect(harness.sockets[0].clientEvents.filter((event) => event === "join-order-room")).toHaveLength(1)
    duplicateChatLease.release()
    chatLease.release()
    harness.manager.stop()
  })

  test("fails closed on a failed scope downgrade and retries without the old grant", async () => {
    let failDowngrade = false
    const harness = createHarness({
      authorizeRoom: async (pedidoId, scopes) => {
        if (failDowngrade && scopes.length === 1 && scopes[0] === "tracking:watch") {
          throw new Error("downgrade unavailable")
        }
        return { token: `capability-${pedidoId}-${scopes.join("-")}`, scopes, expiresIn: 120 }
      },
    })
    harness.manager.setActor(actor)
    const chatLease = await harness.manager.getClient().acquireOrderRoom("pedido-downgrade", ["chat:read"])
    const trackingLease = await harness.manager.getClient().acquireOrderRoom("pedido-downgrade", ["tracking:watch"])
    failDowngrade = true
    chatLease.release()
    await flush()

    const socket = harness.sockets[0]
    expect(socket.clientEvents.filter((event) => event === "leave-order-room")).toHaveLength(1)
    trackingLease.release()
    harness.manager.stop()
  })

  test("uses a bounded refresh delay when capability TTL is shorter than the margin", async () => {
    const activeTimers = new Map<number, { handler: () => void; timeout: number }>()
    let nextTimer = 0
    const harness = createHarness({
      authorizeRoom: async (pedidoId, scopes) => ({ token: `short-${pedidoId}`, scopes, expiresIn: 1 }),
      setTimeout: (handler, timeout) => {
        const id = ++nextTimer
        activeTimers.set(id, { handler, timeout })
        return id as unknown as ReturnType<typeof setTimeout>
      },
      clearTimeout: (handle) => { activeTimers.delete(handle as unknown as number) },
    })
    harness.manager.setActor(actor)
    const lease = await harness.manager.getClient().acquireOrderRoom("pedido-refresh", ["chat:read"])

    const refreshTimer = [...activeTimers.values()].find((timer) => timer.timeout !== 10000)
    expect(refreshTimer?.timeout).toBeGreaterThanOrEqual(250)
    lease.release()
    harness.manager.stop()
  })

  test("coalesces resync requests and pauses reconnect scheduling while offline or hidden", async () => {
    let resyncCalls = 0
    let online = true
    let visible = true
    const timers: Array<() => void> = []
    const harness = createHarness({
      isOnline: () => online,
      isVisible: () => visible,
      setTimeout: (handler) => {
        timers.push(handler)
        return timers.length as unknown as ReturnType<typeof setTimeout>
      },
      clearTimeout: () => undefined,
    })
    harness.manager.setActor(actor)
    const unregister = harness.manager.getClient().registerResync(async () => { resyncCalls += 1 })
    await harness.manager.ensureConnected()
    await Promise.all([
      harness.manager.getClient().requestResync("manual"),
      harness.manager.getClient().requestResync("suspected-gap"),
    ])
    expect(resyncCalls).toBe(2)

    online = false
    harness.manager.handleOffline()
    visible = false
    harness.sockets[0].emitFromServer("disconnect")
    expect(timers).toHaveLength(0)
    online = true
    visible = true
    unregister()
    harness.manager.stop()
  })
})
