// ============================================
// F10-C1c — static contract: owner supervision, compensations and reports (no database)
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

const SERVICE = "src/lib/caja-egresos-service.ts"
const HTTP = "src/lib/caja-egresos-http.ts"
const OWNER_UI = "src/components/business/owner-caja-egresos.tsx"
const CASHIER_UI = "src/components/business/caja-salidas-cajero.tsx"
const COMP_ROUTE = "src/app/api/negocio/caja/egresos/[id]/compensacion/route.ts"
const MIGRATION = "prisma/migrations/20261118150000_f10_c1c_block_post_close_compensation/migration.sql"

describe("F10-C1c — compensation: owner only, one writer, open shift only", () => {
  test("only the owner compensation route reaches the compensation, through the owner session", () => {
    expect(users(/compensarEgresoHttp|compensarEgresoCaja/)).toEqual([HTTP, COMP_ROUTE, SERVICE].sort())
    const route = read(COMP_ROUTE)
    expect(route).toContain("requireNegocioCajaGenerico(req)")
    expect(route).toContain("compensarEgresoHttp(req, auth.negocioId, id)")
    for (const { path } of productive.filter(({ path }) => path.startsWith("src/app/api/operativo/") || path.startsWith("src/app/operaciones/"))) {
      expect({ path, compensa: /compensar|compensacion\/|caja-egresos-http.*compensar/.test(read(path)) }).toEqual({ path, compensa: false })
    }
  })

  test("the engine locks the register first, requires the open shift and the physical-cash confirmation, and never edits the original", () => {
    const service = read(SERVICE)
    const fn = service.slice(service.indexOf("export async function compensarEgresoCaja("), service.indexOf("// Owner threshold configuration"))
    expect(fn).toContain("await lockCaja(tx, negocioId, base.cajaFisicaId)")
    expect(fn.indexOf("await lockCaja(tx, negocioId, base.cajaFisicaId)")).toBeLessThan(fn.indexOf('FROM "egresos_caja"'))
    expect(fn).toContain('if (turno?.estado !== TURNO_ESTADO_ABIERTO) return fail(409, COMPENSACION_POSTERIOR_TEXTO, "COMPENSACION_POSTERIOR_BLOQUEADA")')
    expect(fn).toContain("if (input.confirmoEfectivoEnCaja !== true)")
    expect(fn).toContain('momento: "TURNO_ABIERTO"')
    expect(fn).not.toContain('"POSTERIOR_AL_CIERRE"')
    expect(fn).not.toMatch(/\.egresoCaja\.(update|updateMany|upsert|delete)|\.movimientoFinanciero\.(update|delete)|\.operacionFinanciera\.(update|delete)/)
    expect(fn).toContain("if (opciones.auditar) await opciones.auditar(tx, { egreso: actualizado, compensacion })")
  })

  test("the SQL migration only replaces two guard functions and blocks the post-close compensation", () => {
    const raw = readFileSync(join(root, MIGRATION))
    expect(raw.includes(13)).toBe(false)
    const sql = raw.toString("utf8")
    expect(sql.match(/CREATE OR REPLACE FUNCTION/g)).toHaveLength(2)
    expect(sql).not.toMatch(/\bDROP\b|ALTER TABLE|CREATE TABLE|INSERT INTO|UPDATE "|DELETE\s+FROM|TRUNCATE/i)
    expect(sql.match(/after the close is blocked until the closing reconciliation/g)).toHaveLength(2)
  })
})

describe("F10-C1c — supervision never moves money; the cashier never sees private data", () => {
  test("reviews and confirmations write only history and state (no ledger writes in decidirEgreso)", () => {
    const service = read(SERVICE)
    const fn = service.slice(service.indexOf("async function decidirEgreso("), service.indexOf("/** Owner review: REVISADO"))
    expect(fn).not.toMatch(/operacionFinanciera|movimientoFinanciero|cuentaFinanciera/)
    expect(fn).toContain('"EGRESO_COMPENSADO"')
  })

  test("the cashier view exposes a read-only administrative state, never the raw confirmation, alerts or texts", () => {
    const service = read(SERVICE)
    const vista = service.slice(service.indexOf("export function egresoParaCajero("), service.indexOf("export interface FiltroEgresos"))
    expect(vista).toContain("estadoAdministrativo: estadoAdministrativoCajero(e, empleadoId)")
    expect(vista).not.toMatch(/confirmacionRetiroEstado:|alertas|esperado|justificacion|observacion|revisiones|compensacion:/)
    const estado = service.slice(service.indexOf("export function estadoAdministrativoCajero("), service.indexOf("/** Cashier view:"))
    expect(estado).toContain('if (e.actorTipo !== "EMPLEADO" || e.empleadoId !== empleadoId) return null')
    expect(estado).toContain('if (e.confirmacionRetiroEstado === "NO_RECIBIDO" || e.estadoRevision === "OBSERVADO") return "OBSERVADO" as const')
  })

  test("the owner panel is owner-side only: imported by the owner Caja tab, never by cashier code", () => {
    expect(users(/@\/components\/business\/owner-caja-egresos["']/)).toEqual(["src/components/business/caja-tab.tsx"])
    expect(read(CASHIER_UI)).not.toMatch(/owner-caja-egresos|api\/negocio\//)
    for (const { path, src } of productive.filter(({ path }) => path.startsWith("src/app/operaciones/") || path.startsWith("src/app/api/operativo/"))) {
      expect({ path, ownerUi: /owner-caja-egresos|owner-caja-desglose-turno/.test(src) }).toEqual({ path, ownerUi: false })
    }
  })
})

describe("F10-C1c — owner UI: explicit register and guarded financial actions", () => {
  const ui = read(OWNER_UI)

  test("the register is never chosen automatically and the owner sends the shift they saw", () => {
    expect(ui).toContain('useState(() => (abiertas.some((c) => c.id === cajaInicial) ? cajaInicial : ""))')
    expect(ui).not.toMatch(/abiertas\.length === 1 \?/)
    expect(ui).toContain("cajaFisicaId: caja.id, turnoCajaId: caja.turnoAbierto.id")
    expect(ui).toContain('if (r.code === "TURNO_CAMBIO"')
  })

  test("financial actions: one key per exact content, kept on network error / 5xx, guarded against double click", () => {
    expect(ui.match(/if \(!r\.incierto\) intentos\.olvidar\(canonico\)/g)).toHaveLength(2)
    expect(ui.match(/if \(enCurso\.current/g)?.length).toBeGreaterThanOrEqual(2)
    expect(ui).toContain('"Idempotency-Key": key')
  })

  test("the panel keeps room for the install notice and hides the floating chat / notice while a financial form is open", () => {
    expect(ui).toContain('export const RESERVA_AVISO_INSTALACION = "calc(var(--deligo-install-prompt-h, 0px) + 1rem)"')
    expect(ui).toContain('aria-labelledby="egresos-caja-titulo" style={{ paddingBottom: RESERVA_AVISO_INSTALACION }}')
    expect(ui).toContain('document.body.dataset.cajaSalidaActiva = "true"')
    expect(read("src/app/globals.css")).toContain('body[data-caja-salida-activa="true"] .deligo-install-prompt')
  })

  test("compensation needs a motive, the physical-cash confirmation and a second explicit confirmation", () => {
    const form = ui.slice(ui.indexOf("function FormCompensacion("), ui.indexOf("// Owner registration"))
    expect(form).toContain("const listo = motivo.trim().length > 0 && efectivoEnCaja")
    expect(form).toContain("if (!confirmando) { setConfirmando(true); return }")
    expect(form).toContain("confirmoEfectivoEnCaja: true")
  })
})
