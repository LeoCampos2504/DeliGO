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
    // P2-T22C: IOS-PWA-DEBUG-LAUNCH-FIX-R2A intentionally appends
    // ?iosDebug=1 to Cliente's start_url so every cold PWA launch from the
    // installed icon carries the real-device diagnostic flag (localStorage
    // can't cross the Safari -> installed-app storage boundary on iOS — see
    // src/lib/ios-debug-snapshot.ts's isIosDebugFlagEnabled comment and
    // src/lib/ios-pwa-debug-launch-static-contract.test.ts, which is the
    // authoritative contract for this TESTING-only value). This must revert
    // to "/cliente" together with the rest of that instrumentation before
    // Production (PWA_DEBUG_START_URL_MUST_BE_REMOVED_BEFORE_PRODUCTION).
    startUrl: "/cliente?iosDebug=1",
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
