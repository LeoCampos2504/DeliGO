// P2 — Chat POST route, fully isolated unit tests.
// No real DB (Prisma), no real network, no Railway secret: every dependency
// of route.ts is replaced via mock.module before the route is imported.
import { beforeEach, describe, expect, mock, test } from "bun:test"
import { NextRequest } from "next/server"

const DEFAULT_PEDIDO = {
  id: "pedido-1",
  clienteId: "cliente-1",
  negocioId: "negocio-1",
  negocioNombre: "Negocio Test",
  negocioSlug: "negocio-test",
  clienteNombre: "Cliente Test",
  estado: "recibido",
  total: 1000,
  metodoEntrega: "domicilio",
  metodoPago: "efectivo",
  chatRevision: 5,
}

let pedidoRecord: typeof DEFAULT_PEDIDO | null
let sessionResult: { userId: string; userType: string } | null
let createShouldThrow: Error | null
let createCallCount: number
let publishCalls: Array<Record<string, unknown>>
let publishImpl: (event: Record<string, unknown>) => Promise<unknown>
let pedidoUpdateCalls: Array<Record<string, unknown>>
let chatMensajesRecord: Array<Record<string, unknown>>
let findManyCallCount: number
let markReadUpdateCount: number

const FIXED_DATE = new Date("2026-08-18T00:00:00.000Z")

mock.module("@/lib/db", () => {
  const chatMensaje = {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      createCallCount += 1
      if (createShouldThrow) throw createShouldThrow
      return {
        id: "msg-server-generated-1",
        pedidoId: data.pedidoId,
        remitente: data.remitente,
        texto: data.texto,
        imagenUrl: data.imagenUrl,
        archivoUrl: data.archivoUrl,
        archivoNombre: data.archivoNombre,
        archivoTipo: data.archivoTipo,
        leido: data.leido,
        fecha: FIXED_DATE,
        clienteId: data.clienteId,
      }
    },
    findMany: async () => {
      findManyCallCount += 1
      return chatMensajesRecord
    },
    updateMany: async () => {
      const count = markReadUpdateCount
      markReadUpdateCount = 0
      return { count }
    },
  }
  const pedido = {
    findUnique: async () => pedidoRecord,
    // P2-T04 MODEL_R: chatRevision increment, same transaction as create
    // (POST) or as a conditional mark-read bump (GET semantic).
    update: async (args: Record<string, unknown>) => {
      pedidoUpdateCalls.push(args)
      return { chatRevision: 1 }
    },
  }
  const db = {
    pedido,
    negocio: {
      findUnique: async () => ({ pushSubscription: null }),
    },
    cliente: {
      findUnique: async () => ({ pushSubscription: null }),
    },
    chatMensaje,
    // Single-connection interactive-transaction stand-in: the callback
    // receives the SAME chatMensaje/pedido mocks above, so a thrown error
    // (e.g. createShouldThrow) propagates out of $transaction exactly like
    // a real Prisma rollback — no standalone successful create path exists.
    $transaction: async (fn: (tx: { chatMensaje: typeof chatMensaje; pedido: typeof pedido }) => Promise<unknown>) =>
      fn({ chatMensaje, pedido }),
  }
  return { db }
})

mock.module("@/lib/auth", () => ({
  validateSession: async (_token: string) => sessionResult,
}))

mock.module("@/lib/rate-limit", () => ({
  checkRateLimit: () => ({ allowed: true, remaining: 10, resetAt: Date.now() + 1000 }),
  getClientIp: () => "127.0.0.1",
  rateLimitResponse: (result: { retryAfterMs?: number }, message?: string) =>
    Response.json({ error: message || "Demasiados intentos" }, { status: 429 }),
}))

mock.module("@/lib/push", () => ({
  createNotification: async () => {},
  chatMessageNotification: () => ({ title: "t", body: "b" }),
}))

mock.module("@/lib/resource-url", () => ({
  validateChatImageUrl: (value: unknown) => ({ ok: true, value: typeof value === "string" ? value : "" }),
  validateChatPdfUrl: (value: unknown) => ({ ok: true, value: typeof value === "string" ? value : "" }),
}))

mock.module("@/lib/chat-attachment-deletion", () => ({
  sanitizeDeletedClientChatMessageForRead: (m: unknown) => m,
}))

mock.module("@/lib/log-safe-error", () => ({
  safeErrorForLog: (e: unknown) => e,
}))

mock.module("@/lib/realtime-publish", () => ({
  publishRealtimeEvent: (event: Record<string, unknown>) => {
    publishCalls.push(event)
    return publishImpl(event)
  },
}))

const { POST, GET } = await import("./route")

function buildRequest(body: Record<string, unknown> = { texto: "hola" }) {
  return new NextRequest("http://localhost/api/chat/mensajes/pedido-1", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: "deligo_session=fake-session-token",
    },
    body: JSON.stringify(body),
  })
}

function callRoute(pedidoId = "pedido-1", body?: Record<string, unknown>) {
  return POST(buildRequest(body), { params: Promise.resolve({ pedidoId }) })
}

function buildGetRequest(pedidoId = "pedido-1", query = "") {
  return new NextRequest(`http://localhost/api/chat/mensajes/${pedidoId}${query}`, {
    headers: { cookie: "deligo_session=fake-session-token" },
  })
}

function callGet(pedidoId = "pedido-1", query = "") {
  return GET(buildGetRequest(pedidoId, query), { params: Promise.resolve({ pedidoId }) })
}

beforeEach(() => {
  pedidoRecord = { ...DEFAULT_PEDIDO }
  sessionResult = { userId: "cliente-1", userType: "cliente" }
  createShouldThrow = null
  createCallCount = 0
  publishCalls = []
  publishImpl = async (event) => ({ status: "success", eventId: event.eventId, attempts: 1, httpStatus: 200 })
  pedidoUpdateCalls = []
  chatMensajesRecord = []
  findManyCallCount = 0
  markReadUpdateCount = 0
})

describe("POST /api/chat/mensajes/[pedidoId] — P2 server-authoritative publish", () => {
  test("A: successful POST persists the message and publishes chat.message.created exactly once with the exact envelope (all 11 payload fields)", async () => {
    const res = await callRoute()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.mensaje).toBeTruthy()
    expect(typeof body.telefonoFiltrado).toBe("boolean")
    expect(createCallCount).toBe(1)

    expect(publishCalls.length).toBe(1)
    const event = publishCalls[0] as {
      version: number
      type: string
      eventId: string
      resourceId: string
      occurredAt: string
      payload: Record<string, unknown>
    }
    expect(event.version).toBe(1)
    expect(event.type).toBe("chat.message.created")
    expect(event.eventId).toBe(body.mensaje.id)
    expect(event.resourceId).toBe("pedido-1")
    expect(event.occurredAt).toBe(body.mensaje.fecha)

    // Full 11-field payload contract, asserted by deep equality against the
    // exact persisted message the HTTP response itself returned — not a
    // subset. Guards against silently dropping/mismatching a field (e.g. an
    // attachment field) as the route or the payload contract evolves.
    expect(event.payload).toEqual({
      id: body.mensaje.id,
      pedidoId: body.mensaje.pedidoId,
      remitente: body.mensaje.remitente,
      texto: body.mensaje.texto,
      imagenUrl: body.mensaje.imagenUrl,
      archivoUrl: body.mensaje.archivoUrl,
      archivoNombre: body.mensaje.archivoNombre,
      archivoTipo: body.mensaje.archivoTipo,
      leido: body.mensaje.leido,
      fecha: body.mensaje.fecha,
      clienteId: body.mensaje.clienteId,
    })
    expect(Object.keys(event.payload).sort()).toEqual(
      ["id", "pedidoId", "remitente", "texto", "imagenUrl", "archivoUrl", "archivoNombre", "archivoTipo", "leido", "fecha", "clienteId"].sort()
    )
  })

  test("D: an attachment message (imagenUrl) round-trips through the publish payload untouched", async () => {
    const res = await callRoute("pedido-1", { imagenUrl: "https://res.cloudinary.test/chat/pedido-1/photo.jpg" })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.mensaje.imagenUrl).toBe("https://res.cloudinary.test/chat/pedido-1/photo.jpg")
    expect(body.mensaje.archivoUrl).toBeNull()
    expect(body.mensaje.texto).toBe("")

    expect(publishCalls.length).toBe(1)
    const event = publishCalls[0] as { payload: Record<string, unknown> }
    expect(event.payload.imagenUrl).toBe("https://res.cloudinary.test/chat/pedido-1/photo.jpg")
    expect(event.payload.archivoUrl).toBeNull()
    expect(event.payload.archivoNombre).toBeNull()
    expect(event.payload.archivoTipo).toBeNull()
  })

  test("B: a publish failure never turns an already-persisted message into an HTTP error", async () => {
    publishImpl = async (event) => ({ status: "failed", eventId: event.eventId, attempts: 2, httpStatus: 503 })

    const res = await callRoute()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.mensaje).toBeTruthy()
    expect(publishCalls.length).toBe(1)
  })

  test("B2: a disabled publish configuration also preserves HTTP success", async () => {
    publishImpl = async () => ({ status: "disabled", reason: "configuration_incomplete" })

    const res = await callRoute()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(publishCalls.length).toBe(1)
  })

  test("C: a DB create failure skips publish entirely and preserves the existing error response", async () => {
    createShouldThrow = new Error("simulated DB failure")

    const res = await callRoute()
    expect(res.status).toBe(500)
    expect(createCallCount).toBe(1)
    expect(publishCalls.length).toBe(0)
  })

  test("H (P2-T04): a successful POST bumps Pedido.chatRevision by exactly 1, in the same transaction as the create", async () => {
    const res = await callRoute()
    expect(res.status).toBe(200)
    expect(pedidoUpdateCalls).toHaveLength(1)
    expect(pedidoUpdateCalls[0]).toEqual({
      where: { id: "pedido-1" },
      data: { chatRevision: { increment: 1 } },
    })
  })

  test("I (P2-T04): create failure inside the transaction means the revision bump never runs — no standalone successful create path", async () => {
    createShouldThrow = new Error("simulated DB failure")
    const res = await callRoute()
    expect(res.status).toBe(500)
    expect(pedidoUpdateCalls).toHaveLength(0)
  })

  test("P2-T04: the realtime payload never carries a revision field", async () => {
    const res = await callRoute()
    await res.json()
    const event = publishCalls[0] as { payload: Record<string, unknown> }
    expect(Object.keys(event.payload)).not.toContain("chatRevision")
    expect(Object.keys(event.payload)).not.toContain("historyRevision")
  })

  test("ordering: the HTTP response does not resolve before the awaited publish call resolves", async () => {
    let resolvePublish: (value: unknown) => void = () => {}
    let signalEntered: () => void = () => {}
    const entered = new Promise<void>((resolve) => {
      signalEntered = resolve
    })
    const deferred = new Promise((resolve) => {
      resolvePublish = resolve
    })
    publishImpl = () => {
      // Signals the exact moment the route's awaited call reaches the
      // helper, so the test synchronizes on that real event instead of an
      // arbitrary wall-clock guess.
      signalEntered()
      return deferred as Promise<unknown>
    }

    let settled = false
    const responsePromise = callRoute().then((res) => {
      settled = true
      return res
    })

    await entered
    // One more microtask turn so a (buggy) fire-and-forget publish call
    // would have had a chance to let the response promise settle by now.
    await Promise.resolve()
    await Promise.resolve()
    expect(settled).toBe(false)
    expect(publishCalls.length).toBe(1)

    resolvePublish({ status: "success", eventId: (publishCalls[0] as { eventId: string }).eventId, attempts: 1, httpStatus: 200 })
    const res = await responsePromise
    expect(settled).toBe(true)
    expect(res.status).toBe(200)
  })
})

describe("GET /api/chat/mensajes/[pedidoId] — P2-T04 MODEL_R safety/semantic contract", () => {
  test("A: semantic (no mode param) returns the full shape (mensajes + pedido) plus historyRevision", async () => {
    chatMensajesRecord = [{ id: "m1", pedidoId: "pedido-1", remitente: "vendedor", texto: "hola", fecha: FIXED_DATE.toISOString(), leido: false, imagenUrl: null, archivoUrl: null, archivoNombre: null, archivoTipo: null, clienteId: null }]
    const res = await callGet()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.mensajes).toHaveLength(1)
    expect(body.pedido.id).toBe("pedido-1")
    expect(body.historyRevision).toBe(5)
    expect(body.unchanged).toBeUndefined()
  })

  test("B: safety with knownRevision equal to current -> unchanged:true, empty mensajes, zero history query, zero mark-read", async () => {
    chatMensajesRecord = [{ id: "m1", pedidoId: "pedido-1", remitente: "vendedor", texto: "hola", fecha: FIXED_DATE.toISOString(), leido: false, imagenUrl: null, archivoUrl: null, archivoNombre: null, archivoTipo: null, clienteId: null }]
    markReadUpdateCount = 3 // would bump revision if mark-read ran — must not run at all
    const res = await callGet("pedido-1", "?mode=safety&knownRevision=5")
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.unchanged).toBe(true)
    expect(body.mensajes).toEqual([])
    expect(body.historyRevision).toBe(5)
    expect(findManyCallCount).toBe(0)
    expect(pedidoUpdateCalls).toHaveLength(0)
  })

  test("C: safety with knownRevision lower than current -> full, unchanged:false, no mark-read", async () => {
    markReadUpdateCount = 2
    const res = await callGet("pedido-1", "?mode=safety&knownRevision=1")
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.unchanged).toBe(false)
    expect(body.historyRevision).toBe(5)
    expect(body.pedido).toBeDefined()
    expect(findManyCallCount).toBe(1)
    expect(pedidoUpdateCalls).toHaveLength(0) // safety never mark-reads, regardless of markReadUpdateCount
  })

  test("D: safety with missing/invalid/malformed knownRevision -> full fail-safe, no mark-read", async () => {
    for (const query of [
      "?mode=safety",
      "?mode=safety&knownRevision=",
      "?mode=safety&knownRevision=abc",
      "?mode=safety&knownRevision=-1",
      "?mode=safety&knownRevision=3.5",
      "?mode=safety&knownRevision=99999999999999999999",
    ]) {
      pedidoUpdateCalls = []
      findManyCallCount = 0
      const res = await callGet("pedido-1", query)
      const body = await res.json()
      expect(res.status).toBe(200)
      expect(body.unchanged).toBe(false)
      expect(findManyCallCount).toBe(1)
      expect(pedidoUpdateCalls).toHaveLength(0)
    }
  })

  test("E: knownRevision greater than current -> treated as mismatch, full, never unchanged:true", async () => {
    const res = await callGet("pedido-1", "?mode=safety&knownRevision=999")
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.unchanged).toBe(false)
  })

  test("F: semantic mark-read with count>0 bumps chatRevision exactly once", async () => {
    markReadUpdateCount = 2
    const res = await callGet("pedido-1", "")
    expect(res.status).toBe(200)
    expect(pedidoUpdateCalls).toHaveLength(1)
    expect(pedidoUpdateCalls[0]).toEqual({
      where: { id: "pedido-1" },
      data: { chatRevision: { increment: 1 } },
    })
  })

  test("G: semantic mark-read with count=0 (nothing was unread) never bumps chatRevision", async () => {
    markReadUpdateCount = 0
    const res = await callGet("pedido-1", "")
    expect(res.status).toBe(200)
    expect(pedidoUpdateCalls).toHaveLength(0)
  })

  test("J: cross-pedido auth stays fail-closed — a cliente without access to this pedido is rejected on both safety and semantic paths", async () => {
    pedidoRecord = { ...DEFAULT_PEDIDO, clienteId: "someone-else" }
    for (const query of ["", "?mode=safety&knownRevision=5"]) {
      const res = await callGet("pedido-1", query)
      expect(res.status).toBe(403)
      expect(findManyCallCount).toBe(0)
    }
  })

  test("K: the historyRevision used in a full response comes from the access-check read, not a later one — captured before the history SELECT even mutates it via this same request's own mark-read", async () => {
    // The access-check read reports chatRevision=5; this SAME request's own
    // mark-read (count>0) will bump it to 6 in the DB — but the response
    // must still report the PRE-bump value (understate-safe), proving the
    // capture point is the access read, not a re-read after mutation.
    markReadUpdateCount = 1
    const res = await callGet("pedido-1", "")
    const body = await res.json()
    expect(body.historyRevision).toBe(5)
    expect(pedidoUpdateCalls).toHaveLength(1) // the bump did happen server-side
  })

  test("safety-mode requests never touch chatMensaje.updateMany (mark-read) even when knownRevision matches exactly", async () => {
    markReadUpdateCount = 5
    await callGet("pedido-1", "?mode=safety&knownRevision=5")
    expect(pedidoUpdateCalls).toHaveLength(0)
  })

  test("safety mismatch full response never includes unread messages count changes (no mark-read bleed)", async () => {
    markReadUpdateCount = 5
    await callGet("pedido-1", "?mode=safety&knownRevision=0")
    expect(pedidoUpdateCalls).toHaveLength(0)
  })
})
