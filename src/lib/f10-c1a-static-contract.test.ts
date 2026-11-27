// ============================================
// F10-C1a — static contract: cash outflows (no database)
// ============================================
import { describe, expect, test } from "bun:test"
import { readFileSync, readdirSync, statSync } from "node:fs"
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
const writers = (re: RegExp) => productive.filter(({ src }) => re.test(src)).map(({ path }) => path).sort()

const SERVICE = "src/lib/caja-egresos-service.ts"
const HTTP = "src/lib/caja-egresos-http.ts"
const CASHIER_ROUTE = "src/app/api/operativo/caja/[slug]/egresos/route.ts"
const OWNER_ROUTE = "src/app/api/negocio/caja/egresos/route.ts"
const MIGRATION = "prisma/migrations/20261118120000_f10_c1a_cash_outflows/migration.sql"
const SNAPSHOT = "src/lib/caja-turnos-snapshot.ts"

describe("F10-C1a — one writer, session-derived actor", () => {
  test("only the outflow service writes outflows, their history and their ledger operations", () => {
    expect(writers(/\.egresoCaja\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(/)).toEqual([SERVICE])
    expect(writers(/\.revisionEgresoCaja\.(create|createMany|update|upsert)\(/)).toEqual([SERVICE])
    // F10-C1c (operator-authorized 2026-11-18, local): the outflow service is the ONE writer of
    // compensations and of their REVERSION operation (owner reports only read them).
    expect(writers(/\.compensacionEgresoCaja\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(/)).toEqual([SERVICE])
    expect(writers(/revierteOperacionId:/)).toEqual([SERVICE])
    expect(read(SERVICE)).toContain('export const TIPO_OPERACION_COMPENSACION = "REVERSION"')
  })

  test("routes derive the actor from the session; the body never chooses business, actor or (cashier) shift", () => {
    const cashier = read(CASHIER_ROUTE)
    expect(cashier).toContain('resolveOperativoAreaForSlug(req, slug, "caja")')
    expect(cashier).toContain('{ tipo: "EMPLEADO", empleadoId: auth.empleado.id }')
    const owner = read(OWNER_ROUTE)
    expect(owner).toContain("requireNegocioCajaGenerico(req)")
    expect(owner).toContain('{ tipo: "NEGOCIO" }')
    for (const src of [cashier, owner, read(HTTP)]) expect(src).not.toMatch(/body\??\.(empleadoId|actorTipo|actorId|negocioId|turnoCajaId)/)
    const service = read(SERVICE)
    // A cashier can never send a register or a justification.
    expect(service).toContain('return fail(400, "Datos no válidos para registrar una salida de efectivo.", "CAMPOS_NO_PERMITIDOS")')
    expect(service).toContain('actor.tipo === "NEGOCIO" ? s.cajaFisicaId : null')
  })

  test("R1: every outflow / review / confirmation / threshold audit is written with the transaction client", () => {
    const http = read(HTTP)
    expect(http).not.toMatch(/\bauditLog\(/)
    // F10-C1c: + the compensation audit (4 in total).
    // F10-D1: + the conciliation, the recovery and the F5 supplier-adjustment audits (7 in total).
    expect(http.match(/await auditLogWithClient\(tx, \{/g)).toHaveLength(7)
    for (const accion of ["caja.egreso_registrado", "caja.egreso_revisado", "caja.egreso_retiro_confirmado", "caja.egreso_compensado", "caja.egreso_conciliado", "caja.egreso_recuperado", "negocio.config_cambiada"]) expect(http).toContain(accion)
    const service = read(SERVICE)
    expect(service.match(/if \(opciones\.auditar\) await opciones\.auditar\(tx, /g)).toHaveLength(4)
  })
})

describe("F10-C1a — blind close is preserved", () => {
  test("the cashier route and cashier view carry no expected cash, alerts or totals", () => {
    const sinComentarios = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
    expect(sinComentarios(read(CASHIER_ROUTE))).not.toMatch(/esperado|alerta|excede|umbral|justific|diferencia|total/i)
    const service = read(SERVICE)
    const vista = service.slice(service.indexOf("export function egresoParaCajero"), service.indexOf("export interface FiltroEgresos"))
    expect(vista.length).toBeGreaterThan(100)
    expect(sinComentarios(vista)).not.toMatch(/esperado|alerta|excede|umbral|justific|diferencia|total/i)
    // The owner-only figures of JUSTIFICACION_REQUERIDA are never forwarded to a cashier.
    expect(read(HTTP)).toContain('const detalle = actor.tipo === "NEGOCIO" && r.detalle ? { detalle: r.detalle } : {}')
  })

  test("the expected-cash formula is untouched: fund + every leg of the register's cash account attributed to the shift", () => {
    const snapshot = read(SNAPSHOT)
    expect(snapshot).toContain('where: { negocioId, cuentaId: cuenta.id, operacion: { turnoCajaId: turno.id, negocioId } }')
    expect(snapshot).not.toMatch(/tipo:\s*["'](VENTA_COBRO|DEVOLUCION_VENTA|GASTO|PAGO_PROVEEDOR|RETIRO_DUENO)["']/)
    expect(snapshot).toContain("esperado: turno.fondoInicialDecimal.plus(ingresosEfectivo).minus(salidasEfectivo)")
  })
})

describe("F10-C1a — additive migration with SQL guards", () => {
  const migration = read(MIGRATION)
  test("additive only: no DROP / TRUNCATE / DELETE / UPDATE of existing data; one new optional column", () => {
    expect(migration).not.toMatch(/\bDROP\s+(TABLE|COLUMN|CONSTRAINT|INDEX|TRIGGER|FUNCTION)\b|\bTRUNCATE\b|\bDELETE\s+FROM\b|^\s*UPDATE\s+"/im)
    expect(migration.match(/ALTER TABLE "negocios" ADD COLUMN/g)).toHaveLength(1)
    expect(migration).toContain('ADD COLUMN     "cajaEgresoAvisoUmbralDecimal" DECIMAL(12,2);')
    for (const tabla of ["egresos_caja", "revisiones_egresos_caja", "compensaciones_egresos_caja"]) expect(migration).toContain(`CREATE TABLE "${tabla}"`)
  })

  test("natures, cash-only medium, open shift, exact leg, exact snapshot, immutability and prepared compensations are enforced in SQL", () => {
    for (const fragmento of [
      `CHECK ("naturaleza" IN ('GASTO', 'PAGO_PROVEEDOR', 'RETIRO_DUENO'))`,
      `CHECK ("medio" = 'EFECTIVO')`,
      "RAISE EXCEPTION 'cash outflow requires an open shift'",
      "RAISE EXCEPTION 'cash outflow operation must have exactly one movement'",
      "RAISE EXCEPTION 'cash outflow expected-cash snapshot is inconsistent'",
      "RAISE EXCEPTION 'cash outflow is immutable'",
      "RAISE EXCEPTION 'cash outflow movement is immutable'",
      "RAISE EXCEPTION 'cash outflow review requires its history row'",
      "RAISE EXCEPTION 'cash outflow withdrawal confirmation already registered'",
      "RAISE EXCEPTION 'cash outflow reversion cannot change a closed shift'",
      "RAISE EXCEPTION 'cash outflow compensation cannot change a closed shift'",
      `("momento" = 'POSTERIOR_AL_CIERRE' AND "turnoCajaId" IS NULL)`,
      `CREATE UNIQUE INDEX "revisiones_egresos_caja_una_confirmacion_idx"`,
    ]) expect(migration).toContain(fragmento)
    // Internal transfers are NOT outflows (F10-D/E).
    expect(migration).not.toMatch(/'TRANSFERENCIA_INTERNA'/)
  })
})
