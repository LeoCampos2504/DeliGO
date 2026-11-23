// ============================================
// F10-C2a — contrato estático: compras y recepciones (sin base de datos)
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
const users = (re: RegExp) => productive.filter(({ src }) => re.test(src)).map(({ path }) => path).sort()

const SERVICE = "src/lib/compras-recepciones-service.ts"
const HTTP = "src/lib/compras-recepciones-http.ts"
const AUTHORITY = "src/lib/stock-lifecycle.ts"
const MIGRATION = "prisma/migrations/20261119210000_f10_c2a_purchases_receptions/migration.sql"
const OWNER_ROUTES = [...walk("src/app/api/negocio/recepciones"), ...walk("src/app/api/negocio/compras")].filter((p) => p.endsWith("route.ts"))
const CASHIER_ROUTES = [...walk("src/app/api/operativo/caja/[slug]/recepciones"), ...walk("src/app/api/operativo/caja/[slug]/recepciones-datos")].filter((p) => p.endsWith("route.ts"))

describe("F10-C2a — un solo escritor y fronteras con R3A, F5 y el libro financiero", () => {
  test("sólo el servicio de C2a escribe compras, recepciones, líneas, cargos, eventos, costos vigentes y configuración", () => {
    const escritura = /\.(compra|compraLinea|recepcion|recepcionLinea|recepcionCargo|eventoCompraRecepcion|costoVigente|configuracionCompras)\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(/
    expect(users(escritura)).toEqual([SERVICE])
  })

  test("el stock entra SÓLO por la autoridad R3A (registrarEntradaRecepcion); C2a no escribe stockCantidad ni movimientos", () => {
    const src = read(SERVICE)
    expect(src).toContain("registrarEntradaRecepcion(tx")
    expect(src).not.toMatch(/stockCantidad|movimientoInventario\.(create|update)/)
    expect(users(/registrarEntradaRecepcion/)).toEqual([SERVICE, AUTHORITY].sort())
    const autoridad = read(AUTHORITY)
    const fn = autoridad.slice(autoridad.indexOf("export async function registrarEntradaRecepcion"))
    expect(fn).toContain('tipo: "RECEPCION"')
    expect(fn).toContain("recepcionLineaId: linea.recepcionLineaId")
    expect(fn).not.toMatch(/reservaStock\./)
  })

  test("la deuda nace sólo por el motor de F5; C2a nunca toca el libro financiero ni los egresos de Caja", () => {
    const src = read(SERVICE)
    expect(src).not.toMatch(/\.(obligacionProveedor|creditoProveedor|asignacionPago|operacionAsignacion)\.(create|update)/)
    expect(src).toContain("crearObligacionDeRecepcionEnTx(tx")
    expect(src).toContain("operarAsignacionesEnTx(tx")
    expect(src).not.toMatch(/operacionFinanciera|movimientoFinanciero|egresoCaja|compensacionEgresoCaja/)
    expect(read(HTTP)).not.toMatch(/operacionFinanciera|movimientoFinanciero|egresoCaja/)
  })

  test("la aprobación es UNA transacción Serializable con CAS de versión, candados y rollback ante fallos tardíos", () => {
    const src = read(SERVICE)
    const ap = src.slice(src.indexOf("export async function aprobarRecepcion"), src.indexOf("async function resultadoAprobacion"))
    expect(ap).toContain("runSerializable(db")
    expect(ap).toContain("bloquearRecepcion(tx")
    expect(ap).toContain("bloqueo.version !== o.version")
    expect(ap).toContain('FROM "compras"')
    expect(ap).toContain("throw new AbortoTransaccion")
    expect(ap.indexOf("tx.recepcion.update")).toBeLessThan(ap.indexOf("registrarEntradaRecepcion"))
    expect(ap.indexOf("registrarEntradaRecepcion")).toBeLessThan(ap.indexOf("crearObligacionDeRecepcionEnTx"))
  })
})

describe("F10-C2a — permisos", () => {
  test("rutas del dueño: sesión de dueño; rutas del cajero: área caja, actor EMPLEADO, sin aprobar ni ver cuentas", () => {
    expect(OWNER_ROUTES.length).toBe(15) // F10-C2b: GET compras/catalogo · D-7 v2: recepciones/[id]/pagos y [pagoId] · Pagos E1: compras/[id]/pagos · E3: compras/[id]/anticipo-efectivo y compras/permisos-anticipos (todas exigen sesión de dueño, abajo)
    for (const r of OWNER_ROUTES) expect({ r, auth: read(r).includes("await requireNegocioCajaGenerico(req)") }).toEqual({ r, auth: true })
    expect(CASHIER_ROUTES.length).toBe(5) // D-7 v2: recepciones/[id]/pagos del cajero (área caja, sin aprobar; verificado abajo)
    for (const r of CASHIER_ROUTES) {
      const src = read(r)
      expect({ r, auth: src.includes('resolveOperativoAreaForSlug(req, p.slug, "caja")') }).toEqual({ r, auth: true })
      expect({ r, approves: /aprobarRecepcionHttp|vistaPreviaHttp|cerrarCompraHttp|crearCompraHttp|ConfiguracionCompras/.test(src) }).toEqual({ r, approves: false })
      expect({ r, owner: src.includes('tipo: "NEGOCIO"') }).toEqual({ r, owner: false })
    }
    expect(users(/aprobarRecepcionHttp|vistaPreviaHttp/).filter((p) => p.startsWith("src/app/api/operativo/") || p.startsWith("src/app/operaciones/"))).toEqual([])
    const proxy = read("src/proxy.ts")
    expect(proxy).toContain('"/api/negocio/compras"')
    expect(proxy).toContain('"/api/negocio/recepciones"')
  })
})

describe("F10-C2a — migración aditiva", () => {
  const sql = read(MIGRATION)
  const sinComentarios = sql.split(/\n/).filter((l) => !l.trimStart().startsWith("--")).join("\n")
  test("crea; sólo reemplaza los dos CHECK de F5-A que la propia F5-A reservó para C2a; LF con un salto final", () => {
    expect(sinComentarios).not.toMatch(/DROP\s+(TABLE|COLUMN|INDEX|TRIGGER|FUNCTION)/i)
    expect(sinComentarios).not.toMatch(/\bRENAME\b/i)
    const drops = [...sql.matchAll(/DROP CONSTRAINT "([^"]+)"/g)].map((m) => m[1]).sort()
    expect(drops).toEqual(["obligaciones_proveedor_origen_check", "obligaciones_proveedor_recepcion_check"])
    const bytes = readFileSync(join(root, MIGRATION))
    expect(bytes.includes(13)).toBe(false)
    expect(bytes.at(-1)).toBe(10)
    expect(bytes.at(-2)).not.toBe(10)
  })

  test("invariantes en SQL: una entrada por línea, recepción cerrada inmutable, obligación única y exacta, eventos append-only", () => {
    for (const fragmento of [
      '"movimientos_inventario_recepcionLineaId_key"',
      "stock enters only for an approved reception",
      "reception stock entry must equal the accepted quantity",
      "a closed reception is immutable",
      "approved costs of a reception line are immutable",
      "a reception obligation must match its reception",
      "an attributable charge of the same supplier belongs to the reception obligation",
      "an obligation born from a reception cannot be cancelled",
      '"obligaciones_proveedor_cargo_unico"',
      '"recepciones_comprobante_aprobado_unico"',
      '"eventos_compra_recepcion_aprobacion_unica"',
      "purchase/reception history is append-only",
      '"eventos_compra_recepcion_dueno_check"',
    ]) expect({ fragmento, ok: sql.includes(fragmento) }).toEqual({ fragmento, ok: true })
  })
})
