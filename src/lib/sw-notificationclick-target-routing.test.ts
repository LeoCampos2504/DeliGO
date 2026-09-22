/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import vm from "node:vm"

// P2-T31-R23A: contrato permanente para `notificationclick`. R23 encontró
// que ningún test cubría este pipeline end-to-end (sólo `push` estaba
// cubierto, por sw-push-dedupe.test.ts y sw-push-role-icon-routing.test.ts)
// y usó una reproducción read-only para probar, con el `public/sw.js` REAL,
// que el target de `negocio+chat` es idéntico en calidad a los controles
// que ya funcionan físicamente (`cliente+order_update`,
// `repartidor+new_delivery`) — el bug de R23 vivía en el cliente
// (chat-provider.tsx), nunca en el Service Worker. Este archivo convierte
// esa reproducción en un contrato de regresión permanente.

interface FakeClient {
  url: string
  navigateCalls: string[]
  focusCalls: number
  // P2-T44-R1P6C: lets a test model the three real outcomes of
  // `WindowClient.navigate()` — a fresh resolved client (the common case),
  // `null`/`undefined` (allowed by the API, see §15 of the task), or a
  // rejection (the exact case the old code never handled). Defaults to the
  // pre-R1P6C behavior (resolves to a brand-new client object).
  navigateBehavior?: "resolve" | "resolve-null" | "reject"
  navigateError?: { name: string; message: string }
}

interface SwHarness {
  fireClick: (data: Record<string, unknown>, action?: string) => Promise<unknown>
  fireActivate: () => Promise<unknown>
  openWindowCalls: string[]
  // P2-T44-R1P6E: the vm context itself — every top-level `function` in
  // sw.js becomes a property of it. Used ONLY by the durable-trace edge-case
  // tests (TTL/max-records) to call `persistPendingTrace`/
  // `flushPendingSwTraces` directly, deterministically, without needing to
  // fabricate a full notificationclick event for every scenario.
  context: Record<string, (...args: unknown[]) => unknown>
}

// P2-T44-R1P6E: a minimal, faithful-enough fake IndexedDB — just enough of
// the real API surface that `public/sw.js`'s durable-trace helpers
// (openSwDebugDb/getAllPendingTraces/putPendingTrace/deletePendingTrace)
// exercise their REAL code against it, with no changes to that code for
// testability. Bun/Node have no built-in IndexedDB, and adding a new
// dependency for this is out of scope — so this lives entirely in the test
// file, never imported by product code.
interface FakeIDBRequest {
  result: unknown
  onsuccess: (() => void) | null
  onerror: (() => void) | null
}

function makeIdbRequest(result: unknown): FakeIDBRequest {
  const req: FakeIDBRequest = { result, onsuccess: null, onerror: null }
  queueMicrotask(() => req.onsuccess?.())
  return req
}

class FakeIDBObjectStore {
  data = new Map<string, Record<string, unknown>>()
  constructor(private keyPath: string) {}
  put(record: Record<string, unknown>): FakeIDBRequest {
    this.data.set(String(record[this.keyPath]), record)
    return makeIdbRequest(undefined)
  }
  get(id: string): FakeIDBRequest {
    return makeIdbRequest(this.data.get(id))
  }
  getAll(): FakeIDBRequest {
    return makeIdbRequest(Array.from(this.data.values()))
  }
  delete(id: string): FakeIDBRequest {
    this.data.delete(id)
    return makeIdbRequest(undefined)
  }
}

class FakeIDBTransaction {
  oncomplete: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor(private store: FakeIDBObjectStore) {
    queueMicrotask(() => this.oncomplete?.())
  }
  objectStore(_name: string): FakeIDBObjectStore {
    return this.store
  }
}

class FakeIDBDatabase {
  private names = new Set<string>()
  stores = new Map<string, FakeIDBObjectStore>()
  objectStoreNames = { contains: (name: string) => this.names.has(name) }
  createObjectStore(name: string, options: { keyPath: string }): FakeIDBObjectStore {
    const store = new FakeIDBObjectStore(options.keyPath)
    this.stores.set(name, store)
    this.names.add(name)
    return store
  }
  transaction(name: string, _mode: string): FakeIDBTransaction {
    const store = this.stores.get(name)
    if (!store) throw new Error(`FakeIndexedDB: no such object store "${name}"`)
    return new FakeIDBTransaction(store)
  }
}

interface FakeIndexedDB {
  databases: Map<string, FakeIDBDatabase>
  open: (name: string, version: number) => FakeIDBRequest & { onupgradeneeded: (() => void) | null }
}

// `failOpen: true` simulates IndexedDB being unusable (quota exceeded,
// disabled in a private tab, etc.) — every SW helper must degrade to a no-op
// rather than throw.
function makeFakeIndexedDB(opts: { failOpen?: boolean } = {}): FakeIndexedDB {
  const databases = new Map<string, FakeIDBDatabase>()
  return {
    databases,
    open(name: string) {
      const isNew = !databases.has(name)
      const db = databases.get(name) ?? new FakeIDBDatabase()
      if (isNew) databases.set(name, db)
      const req: FakeIDBRequest & { onupgradeneeded: (() => void) | null } = {
        result: db,
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
      }
      queueMicrotask(() => {
        if (opts.failOpen) {
          req.onerror?.()
          return
        }
        if (isNew) req.onupgradeneeded?.()
        req.onsuccess?.()
      })
      return req
    },
  }
}

// Reads the durable trace store directly — bypassing the network entirely —
// so a test can assert persistence/eviction/attemptCount without depending
// on any fetch mock.
function readPendingTraceRecords(idb: FakeIndexedDB): Array<Record<string, unknown>> {
  const db = idb.databases.get("deligo-sw-debug")
  const store = db?.stores.get("pending-traces")
  return store ? Array.from(store.data.values()) : []
}

// Inserts a record directly into the fake store, bypassing
// `persistPendingTrace` entirely — used to set up TTL/eviction scenarios
// deterministically (a record already "aged" past its TTL, or a batch of
// pre-existing records with known `createdAt` ordering) without depending
// on real wall-clock time or on the SW's own id generator.
function seedPendingTraceRecord(idb: FakeIndexedDB, record: Record<string, unknown>): void {
  let db = idb.databases.get("deligo-sw-debug")
  if (!db) {
    db = new FakeIDBDatabase()
    idb.databases.set("deligo-sw-debug", db)
  }
  let store = db.stores.get("pending-traces")
  if (!store) {
    store = db.createObjectStore("pending-traces", { keyPath: "id" })
  }
  store.data.set(String(record.id), record)
}

// P2-T44-R1P5B: `fetchImpl` is OPTIONAL and, by default, still omitted from
// the vm context exactly like before this task — every existing test below
// keeps exercising the real "no `fetch` global available" path (sendSwTrace
// no-ops safely, see public/sw.js). Only the NEW trace-specific tests pass
// one, to observe what the SW's diagnostic POSTs actually contain, or to
// prove a failing/hanging fetch never blocks real routing.
interface LoadServiceWorkerOptions {
  fetchImpl?: (url: string, init: { body?: string; signal?: AbortSignal }) => Promise<{ ok: boolean }>
  // P2-T44-R1P6C: shared, ordered log of every focus()/navigate() call
  // across every fake client, so a test can assert CALL ORDER (navigate
  // before focus), not just "both were called eventually" — see §16 of the
  // task, the exact gap that let the pre-fix code pass every test while
  // failing physically (focus() before an un-awaited navigate()).
  callSequence?: string[]
  // P2-T44-R1P6E: OPTIONAL, like `fetchImpl` — omitted, every existing test
  // below keeps exercising the exact "no IndexedDB available" path (durable
  // persistence no-ops, falls back to the old immediate-only send). Only
  // the new durable-trace tests pass one.
  indexedDBImpl?: FakeIndexedDB
}

function loadServiceWorker(existingClients: FakeClient[] = [], opts: LoadServiceWorkerOptions = {}): SwHarness {
  const source = readFileSync(resolve(import.meta.dir, "..", "..", "public", "sw.js"), "utf8")
  const listeners = new Map<string, (event: unknown) => void>()
  const openWindowCalls: string[] = []
  const sequence = opts.callSequence

  const fakeClients = existingClients.map((c) => ({
    url: c.url,
    focus: () => {
      c.focusCalls += 1
      sequence?.push(`focus:${c.url}`)
      return Promise.resolve()
    },
    navigate: (url: string) => {
      c.navigateCalls.push(url)
      sequence?.push(`navigate:${url}`)
      const behavior = c.navigateBehavior ?? "resolve"
      if (behavior === "reject") {
        const error = new Error(c.navigateError?.message ?? "simulated navigate failure")
        if (c.navigateError?.name) error.name = c.navigateError.name
        return Promise.reject(error)
      }
      if (behavior === "resolve-null") {
        return Promise.resolve(null)
      }
      return Promise.resolve({
        url,
        focus: () => {
          c.focusCalls += 1
          sequence?.push(`focus:${url}`)
          return Promise.resolve()
        },
      })
    },
  }))

  const selfObj: Record<string, unknown> = {
    addEventListener: (type: string, handler: (event: unknown) => void) => {
      listeners.set(type, handler)
    },
    skipWaiting: () => {},
    clients: {
      claim: async () => {},
      matchAll: async () => fakeClients,
      openWindow: (url: string) => {
        openWindowCalls.push(url)
        return Promise.resolve(null)
      },
    },
    registration: { showNotification: () => Promise.resolve() },
    crypto: globalThis.crypto,
    location: { origin: "https://example.test" },
  }
  selfObj.self = selfObj

  const contextGlobals: Record<string, unknown> = {
    self: selfObj,
    URL,
    URLSearchParams,
    console: { info: () => {}, error: () => {}, warn: () => {}, log: () => {} },
    caches: {
      open: async () => ({ keys: async () => [], addAll: async () => {}, delete: async () => {}, match: async () => undefined, put: async () => {} }),
      // Only exercised by `fireActivate()` below — the real activate handler
      // calls these directly (not through `.open()`).
      keys: async () => [],
      delete: async () => true,
    },
  }
  if (opts.fetchImpl) {
    contextGlobals.fetch = opts.fetchImpl
    contextGlobals.AbortController = AbortController
    contextGlobals.setTimeout = setTimeout
    contextGlobals.clearTimeout = clearTimeout
  }
  if (opts.indexedDBImpl) {
    contextGlobals.indexedDB = opts.indexedDBImpl
  }

  const context = vm.createContext(contextGlobals)

  vm.runInContext(source, context, { filename: "sw.js" })

  return {
    fireClick: (data, action) => {
      const handler = listeners.get("notificationclick")
      if (!handler) throw new Error("notificationclick listener was not registered")
      const waits: Array<Promise<unknown>> = []
      handler({
        notification: { close: () => {}, data },
        action,
        waitUntil: (p: Promise<unknown>) => waits.push(p),
      })
      return Promise.all(waits)
    },
    fireActivate: () => {
      const handler = listeners.get("activate")
      if (!handler) throw new Error("activate listener was not registered")
      const waits: Array<Promise<unknown>> = []
      handler({ waitUntil: (p: Promise<unknown>) => waits.push(p) })
      return Promise.all(waits)
    },
    openWindowCalls,
    context: context as unknown as Record<string, (...args: unknown[]) => unknown>,
  }
}

interface TraceCall {
  url: string
  body: Record<string, unknown>
}

// Records every POST body `sendSwTrace` sends, decoded from JSON — used to
// assert the diagnostic trace carries exactly the fields the routing logic
// already computed, without ever needing a real network/Railway TESTING.
function makeCapturingFetch(): { fetchImpl: LoadServiceWorkerOptions["fetchImpl"]; calls: TraceCall[] } {
  const calls: TraceCall[] = []
  const fetchImpl = async (url: string, init: { body?: string }) => {
    calls.push({ url, body: init?.body ? (JSON.parse(init.body) as Record<string, unknown>) : {} })
    return { ok: true }
  }
  return { fetchImpl, calls }
}

// Simulates a trace POST that always fails (covers both a real network
// failure AND the AbortController timeout path — both manifest identically
// to `sendSwTrace` as a rejected fetch promise).
function makeFailingFetch(): LoadServiceWorkerOptions["fetchImpl"] {
  return async () => {
    throw new Error("simulated trace network failure")
  }
}

describe("P2-T31-R23A — notificationclick target routing (public/sw.js real, contrato permanente)", () => {
  test("negocio + chat, PWA cerrada -> abre /negocio?chat=<pedidoId> en una ventana nueva", async () => {
    const sw = loadServiceWorker([])
    await sw.fireClick({ type: "chat", role: "negocio", pedidoId: "pedido-abc" })
    expect(sw.openWindowCalls).toEqual(["https://example.test/negocio?chat=pedido-abc"])
  })

  test("negocio + chat, PWA Negocio YA abierta en /negocio -> navega y enfoca esa ventana, sin abrir una nueva", async () => {
    const client: FakeClient = { url: "https://example.test/negocio", navigateCalls: [], focusCalls: 0 }
    const sw = loadServiceWorker([client])
    await sw.fireClick({ type: "chat", role: "negocio", pedidoId: "pedido-abc" })
    expect(sw.openWindowCalls).toEqual([])
    expect(client.navigateCalls).toEqual(["https://example.test/negocio?chat=pedido-abc"])
    expect(client.focusCalls).toBe(1)
  })

  test("cliente + chat, PWA cerrada -> abre /cliente/?chat=<pedidoId>", async () => {
    const sw = loadServiceWorker([])
    await sw.fireClick({ type: "chat", role: "cliente", pedidoId: "pedido-xyz" })
    expect(sw.openWindowCalls).toEqual(["https://example.test/cliente/?chat=pedido-xyz"])
  })

  test("CONTROL — cliente + order_update, PWA cerrada -> target ya certificado físicamente, sin cambios", async () => {
    const sw = loadServiceWorker([])
    await sw.fireClick({ type: "order_update", role: "cliente", pedidoId: "pedido-111" })
    expect(sw.openWindowCalls).toEqual([
      "https://example.test/cliente/?tab=pedidos&pedidoId=pedido-111&focusPedido=1",
    ])
  })

  test("CONTROL — repartidor + new_delivery, PWA cerrada -> target ya certificado físicamente, sin cambios", async () => {
    const sw = loadServiceWorker([])
    await sw.fireClick({ type: "new_delivery", role: "repartidor", pedidoId: "pedido-222" })
    expect(sw.openWindowCalls).toEqual([
      "https://example.test/repartidor?tab=entregas&pedidoId=pedido-222",
    ])
  })

  test("window matching es role-safe: una ventana de Cliente abierta nunca se reutiliza para un target de Negocio", async () => {
    const clienteClient: FakeClient = { url: "https://example.test/cliente/", navigateCalls: [], focusCalls: 0 }
    const sw = loadServiceWorker([clienteClient])
    await sw.fireClick({ type: "chat", role: "negocio", pedidoId: "pedido-abc" })
    expect(clienteClient.navigateCalls).toEqual([])
    expect(clienteClient.focusCalls).toBe(0)
    expect(sw.openWindowCalls).toEqual(["https://example.test/negocio?chat=pedido-abc"])
  })
})

describe("P2-T44-R1P2 (G3/G4/G5) — rama compartida de Operaciones generalizada, public/sw.js real", () => {
  test("operaciones_pyr_new_order con url segura -> navega ahí (PWA cerrada, ventana nueva)", async () => {
    const sw = loadServiceWorker([])
    await sw.fireClick({
      type: "operaciones_pyr_new_order",
      url: "/operaciones/mi-panel/mi-negocio/pyr/pedidos?pedidoId=pedido-1",
    })
    expect(sw.openWindowCalls).toEqual([
      "https://example.test/operaciones/mi-panel/mi-negocio/pyr/pedidos?pedidoId=pedido-1",
    ])
  })

  test("operaciones_pyr_new_review con url segura -> navega ahí", async () => {
    const sw = loadServiceWorker([])
    await sw.fireClick({
      type: "operaciones_pyr_new_review",
      url: "/operaciones/mi-panel/mi-negocio/pyr/resenas?resenaId=resena-1",
    })
    expect(sw.openWindowCalls).toEqual([
      "https://example.test/operaciones/mi-panel/mi-negocio/pyr/resenas?resenaId=resena-1",
    ])
  })

  test("operaciones_pyr_chat con url segura -> navega directo a la conversación exacta", async () => {
    const sw = loadServiceWorker([])
    await sw.fireClick({
      type: "operaciones_pyr_chat",
      url: "/operaciones/mi-panel/mi-negocio/pyr/pedidos/pedido-1/mensajes",
    })
    expect(sw.openWindowCalls).toEqual([
      "https://example.test/operaciones/mi-panel/mi-negocio/pyr/pedidos/pedido-1/mensajes",
    ])
  })

  test("url externa (https://evil.com) -> rechazada, cae al fallback fijo /operaciones/ingresar", async () => {
    const sw = loadServiceWorker([])
    await sw.fireClick({ type: "operaciones_pyr_new_order", url: "https://evil.com/steal" })
    expect(sw.openWindowCalls).toEqual(["https://example.test/operaciones/ingresar"])
  })

  test("url protocol-relative (//evil.com) -> rechazada, mismo fallback", async () => {
    const sw = loadServiceWorker([])
    await sw.fireClick({ type: "operaciones_pyr_chat", url: "//evil.com" })
    expect(sw.openWindowCalls).toEqual(["https://example.test/operaciones/ingresar"])
  })

  test("url sin el prefijo /operaciones/mi-panel/ -> rechazada aunque sea interna", async () => {
    const sw = loadServiceWorker([])
    await sw.fireClick({ type: "operaciones_pyr_new_order", url: "/cliente/pedidos" })
    expect(sw.openWindowCalls).toEqual(["https://example.test/operaciones/ingresar"])
  })

  test("focaliza una ventana /operaciones/mi-panel/ ya abierta en vez de abrir una nueva", async () => {
    const client: FakeClient = { url: "https://example.test/operaciones/mi-panel/mi-negocio/pyr/pedidos", navigateCalls: [], focusCalls: 0 }
    const sw = loadServiceWorker([client])
    await sw.fireClick({
      type: "operaciones_pyr_new_review",
      url: "/operaciones/mi-panel/mi-negocio/pyr/resenas?resenaId=resena-2",
    })
    expect(sw.openWindowCalls).toEqual([])
    expect(client.navigateCalls).toEqual(["https://example.test/operaciones/mi-panel/mi-negocio/pyr/resenas?resenaId=resena-2"])
    expect(client.focusCalls).toBe(1)
  })

  test("CONTROL — operaciones_salon_new_order y operaciones_order_cancelled no regresan tras generalizar la rama", async () => {
    const sw1 = loadServiceWorker([])
    await sw1.fireClick({ type: "operaciones_salon_new_order", url: "/operaciones/mi-panel/mi-negocio/salon?pedidoId=p1" })
    expect(sw1.openWindowCalls).toEqual(["https://example.test/operaciones/mi-panel/mi-negocio/salon?pedidoId=p1"])

    const sw2 = loadServiceWorker([])
    await sw2.fireClick({ type: "operaciones_order_cancelled", url: "/operaciones/mi-panel/mi-negocio/pyr?pedidoId=p2" })
    expect(sw2.openWindowCalls).toEqual(["https://example.test/operaciones/mi-panel/mi-negocio/pyr?pedidoId=p2"])
  })

  test("CONTROL — mesa_order_ready sigue con su rama propia (/mozo/panel/...), no absorbida por la rama de Operaciones", async () => {
    const sw = loadServiceWorker([])
    await sw.fireClick({
      type: "mesa_order_ready",
      url: "/mozo/panel/mi-negocio?pedidoId=p3",
    })
    expect(sw.openWindowCalls).toEqual(["/mozo/panel/mi-negocio?pedidoId=p3"])
  })
})

describe("P2-T44-R1P5B — traza de diagnóstico del click de Operaciones (observa, nunca altera el ruteo)", () => {
  test("url segura -> mismo target EXACTO que sin instrumentación, con fetch capturando la traza", async () => {
    const { fetchImpl, calls } = makeCapturingFetch()
    const sw = loadServiceWorker([], { fetchImpl })
    await sw.fireClick({
      type: "operaciones_pyr_new_order",
      pedidoId: "pedido-1",
      url: "/operaciones/mi-panel/mi-negocio/pyr/pedidos?pedidoId=pedido-1",
    })
    expect(sw.openWindowCalls).toEqual(["https://example.test/operaciones/mi-panel/mi-negocio/pyr/pedidos?pedidoId=pedido-1"])

    const decision = calls.find((c) => c.body.event === "notificationclick_decision")
    expect(decision).toBeDefined()
    expect(decision!.url).toBe("/api/push/debug-sw-trace")
    expect(decision!.body.traceVersion).toBe("P2_T44_R1P6E_SW_TRACE_V2")
    expect(decision!.body.type).toBe("operaciones_pyr_new_order")
    expect(decision!.body.pedidoId).toBe("pedido-1")
    expect(decision!.body.rawUrl).toBe("/operaciones/mi-panel/mi-negocio/pyr/pedidos?pedidoId=pedido-1")
    expect(decision!.body.safeInternalUrl).toBe(true)
    expect(decision!.body.operationsPanelPrefixMatch).toBe(true)
    expect(decision!.body.containsPyrOrSalon).toBe(true)
    expect(decision!.body.selectedTargetUrl).toBe("/operaciones/mi-panel/mi-negocio/pyr/pedidos?pedidoId=pedido-1")
    expect(decision!.body.usedFallback).toBe(false)
    expect(decision!.body.fallbackReason).toBeNull()

    const routing = calls.find((c) => c.body.event === "notificationclick_routing_result")
    expect(routing!.body.routingAction).toBe("NO_MATCH_OPEN_WINDOW")
    expect(routing!.body.openWindowTarget).toBe("https://example.test/operaciones/mi-panel/mi-negocio/pyr/pedidos?pedidoId=pedido-1")
  })

  test("url externa -> mismo fallback EXACTO que sin instrumentación, traza reporta usedFallback=true con el motivo correcto", async () => {
    const { fetchImpl, calls } = makeCapturingFetch()
    const sw = loadServiceWorker([], { fetchImpl })
    await sw.fireClick({ type: "operaciones_pyr_new_order", url: "https://evil.com/steal" })
    expect(sw.openWindowCalls).toEqual(["https://example.test/operaciones/ingresar"])

    const decision = calls.find((c) => c.body.event === "notificationclick_decision")
    expect(decision!.body.usedFallback).toBe(true)
    expect(decision!.body.fallbackReason).toBe("NOT_SAFE_INTERNAL_URL")
    expect(decision!.body.selectedTargetUrl).toBe("/operaciones/ingresar")
  })

  test("url interna sin el prefijo de Operaciones -> traza reporta MISSING_OPERATIONS_PREFIX", async () => {
    const { fetchImpl, calls } = makeCapturingFetch()
    const sw = loadServiceWorker([], { fetchImpl })
    await sw.fireClick({ type: "operaciones_pyr_new_order", url: "/cliente/pedidos" })
    const decision = calls.find((c) => c.body.event === "notificationclick_decision")
    expect(decision!.body.usedFallback).toBe(true)
    expect(decision!.body.fallbackReason).toBe("MISSING_OPERATIONS_PREFIX")
  })

  test("client existente en /operaciones/mi-panel/ -> traza de cliente reporta matchesOperationsPanel=true y routingAction=NAVIGATE_FOCUS_OPERATIONS_CLIENT", async () => {
    const client: FakeClient = { url: "https://example.test/operaciones/mi-panel/mi-negocio/pyr/pedidos", navigateCalls: [], focusCalls: 0 }
    const { fetchImpl, calls } = makeCapturingFetch()
    const sw = loadServiceWorker([client], { fetchImpl })
    await sw.fireClick({
      type: "operaciones_pyr_new_review",
      url: "/operaciones/mi-panel/mi-negocio/pyr/resenas?resenaId=resena-2",
    })
    expect(sw.openWindowCalls).toEqual([])
    expect(client.navigateCalls).toEqual(["https://example.test/operaciones/mi-panel/mi-negocio/pyr/resenas?resenaId=resena-2"])

    const clientTrace = calls.find((c) => c.body.event === "notificationclick_client")
    expect(clientTrace!.body.clientIndex).toBe(0)
    expect(clientTrace!.body.clientCount).toBe(1)
    expect(clientTrace!.body.matchesOperationsPanel).toBe(true)
    expect(clientTrace!.body.canFocus).toBe(true)
    expect(clientTrace!.body.canNavigate).toBe(true)

    const routing = calls.find((c) => c.body.event === "notificationclick_routing_result")
    expect(routing!.body.routingAction).toBe("NAVIGATE_FOCUS_OPERATIONS_CLIENT")
    expect(routing!.body.navigateTarget).toBe("https://example.test/operaciones/mi-panel/mi-negocio/pyr/resenas?resenaId=resena-2")
    expect(routing!.body.navigateResult).toBe("RESOLVED_CLIENT")
  })

  test("el fetch de traza fallando NUNCA rompe el ruteo real (mismo target, mismo comportamiento)", async () => {
    const sw = loadServiceWorker([], { fetchImpl: makeFailingFetch() })
    await sw.fireClick({
      type: "operaciones_pyr_new_order",
      url: "/operaciones/mi-panel/mi-negocio/pyr/pedidos?pedidoId=pedido-9",
    })
    expect(sw.openWindowCalls).toEqual(["https://example.test/operaciones/mi-panel/mi-negocio/pyr/pedidos?pedidoId=pedido-9"])
  })

  test("el fetch de traza fallando NUNCA rompe el foco/navigate de un client existente", async () => {
    const client: FakeClient = { url: "https://example.test/operaciones/mi-panel/mi-negocio/pyr/pedidos", navigateCalls: [], focusCalls: 0 }
    const sw = loadServiceWorker([client], { fetchImpl: makeFailingFetch() })
    await sw.fireClick({
      type: "operaciones_pyr_chat",
      url: "/operaciones/mi-panel/mi-negocio/pyr/pedidos/pedido-9/mensajes",
    })
    expect(client.navigateCalls).toEqual(["https://example.test/operaciones/mi-panel/mi-negocio/pyr/pedidos/pedido-9/mensajes"])
    expect(client.focusCalls).toBe(1)
    expect(sw.openWindowCalls).toEqual([])
  })

  test("sin fetch global disponible (entorno sin push-debug ingest) -> el ruteo funciona idéntico, sin throw", async () => {
    const sw = loadServiceWorker([])
    await expect(
      sw.fireClick({ type: "operaciones_pyr_new_order", url: "/operaciones/mi-panel/mi-negocio/pyr/pedidos?pedidoId=pedido-1" })
    ).resolves.toBeDefined()
    expect(sw.openWindowCalls).toEqual(["https://example.test/operaciones/mi-panel/mi-negocio/pyr/pedidos?pedidoId=pedido-1"])
  })

  test("CONTROL — Salón y cancelación no regresan con la traza activa", async () => {
    const { fetchImpl } = makeCapturingFetch()
    const sw1 = loadServiceWorker([], { fetchImpl })
    await sw1.fireClick({ type: "operaciones_salon_new_order", url: "/operaciones/mi-panel/mi-negocio/salon?pedidoId=p1" })
    expect(sw1.openWindowCalls).toEqual(["https://example.test/operaciones/mi-panel/mi-negocio/salon?pedidoId=p1"])

    const sw2 = loadServiceWorker([], { fetchImpl })
    await sw2.fireClick({ type: "operaciones_order_cancelled", url: "/operaciones/mi-panel/mi-negocio/pyr?pedidoId=p2" })
    expect(sw2.openWindowCalls).toEqual(["https://example.test/operaciones/mi-panel/mi-negocio/pyr?pedidoId=p2"])
  })

  test("CONTROL — Mozo (mesa_order_ready) no regresa ni genera traza de Operaciones", async () => {
    const { fetchImpl, calls } = makeCapturingFetch()
    const sw = loadServiceWorker([], { fetchImpl })
    await sw.fireClick({ type: "mesa_order_ready", url: "/mozo/panel/mi-negocio?pedidoId=p3" })
    expect(sw.openWindowCalls).toEqual(["/mozo/panel/mi-negocio?pedidoId=p3"])
    expect(calls).toEqual([])
  })

  test("CONTROL — notificaciones personales (Cliente/Negocio/Repartidor) no generan traza de Operaciones", async () => {
    const { fetchImpl, calls } = makeCapturingFetch()
    const sw = loadServiceWorker([], { fetchImpl })
    await sw.fireClick({ type: "chat", role: "negocio", pedidoId: "pedido-abc" })
    expect(sw.openWindowCalls).toEqual(["https://example.test/negocio?chat=pedido-abc"])
    expect(calls).toEqual([])
  })
})

// P2-T44-R1P6C: fix del bug de ruteo confirmado físicamente en
// P2_T44_R1P6B_EXISTING_CLIENT_VS_CLOSED_APP_AUDIT.md — con la PWA de
// Operaciones ya abierta en el Home bare (`/operaciones/mi-panel`, sin
// slash final), el viejo segundo loop sin filtro la capturaba y le
// pasaba `client.navigate(targetUrl)` sin `await`/verificación/`catch`,
// dejando al usuario silenciosamente en Home. Este bloque reproduce
// EXACTAMENTE esa condición física (antes imposible de expresar con el
// harness — el único test de "client existente" previo usaba un pathname
// YA con slug completo, que matcheaba el loop estricto viejo).
describe("P2-T44-R1P6C — ruteo seguro por client existente (Home bare, nested, foreign, navigate reject/null, orden)", () => {
  test("HOME BARE real (/operaciones/mi-panel, sin slash final) -> se considera Operations client válido, navigate(targetUrl) se llama UNA vez, sin openWindow", async () => {
    const home: FakeClient = { url: "https://example.test/operaciones/mi-panel", navigateCalls: [], focusCalls: 0 }
    const sequence: string[] = []
    const sw = loadServiceWorker([home], { callSequence: sequence })
    const targetUrl = "/operaciones/mi-panel/test_t44_r1d_negocio_b_4135ea7a/pyr/pedidos?pedidoId=test-order"
    await sw.fireClick({ type: "operaciones_pyr_new_order", url: targetUrl })

    expect(home.navigateCalls).toEqual([`https://example.test${targetUrl}`])
    expect(home.focusCalls).toBe(1)
    expect(sw.openWindowCalls).toEqual([])
    // navigate ANTES que focus — nunca al revés.
    expect(sequence).toEqual([`navigate:https://example.test${targetUrl}`, `focus:https://example.test${targetUrl}`])
  })

  test("NESTED operations client (otro negocio/pantalla) -> navega al target exacto, focus después, sin openWindow", async () => {
    const other: FakeClient = { url: "https://example.test/operaciones/mi-panel/otro-negocio/pyr/pedidos", navigateCalls: [], focusCalls: 0 }
    const sequence: string[] = []
    const sw = loadServiceWorker([other], { callSequence: sequence })
    const targetUrl = "/operaciones/mi-panel/mi-negocio/pyr/pedidos?pedidoId=pedido-x"
    await sw.fireClick({ type: "operaciones_pyr_new_order", url: targetUrl })

    expect(other.navigateCalls).toEqual([`https://example.test${targetUrl}`])
    expect(sw.openWindowCalls).toEqual([])
    expect(sequence).toEqual([`navigate:https://example.test${targetUrl}`, `focus:https://example.test${targetUrl}`])
  })

  test("CLIENT AJENO (Cliente/Negocio/Repartidor/Mozo abiertos, ninguno de Operaciones) -> ninguno se reutiliza, openWindow exactamente una vez", async () => {
    const clienteClient: FakeClient = { url: "https://example.test/cliente/", navigateCalls: [], focusCalls: 0 }
    const negocioClient: FakeClient = { url: "https://example.test/negocio", navigateCalls: [], focusCalls: 0 }
    const repartidorClient: FakeClient = { url: "https://example.test/repartidor", navigateCalls: [], focusCalls: 0 }
    const mozoClient: FakeClient = { url: "https://example.test/mozo/panel/mi-negocio", navigateCalls: [], focusCalls: 0 }
    const sw = loadServiceWorker([clienteClient, negocioClient, repartidorClient, mozoClient])
    const targetUrl = "/operaciones/mi-panel/mi-negocio/pyr/pedidos?pedidoId=pedido-1"
    await sw.fireClick({ type: "operaciones_pyr_new_order", url: targetUrl })

    expect(clienteClient.navigateCalls).toEqual([])
    expect(negocioClient.navigateCalls).toEqual([])
    expect(repartidorClient.navigateCalls).toEqual([])
    expect(mozoClient.navigateCalls).toEqual([])
    expect(clienteClient.focusCalls).toBe(0)
    expect(negocioClient.focusCalls).toBe(0)
    expect(repartidorClient.focusCalls).toBe(0)
    expect(mozoClient.focusCalls).toBe(0)
    expect(sw.openWindowCalls).toEqual([`https://example.test${targetUrl}`])
  })

  test("navigate() RECHAZA sobre el Home existente -> cae a openWindow(targetUrl), sin excepción no manejada", async () => {
    const home: FakeClient = {
      url: "https://example.test/operaciones/mi-panel",
      navigateCalls: [],
      focusCalls: 0,
      navigateBehavior: "reject",
      navigateError: { name: "InvalidStateError", message: "simulated" },
    }
    const sw = loadServiceWorker([home])
    const targetUrl = "/operaciones/mi-panel/mi-negocio/pyr/pedidos?pedidoId=pedido-2"
    // No debe haber ninguna excepción/rechazo no manejado saliendo de fireClick.
    await expect(sw.fireClick({ type: "operaciones_pyr_new_order", url: targetUrl })).resolves.toBeDefined()

    expect(home.navigateCalls).toEqual([`https://example.test${targetUrl}`])
    expect(sw.openWindowCalls).toEqual([`https://example.test${targetUrl}`])
  })

  test("navigate() resuelve null/undefined -> focus() se llama sobre el client ORIGINAL, sin abrir una ventana extra", async () => {
    const home: FakeClient = {
      url: "https://example.test/operaciones/mi-panel",
      navigateCalls: [],
      focusCalls: 0,
      navigateBehavior: "resolve-null",
    }
    const sw = loadServiceWorker([home])
    const targetUrl = "/operaciones/mi-panel/mi-negocio/pyr/pedidos?pedidoId=pedido-3"
    await sw.fireClick({ type: "operaciones_pyr_new_order", url: targetUrl })

    expect(home.navigateCalls).toEqual([`https://example.test${targetUrl}`])
    expect(home.focusCalls).toBe(1)
    expect(sw.openWindowCalls).toEqual([])
  })

  test("REGRESIÓN — app cerrada (sin ningún client) sigue usando openWindow(targetUrl), sin cambios", async () => {
    const sw = loadServiceWorker([])
    const targetUrl = "/operaciones/mi-panel/mi-negocio/pyr/pedidos?pedidoId=pedido-4"
    await sw.fireClick({ type: "operaciones_pyr_new_order", url: targetUrl })
    expect(sw.openWindowCalls).toEqual([`https://example.test${targetUrl}`])
  })

  test("REGRESIÓN — los 5 tipos del branch compartido usan el nuevo patrón robusto contra el mismo Home bare", async () => {
    const types = [
      "operaciones_salon_new_order",
      "operaciones_order_cancelled",
      "operaciones_pyr_new_order",
      "operaciones_pyr_new_review",
      "operaciones_pyr_chat",
    ]
    for (const type of types) {
      const home: FakeClient = { url: "https://example.test/operaciones/mi-panel", navigateCalls: [], focusCalls: 0 }
      const sequence: string[] = []
      const sw = loadServiceWorker([home], { callSequence: sequence })
      const targetUrl = `/operaciones/mi-panel/mi-negocio/pyr/pedidos?pedidoId=pedido-${type}`
      await sw.fireClick({ type, url: targetUrl })
      expect(home.navigateCalls).toEqual([`https://example.test${targetUrl}`])
      expect(sw.openWindowCalls).toEqual([])
      expect(sequence).toEqual([`navigate:https://example.test${targetUrl}`, `focus:https://example.test${targetUrl}`])
    }
  })
})

// P2-T44-R1P6E: R1P6A and R1P6D both showed push_received/show_notification
// arriving reliably while notificationclick_decision/_client/_routing_result
// silently vanished, twice, even after R1P6C's routing fix was live and
// tested. This durable trace exists to close exactly that gap — these tests
// prove it persists BEFORE any network attempt, recovers on a later flush,
// keeps growing bounded (TTL + max records), and — critically — never
// changes routing behavior even when both IndexedDB and the network fail
// simultaneously.
describe("P2-T44-R1P6E — traza durable de notificationclick vía IndexedDB", () => {
  test("push_received/show_notification/notificationclick_* usan la nueva traceVersion/routingVersion", async () => {
    const { fetchImpl, calls } = makeCapturingFetch()
    const sw = loadServiceWorker([], { fetchImpl })
    const targetUrl = "/operaciones/mi-panel/mi-negocio/pyr/pedidos?pedidoId=pedido-version"
    await sw.fireClick({ type: "operaciones_pyr_new_order", url: targetUrl })
    expect(calls.length).toBeGreaterThan(0)
    for (const call of calls) {
      expect(call.body.traceVersion).toBe("P2_T44_R1P6E_SW_TRACE_V2")
      expect(call.body.routingVersion).toBe("P2_T44_R1P6I_ABSOLUTE_OPERATIONS_TARGET")
    }
    const events = calls.map((c) => c.body.event)
    expect(events).toContain("notificationclick_decision")
    expect(events).toContain("notificationclick_routing_result")
  })

  test("DURABLE_PERSIST_NETWORK_FAIL — notificationclick persiste en IndexedDB aunque el fetch de traza rechace, y el ruteo real no se ve afectado", async () => {
    const idb = makeFakeIndexedDB()
    const home: FakeClient = { url: "https://example.test/operaciones/mi-panel", navigateCalls: [], focusCalls: 0 }
    const sw = loadServiceWorker([home], { fetchImpl: makeFailingFetch(), indexedDBImpl: idb })
    const targetUrl = "/operaciones/mi-panel/mi-negocio/pyr/pedidos?pedidoId=pedido-durable-1"
    await sw.fireClick({ type: "operaciones_pyr_new_order", url: targetUrl })

    // Ruteo real: idéntico a como se comporta sin ninguna traza durable.
    expect(home.navigateCalls).toEqual([`https://example.test${targetUrl}`])
    expect(home.focusCalls).toBe(1)
    expect(sw.openWindowCalls).toEqual([])

    // Pero además, la evidencia sobrevivió LOCALMENTE pese a que el POST
    // rechazó todas las veces.
    const records = readPendingTraceRecords(idb)
    const events = records.map((r) => (r.fields as Record<string, unknown>).event)
    expect(events).toContain("notificationclick_decision")
    expect(events).toContain("notificationclick_routing_result")
    for (const r of records) {
      expect(r.attemptCount).toBe(1)
      expect(r.traceVersion).toBe("P2_T44_R1P6E_SW_TRACE_V2")
      expect(r.routingVersion).toBe("P2_T44_R1P6I_ABSOLUTE_OPERATIONS_TARGET")
    }
  })

  test("DURABLE_FLUSH_SUCCESS — un registro pendiente de un click anterior se envía y se borra en el próximo flush exitoso", async () => {
    const idb = makeFakeIndexedDB()
    // "Click anterior": la red falla, el registro queda pendiente.
    const home1: FakeClient = { url: "https://example.test/operaciones/mi-panel", navigateCalls: [], focusCalls: 0 }
    const sw1 = loadServiceWorker([home1], { fetchImpl: makeFailingFetch(), indexedDBImpl: idb })
    await sw1.fireClick({
      type: "operaciones_pyr_new_order",
      url: "/operaciones/mi-panel/mi-negocio/pyr/pedidos?pedidoId=pedido-durable-2",
    })
    expect(readPendingTraceRecords(idb).length).toBeGreaterThan(0)

    // "El SW despierta de nuevo" — misma IndexedDB, ahora con red disponible.
    const { fetchImpl: okFetch, calls } = makeCapturingFetch()
    const sw2 = loadServiceWorker([], { fetchImpl: okFetch, indexedDBImpl: idb })
    await sw2.context.flushPendingSwTraces()

    expect(readPendingTraceRecords(idb)).toEqual([])
    expect(calls.length).toBeGreaterThan(0)
    expect(calls.every((c) => typeof c.body.traceRecordId === "string")).toBe(true)
  })

  test("DURABLE_FLUSH_FAIL — si el flush vuelve a fallar, el registro NO se borra y attemptCount se incrementa", async () => {
    const idb = makeFakeIndexedDB()
    seedPendingTraceRecord(idb, {
      id: "seed-flush-fail",
      traceVersion: "P2_T44_R1P6E_SW_TRACE_V2",
      routingVersion: "P2_T44_R1P6I_ABSOLUTE_OPERATIONS_TARGET",
      createdAt: Date.now(),
      expiresAt: Date.now() + 60_000,
      attemptCount: 1,
      fields: { event: "notificationclick_decision", type: "operaciones_pyr_new_order" },
    })

    const sw = loadServiceWorker([], { fetchImpl: makeFailingFetch(), indexedDBImpl: idb })
    await sw.context.flushPendingSwTraces()

    const records = readPendingTraceRecords(idb)
    expect(records.length).toBe(1)
    expect(records[0]!.id).toBe("seed-flush-fail")
    expect(records[0]!.attemptCount).toBe(2)
  })

  test("TTL — un registro vencido se descarta sin intentar enviarlo", async () => {
    const idb = makeFakeIndexedDB()
    seedPendingTraceRecord(idb, {
      id: "seed-expired",
      traceVersion: "P2_T44_R1P6E_SW_TRACE_V2",
      routingVersion: "P2_T44_R1P6I_ABSOLUTE_OPERATIONS_TARGET",
      createdAt: Date.now() - 25 * 60 * 60 * 1000,
      expiresAt: Date.now() - 1000, // ya vencido
      attemptCount: 0,
      fields: { event: "notificationclick_decision", type: "operaciones_pyr_new_order" },
    })

    const { fetchImpl, calls } = makeCapturingFetch()
    const sw = loadServiceWorker([], { fetchImpl, indexedDBImpl: idb })
    await sw.context.flushPendingSwTraces()

    expect(readPendingTraceRecords(idb)).toEqual([])
    // Nunca se intentó enviarlo por red — se descartó directo por TTL.
    expect(calls.some((c) => c.body.traceRecordId === "seed-expired")).toBe(false)
  })

  test("MAX RECORDS — al superar el tope se elimina primero el más viejo, nunca el recién creado", async () => {
    const idb = makeFakeIndexedDB()
    const MAX_RECORDS = 50
    for (let i = 0; i < MAX_RECORDS; i++) {
      seedPendingTraceRecord(idb, {
        id: `seed-${i}`,
        traceVersion: "P2_T44_R1P6E_SW_TRACE_V2",
        routingVersion: "P2_T44_R1P6I_ABSOLUTE_OPERATIONS_TARGET",
        createdAt: i, // seed-0 es el más viejo, seed-49 el más nuevo
        expiresAt: Date.now() + 60_000,
        attemptCount: 0,
        fields: { event: "notificationclick_decision", type: "operaciones_pyr_new_order" },
      })
    }
    expect(readPendingTraceRecords(idb).length).toBe(MAX_RECORDS)

    const sw = loadServiceWorker([], { indexedDBImpl: idb })
    await sw.context.persistPendingTrace({ event: "notificationclick_decision", type: "operaciones_pyr_new_order" })

    const records = readPendingTraceRecords(idb)
    const ids = records.map((r) => r.id)
    expect(records.length).toBe(MAX_RECORDS) // acotado, nunca crece sin límite
    expect(ids).not.toContain("seed-0") // el más viejo, eliminado
    expect(ids).toContain("seed-49") // el más nuevo de los sembrados, conservado
    expect(ids.filter((id) => !String(id).startsWith("seed-")).length).toBe(1) // el recién creado, conservado
  })

  test("TRACE_FAILURE_ROUTING_REGRESSION — IndexedDB Y la red fallan a la vez, el ruteo real sigue idéntico", async () => {
    const home: FakeClient = { url: "https://example.test/operaciones/mi-panel", navigateCalls: [], focusCalls: 0 }
    const sequence: string[] = []
    const brokenIdb = makeFakeIndexedDB({ failOpen: true })
    const sw = loadServiceWorker([home], {
      fetchImpl: makeFailingFetch(),
      indexedDBImpl: brokenIdb,
      callSequence: sequence,
    })
    const targetUrl = "/operaciones/mi-panel/mi-negocio/pyr/pedidos?pedidoId=pedido-durable-3"
    await expect(sw.fireClick({ type: "operaciones_pyr_new_order", url: targetUrl })).resolves.toBeDefined()

    expect(home.navigateCalls).toEqual([`https://example.test${targetUrl}`])
    expect(home.focusCalls).toBe(1)
    expect(sw.openWindowCalls).toEqual([])
    expect(sequence).toEqual([`navigate:https://example.test${targetUrl}`, `focus:https://example.test${targetUrl}`])
  })

  test("activate también reintenta trazas pendientes (uno de los 3 puntos de despertar mínimos)", async () => {
    const idb = makeFakeIndexedDB()
    seedPendingTraceRecord(idb, {
      id: "seed-on-activate",
      traceVersion: "P2_T44_R1P6E_SW_TRACE_V2",
      routingVersion: "P2_T44_R1P6I_ABSOLUTE_OPERATIONS_TARGET",
      createdAt: Date.now(),
      expiresAt: Date.now() + 60_000,
      attemptCount: 0,
      fields: { event: "notificationclick_routing_result", type: "operaciones_pyr_new_order" },
    })
    const { fetchImpl, calls } = makeCapturingFetch()
    const sw = loadServiceWorker([], { fetchImpl, indexedDBImpl: idb })
    await sw.fireActivate()
    expect(readPendingTraceRecords(idb)).toEqual([])
    expect(calls.some((c) => c.body.traceRecordId === "seed-on-activate")).toBe(true)
  })
})
