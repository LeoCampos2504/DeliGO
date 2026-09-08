/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test"
import { readFileSync, statSync } from "node:fs"
import { resolve } from "node:path"
import { getRoleConfig, type DeliGORole } from "./role-config"

// DELIGO-BRANDING-R1-PWA-ROLE-ICON-REFRESH: contrato mínimo para el refresh
// de íconos por rol — que ningún manifest quede apuntando a un ícono
// inexistente, que cada PNG sea realmente un PNG con las dimensiones que su
// propio nombre de archivo promete, y que cada rol objetivo apunte al asset
// correcto (nunca uno prestado de otro rol).

const PUBLIC_DIR = resolve(import.meta.dir, "../../public")

function readPngDimensions(absolutePath: string): { width: number; height: number } {
  const buf = readFileSync(absolutePath)
  const isPng = buf.slice(0, 8).toString("hex") === "89504e470d0a1a0a"
  if (!isPng) throw new Error(`${absolutePath} is not a valid PNG (bad signature)`)
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}

function publicFileExists(publicPath: string): boolean {
  try {
    statSync(resolve(PUBLIC_DIR, publicPath.replace(/^\//, "")))
    return true
  } catch {
    return false
  }
}

const ROLES_WITH_REFRESHED_ICONS: DeliGORole[] = ["cliente", "negocio", "repartidor", "admin", "operaciones"]

const MANIFEST_FILE_BY_ROLE: Record<string, string> = {
  cliente: "manifest-cliente.json",
  negocio: "manifest-negocio.json",
  repartidor: "manifest-repartidor.json",
  admin: "manifest-admin.json",
  operaciones: "manifest-operaciones.json",
}

describe("DELIGO-BRANDING-R1 — contrato de íconos PWA por rol", () => {
  test("role-config.icon192/icon512 existen en disco, son PNG válidos y respetan la dimensión de su propio nombre", () => {
    for (const role of ROLES_WITH_REFRESHED_ICONS) {
      const config = getRoleConfig(role)

      expect(publicFileExists(config.icon192)).toBe(true)
      expect(publicFileExists(config.icon512)).toBe(true)

      const dims192 = readPngDimensions(resolve(PUBLIC_DIR, config.icon192.replace(/^\//, "")))
      expect(dims192).toEqual({ width: 192, height: 192 })

      const dims512 = readPngDimensions(resolve(PUBLIC_DIR, config.icon512.replace(/^\//, "")))
      expect(dims512).toEqual({ width: 512, height: 512 })
    }
  })

  test("cada rol apunta a SU PROPIO asset — nunca al de otro rol (Operaciones ya no reusa Negocio)", () => {
    const icon192ByRole = Object.fromEntries(
      ROLES_WITH_REFRESHED_ICONS.map((role) => [role, getRoleConfig(role).icon192])
    )

    expect(icon192ByRole.cliente).toBe("/icon-cliente-192x192.png")
    expect(icon192ByRole.negocio).toBe("/icon-negocio-192x192.png")
    expect(icon192ByRole.repartidor).toBe("/icon-repartidor-192x192.png")
    expect(icon192ByRole.admin).toBe("/icon-admin-192x192.png")
    expect(icon192ByRole.operaciones).toBe("/icon-operaciones-192x192.png")

    // Ningún rol de este set comparte icon192 con otro — cada valor es único.
    const values = Object.values(icon192ByRole)
    expect(new Set(values).size).toBe(values.length)
  })

  test("los manifests de estos 5 roles nunca referencian un ícono inexistente, y su 'any'/'maskable' apuntan al ícono propio del rol", () => {
    for (const role of ROLES_WITH_REFRESHED_ICONS) {
      const manifest = JSON.parse(
        readFileSync(resolve(PUBLIC_DIR, MANIFEST_FILE_BY_ROLE[role]), "utf8")
      )
      const config = getRoleConfig(role)

      expect(Array.isArray(manifest.icons)).toBe(true)
      expect(manifest.icons.length).toBeGreaterThan(0)

      for (const entry of manifest.icons) {
        expect(publicFileExists(entry.src)).toBe(true)
      }

      const anyEntries = manifest.icons.filter((entry: { purpose?: string }) => entry.purpose === "any")
      expect(anyEntries.some((entry: { src: string }) => entry.src === config.icon192)).toBe(true)
      expect(anyEntries.some((entry: { src: string }) => entry.src === config.icon512)).toBe(true)
    }
  })

  test("manifest-operaciones.json ya no referencia icon-negocio-*", () => {
    const manifest = JSON.parse(
      readFileSync(resolve(PUBLIC_DIR, "manifest-operaciones.json"), "utf8")
    )
    for (const entry of manifest.icons) {
      expect(entry.src).not.toContain("icon-negocio")
    }
  })

  test("el ícono global de fallback (layout.tsx) sigue siendo el de Cliente, y el archivo referenciado existe", () => {
    const layout = readFileSync(resolve(import.meta.dir, "../app/layout.tsx"), "utf8")
    expect(layout).toContain('"/icon-cliente-192x192.png"')
    expect(publicFileExists("/icon-cliente-192x192.png")).toBe(true)
  })
})
