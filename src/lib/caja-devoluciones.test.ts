// ============================================
// F4-A — pure rules and static contract of sale voids / partial returns
// ============================================
import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { Prisma } from "@prisma/client"
import {
  fingerprintDevolucion,
  importeDevolucionLinea,
  mapDevolucionDbError,
  parseDevolucionBody,
  parseFiltroHistorial,
  textoNotificacionDevolucion,
  type DevolucionSolicitud,
} from "@/lib/caja-devoluciones-service"

const D = (v: string | number) => new Prisma.Decimal(String(v))
const root = process.cwd()
const read = (p: string) => readFileSync(join(root, p), "utf8")

const valido = {
  tipo: "DEVOLUCION_PARCIAL",
  motivo: " El cliente devolvió una gaseosa ",
  confirmo: true,
  reintegro: { modo: "REALIZADO", medio: "EFECTIVO" },
  items: [{ ventaItemId: "item-1", cantidad: 1, reingresaStock: true }],
}

describe("F4-A — request validation (client never sets amounts)", () => {
  test("a valid partial return is normalized", () => {
    const parsed = parseDevolucionBody({ ...valido, importe: 1, precio: 1 })
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.value.motivo).toBe("El cliente devolvió una gaseosa")
    expect(parsed.value.lineas[0].cantidad?.toString()).toBe("1")
    expect(parsed.value).not.toHaveProperty("importe")
  })

  test("every missing decision is a controlled 400", () => {
    const code = (body: unknown) => (parseDevolucionBody(body) as { code?: string }).code
    expect(code({ ...valido, tipo: "EDITAR" })).toBe("TIPO_DEVOLUCION_INVALIDO")
    expect(code({ ...valido, items: [] })).toBe("ITEMS_DEVOLUCION_INVALIDOS")
    expect(code({ ...valido, items: [valido.items[0], valido.items[0]] })).toBe("ITEMS_DEVOLUCION_INVALIDOS")
    expect(code({ ...valido, items: [{ ventaItemId: "item-1", cantidad: 1 }] })).toBe("STOCK_DECISION_REQUERIDA")
    for (const cantidad of [0, -1, "abc", 1.2345, Number.NaN, undefined]) {
      expect(code({ ...valido, items: [{ ventaItemId: "item-1", cantidad, reingresaStock: true }] })).toBe("CANTIDAD_DEVOLUCION_INVALIDA")
    }
    expect(code({ ...valido, motivo: "   " })).toBe("MOTIVO_DEVOLUCION_REQUERIDO")
    expect(code({ ...valido, motivo: "x".repeat(501) })).toBe("MOTIVO_DEVOLUCION_REQUERIDO")
    expect(code({ ...valido, reintegro: { modo: "REALIZADO", medio: "MERCADO_PAGO" } })).toBe("REINTEGRO_INVALIDO")
    expect(code({ ...valido, reintegro: undefined })).toBe("REINTEGRO_INVALIDO")
    expect(code({ ...valido, confirmo: "true" })).toBe("CONFIRMACION_DEVOLUCION_REQUERIDA")
    expect(code({ ...valido, cajaFisicaId: "  " })).toBe("CAJA_INVALIDA")
  })

  test("a void ignores quantities: the server returns what is left", () => {
    const parsed = parseDevolucionBody({ ...valido, tipo: "ANULACION", items: [{ ventaItemId: "item-1", cantidad: 99, reingresaStock: false }] })
    expect(parsed.ok && parsed.value.lineas[0].cantidad).toBeNull()
  })
})

describe("F4-A — amount actually charged, cumulative and exact", () => {
  test("operator example: 2 sodas × $2.000 + yerba $5.000; one soda back = $2.000, net $7.000", () => {
    const soda = importeDevolucionLinea({ subtotal: D("4000"), vendida: D(2), devueltaAntes: D(0), importeDevueltoAntes: D(0), cantidad: D(1) })
    expect(soda.toFixed(2)).toBe("2000.00")
    expect(D("9000").minus(soda).toFixed(2)).toBe("7000.00")
  })

  test("successive single-unit returns add up exactly to the subtotal and never exceed it", () => {
    for (const [subtotal, vendida] of [["0.10", 20], ["9.99", 3], ["100.00", 7], ["0.05", 2], ["1234.57", 9]] as const) {
      let devuelta = D(0)
      let devuelto = D(0)
      for (let i = 0; i < vendida; i++) {
        const importe = importeDevolucionLinea({ subtotal: D(subtotal), vendida: D(vendida), devueltaAntes: devuelta, importeDevueltoAntes: devuelto, cantidad: D(1) })
        expect(importe.isNegative()).toBe(false)
        devuelta = devuelta.plus(1)
        devuelto = devuelto.plus(importe)
        expect(devuelto.lte(D(subtotal))).toBe(true)
      }
      expect(devuelto.toFixed(2)).toBe(D(subtotal).toFixed(2))
    }
  })
})

describe("F4-A — idempotency fingerprint, notice and filters", () => {
  const solicitud = (over: Partial<DevolucionSolicitud> = {}): DevolucionSolicitud => ({
    tipo: "DEVOLUCION_PARCIAL",
    motivo: "m",
    reintegro: { modo: "PENDIENTE" },
    cajaFisicaId: null,
    lineas: [
      { ventaItemId: "b", cantidad: D(1), reingresaStock: true },
      { ventaItemId: "a", cantidad: D(2), reingresaStock: false },
    ],
    ...over,
  })

  test("same content in any line order → same fingerprint; any change or another actor → different", () => {
    const actor = { tipo: "EMPLEADO" as const, empleadoId: "e1" }
    const base = fingerprintDevolucion("n1", "v1", solicitud(), actor)
    expect(fingerprintDevolucion("n1", "v1", solicitud({ lineas: [...solicitud().lineas].reverse() }), actor)).toBe(base)
    expect(fingerprintDevolucion("n1", "v1", solicitud({ motivo: "otro" }), actor)).not.toBe(base)
    expect(fingerprintDevolucion("n1", "v1", solicitud({ reintegro: { modo: "NO_CORRESPONDE" } }), actor)).not.toBe(base)
    expect(fingerprintDevolucion("n1", "v1", solicitud(), { tipo: "EMPLEADO", empleadoId: "e2" })).not.toBe(base)
    expect(fingerprintDevolucion("n2", "v1", solicitud(), actor)).not.toBe(base)
  })

  test("owner notice states who, sale, products, amount, reason and refund status (never claims a bank transfer)", () => {
    const texto = textoNotificacionDevolucion({
      tipo: "ANULACION",
      empleadoNombre: "Beto",
      ventaId: "abcdef123456",
      importe: D("9000"),
      motivo: "Cargada por error",
      reintegroEstado: "REALIZADO",
      reintegroMedio: "TRANSFERENCIA",
      lineas: [{ nombre: "Gaseosa", cantidad: 2 }, { nombre: "Yerba", cantidad: 1 }],
    })
    expect(texto.titulo).toBe("Venta anulada")
    expect(texto.cuerpo).toContain("Beto anuló la venta #abcdef12")
    expect(texto.cuerpo).toContain("2 × Gaseosa, 1 × Yerba")
    expect(texto.cuerpo).toContain("Motivo: Cargada por error")
    expect(texto.cuerpo).toContain("declarado (sin verificación bancaria)")
    const pendiente = textoNotificacionDevolucion({ tipo: "DEVOLUCION_PARCIAL", empleadoNombre: "Ana", ventaId: "x".repeat(10), importe: D("1"), motivo: "m", reintegroEstado: "PENDIENTE", reintegroMedio: null, lineas: [] })
    expect(pendiente.cuerpo).toContain("reintegro pendiente")
  })

  test("history filter: one day range or a reference, bounded", () => {
    expect(parseFiltroHistorial(new URLSearchParams({ ref: "#AB12cd34" }))).toMatchObject({ ok: true, ref: "ab12cd34" })
    expect(parseFiltroHistorial(new URLSearchParams({ ref: "ab" })).ok).toBe(false)
    expect(parseFiltroHistorial(new URLSearchParams({ ref: "ab12;--" })).ok).toBe(false)
    expect(parseFiltroHistorial(new URLSearchParams({ desde: "2026-10-01T03:00:00.000Z", hasta: "2026-10-02T03:00:00.000Z" })).ok).toBe(true)
    expect(parseFiltroHistorial(new URLSearchParams({ desde: "2026-08-01T00:00:00.000Z", hasta: "2026-10-02T00:00:00.000Z" })).ok).toBe(false)
    expect(parseFiltroHistorial(new URLSearchParams({ desde: "x", hasta: "y" })).ok).toBe(false)
  })

  test("SQL guard failures become controlled conflicts", () => {
    expect(mapDevolucionDbError(new Error("ERROR: sale return quantity exceeds the sold quantity"))?.code).toBe("CANTIDAD_DEVOLUCION_EXCEDIDA")
    expect(mapDevolucionDbError(new Error("sale return cash refund requires an open shift"))?.code).toBe("TURNO_NO_DISPONIBLE")
    expect(mapDevolucionDbError(new Error("other"))).toBeNull()
  })
})

describe("F4-A — static contract", () => {
  const MIGRATION = "prisma/migrations/20261017120000_f4_a_sale_returns/migration.sql"

  test("migration is additive: new tables and guards only, never rewriting sales, cobros or closed shifts", () => {
    const sql = read(MIGRATION)
    expect(sql).toContain('CREATE TABLE "devoluciones_venta"')
    expect(sql).toContain('CREATE TABLE "devoluciones_venta_items"')
    expect(sql).not.toMatch(/\bDROP\b|\bUPDATE\s+"|\bDELETE\s+FROM\b|ALTER TABLE "(ventas_caja|venta_items|cobros_venta|turnos_caja|operaciones_financieras|movimientos_financieros)"/)
    expect(sql).toContain("sale return quantity exceeds the sold quantity")
    expect(sql).toContain("sale return cash refund requires an open shift")
    expect(sql).toContain("sale return is immutable")
  })

  test("cashier screen and APIs only use operativo endpoints and never touch expected cash", () => {
    const page = read("src/app/operaciones/mi-panel/[slug]/caja/page.tsx")
    expect(page).not.toMatch(/\/api\/negocio\//)
    expect(page).toContain("historialUrl: `${base}/ventas/historial`")
    for (const path of [
      "src/app/api/operativo/caja/[slug]/ventas/historial/route.ts",
      "src/app/api/operativo/caja/[slug]/ventas/[id]/devoluciones/route.ts",
      "src/app/api/operativo/caja/[slug]/devoluciones/[id]/reintegro/route.ts",
    ]) {
      const src = read(path)
      expect(src).toContain('resolveOperativoAreaForSlug(req, slug, "caja")')
      expect(src).toContain('{ tipo: "EMPLEADO", empleadoId: auth.empleado.id }')
      expect(src).not.toMatch(/caja-turnos-admin|calcularSnapshotEfectivoTurno|efectivoEsperado|body\.(empleadoId|negocioId|actor)/)
      expect(src).not.toMatch(/export async function (PATCH|PUT|DELETE)/)
    }
    const component = read("src/components/business/caja-devoluciones.tsx")
    expect(component).not.toMatch(/\/api\/negocio\/|\/api\/operativo\//)
  })

  test("the service never edits the original sale, its lines, cobro or closed shift", () => {
    const src = read("src/lib/caja-devoluciones-service.ts")
    expect(src).not.toMatch(/\.(venta|ventaItem|cobroVenta|turnoCaja)\.(update|updateMany|upsert|delete|deleteMany)\(/)
    expect(src).toContain('UPDATE "ventas_caja" SET "cantidadItems" = "cantidadItems"')
  })
})
