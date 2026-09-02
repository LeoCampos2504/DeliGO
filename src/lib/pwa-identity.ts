import type { Metadata, Viewport } from "next"
import { getRoleConfig, type DeliGORole } from "@/lib/role-config"

/**
 * Roles whose PWA identity is emitted from an App Router layout during SSR.
 * Token-based roles keep using DynamicManifest because their URLs are resolved
 * on the client and are intentionally outside these stable PWA scopes.
 */
export const PRINCIPAL_PWA_ROLES = [
  "cliente",
  "negocio",
  "operaciones",
  "repartidor",
] as const satisfies readonly DeliGORole[]

export type PrincipalPwaRole = (typeof PRINCIPAL_PWA_ROLES)[number]

export function isPrincipalPwaRole(role: DeliGORole): role is PrincipalPwaRole {
  return PRINCIPAL_PWA_ROLES.includes(role as PrincipalPwaRole)
}

// P2-T22B-R2: only Cliente's hero/catalog surfaces have been hardened with
// env(safe-area-inset-top) protection for every top-anchored header (see
// src/app/cliente/page.tsx, client-favorites-panel.tsx, client-orders-panel.tsx,
// client-promos-panel.tsx, client-profile-panel.tsx, and T22A's hero controls).
// Negocio/Operaciones/Repartidor have not been audited for that protection, so
// they must keep the opaque "default" status bar until they receive the same
// hardening — a global black-translucent would be an unaudited regression there.
function getAppleStatusBarStyle(role: PrincipalPwaRole): "default" | "black-translucent" {
  return role === "cliente" ? "black-translucent" : "default"
}

export function getPwaIdentityMetadata(role: PrincipalPwaRole): Metadata {
  const config = getRoleConfig(role)

  return {
    title: `${config.name} - ${config.description}`,
    applicationName: config.shortName,
    manifest: config.manifestFile,
    icons: {
      icon: [
        {
          url: config.icon192,
          sizes: "192x192",
          type: "image/png",
        },
      ],
      apple: [
        {
          url: config.icon192,
          sizes: "192x192",
          type: "image/png",
        },
      ],
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: getAppleStatusBarStyle(role),
      title: config.shortName,
    },
  }
}

export function getPwaIdentityViewport(role: PrincipalPwaRole): Viewport {
  const config = getRoleConfig(role)

  return {
    themeColor: config.themeColor,
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    interactiveWidget: "resizes-content",
    viewportFit: "cover",
  }
}
