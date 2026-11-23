// ============================================
// F10-C2b — contrato estático: interfaces de recepción (sin base de datos)
// ============================================
import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8")
const PAGINA_CAJERO = read("src/app/operaciones/mi-panel/[slug]/recepciones/page.tsx")
const EDITOR = read("src/components/business/recepcion-editor.tsx")
const PAGO = read("src/components/business/recepcion-pago-efectivo.tsx")
const DUENO = read("src/components/business/owner-compras.tsx")
const sinComentarios = (s: string) => s.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "")

describe("F10-C2b — privacidad del cajero", () => {
  test("la pantalla del cajero sólo usa rutas operativas y nunca muestra saldos, anticipos, deuda ni esperado de Caja", () => {
    const codigo = sinComentarios(PAGINA_CAJERO)
    const urls = [...codigo.matchAll(/`([^`]*\/api\/[^`]*)`/g)].map((m) => m[1])
    expect(urls.length).toBeGreaterThan(0)
    for (const u of urls) expect({ u, operativa: u.includes("/api/operativo/") || u.startsWith("${base}") }).toEqual({ u, operativa: true })
    expect(codigo).toContain("const base = `/api/operativo/caja/${encodeURIComponent(slug)}`")
    for (const src of [codigo, sinComentarios(PAGO)]) {
      expect(src).not.toMatch(/\/api\/negocio\//)
      expect(src).not.toMatch(/saldoNeto|deudaExigible|saldoAFavor|anticiposDisponibles|efectivoEsperado|totalObligacion|totalesAprobacion/)
    }
    // el editor compartido declara el tipo del detalle, pero nunca lo muestra ni consulta rutas del dueño
    expect(sinComentarios(EDITOR)).not.toMatch(/\.totalesAprobacion|\.totalObligacion|\/api\/negocio\/|saldoNeto|deudaExigible|anticiposDisponibles|efectivoEsperado/)
  })

  test("aprobar, rechazar y devolver no existen en la pantalla del cajero", () => {
    expect(sinComentarios(PAGINA_CAJERO)).not.toMatch(/aprobacion|"rechazo"|"devolucion"|vista-previa/)
  })
})

describe("F10-C2b — pago en efectivo al recibir (D-7)", () => {
  test("se registra SÓLO por la salida PAGO_PROVEEDOR de F10-C1 (con Idempotency-Key y confirmación); el cajero nunca vincula ni crea créditos", () => {
    const src = sinComentarios(PAGO)
    expect(src).toContain('naturaleza: "PAGO_PROVEEDOR"')
    expect(src).toContain("newIdempotencyKey()")
    expect(src).toContain("if (!confirmo)")
    expect(src).not.toMatch(/creditos\/caja|\/creditos|asignaciones|operacionFinanciera|movimientoFinanciero/)
    expect(sinComentarios(PAGINA_CAJERO)).toContain("egresosUrl={`${base}/egresos`}")
    expect(sinComentarios(PAGINA_CAJERO)).toContain("pagosUrl={`${base}/recepciones/${encodeURIComponent(detalle.id)}/pagos`}")
  })

  test("D-7 v2: el pago sale UNA vez por registrarEgresoCaja (F10-C1) y se asocia a la recepción DENTRO de esa transacción; el dueño nunca crea movimientos", () => {
    const http = sinComentarios(read("src/lib/recepcion-pagos-http.ts"))
    expect(http).toContain("registrarEgresoCaja(db, { negocioId, actor: { tipo: \"EMPLEADO\", empleadoId }, solicitud")
    const hook = http.slice(http.indexOf("auditar: async (tx, egreso) => {"), http.indexOf("if (!result.ok) return failure(result)"))
    expect(hook).toContain("asociarPagoEnTx(tx,")
    expect(http).not.toMatch(/movimientoFinanciero\.create|operacionFinanciera\.create|egresoCaja\.create/)
    // al aprobar: crédito de F5 + asignación con el motor único, en la transacción de la aprobación
    const aprob = sinComentarios(read("src/lib/compras-recepciones-service.ts"))
    expect(aprob).toContain("await bloquearPagosEnTx(tx, negocioId, recepcionId)")
    expect(aprob).toContain("planificarPagosEnTx(tx,")
    expect(aprob).toContain("await marcarAcreditadosEnTx(tx,")
    const src = sinComentarios(DUENO)
    expect(src).toContain("/api/negocio/recepciones/${recepcionId}/pagos")
    expect(src).toContain("esReferenciaDeRecepcion(p.comprobante, numero)")
    expect(src).not.toMatch(/\/api\/negocio\/caja\/egresos|\/egresos"|\/creditos\/caja/)
  })
})

describe("F10-C2b — aprobación del dueño", () => {
  test("envía la versión vista y confirmaciones explícitas; nunca aprueba sin confirmar los importes", () => {
    const src = sinComentarios(DUENO)
    expect(src).toContain("version: v.version")
    expect(src).toContain("return o.confirmoImportes")
    expect(src).toContain('disabled={accion.enviando || !puedeAprobar(vista, confirmos)')
    expect(src).toContain("/aprobacion`")
  })
})
