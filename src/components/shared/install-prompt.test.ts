// P2-T52-R1B: contrato puro de exclusión de rutas de
// src/components/shared/install-prompt.tsx. No se renderiza el
// componente completo (depende de framer-motion, beforeinstallprompt y
// otros hooks de navegador sin harness real en este entorno) — se
// testean directamente las dos funciones puras de clasificación de
// pathname que `InstallPrompt()` usa para decidir si montarse o no,
// exportadas explícitamente para este propósito (ver comentario en el
// propio archivo).
import { describe, expect, test } from "bun:test"
import { isLegacyOperationsTombstoneRoute, isMozoRoute } from "./install-prompt"

describe("P2-T52-R1B — isLegacyOperationsTombstoneRoute (/e, /s)", () => {
  test("A. /e (bare) → excluido", () => {
    expect(isLegacyOperationsTombstoneRoute("/e")).toBe(true)
  })

  test("B. /e/abc → excluido", () => {
    expect(isLegacyOperationsTombstoneRoute("/e/abc")).toBe(true)
  })

  test("C. /s (bare) → excluido", () => {
    expect(isLegacyOperationsTombstoneRoute("/s")).toBe(true)
  })

  test("D. /s/abc → excluido", () => {
    expect(isLegacyOperationsTombstoneRoute("/s/abc")).toBe(true)
  })

  test("G. /operaciones → NO excluido por esta regla", () => {
    expect(isLegacyOperationsTombstoneRoute("/operaciones")).toBe(false)
  })

  test("H. /cliente → NO excluido por esta regla", () => {
    expect(isLegacyOperationsTombstoneRoute("/cliente")).toBe(false)
  })

  test("I. /negocio → NO excluido por esta regla", () => {
    expect(isLegacyOperationsTombstoneRoute("/negocio")).toBe(false)
  })

  test("J. /repartidor → NO excluido por esta regla", () => {
    expect(isLegacyOperationsTombstoneRoute("/repartidor")).toBe(false)
  })

  test("/mozo NO queda excluido por esta función (tiene su propia regla separada)", () => {
    expect(isLegacyOperationsTombstoneRoute("/mozo")).toBe(false)
    expect(isLegacyOperationsTombstoneRoute("/mozo/panel/test")).toBe(false)
  })

  test("no hace match parcial engañoso (ej. /empleados, /salones)", () => {
    expect(isLegacyOperationsTombstoneRoute("/empleados")).toBe(false)
    expect(isLegacyOperationsTombstoneRoute("/salones")).toBe(false)
  })
})

describe("P2-T52-R1B — isMozoRoute preservado sin cambios (regresión)", () => {
  test("E. /mozo → excluido (regla preexistente intacta)", () => {
    expect(isMozoRoute("/mozo")).toBe(true)
  })

  test("F. /mozo/panel/test → excluido (regla preexistente intacta)", () => {
    expect(isMozoRoute("/mozo/panel/test")).toBe(true)
  })

  test("/e y /s no quedan excluidos por isMozoRoute (cada regla es independiente)", () => {
    expect(isMozoRoute("/e")).toBe(false)
    expect(isMozoRoute("/s")).toBe(false)
  })
})
