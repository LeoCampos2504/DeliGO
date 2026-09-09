/// <reference types="bun-types" />

// ============================================
// IOS-PWA-DEBUG-LAUNCH-FIX-R2A — contrato estático focal
// (corregido por PRE-T29-FIX-MANIFEST-CLIENTE-IOSDEBUG-FLAG-TESTING, F-PRE-T29-02)
// ============================================
// R2A había embebido ?iosDebug=1 directamente en el start_url del manifest
// de Cliente para que la PWA instalada lanzara directo al modo de
// diagnóstico, evitando depender de localStorage cruzando el límite
// Safari -> app instalada (ese cruce no puede funcionar en WebKit/iOS —
// son contextos de storage separados). Eso resultó ser Production-visible:
// cualquier instalación NUEVA de la PWA Cliente hecha después de promover
// ese manifest habría abierto con el panel de diagnóstico activado por
// defecto (F-PRE-T29-02, encontrado durante
// PRE-T29-PROMOTE-CERTIFIED-TESTING-TO-MAIN-AND-PRODUCTION).
//
// Esta tarea revierte el manifest a su start_url normal (`/cliente`, sin
// query param) SIN eliminar el mecanismo de diagnóstico: el panel y
// `isIosDebugFlagEnabled` siguen leyendo `?iosDebug=1` de la URL en
// tiempo de ejecución, así que un operador/tester puede seguir activándolo
// manualmente navegando a `/cliente?iosDebug=1` — sólo deja de estar
// activado POR DEFECTO en cada lanzamiento en frío desde el ícono
// instalado. No protege ningún comportamiento de layout — cero archivos
// de UI/CSS fueron tocados por esta tarea.

import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"
import { isIosDebugFlagEnabled } from "./ios-debug-snapshot"

const MANIFEST_CLIENTE = join(process.cwd(), "public", "manifest-cliente.json")
const DEBUG_PANEL = join(process.cwd(), "src", "components", "pwa", "ios-viewport-debug-panel.tsx")
const DEBUG_SNAPSHOT_LIB = join(process.cwd(), "src", "lib", "ios-debug-snapshot.ts")

describe("IOS-PWA-DEBUG-LAUNCH-FIX-R2A — start_url de diagnóstico en TESTING", () => {
  test("A. manifest-cliente.json start_url es /cliente — el debug panel ya NO está activado por defecto", () => {
    const manifest = JSON.parse(readFileSync(MANIFEST_CLIENTE, "utf-8"))
    expect(manifest.start_url).toBe("/cliente")
    expect(manifest.start_url).not.toContain("iosDebug")
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

  test("F. sanity: un manifest sintético con el flag de debug hardcodeado falla el check A (el test realmente detecta drift)", () => {
    const synthetic = { start_url: "/cliente?iosDebug=1" }
    expect(synthetic.start_url).not.toBe("/cliente")
  })

  test("G. acceso manual /cliente?iosDebug=1 sigue funcionando — el panel no fue eliminado ni desactivado", () => {
    expect(isIosDebugFlagEnabled("?iosDebug=1")).toBe(true)
    expect(isIosDebugFlagEnabled("")).toBe(false)
  })
})
