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
 * P2-T05 Stage3H3 (F-P2-T05-16): valor seguro para el campo legacy
 * `pushSubscription String?` — `parsePushSubscriptionShape` acepta
 * deliberadamente tanto un string JSON como un objeto ya parseado (rutas
 * operativas), pero las rutas personales (`/api/push/subscribe`,
 * `/api/mozo/push/subscribe`) persistían el valor RAW del body sin
 * canonicalizar: un objeto válido pasaba la validación de forma pero
 * llegaba como objeto a un campo `String?` de Prisma, que fallaba en
 * runtime (500 no controlado, aunque con rollback atómico completo —
 * confirmado sin corrupción de datos).
 *
 * Regla: si el valor original ya era un string, se devuelve exactamente
 * ese mismo string (nunca se re-serializa) — preserva byte-for-byte el
 * formato legacy y la compatibilidad de exact-match de unsubscribe con los
 * clientes actuales. Si el valor original era un objeto, se canonicaliza a
 * JSON usando ÚNICAMENTE los campos ya validados por
 * `parsePushSubscriptionShape` (nunca propiedades adicionales del body).
 */
function canonicalPushSubscriptionString(parsed: ParsedPushSubscriptionShape): string {
  return JSON.stringify({
    endpoint: parsed.endpoint,
    expirationTime: parsed.expirationTime,
    keys: {
      p256dh: parsed.keys.p256dh,
      auth: parsed.keys.auth,
    },
  })
}

export function toLegacyPushSubscriptionString(
  original: unknown,
  parsed: ParsedPushSubscriptionShape
): string {
  if (typeof original === "string") return original
  return canonicalPushSubscriptionString(parsed)
}

/**
 * P2-T05 Stage3H3R1 (F-P2-T05-17): comparación semántica de dos shapes ya
 * validadas — SOLO los campos de la subscription física
 * (endpoint/expirationTime/keys.p256dh/keys.auth), nunca su representación
 * serializada (property order, whitespace, extra fields). Un endpoint
 * idéntico con keys distintas (rotación de keys en el mismo endpoint) NO es
 * la misma subscription lógica — comparar sólo por endpoint permitiría que
 * un dispositivo obsoleto limpie el binding legacy de un dispositivo más
 * nuevo que por casualidad comparte endpoint.
 */
export function arePushSubscriptionsEquivalent(
  a: ParsedPushSubscriptionShape,
  b: ParsedPushSubscriptionShape
): boolean {
  return (
    a.endpoint === b.endpoint &&
    a.expirationTime === b.expirationTime &&
    a.keys.p256dh === b.keys.p256dh &&
    a.keys.auth === b.keys.auth
  )
}

export interface ResolvedPushSubscriptionDetachInput {
  /** El string original EXACTO si el input era un string — nunca re-serializado. */
  rawString: string | null
  /** Shape completa ya validada, si el input (string u objeto) tenía forma válida. */
  parsed: ParsedPushSubscriptionShape | null
  /** Endpoint usable para el detach normalizado — tolerante, nunca exige forma completa. */
  endpoint: string | null
  /** Representación canónica JSON, sólo si `parsed` es válida. */
  canonical: string | null
}

/**
 * P2-T05 Stage3H3R1 (F-P2-T05-17): punto único de entrada para resolver
 * cualquier representación de subscription (string legacy, string
 * no-canónico, objeto ya parseado) a las piezas que un detach seguro
 * necesita. No decide fail-open/fail-closed por sí mismo — eso sigue siendo
 * responsabilidad de cada ruta (una ruta puede tratar "objeto inválido"
 * como 400, otra como no-op, según su propio contrato ya existente).
 */
export function resolvePushSubscriptionDetachInput(value: unknown): ResolvedPushSubscriptionDetachInput {
  if (typeof value === "string") {
    const parsed = parsePushSubscriptionShape(value)
    return {
      rawString: value,
      parsed,
      endpoint: parsed ? parsed.endpoint : extractEndpointForDetach(value),
      canonical: parsed ? canonicalPushSubscriptionString(parsed) : null,
    }
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const parsed = parsePushSubscriptionShape(value)
    if (!parsed) {
      return { rawString: null, parsed: null, endpoint: null, canonical: null }
    }
    return {
      rawString: null,
      parsed,
      endpoint: parsed.endpoint,
      canonical: canonicalPushSubscriptionString(parsed),
    }
  }
  return { rawString: null, parsed: null, endpoint: null, canonical: null }
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
