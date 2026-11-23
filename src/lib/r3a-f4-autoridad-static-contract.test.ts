// ============================================
// R3A — contrato estático: F4-A / F4-B escriben stock SÓLO por la autoridad (sin base de datos)
// ============================================
import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8")
const AUTHORITY = read("src/lib/stock-lifecycle.ts")
const DEVOLUCIONES = read("src/lib/caja-devoluciones-service.ts")
const CORRECCIONES = read("src/lib/caja-correcciones-service.ts")
const cuerpo = (fn: string) => {
  const start = AUTHORITY.indexOf(`export async function ${fn}(`)
  expect(start).toBeGreaterThan(0)
  return AUTHORITY.slice(start, AUTHORITY.indexOf("\n}\n", start))
}

describe("R3A — F4 delega el stock en la autoridad", () => {
  test("devoluciones y correcciones no escriben stockCantidad, no crean movimientos ni importan la autoridad pura", () => {
    for (const [nombre, src] of [["devoluciones", DEVOLUCIONES], ["correcciones", CORRECCIONES]] as const) {
      expect({ nombre, stock: /stockCantidad/.test(src) }).toEqual({ nombre, stock: false })
      expect({ nombre, movimientos: /movimientoInventario\.(create|update|upsert)/.test(src) }).toEqual({ nombre, movimientos: false })
      expect({ nombre, puro: /@\/lib\/stock-authority/.test(src) }).toEqual({ nombre, puro: false })
      expect({ nombre, resolveNextStock: /resolveNextStock/.test(src) }).toEqual({ nombre, resolveNextStock: false })
    }
    expect(DEVOLUCIONES).toContain("await reingresarStockDevolucionVenta(tx, {")
    expect(CORRECCIONES).toContain("await planificarStockCorreccionVenta(tx, {")
    expect(CORRECCIONES).toContain("await registrarStockCorreccionVenta(tx, {")
    // el plan se calcula ANTES de escribir la corrección y se aplica después (mismo orden de siempre)
    expect(CORRECCIONES.indexOf("planificarStockCorreccionVenta(tx")).toBeLessThan(CORRECCIONES.indexOf("tx.correccionVenta.create("))
    expect(CORRECCIONES.indexOf("tx.correccionVenta.create(")).toBeLessThan(CORRECCIONES.indexOf("registrarStockCorreccionVenta(tx"))
  })

  test("las funciones nuevas de la autoridad leen la disponibilidad en la transacción, no tocan reservas ni leen el modo", () => {
    for (const fn of ["reingresarStockDevolucionVenta", "planificarStockCorreccionVenta", "registrarStockCorreccionVenta", "registrarEntradaRecepcion"]) {
      const body = cuerpo(fn)
      expect({ fn, reservas: /reservaStock\.(update|updateMany|create|createMany|delete)/.test(body) }).toEqual({ fn, reservas: false })
      expect({ fn, modo: /readStockReservationMode|stockReservaModo/.test(body) }).toEqual({ fn, modo: false })
    }
    expect(cuerpo("reingresarStockDevolucionVenta")).toContain("await leerDisponibilidadStock(tx,")
    expect(cuerpo("planificarStockCorreccionVenta")).toContain("cantidad > disponibilidad.available")
  })

  test("los tipos de movimiento de la autoridad son exactamente las constantes que F4 ya publicaba", () => {
    expect(DEVOLUCIONES).toContain('export const MOVIMIENTO_TIPO_DEVOLUCION = "DEVOLUCION"')
    expect(CORRECCIONES).toContain('export const MOVIMIENTO_TIPO_CORRECCION_ENTRADA = "CORRECCION_ENTRADA"')
    expect(CORRECCIONES).toContain('export const MOVIMIENTO_TIPO_CORRECCION_SALIDA = "CORRECCION_SALIDA"')
    expect(cuerpo("reingresarStockDevolucionVenta")).toContain('tipo: "DEVOLUCION"')
    expect(cuerpo("planificarStockCorreccionVenta")).toContain('"CORRECCION_SALIDA" : "CORRECCION_ENTRADA"')
  })
})
