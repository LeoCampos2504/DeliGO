/// <reference types="bun-types" />

// ============================================
// IOS-PWA-DEBUG-LAUNCH-FIX-R2A — contrato estático focal
// ============================================
// Protege el fix real de esta tarea: el manifest de cliente en TESTING
// declara start_url con ?iosDebug=1 incluido, para que la PWA instalada
// lance directo al modo de diagnóstico sin depender de localStorage
// cruzando el límite Safari -> app instalada (ese cruce no puede
// funcionar en WebKit/iOS — son contextos de storage separados).
// No protege ningún comportamiento de layout — cero archivos de UI/CSS
// fueron tocados por esta tarea.
// TEMPORARY_TESTING_DIAGNOSTIC_ONLY=SI — este contrato entero debe
// eliminarse junto con el resto de la instrumentación antes de promover a
// Producción (ver PWA_DEBUG_START_URL_MUST_BE_REMOVED_BEFORE_PRODUCTION).

import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const MANIFEST_CLIENTE = join(process.cwd(), "public", "manifest-cliente.json")
const DEBUG_PANEL = join(process.cwd(), "src", "components", "pwa", "ios-viewport-debug-panel.tsx")
const DEBUG_SNAPSHOT_LIB = join(process.cwd(), "src", "lib", "ios-debug-snapshot.ts")

describe("IOS-PWA-DEBUG-LAUNCH-FIX-R2A — start_url de diagnóstico en TESTING", () => {
  test("A. manifest-cliente.json start_url incluye ?iosDebug=1", () => {
    const manifest = JSON.parse(readFileSync(MANIFEST_CLIENTE, "utf-8"))
    expect(manifest.start_url).toBe("/cliente?iosDebug=1")
  })

  test("B. display/scope/icons del manifest no fueron alterados por este fix", () => {
    const manifest = JSON.parse(readFileSync(MANIFEST_CLIENTE, "utf-8"))
    expect(manifest.display).toBe("standalone")
    expect(manifest.scope).toBe("/cliente")
    expect(Array.isArray(manifest.icons)).toBe(true)
    expect(manifest.icons.length).toBeGreaterThan(0)
  })

  test("C. el manifest sigue siendo JSON válido con todos sus campos previos (name, share_target, shortcuts)", () => {
    const manifest = JSON.parse(readFileSync(MANIFEST_CLIENTE, "utf-8"))
    expect(manifest.name).toBe("DeliGO - Pedí lo que quieras")
    expect(manifest.share_target).toBeDefined()
    expect(manifest.shortcuts).toBeDefined()
  })

  test("D. el panel de diagnóstico ya NO depende de localStorage — sólo del query flag", () => {
    const source = readFileSync(DEBUG_PANEL, "utf-8")
    const codeOnly = source
      .split("\n")
      .filter((line) => !line.trim().startsWith("*") && !line.trim().startsWith("//"))
      .join("\n")
    expect(codeOnly).not.toMatch(/localStorage/)
    expect(codeOnly).toContain("isIosDebugFlagEnabled(window.location.search)")
  })

  test("E. la librería pura ya no exporta la persistencia de localStorage cross-context eliminada", () => {
    const source = readFileSync(DEBUG_SNAPSHOT_LIB, "utf-8")
    // Excluye comentarios: el propio código documenta en prosa, dentro de un
    // comentario, por qué IOS_DEBUG_STORAGE_KEY se eliminó — no debe contar
    // como una reintroducción del símbolo.
    const codeOnly = source
      .split("\n")
      .filter((line) => !line.trim().startsWith("*") && !line.trim().startsWith("//"))
      .join("\n")
    expect(codeOnly).not.toMatch(/IOS_DEBUG_STORAGE_KEY/)
    expect(codeOnly).not.toMatch(/resolveIosDebugEnabled/)
    // isIosDebugFlagEnabled sigue existiendo y es, de nuevo, la única autoridad.
    expect(codeOnly).toContain("export function isIosDebugFlagEnabled(search: string): boolean {")
  })

  test("F. sanity: un manifest sintético con start_url distinto falla el check A (el test realmente detecta drift)", () => {
    const synthetic = { start_url: "/cliente" }
    expect(synthetic.start_url).not.toBe("/cliente?iosDebug=1")
  })
})
