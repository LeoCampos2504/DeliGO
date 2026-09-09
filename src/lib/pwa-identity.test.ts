/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { getRoleConfig } from "./role-config"
import {
  getPwaIdentityMetadata,
  getPwaIdentityViewport,
  isPrincipalPwaRole,
  PRINCIPAL_PWA_ROLES,
} from "./pwa-identity"

const contracts = {
  cliente: {
    id: "/cliente/?pwa=cliente",
    scope: "/cliente",
    // PRE-T29-FIX-MANIFEST-CLIENTE-IOSDEBUG-FLAG-TESTING (F-PRE-T29-02):
    // reverted the IOS-PWA-DEBUG-LAUNCH-FIX-R2A/P2-T22C start_url override —
    // it made every new Cliente PWA install launch with the diagnostic
    // panel on by default, which is Production-visible. The manual gate
    // (/cliente?iosDebug=1, see ios-pwa-debug-launch-static-contract.test.ts)
    // still works; it's just no longer baked into the manifest.
    startUrl: "/cliente",
  },
  negocio: {
    id: "/negocio/?pwa=negocio",
    scope: "/negocio",
    startUrl: "/negocio",
  },
  operaciones: {
    id: "/operaciones/?pwa=operaciones",
    scope: "/operaciones",
    startUrl: "/operaciones",
  },
  repartidor: {
    id: "/repartidor/?pwa=repartidor",
    scope: "/repartidor",
    startUrl: "/repartidor",
  },
} as const

describe("PWA-21-A01 + PWA-22-01 — identidad SSR por rol", () => {
  test("la fuente de verdad conserva una identidad SSR para cada PWA principal", () => {
    expect(PRINCIPAL_PWA_ROLES).toEqual([
      "cliente",
      "negocio",
      "operaciones",
      "repartidor",
    ])

    for (const role of PRINCIPAL_PWA_ROLES) {
      const config = getRoleConfig(role)
      const metadata = getPwaIdentityMetadata(role)
      const viewport = getPwaIdentityViewport(role)

      expect(isPrincipalPwaRole(role)).toBe(true)
      expect(metadata.manifest).toBe(config.manifestFile)
      expect(metadata.title).toBe(`${config.name} - ${config.description}`)
      expect(metadata.applicationName).toBe(config.shortName)
      expect(viewport.themeColor).toBe(config.themeColor)
      expect(viewport.viewportFit).toBe("cover")
      expect(viewport.interactiveWidget).toBe("resizes-content")
    }

    expect(isPrincipalPwaRole("mozo")).toBe(false)
    expect(isPrincipalPwaRole("salon")).toBe(false)
    expect(isPrincipalPwaRole("empleado")).toBe(false)
  })

  // P2-T22B-R2: only "cliente" has been hardened with safe-area-aware top
  // headers (src/app/cliente/page.tsx and the 4 client-*-panel.tsx files —
  // see client-headers-safe-area-static-contract.test.ts). Negocio/
  // Operaciones/Repartidor keep the opaque "default" status bar until they
  // receive the same audit and hardening.
  test("statusBarStyle es black-translucent solo para cliente; el resto conserva default", () => {
    const statusBarStyleByRole: Record<(typeof PRINCIPAL_PWA_ROLES)[number], string> = {
      cliente: "black-translucent",
      negocio: "default",
      operaciones: "default",
      repartidor: "default",
    }

    for (const role of PRINCIPAL_PWA_ROLES) {
      const metadata = getPwaIdentityMetadata(role)
      expect(metadata.appleWebApp).toMatchObject({
        capable: true,
        statusBarStyle: statusBarStyleByRole[role],
      })
    }
  })

  test("los manifests existentes conservan id, scope, start_url y display", () => {
    for (const [role, contract] of Object.entries(contracts)) {
      const manifest = JSON.parse(
        readFileSync(resolve(import.meta.dir, `../../public/manifest-${role}.json`), "utf8")
      )
      const config = getRoleConfig(role)

      expect(manifest.id).toBe(contract.id)
      expect(manifest.scope).toBe(contract.scope)
      expect(manifest.start_url).toBe(contract.startUrl)
      expect(manifest.display).toBe("standalone")
      expect(manifest.theme_color).toBe(config.themeColor)
      expect(manifest.scope).not.toBe("/")
    }
  })

  test("cada layout principal emite su metadata SSR y DynamicManifest no la sustituye", () => {
    for (const role of PRINCIPAL_PWA_ROLES) {
      const layout = readFileSync(
        resolve(import.meta.dir, `../app/${role}/layout.tsx`),
        "utf8"
      )

      expect(layout).toContain(`getPwaIdentityMetadata("${role}")`)
      expect(layout).toContain(`getPwaIdentityViewport("${role}")`)
    }

    const dynamicManifest = readFileSync(
      resolve(import.meta.dir, "../components/shared/dynamic-manifest.tsx"),
      "utf8"
    )

    expect(dynamicManifest).toContain('import { isPrincipalPwaRole } from "@/lib/pwa-identity"')
    expect(dynamicManifest).toContain("if (isPrincipalPwaRole(role)) return")
  })
})
