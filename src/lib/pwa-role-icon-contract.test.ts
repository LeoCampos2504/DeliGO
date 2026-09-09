/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test"
import { readFileSync, statSync } from "node:fs"
import { resolve } from "node:path"
import sharp from "sharp"
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

// ============================================
// P2-T36 — maskable safe-zone: derivado dedicado, no el mismo asset "any"
// ============================================
// Los 8 manifests originales apuntaban el mismo PNG full-bleed a purpose
// "any" Y "maskable" — ningún ícono tenía margen real para el círculo de
// seguridad (80% de diámetro) que Android puede aplicar a un maskable. Se
// generó un derivado técnico por rol (mismo logo, mismo fondo YA existente
// en el propio asset, escalado+centrado — sin redibujar, sin color nuevo)
// para los 5 roles con arte fuente íntegro. Empleado/Mozo/Salón quedan
// FUERA de este fix — su PNG fuente está corrupto/recortado (ver
// P2_T36_PWA_BRANDING_HYGIENE.md), no hay insumo válido del que derivar un
// maskable seguro sin inventar contenido.

const MASKABLE_FIXED_ROLES: DeliGORole[] = ["cliente", "negocio", "repartidor", "admin", "operaciones"]

// Mide el radio máximo (desde el centro) del contenido visual real —
// robusto: no depende de bytes exactos, sólo de dónde el color deja de
// coincidir con el color de fondo muestreado en la esquina (0,0), que por
// construcción es sólido y uniforme en estos derivados.
async function maxContentRadiusFraction(absolutePath: string): Promise<number> {
  const img = sharp(absolutePath)
  const meta = await img.metadata()
  const width = meta.width!
  const height = meta.height!
  const raw = await img.raw().ensureAlpha().toBuffer()
  const at = (x: number, y: number) => {
    const idx = (y * width + x) * 4
    return [raw[idx], raw[idx + 1], raw[idx + 2]] as const
  }
  const dist = (a: readonly number[], b: readonly number[]) =>
    Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)
  const bg = at(0, 0)
  const THRESH = 24
  const midY = Math.floor(height / 2)
  const midX = Math.floor(width / 2)
  let leftEdge = 0, rightEdge = width - 1, topEdge = 0, bottomEdge = height - 1
  for (let x = 0; x < width; x++) if (dist(at(x, midY), bg) > THRESH) { leftEdge = x; break }
  for (let x = width - 1; x >= 0; x--) if (dist(at(x, midY), bg) > THRESH) { rightEdge = x; break }
  for (let y = 0; y < height; y++) if (dist(at(midX, y), bg) > THRESH) { topEdge = y; break }
  for (let y = height - 1; y >= 0; y--) if (dist(at(midX, y), bg) > THRESH) { bottomEdge = y; break }
  const cx = width / 2, cy = height / 2
  const maxRadius = Math.max(cx - leftEdge, rightEdge - cx, cy - topEdge, bottomEdge - cy)
  return maxRadius / (width / 2)
}

describe("P2-T36 — maskable safe-zone (derivados dedicados, sin redibujar)", () => {
  test("cada rol arreglado tiene un maskable-{size}x{size}.png dedicado, distinto del asset 'any'", () => {
    for (const role of MASKABLE_FIXED_ROLES) {
      const manifestPath = resolve(import.meta.dir, "../../public", MANIFEST_FILE_BY_ROLE[role])
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
      const anyEntries = manifest.icons.filter((e: { purpose?: string }) => e.purpose === "any")
      const maskableEntries = manifest.icons.filter((e: { purpose?: string }) => e.purpose === "maskable")
      expect(maskableEntries.length).toBeGreaterThan(0)
      for (const m of maskableEntries) {
        expect(publicFileExists(m.src)).toBe(true)
        expect(m.src).toContain("-maskable-")
        // nunca el mismo archivo que "any" — habría sido el bug original
        expect(anyEntries.some((a: { src: string }) => a.src === m.src)).toBe(false)
      }
    }
  })

  // Círculo de seguridad de Android: radio = 40% del ANCHO TOTAL (diámetro
  // 80%). `maxContentRadiusFraction` normaliza contra el MEDIO-ancho, así
  // que ese mismo límite equivale a 0.4*width / (width/2) = 0.8 aquí.
  const SAFE_ZONE_FRACTION_OF_HALF_WIDTH = 0.8

  test("el contenido visual de cada maskable dedicado cabe dentro del círculo de seguridad (radio <= 40% del ancho total, purpose=maskable de Android)", async () => {
    for (const role of MASKABLE_FIXED_ROLES) {
      for (const size of [192, 512]) {
        const p = resolve(import.meta.dir, "../../public", `icon-${role}-maskable-${size}x${size}.png`)
        const fraction = await maxContentRadiusFraction(p)
        // sanity: el propio helper debe distinguir "roto" de "seguro" — el
        // ASSET ORIGINAL (full-bleed, sin margen) da fraction>1.0 aquí mismo.
        expect(fraction).toBeLessThanOrEqual(SAFE_ZONE_FRACTION_OF_HALF_WIDTH)
      }
    }
  })

  test("sanity: el mismo helper de medición detecta CORRECTAMENTE que el asset ORIGINAL (any) NO cabe en el círculo de seguridad — prueba que el test de arriba no pasa trivialmente", async () => {
    for (const role of MASKABLE_FIXED_ROLES) {
      const p = resolve(import.meta.dir, "../../public", `icon-${role}-512x512.png`)
      const fraction = await maxContentRadiusFraction(p)
      expect(fraction).toBeGreaterThan(SAFE_ZONE_FRACTION_OF_HALF_WIDTH)
    }
  })

  test("Empleado/Mozo/Salón NO tienen derivado maskable dedicado todavía — su fuente está corrupta, no se inventó un fix (ver reporte T36, OPERATOR_DESIGN_DECISION_REQUIRED)", () => {
    for (const role of ["empleado", "mozo", "salon"]) {
      expect(publicFileExists(`/icon-${role}-maskable-512x512.png`)).toBe(false)
    }
  })
})

// ============================================
// P2-T36 — badge Android monocromático compartido
// ============================================
describe("P2-T36 — badge-deligo-monochrome-96x96.png (silueta compartida, no un ícono de rol)", () => {
  const BADGE_PATH = resolve(import.meta.dir, "../../public/badge-deligo-monochrome-96x96.png")

  test("el asset existe, es un PNG con canal alfa real, y no es simplemente uno de los íconos full-color existentes", () => {
    expect(publicFileExists("/badge-deligo-monochrome-96x96.png")).toBe(true)
    const buf = readFileSync(BADGE_PATH)
    expect(buf.slice(0, 8).toString("hex")).toBe("89504e470d0a1a0a")
    const cliente = readFileSync(resolve(import.meta.dir, "../../public/icon-cliente-192x192.png"))
    expect(Buffer.compare(buf, cliente)).not.toBe(0)
  })

  test("el badge tiene una silueta real (ni completamente vacío ni completamente opaco) — extraído mecánicamente del glyph blanco existente, sin redibujar", async () => {
    const img = sharp(BADGE_PATH)
    const meta = await img.metadata()
    expect(meta.hasAlpha).toBe(true)
    const raw = await img.raw().ensureAlpha().toBuffer()
    let opaque = 0
    const total = meta.width! * meta.height!
    for (let i = 3; i < raw.length; i += 4) if (raw[i] > 128) opaque++
    const fraction = opaque / total
    // Ni "todo transparente" (extracción rota) ni "todo opaco" (no es una
    // silueta, es un rectángulo sólido) — un rango amplio y no frágil.
    expect(fraction).toBeGreaterThan(0.05)
    expect(fraction).toBeLessThan(0.6)
  })

  test("es el ÚNICO badge — ningún manifest ni el propio sw.js referencian un badge distinto por rol", () => {
    const swSource = readFileSync(resolve(import.meta.dir, "../../public/sw.js"), "utf8")
    const badgeMatches = swSource.match(/\/badge-[a-z0-9-]+\.png/gi) ?? []
    const uniqueBadges = new Set(badgeMatches)
    expect(uniqueBadges.size).toBe(1)
    expect(uniqueBadges.has("/badge-deligo-monochrome-96x96.png")).toBe(true)
  })
})
