// OBSERVABILITY + LOAD/PERFORMANCE CERTIFICATION — orquestador Bun
// ============================================
// Un solo comando: seed -> spawn k6 -> integrity validation -> cleanup ->
// run-metadata. Runtime BUN (Prisma/fixtures/sessions/manifest/cleanup) y
// runtime K6 (HTTP/cookies/VUs/checks/métricas) estrictamente separados —
// este archivo es el único punto donde ambos se tocan, y sólo para spawnear
// k6 como proceso hijo (nunca importa Prisma dentro del proceso k6).
//
// DB hard gate: TODO acceso a Prisma en este archivo pasa por imports
// DINÁMICOS (`await import(...)`) ejecutados DESPUÉS de fijar
// `process.env.DATABASE_URL = process.env.DELIGO_TEST_DATABASE_URL` —
// nunca un import estático a nivel de módulo (esos se hoistean antes que
// cualquier otro código y ejecutarían con el DATABASE_URL ambiente
// incorrecto). Ver seed-pool.ts para la misma explicación en detalle.
//
// Uso: bun run load-tests/runner/orchestrate.ts --scenario baseline-readonly
//      bun run load-tests/runner/orchestrate.ts --scenario baseline-one-order

import { spawn, execSync } from "node:child_process"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { TARGET_URL, assertAllowedTarget } from "../config/environments.js"
import { resultsDir, writeManifest } from "../seed/manifest"

const KNOWN_SCENARIOS = new Set(["baseline-readonly", "baseline-one-order"])

const KNOWN_K6_LOCATIONS = [
  "k6", // PATH, si ya está resuelto en este shell
  "C:\\Program Files\\k6\\k6.exe",
  `${process.env.LOCALAPPDATA || ""}\\Microsoft\\WinGet\\Links\\k6.exe`,
  `${process.env.LOCALAPPDATA || ""}\\Programs\\k6\\k6.exe`,
]

function resolveK6Binary(): string {
  if (process.env.K6_BIN && existsSync(process.env.K6_BIN)) return process.env.K6_BIN
  for (const candidate of KNOWN_K6_LOCATIONS) {
    if (candidate === "k6") continue // se prueba al spawnear, no con existsSync
    if (candidate && existsSync(candidate)) return candidate
  }
  // Último recurso: confiar en PATH y dejar que el spawn falle con un error claro si no está.
  return "k6"
}

function parseArgs(argv: string[]): { scenario: string } {
  const idx = argv.indexOf("--scenario")
  const scenario = idx >= 0 ? argv[idx + 1] : undefined
  if (!scenario || !KNOWN_SCENARIOS.has(scenario)) {
    throw new Error(
      `Escenario desconocido o faltante: "${scenario}". Válidos en Fase B: ${[...KNOWN_SCENARIOS].join(", ")}. (fail closed — no se ejecuta nada)`
    )
  }
  return { scenario }
}

function runK6(k6Bin: string, scenarioFile: string, env: NodeJS.ProcessEnv): Promise<number> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(k6Bin, ["run", scenarioFile], {
      env,
      stdio: "inherit",
    })
    child.on("error", (err) => reject(err))
    child.on("close", (code) => resolvePromise(code ?? 1))
    // Señal handling — intenta detener el hijo k6 antes de salir.
    const forwardSignal = (signal: NodeJS.Signals) => {
      console.error(`\n[orchestrate] ${signal} recibido — deteniendo k6 y preparando cleanup...`)
      child.kill(signal)
    }
    process.once("SIGINT", () => forwardSignal("SIGINT"))
    process.once("SIGTERM", () => forwardSignal("SIGTERM"))
  })
}

async function main() {
  const { scenario } = parseArgs(process.argv.slice(2))

  // ---- Target hard gate ----
  assertAllowedTarget(TARGET_URL)

  // ---- DB hard gate ----
  const testDbUrl = process.env.DELIGO_TEST_DATABASE_URL
  if (!testDbUrl) {
    throw new Error(
      "TEST_DB_HARD_GATE: DELIGO_TEST_DATABASE_URL no está definida en el entorno. Nunca se usa DATABASE_URL como fallback silencioso. Abortando antes de cualquier write."
    )
  }

  const k6Bin = resolveK6Binary()
  let k6Version = "unknown"
  try {
    k6Version = execSync(`"${k6Bin}" version`, { encoding: "utf-8" }).trim()
  } catch (err) {
    throw new Error(`No se pudo ejecutar k6 en "${k6Bin}" — instalar k6 (winget install k6 --source winget) antes de continuar. Detalle: ${(err as Error).message}`)
  }

  let commitHash = "unknown"
  try {
    commitHash = execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim()
  } catch {
    // no crítico para el run — se registra "unknown" si falla.
  }

  const runId = `loadcert-${Date.now()}-${randomUUID().slice(0, 8)}`
  const startedAt = new Date().toISOString()
  console.log(`[orchestrate] runId=${runId} scenario=${scenario} target=${TARGET_URL} k6=${k6Version}`)

  // ---- Seed (Prisma, dinámico, DESPUÉS del DB hard gate ya validado arriba) ----
  const { seedFixtures, disconnectSeedDb } = await import("../seed/seed-pool")
  const seedResult = await seedFixtures(runId, scenario)
  await disconnectSeedDb()
  console.log(`[orchestrate] seed OK — negocioIds=${seedResult.manifest.negocioIds} clienteIds=${seedResult.manifest.clienteIds}`)

  const resultsPath = join(resultsDir(), runId)
  mkdirSync(resultsPath, { recursive: true })

  const scenarioFile = join(__dirname, "..", "k6", "scenarios", `${scenario}.js`)

  let k6ExitCode = 1
  let cleanupVerdict: unknown = null
  try {
    k6ExitCode = await runK6(k6Bin, scenarioFile, {
      ...process.env,
      K6_RUN_ID: runId,
      K6_POOL_FILE: seedResult.runtimePoolFile,
      K6_RESULTS_DIR: resultsPath,
      K6_COMMIT_HASH: commitHash,
    })
    console.log(`[orchestrate] k6 exit code=${k6ExitCode}`)

    // ---- Integrity validation (sólo tiene sentido si hubo writes) ----
    if (scenario === "baseline-one-order" && k6ExitCode === 0) {
      const { validateOneOrderIntegrity } = await import("./integrity")
      const integrity = await validateOneOrderIntegrity(seedResult.manifest)
      console.log("[orchestrate] integrity:", JSON.stringify(integrity, null, 2))
      writeFileSync(join(resultsPath, "integrity-verdict.json"), JSON.stringify(integrity, null, 2), "utf-8")
      if (integrity.pedidoId) {
        seedResult.manifest.pedidoIds.push(integrity.pedidoId)
        // Persistir ANTES de cleanup — si el proceso muriera entre esta
        // línea y el cleanup de más abajo, el manifest en disco ya refleja
        // el pedido real y `cleanup.ts --manifest <path>` (recuperación
        // manual) puede encontrarlo sin depender de ningún cascade
        // implícito de Prisma.
        writeManifest(seedResult.manifest)
      }
    }
  } finally {
    // ---- Cleanup — siempre, incluso si k6 falló o hubo una excepción arriba ----
    const { cleanupByManifest, disconnectCleanupDb } = await import("./cleanup")
    cleanupVerdict = await cleanupByManifest(seedResult.manifest)
    await disconnectCleanupDb()
    console.log("[orchestrate] cleanup verdict:", JSON.stringify(cleanupVerdict, null, 2))
  }

  const endedAt = new Date().toISOString()
  const runMetadata = {
    runId,
    scenario,
    commitHash,
    targetUrl: TARGET_URL,
    k6Version,
    startedAt,
    endedAt,
    k6ExitCode,
    cleanupVerdict,
  }
  writeFileSync(join(resultsPath, "run-metadata.json"), JSON.stringify(runMetadata, null, 2), "utf-8")
  console.log(`[orchestrate] run-metadata.json escrito en ${resultsPath}`)

  process.exit(k6ExitCode)
}

main().catch((err) => {
  console.error("[orchestrate] FALLO:", err)
  process.exit(1)
})
