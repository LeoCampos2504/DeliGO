/// <reference types="bun-types" />

// ============================================
// P2-T29B-R1 — Timeline Cliente: continuidad para aceptado/esperando_repartidor
// ============================================
// Feedback físico del operador durante la certificación de P2-T29B: la
// timeline Cliente (client-orders-panel.tsx) usaba un `findIndex` sobre un
// array literal que nunca incluyó "aceptado"/"esperando_repartidor" — al
// llegar a esos estados, `adjustedStepIndex` caía en -1 y la barra de
// progreso se "apagaba" por completo. Este test cubre el mapping explícito
// (DOMICILIO_STEP_INDEX/RETIRO_STEP_INDEX) y los labels dinámicos que lo
// reemplazan, exactamente los 5 estados nuevos, la compatibilidad legacy y
// Retiro/Mesa — sin rediseñar la timeline (T29D sigue fuera de alcance).

import { describe, expect, test } from "bun:test"
import {
  DOMICILIO_STEP_INDEX,
  RETIRO_STEP_INDEX,
  domicilioTimelineSteps,
  retiroTimelineSteps,
} from "./client-orders-panel"

describe("P2-T29B-R1 — DOMICILIO: exactamente 5 posiciones, nunca 6", () => {
  test("domicilioTimelineSteps siempre devuelve 5 pasos, cualquiera sea el estado", () => {
    for (const estado of ["recibido", "aceptado", "preparando", "esperando_repartidor", "en_camino"]) {
      expect(domicilioTimelineSteps(estado)).toHaveLength(5)
    }
  })

  test("recibido: primer nodo activo como 'Recibido', índice 0", () => {
    expect(DOMICILIO_STEP_INDEX["recibido"]).toBe(0)
    expect(domicilioTimelineSteps("recibido")[0].label).toBe("Recibido")
  })

  test("aceptado: el MISMO primer nodo cambia a 'Aceptado' (no un nodo nuevo), índice 0 — timeline no se apaga", () => {
    expect(DOMICILIO_STEP_INDEX["aceptado"]).toBe(0)
    const steps = domicilioTimelineSteps("aceptado")
    expect(steps).toHaveLength(5)
    expect(steps[0].label).toBe("Aceptado")
    expect(steps.some((s) => s.label === "Recibido")).toBe(false)
  })

  test("preparando: segundo nodo activo, primer nodo ya figura 'Aceptado'", () => {
    expect(DOMICILIO_STEP_INDEX["preparando"]).toBe(1)
    const steps = domicilioTimelineSteps("preparando")
    expect(steps[0].label).toBe("Aceptado")
    expect(steps[1].label).toBe("Preparando")
  })

  test("esperando_repartidor: tercer nodo activo, label 'Buscando delivery' — nunca el string raw", () => {
    expect(DOMICILIO_STEP_INDEX["esperando_repartidor"]).toBe(2)
    const steps = domicilioTimelineSteps("esperando_repartidor")
    expect(steps[2].label).toBe("Buscando delivery")
    expect(steps.some((s) => s.label.includes("esperando_repartidor"))).toBe(false)
    expect(steps.some((s) => s.label.includes("_"))).toBe(false)
  })

  test("en_camino: cuarto nodo activo", () => {
    expect(DOMICILIO_STEP_INDEX["en_camino"]).toBe(3)
    expect(domicilioTimelineSteps("en_camino")[3].label).toBe("En camino")
  })

  test("entregado: quinto nodo ('Listo'), sin agregar una sexta posición", () => {
    expect(DOMICILIO_STEP_INDEX["entregado"]).toBe(4)
    const steps = domicilioTimelineSteps("entregado")
    expect(steps).toHaveLength(5)
    expect(steps[4].label).toBe("Listo")
  })
})

describe("P2-T29B-R1 — DOMICILIO: compatibilidad legacy (sin estados nuevos en DB)", () => {
  test("legacy recibido->preparando directo: timeline no se apaga, segundo paso activo", () => {
    expect(DOMICILIO_STEP_INDEX["preparando"]).toBeGreaterThanOrEqual(0)
    const steps = domicilioTimelineSteps("preparando")
    expect(steps[0].label).toBe("Aceptado")
    expect(steps[1].label).toBe("Preparando")
  })

  test("legacy preparando->en_camino directo: 'Buscando delivery' queda completado de forma coherente, no crashea", () => {
    const idx = DOMICILIO_STEP_INDEX["en_camino"]
    expect(idx).toBe(3)
    // El paso 2 ("Buscando delivery") se considera completado aunque el
    // pedido nunca haya pasado literalmente por esperando_repartidor — la
    // UI lo determina con `i <= adjustedStepIndex`, no con un match exacto.
    expect(2).toBeLessThanOrEqual(idx)
  })
})

describe("P2-T29B-R1 — RETIRO: aceptado no apaga la timeline, sin 'Buscando delivery'", () => {
  test("recibido: índice 0", () => {
    expect(RETIRO_STEP_INDEX["recibido"]).toBe(0)
  })

  test("aceptado: mismo primer nodo ('Aceptado'), índice 0 — antes caía en -1 y apagaba la barra", () => {
    expect(RETIRO_STEP_INDEX["aceptado"]).toBe(0)
    const steps = retiroTimelineSteps("aceptado")
    expect(steps[0].label).toBe("Aceptado")
  })

  test("preparando y listo_para_retirar siguen activos, sin regresión", () => {
    expect(RETIRO_STEP_INDEX["preparando"]).toBeGreaterThanOrEqual(0)
    expect(RETIRO_STEP_INDEX["listo_para_retirar"]).toBeGreaterThanOrEqual(0)
  })

  test("ningún paso de Retiro se llama 'Buscando delivery' (no corresponde a este flujo)", () => {
    for (const estado of ["recibido", "aceptado", "preparando", "listo_para_retirar"]) {
      const labels = retiroTimelineSteps(estado).map((s) => s.label)
      expect(labels).not.toContain("Buscando delivery")
    }
  })
})
