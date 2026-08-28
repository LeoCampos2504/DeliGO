/// <reference types="bun-types" />
// ============================================
// P2-T18-BLOCKER-AUTH2-R8 (Phase 2) — realtime-client.ts: selector de
// familia activa en /api/realtime/token y /api/realtime/authorize.
// ============================================
// Mockea EXCLUSIVAMENTE `fetch` (la frontera de red) — nunca la lógica de
// construcción de URL que se está probando. Contrato congelado en
// codex-reports/archive/P2-T18-BLOCKER-AUTH2-R7.md §REALTIME_TOKEN/
// §REALTIME_AUTHORIZE: la familia se deriva de window.location.pathname,
// nunca se le pide a RealtimeManager que la reenvíe — las firmas públicas
// exportadas no cambian (options: {signal?}).

import { afterAll, afterEach, describe, expect, test } from "bun:test"
import { GlobalRegistrator } from "@happy-dom/global-registrator"

GlobalRegistrator.register()

afterAll(() => {
  GlobalRegistrator.unregister()
})

const { authorizeRealtimeRoomResult, fetchRealtimeTokenResult } = await import("./realtime-client")

function setPathname(pathname: string): void {
  ;(window as unknown as { happyDOM: { setURL: (url: string) => void } }).happyDOM.setURL(
    `http://localhost${pathname}`
  )
}

const originalFetch = global.fetch

function mockFetchOnce(handler: (url: string, init?: RequestInit) => Response) {
  global.fetch = ((url: string | URL, init?: RequestInit) =>
    Promise.resolve(handler(String(url), init))) as typeof fetch
}

afterEach(() => {
  global.fetch = originalFetch
})

describe("fetchRealtimeTokenResult — selector de familia por pathname", () => {
  test("pestaña Cliente adjunta ?actorFamily=cliente a /api/realtime/token", async () => {
    setPathname("/cliente/pedidos/123")
    let capturedUrl = ""
    mockFetchOnce((url) => {
      capturedUrl = url
      return new Response(JSON.stringify({ token: "tok", expiresIn: 100 }), { status: 200 })
    })
    await fetchRealtimeTokenResult()
    expect(capturedUrl).toBe("/api/realtime/token?actorFamily=cliente")
  })

  test("pestaña Negocio adjunta ?actorFamily=negocio", async () => {
    setPathname("/negocio/dashboard")
    let capturedUrl = ""
    mockFetchOnce((url) => {
      capturedUrl = url
      return new Response(JSON.stringify({ token: "tok" }), { status: 200 })
    })
    await fetchRealtimeTokenResult()
    expect(capturedUrl).toBe("/api/realtime/token?actorFamily=negocio")
  })

  test("pathname fuera del esquema de familias (/admin) NO adjunta selector — comportamiento actual preservado", async () => {
    setPathname("/admin")
    let capturedUrl = ""
    mockFetchOnce((url) => {
      capturedUrl = url
      return new Response(JSON.stringify({ token: "tok" }), { status: 200 })
    })
    await fetchRealtimeTokenResult()
    expect(capturedUrl).toBe("/api/realtime/token")
  })

  test("firma pública sin cambio: options.signal sigue funcionando", async () => {
    setPathname("/cliente")
    const controller = new AbortController()
    let capturedInit: RequestInit | undefined
    mockFetchOnce((_url, init) => {
      capturedInit = init
      return new Response(JSON.stringify({ token: "tok" }), { status: 200 })
    })
    await fetchRealtimeTokenResult({ signal: controller.signal })
    expect(capturedInit?.signal).toBe(controller.signal)
  })
})

describe("authorizeRealtimeRoomResult — selector de familia por pathname", () => {
  test("pestaña Cliente adjunta ?actorFamily=cliente a /api/realtime/authorize", async () => {
    setPathname("/cliente/pedidos/123")
    let capturedUrl = ""
    mockFetchOnce((url) => {
      capturedUrl = url
      return new Response(JSON.stringify({ token: "cap" }), { status: 200 })
    })
    await authorizeRealtimeRoomResult("pedido-1", ["chat:read"])
    expect(capturedUrl).toBe("/api/realtime/authorize?actorFamily=cliente")
  })

  test("pestaña Repartidor adjunta ?actorFamily=repartidor", async () => {
    setPathname("/repartidor/entregas")
    let capturedUrl = ""
    mockFetchOnce((url) => {
      capturedUrl = url
      return new Response(JSON.stringify({ token: "cap" }), { status: 200 })
    })
    await authorizeRealtimeRoomResult("pedido-1", ["tracking:watch"])
    expect(capturedUrl).toBe("/api/realtime/authorize?actorFamily=repartidor")
  })

  test("el body sigue siendo exactamente {pedidoId, requestedScopes} — el selector va sólo en la URL, nunca en el body", async () => {
    setPathname("/negocio")
    let capturedBody: unknown = null
    mockFetchOnce((_url, init) => {
      capturedBody = init?.body ? JSON.parse(String(init.body)) : null
      return new Response(JSON.stringify({ token: "cap" }), { status: 200 })
    })
    await authorizeRealtimeRoomResult("pedido-2", ["chat:read", "chat:typing"])
    expect(capturedBody).toEqual({ pedidoId: "pedido-2", requestedScopes: ["chat:read", "chat:typing"] })
  })
})
