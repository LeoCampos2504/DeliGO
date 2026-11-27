/// <reference types="bun-types" />
// F10-D1 — static contract: additive migration (the historical block stays), owner-only routes, no shift-less
// reversion, the conciliation never creates money, the cashier view gains nothing.
import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const root = join(import.meta.dir, "..", "..")
const read = (p: string) => readFileSync(join(root, p), "utf8").replace(/\r\n/g, "\n")
const MIGRATION = "prisma/migrations/20261127120000_f10_d1_conciliacion_recupero_egresos/migration.sql"
const BLOQUEO = "prisma/migrations/20261118150000_f10_c1c_block_post_close_compensation/migration.sql"
const SERVICE = "src/lib/caja-egresos-correccion-service.ts"

describe("F10-D1 — static contract", () => {
  test("the post-close compensation block of 20261118150000 stays in force and is not replaced", () => {
    const bloqueo = read(BLOQUEO)
    expect(bloqueo).toContain("RAISE EXCEPTION 'cash outflow compensation after the close is blocked until the closing reconciliation';")
    expect(bloqueo).toContain("IF NEW.\"momento\" = 'POSTERIOR_AL_CIERRE' THEN")
    const m = read(MIGRATION)
    expect(m).not.toMatch(/CREATE OR REPLACE/i)
    expect(m).not.toMatch(/\b(DROP|TRUNCATE|DELETE FROM|UPDATE ")/i)
    for (const existente of ["guard_operacion_egreso_caja", "guard_compensacion_egreso_caja", "guard_movimiento_egreso_caja", "guard_egreso_caja\"", "guard_credito_f5a", "guard_obligacion_f5a"]) expect(m).not.toContain(existente)
    // Only the two NEW tables are altered.
    for (const [, tabla] of m.matchAll(/ALTER TABLE "([a-z_]+)"/g)) expect(["conciliaciones_egresos_caja", "recuperos_egresos_caja"]).toContain(tabla)
  })

  test("conciliation never creates money; recovery is ONE positive leg in an OPEN shift; never a REVERSION", () => {
    const s = read(SERVICE)
    expect(s.match(/operacionFinanciera\.create\(/g)).toHaveLength(1)
    const conciliar = s.slice(s.indexOf("export async function conciliarEgresoCerrado"), s.indexOf("export function solicitudRecupero"))
    expect(conciliar).not.toMatch(/operacionFinanciera|movimientoFinanciero|cuentaEfectivoCaja/)
    expect(s).not.toContain('"REVERSION"')
    expect(s).toContain("tipo: TIPO_OPERACION_RECUPERO_EGRESO")
    // Recovery lock order: receiving register row first, then the outflow row (no second register lock).
    const recupero = s.slice(s.indexOf("export async function registrarRecuperoEgreso"))
    expect(recupero.indexOf("lockCaja(tx, negocioId, cajaFisicaId)")).toBeLessThan(recupero.indexOf("bloquearEgreso(tx, negocioId, egresoId, true)"))
    const m = read(MIGRATION)
    expect(m).toContain("CREATE CONSTRAINT TRIGGER \"operaciones_financieras_recupero_egreso_completa_trigger\"")
    expect(m).toContain("DEFERRABLE INITIALLY DEFERRED")
    expect(m).toContain("'cash outflow conciliation exceeds the closed shift surplus'")
    expect(m).toContain("'cash outflow corrections exceed the outflow amount'")
  })

  test("owner-only routes; the cashier view and cashier routes gain nothing", () => {
    for (const r of ["conciliacion", "recupero"]) {
      const route = read(`src/app/api/negocio/caja/egresos/[id]/${r}/route.ts`)
      expect(route).toContain("const auth = await requireNegocioCajaGenerico(req)")
      expect(route).toContain("auth.negocioId")
    }
    const egresos = read("src/lib/caja-egresos-service.ts")
    const cajero = egresos.slice(egresos.indexOf("export function egresoParaCajero"), egresos.indexOf("export interface FiltroEgresos"))
    expect(cajero).not.toMatch(/correccion|conciliac|recuper/i)
    const http = read("src/lib/caja-egresos-http.ts")
    expect(http).not.toMatch(/body\??\.(empleadoId|actorTipo|actorId|negocioId|turnoCajaId|cajaFisicaId)/)
  })
})
