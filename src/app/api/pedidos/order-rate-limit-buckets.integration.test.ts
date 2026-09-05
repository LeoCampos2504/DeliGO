/// <reference types="bun-types" />

// ============================================
// P2-T25-R2 — independent account/IP/business order rate-limit buckets
// ============================================
// Protects the fix for the two bypasses P2-T25-R1 confirmed empirically
// (codex-reports/P2_T25_ORDER_ABUSE_RESISTANCE_AUDIT_R1.md): the old single
// "order" bucket was keyed by session-token-or-IP, so (a) a same account with
// a NEW session got a completely fresh bucket for free, and (b) a different
// account from the same IP was never throttled together. This file exercises
// the REAL route handler (POST_FOR_TESTS) against PostgreSQL TESTING — no
// mocks — the same pattern as the rest of this directory's integration
// suites, so a future refactor of the handler or of checkRateLimit() cannot
// silently reopen either bypass without failing here.
//
// Bucket quotas are pre-seeded directly via checkRateLimit() (same shared
// in-memory store the route reads) instead of firing dozens of real HTTP
// requests through the handler — real writes are reserved for the exact
// boundary being asserted (see P2-T25-R2 §29: "preferir pre-seeding/helper
// tests si permite certificar el mismo contrato con menos escrituras").
//
// P2-T25-R2A (human review of R2): tests 8-11 protect a follow-up fix —
// human review found that an EXACT idempotent replay (same negocioId +
// Idempotency-Key) still consumed all three buckets in the original R2
// implementation, including orderBusiness. Since a replay never creates a
// new Pedido (it returns the existing one, 200, or 409 on conflict), an
// attacker could place ONE real order and replay it dozens of times to drain
// the shared business bucket and lock out unrelated customers — confirmed
// empirically before the fix (codex-reports/
// P2_T25_R2A_IDEMPOTENCY_SHARED_BUCKET_SEMANTICS_FIX.md): 3 pure replays of
// one real order measurably consumed 3 orderBusiness units, and a
// subsequently-drained bucket correctly returned 429 to a genuinely fresh
// victim order. The fix: a cheap, non-transactional pre-check for an
// existing (negocioId, idempotencyKey) match skips orderBusiness (both peek
// and commit) for that request, while orderAccount/orderIp still apply
// unconditionally — replays remain capped as raw request volume, they just
// stop being billable against the shared business bucket.
//
// P2-T25-R2C (human review of R2B): test 14 protects a third follow-up
// fix — R2B's own report flagged, but did not fix (out of scope for that
// task), a preexisting ownership bug in the order-creation concurrency lock
// (`orderLockKey`, keyed by session-or-IP): `releaseLock()` is a plain
// `Map.delete(key)` with no ownership check (see src/lib/concurrency.ts), so
// when `acquireLock(orderLockKey)` FAILED for a request (lock already held
// by another concurrent request from the same actor) and that request
// returned 409, its own `finally` block still called
// `releaseLock(orderLockKey)` unconditionally — freeing the OTHER request's
// still-active lock. Confirmed empirically before this fix (codex-reports/
// P2_T25_R2C_ORDER_LOCK_OWNERSHIP_RELEASE_RACE.md) that this let a THIRD
// concurrent request enter the critical section and create a real second
// Pedido row while the first request was still in flight — defeating the
// exact double-submit protection this lock exists for. The fix: an
// `orderLockAcquired` flag, set to `true` only after a successful
// `acquireLock`, gates the `finally` release — same pattern already used for
// the R2B idempotency lock in the same file.
//
// P2-T25-R2B (human review of R2A): tests 12-13 protect a second follow-up
// fix — R2A's own report flagged, but did not verify past N=2, a residual
// race: the non-transactional precheck it added has no serialization
// between DIFFERENT actors (different accounts/IPs, each running under its
// own `orderLockKey`), so N genuinely concurrent actors sharing the same NEW
// Idempotency-Key can all see "no existing pedido" before any of them
// commits, each consuming a real orderBusiness unit — confirmed empirically
// before this fix (codex-reports/
// P2_T25_R2B_CONCURRENT_IDEMPOTENCY_BUSINESS_BUCKET_RACE.md) to scale with N
// (3 concurrent actors consumed 3 units, 5 concurrent actors consumed 5),
// not bounded at "1 extra" as R2A's report had assumed without testing
// beyond 2. The DB's unique constraint always still creates exactly 1
// Pedido regardless. The fix: an additional in-memory lock scoped to
// (negocioId, idempotencyKey) — reusing the same acquireLock/releaseLock
// primitive already used for the per-actor order lock — acquired right
// before the precheck; only the first concurrent actor for a given key can
// evaluate the precheck and the business bucket, any other concurrent actor
// for the same key gets an immediate 409 without touching orderBusiness or
// the DB.

import { randomUUID } from "crypto"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createSession, SESSION_COOKIE_NAME } from "@/lib/auth"
import { checkRateLimit } from "@/lib/rate-limit"
import { POST_FOR_TESTS as crearPedido } from "@/app/api/pedidos/route"

setDefaultTimeout(60_000)

const prefix = "test-t25-r2-"

async function ensureNegocio(suffix: string, extra: Partial<Parameters<typeof db.negocio.create>[0]["data"]> = {}) {
  return db.negocio.create({
    data: {
      nombre: `${prefix}${suffix}`,
      slug: `${prefix}${suffix}`,
      usuario: `${prefix}${suffix}`,
      email: `${prefix}${suffix}@example.test`,
      password: "fixture",
      aprobado: true,
      suspendido: false,
      horarioMode: "simple",
      abiertoManual: true,
      ofreceRetiro: true,
      ...extra,
    },
  })
}

async function ensureProducto(negocioId: string) {
  const producto = await db.producto.create({ data: { nombre: `${prefix}producto`, precio: 100, negocioId } })
  return producto.id
}

async function ensureCliente(suffix: string) {
  return db.cliente.create({ data: { nombre: `${prefix}${suffix}`, email: `${prefix}${suffix}@example.test`, telefono: "" } })
}

// P2-T25-R2B: a distinct actor (own account, own session, own IP) for the
// concurrent-race tests — each must be independent so neither orderAccount
// nor orderIp can be the confound, isolating the orderBusiness question.
async function ensureActor(suffix: string) {
  const cliente = await ensureCliente(suffix)
  const session = await createSession(cliente.id, "cliente")
  const ip = `203.0.113.${randomUUID().slice(0, 2)}${randomUUID().slice(0, 1)}`
  return { cliente, session, ip }
}

// P2-T25-R2B: a timer-based barrier — every concurrent request pauses here
// (via the beforeIdempotencyPrecheck test hook) until the same timeout
// fires, maximizing the odds that all of them reach the non-transactional
// precheck before any of them has committed a Pedido. This lives entirely
// in test code: the hook is a no-op in production (see
// PedidoRouteTestHooks in route.ts) and no sleep of any kind exists outside
// this file.
function makeBarrier(delayMs: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, delayMs))
}

function pedidoBody(negocioId: string, productoId: string) {
  return {
    negocioId,
    items: [{ productoId, cantidad: 1, agregados: [], secciones: {}, ingredientesQuitados: [], talle: "", color: "" }],
    metodoEntrega: "retiro",
    metodoPago: "efectivo",
    notas: null,
    direccion: null,
    referencia: null,
    lat: null,
    lng: null,
    mesaId: null,
    mesaNumero: null,
    empleadoCodigo: null,
    fingerprint: null,
    mesaGeolocation: null,
  }
}

function mesaBody(negocioId: string, productoId: string, mesaNumero: number) {
  return {
    negocioId,
    items: [{ productoId, cantidad: 1, agregados: [], secciones: {}, ingredientesQuitados: [], talle: "", color: "" }],
    metodoEntrega: "mesa",
    metodoPago: "efectivo",
    notas: null,
    direccion: null,
    referencia: null,
    lat: null,
    lng: null,
    mesaId: null,
    mesaNumero,
    empleadoCodigo: null,
    fingerprint: null,
    mesaGeolocation: null,
  }
}

function req(body: unknown, opts: { cookie?: string; ip: string; idempotencyKey?: string }): NextRequest {
  const headers: Record<string, string> = { "content-type": "application/json", "x-forwarded-for": opts.ip }
  if (opts.cookie) headers["cookie"] = `${SESSION_COOKIE_NAME}=${opts.cookie}`
  if (opts.idempotencyKey) headers["idempotency-key"] = opts.idempotencyKey
  return new NextRequest("http://localhost/api/pedidos", { method: "POST", body: JSON.stringify(body), headers })
}

async function cleanup() {
  const negocios = await db.negocio.findMany({ where: { slug: { startsWith: prefix } }, select: { id: true } })
  const negocioIds = negocios.map((n) => n.id)
  const clientes = await db.cliente.findMany({ where: { email: { startsWith: prefix } }, select: { id: true } })
  const clienteIds = clientes.map((c) => c.id)

  if (negocioIds.length) {
    await db.pedidoEvento.deleteMany({ where: { pedido: { negocioId: { in: negocioIds } } } }).catch(() => {})
    await db.pedido.deleteMany({ where: { negocioId: { in: negocioIds } } })
    await db.producto.deleteMany({ where: { negocioId: { in: negocioIds } } })
    await db.mesa.deleteMany({ where: { negocioId: { in: negocioIds } } })
    await db.negocio.deleteMany({ where: { id: { in: negocioIds } } })
  }
  if (clienteIds.length) {
    await db.sesion.deleteMany({ where: { userId: { in: clienteIds } } })
    await db.cliente.deleteMany({ where: { id: { in: clienteIds } } })
  }
}

beforeAll(async () => {
  await cleanup()
}, { timeout: 30_000 })

afterAll(async () => {
  await cleanup()
  const remaining = await db.negocio.count({ where: { slug: { startsWith: prefix } } })
  expect(remaining).toBe(0)
})

describe("P2-T25-R2 — account/IP/business independent order rate-limit buckets", () => {
  test("1. orderAccount: same account with a NEW session stays blocked (R1 bypass closed)", async () => {
    const negocio = await ensureNegocio("acc")
    const productoId = await ensureProducto(negocio.id)
    const cliente = await ensureCliente("acc-cliente")
    const sessionA = await createSession(cliente.id, "cliente")
    const ip = `198.51.100.${randomUUID().slice(0, 2)}`

    for (let i = 0; i < 4; i++) checkRateLimit("orderAccount", cliente.id)

    const res5 = await crearPedido(req(pedidoBody(negocio.id, productoId), { cookie: sessionA, ip }), {})
    expect(res5.status).toBe(201) // 5th — fills the account bucket exactly

    const res6 = await crearPedido(req(pedidoBody(negocio.id, productoId), { cookie: sessionA, ip }), {})
    expect(res6.status).toBe(429)
    expect(res6.headers.get("Retry-After")).not.toBeNull()

    // New session, SAME account — R1's confirmed bypass. Must now stay 429.
    const sessionB = await createSession(cliente.id, "cliente")
    const resNewSession = await crearPedido(req(pedidoBody(negocio.id, productoId), { cookie: sessionB, ip }), {})
    expect(resNewSession.status).toBe(429)
  })

  test("2. orderIp: multiple accounts from the same IP share one bucket (R1 bypass closed)", async () => {
    const negocio = await ensureNegocio("ip")
    const productoId = await ensureProducto(negocio.id)
    const clienteX = await ensureCliente("ip-cliente-x")
    const sessionX = await createSession(clienteX.id, "cliente")
    const ip = `198.51.100.${randomUUID().slice(0, 2)}9`

    for (let i = 0; i < 14; i++) checkRateLimit("orderIp", ip)

    const res15 = await crearPedido(req(pedidoBody(negocio.id, productoId), { cookie: sessionX, ip }), {})
    expect(res15.status).toBe(201) // fills the IP bucket exactly — clienteX's own account bucket is fresh (1/5)

    // A DIFFERENT, brand-new account, same IP — its own account bucket is
    // completely untouched, yet it must still be blocked by the shared IP bucket.
    const clienteY = await ensureCliente("ip-cliente-y")
    const sessionY = await createSession(clienteY.id, "cliente")
    const resY = await crearPedido(req(pedidoBody(negocio.id, productoId), { cookie: sessionY, ip }), {})
    expect(resY.status).toBe(429)
  })

  test("3. orderBusiness: aggregate across accounts+IPs, isolated per negocio", async () => {
    const negocioTarget = await ensureNegocio("biz-target")
    const negocioOther = await ensureNegocio("biz-other")
    const productoTarget = await ensureProducto(negocioTarget.id)
    const productoOther = await ensureProducto(negocioOther.id)

    for (let i = 0; i < 29; i++) checkRateLimit("orderBusiness", negocioTarget.id)

    const clienteA = await ensureCliente("biz-cliente-a")
    const sessionA = await createSession(clienteA.id, "cliente")
    const ipA = `198.51.100.${randomUUID().slice(0, 2)}1`
    const res30 = await crearPedido(req(pedidoBody(negocioTarget.id, productoTarget), { cookie: sessionA, ip: ipA }), {})
    expect(res30.status).toBe(201) // fills the business bucket exactly

    // A totally different account + different IP, still targeting the SAME
    // negocio — its own account/IP buckets are fresh, yet blocked.
    const clienteB = await ensureCliente("biz-cliente-b")
    const sessionB = await createSession(clienteB.id, "cliente")
    const ipB = `198.51.100.${randomUUID().slice(0, 2)}2`
    const resB = await crearPedido(req(pedidoBody(negocioTarget.id, productoTarget), { cookie: sessionB, ip: ipB }), {})
    expect(resB.status).toBe(429)

    // Critical requirement (R2 §37): a 429-rejected request must create ZERO
    // side effects — no Pedido row, regardless of the pre-seeded quota.
    const targetPedidoCount = await db.pedido.count({ where: { negocioId: negocioTarget.id } })
    expect(targetPedidoCount).toBe(1) // only res30's real pedido — resB left nothing behind

    // SAME (already-blocked-for-target) account+IP, but ordering from a
    // DIFFERENT negocio — proves isolation (no cross-business bleed), and
    // simultaneously proves account/IP isolation (a fresh actor combo, on a
    // fresh business bucket, can still order normally).
    const resOther = await crearPedido(req(pedidoBody(negocioOther.id, productoOther), { cookie: sessionB, ip: ipB }), {})
    expect(resOther.status).toBe(201)
  })

  test("4. idempotency: replay with same Idempotency-Key still returns the same pedido, no duplicate row", async () => {
    const negocio = await ensureNegocio("idem")
    const productoId = await ensureProducto(negocio.id)
    const cliente = await ensureCliente("idem-cliente")
    const session = await createSession(cliente.id, "cliente")
    const ip = `198.51.100.${randomUUID().slice(0, 2)}3`
    const idemKey = randomUUID()

    const res1 = await crearPedido(req(pedidoBody(negocio.id, productoId), { cookie: session, ip, idempotencyKey: idemKey }), {})
    expect(res1.status).toBe(201)
    const body1 = await res1.json()

    const res2 = await crearPedido(req(pedidoBody(negocio.id, productoId), { cookie: session, ip, idempotencyKey: idemKey }), {})
    expect(res2.status).toBe(200)
    const body2 = await res2.json()
    expect(body2.id).toBe(body1.id)

    const count = await db.pedido.count({ where: { negocioId: negocio.id, idempotencyKey: idemKey } })
    expect(count).toBe(1)
  })

  test("5. concurrency lock: same-actor double-submit still gets 409, unrelated to the new rate-limit buckets", async () => {
    const negocio = await ensureNegocio("lock")
    const productoId = await ensureProducto(negocio.id)
    const cliente = await ensureCliente("lock-cliente")
    const session = await createSession(cliente.id, "cliente")
    const ip = `198.51.100.${randomUUID().slice(0, 2)}4`

    const [r1, r2] = await Promise.all([
      crearPedido(req(pedidoBody(negocio.id, productoId), { cookie: session, ip }), {}),
      crearPedido(req(pedidoBody(negocio.id, productoId), { cookie: session, ip }), {}),
    ])
    const statuses = [r1.status, r2.status].sort()
    expect(statuses).toEqual([201, 409])
  })

  test("6. mesa guest: unauthenticated mesa order is unaffected by the account bucket (no clienteId to key on)", async () => {
    const negocio = await ensureNegocio("mesa", { salonActivo: true })
    const productoId = await ensureProducto(negocio.id)
    const mesa = await db.mesa.create({ data: { negocioId: negocio.id, numero: 9001 } })
    const ip = `198.51.100.${randomUUID().slice(0, 2)}5`

    const res = await crearPedido(req(mesaBody(negocio.id, productoId, mesa.numero), { ip }), {})
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.metodoEntrega).toBe("mesa")
  })

  test("7. invalid negocioId never burns the real negocio's business bucket", async () => {
    const negocioReal = await ensureNegocio("real-biz")
    const productoReal = await ensureProducto(negocioReal.id)
    const ip = `198.51.100.${randomUUID().slice(0, 2)}6`

    // Garbage negocioId (doesn't match the product's real negocioId) — must
    // be rejected by payload/product validation, BEFORE reaching the rate
    // limiters (all three live strictly after that validation in the handler).
    const garbageBody = pedidoBody("this-negocio-does-not-exist", productoReal)
    const resGarbage = await crearPedido(req(garbageBody, { ip }), {})
    expect(resGarbage.status).toBe(400)

    // The real negocio's business bucket must still be fully fresh (30/30
    // available) — proven by exhausting it now with 29 pre-seeded units plus
    // 1 real request, which must still succeed as the 30th, not fail early.
    for (let i = 0; i < 29; i++) checkRateLimit("orderBusiness", negocioReal.id)
    const cliente = await ensureCliente("real-biz-cliente")
    const session = await createSession(cliente.id, "cliente")
    const res30 = await crearPedido(req(pedidoBody(negocioReal.id, productoReal), { cookie: session, ip: `${ip}9` }), {})
    expect(res30.status).toBe(201)
  })

  test("8. R2A: an exact idempotent replay consumes ZERO orderBusiness units", async () => {
    const negocio = await ensureNegocio("r2a-replay")
    const productoId = await ensureProducto(negocio.id)
    const attacker = await ensureCliente("r2a-attacker")
    const attackerSession = await createSession(attacker.id, "cliente")
    const attackerIp = `203.0.113.${randomUUID().slice(0, 2)}`
    const idemKey = randomUUID()

    const res1 = await crearPedido(
      req(pedidoBody(negocio.id, productoId), { cookie: attackerSession, ip: attackerIp, idempotencyKey: idemKey }),
      {}
    )
    expect(res1.status).toBe(201)
    const remainingAfterCreate = checkRateLimit("orderBusiness", negocio.id, { dryRun: true }).remaining

    // 3 exact replays — same account, same key, same body. Bounded to 3 (not
    // more) because orderAccount (5/5min) would otherwise become the
    // confound: the point here is isolating orderBusiness specifically.
    for (let i = 0; i < 3; i++) {
      const r = await crearPedido(
        req(pedidoBody(negocio.id, productoId), { cookie: attackerSession, ip: attackerIp, idempotencyKey: idemKey }),
        {}
      )
      expect(r.status).toBe(200) // safe-replay HTTP contract unaffected by the fix
    }
    const remainingAfterReplays = checkRateLimit("orderBusiness", negocio.id, { dryRun: true }).remaining

    expect(remainingAfterReplays).toBe(remainingAfterCreate) // zero additional units consumed
    const realPedidoCount = await db.pedido.count({ where: { negocioId: negocio.id } })
    expect(realPedidoCount).toBe(1) // still just the one real order
  })

  test("9. R2A: a CONFLICTING replay (same key, different account) also consumes ZERO orderBusiness units, still 409", async () => {
    const negocio = await ensureNegocio("r2a-conflict")
    const productoId = await ensureProducto(negocio.id)
    const clienteA = await ensureCliente("r2a-conflict-a")
    const sessionA = await createSession(clienteA.id, "cliente")
    const ipA = `203.0.113.${randomUUID().slice(0, 2)}1`
    const idemKey = randomUUID()

    const res1 = await crearPedido(req(pedidoBody(negocio.id, productoId), { cookie: sessionA, ip: ipA, idempotencyKey: idemKey }), {})
    expect(res1.status).toBe(201)
    const remainingAfterCreate = checkRateLimit("orderBusiness", negocio.id, { dryRun: true }).remaining

    // A DIFFERENT account reusing the SAME (negocioId, idempotencyKey) —
    // isSafeIdempotentPedido rejects it (fingerprint mismatch), so this must
    // be a 409 conflict, not a 200 replay or a 201 creation.
    const clienteB = await ensureCliente("r2a-conflict-b")
    const sessionB = await createSession(clienteB.id, "cliente")
    const ipB = `203.0.113.${randomUUID().slice(0, 2)}2`
    const resConflict = await crearPedido(
      req(pedidoBody(negocio.id, productoId), { cookie: sessionB, ip: ipB, idempotencyKey: idemKey }),
      {}
    )
    expect(resConflict.status).toBe(409)

    const remainingAfterConflict = checkRateLimit("orderBusiness", negocio.id, { dryRun: true }).remaining
    expect(remainingAfterConflict).toBe(remainingAfterCreate) // conflict burned zero business-bucket units too
    const realPedidoCount = await db.pedido.count({ where: { negocioId: negocio.id } })
    expect(realPedidoCount).toBe(1) // no second row from the conflicting attempt
  })

  test("10. R2A: a replay flood is still eventually capped by orderAccount, never touching orderBusiness", async () => {
    const negocio = await ensureNegocio("r2a-flood")
    const productoId = await ensureProducto(negocio.id)
    const attacker = await ensureCliente("r2a-flood-attacker")
    const attackerSession = await createSession(attacker.id, "cliente")
    const attackerIp = `203.0.113.${randomUUID().slice(0, 2)}3`
    const idemKey = randomUUID()

    const res1 = await crearPedido(
      req(pedidoBody(negocio.id, productoId), { cookie: attackerSession, ip: attackerIp, idempotencyKey: idemKey }),
      {}
    )
    expect(res1.status).toBe(201) // consumes 1/5 of this account's own bucket

    // 4 more replays exhaust the attacker's OWN account bucket (5/5min) —
    // the 5th replay call (6th request overall) must then be 429, sourced
    // from orderAccount, never from orderBusiness (still essentially full).
    let lastStatus = 0
    for (let i = 0; i < 5; i++) {
      const r = await crearPedido(
        req(pedidoBody(negocio.id, productoId), { cookie: attackerSession, ip: attackerIp, idempotencyKey: idemKey }),
        {}
      )
      lastStatus = r.status
    }
    expect(lastStatus).toBe(429) // IDEMPOTENT_REPLAY_REQUEST_FLOOD_STILL_LIMITED=SI

    const businessRemaining = checkRateLimit("orderBusiness", negocio.id, { dryRun: true }).remaining
    expect(businessRemaining).toBeGreaterThanOrEqual(28) // only the 1 real order ever touched it
  })

  test("11. R2A: the original DoS scenario is closed — a fresh victim can still place a new order after an attacker replay-floods one real order", async () => {
    const negocio = await ensureNegocio("r2a-victim")
    const productoId = await ensureProducto(negocio.id)
    const attacker = await ensureCliente("r2a-victim-attacker")
    const attackerSession = await createSession(attacker.id, "cliente")
    const attackerIp = `203.0.113.${randomUUID().slice(0, 2)}4`
    const idemKey = randomUUID()

    const res1 = await crearPedido(
      req(pedidoBody(negocio.id, productoId), { cookie: attackerSession, ip: attackerIp, idempotencyKey: idemKey }),
      {}
    )
    expect(res1.status).toBe(201)
    for (let i = 0; i < 3; i++) {
      await crearPedido(
        req(pedidoBody(negocio.id, productoId), { cookie: attackerSession, ip: attackerIp, idempotencyKey: idemKey }),
        {}
      )
    }

    // A totally fresh victim, fresh account, fresh IP, a genuinely NEW order
    // (no idempotency key) against the SAME negocio the attacker replayed —
    // must succeed, since only 1 real order-worth of orderBusiness was ever
    // actually consumed against this negocio.
    const victim = await ensureCliente("r2a-victim-real")
    const victimSession = await createSession(victim.id, "cliente")
    const victimIp = `203.0.113.${randomUUID().slice(0, 2)}5`
    const resVictim = await crearPedido(req(pedidoBody(negocio.id, productoId), { cookie: victimSession, ip: victimIp }), {})
    expect(resVictim.status).toBe(201) // IDEMPOTENT_REPLAY_BUSINESS_DOS_CLOSED=SI
  })

  test("12. R2B: N concurrent actors sharing one NEW idempotency key consume AT MOST 1 orderBusiness unit, never N", async () => {
    const negocio = await ensureNegocio("r2b-race")
    const productoId = await ensureProducto(negocio.id)
    const idemKey = randomUUID()
    const actors = await Promise.all([
      ensureActor("r2b-race-a"),
      ensureActor("r2b-race-b"),
      ensureActor("r2b-race-c"),
    ])

    // Seed 1 dummy unit first so both the "before" and "after" dryRun peeks
    // land on the same (entry-exists) branch of checkRateLimit — its
    // dryRun formula differs between a brand-new key (no entry yet) and an
    // established one, which would otherwise throw off a plain before/after
    // delta by exactly 1 (see the R2B report's methodology note).
    checkRateLimit("orderBusiness", negocio.id)
    const remainingBefore = checkRateLimit("orderBusiness", negocio.id, { dryRun: true }).remaining

    const barrier = makeBarrier(200)
    const results = await Promise.all(
      actors.map((actor) =>
        crearPedido(
          req(pedidoBody(negocio.id, productoId), { cookie: actor.session, ip: actor.ip, idempotencyKey: idemKey }),
          { beforeIdempotencyPrecheck: () => barrier }
        )
      )
    )
    const remainingAfter = checkRateLimit("orderBusiness", negocio.id, { dryRun: true }).remaining
    const consumed = remainingBefore - remainingAfter

    expect(consumed).toBeLessThanOrEqual(1) // CONCURRENT_IDEMPOTENCY_BUSINESS_DOS_CLOSED=SI — never N
    const statuses = results.map((r) => r.status).sort((a, b) => a - b)
    expect(statuses.filter((s) => s === 201 || s === 200).length).toBe(1) // exactly one winner
    const pedidoRows = await db.pedido.count({ where: { negocioId: negocio.id } })
    expect(pedidoRows).toBe(1) // DB unique constraint remains the sole creation authority
  })

  test("13. R2B: a concurrent same-key attack cannot push a near-full business bucket over the edge for a fresh victim", async () => {
    const negocio = await ensureNegocio("r2b-victim")
    const productoId = await ensureProducto(negocio.id)
    const idemKey = randomUUID()
    const actors = await Promise.all([
      ensureActor("r2b-victim-a"),
      ensureActor("r2b-victim-b"),
      ensureActor("r2b-victim-c"),
    ])

    // Prime 27/30 directly (helper-seeded, no real writes) — leaves exactly
    // 3 units of real headroom, same technique as test 3/7 above.
    for (let i = 0; i < 27; i++) checkRateLimit("orderBusiness", negocio.id)

    const barrier = makeBarrier(200)
    await Promise.all(
      actors.map((actor) =>
        crearPedido(
          req(pedidoBody(negocio.id, productoId), { cookie: actor.session, ip: actor.ip, idempotencyKey: idemKey }),
          { beforeIdempotencyPrecheck: () => barrier }
        )
      )
    )
    const pedidoRows = await db.pedido.count({ where: { negocioId: negocio.id } })
    expect(pedidoRows).toBe(1)

    // A totally fresh victim, fresh account, fresh IP, a genuinely NEW order
    // (no idempotency key) — must still succeed: the concurrent attack above
    // burned at most 1 unit of the 3 remaining, regardless of how many
    // actors raced for it.
    const victim = await ensureActor("r2b-victim-real")
    const resVictim = await crearPedido(req(pedidoBody(negocio.id, productoId), { cookie: victim.session, ip: victim.ip }), {})
    expect(resVictim.status).toBe(201)
  })

  test("14. R2C: a failed lock acquire (B) must never release the lock owned by an in-flight request (A), and a legitimate release still lets D through", async () => {
    const negocio = await ensureNegocio("r2c-lock")
    const productoId = await ensureProducto(negocio.id)
    const actor = await ensureActor("r2c-lock")

    // A: acquires orderLockKey and pauses mid-flight via the new
    // afterOrderLockAcquired hook — still holding the lock the whole time.
    let releaseA: () => void
    const aGate = new Promise<void>((resolve) => {
      releaseA = resolve
    })
    const aPromise = crearPedido(req(pedidoBody(negocio.id, productoId), { cookie: actor.session, ip: actor.ip }), {
      afterOrderLockAcquired: () => aGate,
    })
    await new Promise((r) => setTimeout(r, 100)) // let A actually reach the hook

    // B: same actor, same orderLockKey, while A definitely still holds it —
    // must be rejected, and (the actual R2C regression) must NOT free A's lock.
    const bRes = await crearPedido(req(pedidoBody(negocio.id, productoId), { cookie: actor.session, ip: actor.ip }), {})
    expect(bRes.status).toBe(409)

    // C: same key, immediately after B, while A is STILL paused/holding.
    // Pre-fix this succeeded (B's finally freed A's lock) and created a
    // second real Pedido row — exactly the double-submit this lock exists
    // to prevent. Post-fix it must also be 409.
    const cRes = await crearPedido(req(pedidoBody(negocio.id, productoId), { cookie: actor.session, ip: actor.ip }), {})
    expect(cRes.status).toBe(409)

    releaseA!()
    const aRes = await aPromise
    expect(aRes.status).toBe(201) // the only request that legitimately held the lock

    const pedidoRows = await db.pedido.count({ where: { negocioId: negocio.id } })
    expect(pedidoRows).toBe(1) // FOREIGN_LOCK_REJECT_SIDE_EFFECTS=0 — B/C created nothing

    // D: a fresh request, same key, AFTER A's legitimate release — the lock
    // must not be left orphaned by the fix (still released normally on the
    // owner's own finally).
    const dRes = await crearPedido(req(pedidoBody(negocio.id, productoId), { cookie: actor.session, ip: actor.ip }), {})
    expect(dRes.status).toBe(201)
  })
})
