// ============================================
// T7-F1 — contrato estático de los retiros personales (sin base de datos)
// ============================================
// El stock sólo lo mueve la autoridad; ningún archivo del retiro escribe dinero; cada ruta autentica con la
// autoridad de sesión correcta; la migración es aditiva (sin backfill ni cambios en datos existentes); el cajero
// nunca recibe costos ni decisiones.
import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n")
const SERVICE = read("src/lib/retiros-personales-service.ts")
const HTTP = read("src/lib/retiros-personales-http.ts")
const AUTHORITY = read("src/lib/stock-lifecycle.ts")
const MIGRATION = read("prisma/migrations/20261127200000_t7_retiros_personales/migration.sql")

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(join(process.cwd(), dir))) {
    const rel = `${dir}/${entry}`
    if (statSync(join(process.cwd(), rel)).isDirectory()) walk(rel, out)
    else if (entry === "route.ts") out.push(rel)
  }
  return out
}
const OWNER_ROUTES = [...walk("src/app/api/negocio/caja/retiros-personales"), "src/app/api/negocio/empleados/permisos-retiro/route.ts"]
const CASHIER_ROUTES = walk("src/app/api/operativo/caja/[slug]/retiros-personales")
const cuerpo = (fn: string) => {
  const start = AUTHORITY.indexOf(`export async function ${fn}(`)
  expect(start).toBeGreaterThan(0)
  return AUTHORITY.slice(start, AUTHORITY.indexOf("\n}\n", start))
}

describe("T7-F1 — stock sólo por la autoridad", () => {
  test("servicio, capa HTTP y rutas no escriben stockCantidad, no crean movimientos ni importan la autoridad pura", () => {
    for (const [nombre, src] of [["service", SERVICE], ["http", HTTP], ...[...OWNER_ROUTES, ...CASHIER_ROUTES].map((r) => [r, read(r)] as const)] as const) {
      expect({ nombre, stock: /stockCantidad/.test(src) }).toEqual({ nombre, stock: false })
      expect({ nombre, movimientos: /movimientoInventario\.(create|update|upsert|delete)/.test(src) }).toEqual({ nombre, movimientos: false })
      expect({ nombre, puro: /@\/lib\/stock-authority/.test(src) }).toEqual({ nombre, puro: false })
      expect({ nombre, resolveNextStock: /resolveNextStock/.test(src) }).toEqual({ nombre, resolveNextStock: false })
    }
    // plan ANTES de crear el retiro, escritura de stock DESPUÉS, todo en la misma transacción Serializable
    expect(SERVICE).toContain("runStockSerializable(db, (tx) => registrarRetiroEnTx(tx,")
    expect(SERVICE.indexOf("await planificarStockRetiroPersonal(tx,")).toBeLessThan(SERVICE.indexOf("await tx.retiroPersonal.create("))
    expect(SERVICE.indexOf("await tx.retiroPersonal.create(")).toBeLessThan(SERVICE.indexOf("await registrarStockRetiroPersonal(tx,"))
    expect(SERVICE).toContain("await reingresarStockRetiroPersonal(tx,")
  })

  test("las funciones nuevas de la autoridad leen la disponibilidad en la tx, no tocan reservas ni el modo y vinculan su origen", () => {
    for (const fn of ["planificarStockRetiroPersonal", "registrarStockRetiroPersonal", "reingresarStockRetiroPersonal"]) {
      const body = cuerpo(fn)
      expect({ fn, reservas: /reservaStock\.(update|updateMany|create|createMany|delete)/.test(body) }).toEqual({ fn, reservas: false })
      expect({ fn, modo: /readStockReservationMode|stockReservaModo/.test(body) }).toEqual({ fn, modo: false })
    }
    expect(cuerpo("planificarStockRetiroPersonal")).toContain("await leerDisponibilidadStock(tx,")
    expect(cuerpo("planificarStockRetiroPersonal")).toContain("total.cantidad > availability.available")
    expect(cuerpo("registrarStockRetiroPersonal")).toContain("tipo: MOVIMIENTO_TIPO_RETIRO_PERSONAL")
    expect(cuerpo("registrarStockRetiroPersonal")).toContain("retiroPersonalId: params.retiroPersonalId")
    expect(cuerpo("reingresarStockRetiroPersonal")).toContain("tipo: MOVIMIENTO_TIPO_RETIRO_PERSONAL_REINGRESO")
    expect(cuerpo("reingresarStockRetiroPersonal")).toContain("devolucionRetiroId: params.devolucionRetiroId")
    expect(AUTHORITY).toContain('export const MOVIMIENTO_TIPO_RETIRO_PERSONAL = "RETIRO_PERSONAL"')
    expect(AUTHORITY).toContain('export const MOVIMIENTO_TIPO_RETIRO_PERSONAL_REINGRESO = "RETIRO_PERSONAL_REINGRESO"')
  })
})

describe("T7-F1 — sin dinero", () => {
  test("ningún archivo del retiro escribe ventas, cobros, operaciones, libro, cuentas ni egresos", () => {
    for (const [nombre, src] of [["service", SERVICE], ["http", HTTP]] as const) {
      expect({ nombre, escrituraDinero: /\b(venta|ventaItem|cobroVenta|operacionFinanciera|movimientoFinanciero|cuentaFinanciera|egresoCaja|devolucionVenta)\.(create|createMany|update|updateMany|upsert|delete)/.test(src) }).toEqual({ nombre, escrituraDinero: false })
      expect({ nombre, motorVenta: /registrarVentaCaja|caja-venta-service|caja-egresos-service/.test(src) }).toEqual({ nombre, motorVenta: false })
    }
  })
})

describe("T7-F1 — autenticación y respuestas", () => {
  test("rutas del dueño: sesión de negocio genérico; rutas del cajero: sesión operativa de Caja; actor siempre de la sesión", () => {
    expect(OWNER_ROUTES.length).toBe(7)
    expect(CASHIER_ROUTES.length).toBe(2)
    for (const r of OWNER_ROUTES) {
      const src = read(r)
      for (const handler of src.match(/export async function (GET|POST|PUT)\([^)]*\)[^{]*\{[^]*?\n\}/g) ?? []) {
        expect({ r, auth: handler.includes("await requireNegocioCajaGenerico(req)") && handler.includes("if (!auth.ok) return auth.response") }).toEqual({ r, auth: true })
      }
    }
    for (const r of CASHIER_ROUTES) {
      const src = read(r)
      expect(src).toContain('await resolveOperativoAreaForSlug(req, slug, "caja")')
      expect(src).toContain("if (!auth.ok) return cajaAuthFailure(auth)")
      expect(src).toContain('{ tipo: "EMPLEADO", empleadoId: auth.empleado.id }')
      expect(src).not.toMatch(/negocioId:\s*(body|req)/)
    }
    expect(read("src/app/api/operativo/caja/[slug]/retiros-personales/route.ts")).toContain('vista: "cajero"')
  })

  test("la respuesta del cajero no incluye costos, decisiones, devoluciones ni el registrante", () => {
    const start = SERVICE.indexOf("export function retiroParaCajero(")
    const fn = SERVICE.slice(start, SERVICE.indexOf("\n}\n", start))
    expect(fn).not.toMatch(/costo|decision|devolucion|registradoPor/i)
  })

  test("el permiso del empleado se relee dentro de la transacción (la revocación vale para sesiones abiertas)", () => {
    const start = SERVICE.indexOf("async function resolverRegistrante(")
    const fn = SERVICE.slice(start, SERVICE.indexOf("\n}\n", start))
    expect(fn).toContain("tx.empleado.findFirst(")
    expect(fn).toContain("retiroPersonalHabilitado")
    expect(fn).toContain("RETIRO_NO_HABILITADO")
  })
})

describe("T7-F1 — migración aditiva", () => {
  test("sin DROP, sin backfill, sin cambios en datos existentes; permiso conservador por defecto", () => {
    const sql = MIGRATION.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n")
    expect(sql).not.toMatch(/\bDROP\s+(TABLE|COLUMN|INDEX|CONSTRAINT)\b/i)
    expect(sql).not.toMatch(/\bRENAME\b/i)
    expect(sql).not.toMatch(/^\s*(UPDATE|DELETE|INSERT)\b/im)
    expect(sql).not.toMatch(/\bTRUNCATE\b/i)
    expect(sql).toContain('ALTER TABLE "empleados" ADD COLUMN     "retiroPersonalHabilitado" BOOLEAN NOT NULL DEFAULT false;')
    // las únicas alteraciones de tablas existentes: la columna del permiso, dos columnas NULL + índices/FK/CHECK en movimientos
    const alterados = [...sql.matchAll(/ALTER TABLE "([a-z_]+)"/g)].map((m) => m[1])
    const nuevas = ["familiares_retiro", "retiros_personales", "retiro_personal_lineas", "devoluciones_retiro", "devolucion_retiro_lineas", "decisiones_recupero_retiro", "decision_recupero_retiro_items"]
    expect([...new Set(alterados.filter((t) => !nuevas.includes(t)))].sort()).toEqual(["empleados", "movimientos_inventario"])
    expect(sql).toContain('ADD COLUMN     "devolucionRetiroId" TEXT')
    expect(sql).toContain('CREATE UNIQUE INDEX "decision_recupero_retiro_items_vigente_key" ON "decision_recupero_retiro_items"("retiroId") WHERE "vigente";')
  })

  test("es la migración más reciente y las anteriores siguen siendo 70", () => {
    const dirs = readdirSync(join(process.cwd(), "prisma/migrations")).filter((d) => /^\d+_/.test(d)).sort()
    expect(dirs.length).toBe(71)
    expect(dirs.at(-1)).toBe("20261127200000_t7_retiros_personales")
    expect(dirs.at(-2)).toBe("20261127120000_f10_d1_conciliacion_recupero_egresos")
  })
})

describe("T7-F1 — revisión independiente (correcciones)", () => {
  test("el resumen recorre el período completo en lotes; el límite sólo existe en el detalle paginado", () => {
    const start = SERVICE.indexOf("export async function resumenRetirosPeriodo(")
    const fn = SERVICE.slice(start, SERVICE.indexOf("\n}\n", start))
    expect(fn).toContain("take: RETIRO_LOTE_RESUMEN")
    expect(fn).toContain("if (lote.length < RETIRO_LOTE_RESUMEN) break")
    expect(fn).toContain("cursor = lote[lote.length - 1].id")
    expect(fn).toContain("SET TRANSACTION READ ONLY")
    expect(SERVICE).not.toMatch(/take:\s*2000/)
    expect(HTTP).toContain("resumen: await resumenRetirosPeriodo(db, negocioId, f.value)")
    expect(HTTP).toContain("siguienteCursor: pagina.siguienteCursor")
  })

  test("una línea de variante borrada nunca reingresa al producto padre", () => {
    expect(SERVICE).toContain("const varianteBorrada = c.linea.lineaDeVariante && !c.linea.productoVarianteId")
    expect(SERVICE).toContain("c.linea.movioStock && c.linea.productoId && !varianteBorrada")
    expect(SERVICE).toContain("lineaDeVariante: Boolean(l.item.varianteId)")
    expect(MIGRATION).toContain('AND ("lineaDeVariante" OR "productoVarianteId" IS NULL)')
  })

  test("el intento de retiro usa su propio almacenamiento y el mecanismo de ventas no se modificó", () => {
    const DIALOG = read("src/components/business/caja-retiro-personal.tsx")
    const TAB = read("src/components/business/caja-tab.tsx")
    expect(DIALOG).toContain('const RETIRO_ATTEMPT_PREFIX = "deligo:caja:retiro-attempt:v1:"')
    expect(DIALOG.indexOf("onPendienteChange(attempt) // guardado ANTES de enviar")).toBeLessThan(DIALOG.indexOf("await enviar(attempt)"))
    expect(DIALOG).toContain("classifyCheckoutResponse(res.status, json.code)")
    expect(TAB).toContain("if (!seleccion && pendingRetiro) {")
    expect(TAB).toContain("readPendingRetiro(source.attemptScope)")
    expect(read("src/lib/caja-checkout-attempt.ts")).not.toMatch(/retiro/i)
  })
})
