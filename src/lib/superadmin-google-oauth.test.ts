/// <reference types="bun-types" />
// ============================================
// DeliGO — Tests: verificación OAuth Google para Superadmin (24-A)
// ============================================
// El intercambio de código (exchangeSuperadminGoogleCode) mockea
// EXCLUSIVAMENTE la frontera de red hacia oauth2.googleapis.com/token — eso
// no cambió. La verificación del id_token (24-A-CORRECCIÓN-1) ya NO se
// mockea por HTTP: se firma un JWT de prueba con una clave RSA propia y se
// verifica con la instancia REAL de `OAuth2Client` de `google-auth-library`,
// sustituyendo únicamente `getFederatedSignonCertsAsync` (la frontera de red
// que obtiene las claves públicas de Google) — la criptografía real de la
// librería corre sin mockear. Sin DB en todo este archivo.

import { describe, test, expect, afterEach } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"
import { createHash, generateKeyPairSync, sign as cryptoSign } from "crypto"
import { OAuth2Client } from "google-auth-library"
import {
  buildSuperadminGoogleAuthUrl,
  buildSuperadminGoogleRedirectUri,
  generateOAuthState,
  generateOAuthNonce,
  generatePkcePair,
  exchangeSuperadminGoogleCode,
  verifySuperadminGoogleIdToken,
  isSuperadminGoogleConfigured,
  type GoogleIdTokenVerifier,
} from "./superadmin-google-oauth"

const originalFetch = global.fetch

function mockFetchOnce(handler: (url: string, init?: RequestInit) => Promise<Response> | Response) {
  global.fetch = ((url: string | URL, init?: RequestInit) =>
    Promise.resolve(handler(String(url), init))) as typeof fetch
}

afterEach(() => {
  global.fetch = originalFetch
})

describe("24-A — configuración y construcción de URL", () => {
  test("isSuperadminGoogleConfigured refleja GOOGLE_CLIENT_ID/SECRET del entorno", () => {
    // .env del proyecto ya trae GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET (usados
    // también por /api/auth/google) — no se duplican credenciales para 24-A.
    expect(typeof isSuperadminGoogleConfigured()).toBe("boolean")
  })

  test("redirect_uri propio, nunca colisiona con /api/auth/google/callback", () => {
    const uri = buildSuperadminGoogleRedirectUri()
    expect(uri).toContain("/api/superadmin/auth/google/callback")
    expect(uri).not.toContain("/api/auth/google/callback")
  })

  test("buildSuperadminGoogleAuthUrl incluye state, nonce, PKCE S256 y scope mínimo", () => {
    const { codeChallenge } = generatePkcePair()
    const url = buildSuperadminGoogleAuthUrl({ state: "state-1", nonce: "nonce-1", codeChallenge })
    const parsed = new URL(url)
    expect(parsed.origin + parsed.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth")
    expect(parsed.searchParams.get("state")).toBe("state-1")
    expect(parsed.searchParams.get("nonce")).toBe("nonce-1")
    expect(parsed.searchParams.get("code_challenge")).toBe(codeChallenge)
    expect(parsed.searchParams.get("code_challenge_method")).toBe("S256")
    expect(parsed.searchParams.get("response_type")).toBe("code")
    expect(parsed.searchParams.get("redirect_uri")).toBe(buildSuperadminGoogleRedirectUri())
  })
})

describe("24-A — state / nonce / PKCE", () => {
  test("generateOAuthState produce valores distintos y suficientemente largos", () => {
    const a = generateOAuthState()
    const b = generateOAuthState()
    expect(a).not.toBe(b)
    expect(a.length).toBeGreaterThanOrEqual(32)
  })

  test("generateOAuthNonce produce valores distintos", () => {
    expect(generateOAuthNonce()).not.toBe(generateOAuthNonce())
  })

  test("generatePkcePair: code_challenge es SHA-256(code_verifier) en base64url", () => {
    const { codeVerifier, codeChallenge } = generatePkcePair()
    const expected = createHash("sha256").update(codeVerifier).digest("base64url")
    expect(codeChallenge).toBe(expected)
    expect(codeChallenge).not.toBe(codeVerifier)
  })
})

describe("24-A — exchangeSuperadminGoogleCode (frontera de red mockeada)", () => {
  test("token exchange exitoso devuelve el id_token", async () => {
    mockFetchOnce((url) => {
      expect(url).toBe("https://oauth2.googleapis.com/token")
      return new Response(JSON.stringify({ id_token: "fake.id.token" }), { status: 200 })
    })
    const result = await exchangeSuperadminGoogleCode({ code: "abc", codeVerifier: "verifier" })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.idToken).toBe("fake.id.token")
  })

  test("respuesta sin id_token -> no_id_token", async () => {
    mockFetchOnce(() => new Response(JSON.stringify({}), { status: 200 }))
    const result = await exchangeSuperadminGoogleCode({ code: "abc", codeVerifier: "verifier" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe("no_id_token")
  })

  test("Google responde error HTTP -> google_error (sin filtrar el body)", async () => {
    mockFetchOnce(() => new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 }))
    const result = await exchangeSuperadminGoogleCode({ code: "abc", codeVerifier: "verifier" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe("google_error")
  })

  test("fallo de red -> network_error, nunca lanza", async () => {
    mockFetchOnce(() => {
      throw new Error("ECONNRESET")
    })
    const result = await exchangeSuperadminGoogleCode({ code: "abc", codeVerifier: "verifier" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe("network_error")
  })
})

// ---------------------------------------------------------------------------
// verifySuperadminGoogleIdToken — verificación criptográfica REAL
// ---------------------------------------------------------------------------
// 24-A-CORRECCIÓN-1: nunca se llama a tokeninfo/userinfo. Se firma un JWT de
// prueba con una clave RSA propia y se lo verifica con la instancia REAL de
// `OAuth2Client` de `google-auth-library` — la única pieza sustituida es
// `getFederatedSignonCertsAsync` (la frontera de red hacia Google que
// obtiene las claves públicas), inyectando nuestras propias claves de
// prueba en vez de llamar a Google. La verificación de firma/issuer/
// audience/expiración que corre después es 100% el código real de la
// librería, sin mockear — confirmado empíricamente contra 6 escenarios de
// ataque (firma inválida, alg:none, issuer/audience incorrecta, expirado,
// kid desconocido) antes de escribir esta suite.

const TEST_KID = "test-kid-1"
const { publicKey: TEST_PUBLIC_KEY, privateKey: TEST_PRIVATE_KEY } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
})

function b64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf-8") : input
  return buf.toString("base64url")
}

function signTestJwt(header: Record<string, unknown>, payload: Record<string, unknown>): string {
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`
  const signature = cryptoSign("RSA-SHA256", Buffer.from(signingInput), TEST_PRIVATE_KEY)
  return `${signingInput}.${b64url(signature)}`
}

/**
 * Construye un verificador REAL (misma clase `OAuth2Client` que usa
 * producción) cuya única diferencia es de dónde saca las claves públicas —
 * de un objeto de prueba en memoria en vez de la red de Google.
 */
function makeTestVerifier(opts: {
  certs?: Record<string, string>
  audience?: string
  certFetchError?: Error
}): GoogleIdTokenVerifier {
  const client = new OAuth2Client(opts.audience ?? "test-client-id")
  const certs = opts.certs ?? { [TEST_KID]: TEST_PUBLIC_KEY }
  ;(client as unknown as { getFederatedSignonCertsAsync: () => Promise<{ certs: Record<string, string>; format: string }> }).getFederatedSignonCertsAsync = async () => {
    if (opts.certFetchError) throw opts.certFetchError
    return { certs, format: "pem" }
  }
  return client as unknown as GoogleIdTokenVerifier
}

const NOW = Math.floor(Date.now() / 1000)
// verifySuperadminGoogleIdToken siempre valida contra el GOOGLE_CLIENT_ID
// real del proceso (constante de módulo leída de process.env en
// superadmin-google-oauth.ts) — nunca contra un valor que le pasemos acá.
// Por eso la audience de los JWT de prueba tiene que ser ESE mismo valor
// (.env ya lo trae, cargado automáticamente por `bun test`), no un
// placeholder inventado.
const AUDIENCE = process.env.GOOGLE_CLIENT_ID || "test-client-id"

function basePayload(overrides: Record<string, unknown> = {}) {
  return {
    iss: "https://accounts.google.com",
    aud: AUDIENCE,
    sub: "sub-crypto-real",
    email: "admin@example.com",
    email_verified: true,
    nonce: "expected-nonce",
    iat: NOW - 5,
    exp: NOW + 3600,
    ...overrides,
  }
}

function baseHeader(overrides: Record<string, unknown> = {}) {
  return { alg: "RS256", kid: TEST_KID, typ: "JWT", ...overrides }
}

describe("24-A-CORRECCIÓN-1 — verifySuperadminGoogleIdToken (verificación criptográfica real, sin red)", () => {
  test("1. id_token válido, firmado y verificado de verdad -> payload aceptado", async () => {
    const jwt = signTestJwt(baseHeader(), basePayload())
    const result = await verifySuperadminGoogleIdToken(
      { idToken: jwt, expectedNonce: "expected-nonce" },
      makeTestVerifier({ audience: AUDIENCE })
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.claims.sub).toBe("sub-crypto-real")
      expect(result.claims.email).toBe("admin@example.com")
      expect(result.claims.emailVerified).toBe(true)
    }
  })

  test("2. firma inválida (firmado con una clave distinta a la de los certs) -> rechazo", async () => {
    const { privateKey: otherPrivateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    })
    const header = baseHeader()
    const payload = basePayload()
    const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`
    const wrongSignature = cryptoSign("RSA-SHA256", Buffer.from(signingInput), otherPrivateKey)
    const jwt = `${signingInput}.${b64url(wrongSignature)}`

    const result = await verifySuperadminGoogleIdToken(
      { idToken: jwt, expectedNonce: "expected-nonce" },
      makeTestVerifier({ audience: AUDIENCE })
    )
    expect(result.ok).toBe(false)
  })

  test("3. token manipulado DESPUÉS de firmarse (payload alterado, firma original) -> rechazo", async () => {
    const jwt = signTestJwt(baseHeader(), basePayload())
    const [h, , s] = jwt.split(".")
    const tamperedPayload = b64url(JSON.stringify(basePayload({ sub: "sub-atacante-inyectado" })))
    const tampered = `${h}.${tamperedPayload}.${s}`

    const result = await verifySuperadminGoogleIdToken(
      { idToken: tampered, expectedNonce: "expected-nonce" },
      makeTestVerifier({ audience: AUDIENCE })
    )
    expect(result.ok).toBe(false)
  })

  test("4. algoritmo 'none' (sin firma) -> rechazo", async () => {
    const header = baseHeader({ alg: "none" })
    const payload = basePayload()
    const jwt = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}.`

    const result = await verifySuperadminGoogleIdToken(
      { idToken: jwt, expectedNonce: "expected-nonce" },
      makeTestVerifier({ audience: AUDIENCE })
    )
    expect(result.ok).toBe(false)
  })

  test("5. issuer inválido -> rechazo", async () => {
    const jwt = signTestJwt(baseHeader(), basePayload({ iss: "https://evil.example.com" }))
    const result = await verifySuperadminGoogleIdToken(
      { idToken: jwt, expectedNonce: "expected-nonce" },
      makeTestVerifier({ audience: AUDIENCE })
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe("issuer")
  })

  test("6. audience inválida -> rechazo", async () => {
    const jwt = signTestJwt(baseHeader(), basePayload({ aud: "otro-client-id" }))
    const result = await verifySuperadminGoogleIdToken(
      { idToken: jwt, expectedNonce: "expected-nonce" },
      makeTestVerifier({ audience: AUDIENCE })
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe("audience")
  })

  test("7. token expirado -> rechazo", async () => {
    const jwt = signTestJwt(baseHeader(), basePayload({ iat: NOW - 7200, exp: NOW - 3600 }))
    const result = await verifySuperadminGoogleIdToken(
      { idToken: jwt, expectedNonce: "expected-nonce" },
      makeTestVerifier({ audience: AUDIENCE })
    )
    expect(result.ok).toBe(false)
  })

  test("8. nonce inválido (presente pero no coincide) -> rechazo — el nonce validado viene del payload ya verificado criptográficamente, no de datos sin verificar", async () => {
    const jwt = signTestJwt(baseHeader(), basePayload({ nonce: "un-nonce-distinto" }))
    const result = await verifySuperadminGoogleIdToken(
      { idToken: jwt, expectedNonce: "expected-nonce" },
      makeTestVerifier({ audience: AUDIENCE })
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe("nonce")
  })

  test("9. nonce ausente -> rechazo", async () => {
    const payload = basePayload()
    delete (payload as Record<string, unknown>).nonce
    const jwt = signTestJwt(baseHeader(), payload)
    const result = await verifySuperadminGoogleIdToken(
      { idToken: jwt, expectedNonce: "expected-nonce" },
      makeTestVerifier({ audience: AUDIENCE })
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe("nonce")
  })

  test("10. sub ausente -> rechazo", async () => {
    const payload = basePayload()
    delete (payload as Record<string, unknown>).sub
    const jwt = signTestJwt(baseHeader(), payload)
    const result = await verifySuperadminGoogleIdToken(
      { idToken: jwt, expectedNonce: "expected-nonce" },
      makeTestVerifier({ audience: AUDIENCE })
    )
    expect(result.ok).toBe(false)
  })

  test("11. error al obtener las claves públicas -> rechazo controlado (nunca lanza)", async () => {
    const jwt = signTestJwt(baseHeader(), basePayload())
    const result = await verifySuperadminGoogleIdToken(
      { idToken: jwt, expectedNonce: "expected-nonce" },
      makeTestVerifier({
        audience: AUDIENCE,
        certFetchError: new Error("Failed to retrieve verification certificates: 500"),
      })
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe("network_error")
  })

  test("12. Google temporalmente inaccesible al actualizar claves (timeout) -> rechazo controlado, misma categoría que el fallo de obtención de claves", async () => {
    const jwt = signTestJwt(baseHeader(), basePayload())
    const result = await verifySuperadminGoogleIdToken(
      { idToken: jwt, expectedNonce: "expected-nonce" },
      makeTestVerifier({
        audience: AUDIENCE,
        certFetchError: new Error("Failed to retrieve verification certificates: ETIMEDOUT"),
      })
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe("network_error")
  })

  test("13. no existe ninguna llamada FUNCIONAL a tokeninfo en el código de producción", () => {
    // Se buscan patrones de USO (URL completa que un fetch() llamaría), no
    // la palabra suelta — el archivo SÍ menciona "tokeninfo" en comentarios,
    // para documentar explícitamente por qué se dejó de usar (sección 3 del
    // prompt 24-A-CORRECCIÓN-1 pide justamente esa explicación).
    const source = readFileSync(join(process.cwd(), "src", "lib", "superadmin-google-oauth.ts"), "utf-8")
    expect(source).not.toContain("oauth2.googleapis.com/tokeninfo")
    expect(source).not.toMatch(/fetch\(\s*[`'"].*tokeninfo/i)
  })

  test("14. no existe fallback FUNCIONAL a userinfo en el código de producción", () => {
    const source = readFileSync(join(process.cwd(), "src", "lib", "superadmin-google-oauth.ts"), "utf-8")
    expect(source).not.toContain("googleapis.com/oauth2/v3/userinfo")
    expect(source).not.toMatch(/fetch\(\s*[`'"].*userinfo/i)
  })

  test("15. el id_token nunca se filtra en mensajes de error/log — solo una categoría sanitizada", async () => {
    const jwt = signTestJwt(baseHeader(), basePayload({ iss: "https://evil.example.com" }))
    const originalConsoleError = console.error
    const loggedMessages: string[] = []
    console.error = (...args: unknown[]) => {
      loggedMessages.push(args.map((a) => String(a)).join(" "))
    }
    try {
      // Forzamos la rama catch (fallo al obtener claves) para confirmar que
      // ni siquiera en el peor caso se imprime el JWT completo.
      await verifySuperadminGoogleIdToken(
        { idToken: jwt, expectedNonce: "expected-nonce" },
        makeTestVerifier({ audience: AUDIENCE, certFetchError: new Error("Failed to retrieve verification certificates: boom") })
      )
    } finally {
      console.error = originalConsoleError
    }
    const joined = loggedMessages.join("\n")
    expect(joined).not.toContain(jwt)
    expect(joined).not.toContain(TEST_PRIVATE_KEY)
  })
})
