import { createHmac, randomUUID } from "crypto"

export const INTERNAL_PUBLISH_PATH = "/internal/realtime/publish"
export const INTERNAL_PUBLISH_TIMEOUT_MS = 400
export const INTERNAL_PUBLISH_MAX_RETRIES = 1
export const INTERNAL_PUBLISH_RETRY_BACKOFF_MS = 100
export const INTERNAL_PUBLISH_SECRET_MIN_LENGTH = 32

type ChatMessageCreatedPayload = {
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

type ChatMessagesReadPayload = {
  pedidoId: string
  readBy: string
  userType: "cliente" | "negocio" | "repartidor"
}

type TrackingLocationUpdatedPayload = {
  pedidoId: string
  lat: number
  lng: number
  timestamp: string
  version?: number | string
}

export type RealtimePublishEvent =
  | {
      version: 1
      type: "chat.message.created"
      eventId: string
      resourceId: string
      occurredAt: string
      payload: ChatMessageCreatedPayload
      traceId?: string
    }
  | {
      version: 1
      type: "chat.messages.read"
      eventId: string
      resourceId: string
      occurredAt: string
      payload: ChatMessagesReadPayload
      traceId?: string
    }
  | {
      version: 1
      type: "tracking.location.updated"
      eventId: string
      resourceId: string
      occurredAt: string
      payload: TrackingLocationUpdatedPayload
      traceId?: string
    }

export type RealtimePublishResult =
  | { status: "success"; eventId: string; attempts: number; httpStatus: number }
  | { status: "deduplicated"; eventId: string; attempts: number; httpStatus: number }
  | { status: "disabled"; reason: "configuration_incomplete" | "configuration_invalid" }
  | { status: "failed"; eventId: string; attempts: number; httpStatus?: number }

type PublishOptions = {
  fetchImpl?: FetchImplementation
  now?: () => number
  sleep?: (milliseconds: number) => Promise<void>
}

type FetchImplementation = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>

let configurationWarningEmitted = false

function warnConfigurationOnce(category: string): void {
  if (configurationWarningEmitted) return
  configurationWarningEmitted = true
  console.warn("[Realtime Publish] disabled category=" + category)
}

function readConfiguration():
  | { status: "ready"; url: string; secret: string }
  | { status: "disabled"; reason: "configuration_incomplete" | "configuration_invalid" } {
  const rawUrl = process.env.REALTIME_INTERNAL_SERVICE_URL?.trim()
  const secret = process.env.REALTIME_INTERNAL_PUBLISH_SECRET?.trim()
  if (!rawUrl || !secret || secret.length < INTERNAL_PUBLISH_SECRET_MIN_LENGTH) {
    warnConfigurationOnce("configuration_incomplete")
    return { status: "disabled", reason: "configuration_incomplete" }
  }

  try {
    const parsed = new URL(rawUrl)
    if (
      (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash
    ) {
      warnConfigurationOnce("configuration_invalid")
      return { status: "disabled", reason: "configuration_invalid" }
    }
    return {
      status: "ready",
      url: parsed.toString().replace(/\/+$/, ""),
      secret,
    }
  } catch {
    warnConfigurationOnce("configuration_invalid")
    return { status: "disabled", reason: "configuration_invalid" }
  }
}

function signRequest(
  secret: string,
  timestamp: string,
  requestId: string,
  rawBody: string
): string {
  return createHmac("sha256", secret)
    .update(timestamp + "." + requestId + "." + rawBody, "utf8")
    .digest("hex")
}

async function fetchWithTimeout(
  fetchImpl: FetchImplementation,
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function isRetryableStatus(status: number): boolean {
  return status >= 500 && status <= 599
}

export async function publishRealtimeEvent(
  event: RealtimePublishEvent,
  options: PublishOptions = {}
): Promise<RealtimePublishResult> {
  const configuration = readConfiguration()
  if (configuration.status !== "ready") return configuration

  const fetchImpl = options.fetchImpl || fetch
  const now = options.now || (() => Date.now())
  const sleep = options.sleep || defaultSleep
  const rawBody = JSON.stringify(event)
  const url = configuration.url + INTERNAL_PUBLISH_PATH
  let lastStatus: number | undefined

  for (let attempt = 0; attempt <= INTERNAL_PUBLISH_MAX_RETRIES; attempt += 1) {
    const timestamp = String(now())
    const requestId = randomUUID()
    const signature = signRequest(configuration.secret, timestamp, requestId, rawBody)

    try {
      const response = await fetchWithTimeout(
        fetchImpl,
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-DeliGO-Timestamp": timestamp,
            "X-DeliGO-Request-Id": requestId,
            "X-DeliGO-Signature": signature,
          },
          body: rawBody,
        },
        INTERNAL_PUBLISH_TIMEOUT_MS
      )
      lastStatus = response.status

      if (response.ok) {
        const result = (await response.json().catch(() => ({}))) as { deduplicated?: boolean }
        return {
          status: result.deduplicated ? "deduplicated" : "success",
          eventId: event.eventId,
          attempts: attempt + 1,
          httpStatus: response.status,
        }
      }

      if (!isRetryableStatus(response.status) || attempt === INTERNAL_PUBLISH_MAX_RETRIES) {
        console.warn(
          "[Realtime Publish] result=failed type=" +
            event.type +
            " eventId=" +
            event.eventId +
            " status=" +
            response.status +
            " attempt=" +
            (attempt + 1)
        )
        return {
          status: "failed",
          eventId: event.eventId,
          attempts: attempt + 1,
          httpStatus: response.status,
        }
      }
    } catch {
      if (attempt === INTERNAL_PUBLISH_MAX_RETRIES) {
        console.warn(
          "[Realtime Publish] result=failed type=" +
            event.type +
            " eventId=" +
            event.eventId +
            " status=network_or_timeout attempt=" +
            (attempt + 1)
        )
        return { status: "failed", eventId: event.eventId, attempts: attempt + 1, httpStatus: lastStatus }
      }
    }

    await sleep(INTERNAL_PUBLISH_RETRY_BACKOFF_MS)
  }

  return {
    status: "failed",
    eventId: event.eventId,
    attempts: INTERNAL_PUBLISH_MAX_RETRIES + 1,
    httpStatus: lastStatus,
  }
}
