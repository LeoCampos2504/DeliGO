// P2-T44-R1P5B (G3 SW CLICK TRACE): unit tests for the new TESTING-only SW
// trace ingest. No real DB, no real Railway env — same pattern as
// debug-guard/route.test.ts (env var flip + fresh import per test).
import { afterEach, describe, expect, mock, test } from "bun:test"
import { NextRequest } from "next/server"

const ORIGINAL = process.env.RAILWAY_ENVIRONMENT_NAME

function setTesting() {
  process.env.RAILWAY_ENVIRONMENT_NAME = "TESTING"
}

function restoreEnv() {
  if (ORIGINAL === undefined) delete process.env.RAILWAY_ENVIRONMENT_NAME
  else process.env.RAILWAY_ENVIRONMENT_NAME = ORIGINAL
}

function postTrace(body: unknown, headers: Record<string, string> = { "content-type": "application/json" }) {
  return import("./route").then(({ POST }) =>
    POST(
      new NextRequest("http://localhost/api/push/debug-sw-trace", {
        method: "POST",
        headers,
        body: typeof body === "string" ? body : JSON.stringify(body),
      })
    )
  )
}

describe("POST /api/push/debug-sw-trace", () => {
  afterEach(() => {
    restoreEnv()
    mock.restore()
  })

  test("production => 404, never processes the body", async () => {
    process.env.RAILWAY_ENVIRONMENT_NAME = "production"
    const infoSpy = mock(() => {})
    console.info = infoSpy
    const res = await postTrace({ event: "endpoint_self_test", traceVersion: "v1" })
    expect(res.status).toBe(404)
    expect(infoSpy).not.toHaveBeenCalled()
  })

  test("var absent (local without Railway) => 404, fail-closed", async () => {
    delete process.env.RAILWAY_ENVIRONMENT_NAME
    const res = await postTrace({ event: "endpoint_self_test" })
    expect(res.status).toBe(404)
  })

  test("TESTING + schema válido => 204, log sanitizado con receivedAt + los campos permitidos", async () => {
    setTesting()
    const infoSpy = mock(() => {})
    console.info = infoSpy
    const res = await postTrace({
      event: "notificationclick_decision",
      traceVersion: "P2_T44_R1P5B_SW_TRACE_V1",
      type: "operaciones_pyr_new_order",
      pedidoId: "pedido-123",
      rawUrlPresent: true,
      rawUrlType: "string",
      rawUrl: "/operaciones/mi-panel/mi-negocio/pyr/pedidos?pedidoId=pedido-123",
      safeInternalUrl: true,
      operationsPanelPrefixMatch: true,
      containsPyrOrSalon: true,
      selectedTargetUrl: "/operaciones/mi-panel/mi-negocio/pyr/pedidos?pedidoId=pedido-123",
      usedFallback: false,
      clientCount: 2,
    })
    expect(res.status).toBe(204)
    expect(infoSpy).toHaveBeenCalledTimes(1)
    const [tag, payloadJson] = infoSpy.mock.calls[0] as unknown as [string, string]
    expect(tag).toBe("[SW_TRACE]")
    const payload = JSON.parse(payloadJson)
    expect(payload.event).toBe("notificationclick_decision")
    expect(payload.type).toBe("operaciones_pyr_new_order")
    expect(payload.pedidoId).toBe("pedido-123")
    expect(payload.rawUrl).toBe("/operaciones/mi-panel/mi-negocio/pyr/pedidos?pedidoId=pedido-123")
    expect(payload.usedFallback).toBe(false)
    expect(payload.clientCount).toBe(2)
    expect(typeof payload.receivedAt).toBe("string")
  })

  test("body demasiado grande (>8KB) => 400/413, nunca procesado", async () => {
    setTesting()
    const infoSpy = mock(() => {})
    console.info = infoSpy
    const huge = "x".repeat(9 * 1024)
    const res = await postTrace({ event: "endpoint_self_test", errorMessage: huge })
    expect([400, 413]).toContain(res.status)
    expect(infoSpy).not.toHaveBeenCalled()
  })

  test("Content-Length header ya excede el límite => 413 sin leer el body", async () => {
    setTesting()
    const infoSpy = mock(() => {})
    console.info = infoSpy
    const res = await postTrace(
      { event: "endpoint_self_test" },
      { "content-type": "application/json", "content-length": String(9 * 1024) }
    )
    expect(res.status).toBe(413)
    expect(infoSpy).not.toHaveBeenCalled()
  })

  test("JSON inválido => 400, nunca procesado", async () => {
    setTesting()
    const infoSpy = mock(() => {})
    console.info = infoSpy
    const res = await postTrace("{ not valid json")
    expect(res.status).toBe(400)
    expect(infoSpy).not.toHaveBeenCalled()
  })

  test("Content-Type distinto de application/json => 400", async () => {
    setTesting()
    const res = await postTrace({ event: "endpoint_self_test" }, { "content-type": "text/plain" })
    expect(res.status).toBe(400)
  })

  test("evento desconocido/ausente => 400", async () => {
    setTesting()
    const res1 = await postTrace({ traceVersion: "v1" })
    expect(res1.status).toBe(400)
    const res2 = await postTrace({ event: "totally_made_up_event" })
    expect(res2.status).toBe(400)
  })

  test("campos desconocidos y con nombre de secreto nunca llegan al log", async () => {
    setTesting()
    const infoSpy = mock(() => {})
    console.info = infoSpy
    const res = await postTrace({
      event: "endpoint_self_test",
      pushEndpoint: "https://fcm.googleapis.com/secret-endpoint-abc",
      p256dh: "should-never-appear",
      authorizationHeader: "Bearer secret",
      cookieValue: "session=abc",
      password: "hunter2",
      vapidPrivateKey: "super-secret",
      unknownRandomField: "should be dropped",
    })
    expect(res.status).toBe(204)
    expect(infoSpy).toHaveBeenCalledTimes(1)
    const [, payloadJson] = infoSpy.mock.calls[0] as unknown as [string, string]
    const raw = payloadJson.toLowerCase()
    expect(raw).not.toContain("secret")
    expect(raw).not.toContain("hunter2")
    expect(raw).not.toContain("bearer")
    expect(raw).not.toContain("session=abc")
    expect(raw).not.toContain("p256dh")
    expect(raw).not.toContain("fcm.googleapis.com")
    expect(raw).not.toContain("unknownrandomfield")
    const payload = JSON.parse(payloadJson)
    expect(Object.keys(payload).sort()).toEqual(["event", "receivedAt"])
  })

  test("strings largos se truncan, nunca se loguean completos", async () => {
    setTesting()
    const infoSpy = mock(() => {})
    console.info = infoSpy
    const longFallbackReason = "R".repeat(500)
    const res = await postTrace({ event: "endpoint_self_test", fallbackReason: longFallbackReason })
    expect(res.status).toBe(204)
    const [, payloadJson] = infoSpy.mock.calls[0] as unknown as [string, string]
    const payload = JSON.parse(payloadJson)
    expect(payload.fallbackReason.length).toBeLessThan(longFallbackReason.length)
  })

  test("rawUrl/selectedTargetUrl externas o protocol-relative se descartan (nunca se loguea una URL no interna)", async () => {
    setTesting()
    const infoSpy = mock(() => {})
    console.info = infoSpy
    const res = await postTrace({
      event: "notificationclick_decision",
      rawUrl: "https://evil.example.com/steal",
      selectedTargetUrl: "//evil.example.com",
    })
    expect(res.status).toBe(204)
    const [, payloadJson] = infoSpy.mock.calls[0] as unknown as [string, string]
    const payload = JSON.parse(payloadJson)
    expect(payload.rawUrl).toBeUndefined()
    expect(payload.selectedTargetUrl).toBeUndefined()
  })

  test("nunca importa ni toca la DB", () => {
    const fs = require("fs") as typeof import("fs")
    const path = require("path") as typeof import("path")
    const source = fs.readFileSync(path.join(__dirname, "route.ts"), "utf8")
    expect(source).not.toContain("@/lib/db")
    expect(source).not.toContain("prisma")
  })

  test("no define GET — la traza nunca es legible por HTTP", () => {
    const fs = require("fs") as typeof import("fs")
    const path = require("path") as typeof import("path")
    const source = fs.readFileSync(path.join(__dirname, "route.ts"), "utf8")
    expect(source).not.toMatch(/export\s+async\s+function\s+GET/)
  })
})
