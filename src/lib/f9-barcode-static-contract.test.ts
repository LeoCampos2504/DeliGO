// ============================================
// F9 — static contract: security headers, self-hosted WASM, wiring, scope
// ============================================
import { describe, expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { ZXING_WASM_SHA256 } from "zxing-wasm/reader"
import { ZXING_READER_WASM_URL, ZXING_WASM_VERSION_SERVED } from "./barcode-detector-loader"

const root = process.cwd()
const read = (p: string) => readFileSync(join(root, p), "utf8")

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(join(root, dir))) {
    const rel = `${dir}/${entry}`
    if (statSync(join(root, rel)).isDirectory()) out.push(...walk(rel))
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) out.push(rel)
  }
  return out
}
const sourceFiles = walk("src")

const F9_FILES = [
  "src/lib/barcode.ts",
  "src/lib/scan-lock.ts",
  "src/lib/barcode-uniqueness.ts",
  "src/lib/barcode-detector-loader.ts",
  "src/lib/scan-feedback.ts",
  "src/components/business/barcode-scanner.tsx",
]

const WRITE_ROUTES = [
  "src/app/api/negocio/productos/route.ts",
  "src/app/api/negocio/productos/[id]/route.ts",
  "src/app/api/negocio/productos/[id]/variantes/route.ts",
  "src/app/api/negocio/productos/[id]/variantes/[varianteId]/route.ts",
]

describe("F9 — security headers (D2)", () => {
  const proxy = read("src/proxy.ts")
  test("camera only for the own origin; microphone off; geolocation unchanged", () => {
    expect(proxy).toContain('"camera=(self), microphone=(), geolocation=(self)"')
    expect(proxy).not.toContain("camera=()")
    expect(proxy).not.toMatch(/camera=\([^)]*https?:/)
    expect(proxy).not.toContain("camera=*")
  })
  test("the other protections stay as they were", () => {
    expect(proxy).toContain('response.headers.set("X-Content-Type-Options", "nosniff")')
    expect(proxy).toContain('response.headers.set("X-Frame-Options", "SAMEORIGIN")')
    expect(proxy).toContain('"connect-src \'self\' ws: wss: https://res.cloudinary.com https://nominatim.openstreetmap.org"')
    expect(proxy).toContain('"default-src \'self\'"')
    expect(proxy).toContain('"frame-ancestors \'self\'"')
    expect(proxy).not.toMatch(/jsdelivr|unpkg\.com\/zxing/)
  })
})

describe("F9 — detector assets are self-hosted (no CDN)", () => {
  const wasmPath = join(root, "public", ZXING_READER_WASM_URL)
  test("the served WASM exists and is byte-identical to the installed zxing-wasm build", () => {
    expect(existsSync(wasmPath)).toBe(true)
    const sha = createHash("sha256").update(readFileSync(wasmPath)).digest("hex")
    expect(sha).toBe(ZXING_WASM_SHA256)
  })
  test("served version == installed zxing-wasm version", () => {
    const installed = JSON.parse(read("node_modules/zxing-wasm/package.json")).version
    expect(ZXING_WASM_VERSION_SERVED).toBe(installed)
    expect(ZXING_READER_WASM_URL).toBe(`/vendor/zxing-wasm/${installed}/zxing_reader.wasm`)
  })
  test("barcode-detector is pinned exactly", () => {
    expect(JSON.parse(read("package.json")).dependencies["barcode-detector"]).toBe("3.2.2")
  })
  test("the loader overrides the default CDN locateFile with the same-origin URL", () => {
    const loader = read("src/lib/barcode-detector-loader.ts")
    expect(loader).toContain("locateFile: (path: string, prefix: string) => (path.endsWith(\".wasm\") ? ZXING_READER_WASM_URL : prefix + path)")
    expect(loader).toContain('await import("barcode-detector/ponyfill")')
  })
  test("no F9 file references an external URL", () => {
    for (const file of F9_FILES) expect(read(file)).not.toMatch(/https?:\/\//)
  })
  test("barcode-detector is only ever loaded lazily (never a static import → no SSR/build side effects)", () => {
    for (const file of sourceFiles) {
      expect(read(file)).not.toMatch(/^import [^\n]*from "barcode-detector/m)
    }
  })
})

describe("F9 — camera lifecycle and SSR safety (static)", () => {
  const scanner = read("src/components/business/barcode-scanner.tsx")
  test("client component; getUserMedia only inside the start function", () => {
    expect(scanner.startsWith('"use client"')).toBe(true)
    const topLevel = scanner.split("\n").filter((l) => /^\S/.test(l)).join("\n")
    expect(topLevel).not.toContain("getUserMedia")
  })
  test("prefers the rear camera, inline playback, releases tracks/timers/listeners", () => {
    expect(scanner).toContain('facingMode: { ideal: "environment" }')
    expect(scanner).toContain("playsInline")
    expect(scanner).toContain("getTracks().forEach((track) => track.stop())")
    expect(scanner).toContain("window.clearTimeout(timerRef.current)")
    expect(scanner).toContain('document.removeEventListener("visibilitychange", onVisibility)')
    expect(scanner).toContain('window.removeEventListener("pagehide", onPageHide)')
    expect(scanner).toContain("return () => stopCamera()")
  })
  test("every analyzed frame (also empty ones) goes through the scan lock", () => {
    expect(scanner).toContain("lockRef.current.observe(keys, performance.now(), { acceptNew })")
  })
})

describe("F9 — Caja reuses the existing cart and checkout", () => {
  const caja = read("src/components/business/caja-tab.tsx")
  test("scans go through addCartLine; the only POST is the existing checkout", () => {
    expect(caja).toContain("const next = addCartLine(cartRef.current, line)")
    expect(caja.match(/method: "POST"/g)?.length).toBe(1)
    expect(caja).toContain('fetch("/api/negocio/caja/ventas", {')
    const handler = caja.slice(caja.indexOf("async function handleScannedCode"), caja.indexOf("function applyScanResolution"))
    expect(handler).not.toContain("fetch(")
  })
  test("exact lookup authority, never the substring search", () => {
    const handler = caja.slice(caja.indexOf("async function handleScannedCode"), caja.indexOf("function applyScanResolution"))
    expect(handler).toContain("resolveScannedBarcode")
    expect(handler).not.toContain("matchesCajaSearch")
  })
  test("the checkout route is untouched by F9 (no barcode logic there)", () => {
    expect(read("src/app/api/negocio/caja/ventas/route.ts")).not.toMatch(/barcode|codigoBarras/i)
  })
})

describe("F9 — duplicate guard wiring (D3)", () => {
  const guard = read("src/lib/barcode-uniqueness.ts")
  test("transaction-scoped advisory lock with a bound parameter inside a Serializable runner (outside R3A's allowlist)", () => {
    expect(guard).toContain("pg_advisory_xact_lock(hashtextextended(${barcodeLockName(negocioId, key)}, 0))")
    expect(guard).not.toMatch(/pg_advisory_lock\(/)
    expect(guard).not.toMatch(/\$executeRawUnsafe|\$queryRawUnsafe/)
    expect(guard).toContain("return runBarcodeSerializable(client, async (tx) => {")
    expect(guard).toContain("isolationLevel: Prisma.TransactionIsolationLevel.Serializable")
    expect(guard).not.toContain("runStockSerializable(")
    expect(guard).not.toContain("@/lib/stock-lifecycle")
    expect(guard).toContain("[...new Set(keys)].sort()")
  })
  test("all 4 write routes normalize and claim through the shared guard", () => {
    for (const route of WRITE_ROUTES) {
      const src = read(route)
      expect(src).toContain("normalizeBarcodeForStorage(")
      expect(src).toContain("runBarcodeGuardedWrite(")
      expect(src).toContain("mapBarcodeWriteError(error)")
      expect(src).not.toContain("codigoBarras || null")
    }
  })
  test("no other route writes codigoBarras", () => {
    const writers = sourceFiles.filter(
      (f) => f.startsWith("src/app/api/") && /codigoBarras\s*:/.test(read(f)) && /\.(create|update|createMany|upsert)\(/.test(read(f))
    )
    const allowed = new Set([...WRITE_ROUTES])
    for (const f of writers) {
      const src = read(f)
      // read-only selects (public catalog, Mozo order lines) declare codigoBarras: true
      if (/codigoBarras\s*:\s*true/.test(src) && !/codigoBarras\s*:\s*(?!true)/.test(src)) continue
      expect(allowed.has(f)).toBe(true)
    }
  })
})

describe("F9 — scope: generic businesses only; Mozo keeps its flow", () => {
  test("the scanner is used only by Caja and Inventario", () => {
    const users = sourceFiles.filter((f) => read(f).includes("barcode-scanner\"") && f !== "src/components/business/barcode-scanner.tsx")
    expect(users.sort()).toEqual(["src/components/business/caja-tab.tsx", "src/components/business/inventario-tab.tsx"])
  })
  test("Caja and Inventario tabs exist only for rubro 'negocio'", () => {
    const panel = read("src/components/business/business-panel.tsx")
    expect(panel).toMatch(/if \(isNegocio\) \{\s*items\.push\(\{ id: "caja"[^\n]*\n\s*items\.push\(\{ id: "inventario"/)
  })
  test("Mozo still uses its own html5-qrcode QR flow with the rear camera", () => {
    const mozo = read("src/app/mozo/[slug]/page.tsx")
    expect(mozo).toContain('import { Html5Qrcode } from "html5-qrcode"')
    expect(mozo).toContain('{ facingMode: "environment" }')
    expect(mozo).not.toContain("barcode-scanner")
  })
})
