// ============================================
// P2-T56-R3A-I5-P0 — comandos internos (orquestación y protecciones)
// ============================================
// Dependencias inyectadas: el fake en memoria como base, huella y SuperAdmins
// simulados. Nunca toca una base real ni el modo global.
import { describe, expect, test } from "bun:test"
import { Prisma } from "@prisma/client"
import { runStockSerializable } from "./stock-lifecycle"
import { createFakeDb, type FakeDb, type FakeState } from "./stock-lifecycle-test-fake"
import {
  evaluarGuardasEntornoStock,
  fingerprintFromSystemIdentifier,
  parseStockOpsArgs,
  runStockModeCommand,
  runStockRollbackCommand,
  STOCK_RESERVATION_OPS_ENVIRONMENTS,
  type StockOpsDeps,
} from "./stock-reservation-ops"

type Tx = Prisma.TransactionClient
const FP = "d64be28f676e"

function seed(mode: string, extra: Partial<FakeState> = {}): FakeDb {
  return createFakeDb({
    config: { clave: "platform", stockReservaModo: mode, id: "cfg-1", updatedAt: new Date(1_000) },
    superadmins: [{ id: "sa-1", activo: true }],
    ...extra,
  })
}

function deps(fake: FakeDb, overrides: Partial<StockOpsDeps> = {}): StockOpsDeps {
  return {
    reader: fake.client as unknown as Tx,
    runSerializable: (fn) => runStockSerializable(fake.client as never, fn),
    dbFingerprint: async () => FP,
    findActiveSuperAdminIdsByEmail: async (email) => (email === "ops@example.test" ? ["sa-1"] : email === "dup@example.test" ? ["a", "b"] : []),
    railwayEnvironmentName: undefined,
    newOperationRef: () => "op-fixed",
    ...overrides,
  }
}

const modeArgs = (extra: string[] = []) => [
  "--env=TESTING",
  `--expect-db=${FP}`,
  "--from=OFF",
  "--to=ON",
  "--actor-email=ops@example.test",
  "--reason=Activación controlada de I5 en TESTING",
  ...extra,
]

const untouched = (fake: FakeDb, mode = "OFF") => {
  expect(fake.state.config?.stockReservaModo).toBe(mode)
  expect(fake.state.audits).toHaveLength(0)
  expect(fake.transactionCount).toBe(0)
}

describe("I5-P0 ops — parseo estricto de argumentos", () => {
  test("desconocidos, repetidos, sin valor o flag con valor → errores", () => {
    const parsed = parseStockOpsArgs(["--env=A", "--env=B", "--nope=1", "--from", "--execute=yes", "suelto"], ["env", "from"], ["execute"])
    expect(parsed.errors).toEqual(["ARG_REPEATED:env", "ARG_UNKNOWN:nope", "ARG_VALUE_REQUIRED:from", "FLAG_TAKES_NO_VALUE:execute", "ARG_INVALID:suelto"])
  })

  test("valores con espacios y signos se conservan", () => {
    expect(parseStockOpsArgs(["--reason=Motivo con espacios = sí"], ["reason"], []).values.reason).toBe("Motivo con espacios = sí")
  })
})

describe("I5-P0 ops — guardas de entorno e identidad de la base", () => {
  test("sólo TESTING está habilitado (Production no)", () => {
    expect(Object.keys(STOCK_RESERVATION_OPS_ENVIRONMENTS)).toEqual(["TESTING"])
    expect(evaluarGuardasEntornoStock({ envArg: "production", railwayEnvironmentName: undefined, dbFingerprint: FP, expectDb: FP })).toContain("ENV_NOT_ALLOWED")
  })

  test("matriz de guardas", () => {
    const ok = { envArg: "TESTING", railwayEnvironmentName: undefined, dbFingerprint: FP, expectDb: FP }
    expect(evaluarGuardasEntornoStock(ok)).toEqual([])
    expect(evaluarGuardasEntornoStock({ ...ok, railwayEnvironmentName: "TESTING" })).toEqual([])
    expect(evaluarGuardasEntornoStock({ ...ok, envArg: undefined })).toContain("ENV_REQUIRED")
    expect(evaluarGuardasEntornoStock({ ...ok, railwayEnvironmentName: "production" })).toContain("ENV_MISMATCH_RAILWAY")
    expect(evaluarGuardasEntornoStock({ ...ok, expectDb: undefined })).toContain("EXPECT_DB_REQUIRED")
    expect(evaluarGuardasEntornoStock({ ...ok, dbFingerprint: null })).toContain("DB_FINGERPRINT_UNAVAILABLE")
    expect(evaluarGuardasEntornoStock({ ...ok, dbFingerprint: "000000000000", expectDb: "000000000000" })).toEqual(["DB_FINGERPRINT_NOT_ENV"])
    expect(evaluarGuardasEntornoStock({ ...ok, expectDb: "111111111111" })).toEqual(["DB_FINGERPRINT_NOT_EXPECTED"])
  })

  test("huella = sha256(system_identifier) truncada a 12 hex", () => {
    expect(fingerprintFromSystemIdentifier("7000000000000000000")).toMatch(/^[0-9a-f]{12}$/)
    expect(fingerprintFromSystemIdentifier("1")).not.toBe(fingerprintFromSystemIdentifier("2"))
  })
})

describe("I5-P0 ops — comando de modo", () => {
  test("DRY-RUN por defecto: informa y no escribe nada", async () => {
    const fake = seed("OFF")
    const out = await runStockModeCommand(modeArgs(), deps(fake))
    expect(out.exitCode).toBe(0)
    expect(out.output).toMatchObject({
      command: "stock-reservation-mode",
      execute: false,
      result: "DRY_RUN_NO_CHANGES",
      env: "TESTING",
      dbFingerprint: FP,
      actorId: "sa-1",
      operationRef: "op-fixed",
      currentMode: "OFF",
      transition: "OFF->ON",
      allowed: true,
      activeReservations: 0,
      problems: [],
    })
    untouched(fake)
  })

  test("entorno equivocado / Railway distinto / huella distinta / huella no disponible → rechazo sin leer el modo", async () => {
    const fake = seed("OFF")
    const cases: Array<[string[], Partial<StockOpsDeps>, string]> = [
      [modeArgs().map((a) => (a === "--env=TESTING" ? "--env=production" : a)), {}, "ENV_NOT_ALLOWED"],
      [modeArgs(), { railwayEnvironmentName: "production" }, "ENV_MISMATCH_RAILWAY"],
      [modeArgs(), { dbFingerprint: async () => "aaaaaaaaaaaa" }, "DB_FINGERPRINT_NOT_ENV"],
      [modeArgs().map((a) => (a.startsWith("--expect-db") ? "--expect-db=bbbbbbbbbbbb" : a)), {}, "DB_FINGERPRINT_NOT_EXPECTED"],
      [modeArgs(), { dbFingerprint: async () => { throw new Error("denied") } }, "DB_FINGERPRINT_UNAVAILABLE"],
    ]
    for (const [argv, override, problem] of cases) {
      const out = await runStockModeCommand([...argv, "--execute", "--confirm=OFF->ON"], deps(fake, override))
      expect(out.exitCode).toBe(2)
      expect(out.output.result).toBe("REJECTED")
      expect(out.output.problems).toContain(problem)
      expect(out.output).not.toHaveProperty("currentMode")
    }
    untouched(fake)
  })

  test("actor: email inexistente, ambiguo o ausente → rechazo; motivo corto → problema", async () => {
    const fake = seed("OFF")
    for (const [email, problem] of [["nadie@example.test", "ACTOR_NOT_ACTIVE_SUPERADMIN"], ["dup@example.test", "ACTOR_EMAIL_AMBIGUOUS"]]) {
      const out = await runStockModeCommand(modeArgs().map((a) => (a.startsWith("--actor-email") ? `--actor-email=${email}` : a)), deps(fake))
      expect(out.output.problems).toContain(problem)
    }
    const noActor = await runStockModeCommand(modeArgs().filter((a) => !a.startsWith("--actor-email")), deps(fake))
    expect(noActor.output.problems).toContain("ACTOR_EMAIL_REQUIRED")
    const shortReason = await runStockModeCommand(modeArgs().map((a) => (a.startsWith("--reason") ? "--reason=corto" : a)), deps(fake))
    expect(shortReason.exitCode).toBe(2)
    expect(shortReason.output.problems).toContain("REASON_TOO_SHORT")
    untouched(fake)
  })

  test("transición inválida: dry-run la informa; --execute la rechaza sin escribir", async () => {
    const fake = seed("ON")
    const argv = modeArgs().map((a) => (a === "--from=OFF" ? "--from=ON" : a === "--to=ON" ? "--to=OFF" : a))
    const dry = await runStockModeCommand(argv, deps(fake))
    expect(dry.exitCode).toBe(2)
    expect(dry.output.problems).toContain("TRANSITION_FORBIDDEN")
    const exec = await runStockModeCommand([...argv, "--execute", "--confirm=ON->OFF"], deps(fake))
    expect(exec.output.result).toBe("REJECTED")
    untouched(fake, "ON")
  })

  test("--execute sin --confirm o con confirmación distinta → no cambia nada", async () => {
    const fake = seed("OFF")
    for (const extra of [["--execute"], ["--execute", "--confirm=OFF->DRAINING"], ["--execute", "--confirm=off->on"]]) {
      const out = await runStockModeCommand(modeArgs(extra), deps(fake))
      expect(out.exitCode).toBe(2)
      expect(out.output.problems).toEqual(["CONFIRM_MISMATCH"])
    }
    untouched(fake)
  })

  test("--execute + confirmación exacta → aplica por la autoridad (AuditLog con referencia y origen del comando)", async () => {
    const fake = seed("OFF")
    const out = await runStockModeCommand(modeArgs(["--execute", "--confirm=OFF->ON", "--operation-ref=op-manual"]), deps(fake))
    expect(out.exitCode).toBe(0)
    expect(out.output).toMatchObject({ result: "APPLIED", modeAfter: "ON", operationRef: "op-manual" })
    expect(fake.state.config?.stockReservaModo).toBe("ON")
    expect(fake.state.audits).toHaveLength(1)
    expect(JSON.parse(fake.state.audits[0].detalle)).toMatchObject({ operationRef: "op-manual", source: "cli:stock-reservation-mode", from: "OFF", to: "ON" })
    expect(fake.isolationLevels).toEqual(["Serializable"])
  })

  test("la salida nunca incluye URL ni credenciales de la base", async () => {
    const fake = seed("OFF")
    const out = await runStockModeCommand(modeArgs(), deps(fake))
    expect(JSON.stringify(out.output)).not.toMatch(/postgres|password|DATABASE_URL/i)
  })
})

describe("I5-P0 ops — comando de recuperación", () => {
  const base = (mode: string) =>
    seed(mode, {
      pedidos: [{ id: "ped-cancel", negocioId: "neg-1", estado: "cancelado", tarifaServicio: 0, deudaAcumulada: false, items: [] }],
      reservas: [
        {
          id: "r-1",
          negocioId: "neg-1",
          pedidoId: "ped-cancel",
          pedidoItemId: "it-1",
          productoId: "p",
          productoVarianteId: null,
          cantidad: 1,
          estado: "ACTIVA",
          motivoLiberacion: null,
          consumidaEn: null,
          liberadaEn: null,
        },
      ],
    })
  const rbArgs = (extra: string[] = []) => [
    "--env=TESTING",
    `--expect-db=${FP}`,
    "--negocio=neg-1",
    "--reserva-ids=r-1",
    "--actor-email=ops@example.test",
    "--reason=Reserva atascada de pedido cancelado",
    ...extra,
  ]

  test("dry-run en OFF: informa MODE_NOT_DRAINING, no escribe", async () => {
    const fake = base("OFF")
    const out = await runStockRollbackCommand(rbArgs(), deps(fake))
    expect(out.exitCode).toBe(2)
    expect(out.output).toMatchObject({ result: "DRY_RUN_NO_CHANGES", mode: "OFF" })
    expect(out.output.problems).toContain("MODE_NOT_DRAINING")
    expect(fake.state.reservas[0].estado).toBe("ACTIVA")
    expect(fake.transactionCount).toBe(0)
  })

  test("DRAINING: --execute exige --confirm=ROLLBACK:<n>; con la confirmación exacta libera por la autoridad", async () => {
    const fake = base("DRAINING")
    const bad = await runStockRollbackCommand(rbArgs(["--execute", "--confirm=ROLLBACK:2"]), deps(fake))
    expect(bad.output.problems).toEqual(["CONFIRM_MISMATCH"])
    expect(fake.state.reservas[0].estado).toBe("ACTIVA")
    const ok = await runStockRollbackCommand(rbArgs(["--execute", "--confirm=ROLLBACK:1"]), deps(fake))
    expect(ok.exitCode).toBe(0)
    expect(ok.output).toMatchObject({ result: "APPLIED", applied: { released: ["r-1"], alreadyReleased: [] } })
    expect(fake.state.reservas[0]).toMatchObject({ estado: "LIBERADA", motivoLiberacion: "ROLLBACK" })
    expect(JSON.parse(fake.state.audits[0].detalle)).toMatchObject({ source: "cli:stock-reservation-rollback", operationRef: "op-fixed" })
  })

  test("entorno o huella inválidos → rechazo antes de clasificar", async () => {
    const fake = base("DRAINING")
    const out = await runStockRollbackCommand(rbArgs(["--execute", "--confirm=ROLLBACK:1"]), deps(fake, { dbFingerprint: async () => "cccccccccccc" }))
    expect(out.output.problems).toContain("DB_FINGERPRINT_NOT_ENV")
    expect(out.output).not.toHaveProperty("items")
    expect(fake.state.reservas[0].estado).toBe("ACTIVA")
  })
})
