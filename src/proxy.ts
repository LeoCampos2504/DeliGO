import { NextResponse, NextRequest } from "next/server"

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

const CORS_ALLOW_METHODS = "GET, POST, PUT, DELETE, OPTIONS"
const CORS_ALLOW_HEADERS = "Content-Type, Authorization"

function addCorsHeaders(
  response: NextResponse,
  request: NextRequest
): NextResponse {
  // Allow same-origin by default
  const origin = request.headers.get("origin")
  if (origin) {
    // In production you'd validate against an allow-list;
    // for now, reflect the origin (same-domain requests only in practice)
    response.headers.set("Access-Control-Allow-Origin", origin)
  } else {
    response.headers.set("Access-Control-Allow-Origin", "*")
  }
  response.headers.set("Access-Control-Allow-Methods", CORS_ALLOW_METHODS)
  response.headers.set("Access-Control-Allow-Headers", CORS_ALLOW_HEADERS)
  response.headers.set("Access-Control-Max-Age", "86400") // 24 h preflight cache
  return response
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

function checkRouteProtection(
  pathname: string,
  token: string | null
): RouteCheckResult {
  // 1. Public routes — always allowed
  if (matchesPrefix(pathname, PUBLIC_API_PREFIXES)) {
    return { allowed: true }
  }

  // 2. Role-specific routes
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

  // 3. Any-auth routes (chat, push)
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

  // 4. Other API routes — allowed (no special protection at middleware level)
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
    const response = new NextResponse(null, { status: 204 })
    addCorsHeaders(response, request)
    addSecurityHeaders(response)
    addRateLimitHintHeaders(response)
    const duration = Date.now() - startTime
    logApiRequest("OPTIONS", pathname, 204, duration)
    return response
  }

  // --- API route protection (soft auth) ---
  if (isApiRoute) {
    const token = getSessionToken(request)
    const check = checkRouteProtection(pathname, token)

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
