import { describe, expect, test } from "bun:test"
import { RealtimeManager } from "@/lib/realtime-manager"
import type {
  RealtimeActorTokenResult,
  RealtimeCapabilityResult,
  RealtimeChatMessagePayload,
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
const repartidorActor = { userId: "repartidor-1", userType: "repartidor" as const }
const negocioActor = { userId: "negocio-1", userType: "negocio" as const }

describe("RealtimeManager", () => {
  test("caches snapshots and notifies only when observable state changes", async () => {
    const harness = createHarness()
    const initial = harness.manager.getConnectionSnapshot()
    expect(Object.is(initial, harness.manager.getConnectionSnapshot())).toBe(true)
    expect(Object.isFrozen(initial)).toBe(true)

    let notifications = 0
    const notifiedSnapshots: unknown[] = []
    const unsubscribe = harness.manager.subscribeState(() => {
      notifications += 1
      notifiedSnapshots.push(harness.manager.getConnectionSnapshot())
    })

    harness.manager.setActor(actor)
    const actorSnapshot = harness.manager.getConnectionSnapshot()
    expect(Object.is(initial, actorSnapshot)).toBe(false)
    expect(Object.is(actorSnapshot, harness.manager.getConnectionSnapshot())).toBe(true)
    expect(notifications).toBe(2)
    expect(notifiedSnapshots[1]).toBe(actorSnapshot)

    harness.manager.setActor(actor)
    expect(notifications).toBe(2)
    expect(Object.is(actorSnapshot, harness.manager.getConnectionSnapshot())).toBe(true)

    await harness.manager.ensureConnected()
    const connectedSnapshot = harness.manager.getConnectionSnapshot()
    expect(connectedSnapshot.socketGeneration).toBeGreaterThan(actorSnapshot.socketGeneration)
    expect(Object.is(actorSnapshot, connectedSnapshot)).toBe(false)
    expect(Object.is(connectedSnapshot, harness.manager.getConnectionSnapshot())).toBe(true)
    const notificationsAfterConnect = notifications
    expect(new Set(notifiedSnapshots).size).toBe(notifiedSnapshots.length)

    await harness.manager.ensureConnected()
    expect(notifications).toBe(notificationsAfterConnect)
    expect(Object.is(connectedSnapshot, harness.manager.getConnectionSnapshot())).toBe(true)

    harness.manager.stop()
    const stoppedSnapshot = harness.manager.getConnectionSnapshot()
    expect(Object.is(connectedSnapshot, stoppedSnapshot)).toBe(false)
    expect(Object.is(stoppedSnapshot, harness.manager.getConnectionSnapshot())).toBe(true)

    const notificationsBeforeUnsubscribe = notifications
    unsubscribe()
    harness.manager.setActor(actor)
    expect(notifications).toBe(notificationsBeforeUnsubscribe)
  })

  test("keeps snapshot caches isolated per manager and actor transitions coherent", () => {
    const first = createHarness().manager
    const second = createHarness().manager
    expect(Object.is(first.getConnectionSnapshot(), second.getConnectionSnapshot())).toBe(false)

    first.setActor({ userId: "user-a", userType: "cliente" })
    const actorASnapshot = first.getConnectionSnapshot()
    first.setActor({ userId: "user-b", userType: "negocio" })
    const actorBSnapshot = first.getConnectionSnapshot()

    expect(actorBSnapshot.actor).toEqual({ userId: "user-b", userType: "negocio" })
    expect(actorASnapshot.actor).toEqual({ userId: "user-a", userType: "cliente" })
    expect(Object.is(actorASnapshot, actorBSnapshot)).toBe(false)
    expect(Object.is(actorBSnapshot, first.getConnectionSnapshot())).toBe(true)
    first.stop()
    second.stop()
  })

  test("publishes connection errors and clears them on stop", async () => {
    const harness = createHarness({
      fetchActorToken: async () => { throw new Error("token failure") },
    })
    harness.manager.setActor(actor)
    const beforeFailure = harness.manager.getConnectionSnapshot()

    await harness.manager.ensureConnected().catch(() => {})
    const failureSnapshot = harness.manager.getConnectionSnapshot()
    expect(failureSnapshot.state).toBe("error")
    expect(failureSnapshot.error).toBe("token failure")
    expect(Object.is(beforeFailure, failureSnapshot)).toBe(false)
    expect(Object.is(failureSnapshot, harness.manager.getConnectionSnapshot())).toBe(true)

    harness.manager.stop()
    const stoppedSnapshot = harness.manager.getConnectionSnapshot()
    expect(stoppedSnapshot.state).toBe("stopped")
    expect(stoppedSnapshot.error).toBeNull()
    expect(Object.is(failureSnapshot, stoppedSnapshot)).toBe(false)
    expect(Object.is(stoppedSnapshot, harness.manager.getConnectionSnapshot())).toBe(true)
  })

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

  test("chat commands require the shared room grant and preserve the legacy producer event", async () => {
    const harness = createHarness()
    const client = harness.manager.getClient()
    const message: RealtimeChatMessagePayload = {
      id: "message-1",
      pedidoId: "pedido-commands",
      remitente: "cliente",
      texto: "Hola",
      imagenUrl: null,
      archivoUrl: null,
      archivoNombre: null,
      archivoTipo: null,
      leido: false,
      fecha: new Date().toISOString(),
      clienteId: "cliente-1",
    }

    harness.manager.setActor(actor)
    expect(client.sendTyping("pedido-commands")).toBe(false)
    const lease = await client.acquireOrderRoom("pedido-commands", ["chat:read", "chat:typing"])
    const socket = harness.sockets[0]

    expect(client.sendTyping("pedido-commands")).toBe(true)
    expect(client.sendStopTyping("pedido-commands")).toBe(true)
    expect(client.markMessagesRead("pedido-commands")).toBe(true)
    expect(client.sendLegacyChatMessage("pedido-commands", message)).toBe(true)
    expect(harness.capabilityCalls).toBe(1)
    expect(socket.clientEvents).toEqual([
      "join-order-room",
      "typing",
      "stop-typing",
      "mark-read",
      "message-sent",
    ])

    lease.release()
    expect(client.sendTyping("pedido-commands")).toBe(false)
    harness.manager.stop()
  })

  test("legacy broadcast failure is best effort after HTTP authority succeeds", async () => {
    const harness = createHarness({
      createSocket: () => {
        const socket = new FakeSocket()
        const emit = socket.emit.bind(socket)
        socket.emit = (event, ...args) => {
          if (event === "message-sent") throw new Error("transport unavailable")
          return emit(event, ...args)
        }
        return socket
      },
    })
    harness.manager.setActor(actor)
    const lease = await harness.manager.getClient().acquireOrderRoom("pedido-best-effort", ["chat:read"])
    const sent = harness.manager.getClient().sendLegacyChatMessage("pedido-best-effort", {
      id: "message-best-effort",
      pedidoId: "pedido-best-effort",
      remitente: "cliente",
      texto: "persisted",
      imagenUrl: null,
      archivoUrl: null,
      archivoNombre: null,
      archivoTipo: null,
      leido: false,
      fecha: new Date().toISOString(),
      clienteId: "cliente-1",
    })
    expect(sent).toBe(false)
    lease.release()
    harness.manager.stop()
  })

  test("tracking:publish command requires the shared room grant and preserves the legacy producer event", async () => {
    const harness = createHarness()
    const client = harness.manager.getClient()
    const location = { lat: -26.18, lng: -58.17, timestamp: new Date().toISOString() }

    harness.manager.setActor(repartidorActor)
    expect(client.sendTrackingLocation("pedido-tracking-commands", location)).toBe(false)
    const lease = await client.acquireOrderRoom("pedido-tracking-commands", ["tracking:publish"])
    const socket = harness.sockets[0]

    expect(client.sendTrackingLocation("pedido-tracking-commands", location)).toBe(true)
    expect(harness.capabilityCalls).toBe(1)
    expect(socket.clientEvents).toEqual(["join-order-room", "location-update"])

    lease.release()
    expect(client.sendTrackingLocation("pedido-tracking-commands", location)).toBe(false)
    harness.manager.stop()
  })

  test("tracking:publish is scoped per pedido and does not leak to an unleased room", async () => {
    const harness = createHarness()
    const client = harness.manager.getClient()
    const location = { lat: -26.18, lng: -58.17, timestamp: new Date().toISOString() }

    harness.manager.setActor(repartidorActor)
    const lease = await client.acquireOrderRoom("pedido-leased", ["tracking:publish"])

    expect(client.sendTrackingLocation("pedido-not-leased", location)).toBe(false)
    expect(client.sendTrackingLocation("pedido-leased", location)).toBe(true)

    lease.release()
    harness.manager.stop()
  })

  test("tracking:publish command rejects a room leased only for a different scope", async () => {
    const harness = createHarness()
    const client = harness.manager.getClient()
    const location = { lat: -26.18, lng: -58.17, timestamp: new Date().toISOString() }

    harness.manager.setActor(repartidorActor)
    const watchLease = await client.acquireOrderRoom("pedido-watch-only", ["tracking:watch"])
    expect(client.sendTrackingLocation("pedido-watch-only", location)).toBe(false)

    watchLease.release()
    harness.manager.stop()
  })

  test("tracking:publish command fails closed once the transport disconnects", async () => {
    const harness = createHarness()
    const client = harness.manager.getClient()
    const location = { lat: -26.18, lng: -58.17, timestamp: new Date().toISOString() }

    harness.manager.setActor(repartidorActor)
    const lease = await client.acquireOrderRoom("pedido-disconnect", ["tracking:publish"])
    expect(client.sendTrackingLocation("pedido-disconnect", location)).toBe(true)

    harness.sockets[0].disconnect()
    expect(client.sendTrackingLocation("pedido-disconnect", location)).toBe(false)

    lease.release()
    harness.manager.stop()
  })

  test("tracking:publish broadcast failure is best effort after HTTP authority succeeds", async () => {
    const harness = createHarness({
      createSocket: () => {
        const socket = new FakeSocket()
        const emit = socket.emit.bind(socket)
        socket.emit = (event, ...args) => {
          if (event === "location-update") throw new Error("transport unavailable")
          return emit(event, ...args)
        }
        return socket
      },
    })
    harness.manager.setActor(repartidorActor)
    const lease = await harness.manager.getClient().acquireOrderRoom("pedido-tracking-best-effort", ["tracking:publish"])
    const sent = harness.manager.getClient().sendTrackingLocation("pedido-tracking-best-effort", {
      lat: -26.18,
      lng: -58.17,
      timestamp: new Date().toISOString(),
    })
    expect(sent).toBe(false)
    lease.release()
    harness.manager.stop()
  })

  test("disconnects after a bounded zero-demand grace and preserves a future second scope", async () => {
    const activeTimers = new Map<number, { handler: () => void; timeout: number }>()
    let nextTimer = 0
    const harness = createHarness({
      idleDisconnectGraceMs: 5000,
      setTimeout: (handler, timeout) => {
        const id = ++nextTimer
        activeTimers.set(id, { handler: () => { activeTimers.delete(id); handler() }, timeout })
        return id as unknown as ReturnType<typeof setTimeout>
      },
      clearTimeout: (handle) => { activeTimers.delete(handle as unknown as number) },
    })
    harness.manager.setActor(actor)
    const client = harness.manager.getClient()
    const chatLease = await client.acquireOrderRoom("pedido-idle", ["chat:read", "chat:typing"])
    const trackingLease = await client.acquireOrderRoom("pedido-idle", ["tracking:watch"])
    const socket = harness.sockets[0]

    chatLease.release()
    expect(socket.connected).toBe(true)
    expect([...activeTimers.values()].some((timer) => timer.timeout === 5000)).toBe(false)

    trackingLease.release()
    const idleTimer = [...activeTimers.values()].find((timer) => timer.timeout === 5000)
    expect(idleTimer).toBeDefined()
    idleTimer?.handler()
    expect(socket.connected).toBe(false)
    expect(client.getConnectionState()).toBe("idle")
    expect(activeTimers.size).toBe(0)

    const reopenedLease = await client.acquireOrderRoom("pedido-idle", ["chat:read"])
    expect(harness.sockets).toHaveLength(2)
    reopenedLease.release()
    harness.manager.stop()
  })

  test("aborted room acquisition invalidates the generation before a stale join", async () => {
    let resolveCapability: ((result: RealtimeCapabilityResult) => void) | undefined
    const harness = createHarness({
      authorizeRoom: () => new Promise((resolve) => { resolveCapability = resolve }),
    })
    const controller = new AbortController()
    harness.manager.setActor(actor)
    const pending = harness.manager.getClient().acquireOrderRoom(
      "pedido-aborted",
      ["chat:read", "chat:typing"],
      { signal: controller.signal },
    )
    await flush()
    controller.abort()
    await expect(pending).rejects.toThrow("Realtime room lease aborted")
    resolveCapability?.({ token: "stale-capability", scopes: ["chat:read", "chat:typing"] })
    await flush()
    await flush()

    expect(harness.sockets[0].clientEvents.filter((event) => event === "join-order-room")).toHaveLength(0)
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
    const lease = await harness.manager.getClient().acquireOrderRoom("pedido-3", ["chat:read", "chat:typing"])
    const firstSocket = harness.sockets[0]
    const received: string[] = []
    const typingReceived: string[] = []
    const unsubscribe = harness.manager.getClient().subscribe("new-message", (msg) => received.push(msg.id ?? "unknown"))
    const unsubscribeTyping = harness.manager.getClient().subscribe("user-typing", () => typingReceived.push("typing"))

    // T1 (first socket event delivery) — the generation the whole rest of
    // this test's reconnects are measured against.
    firstSocket.emitFromServer("new-message", { id: "gen1" })
    expect(received).toEqual(["gen1"])

    firstSocket.emitFromServer("realtime-auth-expired", { code: "TOKEN_EXPIRED" })
    firstSocket.emitFromServer("realtime-auth-expired", { code: "TOKEN_EXPIRED" })
    firstSocket.emitFromServer("disconnect")
    await flush()
    await flush()

    expect(harness.actorTokenCalls).toBe(2)
    expect(harness.sockets).toHaveLength(2)
    expect(harness.manager.getConnectionState()).toBe("connected")
    expect(harness.sockets[1].clientEvents.filter((event) => event === "join-order-room")).toHaveLength(1)
    // T8 — the replaced (stale) socket can never deliver again.
    firstSocket.emitFromServer("new-message", { id: "stale" })
    expect(received).toEqual(["gen1"])

    // T2/T9 — a brand-new socket after a same-actor auth-expiry reconnect
    // delivers exactly like the first one (P2-T18-R3's confirmed-correct
    // regression guard — this must never flip to FAIL).
    const secondSocket = harness.sockets[1]
    expect(secondSocket.listenerCount("new-message")).toBe(1)
    secondSocket.emitFromServer("new-message", { id: "gen2" })
    expect(received).toEqual(["gen1", "gen2"])
    // T10 — typing survives the same reconnect via the same relay mechanism.
    secondSocket.emitFromServer("user-typing", { userId: "other", pedidoId: "pedido-3" })
    expect(typingReceived).toEqual(["typing"])

    // T3 — a THIRD generation (another same-actor auth-expiry cycle) keeps
    // delivering; the old (second) socket goes stale exactly like the first.
    secondSocket.emitFromServer("realtime-auth-expired", { code: "TOKEN_EXPIRED" })
    secondSocket.emitFromServer("realtime-auth-expired", { code: "TOKEN_EXPIRED" })
    secondSocket.emitFromServer("disconnect")
    await flush()
    await flush()

    expect(harness.sockets).toHaveLength(3)
    const thirdSocket = harness.sockets[2]
    expect(thirdSocket.listenerCount("new-message")).toBe(1)
    secondSocket.emitFromServer("new-message", { id: "stale-gen2" })
    expect(received).toEqual(["gen1", "gen2"])
    thirdSocket.emitFromServer("new-message", { id: "gen3" })
    expect(received).toEqual(["gen1", "gen2", "gen3"])

    lease.release()
    unsubscribe()
    unsubscribeTyping()
    harness.manager.stop()
  })

  test("P2-T18-R1: an incoming actor's subscription survives stop(\"actor-change\") even when the outgoing actor's teardown races it", async () => {
    // Reproduces the exact real-world ordering: ChatSheet (a child of
    // RealtimeProvider) unsubscribes the outgoing actor and subscribes the
    // incoming actor in its own effect BEFORE RealtimeProvider's effect
    // calls manager.setActor() — see P2_T18_SOCKET_REGENERATION_EVENT_
    // RELAY_DIAGNOSTIC_R3.md section J. Before the fix, setActor's
    // stop("actor-change") unconditionally cleared `subscriptions`,
    // discarding the incoming actor's just-added handler.
    const harness = createHarness()
    harness.manager.setActor(negocioActor)
    await harness.manager.ensureConnected()
    const negocioReceived: string[] = []
    const negocioUnsub = harness.manager.getClient().subscribe("new-message", () => negocioReceived.push("negocio"))
    await flush()

    // Child effect: cleanup old actor's handler, subscribe new actor's handler.
    negocioUnsub()
    const clienteReceived: string[] = []
    const clienteUnsub = harness.manager.getClient().subscribe("new-message", () => clienteReceived.push("cliente"))

    // Parent effect (runs after, per React's child-before-parent ordering).
    harness.manager.setActor(actor)
    await harness.manager.ensureConnected()
    await flush()

    const newSocket = harness.sockets[harness.sockets.length - 1]
    expect(newSocket.listenerCount("new-message")).toBe(1)
    newSocket.emitFromServer("new-message", { id: "post-switch" })

    expect(negocioReceived).toEqual([])
    expect(clienteReceived).toEqual(["cliente"])

    clienteUnsub()
    harness.manager.stop()
  })

  test("P2-T18-R1: actor switch survives the reverse ordering (setActor before the consumer resubscribes)", async () => {
    const harness = createHarness()
    harness.manager.setActor(negocioActor)
    await harness.manager.ensureConnected()
    const negocioReceived: string[] = []
    const negocioUnsub = harness.manager.getClient().subscribe("new-message", () => negocioReceived.push("negocio"))
    await flush()

    // Parent effect runs first this time.
    harness.manager.setActor(actor)
    // Consumer's own effect cleanup/setup runs after.
    negocioUnsub()
    const clienteReceived: string[] = []
    const clienteUnsub = harness.manager.getClient().subscribe("new-message", () => clienteReceived.push("cliente"))
    await harness.manager.ensureConnected()
    await flush()

    const newSocket = harness.sockets[harness.sockets.length - 1]
    expect(newSocket.listenerCount("new-message")).toBe(1)
    newSocket.emitFromServer("new-message", { id: "post-switch-reverse" })

    expect(negocioReceived).toEqual([])
    expect(clienteReceived).toEqual(["cliente"])

    clienteUnsub()
    harness.manager.stop()
  })

  test("logout (setActor(null)) still fully clears subscriptions and resync handlers", async () => {
    const harness = createHarness()
    harness.manager.setActor(actor)
    await harness.manager.ensureConnected()
    harness.manager.getClient().subscribe("new-message", () => {})
    harness.manager.getClient().registerResync(() => {})
    expect((harness.manager as unknown as { subscriptions: Map<string, unknown> }).subscriptions.size).toBe(1)
    expect((harness.manager as unknown as { resyncHandlers: Set<unknown> }).resyncHandlers.size).toBe(1)

    harness.manager.setActor(null)

    expect((harness.manager as unknown as { subscriptions: Map<string, unknown> }).subscriptions.size).toBe(0)
    expect((harness.manager as unknown as { resyncHandlers: Set<unknown> }).resyncHandlers.size).toBe(0)
  })

  test("provider-unmount and session-invalid still fully clear subscriptions", async () => {
    for (const reason of ["provider-unmount", "session-invalid"] as const) {
      const harness = createHarness()
      harness.manager.setActor(actor)
      await harness.manager.ensureConnected()
      harness.manager.getClient().subscribe("new-message", () => {})
      expect((harness.manager as unknown as { subscriptions: Map<string, unknown> }).subscriptions.size).toBe(1)

      harness.manager.stop(reason)

      expect((harness.manager as unknown as { subscriptions: Map<string, unknown> }).subscriptions.size).toBe(0)
    }
  })

  test("P2-T18-R1: tracking's repartidor-location relay survives the same actor-switch race as chat", async () => {
    const harness = createHarness()
    harness.manager.setActor(negocioActor)
    await harness.manager.ensureConnected()
    const negocioReceived: string[] = []
    const negocioUnsub = harness.manager.getClient().subscribe("repartidor-location", () => negocioReceived.push("negocio"))
    await flush()

    negocioUnsub()
    const clienteReceived: string[] = []
    const clienteUnsub = harness.manager.getClient().subscribe("repartidor-location", () => clienteReceived.push("cliente"))
    harness.manager.setActor(actor)
    await harness.manager.ensureConnected()
    await flush()

    const newSocket = harness.sockets[harness.sockets.length - 1]
    expect(newSocket.listenerCount("repartidor-location")).toBe(1)
    newSocket.emitFromServer("repartidor-location", { pedidoId: "pedido-track", lat: 0, lng: 0, timestamp: "now" })

    expect(negocioReceived).toEqual([])
    expect(clienteReceived).toEqual(["cliente"])

    clienteUnsub()
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
    const timers: Array<{ handler: () => void; timeout: number }> = []
    const harness = createHarness({
      isOnline: () => online,
      isVisible: () => visible,
      setTimeout: (handler, timeout) => {
        timers.push({ handler, timeout })
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
    expect(timers.filter((timer) => timer.timeout !== 5000)).toHaveLength(0)
    online = true
    visible = true
    unregister()
    harness.manager.stop()
  })
})
