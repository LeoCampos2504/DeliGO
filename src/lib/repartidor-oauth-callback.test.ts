import { describe, expect, test } from "bun:test"
import {
  cleanRepartidorOAuthCallbackParams,
  hasRepartidorOAuthCallbackParams,
  readRepartidorOAuthCallback,
} from "./repartidor-oauth-callback"

describe("repartidor OAuth callback contract", () => {
  test("recognizes a non-authoritative success signal without identity data", () => {
    const params = new URLSearchParams("auth_success=google")
    const callback = readRepartidorOAuthCallback(params)

    expect(callback).toEqual({ kind: "success", provider: "google" })
    expect(hasRepartidorOAuthCallbackParams(params)).toBe(true)
    expect(params.has("token")).toBe(false)
    expect(params.has("userId")).toBe(false)
    expect(params.has("email")).toBe(false)
    expect(cleanRepartidorOAuthCallbackParams(new URL("https://deligo.test/repartidor?auth_success=google&tab=historial#x"))).toBe(
      "/repartidor?tab=historial#x"
    )
  })

  test("maps known and unknown errors to safe UI messages", () => {
    expect(readRepartidorOAuthCallback(new URLSearchParams("auth_error=access_denied"))).toEqual({
      kind: "error",
      code: "access_denied",
      message: "Cancelaste el inicio de sesión con Google",
    })
    expect(readRepartidorOAuthCallback(new URLSearchParams("auth_error=arbitrary-provider-text"))).toEqual({
      kind: "error",
      code: "arbitrary-provider-text",
      message: "Error al iniciar sesión con Google",
    })
  })

  test("does not process a normal URL as an OAuth callback", () => {
    const params = new URLSearchParams("tab=historial")

    expect(readRepartidorOAuthCallback(params)).toEqual({ kind: "none" })
    expect(hasRepartidorOAuthCallbackParams(params)).toBe(false)
  })

  test("uses the first success signal when it is duplicated", () => {
    expect(readRepartidorOAuthCallback(new URLSearchParams("auth_success=google&auth_success=google"))).toEqual({
      kind: "success",
      provider: "google",
    })
  })

  test("gives an OAuth error precedence over a simultaneous success signal", () => {
    expect(readRepartidorOAuthCallback(new URLSearchParams("auth_success=google&auth_error=access_denied"))).toEqual({
      kind: "error",
      code: "access_denied",
      message: "Cancelaste el inicio de sesión con Google",
    })
  })

  test("fake success remains only a signal and cannot create identity", () => {
    const params = new URLSearchParams("auth_success=google")
    const callback = readRepartidorOAuthCallback(params)

    expect(callback.kind).toBe("success")
    expect(callback).not.toHaveProperty("userId")
    expect(callback).not.toHaveProperty("token")
  })
})
