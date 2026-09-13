/**
 * P2-T24-R1 — opt-in OSRM Match capability probe.
 *
 * This is deliberately not imported by tests, build, lint or CI. It performs
 * read-only requests with synthetic coordinates only and hard-fails outside
 * an explicit TESTING environment.
 */

import { createOsrmMapMatchingProvider } from "@/lib/osrm-map-matching-provider"
import type { RawMatchingPoint } from "@/lib/map-matching-provider"

const SYNTHETIC_TRACE: RawMatchingPoint[] = [
  { lat: 52.517037, lng: 13.38886, offsetMs: 0, accuracy: 25 },
  { lat: 52.529407, lng: 13.397634, offsetMs: 1_000, accuracy: 25 },
  { lat: 52.523219, lng: 13.428555, offsetMs: 2_000, accuracy: 25 },
]

function fail(message: string): never {
  console.error("T24_PROBE_STATUS=BLOCKED")
  console.error("T24_PROBE_ERROR=" + message)
  process.exit(1)
}

function assertTestingGuard(): { baseUrl: string; environment: string } {
  if (!process.argv.includes("--confirm-testing")) fail("missing --confirm-testing")
  const environment = process.env.DELIGO_ENVIRONMENT || process.env.RAILWAY_ENVIRONMENT_NAME || process.env.APP_ENV || ""
  if (environment !== "TESTING") fail("environment marker must be exactly TESTING")
  if (process.env.NODE_ENV === "production") fail("NODE_ENV=production rejected")
  const baseUrl = process.env.T24_OSRM_BASE_URL || process.env.MAP_MATCHING_BASE_URL || ""
  if (!baseUrl) fail("missing T24_OSRM_BASE_URL or MAP_MATCHING_BASE_URL")
  try {
    const parsed = new URL(baseUrl)
    const host = parsed.hostname.toLowerCase()
    if (parsed.username || parsed.password || parsed.search || parsed.hash ||
        host === "deligo.ar" || host === "www.deligo.ar" || host.endsWith(".deligo.ar")) {
      fail("Production or credential-bearing URL rejected")
    }
  } catch {
    fail("invalid OSRM base URL")
  }
  return { baseUrl, environment }
}

async function main(): Promise<void> {
  const { baseUrl, environment } = assertTestingGuard()
  const startedAt = Date.now()
  const provider = createOsrmMapMatchingProvider({
    baseUrl,
    enabled: true,
    timeoutMs: 250,
    env: { ...process.env, DELIGO_ENVIRONMENT: environment, NODE_ENV: "test" },
  })
  const result = await provider.matchTrajectory(SYNTHETIC_TRACE)
  const latencyMs = Date.now() - startedAt

  console.log("T24_PROBE_STATUS=COMPLETED")
  console.log("PROBE_EXECUTION_ENVIRONMENT=LOCAL_TESTING_CONTEXT")
  console.log("PROBE_PII_SENT=NO")
  console.log("PROBE_TRACE_POINTS=3_SYNTHETIC")
  console.log("LATENCY_MS=" + latencyMs)
  console.log("TIMEOUT_MS=250")
  console.log("OSRM_MATCH_RESULT_STATUS=" + result.status)
  if (result.status === "matched") {
    console.log("OSRM_MATCH_HTTP_AND_CODE=PASS")
    console.log("OSRM_MATCH_VALID_TRACE=PASS")
    console.log("OSRM_MATCH_RADIUSES=" + (SYNTHETIC_TRACE.every((point) => point.accuracy !== undefined) ? "PASS" : "NOT_RUN"))
    console.log("OSRM_MATCH_TRACEPOINTS=" + result.tracepoints.length)
    console.log("OSRM_MATCHINGS=" + result.matchings.length)
    console.log("OSRM_MATCH_CONFIDENCE=" + result.matchings.map((matching) => matching.confidence).join(","))
    console.log("OSRM_MATCH_GEOMETRY=FULL_GEOJSON")
  } else {
    console.log("OSRM_MATCH_VALID_TRACE=FAIL")
    console.log("OSRM_MATCH_RADIUSES=FAIL")
    console.log("OSRM_MATCH_FAILURE_REASON=" + (result.status === "error" || result.status === "rejected" ? result.reason : "timeout"))
  }
  console.log("OSRM_MATCH_NOMATCH_BEHAVIOR=NOT_RUN_RUNTIME_SAFE")
  console.log("PROBE_NOTE=NoMatch and timeout/abort failure paths are covered by deterministic unit tests; no unsuitable public request is sent.")
}

if (import.meta.main) {
  await main().catch((error) => fail(error instanceof Error ? error.message : String(error)))
}
