/// <reference types="bun-types" />

// ============================================
// SEC-DEVICE-1 — src/lib/device-identity.ts: funciones puras
// ============================================
// Sin DB, sin red — sólo generación/validación/derivación del token de
// dispositivo. Nunca imprime un token/hash real fuera de estas aserciones
// sintéticas.

import { describe, expect, test } from "bun:test"
import { NextRequest, NextResponse } from "next/server"
import { DEVICE_COOKIE_NAME, getOrCreateDeviceIdentity, setDeviceCookie } from "./device-identity"

function reqWithCookie(cookieHeader?: string) {
  return new NextRequest("http://localhost/api/whatever", {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  })
}

describe("SEC-DEVICE-1 — getOrCreateDeviceIdentity: sin cookie", () => {
  test("genera un token nuevo, formato base64url de 43 caracteres, isNew=true", () => {
    const identity = getOrCreateDeviceIdentity(reqWithCookie())
    expect(identity.isNew).toBe(true)
    expect(identity.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(identity.deviceId).toMatch(/^[0-9a-f]{64}$/) // SHA-256 hex
  })

  test("dos llamadas sin cookie generan tokens/deviceId distintos", () => {
    const a = getOrCreateDeviceIdentity(reqWithCookie())
    const b = getOrCreateDeviceIdentity(reqWithCookie())
    expect(a.token).not.toBe(b.token)
    expect(a.deviceId).not.toBe(b.deviceId)
  })
})

describe("SEC-DEVICE-1 — getOrCreateDeviceIdentity: cookie válida existente", () => {
  test("misma cookie → mismo deviceId siempre (determinista), isNew=false", () => {
    const first = getOrCreateDeviceIdentity(reqWithCookie())
    const cookieHeader = `${DEVICE_COOKIE_NAME}=${first.token}`

    const second = getOrCreateDeviceIdentity(reqWithCookie(cookieHeader))
    expect(second.isNew).toBe(false)
    expect(second.token).toBe(first.token)
    expect(second.deviceId).toBe(first.deviceId)

    const third = getOrCreateDeviceIdentity(reqWithCookie(cookieHeader))
    expect(third.deviceId).toBe(first.deviceId)
  })

  test("el token crudo NUNCA aparece dentro del deviceId derivado", () => {
    const identity = getOrCreateDeviceIdentity(reqWithCookie())
    expect(identity.deviceId).not.toContain(identity.token)
    expect(identity.token).not.toBe(identity.deviceId)
  })
})

describe("SEC-DEVICE-1 — getOrCreateDeviceIdentity: cookies distintas producen deviceId distintos", () => {
  test("dos cookies válidas pero diferentes → deviceId diferentes (nunca colisiona por error)", () => {
    const a = getOrCreateDeviceIdentity(reqWithCookie())
    const b = getOrCreateDeviceIdentity(reqWithCookie(`${DEVICE_COOKIE_NAME}=${getOrCreateDeviceIdentity(reqWithCookie()).token}`))
    const aAgain = getOrCreateDeviceIdentity(reqWithCookie(`${DEVICE_COOKIE_NAME}=${a.token}`))
    expect(aAgain.deviceId).toBe(a.deviceId)
    expect(aAgain.deviceId).not.toBe(b.deviceId)
  })
})

describe("SEC-DEVICE-1 — getOrCreateDeviceIdentity: cookie inválida se regenera, nunca 500", () => {
  test("cookie manipulada/formato ajeno → se trata como ausente, se genera token nuevo", () => {
    const cases = [
      "not-base64url-and-way-too-short",
      "a".repeat(200), // demasiado largo
      "contains spaces not valid!!",
      "", // vacío
    ]
    for (const raw of cases) {
      const identity = getOrCreateDeviceIdentity(reqWithCookie(`${DEVICE_COOKIE_NAME}=${raw}`))
      expect(identity.isNew).toBe(true)
      expect(identity.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    }
  })
})

describe("SEC-DEVICE-1 — setDeviceCookie: opciones seguras", () => {
  test("HttpOnly, SameSite=Lax, Path=/, maxAge ~1 año", () => {
    const res = NextResponse.json({ ok: true })
    setDeviceCookie(res, "synthetic-raw-token-for-test-only-not-real-0000000")
    const setCookieHeader = res.headers.get("set-cookie") ?? ""
    expect(setCookieHeader).toContain(`${DEVICE_COOKIE_NAME}=`)
    expect(setCookieHeader).toContain("HttpOnly")
    expect(setCookieHeader).toMatch(/SameSite=Lax/i)
    expect(setCookieHeader).toContain("Path=/")
    expect(setCookieHeader).toContain(`Max-Age=${365 * 24 * 60 * 60}`)
  })

  test("Secure se omite fuera de producción (NODE_ENV=test durante bun test)", () => {
    const res = NextResponse.json({ ok: true })
    setDeviceCookie(res, "synthetic-raw-token-for-test-only-not-real-0000001")
    const setCookieHeader = res.headers.get("set-cookie") ?? ""
    expect(process.env.NODE_ENV).not.toBe("production")
    expect(setCookieHeader).not.toMatch(/;\s*Secure/i)
  })
})
