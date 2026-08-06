// ============================================
// DeliGO — OAuth/OIDC Google para Superadmin (24-A)
// ============================================
// Flujo aislado y explícito, separado de src/app/api/auth/google/** (cliente/
// repartidor) y src/app/api/operativo/auth/google/** (cuenta operativa). No
// reutiliza sus cookies, su lógica de creación de usuario, ni su sesión —
// solo el patrón de resolución de URL base (evitar Host/X-Forwarded-Host) ya
// usado en ambos flujos existentes.
//
// A diferencia de los flujos existentes, este SÍ valida el id_token
// completo (firma criptográfica, issuer, audience, expiración, nonce,
// email_verified) — apropiado para la cuenta de mayor privilegio de la
// plataforma.
//
// 24-A-CORRECCIÓN-1: la validación usa `google-auth-library` oficial
// (`OAuth2Client.verifyIdToken`), NO el endpoint `tokeninfo` (Google lo
// documenta como herramienta de depuración, no apta para producción) ni el
// endpoint `userinfo` (nunca verifica la firma del token, solo confía en la
// respuesta HTTP). La librería descarga y cachea las claves públicas RSA de
// Google (respeta `Cache-Control` de la respuesta), verifica la firma
// RS256/ES256 contra la clave correcta por `kid`, y valida issuer/audience/
// expiración internamente — igual revalidamos todo explícitamente acá
// después (defensa en profundidad, nunca confiar en "no lanzó" como única
// señal), más `nonce` (que la librería no conoce) y `sub`/tipos de claims.
//
// Incluye PKCE (S256) además de `state` — la infraestructura existente no lo
// soporta, pero es puro cómputo local (sin dependencias nuevas) y agrega
// profundidad de defensa aunque el cliente ya sea confidencial (tiene
// client_secret).

import { randomBytes, createHash } from "crypto"
import { OAuth2Client, type TokenPayload } from "google-auth-library"

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ""
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ""

// Mismo patrón que src/app/api/auth/google/route.ts y
// src/app/api/operativo/auth/google/route.ts: nunca usar req.headers/
// req.url para construir el redirect_uri (Railway puede exponer valores
// internos como 0.0.0.0). Redirect URI propio (no GOOGLE_REDIRECT_URI) para
// que este flujo nunca pueda colisionar con el de cliente/repartidor.
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.APP_URL ||
  process.env.NEXTAUTH_URL ||
  "http://localhost:3000"

export const SUPERADMIN_GOOGLE_REDIRECT_PATH = "/api/superadmin/auth/google/callback"

export function isSuperadminGoogleConfigured(): boolean {
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET)
}

export function buildSuperadminGoogleRedirectUri(): string {
  return `${APP_URL}${SUPERADMIN_GOOGLE_REDIRECT_PATH}`
}

// ---------------------------------------------------------------------------
// state / nonce / PKCE
// ---------------------------------------------------------------------------

function randomUrlSafeToken(bytes: number): string {
  return randomBytes(bytes).toString("base64url")
}

export function generateOAuthState(): string {
  return randomUrlSafeToken(32)
}

export function generateOAuthNonce(): string {
  return randomUrlSafeToken(32)
}

export interface PkcePair {
  codeVerifier: string
  codeChallenge: string
}

export function generatePkcePair(): PkcePair {
  const codeVerifier = randomUrlSafeToken(32)
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url")
  return { codeVerifier, codeChallenge }
}

// ---------------------------------------------------------------------------
// Authorization URL
// ---------------------------------------------------------------------------

export function buildSuperadminGoogleAuthUrl(params: {
  state: string
  nonce: string
  codeChallenge: string
}): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth")
  url.searchParams.set("client_id", GOOGLE_CLIENT_ID)
  url.searchParams.set("redirect_uri", buildSuperadminGoogleRedirectUri())
  url.searchParams.set("response_type", "code")
  url.searchParams.set("scope", "openid email")
  url.searchParams.set("state", params.state)
  url.searchParams.set("nonce", params.nonce)
  url.searchParams.set("code_challenge", params.codeChallenge)
  url.searchParams.set("code_challenge_method", "S256")
  // Sin access_type=offline / prompt=consent: no se necesita refresh_token
  // (no hay uso posterior a la API de Google), y sin forzar el selector de
  // cuenta se evita filtrar por UI qué cuenta está autorizada.
  return url.toString()
}

// ---------------------------------------------------------------------------
// Token exchange + validación del id_token
// ---------------------------------------------------------------------------

interface GoogleTokenResponse {
  id_token?: string
  error?: string
  error_description?: string
}

export type TokenExchangeResult =
  | { ok: true; idToken: string }
  | { ok: false; reason: "network_error" | "no_id_token" | "google_error" }

export async function exchangeSuperadminGoogleCode(params: {
  code: string
  codeVerifier: string
}): Promise<TokenExchangeResult> {
  let response: Response
  try {
    response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: params.code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: buildSuperadminGoogleRedirectUri(),
        grant_type: "authorization_code",
        code_verifier: params.codeVerifier,
      }),
    })
  } catch {
    return { ok: false, reason: "network_error" }
  }

  if (!response.ok) {
    return { ok: false, reason: "google_error" }
  }

  let body: GoogleTokenResponse
  try {
    body = (await response.json()) as GoogleTokenResponse
  } catch {
    return { ok: false, reason: "network_error" }
  }

  if (!body.id_token) {
    return { ok: false, reason: "no_id_token" }
  }

  return { ok: true, idToken: body.id_token }
}

const GOOGLE_ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"])

export interface VerifiedSuperadminGoogleClaims {
  sub: string
  email: string | null
  emailVerified: boolean
}

export type IdTokenVerificationResult =
  | { ok: true; claims: VerifiedSuperadminGoogleClaims }
  | { ok: false; reason: "network_error" | "invalid_token" | "issuer" | "audience" | "expired" | "nonce" | "sub_ausente" }

/**
 * Categorías internas de por qué falló la verificación criptográfica —
 * SOLO para logs sanitizados/auditoría/tests. `google-auth-library` no
 * expone códigos de error tipados (lanza `Error` con mensajes de texto), así
 * que esta clasificación es best-effort sobre el mensaje; nunca se expone al
 * navegador de ninguna forma — el rechazo visible es siempre el mismo
 * genérico sin importar la categoría real.
 */
type VerificationErrorCategory =
  | "signature"
  | "issuer"
  | "audience"
  | "expired"
  | "malformed"
  | "key_fetch_failed"
  | "unknown"

function classifyVerificationError(error: unknown): VerificationErrorCategory {
  const message = error instanceof Error ? error.message : String(error)
  if (/Failed to retrieve verification certificates/i.test(message)) return "key_fetch_failed"
  if (/Invalid token signature|No pem found/i.test(message)) return "signature"
  if (/Invalid issuer/i.test(message)) return "issuer"
  if (/Wrong recipient|audience/i.test(message)) return "audience"
  if (/too late|too early|Expiration time too far|No expiration time|No issue time/i.test(message)) return "expired"
  if (/Wrong number of segments|Can't parse token/i.test(message)) return "malformed"
  return "unknown"
}

/**
 * Frontera del verificador Google — únicamente esto es sustituible en tests
 * (sección 5 del prompt 24-A-CORRECCIÓN-1). La decisión de identidad
 * (src/lib/superadmin-identity.ts), el bootstrap, la sesión y la
 * autorización propia nunca se mockean.
 */
export interface GoogleIdTokenVerifier {
  verifyIdToken(options: { idToken: string; audience: string }): Promise<{ getPayload(): TokenPayload | undefined }>
}

let defaultVerifier: GoogleIdTokenVerifier | null = null
let defaultVerifierOverridden = false

function getDefaultVerifier(): GoogleIdTokenVerifier {
  // Instancia única reutilizada entre requests: `getFederatedSignonCertsAsync`
  // cachea las claves públicas de Google en memoria respetando el
  // `Cache-Control` de la respuesta — reutilizar el cliente evita refetch en
  // cada login mientras el cache siga vigente.
  if (!defaultVerifier) {
    defaultVerifier = new OAuth2Client(GOOGLE_CLIENT_ID)
  }
  return defaultVerifier
}

/**
 * SOLO PARA TESTS: sustituye el verificador por defecto que usan las rutas
 * reales (que nunca pasan un `verifier` explícito a
 * `verifySuperadminGoogleIdToken`). Permite que los tests end-to-end de las
 * rutas OAuth (src/lib/superadmin-auth.test.ts) ejerciten el código de
 * producción real con un `OAuth2Client` real cuya única diferencia es de
 * dónde saca las claves públicas — nunca mockea `resolverIdentidadSuperadminGoogle`,
 * el bootstrap, la sesión, ni la autorización propia. Llamar con `null`
 * restaura el default de producción.
 */
export function __setDefaultGoogleVerifierForTests(verifier: GoogleIdTokenVerifier | null): void {
  defaultVerifier = verifier
  defaultVerifierOverridden = verifier !== null
}

/** SOLO PARA TESTS: indica si el verificador por defecto está sustituido. */
export function __isDefaultGoogleVerifierOverriddenForTests(): boolean {
  return defaultVerifierOverridden
}

/**
 * Valida el id_token completo: firma criptográfica RS256/ES256 contra la
 * clave pública de Google correspondiente al `kid` del header (JWKS con
 * caché y rotación respetados por la librería), issuer, audience y
 * expiración — vía `google-auth-library`, nunca `tokeninfo` (herramienta de
 * depuración, no apta para producción según la propia documentación de
 * Google) ni `userinfo` (no verifica firma). Después del veredicto de la
 * librería, revalidamos explícitamente issuer/audience/expiración (defensa
 * en profundidad) y agregamos lo que la librería no conoce: `nonce`
 * (protección contra replay del id_token) y presencia/tipo de `sub`.
 *
 * Nunca lanza: cualquier fallo (firma inválida, issuer/audience incorrecta,
 * expirado, JWT malformado, o un fallo de red al obtener/actualizar las
 * claves públicas de Google) se captura y se traduce a un rechazo
 * controlado y genérico — la categoría real solo se usa para un log
 * sanitizado interno, nunca se expone al llamador HTTP.
 */
export async function verifySuperadminGoogleIdToken(
  params: { idToken: string; expectedNonce: string },
  verifier: GoogleIdTokenVerifier = getDefaultVerifier()
): Promise<IdTokenVerificationResult> {
  let payload: TokenPayload | undefined
  try {
    const ticket = await verifier.verifyIdToken({ idToken: params.idToken, audience: GOOGLE_CLIENT_ID })
    payload = ticket.getPayload()
  } catch (error) {
    const category = classifyVerificationError(error)
    console.error("[SuperadminGoogleVerify] id_token rechazado (categoría interna):", category)
    // La librería ya valida issuer/audience/expiración internamente y
    // lanza ANTES de devolver un payload — cuando eso pasa, la categoría
    // clasificada del mensaje de error es la única fuente posible para un
    // `reason` específico (las comprobaciones explícitas de más abajo nunca
    // se alcanzan en ese caso, porque no hay payload). "signature",
    // "malformed" y "unknown" se mantienen genéricos a propósito.
    switch (category) {
      case "key_fetch_failed":
        return { ok: false, reason: "network_error" }
      case "issuer":
        return { ok: false, reason: "issuer" }
      case "audience":
        return { ok: false, reason: "audience" }
      case "expired":
        return { ok: false, reason: "expired" }
      default:
        return { ok: false, reason: "invalid_token" }
    }
  }

  if (!payload) {
    return { ok: false, reason: "invalid_token" }
  }

  // Revalidación explícita — nunca confiar únicamente en que la librería
  // "no lanzó".
  if (!payload.iss || !GOOGLE_ISSUERS.has(payload.iss)) {
    return { ok: false, reason: "issuer" }
  }
  if (payload.aud !== GOOGLE_CLIENT_ID) {
    return { ok: false, reason: "audience" }
  }
  if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) {
    return { ok: false, reason: "expired" }
  }
  if (typeof payload.nonce !== "string" || payload.nonce.length === 0 || payload.nonce !== params.expectedNonce) {
    return { ok: false, reason: "nonce" }
  }
  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    return { ok: false, reason: "sub_ausente" }
  }

  return {
    ok: true,
    claims: {
      sub: payload.sub,
      email: typeof payload.email === "string" ? payload.email : null,
      emailVerified: payload.email_verified === true,
    },
  }
}
