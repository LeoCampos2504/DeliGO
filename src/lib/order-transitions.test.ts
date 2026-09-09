/// <reference types="bun-types" />

// ============================================
// P2-T29A — order-transitions authority (pure, no DB)
// ============================================
// Cubre el target graph (DOMICILIO/RETIRO/MESA), el grafo activo vigente,
// la decisión de cancelación en `aceptado`, y el rechazo explícito de
// `recibido->aceptado` para MESA. Ninguno de estos tests toca la DB —
// la autoridad es pura por diseño (ver order-transitions.ts).

import { describe, expect, test } from "bun:test"
import {
  ACTIVE_FORWARD_TRANSITIONS,
  CANONICAL_ACCEPTED_STATE,
  CANONICAL_WAITING_DRIVER_STATE,
  CLIENTE_PUEDE_CANCELAR_EN_ACEPTADO,
  MESA_PASA_POR_ACEPTADO,
  TARGET_FORWARD_TRANSITIONS,
  canTransitionToCancelled,
  isTerminalEstado,
  isValidForwardTransition,
} from "./order-transitions"

describe("P2-T29A — canonical names", () => {
  test("los nombres canónicos son exactamente los decididos por el operador", () => {
    expect(CANONICAL_ACCEPTED_STATE).toBe("aceptado")
    expect(CANONICAL_WAITING_DRIVER_STATE).toBe("esperando_repartidor")
  })

  test("decisiones de producto ya cerradas", () => {
    expect(CLIENTE_PUEDE_CANCELAR_EN_ACEPTADO).toBe(true)
    expect(MESA_PASA_POR_ACEPTADO).toBe(false)
  })
})

describe("P2-T29A — TARGET_FORWARD_TRANSITIONS — DOMICILIO", () => {
  test("recibido→aceptado válido", () => {
    expect(isValidForwardTransition(TARGET_FORWARD_TRANSITIONS, "domicilio", "recibido", "aceptado")).toBe(true)
  })
  test("aceptado→preparando válido", () => {
    expect(isValidForwardTransition(TARGET_FORWARD_TRANSITIONS, "domicilio", "aceptado", "preparando")).toBe(true)
  })
  test("preparando→esperando_repartidor válido", () => {
    expect(isValidForwardTransition(TARGET_FORWARD_TRANSITIONS, "domicilio", "preparando", "esperando_repartidor")).toBe(true)
  })
  test("esperando_repartidor→en_camino válido", () => {
    expect(isValidForwardTransition(TARGET_FORWARD_TRANSITIONS, "domicilio", "esperando_repartidor", "en_camino")).toBe(true)
  })
  test("en_camino→entregado válido", () => {
    expect(isValidForwardTransition(TARGET_FORWARD_TRANSITIONS, "domicilio", "en_camino", "entregado")).toBe(true)
  })
  test("transiciones salteadas/retroceso inválidas", () => {
    expect(isValidForwardTransition(TARGET_FORWARD_TRANSITIONS, "domicilio", "recibido", "preparando")).toBe(false)
    expect(isValidForwardTransition(TARGET_FORWARD_TRANSITIONS, "domicilio", "recibido", "esperando_repartidor")).toBe(false)
    expect(isValidForwardTransition(TARGET_FORWARD_TRANSITIONS, "domicilio", "preparando", "en_camino")).toBe(false)
    expect(isValidForwardTransition(TARGET_FORWARD_TRANSITIONS, "domicilio", "en_camino", "esperando_repartidor")).toBe(false)
    expect(isValidForwardTransition(TARGET_FORWARD_TRANSITIONS, "domicilio", "entregado", "recibido")).toBe(false)
  })
})

describe("P2-T29A — TARGET_FORWARD_TRANSITIONS — RETIRO", () => {
  test("recibido→aceptado válido", () => {
    expect(isValidForwardTransition(TARGET_FORWARD_TRANSITIONS, "retiro", "recibido", "aceptado")).toBe(true)
  })
  test("aceptado→preparando válido", () => {
    expect(isValidForwardTransition(TARGET_FORWARD_TRANSITIONS, "retiro", "aceptado", "preparando")).toBe(true)
  })
  test("preparando→listo_para_retirar válido", () => {
    expect(isValidForwardTransition(TARGET_FORWARD_TRANSITIONS, "retiro", "preparando", "listo_para_retirar")).toBe(true)
  })
  test("listo_para_retirar→entregado válido", () => {
    expect(isValidForwardTransition(TARGET_FORWARD_TRANSITIONS, "retiro", "listo_para_retirar", "entregado")).toBe(true)
  })
  test("retiro nunca pasa por esperando_repartidor/en_camino", () => {
    expect(isValidForwardTransition(TARGET_FORWARD_TRANSITIONS, "retiro", "preparando", "esperando_repartidor")).toBe(false)
    expect(isValidForwardTransition(TARGET_FORWARD_TRANSITIONS, "retiro", "preparando", "en_camino")).toBe(false)
  })
})

describe("P2-T29A — TARGET_FORWARD_TRANSITIONS — MESA", () => {
  test("recibido→preparando válido", () => {
    expect(isValidForwardTransition(TARGET_FORWARD_TRANSITIONS, "mesa", "recibido", "preparando")).toBe(true)
  })
  test("recibido→aceptado INVÁLIDO (MESA_PASA_POR_ACEPTADO=false)", () => {
    expect(isValidForwardTransition(TARGET_FORWARD_TRANSITIONS, "mesa", "recibido", "aceptado")).toBe(false)
  })
  test("preparando→listo_para_retirar válido", () => {
    expect(isValidForwardTransition(TARGET_FORWARD_TRANSITIONS, "mesa", "preparando", "listo_para_retirar")).toBe(true)
  })
  test("listo_para_retirar→entregado válido", () => {
    expect(isValidForwardTransition(TARGET_FORWARD_TRANSITIONS, "mesa", "listo_para_retirar", "entregado")).toBe(true)
  })
  test("mesa nunca tiene el estado aceptado en ninguna transición de su grafo", () => {
    const mesaTargets = Object.values(TARGET_FORWARD_TRANSITIONS.mesa).flat()
    const mesaOrigins = Object.keys(TARGET_FORWARD_TRANSITIONS.mesa)
    expect(mesaTargets).not.toContain(CANONICAL_ACCEPTED_STATE)
    expect(mesaOrigins).not.toContain(CANONICAL_ACCEPTED_STATE)
  })
})

describe("P2-T29A — cancelación", () => {
  test("cliente puede cancelar desde aceptado (grafo target)", () => {
    expect(canTransitionToCancelled(CANONICAL_ACCEPTED_STATE, "target")).toBe(true)
  })
  test("esperando_repartidor también es cancelable (grafo target, equivalente al en_camino actual)", () => {
    expect(canTransitionToCancelled(CANONICAL_WAITING_DRIVER_STATE, "target")).toBe(true)
  })
  test("grafo activo hoy no conoce aceptado/esperando_repartidor como cancelables (no existen todavía)", () => {
    expect(canTransitionToCancelled(CANONICAL_ACCEPTED_STATE, "active")).toBe(false)
    expect(canTransitionToCancelled(CANONICAL_WAITING_DRIVER_STATE, "active")).toBe(false)
  })
  test("estados no-terminales activos siguen siendo cancelables en ambos grafos", () => {
    for (const estado of ["recibido", "preparando", "en_camino", "listo_para_retirar"]) {
      expect(canTransitionToCancelled(estado, "active")).toBe(true)
      expect(canTransitionToCancelled(estado, "target")).toBe(true)
    }
  })
  test("estados terminales nunca son cancelables", () => {
    expect(canTransitionToCancelled("entregado")).toBe(false)
    expect(canTransitionToCancelled("cancelado")).toBe(false)
  })
})

describe("P2-T29A — isTerminalEstado", () => {
  test("entregado y cancelado son terminales", () => {
    expect(isTerminalEstado("entregado")).toBe(true)
    expect(isTerminalEstado("cancelado")).toBe(true)
  })
  test("el resto no lo es", () => {
    for (const estado of ["recibido", "aceptado", "preparando", "esperando_repartidor", "en_camino", "listo_para_retirar"]) {
      expect(isTerminalEstado(estado)).toBe(false)
    }
  })
})

describe("P2-T29A — ACTIVE_FORWARD_TRANSITIONS — grafo vigente hoy (sin aceptado/esperando_repartidor)", () => {
  test("domicilio: recibido→preparando→en_camino", () => {
    expect(isValidForwardTransition(ACTIVE_FORWARD_TRANSITIONS, "domicilio", "recibido", "preparando")).toBe(true)
    expect(isValidForwardTransition(ACTIVE_FORWARD_TRANSITIONS, "domicilio", "preparando", "en_camino")).toBe(true)
  })
  test("retiro: recibido→preparando→listo_para_retirar→entregado", () => {
    expect(isValidForwardTransition(ACTIVE_FORWARD_TRANSITIONS, "retiro", "recibido", "preparando")).toBe(true)
    expect(isValidForwardTransition(ACTIVE_FORWARD_TRANSITIONS, "retiro", "preparando", "listo_para_retirar")).toBe(true)
    expect(isValidForwardTransition(ACTIVE_FORWARD_TRANSITIONS, "retiro", "listo_para_retirar", "entregado")).toBe(true)
  })
  test("mesa: recibido→preparando→listo_para_retirar→entregado, sin aceptado", () => {
    expect(isValidForwardTransition(ACTIVE_FORWARD_TRANSITIONS, "mesa", "recibido", "preparando")).toBe(true)
    expect(isValidForwardTransition(ACTIVE_FORWARD_TRANSITIONS, "mesa", "preparando", "listo_para_retirar")).toBe(true)
    expect(isValidForwardTransition(ACTIVE_FORWARD_TRANSITIONS, "mesa", "listo_para_retirar", "entregado")).toBe(true)
    expect(isValidForwardTransition(ACTIVE_FORWARD_TRANSITIONS, "mesa", "recibido", "aceptado")).toBe(false)
  })
  test("el grafo activo nunca contiene aceptado ni esperando_repartidor en ninguna modalidad — T29A no activa el flujo nuevo", () => {
    for (const modalidad of ["domicilio", "retiro", "mesa"] as const) {
      const origins = Object.keys(ACTIVE_FORWARD_TRANSITIONS[modalidad])
      const targets = Object.values(ACTIVE_FORWARD_TRANSITIONS[modalidad]).flat()
      expect(origins).not.toContain(CANONICAL_ACCEPTED_STATE)
      expect(origins).not.toContain(CANONICAL_WAITING_DRIVER_STATE)
      expect(targets).not.toContain(CANONICAL_ACCEPTED_STATE)
      expect(targets).not.toContain(CANONICAL_WAITING_DRIVER_STATE)
    }
  })
  test("cross-modalidad inválida: domicilio no llega a listo_para_retirar, retiro/mesa no llegan a en_camino", () => {
    expect(isValidForwardTransition(ACTIVE_FORWARD_TRANSITIONS, "domicilio", "preparando", "listo_para_retirar")).toBe(false)
    expect(isValidForwardTransition(ACTIVE_FORWARD_TRANSITIONS, "retiro", "preparando", "en_camino")).toBe(false)
    expect(isValidForwardTransition(ACTIVE_FORWARD_TRANSITIONS, "mesa", "preparando", "en_camino")).toBe(false)
  })
})
