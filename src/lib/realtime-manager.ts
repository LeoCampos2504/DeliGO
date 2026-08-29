import { io } from "socket.io-client"
import { authorizeRealtimeRoomResult, fetchRealtimeTokenResult, getRealtimeSocketUrl } from "@/lib/realtime-client"
import type { RealtimeScope } from "@/lib/realtime-policy"
import type {
  RealtimeActorIdentity,
  RealtimeActorTokenResult,
  RealtimeCapabilityResult,
  RealtimeClient,
  RealtimeConnectionSnapshot,
  RealtimeConnectionState,
  RealtimeChatMessagePayload,
  RealtimeEventHandler,
  RealtimeEventMap,
  RealtimeEventType,
  RealtimeManagerDependencies,
  RealtimeResyncHandler,
  RealtimeResyncReason,
  RealtimeRoomLease,
  RealtimeSocketLike,
  RealtimeSocketOptions,
  RealtimeStateListener,
  RealtimeStopReason,
  RealtimeTrackingLocationInput,
} from "@/lib/realtime-types"

const DEFAULT_CAPABILITY_TTL_SECONDS = 120
const DEFAULT_RECONNECT_BASE_MS = 1000
const DEFAULT_RECONNECT_MAX_MS = 30000
const DEFAULT_CAPABILITY_REFRESH_MARGIN_MS = 15000
const DEFAULT_SOCKET_CONNECT_TIMEOUT_MS = 20000
const ROOM_JOIN_TIMEOUT_MS = 10000
const MIN_CAPABILITY_REFRESH_DELAY_MS = 250
const CAPABILITY_RETRY_BASE_MS = 1000
const CAPABILITY_RETRY_MAX_MS = 30000
const DEFAULT_IDLE_DISCONNECT_GRACE_MS = 5000

const REALTIME_SCOPES: readonly RealtimeScope[] = [
  "chat:read",
  "chat:typing",
  "tracking:watch",
  "tracking:publish",
]

class RealtimeStaleOperationError extends Error {
  constructor() {
    super("Stale realtime operation")
    this.name = "RealtimeStaleOperationError"
  }
}

interface RoomRecord {
  pedidoId: string
  leases: Map<string, Set<RealtimeScope>>
  requestedScopes: RealtimeScope[]
  grantedScopes: RealtimeScope[]
  expiresAt: number
  joined: boolean
  roomGeneration: number
  capabilityPromise: Promise<void> | null
  capabilityKey: string | null
  capabilityGeneration: number
  refreshTimer: ReturnType<typeof setTimeout> | null
  capabilityRetryAttempt: number
}

interface SocketListener {
  event: string
  handler: (...args: unknown[]) => void
}

interface InternalRealtimeDependencies {
  createSocket: (url: string, options: RealtimeSocketOptions) => RealtimeSocketLike
  getSocketUrl: () => string
  fetchActorToken: (options?: { signal?: AbortSignal }) => Promise<RealtimeActorTokenResult>
  authorizeRoom: (
    pedidoId: string,
    scopes: RealtimeScope[],
    options?: { signal?: AbortSignal }
  ) => Promise<RealtimeCapabilityResult>
  now: () => number
  random: () => number
  setTimeout: (handler: () => void, timeout: number) => ReturnType<typeof setTimeout>
  clearTimeout: (handle: ReturnType<typeof setTimeout>) => void
  isOnline: () => boolean
  isVisible: () => boolean
  reconnectBaseMs: number
  reconnectMaxMs: number
  capabilityRefreshMarginMs: number
  socketConnectTimeoutMs: number
  idleDisconnectGraceMs: number
}

function defaultCreateSocket(url: string, options: RealtimeSocketOptions): RealtimeSocketLike {
  return io(url, options as never) as unknown as RealtimeSocketLike
}

function defaultSetTimeout(handler: () => void, timeout: number): ReturnType<typeof setTimeout> {
  return setTimeout(handler, timeout)
}

function defaultClearTimeout(handle: ReturnType<typeof setTimeout>): void {
  clearTimeout(handle)
}

function isScope(value: unknown): value is RealtimeScope {
  return typeof value === "string" && REALTIME_SCOPES.includes(value as RealtimeScope)
}

function normalizeScopes(scopes: readonly RealtimeScope[]): RealtimeScope[] {
  return [...new Set(scopes)].filter(isScope).sort()
}

function scopeKey(scopes: readonly RealtimeScope[]): string {
  return normalizeScopes(scopes).join("|")
}

function includesScopes(granted: readonly RealtimeScope[], requested: readonly RealtimeScope[]): boolean {
  const grantedSet = new Set(granted)
  return requested.every((scope) => grantedSet.has(scope))
}

function isStrictScopeDowngrade(granted: readonly RealtimeScope[], requested: readonly RealtimeScope[]): boolean {
  return granted.length > requested.length && includesScopes(granted, requested)
}

function actorKey(actor: RealtimeActorIdentity | null): string | null {
  return actor ? `${actor.userType}:${actor.userId}` : null
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "Realtime operation failed"
}

function errorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined
  const status = (error as { status?: unknown }).status
  return typeof status === "number" ? status : undefined
}

export class RealtimeManager {
  private readonly dependencies: InternalRealtimeDependencies
  private readonly stateListeners = new Set<RealtimeStateListener>()
  private readonly subscriptions = new Map<RealtimeEventType, Set<RealtimeEventHandler<RealtimeEventType>>>()
  private readonly resyncHandlers = new Set<RealtimeResyncHandler>()
  private readonly rooms = new Map<string, RoomRecord>()
  private readonly socketListeners: SocketListener[] = []
  private readonly socketRelayEvents = new Set<RealtimeEventType>()
  private readonly socketRelayHandlers = new Map<RealtimeEventType, (...args: unknown[]) => void>()
  private readonly client: RealtimeClient

  private actor: RealtimeActorIdentity | null = null
  private actorEpoch = 0
  private stopped = true
  private state: RealtimeConnectionState = "idle"
  private connectionError: string | null = null
  private connectionSnapshot: RealtimeConnectionSnapshot = Object.freeze({
    state: "idle",
    error: null,
    actor: null,
    actorEpoch: 0,
    socketGeneration: 0,
  })
  private socket: RealtimeSocketLike | null = null
  private socketGeneration = 0
  private leaseCounter = 0
  private reconnectAttempt = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectWakeScheduled = false
  private idleDisconnectTimer: ReturnType<typeof setTimeout> | null = null
  private tokenPromise: Promise<RealtimeActorTokenResult> | null = null
  private tokenAbortController: AbortController | null = null
  private connectPromise: Promise<void> | null = null
  private connectAbortController: AbortController | null = null
  private readonly capabilityAbortControllers = new Set<AbortController>()
  private reauthPromise: Promise<void> | null = null
  private resyncPromise: Promise<void> | null = null
  private resyncReason: RealtimeResyncReason | null = null

  constructor(dependencies: RealtimeManagerDependencies = {}) {
    this.dependencies = {
      createSocket: dependencies.createSocket || defaultCreateSocket,
      getSocketUrl: dependencies.getSocketUrl || getRealtimeSocketUrl,
      fetchActorToken: dependencies.fetchActorToken || fetchRealtimeTokenResult,
      authorizeRoom: dependencies.authorizeRoom || authorizeRealtimeRoomResult,
      now: dependencies.now || (() => Date.now()),
      random: dependencies.random || Math.random,
      setTimeout: dependencies.setTimeout || defaultSetTimeout,
      clearTimeout: dependencies.clearTimeout || defaultClearTimeout,
      isOnline: dependencies.isOnline || (() => typeof navigator === "undefined" || navigator.onLine),
      isVisible: dependencies.isVisible || (() => typeof document === "undefined" || document.visibilityState === "visible"),
      reconnectBaseMs: dependencies.reconnectBaseMs || DEFAULT_RECONNECT_BASE_MS,
      reconnectMaxMs: dependencies.reconnectMaxMs || DEFAULT_RECONNECT_MAX_MS,
      capabilityRefreshMarginMs: dependencies.capabilityRefreshMarginMs || DEFAULT_CAPABILITY_REFRESH_MARGIN_MS,
      socketConnectTimeoutMs: dependencies.socketConnectTimeoutMs || DEFAULT_SOCKET_CONNECT_TIMEOUT_MS,
      idleDisconnectGraceMs: dependencies.idleDisconnectGraceMs ?? DEFAULT_IDLE_DISCONNECT_GRACE_MS,
    }

    this.client = {
      getConnectionState: () => this.getConnectionState(),
      getConnectionError: () => this.getConnectionError(),
      getConnectionSnapshot: () => this.getConnectionSnapshot(),
      ensureConnected: () => this.ensureConnected(),
      acquireOrderRoom: (pedidoId, scopes, options) => this.acquireOrderRoom(pedidoId, scopes, options),
      subscribe: (event, handler) => this.subscribe(event, handler),
      sendTyping: (pedidoId) => this.sendTyping(pedidoId),
      sendStopTyping: (pedidoId) => this.sendStopTyping(pedidoId),
      markMessagesRead: (pedidoId) => this.markMessagesRead(pedidoId),
      sendLegacyChatMessage: (pedidoId, message) => this.sendLegacyChatMessage(pedidoId, message),
      sendTrackingLocation: (pedidoId, location) => this.sendTrackingLocation(pedidoId, location),
      registerResync: (handler) => this.registerResync(handler),
      requestResync: (reason) => this.requestResync(reason),
      stop: (reason) => this.stop(reason),
    }
  }

  getClient(): RealtimeClient {
    return this.client
  }

  getConnectionState(): RealtimeConnectionState {
    return this.state
  }

  getConnectionError(): string | null {
    return this.connectionError
  }

  getConnectionSnapshot(): RealtimeConnectionSnapshot {
    return this.connectionSnapshot
  }

  subscribeState(listener: RealtimeStateListener): () => void {
    this.stateListeners.add(listener)
    return () => this.stateListeners.delete(listener)
  }

  setActor(nextActor: RealtimeActorIdentity | null): void {
    if (actorKey(nextActor) === actorKey(this.actor) && !this.stopped) return

    this.stop(nextActor ? "actor-change" : "logout")
    this.actor = nextActor ? { ...nextActor } : null
    this.actorEpoch += 1
    this.stopped = !nextActor
    this.connectionError = null
    this.setState(nextActor ? "idle" : "stopped")
  }

  ensureConnected(): Promise<void> {
    if (!this.actor || this.stopped) return Promise.reject(new Error("Realtime actor unavailable"))
    if (!this.dependencies.isOnline()) {
      this.setState("offline")
      return Promise.reject(new Error("Realtime offline"))
    }
    if (this.socket?.connected && this.state === "connected") return Promise.resolve()
    if (this.connectPromise) return this.connectPromise

    const epoch = this.actorEpoch
    this.clearReconnectTimer()
    this.setState("connecting")
    this.connectPromise = this.connectForEpoch(epoch)
      .then(() => {
        if (this.isCurrentEpoch(epoch) && !this.hasGlobalRealtimeDemand()) this.scheduleIdleDisconnect()
      })
      .catch((error: unknown) => {
        if (this.isCurrentEpoch(epoch) && !(error instanceof RealtimeStaleOperationError)) {
          this.setConnectionFailure(error)
        }
        throw error
      })
      .finally(() => {
        if (this.isCurrentEpoch(epoch)) this.connectPromise = null
      })
    return this.connectPromise
  }

  async acquireOrderRoom(
    pedidoId: string,
    scopes: readonly RealtimeScope[],
    options: { signal?: AbortSignal } = {},
  ): Promise<RealtimeRoomLease> {
    const normalizedPedidoId = pedidoId.trim()
    const normalizedScopes = normalizeScopes(scopes)
    if (!normalizedPedidoId || normalizedScopes.length === 0) {
      throw new Error("Invalid realtime room lease")
    }
    if (options.signal?.aborted) throw new Error("Realtime room lease aborted")
    if (!this.actor || this.stopped) throw new Error("Realtime actor unavailable")

    this.clearIdleDisconnectTimer()
    const record = this.rooms.get(normalizedPedidoId) || this.createRoomRecord(normalizedPedidoId)
    const leaseId = `lease-${++this.leaseCounter}`
    let abortHandler: (() => void) | null = null
    const abortPromise = options.signal
      ? new Promise<never>((_, reject) => {
        abortHandler = () => reject(new Error("Realtime room lease aborted"))
        options.signal?.addEventListener("abort", abortHandler, { once: true })
      })
      : null
    const previousScopeKey = scopeKey(record.requestedScopes)
    record.leases.set(leaseId, new Set(normalizedScopes))
    record.requestedScopes = this.getRequestedScopes(record)
    if (scopeKey(record.requestedScopes) !== previousScopeKey) record.roomGeneration += 1

    try {
      if (abortPromise) await Promise.race([this.ensureConnected(), abortPromise])
      else await this.ensureConnected()
      const reconcilePromise = this.reconcileRoom(record, this.actorEpoch, this.socketGeneration, false)
      if (abortPromise) await Promise.race([reconcilePromise, abortPromise])
      else await reconcilePromise
      if (options.signal?.aborted) throw new Error("Realtime room lease aborted")
      return this.createLease(record, leaseId, normalizedScopes)
    } catch (error) {
      if (this.isCurrentRecord(record) && record.leases.has(leaseId)) {
        const previousScopeKey = scopeKey(record.requestedScopes)
        record.leases.delete(leaseId)
        record.requestedScopes = this.getRequestedScopes(record)
        const scopeChanged = scopeKey(record.requestedScopes) !== previousScopeKey
        if (scopeChanged) record.roomGeneration += 1
        if (record.leases.size === 0) {
          this.leaveRoom(record)
          this.deleteRoomRecord(record)
          this.scheduleIdleDisconnect()
        } else if (scopeChanged) {
          void this.reconcileRoom(record, this.actorEpoch, this.socketGeneration, false).catch(() => {})
        }
      }
      throw error
    } finally {
      if (abortHandler && options.signal) options.signal.removeEventListener("abort", abortHandler)
    }
  }

  sendTyping(pedidoId: string): boolean {
    return this.emitAuthorizedRoomEvent(pedidoId, "chat:typing", "typing")
  }

  sendStopTyping(pedidoId: string): boolean {
    return this.emitAuthorizedRoomEvent(pedidoId, "chat:typing", "stop-typing")
  }

  markMessagesRead(pedidoId: string): boolean {
    return this.emitAuthorizedRoomEvent(pedidoId, "chat:read", "mark-read")
  }

  sendLegacyChatMessage(pedidoId: string, message: RealtimeChatMessagePayload): boolean {
    const normalizedPedidoId = pedidoId.trim()
    if (!this.canEmitAuthorizedRoomEvent(normalizedPedidoId, "chat:read")) return false
    try {
      this.socket?.emit("message-sent", { pedidoId: normalizedPedidoId, message })
      return true
    } catch {
      return false
    }
  }

  sendTrackingLocation(pedidoId: string, location: RealtimeTrackingLocationInput): boolean {
    const normalizedPedidoId = pedidoId.trim()
    if (!this.canEmitAuthorizedRoomEvent(normalizedPedidoId, "tracking:publish")) return false
    try {
      this.socket?.emit("location-update", { pedidoId: normalizedPedidoId, ...location })
      return true
    } catch {
      return false
    }
  }

  subscribe<K extends RealtimeEventType>(event: K, handler: RealtimeEventHandler<K>): () => void {
    const handlers = this.subscriptions.get(event) || new Set<RealtimeEventHandler<RealtimeEventType>>()
    handlers.add(handler as RealtimeEventHandler<RealtimeEventType>)
    this.subscriptions.set(event, handlers)
    if (this.socket) this.attachEventRelay(this.socket, event)

    let active = true
    return () => {
      if (!active) return
      active = false
      handlers.delete(handler as RealtimeEventHandler<RealtimeEventType>)
      if (handlers.size === 0) this.subscriptions.delete(event)
      if (handlers.size === 0) this.detachEventRelay(event)
    }
  }

  registerResync(handler: RealtimeResyncHandler): () => void {
    this.resyncHandlers.add(handler)
    let active = true
    return () => {
      if (!active) return
      active = false
      this.resyncHandlers.delete(handler)
    }
  }

  requestResync(reason: RealtimeResyncReason): Promise<void> {
    if (!this.actor || this.stopped) return Promise.resolve()
    this.resyncReason = this.resyncReason || reason
    if (this.resyncPromise) return this.resyncPromise

    const epoch = this.actorEpoch
    this.resyncPromise = Promise.resolve()
      .then(async () => {
        if (!this.isCurrentEpoch(epoch)) return
        const currentReason = this.resyncReason || reason
        this.resyncReason = null
        const handlers = [...this.resyncHandlers]
        await Promise.allSettled(handlers.map((handler) => Promise.resolve(handler(currentReason))))
      })
      .finally(() => {
        if (this.isCurrentEpoch(epoch)) {
          this.resyncPromise = null
          this.resyncReason = null
        }
      })
    return this.resyncPromise
  }

  handleOnline(): void {
    if (!this.actor || this.stopped || !this.hasGlobalRealtimeDemand()) return
    this.scheduleWake("online")
  }

  handleOffline(): void {
    if (!this.actor || this.stopped) return
    this.clearReconnectTimer()
    this.setState("offline")
  }

  handleVisibilityChange(visible: boolean): void {
    if (!this.actor || this.stopped || !visible || !this.hasGlobalRealtimeDemand()) return
    this.scheduleWake("foreground")
  }

  stop(reason: RealtimeStopReason = "manual"): void {
    this.actorEpoch += 1
    this.stopped = true
    this.clearReconnectTimer()
    this.clearIdleDisconnectTimer()
    this.reconnectWakeScheduled = false
    this.abortPendingRequests()
    this.detachSocket(true)
    for (const record of this.rooms.values()) this.clearRoomTimer(record)
    this.rooms.clear()
    this.subscriptions.clear()
    this.resyncHandlers.clear()
    this.resyncPromise = null
    this.resyncReason = null
    this.connectPromise = null
    this.reauthPromise = null
    this.actor = null
    this.connectionError = reason === "session-invalid" ? "Realtime session invalid" : null
    this.setState("stopped")
  }

  private async connectForEpoch(epoch: number, tokenResult?: RealtimeActorTokenResult): Promise<void> {
    const actorToken = tokenResult || await this.getActorToken(epoch)
    if (!this.isCurrentEpoch(epoch)) throw new RealtimeStaleOperationError()

    const socketGeneration = ++this.socketGeneration
    this.emitState()
    this.detachSocket(true)
    const socket = this.dependencies.createSocket(this.dependencies.getSocketUrl(), {
      auth: { token: actorToken.token },
      autoConnect: false,
      reconnection: false,
      transports: ["websocket", "polling"],
      path: "/socket.io",
      timeout: this.dependencies.socketConnectTimeoutMs,
    })
    this.socket = socket
    const connectController = new AbortController()
    this.connectAbortController = connectController

    return new Promise<void>((resolve, reject) => {
      let settled = false
      const cleanup = () => {
        connectController.signal.removeEventListener("abort", onAbort)
        if (this.connectAbortController === connectController) this.connectAbortController = null
      }
      const finishResolve = () => {
        if (settled) return
        settled = true
        cleanup()
        resolve()
      }
      const finishReject = (error: unknown) => {
        if (settled) return
        settled = true
        cleanup()
        reject(error instanceof Error ? error : new Error("Realtime connection failed"))
      }
      const onAbort = () => finishReject(new Error("Realtime connection aborted"))
      connectController.signal.addEventListener("abort", onAbort, { once: true })

      const onConnect = () => {
        if (!this.isCurrentSocket(epoch, socketGeneration, socket)) {
          socket.disconnect()
          finishReject(new RealtimeStaleOperationError())
          return
        }
        void this.handleConnected(epoch, socketGeneration)
          .then(() => {
            finishResolve()
          })
          .catch(finishReject)
      }
      const onConnectError = (error: unknown) => {
        if (!this.isCurrentSocket(epoch, socketGeneration, socket)) return
        this.detachSocket(true)
        this.setConnectionFailure(error)
        this.scheduleReconnect()
        finishReject(error instanceof Error ? error : new Error("Realtime connection failed"))
      }
      const onDisconnect = () => {
        if (!this.isCurrentSocket(epoch, socketGeneration, socket) || this.stopped) return
        this.invalidateTransportGrants()
        if (!this.hasGlobalRealtimeDemand()) this.setState("idle")
        else if (!this.dependencies.isOnline()) this.setState("offline")
        else this.setState("reconnecting")
        this.scheduleReconnect()
        finishReject(new Error("Realtime socket disconnected"))
      }
      const onAuthExpired = () => {
        if (!this.isCurrentSocket(epoch, socketGeneration, socket)) return
        void this.reauthenticate(epoch, socketGeneration).catch(() => {})
      }

      this.addSocketListener(socket, "connect", onConnect)
      this.addSocketListener(socket, "connect_error", onConnectError)
      this.addSocketListener(socket, "disconnect", onDisconnect)
      this.addSocketListener(socket, "realtime-auth-expired", onAuthExpired)
      this.attachEventRelays(socket)

      try {
        socket.connect()
      } catch (error) {
        onConnectError(error)
      }
    })
  }

  private async handleConnected(epoch: number, socketGeneration: number): Promise<void> {
    if (!this.isCurrentEpoch(epoch) || !this.socket || this.socketGeneration !== socketGeneration) {
      throw new RealtimeStaleOperationError()
    }
    this.reconnectAttempt = 0
    this.connectionError = null
    this.setState("connected")
    await this.rejoinAllRooms(epoch, socketGeneration)
    await this.requestResync("initial-connect")
  }

  private async getActorToken(epoch: number, force = false): Promise<RealtimeActorTokenResult> {
    if (force) {
      this.tokenPromise = null
      this.tokenAbortController?.abort()
    }
    if (this.tokenPromise) return this.tokenPromise

    const controller = new AbortController()
    this.tokenAbortController = controller
    this.tokenPromise = this.dependencies.fetchActorToken({ signal: controller.signal })
      .then((result) => {
        if (!this.isCurrentEpoch(epoch)) throw new RealtimeStaleOperationError()
        return result
      })
      .finally(() => {
        if (this.isCurrentEpoch(epoch)) {
          this.tokenPromise = null
          this.tokenAbortController = null
        }
      })
    return this.tokenPromise
  }

  private async reauthenticate(epoch: number, socketGeneration: number): Promise<void> {
    if (!this.isCurrentSocket(epoch, socketGeneration, this.socket)) return
    if (!this.hasGlobalRealtimeDemand()) {
      this.detachSocket(true)
      this.setState("idle")
      return
    }
    if (this.reauthPromise) return this.reauthPromise

    this.setState("reauthenticating")
    this.invalidateTransportGrants()
    this.detachSocket(true)
    this.reauthPromise = (async () => {
      try {
        const freshToken = await this.getActorToken(epoch, true)
        if (!this.isCurrentEpoch(epoch)) throw new RealtimeStaleOperationError()
        await this.connectForEpoch(epoch, freshToken)
        await this.requestResync("reauth")
      } catch (error) {
        if (this.isCurrentEpoch(epoch)) {
          if (errorStatus(error) === 401 || errorStatus(error) === 403) this.stop("session-invalid")
          else this.scheduleReconnect()
        }
        throw error
      } finally {
        if (this.isCurrentEpoch(epoch)) this.reauthPromise = null
      }
    })()
    await this.reauthPromise
  }

  private async rejoinAllRooms(epoch: number, socketGeneration: number): Promise<void> {
    const records = [...this.rooms.values()]
    await Promise.all(records.map(async (record) => {
      if (!record.leases.size) return
      record.joined = false
      record.grantedScopes = []
      record.roomGeneration += 1
      try {
        await this.reconcileRoom(record, epoch, socketGeneration, true)
      } catch (error) {
        if (this.isCurrentEpoch(epoch)) {
          this.connectionError = errorMessage(error)
          this.emitState()
        }
      }
    }))
    if (records.length) await this.requestResync("room-rejoin")
  }

  private async reconcileRoom(
    record: RoomRecord,
    epoch: number,
    socketGeneration: number,
    force: boolean
  ): Promise<void> {
    if (!this.isCurrentRecord(record) || !record.leases.size) return
    const requestedScopes = this.getRequestedScopes(record)
    record.requestedScopes = requestedScopes
    const key = scopeKey(requestedScopes)
    const hasFreshGrant = record.joined && scopeKey(record.grantedScopes) === key &&
      record.expiresAt > this.dependencies.now() + this.dependencies.capabilityRefreshMarginMs
    if (!force && hasFreshGrant) return
    if (record.capabilityPromise && record.capabilityKey === key && record.capabilityGeneration === record.roomGeneration) {
      return record.capabilityPromise
    }

    const roomGeneration = record.roomGeneration
    const previousGrant = [...record.grantedScopes]
    const previousJoined = record.joined
    const promise = this.authorizeAndJoin(record, requestedScopes, epoch, socketGeneration, roomGeneration)
    record.capabilityPromise = promise
    record.capabilityKey = key
    record.capabilityGeneration = roomGeneration

    try {
      await promise
    } catch (error) {
      const oldGrantStillCovers = previousJoined && includesScopes(previousGrant, requestedScopes)
      const strictDowngrade = previousJoined && isStrictScopeDowngrade(previousGrant, requestedScopes)
      const currentGeneration = this.isCurrentEpoch(epoch) && this.isCurrentRecord(record) &&
        record.roomGeneration === roomGeneration
      if (strictDowngrade && currentGeneration) {
        this.leaveRoom(record)
        this.scheduleCapabilityRetry(record, epoch)
        throw error
      }
      if (oldGrantStillCovers && currentGeneration) {
        this.scheduleCapabilityRetry(record, epoch)
        return
      }
      throw error
    } finally {
      if (record.capabilityPromise === promise) {
        record.capabilityPromise = null
        record.capabilityKey = null
      }
    }
  }

  private async authorizeAndJoin(
    record: RoomRecord,
    requestedScopes: RealtimeScope[],
    epoch: number,
    socketGeneration: number,
    roomGeneration: number
  ): Promise<void> {
    const controller = new AbortController()
    this.capabilityAbortControllers.add(controller)
    try {
      const capability = await this.dependencies.authorizeRoom(record.pedidoId, requestedScopes, { signal: controller.signal })
      if (!this.isCurrentRoomOperation(record, epoch, socketGeneration, roomGeneration)) {
        throw new RealtimeStaleOperationError()
      }
      const socket = this.socket
      if (!socket?.connected) throw new Error("Realtime socket is not connected")
      await this.joinRoom(socket, record.pedidoId, capability.token, controller.signal)
      if (!this.isCurrentRoomOperation(record, epoch, socketGeneration, roomGeneration)) {
        throw new RealtimeStaleOperationError()
      }
      record.grantedScopes = [...requestedScopes]
      record.joined = true
      record.capabilityRetryAttempt = 0
      const ttlMs = (capability.expiresIn || DEFAULT_CAPABILITY_TTL_SECONDS) * 1000
      record.expiresAt = this.dependencies.now() + ttlMs
      this.scheduleRoomRefresh(record, epoch)
    } finally {
      this.capabilityAbortControllers.delete(controller)
    }
  }

  private joinRoom(socket: RealtimeSocketLike, pedidoId: string, capability: string, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false
      const cleanup = () => signal.removeEventListener("abort", onAbort)
      const onAbort = () => {
        if (settled) return
        settled = true
        this.dependencies.clearTimeout(timer)
        reject(new Error("Realtime room join aborted"))
      }
      const timer = this.dependencies.setTimeout(() => {
        if (settled) return
        settled = true
        cleanup()
        reject(new Error("Realtime room join timed out"))
      }, ROOM_JOIN_TIMEOUT_MS)
      const ack = (result: unknown) => {
        if (settled) return
        settled = true
        this.dependencies.clearTimeout(timer)
        cleanup()
        if (result && typeof result === "object" && (result as { ok?: unknown }).ok === true) resolve()
        else reject(new Error("Realtime room join rejected"))
      }
      signal.addEventListener("abort", onAbort, { once: true })
      socket.emit("join-order-room", capability, ack)
      void pedidoId
    })
  }

  private scheduleRoomRefresh(record: RoomRecord, epoch: number, delayOverride?: number): void {
    this.clearRoomTimer(record)
    const remainingMs = Math.max(0, record.expiresAt - this.dependencies.now())
    const refreshLeadMs = Math.min(
      this.dependencies.capabilityRefreshMarginMs,
      Math.max(MIN_CAPABILITY_REFRESH_DELAY_MS, Math.floor(remainingMs / 2)),
    )
    const delay = delayOverride ?? Math.max(MIN_CAPABILITY_REFRESH_DELAY_MS, remainingMs - refreshLeadMs)
    record.refreshTimer = this.dependencies.setTimeout(() => {
      if (!this.isCurrentEpoch(epoch) || !this.isCurrentRecord(record) || !record.leases.size) return
      record.roomGeneration += 1
      void this.reconcileRoom(record, epoch, this.socketGeneration, true).catch(() => {
        if (this.isCurrentRecord(record)) this.scheduleRoomRefresh(record, epoch)
      })
    }, delay)
  }

  private scheduleCapabilityRetry(record: RoomRecord, epoch: number): void {
    if (!this.isCurrentRecord(record) || !record.leases.size) return
    record.capabilityRetryAttempt = Math.min(record.capabilityRetryAttempt + 1, 10)
    const delay = Math.min(
      CAPABILITY_RETRY_MAX_MS,
      CAPABILITY_RETRY_BASE_MS * (2 ** (record.capabilityRetryAttempt - 1)),
    )
    this.scheduleRoomRefresh(record, epoch, delay)
  }

  private createRoomRecord(pedidoId: string): RoomRecord {
    const record: RoomRecord = {
      pedidoId,
      leases: new Map(),
      requestedScopes: [],
      grantedScopes: [],
      expiresAt: 0,
      joined: false,
      roomGeneration: 0,
      capabilityPromise: null,
      capabilityKey: null,
      capabilityGeneration: 0,
      refreshTimer: null,
      capabilityRetryAttempt: 0,
    }
    this.rooms.set(pedidoId, record)
    return record
  }

  private createLease(record: RoomRecord, leaseId: string, scopes: RealtimeScope[]): RealtimeRoomLease {
    let released = false
    return {
      pedidoId: record.pedidoId,
      scopes: [...scopes],
      release: () => {
        if (released) return
        released = true
        this.releaseLease(record, leaseId)
      },
    }
  }

  private releaseLease(record: RoomRecord, leaseId: string): void {
    if (!this.isCurrentRecord(record)) return
    if (!record.leases.delete(leaseId)) return
    const previousScopeKey = scopeKey(record.requestedScopes)
    record.requestedScopes = this.getRequestedScopes(record)
    if (scopeKey(record.requestedScopes) !== previousScopeKey) record.roomGeneration += 1
    if (record.leases.size === 0) {
      this.leaveRoom(record)
      this.deleteRoomRecord(record)
      this.scheduleIdleDisconnect()
      return
    }
    const epoch = this.actorEpoch
    void this.reconcileRoom(record, epoch, this.socketGeneration, false).catch(() => {})
  }

  private leaveRoom(record: RoomRecord): void {
    this.clearRoomTimer(record)
    if (this.socket?.connected && record.joined) {
      this.socket.emit("leave-order-room", record.pedidoId, () => {})
    }
    record.joined = false
    record.grantedScopes = []
  }

  private deleteRoomRecord(record: RoomRecord): void {
    if (this.rooms.get(record.pedidoId) === record) this.rooms.delete(record.pedidoId)
    this.clearRoomTimer(record)
  }

  private getRequestedScopes(record: RoomRecord): RealtimeScope[] {
    const scopes = new Set<RealtimeScope>()
    for (const leaseScopes of record.leases.values()) {
      for (const scope of leaseScopes) scopes.add(scope)
    }
    return normalizeScopes([...scopes])
  }

  private hasGlobalRealtimeDemand(): boolean {
    for (const record of this.rooms.values()) {
      if (record.leases.size > 0) return true
    }
    return false
  }

  private scheduleIdleDisconnect(): void {
    if (!this.socket || this.hasGlobalRealtimeDemand() || this.idleDisconnectTimer) return
    const epoch = this.actorEpoch
    this.idleDisconnectTimer = this.dependencies.setTimeout(() => {
      this.idleDisconnectTimer = null
      if (!this.isCurrentEpoch(epoch) || this.hasGlobalRealtimeDemand() || !this.socket) return
      this.clearReconnectTimer()
      this.detachSocket(true)
      this.connectionError = null
      this.setState("idle")
    }, this.dependencies.idleDisconnectGraceMs)
  }

  private clearIdleDisconnectTimer(): void {
    if (this.idleDisconnectTimer === null) return
    this.dependencies.clearTimeout(this.idleDisconnectTimer)
    this.idleDisconnectTimer = null
  }

  private scheduleReconnect(): void {
    if (this.stopped || !this.actor || !this.hasGlobalRealtimeDemand() || this.reconnectTimer || !this.dependencies.isOnline()) return
    if (!this.dependencies.isVisible()) return
    const exponential = Math.min(
      this.dependencies.reconnectMaxMs,
      this.dependencies.reconnectBaseMs * (2 ** this.reconnectAttempt)
    )
    const jitter = 0.75 + this.dependencies.random() * 0.5
    const delay = Math.min(this.dependencies.reconnectMaxMs, Math.round(exponential * jitter))
    this.reconnectAttempt += 1
    this.setState("reconnecting")
    const epoch = this.actorEpoch
    this.reconnectTimer = this.dependencies.setTimeout(() => {
      this.reconnectTimer = null
      if (!this.isCurrentEpoch(epoch) || !this.dependencies.isOnline() || !this.dependencies.isVisible()) return
      void this.ensureConnected().catch(() => {})
    }, delay)
  }

  private scheduleWake(reason: RealtimeResyncReason): void {
    if (this.reconnectWakeScheduled) return
    this.reconnectWakeScheduled = true
    Promise.resolve().then(() => {
      this.reconnectWakeScheduled = false
      if (this.stopped || !this.actor || !this.hasGlobalRealtimeDemand() || !this.dependencies.isOnline() || !this.dependencies.isVisible()) return
      void this.ensureConnected()
        .then(() => this.requestResync(reason))
        .catch(() => {})
    })
  }

  private setConnectionFailure(error: unknown): void {
    this.connectionError = errorMessage(error)
    if (!this.dependencies.isOnline()) this.setState("offline")
    else this.setState("error")
  }

  private emitAuthorizedRoomEvent(
    pedidoId: string,
    requiredScope: RealtimeScope,
    event: "typing" | "stop-typing" | "mark-read",
  ): boolean {
    const normalizedPedidoId = pedidoId.trim()
    if (!this.canEmitAuthorizedRoomEvent(normalizedPedidoId, requiredScope)) return false
    try {
      this.socket?.emit(event, normalizedPedidoId)
      return true
    } catch {
      return false
    }
  }

  private canEmitAuthorizedRoomEvent(pedidoId: string, requiredScope: RealtimeScope): boolean {
    if (!pedidoId || !this.actor || this.stopped || !this.socket?.connected) return false
    const record = this.rooms.get(pedidoId)
    return Boolean(record?.joined && record.grantedScopes.includes(requiredScope))
  }

  private setState(state: RealtimeConnectionState): void {
    this.state = state
    this.emitState()
  }

  private emitState(): void {
    const currentActor = this.connectionSnapshot.actor
    const actorChanged = currentActor?.userId !== this.actor?.userId ||
      currentActor?.userType !== this.actor?.userType
    if (
      this.connectionSnapshot.state === this.state &&
      this.connectionSnapshot.error === this.connectionError &&
      !actorChanged &&
      this.connectionSnapshot.actorEpoch === this.actorEpoch &&
      this.connectionSnapshot.socketGeneration === this.socketGeneration
    ) return

    this.connectionSnapshot = Object.freeze({
      state: this.state,
      error: this.connectionError,
      actor: this.actor ? Object.freeze({ ...this.actor }) : null,
      actorEpoch: this.actorEpoch,
      socketGeneration: this.socketGeneration,
    })
    for (const listener of this.stateListeners) listener()
  }

  private addSocketListener(socket: RealtimeSocketLike, event: string, handler: (...args: unknown[]) => void): void {
    socket.on(event, handler)
    this.socketListeners.push({ event, handler })
  }

  private attachEventRelay(socket: RealtimeSocketLike, event: RealtimeEventType): void {
    if (socket !== this.socket || this.socketRelayEvents.has(event)) return
    const handler = (...args: unknown[]) => {
      if (socket !== this.socket || this.stopped) return
      const payload = args[0] as RealtimeEventMap[typeof event]
      const handlers = this.subscriptions.get(event)
      // eslint-disable-next-line no-console
      console.log(`[Realtime][DIAG] relay_fired event=${event} subscriberCount=${handlers?.size ?? 0}`)
      if (!handlers) return
      for (const subscriber of [...handlers]) {
        try {
          subscriber(payload)
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error(`[Realtime][DIAG] subscriber_threw event=${event}`, error)
          // One consumer must not prevent the remaining registry handlers from receiving the event.
        }
      }
    }
    this.addSocketListener(socket, event, handler)
    this.socketRelayEvents.add(event)
    this.socketRelayHandlers.set(event, handler)
  }

  private attachEventRelays(socket: RealtimeSocketLike): void {
    for (const event of this.subscriptions.keys()) this.attachEventRelay(socket, event)
  }

  private detachEventRelay(event: RealtimeEventType): void {
    const handler = this.socketRelayHandlers.get(event)
    if (!handler) return
    const socket = this.socket
    if (socket) socket.off?.(event, handler)
    const listenerIndex = this.socketListeners.findIndex((listener) =>
      listener.event === event && listener.handler === handler
    )
    if (listenerIndex >= 0) this.socketListeners.splice(listenerIndex, 1)
    this.socketRelayEvents.delete(event)
    this.socketRelayHandlers.delete(event)
  }

  private detachSocket(disconnect: boolean): void {
    const socket = this.socket
    if (!socket) return
    for (const listener of this.socketListeners) socket.off?.(listener.event, listener.handler)
    this.socketListeners.length = 0
    this.socketRelayEvents.clear()
    this.socketRelayHandlers.clear()
    this.socket = null
    if (disconnect) socket.disconnect()
  }

  private invalidateTransportGrants(): void {
    this.abortCapabilityRequests()
    for (const record of this.rooms.values()) {
      record.joined = false
      record.grantedScopes = []
      record.expiresAt = 0
      record.roomGeneration += 1
      this.clearRoomTimer(record)
    }
  }

  private clearRoomTimer(record: RoomRecord): void {
    if (!record.refreshTimer) return
    this.dependencies.clearTimeout(record.refreshTimer)
    record.refreshTimer = null
  }

  private clearReconnectTimer(): void {
    if (!this.reconnectTimer) return
    this.dependencies.clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
  }

  private abortPendingRequests(): void {
    this.tokenAbortController?.abort()
    this.connectAbortController?.abort()
    this.abortCapabilityRequests()
    this.tokenAbortController = null
    this.connectAbortController = null
    this.tokenPromise = null
    this.connectPromise = null
  }

  private abortCapabilityRequests(): void {
    for (const controller of this.capabilityAbortControllers) controller.abort()
    this.capabilityAbortControllers.clear()
  }

  private isCurrentEpoch(epoch: number): boolean {
    return !this.stopped && this.actor !== null && this.actorEpoch === epoch
  }

  private isCurrentSocket(epoch: number, socketGeneration: number, socket: RealtimeSocketLike | null): boolean {
    return this.isCurrentEpoch(epoch) && this.socket === socket && this.socketGeneration === socketGeneration
  }

  private isCurrentRecord(record: RoomRecord): boolean {
    return this.rooms.get(record.pedidoId) === record
  }

  private isCurrentRoomOperation(record: RoomRecord, epoch: number, socketGeneration: number, roomGeneration: number): boolean {
    return this.isCurrentEpoch(epoch) && this.isCurrentRecord(record) && this.socket?.connected === true &&
      this.socketGeneration === socketGeneration && record.roomGeneration === roomGeneration
  }
}
