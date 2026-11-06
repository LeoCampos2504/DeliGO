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
const DEVOLUCIONES = "src/lib/caja-devoluciones-service.ts"
const ROUTE = "src/app/api/negocio/caja/ventas/route.ts"
const MIGRATION = "prisma/migrations/20261009120000_f10_b0_sales_idempotency_payments_ledger/migration.sql"

describe("F10-B0 — one sales engine", () => {
  test("only the shared engine creates Venta, CobroVenta and financial operations/movements", () => {
    // Sorted: directory scan order differs between Windows and Linux CI (same exact set).
    const writers = (re: RegExp) => productive.filter(({ src }) => re.test(src)).map(({ path }) => path).sort()
    expect(writers(/\b(?:tx|db)\.venta\.create\(/)).toEqual([ENGINE])
    expect(writers(/\.cobroVenta\.(create|createMany|update|upsert)\(/)).toEqual([ENGINE])
    // F4-A: the sale-return service is the only other ledger writer (DEVOLUCION_VENTA cash refunds).
    expect(writers(/\.operacionFinanciera\.(create|createMany|update|upsert)\(/)).toEqual([DEVOLUCIONES, ENGINE])
    expect(writers(/\.movimientoFinanciero\.(create|createMany|update|upsert)\(/)).toEqual([])
    expect(writers(/\.cuentaFinanciera\.(create|createMany|update|upsert)\(/)).toEqual([DEVOLUCIONES, ENGINE])
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
    // F10-B2.2-A: only cash gets a ledger account, chosen from the resolved
    // physical register after replay and authorization; non-cash gets none.
    expect(engine).toContain('const cuentaEfectivoId = metodoPago !== "EFECTIVO"')
    expect(engine).toContain('tx.cuentaFinanciera.createMany({ data: [{ negocioId, clave: `${CUENTA_EFECTIVO_CAJA_FISICA_PREFIX}${cajaFisicaIdDelTurno}`')
    expect(engine).toContain('tx.cuentaFinanciera.createMany({ data: [{ negocioId, clave: CUENTA_EFECTIVO_CAJA_SIN_ASIGNAR')
    expect(engine).not.toMatch(/MERCADO_PAGO|mercadopago|saldo/i)
    expect(engine).toContain("estadoConciliacion: estadoConciliacionInicial(metodoPago)")
  })
  test("statistics: commercial volume from Venta, money by method from the real cobros (F4-C2), never counted twice", () => {
    const route = read(ROUTE)
    // F4-C2 (operator-authorized 2026-11-06): the money by method no longer
    // groups Venta.total by Venta.metodoPago; it comes from CobroVenta through
    // the single summary helper, which counts each cobro once for its own sale
    // and reads a sale without cobros (pre-F10-B0) as one cobro of its
    // metodoPago. The commercial total keeps summing the sales themselves.
    expect(route).not.toMatch(/v\.metodoPago === metodo/)
    expect(route).toContain("const resumen = resumirCobrosCaja(")
    expect(route).toContain("cobros: cobrosPorVenta.get(v.id) ?? []")
    expect(route).toContain("totalVendido: moneyToNumber(resumen.ventasBrutas),")
    expect(route).toContain("totalEfectivo: moneyToNumber(resumen.cobradoPorMedio.EFECTIVO),")
    // cobros are read in their own query: the sale objects (JSON contract) never carry them
    expect(route).toMatch(/db\.cobroVenta\.findMany\(\{ where: \{ negocioId, ventaId: \{ in: ventasHoy\.map/)
    expect(route).not.toMatch(/include: \{ items: true, cobros/)
    const helper = read("src/lib/caja-resumen-cobros.ts")
    expect(helper).toContain('export const MEDIOS_DINERO_CAJA = ["EFECTIVO", "TRANSFERENCIA", "OTRO"] as const')
    expect(helper).toContain("if (venta.cobros && venta.cobros.length > 0) {")
    expect(helper).toContain("return [{ metodo: venta.metodoPago, importe: storedMoney(venta.totalDecimal, venta.total), legacy: true }]")
    expect(helper).toContain("else noDinero.push(cobro.importe)")
    expect(helper).not.toMatch(/\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(/)
  })
  test("the Caja client sends an Idempotency-Key bound to the attempt", () => {
    const caja = read("src/components/business/caja-tab.tsx")
    expect(caja).toContain('headers: { "Content-Type": "application/json", "Idempotency-Key": key }')
    expect(caja).toContain("const key = resolveAttemptKey(pendingAttempt, canonical) ?? newIdempotencyKey()")
    expect(caja.match(/method: "POST"/g)?.length).toBe(1)
  })
})

describe("F10-B0 — scope limits (no B1/B2/C/D/E, no mixed payments)", () => {
  // F10-B1 (authorized 2026-10-09) replaced the original "no cashier yet" check:
  // the cashier pieces now exist and are verified by f10-b1-static-contract.test.ts;
  // here we keep the invariant that matters for B0 — the cashier route reuses the
  // single engine and never writes sales itself.
  test("the cashier sale route (F10-B1) reuses the single engine", () => {
    const cashier = read("src/app/api/operativo/caja/[slug]/ventas/route.ts")
    expect(cashier).toContain("await registrarVentaCaja(db, {")
    expect(cashier).not.toMatch(/\.venta\.create\(|runStockSerializable\(/)
  })
  // F10-B2.1 (authorized) introduced registers and shifts; the B0 invariant
  // that remains is that the shift of a sale is written only by the single
  // engine (verified in depth by f10-b2-1-static-contract.test.ts).
  test("shifts arrive with F10-B2.1: Venta.turnoCajaId is optional and written only by the engine", () => {
    const schema = read("prisma/schema.prisma")
    expect(schema).toMatch(/model (TurnoCaja|CajaFisica)\b/)
    const venta = schema.slice(schema.indexOf("model Venta {"), schema.indexOf("}", schema.indexOf("model Venta {")))
    expect(venta).toContain("turnoCajaId String?")
    expect(productive.filter(({ src }) => /\bturnoCajaId,\r?\n/.test(src) && /\.venta\.create\(/.test(src)).map(({ path }) => path)).toEqual([ENGINE])
  })
  test("the checkout still takes exactly one payment method", () => {
    const caja = read("src/components/business/caja-tab.tsx")
    expect(caja).toContain("onConfirm: (metodo: MetodoPagoVenta) => void")
    expect(caja).toContain("body: JSON.stringify({ metodoPago, items,")
    expect(caja).toContain("cajaFisicaId: requestCajaFisicaId")
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
