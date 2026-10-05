// ============================================
// P2-T56-R3A-I1 — contrato de schema, migración y "sin cambio de runtime"
// ============================================
// I1-P … I1-T + garantías de I1: la tabla existe pero ningún runtime la usa,
// el modo default es OFF y la migración es estrictamente aditiva.
import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync, statSync } from "fs"
import { join } from "path"
import { MOVIMIENTO_TIPOS, MOVIMIENTO_TIPO_PEDIDO, MOVIMIENTO_TIPOS_PERSISTIBLES, isValidMovimientoTipo } from "./inventario"

const ROOT = process.cwd()
const read = (path: string) => readFileSync(join(ROOT, path), "utf8").replace(/\r\n/g, "\n")
const schema = read("prisma/schema.prisma")
const MIGRATION_DIR = "prisma/migrations/20261005120000_add_order_stock_reservations_base_p2_t56_r3a_i1"
const migration = read(`${MIGRATION_DIR}/migration.sql`)

function modelBlock(name: string): string {
  const start = schema.indexOf(`model ${name} {`)
  expect(start).toBeGreaterThanOrEqual(0)
  return schema.slice(start, schema.indexOf("\n}", start) + 2)
}
const squash = (s: string) => s.replace(/\s+/g, " ")

describe("I1-P — model ReservaStock (A0.1-17)", () => {
  const block = squash(modelBlock("ReservaStock"))

  test("campos con los tipos/nulabilidad del modelo final", () => {
    for (const field of [
      "id String @id @default(cuid())",
      "negocioId String",
      "pedidoId String",
      "pedidoItemId String",
      "productoId String?",
      "productoVarianteId String?",
      "cantidad Float",
      "estado String",
      "motivoLiberacion String?",
      "createdAt DateTime @default(now())",
      "consumidaEn DateTime?",
      "liberadaEn DateTime?",
    ]) {
      expect(block).toContain(field)
    }
  })

  test("FKs y semántica de borrado (A0.1-8)", () => {
    expect(block).toContain("negocio Negocio @relation(fields: [negocioId], references: [id], onDelete: Cascade)")
    expect(block).toContain("pedido Pedido @relation(fields: [pedidoId], references: [id], onDelete: NoAction)")
    expect(block).toContain("pedidoItem PedidoItem @relation(fields: [pedidoItemId], references: [id], onDelete: NoAction)")
    expect(block).toContain("producto Producto? @relation(fields: [productoId], references: [id], onDelete: SetNull)")
    expect(block).toContain("productoVariante ProductoVariante? @relation(fields: [productoVarianteId], references: [id], onDelete: SetNull)")
  })

  test("unique + índices multi-tenant (A0.1-7) + tabla reservas_stock", () => {
    expect(block).toContain("@@unique([pedidoItemId])")
    expect(block).toContain("@@index([negocioId, estado, productoId, productoVarianteId])")
    expect(block).toContain("@@index([negocioId, productoVarianteId, estado])")
    expect(block).toContain("@@index([pedidoId])")
    expect(block).toContain('@@map("reservas_stock")')
  })

  test("estado es String (sin enum Prisma nuevo)", () => {
    expect(schema).not.toMatch(/enum\s+ReservaEstado/)
    expect(schema).not.toMatch(/enum\s+StockReservaModo/)
  })

  test("relaciones inversas en Negocio, Pedido, PedidoItem (1:1), Producto y ProductoVariante", () => {
    expect(squash(modelBlock("Negocio"))).toContain("reservasStock ReservaStock[]")
    expect(squash(modelBlock("Pedido"))).toContain("reservasStock ReservaStock[]")
    expect(squash(modelBlock("Pedido"))).toContain("movimientosInventario MovimientoInventario[]")
    expect(squash(modelBlock("PedidoItem"))).toContain("reservaStock ReservaStock?")
    expect(squash(modelBlock("Producto"))).toContain("reservasStock ReservaStock[]")
    expect(squash(modelBlock("ProductoVariante"))).toContain("reservasStock ReservaStock[]")
  })
})

describe("I1-Q — ConfigPlataforma.stockReservaModo", () => {
  test('String con default "OFF"', () => {
    expect(squash(modelBlock("ConfigPlataforma"))).toContain('stockReservaModo String @default("OFF")')
  })
})

describe("I1-R — MovimientoInventario.pedidoId", () => {
  const block = squash(modelBlock("MovimientoInventario"))
  test("nullable + relación SetNull + índice", () => {
    expect(block).toContain("pedidoId String?")
    expect(block).toContain("pedido Pedido? @relation(fields: [pedidoId], references: [id], onDelete: SetNull)")
    expect(block).toContain("@@index([pedidoId])")
  })
  test("las FKs previas del modelo no cambian", () => {
    expect(block).toContain("producto Producto @relation(fields: [productoId], references: [id], onDelete: Cascade)")
    expect(block).toContain("venta Venta? @relation(fields: [ventaId], references: [id], onDelete: SetNull)")
  })
})

describe("I1-S — la migración contiene exactamente las operaciones aditivas esperadas", () => {
  const statements = migration
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)

  test("es la única migración nueva de I1 y la más reciente", () => {
    const dirs = readdirSync(join(ROOT, "prisma/migrations")).filter((d) => statSync(join(ROOT, "prisma/migrations", d)).isDirectory()).sort()
    expect(dirs[dirs.length - 1]).toBe(MIGRATION_DIR.split("/").pop()!)
  })

  test("1 tabla, 2 columnas, 5 índices, 6 FKs — nada más", () => {
    const kinds = statements.map((s) => {
      if (/^CREATE TABLE "reservas_stock"/.test(s)) return "CREATE_TABLE"
      if (/^ALTER TABLE "\w+" ADD COLUMN/.test(s)) return "ADD_COLUMN"
      if (/^CREATE (UNIQUE )?INDEX/.test(s)) return "CREATE_INDEX"
      if (/^ALTER TABLE "\w+" ADD CONSTRAINT "\w+" FOREIGN KEY/.test(s)) return "ADD_FK"
      return `UNEXPECTED: ${s.slice(0, 60)}`
    })
    expect(kinds.filter((k) => k.startsWith("UNEXPECTED"))).toEqual([])
    expect(kinds.filter((k) => k === "CREATE_TABLE")).toHaveLength(1)
    expect(kinds.filter((k) => k === "ADD_COLUMN")).toHaveLength(2)
    expect(kinds.filter((k) => k === "CREATE_INDEX")).toHaveLength(5)
    expect(kinds.filter((k) => k === "ADD_FK")).toHaveLength(6)
  })

  test("columnas nuevas: pedidoId nullable y stockReservaModo NOT NULL DEFAULT 'OFF' (sin backfill)", () => {
    expect(migration).toContain('ALTER TABLE "movimientos_inventario" ADD COLUMN     "pedidoId" TEXT;')
    expect(migration).toContain(`ALTER TABLE "config_plataforma" ADD COLUMN     "stockReservaModo" TEXT NOT NULL DEFAULT 'OFF';`)
  })

  test("semántica ON DELETE exacta de cada FK", () => {
    const onDelete = (constraint: string) => {
      const stmt = statements.find((s) => s.includes(`"${constraint}"`))
      expect(stmt).toBeDefined()
      return stmt!.match(/ON DELETE (CASCADE|SET NULL|NO ACTION|RESTRICT)/)?.[1]
    }
    expect(onDelete("reservas_stock_negocioId_fkey")).toBe("CASCADE")
    expect(onDelete("reservas_stock_pedidoId_fkey")).toBe("NO ACTION")
    expect(onDelete("reservas_stock_pedidoItemId_fkey")).toBe("NO ACTION")
    expect(onDelete("reservas_stock_productoId_fkey")).toBe("SET NULL")
    expect(onDelete("reservas_stock_productoVarianteId_fkey")).toBe("SET NULL")
    expect(onDelete("movimientos_inventario_pedidoId_fkey")).toBe("SET NULL")
  })

  test("índices requeridos", () => {
    expect(migration).toContain('CREATE UNIQUE INDEX "reservas_stock_pedidoItemId_key" ON "reservas_stock"("pedidoItemId");')
    expect(migration).toContain('ON "reservas_stock"("negocioId", "estado", "productoId", "productoVarianteId");')
    expect(migration).toContain('ON "reservas_stock"("negocioId", "productoVarianteId", "estado");')
    expect(migration).toContain('CREATE INDEX "reservas_stock_pedidoId_idx" ON "reservas_stock"("pedidoId");')
    expect(migration).toContain('CREATE INDEX "movimientos_inventario_pedidoId_idx" ON "movimientos_inventario"("pedidoId");')
  })
})

describe("I1-T — la migración no contiene statements destructivos", () => {
  const sql = migration
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
  test("sin DROP / TRUNCATE / DELETE / UPDATE / RENAME / ALTER COLUMN", () => {
    expect(sql).not.toMatch(/\bDROP\b/i)
    expect(sql).not.toMatch(/\bTRUNCATE\b/i)
    expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i)
    expect(sql).not.toMatch(/^\s*UPDATE\b/im)
    expect(sql).not.toMatch(/\bRENAME\b/i)
    expect(sql).not.toMatch(/\bALTER\s+COLUMN\b/i)
  })
  test("ON DELETE CASCADE sólo en la FK de Negocio prevista", () => {
    const cascades = sql.match(/"\w+_fkey"[^;]*ON DELETE CASCADE/g) ?? []
    expect(cascades).toHaveLength(1)
    expect(cascades[0]).toContain('"reservas_stock_negocioId_fkey"')
  })
})

describe("I1 — tipo de movimiento PEDIDO sin abrir el endpoint manual", () => {
  test("PEDIDO existe en la autoridad de tipos persistibles", () => {
    expect(MOVIMIENTO_TIPO_PEDIDO).toBe("PEDIDO")
    expect([...MOVIMIENTO_TIPOS_PERSISTIBLES]).toEqual(["ENTRADA", "SALIDA", "AJUSTE", "VENTA", "PEDIDO"])
  })
  test("la lista de movimientos manuales no cambia: PEDIDO sigue siendo inválido para POST manual", () => {
    expect([...MOVIMIENTO_TIPOS]).toEqual(["ENTRADA", "SALIDA", "AJUSTE", "VENTA"])
    expect(isValidMovimientoTipo("PEDIDO")).toBe(false)
  })
})

describe("I1 — sin cambio de runtime: ningún caller productivo usa la autoridad nueva ni ReservaStock", () => {
  function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(join(ROOT, dir))) {
      const rel = `${dir}/${name}`
      const st = statSync(join(ROOT, rel))
      if (st.isDirectory()) walk(rel, out)
      else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) out.push(rel)
    }
    return out
  }
  // Se lee cada archivo productivo UNA vez al recolectar el describe (fuera del
  // timeout por test); los dos tests sólo filtran en memoria.
  const productive = walk("src").map((path) => ({ path, src: read(path) }))

  test("PRODUCTIVE_STOCK_AUTHORITY_CALLERS=0", () => {
    const callers = productive
      .filter(({ path, src }) => path !== "src/lib/stock-authority.ts" && /["']@\/lib\/stock-authority["']|["']\.\/stock-authority["']/.test(src))
      .map(({ path }) => path)
    expect(callers).toEqual([])
  })

  test("ningún archivo productivo lee/escribe reservaStock ni stockReservaModo ni MOVIMIENTO_TIPO_PEDIDO", () => {
    const hits = productive
      .filter(({ path, src }) => {
        if (path === "src/lib/stock-authority.ts" || path === "src/lib/inventario.ts") return false
        return /\.reservaStock\b|reservasStock|stockReservaModo|MOVIMIENTO_TIPO_PEDIDO/.test(src)
      })
      .map(({ path }) => path)
    expect(hits).toEqual([])
  })
})
