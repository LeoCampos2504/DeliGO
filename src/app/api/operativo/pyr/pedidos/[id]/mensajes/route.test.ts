// P2-T04 Stage 3B — focal unit tests for the Operativo (personal PyR)
// mensajes route (R-MUT-06 create, R-MUT-07 mark-read): both must now
// invalidate Pedido.chatRevision atomically, exactly like the main Chat
// route already does. No real DB (Prisma), no network — every dependency
// is mocked.
import { beforeEach, describe, expect, mock, test } from "bun:test"
import { NextRequest, NextResponse } from "next/server"

type QueryRawLockRow = { clienteId: string | null; negocioNombre: string }

let authResult:
  | { ok: true; negocio: { id: string }; cuenta: { id: string } }
  | { ok: false; status: number; state: string; clearSession?: boolean }
let pedidoFindFirstResult: { id: string; estado: string; metodoEntrega: string; clienteNombre: string } | null
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

mock.module("@/lib/operativo-mozo", () => ({
  resolveOperativoAreaForSlug: async () => authResult,
  noStore: (response: NextResponse) => response,
}))

// `@/lib/auth` is intentionally NOT mocked here: the route only reads the
// static `OPERATIONAL_SESSION_COOKIE_NAME` string constant from it (used
// solely for `response.cookies.delete(...)` on an auth-denied response) —
// letting it resolve to the real module avoids clobbering `@/lib/auth`'s
// other exports for any OTHER test file mocking it differently when run
// in the same bun:test process (mock.module is process-global, not scoped
// per file).

mock.module("@/lib/push", () => ({
  createNotification: async () => {},
  chatMessageNotification: () => ({ title: "t", body: "b" }),
}))

mock.module("@/lib/rate-limit", () => ({
  checkRateLimit: () => ({ allowed: true, remaining: 10, resetAt: Date.now() + 1000 }),
  rateLimitResponse: (result: { retryAfterMs?: number }, message?: string) =>
    NextResponse.json({ ok: false, error: message || "Demasiados intentos" }, { status: 429 }),
}))

mock.module("@/lib/log-safe-error", () => ({
  safeErrorForLog: (e: unknown) => e,
}))

const { GET, POST } = await import("./route")

function buildGetRequest(pedidoId = "pedido-1", slug = "negocio-slug") {
  return new NextRequest(`http://localhost/api/operativo/pyr/pedidos/${pedidoId}/mensajes?slug=${slug}`)
}
function callGet(pedidoId = "pedido-1", slug?: string) {
  return GET(buildGetRequest(pedidoId, slug), { params: Promise.resolve({ id: pedidoId }) })
}

function buildPostRequest(pedidoId = "pedido-1", body: Record<string, unknown> = { mensaje: "hola" }, slug = "negocio-slug") {
  return new NextRequest(`http://localhost/api/operativo/pyr/pedidos/${pedidoId}/mensajes?slug=${slug}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}
function callPost(pedidoId = "pedido-1", body?: Record<string, unknown>) {
  return POST(buildPostRequest(pedidoId, body), { params: Promise.resolve({ id: pedidoId }) })
}

beforeEach(() => {
  authResult = { ok: true, negocio: { id: "negocio-1" }, cuenta: { id: "cuenta-1" } }
  pedidoFindFirstResult = { id: "pedido-1", estado: "recibido", metodoEntrega: "domicilio", clienteNombre: "Cliente Test" }
  chatMensajesRecord = [
    { id: "m1", remitente: "cliente", texto: "hola", imagenUrl: null, archivoUrl: null, archivoNombre: null, archivoTipo: null, fecha: FIXED_DATE, leido: false },
  ]
  markReadUpdateCount = 1
  pedidoUpdateCalls = []
  createCallCount = 0
  createShouldThrow = null
  queryRawLockResult = [{ clienteId: "cliente-1", negocioNombre: "Negocio Test" }]
})

describe("Operativo PyR mensajes — P2-T04 Stage 3B chatRevision invalidation", () => {
  test("PYR-REV-11: successful create bumps Pedido.chatRevision by exactly 1, same transaction as the create", async () => {
    const res = await callPost()
    expect(res.status).toBe(200)
    expect(createCallCount).toBe(1)
    expect(pedidoUpdateCalls).toHaveLength(1)
    expect(pedidoUpdateCalls[0]).toEqual({
      where: { id: "pedido-1" },
      data: { chatRevision: { increment: 1 } },
    })
  })

  test("a create failure inside the transaction never bumps the revision", async () => {
    createShouldThrow = new Error("simulated DB failure")
    const res = await callPost()
    expect(res.status).toBe(500)
    expect(pedidoUpdateCalls).toHaveLength(0)
  })

  test("PYR-REV-12: mark-read with count>0 bumps the revision exactly once", async () => {
    markReadUpdateCount = 1
    const res = await callGet()
    expect(res.status).toBe(200)
    expect(pedidoUpdateCalls).toHaveLength(1)
    expect(pedidoUpdateCalls[0]).toEqual({
      where: { id: "pedido-1" },
      data: { chatRevision: { increment: 1 } },
    })
  })

  test("PYR-REV-13: mark-read with count=0 never bumps the revision", async () => {
    markReadUpdateCount = 0
    const res = await callGet()
    expect(res.status).toBe(200)
    expect(pedidoUpdateCalls).toHaveLength(0)
  })

  test("PYR-REV-14: authorization/areaOperativa failure produces zero ChatMensaje mutation and zero revision bump", async () => {
    authResult = { ok: false, status: 403, state: "area_no_habilitada" }
    const resGet = await callGet()
    const resPost = await callPost()
    expect(resGet.status).toBe(403)
    expect(resPost.status).toBe(403)
    expect(createCallCount).toBe(0)
    expect(pedidoUpdateCalls).toHaveLength(0)
  })

  test("PYR-REV-15: response/status contract is unchanged — no chatRevision/historyRevision leaked into either shape", async () => {
    const resGet = await callGet()
    const bodyGet = await resGet.json()
    expect(bodyGet.ok).toBe(true)
    expect(bodyGet.pedido).toBeDefined()
    expect(bodyGet.mensajes).toBeDefined()
    expect(bodyGet).not.toHaveProperty("chatRevision")
    expect(bodyGet).not.toHaveProperty("historyRevision")

    const resPost = await callPost()
    const bodyPost = await resPost.json()
    expect(bodyPost).toEqual({ ok: true, mensaje: { id: "msg-server-1" } })
  })

  test("pedido inactive at lock time (404) never bumps the revision", async () => {
    queryRawLockResult = []
    const res = await callPost()
    expect(res.status).toBe(404)
    expect(pedidoUpdateCalls).toHaveLength(0)
  })
})
