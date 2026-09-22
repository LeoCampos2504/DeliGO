/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import vm from "node:vm"

// P2-T39-R3: contrato permanente para el canal de Push de SuperAdmin en el
// Service Worker REAL (`public/sw.js`, nunca una reimplementación) — misma
// técnica exacta que sw-push-role-icon-routing.test.ts /
// sw-notificationclick-target-routing.test.ts. Cubre las dos mitades del
// contrato de R2/R3: (1) el evento `push` elige el ícono admin y copia
// `actorFamily` a `notification.data` sin dispatch por tipo; (2) el evento
// `notificationclick` navega SIEMPRE a un target fijo `/admin`, nunca por
// entidad, independientemente de cuál de los 5 tipos haya llegado.

interface FakeClient {
  url: string
  navigateCalls: string[]
  focusCalls: number
}

interface SwHarness {
  listeners: Map<string, (event: unknown) => void>
  showNotificationCalls: Array<{ title: string; options: Record<string, unknown> }>
  openWindowCalls: string[]
}

function loadServiceWorker(existingClients: FakeClient[] = []): SwHarness {
  const source = readFileSync(resolve(import.meta.dir, "..", "..", "public", "sw.js"), "utf8")
  const listeners = new Map<string, (event: unknown) => void>()
  const showNotificationCalls: Array<{ title: string; options: Record<string, unknown> }> = []
  const openWindowCalls: string[] = []

  const fakeClients = existingClients.map((c) => ({
    url: c.url,
    focus: () => {
      c.focusCalls += 1
      return Promise.resolve()
    },
    navigate: (url: string) => {
      c.navigateCalls.push(url)
      return Promise.resolve({ url, focus: () => { c.focusCalls += 1; return Promise.resolve() } })
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
    registration: {
      showNotification: (title: string, options: Record<string, unknown>) => {
        showNotificationCalls.push({ title, options })
        return Promise.resolve()
      },
    },
    crypto: globalThis.crypto,
    location: { origin: "https://example.test" },
  }
  selfObj.self = selfObj

  const contextGlobals: Record<string, unknown> = {
    self: selfObj,
    URL,
    URLSearchParams,
    Date,
    console: { info: () => {}, error: () => {}, warn: () => {}, log: () => {} },
    caches: {
      open: async () => ({ keys: async () => [], addAll: async () => {}, delete: async () => {}, match: async () => undefined, put: async () => {} }),
    },
  }

  const context = vm.createContext(contextGlobals)
  vm.runInContext(source, context, { filename: "sw.js" })

  return { listeners, showNotificationCalls, openWindowCalls }
}

function firePush(sw: SwHarness, payload: unknown) {
  const handler = sw.listeners.get("push")
  if (!handler) throw new Error("push listener was not registered")
  const waits: Array<Promise<unknown>> = []
  handler({ data: { json: () => payload }, waitUntil: (p: Promise<unknown>) => waits.push(p) })
  return Promise.all(waits)
}

function fireClick(sw: SwHarness, data: Record<string, unknown>) {
  const handler = sw.listeners.get("notificationclick")
  if (!handler) throw new Error("notificationclick listener was not registered")
  const waits: Array<Promise<unknown>> = []
  handler({ notification: { close: () => {}, data }, waitUntil: (p: Promise<unknown>) => waits.push(p) })
  return Promise.all(waits)
}

function lastShowNotificationCall(sw: SwHarness) {
  const call = sw.showNotificationCalls[sw.showNotificationCalls.length - 1]
  if (!call) throw new Error("showNotification was never called")
  return call
}

function superadminPushPayload(type: string, extra: Record<string, unknown> = {}) {
  return {
    title: "Nuevo negocio pendiente",
    body: "Test Negocio verificó su email y espera aprobación.",
    data: { type, actorFamily: "superadmin", url: "/admin", entityId: "negocio-1", navigateTo: "pendientes", ...extra },
  }
}

describe("P2-T39-R3 — Service Worker push: ícono admin y copia de actorFamily", () => {
  test("payload con actorFamily=superadmin usa el ícono admin, sin importar el tipo", () => {
    const sw = loadServiceWorker()
    firePush(sw, superadminPushPayload("negocio_pendiente"))
    const { options } = lastShowNotificationCall(sw)
    expect(options.icon).toBe("/icon-admin-192x192.png")
  })

  test("los 5 tipos de Notificacion.tipo dirigidos a SuperAdmin comparten el mismo ícono admin (nunca dispatch por tipo)", () => {
    const types = ["negocio_pendiente", "destacado_solicitud", "denuncia_nueva", "negocio_deuda", "review_moderation"]
    for (const type of types) {
      const sw = loadServiceWorker()
      firePush(sw, superadminPushPayload(type))
      expect(lastShowNotificationCall(sw).options.icon).toBe("/icon-admin-192x192.png")
    }
  })

  test("notification.data copia actorFamily -> notificationclick puede leerlo después", () => {
    const sw = loadServiceWorker()
    firePush(sw, superadminPushPayload("denuncia_nueva"))
    const { options } = lastShowNotificationCall(sw)
    expect((options.data as Record<string, unknown>).actorFamily).toBe("superadmin")
  })

  test("CONTROL — un payload sin actorFamily (negocio real) sigue resolviendo su propio ícono por role, sin regresión", () => {
    const sw = loadServiceWorker()
    firePush(sw, { title: "t", body: "b", data: { type: "order_update", role: "negocio" } })
    expect(lastShowNotificationCall(sw).options.icon).toBe("/icon-negocio-192x192.png")
  })
})

describe("P2-T39-R3 — Service Worker notificationclick: target fijo /admin para actorFamily=superadmin", () => {
  test("PWA /admin cerrada -> abre una ventana nueva en /admin", async () => {
    const sw = loadServiceWorker([])
    await fireClick(sw, { actorFamily: "superadmin", type: "negocio_pendiente", entityId: "negocio-1", navigateTo: "pendientes" })
    expect(sw.openWindowCalls).toEqual(["https://example.test/admin"])
  })

  test("una ventana /admin ya abierta -> navega y enfoca esa ventana, nunca abre una nueva", async () => {
    const client: FakeClient = { url: "https://example.test/admin", navigateCalls: [], focusCalls: 0 }
    const sw = loadServiceWorker([client])
    await fireClick(sw, { actorFamily: "superadmin", type: "denuncia_nueva" })
    expect(sw.openWindowCalls).toEqual([])
    expect(client.navigateCalls).toEqual(["https://example.test/admin"])
    expect(client.focusCalls).toBe(1)
  })

  test("una ventana /admin/dashboard (subruta) también cuenta como cliente Admin reutilizable", async () => {
    const client: FakeClient = { url: "https://example.test/admin/dashboard", navigateCalls: [], focusCalls: 0 }
    const sw = loadServiceWorker([client])
    await fireClick(sw, { actorFamily: "superadmin", type: "negocio_deuda" })
    expect(sw.openWindowCalls).toEqual([])
    expect(client.navigateCalls).toEqual(["https://example.test/admin"])
  })

  test("target siempre fijo /admin, sin importar entityId/navigateTo/tipo (EXACT_ENTITY_DEEP_LINK_REQUIRED=NO)", async () => {
    const sw = loadServiceWorker([])
    await fireClick(sw, {
      actorFamily: "superadmin",
      type: "review_moderation",
      entityId: "solicitud-abc",
      navigateTo: "moderacion-resenas",
      url: "https://evil.example/phishing",
    })
    expect(sw.openWindowCalls).toEqual(["https://example.test/admin"])
  })

  test("una ventana de Negocio abierta nunca se reutiliza para el target de SuperAdmin", async () => {
    const negocioClient: FakeClient = { url: "https://example.test/negocio", navigateCalls: [], focusCalls: 0 }
    const sw = loadServiceWorker([negocioClient])
    await fireClick(sw, { actorFamily: "superadmin", type: "negocio_pendiente" })
    expect(negocioClient.navigateCalls).toEqual([])
    expect(negocioClient.focusCalls).toBe(0)
    expect(sw.openWindowCalls).toEqual(["https://example.test/admin"])
  })

  test("CONTROL — un click sin actorFamily=superadmin (negocio+chat) sigue con su propio ruteo, sin regresión", async () => {
    const sw = loadServiceWorker([])
    await fireClick(sw, { type: "chat", role: "negocio", pedidoId: "pedido-abc" })
    expect(sw.openWindowCalls).toEqual(["https://example.test/negocio?chat=pedido-abc"])
  })
})
