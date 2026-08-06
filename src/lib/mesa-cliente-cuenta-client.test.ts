/// <reference types="bun-types" />
// ============================================
// DeliGO — Tests: cliente de cuenta pública de mesa (23-B)
// ============================================
// Mockea EXCLUSIVAMENTE `fetch` — nunca la lógica de mapeo que se está
// probando. Sin DB, sin React. Cubre query/endpoint exactos, `cache:
// "no-store"`, y el mapeo completo de respuestas del contrato de
// GET /api/public/mesa-cuenta.

import { describe, test, expect, afterEach } from "bun:test"
import { fetchMesaClienteCuenta } from "./mesa-cliente-cuenta-client"

const originalFetch = global.fetch

function mockFetchOnce(handler: (url: string, init?: RequestInit) => Response) {
  global.fetch = ((url: string | URL, init?: RequestInit) =>
    Promise.resolve(handler(String(url), init))) as typeof fetch
}

afterEach(() => {
  global.fetch = originalFetch
})

const cuentaActivaBody = {
  ok: true,
  status: "activa",
  negocio: { nombre: "Restó A" },
  mesa: { numero: 5 },
  pedidos: [],
  totalGeneral: 1000,
  pedidosIncluidosCount: 1,
  pedidosExcluidosCount: 0,
  pedidosPendientesCount: 0,
  puedeCerrar: true,
}

describe("23-B — fetchMesaClienteCuenta: endpoint y método exactos", () => {
  test("GET al endpoint correcto con slug y mesa como query params, encodeURIComponent aplicado", async () => {
    let capturedUrl = ""
    let capturedInit: RequestInit | undefined
    mockFetchOnce((url, init) => {
      capturedUrl = url
      capturedInit = init
      return new Response(JSON.stringify(cuentaActivaBody), { status: 200 })
    })
    await fetchMesaClienteCuenta({ slug: "resto raro/con espacio", mesaNumero: 7 })
    expect(capturedUrl).toBe(
      `/api/public/mesa-cuenta?slug=${encodeURIComponent("resto raro/con espacio")}&mesa=7`
    )
    expect(capturedInit?.method ?? "GET").toBe("GET")
    expect(capturedInit?.cache).toBe("no-store")
  })

  test("nunca envía negocioId/mesaId/ocupacionId — solo slug/mesa públicos van en la URL", async () => {
    let capturedUrl = ""
    mockFetchOnce((url) => {
      capturedUrl = url
      return new Response(JSON.stringify({ ok: true, status: "sin_sesion" }), { status: 200 })
    })
    await fetchMesaClienteCuenta({ slug: "resto-a", mesaNumero: 3 })
    for (const forbidden of ["negocioId", "mesaId", "ocupacionId", "token", "cookie"]) {
      expect(capturedUrl.toLowerCase()).not.toContain(forbidden.toLowerCase())
    }
  })
})

describe("23-B — fetchMesaClienteCuenta: mapeo de respuestas", () => {
  test("status 'sin_sesion' -> kind 'sin_sesion'", async () => {
    mockFetchOnce(() => new Response(JSON.stringify({ ok: true, status: "sin_sesion" }), { status: 200 }))
    const outcome = await fetchMesaClienteCuenta({ slug: "a", mesaNumero: 1 })
    expect(outcome.kind).toBe("sin_sesion")
  })

  test("status 'cerrada' -> kind 'cerrada'", async () => {
    mockFetchOnce(() => new Response(JSON.stringify({ ok: true, status: "cerrada" }), { status: 200 }))
    const outcome = await fetchMesaClienteCuenta({ slug: "a", mesaNumero: 1 })
    expect(outcome.kind).toBe("cerrada")
  })

  test("status 'activa' con forma válida -> kind 'activa' con cuenta completa", async () => {
    mockFetchOnce(() => new Response(JSON.stringify(cuentaActivaBody), { status: 200 }))
    const outcome = await fetchMesaClienteCuenta({ slug: "a", mesaNumero: 5 })
    expect(outcome).toEqual({
      kind: "activa",
      cuenta: {
        negocioNombre: "Restó A",
        mesaNumero: 5,
        pedidos: [],
        totalGeneral: 1000,
        pedidosIncluidosCount: 1,
        pedidosExcluidosCount: 0,
        pedidosPendientesCount: 0,
        puedeCerrar: true,
      },
    })
  })

  test("status 'activa' con forma inesperada (falta totalGeneral) -> error, nunca se trata como éxito sin confirmar el shape", async () => {
    const { totalGeneral: _omit, ...malformed } = cuentaActivaBody
    mockFetchOnce(() => new Response(JSON.stringify(malformed), { status: 200 }))
    const outcome = await fetchMesaClienteCuenta({ slug: "a", mesaNumero: 5 })
    expect(outcome.kind).toBe("error")
  })

  test("ok !== true -> error", async () => {
    mockFetchOnce(() => new Response(JSON.stringify({ ok: false, status: "activa" }), { status: 200 }))
    const outcome = await fetchMesaClienteCuenta({ slug: "a", mesaNumero: 5 })
    expect(outcome.kind).toBe("error")
  })

  test("status HTTP no-2xx (429/500) -> error", async () => {
    mockFetchOnce(() => new Response(JSON.stringify({ error: "rate limited" }), { status: 429 }))
    const outcome = await fetchMesaClienteCuenta({ slug: "a", mesaNumero: 5 })
    expect(outcome.kind).toBe("error")
  })

  test("respuesta no JSON -> error, nunca lanza", async () => {
    mockFetchOnce(() => new Response("<html>", { status: 200, headers: { "content-type": "text/html" } }))
    const outcome = await fetchMesaClienteCuenta({ slug: "a", mesaNumero: 5 })
    expect(outcome.kind).toBe("error")
  })

  test("fallo de red -> error, nunca lanza", async () => {
    global.fetch = (() => Promise.reject(new TypeError("Failed to fetch"))) as unknown as typeof fetch
    const outcome = await fetchMesaClienteCuenta({ slug: "a", mesaNumero: 5 })
    expect(outcome.kind).toBe("error")
  })

  test("AbortError se re-lanza (no se traga como error genérico)", async () => {
    global.fetch = (() => Promise.reject(new DOMException("aborted", "AbortError"))) as unknown as typeof fetch
    await expect(fetchMesaClienteCuenta({ slug: "a", mesaNumero: 5 })).rejects.toThrow()
  })
})
