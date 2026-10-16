// ============================================
// F4-B — pure rules and static contract of owner sale corrections
// ============================================
import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { Prisma } from "@prisma/client"
import { fingerprintCorreccion, mapCorreccionDbError, parseCorreccionBody, type CorreccionSolicitud } from "@/lib/caja-correcciones-service"
import { lineaVigente } from "@/lib/caja-venta-vigente"

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

const valido = {
  motivo: " Se escaneó el sabor equivocado ",
  confirmo: true,
  secuenciaEsperada: 0,
  lineas: [{ ventaItemId: "item-1", productoId: "p-lima", varianteId: null, cantidad: 2 }],
}

describe("F4-B — request validation (client never sets prices, totals or the actor)", () => {
  test("a valid correction is normalized; price/total/actor fields are ignored", () => {
    const parsed = parseCorreccionBody({ ...valido, precio: 1, total: 1, actorTipo: "EMPLEADO", lineas: [{ ...valido.lineas[0], precio: 1 }] })
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.value.motivo).toBe("Se escaneó el sabor equivocado")
    expect(parsed.value.lineas[0]).toEqual({ ventaItemId: "item-1", productoId: "p-lima", varianteId: null, cantidad: new Prisma.Decimal(2) })
    expect(JSON.stringify(parsed.value)).not.toMatch(/precio|total|actor/)
  })

  test("every missing or invalid decision is a controlled 400", () => {
    const code = (body: unknown) => (parseCorreccionBody(body) as { code?: string }).code
    expect(code({ ...valido, lineas: [] })).toBe("LINEAS_CORRECCION_INVALIDAS")
    expect(code({ ...valido, lineas: [valido.lineas[0], valido.lineas[0]] })).toBe("LINEAS_CORRECCION_INVALIDAS")
    expect(code({ ...valido, lineas: [{ ...valido.lineas[0], productoId: "" }] })).toBe("PRODUCTO_CORRECCION_INVALIDO")
    expect(code({ ...valido, lineas: [{ ...valido.lineas[0], varianteId: 7 }] })).toBe("PRODUCTO_CORRECCION_INVALIDO")
    for (const cantidad of [-1, "abc", 1.2345, Number.NaN, undefined]) {
      expect(code({ ...valido, lineas: [{ ...valido.lineas[0], cantidad }] })).toBe("CANTIDAD_CORRECCION_INVALIDA")
    }
    expect(code({ ...valido, motivo: "  " })).toBe("MOTIVO_CORRECCION_REQUERIDO")
    expect(code({ ...valido, motivo: "x".repeat(501) })).toBe("MOTIVO_CORRECCION_REQUERIDO")
    expect(code({ ...valido, secuenciaEsperada: -1 })).toBe("SECUENCIA_CORRECCION_INVALIDA")
    expect(code({ ...valido, secuenciaEsperada: "0" })).toBe("SECUENCIA_CORRECCION_INVALIDA")
    expect(code({ ...valido, confirmo: "true" })).toBe("CONFIRMACION_CORRECCION_REQUERIDA")
  })

  test("productoId null is accepted only to keep a line whose product left the catalog", () => {
    const parsed = parseCorreccionBody({ ...valido, lineas: [{ ventaItemId: "item-1", productoId: null, cantidad: 1 }] })
    expect(parsed.ok && parsed.value.lineas[0].productoId).toBeNull()
  })
})

describe("F4-B — fingerprint, current lines and SQL guard mapping", () => {
  const solicitud = (over: Partial<CorreccionSolicitud> = {}): CorreccionSolicitud => ({
    motivo: "m",
    secuenciaEsperada: 0,
    lineas: [
      { ventaItemId: "b", productoId: "p2", varianteId: null, cantidad: new Prisma.Decimal(1) },
      { ventaItemId: "a", productoId: "p1", varianteId: "v1", cantidad: new Prisma.Decimal(2) },
    ],
    ...over,
  })

  test("same content in any order → same fingerprint; any change → different", () => {
    const base = fingerprintCorreccion("n1", "v1", solicitud())
    expect(fingerprintCorreccion("n1", "v1", solicitud({ lineas: [...solicitud().lineas].reverse() }))).toBe(base)
    expect(fingerprintCorreccion("n1", "v1", solicitud({ motivo: "otro" }))).not.toBe(base)
    expect(fingerprintCorreccion("n1", "v1", solicitud({ secuenciaEsperada: 1 }))).not.toBe(base)
    expect(fingerprintCorreccion("n2", "v1", solicitud())).not.toBe(base)
  })

  test("a never-corrected line IS the original row; a corrected line keeps the charged price", () => {
    const item = { id: "i1", productoId: "p-cola", productoVarianteId: null, nombre: "Cola", varianteNombre: null, precio: 2000, cantidad: 2, subtotal: 4000, subtotalDecimal: new Prisma.Decimal("4000.00") }
    expect(lineaVigente(item, null)).toMatchObject({ productoId: "p-cola", nombre: "Cola", cantidad: 2, precio: 2000, corregida: false })
    const corregida = lineaVigente(item, [{ ventaItemId: "i1", productoId: "p-lima", productoVarianteId: null, nombre: "Lima", varianteNombre: null, precio: 2000, cantidad: 2, subtotalDecimal: new Prisma.Decimal("4000.00") }])
    expect(corregida).toMatchObject({ productoId: "p-lima", nombre: "Lima", cantidad: 2, precio: 2000, corregida: true })
    expect(corregida.subtotal.toFixed(2)).toBe("4000.00")
  })

  test("SQL guard failures become controlled conflicts", () => {
    expect(mapCorreccionDbError(new Error("sale correction must keep the charged total"))?.code).toBe("TOTAL_CORRECCION_DISTINTO")
    expect(mapCorreccionDbError(new Error("sale correction lines must cover the sale and keep its total"))?.code).toBe("TOTAL_CORRECCION_DISTINTO")
    expect(mapCorreccionDbError(new Error("sale correction is not allowed on a sale with returns"))?.code).toBe("VENTA_CON_DEVOLUCIONES")
    expect(mapCorreccionDbError(new Error("sale correction must keep the charged unit price"))?.code).toBe("PRECIO_CORRECCION_INVALIDO")
    expect(mapCorreccionDbError(new Error("other"))).toBeNull()
  })
})

describe("F4-B — static contract", () => {
  const MIGRATION = "prisma/migrations/20261018120000_f4_b_sale_corrections/migration.sql"

  test("owner-only: one owner route, no cashier route, actor never from the body", () => {
    const route = read("src/app/api/negocio/caja/ventas/[id]/correcciones/route.ts")
    expect(route).toContain("await requireNegocioCajaGenerico(req)")
    expect(route).toContain("negocioId: auth.negocioId")
    expect(route).not.toMatch(/body\.(negocioId|actor|empleadoId)/)
    expect(route).not.toMatch(/export async function (GET|PATCH|PUT|DELETE)/)
    const productive = walk("src")
    expect(productive.filter((path) => /registrarCorreccionVenta\(/.test(read(path)))).toEqual(["src/app/api/negocio/caja/ventas/[id]/correcciones/route.ts", "src/lib/caja-correcciones-service.ts"])
    expect(productive.filter((path) => path.startsWith("src/app/api/operativo/") && /caja-correcciones|registrarCorreccion|\/correcciones/.test(read(path)))).toEqual([])
    expect(read("src/app/operaciones/mi-panel/[slug]/caja/page.tsx")).not.toMatch(/correccionUrl|correcciones/)
  })

  test("the service never edits the original sale, its lines, cobro, ledger, shift or returns", () => {
    const src = read("src/lib/caja-correcciones-service.ts")
    expect(src).not.toMatch(/\.(venta|ventaItem|cobroVenta|turnoCaja|operacionFinanciera|movimientoFinanciero|devolucionVenta)\.(create|update|updateMany|upsert|delete|deleteMany)\(/)
    expect(src).toContain('actorTipo: "NEGOCIO"')
    expect(src).toContain("precio: l.vigente.precio")
    expect(src).not.toMatch(/producto\.precio|variante\.precio|select: \{[^}]*precio/)
  })

  test("migration is additive and keeps the applied F4-A migration untouched", () => {
    const sql = read(MIGRATION)
    expect(sql).toContain('CREATE TABLE "correcciones_venta"')
    expect(sql).toContain('CREATE TABLE "correcciones_venta_lineas"')
    expect(sql).not.toMatch(/\bDROP\b|\bUPDATE\s+"|\bDELETE\s+FROM\b|ALTER TABLE "(ventas_caja|venta_items|cobros_venta|turnos_caja|operaciones_financieras|movimientos_financieros|devoluciones_venta|devoluciones_venta_items)"/)
    expect(sql).toContain('ALTER TABLE "movimientos_inventario" ADD COLUMN     "correccionVentaId" TEXT;')
    for (const guard of ["sale correction must keep the charged total", "sale correction is not allowed on a sale with returns", "sale correction must keep the charged unit price", "sale correction is immutable"]) {
      expect(sql).toContain(guard)
    }
    expect(sql).toContain('CREATE OR REPLACE FUNCTION "guard_devolucion_venta_item"()')
    expect(read("prisma/migrations/20261017120000_f4_a_sale_returns/migration.sql")).not.toContain("correcciones_venta")
  })
})
