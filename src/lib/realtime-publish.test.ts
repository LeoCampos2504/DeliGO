import { createHmac } from "crypto"
import { beforeEach, describe, expect, test } from "bun:test"
import {
  INTERNAL_PUBLISH_PATH,
  INTERNAL_PUBLISH_TIMEOUT_MS,
  publishRealtimeEvent,
  type RealtimePublishEvent,
} from "@/lib/realtime-publish"

const secret = "test-only-internal-publish-secret-01234567890123456789"

function event(eventId = "event-a"): RealtimePublishEvent {
  return {
    version: 1,
    type: "chat.message.created",
    eventId,
    resourceId: "pedido-a",
    occurredAt: new Date().toISOString(),
    payload: {
      id: "mensaje-" + eventId,
      pedidoId: "pedido-a",
      remitente: "cliente",
      texto: "server message",
      imagenUrl: null,
      archivoUrl: null,
      archivoNombre: null,
      archivoTipo: null,
      leido: false,
      fecha: new Date().toISOString(),
      clienteId: "cliente-a",
    },
  }
}

function trackingEvent(eventId = "tracking-event"): Extract<RealtimePublishEvent, { type: "tracking.location.updated" }> {
  return {
    version: 1,
    type: "tracking.location.updated",
    eventId,
    resourceId: "pedido-a",
    occurredAt: new Date().toISOString(),
    payload: {
      pedidoId: "pedido-a",
      lat: -34.5999,
      lng: -58.4,
      timestamp: new Date().toISOString(),
      version: 7,
    },
  }
}

beforeEach(() => {
  process.env.REALTIME_INTERNAL_SERVICE_URL = "http://internal-chat.test/base/"
  process.env.REALTIME_INTERNAL_PUBLISH_SECRET = secret
})

describe("server-only realtime publish helper", () => {
  test("transports an optional matched trajectory without altering RAW fields or version", async () => {
    const matchedTrajectory = [
      { lat: -34.6, lng: -58.4, offsetMs: 0 },
      { lat: -34.59995, lng: -58.4, offsetMs: 500 },
      { lat: -34.5999, lng: -58.4, offsetMs: 1_000 },
    ]
    let sentBody = ""
    const event = trackingEvent("matched-event")
    event.payload.matchedTrajectory = matchedTrajectory
    const result = await publishRealtimeEvent(event, {
      fetchImpl: async (_url, init = {}) => {
        sentBody = String(init.body)
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      },
    })
    expect(result.status).toBe("success")
    const sent = JSON.parse(sentBody)
    expect(sent.payload.matchedTrajectory).toEqual(matchedTrajectory)
    expect(sent.payload.lat).toBe(event.payload.lat)
    expect(sent.payload.lng).toBe(event.payload.lng)
    expect(sent.payload.version).toBe(7)
  })

  test("accepts a one-point matched trajectory and equal offsets", async () => {
    const event = trackingEvent("matched-equal-offset-event")
    event.payload.matchedTrajectory = [
      { lat: -34.6, lng: -58.4, offsetMs: 0 },
      { lat: -34.5999, lng: -58.4, offsetMs: 0 },
    ]
    const result = await publishRealtimeEvent(event, { fetchImpl: async () => new Response("{}", { status: 200 }) })
    expect(result.status).toBe("success")
  })

  test("accepts the minimum one-point matched trajectory", async () => {
    const event = trackingEvent("matched-one-point-event")
    event.payload.matchedTrajectory = [{ lat: -34.6, lng: -58.4, offsetMs: 0 }]
    const result = await publishRealtimeEvent(event, { fetchImpl: async () => new Response("{}", { status: 200 }) })
    expect(result.status).toBe("success")
  })

  test("rejects malformed matched trajectories before network I/O", async () => {
    for (const matchedTrajectory of [
      [],
      [{ lat: Number.NaN, lng: -58.4, offsetMs: 0 }],
      [{ lat: -34.6, lng: -181, offsetMs: 0 }],
      [{ lat: -34.6, lng: -58.4, offsetMs: -1 }],
      [{ lat: -34.6, lng: -58.4, offsetMs: 2 }, { lat: -34.6, lng: -58.4, offsetMs: 1 }],
      [{ lat: -34.6, lng: -58.4, offsetMs: 0, provider: "osrm" }],
    ]) {
      const event = trackingEvent("invalid-matched-event")
      event.payload.matchedTrajectory = matchedTrajectory as never
      const result = await publishRealtimeEvent(event, { fetchImpl: async () => { throw new Error("must not send") } })
      expect(result).toMatchObject({ status: "invalid", reason: "matched_trajectory_invalid" })
    }
  })

  test("rejects a matched envelope over 16 KiB before network I/O", async () => {
    const event = trackingEvent("oversized-matched-event")
    event.traceId = "x".repeat(20_000)
    event.payload.matchedTrajectory = [{ lat: -34.6, lng: -58.4, offsetMs: 0 }]
    const result = await publishRealtimeEvent(event, { fetchImpl: async () => { throw new Error("must not send") } })
    expect(result).toEqual({ status: "invalid", eventId: event.eventId, reason: "matched_payload_too_large" })
  })

  test("serializes the optional tracking trajectory without changing the legacy envelope", async () => {
    const trajectory = [
      { lat: -34.6, lng: -58.4, offsetMs: 0 },
      { lat: -34.5999, lng: -58.4, offsetMs: 1_000 },
    ]
    let sentBody = ""
    const response = await publishRealtimeEvent({
      version: 1,
      type: "tracking.location.updated",
      eventId: "trajectory-event",
      resourceId: "pedido-a",
      occurredAt: new Date().toISOString(),
      payload: { pedidoId: "pedido-a", lat: -34.5999, lng: -58.4, timestamp: new Date().toISOString(), version: 7, trajectory },
    }, {
      fetchImpl: async (_url, init = {}) => {
        sentBody = String(init.body)
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      },
    })

    expect(response.status).toBe("success")
    expect(JSON.parse(sentBody).payload.trajectory).toEqual(trajectory)
  })

  test("composes URL and emits verifier-compatible HMAC headers", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = []
    const response = await publishRealtimeEvent(event(), {
      now: () => 1_700_000_000_000,
      fetchImpl: async (url, init = {}) => {
        calls.push({ url: String(url), init })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      },
    })

    expect(response.status).toBe("success")
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe("http://internal-chat.test/base" + INTERNAL_PUBLISH_PATH)
    expect(calls[0].init.method).toBe("POST")
    expect(calls[0].init.headers).toMatchObject({
      "Content-Type": "application/json",
    })

    const headers = calls[0].init.headers as Record<string, string>
    const body = String(calls[0].init.body)
    const expected = createHmac("sha256", secret)
      .update(
        headers["X-DeliGO-Timestamp"] +
          "." +
          headers["X-DeliGO-Request-Id"] +
          "." +
          body,
        "utf8"
      )
      .digest("hex")
    expect(headers["X-DeliGO-Signature"]).toBe(expected)
  })

  test("changes requestId on retry while preserving eventId", async () => {
    const calls: Array<{ headers: Record<string, string>; body: string }> = []
    let attempt = 0
    const response = await publishRealtimeEvent(event("retry-event"), {
      sleep: async () => {},
      fetchImpl: async (_url, init = {}) => {
        attempt += 1
        calls.push({
          headers: init.headers as Record<string, string>,
          body: String(init.body),
        })
        return new Response("temporary", { status: attempt === 1 ? 503 : 200 })
      },
    })

    expect(response).toMatchObject({ status: "success", eventId: "retry-event", attempts: 2 })
    expect(calls[0].headers["X-DeliGO-Request-Id"]).not.toBe(calls[1].headers["X-DeliGO-Request-Id"])
    expect(calls[0].body).toBe(calls[1].body)
  })

  test("does not retry 4xx responses", async () => {
    let calls = 0
    const response = await publishRealtimeEvent(event("client-error"), {
      fetchImpl: async () => {
        calls += 1
        return new Response("bad request", { status: 422 })
      },
    })

    expect(response).toMatchObject({ status: "failed", eventId: "client-error", attempts: 1, httpStatus: 422 })
    expect(calls).toBe(1)
  })

  test("retries one time on a network failure", async () => {
    let calls = 0
    const response = await publishRealtimeEvent(event("network-error"), {
      sleep: async () => {},
      fetchImpl: async () => {
        calls += 1
        throw new Error("network unavailable")
      },
    })

    expect(response).toMatchObject({ status: "failed", eventId: "network-error", attempts: 2 })
    expect(calls).toBe(2)
  })

  test("uses the bounded timeout and returns best-effort failure", async () => {
    const startedAt = Date.now()
    const response = await publishRealtimeEvent(event("timeout-event"), {
      sleep: async () => {},
      fetchImpl: async (_url, init = {}) => {
        await new Promise<never>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(new Error("aborted")))
        })
        throw new Error("unreachable")
      },
    })

    expect(response).toMatchObject({ status: "failed", eventId: "timeout-event", attempts: 2 })
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(INTERNAL_PUBLISH_TIMEOUT_MS)
  })

  test("fails safe when URL or secret configuration is partial", async () => {
    delete process.env.REALTIME_INTERNAL_SERVICE_URL
    const disabledByUrl = await publishRealtimeEvent(event("disabled-url"))
    expect(disabledByUrl).toEqual({ status: "disabled", reason: "configuration_incomplete" })

    process.env.REALTIME_INTERNAL_SERVICE_URL = "http://internal-chat.test"
    delete process.env.REALTIME_INTERNAL_PUBLISH_SECRET
    const disabledBySecret = await publishRealtimeEvent(event("disabled-secret"))
    expect(disabledBySecret).toEqual({ status: "disabled", reason: "configuration_incomplete" })
  })

  test("rejects URL query/hash and credential-bearing targets", async () => {
    process.env.REALTIME_INTERNAL_SERVICE_URL = "https://internal-chat.test/base?target=unsafe"
    const disabledByQuery = await publishRealtimeEvent(event("disabled-query"))
    expect(disabledByQuery).toEqual({ status: "disabled", reason: "configuration_invalid" })

    process.env.REALTIME_INTERNAL_SERVICE_URL = "https://user:pass@internal-chat.test/base"
    const disabledByCredentials = await publishRealtimeEvent(event("disabled-credentials"))
    expect(disabledByCredentials).toEqual({ status: "disabled", reason: "configuration_invalid" })
  })
})
