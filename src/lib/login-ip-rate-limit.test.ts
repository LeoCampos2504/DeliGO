/// <reference types="bun-types" />

// ============================================
// AUTH-LOGIN-THROTTLE-HARDENING — dimensión IP del bucket "login"
// ============================================
// Puro: sin red, sin DB — llama directamente a checkRateLimit (store en
// memoria, singleton de módulo). Usa IPs sintéticas únicas (randomUUID) para
// que este archivo nunca interfiera con otro test que también use el bucket
// "login" en el mismo proceso.

import { describe, expect, test } from "bun:test"
import { randomUUID } from "crypto"
import { checkRateLimit, RATE_LIMITS, rateLimitResponse } from "./rate-limit"

describe("bucket login — límite IP subido a 10/5min (AUTH-LOGIN-THROTTLE-HARDENING)", () => {
  test("RATE_LIMITS.login es 10 solicitudes por 5 minutos", () => {
    expect(RATE_LIMITS.login.maxRequests).toBe(10)
    expect(RATE_LIMITS.login.windowMs).toBe(5 * 60 * 1000)
  })

  test("los primeros 10 intentos desde la misma IP están permitidos", () => {
    const ip = `203.0.113.${randomUUID().slice(0, 4)}`
    for (let i = 0; i < 10; i++) {
      const r = checkRateLimit("login", ip)
      expect(r.allowed).toBe(true)
    }
  })

  test("el 11º intento desde la misma IP es rechazado con Retry-After", () => {
    const ip = `203.0.113.${randomUUID().slice(0, 4)}`
    for (let i = 0; i < 10; i++) {
      checkRateLimit("login", ip)
    }
    const eleventh = checkRateLimit("login", ip)
    expect(eleventh.allowed).toBe(false)
    expect(eleventh.retryAfterMs).toBeGreaterThan(0)

    const response = rateLimitResponse(eleventh, "Demasiados intentos. Intentá de nuevo en 5 minutos.")
    expect(response.status).toBe(429)
    expect(response.headers.get("Retry-After")).toBeTruthy()
  })

  test("otros buckets no fueron alterados por este cambio (sanity check sobre un valor sin relación)", () => {
    expect(RATE_LIMITS.register.maxRequests).toBe(3)
    expect(RATE_LIMITS.register.windowMs).toBe(60 * 60 * 1000)
    expect(RATE_LIMITS.password.maxRequests).toBe(3)
    expect(RATE_LIMITS.password.windowMs).toBe(15 * 60 * 1000)
  })
})
