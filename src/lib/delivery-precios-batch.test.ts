/// <reference types="bun-types" />

// ============================================
// T20-DK2C — Batching compartido de delivery-precios (pura, sin DOM/red)
// ============================================
// Prueba `fetchDeliveryPreciosBatched` — la única implementación de
// chunking/combinación/fail-open reutilizada por AMBOS consumidores reales
// del endpoint (`useSoloDeliveryCoverage` para discovery y el flujo
// histórico de precios en `cliente/page.tsx`) — inyectando un `fetchChunk`
// stub en vez de HTTP real.

import { describe, expect, test } from "bun:test"
import { fetchDeliveryPreciosBatched, type DeliveryPreciosMap } from "./delivery-precios-batch"

function idsCount(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `negocio-${i + 1}`)
}

// Stub de `fetchChunk`: simula el endpoint real. `special` permite
// devolver un shape de precio distinto para IDs puntuales (para detectar
// en qué chunk terminó cada uno).
function makeFetchChunkStub(special: Record<string, DeliveryPreciosMap[string]> = {}) {
  const calls: string[][] = []
  const fetchChunk = async (_lat: number, _lng: number, ids: string[]): Promise<DeliveryPreciosMap> => {
    calls.push(ids)
    const precios: DeliveryPreciosMap = {}
    for (const id of ids) {
      precios[id] = special[id] ?? { precioDelivery: 100, mode: "simple" }
    }
    return precios
  }
  return { fetchChunk, calls }
}

describe("T20-DK2C — fetchDeliveryPreciosBatched: fórmula de chunks", () => {
  test("51 ids -> 2 requests (50 y 1), mapa combinado completo", async () => {
    const { fetchChunk, calls } = makeFetchChunkStub()
    const result = await fetchDeliveryPreciosBatched(1, 1, idsCount(51), fetchChunk)
    expect(calls).toHaveLength(2)
    expect(calls[0]).toHaveLength(50)
    expect(calls[1]).toHaveLength(1)
    expect(Object.keys(result)).toHaveLength(51)
  })

  test("100 ids -> 2 requests (50 y 50)", async () => {
    const { fetchChunk, calls } = makeFetchChunkStub()
    const result = await fetchDeliveryPreciosBatched(1, 1, idsCount(100), fetchChunk)
    expect(calls).toHaveLength(2)
    expect(calls.map((c) => c.length)).toEqual([50, 50])
    expect(Object.keys(result)).toHaveLength(100)
  })

  test("101 ids -> 3 requests (50, 50 y 1) — el #101 (tercer chunk) también se resuelve", async () => {
    const { fetchChunk, calls } = makeFetchChunkStub({
      "negocio-101": { precioDelivery: 999, zonaNombre: "Zona rara", mode: "expert" },
    })
    const result = await fetchDeliveryPreciosBatched(1, 1, idsCount(101), fetchChunk)
    expect(calls).toHaveLength(3)
    expect(calls.map((c) => c.length)).toEqual([50, 50, 1])
    expect(Object.keys(result)).toHaveLength(101)
    expect(result["negocio-101"].precioDelivery).toBe(999)
    expect(result["negocio-101"].zonaNombre).toBe("Zona rara")
  })

  test("un negocio distinguible en CADA chunk (1º, 2º y 3º) aparece con su precio propio en el mapa final", async () => {
    const { fetchChunk } = makeFetchChunkStub({
      "negocio-1": { precioDelivery: 111, mode: "simple" }, // chunk 1
      "negocio-51": { precioDelivery: 222, mode: "simple" }, // chunk 2
      "negocio-101": { precioDelivery: 333, mode: "simple" }, // chunk 3
    })
    const result = await fetchDeliveryPreciosBatched(1, 1, idsCount(101), fetchChunk)
    expect(result["negocio-1"].precioDelivery).toBe(111)
    expect(result["negocio-51"].precioDelivery).toBe(222)
    expect(result["negocio-101"].precioDelivery).toBe(333)
  })

  test("120 ids -> 3 requests (50, 50, 20)", async () => {
    const { fetchChunk, calls } = makeFetchChunkStub()
    const result = await fetchDeliveryPreciosBatched(1, 1, idsCount(120), fetchChunk)
    expect(calls).toHaveLength(3)
    expect(calls.map((c) => c.length)).toEqual([50, 50, 20])
    expect(Object.keys(result)).toHaveLength(120)
  })

  test("50 exactos -> 1 solo request", async () => {
    const { fetchChunk, calls } = makeFetchChunkStub()
    const result = await fetchDeliveryPreciosBatched(1, 1, idsCount(50), fetchChunk)
    expect(calls).toHaveLength(1)
    expect(Object.keys(result)).toHaveLength(50)
  })

  test("0 ids -> 0 requests", async () => {
    const { fetchChunk, calls } = makeFetchChunkStub()
    const result = await fetchDeliveryPreciosBatched(1, 1, [], fetchChunk)
    expect(calls).toHaveLength(0)
    expect(result).toEqual({})
  })
})

describe("T20-DK2C — fallo parcial de un chunk (precios)", () => {
  test("chunk 2 falla: negocios del chunk 1 conservan sus datos, los del chunk 2 quedan sin precio conocido (nunca inventado)", async () => {
    const calls: string[][] = []
    const fetchChunk = async (_lat: number, _lng: number, ids: string[]): Promise<DeliveryPreciosMap> => {
      calls.push(ids)
      if (calls.length === 2) return {} // simula fallo (400/500/red) del segundo chunk
      const precios: DeliveryPreciosMap = {}
      for (const id of ids) precios[id] = { precioDelivery: 150, mode: "simple" }
      return precios
    }

    const result = await fetchDeliveryPreciosBatched(1, 1, idsCount(101), fetchChunk)
    expect(result["negocio-1"].precioDelivery).toBe(150)
    expect(result["negocio-50"].precioDelivery).toBe(150)
    // Nunca se inventa precio 0/gratis para los del chunk fallido.
    expect(result["negocio-51"]).toBeUndefined()
    expect(result["negocio-100"]).toBeUndefined()
  })

  test("nunca lanza — un fetchChunk que siempre resuelve (incluso ante fallo real) es indispensable para que Promise.all no rechace", async () => {
    const fetchChunk = async () => ({}) // equivalente al catch{} real
    await expect(fetchDeliveryPreciosBatched(1, 1, idsCount(60), fetchChunk)).resolves.toEqual({})
  })
})

describe("T20-DK2C — resultado faltante dentro de un chunk exitoso", () => {
  test("un id ausente en la respuesta del servidor no recibe un precio ficticio", async () => {
    const fetchChunk = async (_lat: number, _lng: number, ids: string[]): Promise<DeliveryPreciosMap> => {
      const [first] = ids
      return { [first]: { precioDelivery: 200, mode: "simple" } } // "olvida" el segundo id
    }
    const result = await fetchDeliveryPreciosBatched(1, 1, ["negocio-a", "negocio-b"], fetchChunk)
    expect(result["negocio-a"].precioDelivery).toBe(200)
    expect(result["negocio-b"]).toBeUndefined()
  })
})

describe("T20-DK2C — deduplicación", () => {
  test("IDs repetidos se piden una sola vez", async () => {
    const { fetchChunk, calls } = makeFetchChunkStub()
    await fetchDeliveryPreciosBatched(1, 1, ["A", "B", "A", "C", "B"], fetchChunk)
    expect(calls).toHaveLength(1)
    expect(calls[0]).toEqual(["A", "B", "C"])
  })

  test("deduplicar puede evitar cruzar el límite de 50 innecesariamente (60 ids con muchos repetidos, 40 únicos)", async () => {
    const withDupes = [...idsCount(40), ...idsCount(20)] // negocio-1..20 repetidos
    const { fetchChunk, calls } = makeFetchChunkStub()
    await fetchDeliveryPreciosBatched(1, 1, withDupes, fetchChunk)
    expect(calls).toHaveLength(1) // 40 únicos, cabe en un solo chunk
    expect(calls[0]).toHaveLength(40)
  })
})
