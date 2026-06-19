// DeliGO - Role-specific configuration
// Each "app" within DeliGO has its own branding, colors, and PWA manifest

export type DeliGORole =
  | "cliente"
  | "negocio"
  | "repartidor"
  | "admin"
  | "mozo"
  | "salon"
  | "empleado"

export interface RoleConfig {
  id: DeliGORole
  name: string
  shortName: string
  description: string
  emoji: string
  color: string        // Tailwind color name for the role
  themeColor: string   // Hex theme color
  manifestFile: string // PWA manifest filename
  startUrl: string     // Where to go when opening the app
  loginUrl: string     // Login page for this role
  icon192: string      // 192x192 icon filename
  icon512: string      // 512x512 icon filename
  gradientFrom: string // Tailwind gradient from color
  gradientTo: string   // Tailwind gradient to color
  shadowColor: string  // Tailwind shadow color
  /** Whether this role uses token-in-URL magic links (no login) */
  tokenBased?: boolean
  /** Path prefix used to detect this role from URL (e.g. "/m/") */
  pathPrefix?: string
}

export const ROLE_CONFIGS: Record<DeliGORole, RoleConfig> = {
  cliente: {
    id: "cliente",
    name: "DeliGO",
    shortName: "DeliGO",
    description: "Pedí lo que quieras con DeliGO",
    emoji: "🍔",
    color: "orange",
    themeColor: "#FB8C00",
    manifestFile: "/manifest-cliente.json",
    startUrl: "/cliente",
    loginUrl: "/cliente",
    icon192: "/icon-cliente-192x192.png",
    icon512: "/icon-cliente-512x512.png",
    gradientFrom: "from-orange-500",
    gradientTo: "to-amber-500",
    shadowColor: "shadow-orange-500/20",
  },
  negocio: {
    id: "negocio",
    name: "DeliGO Negocios",
    shortName: "DeliGO Negocios",
    description: "Gestioná tu catálogo, pedidos y delivery",
    emoji: "🏪",
    color: "emerald",
    themeColor: "#059669",
    manifestFile: "/manifest-negocio.json",
    startUrl: "/negocio",
    loginUrl: "/negocio",
    icon192: "/icon-negocio-192x192.png",
    icon512: "/icon-negocio-512x512.png",
    gradientFrom: "from-emerald-500",
    gradientTo: "to-teal-500",
    shadowColor: "shadow-emerald-500/20",
  },
  repartidor: {
    id: "repartidor",
    name: "DeliGO Delivery",
    shortName: "DeliGO Delivery",
    description: "Recibí y entregá pedidos",
    emoji: "🛵",
    color: "sky",
    themeColor: "#0284C7",
    manifestFile: "/manifest-repartidor.json",
    startUrl: "/repartidor",
    loginUrl: "/repartidor",
    icon192: "/icon-repartidor-192x192.png",
    icon512: "/icon-repartidor-512x512.png",
    gradientFrom: "from-sky-500",
    gradientTo: "to-blue-500",
    shadowColor: "shadow-sky-500/20",
  },
  admin: {
    id: "admin",
    name: "DeliGO Admin",
    shortName: "DeliGO Admin",
    description: "Panel de administración",
    emoji: "🔐",
    color: "violet",
    themeColor: "#7C3AED",
    manifestFile: "/manifest-admin.json",
    startUrl: "/admin",
    loginUrl: "/admin",
    icon192: "/icon-admin-192x192.png",
    icon512: "/icon-admin-512x512.png",
    gradientFrom: "from-violet-500",
    gradientTo: "to-purple-500",
    shadowColor: "shadow-violet-500/20",
  },
  mozo: {
    id: "mozo",
    name: "DeliGO Mozos",
    shortName: "DeliGO Mozos",
    description: "Gestioná tus mesas y pedidos",
    emoji: "🧑‍🍳",
    color: "amber",
    themeColor: "#D97706",
    manifestFile: "/manifest-mozo.json",
    // startUrl is dynamic — set to /m/{token} at install time via /api/manifest
    startUrl: "/mozo",
    loginUrl: "/mozo",
    icon192: "/icon-mozo-192x192.png",
    icon512: "/icon-mozo-512x512.png",
    gradientFrom: "from-amber-500",
    gradientTo: "to-orange-600",
    shadowColor: "shadow-amber-500/20",
    tokenBased: true,
    pathPrefix: "/m/",
  },
  salon: {
    id: "salon",
    name: "DeliGO Salón",
    shortName: "DeliGO Salón",
    description: "Vista en vivo del salón y pedidos",
    emoji: "🪑",
    color: "slate",
    themeColor: "#475569",
    manifestFile: "/manifest-salon.json",
    startUrl: "/s",
    loginUrl: "/s",
    icon192: "/icon-salon-192x192.png",
    icon512: "/icon-salon-512x512.png",
    gradientFrom: "from-slate-600",
    gradientTo: "to-slate-800",
    shadowColor: "shadow-slate-500/20",
    tokenBased: true,
    pathPrefix: "/s/",
  },
  empleado: {
    id: "empleado",
    name: "DeliGO Empleados",
    shortName: "DeliGO Empleados",
    description: "Pedidos, reseñas y chat del negocio",
    emoji: "📋",
    color: "cyan",
    themeColor: "#0891B2",
    manifestFile: "/manifest-empleado.json",
    startUrl: "/e",
    loginUrl: "/e",
    icon192: "/icon-empleado-192x192.png",
    icon512: "/icon-empleado-512x512.png",
    gradientFrom: "from-cyan-500",
    gradientTo: "to-teal-600",
    shadowColor: "shadow-cyan-500/20",
    tokenBased: true,
    pathPrefix: "/e/",
  },
}

/**
 * Get role config from user type string
 */
export function getRoleConfig(userType: string): RoleConfig {
  return ROLE_CONFIGS[userType as DeliGORole] ?? ROLE_CONFIGS.cliente
}

/**
 * Get role config from current URL pathname
 * Recognizes token-based magic-link routes:
 *   /m/{token}   → mozo
 *   /mozo/{slug} → mozo (scanner page)
 *   /s/{token}   → salon
 *   /e/{token}   → empleado
 */
export function getRoleFromPath(pathname: string): DeliGORole {
  // Cliente PWA lives at /cliente/ (scope: "/cliente/")
  if (pathname.startsWith("/cliente")) return "cliente"
  if (pathname.startsWith("/negocio")) return "negocio"
  if (pathname.startsWith("/repartidor")) return "repartidor"
  if (pathname.startsWith("/admin")) return "admin"
  // Token-based magic-link routes
  if (pathname.startsWith("/m/") || pathname === "/m") return "mozo"
  if (pathname.startsWith("/mozo/")) return "mozo"
  if (pathname.startsWith("/s/") || pathname === "/s") return "salon"
  if (pathname.startsWith("/e/") || pathname === "/e") return "empleado"
  // Fallback: root "/" redirects to /cliente/ so treat it as cliente too
  return "cliente"
}

/**
 * Extract the token from a magic-link URL pathname.
 * Returns null if the path doesn't contain a token.
 *
 * Examples:
 *   "/m/abc123"        → "abc123"
 *   "/s/xyz789"        → "xyz789"
 *   "/e/token-here"    → "token-here"
 *   "/mozo/mi-slug"    → null (slug, not token)
 *   "/negocio"         → null
 */
export function getTokenFromPath(pathname: string): string | null {
  // Match /m/{token}, /s/{token}, /e/{token}
  const match = pathname.match(/^\/([mse])\/([^/?#]+)/)
  if (!match) return null
  return match[2]
}
