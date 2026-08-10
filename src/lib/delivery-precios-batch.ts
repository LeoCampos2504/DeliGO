// ============================================
// DeliGO — Fetch en lotes de POST /api/negocios/delivery-precios (T20-DK2C)
// ============================================
// Única implementación de "pedir precios/cobertura de delivery para un
// conjunto de negocios sin violar el límite estricto del endpoint"
// (T20-DK2B: `DELIVERY_PRECIOS_MAX_IDS` por request, HTTP 400 ante exceso —
// nunca trunca en silencio). Reutilizada por CUALQUIER consumidor:
//
// - `useSoloDeliveryCoverage` (T20-DK2/DK2A/DK2B): sólo lee `.delivery`
//   para decidir si un negocio "solo delivery" aparece en discovery.
// - `cliente/page.tsx` (histórico, ya existía antes de T20-DK2): lee el
//   shape completo (`precioDelivery`, `zonaNombre`, `mode`, `reason`) para
//   mostrar precios/disponibilidad de delivery en las cards del home.
//
// Ambos consumidores pueden recibir más de `DELIVERY_PRECIOS_MAX_IDS`
// negocios (el listado de discovery no tiene paginación) — esta función
// deduplica, divide en lotes de ese tamaño, los resuelve en paralelo y
// combina el resultado en un único mapa, preservando el shape exacto que ya
// devuelve el endpoint. Un lote que falla (red, 400, 500) nunca tira los
// demás ni inventa un precio/cobertura — sus negocios simplemente quedan
// ausentes del mapa combinado (mismo tratamiento que un ID no encontrado).

import { chunkArray } from "@/lib/chunk-array"
import { DELIVERY_PRECIOS_MAX_IDS } from "@/lib/delivery-coverage"

export interface DeliveryPrecioEntry {
  precioDelivery?: number
  zonaNombre?: string
  mode?: string
  delivery?: boolean
  reason?: string
}

export type DeliveryPreciosMap = Record<string, DeliveryPrecioEntry>

async function fetchDeliveryPreciosChunk(lat: number, lng: number, ids: string[]): Promise<DeliveryPreciosMap> {
  try {
    const res = await fetch("/api/negocios/delivery-precios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lng, negocioIds: ids }),
    })
    if (!res.ok) return {}
    const json = await res.json()
    return (json.precios as DeliveryPreciosMap) ?? {}
  } catch {
    // Un lote que falla (red, timeout) nunca debe tirar el resto de la
    // resolución — sus negocios simplemente quedan sin datos conocidos.
    return {}
  }
}

// `fetchChunk` es inyectable para poder probar el algoritmo de lotes
// (chunking, paralelismo, combinación, fallo parcial) sin red/DOM real.
export async function fetchDeliveryPreciosBatched(
  lat: number,
  lng: number,
  negocioIds: string[],
  fetchChunk: (lat: number, lng: number, ids: string[]) => Promise<DeliveryPreciosMap> = fetchDeliveryPreciosChunk
): Promise<DeliveryPreciosMap> {
  const uniqueIds = [...new Set(negocioIds)]
  const chunks = chunkArray(uniqueIds, DELIVERY_PRECIOS_MAX_IDS)
  const chunkResults = await Promise.all(chunks.map((chunk) => fetchChunk(lat, lng, chunk)))
  // Los IDs de cada chunk son disjuntos entre sí (vienen de un array ya
  // deduplicado dividido en tramos) — combinar nunca pisa un resultado con
  // otro, y el orden de resolución de las promesas no afecta el resultado.
  return Object.assign({}, ...chunkResults)
}
