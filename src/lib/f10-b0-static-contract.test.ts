// ============================================
// F10-B0 — static contract: single sale engine, scope limits, additive schema
// ============================================
import { describe, expect, test } from "bun:test"
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

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
const productive = walk("src").map((path) => ({ path, src: read(path) }))
const ENGINE = "src/lib/caja-venta-service.ts"
const ROUTE = "src/app/api/negocio/caja/ventas/route.ts"
const MIGRATION = "prisma/migrations/20261009120000_f10_b0_sales_idempotency_payments_ledger/migration.sql"

describe("F10-B0 — one sales engine", () => {
  test("only the shared engine creates Venta, CobroVenta and financial operations/movements", () => {
    const writers = (re: RegExp) => productive.filter(({ src }) => re.test(src)).map(({ path }) => path)
    expect(writers(/\b(?:tx|db)\.venta\.create\(/)).toEqual([ENGINE])
    expect(writers(/\.cobroVenta\.(create|createMany|update|upsert)\(/)).toEqual([ENGINE])
    expect(writers(/\.operacionFinanciera\.(create|createMany|update|upsert)\(/)).toEqual([ENGINE])
    expect(writers(/\.movimientoFinanciero\.(create|createMany|update|upsert)\(/)).toEqual([])
    expect(writers(/\.cuentaFinanciera\.(create|createMany|update|upsert)\(/)).toEqual([ENGINE])
  })
  test("the owner route delegates to the engine with the session actor; body never chooses the actor", () => {
    const route = read(ROUTE)
    expect(route).toContain("await registrarVentaCaja(db, {")
    expect(route).toContain('actor: { tipo: "NEGOCIO" },')
    expect(route).not.toMatch(/body\.(empleadoId|actorTipo|actorId)|empleadoId:\s*body/)
    expect(route).toContain('readIdempotencyKey(req)')
  })
  test("ledger: only cash enters it, in the system cash account; no Mercado Pago account or balance", () => {
    const engine = read(ENGINE)
    expect(engine).toContain('export const CUENTA_EFECTIVO_CAJA_SIN_ASIGNAR = "efectivo_caja_sin_asignar"')
    expect(engine).toContain('const cuentaEfectivoId = metodoPago === "EFECTIVO" ? await asegurarCuentaEfectivoCaja(db, negocioId) : null')
    expect(engine).not.toMatch(/MERCADO_PAGO|mercadopago|saldo/i)
    expect(engine).toContain("estadoConciliacion: estadoConciliacionInicial(metodoPago)")
  })
  test("statistics keep reading Venta (no double counting through cobros)", () => {
    const route = read(ROUTE)
    expect(route).toContain('totalEfectivo: round(ventasHoy.filter((v) => v.metodoPago === "EFECTIVO")')
    expect(route).not.toMatch(/cobroVenta|cobros/)
  })
  test("the Caja client sends an Idempotency-Key bound to the attempt", () => {
    const caja = read("src/components/business/caja-tab.tsx")
    expect(caja).toContain('headers: { "Content-Type": "application/json", "Idempotency-Key": key }')
    expect(caja).toContain("const key = resolveAttemptKey(pendingAttempt, canonical) ?? newIdempotencyKey()")
    expect(caja.match(/method: "POST"/g)?.length).toBe(1)
  })
})

describe("F10-B0 — scope limits (no B1/B2/C/D/E, no mixed payments)", () => {
  test("no cashier area, route or page yet (F10-B1)", () => {
    expect(read("src/lib/area-operativa.ts")).not.toMatch(/"caja"/)
    expect(existsSync(join(root, "src/app/api/operativo/caja"))).toBe(false)
    expect(existsSync(join(root, "src/app/operaciones/mi-panel/[slug]/caja"))).toBe(false)
  })
  test("no shifts or physical registers yet (F10-B2): no models, no Venta.turnoId", () => {
    const schema = read("prisma/schema.prisma")
    expect(schema).not.toMatch(/model (TurnoCaja|CajaFisica)\b/)
    const venta = schema.slice(schema.indexOf("model Venta {"), schema.indexOf("}", schema.indexOf("model Venta {")))
    expect(venta).not.toMatch(/turnoId/)
  })
  test("the checkout still takes exactly one payment method", () => {
    const caja = read("src/components/business/caja-tab.tsx")
    expect(caja).toContain("onConfirm: (metodo: MetodoPagoVenta) => void")
    expect(caja).toContain("body: JSON.stringify({ metodoPago, items })")
  })
})

describe("F10-B0 — additive migration", () => {
  test("only CREATE / ADD COLUMN / indexes / FKs on new columns — no drops, rewrites or data changes", () => {
    const sql = read(MIGRATION)
    const statements = sql.replace(/--[^\n]*/g, "").split(";").map((s) => s.trim()).filter(Boolean)
    for (const st of statements) {
      expect({ st: st.slice(0, 60), ok: /^(CREATE TABLE|CREATE (UNIQUE )?INDEX|ALTER TABLE "\w+" ADD (COLUMN|CONSTRAINT))/.test(st) }).toEqual({ st: st.slice(0, 60), ok: true })
      expect(st).not.toMatch(/\bDROP\b|ALTER COLUMN|SET NOT NULL|\bUPDATE\s+"|\bDELETE\s+FROM|TRUNCATE/i)
    }
    expect(sql).toContain('ALTER TABLE "ventas_caja" ADD COLUMN     "actorId" TEXT,')
    expect(sql).not.toMatch(/"ventas_caja"[^;]*NOT NULL/)
  })
})
