/// <reference types="bun-types" />
// F4-C5 (D5) — commercial attempts on this device: isolation, persistence, classification.

import { beforeEach, describe, expect, test } from "bun:test"
import {
  clasificarConfirmacion,
  clasificarVerificacion,
  contextoActor,
  guardarIntento,
  intentoVencido,
  leerIntento,
  listarIntentos,
  retirarIntento,
  type IntentoComercial,
} from "@/lib/caja-intento-comercial"

class MemoryStorage {
  private data = new Map<string, string>()
  get length() { return this.data.size }
  key(i: number) { return [...this.data.keys()][i] ?? null }
  getItem(k: string) { return this.data.has(k) ? this.data.get(k)! : null }
  setItem(k: string, v: string) { this.data.set(k, String(v)) }
  removeItem(k: string) { this.data.delete(k) }
  clear() { this.data.clear() }
}

const store = new MemoryStorage()
beforeEach(() => {
  store.clear()
  ;(globalThis as { window?: unknown }).window = { localStorage: store }
})

const owner = { negocioId: "neg-1", actor: contextoActor({ tipo: "NEGOCIO" }) }
const cajero = { negocioId: "neg-1", actor: contextoActor({ tipo: "EMPLEADO", empleadoId: "emp-1" }) }
const intento = (over: Partial<IntentoComercial> = {}): IntentoComercial => ({
  v: 1, tipo: "CAMBIO", ...owner, ventaOrigenId: "venta-1", ventaOrigenReferencia: "venta1", key: "6f1c2c4e-8a1b-4d3e-9f2a-4b7c0d1e2f30",
  cuerpo: "{\"a\":1}", resumen: { lineas: [] }, estado: "ENVIANDO", createdAt: 1, updatedAt: 1, ...over,
})

describe("F4-C5 — attempts stored on this device", () => {
  test("stored before sending, read back exactly, removed only on purpose", () => {
    expect(guardarIntento(intento())).toBe(true)
    expect(leerIntento(owner, "venta-1")).toEqual(intento())
    retirarIntento(owner, "venta-1")
    expect(leerIntento(owner, "venta-1")).toBeNull()
  })

  test("isolated per business, actor and origin sale: another session never sees it", () => {
    guardarIntento(intento())
    expect(leerIntento(cajero, "venta-1")).toBeNull()
    expect(leerIntento({ negocioId: "neg-2", actor: "NEGOCIO" }, "venta-1")).toBeNull()
    expect(leerIntento(owner, "venta-2")).toBeNull()
    guardarIntento(intento({ ...cajero, ventaOrigenId: "venta-9", createdAt: 5 }))
    expect(listarIntentos(owner).map((i) => i.ventaOrigenId)).toEqual(["venta-1"])
    expect(listarIntentos(cajero).map((i) => i.ventaOrigenId)).toEqual(["venta-9"])
  })

  test("a tampered or foreign entry is ignored, never reused", () => {
    store.setItem("deligo:caja:intento-comercial:v1:neg-1:NEGOCIO:venta-1", JSON.stringify({ ...intento(), actor: "EMPLEADO:otro" }))
    expect(leerIntento(owner, "venta-1")).toBeNull()
    store.setItem("deligo:caja:intento-comercial:v1:neg-1:NEGOCIO:venta-1", JSON.stringify({ ...intento(), key: "no-es-uuid" }))
    expect(leerIntento(owner, "venta-1")).toBeNull()
    store.setItem("deligo:caja:intento-comercial:v1:neg-1:NEGOCIO:venta-1", "{roto")
    expect(leerIntento(owner, "venta-1")).toBeNull()
  })

  test("if it cannot be stored, saving says so (then nothing is sent)", () => {
    ;(globalThis as { window?: unknown }).window = { get localStorage() { throw new Error("blocked") } }
    expect(guardarIntento(intento())).toBe(false)
    ;(globalThis as { window?: unknown }).window = { localStorage: { setItem() { throw new Error("quota") }, getItem: () => null } }
    expect(guardarIntento(intento())).toBe(false)
  })

  test("7-day review: overdue is flagged, never removed by reading or listing", () => {
    const viejo = intento({ createdAt: Date.now() - 8 * 86_400_000, estado: "INCIERTO" })
    guardarIntento(viejo)
    expect(intentoVencido(viejo)).toBe(true)
    expect(intentoVencido(intento({ createdAt: Date.now() }))).toBe(false)
    expect(listarIntentos(owner)).toHaveLength(1)
    expect(leerIntento(owner, "venta-1")).not.toBeNull()
  })
})

describe("F4-C5 — classification of answers", () => {
  test("confirmation: 2xx registered, 5xx / no answer uncertain, other 4xx definitively refused", () => {
    expect([200, 201].map(clasificarConfirmacion)).toEqual(["registrado", "registrado"])
    expect([null, 500, 502, 503].map(clasificarConfirmacion)).toEqual(["incierto", "incierto", "incierto", "incierto"])
    expect([400, 403, 404, 409].map(clasificarConfirmacion)).toEqual(["rechazado", "rechazado", "rechazado", "rechazado"])
  })

  test("verification: only REGISTRADO / NO_REGISTRADO / reused key are safe; everything else stays uncertain", () => {
    expect(clasificarVerificacion(200, { estado: "REGISTRADO" })).toBe("registrado")
    expect(clasificarVerificacion(200, { estado: "NO_REGISTRADO" })).toBe("no_registrado")
    expect(clasificarVerificacion(409, { code: "IDEMPOTENCY_KEY_REUSED" })).toBe("clave_usada")
    for (const [status, body] of [[null, null], [500, {}], [503, { code: "VERIFICACION_INCIERTA" }], [401, {}], [403, {}], [404, {}], [400, { code: "ESPERADO_INVALIDO" }], [200, {}], [409, { code: "OTRA" }]] as const) {
      expect(clasificarVerificacion(status, body)).toBe("incierto")
    }
  })
})
