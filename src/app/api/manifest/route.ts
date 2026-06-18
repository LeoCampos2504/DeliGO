import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { ROLE_CONFIGS, type DeliGORole } from "@/lib/role-config"

// ============================================
// GET /api/manifest?role=mozo&token=abc123
//
// - Without token: 302 redirect to the static manifest file
// - With token (for token-based roles mozo/salon/empleado):
//   returns a dynamic manifest with start_url set to /{m|s|e}/{token}
//   so the installed PWA opens directly to the user's dashboard.
// ============================================

const STATIC_MANIFEST_BY_ROLE: Record<string, string> = {
  admin: "/manifest-admin.json",
  cliente: "/manifest-cliente.json",
  negocio: "/manifest-negocio.json",
  repartidor: "/manifest-repartidor.json",
  mozo: "/manifest-mozo.json",
  salon: "/manifest-salon.json",
  empleado: "/manifest-empleado.json",
}

export async function GET(request: NextRequest) {
  const role = request.nextUrl.searchParams.get("role") ?? "cliente"
  const token = request.nextUrl.searchParams.get("token")

  const manifestPath = STATIC_MANIFEST_BY_ROLE[role] ?? STATIC_MANIFEST_BY_ROLE.cliente

  // ── Without token → just redirect to static manifest file ──
  if (!token) {
    return NextResponse.redirect(new URL(manifestPath, request.url))
  }

  // ── With token → generate dynamic manifest (only for token-based roles) ──
  const config = ROLE_CONFIGS[role as DeliGORole]
  if (!config?.tokenBased) {
    // Role doesn't use tokens → fall back to redirect
    return NextResponse.redirect(new URL(manifestPath, request.url))
  }

  try {
    // Read the static manifest file
    const filePath = path.join(process.cwd(), "public", manifestPath)
    const manifestJson = await fs.readFile(filePath, "utf-8")
    const manifest = JSON.parse(manifestJson)

    // Override start_url to include the token, so the installed PWA
    // opens directly to this user's dashboard
    manifest.start_url = `${config.pathPrefix}${token}`
    // Scope must match the role's path prefix (e.g. "/m/", "/s/", "/e/")
    // — NOT "/" — otherwise the installed PWA would capture ALL routes
    // (including "/", "/negocio", "/repartidor") and prevent the user
    // from installing the cliente/negocio/repartidor PWAs separately.
    manifest.scope = config.pathPrefix
    // Stable id (does NOT include the token) so the PWA stays the same
    // app even if the token changes (e.g. mozo re-logs in). Without an
    // explicit id the browser would derive it from start_url, which
    // contains the token → every new token = a "new" app.
    manifest.id = `${config.pathPrefix}?pwa=${role}`

    return NextResponse.json(manifest, {
      headers: {
        "Content-Type": "application/manifest+json",
        // Don't cache dynamic manifests — token may change
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    })
  } catch (error) {
    console.error("[/api/manifest] Error generating dynamic manifest:", error)
    // Fall back to static redirect
    return NextResponse.redirect(new URL(manifestPath, request.url))
  }
}
