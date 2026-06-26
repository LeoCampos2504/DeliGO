"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { getRoleFromPath, getRoleConfig } from "@/lib/role-config"

/**
 * Dynamic Manifest Link Component
 * Updates the <link rel="manifest"> and meta theme-color based on the current route's role.
 * Also updates the apple-touch-icon for each role.
 *
 * Token-based routes use static manifests so bearer links are not repeated in
 * secondary URLs.
 */
export function DynamicManifest() {
  const pathname = usePathname()
  const role = getRoleFromPath(pathname)
  const config = getRoleConfig(role)

  useEffect(() => {
    // ── Compute manifest href ──
    // For token-based roles with a token in URL, use the dynamic API endpoint
    // so the installed PWA opens to /{m|s|e}/{token} directly
    const manifestHref = config.manifestFile

    // Update manifest link
    const existingManifest = document.querySelector('link[rel="manifest"]')
    if (existingManifest) {
      existingManifest.setAttribute("href", manifestHref)
    } else {
      const link = document.createElement("link")
      link.rel = "manifest"
      link.href = manifestHref
      document.head.appendChild(link)
    }

    // Update theme-color meta
    const existingThemeColor = document.querySelector('meta[name="theme-color"]')
    if (existingThemeColor) {
      existingThemeColor.setAttribute("content", config.themeColor)
    } else {
      const meta = document.createElement("meta")
      meta.name = "theme-color"
      meta.content = config.themeColor
      document.head.appendChild(meta)
    }

    // Update apple-touch-icon
    const existingAppleIcon = document.querySelector('link[rel="apple-touch-icon"]')
    if (existingAppleIcon) {
      existingAppleIcon.setAttribute("href", config.icon192)
    } else {
      const link = document.createElement("link")
      link.rel = "apple-touch-icon"
      link.href = config.icon192
      document.head.appendChild(link)
    }

    // Update favicon
    const existingFavicon = document.querySelector('link[rel="icon"][type="image/png"]')
    if (existingFavicon) {
      existingFavicon.setAttribute("href", config.icon192)
    }

    // Update page title based on role
    document.title = `${config.name} - ${config.description}`
  }, [config, role])

  return null
}
