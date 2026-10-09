// ============================================
// F10-B2.1 — static contract: registers & shifts single writer, server-side
// attribution, owner-only expected cash, additive migration with invariants
// ============================================
import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

const root = process.cwd()
const read = (p: string) => readFileSync(join(root, p), "utf8").replace(/\r\n/g, "\n")
function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(join(root, dir))) {
    const rel = `${dir}/${entry}`
    if (statSync(join(root, rel)).isDirectory()) out.push(...walk(rel))
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) out.push(rel)
  }
  return out
}
const productive = walk("src").map((path) => ({ path, src: read(path) }))
const writers = (re: RegExp) => productive.filter(({ src }) => re.test(src)).map(({ path }) => path).sort()

const SERVICE = "src/lib/caja-turnos-service.ts"
const ADMIN = "src/lib/caja-turnos-admin.ts"
const ENGINE = "src/lib/caja-venta-service.ts"
const CASHIER_SALE = "src/app/api/operativo/caja/[slug]/ventas/route.ts"
const CASHIER_TURNO = "src/app/api/operativo/caja/[slug]/turno/route.ts"
const OWNER_SALE = "src/app/api/negocio/caja/ventas/route.ts"
const MIGRATION = "prisma/migrations/20261011120000_f10_b2_1_cash_registers_shifts/migration.sql"

describe("F10-B2.1 — single writer of registers and shifts", () => {
  test("only the shifts service creates/updates registers and creates shifts", () => {
    expect(writers(/\.cajaFisica\.(create|createMany|update|updateMany|upsert)\(/)).toEqual([SERVICE])
    expect(writers(/\.turnoCaja\.(create|createMany|upsert)\(/)).toEqual([SERVICE])
  })

  test("no path changes a shift (responsible person / fund are immutable in B2.1) and registers are never deleted", () => {
    expect(writers(/\.turnoCaja\.(update|updateMany|delete|deleteMany)\(/)).toEqual([])
    expect(writers(/\.cajaFisica\.(delete|deleteMany)\(/)).toEqual([])
  })

  test("opening a shift never creates financial operations / ledger legs / inventory movements", () => {
    const src = read(SERVICE)
    expect(src).not.toMatch(/operacionFinanciera|movimientoFinanciero|movimientoInventario|stockCantidad/)
  })

  test("no route can switch the shift-enforcement flag yet (activation is F10-B2.2)", () => {
    expect(writers(/data:\s*\{[^}]*\bcajaTurnosModo\b/)).toEqual([])
  })

  test("concurrency guards: register row lock + state-based mapping of unique violations", () => {
    const src = read(SERVICE)
    expect(src).toContain('FOR UPDATE`')
    expect(src).toContain('fail(409, "Esta caja ya tiene un turno abierto.", "CAJA_CON_TURNO_ABIERTO")')
    expect(src).toContain('"La caja tiene un turno abierto y no se puede desactivar.", "CAJA_CON_TURNO_ABIERTO"')
    expect(src).toContain("skipDuplicates: true")
  })
})

describe("F10-B2.1 — attribution is decided by the server", () => {
  test("cashier sale route: the shift is the employee's OWN open shift, resolved from the session", () => {
    const src = read(CASHIER_SALE)
    expect(src).toContain('const turno = await turnoAbiertoDeActor(db, auth.negocio.id, { tipo: "EMPLEADO", empleadoId: auth.empleado.id })')
    expect(src).toContain("turnoCajaId: turno?.id ?? null,")
    expect(src).not.toMatch(/(?<![.\w])body\.|turnoCajaId:(?!\s*turno\?\.id)/)
  })

  test("owner sale route: only the owner's OWN shift (never an employee's)", () => {
    const src = read(OWNER_SALE)
    expect(src).toContain('const turno = await turnoAbiertoDeActor(db, negocioId, { tipo: "NEGOCIO" })')
    expect(src).toContain("turnoCajaId: turno?.id ?? null,")
  })

  test("engine re-validates the shift inside its transaction and books cash on that register's account", () => {
    const src = read(ENGINE)
    expect(src).toContain("where: { id: turnoCajaId, negocioId, estado: TURNO_ESTADO_ABIERTO, cajaFisicaId: cajaFisicaIdDelTurno!, responsableTipo: actor.tipo, responsableId: actorId },")
    expect(src).toContain("await asegurarCuentaEfectivoCajaFisica(db, negocioId, cajaFisicaIdDelTurno)")
    expect(src).toContain("if (negocio?.cajaTurnosModo === CAJA_TURNOS_MODO_OBLIGATORIO) {")
    expect(src.match(/\n\s+turnoCajaId,\n/g)).toHaveLength(2) // Venta + OperacionFinanciera
    expect(productive.filter(({ src: s }) => /\bturnoCajaId,\n/.test(s) && /\.(venta|operacionFinanciera)\.create\(/.test(s)).map(({ path }) => path)).toEqual([ENGINE])
  })

  test("still ONE sales engine", () => {
    expect(writers(/\b(?:tx|db)\.venta\.create\(/)).toEqual([ENGINE])
  })
})

describe("F10-B2.1 — expected cash is owner-only (blind close F10-B2.2)", () => {
  test("only owner routes import the admin module", () => {
    const importers = writers(/@\/lib\/caja-turnos-admin["']/)
    expect(importers.length).toBeGreaterThan(0)
    for (const path of importers) expect(path.startsWith("src/app/api/negocio/")).toBe(true)
  })

  test("no cashier code (operativo APIs, Operaciones pages, client components) touches expected cash or the ledger", () => {
    const cashier = productive.filter(({ path }) => path.startsWith("src/app/api/operativo/") || path.startsWith("src/app/operaciones/") || path.startsWith("src/components/"))
    for (const { path, src } of cashier) {
      expect({ path, admin: /caja-turnos-admin|calcularEfectivoEsperado|efectivoEsperado|esperado:/.test(src) }).toEqual({ path, admin: false })
    }
    const turno = read(CASHIER_TURNO)
    expect(turno).not.toMatch(/\.(movimientoFinanciero|operacionFinanciera|cuentaFinanciera|venta|cobroVenta)\./)
  })

  test("admin module computes with exact money only", () => {
    const src = read(ADMIN)
    expect(src).toContain("storedMoney(l.importeDecimal, l.importe)")
    expect(src).toContain("turno.fondoInicialDecimal.plus(ingresosEfectivo).minus(salidasEfectivo)")
    expect(src).not.toMatch(/reduce\(\(\w+, \w+\) => \w+ \+ /)
  })
})

describe("F10-B2.1 — additive migration with real PostgreSQL invariants", () => {
  const raw = readFileSync(join(root, MIGRATION))
  const sql = raw.toString("utf8").replace(/--[^\n]*/g, "")

  test("additive only: nothing destructive, no historical rewrite, nothing of R3A", () => {
    expect(sql).not.toMatch(/\bDROP\b|ALTER COLUMN|TRUNCATE|^\s*UPDATE\b|DELETE\s+FROM|SET NOT NULL|reservas_stock|stockReservaModo/im)
  })

  test("the invariants exist in SQL", () => {
    for (const fragment of [
      `CREATE UNIQUE INDEX "turnos_caja_cajaFisicaId_abierto_key" ON "turnos_caja"("cajaFisicaId") WHERE "estado" = 'ABIERTO';`,
      `CREATE UNIQUE INDEX "turnos_caja_empleado_abierto_key" ON "turnos_caja"("negocioId", "empleadoId") WHERE "estado" = 'ABIERTO' AND "empleadoId" IS NOT NULL;`,
      `CREATE UNIQUE INDEX "turnos_caja_negocio_responsable_abierto_key" ON "turnos_caja"("negocioId") WHERE "estado" = 'ABIERTO' AND "responsableTipo" = 'NEGOCIO';`,
      `CREATE UNIQUE INDEX "cajas_fisicas_negocioId_predeterminada_key" ON "cajas_fisicas"("negocioId") WHERE "esPredeterminada" AND "activa";`,
      `CREATE UNIQUE INDEX "cajas_fisicas_negocioId_nombre_ci_key" ON "cajas_fisicas"("negocioId", lower(btrim("nombre")));`,
      `CHECK (NOT "esPredeterminada" OR "activa")`,
      `CHECK ("fondoInicialDecimal" >= 0)`,
      `CHECK ("cajaTurnosModo" IN ('OPCIONAL', 'OBLIGATORIO'))`,
      `FOREIGN KEY ("cajaFisicaId", "negocioId") REFERENCES "cajas_fisicas"("id", "negocioId")`,
      `CREATE UNIQUE INDEX "cuentas_financieras_cajaFisicaId_efectivo_key"`,
      `"fondoInicialDecimal" DECIMAL(12,2) NOT NULL`,
      `ADD COLUMN     "cajaTurnosModo" TEXT NOT NULL DEFAULT 'OPCIONAL'`,
    ]) {
      expect(sql).toContain(fragment)
    }
    expect(sql).toMatch(/"responsableTipo" = 'EMPLEADO' AND "empleadoId" IS NOT NULL AND "responsableId" = "empleadoId"/)
    expect(sql).toMatch(/"responsableTipo" = 'NEGOCIO' AND "empleadoId" IS NULL AND "responsableId" = "negocioId"/)
  })

  test("migration bytes are LF with one final newline (checksum-stable)", () => {
    expect(raw.includes(13)).toBe(false)
    expect(raw.at(-1)).toBe(10)
    expect(raw.at(-2)).not.toBe(10)
  })

  test("no new Float money column: the opening cash is Decimal(12, 2)", () => {
    const schema = read("prisma/schema.prisma")
    const turno = schema.slice(schema.indexOf("model TurnoCaja {"), schema.indexOf("\n}\n", schema.indexOf("model TurnoCaja {")))
    expect(turno).toContain("fondoInicialDecimal    Decimal  @db.Decimal(12, 2)")
    expect(turno).not.toMatch(/\bFloat\b/)
  })
})
