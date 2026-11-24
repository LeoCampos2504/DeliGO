/// <reference types="bun-types" />
// BUG-001 — regla única de identidad visible del empleado (unidad, sin base de datos).
import { describe, expect, test } from "bun:test"
import { empleadoVinculado, NOMBRE_EMPLEADO_PENDIENTE, nombreHistoricoVisible, nombreVisibleEmpleado } from "@/lib/empleado-identidad"

const cuenta = (nombre: string, eliminado = false) => ({ nombre, eliminado })

describe("nombreVisibleEmpleado", () => {
  test("1. vinculado con nombre heredado «Pendiente de vinculación» → nombre de la cuenta", () => {
    expect(nombreVisibleEmpleado({ nombre: NOMBRE_EMPLEADO_PENDIENTE, cuentaOperativa: cuenta("Lucía Cuenta") })).toBe("Lucía Cuenta")
  })
  test("2. vinculado con nombre heredado distinto → nombre de la cuenta", () => {
    expect(nombreVisibleEmpleado({ nombre: "Lucia Heredada", cuentaOperativa: cuenta("Lucía Cuenta") })).toBe("Lucía Cuenta")
  })
  test("3. realmente pendiente (sin cuenta) → sigue «Pendiente de vinculación»", () => {
    expect(nombreVisibleEmpleado({ nombre: NOMBRE_EMPLEADO_PENDIENTE, cuentaOperativa: null })).toBe(NOMBRE_EMPLEADO_PENDIENTE)
    expect(empleadoVinculado({ nombre: NOMBRE_EMPLEADO_PENDIENTE, cuentaOperativa: null })).toBe(false)
  })
  test("cuenta eliminada o sin nombre → no es un vínculo utilizable: queda Empleado.nombre", () => {
    expect(nombreVisibleEmpleado({ nombre: NOMBRE_EMPLEADO_PENDIENTE, cuentaOperativa: cuenta("Borrada", true) })).toBe(NOMBRE_EMPLEADO_PENDIENTE)
    expect(nombreVisibleEmpleado({ nombre: "Beto", cuentaOperativa: cuenta("   ") })).toBe("Beto")
  })
  test("espacios y vacíos", () => {
    expect(nombreVisibleEmpleado({ nombre: "x", cuentaOperativa: cuenta("  Ana Real  ") })).toBe("Ana Real")
    expect(nombreVisibleEmpleado({ nombre: "  ", cuentaOperativa: null })).toBe("Empleado")
    expect(nombreVisibleEmpleado(null)).toBe("Empleado")
    expect(nombreVisibleEmpleado(undefined)).toBe("Empleado")
  })
})

describe("nombreHistoricoVisible (foto guardada en registros históricos)", () => {
  test("foto = marcador + vínculo activo inequívoco → nombre actual, marcado como resuelto", () => {
    expect(nombreHistoricoVisible(NOMBRE_EMPLEADO_PENDIENTE, { nombre: NOMBRE_EMPLEADO_PENDIENTE, cuentaOperativa: cuenta("Lucía Cuenta") })).toEqual({ nombre: "Lucía Cuenta", resuelto: true })
  })
  test("foto con un nombre real → se respeta tal cual (identidad registrada originalmente)", () => {
    expect(nombreHistoricoVisible("Mozo Viejo", { nombre: "Mozo Viejo", cuentaOperativa: cuenta("Lucía Cuenta") })).toEqual({ nombre: "Mozo Viejo", resuelto: false })
  })
  test("foto = marcador sin vínculo, sin empleado o con cuenta eliminada → se respeta el marcador", () => {
    expect(nombreHistoricoVisible(NOMBRE_EMPLEADO_PENDIENTE, { nombre: NOMBRE_EMPLEADO_PENDIENTE, cuentaOperativa: null })).toEqual({ nombre: NOMBRE_EMPLEADO_PENDIENTE, resuelto: false })
    expect(nombreHistoricoVisible(NOMBRE_EMPLEADO_PENDIENTE, null)).toEqual({ nombre: NOMBRE_EMPLEADO_PENDIENTE, resuelto: false })
    expect(nombreHistoricoVisible(NOMBRE_EMPLEADO_PENDIENTE, { nombre: "x", cuentaOperativa: cuenta("Borrada", true) })).toEqual({ nombre: NOMBRE_EMPLEADO_PENDIENTE, resuelto: false })
  })
  test("sin foto → null", () => {
    expect(nombreHistoricoVisible(null, { nombre: "x", cuentaOperativa: cuenta("Ana") })).toEqual({ nombre: null, resuelto: false })
  })
})
