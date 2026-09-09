/// <reference types="bun-types" />

// ============================================
// P2-T22 — Locales Destacados debe usar el mismo mecanismo de navegación
// PWA-scoped que ya usa Home (fijado en 0491b0b "fix: keep client catalog
// inside pwa scope", 2026-08-07). Ese commit migró cliente/page.tsx,
// chat-fab.tsx y los 3 paneles de client/* a getClienteCatalogoPath()
// (/cliente/n/[slug], DENTRO del scope "/cliente" del manifest) pero
// nunca tocó promoted-businesses-section.tsx — que ya existía desde el
// commit inicial del repo — dejándolo con la URL pública cruda
// (/n/[slug], FUERA del scope), lo que hace que iOS/Android abran el
// negocio en el browser del sistema en vez de mantenerlo en el PWA
// standalone. Ver cliente-catalog-navigation.ts para la distinción
// documentada entre getClienteCatalogoPath (interno) y
// getPublicCatalogoPath (QR/links externos).
// ============================================

import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const SOURCE = readFileSync(
  join(process.cwd(), "src", "components", "home", "promoted-businesses-section.tsx"),
  "utf8"
)

describe("Locales Destacados permanece dentro del scope PWA de Cliente", () => {
  test("importa el mismo helper que ya usa Home (cliente/page.tsx) en vez de construir la URL pública a mano", () => {
    expect(SOURCE).toContain('import { getClienteCatalogoPath } from "@/lib/cliente-catalog-navigation"')
  })

  test("cada Link a un negocio usa getClienteCatalogoPath — nunca la URL pública cruda /n/${slug}", () => {
    const hrefLines = SOURCE.match(/href=\{[^}]*\}/g) ?? []
    expect(hrefLines.length).toBeGreaterThan(0)
    for (const href of hrefLines) {
      expect(href).toContain("getClienteCatalogoPath(")
      expect(href).not.toMatch(/`\/n\/\$\{/)
    }
  })

  test("no queda ninguna URL pública cruda hacia un negocio en este componente (el patrón exacto que causaba la salida al browser)", () => {
    expect(SOURCE).not.toMatch(/`\/n\/\$\{negocio(\.slug|Slug)\}`/)
  })
})
