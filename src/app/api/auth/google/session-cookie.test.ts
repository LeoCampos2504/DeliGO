import { beforeEach, afterEach, describe, expect, test, mock } from "bun:test"
import { NextRequest, NextResponse } from "next/server"
import { proxy } from "@/proxy"
import { authMockState, installAuthMock, resetAuthMockState } from "@/lib/test-helpers/auth-mock"

installAuthMock()

process.env.PUSH_OWNER_HANDOFF_SECRET = "google-oauth-session-test-secret-".repeat(2)
process.env.GOOGLE_CLIENT_ID = "google-client-test"
process.env.GOOGLE_CLIENT_SECRET = "google-secret-test"
process.env.GOOGLE_REDIRECT_URI = "http://localhost/api/auth/google/callback"
process.env.NEXT_PUBLIC_APP_URL = "http://localhost"

const dbMock = {
  cliente: {
    findUnique: async () => ({ id: "cliente-test", nombre: "Cliente", email: "cliente@example.test" }),
    findFirst: async () => null,
    update: async () => null,
  },
  repartidor: {
    findUnique: async () => ({ id: "repartidor-test", nombre: "Repartidor", email: "repartidor@example.test", activo: true }),
    findFirst: async () => null,
    update: async () => null,
  },
  legalAcceptance: { findFirst: async () => ({ id: "legal-fixture" }) },
}

mock.module("@/lib/db", () => ({ db: dbMock }))

const { GET: googleCallback } = await import("./callback/route")
const { GET: authMe } = await import("../me/route")
const { POST: logout } = await import("../logout/route")
const { setFamilySessionCookie } = await import("@/lib/auth-session-cookie")
const { verifyPushOwnerHandoff } = await import("@/lib/push-owner-handoff")

const originalFetch = globalThis.fetch
let callbackRole: "cliente" | "repartidor" = "cliente"

function uuid(): string {
  return crypto.randomUUID()
}

function cookieHeader(response: NextResponse): string {
  return response.headers.get("set-cookie") ?? ""
}

function callbackRequest(role: "cliente" | "repartidor", extraCookies = ""): NextRequest {
  return new NextRequest("http://localhost/api/auth/google/callback?code=fake-code&state=fake-state", {
    headers: { cookie: `google_oauth_role=${role}; google_oauth_state=fake-state${extraCookies ? `; ${extraCookies}` : ""}` },
  })
}

async function invokeCallback(role: "cliente" | "repartidor", extraCookies = ""): Promise<NextResponse> {
  callbackRole = role
  return googleCallback(callbackRequest(role, extraCookies))
}

beforeEach(() => {
  resetAuthMockState()
  dbMock.cliente.findUnique = async () => ({ id: "cliente-test", nombre: "Cliente", email: "cliente@example.test" })
  dbMock.repartidor.findUnique = async () => ({ id: "repartidor-test", nombre: "Repartidor", email: "repartidor@example.test", activo: true })
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes("oauth2.googleapis.com/token")) {
      return Response.json({ access_token: "fake-access-token", id_token: "fake-id-token", token_type: "Bearer", expires_in: 3600 })
    }
    return Response.json({
      sub: callbackRole === "cliente" ? "google-cliente-fixture" : "google-repartidor-fixture",
      email: callbackRole === "cliente" ? "cliente@example.test" : "repartidor@example.test",
      email_verified: true,
      name: "OAuth Fixture",
      picture: "",
      given_name: "OAuth",
      family_name: "Fixture",
    })
  }) as typeof fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe("P2-T34-R3 Google OAuth family session cookies", () => {
  test("callback Cliente escribe su cookie familiar, no una nueva cookie global", async () => {
    const role = "cliente"
    const expectedCookie = "deligo_session_cliente"
    const response = await invokeCallback(role)

    expect(response.status).toBe(307)
    expect(response.cookies.get(expectedCookie)?.value).toBeTruthy()
    expect(response.cookies.get("deligo_session")).toBeUndefined()
    expect(cookieHeader(response)).not.toMatch(/(?:^|[,; ])deligo_session=/)
    expect(response.cookies.get("deligo_push_handoff")?.value).toBeTruthy()
  })

  test("callback Repartidor escribe su cookie familiar, no una nueva cookie global", async () => {
    const role = "repartidor"
    const expectedCookie = "deligo_session_repartidor"
    const response = await invokeCallback(role)

    expect(response.status).toBe(307)
    expect(response.cookies.get(expectedCookie)?.value).toBeTruthy()
    expect(response.cookies.get("deligo_session")).toBeUndefined()
    expect(cookieHeader(response)).not.toMatch(/(?:^|[,; ])deligo_session=/)
    expect(response.cookies.get("deligo_push_handoff")?.value).toBeTruthy()
  })

  test("T40 conserva owner anterior de la misma familia desde legacy durante migración", async () => {
    authMockState.sesionByToken.set("legacy-client-token", {
      token: "legacy-client-token",
      userId: "cliente-old",
      userType: "cliente",
      expiresAt: new Date(Date.now() - 1000),
    })

    const response = await invokeCallback("cliente", "deligo_session=legacy-client-token")
    const handoff = await verifyPushOwnerHandoff(response.cookies.get("deligo_push_handoff")?.value)

    expect(handoff?.family).toBe("cliente")
    expect(handoff?.prevOwnerId).toBe("cliente-old")
  })

  test("T40 nunca limpia el owner de otra familia encontrado en la cookie legacy compartida", async () => {
    authMockState.sesionByToken.set("legacy-driver-token", {
      token: "legacy-driver-token",
      userId: "repartidor-old",
      userType: "repartidor",
      expiresAt: new Date(Date.now() + 60_000),
    })

    const response = await invokeCallback("cliente", "deligo_session=legacy-driver-token")
    const handoff = await verifyPushOwnerHandoff(response.cookies.get("deligo_push_handoff")?.value)

    expect(handoff?.family).toBe("cliente")
    expect(handoff?.prevOwnerType).toBeNull()
    expect(handoff?.prevOwnerId).toBeNull()
  })

  test("con ambas cookies emitidas, proxy y /api/auth/me mantienen Cliente y Repartidor independientes", async () => {
    const response = NextResponse.json({ ok: true })
    const clienteToken = uuid()
    const repartidorToken = uuid()
    setFamilySessionCookie(response, clienteToken, "cliente")
    setFamilySessionCookie(response, repartidorToken, "repartidor")

    expect(response.cookies.get("deligo_session_cliente")?.value).toBe(clienteToken)
    expect(response.cookies.get("deligo_session_repartidor")?.value).toBe(repartidorToken)
    expect(response.cookies.get("deligo_session")).toBeUndefined()

    authMockState.usersByToken.set(clienteToken, { id: "cliente-fixture", type: "cliente" })
    authMockState.usersByToken.set(repartidorToken, { id: "repartidor-fixture", type: "repartidor" })

    for (const [family, expectedType] of [["cliente", "cliente"], ["repartidor", "repartidor"]] as const) {
      const url = `http://localhost/api/auth/me?actorFamily=${family}`
      const incoming = new NextRequest(url, {
        headers: { cookie: `deligo_session_cliente=${clienteToken}; deligo_session_repartidor=${repartidorToken}` },
      })
      const resolved = proxy(incoming)
      const forwardedCookie = resolved.headers.get("x-middleware-request-cookie")
      expect(forwardedCookie).toContain(`deligo_session=${family === "cliente" ? clienteToken : repartidorToken}`)

      const meResponse = await authMe(new NextRequest(url, { headers: { cookie: forwardedCookie ?? "" } }))
      const body = await meResponse.json()
      expect(meResponse.status).toBe(200)
      expect(body.user.type).toBe(expectedType)
    }
  })

  test("helper conserva atributos seguros de cookie de familia", () => {
    const originalNodeEnv = process.env.NODE_ENV
    try {
      process.env.NODE_ENV = "production"
      const response = NextResponse.json({ ok: true })
      setFamilySessionCookie(response, uuid(), "cliente")
      const serialized = cookieHeader(response)

      expect(serialized).toContain("HttpOnly")
      expect(serialized).toContain("SameSite=lax")
      expect(serialized).toContain("Path=/")
      expect(serialized).toContain("Secure")
    } finally {
      process.env.NODE_ENV = originalNodeEnv
    }
  })

  test("logout Cliente elimina la sesión seleccionada y su cookie familiar, nunca la cookie Repartidor", async () => {
    const request = new NextRequest("http://localhost/api/auth/logout?actorFamily=cliente", {
      method: "POST",
      headers: {
        cookie: "deligo_session=cliente-selected-token; deligo_session_cliente=cliente-selected-token; deligo_session_repartidor=repartidor-preserved-token",
        "x-resolved-actor-family": "cliente",
      },
    })

    const response = await logout(request)

    expect(authMockState.deletedSessionTokens).toEqual(["cliente-selected-token"])
    expect(response.cookies.get("deligo_session_cliente")?.value).toBe("")
    expect(response.cookies.get("deligo_session_repartidor")).toBeUndefined()
  })

  test("callback source uses the same-family legacy fallback only for T40 lookup and never writes global session", async () => {
    const source = await Bun.file("src/app/api/auth/google/callback/route.ts").text()
    const consentSource = await Bun.file("src/app/api/auth/google/consent/route.ts").text()

    expect(source).toContain("getFamilySessionCookieName(role)")
    expect(source).toContain("previousSession.userType === role")
    expect(source).toContain("setFamilySessionCookie(response, sessionToken, role)")
    expect(source).not.toContain("response.cookies.set(SESSION_COOKIE_NAME, sessionToken")
    expect(consentSource).toContain("setFamilySessionCookie(response, sessionToken, claims.accountType)")
    expect(consentSource).not.toContain("response.cookies.set(SESSION_COOKIE_NAME, sessionToken")
  })
})
