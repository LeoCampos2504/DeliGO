/// <reference types="bun-types" />

// ============================================
// P2T01-09 — MODEL-LOCK-A: real-Postgres concurrency proof
// ============================================
// Proves the TOCTOU-closing property Stage 1B claims (and Stage 1 did NOT
// actually demonstrate): a location write can never persist coordinates
// gathered after a Negocio's tracking-disable has already committed, and a
// disable can never observe a "clean" state while a concurrent location
// write is mid-flight — regardless of which one reaches Postgres first.
//
// This is deliberately NOT timing-based ("wait a bit and hope the other
// query blocked"). Each interleaving pins the blocked query's real
// PostgreSQL backend pid (via `SELECT pg_backend_pid()` as the FIRST
// statement in the SAME `$transaction` callback as the query under test —
// Prisma's interactive transactions hold one physical connection for the
// whole callback) and POLLS `pg_stat_activity.wait_event_type` on a third,
// independent connection until it observes that exact pid genuinely
// waiting on a lock — a real, observable DB state, not a guessed delay.
//
// The two production statements below are copied verbatim from
// src/app/api/repartidor/ubicacion/route.ts (MODEL-LOCK-A) and from the
// ordinary Prisma `db.negocio.update({ data: { seguimientoDeliveryActivo }
// })` in src/app/api/negocio/config/route.ts (reproduced as raw SQL only so
// this test can pin its backend pid the same way — an ordinary Prisma
// UPDATE takes the exact same implicit FOR NO KEY UPDATE row lock either
// way; no test-only hook exists or is added anywhere in production code).
//
// Three independent PrismaClient instances are used: clientA and clientB
// are the two contending connections (each interleaving genuinely uses two
// separate physical connections); clientC only observes pg_stat_activity
// and sets up/verifies fixtures — it never participates in the lock
// contention itself. clientC is its own dedicated instance rather than the
// shared `@/lib/db` singleton specifically so this file's correctness never
// depends on module-resolution/file-execution order relative to any sibling
// test file that mocks "@/lib/db" (see the comment at its declaration).
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { PrismaClient, Prisma } from "@prisma/client"

setDefaultTimeout(30_000)

const prefix = "test-p2t01-conc-"
const clientA = new PrismaClient()
const clientB = new PrismaClient()
// Deliberately its OWN PrismaClient instance for fixtures/observation/
// cleanup — NOT the shared `@/lib/db` singleton. Bun's `mock.module` patches
// the module registry process-wide (see route.test.ts's own comment on this
// exact hazard); when this file runs in the same `bun test` invocation as
// any focal file that mocks "@/lib/db" (e.g. repartidor/pedidos/route.test.ts,
// loaded first if it sorts alphabetically earlier), importing the shared `db`
// singleton here would silently resolve to that mock instead of a real
// Prisma client. A dedicated instance makes this file's correctness
// independent of sibling test files' mocks or of file execution order.
const clientC = new PrismaClient()

type Queryable = PrismaClient | Prisma.TransactionClient

async function ensureNegocio(suffix: string) {
  return clientC.negocio.create({
    data: {
      nombre: `${prefix}${suffix}`,
      slug: `${prefix}${suffix}`,
      usuario: `${prefix}${suffix}`,
      email: `${prefix}${suffix}@example.test`,
      password: "fixture",
      aprobado: true,
      suspendido: false,
      seguimientoDeliveryActivo: true,
    },
  })
}

async function ensurePedidoEnCamino(negocioId: string, suffix: string) {
  return clientC.pedido.create({
    data: {
      negocioId,
      negocioSlug: `${prefix}${suffix}`,
      negocioNombre: `${prefix}${suffix}`,
      clienteNombre: `${prefix}cliente`,
      total: 100,
      totalProductos: 100,
      metodoEntrega: "domicilio",
      metodoPago: "efectivo",
      estado: "en_camino",
      repartidorId: `${prefix}repartidor-${suffix}`,
      seguimientoDeliveryHabilitado: true,
    },
  })
}

async function cleanup() {
  const negocios = await clientC.negocio.findMany({ where: { slug: { startsWith: prefix } }, select: { id: true } })
  const negocioIds = negocios.map((n) => n.id)
  if (negocioIds.length) {
    await clientC.pedido.deleteMany({ where: { negocioId: { in: negocioIds } } })
    await clientC.negocio.deleteMany({ where: { id: { in: negocioIds } } })
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Polls a REAL, observable Postgres state (pg_stat_activity.wait_event_type
// for the given backend pid) rather than sleeping a guessed duration —
// resolves true as soon as that connection is genuinely waiting on a lock,
// false if it never does within timeoutMs (a real, meaningful test
// failure, not a flaky pass).
async function waitUntilBlockedOnLock(pid: number, timeoutMs = 5000): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const rows = await clientC.$queryRaw<{ wait_event_type: string | null }[]>`
      SELECT wait_event_type FROM pg_stat_activity WHERE pid = ${pid}
    `
    if (rows[0]?.wait_event_type === "Lock") return true
    await sleep(25)
  }
  return false
}

function deferred<T = void>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

async function pinBackendPid(tx: Queryable): Promise<number> {
  const rows = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() as pid`
  return rows[0].pid
}

// Verbatim copy of the production statement in
// src/app/api/repartidor/ubicacion/route.ts (MODEL-LOCK-A).
function locationWriteSql(
  tx: Queryable,
  params: { negocioId: string; pedidoId: string; repartidorId: string; lat: number; lng: number; now: Date }
) {
  return tx.$queryRaw<{ repartidorLat: number; repartidorLng: number; locationRevision: number }[]>`
    WITH eligible_business AS (
      SELECT "id"
      FROM "negocios"
      WHERE "id" = ${params.negocioId}
        AND "seguimientoDeliveryActivo" = true
      FOR SHARE
    )
    UPDATE "pedidos"
    SET "repartidorLat" = ${params.lat},
        "repartidorLng" = ${params.lng},
        "repartidorLastUpdate" = ${params.now},
        "locationRevision" = "locationRevision" + 1
    FROM eligible_business
    WHERE "pedidos"."id" = ${params.pedidoId}
      AND "pedidos"."negocioId" = eligible_business."id"
      AND "pedidos"."repartidorId" = ${params.repartidorId}
      AND "pedidos"."estado" = 'en_camino'
      AND "pedidos"."metodoEntrega" = 'domicilio'
      AND "pedidos"."seguimientoDeliveryHabilitado" = true
    RETURNING "pedidos"."repartidorLat", "pedidos"."repartidorLng", "pedidos"."repartidorLastUpdate", "pedidos"."locationRevision"
  `
}

// Verbatim (as raw SQL) of the ordinary Prisma
// `db.negocio.update({ where: { id }, data: { seguimientoDeliveryActivo:
// false } })` in src/app/api/negocio/config/route.ts.
function disableSql(tx: Queryable, negocioId: string) {
  return tx.$executeRaw`UPDATE "negocios" SET "seguimientoDeliveryActivo" = false WHERE "id" = ${negocioId}`
}

beforeAll(async () => {
  await cleanup()
}, { timeout: 30_000 })

afterAll(async () => {
  await cleanup()
  await clientA.$disconnect()
  await clientB.$disconnect()
  await clientC.$disconnect()
})

describe("P2T01-09 — MODEL-LOCK-A real Postgres concurrency", () => {
  test("CASE-A (INTERLEAVING_LOCATION_FIRST_TEST): location write acquires the negocios FOR SHARE lock first; a concurrent disable genuinely blocks on it (pid-confirmed), then only observes/commits false AFTER the location write has already committed", async () => {
    const negocio = await ensureNegocio("case-a")
    const pedido = await ensurePedidoEnCamino(negocio.id, "case-a")
    const repartidorId = pedido.repartidorId!

    const canCommitA = deferred<void>()
    let aResolved = false

    const txAPromise = clientA
      .$transaction(
        async (tx) => {
          await pinBackendPid(tx) // proves this is one held connection; pid itself unused here
          const rows = await locationWriteSql(tx, {
            negocioId: negocio.id,
            pedidoId: pedido.id,
            repartidorId,
            lat: -10,
            lng: -20,
            now: new Date(),
          })
          await canCommitA.promise
          return rows
        },
        { timeout: 20_000, maxWait: 20_000 }
      )
      .then((rows) => {
        aResolved = true
        return rows
      })

    // B (the disable) starts once A's FOR SHARE lock is already held — A's
    // transaction callback only reaches `canCommitA.promise` AFTER the
    // location write statement has fully executed and taken its lock, so
    // waiting for that same tick boundary via a resolved microtask chain is
    // sufficient here; the actual proof of contention is the pid-pinned
    // poll below, not this ordering alone.
    await sleep(150)

    let bPid: number | null = null
    let bResolved = false
    const txBPromise = clientB
      .$transaction(
        async (tx) => {
          bPid = await pinBackendPid(tx)
          await disableSql(tx, negocio.id)
        },
        { timeout: 20_000, maxWait: 20_000 }
      )
      .then(() => {
        bResolved = true
      })

    while (bPid === null) {
      await sleep(10)
    }

    const blocked = await waitUntilBlockedOnLock(bPid, 5000)
    expect(blocked).toBe(true)
    expect(bResolved).toBe(false)
    expect(aResolved).toBe(false)

    canCommitA.resolve()
    const rowsA = await txAPromise
    await txBPromise
    expect(bResolved).toBe(true)

    expect(rowsA.length).toBe(1)
    expect(rowsA[0].locationRevision).toBe(1)
    expect(rowsA[0].repartidorLat).toBe(-10)

    const pedidoAfter = await clientC.pedido.findUniqueOrThrow({ where: { id: pedido.id } })
    expect(pedidoAfter.repartidorLat).toBe(-10)
    expect(pedidoAfter.repartidorLng).toBe(-20)
    expect(pedidoAfter.locationRevision).toBe(1)

    const negocioAfter = await clientC.negocio.findUniqueOrThrow({ where: { id: negocio.id } })
    expect(negocioAfter.seguimientoDeliveryActivo).toBe(false)

    // POST_DISABLE_WRITE_PROVEN_IMPOSSIBLE_TEST: a subsequent, ordinary
    // (non-concurrent) location write attempt — using the exact same
    // production statement — now affects 0 rows, because the CTE's FOR
    // SHARE re-check reads the now-committed, now-false live flag.
    const rowsAfterDisable = await locationWriteSql(clientC, {
      negocioId: negocio.id,
      pedidoId: pedido.id,
      repartidorId,
      lat: -99,
      lng: -99,
      now: new Date(),
    })
    expect(rowsAfterDisable.length).toBe(0)

    // The rejected write must not have mutated anything — coords/revision
    // stay exactly as A left them.
    const pedidoFinal = await clientC.pedido.findUniqueOrThrow({ where: { id: pedido.id } })
    expect(pedidoFinal.repartidorLat).toBe(-10)
    expect(pedidoFinal.locationRevision).toBe(1)
  })

  test("CASE-B (INTERLEAVING_DISABLE_FIRST_TEST): disable acquires the negocios row lock first; a concurrent location write genuinely blocks on it (pid-confirmed via pg_stat_activity), then observes 0 rows once it resumes and the disable has already committed", async () => {
    const negocio = await ensureNegocio("case-b")
    const pedido = await ensurePedidoEnCamino(negocio.id, "case-b")
    const repartidorId = pedido.repartidorId!

    const canCommitB = deferred<void>()
    let bResolved = false

    const txBPromise = clientB
      .$transaction(
        async (tx) => {
          await pinBackendPid(tx)
          await disableSql(tx, negocio.id)
          await canCommitB.promise
        },
        { timeout: 20_000, maxWait: 20_000 }
      )
      .then(() => {
        bResolved = true
      })

    // Startup grace period only — NOT the evidence of blocking. The actual
    // proof is the pg_stat_activity poll on A's real pid below.
    await sleep(150)

    let aPid: number | null = null
    let aResolved = false
    const txAPromise = clientA
      .$transaction(
        async (tx) => {
          aPid = await pinBackendPid(tx)
          return locationWriteSql(tx, {
            negocioId: negocio.id,
            pedidoId: pedido.id,
            repartidorId,
            lat: -5,
            lng: -6,
            now: new Date(),
          })
        },
        { timeout: 20_000, maxWait: 20_000 }
      )
      .then((rows) => {
        aResolved = true
        return rows
      })

    while (aPid === null) {
      await sleep(10)
    }

    const blocked = await waitUntilBlockedOnLock(aPid, 5000)
    expect(blocked).toBe(true)
    expect(aResolved).toBe(false)
    expect(bResolved).toBe(false)

    canCommitB.resolve()
    await txBPromise
    const rowsA = await txAPromise
    expect(aResolved).toBe(true)

    // A's FOR SHARE re-check now reads the committed, false live flag — its
    // CTE matches 0 rows, so the UPDATE affects 0 rows.
    expect(rowsA.length).toBe(0)

    const pedidoAfter = await clientC.pedido.findUniqueOrThrow({ where: { id: pedido.id } })
    expect(pedidoAfter.repartidorLat).toBeNull()
    expect(pedidoAfter.repartidorLng).toBeNull()
    expect(pedidoAfter.locationRevision).toBe(0)

    const negocioAfter = await clientC.negocio.findUniqueOrThrow({ where: { id: negocio.id } })
    expect(negocioAfter.seguimientoDeliveryActivo).toBe(false)
  })
})
