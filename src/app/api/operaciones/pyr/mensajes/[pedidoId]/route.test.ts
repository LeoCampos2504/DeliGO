// P2-T04 Stage 3B — focal unit tests for the Operaciones PyR text-message
// route (R-MUT-06 create, R-MUT-07 mark-read): both must now invalidate
// Pedido.chatRevision atomically, exactly like the main Chat route already
// does. No real DB (Prisma), no network — every dependency is mocked.
import { beforeEach, describe, expect, mock, test } from "bun:test"
import { NextRequest, NextResponse } from "next/server"

type QueryRawLockRow = { clienteId: string | null; negocioNombre: string }

const DEFAULT_CONTEXT = {
  terminal: { id: "terminal-1", nombre: "Terminal Test" },
  negocio: { id: "negocio-1", nombre: "Negocio Test", colorPrincipal: "#000000" },
}

let authResult: { ok: true; context: typeof DEFAULT_CONTEXT } | { ok: false; response: NextResponse }
let hasScopeResult: boolean
let pedidoFindFirstResult: { clienteNombre: string; estado: string; metodoEntrega: string } | null
let chatMensajesRecord: Array<{
  id: string
  remitente: string
  texto: string
  imagenUrl: string | null
  archivoUrl: string | null
  archivoNombre: string | null
  archivoTipo: string | null
  fecha: Date
  leido: boolean
}>
let markReadUpdateCount: number
let pedidoUpdateCalls: Array<Record<string, unknown>>
let createCallCount: number
let createShouldThrow: Error | null
let queryRawLockResult: QueryRawLockRow[]

const FIXED_DATE = new Date("2026-08-23T00:00:00.000Z")

mock.module("@/lib/db", () => {
  const chatMensaje = {
    findMany: async () => chatMensajesRecord,
    updateMany: async () => {
      const count = markReadUpdateCount
      markReadUpdateCount = 0
      return { count }
    },
    create: async () => {
      createCallCount += 1
      if (createShouldThrow) throw createShouldThrow
      return { id: "msg-server-1" }
    },
  }
  const pedido = {
    findFirst: async () => pedidoFindFirstResult,
    update: async (args: Record<string, unknown>) => {
      pedidoUpdateCalls.push(args)
      return {}
    },
  }
  const queryRaw = async (_strings: TemplateStringsArray, ..._values: unknown[]) => queryRawLockResult
  const db = {
    pedido,
    chatMensaje,
    cliente: { findUnique: async () => ({ pushSubscription: null }) },
    $queryRaw: queryRaw,
    $transaction: async (fn: (tx: { chatMensaje: typeof chatMensaje; pedido: typeof pedido; $queryRaw: typeof queryRaw }) => Promise<unknown>) =>
      fn({ chatMensaje, pedido, $queryRaw: queryRaw }),
  }
  return { db }
})

mock.module("@/lib/operaciones-terminal-access", () => ({
  requireOperacionesScope: async () => authResult,
  hasTerminalScope: () => hasScopeResult,
}))

mock.module("@/lib/push", () => ({
  createNotification: async () => {},
  chatMessageNotification: () => ({ title: "t", body: "b" }),
}))

// `mock.module` is process-global (not scoped per file) in bun:test — this
// route only calls `checkRateLimit`, but the shape includes `rateLimitResponse`
// too so that whichever PyR test file loads first in a combined run leaves a
// mock compatible with the operativo/pyr route, which does need it.
mock.module("@/lib/rate-limit", () => ({
  checkRateLimit: () => ({ allowed: true, remaining: 10, resetAt: Date.now() + 1000 }),
  rateLimitResponse: (result: { retryAfterMs?: number }, message?: string) =>
    NextResponse.json({ ok: false, error: message || "Demasiados intentos" }, { status: 429 }),
}))

const { GET, POST } = await import("./route")

function buildGetRequest(pedidoId = "pedido-1") {
  return new NextRequest(`http://localhost/api/operaciones/pyr/mensajes/${pedidoId}`)
}
function callGet(pedidoId = "pedido-1") {
  return GET(buildGetRequest(pedidoId), { params: Promise.resolve({ pedidoId }) })
}

function buildPostRequest(pedidoId = "pedido-1", body: Record<string, unknown> = { texto: "hola" }) {
  return new NextRequest(`http://localhost/api/operaciones/pyr/mensajes/${pedidoId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}
function callPost(pedidoId = "pedido-1", body?: Record<string, unknown>) {
  return POST(buildPostRequest(pedidoId, body), { params: Promise.resolve({ pedidoId }) })
}

beforeEach(() => {
  authResult = { ok: true, context: DEFAULT_CONTEXT }
  hasScopeResult = true
  pedidoFindFirstResult = { clienteNombre: "Cliente Test", estado: "recibido", metodoEntrega: "domicilio" }
  chatMensajesRecord = [
    { id: "m1", remitente: "cliente", texto: "hola", imagenUrl: null, archivoUrl: null, archivoNombre: null, archivoTipo: null, fecha: FIXED_DATE, leido: false },
  ]
  markReadUpdateCount = 1
  pedidoUpdateCalls = []
  createCallCount = 0
  createShouldThrow = null
  queryRawLockResult = [{ clienteId: "cliente-1", negocioNombre: "Negocio Test" }]
})

describe("Operaciones PyR mensajes — P2-T04 Stage 3B chatRevision invalidation", () => {
  test("PYR-REV-01: successful create bumps Pedido.chatRevision by exactly 1, same transaction as the create", async () => {
    const res = await callPost()
    expect(res.status).toBe(200)
    expect(createCallCount).toBe(1)
    expect(pedidoUpdateCalls).toHaveLength(1)
    expect(pedidoUpdateCalls[0]).toEqual({
      where: { id: "pedido-1" },
      data: { chatRevision: { increment: 1 } },
    })
  })

  test("PYR-REV-02: a create failure inside the transaction never bumps the revision — no standalone successful create path", async () => {
    createShouldThrow = new Error("simulated DB failure")
    const res = await callPost()
    expect(res.status).toBe(500)
    expect(pedidoUpdateCalls).toHaveLength(0)
  })

  test("PYR-REV-03: mark-read with count>0 bumps the revision exactly once", async () => {
    markReadUpdateCount = 1
    const res = await callGet()
    expect(res.status).toBe(200)
    expect(pedidoUpdateCalls).toHaveLength(1)
    expect(pedidoUpdateCalls[0]).toEqual({
      where: { id: "pedido-1" },
      data: { chatRevision: { increment: 1 } },
    })
  })

  test("PYR-REV-04: mark-read with count=0 never bumps the revision", async () => {
    markReadUpdateCount = 0
    const res = await callGet()
    expect(res.status).toBe(200)
    expect(pedidoUpdateCalls).toHaveLength(0)
  })

  test("PYR-REV-05: an authorization failure produces zero ChatMensaje mutation and zero revision bump", async () => {
    authResult = { ok: false, response: NextResponse.json({ ok: false }, { status: 403 }) }
    const resGet = await callGet()
    const resPost = await callPost()
    expect(resGet.status).toBe(403)
    expect(resPost.status).toBe(403)
    expect(createCallCount).toBe(0)
    expect(pedidoUpdateCalls).toHaveLength(0)
  })

  test("PYR-REV-06: response/status contract is unchanged — no chatRevision/historyRevision leaked into either shape", async () => {
    const resGet = await callGet()
    const bodyGet = await resGet.json()
    expect(bodyGet.ok).toBe(true)
    expect(bodyGet.mensajes).toBeDefined()
    expect(bodyGet.pedido).toBeDefined()
    expect(bodyGet.capacidades).toBeDefined()
    expect(bodyGet).not.toHaveProperty("chatRevision")
    expect(bodyGet).not.toHaveProperty("historyRevision")

    const resPost = await callPost()
    const bodyPost = await resPost.json()
    expect(bodyPost).toEqual({ ok: true, mensaje: { id: "msg-server-1" } })
  })

  test("pedido inactive at lock time (409) never bumps the revision", async () => {
    queryRawLockResult = []
    const res = await callPost()
    expect(res.status).toBe(409)
    expect(pedidoUpdateCalls).toHaveLength(0)
  })
})
