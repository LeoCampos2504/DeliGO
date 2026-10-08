// ============================================
// P2-T56-R3A-I5-P0 — comandos internos de operación de reservas de stock
// ============================================
// Orquestación de los dos comandos internos (sin endpoint ni UI):
//   scripts/stock-reservation-mode.ts      → transición de modo auditada
//   scripts/stock-reservation-rollback.ts  → recuperación extraordinaria
// Toda escritura pasa por la autoridad transaccional de src/lib/stock-lifecycle.ts
// (cambiarModoReservaStock / liberarReservasPorRollback dentro de
// runStockSerializable). Este módulo no escribe nada por sí mismo y no importa
// la base: recibe sus dependencias (inyectables en tests).
//
// Protecciones (en este orden, todas antes de cualquier escritura):
//   1. argumentos estrictos (desconocidos o repetidos → rechazo);
//   2. --env debe ser un entorno habilitado (hoy sólo TESTING) y, si el proceso
//      corre en Railway, coincidir con RAILWAY_ENVIRONMENT_NAME;
//   3. huella de la base (sha256 del system_identifier del cluster, 12 hex) =
//      la registrada para ese entorno = --expect-db;
//   4. actor: email de un SuperAdmin ACTIVO (exactamente uno) → su id queda en
//      el AuditLog; la autoridad lo revalida dentro de la tx;
//   5. motivo obligatorio y referencia de operación;
//   6. DRY-RUN por defecto: sin --execute sólo se lee y se informa;
//   7. con --execute además se exige --confirm exacto (p. ej. "OFF->ON").
// Nunca se ejecuta al importarse: los scripts usan `import.meta.main`.

import { createHash, randomUUID } from "node:crypto"
import type { Prisma } from "@prisma/client"
import {
  cambiarModoReservaStock,
  evaluarCambioModoReservaStock,
  evaluarRollbackReservas,
  liberarReservasPorRollback,
  mapStockLifecycleError,
  type StockModeTransitionRequest,
  type StockReservationRollbackRequest,
} from "@/lib/stock-lifecycle"

type Tx = Prisma.TransactionClient
type Mode = StockModeTransitionRequest["from"]

/**
 * Entornos habilitados → huella esperada de su base (no es un secreto: es un
 * hash truncado del identificador del cluster). Production NO está habilitado:
 * habilitarlo requiere un cambio de código y una autorización explícita.
 */
export const STOCK_RESERVATION_OPS_ENVIRONMENTS: Readonly<Record<string, string>> = Object.freeze({
  TESTING: "d64be28f676e",
})

export interface StockOpsDeps {
  /** Cliente de sólo lectura para dry-run / clasificación. */
  reader: Tx
  /** Ejecuta fn dentro de runStockSerializable (Serializable + reintento acotado). */
  runSerializable: <T>(fn: (tx: Tx) => Promise<T>) => Promise<T>
  /** Huella de la base conectada (12 hex). */
  dbFingerprint: () => Promise<string>
  /** IDs de SuperAdmin ACTIVOS con ese email. */
  findActiveSuperAdminIdsByEmail: (email: string) => Promise<string[]>
  railwayEnvironmentName: string | undefined
  newOperationRef: () => string
}

export interface StockOpsOutcome {
  exitCode: 0 | 1 | 2
  output: Record<string, unknown>
}

/** sha256(system_identifier) truncado a 12 hex. */
export function fingerprintFromSystemIdentifier(systemIdentifier: string): string {
  return createHash("sha256").update(systemIdentifier).digest("hex").slice(0, 12)
}

export interface ParsedStockOpsArgs {
  values: Record<string, string>
  flags: Set<string>
  errors: string[]
}

export function parseStockOpsArgs(argv: ReadonlyArray<string>, valueKeys: ReadonlyArray<string>, flagKeys: ReadonlyArray<string>): ParsedStockOpsArgs {
  const values: Record<string, string> = {}
  const flags = new Set<string>()
  const errors: string[] = []
  for (const arg of argv) {
    const m = /^--([a-z][a-z-]*)(?:=([\s\S]*))?$/.exec(arg)
    if (!m) {
      errors.push(`ARG_INVALID:${arg.slice(0, 40)}`)
      continue
    }
    const [, key, value] = m
    if (flagKeys.includes(key)) {
      if (value !== undefined) errors.push(`FLAG_TAKES_NO_VALUE:${key}`)
      else if (flags.has(key)) errors.push(`ARG_REPEATED:${key}`)
      else flags.add(key)
    } else if (valueKeys.includes(key)) {
      if (value === undefined || value === "") errors.push(`ARG_VALUE_REQUIRED:${key}`)
      else if (key in values) errors.push(`ARG_REPEATED:${key}`)
      else values[key] = value
    } else {
      errors.push(`ARG_UNKNOWN:${key}`)
    }
  }
  return { values, flags, errors }
}

export function evaluarGuardasEntornoStock(params: {
  envArg: string | undefined
  railwayEnvironmentName: string | undefined
  dbFingerprint: string | null
  expectDb: string | undefined
}): string[] {
  const problems: string[] = []
  const expected = params.envArg ? STOCK_RESERVATION_OPS_ENVIRONMENTS[params.envArg] : undefined
  if (!params.envArg) problems.push("ENV_REQUIRED")
  else if (!expected) problems.push("ENV_NOT_ALLOWED")
  if (params.railwayEnvironmentName !== undefined && params.railwayEnvironmentName !== params.envArg) problems.push("ENV_MISMATCH_RAILWAY")
  if (!params.expectDb) problems.push("EXPECT_DB_REQUIRED")
  if (params.dbFingerprint === null) problems.push("DB_FINGERPRINT_UNAVAILABLE")
  else {
    if (expected && params.dbFingerprint !== expected) problems.push("DB_FINGERPRINT_NOT_ENV")
    if (params.expectDb && params.dbFingerprint !== params.expectDb) problems.push("DB_FINGERPRINT_NOT_EXPECTED")
  }
  return problems
}

async function resolverEntornoYActor(
  values: Record<string, string>,
  deps: StockOpsDeps
): Promise<{ problems: string[]; fingerprint: string | null; actorId: string }> {
  let fingerprint: string | null = null
  try {
    fingerprint = await deps.dbFingerprint()
  } catch {
    fingerprint = null
  }
  const problems = evaluarGuardasEntornoStock({
    envArg: values.env,
    railwayEnvironmentName: deps.railwayEnvironmentName,
    dbFingerprint: fingerprint,
    expectDb: values["expect-db"],
  })
  let actorId = ""
  // El actor sólo se resuelve contra una base ya verificada.
  if (problems.length === 0) {
    if (!values["actor-email"]) problems.push("ACTOR_EMAIL_REQUIRED")
    else {
      const ids = await deps.findActiveSuperAdminIdsByEmail(values["actor-email"])
      if (ids.length === 1) actorId = ids[0]
      else problems.push(ids.length === 0 ? "ACTOR_NOT_ACTIVE_SUPERADMIN" : "ACTOR_EMAIL_AMBIGUOUS")
    }
  }
  return { problems, fingerprint, actorId }
}

function rejected(output: Record<string, unknown>, error: unknown): StockOpsOutcome {
  const mapped = mapStockLifecycleError(error)
  if (mapped) return { exitCode: 2, output: { ...output, result: "REJECTED", error: mapped.body } }
  return { exitCode: 1, output: { ...output, result: "ERROR", errorName: error instanceof Error ? error.name : typeof error } }
}

const MODE_VALUE_KEYS = ["env", "expect-db", "from", "to", "actor-email", "reason", "operation-ref", "confirm"]

/** Comando de transición de modo (dry-run por defecto). */
export async function runStockModeCommand(argv: ReadonlyArray<string>, deps: StockOpsDeps): Promise<StockOpsOutcome> {
  const args = parseStockOpsArgs(argv, MODE_VALUE_KEYS, ["execute"])
  const execute = args.flags.has("execute")
  const base: Record<string, unknown> = { command: "stock-reservation-mode", execute }
  if (args.errors.length) return { exitCode: 2, output: { ...base, result: "REJECTED", problems: args.errors } }

  const env = await resolverEntornoYActor(args.values, deps)
  base.env = args.values.env ?? null
  base.dbFingerprint = env.fingerprint
  if (env.problems.length) return { exitCode: 2, output: { ...base, result: "REJECTED", problems: env.problems } }

  const request: StockModeTransitionRequest = {
    from: (args.values.from ?? "") as Mode,
    to: (args.values.to ?? "") as Mode,
    superAdminId: env.actorId,
    reason: args.values.reason ?? "",
    operationRef: args.values["operation-ref"] ?? deps.newOperationRef(),
    source: "cli:stock-reservation-mode",
  }
  const preview = await evaluarCambioModoReservaStock(deps.reader, request)
  Object.assign(base, {
    actorId: env.actorId,
    operationRef: request.operationRef,
    currentMode: preview.currentMode,
    transition: `${request.from}->${request.to}`,
    allowed: preview.allowed,
    activeReservations: preview.activeReservations,
    problems: preview.problems,
  })
  if (!execute) return { exitCode: preview.problems.length ? 2 : 0, output: { ...base, result: "DRY_RUN_NO_CHANGES" } }
  if (preview.problems.length) return { exitCode: 2, output: { ...base, result: "REJECTED" } }
  if (args.values.confirm !== `${request.from}->${request.to}`) {
    return { exitCode: 2, output: { ...base, result: "REJECTED", problems: ["CONFIRM_MISMATCH"] } }
  }
  try {
    const applied = await deps.runSerializable((tx) => cambiarModoReservaStock(tx, request))
    const after = await evaluarCambioModoReservaStock(deps.reader, { ...request, from: request.to, to: request.to })
    return { exitCode: 0, output: { ...base, result: "APPLIED", applied, modeAfter: after.currentMode } }
  } catch (error) {
    return rejected(base, error)
  }
}

const ROLLBACK_VALUE_KEYS = ["env", "expect-db", "negocio", "reserva-ids", "actor-email", "reason", "operation-ref", "confirm"]

/** Comando de recuperación extraordinaria (dry-run por defecto; sólo DRAINING). */
export async function runStockRollbackCommand(argv: ReadonlyArray<string>, deps: StockOpsDeps): Promise<StockOpsOutcome> {
  const args = parseStockOpsArgs(argv, ROLLBACK_VALUE_KEYS, ["execute"])
  const execute = args.flags.has("execute")
  const base: Record<string, unknown> = { command: "stock-reservation-rollback", execute }
  if (args.errors.length) return { exitCode: 2, output: { ...base, result: "REJECTED", problems: args.errors } }

  const env = await resolverEntornoYActor(args.values, deps)
  base.env = args.values.env ?? null
  base.dbFingerprint = env.fingerprint
  if (env.problems.length) return { exitCode: 2, output: { ...base, result: "REJECTED", problems: env.problems } }

  const reservaIds = (args.values["reserva-ids"] ?? "").split(",").map((s) => s.trim()).filter(Boolean)
  const request: StockReservationRollbackRequest = {
    negocioId: args.values.negocio ?? "",
    reservaIds,
    superAdminId: env.actorId,
    reason: args.values.reason ?? "",
    operationRef: args.values["operation-ref"] ?? deps.newOperationRef(),
    source: "cli:stock-reservation-rollback",
  }
  const preview = await evaluarRollbackReservas(deps.reader, request)
  Object.assign(base, {
    actorId: env.actorId,
    operationRef: request.operationRef,
    mode: preview.mode,
    negocioId: request.negocioId,
    items: preview.items,
    problems: preview.problems,
  })
  if (!execute) return { exitCode: preview.problems.length ? 2 : 0, output: { ...base, result: "DRY_RUN_NO_CHANGES" } }
  if (preview.problems.length) return { exitCode: 2, output: { ...base, result: "REJECTED" } }
  if (args.values.confirm !== `ROLLBACK:${reservaIds.length}`) {
    return { exitCode: 2, output: { ...base, result: "REJECTED", problems: ["CONFIRM_MISMATCH"] } }
  }
  try {
    const applied = await deps.runSerializable((tx) => liberarReservasPorRollback(tx, request))
    return { exitCode: 0, output: { ...base, result: "APPLIED", applied } }
  } catch (error) {
    return rejected(base, error)
  }
}

/** Dependencias reales (Prisma) para los scripts. */
export function prismaStockOpsDeps(
  client: Tx & { $queryRaw: <T = unknown>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T> },
  runSerializable: StockOpsDeps["runSerializable"]
): StockOpsDeps {
  return {
    reader: client,
    runSerializable,
    dbFingerprint: async () => {
      const rows = await client.$queryRaw<Array<{ id: string }>>`SELECT system_identifier::text AS id FROM pg_control_system()`
      if (!rows[0]?.id) throw new Error("NO_SYSTEM_IDENTIFIER")
      return fingerprintFromSystemIdentifier(rows[0].id)
    },
    findActiveSuperAdminIdsByEmail: async (email) =>
      (await client.superAdmin.findMany({ where: { email, activo: true }, select: { id: true } })).map((a) => a.id),
    railwayEnvironmentName: process.env.RAILWAY_ENVIRONMENT_NAME,
    newOperationRef: () => randomUUID(),
  }
}
