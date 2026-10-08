// ============================================
// P2-T56-R3A-I5-P0 — contrato estático del controlador de modos
// ============================================
// Fija que:
//  1. el modo sólo se escribe en cambiarModoReservaStock (un único CAS);
//  2. ROLLBACK sólo lo asigna liberarReservasPorRollback; ReservaStock nunca se borra;
//  3. los comandos no se ejecutan al importarse ni forman parte de start/build/cron;
//  4. sólo TESTING está habilitado para los comandos;
//  5. el módulo de comandos no importa la base ni toca tablas de reservas directamente.
import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync, statSync } from "fs"
import { join } from "path"

const ROOT = join(import.meta.dir, "..", "..")
const read = (path: string) => readFileSync(join(ROOT, path), "utf8").replace(/\r\n/g, "\n")
const LIFECYCLE = read("src/lib/stock-lifecycle.ts")
const OPS = read("src/lib/stock-reservation-ops.ts")
const MODE_SCRIPT = read("scripts/stock-reservation-mode.ts")
const ROLLBACK_SCRIPT = read("scripts/stock-reservation-rollback.ts")

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${name}`
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out)
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) && !/-test-fake\.ts$/.test(name)) out.push(rel)
  }
  return out
}
const productive = [...walk("src"), ...walk("scripts")].map((path) => ({ path, src: read(path) }))

function bodyOf(src: string, signature: string): string {
  const start = src.indexOf(signature)
  if (start < 0) throw new Error(`no se encontró ${signature}`)
  const next = src.indexOf("\nexport ", start + signature.length)
  return src.slice(start, next < 0 ? undefined : next)
}

describe("I5-P0 — escritura del modo", () => {
  test("configPlataforma.update* aparece una sola vez en la autoridad, dentro de cambiarModoReservaStock", () => {
    expect(LIFECYCLE.match(/configPlataforma\.update/g)).toHaveLength(1)
    expect(bodyOf(LIFECYCLE, "export async function cambiarModoReservaStock(")).toContain("tx.configPlataforma.updateMany(")
  })

  test("el CAS compara id + modo + updatedAt y el AuditLog va en la misma función", () => {
    const body = bodyOf(LIFECYCLE, "export async function cambiarModoReservaStock(")
    expect(body).toMatch(/where: \{ id: config\.id, stockReservaModo: current, updatedAt: config\.updatedAt \}/)
    expect(body.indexOf("tx.auditLog.create(")).toBeGreaterThan(body.indexOf("tx.configPlataforma.updateMany("))
  })

  test("ningún otro archivo productivo escribe stockReservaModo", () => {
    const writers = productive
      .filter(({ path }) => path !== "src/lib/stock-lifecycle.ts")
      .filter(({ src }) => /stockReservaModo\s*:\s*[^}\n]*(ON|OFF|DRAINING|request|data)/.test(src) && /configPlataforma\.(update|upsert|create)/.test(src))
      .map(({ path }) => path)
    expect(writers).toEqual([])
  })
})

describe("I5-P0 — recuperación", () => {
  test('motivoLiberacion: "ROLLBACK" sólo en liberarReservasPorRollback', () => {
    const hits = productive.filter(({ src }) => src.includes('motivoLiberacion: "ROLLBACK"')).map(({ path }) => path)
    expect(hits).toEqual(["src/lib/stock-lifecycle.ts"])
    expect(LIFECYCLE.match(/motivoLiberacion: "ROLLBACK"/g)).toHaveLength(1)
    expect(bodyOf(LIFECYCLE, "export async function liberarReservasPorRollback(")).toContain('motivoLiberacion: "ROLLBACK"')
  })

  test("ReservaStock nunca se borra en código productivo", () => {
    const hits = productive.filter(({ src }) => /reservaStock\.delete/.test(src)).map(({ path }) => path)
    expect(hits).toEqual([])
  })

  test("la recuperación exige DRAINING y pedido cancelado", () => {
    const src = LIFECYCLE
    expect(src).toContain('if (mode !== "DRAINING") problems.push("MODE_NOT_DRAINING")')
    expect(src).toContain('if (p.estado !== "cancelado") return { ...base, action: "REJECT", reason: "PEDIDO_NOT_CANCELLED_USE_NORMAL_FLOW" }')
  })
})

describe("I5-P0 — comandos internos", () => {
  test("los scripts sólo corren como proceso principal (import.meta.main) y usan las dependencias reales vía el módulo de comandos", () => {
    for (const script of [MODE_SCRIPT, ROLLBACK_SCRIPT]) {
      expect(script).toContain("if (import.meta.main) {")
      const imports = [...script.matchAll(/from "([^"]+)"/g)].map((m) => m[1]).sort()
      expect(imports).toEqual(["@/lib/db", "@/lib/stock-lifecycle", "@/lib/stock-reservation-ops"])
    }
  })

  test("no forman parte de start/build/scripts de package.json ni los importa ningún archivo productivo", () => {
    const pkg = read("package.json")
    expect(pkg).not.toContain("stock-reservation-mode")
    expect(pkg).not.toContain("stock-reservation-rollback")
    const importers = productive
      .filter(({ src }) => /(from|import)\s*\(?\s*["'][^"']*scripts\/stock-reservation-(mode|rollback)/.test(src))
      .map(({ path }) => path)
    expect(importers).toEqual([])
  })

  test("el módulo de comandos no importa la base ni toca tablas de reservas/config directamente", () => {
    expect(OPS).not.toContain('"@/lib/db"')
    expect(OPS).not.toMatch(/\.reservaStock\b|\.configPlataforma\b|stockReservaModo/)
    expect(OPS).toMatch(/STOCK_RESERVATION_OPS_ENVIRONMENTS[^=]*= Object\.freeze\(\{\n\s+TESTING: "[0-9a-f]{12}",\n\}\)/)
  })

  test("dry-run por defecto: sin --execute el comando devuelve antes de cualquier runSerializable", () => {
    for (const fn of ["export async function runStockModeCommand(", "export async function runStockRollbackCommand("]) {
      const body = bodyOf(OPS, fn)
      expect(body.indexOf('if (!execute) return')).toBeGreaterThan(-1)
      expect(body.indexOf('if (!execute) return')).toBeLessThan(body.indexOf("deps.runSerializable("))
    }
  })
})
