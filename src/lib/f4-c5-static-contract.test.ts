/// <reference types="bun-types" />
// ============================================
// F4-C5 — static guarantees (source contracts)
// ============================================
// (1) a verification never performs a commercial operation; (2) blind close:
// the owner-only breakdowns never reach cashier code; (3) each route keeps its
// authentication; (4) the selling view in selection mode never touches the
// checkout attempt; (5) the UI stores the attempt BEFORE sending and sends the
// quoted amounts as received; (6) the F4-C5 migration only ADDS objects.

import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const ROOT = process.cwd()
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8").replace(/\r\n/g, "\n")
function walk(dir: string): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const rel = join(dir, name)
    return statSync(join(ROOT, rel)).isDirectory() ? walk(rel) : [relative(ROOT, join(ROOT, rel)).replace(/\\/g, "/")]
  })
}
const productivos = walk("src").filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.(ts|tsx)$/.test(f))

/** Source of a top-level function, from its declaration to the next top-level declaration. */
function cuerpo(src: string, firma: string): string {
  const i = src.indexOf(firma)
  if (i < 0) throw new Error(`no encontrado: ${firma}`)
  const resto = src.slice(i + firma.length)
  const fin = resto.search(/\n(export )?(async )?function |\nconst |\nexport const /)
  return resto.slice(0, fin < 0 ? undefined : fin)
}

describe("F4-C5 — static guarantees", () => {
  test("a verification never registers anything: no engine, no exchange, no credit", () => {
    const src = read("src/lib/caja-cambios-service.ts")
    for (const firma of ["export async function verificarCambioVentaEnTx(", "export async function verificarVentaAdicionalEnTx(", "async function cerrarIntentoEnTx(", "async function correrVerificacion<T>("]) {
      const body = cuerpo(src, firma)
      expect(body).not.toMatch(/registrarDevolucionVentaEnTx\(|registrarVentaCajaEnTx\(|registrarCreditoCambioEnTx\(|registrarCambioVentaEnTx\(|registrarVentaAdicionalEnTx\(|motor\(|cambioVenta\.create|venta\.create|cobroVenta|operacionFinanciera|movimientoInventario/)
    }
    // the only write of a verification is the closure row (+ its audit)
    expect(cuerpo(src, "async function cerrarIntentoEnTx(")).toContain("tx.intentoCajaComercial.create(")
    // the registrations refuse a closed key right after their replay
    expect(src.match(/rechazoIntentoCerrado\(/g)).toHaveLength(4) // definition + exchange tx + exchange catch + additional tx
  })

  test("blind close: owner-only breakdowns are imported only by owner routes, never by cashier code", () => {
    const importadores = (modulo: string) => productivos.filter((f) => read(f).includes(`from "@/lib/${modulo}"`))
    expect(importadores("caja-resumen-cambios")).toEqual(["src/app/api/negocio/caja/ventas/route.ts"])
    for (const f of productivos.filter((f) => f.startsWith("src/app/api/operativo/") || f.startsWith("src/app/operaciones/") || f === "src/lib/operativo-caja.ts")) {
      const src = read(f)
      expect(src).not.toContain("caja-resumen-cambios")
      expect(src).not.toContain("caja-resumen-cobros")
      expect(src).not.toMatch(/resumenCambiosTurnos?\(/)
      expect(src).not.toContain("configuracion-cambios")
    }
  })

  test("each new route keeps its authentication (owner session / cashier área caja)", () => {
    const owner = ["cambios/verificacion", "adicionales/verificacion", "cadena"].map((s) => `src/app/api/negocio/caja/ventas/[id]/${s}/route.ts`).concat(["src/app/api/negocio/caja/configuracion-cambios/route.ts"])
    for (const f of owner) expect(read(f)).toContain("await requireNegocioCajaGenerico(req)")
    for (const s of ["cambios/verificacion", "adicionales/verificacion", "cadena"]) {
      const src = read(`src/app/api/operativo/caja/[slug]/ventas/[id]/${s}/route.ts`)
      expect(src).toContain('resolveOperativoAreaForSlug(req, slug, "caja")')
      expect(src).toContain("noStore(")
    }
  })

  test("selection mode of the selling view never reads, keeps or sends a checkout attempt", () => {
    const src = read("src/components/business/caja-tab.tsx")
    expect(src).toContain("useState<PendingCheckoutAttempt | null>(() => (seleccion ? null : readPendingAttempt(source.attemptScope)))")
    const abrir = cuerpo(src, "  function openCheckout() {")
    expect(abrir.indexOf("if (seleccion) {")).toBeLessThan(abrir.indexOf("setCheckoutOpen(true)"))
    expect(abrir.slice(abrir.indexOf("if (seleccion) {"), abrir.indexOf("setCheckoutOpen(true)"))).toContain("seleccion.onConfirmar(cart)")
  })

  test("the UI stores the attempt BEFORE sending and sends the quoted amounts exactly as received", () => {
    const src = read("src/components/business/caja-cambios.tsx")
    const confirmar = cuerpo(src, "function useConfirmar(")
    expect(confirmar.indexOf("if (!guardarIntento(intento)) {")).toBeGreaterThan(0)
    expect(confirmar.indexOf("if (!guardarIntento(intento)) {")).toBeLessThan(confirmar.indexOf("await fetch(url"))
    expect(src).toContain("const cotizados = { salida: vigente.importes.salida, entrada: vigente.importes.entrada }")
    expect(src).toContain("      esperado: cotizados,\n")
    // verification resends the stored key and body, never a new one
    expect(src).toContain('headers: { "Content-Type": "application/json", "Idempotency-Key": intento.key }, body: intento.cuerpo')
    expect(src).not.toMatch(/localStorage\.(setItem|removeItem|clear)/) // only through the attempt module
  })

  test("the F4-C5 migration only adds objects (no historical object is dropped or altered)", () => {
    const sql = read("prisma/migrations/20261110120000_f4_c5_commercial_attempt_claims/migration.sql")
    expect(sql).not.toMatch(/\bDROP\b/i)
    for (const m of sql.matchAll(/ALTER TABLE "([^"]+)"/g)) expect(m[1]).toBe("intentos_caja_comerciales")
    expect(sql).toContain('CONSTRAINT "intentos_caja_comerciales_pkey" PRIMARY KEY ("negocioId","idempotencyKey")')
  })
})
