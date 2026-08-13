// OBSERVABILITY + LOAD/PERFORMANCE CERTIFICATION — BASELINE A (read-only)
// ============================================
// 1 VU, ~3 minutos, SIN writes HTTP. Objetivo (Fase A §32, Fase B §43-46):
// validar el harness completo (pool/cookies/checks/tags/summary/runner/
// cleanup) sin que el checkout complique el diagnóstico. Si esto falla, NO
// se corre baseline-one-order.

import { sleep } from "k6"
import { TARGET_URL } from "../../config/environments.js"
import { identities } from "../lib/pool.js"
import { createActorJar } from "../lib/actors.js"
import { runClienteReadonlyRound } from "../flows/cliente-flow.js"
import { buildSummaryOutputs } from "../lib/summary.js"

const clienteIdentity = identities.find((identity) => identity.role === "cliente" && identity.index === 0)
const negocioIdentity = identities.find((identity) => identity.role === "negocio" && identity.index === 0)
if (!clienteIdentity || !negocioIdentity) {
  throw new Error("Pool de identidades incompleto para baseline-readonly (se esperaba 1 cliente + 1 negocio).")
}

// Creado UNA vez a nivel de módulo — k6 le da a cada VU su propio contexto
// JS aislado, así que esta variable persiste entre iteraciones de la MISMA
// VU (igual que una sesión de browser real mientras la pestaña sigue
// abierta), en vez de recrear el jar en cada iteración.
const clienteJar = createActorJar(clienteIdentity)

export const options = {
  scenarios: {
    baseline_readonly: {
      executor: "constant-vus",
      vus: 1,
      duration: "3m",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    checks: ["rate==1"],
    http_req_duration: ["p(95)<1000"],
  },
  // p(99) no viene en el set por defecto (avg/min/med/max/p(90)/p(95)) —
  // Fase A exige registrar p50/p95/p99, no sólo el que tiene threshold.
  summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "p(99)", "max"],
}

export default function () {
  runClienteReadonlyRound(clienteJar, negocioIdentity)
  // Respeta el poll real más lento auditado en Fase A (15s) — nunca más
  // agresivo que el polling real de la app.
  sleep(15)
}

export function handleSummary(data) {
  return buildSummaryOutputs(data, {
    runId: __ENV.K6_RUN_ID || "unknown",
    scenario: "baseline-readonly",
    targetUrl: TARGET_URL,
    commitHash: __ENV.K6_COMMIT_HASH || "unknown",
    resultsDir: __ENV.K6_RESULTS_DIR,
  })
}
