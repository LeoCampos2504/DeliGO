// COMPRESSED-50: 50 complete order lifecycles in 10 minutes = 5 arrivals/minute.
import exec from "k6/execution"
import { TARGET_URL } from "../../config/environments.js"
import { findIdentity, idempotencyKeys } from "../lib/pool.js"
import { runOneOrderLifecycle } from "../flows/order-baseline-flow.js"
import { buildSummaryOutputs } from "../lib/summary.js"
import { compressed50BoundaryStarts, compressed50TargetIterations } from "../lib/metrics.js"

export const options = {
  scenarios: {
    compressed50_orders: {
      executor: "constant-arrival-rate",
      rate: 5,
      timeUnit: "1m",
      duration: "10m",
      preAllocatedVUs: 20,
      maxVUs: 50,
      gracefulStop: "30s",
    },
  },
  thresholds: {
    checks: ["rate==1"],
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1000"],
    checkout_duration: ["p(95)<1500"],
    transition_duration: ["p(95)<1500"],
    confirmation_duration: ["p(95)<1500"],
    unexpected_429: ["count==0"],
    http_5xx: ["count==0"],
    request_timeouts: ["count==0"],
    dropped_iterations: ["count==0"],
  },
  summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "p(99)", "max"],
}

export default function () {
  const iterationIndex = exec.scenario.iterationInTest
  if (iterationIndex >= 50) {
    compressed50BoundaryStarts.add(1)
    return
  }
  compressed50TargetIterations.add(1)
  const clienteIdentity = findIdentity("cliente", iterationIndex)
  const negocioIdentity = findIdentity("negocio", 0)
  const idempotencyKey = idempotencyKeys[iterationIndex]
  if (!idempotencyKey) throw new Error(`COMPRESSED50_KEY_MISSING iteration=${iterationIndex}`)
  runOneOrderLifecycle(clienteIdentity, negocioIdentity, idempotencyKey)
}

export function handleSummary(data) {
  return buildSummaryOutputs(data, {
    runId: __ENV.K6_RUN_ID || "unknown",
    scenario: "compressed50",
    targetUrl: TARGET_URL,
    commitHash: __ENV.K6_COMMIT_HASH || "unknown",
    resultsDir: __ENV.K6_RESULTS_DIR,
  })
}
