/// <reference types="bun-types" />

// ============================================
// T20-DK2B/DK2C — extractSoloDeliveryCandidateIds (pura, sin DOM)
// ============================================
// El algoritmo de batching en sí (chunking, combinación, fallo parcial,
// resultado faltante, deduplicación general) se movió a
// `src/lib/delivery-precios-batch.test.ts` — es compartido con el
// consumidor histórico de precios (T20-DK2C) y no debe duplicarse acá. Este
// archivo prueba únicamente lo específico de este hook: qué negocios
// cuentan como "candidatos solo delivery" y la estabilidad de esa lista
// ante reordenamientos del array de entrada.

import { describe, expect, test } from "bun:test"
import { extractSoloDeliveryCandidateIds, type SoloDeliveryCoverageCandidate } from "./use-solo-delivery-coverage"

describe("T20-DK2B — extractSoloDeliveryCandidateIds: dedupe + orden estable", () => {
  function candidate(id: string, overrides: Partial<SoloDeliveryCoverageCandidate> = {}): SoloDeliveryCoverageCandidate {
    return { id, ofreceDelivery: true, retiroHabilitado: false, ...overrides }
  }

  test("deduplica ids repetidos", () => {
    const negocios = [candidate("A"), candidate("B"), candidate("A"), candidate("C"), candidate("B")]
    expect(extractSoloDeliveryCandidateIds(negocios)).toEqual(["A", "B", "C"])
  })

  test("mismo conjunto en distinto orden produce la misma lista de salida (queryKey estable)", () => {
    const orden1 = [candidate("C"), candidate("A"), candidate("B")]
    const orden2 = [candidate("A"), candidate("B"), candidate("C")]
    const salida1 = extractSoloDeliveryCandidateIds(orden1)
    const salida2 = extractSoloDeliveryCandidateIds(orden2)
    expect(salida1).toEqual(salida2)
    expect(salida1.join(",")).toBe(salida2.join(","))
  })

  test("excluye Delivery+retiro y Solo retiro — sólo entran los 'solo delivery'", () => {
    const negocios = [
      candidate("solo-delivery", { ofreceDelivery: true, retiroHabilitado: false }),
      candidate("delivery-retiro", { ofreceDelivery: true, retiroHabilitado: true }),
      candidate("solo-retiro", { ofreceDelivery: false, retiroHabilitado: true }),
    ]
    expect(extractSoloDeliveryCandidateIds(negocios)).toEqual(["solo-delivery"])
  })
})
