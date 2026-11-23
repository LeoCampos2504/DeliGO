// ============================================
// F5-A — contrato estático: proveedores y cuenta corriente (sin base de datos)
// ============================================
import { describe, expect, test } from "bun:test"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { execFileSync } from "node:child_process"

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

const SERVICE = "src/lib/cuenta-proveedor-service.ts"
const PROV_SERVICE = "src/lib/proveedores-service.ts"
const HTTP = "src/lib/cuenta-proveedor-http.ts"
const UI = "src/components/business/owner-proveedores.tsx"
const MIGRATION = "prisma/migrations/20261119180000_f5a_suppliers_ledger/migration.sql"
const ROUTES = walk("src/app/api/negocio/proveedores").filter((p) => p.endsWith("route.ts"))

describe("F5-A — un solo escritor, sólo el dueño", () => {
  test("sólo el motor escribe obligaciones, créditos, eventos, operaciones y asignaciones", () => {
    const escritura = /\.(obligacionProveedor|creditoProveedor|eventoCuentaProveedor|operacionAsignacion|asignacionPago)\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(/
    expect(users(escritura)).toEqual([SERVICE])
    expect(users(/\.(proveedor|proveedorCambio)\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(/)).toEqual([PROV_SERVICE])
  })

  test("todas las rutas autentican como dueño de negocio genérico y nada operativo llega al motor", () => {
    expect(ROUTES.length).toBe(14) // +1: productos que entrega el proveedor (F10-C2b) · +2 Pagos E2: cuenta-pedidos (lectura) y pagos-deudas; todas sólo dueño (verificado abajo)
    for (const r of ROUTES) {
      const src = read(r)
      expect({ r, auth: src.includes("await requireNegocioCajaGenerico(req)") && src.includes("if (!auth.ok) return auth.response") }).toEqual({ r, auth: true })
      expect({ r, negocioDeSesion: src.includes("auth.negocioId") }).toEqual({ r, negocioDeSesion: true })
    }
    expect(users(/cuenta-proveedor-http|cuenta-proveedor-service|proveedores-service/).filter((p) => p.startsWith("src/app/api/operativo/") || p.startsWith("src/app/operaciones/"))).toEqual([])
    expect(read("src/proxy.ts")).toContain('"/api/negocio/proveedores"')
  })

  test("cada escritura económica exige Idempotency-Key, corre en Serializable y audita dentro de la transacción", () => {
    const src = read(SERVICE)
    for (const fn of ["registrarObligacion", "anularObligacion", "registrarCredito", "vincularPagoCaja", "transicionarCredito", "operarAsignaciones"]) {
      const inicio = src.indexOf(`export async function ${fn}(`)
      const cuerpo = src.slice(inicio, src.indexOf("\nexport ", inicio + 10))
      // operarAsignaciones delega en su núcleo operarAsignacionesEnTx (compartido con la aprobación de recepciones de F10-C2a)
      // vincularPagoCaja delega en vincularPagoCajaEnTx (compartido con la aprobación de una recepción con pago al recibir, D-7 v2)
      const audita = cuerpo.includes("opciones.auditar(tx") || (fn === "operarAsignaciones" && cuerpo.includes("operarAsignacionesEnTx(tx")) || (fn === "vincularPagoCaja" && cuerpo.includes("vincularPagoCajaEnTx(tx"))
      expect({ fn, clave: cuerpo.includes("claveValida(input.idempotencyKey)"), ssi: cuerpo.includes("runSerializable(db"), audita }).toEqual({ fn, clave: true, ssi: true, audita: true })
    }
    const inicioNucleo = src.indexOf("export async function operarAsignacionesEnTx(")
    const nucleo = src.slice(inicioNucleo, src.indexOf("\nexport ", inicioNucleo + 10))
    expect(nucleo).toContain("bloquearProveedor(tx")
    expect(nucleo).toContain("opciones.auditar(tx")
    const inicioVinculo = src.indexOf("export async function vincularPagoCajaEnTx(")
    const vinculo = src.slice(inicioVinculo, src.indexOf("// Transiciones de un crédito", inicioVinculo))
    expect(vinculo).toContain("bloquearProveedor(tx")
    expect(vinculo).toContain("opciones.auditar(tx")
    expect(vinculo).toContain('FROM "egresos_caja" WHERE "id" = ${egresoCajaId} AND "negocioId" = ${negocioId} FOR UPDATE')
    expect(read(HTTP)).toContain("auditLogWithClient(tx")
  })

  test("dinero exacto: Decimal en el modelo (sin Float), sin coma flotante en el motor, centavos enteros en la UI", () => {
    const schema = read("prisma/schema.prisma")
    const f5 = schema.slice(schema.indexOf("model Proveedor {"), schema.indexOf('@@map("asignaciones_pago")'))
    expect(f5).not.toMatch(/\bFloat\b/)
    expect(f5.match(/Decimal\s+@db\.Decimal\(12, 2\)/g)?.length).toBe(3)
    expect(read(SERVICE)).not.toMatch(/parseFloat|Number\([^)]*importe/)
    expect(read(UI)).toContain("centavos")
  })
})

describe("F5-A — reglas financieras en el motor", () => {
  test("pagos declarados no son efectivos; sólo créditos efectivos se asignan; la sugerencia FIFO sólo lee", () => {
    const src = read(SERVICE)
    expect(src).toContain('ESTADOS_CREDITO_EFECTIVO = ["VIGENTE", "CONFIRMADO_DUENO"]')
    expect(src).toContain('estado: origen === "PAGO_DECLARADO" ? "DECLARADO" : "VIGENTE"')
    expect(src).toContain('"CREDITO_NO_EFECTIVO"')
    const sug = src.slice(src.indexOf("export async function sugerenciaAsignacion"), src.indexOf("export async function pagosCajaSinVincular"))
    expect(sug).not.toMatch(/\.(create|update)\(/)
  })

  test("vincular un pago de Caja: mismo orden de candados que la compensación y el egreso nunca se modifica", () => {
    const src = read(SERVICE)
    const v = src.slice(src.indexOf("export async function vincularPagoCaja"), src.indexOf("// Transiciones de un crédito"))
    expect(v.indexOf('FROM "cajas_fisicas"')).toBeGreaterThan(0)
    expect(v.indexOf('FROM "cajas_fisicas"')).toBeLessThan(v.indexOf('FROM "egresos_caja"'))
    expect(v).toContain("FOR UPDATE")
    expect(v).not.toMatch(/egresoCaja\.(update|delete)/)
    const c1 = read("src/lib/caja-egresos-service.ts")
    expect(c1).toContain('"PAGO_VINCULADO_A_PROVEEDOR"')
    expect(c1).toContain("cash outflow is linked to a supplier credit")
  })
})

describe("F5-A — migración aditiva con invariantes en SQL", () => {
  const sql = read(MIGRATION)
  test("sólo crea: no borra, no renombra ni altera tablas existentes (salvo el trigger aditivo de D-8)", () => {
    expect(sql).not.toMatch(/\bDROP\b/i)
    expect(sql).not.toMatch(/\bRENAME\b/i)
    const alterados = [...sql.matchAll(/ALTER TABLE "([^"]+)"/g)].map((m) => m[1])
    const propias = ["proveedores", "proveedor_cambios", "obligaciones_proveedor", "creditos_proveedor", "eventos_cuenta_proveedor", "operaciones_asignacion", "asignaciones_pago"]
    expect(alterados.filter((t) => !propias.includes(t))).toEqual([])
    expect(sql).toContain('CREATE TRIGGER "compensaciones_egresos_caja_credito_proveedor_trigger" BEFORE INSERT ON "compensaciones_egresos_caja"')
  })

  test("CUIT, unicidades, FKs compuestas, append-only (UPDATE y DELETE) y topes de asignación", () => {
    for (const fragmento of [
      'CREATE FUNCTION "f5a_cuit_valido"',
      '"proveedores_negocio_cuit_unico"',
      '"creditos_proveedor_egreso_vigente_unico"',
      "assignment exceeds the available credit",
      "assignment exceeds the pending obligation",
      "only an effective supplier credit can be assigned",
      "unassignment must reverse exactly one assignment",
      'CREATE FUNCTION "guard_delete_f5a"',
      'FOREIGN KEY ("creditoId", "proveedorId", "negocioId")',
      'FOREIGN KEY ("obligacionId", "proveedorId", "negocioId")',
    ]) expect({ fragmento, ok: sql.includes(fragmento) }).toEqual({ fragmento, ok: true })
    for (const tabla of ["proveedores", "proveedor_cambios", "obligaciones_proveedor", "creditos_proveedor", "eventos_cuenta_proveedor", "operaciones_asignacion", "asignaciones_pago"]) {
      expect({ tabla, delete: sql.includes(`BEFORE DELETE ON "${tabla}"`) }).toEqual({ tabla, delete: true })
    }
  })
})

describe("F5-A — migraciones con fin de línea canónico (Windows / Linux)", () => {
  test(".gitattributes fija LF para las migraciones; todo blob indexado es LF; las migraciones nuevas son LF en disco", () => {
    expect(read(".gitattributes")).toContain("prisma/migrations/**/*.sql text eol=lf")
    const eol = execFileSync("git", ["ls-files", "--eol", "prisma/migrations"], { cwd: root, encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean)
    expect(eol.length).toBeGreaterThan(50)
    for (const linea of eol) expect({ linea, indexLf: /^i\/(lf|none)\s/.test(linea) }).toEqual({ linea, indexLf: true })
    const bytes = readFileSync(join(root, MIGRATION))
    expect(bytes.includes(13)).toBe(false)
    expect(bytes.at(-1)).toBe(10)
    expect(bytes.at(-2)).not.toBe(10)
  })
})
