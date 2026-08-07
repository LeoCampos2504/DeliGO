/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { PRINCIPAL_PWA_ROLES } from "./pwa-identity"
import { getRoleConfig } from "./role-config"

const ORIGIN = "https://deligo.example"

function canonicalizeNextPath(path: string): URL {
  const url = new URL(path, ORIGIN)

  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1)
  }

  return url
}

function isUrlWithinScope(scope: string, target: URL): boolean {
  const scopeUrl = new URL(scope, ORIGIN)
  return scopeUrl.origin === target.origin && target.pathname.startsWith(scopeUrl.pathname)
}

describe("PWA Android — canonical start_url y scope", () => {
  test("cada start_url canónico de Next termina dentro de su scope", () => {
    for (const role of PRINCIPAL_PWA_ROLES) {
      const manifest = JSON.parse(
        readFileSync(resolve(import.meta.dir, `../../public/manifest-${role}.json`), "utf8")
      )
      const finalUrl = canonicalizeNextPath(manifest.start_url)

      expect(isUrlWithinScope(manifest.scope, finalUrl)).toBe(true)
      expect(finalUrl.pathname).toBe(getRoleConfig(role).startUrl)
    }
  })

  test("ningún root route real colisiona con los scopes canónicos por prefijo", () => {
    const rootSegments = readdirSync(resolve(import.meta.dir, "../app"), {
      withFileTypes: true,
    })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)

    for (const role of PRINCIPAL_PWA_ROLES) {
      const collisions = rootSegments.filter(
        (segment) => segment !== role && segment.startsWith(role)
      )

      expect(collisions).toEqual([])
    }
  })
})
