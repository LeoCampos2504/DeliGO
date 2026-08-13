/// <reference types="bun-types" />

// ============================================
// AUTH-LOGIN-THROTTLE-HARDENING — lógica pura (sin DB)
// ============================================
// loginThrottleKey() y decideLoginThrottle() no tocan Postgres — se prueban
// aisladas. Las funciones que sí tocan DB (checkLoginAccountThrottle,
// recordLoginFailure, clearLoginFailures) se cubren en el contrato de
// integración una vez aplicada la migración a TESTING (fuera de esta tarea,
// ver PENDING_TEST_DB_MIGRATION en el informe).

import { describe, expect, test } from "bun:test"
import {
  ACCOUNT_FAILURE_LIMIT,
  ACCOUNT_WINDOW_MS,
  decideLoginThrottle,
  loginThrottleKey,
  type LoginThrottleRowSnapshot,
} from "./auth-login-throttle"

describe("loginThrottleKey — derivación de clave", () => {
  test("Cliente: mismo email con distinto casing/espacios produce distinta key si no se normaliza antes (el módulo no normaliza)", () => {
    // loginThrottleKey NO normaliza — es responsabilidad del caller pasar el
    // mismo valor ya normalizado que usa para el lookup real (ver rutas).
    const raw = loginThrottleKey("cliente", "Usuario@Example.com")
    const normalized = loginThrottleKey("cliente", "usuario@example.com")
    expect(raw).not.toBe(normalized)
  })

  test("Cliente email (ya normalizado): trim + lowercase produce la misma key que el valor final usado en el lookup", () => {
    const email = "  Usuario@Example.com  "
    const normalized = email.toLowerCase().trim()
    expect(normalized).toBe("usuario@example.com")
    const key = loginThrottleKey("cliente", normalized)
    expect(key).toBe(loginThrottleKey("cliente", "usuario@example.com"))
  })

  test("Repartidor email: misma semántica trim + lowercase que Cliente", () => {
    const email = "  Repartidor@Example.com  ".toLowerCase().trim()
    expect(email).toBe("repartidor@example.com")
    expect(loginThrottleKey("repartidor", email)).toBe(loginThrottleKey("repartidor", "repartidor@example.com"))
  })

  test("CuentaOperativa email: misma semántica trim + lowercase", () => {
    const email = "  Operativa@Example.com  ".toLowerCase().trim()
    expect(email).toBe("operativa@example.com")
    expect(loginThrottleKey("cuenta_operativa", email)).toBe(
      loginThrottleKey("cuenta_operativa", "operativa@example.com")
    )
  })

  test("Negocio usuario: SOLO trim, SIN lowercase forzado (el lookup real tampoco lo fuerza)", () => {
    const usuario = "  MiUsuario123  ".trim()
    expect(usuario).toBe("MiUsuario123") // mayúsculas preservadas a propósito
    const key = loginThrottleKey("negocio", usuario)
    // Una key calculada con lowercase forzado sería DISTINTA — confirma que
    // este helper no lo aplica por su cuenta.
    expect(key).not.toBe(loginThrottleKey("negocio", usuario.toLowerCase()))
  })

  test("mismo accountType + identifier -> misma key (determinístico)", () => {
    expect(loginThrottleKey("cliente", "a@b.com")).toBe(loginThrottleKey("cliente", "a@b.com"))
  })

  test("accountType distinto con el mismo identifier -> key distinta (namespacing entre tipos de cuenta)", () => {
    const a = loginThrottleKey("cliente", "a@b.com")
    const b = loginThrottleKey("repartidor", "a@b.com")
    const c = loginThrottleKey("negocio", "a@b.com")
    const d = loginThrottleKey("cuenta_operativa", "a@b.com")
    const all = [a, b, c, d]
    expect(new Set(all).size).toBe(4)
  })

  test("la key es un hash hexadecimal SHA-256 (64 caracteres hex) — nunca el identifier en claro", () => {
    const key = loginThrottleKey("cliente", "alguien@example.com")
    expect(key).toMatch(/^[0-9a-f]{64}$/)
    expect(key).not.toContain("alguien")
    expect(key).not.toContain("example.com")
    expect(key).not.toContain("@")
  })
})

describe("decideLoginThrottle — semántica de ventana (pura)", () => {
  const now = new Date("2026-08-13T12:00:00.000Z")

  test("sin fila (null) -> allowed, sin fallos activos", () => {
    const result = decideLoginThrottle(null, now)
    expect(result).toEqual({ allowed: true, hadActiveFailures: false })
  })

  test("count=9 dentro de ventana activa -> allowed (todavía por debajo del límite de 10)", () => {
    const row: LoginThrottleRowSnapshot = { count: 9, resetAt: new Date(now.getTime() + 60_000) }
    const result = decideLoginThrottle(row, now)
    expect(result.allowed).toBe(true)
    expect(result.hadActiveFailures).toBe(true)
  })

  test("count=10 (=ACCOUNT_FAILURE_LIMIT) dentro de ventana activa -> throttled, sin esperar un 11º intento", () => {
    expect(ACCOUNT_FAILURE_LIMIT).toBe(10)
    const row: LoginThrottleRowSnapshot = { count: 10, resetAt: new Date(now.getTime() + 60_000) }
    const result = decideLoginThrottle(row, now)
    expect(result.allowed).toBe(false)
    expect(result.hadActiveFailures).toBe(true)
    expect(result.retryAfterMs).toBe(60_000)
  })

  test("fila expirada (resetAt <= now) -> allowed, tratada como si no existiera", () => {
    const row: LoginThrottleRowSnapshot = { count: 10, resetAt: new Date(now.getTime() - 1) }
    const result = decideLoginThrottle(row, now)
    expect(result.allowed).toBe(true)
    expect(result.hadActiveFailures).toBe(false)
  })

  test("resetAt exactamente igual a now -> tratada como expirada (<=), no bloquea", () => {
    const row: LoginThrottleRowSnapshot = { count: 10, resetAt: now }
    const result = decideLoginThrottle(row, now)
    expect(result.allowed).toBe(true)
  })

  test("retryAfterMs se calcula correctamente como resetAt - now", () => {
    const row: LoginThrottleRowSnapshot = { count: 15, resetAt: new Date(now.getTime() + 123_456) }
    const result = decideLoginThrottle(row, now)
    expect(result.allowed).toBe(false)
    expect(result.retryAfterMs).toBe(123_456)
  })

  test("ACCOUNT_WINDOW_MS es de 10 minutos exactos", () => {
    expect(ACCOUNT_WINDOW_MS).toBe(10 * 60 * 1000)
  })
})
