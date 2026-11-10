/// <reference types="bun-types" />

// F4-C4 — pure parts of the exchange service (unit, no database): request
// parsing, fingerprint, derived inner keys, informative warnings (P1) and the
// static guarantees that keep ONE sales engine and ONE return writer.

import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { Prisma } from "@prisma/client"
import {
  calcularAdvertenciasCambio,
  clavesInternasCambio,
  describirAdvertencias,
  fingerprintCambio,
  parseCambioBody,
  umbralesAvisoCambio,
  uuidV5,
} from "@/lib/caja-cambios-service"
import { isValidVentaIdempotencyKey } from "@/lib/caja-venta"

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8").replace(/\r\n/g, "\n")
const base = {
  motivo: "Cambio de talle",
  salen: [{ ventaItemId: "item-1", cantidad: 1, reingresaStock: true }],
  entran: [{ productoId: "prod-2", cantidad: 2 }],
  esperado: { salida: "2000.00", entrada: "2000.00" },
  confirmo: true,
}

describe("F4-C4 — parseCambioBody", () => {
  test("valid exchange: F4-A rules for what goes out, Caja sale rules for what comes in", () => {
    const r = parseCambioBody({ ...base, medioDiferencia: "EFECTIVO", reintegro: { modo: "PENDIENTE" }, esperado: { salida: "2000.00", entrada: 3500 } }, "REGISTRAR")
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.salen[0].cantidad?.toString()).toBe("1")
    expect(r.value.entran).toEqual([{ productoId: "prod-2", varianteId: undefined, cantidad: 2 }])
    expect(r.value.medioDiferencia).toBe("EFECTIVO")
    expect(r.value.reintegro).toEqual({ modo: "PENDIENTE" })
    expect(r.value.esperado?.entrada.toFixed(2)).toBe("3500.00")
  })

  test("refusals: nothing in/out, no confirmation, unknown method, NO_CORRESPONDE refund, prices from the client are ignored", () => {
    expect(parseCambioBody({ ...base, salen: [] }, "REGISTRAR")).toMatchObject({ ok: false, code: "SALEN_INVALIDOS" })
    expect(parseCambioBody({ ...base, entran: [] }, "REGISTRAR")).toMatchObject({ ok: false, code: "ENTRAN_INVALIDOS" })
    expect(parseCambioBody({ ...base, confirmo: false }, "REGISTRAR")).toMatchObject({ ok: false, code: "CONFIRMACION_CAMBIO_REQUERIDA" })
    expect(parseCambioBody({ ...base, medioDiferencia: "CREDITO_CAMBIO" }, "REGISTRAR")).toMatchObject({ ok: false, code: "MEDIO_DIFERENCIA_INVALIDO" })
    expect(parseCambioBody({ ...base, medioDiferencia: "CAMBIO" }, "REGISTRAR")).toMatchObject({ ok: false, code: "MEDIO_DIFERENCIA_INVALIDO" })
    expect(parseCambioBody({ ...base, reintegro: { modo: "NO_CORRESPONDE" } }, "REGISTRAR")).toMatchObject({ ok: false, code: "REINTEGRO_INVALIDO" })
    expect(parseCambioBody({ ...base, salen: [{ ventaItemId: "item-1", cantidad: 0, reingresaStock: true }] }, "REGISTRAR")).toMatchObject({ ok: false, code: "CANTIDAD_DEVOLUCION_INVALIDA" })
    expect(parseCambioBody({ ...base, motivo: " " }, "REGISTRAR")).toMatchObject({ ok: false, code: "MOTIVO_DEVOLUCION_REQUERIDO" })
    expect(parseCambioBody({ ...base, esperado: { salida: "-1", entrada: "1" } }, "REGISTRAR")).toMatchObject({ ok: false, code: "ESPERADO_INVALIDO" })
    const conPrecio = parseCambioBody({ ...base, entran: [{ productoId: "prod-2", cantidad: 1, precio: 1, total: 1 }] }, "REGISTRAR")
    expect(conPrecio.ok && JSON.stringify(conPrecio.value)).not.toContain("precio")
  })

  test("a quote needs no confirmation, no motive and no quoted amounts", () => {
    const { motivo: _m, confirmo: _c, esperado: _e, ...sinConfirmar } = base
    void _m
    void _c
    void _e
    expect(parseCambioBody(sinConfirmar, "COTIZAR").ok).toBe(true)
  })

  test("H1 — a confirmation REQUIRES the quoted amounts, exact decimals only (never rounded floats)", () => {
    const { esperado: _e, ...sinEsperado } = base
    void _e
    expect(parseCambioBody(sinEsperado, "REGISTRAR")).toMatchObject({ ok: false, status: 400, code: "ESPERADO_REQUERIDO" })
    expect(parseCambioBody({ ...base, esperado: null }, "REGISTRAR")).toMatchObject({ ok: false, code: "ESPERADO_REQUERIDO" })
    expect(parseCambioBody({ ...base, esperado: { salida: "2000.00" } }, "REGISTRAR")).toMatchObject({ ok: false, code: "ESPERADO_INVALIDO" })
    expect(parseCambioBody({ ...base, esperado: { salida: "2000.001", entrada: "1" } }, "REGISTRAR")).toMatchObject({ ok: false, code: "ESPERADO_INVALIDO" })
    // 0.1 + 0.2 as a JS number is 0.30000000000000004: refused, never rounded to 0.30.
    expect(parseCambioBody({ ...base, esperado: { salida: 0.1 + 0.2, entrada: "1" } }, "REGISTRAR")).toMatchObject({ ok: false, code: "ESPERADO_INVALIDO" })
    const numeros = parseCambioBody({ ...base, esperado: { salida: 2000, entrada: 2000.5 } }, "REGISTRAR")
    expect(numeros.ok && [numeros.value.esperado!.salida.toFixed(2), numeros.value.esperado!.entrada.toFixed(2)]).toEqual(["2000.00", "2000.50"])
    const texto = parseCambioBody(base, "REGISTRAR")
    expect(texto.ok && texto.value.esperado!.salida.equals(new Prisma.Decimal("2000"))).toBe(true)
  })
})

describe("F4-C4 — fingerprint and derived keys", () => {
  const s = (over: Record<string, unknown> = {}) => {
    const r = parseCambioBody({ ...base, ...over }, "REGISTRAR")
    if (!r.ok) throw new Error(r.error)
    return r.value
  }
  test("order-insensitive, actor- and content-sensitive", () => {
    const a = s({ entran: [{ productoId: "a", cantidad: 1 }, { productoId: "b", cantidad: 2 }] })
    const b = s({ entran: [{ productoId: "b", cantidad: 2 }, { productoId: "a", cantidad: 1 }] })
    expect(fingerprintCambio("n", "v", a, { tipo: "NEGOCIO" })).toBe(fingerprintCambio("n", "v", b, { tipo: "NEGOCIO" }))
    expect(fingerprintCambio("n", "v", a, { tipo: "NEGOCIO" })).not.toBe(fingerprintCambio("n", "v", a, { tipo: "EMPLEADO", empleadoId: "e" }))
    expect(fingerprintCambio("n", "v", a, { tipo: "NEGOCIO" })).not.toBe(fingerprintCambio("n", "v", s({ medioDiferencia: "EFECTIVO" }), { tipo: "NEGOCIO" }))
  })
  test("UUIDv5 (RFC 4122 vector) and deterministic inner keys accepted as Idempotency-Keys", () => {
    expect(uuidV5("www.example.com", "6ba7b810-9dad-11d1-80b4-00c04fd430c8")).toBe("2ed6657d-e927-568b-95e1-2665a8aea6a2")
    const k1 = clavesInternasCambio("negocio", "11111111-1111-4111-8111-111111111111")
    const k2 = clavesInternasCambio("negocio", "11111111-1111-4111-8111-111111111111")
    expect(k1).toEqual(k2)
    expect(k1.devolucion).not.toBe(k1.venta)
    expect(isValidVentaIdempotencyKey(k1.devolucion) && isValidVentaIdempotencyKey(k1.venta)).toBe(true)
    expect(clavesInternasCambio("otro", "11111111-1111-4111-8111-111111111111").venta).not.toBe(k1.venta)
  })
})

describe("F4-C4 — P1 informative warnings", () => {
  const ahora = new Date("2026-11-09T12:00:00Z")
  const dia = 86_400_000
  const p = (over: Partial<Parameters<typeof calcularAdvertenciasCambio>[0]> = {}) =>
    calcularAdvertenciasCambio({ ahora, ventaCreadaEn: ahora, cambiosPrevios: 0, umbralAntiguedadDias: 30, umbralCadenaCambios: 3, lineasPrecioHeredado: [], ventaCorregida: false, turnoOrigenCerrado: false, ...over })
  test("defaults 30 days / 3 previous exchanges, configurable per business", () => {
    expect(umbralesAvisoCambio(null)).toEqual({ antiguedadDias: 30, cadenaCambios: 3 })
    expect(umbralesAvisoCambio({ cambioAvisoAntiguedadDias: 7, cambioAvisoCadenaCambios: null })).toEqual({ antiguedadDias: 7, cadenaCambios: 3 })
  })
  test("more than 30 days; 3 or more previous exchanges; inherited price, corrected sale, closed shift", () => {
    expect(p().items).toEqual([])
    expect(p({ ventaCreadaEn: new Date(ahora.getTime() - 30 * dia) }).items).toEqual([])
    expect(p({ ventaCreadaEn: new Date(ahora.getTime() - 31 * dia) }).items).toEqual([{ codigo: "VENTA_ANTIGUA", nivel: "INFO", datos: { dias: 31 }, umbral: 30 }])
    expect(p({ cambiosPrevios: 2 }).items).toEqual([])
    expect(p({ cambiosPrevios: 3 }).items.map((a) => a.codigo)).toEqual(["CADENA_LARGA"])
    const todas = p({ ventaCreadaEn: new Date(ahora.getTime() - 40 * dia), cambiosPrevios: 5, lineasPrecioHeredado: ["Redmi"], ventaCorregida: true, turnoOrigenCerrado: true })
    expect(todas.version).toBe(1)
    expect(todas.items.every((a) => a.nivel === "INFO")).toBe(true)
    expect(todas.items.map((a) => a.codigo)).toEqual(["VENTA_ANTIGUA", "CADENA_LARGA", "PRECIO_HEREDADO", "VENTA_CORREGIDA", "VENTA_DE_TURNO_CERRADO"])
    expect(describirAdvertencias(todas)).toHaveLength(5)
  })
})

describe("F4-C4 — static guarantees", () => {
  const service = read("src/lib/caja-cambios-service.ts")
  test("the exchange service composes the existing writers; it never writes sales, cobros, ledger or stock itself", () => {
    expect(service).toContain("registrarDevolucionVentaEnTx(tx, {")
    expect(service).toContain("registrarVentaCajaEnTx(tx, {")
    expect(service).toContain("registrarCreditoCambioEnTx(tx, {")
    expect(service).not.toMatch(/\.(venta|ventaItem|cobroVenta|operacionFinanciera|movimientoFinanciero|cuentaFinanciera|movimientoInventario|devolucionVenta|devolucionVentaItem|reservaStock)\.(create|createMany|update|updateMany|upsert|delete)\(/)
    expect(service).not.toMatch(/stockCantidad/)
  })
  test("one dedicated executor; the existing runners keep their policy", () => {
    expect(service).toContain("ejecutarSerializableCambio")
    expect(service).not.toMatch(/runSerializable\(|runStockSerializable\(/)
    expect(read("src/lib/stock-lifecycle.ts")).toContain("export const STOCK_SERIALIZABLE_MAX_ATTEMPTS = 3")
    expect(read("src/lib/caja-devoluciones-service.ts")).toContain("if (!isStockSerializationConflict(error) || attempt >= 8) throw error")
  })
  test("a normal Caja sale still refuses CAMBIO / CREDITO_CAMBIO and never carries a link", () => {
    const engine = read("src/lib/caja-venta-service.ts")
    expect(engine).toContain("if ((input.metodoPago === METODO_PAGO_VENTA_CAMBIO) !== (input.vinculo?.tipo === \"CAMBIO\")) {")
    expect(engine).toContain("ventaOrigenId: input.vinculo?.ventaOrigenId ?? null,")
    expect(read("src/lib/caja-venta.ts")).toContain('export const METODOS_PAGO_VENTA = ["EFECTIVO", "TRANSFERENCIA", "OTRO"] as const')
  })
  test("H3-I — the 3 shift-attribution sites of the engine: all after the shift validation; the 3rd ONLY in the exchange branch", () => {
    const engine = read("src/lib/caja-venta-service.ts")
    const core = engine.slice(engine.indexOf("export async function registrarVentaCajaEnTx("), engine.indexOf("export async function registrarCreditoCambioEnTx("))
    const sites = [...core.matchAll(/\n\s+turnoCajaId,\n/g)].map((m) => m.index!)
    expect(sites).toHaveLength(3)
    // every site comes after the cash-account resolution and the shift validation (open, same register, responsible, OBLIGATORIO)
    const cuenta = core.indexOf('const cuentaEfectivoId = metodoPago !== "EFECTIVO"')
    const turnoValidado = core.indexOf("...(!ownerSharesEmployeeShift ? { responsableTipo: actor.tipo, responsableId: actorId } : {}),")
    const obligatorio = core.indexOf("if (negocio?.cajaTurnosModo === CAJA_TURNOS_MODO_OBLIGATORIO) {")
    expect(Math.min(cuenta, turnoValidado, obligatorio)).toBeGreaterThan(0)
    for (const site of sites) expect(site).toBeGreaterThan(Math.max(cuenta, turnoValidado, obligatorio))
    const ventaCreate = core.indexOf("const venta = await tx.venta.create({")
    const ramaCambio = core.indexOf("\n  if (cambio) {\n")
    const finRama = core.indexOf('if (!metodoPago) throw new Error("A normal Caja sale always has its payment method")')
    expect(ventaCreate).toBeGreaterThan(0)
    expect(sites[0]).toBeGreaterThan(ventaCreate) // 1: the Venta row
    expect(sites[0]).toBeLessThan(ramaCambio)
    expect(sites[1]).toBeGreaterThan(ramaCambio) // 2: the D+ cash operation, inside the exchange branch
    expect(sites[1]).toBeLessThan(finRama)
    expect(sites[2]).toBeGreaterThan(finRama) // 3: the normal sale's cash operation
    // the exchange branch charges only D+ and returns before the normal cobro; it never touches the total
    const rama = core.slice(ramaCambio, finRama)
    expect(rama).toContain("importe: moneyToNumber(cambio.diferencia),")
    expect(rama).toContain("cobroVentaId: cobroDiferencia.id,")
    expect(rama).toContain("return { ok: true as const, replayed: false, venta }")
    expect(rama).not.toContain("totalExacto")
  })

  test("the credit cobro is never money: NO_APLICA, no ledger operation in its writer", () => {
    const engine = read("src/lib/caja-venta-service.ts")
    const writer = engine.slice(engine.indexOf("export async function registrarCreditoCambioEnTx("), engine.indexOf("// F10-B1 — request body parsing"))
    expect(writer).toContain("metodo: METODO_COBRO_CREDITO_CAMBIO,")
    expect(writer).toContain('estadoConciliacion: "NO_APLICA",')
    expect(writer).not.toMatch(/operacionFinanciera|cuentaFinanciera/)
  })
  test("routes take negocio and actor only from the session", () => {
    for (const path of [
      "src/app/api/negocio/caja/ventas/[id]/cambios/route.ts",
      "src/app/api/negocio/caja/ventas/[id]/cambios/cotizacion/route.ts",
      "src/app/api/negocio/caja/ventas/[id]/adicionales/route.ts",
    ]) {
      const src = read(path)
      expect(src).toContain("requireNegocioCajaGenerico(req)")
      expect(src).toContain('{ tipo: "NEGOCIO" }')
    }
    for (const path of [
      "src/app/api/operativo/caja/[slug]/ventas/[id]/cambios/route.ts",
      "src/app/api/operativo/caja/[slug]/ventas/[id]/cambios/cotizacion/route.ts",
      "src/app/api/operativo/caja/[slug]/ventas/[id]/adicionales/route.ts",
    ]) {
      const src = read(path)
      expect(src).toContain('resolveOperativoAreaForSlug(req, slug, "caja")')
      expect(src).toContain('{ tipo: "EMPLEADO", empleadoId: auth.empleado.id }')
      expect(src).not.toMatch(/body\.|req\.json/)
    }
  })
  test("money amounts are exact decimals (no float arithmetic on amounts)", () => {
    expect(service).not.toMatch(/importe[A-Za-z]*\s*[+-]\s*\d|\.toNumber\(\)\s*[+-]/)
    expect(new Prisma.Decimal("0.1").plus("0.2").toFixed(2)).toBe("0.30")
  })
})
