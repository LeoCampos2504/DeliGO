// P2-T04 Stage 3B — focal unit tests for the Operaciones PyR attachment
// route (R-MUT-06 create): must now invalidate Pedido.chatRevision
// atomically, exactly like the main Chat route already does. No real DB
// (Prisma), no real Cloudinary/network, no real local file I/O — every
// dependency is mocked, including the Cloudinary upload so the route never
// falls back to writing a file to disk.
import { beforeEach, describe, expect, mock, test } from "bun:test"
import { NextRequest, NextResponse } from "next/server"

// Forces `cloudinaryConfigured=true` inside the route so it never reaches
// its local-disk fallback path in this test process.
process.env.CLOUDINARY_CLOUD_NAME = "test-cloud"
process.env.CLOUDINARY_API_KEY = "test-key"
process.env.CLOUDINARY_API_SECRET = "test-secret"

type QueryRawLockRow = { clienteId: string | null; negocioNombre: string }

const DEFAULT_CONTEXT = {
  terminal: { id: "terminal-1", nombre: "Terminal Test" },
  negocio: { id: "negocio-1", nombre: "Negocio Test", colorPrincipal: "#000000" },
}

let authResult: { ok: true; context: typeof DEFAULT_CONTEXT } | { ok: false; response: NextResponse }
let pedidoFindFirstResult: { id: string } | null
let pedidoUpdateCalls: Array<Record<string, unknown>>
let createCallCount: number
let createShouldThrow: Error | null
let queryRawLockResult: QueryRawLockRow[]

mock.module("@/lib/db", () => {
  const chatMensaje = {
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

mock.module("@/lib/resource-url", () => ({
  validateChatImageUrl: (value: unknown) => ({ ok: true, value: typeof value === "string" ? value : "" }),
  validateChatPdfUrl: (value: unknown) => ({ ok: true, value: typeof value === "string" ? value : "" }),
}))

mock.module("@/lib/cloudinary", () => ({
  uploadImage: async () => ({ url: "https://res.cloudinary.test/chat/pedido-1/photo.jpg" }),
  uploadFile: async () => ({ url: "https://res.cloudinary.test/chat/pedido-1/comprobante.pdf" }),
}))

const { POST } = await import("./route")

// Minimal real PNG signature so `hasAllowedSignature` accepts it.
const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])

function buildPngFile(): File {
  return new File([PNG_SIGNATURE], "photo.png", { type: "image/png" })
}

function buildPostRequest(pedidoId = "pedido-1", file: File = buildPngFile()) {
  const formData = new FormData()
  formData.set("file", file)
  return new NextRequest(`http://localhost/api/operaciones/pyr/mensajes/${pedidoId}/adjunto`, {
    method: "POST",
    body: formData,
  })
}
function callPost(pedidoId = "pedido-1", file?: File) {
  return POST(buildPostRequest(pedidoId, file), { params: Promise.resolve({ pedidoId }) })
}

beforeEach(() => {
  authResult = { ok: true, context: DEFAULT_CONTEXT }
  pedidoFindFirstResult = { id: "pedido-1" }
  pedidoUpdateCalls = []
  createCallCount = 0
  createShouldThrow = null
  queryRawLockResult = [{ clienteId: "cliente-1", negocioNombre: "Negocio Test" }]
})

describe("Operaciones PyR adjunto — P2-T04 Stage 3B chatRevision invalidation", () => {
  test("PYR-REV-07: successful attachment create bumps Pedido.chatRevision by exactly 1, same transaction as the create", async () => {
    const res = await callPost()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(createCallCount).toBe(1)
    expect(pedidoUpdateCalls).toHaveLength(1)
    expect(pedidoUpdateCalls[0]).toEqual({
      where: { id: "pedido-1" },
      data: { chatRevision: { increment: 1 } },
    })
  })

  test("PYR-REV-08: a create failure inside the transaction is never reported as a successful persisted message, and never bumps the revision", async () => {
    createShouldThrow = new Error("simulated DB failure")
    const res = await callPost()
    const body = await res.json()
    expect(res.status).toBe(500)
    expect(body.ok).toBe(false)
    expect(pedidoUpdateCalls).toHaveLength(0)
  })

  test("PYR-REV-09: authorization/file restrictions unchanged — an unsupported file type is rejected before any DB mutation", async () => {
    const badFile = new File([new Uint8Array([1, 2, 3, 4])], "malware.exe", { type: "application/octet-stream" })
    const res = await callPost("pedido-1", badFile)
    expect(res.status).toBe(400)
    expect(createCallCount).toBe(0)
    expect(pedidoUpdateCalls).toHaveLength(0)
  })

  test("an authorization failure produces zero ChatMensaje mutation and zero revision bump", async () => {
    authResult = { ok: false, response: NextResponse.json({ ok: false }, { status: 403 }) }
    const res = await callPost()
    expect(res.status).toBe(403)
    expect(createCallCount).toBe(0)
    expect(pedidoUpdateCalls).toHaveLength(0)
  })

  test("PYR-REV-10: response contract unchanged — no chatRevision/historyRevision leaked into the response", async () => {
    const res = await callPost()
    const body = await res.json()
    expect(body).toEqual({ ok: true, mensaje: { id: "msg-server-1" } })
  })

  test("pedido inactive at lock time (409) never bumps the revision", async () => {
    queryRawLockResult = []
    const res = await callPost()
    expect(res.status).toBe(409)
    expect(pedidoUpdateCalls).toHaveLength(0)
  })
})
