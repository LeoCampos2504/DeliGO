export const REALTIME_USER_TYPES = ["cliente", "negocio", "repartidor"] as const
export type RealtimeUserType = (typeof REALTIME_USER_TYPES)[number]

export const REALTIME_SCOPES = [
  "chat:read",
  "chat:typing",
  "tracking:watch",
  "tracking:publish",
] as const
export type RealtimeScope = (typeof REALTIME_SCOPES)[number]

export type RealtimePolicyCode =
  | "ROOM_FORBIDDEN"
  | "TRACKING_DISABLED"
  | "ORDER_NOT_ACTIVE"
  | "INVALID_SCOPE"

export interface RealtimeActor {
  userId: string
  userType: RealtimeUserType
}

export interface RealtimeOrderSnapshot {
  id: string
  clienteId: string | null
  negocioId: string
  repartidorId: string | null
  estado: string
  metodoEntrega: string
  // Flag VIVO del Negocio en el momento de esta autorización (no del pedido).
  seguimientoDeliveryActivo: boolean
  // Snapshot INMUTABLE tomado en el momento de crear este Pedido
  // (Pedido.seguimientoDeliveryHabilitado). Ver isTrackingCoreEligible.
  seguimientoDeliveryHabilitado: boolean
  repartidorAssociationValid?: boolean
}

export interface TrackingCoreOrderInput {
  estado: string
  metodoEntrega: string
  seguimientoDeliveryHabilitado: boolean
}

export interface TrackingCoreNegocioInput {
  seguimientoDeliveryActivo: boolean
}

// Única definición de "¿corresponde producir/mostrar tracking para este
// pedido, en este instante?" — sin identidad de actor, sin Prisma, sin DB,
// sin efectos secundarios (P2-T01 Stage 1 / Stage 1B). Todo call site que
// necesite esta pregunta debe llamar a esta función, nunca reimplementar la
// expresión manualmente.
export function isTrackingCoreEligible(
  order: TrackingCoreOrderInput,
  negocio: TrackingCoreNegocioInput
): boolean {
  return (
    order.estado === ACTIVE_TRACKING_STATE &&
    order.metodoEntrega === "domicilio" &&
    order.seguimientoDeliveryHabilitado === true &&
    negocio.seguimientoDeliveryActivo === true
  )
}

export type RealtimePolicyResult =
  | { ok: true; scopes: RealtimeScope[] }
  | { ok: false; code: RealtimePolicyCode }

const ACTIVE_TRACKING_STATE = "en_camino"

function isRealtimeScope(value: unknown): value is RealtimeScope {
  return typeof value === "string" && (REALTIME_SCOPES as readonly string[]).includes(value)
}

export function normalizeRequestedScopes(value: unknown): RealtimeScope[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > REALTIME_SCOPES.length) {
    return null
  }

  const scopes = [...new Set(value)]
  if (scopes.length !== value.length || !scopes.every(isRealtimeScope)) return null
  return scopes
}

export function authorizeRealtimeOrder(
  actor: RealtimeActor,
  order: RealtimeOrderSnapshot,
  requestedScopes: RealtimeScope[]
): RealtimePolicyResult {
  if (!requestedScopes.length) return { ok: false, code: "INVALID_SCOPE" }

  const isOwnChatOrder =
    order.metodoEntrega !== "mesa" &&
    ((actor.userType === "cliente" && order.clienteId === actor.userId) ||
      (actor.userType === "negocio" && order.negocioId === actor.userId))

  const allowedScopes: RealtimeScope[] = []
  if (isOwnChatOrder && (actor.userType === "cliente" || actor.userType === "negocio")) {
    allowedScopes.push("chat:read", "chat:typing")
  }

  const trackingOrderIsActive =
    order.estado === ACTIVE_TRACKING_STATE && order.metodoEntrega === "domicilio"
  const trackingEnabled = isTrackingCoreEligible(
    {
      estado: order.estado,
      metodoEntrega: order.metodoEntrega,
      seguimientoDeliveryHabilitado: order.seguimientoDeliveryHabilitado,
    },
    { seguimientoDeliveryActivo: order.seguimientoDeliveryActivo }
  )

  if (actor.userType === "cliente" && order.clienteId === actor.userId) {
    if (!trackingOrderIsActive) {
      if (requestedScopes.some((scope) => scope === "tracking:watch")) {
        return { ok: false, code: "ORDER_NOT_ACTIVE" }
      }
    } else if (!trackingEnabled) {
      if (requestedScopes.some((scope) => scope === "tracking:watch")) {
        return { ok: false, code: "TRACKING_DISABLED" }
      }
    } else {
      allowedScopes.push("tracking:watch")
    }
  }

  if (actor.userType === "repartidor") {
    if (requestedScopes.includes("tracking:publish")) {
      if (!trackingOrderIsActive || order.repartidorId !== actor.userId || !order.repartidorAssociationValid) {
        return { ok: false, code: "ROOM_FORBIDDEN" }
      }
      if (!trackingEnabled) return { ok: false, code: "TRACKING_DISABLED" }
      allowedScopes.push("tracking:publish")
    }
  }

  if (requestedScopes.some((scope) => !allowedScopes.includes(scope))) {
    return { ok: false, code: "ROOM_FORBIDDEN" }
  }

  return { ok: true, scopes: requestedScopes }
}
