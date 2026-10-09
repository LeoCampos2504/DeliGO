// ============================================
// F10-B2.0 — static contract: exact money, single writer, additive migration, Caja origin protection
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
const ENGINE = "src/lib/caja-venta-service.ts"
const OWNER_ROUTE = "src/app/api/negocio/caja/ventas/route.ts"
const MONEY = "src/lib/money.ts"
const MIGRATION_DIR = "20261010120000_f10_b2_0_money_decimal_columns"
const MIGRATION = `prisma/migrations/${MIGRATION_DIR}/migration.sql`

describe("F10-B2.0 — single writer of the exact money columns", () => {
  test("only the shared Caja engine writes totalDecimal / subtotalDecimal / importeDecimal", () => {
    const writers = productive.filter(({ src }) => /\b(totalDecimal|subtotalDecimal|importeDecimal):(?!\s*true\b)/.test(src)).map(({ path }) => path)
    expect(writers).toEqual([ENGINE])
  })

  test("the engine dual-writes every money row from ONE exact computation", () => {
    const src = read(ENGINE)
    expect(src).toContain("importes = saleAmountsExact(computed.items)")
    expect(src).toContain("total: moneyToNumber(totalExacto),\n          totalDecimal: totalExacto,")
    expect(src).toContain("subtotal: moneyToNumber(importes.subtotales[index]),\n              subtotalDecimal: importes.subtotales[index],")
    expect(src).toContain("importe: moneyToNumber(totalExacto),\n          importeDecimal: totalExacto,")
    expect(src).toContain("importe: moneyToNumber(totalExacto), importeDecimal: totalExacto")
    // the old float-derived values are no longer written
    expect(src).not.toMatch(/total:\s*computed\.total|subtotal:\s*item\.subtotal|importe:\s*venta\.total/)
    expect(src).toContain("IMPORTE_FUERA_DE_RANGO")
  })

  test("still ONE sales engine (owner + cashier delegate; nobody else creates Venta)", () => {
    expect(productive.filter(({ src }) => /\b(?:tx|db)\.venta\.create\(/.test(src)).map(({ path }) => path)).toEqual([ENGINE])
    expect(read(OWNER_ROUTE)).toContain("await registrarVentaCaja(db, {")
    expect(read("src/app/api/operativo/caja/[slug]/ventas/route.ts")).toContain("await registrarVentaCaja(db, {")
  })

  test("money helpers are server-only (never imported by client components)", () => {
    const clientImporters = productive.filter(({ src }) => /^["']use client["']/m.test(src) && /@\/lib\/money["']/.test(src)).map(({ path }) => path)
    expect(clientImporters).toEqual([])
    expect(read(MONEY)).toContain('import { Prisma } from "@prisma/client"')
  })

  test("the Caja line rule is the previous one; accumulation is exact", () => {
    const src = read(MONEY)
    expect(src).toContain("const cents = Math.round(precio * cantidad * 100)")
    expect(src).toContain("return new Prisma.Decimal(cents).dividedBy(100)")
    expect(src).toContain("subtotales = lines.map((l) => lineSubtotalCaja(l.precio, l.cantidad))")
    expect(src).toContain("return { subtotales, total: addMoney(...subtotales) }")
  })
})

describe("F10-B2.0 — owner JSON contract and exact summary", () => {
  test("every owner response strips the Decimal columns (no Prisma Decimal objects to the client)", () => {
    const src = read(OWNER_ROUTE)
    expect(src).toContain("ventasHoy: ventasHoy.map(ventaCajaParaRespuesta)")
    expect(src).toContain("NextResponse.json(ventaCajaParaRespuesta(result.venta), { status: 200,")
    expect(src).toContain("NextResponse.json(ventaCajaParaRespuesta(result.venta), { status: 201 })")
    expect(src).not.toMatch(/NextResponse\.json\(result\.venta/)
  })

  test("the daily summary sums exact amounts, never floats", () => {
    const src = read(OWNER_ROUTE)
    expect(src).toContain("addMoney(...ventasHoy.filter((v) => !metodo || v.metodoPago === metodo).map((v) => storedMoney(v.totalDecimal, v.total)))")
    expect(src).not.toMatch(/reduce\(\(sum, v\) => sum \+ v\.total/)
  })

  test("the cashier response stays an explicit allowlist (no Decimal columns)", () => {
    const helpers = read("src/lib/operativo-caja.ts")
    expect(helpers).not.toMatch(/Decimal/)
  })
})

describe("F10-B2.0 — additive migration", () => {
  test("only ADD COLUMN NUMERIC(12,2) nullable + guarded backfill of NULLs; nothing destructive", () => {
    const sql = read(MIGRATION).replace(/--[^\n]*/g, "")
    const statements = sql.split(";").map((s) => s.trim()).filter(Boolean)
    expect(statements).toHaveLength(8)
    const adds = statements.filter((s) => /^ALTER TABLE/.test(s))
    expect(adds).toHaveLength(4)
    for (const s of adds) expect(s).toMatch(/^ALTER TABLE "\w+" ADD COLUMN\s+"(totalDecimal|subtotalDecimal|importeDecimal)" DECIMAL\(12,2\)$/)
    const updates = statements.filter((s) => /^UPDATE/.test(s))
    expect(updates).toHaveLength(4)
    for (const s of updates) {
      expect(s).toMatch(/SET "(totalDecimal|subtotalDecimal|importeDecimal)" = ROUND\("(total|subtotal|importe)"::numeric, 2\)/)
      expect(s).toMatch(/WHERE "\w+" IS NULL AND abs\("\w+"\) < 9999999999\.995$/)
    }
    expect(sql).not.toMatch(/\bDROP\b|ALTER COLUMN|SET NOT NULL|TRUNCATE|DELETE\s+FROM|reservas_stock|stockReservaModo|stockCantidad|movimientos_inventario/i)
  })

  test("migration file bytes are LF with one final newline (checksum-stable across checkouts)", () => {
    const raw = readFileSync(join(root, MIGRATION))
    expect(raw.includes(13)).toBe(false)
    expect(raw.at(-1)).toBe(10)
    expect(raw.at(-2)).not.toBe(10)
  })

  test("schema: the 4 new columns are optional Decimal(12, 2); legacy Float columns kept", () => {
    const schema = read("prisma/schema.prisma")
    expect(schema).toContain("totalDecimal  Decimal? @db.Decimal(12, 2)")
    expect(schema).toContain("importeDecimal     Decimal? @db.Decimal(12, 2)")
    expect(schema).toContain("importeDecimal Decimal? @db.Decimal(12, 2)")
    expect(schema).toContain("subtotalDecimal    Decimal? @db.Decimal(12, 2)")
    expect(schema).toMatch(/total\s+Float\n/)
    expect(schema).toMatch(/subtotal\s+Float\n/)
  })

  test("the applied F10-B0 migration was not edited again", () => {
    const b0 = readFileSync(join(root, "prisma/migrations/20261009120000_f10_b0_sales_idempotency_payments_ledger/migration.sql"))
      .toString("utf8")
      .replace(/\r\n/g, "\n")
    // versioned blob = 5631 bytes, sha256 51625d5d… (documented in F10-B1 §2)
    expect(Buffer.byteLength(b0)).toBe(5631)
  })
})

describe("F10-B2.0 — Caja origin protection", () => {
  test("/api/negocio/caja is under the existing owner origin allowlist; no second CSRF implementation", () => {
    const proxy = read("src/proxy.ts")
    const block = proxy.slice(proxy.indexOf("const NEGOCIO_ORIGIN_PROTECTED_PREFIXES = ["), proxy.indexOf("]", proxy.indexOf("const NEGOCIO_ORIGIN_PROTECTED_PREFIXES = [")))
    expect(block).toContain('"/api/negocio/caja",')
    expect(proxy).toContain('"/api/operativo",')
    expect(proxy).toContain("const originError = validateMutationOrigin(request)")
    expect(productive.filter(({ src }) => /function validateMutationOrigin/.test(src)).map(({ path }) => path)).toEqual(["src/lib/request-security.ts"])
  })
})
