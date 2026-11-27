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

beforeEach(() => {
  process.env.REALTIME_INTERNAL_SERVICE_URL = "http://internal-chat.test/base/"
  process.env.REALTIME_INTERNAL_PUBLISH_SECRET = secret
})

describe("server-only realtime publish helper", () => {
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
