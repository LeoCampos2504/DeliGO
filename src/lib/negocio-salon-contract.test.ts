/// <reference types="bun-types" />
// ============================================
// DeliGO — Tests: capacidad de Salón del negocio (Tarea 20)
// ============================================
// Puro: sin red, sin DB, sin React.

import { describe, test, expect } from "bun:test"
import { tieneSalonHabilitado, mensajeBloqueoDesactivacionSalon, ESTADOS_PENDIENTES_MESA } from "./negocio-salon-contract"

describe("Tarea 20 — tieneSalonHabilitado (deny-by-default)", () => {
  test("salonActivo === true -> habilitado", () => {
    expect(tieneSalonHabilitado({ salonActivo: true })).toBe(true)
  })

  test("salonActivo === false -> deshabilitado", () => {
    expect(tieneSalonHabilitado({ salonActivo: false })).toBe(false)
  })

  test("negocio null/undefined -> deshabilitado, nunca lanza", () => {
    expect(tieneSalonHabilitado(null)).toBe(false)
    expect(tieneSalonHabilitado(undefined)).toBe(false)
  })

  test("valores no estrictamente true (string, número, undefined, null) -> deshabilitado", () => {
    expect(tieneSalonHabilitado({ salonActivo: "true" })).toBe(false)
    expect(tieneSalonHabilitado({ salonActivo: 1 })).toBe(false)
    expect(tieneSalonHabilitado({ salonActivo: undefined })).toBe(false)
    expect(tieneSalonHabilitado({ salonActivo: null })).toBe(false)
  })
})

describe("Tarea 20 — mensajeBloqueoDesactivacionSalon (allowlist cerrada, nunca detalles internos)", () => {
  test("ocupacion_activa", () => {
    expect(mensajeBloqueoDesactivacionSalon("ocupacion_activa")).toBe(
      "No podés desactivar el salón mientras haya mesas ocupadas. Cerrá las cuentas abiertas primero."
    )
  })

  test("pedidos_pendientes", () => {
    expect(mensajeBloqueoDesactivacionSalon("pedidos_pendientes")).toBe(
      "No podés desactivar el salón mientras haya pedidos de mesa pendientes. Entregalos o cancelalos primero."
    )
  })

  test("nunca contiene ids, SQL ni palabras de detalle Prisma", () => {
    for (const code of ["ocupacion_activa", "pedidos_pendientes"] as const) {
      const mensaje = mensajeBloqueoDesactivacionSalon(code)
      expect(mensaje.toLowerCase()).not.toContain("prisma")
      expect(mensaje.toLowerCase()).not.toContain("select")
      expect(mensaje).not.toMatch(/[a-z0-9]{20,}/i) // sin ids largos tipo cuid
    }
  })
})

describe("Tarea 20 — ESTADOS_PENDIENTES_MESA reexportado (nunca duplicado)", () => {
  test("es exactamente la misma allowlist que ya usan mesa-cuenta.ts/mesa-occupancy.ts", () => {
    expect(ESTADOS_PENDIENTES_MESA).toEqual(["recibido", "preparando", "listo_para_retirar"])
  })
})
