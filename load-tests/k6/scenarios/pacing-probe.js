// Fase C pacing probe: one VU per read-only role using the exact realistic
// scheduler functions. It observes the 8s, 15s and 30s clocks without a
// tight loop and without changing the executor model used by REALISTIC-20.
import { TARGET_URL } from "../../config/environments.js"
import { buildSummaryOutputs } from "../lib/summary.js"
import { cliente, negocio, repartidor, operaciones } from "../lib/realistic-roles.js"

const probeStages = [
  { target: 1, duration: "5s" },
  { target: 1, duration: "70s" },
  { target: 0, duration: "5s" },
]

export const options = {
  scenarios: {
    pacing_probe_cliente: {
      executor: "ramping-vus",
      exec: "cliente",
      startVUs: 0,
      stages: probeStages,
      tags: { role: "cliente" },
      gracefulRampDown: "0s",
    },
    pacing_probe_negocio: {
      executor: "ramping-vus",
      exec: "negocio",
      startVUs: 0,
      stages: probeStages,
      tags: { role: "negocio" },
      gracefulRampDown: "0s",
    },
    pacing_probe_repartidor: {
      executor: "ramping-vus",
      exec: "repartidor",
      startVUs: 0,
      stages: probeStages,
      tags: { role: "repartidor" },
      gracefulRampDown: "0s",
    },
    pacing_probe_operaciones: {
      executor: "ramping-vus",
      exec: "operaciones",
      startVUs: 0,
      stages: probeStages,
      tags: { role: "operaciones" },
      gracefulRampDown: "0s",
    },
  },
  thresholds: {
    checks: ["rate==1"],
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1000"],
  },
  summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "p(99)", "max"],
}

export { cliente, negocio, repartidor, operaciones }

export function handleSummary(data) {
  return buildSummaryOutputs(data, {
    runId: __ENV.K6_RUN_ID || "unknown",
    scenario: "pacingProbe",
    targetUrl: TARGET_URL,
    commitHash: __ENV.K6_COMMIT_HASH || "unknown",
    resultsDir: __ENV.K6_RESULTS_DIR,
  })
}
