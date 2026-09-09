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
}

interface SwHarness {
  fireClick: (data: Record<string, unknown>, action?: string) => Promise<unknown>
  openWindowCalls: string[]
}

function loadServiceWorker(existingClients: FakeClient[] = []): SwHarness {
  const source = readFileSync(resolve(import.meta.dir, "..", "..", "public", "sw.js"), "utf8")
  const listeners = new Map<string, (event: unknown) => void>()
  const openWindowCalls: string[] = []

  const fakeClients = existingClients.map((c) => ({
    url: c.url,
    focus: () => {
      c.focusCalls += 1
      return Promise.resolve()
    },
    navigate: (url: string) => {
      c.navigateCalls.push(url)
      return Promise.resolve({
        url,
        focus: () => {
          c.focusCalls += 1
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

  const context = vm.createContext({
    self: selfObj,
    URL,
    URLSearchParams,
    console: { info: () => {}, error: () => {}, warn: () => {}, log: () => {} },
    caches: {
      open: async () => ({ keys: async () => [], addAll: async () => {}, delete: async () => {}, match: async () => undefined, put: async () => {} }),
    },
  })

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
    openWindowCalls,
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
