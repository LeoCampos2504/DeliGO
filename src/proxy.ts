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

// UUID v4 regex for lightweight session token validation
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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
]

/** Role-specific protected route prefixes and the required userType */
const ROLE_PROTECTED_ROUTES: Array<{ prefix: string; userType: string }> = [
  { prefix: "/api/cliente", userType: "cliente" },
  { prefix: "/api/negocio", userType: "negocio" },
  { prefix: "/api/repartidor", userType: "repartidor" },
  { prefix: "/api/superadmin", userType: "superadmin" },
]

/** Routes that require *any* authenticated session */
const AUTH_REQUIRED_PREFIXES = [
  "/api/chat",
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
  pathname: string,
  method: string,
  token: string | null
): RouteCheckResult {
  // 1. Public routes — always allowed
  if (matchesPrefix(pathname, PUBLIC_API_PREFIXES)) {
    return { allowed: true }
  }

  // 2. Exact routes whose handler performs full auth with session or scoped tokens.
  if (hasHandlerManagedAuth(pathname, method)) {
    return { allowed: true }
  }

  // 3. Role-specific routes
  for (const { prefix, userType } of ROLE_PROTECTED_ROUTES) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      if (!token) {
        return {
          allowed: false,
          status: 401,
          message: `Se requiere autenticación de ${userType}`,
        }
      }
      // Soft check passed — cookie exists and looks like a UUID.
      // The route handler will do the full userType validation.
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

  // --- API route protection (soft auth) ---
  if (isApiRoute) {
    const token = getSessionToken(request)
    const check = checkRouteProtection(pathname, request.method, token)

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

  // --- Continue with the request ---
  const response = NextResponse.next()

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
