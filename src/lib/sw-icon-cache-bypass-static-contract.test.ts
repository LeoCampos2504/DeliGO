/// <reference types="bun-types" />

// ============================================
// P2-T36 — F-P2-T36-02: SW icon/badge cache-bypass substring fix
// ============================================
// public/sw.js documentaba (comentario DELIGO-BRANDING-R1) que la regla
// "never cache manifest files or PWA icons" nunca funcionó para íconos: el
// chequeo `request.url.includes("icon-192")`/`includes("icon-512")` jamás
// matchea nombres reales (`icon-cliente-192x192.png` contiene
// "cliente-192x192" justo después de "icon-", nunca el substring literal
// "icon-192") — los PNG de ícono/badge caían silenciosamente en la rama
// cache-first de assets estáticos, pudiendo quedar servidos stale
// indefinidamente sin depender de CACHE_NAME. Este archivo prueba, contra
// el `public/sw.js` REAL cargado en un sandbox VM (misma técnica que
// sw-push-dedupe.test.ts / sw-push-role-icon-routing.test.ts — nunca una
// reimplementación), que el fix (`isPwaBrandingAsset`, basado en
// `URL.pathname` en vez de un substring accidental) realmente bypassea el
// cache-first para TODOS los nombres reales de ícono/badge/maskable, y que
// el bug original habría fallado exactamente este mismo test.

import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import vm from "node:vm"

interface SwHarness {
  fetchListener: ((event: unknown) => void) | undefined
  fetchedFromNetwork: string[]
  servedFromCache: string[]
}

function loadServiceWorker(): SwHarness {
  const source = readFileSync(resolve(import.meta.dir, "..", "..", "public", "sw.js"), "utf8")

  const fetchedFromNetwork: string[] = []
  const servedFromCache: string[] = []
  let fetchListener: ((event: unknown) => void) | undefined

  const selfObj: Record<string, unknown> = {
    addEventListener: (type: string, handler: (event: unknown) => void) => {
      if (type === "fetch") fetchListener = handler
    },
    skipWaiting: () => {},
    clients: { claim: async () => {}, matchAll: async () => [] },
  }
  selfObj.self = selfObj

  // Every cache lookup "hits" — a real stale cached icon from before the
  // fix. If the fetch handler routes through cache-first for an icon URL,
  // this cached (stale) response gets served without ever touching
  // `fakeFetch` below — exactly the bug this test must catch.
  const context = vm.createContext({
    self: selfObj,
    Date,
    console,
    URL,
    Response,
    fetch: undefined, // set below, referenced as a free variable by sw.js
    caches: {
      open: async () => ({
        keys: async () => [],
        addAll: async () => {},
        delete: async () => {},
        match: async (request: { url: string }) => {
          servedFromCache.push(request.url)
          return new Response("stale-cached-bytes", { status: 200 })
        },
        put: async () => {},
      }),
    },
  })

  // `fetch` is referenced as a bare global inside sw.js — define it in the
  // same context so both the module-level bypass branch (network-first,
  // falls back to cache only on failure) and the cache-first branch
  // (checks cache before ever calling fetch) are observable from outside.
  context.fetch = (request: { url: string } | string) => {
    const url = typeof request === "string" ? request : request.url
    fetchedFromNetwork.push(url)
    return Promise.resolve(new Response("fresh-network-bytes", { status: 200 }))
  }

  vm.runInContext(source, context, { filename: "sw.js" })

  return { fetchListener, fetchedFromNetwork, servedFromCache }
}

function fireFetch(sw: SwHarness, url: string): Promise<unknown> {
  if (!sw.fetchListener) throw new Error("fetch listener was not registered")
  let respondedWith: Promise<unknown> | undefined
  const event = {
    request: new Request(url, { method: "GET" }),
    respondWith: (p: Promise<unknown>) => {
      respondedWith = p
    },
    waitUntil: (p: Promise<unknown>) => p,
  }
  sw.fetchListener(event)
  return respondedWith ?? Promise.resolve(undefined)
}

const REAL_ICON_URLS = [
  "https://deligo.ar/icon-cliente-192x192.png",
  "https://deligo.ar/icon-cliente-512x512.png",
  "https://deligo.ar/icon-negocio-192x192.png",
  "https://deligo.ar/icon-admin-512x512.png",
  "https://deligo.ar/icon-empleado-512x512.png",
]

const NEW_P2_T36_ASSET_URLS = [
  "https://deligo.ar/icon-cliente-maskable-192x192.png",
  "https://deligo.ar/icon-cliente-maskable-512x512.png",
  "https://deligo.ar/icon-admin-maskable-512x512.png",
  "https://deligo.ar/badge-deligo-monochrome-96x96.png",
]

describe("P2-T36 — SW nunca cache-first para íconos/badges reales de DeliGO (F-P2-T36-02)", () => {
  test("cada URL real de ícono de rol va SIEMPRE a la red primero, nunca sirve el cache stale directamente", async () => {
    for (const url of REAL_ICON_URLS) {
      const sw = loadServiceWorker()
      await fireFetch(sw, url)
      expect(sw.fetchedFromNetwork).toContain(url)
      // network-first: el cache SÓLO se consulta si fetch() falla — acá
      // fetch() siempre resuelve, así que match() nunca debería llamarse.
      expect(sw.servedFromCache).not.toContain(url)
    }
  })

  test("los assets NUEVOS de P2-T36 (maskable + badge) también van siempre a la red — el fix cubre nombres que no existían cuando se escribió el substring original", async () => {
    for (const url of NEW_P2_T36_ASSET_URLS) {
      const sw = loadServiceWorker()
      await fireFetch(sw, url)
      expect(sw.fetchedFromNetwork).toContain(url)
      expect(sw.servedFromCache).not.toContain(url)
    }
  })

  test("sanity: el patrón ORIGINAL roto (`includes(\"icon-192\")` / `includes(\"icon-512\")`) NUNCA matchea estos nombres reales — prueba que el fix no es un no-op sobre una condición que ya funcionaba", () => {
    for (const url of REAL_ICON_URLS) {
      const brokenMatch = url.includes("icon-192") || url.includes("icon-512")
      expect(brokenMatch).toBe(false)
    }
  })

  test("manifest sigue yendo siempre a la red (comportamiento preexistente, no tocado por el fix)", async () => {
    const sw = loadServiceWorker()
    await fireFetch(sw, "https://deligo.ar/manifest-cliente.json")
    expect(sw.fetchedFromNetwork).toContain("https://deligo.ar/manifest-cliente.json")
    expect(sw.servedFromCache).not.toContain("https://deligo.ar/manifest-cliente.json")
  })

  test("un asset estático NO relacionado con branding (imagen de producto) sigue siendo cache-first — el fix no amplió el bypass más allá de icon-/badge-", async () => {
    const sw = loadServiceWorker()
    await fireFetch(sw, "https://deligo.ar/uploads/producto-123.jpg")
    // cache-first: el cache SÍ se consulta (y "hit", por el mock) antes de
    // tocar la red — comportamiento sin cambios para assets no-branding.
    expect(sw.servedFromCache).toContain("https://deligo.ar/uploads/producto-123.jpg")
  })
})

describe("P2-T36 — CACHE_NAME bump (fuerza purga de cualquier ícono ya cacheado stale por el bug de substring)", () => {
  test("CACHE_NAME subió de versión respecto al valor documentado en el propio historial del archivo (deligo-v15)", () => {
    const source = readFileSync(resolve(import.meta.dir, "..", "..", "public", "sw.js"), "utf8")
    const match = source.match(/const CACHE_NAME = "([^"]+)"/)
    expect(match).not.toBeNull()
    expect(match?.[1]).not.toBe("deligo-v15")
    expect(match?.[1]).toMatch(/^deligo-v\d+$/)
  })
})
