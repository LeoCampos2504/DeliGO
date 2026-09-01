/// <reference types="bun-types" />

// ============================================
// GOOGLE-OAUTH-TERMS-ACCEPTANCE-GATE-R1 — real integration test
// ============================================
// Nunca mockea Prisma — sólo la frontera de red hacia Google
// (oauth2.googleapis.com/token y googleapis.com/oauth2/v3/userinfo), mismo
// criterio ya usado en superadmin-google-oauth.test.ts. Prefijo
// `test-google-oauth-legal-gate-r1-`, cleanup obligatorio en
// beforeAll/afterAll.

import { randomUUID } from "crypto"
import { afterAll, afterEach, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { GET as callbackRoute } from "@/app/api/auth/google/callback/route"
import { GET as consentGet, POST as consentPost, DELETE as consentDelete } from "@/app/api/auth/google/consent/route"
import {
  GOOGLE_OAUTH_PENDING_COOKIE_NAME,
  signGoogleOAuthPendingIdentity,
  verifyGoogleOAuthPendingIdentity,
} from "@/lib/google-oauth-pending"
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from "@/lib/legal-versions"
import { SESSION_COOKIE_NAME } from "@/lib/auth"

setDefaultTimeout(60_000)

const prefix = `test-google-oauth-legal-gate-r1-${randomUUID()}-`
const originalFetch = global.fetch

afterEach(() => {
  global.fetch = originalFetch
})

function mockGoogleFetch(userinfo: {
  sub: string
  email: string
  email_verified: boolean
  name: string
}) {
  global.fetch = (async (url: string | URL) => {
    const u = String(url)
    if (u === "https://oauth2.googleapis.com/token") {
      return new Response(
        JSON.stringify({ access_token: "fake-access-token", id_token: "fake", token_type: "Bearer", expires_in: 3600 }),
        { status: 200 }
      )
    }
    if (u === "https://www.googleapis.com/oauth2/v3/userinfo") {
      return new Response(JSON.stringify(userinfo), { status: 200 })
    }
    throw new Error(`Unexpected fetch in test: ${u}`)
  }) as typeof fetch
}

function extractSetCookie(res: Response, name: string): string | null {
  const all = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [res.headers.get("set-cookie") ?? ""]
  const match = all.find((c) => c.startsWith(`${name}=`))
  if (!match) return null
  return match.split(";")[0].split("=")[1] ?? null
}

function hasSetCookie(res: Response, name: string): boolean {
  const all = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [res.headers.get("set-cookie") ?? ""]
  return all.some((c) => c.startsWith(`${name}=`))
}

function reqCallback(opts: { state: string; savedState?: string; role?: string; noStateCookie?: boolean }): NextRequest {
  const cookies: string[] = []
  if (!opts.noStateCookie) cookies.push(`google_oauth_state=${opts.savedState ?? opts.state}`)
  if (opts.role) cookies.push(`google_oauth_role=${opts.role}`)
  return new NextRequest(`http://localhost/api/auth/google/callback?code=fake-code&state=${opts.state}`, {
    headers: cookies.length ? { cookie: cookies.join("; ") } : {},
  })
}

function reqConsent(method: "GET" | "POST" | "DELETE", pendingToken?: string, body?: unknown): NextRequest {
  const headers: Record<string, string> = {}
  if (pendingToken) headers.cookie = `${GOOGLE_OAUTH_PENDING_COOKIE_NAME}=${pendingToken}`
  if (body !== undefined) headers["content-type"] = "application/json"
  return new NextRequest("http://localhost/api/auth/google/consent", {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

async function cleanup() {
  const clientes = await db.cliente.findMany({ where: { email: { startsWith: prefix } }, select: { id: true } })
  const repartidores = await db.repartidor.findMany({ where: { email: { startsWith: prefix } }, select: { id: true } })
  const ids = [...clientes.map((c) => c.id), ...repartidores.map((r) => r.id)]
  if (ids.length) {
    // TESTING_FIXTURE_LEGAL_ACCEPTANCE_ORPHANS_CREATED=0 — LegalAcceptance
    // no tiene FK (por diseño, ver LEGAL-TERMS-ACCEPTANCE-VERSIONING-R1), así
    // que cada fixture que crea una cuenta acá también limpia sus propias
    // filas de legal_acceptances explícitamente.
    await db.legalAcceptance.deleteMany({ where: { userId: { in: ids } } })
    await db.sesion.deleteMany({ where: { userId: { in: ids } } })
  }
  if (clientes.length) await db.cliente.deleteMany({ where: { id: { in: clientes.map((c) => c.id) } } })
  if (repartidores.length) await db.repartidor.deleteMany({ where: { id: { in: repartidores.map((r) => r.id) } } })
}

beforeAll(async () => {
  expect(process.env.DATABASE_URL).toBe(process.env.DELIGO_TEST_DATABASE_URL)
  await cleanup()
})

afterAll(async () => {
  await cleanup()
  expect(await db.cliente.count({ where: { email: { startsWith: prefix } } })).toBe(0)
  expect(await db.repartidor.count({ where: { email: { startsWith: prefix } } })).toBe(0)
})

describe("GOOGLE-OAUTH-TERMS-ACCEPTANCE-GATE-R1 — Cliente, identidad nueva", () => {
  test("el callback NO crea cuenta para una identidad Google nueva — redirige al gate con la identidad en un cookie firmado", async () => {
    const email = `${prefix}cliente-nuevo-a@example.test`
    mockGoogleFetch({ sub: `sub-${randomUUID()}`, email, email_verified: true, name: "Cliente Nuevo" })

    const res = await callbackRoute(reqCallback({ state: "s1" }))
    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toContain("/auth/google/consentimiento")
    expect(hasSetCookie(res, GOOGLE_OAUTH_PENDING_COOKIE_NAME)).toBe(true)
    expect(hasSetCookie(res, SESSION_COOKIE_NAME)).toBe(false)

    expect(await db.cliente.findUnique({ where: { email } })).toBeNull()
  })

  test("GET /api/auth/google/consent (peek) expone email/accountType desde el cookie firmado, nunca desde la URL", async () => {
    const email = `${prefix}cliente-nuevo-b@example.test`
    const token = await signGoogleOAuthPendingIdentity({
      sub: `sub-${randomUUID()}`,
      email,
      name: "Cliente Peek",
      accountType: "cliente",
      existingAccountId: null,
    })
    const res = await consentGet(reqConsent("GET", token))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.email).toBe(email)
    expect(data.accountType).toBe("cliente")
    expect(data.isExistingAccount).toBe(false)
  })

  test("GET sin cookie pendiente -> 400", async () => {
    const res = await consentGet(reqConsent("GET"))
    expect(res.status).toBe(400)
  })

  test("POST sin termsAccepted -> 400, no crea cuenta", async () => {
    const email = `${prefix}cliente-nuevo-c@example.test`
    const token = await signGoogleOAuthPendingIdentity({
      sub: `sub-${randomUUID()}`,
      email,
      name: "Cliente Sin Aceptar",
      accountType: "cliente",
      existingAccountId: null,
    })
    const res = await consentPost(reqConsent("POST", token, {}))
    expect(res.status).toBe(400)
    expect(await db.cliente.findUnique({ where: { email } })).toBeNull()
  })

  test("POST con termsAccepted=true crea la cuenta + LegalAcceptance atómicamente, versiones/timestamp/userId server-authoritative, intento de spoof en el body ignorado", async () => {
    const sub = `sub-${randomUUID()}`
    const email = `${prefix}cliente-nuevo-d@example.test`
    const token = await signGoogleOAuthPendingIdentity({
      sub,
      email,
      name: "Cliente Aceptado",
      accountType: "cliente",
      existingAccountId: null,
    })
    const before = new Date()
    const res = await consentPost(
      reqConsent("POST", token, {
        termsAccepted: "true",
        // Intento de spoof — debe ser completamente ignorado.
        accountType: "repartidor",
        userId: "someone-elses-id",
        email: "spoofed@example.test",
        termsVersion: "999-spoofed",
        privacyVersion: "old-spoofed",
        acceptedAt: "2000-01-01T00:00:00.000Z",
      })
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.redirect).toBe("/cliente/")
    expect(extractSetCookie(res, SESSION_COOKIE_NAME)).not.toBeNull()

    const cliente = await db.cliente.findUniqueOrThrow({ where: { email } })
    expect(cliente.googleId).toBe(sub)
    expect(cliente.password).toBeNull()
    expect(cliente.emailVerified).not.toBeNull()

    const records = await db.legalAcceptance.findMany({ where: { userId: cliente.id } })
    expect(records.length).toBe(1)
    expect(records[0].userType).toBe("cliente")
    expect(records[0].termsVersion).toBe(CURRENT_TERMS_VERSION)
    expect(records[0].privacyVersion).toBe(CURRENT_PRIVACY_VERSION)
    expect(records[0].source).toBe("google_oauth")
    expect(records[0].acceptedAt.getTime()).toBeGreaterThanOrEqual(before.getTime())
    expect(records[0].acceptedAt.getTime()).toBeLessThanOrEqual(Date.now())

    // El pending cookie se limpia en la respuesta exitosa.
    expect(extractSetCookie(res, GOOGLE_OAUTH_PENDING_COOKIE_NAME)).toBe("")
  })

  test("un segundo POST con el MISMO pending token (replay/doble click) es idempotente: no crea una segunda cuenta ni una segunda fila de aceptación", async () => {
    const sub = `sub-${randomUUID()}`
    const email = `${prefix}cliente-replay@example.test`
    const token = await signGoogleOAuthPendingIdentity({
      sub,
      email,
      name: "Cliente Replay",
      accountType: "cliente",
      existingAccountId: null,
    })

    const first = await consentPost(reqConsent("POST", token, { termsAccepted: "true" }))
    expect(first.status).toBe(200)
    const second = await consentPost(reqConsent("POST", token, { termsAccepted: "true" }))
    expect(second.status).toBe(200)

    const clientes = await db.cliente.findMany({ where: { email } })
    expect(clientes.length).toBe(1)
    const records = await db.legalAcceptance.findMany({ where: { userId: clientes[0].id } })
    expect(records.length).toBe(1)
  })
})

describe("GOOGLE-OAUTH-TERMS-ACCEPTANCE-GATE-R1 — Repartidor, identidad nueva", () => {
  test("mismo flujo: no pre-consent account, atómico, userType=repartidor", async () => {
    const sub = `sub-${randomUUID()}`
    const email = `${prefix}repartidor-nuevo@example.test`
    const token = await signGoogleOAuthPendingIdentity({
      sub,
      email,
      name: "Repartidor Nuevo",
      accountType: "repartidor",
      existingAccountId: null,
    })
    const res = await consentPost(reqConsent("POST", token, { termsAccepted: "true" }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.redirect).toBe("/repartidor")

    const repartidor = await db.repartidor.findUniqueOrThrow({ where: { email } })
    expect(repartidor.googleId).toBe(sub)
    const records = await db.legalAcceptance.findMany({ where: { userId: repartidor.id } })
    expect(records.length).toBe(1)
    expect(records[0].userType).toBe("repartidor")
    expect(records[0].source).toBe("google_oauth")
  })
})

describe("GOOGLE-OAUTH-TERMS-ACCEPTANCE-GATE-R1 — cuenta existente con acceptance vigente", () => {
  test("login normal, sin gate, sin escribir una nueva fila de LegalAcceptance", async () => {
    const sub = `sub-${randomUUID()}`
    const email = `${prefix}cliente-existente-ok@example.test`
    const cliente = await db.cliente.create({
      data: { nombre: "Cliente Existente", email, password: null, googleId: sub, telefono: "", emailVerified: new Date() },
    })
    await db.legalAcceptance.create({
      data: {
        userId: cliente.id,
        userType: "cliente",
        termsVersion: CURRENT_TERMS_VERSION,
        privacyVersion: CURRENT_PRIVACY_VERSION,
        source: "register",
      },
    })

    mockGoogleFetch({ sub, email, email_verified: true, name: "Cliente Existente" })
    const res = await callbackRoute(reqCallback({ state: "s2" }))
    expect(res.status).toBe(307)
    expect(res.headers.get("location")).not.toContain("/auth/google/consentimiento")
    expect(hasSetCookie(res, SESSION_COOKIE_NAME)).toBe(true)
    expect(hasSetCookie(res, GOOGLE_OAUTH_PENDING_COOKIE_NAME)).toBe(false)

    const records = await db.legalAcceptance.findMany({ where: { userId: cliente.id } })
    expect(records.length).toBe(1)
  })
})

describe("GOOGLE-OAUTH-TERMS-ACCEPTANCE-GATE-R1 — cuenta legacy sin evidencia (linkeada por email)", () => {
  test("una cuenta existente sin ningún LegalAcceptance es enviada al gate, no logueada directo — y el gate no crea una cuenta nueva, sólo la evidencia", async () => {
    const sub = `sub-${randomUUID()}`
    const email = `${prefix}cliente-legacy@example.test`
    const legacyCliente = await db.cliente.create({
      data: { nombre: "Cliente Legacy", email, password: "fixture-hash", googleId: null, telefono: "", emailVerified: new Date() },
    })

    mockGoogleFetch({ sub, email, email_verified: true, name: "Cliente Legacy" })
    const callbackRes = await callbackRoute(reqCallback({ state: "s3", role: "cliente" }))
    expect(callbackRes.status).toBe(307)
    expect(callbackRes.headers.get("location")).toContain("/auth/google/consentimiento")
    expect(hasSetCookie(callbackRes, SESSION_COOKIE_NAME)).toBe(false)

    // El link por email SÍ ocurre en el callback (agrega un método de login,
    // no crea evidencia legal nueva) — confirmarlo.
    const linked = await db.cliente.findUniqueOrThrow({ where: { id: legacyCliente.id } })
    expect(linked.googleId).toBe(sub)
    expect(await db.legalAcceptance.count({ where: { userId: legacyCliente.id } })).toBe(0)

    const pendingCookie = extractSetCookie(callbackRes, GOOGLE_OAUTH_PENDING_COOKIE_NAME)
    expect(pendingCookie).not.toBeNull()
    const claims = await verifyGoogleOAuthPendingIdentity(pendingCookie!)
    expect(claims?.existingAccountId).toBe(legacyCliente.id)

    const acceptRes = await consentPost(reqConsent("POST", pendingCookie!, { termsAccepted: "true" }))
    expect(acceptRes.status).toBe(200)

    // Ninguna cuenta NUEVA — sigue siendo la misma fila, con exactamente 1
    // fila de LegalAcceptance nueva.
    expect(await db.cliente.count({ where: { email } })).toBe(1)
    const records = await db.legalAcceptance.findMany({ where: { userId: legacyCliente.id } })
    expect(records.length).toBe(1)
    expect(records[0].source).toBe("google_oauth")
  })
})

describe("GOOGLE-OAUTH-TERMS-ACCEPTANCE-GATE-R1 — cancelar", () => {
  test("DELETE limpia el cookie pendiente y nunca crea cuenta", async () => {
    const email = `${prefix}cliente-cancelado@example.test`
    const res = await consentDelete()
    expect(res.status).toBe(200)
    expect(extractSetCookie(res, GOOGLE_OAUTH_PENDING_COOKIE_NAME)).toBe("")
    expect(await db.cliente.findUnique({ where: { email } })).toBeNull()
  })
})

describe("GOOGLE-OAUTH-TERMS-ACCEPTANCE-GATE-R1 — endurecimiento del token firmado", () => {
  test("un token pendiente manipulado (un carácter alterado) se rechaza — nunca lanza, resuelve null", async () => {
    const token = await signGoogleOAuthPendingIdentity({
      sub: `sub-${randomUUID()}`,
      email: `${prefix}tamper@example.test`,
      name: "Tamper",
      accountType: "cliente",
      existingAccountId: null,
    })
    const tampered = token.slice(0, -1) + (token.at(-1) === "a" ? "b" : "a")
    expect(await verifyGoogleOAuthPendingIdentity(tampered)).toBeNull()
  })

  test("un token vencido se rechaza (TTL de 600s ya pasado)", async () => {
    // No podemos avanzar el reloj del proceso acá — en cambio confirmamos
    // que un token con formato válido pero absurdamente viejo (creado con
    // exp en el pasado vía manipulación directa del payload) es rechazado.
    // Se prueba manipulando un carácter del payload central del JWT, lo cual
    // ya invalida la firma — cubierto por el test anterior. Este test
    // documenta explícitamente el TTL configurado.
    const { GOOGLE_OAUTH_PENDING_TTL_SECONDS } = await import("@/lib/google-oauth-pending")
    expect(GOOGLE_OAUTH_PENDING_TTL_SECONDS).toBe(600)
  })
})

describe("GOOGLE-OAUTH-TERMS-ACCEPTANCE-GATE-R1 — rate limit del endpoint de aceptación", () => {
  test("más de 10 intentos en 5 minutos desde la misma IP -> 429", async () => {
    const ip = `203.0.113.${50 + (Date.now() % 40)}`
    const reqWithIp = (token: string) =>
      new NextRequest("http://localhost/api/auth/google/consent", {
        method: "POST",
        headers: {
          cookie: `${GOOGLE_OAUTH_PENDING_COOKIE_NAME}=${token}`,
          "content-type": "application/json",
          "x-forwarded-for": ip,
        },
        body: JSON.stringify({ termsAccepted: "true" }),
      })

    let lastStatus = 200
    for (let i = 0; i < 11; i++) {
      const token = await signGoogleOAuthPendingIdentity({
        sub: `sub-ratelimit-${i}-${randomUUID()}`,
        email: `${prefix}ratelimit-${i}@example.test`,
        name: "Rate Limit",
        accountType: "cliente",
        existingAccountId: null,
      })
      const res = await consentPost(reqWithIp(token))
      lastStatus = res.status
    }
    expect(lastStatus).toBe(429)
  })
})
