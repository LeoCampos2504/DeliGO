// Fase C orchestrator: target gate -> isolated seed -> PG snapshots -> k6 ->
// read-only integrity -> directed cleanup -> safe artifacts. No Railway API/CLI,
// no product changes, and no DATABASE_URL fallback.
import { spawn, execSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { createHash } from "node:crypto"
import { resolve } from "node:path"
import { TARGET_URL, assertAllowedTarget } from "../config/environments.js"
import { resultsDir, writeManifest } from "../seed/manifest"
import { deleteRuntimePool } from "../seed/runtime-pool"
import type { SeedResult } from "../seed/seed-pool"
import { capturePgSnapshot, startPgSampler } from "./pg-metrics"

const KNOWN_SCENARIOS = new Set(["baseline-readonly", "baseline-one-order", "pacingProbe", "realistic20", "compressed50"])
const SCENARIO_FILES: Record<string, string> = {
  "baseline-readonly": "baseline-readonly.js",
  "baseline-one-order": "baseline-one-order.js",
  pacingProbe: "pacing-probe.js",
  realistic20: "realistic-20.js",
  compressed50: "compressed-50-orders.js",
}
const KNOWN_K6_LOCATIONS = [
  "k6",
  "C:\\Program Files\\k6\\k6.exe",
  `${process.env.LOCALAPPDATA || ""}\\Microsoft\\WinGet\\Links\\k6.exe`,
  `${process.env.LOCALAPPDATA || ""}\\Programs\\k6\\k6.exe`,
]

const REALISTIC_FIDELITY_ENDPOINTS = [
  { key: "client_orders", expectedIntervalMs: 15_000, minimumSamples: 2 },
  { key: "client_unread_chat", expectedIntervalMs: 15_000, minimumSamples: 2 },
  { key: "business_counts", expectedIntervalMs: 8_000, minimumSamples: 2 },
  { key: "business_orders", expectedIntervalMs: 15_000, minimumSamples: 2 },
  { key: "repartidor_profile", expectedIntervalMs: 30_000, minimumSamples: 2 },
  { key: "repartidor_orders", expectedIntervalMs: 8_000, minimumSamples: 2 },
  { key: "repartidor_delivered", expectedIntervalMs: 15_000, minimumSamples: 2 },
  { key: "operations_salon_panel", expectedIntervalMs: 15_000, minimumSamples: 2 },
]

function evaluateEndpointFidelity(summary: { metrics?: Record<string, { values?: Record<string, number> }> }) {
  const metrics = summary.metrics || {}
  const endpoints = REALISTIC_FIDELITY_ENDPOINTS.map(({ key, expectedIntervalMs, minimumSamples }) => {
    const metric = metrics[`realistic20_poll_interval_ms_${key}`]
    const values = metric?.values || {}
    const observedEffectiveIntervalMs = Number(values.med || values.avg || 0)
    const pollStarts = Number(metrics[`realistic20_poll_starts_${key}`]?.values?.count || 0)
    const samples = Math.max(0, pollStarts - 1)
    const differencePercent = expectedIntervalMs > 0
      ? ((observedEffectiveIntervalMs - expectedIntervalMs) / expectedIntervalMs) * 100
      : 0
    const pass = samples >= minimumSamples && Math.abs(differencePercent) <= 10
    return {
      endpoint: key,
      expectedIntervalMs,
      observedEffectiveIntervalMs,
      samples,
      differencePercent,
      fidelity: pass ? "PASS" : "FAIL",
    }
  })
  const catalogStarts = Number(metrics.realistic20_poll_starts_catalog_business?.values?.count || 0)
  const catalogPass = catalogStarts >= 1
  return {
    pass: catalogPass && endpoints.every((endpoint) => endpoint.fidelity === "PASS"),
    catalogOnOpen: { expectedPerActiveClientVu: 1, observedStarts: catalogStarts, fidelity: catalogPass ? "PASS" : "FAIL" },
    endpoints,
  }
}

function requireTestDatabaseUrl(): string {
  const value = process.env.DELIGO_TEST_DATABASE_URL
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error("TEST_DB_HARD_GATE: DELIGO_TEST_DATABASE_URL no está disponible. Nunca se usa DATABASE_URL como fallback silencioso.")
  }
  return value
}

function resolveK6Binary(): string {
  if (process.env.K6_BIN && existsSync(process.env.K6_BIN)) return process.env.K6_BIN
  for (const candidate of KNOWN_K6_LOCATIONS) {
    if (candidate !== "k6" && candidate && existsSync(candidate)) return candidate
  }
  return "k6"
}

function parseArgs(argv: string[]): { scenario: string } {
  const idx = argv.indexOf("--scenario")
  const scenario = idx >= 0 ? argv[idx + 1] : undefined
  if (!scenario || !KNOWN_SCENARIOS.has(scenario)) {
    throw new Error(`Escenario faltante/desconocido: ${scenario ?? ""}. Válidos: ${[...KNOWN_SCENARIOS].join(", ")}`)
  }
  return { scenario }
}

function runK6(k6Bin: string, scenarioFile: string, env: NodeJS.ProcessEnv): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(k6Bin, ["run", scenarioFile], { env, stdio: "inherit" })
    child.on("error", reject)
    child.on("close", (code) => resolve(code ?? 1))
    const forwardSignal = (signal: NodeJS.Signals) => {
      console.error(`[orchestrate] ${signal} recibido; deteniendo k6`)
      child.kill(signal)
    }
    process.once("SIGINT", () => forwardSignal("SIGINT"))
    process.once("SIGTERM", () => forwardSignal("SIGTERM"))
  })
}

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex")
}

function evaluatePacingProbe(resultsPath: string) {
  const summaryPath = join(resultsPath, "summary.json")
  if (!existsSync(summaryPath)) {
    return { pass: false, reason: "SUMMARY_MISSING", expectedMinIterationDurationMs: 14000 }
  }
  const summary = JSON.parse(readFileSync(summaryPath, "utf8"))
  const metrics = summary.metrics || {}
  const duration = metrics.iteration_duration?.values || {}
  const iterations = Number(metrics.iterations?.values?.count || 0)
  const requests = Number(metrics.http_reqs?.values?.count || 0)
  const avgIterationDurationMs = Number(duration.avg || 0)
  const p95IterationDurationMs = Number(duration["p(95)"] || 0)
  const clientIterationDuration = metrics.realistic20_iteration_duration_cliente?.values || {}
  const clientAvgIterationDurationMs = Number(clientIterationDuration.avg || 0)
  const clientP95IterationDurationMs = Number(clientIterationDuration["p(95)"] || 0)
  const failedRate = Number(metrics.http_req_failed?.values?.rate || 0)
  const checksRate = Number(metrics.checks?.values?.rate || 0)
  const endpointFidelity = evaluateEndpointFidelity(summary)
  const expectedMinIterationDurationMs = 14000
  const pass = iterations >= 2
    && requests >= iterations
    && clientAvgIterationDurationMs >= expectedMinIterationDurationMs
    && clientP95IterationDurationMs >= expectedMinIterationDurationMs
    && failedRate === 0
    && checksRate === 1
    && endpointFidelity.pass
  return {
    pass,
    expectedMinIterationDurationMs,
    iterations,
    requests,
    avgIterationDurationMs,
    p95IterationDurationMs,
    clientAvgIterationDurationMs,
    clientP95IterationDurationMs,
    failedRate,
    checksRate,
    endpointFidelity,
  }
}

async function assertTargetStable(): Promise<void> {
  assertAllowedTarget(TARGET_URL)
  const statuses: number[] = []
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 30000)
    try {
      const response = await fetch(`${TARGET_URL}/`, { method: "GET", redirect: "manual", signal: controller.signal })
      statuses.push(response.status)
      if (response.status >= 500) throw new Error(`TARGET_UNSTABLE_HTTP_${response.status}`)
    } finally {
      clearTimeout(timer)
    }
  }
  if (statuses.length !== 3 || statuses.some((status) => status < 200 || status >= 500)) {
    throw new Error(`TARGET_UNSTABLE_HTTP statuses=${statuses.join(",")}`)
  }
  console.log(`TARGET_STABLE_BEFORE_LOAD=SI statuses=${statuses.join(",")}`)
}

function safeError(error: unknown): string {
  return error instanceof Error ? error.name : "unknown"
}

function collectFiles(root: string): string[] {
  if (!existsSync(root)) return []
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name)
    return entry.isDirectory() ? collectFiles(path) : [path]
  })
}

function scanResultsForSecrets(root: string) {
  const prohibited: string[] = []
  const patterns = [
    /postgres(?:ql)?:\/\/\S+/i,
    /(?:DELIGO_TEST_DATABASE_URL|DATABASE_URL)\s*[:=]\s*\S+/i,
    /(?:authorization|cookie|set-cookie)\s*:\s*\S+/i,
    /["']sessionToken["']\s*:/i,
  ]
  for (const file of collectFiles(root)) {
    const text = readFileSync(file, "utf8")
    if (patterns.some((pattern) => pattern.test(text))) prohibited.push(file)
  }
  return { pass: prohibited.length === 0, prohibitedFiles: prohibited.map((file) => file.replace(`${root}\\`, "")) }
}

function numeric(value: unknown): number {
  const result = Number(value)
  return Number.isFinite(result) ? result : 0
}

function summarizePg(resultsPath: string) {
  const path = join(resultsPath, "postgres-metrics.jsonl")
  const snapshots = existsSync(path)
    ? readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line))
    : []
  const valid = snapshots.filter((snapshot) => typeof snapshot.connectionCount !== "undefined")
  const before = valid.find((snapshot) => snapshot.phase === "before") ?? valid[0] ?? {}
  const after = valid.find((snapshot) => snapshot.phase === "after") ?? valid[valid.length - 1] ?? {}
  const post = valid.find((snapshot) => snapshot.phase === "post_cleanup") ?? after
  const peak = valid.reduce((max, snapshot) => Math.max(max, numeric(snapshot.connectionCount)), 0)
  const dbBefore = before.pgStatDatabase || {}
  const dbAfter = after.pgStatDatabase || {}
  const delta = (field: string) => numeric(dbAfter[field]) - numeric(dbBefore[field])
  const hitDelta = delta("blksHit")
  const readDelta = delta("blksRead")
  return {
    snapshots: snapshots.length,
    pgConnectionsBaseline: numeric(before.connectionCount),
    pgConnectionsPeak: peak,
    pgConnectionsPost: numeric(post.connectionCount),
    pgMaxConnections: numeric(before.maxConnections),
    pgXactCommitDelta: delta("xactCommit"),
    pgXactRollbackDelta: delta("xactRollback"),
    pgDeadlockDelta: delta("deadlocks"),
    pgTempFilesDelta: delta("tempFiles"),
    pgTempBytesDelta: delta("tempBytes"),
    pgCacheHitSignal: hitDelta + readDelta > 0 ? hitDelta / (hitDelta + readDelta) : null,
  }
}

async function main() {
  const { scenario } = parseArgs(process.argv.slice(2))
  requireTestDatabaseUrl()
  await assertTargetStable()
  const runId = `loadcert-${Date.now()}-${randomUUID().slice(0, 8)}`
  const startedAt = new Date().toISOString()
  const resultsPath = join(resultsDir(), runId)
  mkdirSync(resultsPath, { recursive: true })
  const k6Bin = resolveK6Binary()
  const scenarioFile = resolve(process.cwd(), "load-tests", "k6", "scenarios", SCENARIO_FILES[scenario])
  if (!existsSync(scenarioFile)) throw new Error(`K6_SCENARIO_FILE_MISSING path=${scenarioFile}`)
  const scenarioSha256 = sha256File(scenarioFile)
  const k6CommandResolved = JSON.stringify([k6Bin, "run", scenarioFile])
  let k6Version = "unknown"
  try {
    k6Version = execSync(`"${k6Bin}" version`, { encoding: "utf8" }).trim()
  } catch (error) {
    throw new Error(`No se pudo ejecutar k6 (${safeError(error)})`)
  }
  const commitHash = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim()
  console.log(`[orchestrate] runId=${runId} scenario=${scenario} k6=${k6Version}`)

  let seedResult: SeedResult | undefined
  let sampler: Awaited<ReturnType<typeof startPgSampler>> | undefined
  let k6ExitCode = 1
  let integrity: unknown = null
  let cleanupVerdict: unknown = null
  let pacingProbe: unknown = null
  let realisticFidelity: unknown = null
  let targetStable = true
  try {
    const seedModule = await import("../seed/seed-pool")
    seedResult = await seedModule.seedFixtures(runId, scenario)
    await seedModule.disconnectSeedDb()
    await capturePgSnapshot(resultsPath, "before")
    sampler = await startPgSampler(resultsPath)

    const childEnv: NodeJS.ProcessEnv = { ...process.env, K6_RUN_ID: runId, K6_POOL_FILE: seedResult.runtimePoolFile, K6_RESULTS_DIR: resultsPath, K6_COMMIT_HASH: commitHash }
    childEnv.K6_SCENARIO_FILE = scenarioFile
    childEnv.K6_SCENARIO_SHA256 = scenarioSha256
    delete childEnv.DATABASE_URL
    delete childEnv.DELIGO_TEST_DATABASE_URL
    k6ExitCode = await runK6(k6Bin, scenarioFile, childEnv)
    await sampler.stop()
    sampler = undefined
    await capturePgSnapshot(resultsPath, "after")

    if (scenario === "pacingProbe") {
      pacingProbe = evaluatePacingProbe(resultsPath)
      if (!(pacingProbe as { pass?: boolean }).pass) k6ExitCode = 1
    } else if (scenario === "realistic20") {
      const summaryPath = join(resultsPath, "summary.json")
      realisticFidelity = existsSync(summaryPath)
        ? evaluateEndpointFidelity(JSON.parse(readFileSync(summaryPath, "utf8")))
        : { pass: false, reason: "SUMMARY_MISSING" }
      if (!(realisticFidelity as { pass?: boolean }).pass) k6ExitCode = 1
      const integrityModule = await import("./integrity")
      integrity = await integrityModule.validateRealistic20Integrity(seedResult.manifest)
    } else if (scenario === "compressed50") {
      const integrityModule = await import("./integrity")
      integrity = await integrityModule.validateCompressed50Integrity(seedResult.manifest)
      if (integrity && typeof integrity === "object" && "pedidoIds" in integrity) {
        seedResult.manifest.pedidoIds.push(...(integrity.pedidoIds as string[]))
        writeManifest(seedResult.manifest)
      }
    } else if (scenario === "baseline-one-order" && k6ExitCode === 0) {
      const integrityModule = await import("./integrity")
      const one = await integrityModule.validateOneOrderIntegrity(seedResult.manifest)
      integrity = one
      if (one.pedidoId) {
        seedResult.manifest.pedidoIds.push(one.pedidoId)
        writeManifest(seedResult.manifest)
      }
    }
  } finally {
    if (sampler) await sampler.stop().catch(() => {})
    if (seedResult) {
      try {
        const cleanupModule = await import("./cleanup")
        cleanupVerdict = await cleanupModule.cleanupByManifest(seedResult.manifest)
        await capturePgSnapshot(resultsPath, "post_cleanup")
        await cleanupModule.disconnectCleanupDb()
      } catch (error) {
        cleanupVerdict = { allClean: false, error: safeError(error) }
        // Runtime secrets are still removed even when DB cleanup needs manual recovery.
        deleteRuntimePool(seedResult.manifest.runId)
      }
    }
  }

  const endedAt = new Date().toISOString()
  const secretScan = scanResultsForSecrets(resultsPath)
  const metadata = {
    runId,
    scenario,
    scenarioFile,
    scenarioSha256,
    k6CommandResolved,
    commitHash,
    targetUrl: TARGET_URL,
    targetStableBeforeLoad: targetStable,
    k6Version,
    startedAt,
    endedAt,
    k6ExitCode,
    financialFixture: seedResult?.financialFixture ?? null,
    pacingProbe,
    realisticFidelity,
    seedCounts: seedResult ? {
      cliente: seedResult.manifest.clienteIds.length,
      negocioSessions: seedResult.manifest.sessionTokenHashes.length,
      repartidor: seedResult.manifest.repartidorIds.length,
      operaciones: seedResult.manifest.cuentaOperativaIds.length,
    } : null,
    integrity,
    cleanupVerdict,
    postgres: summarizePg(resultsPath),
    secretScan,
    docsVerified: true,
    docsEvidence: {
      k6SleepIncludedInIterationTiming: true,
      sources: [
        "https://grafana.com/docs/k6/latest/javascript-api/k6/sleep/",
        "https://grafana.com/docs/k6/latest/using-k6/metrics/reference/",
        "https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/constant-arrival-rate/",
        "https://grafana.com/docs/k6/latest/javascript-api/k6-execution/",
      ],
    },
  }
  writeFileSync(join(resultsPath, "run-metadata.json"), JSON.stringify(metadata, null, 2), "utf8")
  console.log(`[orchestrate] run metadata written for ${scenario}; cleanup=${Boolean((cleanupVerdict as { allClean?: boolean } | null)?.allClean)}`)
  process.exit(k6ExitCode === 0 && secretScan.pass && Boolean((cleanupVerdict as { allClean?: boolean } | null)?.allClean) && (pacingProbe === null || Boolean((pacingProbe as { pass?: boolean }).pass)) ? 0 : 1)
}

main().catch((error) => {
  console.error(`[orchestrate] FALLO ${safeError(error)}`)
  process.exit(1)
})
