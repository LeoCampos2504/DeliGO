// ============================================
// DeliGO — Cobertura de delivery por ubicación (T20-DK2)
// ============================================
// Única fuente de verdad para "¿esta ubicación cae dentro de la zona de
// delivery de este negocio?" — extraída sin cambiar comportamiento desde
// `POST /api/negocios/delivery-precios` (el endpoint que ya usaba el home
// de Cliente para calcular precios/disponibilidad en lote). Reutilizada
// también por la política de visibilidad en discovery (T20-DK2) para no
// duplicar el algoritmo de polígonos.
//
// No toca el gate independiente de `POST /api/pedidos` (creación real de
// pedido) ni el de `/api/negocio/delivery-zonas` (checkout de un solo
// negocio) — esos siguen siendo su propia defensa en profundidad, tal como
// exige T20-DK1.

// T20-DK2B: única fuente de verdad del límite de `negocioIds` por request de
// `POST /api/negocios/delivery-precios` — usada tanto por el endpoint (para
// rechazar explícitamente un exceso) como por `useSoloDeliveryCoverage`
// (para dividir el conjunto de candidatos en lotes de este tamaño). Cambiar
// este número no requiere tocar ningún otro archivo.
export const DELIVERY_PRECIOS_MAX_IDS = 50

export interface ZonaDelivery {
  id?: string
  nombre?: string
  precio?: number
  puntos: { lat: number; lng: number }[]
  color?: string
}

export interface NegocioConCoberturaDelivery {
  ofreceDelivery: boolean
  deliveryMode: string
  precioDelivery: number
  precioDeliveryDefault: number
  zonaDeliveryActiva: boolean
  zonasDelivery: unknown // JSON string o array ya parseado
}

export interface DeliveryCoverageResult {
  precioDelivery: number
  zonaNombre?: string
  mode: string
  delivery?: boolean
  reason?: string
}

function safeParseZonas(value: unknown): ZonaDelivery[] {
  if (!value) return []
  const parsed = typeof value === "string" ? tryParseJSON(value) : value
  return Array.isArray(parsed) ? (parsed as ZonaDelivery[]) : []
}

function tryParseJSON(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return []
  }
}

// Point-in-polygon (ray-casting), idéntico al que ya usaba delivery-precios.
export function pointInPolygon(lat: number, lng: number, polygon: { lat: number; lng: number }[]): boolean {
  let inside = false
  const n = polygon.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].lat
    const yi = polygon[i].lng
    const xj = polygon[j].lat
    const yj = polygon[j].lng
    const intersect = yi > lng !== yj > lng && lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

// Comportamiento idéntico al bucle histórico de `delivery-precios`: mismo
// orden de casos (sin delivery -> modo simple -> modo experto sin zonas ->
// modo experto con zonas), mismos campos de salida.
export function resolveDeliveryCoverage(
  negocio: NegocioConCoberturaDelivery,
  lat: number,
  lng: number
): DeliveryCoverageResult {
  if (!negocio.ofreceDelivery) {
    return { precioDelivery: 0, mode: "none", delivery: false, reason: "no_delivery" }
  }

  if (!negocio.zonaDeliveryActiva || negocio.deliveryMode !== "expert") {
    return { precioDelivery: negocio.precioDelivery ?? 0, mode: "simple" }
  }

  const zonas = safeParseZonas(negocio.zonasDelivery)

  if (zonas.length === 0) {
    return {
      precioDelivery: negocio.precioDeliveryDefault ?? negocio.precioDelivery ?? 0,
      mode: "expert",
      zonaNombre: undefined,
    }
  }

  for (const zona of zonas) {
    if (zona.puntos && Array.isArray(zona.puntos) && zona.puntos.length >= 3 && pointInPolygon(lat, lng, zona.puntos)) {
      return { precioDelivery: zona.precio ?? 0, zonaNombre: zona.nombre, mode: "expert" }
    }
  }

  return {
    precioDelivery: negocio.precioDeliveryDefault ?? negocio.precioDelivery ?? 0,
    mode: "expert",
    delivery: false,
    reason: "outside_zones",
  }
}

// Rango válido compartido — única fuente de verdad para "¿esta lat/lng es
// geográficamente válida?", reutilizada tanto por el parseo desde string
// (query params) como desde number (props/body ya numéricos).
function isFiniteCoordinate(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
  if (lat < -90 || lat > 90) return false
  if (lng < -180 || lng > 180) return false
  return true
}

// T20-DK2: parseo estricto de lat/lng recibidos como query params — nunca
// lanza, nunca produce un error Prisma/raw. Coordenadas ausentes o
// inválidas se tratan como "ubicación desconocida" (nunca se asume fuera de
// zona por una entrada malformada). Ningún endpoint GET de discovery llama
// esto hoy (T20-DK2A eliminó lat/lng de sus query strings) — se mantiene
// para cualquier consumidor que reciba coordenadas como string.
export function parseDiscoveryCoordinates(params: {
  lat: string | null
  lng: string | null
}): { lat: number; lng: number } | null {
  if (params.lat === null || params.lng === null) return null
  if (params.lat.trim() === "" || params.lng.trim() === "") return null
  const lat = Number(params.lat)
  const lng = Number(params.lng)
  if (!isFiniteCoordinate(lat, lng)) return null
  return { lat, lng }
}

// T20-DK2A: misma validación que `parseDiscoveryCoordinates`, para el caso
// en que la ubicación ya llega como number (props de React, body de un
// POST) — usada por `useSoloDeliveryCoverage` antes de armar el batch a
// `POST /api/negocios/delivery-precios`, para nunca disparar ese request
// con coordenadas no finitas o fuera de rango.
export function isValidCoordinatePair(lat: number | undefined, lng: number | undefined): boolean {
  if (lat === undefined || lng === undefined) return false
  return isFiniteCoordinate(lat, lng)
}
