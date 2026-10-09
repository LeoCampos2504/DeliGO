// ============================================
// F10-B1 — área "caja" rules + static contract of the cashier surfaces
// ============================================
// Pure unit checks of the área helper plus source-level invariants: the cashier
// routes authenticate only through the personal session + área "caja", reuse
// the single F10-B0 engine with a server-derived EMPLEADO actor, REQUIRE the
// Idempotency-Key, never let the body choose identity/prices, and never read
// business-wide sales, cash, ledger or reservation data (blind-close safety for
// F10-B2). No schema change in B1.
import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import {
  AREA_CAJA_RUBRO,
  AREA_OPERATIVA_VALUES,
  areaOperativaDisponibleEnNegocio,
  areaOperativaRequiereSalon,
  normalizeAreaOperativa,
  resolveAreaOperativaEfectiva,
} from "@/lib/area-operativa"
import { STOCK_LIFECYCLE_RUBRO } from "@/lib/stock-authority"

const root = process.cwd()
const read = (p: string) => readFileSync(join(root, p), "utf8")

const CASHIER_CATALOG = "src/app/api/operativo/caja/[slug]/productos/route.ts"
const CASHIER_SALE = "src/app/api/operativo/caja/[slug]/ventas/route.ts"
const CASHIER_HELPERS = "src/lib/operativo-caja.ts"
const CASHIER_PAGE = "src/app/operaciones/mi-panel/[slug]/caja/page.tsx"
const CATALOG_HELPER = "src/lib/caja-catalogo.ts"
const ENGINE = "src/lib/caja-venta-service.ts"
const CASHIER_FILES = [CASHIER_CATALOG, CASHIER_SALE, CASHIER_HELPERS, CASHIER_PAGE]

describe("F10-B1 — área caja (pure helper)", () => {
  test("caja is a real área: allowlisted, resolved as itself, unknown values still deny", () => {
    expect(AREA_OPERATIVA_VALUES).toContain("caja")
    expect(normalizeAreaOperativa("caja")).toBe("caja")
    expect(resolveAreaOperativaEfectiva({ areaOperativa: "caja", rol: "mozo" })).toBe("caja")
    expect(resolveAreaOperativaEfectiva({ areaOperativa: "CAJA", rol: "cajero" })).toBe("sin_asignar")
    expect(resolveAreaOperativaEfectiva({ areaOperativa: "sin_asignar", rol: "cajero" })).toBe("sin_asignar")
  })

  test("caja needs no Salón but only exists in generic businesses; other áreas keep their rules", () => {
    expect(areaOperativaRequiereSalon("caja")).toBe(false)
    expect(areaOperativaRequiereSalon("pyr")).toBe(false)
    expect(areaOperativaRequiereSalon("mozo")).toBe(true)
    expect(areaOperativaRequiereSalon("salon")).toBe(true)
    expect(areaOperativaRequiereSalon("sin_asignar")).toBe(true)
    expect(areaOperativaDisponibleEnNegocio("caja", { salonActivo: false, rubro: "negocio" })).toBe(true)
    expect(areaOperativaDisponibleEnNegocio("caja", { salonActivo: true, rubro: "restaurante" })).toBe(false)
    expect(areaOperativaDisponibleEnNegocio("caja", { salonActivo: true, rubro: "ropa" })).toBe(false)
    expect(areaOperativaDisponibleEnNegocio("caja", { salonActivo: false, rubro: null })).toBe(false)
    // unchanged: mozo/salon need Salón in any rubro, pyr never does
    expect(areaOperativaDisponibleEnNegocio("mozo", { salonActivo: false, rubro: "negocio" })).toBe(false)
    expect(areaOperativaDisponibleEnNegocio("mozo", { salonActivo: true, rubro: "restaurante" })).toBe(true)
    expect(areaOperativaDisponibleEnNegocio("salon", { salonActivo: true, rubro: "negocio" })).toBe(true)
    expect(areaOperativaDisponibleEnNegocio("pyr", { salonActivo: false, rubro: "restaurante" })).toBe(true)
  })

  test("the caja rubro is exactly the generic-business authority", () => {
    expect(AREA_CAJA_RUBRO).toBe(STOCK_LIFECYCLE_RUBRO)
  })

  test("local área allowlists stay in sync (employees API + owner UI); owner UI offers Caja only to generic businesses", () => {
    for (const path of ["src/app/api/negocio/empleados/route.ts", "src/app/api/negocio/empleados/[id]/route.ts"]) {
      const src = read(path)
      expect(src).toContain('const AREAS_OPERATIVAS = ["sin_asignar", "mozo", "salon", "pyr", "caja"] as const')
      expect(src).toContain("AREA_CAJA_RUBRO")
      expect(src).toContain("El área Caja sólo está disponible para negocios genéricos.")
    }
    const salonTab = read("src/components/business/salon-tab.tsx")
    expect(salonTab).toContain('{ value: "caja", label: "Caja" },')
    expect(salonTab).toContain('AREA_OPERATIVA_OPTIONS.filter((a) => a.value !== "caja" || rubro === "negocio")')
  })
})

describe("F10-B1 — cashier routes: authorization and identity", () => {
  test("both routes authorize ONLY via the personal session resolver with área caja", () => {
    for (const path of [CASHIER_CATALOG, CASHIER_SALE]) {
      const src = read(path)
      expect(src).toContain('const auth = await resolveOperativoAreaForSlug(req, slug, "caja")')
      expect(src).toContain("if (!auth.ok) return cajaAuthFailure(auth)")
      // no owner session, no shared terminals, no legacy role/permission system
      expect(src).not.toMatch(/SESSION_COOKIE_NAME|getUserFromToken|terminal-operativa|terminalOperativa|TerminalOperativa|\.rol\b|permisos/)
    }
    expect(read(CASHIER_HELPERS)).not.toMatch(/terminal-operativa|terminalOperativa|TerminalOperativa|\.rol\b|permisos/)
  })

  test("the sale route requires the key and delegates to the single engine with the session's EMPLEADO actor", () => {
    const src = read(CASHIER_SALE)
    expect(src).toContain('code: "IDEMPOTENCY_KEY_REQUIRED"')
    expect(src).toContain("if (!isValidVentaIdempotencyKey(rawKey)) {")
    expect(src).toContain("const result = await registrarVentaCaja(db, {")
    expect(src).toContain("negocioId: auth.negocio.id,")
    expect(src).toContain('actor: { tipo: "EMPLEADO", empleadoId: auth.empleado.id },')
    expect(src).toContain("parseVentaCajaRequestBody(")
    // the body can never choose business, employee, actor, prices, totals or a shift
    // (the request body is only ever handed to parseVentaCajaRequestBody)
    expect(src).not.toMatch(/(?<![.\w])body\.|negocioId:(?!\s*auth\.negocio\.id)|turnoId|precio|total:(?!\s*result\.venta\.total)/)
    expect(src.match(/req\.json\(/g)).toHaveLength(1)
    expect(src).toContain("parseVentaCajaRequestBody(await req.json().catch(() => null))")
    expect(src).not.toMatch(/\.venta\.create\(|runStockSerializable\(|\$transaction\(/)
  })

  test("engine: a replay is returned only to the same actor (different person, same key → 409)", () => {
    const src = read(ENGINE)
    expect(src).toContain("function sameActor(existing: VentaCajaConItems, actor: VentaCajaActor, negocioId: string): boolean {")
    expect(src).toContain("existing.idempotencyFingerprint === fingerprint && sameActor(existing, actor, negocioId)")
    expect(src.match(/replayOrConflict\(existing, fingerprint, actor, negocioId\)/g)).toHaveLength(2)
  })
})

describe("F10-B1 — blind-close safety (no business-wide data for the cashier)", () => {
  test("cashier code never reads sales lists, summaries, cobros, ledger, cash accounts or reservations", () => {
    for (const path of CASHIER_FILES) {
      const src = read(path)
      expect(src).not.toMatch(/\.venta\.(findMany|aggregate|groupBy|count)\(/)
      expect(src).not.toMatch(/\.(cobroVenta|operacionFinanciera|movimientoFinanciero|cuentaFinanciera|reservaStock|movimientoInventario)\./)
      expect(src).not.toMatch(/resumenHoy|ventasHoy(?!QueryKey: null)|efectivoEsperado|saldo/)
    }
  })

  test("cashier catalog: selling fields only, same availability authority as the owner", () => {
    const helper = read(CATALOG_HELPER)
    const select = helper.slice(helper.indexOf("export const CAJERO_PRODUCTO_SELECT"))
    const block = select.slice(0, select.indexOf("} as const"))
    expect(block).toContain("precio: true")
    expect(block).not.toMatch(/costo|descuento|negocioId|orden/)
    expect(read(CASHIER_CATALOG)).toContain("select: CAJERO_PRODUCTO_SELECT,")
    expect(read(CASHIER_CATALOG)).toContain("anotarDisponibilidadCaja(db, auth.negocio.id, productos, { rubro: auth.negocio.rubro })")
    expect(read("src/app/api/negocio/productos/route.ts")).toContain("await anotarDisponibilidadCaja(db, negocioId, productos)")
    // availability is never recomputed elsewhere in the cashier code
    for (const path of [CASHIER_CATALOG, CASHIER_SALE, CASHIER_HELPERS]) {
      expect(read(path)).not.toMatch(/leerReservasActivasPorClave|resolvePublicProductAvailability/)
    }
  })

  test("cashier sale response: own sale only", () => {
    const helpers = read(CASHIER_HELPERS)
    const fn = helpers.slice(helpers.indexOf("export function ventaParaCajero"))
    expect(fn).not.toMatch(/actorId|idempotency|cobros|negocioId|empleadoId/)
  })

  test("cashier page: VenderView with operativo endpoints only; never the owner's Caja/summary or owner APIs", () => {
    const page = read(CASHIER_PAGE)
    expect(page).toContain('import { VenderView, type CajaVenderSource } from "@/components/business/caja-tab"')
    expect(page).not.toMatch(/CajaTab|ResumenView|\/api\/negocio\//)
    expect(page).toContain("attemptScope: `operativo:${empleado.id}:${negocio.id}`")
    expect(page).toContain("ventasUrl: `/api/operativo/caja/${encodeURIComponent(negocio.slug)}/ventas`")
    expect(page).toContain("ventasHoyQueryKey: null")
    expect(page).toContain("categoriasUrl: null")
    // the owner-only summary stays private to caja-tab
    expect(read("src/components/business/caja-tab.tsx")).toMatch(/\nfunction ResumenView\(/)
  })

  test("personal home links área caja to the cashier page", () => {
    const home = read("src/app/mozo/page.tsx")
    expect(home).toContain('caja: "Caja",')
    expect(home).toContain('areaEfectiva === "caja" ? (')
    expect(home).toContain("/operaciones/mi-panel/${encodeURIComponent(vinculo.negocio.slug)}/caja")
  })
})

describe("F10-B1 — no schema change", () => {
  // F10-B2.0 added the next migration; the B1 invariant is that B1 itself
  // added none: the migration right after F10-B0's is F10-B2.0's.
  test("F10-B1 added no migration (F10-B0's is followed directly by F10-B2.0's)", () => {
    const migrations = readdirSync(join(root, "prisma/migrations")).filter((d) => /^\d{14}_/.test(d)).sort()
    const b0 = migrations.indexOf("20261009120000_f10_b0_sales_idempotency_payments_ledger")
    expect(b0).toBeGreaterThan(-1)
    expect(migrations[b0 + 1]).toBe("20261010120000_f10_b2_0_money_decimal_columns")
  })
})
