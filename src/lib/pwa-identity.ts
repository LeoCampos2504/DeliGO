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
      statusBarStyle: "default",
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
