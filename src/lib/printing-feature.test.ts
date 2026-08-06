/// <reference types="bun-types" />
import { describe, test, expect } from "bun:test"
import { isAccountPrintingEnabled } from "./printing-feature"

/** Elimina comentarios de línea (`//`) y de bloque (`/* ... *\/`) — evita falsos positivos cuando el código DOCUMENTA (en un comentario) que deliberadamente no hace algo. */
function stripAllComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")
}

// ============================================
// DeliGO — Tests permanentes: bandera de impresión de cuentas (P3-PARK)
// ============================================
// Puro: sin DB, sin red, sin React, sin DOM — ejecutable directamente con
// `bun test`. `ACCOUNT_PRINTING_ENABLED` (la constante calculada desde
// `process.env`) no se testea acá porque su valor queda fijado al importar
// el módulo, en el momento del build — el comportamiento real que importa
// probar es la función pura `isAccountPrintingEnabled`, que es exactamente
// la misma regla que la constante aplica internamente.

describe("P3-PARK — isAccountPrintingEnabled", () => {
  test("1. undefined devuelve false", () => {
    expect(isAccountPrintingEnabled(undefined)).toBe(false)
  })

  test("2. string vacío devuelve false", () => {
    expect(isAccountPrintingEnabled("")).toBe(false)
  })

  test("3. 'false' devuelve false", () => {
    expect(isAccountPrintingEnabled("false")).toBe(false)
  })

  test("4. 'TRUE' devuelve false (sin normalización de mayúsculas)", () => {
    expect(isAccountPrintingEnabled("TRUE")).toBe(false)
  })

  test("5. 'True' devuelve false", () => {
    expect(isAccountPrintingEnabled("True")).toBe(false)
  })

  test("6. '1' devuelve false", () => {
    expect(isAccountPrintingEnabled("1")).toBe(false)
  })

  test("7. 'yes' devuelve false", () => {
    expect(isAccountPrintingEnabled("yes")).toBe(false)
  })

  test("8. ' true ' (con espacios) devuelve false (sin trim)", () => {
    expect(isAccountPrintingEnabled(" true ")).toBe(false)
  })

  test("9. 'true' (exacto) devuelve true", () => {
    expect(isAccountPrintingEnabled("true")).toBe(true)
  })

  test("10. La función es determinista (misma entrada, misma salida, sin estado)", () => {
    const results = Array.from({ length: 5 }, () => isAccountPrintingEnabled("true"))
    expect(results.every((r) => r === true)).toBe(true)
    const resultsFalse = Array.from({ length: 5 }, () => isAccountPrintingEnabled("nope"))
    expect(resultsFalse.every((r) => r === false)).toBe(true)
  })

  test("11. No accede a window (verificado leyendo el código real, excluyendo comentarios de línea y de bloque que solo documentan su ausencia)", async () => {
    const source = await Bun.file("./src/lib/printing-feature.ts").text()
    const codeOnly = stripAllComments(source)
    expect(codeOnly.includes("window")).toBe(false)
  })

  test("12. No accede a navigator (verificado leyendo el código real, excluyendo comentarios)", async () => {
    const source = await Bun.file("./src/lib/printing-feature.ts").text()
    const codeOnly = stripAllComments(source)
    expect(codeOnly.includes("navigator")).toBe(false)
  })

  test("13. Funciona en SSR: importar y llamar la función no requiere window/navigator/document (el propio entorno de este test runner no los define)", () => {
    expect(typeof (globalThis as { window?: unknown }).window).toBe("undefined")
    expect(() => isAccountPrintingEnabled("true")).not.toThrow()
    expect(() => isAccountPrintingEnabled(undefined)).not.toThrow()
  })

  test("14. No importa React (verificado leyendo el módulo fuente)", async () => {
    const source = await Bun.file("./src/lib/printing-feature.ts").text()
    expect(/^import .*react/im.test(source)).toBe(false)
  })

  test("15. No solicita ningún permiso (no existe ninguna llamada a requestDevice/requestPort/getUserMedia/Notification en el módulo)", async () => {
    const source = await Bun.file("./src/lib/printing-feature.ts").text()
    expect(source.includes("requestDevice")).toBe(false)
    expect(source.includes("requestPort")).toBe(false)
    expect(source.includes("getUserMedia")).toBe(false)
    expect(source.includes("Notification")).toBe(false)
  })

  test("16. No habilita WebUSB (el módulo no importa nada de thermal-print/webusb-* ni menciona WebUSB fuera de comentarios explicativos)", async () => {
    const source = await Bun.file("./src/lib/printing-feature.ts").text()
    expect(source.includes("webusb-transport")).toBe(false)
    expect(source.includes("webusb-types")).toBe(false)
    expect(/^import/m.test(source)).toBe(false) // el módulo no tiene ningún import — confirma que no depende de nada, menos aún de WebUSB.
  })
})
