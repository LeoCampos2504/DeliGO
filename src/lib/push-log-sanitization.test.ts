/// <reference types="bun-types" />

// ============================================
// GLOBAL-LOGS-PII-1 — push.ts: el endpoint de push (identificador de
// dispositivo de larga duración) y el body crudo del proveedor nunca se
// imprimen en logs runtime, sin importar el caller.
// ============================================
// Usa un endpoint sintético en TEST-NET-3 (RFC 5737, no ruteable) para
// forzar un fallo de red determinista sin depender de un servicio push
// real. Nunca registra un push subscription real ni toca datos de usuario.

import { afterEach, beforeEach, describe, expect, setDefaultTimeout, test } from "bun:test"
import { sendPushNotification } from "./push"

setDefaultTimeout(20_000)

describe("GLOBAL-LOGS-PII-1 — sendPushNotification: endpoint nunca en logs", () => {
  const originalError = console.error
  let captured: string[]

  beforeEach(() => {
    captured = []
    console.error = (...args: unknown[]) => {
      captured.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "))
    }
  })

  afterEach(() => {
    console.error = originalError
  })

  test("fallo de envío: el endpoint sentinel no aparece en ningún console.error capturado", async () => {
    const sentinelEndpoint = "https://203.0.113.77/push-test-endpoint-sentinel-value"
    const subscriptionJson = JSON.stringify({
      endpoint: sentinelEndpoint,
      keys: { p256dh: "fake-p256dh-test-key", auth: "fake-auth-test-key" },
    })

    const result = await sendPushNotification(subscriptionJson, { title: "test", body: "test" })

    expect(result).toBe(false)
    const output = captured.join("\n")
    expect(output).not.toContain(sentinelEndpoint)
    expect(output).not.toContain("203.0.113.77")
    // Señal operativa preservada: el prefijo de log sigue identificando el subsistema.
    expect(output).toContain("[Push]")
  })
})
