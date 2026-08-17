import type { RealtimeScope, RealtimeUserType } from "@/lib/realtime-policy"

export type { RealtimeScope, RealtimeUserType } from "@/lib/realtime-policy"

export type RealtimeConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "reauthenticating"
  | "reconnecting"
  | "offline"
  | "error"
  | "stopped"

export type RealtimeResyncReason =
  | "initial-connect"
  | "reconnect"
  | "reauth"
  | "room-rejoin"
  | "foreground"
  | "online"
  | "suspected-gap"
  | "manual"

export type RealtimeStopReason =
  | "logout"
  | "actor-change"
  | "provider-unmount"
  | "session-invalid"
  | "manual"

export interface RealtimeActorIdentity {
  userId: string
  userType: RealtimeUserType
}

export interface RealtimeChatMessagePayload {
  id: string
  pedidoId: string
  remitente: "cliente" | "vendedor" | "repartidor"
  texto: string
  imagenUrl: string | null
  archivoUrl: string | null
  archivoNombre: string | null
  archivoTipo: string | null
  leido: boolean
  fecha: string
  clienteId: string | null
}

export interface RealtimeMessagesReadPayload {
  pedidoId: string
  readBy: string
  userType: RealtimeUserType
}

export interface RealtimeTypingPayload {
  pedidoId: string
  userId: string
  userType: string
  userName?: string
}

export interface RealtimeStopTypingPayload {
  pedidoId: string
  userId: string
}

export interface RealtimeUnreadUpdatePayload {
  count: number
}

export interface RealtimeLocationPayload {
  pedidoId: string
  lat: number
  lng: number
  timestamp: string
  version?: number | string
}

export interface RealtimeTrackingLocationInput {
  lat: number
  lng: number
  timestamp: string
}

export interface RealtimeEventMap {
  "new-message": RealtimeChatMessagePayload
  "messages-read": RealtimeMessagesReadPayload
  "user-typing": RealtimeTypingPayload
  "user-stop-typing": RealtimeStopTypingPayload
  "unread-update": RealtimeUnreadUpdatePayload
  "repartidor-location": RealtimeLocationPayload
}

export type RealtimeEventType = keyof RealtimeEventMap
export type RealtimeEventHandler<K extends RealtimeEventType> = (payload: RealtimeEventMap[K]) => void

export interface RealtimeActorTokenResult {
  token: string
  expiresIn?: number
}

export interface RealtimeCapabilityResult {
  token: string
  expiresIn?: number
  room?: string
  scopes?: RealtimeScope[]
}

export interface RealtimeRoomLease {
  readonly pedidoId: string
  readonly scopes: readonly RealtimeScope[]
  release(): void
}

export interface RealtimeConnectionSnapshot {
  state: RealtimeConnectionState
  error: string | null
  actor: RealtimeActorIdentity | null
  actorEpoch: number
  socketGeneration: number
}

export type RealtimeStateListener = () => void
export type RealtimeResyncHandler = (reason: RealtimeResyncReason) => Promise<void> | void

export interface RealtimeSocketLike {
  connected: boolean
  on(event: string, handler: (...args: unknown[]) => void): this
  off?(event: string, handler?: (...args: unknown[]) => void): this
  emit(event: string, ...args: unknown[]): boolean
  connect(): this
  disconnect(): this
}

export interface RealtimeSocketOptions {
  auth: { token: string }
  autoConnect: false
  reconnection: false
  transports: ["websocket", "polling"]
  path: "/socket.io"
  timeout: number
}

export interface RealtimeManagerDependencies {
  createSocket?: (url: string, options: RealtimeSocketOptions) => RealtimeSocketLike
  getSocketUrl?: () => string
  fetchActorToken?: (options?: { signal?: AbortSignal }) => Promise<RealtimeActorTokenResult>
  authorizeRoom?: (
    pedidoId: string,
    scopes: RealtimeScope[],
    options?: { signal?: AbortSignal }
  ) => Promise<RealtimeCapabilityResult>
  now?: () => number
  random?: () => number
  setTimeout?: (handler: () => void, timeout: number) => ReturnType<typeof setTimeout>
  clearTimeout?: (handle: ReturnType<typeof setTimeout>) => void
  isOnline?: () => boolean
  isVisible?: () => boolean
  reconnectBaseMs?: number
  reconnectMaxMs?: number
  capabilityRefreshMarginMs?: number
  socketConnectTimeoutMs?: number
  idleDisconnectGraceMs?: number
}

export interface RealtimeClient {
  getConnectionState(): RealtimeConnectionState
  getConnectionError(): string | null
  getConnectionSnapshot(): RealtimeConnectionSnapshot
  ensureConnected(): Promise<void>
  acquireOrderRoom(
    pedidoId: string,
    scopes: readonly RealtimeScope[],
    options?: { signal?: AbortSignal },
  ): Promise<RealtimeRoomLease>
  subscribe<K extends RealtimeEventType>(event: K, handler: RealtimeEventHandler<K>): () => void
  sendTyping(pedidoId: string): boolean
  sendStopTyping(pedidoId: string): boolean
  markMessagesRead(pedidoId: string): boolean
  /** Temporary client producer compatibility until Chat becomes server-authoritative. */
  sendLegacyChatMessage(pedidoId: string, message: RealtimeChatMessagePayload): boolean
  /** Temporary client producer compatibility until repartidor tracking becomes server-authoritative. */
  sendTrackingLocation(pedidoId: string, location: RealtimeTrackingLocationInput): boolean
  registerResync(handler: RealtimeResyncHandler): () => void
  requestResync(reason: RealtimeResyncReason): Promise<void>
  stop(reason?: RealtimeStopReason): void
}
