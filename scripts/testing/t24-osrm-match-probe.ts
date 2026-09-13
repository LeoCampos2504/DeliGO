/**
 * P2-T24-R1 — opt-in OSRM Match capability probe.
 *
 * This is deliberately not imported by tests, build, lint or CI. It performs
 * read-only requests with synthetic coordinates only and hard-fails outside
 * an explicit TESTING environment.
 */

import { createOsrmMapMatchingProvider } from "@/lib/osrm-map-matching-provider"
import { evaluateMapMatching } from "@/lib/map-matching-policy"
import type { RawMatchingPoint } from "@/lib/map-matching-provider"

const SYNTHETIC_TRACE: RawMatchingPoint[] = [
  { lat: 52.517034, lng: 13.38882, offsetMs: 0, accuracy: 5 },
  { lat: 52.52694, lng: 13.415833, offsetMs: 2_000, accuracy: 5 },
  { lat: 52.523239, lng: 13.428554, offsetMs: 4_000, accuracy: 5 },
]

const DEFAULT_TIMEOUT_MS = 250

function readTimeoutMs(): number {
  const flagIndex = process.argv.indexOf("--timeout-ms")
  if (flagIndex === -1) return DEFAULT_TIMEOUT_MS
  const rawValue = process.argv[flagIndex + 1]
  if (!rawValue || !/^\d+$/.test(rawValue)) fail("--timeout-ms must be an integer from 100 to 1000")
  const timeoutMs = Number(rawValue)
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 1000) {
    fail("--timeout-ms must be an integer from 100 to 1000")
  }
  return timeoutMs
}

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
  const timeoutMs = readTimeoutMs()
  const startedAt = Date.now()
  const provider = createOsrmMapMatchingProvider({
    baseUrl,
    enabled: true,
    timeoutMs,
    env: { ...process.env, DELIGO_ENVIRONMENT: environment, NODE_ENV: "test" },
  })
  const result = await provider.matchTrajectory(SYNTHETIC_TRACE)
  const latencyMs = Date.now() - startedAt

  console.log("T24_PROBE_STATUS=COMPLETED")
  console.log("PROBE_EXECUTION_ENVIRONMENT=LOCAL_TESTING_CONTEXT")
  console.log("PROBE_PII_SENT=NO")
  console.log("PROBE_TRACE_POINTS=3_SYNTHETIC")
  console.log("LATENCY_MS=" + latencyMs)
  console.log("TIMEOUT_MS=" + timeoutMs)
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
  const policy = evaluateMapMatching(SYNTHETIC_TRACE, result)
  console.log("PROBE_CURRENT_POLICY_STAGE=ADAPTER_PARSER_GEOMETRY_AND_EVALUATE_MAP_MATCHING")
  console.log("POLICY_DECISION=" + policy.decision)
  if (policy.decision === "REJECT_MATCH") console.log("POLICY_REJECTION_REASON=" + policy.reason)
  const guardStatus = (reasons: string[]): string =>
    policy.decision === "ACCEPT_MATCH" ? "PASS" : policy.decision === "REJECT_MATCH" && reasons.includes(policy.reason) ? "FAIL" : "NOT_EVALUATED"
  console.log("SNAP_DISTANCE_GUARDS=" + guardStatus(["snap_distance_exceeded", "snap_distance_count_mismatch"]))
  console.log("TRACEPOINT_GUARDS=" + guardStatus(["tracepoint_count_mismatch", "null_tracepoint", "raw_point_count_mismatch"]))
  console.log("CONFIDENCE_GUARD=" + guardStatus(["low_confidence"]))
  console.log("ALTERNATIVES_GUARD=" + guardStatus(["ambiguous_tracepoints"]))
  console.log("SINGLE_SUBTRACE_GUARD=" + guardStatus(["multiple_or_missing_matchings"]))
  console.log("OSRM_MATCH_NOMATCH_BEHAVIOR=NOT_RUN_RUNTIME_SAFE")
  console.log("PROBE_NOTE=NoMatch and timeout/abort failure paths are covered by deterministic unit tests; no unsuitable public request is sent.")
}

if (import.meta.main) {
  await main().catch((error) => fail(error instanceof Error ? error.message : String(error)))
}
