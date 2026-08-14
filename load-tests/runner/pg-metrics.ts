// PostgreSQL TESTING observability sampler. Read-only fixed aggregate queries;
// it never records SQL text, row data, or DELIGO_TEST_DATABASE_URL.
import { appendFileSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

function jsonSafe(value: unknown): JsonValue {
  if (typeof value === "bigint") return Number(value)
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(jsonSafe)
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, jsonSafe(entry)]))
  }
  if (value === undefined) return null
  return value as JsonValue
}
function requireTestDatabaseUrl(): string {
  const value = process.env.DELIGO_TEST_DATABASE_URL
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error("TEST_DB_HARD_GATE: DELIGO_TEST_DATABASE_URL no está disponible para PG sampler")
  }
  return value
}

export function metricsPath(resultsPath: string): string {
  return join(resultsPath, "postgres-metrics.jsonl")
}

export async function capturePgSnapshot(resultsPath: string, phase: string): Promise<Record<string, unknown>> {
  process.env.DATABASE_URL = requireTestDatabaseUrl()
  const { db } = await import("@/lib/db")
  const [activity, maxConnections, database, tables] = await Promise.all([
    db.$queryRawUnsafe(`
      SELECT current_database() AS current_database, count(*)::bigint AS connection_count
      FROM pg_stat_activity
      WHERE datname = current_database()
    `),
    db.$queryRawUnsafe(`SHOW max_connections`),
    db.$queryRawUnsafe(`
      SELECT datname, xact_commit, xact_rollback, blks_read, blks_hit,
             temp_files, temp_bytes, deadlocks
      FROM pg_stat_database
      WHERE datname = current_database()
    `),
    db.$queryRawUnsafe(`
      SELECT relname, n_live_tup, seq_scan, idx_scan, n_tup_ins, n_tup_upd, n_tup_del
      FROM pg_stat_user_tables
      WHERE relname IN ('pedidos', 'negocios', 'productos', 'clientes', 'chat_mensajes')
      ORDER BY relname
    `),
  ])
  const activityRow = (activity as Array<Record<string, unknown>>)[0] || {}
  const maxRow = (maxConnections as Array<Record<string, unknown>>)[0] || {}
  const databaseRow = (database as Array<Record<string, unknown>>)[0] || {}
  const snapshot = {
    capturedAt: new Date().toISOString(),
    phase,
    currentDatabase: databaseRow.datname ?? activityRow.current_database ?? null,
    connectionCount: activityRow.connection_count ?? null,
    maxConnections: maxRow.max_connections ?? null,
    pgStatDatabase: {
      xactCommit: databaseRow.xact_commit ?? null,
      xactRollback: databaseRow.xact_rollback ?? null,
      blksRead: databaseRow.blks_read ?? null,
      blksHit: databaseRow.blks_hit ?? null,
      tempFiles: databaseRow.temp_files ?? null,
      tempBytes: databaseRow.temp_bytes ?? null,
      deadlocks: databaseRow.deadlocks ?? null,
    },
    pgStatUserTables: tables,
  }
  appendFileSync(metricsPath(resultsPath), `${JSON.stringify(jsonSafe(snapshot))}\n`, "utf-8")
  return snapshot
}

export async function startPgSampler(resultsPath: string, intervalMs = 12000) {
  mkdirSync(dirname(metricsPath(resultsPath)), { recursive: true })
  const state = { stopped: false, inFlight: Promise.resolve() as Promise<unknown> }
  const timer = setInterval(() => {
    if (state.stopped) return
    state.inFlight = state.inFlight.then(() => capturePgSnapshot(resultsPath, "during")).catch((error) => {
      appendFileSync(
        metricsPath(resultsPath),
        `${JSON.stringify({ capturedAt: new Date().toISOString(), phase: "during", samplerError: error instanceof Error ? error.name : "unknown" })}\n`,
        "utf-8"
      )
    })
  }, intervalMs)
  return {
    async stop() {
      state.stopped = true
      clearInterval(timer)
      await state.inFlight
    },
  }
}
