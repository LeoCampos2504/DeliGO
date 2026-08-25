// P2-T05 Stage3 (F-P2-T05-01): parsing/shape-validation compartido para el
// payload HTTP de PushSubscription que hoy llega duplicado en las 4 rutas de
// subscribe. Server-safe: no importa NextRequest, cookies, el singleton
// Prisma ni React — únicamente valida forma y normaliza. Auth, rate limit,
// owner resolution, status codes y transactions siguen siendo autoridad de
// cada route.
import type { NormalizedPushSubscriptionInput } from "@/lib/push-subscription-repository"

export interface ParsedPushSubscriptionShape {
  endpoint: string
  expirationTime: number | null
  keys: {
    p256dh: string
    auth: string
  }
}

/**
 * Acepta tanto un string JSON (formato legacy enviado por
 * `/api/push/subscribe`, `/api/mozo/push/subscribe`) como un objeto ya
 * parseado, y valida la forma completa: endpoint HTTPS no vacío, keys.p256dh
 * y keys.auth no vacíos, expirationTime `number` finito o `null` (rechaza
 * cualquier otro tipo — un valor previamente tolerado en silencio por los
 * parsers ad-hoc de las rutas operativas, ahora rechazado explícitamente).
 */
export function parsePushSubscriptionShape(value: unknown): ParsedPushSubscriptionShape | null {
  let parsed: unknown = value
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value)
    } catch {
      return null
    }
  }

  if (!parsed || typeof parsed !== "object") return null

  const candidate = parsed as {
    endpoint?: unknown
    expirationTime?: unknown
    keys?: { p256dh?: unknown; auth?: unknown }
  }

  if (
    typeof candidate.endpoint !== "string" ||
    candidate.endpoint.trim().length === 0 ||
    !candidate.keys ||
    typeof candidate.keys.p256dh !== "string" ||
    candidate.keys.p256dh.trim().length === 0 ||
    typeof candidate.keys.auth !== "string" ||
    candidate.keys.auth.trim().length === 0
  ) {
    return null
  }

  const endpoint = candidate.endpoint.trim()
  try {
    const endpointUrl = new URL(endpoint)
    if (endpointUrl.protocol !== "https:") {
      return null
    }
  } catch {
    return null
  }

  if (
    candidate.expirationTime !== null &&
    candidate.expirationTime !== undefined &&
    (typeof candidate.expirationTime !== "number" || !Number.isFinite(candidate.expirationTime))
  ) {
    return null
  }

  const expirationTime =
    typeof candidate.expirationTime === "number" && Number.isFinite(candidate.expirationTime)
      ? candidate.expirationTime
      : null

  return {
    endpoint,
    expirationTime,
    keys: {
      p256dh: candidate.keys.p256dh,
      auth: candidate.keys.auth,
    },
  }
}

/**
 * Convierte la forma HTTP ya validada al input normalizado que consume
 * `registerPushSubscription` — el `expirationTime` epoch-ms del browser se
 * convierte explícitamente a `Date | null` (nunca se pasa el number crudo al
 * repository).
 */
export function toNormalizedPushSubscriptionInput(
  parsed: ParsedPushSubscriptionShape
): NormalizedPushSubscriptionInput | null {
  let expirationTime: Date | null = null
  if (parsed.expirationTime !== null) {
    const date = new Date(parsed.expirationTime)
    if (Number.isNaN(date.getTime())) return null
    expirationTime = date
  }
  return {
    endpoint: parsed.endpoint,
    p256dh: parsed.keys.p256dh,
    auth: parsed.keys.auth,
    expirationTime,
  }
}

/**
 * Extracción tolerante del `endpoint` únicamente, para los flujos de detach
 * (unsubscribe/logout) donde el contrato legacy sólo exige un string no
 * vacío — nunca la forma completa. Si el valor no trae un endpoint utilizable
 * el detach normalizado simplemente se omite (el detach legacy exact-match no
 * depende de esto).
 */
export function extractEndpointForDetach(value: unknown): string | null {
  let parsed: unknown = value
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value)
    } catch {
      return null
    }
  }
  if (!parsed || typeof parsed !== "object") return null
  const endpoint = (parsed as { endpoint?: unknown }).endpoint
  return typeof endpoint === "string" && endpoint.trim().length > 0 ? endpoint.trim() : null
}
