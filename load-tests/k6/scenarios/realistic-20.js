// REALISTIC-20: 14 Cliente + 3 Negocio + 2 Repartidor + 1 Operaciones.
// Closed-model sessions with real polling/think-time; no mass writes.
import { TARGET_URL } from "../../config/environments.js"
import { cliente, negocio, repartidor, operaciones } from "../lib/realistic-roles.js"
import { buildSummaryOutputs } from "../lib/summary.js"

const stages = (targetA, targetB, targetC) => [
  { target: targetA, duration: "2m" },
  { target: targetB, duration: "3m" },
  { target: targetC, duration: "3m" },
  { target: targetC, duration: "10m" },
  { target: 0, duration: "2m" },
]

export const options = {
  scenarios: {
    realistic20_cliente: {
      executor: "ramping-vus",
      exec: "cliente",
      startVUs: 0,
      stages: stages(4, 7, 14),
      gracefulRampDown: "30s",
      tags: { role: "cliente" },
    },
    realistic20_negocio: {
      executor: "ramping-vus",
      exec: "negocio",
      startVUs: 0,
      stages: stages(1, 2, 3),
      gracefulRampDown: "30s",
      tags: { role: "negocio" },
    },
    realistic20_repartidor: {
      executor: "ramping-vus",
      exec: "repartidor",
      startVUs: 0,
      stages: stages(0, 1, 2),
      gracefulRampDown: "30s",
      tags: { role: "repartidor" },
    },
    realistic20_operaciones: {
      executor: "ramping-vus",
      exec: "operaciones",
      startVUs: 0,
      stages: stages(0, 0, 1),
      gracefulRampDown: "30s",
      tags: { role: "operaciones" },
    },
  },
  thresholds: {
    checks: ["rate==1"],
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1000"],
    unexpected_429: ["count==0"],
    http_5xx: ["count==0"],
    request_timeouts: ["count==0"],
  },
  summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "p(99)", "max"],
}

export { cliente, negocio, repartidor, operaciones }

export function handleSummary(data) {
  return buildSummaryOutputs(data, {
    runId: __ENV.K6_RUN_ID || "unknown",
    scenario: "realistic20",
    targetUrl: TARGET_URL,
    commitHash: __ENV.K6_COMMIT_HASH || "unknown",
    resultsDir: __ENV.K6_RESULTS_DIR,
  })
}
