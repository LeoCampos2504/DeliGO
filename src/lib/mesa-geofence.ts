// ============================================
// DeliGO — Geocerca de pedidos de mesa (P0-C.1, modo observación)
// ============================================
// Función pura de evaluación + logging sanitizado. No abre conexión a la
// base de datos, no hace fetch, no depende de sesión ni de request — toda
// la resolución de Negocio/Mesa ocurre en el llamador (el endpoint público
// nuevo y POST /api/pedidos), que le pasa acá únicamente los datos ya
// resueltos. Esto la mantiene testeable con casos conocidos sin mocks.

// Política global de DeliGO — no configurable por negocio, nunca aceptada
// desde el cliente.
export const MESA_GEOFENCE_RADIUS_METERS = 200
export const MESA_GEOFENCE_MAX_ACCURACY_METERS = 150
// "observe": nunca bloquea la creación del pedido, solo informa/registra.
// "enforce" (P0-C.2): bloquea pedidos públicos de mesa de negocios calibrados
// que no resuelven "inside" — la decisión real vive en POST /api/pedidos,
// nunca en el cliente. No configurable por negocio ni por el cliente.
export const MESA_GEOFENCE_MODE = "enforce" as const

export type MesaGeofenceStatus =
  | "inside"
  | "outside"
  | "inaccurate"
  | "invalid"
  | "missing"
  | "business_unconfigured"

export type MesaGeofenceResult = {
  status: MesaGeofenceStatus
  distanceMeters: number | null
  accuracyMeters: number | null
}

export type MesaGeofenceNegocio = {
  lat: number | null
  lng: number | null
  ubicacionCalibradaEn: Date | null
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

// Distancia entre dos puntos sobre la superficie terrestre (metros). Función
// pura, sin dependencias externas, sin mapas ni geocodificación — solo
// trigonometría. Testeable con casos conocidos (ver sección 18 del reporte).
export function haversineDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const EARTH_RADIUS_METERS = 6371000
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180

  const dLat = toRadians(lat2 - lat1)
  const dLng = toRadians(lng2 - lng1)

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return EARTH_RADIUS_METERS * c
}

// Evalúa la geocerca a partir de datos ya resueltos — nunca confía en un
// booleano "estaDentro" del cliente, ni en radio/precisión enviados por él:
// `clienteUbicacion` es tratado como completamente no confiable (puede venir
// directo de `req.json()`, sin validar). La precisión NUNCA se suma al radio.
export function evaluateMesaGeofence(
  negocio: MesaGeofenceNegocio,
  clienteUbicacion: unknown
): MesaGeofenceResult {
  if (negocio.lat == null || negocio.lng == null || negocio.ubicacionCalibradaEn == null) {
    return { status: "business_unconfigured", distanceMeters: null, accuracyMeters: null }
  }

  if (clienteUbicacion === null || clienteUbicacion === undefined) {
    return { status: "missing", distanceMeters: null, accuracyMeters: null }
  }
  if (typeof clienteUbicacion !== "object" || Array.isArray(clienteUbicacion)) {
    return { status: "invalid", distanceMeters: null, accuracyMeters: null }
  }

  const raw = clienteUbicacion as Record<string, unknown>
  const clienteLat = raw.lat
  const clienteLng = raw.lng
  const accuracy = raw.accuracy

  if (!isFiniteNumber(clienteLat) || !isFiniteNumber(clienteLng) || !isFiniteNumber(accuracy)) {
    return { status: "invalid", distanceMeters: null, accuracyMeters: null }
  }
  if (clienteLat < -90 || clienteLat > 90) return { status: "invalid", distanceMeters: null, accuracyMeters: null }
  if (clienteLng < -180 || clienteLng > 180) return { status: "invalid", distanceMeters: null, accuracyMeters: null }
  if (accuracy <= 0) return { status: "invalid", distanceMeters: null, accuracyMeters: null }

  if (accuracy > MESA_GEOFENCE_MAX_ACCURACY_METERS) {
    return { status: "inaccurate", distanceMeters: null, accuracyMeters: accuracy }
  }

  const distanceMeters = haversineDistanceMeters(negocio.lat, negocio.lng, clienteLat, clienteLng)

  return {
    status: distanceMeters <= MESA_GEOFENCE_RADIUS_METERS ? "inside" : "outside",
    distanceMeters,
    accuracyMeters: accuracy,
  }
}

function shortId(value: string | null | undefined): string | null {
  if (!value) return null
  return value.length <= 8 ? value : `${value.slice(0, 8)}...`
}

// Registro sanitizado — nunca coordenadas (ni del cliente ni del negocio),
// nunca cookie/sesión/IP/token/payload completo. Distancia y precisión se
// redondean al metro. Reutilizado tanto por el endpoint público de
// comprobación como por POST /api/pedidos, diferenciando el momento vía
// `event`.
export function logMesaGeofenceObservation(
  event: "mesa_geofence_check_open" | "mesa_geofence_check_order",
  details: {
    negocioId: string
    mesaNumero: number
    result: MesaGeofenceResult
    // P0-C.2: si esta evaluación terminó bloqueando el pedido/la comprobación
    // (siempre calculado server-side, nunca recibido del cliente). Ausente =
    // false, para no romper ningún llamador existente.
    blocked?: boolean
  }
) {
  console.info(`[MesaGeofence] ${event}`, {
    negocioId: shortId(details.negocioId),
    mesaNumero: details.mesaNumero,
    status: details.result.status,
    distanceMeters:
      details.result.distanceMeters === null ? null : Math.round(details.result.distanceMeters),
    accuracyMeters:
      details.result.accuracyMeters === null ? null : Math.round(details.result.accuracyMeters),
    mode: MESA_GEOFENCE_MODE,
    blocked: details.blocked ?? false,
    timestamp: new Date().toISOString(),
  })
}
