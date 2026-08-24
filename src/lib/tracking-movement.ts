// ============================================
// P2-T02 (P2T02-MODEL-E1) — pure GPS sample/movement logic
// ============================================
// No DOM, no React, no fetch, no timers, no `navigator.geolocation` — every
// function here is a pure, synchronous computation over plain data, kept
// separate from src/hooks/use-repartidor-tracking.ts so the movement/
// freshness/accuracy math can be tested directly without mocking a
// Geolocation watcher or a React commit cycle (see
// src/lib/tracking-movement.test.ts).

export interface TrackingLocationSample {
  lat: number
  lng: number
  // Uncertainty radius in meters around (lat, lng). The W3C Geolocation API
  // spec defines `coords.accuracy` only as "the accuracy of the latitude and
  // longitude coordinates in meters" — it does NOT guarantee a specific
  // statistical confidence percentile (neither 1-sigma/68% nor 95%); that
  // interpretation is left to the underlying OS/device location provider,
  // never to the browser or this spec. Every use of `accuracy` in this
  // module treats it strictly as "a radius in meters", nothing stronger.
  accuracy: number
  // Epoch ms this sample was captured — preferably GeolocationPosition's own
  // `timestamp` (see buildSampleFromPosition), never a POST/server time.
  capturedAt: number
}

// Piso absoluto de movimiento, independiente de la precisión reportada —
// evita que incluso un GPS muy preciso cuente unos pocos metros de ruido
// (multipath urbano) como desplazamiento real. P2-T02 Stage 1/1B.
export const MOVEMENT_BASE_DISTANCE_METERS = 15

// Radio de incertidumbre conservador usado cuando `coords.accuracy` no es un
// número finito/no-negativo (anómalo pero posible en algunos dispositivos) —
// preferimos sobreestimar la incertidumbre (exigiendo más distancia para
// considerar movimiento real) antes que asumir 0 y producir un falso
// positivo de movimiento.
export const INVALID_ACCURACY_FALLBACK_METERS = 100

// Ventana de reutilización de un sample ya observado como si representara
// la posición "actual" (para envío inicial de una entrega nueva, heartbeat,
// o recuperación de foreground) — P2-T02 Stage 1B. Anclada al mismo valor
// que MIN_SEND_INTERVAL_MS del hook: un sample de esta antigüedad es, por
// definición, tan fresco como lo sería en operación normal de movimiento
// continuo. Preserva el mismo orden de magnitud que el `maximumAge:3000`
// que ya usaba el modelo anterior (getCurrentPosition polled) — nunca más
// permisivo sin evidencia.
export const SAMPLE_REUSE_MAX_AGE_MS = 5000

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

// Trata cualquier accuracy no numérica/no finita/negativa como
// desconocida-y-conservadora (INVALID_ACCURACY_FALLBACK_METERS) en vez de 0.
export function sanitizeAccuracy(accuracy: unknown): number {
  return isFiniteNumber(accuracy) && accuracy >= 0 ? accuracy : INVALID_ACCURACY_FALLBACK_METERS
}

// Distancia great-circle en metros entre dos puntos lat/lng — fórmula de
// Haversine pura, sin dependencia externa (correcta para las distancias
// cortas/urbanas relevantes a una entrega a domicilio).
export function haversineDistanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const EARTH_RADIUS_METERS = 6371000
  const toRad = (deg: number) => (deg * Math.PI) / 180

  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(Math.min(1, h)))
}

// Presupuesto de error conservador: un movimiento aparente sólo cuenta como
// real si supera la SUMA de las incertidumbres de ambas mediciones (nunca
// sólo la nueva o sólo la anterior), con un piso absoluto independiente de
// la precisión. No asume ningún percentil estadístico de `accuracy` — ver
// el comentario en TrackingLocationSample.
export function effectiveMovementThresholdMeters(
  newAccuracy: unknown,
  previousAccuracy: unknown
): number {
  return Math.max(
    MOVEMENT_BASE_DISTANCE_METERS,
    sanitizeAccuracy(newAccuracy) + sanitizeAccuracy(previousAccuracy)
  )
}

// Sin `previous` (entrega sin lastSentSample todavía) el movimiento es
// trivialmente "significativo" — este caso lo maneja el hook como envío
// inicial, no como una comparación real de distancia.
export function isSignificantMovement(
  previous: { lat: number; lng: number; accuracy: number } | null,
  next: { lat: number; lng: number; accuracy: number }
): boolean {
  if (!previous) return true
  const distance = haversineDistanceMeters(previous, next)
  const threshold = effectiveMovementThresholdMeters(next.accuracy, previous.accuracy)
  return distance > threshold
}

// Un sample es "fresco" (reutilizable como posición actual) si su edad,
// medida contra `now` inyectado (nunca Date.now() implícito — ver P2-T02
// Stage 1B §22), está en [0, maxAgeMs]. Una edad negativa (capturedAt en el
// futuro respecto a `now`) se trata como no confiable, nunca como "más
// fresco que fresco".
export function isSampleFresh(
  sample: TrackingLocationSample | null | undefined,
  now: number,
  maxAgeMs: number = SAMPLE_REUSE_MAX_AGE_MS
): boolean {
  if (!sample) return false
  if (!isFiniteNumber(sample.capturedAt) || !isFiniteNumber(now)) return false
  const age = now - sample.capturedAt
  return age >= 0 && age <= maxAgeMs
}

// `candidate` sólo reemplaza a `current` como observación física más
// reciente si es igual o más nuevo por capturedAt — nunca por orden de
// llegada del callback (un resultado one-shot que resuelve tarde no puede
// pisar un callback de watchPosition más nuevo que ya llegó).
export function isCandidateSampleNewer(
  candidate: TrackingLocationSample,
  current: TrackingLocationSample | null
): boolean {
  if (!current) return true
  return candidate.capturedAt >= current.capturedAt
}

// Construye un sample a partir de un GeolocationPosition (o cualquier objeto
// con la misma forma mínima, para poder testear sin un objeto real del
// browser). `capturedAt` preferido: `position.timestamp` (el instante que el
// propio navegador asocia al fix). Fallback controlado a `nowFallback()`
// (por defecto Date.now, siempre inyectable en tests) sólo si
// `position.timestamp` no es un número finito.
export function buildSampleFromPosition(
  position: { coords: { latitude: number; longitude: number; accuracy: number }; timestamp: unknown },
  nowFallback: () => number = Date.now
): TrackingLocationSample {
  const capturedAt = isFiniteNumber(position.timestamp) ? position.timestamp : nowFallback()
  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracy: sanitizeAccuracy(position.coords.accuracy),
    capturedAt,
  }
}
