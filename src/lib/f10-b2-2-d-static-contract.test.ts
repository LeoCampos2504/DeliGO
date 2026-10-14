import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), "utf8")
const migration = read("prisma/migrations/20261013130000_f10_b2_2_d_cash_shift_review/migration.sql")

describe("F10-B2.2-D — administrative review boundaries", () => {
  test("only owner authenticated routes expose the closed-shift figures", () => {
    for (const path of [
      "src/app/api/negocio/caja/turnos/cerrados/route.ts",
      "src/app/api/negocio/caja/turnos/[id]/revisiones/route.ts",
    ]) expect(read(path)).toContain("requireNegocioCajaGenerico")
    expect(read("src/app/api/operativo/caja/[slug]/turno/route.ts")).not.toMatch(/efectivoEsperado|diferencia|caja-turnos-admin/)
  })

  test("review service appends snapshots and has no update/delete path", () => {
    const service = read("src/lib/caja-turnos-revision.ts")
    expect(service).toContain("tx.revisionTurnoCaja.create(")
    expect(service).not.toMatch(/revisionTurnoCaja\.(update|updateMany|delete|deleteMany)\(/)
    expect(service).toContain("Prisma.TransactionIsolationLevel.Serializable")
    expect(service).toContain("IDEMPOTENCY_KEY_REUSED")
  })

  test("migration preserves old closures, snapshots expected cash, and prevents event updates", () => {
    expect(migration).toContain("UPDATE \"turnos_caja\" AS t")
    expect(migration).toContain("CREATE TRIGGER \"turnos_caja_efectivo_esperado_snapshot_trigger\"")
    expect(migration).toContain("CREATE TRIGGER \"revisiones_turnos_caja_immutable_update_trigger\"")
    expect(migration).toContain("NEW.\"efectivoContadoDecimal\" IS DISTINCT FROM OLD.\"efectivoContadoDecimal\"")
    expect(migration).not.toMatch(/\bDROP\b|TRUNCATE|DELETE\s+FROM|operaciones_financieras\"\s*\)/i)
  })
})
