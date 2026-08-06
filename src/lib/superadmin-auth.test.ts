/// <reference types="bun-types" />
// ============================================
// DeliGO — Tests permanentes: Superadmin Google-only (24-A)
// ============================================
// Integración real contra PostgreSQL (misma base que usa `db` en runtime —
// sin mocks de Prisma). Mockea EXCLUSIVAMENTE la frontera de red hacia
// Google (fetch a oauth2.googleapis.com) en los tests de flujo OAuth
// end-to-end — nunca la lógica propia bajo prueba.
//
// `super_admins` es una tabla global sin scoping por negocio (a diferencia
// de mesa-pedido-cancelacion.test.ts): cada test la deja vacía en
// beforeEach/afterEach para que resolverIdentidadSuperadminGoogle vea un
// estado predecible.

import { describe, test, expect, beforeEach, afterEach, afterAll } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"
import { generateKeyPairSync, sign as cryptoSign } from "crypto"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createSession, createOperationalSession, hashSessionToken } from "@/lib/auth"
import {
  SUPERADMIN_SESSION_COOKIE_NAME,
  SUPERADMIN_OAUTH_STATE_COOKIE,
  SUPERADMIN_OAUTH_NONCE_COOKIE,
  SUPERADMIN_OAUTH_PKCE_COOKIE,
  createSuperadminSession,
  validateSuperadminSession,
  revokeSuperadminSession,
  requireSuperadminSession,
  bootstrapOrAuthenticateSuperadmin,
} from "@/lib/superadmin-auth"
import { __setDefaultGoogleVerifierForTests, type GoogleIdTokenVerifier } from "@/lib/superadmin-google-oauth"
import { GET as googleStartRoute } from "@/app/api/superadmin/auth/google/route"
import { GET as googleCallbackRoute } from "@/app/api/superadmin/auth/google/callback/route"
import { POST as logoutRoute } from "@/app/api/superadmin/auth/logout/route"
import { GET as meRoute } from "@/app/api/superadmin/auth/me/route"
import { GET as configGetRoute, PUT as configPutRoute } from "@/app/api/superadmin/config/route"
import { GET as dashboardGetRoute } from "@/app/api/superadmin/dashboard/route"
import { POST as loginRoute } from "@/app/api/auth/login/route"

// ---------------------------------------------------------------------------
// JWT de prueba firmado de verdad (24-A-CORRECCIÓN-1) — para los tests
// end-to-end de las rutas OAuth reales. La verificación sigue siendo la
// real de `google-auth-library`; solo se sustituye de dónde saca las claves
// públicas (vía __setDefaultGoogleVerifierForTests, restaurado siempre en
// afterEach). Nunca se llama a Google real.
// ---------------------------------------------------------------------------

const TEST_KID = "test-kid-e2e"
const { publicKey: TEST_PUBLIC_KEY, privateKey: TEST_PRIVATE_KEY } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
})

function b64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf-8") : input
  return buf.toString("base64url")
}

function signTestJwt(claims: Record<string, unknown>): string {
  const header = { alg: "RS256", kid: TEST_KID, typ: "JWT" }
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`
  const signature = cryptoSign("RSA-SHA256", Buffer.from(signingInput), TEST_PRIVATE_KEY)
  return `${signingInput}.${b64url(signature)}`
}

async function withTestGoogleVerifier<T>(fn: () => Promise<T>): Promise<T> {
  const { OAuth2Client } = await import("google-auth-library")
  const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
  ;(client as unknown as { getFederatedSignonCertsAsync: () => Promise<{ certs: Record<string, string>; format: string }> }).getFederatedSignonCertsAsync = async () => ({
    certs: { [TEST_KID]: TEST_PUBLIC_KEY },
    format: "pem",
  })
  __setDefaultGoogleVerifierForTests(client as unknown as GoogleIdTokenVerifier)
  try {
    return await fn()
  } finally {
    __setDefaultGoogleVerifierForTests(null)
  }
}

afterEach(() => {
  // Red de seguridad: nunca dejar el verificador por defecto sustituido
  // entre tests si algún assert lanzó antes del finally de
  // withTestGoogleVerifier.
  __setDefaultGoogleVerifierForTests(null)
})

const originalFetch = global.fetch

function mockFetchSequence(handlers: Array<(url: string) => Response>) {
  let i = 0
  global.fetch = (async (url: string | URL) => {
    const handler = handlers[Math.min(i, handlers.length - 1)]
    i++
    return handler(String(url))
  }) as typeof fetch
}

function restoreFetch() {
  global.fetch = originalFetch
}

async function limpiarSuperAdmins() {
  await db.superAdmin.deleteMany({})
}

const sesionesParaLimpiar: string[] = [] // tokens crudos

async function limpiarSesiones() {
  if (sesionesParaLimpiar.length === 0) return
  const hashes = sesionesParaLimpiar.map(hashSessionToken)
  await db.sesion.deleteMany({ where: { token: { in: [...hashes, ...sesionesParaLimpiar] } } })
  sesionesParaLimpiar.length = 0
}

beforeEach(async () => {
  await limpiarSuperAdmins()
})

afterAll(async () => {
  await limpiarSuperAdmins()
  await limpiarSesiones()
  restoreFetch()
})

function reqConCookies(
  url: string,
  cookies: Record<string, string>,
  init: { method?: string; headers?: Record<string, string>; body?: string } = {}
): NextRequest {
  const cookieHeader = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ")
  return new NextRequest(url, {
    method: init.method,
    body: init.body,
    headers: { ...init.headers, ...(cookieHeader ? { cookie: cookieHeader } : {}) },
  })
}

function extractSetCookies(res: Response): Record<string, { value: string; maxAge?: number; httpOnly?: boolean; secure?: boolean; sameSite?: string; path?: string }> {
  // NextResponse expone .cookies con las opciones ya parseadas.
  // @ts-expect-error -- NextResponse en runtime siempre trae .cookies
  const all = res.cookies?.getAll?.() ?? []
  const map: Record<string, { value: string; maxAge?: number; httpOnly?: boolean; secure?: boolean; sameSite?: string; path?: string }> = {}
  for (const c of all) {
    map[c.name] = { value: c.value, maxAge: c.maxAge, httpOnly: c.httpOnly, secure: c.secure, sameSite: c.sameSite as string | undefined, path: c.path }
  }
  return map
}

// ---------------------------------------------------------------------------
// A. Sesión (sección 23)
// ---------------------------------------------------------------------------

describe("24-A — Sesión Superadmin", () => {
  test("1. cookie ausente -> requireSuperadminSession rechaza (401)", async () => {
    const req = reqConCookies("http://localhost/api/superadmin/config", {})
    const result = await requireSuperadminSession(req)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(401)
  })

  test("2. cookie inválida (no existe en DB) -> 401", async () => {
    const req = reqConCookies("http://localhost/api/superadmin/config", {
      [SUPERADMIN_SESSION_COOKIE_NAME]: "a".repeat(64),
    })
    const result = await requireSuperadminSession(req)
    expect(result.ok).toBe(false)
  })

  test("3. sesión expirada -> 401", async () => {
    const admin = await db.superAdmin.create({ data: { googleSub: "sub-exp", activo: true } })
    const token = "b".repeat(64)
    await db.sesion.create({
      data: { token: hashSessionToken(token), userId: admin.id, userType: "superadmin", expiresAt: new Date(Date.now() - 1000) },
    })
    sesionesParaLimpiar.push(token)
    const identity = await validateSuperadminSession(token)
    expect(identity).toBeNull()
  })

  test("4. sesión revocada (logout) -> 401", async () => {
    const admin = await db.superAdmin.create({ data: { googleSub: "sub-revoked", activo: true } })
    const token = await createSuperadminSession(admin.id)
    sesionesParaLimpiar.push(token)
    await revokeSuperadminSession(token)
    const identity = await validateSuperadminSession(token)
    expect(identity).toBeNull()
  })

  test("5. sesión válida -> acceso concedido", async () => {
    const admin = await db.superAdmin.create({ data: { googleSub: "sub-valid", email: "a@example.com", activo: true } })
    const token = await createSuperadminSession(admin.id)
    sesionesParaLimpiar.push(token)
    const req = reqConCookies("http://localhost/api/superadmin/config", { [SUPERADMIN_SESSION_COOKIE_NAME]: token })
    const result = await requireSuperadminSession(req)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.admin.id).toBe(admin.id)
  })

  test("6. Superadmin inactivo -> rechazo aunque la sesión exista y no haya expirado", async () => {
    const admin = await db.superAdmin.create({ data: { googleSub: "sub-inactivo", activo: false } })
    const token = await createSuperadminSession(admin.id)
    sesionesParaLimpiar.push(token)
    const identity = await validateSuperadminSession(token)
    expect(identity).toBeNull()
  })

  test("7. authVersion: mecanismo deliberadamente NO implementado en esta etapa", () => {
    // La sección 9 del prompt permite elegir UNO de los dos mecanismos de
    // revocación (reusar infraestructura existente revocable, o
    // authVersion) — "no agregar ambos sin justificación clara". Esta etapa
    // reutiliza la tabla `Sesion` ya revocable fila por fila (ver tests 4 y
    // 6, que ya demuestran revocación real), así que no se agrega un
    // segundo mecanismo paralelo. Test documentado, no omitido en silencio.
      expect(true).toBe(true)
  })

  test("8. logout revoca la sesión server-side (no solo borra la cookie)", async () => {
    const admin = await db.superAdmin.create({ data: { googleSub: "sub-logout1", activo: true } })
    const token = await createSuperadminSession(admin.id)
    sesionesParaLimpiar.push(token)

    const req = reqConCookies("http://localhost/api/superadmin/auth/logout", { [SUPERADMIN_SESSION_COOKIE_NAME]: token }, { method: "POST" })
    const res = await logoutRoute(req)
    expect(res.status).toBe(200)

    const identity = await validateSuperadminSession(token)
    expect(identity).toBeNull()
  })

  test("9. logout borra la cookie de sesión", async () => {
    const admin = await db.superAdmin.create({ data: { googleSub: "sub-logout2", activo: true } })
    const token = await createSuperadminSession(admin.id)
    sesionesParaLimpiar.push(token)

    const req = reqConCookies("http://localhost/api/superadmin/auth/logout", { [SUPERADMIN_SESSION_COOKIE_NAME]: token }, { method: "POST" })
    const res = await logoutRoute(req)
    const cookies = extractSetCookies(res)
    // res.cookies.delete() (usado por el logout) borra vía Expires=epoch +
    // valor vacío, no vía maxAge:0 — ambas formas son una eliminación válida
    // de cookie, pero .get() solo expone `expires` para esta variante.
    expect(cookies[SUPERADMIN_SESSION_COOKIE_NAME]).toBeDefined()
    expect(cookies[SUPERADMIN_SESSION_COOKIE_NAME].value).toBe("")
  })

  test("9b. logout es idempotente sin cookie (no lanza, responde ok)", async () => {
    const req = reqConCookies("http://localhost/api/superadmin/auth/logout", {}, { method: "POST" })
    const res = await logoutRoute(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  test("10. logout no afecta otras cookies (nunca lee/toca la cookie compartida)", async () => {
    const admin = await db.superAdmin.create({ data: { googleSub: "sub-logout3", activo: true } })
    const superToken = await createSuperadminSession(admin.id)
    sesionesParaLimpiar.push(superToken)
    const clienteToken = await createSession("cliente-fake-id", "cliente")
    sesionesParaLimpiar.push(clienteToken)

    const req = reqConCookies(
      "http://localhost/api/superadmin/auth/logout",
      { [SUPERADMIN_SESSION_COOKIE_NAME]: superToken, deligo_session: clienteToken },
      { method: "POST" }
    )
    const res = await logoutRoute(req)
    const cookies = extractSetCookies(res)
    expect(cookies.deligo_session).toBeUndefined() // logout de superadmin nunca toca esta cookie

    // La sesión de cliente sigue viva en DB (no fue revocada por este logout).
    const clienteSesion = await db.sesion.findUnique({ where: { token: hashSessionToken(clienteToken) } })
    expect(clienteSesion).not.toBeNull()
  })

  test("11-14. cookie de sesión: HttpOnly, Secure en producción, SameSite y expiración correctos", async () => {
    process.env.SUPERADMIN_BOOTSTRAP_ENABLED = "true"
    process.env.SUPERADMIN_GOOGLE_EMAIL = "cookieflags@example.com"

    const startReq = new NextRequest("http://localhost/api/superadmin/auth/google")
    const startRes = await googleStartRoute(startReq)
    const startCookies = extractSetCookies(startRes)
    const state = startCookies[SUPERADMIN_OAUTH_STATE_COOKIE].value
    const nonce = startCookies[SUPERADMIN_OAUTH_NONCE_COOKIE].value
    const verifier = startCookies[SUPERADMIN_OAUTH_PKCE_COOKIE].value

    mockFetchSequence([
      () =>
        new Response(
          JSON.stringify({
            id_token: signTestJwt({
              iss: "https://accounts.google.com",
              aud: process.env.GOOGLE_CLIENT_ID,
              sub: "sub-cookie-flags",
              email: "cookieflags@example.com",
              email_verified: true,
              nonce,
              iat: Math.floor(Date.now() / 1000) - 5,
              exp: Math.floor(Date.now() / 1000) + 3600,
            }),
          }),
          { status: 200 }
        ),
    ])

    const callbackUrl = `http://localhost/api/superadmin/auth/google/callback?code=abc&state=${state}`
    const callbackReq = reqConCookies(callbackUrl, {
      [SUPERADMIN_OAUTH_STATE_COOKIE]: state,
      [SUPERADMIN_OAUTH_NONCE_COOKIE]: nonce,
      [SUPERADMIN_OAUTH_PKCE_COOKIE]: verifier,
    })
    const callbackRes = await withTestGoogleVerifier(() => googleCallbackRoute(callbackReq))
    const finalCookies = extractSetCookies(callbackRes)
    const sessionCookie = finalCookies[SUPERADMIN_SESSION_COOKIE_NAME]

    expect(sessionCookie).toBeDefined()
    expect(sessionCookie.httpOnly).toBe(true)
    // process.env.NODE_ENV en el entorno de test no es "production" — Secure
    // se activa condicionalmente igual que el resto de las cookies del
    // proyecto (ver src/app/api/auth/login/route.ts).
    expect(sessionCookie.secure).toBe(process.env.NODE_ENV === "production")
    expect(sessionCookie.sameSite).toBe("lax")
    expect(sessionCookie.maxAge).toBe(8 * 60 * 60) // SUPERADMIN_SESSION_DURATION_HOURS

    if (sessionCookie) sesionesParaLimpiar.push(sessionCookie.value)
    delete process.env.SUPERADMIN_BOOTSTRAP_ENABLED
    delete process.env.SUPERADMIN_GOOGLE_EMAIL
    restoreFetch()
  })

  test("15. el token crudo de sesión nunca se guarda en DB — solo su hash SHA-256", async () => {
    const admin = await db.superAdmin.create({ data: { googleSub: "sub-hash-only", activo: true } })
    const token = await createSuperadminSession(admin.id)
    sesionesParaLimpiar.push(token)

    const raw = await db.sesion.findUnique({ where: { token } }).catch(() => null)
    expect(raw).toBeNull() // no existe una fila cuyo `token` sea el valor crudo

    const hashed = await db.sesion.findUnique({ where: { token: hashSessionToken(token) } })
    expect(hashed).not.toBeNull()
    expect(hashed?.token).not.toBe(token)
  })
})

// ---------------------------------------------------------------------------
// B. Bootstrap orquestado — DB real (sección 25 / 12)
// ---------------------------------------------------------------------------

describe("24-A — Bootstrap y autenticación (PostgreSQL real)", () => {
  const claimsValidas = { sub: "sub-boot-1", email: "boot@example.com", emailVerified: true }

  test("A. base vacía + bootstrap habilitado + email correcto -> crea y guarda el sub", async () => {
    process.env.SUPERADMIN_BOOTSTRAP_ENABLED = "true"
    process.env.SUPERADMIN_GOOGLE_EMAIL = "boot@example.com"
    delete process.env.SUPERADMIN_GOOGLE_SUB

    const result = await bootstrapOrAuthenticateSuperadmin(claimsValidas)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.bootstrapped).toBe(true)
      const row = await db.superAdmin.findUnique({ where: { id: result.id } })
      expect(row?.googleSub).toBe("sub-boot-1")
      expect(row?.email).toBe("boot@example.com")
    }

    delete process.env.SUPERADMIN_BOOTSTRAP_ENABLED
    delete process.env.SUPERADMIN_GOOGLE_EMAIL
  })

  test("B. base vacía + bootstrap deshabilitado -> rechazo, 0 filas creadas", async () => {
    delete process.env.SUPERADMIN_BOOTSTRAP_ENABLED
    process.env.SUPERADMIN_GOOGLE_EMAIL = "boot@example.com"

    const result = await bootstrapOrAuthenticateSuperadmin(claimsValidas)
    expect(result.ok).toBe(false)
    expect(await db.superAdmin.count()).toBe(0)

    delete process.env.SUPERADMIN_GOOGLE_EMAIL
  })

  test("C. base vacía + email incorrecto -> rechazo", async () => {
    process.env.SUPERADMIN_BOOTSTRAP_ENABLED = "true"
    process.env.SUPERADMIN_GOOGLE_EMAIL = "otro@example.com"

    const result = await bootstrapOrAuthenticateSuperadmin(claimsValidas)
    expect(result.ok).toBe(false)
    expect(await db.superAdmin.count()).toBe(0)

    delete process.env.SUPERADMIN_BOOTSTRAP_ENABLED
    delete process.env.SUPERADMIN_GOOGLE_EMAIL
  })

  test("D. email no verificado -> rechazo", async () => {
    process.env.SUPERADMIN_BOOTSTRAP_ENABLED = "true"
    process.env.SUPERADMIN_GOOGLE_EMAIL = "boot@example.com"

    const result = await bootstrapOrAuthenticateSuperadmin({ ...claimsValidas, emailVerified: false })
    expect(result.ok).toBe(false)
    expect(await db.superAdmin.count()).toBe(0)

    delete process.env.SUPERADMIN_BOOTSTRAP_ENABLED
    delete process.env.SUPERADMIN_GOOGLE_EMAIL
  })

  test("E. Superadmin vinculado + mismo sub -> éxito, no crea otra fila", async () => {
    await db.superAdmin.create({ data: { googleSub: "sub-boot-1", email: "boot@example.com", activo: true } })
    delete process.env.SUPERADMIN_GOOGLE_SUB
    delete process.env.SUPERADMIN_BOOTSTRAP_ENABLED

    const result = await bootstrapOrAuthenticateSuperadmin(claimsValidas)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.bootstrapped).toBe(false)
    expect(await db.superAdmin.count()).toBe(1)
  })

  test("F. Superadmin vinculado + distinto sub -> rechazo, aunque el email coincida", async () => {
    await db.superAdmin.create({ data: { googleSub: "sub-otro", email: "boot@example.com", activo: true } })
    process.env.SUPERADMIN_BOOTSTRAP_ENABLED = "true"
    process.env.SUPERADMIN_GOOGLE_EMAIL = "boot@example.com"

    const result = await bootstrapOrAuthenticateSuperadmin(claimsValidas)
    expect(result.ok).toBe(false)
    expect(await db.superAdmin.count()).toBe(1)

    delete process.env.SUPERADMIN_BOOTSTRAP_ENABLED
    delete process.env.SUPERADMIN_GOOGLE_EMAIL
  })

  test("G. SUPERADMIN_GOOGLE_SUB configurado + sub distinto -> rechazo", async () => {
    process.env.SUPERADMIN_GOOGLE_SUB = "sub-pineado"
    const result = await bootstrapOrAuthenticateSuperadmin(claimsValidas)
    expect(result.ok).toBe(false)
    delete process.env.SUPERADMIN_GOOGLE_SUB
  })

  test("H. SUPERADMIN_GOOGLE_SUB configurado + sub correcto + base vacía -> crea, sin exigir bootstrap/email", async () => {
    process.env.SUPERADMIN_GOOGLE_SUB = "sub-boot-1"
    delete process.env.SUPERADMIN_BOOTSTRAP_ENABLED
    delete process.env.SUPERADMIN_GOOGLE_EMAIL

    const result = await bootstrapOrAuthenticateSuperadmin({ sub: "sub-boot-1", email: null, emailVerified: false })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.bootstrapped).toBe(true)

    delete process.env.SUPERADMIN_GOOGLE_SUB
  })

  test("I. más de un registro administrativo incompatible -> fail closed, nunca elige uno arbitrariamente", async () => {
    await db.superAdmin.create({ data: { googleSub: null, activo: true } })
    await db.superAdmin.create({ data: { googleSub: null, activo: true } })
    process.env.SUPERADMIN_BOOTSTRAP_ENABLED = "true"
    process.env.SUPERADMIN_GOOGLE_EMAIL = "boot@example.com"

    const result = await bootstrapOrAuthenticateSuperadmin(claimsValidas)
    expect(result.ok).toBe(false)
    expect(await db.superAdmin.count()).toBe(2) // ninguna fila tocada

    delete process.env.SUPERADMIN_BOOTSTRAP_ENABLED
    delete process.env.SUPERADMIN_GOOGLE_EMAIL
  })
})

// ---------------------------------------------------------------------------
// C. Concurrencia del bootstrap (sección 26)
// ---------------------------------------------------------------------------

describe("24-A — Concurrencia real de bootstrap", () => {
  test("dos bootstraps concurrentes sobre base vacía: una única identidad vinculada, sin duplicados", async () => {
    process.env.SUPERADMIN_BOOTSTRAP_ENABLED = "true"
    process.env.SUPERADMIN_GOOGLE_EMAIL = "concurrent@example.com"
    const claims = { sub: "sub-concurrent", email: "concurrent@example.com", emailVerified: true }

    const [r1, r2] = await Promise.all([
      bootstrapOrAuthenticateSuperadmin(claims),
      bootstrapOrAuthenticateSuperadmin(claims),
    ])

    expect(r1.ok).toBe(true)
    expect(r2.ok).toBe(true)
    if (r1.ok && r2.ok) expect(r1.id).toBe(r2.id) // ambos terminan reconociendo la MISMA fila

    const rows = await db.superAdmin.findMany({ where: { googleSub: "sub-concurrent" } })
    expect(rows).toHaveLength(1) // nunca dos filas para el mismo sub

    delete process.env.SUPERADMIN_BOOTSTRAP_ENABLED
    delete process.env.SUPERADMIN_GOOGLE_EMAIL
  })

  test("dos vinculaciones concurrentes sobre el mismo legacy sin sub: CAS evita doble vinculación", async () => {
    await db.superAdmin.create({ data: { googleSub: null, activo: true } })
    process.env.SUPERADMIN_BOOTSTRAP_ENABLED = "true"
    process.env.SUPERADMIN_GOOGLE_EMAIL = "legacy-link@example.com"
    const claims = { sub: "sub-legacy-link", email: "legacy-link@example.com", emailVerified: true }

    const [r1, r2] = await Promise.all([
      bootstrapOrAuthenticateSuperadmin(claims),
      bootstrapOrAuthenticateSuperadmin(claims),
    ])

    expect(r1.ok).toBe(true)
    expect(r2.ok).toBe(true)
    const rows = await db.superAdmin.findMany({})
    expect(rows).toHaveLength(1)
    expect(rows[0].googleSub).toBe("sub-legacy-link")

    delete process.env.SUPERADMIN_BOOTSTRAP_ENABLED
    delete process.env.SUPERADMIN_GOOGLE_EMAIL
  })
})

// ---------------------------------------------------------------------------
// D. Flujo OAuth end-to-end vía rutas reales (sección 22, frontera Google mockeada)
// ---------------------------------------------------------------------------

describe("24-A — Flujo OAuth Superadmin end-to-end (rutas reales)", () => {
  test("inicio: state/nonce/PKCE generados y guardados en cookies HttpOnly de corta duración", async () => {
    const req = new NextRequest("http://localhost/api/superadmin/auth/google")
    const res = await googleStartRoute(req)
    expect(res.status).toBe(307) // NextResponse.redirect default

    const cookies = extractSetCookies(res)
    expect(cookies[SUPERADMIN_OAUTH_STATE_COOKIE]).toBeDefined()
    expect(cookies[SUPERADMIN_OAUTH_NONCE_COOKIE]).toBeDefined()
    expect(cookies[SUPERADMIN_OAUTH_PKCE_COOKIE]).toBeDefined()
    for (const name of [SUPERADMIN_OAUTH_STATE_COOKIE, SUPERADMIN_OAUTH_NONCE_COOKIE, SUPERADMIN_OAUTH_PKCE_COOKIE]) {
      expect(cookies[name].httpOnly).toBe(true)
      expect(cookies[name].sameSite).toBe("lax")
      expect(cookies[name].maxAge).toBe(600)
    }

    const location = res.headers.get("location") || ""
    expect(location.startsWith("https://accounts.google.com/o/oauth2/v2/auth")).toBe(true)
  })

  test("callback: state ausente -> redirect de error genérico, cookies temporales limpiadas", async () => {
    const req = new NextRequest("http://localhost/api/superadmin/auth/google/callback?code=abc")
    const res = await googleCallbackRoute(req)
    const location = res.headers.get("location") || ""
    expect(location).toContain("/admin?superadmin_auth_error=invalid_request")
  })

  test("callback: state incorrecto (no coincide con la cookie) -> rechazo", async () => {
    const req = reqConCookies(
      "http://localhost/api/superadmin/auth/google/callback?code=abc&state=state-del-atacante",
      { [SUPERADMIN_OAUTH_STATE_COOKIE]: "state-real" }
    )
    const res = await googleCallbackRoute(req)
    expect(res.headers.get("location")).toContain("superadmin_auth_error=invalid_request")
  })

  test("callback: code ausente -> rechazo", async () => {
    const req = reqConCookies("http://localhost/api/superadmin/auth/google/callback?state=s1", {
      [SUPERADMIN_OAUTH_STATE_COOKIE]: "s1",
    })
    const res = await googleCallbackRoute(req)
    expect(res.headers.get("location")).toContain("superadmin_auth_error=invalid_request")
  })

  test("callback: error devuelto por Google (?error=access_denied) -> mensaje genérico específico", async () => {
    const req = new NextRequest("http://localhost/api/superadmin/auth/google/callback?error=access_denied")
    const res = await googleCallbackRoute(req)
    expect(res.headers.get("location")).toContain("superadmin_auth_error=access_denied")
  })

  test("replay: reutilizar un `state` ya consumido (cookie ya borrada) -> rechazo", async () => {
    // Simula un segundo request con el mismo `state` de la URL pero sin la
    // cookie (porque el primer callback ya la limpió) — el replay nunca
    // puede volver a autorizar.
    const req = new NextRequest("http://localhost/api/superadmin/auth/google/callback?code=abc&state=state-ya-usado")
    const res = await googleCallbackRoute(req)
    expect(res.headers.get("location")).toContain("superadmin_auth_error=invalid_request")
  })

  test("callback exitoso: bootstrap + cookie de sesión + redirect fijo a /admin (nunca a un destino externo)", async () => {
    process.env.SUPERADMIN_BOOTSTRAP_ENABLED = "true"
    process.env.SUPERADMIN_GOOGLE_EMAIL = "e2e@example.com"

    const startRes = await googleStartRoute(new NextRequest("http://localhost/api/superadmin/auth/google"))
    const startCookies = extractSetCookies(startRes)
    const state = startCookies[SUPERADMIN_OAUTH_STATE_COOKIE].value
    const nonce = startCookies[SUPERADMIN_OAUTH_NONCE_COOKIE].value
    const verifier = startCookies[SUPERADMIN_OAUTH_PKCE_COOKIE].value

    const idToken = signTestJwt({
      iss: "https://accounts.google.com",
      aud: process.env.GOOGLE_CLIENT_ID,
      sub: "sub-e2e-success",
      email: "e2e@example.com",
      email_verified: true,
      nonce,
      iat: Math.floor(Date.now() / 1000) - 5,
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
    mockFetchSequence([() => new Response(JSON.stringify({ id_token: idToken }), { status: 200 })])

    // Intenta también inyectar un destino de redirect arbitrario — nunca se
    // lee ni se respeta: el destino final SIEMPRE es /admin fijo.
    const callbackUrl = `http://localhost/api/superadmin/auth/google/callback?code=abc&state=${state}&redirect=https://evil.example.com`
    const req = reqConCookies(callbackUrl, {
      [SUPERADMIN_OAUTH_STATE_COOKIE]: state,
      [SUPERADMIN_OAUTH_NONCE_COOKIE]: nonce,
      [SUPERADMIN_OAUTH_PKCE_COOKIE]: verifier,
    })
    const res = await withTestGoogleVerifier(() => googleCallbackRoute(req))

    const location = res.headers.get("location") || ""
    expect(location.endsWith("/admin")).toBe(true)
    expect(location).not.toContain("evil.example.com")

    const cookies = extractSetCookies(res)
    expect(cookies[SUPERADMIN_SESSION_COOKIE_NAME]).toBeDefined()
    // Cookies temporales limpiadas (maxAge 0) tras un callback exitoso.
    expect(cookies[SUPERADMIN_OAUTH_STATE_COOKIE].maxAge).toBe(0)
    expect(cookies[SUPERADMIN_OAUTH_NONCE_COOKIE].maxAge).toBe(0)
    expect(cookies[SUPERADMIN_OAUTH_PKCE_COOKIE].maxAge).toBe(0)

    // Nunca se filtra el token/id_token/client_secret en la respuesta visible.
    const setCookieHeader = res.headers.get("set-cookie") || ""
    expect(setCookieHeader).not.toContain(idToken)
    expect(setCookieHeader).not.toContain(process.env.GOOGLE_CLIENT_SECRET || "__unset__")

    if (cookies[SUPERADMIN_SESSION_COOKIE_NAME]) {
      sesionesParaLimpiar.push(cookies[SUPERADMIN_SESSION_COOKIE_NAME].value)
    }

    delete process.env.SUPERADMIN_BOOTSTRAP_ENABLED
    delete process.env.SUPERADMIN_GOOGLE_EMAIL
    restoreFetch()
  })

  test("callback: cuenta no autorizada (bootstrap deshabilitado) -> rechazo genérico, sin revelar el motivo exacto", async () => {
    delete process.env.SUPERADMIN_BOOTSTRAP_ENABLED
    delete process.env.SUPERADMIN_GOOGLE_EMAIL

    const startRes = await googleStartRoute(new NextRequest("http://localhost/api/superadmin/auth/google"))
    const startCookies = extractSetCookies(startRes)
    const state = startCookies[SUPERADMIN_OAUTH_STATE_COOKIE].value
    const nonce = startCookies[SUPERADMIN_OAUTH_NONCE_COOKIE].value
    const verifier = startCookies[SUPERADMIN_OAUTH_PKCE_COOKIE].value

    const idToken = signTestJwt({
      iss: "https://accounts.google.com",
      aud: process.env.GOOGLE_CLIENT_ID,
      sub: "sub-no-autorizado",
      email: "cualquiera@example.com",
      email_verified: true,
      nonce,
      iat: Math.floor(Date.now() / 1000) - 5,
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
    mockFetchSequence([() => new Response(JSON.stringify({ id_token: idToken }), { status: 200 })])

    const callbackUrl = `http://localhost/api/superadmin/auth/google/callback?code=abc&state=${state}`
    const req = reqConCookies(callbackUrl, {
      [SUPERADMIN_OAUTH_STATE_COOKIE]: state,
      [SUPERADMIN_OAUTH_NONCE_COOKIE]: nonce,
      [SUPERADMIN_OAUTH_PKCE_COOKIE]: verifier,
    })
    const res = await withTestGoogleVerifier(() => googleCallbackRoute(req))
    const location = res.headers.get("location") || ""
    expect(location).toContain("superadmin_auth_error=not_authorized")
    expect(await db.superAdmin.count()).toBe(0)

    restoreFetch()
  })
})

// ---------------------------------------------------------------------------
// E. Protección de APIs — matriz + auditoría estática (sección 24)
// ---------------------------------------------------------------------------

const SUPERADMIN_ROUTE_FILES = [
  "backup/route.ts",
  "clientes/[id]/desbloquear/route.ts",
  "config/route.ts",
  "dashboard/route.ts",
  "denuncias/route.ts",
  "denuncias/[id]/route.ts",
  "deuda-historial/route.ts",
  "deuda/[id]/abonar/route.ts",
  "deuda/[id]/limite/route.ts",
  "negocios/[id]/route.ts",
  "negocios/[id]/promocionar/route.ts",
  "negocios/[id]/reactivar/route.ts",
  "negocios/[id]/renovar/route.ts",
  "negocios/[id]/suspender/route.ts",
  "solicitudes-destacado/route.ts",
  "solicitudes-destacado/[id]/aprobar/route.ts",
  "solicitudes-destacado/[id]/rechazar/route.ts",
]

describe("24-A — Protección de rutas /api/superadmin", () => {
  test("auditoría estática: las 17 rutas protegidas importan requireSuperadminSession (ninguna quedó sin cubrir)", () => {
    const base = join(process.cwd(), "src", "app", "api", "superadmin")
    for (const rel of SUPERADMIN_ROUTE_FILES) {
      const content = readFileSync(join(base, rel), "utf-8")
      expect(content).toContain("requireSuperadminSession")
      expect(content).not.toContain("SESSION_COOKIE_NAME")
      expect(content).not.toContain("getUserFromToken")
    }
  })

  // config/route.ts usa un status fijo de 403 ("Acceso denegado") para
  // CUALQUIER fallo de requireSuperadminSession — patrón preexistente
  // (ya devolvía 403 tanto para "sin token" como para "rol incorrecto" antes
  // de esta etapa; solo se reemplazó el MECANISMO de validación de sesión,
  // nunca el código de estado que cada ruta ya elegía). La sección 24 acepta
  // explícitamente "401 o resultado controlado" para el caso sin sesión.
  test("sin sesión -> config responde 403 (resultado controlado, patrón preexistente de este archivo)", async () => {
    const req = reqConCookies("http://localhost/api/superadmin/config", {})
    const res = await configGetRoute(req)
    expect(res.status).toBe(403)
  })

  test("sesión inválida -> config responde 403", async () => {
    const req = reqConCookies("http://localhost/api/superadmin/config", {
      [SUPERADMIN_SESSION_COOKIE_NAME]: "0".repeat(64),
    })
    const res = await configGetRoute(req)
    expect(res.status).toBe(403)
  })

  test("sesión Superadmin válida -> config permite acceso (200)", async () => {
    const admin = await db.superAdmin.create({ data: { googleSub: "sub-api-ok", activo: true } })
    const token = await createSuperadminSession(admin.id)
    sesionesParaLimpiar.push(token)
    const req = reqConCookies("http://localhost/api/superadmin/config", { [SUPERADMIN_SESSION_COOKIE_NAME]: token })
    const res = await configGetRoute(req)
    expect(res.status).toBe(200)
  })

  test("sesión de negocio bajo la cookie Superadmin -> rechazada (403)", async () => {
    const token = await createSession("negocio-fake-id", "negocio")
    sesionesParaLimpiar.push(token)
    const req = reqConCookies("http://localhost/api/superadmin/config", { [SUPERADMIN_SESSION_COOKIE_NAME]: token })
    const res = await configGetRoute(req)
    expect(res.status).toBe(403)
  })

  test("sesión de cliente bajo la cookie Superadmin -> rechazada (403)", async () => {
    const token = await createSession("cliente-fake-id-2", "cliente")
    sesionesParaLimpiar.push(token)
    const req = reqConCookies("http://localhost/api/superadmin/config", { [SUPERADMIN_SESSION_COOKIE_NAME]: token })
    const res = await configGetRoute(req)
    expect(res.status).toBe(403)
  })

  test("sesión operativa bajo la cookie Superadmin -> rechazada (403)", async () => {
    const cuenta = await db.cuentaOperativa.create({
      data: { nombre: "Test 24A", email: `test24a-${Date.now()}@example.com`, activo: true, eliminado: false },
    })
    try {
      const token = await createOperationalSession(cuenta.id)
      sesionesParaLimpiar.push(token)
      const req = reqConCookies("http://localhost/api/superadmin/config", { [SUPERADMIN_SESSION_COOKIE_NAME]: token })
      const res = await configGetRoute(req)
      expect(res.status).toBe(403)
    } finally {
      await db.cuentaOperativa.delete({ where: { id: cuenta.id } })
    }
  })

  test("clave compartida legacy -> /api/auth/login ya no reconoce tipo 'superadmin'", async () => {
    const req = new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tipo: "superadmin", password: "admin123" }),
    })
    const res = await loginRoute(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("Tipo de login inválido")
  })

  test("header legacy (Authorization) sin cookie válida -> igual rechazado", async () => {
    const req = new NextRequest("http://localhost/api/superadmin/config", {
      headers: { Authorization: "Bearer admin123" },
    })
    const res = await configGetRoute(req)
    expect(res.status).toBe(403)
  })

  test("query param legacy (?password=) sin cookie válida -> igual rechazado", async () => {
    const req = new NextRequest("http://localhost/api/superadmin/config?password=admin123")
    const res = await configGetRoute(req)
    expect(res.status).toBe(403)
  })

  test("PUT config también protegido por el mismo helper", async () => {
    const req = reqConCookies(
      "http://localhost/api/superadmin/config",
      {},
      { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ promocionadosActivos: true }) }
    )
    const res = await configPutRoute(req)
    expect(res.status).toBe(403)
  })

  test("dashboard/route.ts: patrón alternativo — sin sesión responde 401 directo (ambos patrones conviven en el código preexistente)", async () => {
    const req = reqConCookies("http://localhost/api/superadmin/dashboard", {})
    const res = await dashboardGetRoute(req)
    expect(res.status).toBe(401)
  })

  test("GET /api/superadmin/auth/me: 401 sin sesión, 200 con sesión válida (nunca expone googleSub)", async () => {
    const noSessionReq = reqConCookies("http://localhost/api/superadmin/auth/me", {})
    const noSessionRes = await meRoute(noSessionReq)
    expect(noSessionRes.status).toBe(401)

    const admin = await db.superAdmin.create({ data: { googleSub: "sub-me-route", email: "me@example.com", activo: true } })
    const token = await createSuperadminSession(admin.id)
    sesionesParaLimpiar.push(token)
    const req = reqConCookies("http://localhost/api/superadmin/auth/me", { [SUPERADMIN_SESSION_COOKIE_NAME]: token })
    const res = await meRoute(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.admin.id).toBe(admin.id)
    expect(JSON.stringify(body)).not.toContain("sub-me-route") // nunca expone el googleSub crudo
  })
})

// ---------------------------------------------------------------------------
// F. Limpieza final de fixtures
// ---------------------------------------------------------------------------

describe("24-A — Limpieza de fixtures", () => {
  test("no quedan filas de SuperAdmin de prueba tras la suite", async () => {
    await limpiarSuperAdmins()
    expect(await db.superAdmin.count()).toBe(0)
  })

  test("no quedan sesiones de prueba tras la suite", async () => {
    const tokensCreados = [...sesionesParaLimpiar]
    await limpiarSesiones()
    if (tokensCreados.length > 0) {
      const hashes = tokensCreados.map(hashSessionToken)
      const restantes = await db.sesion.count({ where: { token: { in: [...hashes, ...tokensCreados] } } })
      expect(restantes).toBe(0)
    }
    expect(sesionesParaLimpiar.length).toBe(0)
  })
})
