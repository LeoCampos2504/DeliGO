/// <reference types="bun-types" />
// ============================================
// DeliGO — Tests: máquina de estados pura de la cuenta pública de mesa (23-B)
// ============================================
// Puro: sin red, sin DB, sin React. Cubre los estados de UI descritos en la
// sección 18/28 del prompt 23-B (validando, cargando, cuenta activa, sin
// ocupación, cerrada/expirada, error de red, reintento, no mostrar cuenta
// obsoleta como si fuera actual, reemplazo de datos al cambiar de ocupación).

import { describe, test, expect } from "bun:test"
import { computeMesaClienteCuentaUiState, type MesaClienteCuentaUiInput } from "./mesa-cliente-cuenta-ui"
import type { MesaClienteCuentaActiva } from "./mesa-cliente-cuenta-client"

const cuentaA: MesaClienteCuentaActiva = {
  negocioNombre: "Restó A",
  mesaNumero: 5,
  pedidos: [],
  totalGeneral: 1000,
  pedidosIncluidosCount: 1,
  pedidosExcluidosCount: 0,
  pedidosPendientesCount: 0,
  puedeCerrar: true,
}

const cuentaB: MesaClienteCuentaActiva = {
  ...cuentaA,
  negocioNombre: "Restó B",
  mesaNumero: 9,
  totalGeneral: 500,
}

const base: MesaClienteCuentaUiInput = {
  sessionKey: "restoA:5",
  lastGoodSessionKey: null,
  lastOutcome: null,
  lastGoodCuenta: null,
  fetching: false,
}

describe("23-B — computeMesaClienteCuentaUiState", () => {
  test("sin ningún fetch completado todavía -> loading", () => {
    expect(computeMesaClienteCuentaUiState(base).kind).toBe("loading")
  })

  test("sin_sesion -> hidden (nunca se muestra como error)", () => {
    const state = computeMesaClienteCuentaUiState({ ...base, lastOutcome: { kind: "sin_sesion" } })
    expect(state.kind).toBe("hidden")
  })

  test("cerrada -> se muestra siempre, incluso sin dato previo", () => {
    const state = computeMesaClienteCuentaUiState({ ...base, lastOutcome: { kind: "cerrada" } })
    expect(state.kind).toBe("cerrada")
  })

  test("activa -> se muestra la cuenta, nunca stale", () => {
    const state = computeMesaClienteCuentaUiState({
      ...base,
      lastOutcome: { kind: "activa", cuenta: cuentaA },
    })
    expect(state).toEqual({ kind: "activa", cuenta: cuentaA, stale: false })
  })

  test("error sin dato previo bueno y sin fetch en curso -> error explícito con reintento", () => {
    const state = computeMesaClienteCuentaUiState({ ...base, lastOutcome: { kind: "error" }, fetching: false })
    expect(state).toEqual({ kind: "error", stale: false })
  })

  test("error sin dato previo bueno pero con un fetch en curso (reintento automático/manual) -> loading, nunca 'error' parpadeante", () => {
    const state = computeMesaClienteCuentaUiState({ ...base, lastOutcome: { kind: "error" }, fetching: true })
    expect(state.kind).toBe("loading")
  })

  test("error CON dato previo bueno de la MISMA sesión -> se conserva el dato, marcado stale (nunca se muestra como fresco silenciosamente)", () => {
    const state = computeMesaClienteCuentaUiState({
      ...base,
      lastOutcome: { kind: "error" },
      lastGoodSessionKey: base.sessionKey,
      lastGoodCuenta: cuentaA,
    })
    expect(state).toEqual({ kind: "activa", cuenta: cuentaA, stale: true })
  })

  test("cambio de sesión (nueva mesa/ocupación): el dato bueno de la sesión ANTERIOR nunca se reutiliza, ni siquiera como stale", () => {
    const state = computeMesaClienteCuentaUiState({
      sessionKey: "restoA:9", // mesa distinta
      lastGoodSessionKey: "restoA:5", // el dato bueno era de la mesa 5
      lastOutcome: { kind: "error" },
      lastGoodCuenta: cuentaA,
      fetching: false,
    })
    expect(state).toEqual({ kind: "error", stale: false })
  })

  test("cambio de sesión con lastOutcome todavía null -> loading (nunca se muestra la cuenta de la mesa anterior mientras se valida la nueva)", () => {
    const state = computeMesaClienteCuentaUiState({
      sessionKey: "restoA:9",
      lastGoodSessionKey: "restoA:5",
      lastOutcome: null,
      lastGoodCuenta: cuentaA,
      fetching: true,
    })
    expect(state.kind).toBe("loading")
  })

  test("dato bueno de otra sesión NUNCA se filtra dentro de un resultado 'activa' de la sesión actual", () => {
    // Aunque lastGoodCuenta sea de otra mesa, si el fetch actual YA devolvió
    // "activa" para la sesión correcta, se usa ese dato fresco — nunca el
    // stale de otra mesa.
    const state = computeMesaClienteCuentaUiState({
      sessionKey: "restoA:9",
      lastGoodSessionKey: "restoA:5",
      lastOutcome: { kind: "activa", cuenta: cuentaB },
      lastGoodCuenta: cuentaA,
      fetching: false,
    })
    expect(state).toEqual({ kind: "activa", cuenta: cuentaB, stale: false })
  })
})
