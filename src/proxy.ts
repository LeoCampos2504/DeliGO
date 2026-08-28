import { NextResponse, NextRequest } from "next/server"
import {
  getAllowedCorsOrigin,
  hasDisallowedCorsOrigin,
  isMutatingMethod,
  validateMutationOrigin,
} from "@/lib/request-security"

// ============================================
// DeliGO - Global Middleware
// ============================================
// Security headers, API route protection (soft auth),
// CORS, rate-limit headers, and request logging.
// IMPORTANT: No database calls — middleware runs on Edge runtime.

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SESSION_COOKIE = "deligo_session"

// 24-A: cookie de sesión Superadmin, aislada de SESSION_COOKIE — nunca
// mezclada con cliente/negocio/repartidor. Token opaco de 256 bits en hex
// (ver src/lib/superadmin-auth.ts), no un UUID — de ahí el regex separado.
const SUPERADMIN_SESSION_COOKIE = "deligo_superadmin_session"

// UUID v4 regex for lightweight session token validation
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// 32 random bytes, hex-encoded (64 lowercase hex chars) — see
// generateSuperadminSessionToken in src/lib/superadmin-auth.ts.
const SUPERADMIN_TOKEN_REGEX = /^[0-9a-f]{64}$/i

// ---------------------------------------------------------------------------
// P2-T18-BLOCKER-AUTH2-R2 (Phase 1) — Actor-family session cookie resolution
// ---------------------------------------------------------------------------
// SESSION_COOKIE_SELECTION_AND_AUTH_CONTEXT_ONLY — diseño congelado en
// codex-reports/archive/P2-T18-BLOCKER-AUTH2-R1.md. Cliente/Negocio/
// Repartidor (los tres tipos con login propio que comparten el modelo
// Sesion) pueden tener, cada uno, su propia cookie con nombre de familia,
// coexistiendo en el mismo navegador. Este bloque NUNCA hace lookup a DB
// (Edge runtime, sin dependencias de @/lib/auth para no arrastrar Prisma) —
// sólo decide qué cookie real reenviar bajo el nombre legacy SESSION_COOKIE
// para que los route handlers existentes (que siguen leyendo únicamente
// SESSION_COOKIE) resuelvan la identidad real contra Sesion exactamente
// como siempre. El selector (?actorFamily=) NUNCA es autoridad — un mismatch
// de userType real (resuelto server-side, downstream, sin cambios) nunca
// autoriza, sólo produce el mismo 401/403 que ya producía antes de esta
// tarea. Debe permanecer sincronizado manualmente con
// FAMILY_SESSION_COOKIE_NAMES de src/lib/auth.ts (nunca importado acá).

type SessionFamily = "cliente" | "negocio" | "repartidor"

const FAMILY_SESSION_COOKIE_NAMES: Record<SessionFamily, string> = {
  cliente: "deligo_session_cliente",
  negocio: "deligo_session_negocio",
  repartidor: "deligo_session_repartidor",
}

const SELECTOR_QUERY_PARAM = "actorFamily"

// Rutas compartidas por múltiples familias donde Fase 2 empezará a enviar
// el selector explícito — nunca puede anular una familia derivada de path
// (ver pathFamily más abajo; esas rutas ni siquiera llegan a este chequeo).
const SELECTOR_ENDPOINT_PREFIXES = [
  "/api/auth/me",
  "/api/auth/logout",
  "/api/realtime/token",
  "/api/realtime/authorize",
]

const RESOLVED_ACTOR_FAMILY_HEADER = "x-resolved-actor-family"

function isSessionFamily(value: string | null): value is SessionFamily {
  return value === "cliente" || value === "negocio" || value === "repartidor"
}

/** Familia implícita por prefijo de path — nunca anulable por selector. */
function pathFamily(pathname: string): SessionFamily | null {
  for (const { prefix, userType } of ROLE_PROTECTED_ROUTES) {
    if (!isSessionFamily(userType)) continue // excluye superadmin — cookie propia, ver 24-A
    if (pathname === prefix || pathname.startsWith(prefix + "/")) return userType
  }
  return null
}

interface ResolvedActorSession {
  family: SessionFamily | null
  token: string | null
}

/**
 * Resuelve qué cookie real corresponde a este request.
 * Prioridad: 1) familia de path (nunca anulable); 2) selector explícito
 * SOLO en SELECTOR_ENDPOINT_PREFIXES, validado contra un allowlist fijo —
 * un selector desconocido/malformado se ignora (fail closed, nunca
 * ambiguo); 3) sin familia resuelta: si existe EXACTAMENTE una cookie
 * candidata (de familia o legacy) entre TODAS las conocidas, se usa sin
 * ambigüedad — preserva el comportamiento actual de un único actor. Con
 * más de una candidata y ninguna familia resuelta, no se reenvía nada
 * (fail closed) — nunca se elige arbitrariamente entre dos actores.
 */
function resolveActorSession(request: NextRequest, pathname: string): ResolvedActorSession {
  let family = pathFamily(pathname)

  if (!family && matchesPrefix(pathname, SELECTOR_ENDPOINT_PREFIXES)) {
    const selector = request.nextUrl.searchParams.get(SELECTOR_QUERY_PARAM)
    if (isSessionFamily(selector)) family = selector
  }

  if (family) {
    const familyToken = getCookieToken(request, FAMILY_SESSION_COOKIE_NAMES[family], UUID_REGEX)
    if (familyToken) return { family, token: familyToken }
    // Legacy fallback: sólo cuando la cookie de familia está ausente. El
    // userType real se re-valida server-side, downstream, sin cambios — un
    // mismatch nunca autoriza, sólo produce el mismo 401/403 de siempre.
    return { family, token: getSessionToken(request) }
  }

  const candidates: string[] = []
  for (const f of Object.keys(FAMILY_SESSION_COOKIE_NAMES) as SessionFamily[]) {
    const t = getCookieToken(request, FAMILY_SESSION_COOKIE_NAMES[f], UUID_REGEX)
    if (t) candidates.push(t)
  }
  const legacyToken = getSessionToken(request)
  if (legacyToken) candidates.push(legacyToken)

  if (candidates.length === 1) return { family: null, token: candidates[0] }
  return { family: null, token: null }
}

/**
 * Reescribe el header Cookie del request SALIENTE (nunca la respuesta al
 * navegador) para que SESSION_COOKIE porte el token resuelto — los route
 * handlers downstream, sin modificar, lo leen exactamente como siempre.
 */
function rewriteResolvedSessionCookieHeaders(request: NextRequest, token: string): Headers {
  const headers = new Headers(request.headers)
  const existing = headers.get("cookie") ?? ""
  const kept = existing
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !part.startsWith(`${SESSION_COOKIE}=`))
  kept.push(`${SESSION_COOKIE}=${token}`)
  headers.set("cookie", kept.join("; "))
  return headers
}

// ---------------------------------------------------------------------------
// Route classification helpers
// ---------------------------------------------------------------------------

/** Routes that are public (no auth required) even under /api/ */
const PUBLIC_API_PREFIXES = [
  "/api/auth",
  "/api/negocios", // public catalog
  "/api/pedidos",  // auth checked in handler (allows guest checkout)
  "/api/pdf-proxy", // proxies Cloudinary PDFs (no auth needed)
  "/api/upload",    // file upload (auth checked in handler)
  "/api/cloudinary", // Cloudinary config (public)
  "/api/chat/cleanup", // cron cleanup (auth via header secret)
  // 24-A: inicio/callback/logout/me de OAuth Superadmin — no puede exigir
  // una cookie que todavía no existe. Cada handler hace su propia
  // validación real (nunca queda sin protección: ver
  // src/lib/superadmin-auth.ts requireSuperadminSession).
  "/api/superadmin/auth",
]

/** Role-specific protected route prefixes and the required userType */
const ROLE_PROTECTED_ROUTES: Array<{ prefix: string; userType: string; cookieName: string; tokenPattern: RegExp }> = [
  { prefix: "/api/cliente", userType: "cliente", cookieName: SESSION_COOKIE, tokenPattern: UUID_REGEX },
  { prefix: "/api/negocio", userType: "negocio", cookieName: SESSION_COOKIE, tokenPattern: UUID_REGEX },
  { prefix: "/api/repartidor", userType: "repartidor", cookieName: SESSION_COOKIE, tokenPattern: UUID_REGEX },
  // 24-A: cookie y formato de token propios — nunca la cookie compartida.
  { prefix: "/api/superadmin", userType: "superadmin", cookieName: SUPERADMIN_SESSION_COOKIE, tokenPattern: SUPERADMIN_TOKEN_REGEX },
]

/** Routes that require *any* authenticated session */
const AUTH_REQUIRED_PREFIXES = [
  "/api/chat",
  "/api/realtime",
  "/api/push/subscribe",
  "/api/push/unsubscribe",
]

/** Check whether a path starts with any of the given prefixes */
function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"))
}

// ---------------------------------------------------------------------------
// Security headers applied to ALL responses
// ---------------------------------------------------------------------------

function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("X-Frame-Options", "SAMEORIGIN")
  response.headers.set("X-XSS-Protection", "1; mode=block")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(self)"
  )
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com",
      "img-src 'self' data: blob: https://res.cloudinary.com https://tile.openstreetmap.org https://*.tile.openstreetmap.org",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' ws: wss: https://res.cloudinary.com https://nominatim.openstreetmap.org",
      "worker-src 'self' blob:",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ")
  )
  return response
}

// ---------------------------------------------------------------------------
// CORS headers for API routes
// ---------------------------------------------------------------------------

const CORS_ALLOW_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
const CORS_ALLOW_HEADERS = "Content-Type, X-Requested-With, X-Cleanup-Secret"

function addVaryOrigin(response: NextResponse): void {
  const current = response.headers.get("Vary")
  if (!current) {
    response.headers.set("Vary", "Origin")
    return
  }

  const values = current.split(",").map((value) => value.trim().toLowerCase())
  if (!values.includes("origin")) {
    response.headers.set("Vary", `${current}, Origin`)
  }
}

function addCorsHeaders(
  response: NextResponse,
  request: NextRequest
): NextResponse {
  const allowedOrigin = getAllowedCorsOrigin(request)
  if (!allowedOrigin) {
    return response
  }

  response.headers.set("Access-Control-Allow-Origin", allowedOrigin)
  response.headers.set("Access-Control-Allow-Credentials", "true")
  response.headers.set("Access-Control-Allow-Methods", CORS_ALLOW_METHODS)
  response.headers.set("Access-Control-Allow-Headers", CORS_ALLOW_HEADERS)
  response.headers.set("Access-Control-Max-Age", "86400") // 24 h preflight cache
  addVaryOrigin(response)
  return response
}

// ---------------------------------------------------------------------------
// Origin protection for selected cookie-auth mutating API routes
// ---------------------------------------------------------------------------

const ORIGIN_PROTECTED_PREFIXES = [
  "/api/auth/logout",
  "/api/realtime",
  "/api/cliente",
  "/api/denuncias",
  "/api/destacado-solicitud",
  "/api/notificaciones",
  "/api/operaciones",
  "/api/operativo",
  "/api/pedidos",
  "/api/repartidor",
  "/api/superadmin",
]

const NEGOCIO_ORIGIN_PROTECTED_PREFIXES = [
  "/api/negocio/agregados",
  "/api/negocio/categorias",
  "/api/negocio/config",
  "/api/negocio/empleados",
  "/api/negocio/ingredientes",
  "/api/negocio/mesas-assign",
  "/api/negocio/mozos/invitaciones",
  "/api/negocio/opciones-compartidas",
  "/api/negocio/pedidos",
  "/api/negocio/productos",
  "/api/negocio/resenas",
  "/api/negocio/secciones",
  "/api/negocio/terminales-operativas",
]

function shouldValidateOrigin(pathname: string, method: string): boolean {
  if (!isMutatingMethod(method)) return false

  return (
    matchesPrefix(pathname, ORIGIN_PROTECTED_PREFIXES) ||
    matchesPrefix(pathname, NEGOCIO_ORIGIN_PROTECTED_PREFIXES)
  )
}

// ---------------------------------------------------------------------------
// Lightweight session cookie validation
// ---------------------------------------------------------------------------

/**
 * Reads the session cookie and returns the token if it looks like a valid UUID.
 * This is a *soft* check — we only verify the cookie exists and has UUID format.
 * Full validation (DB lookup, expiry) still happens in the route handlers.
 */
function getSessionToken(request: NextRequest): string | null {
  const token = request.cookies.get(SESSION_COOKIE)?.value
  if (!token) return null
  if (!UUID_REGEX.test(token)) return null
  return token
}

/** Same soft-check idea as getSessionToken, but for an arbitrary cookie/pattern pair. */
function getCookieToken(request: NextRequest, cookieName: string, pattern: RegExp): string | null {
  const token = request.cookies.get(cookieName)?.value
  if (!token) return null
  if (!pattern.test(token)) return null
  return token
}

// ---------------------------------------------------------------------------
// Route protection logic
// ---------------------------------------------------------------------------

/**
 * Determine if the request should be allowed through.
 * Returns RouteAllowed if the request passes, or RouteBlocked if
 * the session cookie is missing/invalid for a protected route.
 */
interface RouteAllowed {
  allowed: true
}

interface RouteBlocked {
  allowed: false
  status: number
  message: string
}

type RouteCheckResult = RouteAllowed | RouteBlocked

function isRouteBlocked(result: RouteCheckResult): result is RouteBlocked {
  return !result.allowed
}

function hasHandlerManagedAuth(pathname: string, method: string): boolean {
  return pathname === "/api/negocio/mesas-assign" && method === "POST"
}

function checkRouteProtection(
  request: NextRequest,
  pathname: string,
  method: string,
  token: string | null,
  resolved: ResolvedActorSession
): RouteCheckResult {
  // 1. Public routes — always allowed
  if (matchesPrefix(pathname, PUBLIC_API_PREFIXES)) {
    return { allowed: true }
  }

  // 2. Exact routes whose handler performs full auth with session or scoped tokens.
  if (hasHandlerManagedAuth(pathname, method)) {
    return { allowed: true }
  }

  // 3. Role-specific routes. Superadmin (24-A) keeps its own isolated
  // cookie/pattern, checked directly here — never went through
  // resolveActorSession, which only knows cliente/negocio/repartidor.
  // The other three reuse `resolved` (computed once in proxy()) instead of
  // a fresh per-entry lookup, so a Fase 1 family-specific cookie is
  // recognized here exactly as the legacy cookie always was.
  for (const { prefix, userType, cookieName, tokenPattern } of ROLE_PROTECTED_ROUTES) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      const roleToken = isSessionFamily(userType)
        ? (resolved.family === userType ? resolved.token : null)
        : getCookieToken(request, cookieName, tokenPattern)
      if (!roleToken) {
        return {
          allowed: false,
          status: 401,
          message: `Se requiere autenticación de ${userType}`,
        }
      }
      // Soft check passed — cookie exists and looks well-formed.
      // The route handler will do the full validation.
      return { allowed: true }
    }
  }

  // 4. Any-auth routes (chat, push)
  if (matchesPrefix(pathname, AUTH_REQUIRED_PREFIXES)) {
    if (!token) {
      return {
        allowed: false,
        status: 401,
        message: "Se requiere autenticación",
      }
    }
    return { allowed: true }
  }

  // 5. Other API routes — allowed (no special protection at middleware level)
  return { allowed: true }
}

// ---------------------------------------------------------------------------
// Rate-limit informational headers
// ---------------------------------------------------------------------------

/**
 * We don't enforce rate limits in middleware (that's done in route handlers
 * with the in-memory store). Instead, we add placeholder informational headers
 * so clients know rate-limiting is active.
 */
function addRateLimitHintHeaders(response: NextResponse): NextResponse {
  // These are informational; actual enforcement is per-route.
  response.headers.set("X-RateLimit-Remaining", "60")
  response.headers.set("X-RateLimit-Reset", String(Math.ceil(Date.now() / 1000) + 60))
  return response
}

// ---------------------------------------------------------------------------
// Request logging (API routes only)
// ---------------------------------------------------------------------------

function logApiRequest(
  method: string,
  pathname: string,
  status: number,
  durationMs: number
): void {
  const level = status >= 500 ? "ERROR" : status >= 400 ? "WARN" : "INFO"
  const timestamp = new Date().toISOString()
  console.log(
    `[${timestamp}] ${level} ${method} ${pathname} → ${status} (${durationMs}ms)`
  )
}

// ---------------------------------------------------------------------------
// Main middleware
// ---------------------------------------------------------------------------

export function proxy(request: NextRequest) {
  const startTime = Date.now()
  const { pathname } = request.nextUrl
  const isApiRoute = pathname.startsWith("/api/")
  const isSocketIo = pathname.startsWith("/socket.io")

  // --- Socket.IO requests — skip middleware, let Next.js rewrites handle them ---
  if (isSocketIo) {
    return NextResponse.next()
  }

  // --- Handle CORS preflight for API routes ---
  if (isApiRoute && request.method === "OPTIONS") {
    const blockedStatus = hasDisallowedCorsOrigin(request) ? 403 : 204
    const response =
      blockedStatus === 403
        ? NextResponse.json({ error: "Origen no permitido" }, { status: 403 })
        : new NextResponse(null, { status: 204 })
    addCorsHeaders(response, request)
    addSecurityHeaders(response)
    addRateLimitHintHeaders(response)
    const duration = Date.now() - startTime
    logApiRequest("OPTIONS", pathname, blockedStatus, duration)
    return response
  }

  // P2-T18-BLOCKER-AUTH2-R2 (Phase 1): resuelto UNA vez por request, usado
  // tanto por checkRouteProtection (soft-check) como por la reescritura de
  // cookie request-only más abajo (aplica a rutas API y de página por
  // igual — mismo mecanismo, sin costo adicional de archivos/complejidad).
  const resolved = resolveActorSession(request, pathname)

  // --- API route protection (soft auth) ---
  if (isApiRoute) {
    const check = checkRouteProtection(request, pathname, request.method, resolved.token, resolved)

    if (isRouteBlocked(check)) {
      const response = NextResponse.json(
        { error: check.message },
        { status: check.status }
      )
      addCorsHeaders(response, request)
      addSecurityHeaders(response)
      const duration = Date.now() - startTime
      logApiRequest(request.method, pathname, check.status, duration)
      return response
    }

    if (shouldValidateOrigin(pathname, request.method)) {
      const originError = validateMutationOrigin(request)
      if (originError) {
        addCorsHeaders(originError, request)
        addSecurityHeaders(originError)
        const duration = Date.now() - startTime
        logApiRequest(request.method, pathname, 403, duration)
        return originError
      }
    }
  }

  // --- Continue with the request, presentando la cookie resuelta bajo el
  // nombre legacy a los route handlers downstream (nunca al navegador —
  // ver rewriteResolvedSessionCookieHeaders). RESOLVED_ACTOR_FAMILY_HEADER
  // se sanea de forma INCONDICIONAL antes de decidir si escribir un valor
  // de confianza — SANITIZE_FIRST -> RESOLVE -> SET_TRUSTED_IF_VALID. Un
  // valor suministrado por el cliente NUNCA puede sobrevivir este paso,
  // ni siquiera cuando resolved.family/resolved.token son null
  // (P2-T18-BLOCKER-AUTH2-R2-R2, corrección del hallazgo de
  // AUTH2-R2-R1 — la versión anterior sólo sobrescribía el header cuando
  // resolved.family era verdadero en /api/auth/logout, dejando pasar sin
  // tocar un valor spoofeado en cualquier otro escenario). ---
  const headers = resolved.token
    ? rewriteResolvedSessionCookieHeaders(request, resolved.token)
    : new Headers(request.headers)
  headers.delete(RESOLVED_ACTOR_FAMILY_HEADER)
  if (pathname === "/api/auth/logout" && resolved.family) {
    headers.set(RESOLVED_ACTOR_FAMILY_HEADER, resolved.family)
  }
  const response = NextResponse.next({ request: { headers } })

  // --- Add security headers to all responses ---
  addSecurityHeaders(response)

  // --- Add CORS + rate-limit headers for API routes ---
  if (isApiRoute) {
    addCorsHeaders(response, request)
    addRateLimitHintHeaders(response)

    // --- Log the API request ---
    // We can't know the final status code here (NextResponse.next() hasn't
    // been handled yet), so we log with a placeholder. For successful requests
    // we use 200 as the assumed status. Error responses are logged above.
    const duration = Date.now() - startTime
    logApiRequest(request.method, pathname, 200, duration)
  }

  return response
}

// ---------------------------------------------------------------------------
// Matcher — only run on relevant paths, excluding static files
// ---------------------------------------------------------------------------

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public folder assets (sw.js, icons, manifest, etc.)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|sw\\.js|manifest\\.json|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)$).*)",
  ],
}
