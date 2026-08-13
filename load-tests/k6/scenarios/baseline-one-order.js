// OBSERVABILITY + LOAD/PERFORMANCE CERTIFICATION — BASELINE B (one order)
// ============================================
// EXACTAMENTE 1 pedido real contra DeliGO Copy, ciclo de vida completo
// (checkout -> preparando -> listo_para_retirar -> confirmar -> entregado).
// Sólo se ejecuta si baseline-readonly (A) pasó — el runner es responsable
// de ese gate, no este script. No mide volumen — la latencia de writes acá
// es OBSERVATIONAL (1 sola muestra), nunca un veredicto de capacidad; por
// eso NO se declara un threshold de latencia sobre `checkout`/transiciones
// en este archivo, sólo sobre checks/error-rate (que sí son significativos
// incluso con 1 muestra: o falló o no falló).

import exec from "k6/execution"
import { TARGET_URL } from "../../config/environments.js"
import { identities, idempotencyKeys } from "../lib/pool.js"
import { runOneOrderLifecycle } from "../flows/order-baseline-flow.js"
import { buildSummaryOutputs } from "../lib/summary.js"

export const options = {
  scenarios: {
    baseline_one_order: {
      executor: "shared-iterations",
      vus: 1,
      iterations: 1,
      maxDuration: "2m",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    checks: ["rate==1"],
  },
  summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "p(99)", "max"],
}

export default function () {
  // Identidad indexada por iteración (exec.scenario.iterationInTest), NUNCA
  // por VU — bajo executors de arrival-rate (Fase C) una misma VU puede
  // correr más de una iteración, así que la identidad del pedido debe
  // depender de LA ITERACIÓN, no de la VU. Con 1 sola iteración acá el
  // resultado es trivial, pero establece el patrón correcto para
  // compressed-50.
  const iterationIndex = exec.scenario.iterationInTest
  const clienteIdentity = identities.find((identity) => identity.role === "cliente" && identity.index === 0)
  const negocioIdentity = identities.find((identity) => identity.role === "negocio" && identity.index === 0)
  const idempotencyKey = idempotencyKeys[iterationIndex]

  if (!clienteIdentity || !negocioIdentity || !idempotencyKey) {
    throw new Error(
      `Pool incompleto para la iteración ${iterationIndex}: cliente=${!!clienteIdentity} negocio=${!!negocioIdentity} idempotencyKey=${!!idempotencyKey}`
    )
  }

  runOneOrderLifecycle(clienteIdentity, negocioIdentity, idempotencyKey)
}

export function handleSummary(data) {
  return buildSummaryOutputs(data, {
    runId: __ENV.K6_RUN_ID || "unknown",
    scenario: "baseline-one-order",
    targetUrl: TARGET_URL,
    commitHash: __ENV.K6_COMMIT_HASH || "unknown",
    resultsDir: __ENV.K6_RESULTS_DIR,
  })
}
