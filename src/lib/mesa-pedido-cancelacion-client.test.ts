/// <reference types="bun-types" />
// ============================================
// DeliGO — Tests: cliente de cancelación de pedidos de mesa (23-A2)
// ============================================
// Mockea EXCLUSIVAMENTE `fetch` (la frontera de red hacia el propio backend)
// — nunca la lógica de mapeo que se está probando. Sin DB, sin React. Cubre
// la sección 22 del prompt 23-A2 (mapeos 17-26) y el payload exacto exigido
// por la sección 10/2 (solo `motivo`, `id` únicamente en la ruta).

import { describe, test, expect, afterEach } from "bun:test"
import {
  cancelarPedidoMesaRequest,
  esErrorRecuperable,
  mensajeCancelarPedidoMesa,
  type CancelarPedidoMesaErrorOutcome,
} from "./mesa-pedido-cancelacion-client"

const originalFetch = global.fetch

function mockFetchOnce(handler: (url: string, init?: RequestInit) => Response) {
  global.fetch = ((url: string | URL, init?: RequestInit) =>
    Promise.resolve(handler(String(url), init))) as typeof fetch
}

afterEach(() => {
  global.fetch = originalFetch
})

describe("23-A2 — cancelarPedidoMesaRequest: payload y ruta exactos", () => {
  test("15. el payload contiene EXACTAMENTE la clave `motivo` — ninguna otra", async () => {
    let capturedBody: unknown = null
    mockFetchOnce((_url, init) => {
      capturedBody = init?.body ? JSON.parse(String(init.body)) : null
      return new Response(
        JSON.stringify({ ok: true, pedido: { id: "p1", estado: "cancelado", canceladoEn: "2026-01-01T00:00:00.000Z", motivoCancelacion: "motivo" } }),
        { status: 200 }
      )
    })
    await cancelarPedidoMesaRequest("p1", "Pedido cargado por error")
    expect(capturedBody).toEqual({ motivo: "Pedido cargado por error" })
  })

  test("16. nunca envía autoridad (negocioId/rol/mesaId/ocupacionMesaId/estado/identidad) en el payload", async () => {
    let capturedBody: unknown = null
    mockFetchOnce((_url, init) => {
      capturedBody = init?.body ? JSON.parse(String(init.body)) : null
      return new Response(JSON.stringify({ ok: false, error: "x" }), { status: 400 })
    })
    await cancelarPedidoMesaRequest("p1", "cualquier motivo válido")
    const keys = Object.keys(capturedBody as Record<string, unknown>)
    expect(keys).toEqual(["motivo"])
    for (const forbidden of ["negocioId", "rol", "userType", "mesaId", "ocupacionMesaId", "estado", "empleadoId", "terminalId", "cuentaOperativaId"]) {
      expect(keys).not.toContain(forbidden)
    }
  })

  test("20. endpoint correcto, id únicamente en la ruta, con encodeURIComponent", async () => {
    let capturedUrl = ""
    mockFetchOnce((url) => {
      capturedUrl = url
      return new Response(JSON.stringify({ ok: false, error: "x" }), { status: 400 })
    })
    await cancelarPedidoMesaRequest("id con espacio/raro", "motivo válido")
    expect(capturedUrl).toBe(`/api/operaciones/pedidos/${encodeURIComponent("id con espacio/raro")}/cancelar`)
  })

  test("método POST y Content-Type application/json", async () => {
    let capturedInit: RequestInit | undefined
    mockFetchOnce((_url, init) => {
      capturedInit = init
      return new Response(JSON.stringify({ ok: false, error: "x" }), { status: 400 })
    })
    await cancelarPedidoMesaRequest("p1", "motivo válido")
    expect(capturedInit?.method).toBe("POST")
    expect((capturedInit?.headers as Record<string, string>)?.["Content-Type"]).toBe("application/json")
  })
})

describe("23-A2 — cancelarPedidoMesaRequest: mapeo de respuestas", () => {
  test("respuesta 200 válida -> ok con el pedido exacto", async () => {
    mockFetchOnce(
      () =>
        new Response(
          JSON.stringify({
            ok: true,
            pedido: { id: "p1", estado: "cancelado", canceladoEn: "2026-01-01T00:00:00.000Z", motivoCancelacion: "motivo x" },
          }),
          { status: 200 }
        )
    )
    const outcome = await cancelarPedidoMesaRequest("p1", "motivo x")
    expect(outcome).toEqual({
      kind: "ok",
      pedido: { id: "p1", estado: "cancelado", canceladoEn: "2026-01-01T00:00:00.000Z", motivoCancelacion: "motivo x" },
    })
  })

  test("26. respuesta 200 con forma inesperada -> server_error, nunca se trata como éxito sin confirmar el shape", async () => {
    mockFetchOnce(() => new Response(JSON.stringify({ ok: true }), { status: 200 }))
    const outcome = await cancelarPedidoMesaRequest("p1", "motivo x")
    expect(outcome.kind).toBe("server_error")
  })

  test("17. 400 -> bad_request", async () => {
    mockFetchOnce(() => new Response(JSON.stringify({ ok: false, error: "Solicitud inválida" }), { status: 400 }))
    const outcome = await cancelarPedidoMesaRequest("p1", "motivo x")
    expect(outcome.kind).toBe("bad_request")
  })

  test("18. 401 -> unauthorized", async () => {
    mockFetchOnce(() => new Response(JSON.stringify({ ok: false, error: "No autenticado" }), { status: 401 }))
    const outcome = await cancelarPedidoMesaRequest("p1", "motivo x")
    expect(outcome.kind).toBe("unauthorized")
  })

  test("19. 403 -> forbidden", async () => {
    mockFetchOnce(() => new Response(JSON.stringify({ ok: false, error: "No tenés permiso" }), { status: 403 }))
    const outcome = await cancelarPedidoMesaRequest("p1", "motivo x")
    expect(outcome.kind).toBe("forbidden")
  })

  test("20b. 404 -> not_found", async () => {
    mockFetchOnce(() => new Response(JSON.stringify({ ok: false, error: "Pedido no encontrado" }), { status: 404 }))
    const outcome = await cancelarPedidoMesaRequest("p1", "motivo x")
    expect(outcome.kind).toBe("not_found")
  })

  test("21. 409 con code sin_ocupacion -> sin_ocupacion", async () => {
    mockFetchOnce(
      () => new Response(JSON.stringify({ ok: false, code: "sin_ocupacion", error: "..." }), { status: 409 })
    )
    const outcome = await cancelarPedidoMesaRequest("p1", "motivo x")
    expect(outcome.kind).toBe("sin_ocupacion")
  })

  test("22. 409 sin code (invalid_estado/conflict) -> conflict genérico", async () => {
    mockFetchOnce(() => new Response(JSON.stringify({ ok: false, error: "..." }), { status: 409 }))
    const outcome = await cancelarPedidoMesaRequest("p1", "motivo x")
    expect(outcome.kind).toBe("conflict")
  })

  test("23. 500 -> server_error", async () => {
    mockFetchOnce(() => new Response(JSON.stringify({ ok: false, error: "Error del servidor" }), { status: 500 }))
    const outcome = await cancelarPedidoMesaRequest("p1", "motivo x")
    expect(outcome.kind).toBe("server_error")
  })

  test("otro status inesperado (ej. 418) -> server_error, fallback genérico", async () => {
    mockFetchOnce(() => new Response("teapot", { status: 418 }))
    const outcome = await cancelarPedidoMesaRequest("p1", "motivo x")
    expect(outcome.kind).toBe("server_error")
  })

  test("24. respuesta no JSON -> mapeada igual según status, nunca lanza", async () => {
    mockFetchOnce(() => new Response("<html>not json</html>", { status: 500, headers: { "content-type": "text/html" } }))
    const outcome = await cancelarPedidoMesaRequest("p1", "motivo x")
    expect(outcome.kind).toBe("server_error")
  })

  test("24b. respuesta 409 vacía/no JSON -> conflict genérico (nunca sin_ocupacion sin confirmar el code)", async () => {
    mockFetchOnce(() => new Response("", { status: 409 }))
    const outcome = await cancelarPedidoMesaRequest("p1", "motivo x")
    expect(outcome.kind).toBe("conflict")
  })

  test("25. fallo de red -> network_error, nunca lanza", async () => {
    global.fetch = (() => Promise.reject(new TypeError("Failed to fetch"))) as unknown as typeof fetch
    const outcome = await cancelarPedidoMesaRequest("p1", "motivo x")
    expect(outcome.kind).toBe("network_error")
  })

  test("AbortError se re-lanza (no se traga como network_error) — permite que el llamador distinga un abort intencional", async () => {
    global.fetch = (() => Promise.reject(new DOMException("aborted", "AbortError"))) as unknown as typeof fetch
    await expect(cancelarPedidoMesaRequest("p1", "motivo x")).rejects.toThrow()
  })
})

describe("23-A2 — mensajeCancelarPedidoMesa (allowlist cerrada de mensajes)", () => {
  const casos: Array<[CancelarPedidoMesaErrorOutcome["kind"], string]> = [
    ["bad_request", "Revisá el motivo ingresado."],
    ["unauthorized", "Tu sesión venció. Volvé a iniciar sesión."],
    ["forbidden", "No tenés permiso para cancelar este pedido."],
    ["not_found", "El pedido ya no está disponible."],
    ["sin_ocupacion", "Este pedido no está vinculado a una ocupación activa y no se puede cancelar desde acá."],
    ["conflict", "El pedido cambió y ya no puede cancelarse. Actualizamos la información."],
    ["server_error", "No se pudo cancelar el pedido. Intentá nuevamente."],
    ["network_error", "No se pudo cancelar el pedido. Intentá nuevamente."],
  ]

  test.each(casos)("%s -> mensaje esperado", (kind, esperado) => {
    expect(mensajeCancelarPedidoMesa({ kind } as CancelarPedidoMesaErrorOutcome)).toBe(esperado)
  })

  test("nunca interpola texto crudo del servidor — mensajes siempre son los propios, fijos", () => {
    // No hay forma de que un `error` del servidor llegue a mensajeCancelarPedidoMesa:
    // su firma ni siquiera acepta la respuesta cruda, solo el `kind` ya clasificado.
    for (const [kind, esperado] of casos) {
      expect(mensajeCancelarPedidoMesa({ kind } as CancelarPedidoMesaErrorOutcome)).toBe(esperado)
    }
  })
})

describe("23-A2 — esErrorRecuperable", () => {
  test("bad_request/sin_ocupacion/conflict/server_error/network_error son recuperables (diálogo permanece abierto)", () => {
    for (const kind of ["bad_request", "sin_ocupacion", "conflict", "server_error", "network_error"] as const) {
      expect(esErrorRecuperable({ kind })).toBe(true)
    }
  })

  test("unauthorized/forbidden/not_found NO son recuperables (no tiene sentido reintentar este pedido acá)", () => {
    for (const kind of ["unauthorized", "forbidden", "not_found"] as const) {
      expect(esErrorRecuperable({ kind })).toBe(false)
    }
  })
})
