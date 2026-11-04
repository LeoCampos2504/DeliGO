// ============================================
// F4-B — pure rules and static contract of owner sale corrections
// ============================================
import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { Prisma } from "@prisma/client"
import { criterioPrecioLinea, fingerprintCorreccion, mapCorreccionDbError, parseCorreccionBody, type CorreccionSolicitud } from "@/lib/caja-correcciones-service"
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
    expect(lineaVigente(item, null)).toMatchObject({ productoId: "p-cola", nombre: "Cola", cantidad: 2, precio: 2000, corregida: false, criterioPrecio: null })
    const corregida = lineaVigente(item, [{ ventaItemId: "i1", productoId: "p-lima", productoVarianteId: null, nombre: "Lima", varianteNombre: null, precio: 2000, cantidad: 2, subtotalDecimal: new Prisma.Decimal("4000.00") }])
    expect(corregida).toMatchObject({ productoId: "p-lima", nombre: "Lima", cantidad: 2, precio: 2000, corregida: true, precioHeredado: true })
    // A line recorded with a price justification is not flagged.
    expect(lineaVigente(item, [{ ventaItemId: "i1", productoId: "p-lima", productoVarianteId: null, nombre: "Lima", varianteNombre: null, precio: 2000, cantidad: 2, subtotalDecimal: new Prisma.Decimal("4000.00"), criterioPrecio: "MISMA_VENTA" }]).precioHeredado).toBe(false)
    // Catalog-justified line: not flagged, and its criterion is exposed to the form.
    expect(lineaVigente(item, [{ ventaItemId: "i1", productoId: "p-otro", productoVarianteId: null, nombre: "Otro", varianteNombre: null, precio: 2000, cantidad: 2, subtotalDecimal: new Prisma.Decimal("4000.00"), criterioPrecio: "PRECIO_CATALOGO_ACTUAL" }])).toMatchObject({ precioHeredado: false, criterioPrecio: "PRECIO_CATALOGO_ACTUAL" })
    expect(corregida.subtotal.toFixed(2)).toBe("4000.00")
  })

  test("sale-based price justification: own product, or another product of the same sale at the same charged price (else the catalog is checked)", () => {
    const originales = [
      { productoId: "p-saphirus", productoVarianteId: null, precio: 2000 },
      { productoId: "p-otro2000", productoVarianteId: null, precio: 2000 },
      { productoId: "p-redmi", productoVarianteId: null, precio: 1000 },
      { productoId: "p-remera", productoVarianteId: "v-roja", precio: 3000 },
      { productoId: "p-remera", productoVarianteId: "v-azul", precio: 3000 },
    ]
    const saphirus = originales[0]
    expect(criterioPrecioLinea(originales, saphirus, "p-saphirus", null)).toBe("MISMO_PRODUCTO")
    expect(criterioPrecioLinea(originales, saphirus, "p-otro2000", null)).toBe("MISMA_VENTA") // same price in the sale
    expect(criterioPrecioLinea(originales, saphirus, "p-redmi", null)).toBeNull() // cheaper: $1.000 unjustified
    expect(criterioPrecioLinea(originales, originales[2], "p-saphirus", null)).toBeNull() // more expensive
    expect(criterioPrecioLinea(originales, saphirus, "p-fuera-de-la-venta", null)).toBeNull() // not in the sale → service checks its current catalog price
    expect(criterioPrecioLinea(originales, originales[3], "p-remera", "v-azul")).toBe("MISMA_VENTA") // variants
    expect(criterioPrecioLinea(originales, originales[3], "p-remera", null)).toBeNull() // variant key matters
  })

  test("SQL guard failures become controlled conflicts", () => {
    expect(mapCorreccionDbError(new Error("sale correction must keep the charged total"))?.code).toBe("TOTAL_CORRECCION_DISTINTO")
    expect(mapCorreccionDbError(new Error("sale correction lines must cover the sale and keep its total"))?.code).toBe("TOTAL_CORRECCION_DISTINTO")
    expect(mapCorreccionDbError(new Error("sale correction is not allowed on a sale with returns"))?.code).toBe("VENTA_CON_DEVOLUCIONES")
    expect(mapCorreccionDbError(new Error("sale correction must keep the charged unit price"))?.code).toBe("PRECIO_CORRECCION_INVALIDO")
    expect(mapCorreccionDbError(new Error("sale correction replacement price is not justified"))?.code).toBe("PRECIO_NO_JUSTIFICADO")
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
    expect(productive.filter((path) => /registrarCorreccionVenta\(/.test(read(path))).sort()).toEqual(["src/app/api/negocio/caja/ventas/[id]/correcciones/route.ts", "src/lib/caja-correcciones-service.ts"].sort())
    expect(productive.filter((path) => path.startsWith("src/app/api/operativo/") && /caja-correcciones|registrarCorreccion|\/correcciones/.test(read(path)))).toEqual([])
    expect(read("src/app/operaciones/mi-panel/[slug]/caja/page.tsx")).not.toMatch(/correccionUrl|correcciones/)
  })

  test("the service never edits the original sale, its lines, cobro, ledger, shift or returns", () => {
    const src = read("src/lib/caja-correcciones-service.ts")
    expect(src).not.toMatch(/\.(venta|ventaItem|cobroVenta|turnoCaja|operacionFinanciera|movimientoFinanciero|devolucionVenta)\.(create|update|updateMany|upsert|delete|deleteMany)\(/)
    expect(src).toContain('actorTipo: "NEGOCIO"')
    expect(src).toContain("precio: l.vigente.precio")
    // The current catalog price is read ONLY to check the PRECIO_CATALOGO_ACTUAL
    // criterion (exact equality with the charged price) and stored as evidence;
    // the line always keeps the price actually charged.
    expect(src).toContain("if (precioActual !== item.precio) return noJustificado(precioActual)")
    expect(src.match(/precio: precioActual/g)).toEqual(["precio: precioActual"])
    expect(src).toContain("catalogo = { precio: precioActual, consultadoEn: verificadoEn }")
    expect(src).not.toMatch(/precio: (producto|variante)\.precio/)
    expect(src).toContain("precioCatalogoConsultado: l.catalogo?.precio ?? null")
    expect(src).toContain("precioCatalogoConsultadoEn: l.catalogo?.consultadoEn ?? null")
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

  test("price-justification migration is additive and never rewrites existing corrections", () => {
    const sql = read("prisma/migrations/20261105120000_f4_b_justified_replacement_prices/migration.sql")
    expect(sql).toContain('ALTER TABLE "correcciones_venta_lineas" ADD COLUMN "criterioPrecio" TEXT;')
    expect(sql).toContain('CREATE OR REPLACE FUNCTION "guard_correccion_venta_linea"()')
    expect(sql).toContain("sale correction replacement price is not justified")
    expect(sql).toContain('ALTER TABLE "correcciones_venta_lineas" ADD COLUMN "precioCatalogoConsultado" DOUBLE PRECISION;')
    expect(sql).toContain('ALTER TABLE "correcciones_venta_lineas" ADD COLUMN "precioCatalogoConsultadoEn" TIMESTAMP(3);')
    for (const criterio of ["'MISMO_PRODUCTO'", "'MISMA_VENTA'", "'PRECIO_CATALOGO_ACTUAL'"]) expect(sql).toContain(criterio)
    // Catalog criterion: same business, product not deleted, active variant, exact price.
    expect(sql).toContain('p."negocioId" = NEW."negocioId" AND p."eliminado" = false')
    expect(sql).toContain('pv."activo" = true')
    expect(sql).toContain('precio_actual IS NULL OR precio_actual <> NEW."precio"')
    expect(sql).not.toMatch(/\bDROP\b|\bUPDATE\s+"|\bDELETE\s+FROM\b|ALTER TABLE "(ventas_caja|venta_items|correcciones_venta|devoluciones_venta|devoluciones_venta_items)"/)
    expect(read("prisma/migrations/20261018120000_f4_b_sale_corrections/migration.sql")).not.toContain("criterioPrecio")
  })
})
