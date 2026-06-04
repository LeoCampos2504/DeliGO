// DeliGO - Role-specific configuration
// Each "app" within DeliGO has its own branding, colors, and PWA manifest

export type DeliGORole = "cliente" | "negocio" | "repartidor" | "admin"

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
    startUrl: "/",
    loginUrl: "/login",
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
}

/**
 * Get role config from user type string
 */
export function getRoleConfig(userType: string): RoleConfig {
  return ROLE_CONFIGS[userType as DeliGORole] ?? ROLE_CONFIGS.cliente
}

/**
 * Get role config from current URL pathname
 */
export function getRoleFromPath(pathname: string): DeliGORole {
  if (pathname.startsWith("/negocio")) return "negocio"
  if (pathname.startsWith("/repartidor")) return "repartidor"
  if (pathname.startsWith("/admin")) return "admin"
  return "cliente"
}
