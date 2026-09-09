/// <reference types="bun-types" />

// ============================================
// P2-T28 — order-status concurrency lock ownership
// ============================================
// R2C found and fixed a MATERIAL foreign-lock-release bug in
// src/app/api/pedidos/route.ts: a request whose own acquireLock() failed
// still ran through the outer finally, which unconditionally called
// releaseLock() — freeing a lock it never held, letting a third concurrent
// request slip in while the original was still in flight (a real double
// Pedido was created — see codex-reports/
// P2_T25_R2C_ORDER_LOCK_OWNERSHIP_RELEASE_RACE.md).
//
// This file certifies, empirically (not by code reading alone), whether the
// analogous lock in src/app/api/negocio/pedidos/[id]/estado/route.ts
// (`pedido-estado:${pedidoId}`) has the same bug. Structural read: it does
// NOT — unlike the pedidos route, the acquireLock() check and its early
// 409 return live BEFORE the try/finally block here (not inside it), so a
// failed acquire never reaches this request's own `finally` and can never
// call releaseLock() on someone else's lock. Confirmed below with the same
// A/B/C harness used in R2C: while A holds the lock (paused via the new
// afterStateLockAcquired test hook, fired only after a successful acquire),
// both a rejected B and a rejected C stay rejected — C never slips in — and
// zero PedidoEvento rows are created by the rejected attempts. After A
// releases legitimately, a fresh D can still transition the order normally
// — the lock is not left orphaned.
//
// See codex-reports/P2_T28_ORDER_STATE_LOCK_OWNERSHIP_HARDENING_R1.md for
// the full audit (including why the non-"cancelado" transitions have no
// DB-level CAS of their own, unlike "cancelado" — making this lock's
// correctness the only defense for those transitions, which is exactly why
// this needed empirical, not just structural, verification).

import { randomUUID } from "crypto"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createSession, SESSION_COOKIE_NAME } from "@/lib/auth"
import { POST_FOR_TESTS as crearPedido } from "@/app/api/pedidos/route"
import { PATCH_FOR_TESTS as cambiarEstado } from "@/app/api/negocio/pedidos/[id]/estado/route"

setDefaultTimeout(60_000)

const prefix = "test-t28-"

async function ensureNegocio(suffix: string) {
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
    },
  })
}

async function ensureProducto(negocioId: string) {
  const producto = await db.producto.create({ data: { nombre: `${prefix}producto`, precio: 100, negocioId } })
  return producto.id
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

function pedidoReq(body: unknown, ip: string, cookie?: string): NextRequest {
  const headers: Record<string, string> = { "content-type": "application/json", "x-forwarded-for": ip }
  if (cookie) headers["cookie"] = `${SESSION_COOKIE_NAME}=${cookie}`
  return new NextRequest("http://localhost/api/pedidos", { method: "POST", body: JSON.stringify(body), headers })
}

function estadoReq(pedidoId: string, body: unknown, negocioSession: string): NextRequest {
  return new NextRequest(`http://localhost/api/negocio/pedidos/${pedidoId}/estado`, {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", cookie: `${SESSION_COOKIE_NAME}=${negocioSession}` },
  })
}

function cambiar(pedidoId: string, body: unknown, negocioSession: string, testHooks: Record<string, unknown> = {}) {
  return cambiarEstado(
    estadoReq(pedidoId, body, negocioSession),
    { params: Promise.resolve({ id: pedidoId }) },
    testHooks
  )
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
    await db.sesion.deleteMany({ where: { userId: { in: negocioIds } } })
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

describe("P2-T28 — pedido-estado lock ownership", () => {
  test("A/B/C/D: a rejected concurrent status-change request never frees another request's state lock", async () => {
    const negocio = await ensureNegocio("lock")
    const productoId = await ensureProducto(negocio.id)
    const negocioSession = await createSession(negocio.id, "negocio")
    const cliente = await db.cliente.create({ data: { nombre: `${prefix}lock-cliente`, email: `${prefix}lock-cliente@example.test`, telefono: "" } })
    const clienteSession = await createSession(cliente.id, "cliente")
    const ip = `198.51.100.${randomUUID().slice(0, 2)}`

    const createRes = await crearPedido(pedidoReq(pedidoBody(negocio.id, productoId), ip, clienteSession), {})
    expect(createRes.status).toBe(201)
    const pedido = await createRes.json()
    expect(pedido.estado).toBe("recibido")

    // A: recibido -> preparando, paused right after acquiring the state lock.
    let releaseA: () => void
    const aGate = new Promise<void>((resolve) => {
      releaseA = resolve
    })
    const aPromise = cambiar(pedido.id, { estado: "preparando" }, negocioSession, {
      afterStateLockAcquired: () => aGate,
    })
    await new Promise((r) => setTimeout(r, 100)) // let A actually reach the hook

    // B: same pedido, while A definitely still holds the lock — must be 409,
    // and (the actual thing under test) must NOT free A's lock.
    const bRes = await cambiar(pedido.id, { estado: "preparando" }, negocioSession)
    expect(bRes.status).toBe(409)

    // C: same pedido, immediately after B, while A is STILL paused/holding.
    // This is the exact R2C-pattern check: if B's rejection had freed A's
    // lock, C would acquire it here and could mutate the Pedido while A is
    // still logically in flight.
    const cRes = await cambiar(pedido.id, { estado: "preparando" }, negocioSession)
    expect(cRes.status).toBe(409)

    releaseA!()
    const aRes = await aPromise
    expect(aRes.status).toBe(200) // the only request that legitimately held the lock
    const aBody = await aRes.json()
    expect(aBody.estado).toBe("preparando")

    // Rejected B/C must have produced zero side effects: no PedidoEvento
    // from them, and the pedido's estado reflects only A's transition.
    const eventCount = await db.pedidoEvento.count({ where: { pedidoId: pedido.id } })
    expect(eventCount).toBe(1) // only A's accepted transition
    const freshPedido = await db.pedido.findUniqueOrThrow({ where: { id: pedido.id } })
    expect(freshPedido.estado).toBe("preparando")

    // D: a fresh request, same pedido, AFTER A's legitimate release — the
    // lock must not be left orphaned by the (structurally already-correct)
    // acquire/release placement.
    const dRes = await cambiar(pedido.id, { estado: "cancelado", motivo: "test" }, negocioSession)
    expect(dRes.status).toBe(200)
    const dBody = await dRes.json()
    expect(dBody.estado).toBe("cancelado")
  })

  test("invalid transition is still rejected with zero mutation (regression)", async () => {
    const negocio = await ensureNegocio("invalid")
    const productoId = await ensureProducto(negocio.id)
    const negocioSession = await createSession(negocio.id, "negocio")
    const cliente = await db.cliente.create({ data: { nombre: `${prefix}invalid-cliente`, email: `${prefix}invalid-cliente@example.test`, telefono: "" } })
    const clienteSession = await createSession(cliente.id, "cliente")
    const ip = `198.51.100.${randomUUID().slice(0, 2)}1`

    const createRes = await crearPedido(pedidoReq(pedidoBody(negocio.id, productoId), ip, clienteSession), {})
    const pedido = await createRes.json()

    // recibido -> entregado is not in VALID_TRANSITIONS["recibido"].
    const res = await cambiar(pedido.id, { estado: "entregado" }, negocioSession)
    expect(res.status).toBe(400)

    const freshPedido = await db.pedido.findUniqueOrThrow({ where: { id: pedido.id } })
    expect(freshPedido.estado).toBe("recibido")
    const eventCount = await db.pedidoEvento.count({ where: { pedidoId: pedido.id } })
    expect(eventCount).toBe(0)
  })
})
