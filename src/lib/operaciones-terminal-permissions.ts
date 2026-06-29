// ============================================
// DeliGO - Operaciones Terminal Permissions
// ============================================
// Fuente de verdad de áreas, perfiles y scopes para terminales compartidas de la
// futura PWA "DeliGO Operaciones".
//
//   - `areas` + `scopes` son la autorización real (validada server-side en cada API futura).
//   - `perfil` es solo una etiqueta/preset visual.
//   - Áreas permitidas en terminales compartidas: salon | pyr. NUNCA `mozo` (exclusivo de
//     empleados con cuenta personal) ni delivery de repartidores.
//   - Ninguna terminal recibe permisos de administración, empleados, configuración,
//     facturación, planes, propietarios ni delivery.

/** Áreas permitidas para terminales compartidas. `mozo` queda explícitamente excluido. */
export const OPERACIONES_AREAS = ["salon", "pyr"] as const
export type OperacionesArea = (typeof OPERACIONES_AREAS)[number]

/** Allowlist de scopes de Salón (orden canónico). */
const SALON_SCOPES = [
  "salon.ver",
  "salon.pedidos.ver",
  "salon.pedidos.cambiar_estado",
  "salon.pedidos.marcar_entregado",
  "salon.mesas.liberar",
  "salon.mesas.reasignar",
  "salon.historial.ver",
  "salon.estadisticas.ver",
] as const

/** Allowlist de scopes de PyR (orden canónico). */
const PYR_SCOPES = [
  "pyr.ver",
  "pyr.pedidos.ver",
  "pyr.pedidos.gestionar",
  "pyr.resenas.ver",
  "pyr.resenas.responder",
  "pyr.mensajes.ver",
  "pyr.mensajes.responder",
] as const

/** Allowlist completo (Salón + PyR), en orden canónico. */
export const OPERACIONES_SCOPES = [...SALON_SCOPES, ...PYR_SCOPES] as const
export type OperacionesScope = (typeof OPERACIONES_SCOPES)[number]

/** Perfiles persistidos. `personalizado` valida/normaliza áreas+scopes del input. */
export const OPERACIONES_PROFILES = [
  "pantalla",
  "cocina",
  "salon_completo",
  "pyr_completo",
  "personalizado",
] as const
export type OperacionesProfile = (typeof OPERACIONES_PROFILES)[number]

/** Perfil inicial por defecto al crear una terminal. */
export const DEFAULT_OPERACIONES_PROFILE: OperacionesProfile = "pantalla"

/** Conjunto efectivo (áreas + scopes) que produce el helper. */
export interface OperacionesGrant {
  areas: OperacionesArea[]
  scopes: OperacionesScope[]
}

/** Presets fijos: el backend recalcula siempre sus áreas/scopes (no confía en el frontend). */
const FIXED_PROFILES: Record<Exclude<OperacionesProfile, "personalizado">, OperacionesGrant> = {
  pantalla: { areas: ["salon"], scopes: ["salon.ver", "salon.pedidos.ver"] },
  cocina: { areas: ["salon"], scopes: ["salon.ver", "salon.pedidos.ver", "salon.pedidos.cambiar_estado"] },
  salon_completo: { areas: ["salon"], scopes: [...SALON_SCOPES] },
  pyr_completo: { areas: ["pyr"], scopes: [...PYR_SCOPES] },
}

const ALLOWED_AREAS = new Set<string>(OPERACIONES_AREAS)
const ALLOWED_SCOPES = new Set<string>(OPERACIONES_SCOPES)

/** Scope base por área: se agrega si el área tiene cualquier scope habilitado. */
const AREA_BASE_SCOPE: Record<OperacionesArea, OperacionesScope> = {
  salon: "salon.ver",
  pyr: "pyr.ver",
}

/** Scopes implícitos: habilitar la clave agrega automáticamente el valor (su `*.ver`). */
const IMPLIED_SCOPES: Partial<Record<OperacionesScope, OperacionesScope>> = {
  "salon.pedidos.cambiar_estado": "salon.pedidos.ver",
  "salon.pedidos.marcar_entregado": "salon.pedidos.ver",
  "pyr.pedidos.gestionar": "pyr.pedidos.ver",
  "pyr.resenas.responder": "pyr.resenas.ver",
  "pyr.mensajes.responder": "pyr.mensajes.ver",
}

/** Área a la que pertenece un scope (prefijo antes del primer punto). */
function scopeArea(scope: string): OperacionesArea | null {
  const prefix = scope.split(".")[0]
  return ALLOWED_AREAS.has(prefix) ? (prefix as OperacionesArea) : null
}

export function isOperacionesProfile(value: unknown): value is OperacionesProfile {
  return typeof value === "string" && (OPERACIONES_PROFILES as readonly string[]).includes(value)
}

/** Filtra/dedup áreas al allowlist (descarta `mozo`, delivery y desconocidas). Orden canónico. */
function sanitizeAreas(input: unknown): Set<OperacionesArea> {
  const areas = new Set<OperacionesArea>()
  if (Array.isArray(input)) {
    for (const raw of input) {
      if (typeof raw !== "string") continue
      const value = raw.trim()
      if (ALLOWED_AREAS.has(value)) areas.add(value as OperacionesArea)
    }
  }
  return areas
}

/**
 * Normaliza un grant personalizado a partir de áreas y scopes crudos:
 * - descarta áreas/scopes desconocidos, no-string y duplicados;
 * - elimina scopes cuya área no esté seleccionada;
 * - agrega los scopes `*.ver` implícitos (gestionar/responder/cambiar_estado/marcar_entregado);
 * - agrega el scope base del área si ésta tiene cualquier scope;
 * - devuelve áreas y scopes en orden canónico.
 */
function normalizeCustomGrant(rawAreas: unknown, rawScopes: unknown): OperacionesGrant {
  const areas = sanitizeAreas(rawAreas)

  const scopes = new Set<string>()
  if (Array.isArray(rawScopes)) {
    for (const raw of rawScopes) {
      if (typeof raw !== "string") continue
      const value = raw.trim()
      if (ALLOWED_SCOPES.has(value)) scopes.add(value)
    }
  }

  // Eliminar scopes cuya área no esté seleccionada.
  for (const scope of [...scopes]) {
    const area = scopeArea(scope)
    if (!area || !areas.has(area)) scopes.delete(scope)
  }

  // Agregar scopes `*.ver` implícitos (la área ya está garantizada porque el origen sobrevivió).
  for (const scope of [...scopes]) {
    const implied = IMPLIED_SCOPES[scope as OperacionesScope]
    if (implied) scopes.add(implied)
  }

  // Agregar el scope base de cada área que tenga al menos un scope.
  for (const area of areas) {
    const hasAny = [...scopes].some((scope) => scopeArea(scope) === area)
    if (hasAny) scopes.add(AREA_BASE_SCOPE[area])
  }

  return {
    areas: OPERACIONES_AREAS.filter((area) => areas.has(area)),
    scopes: OPERACIONES_SCOPES.filter((scope) => scopes.has(scope)),
  }
}

/**
 * Resuelve áreas y scopes efectivos. Perfiles fijos se recalculan en el servidor;
 * `personalizado` valida y normaliza áreas/scopes recibidos.
 */
export function resolveEffectiveGrant(
  perfil: OperacionesProfile,
  rawAreas?: unknown,
  rawScopes?: unknown
): OperacionesGrant {
  if (perfil === "personalizado") {
    return normalizeCustomGrant(rawAreas, rawScopes)
  }
  const fixed = FIXED_PROFILES[perfil]
  return { areas: [...fixed.areas], scopes: [...fixed.scopes] }
}

/**
 * Resuelve el grant canónico a partir de áreas y scopes ALMACENADOS (JSON string o array):
 * - parsea áreas y scopes al allowlist;
 * - elimina scopes cuya área no esté seleccionada;
 * - aplica las dependencias seguras (base `salon.ver`/`pyr.ver` y `*.ver` implícitos);
 * - devuelve áreas y scopes en orden canónico.
 * Nunca agrega `mozo`, delivery, admin, configuración, empleados, facturación, planes ni
 * propietarios (todos quedan fuera del allowlist). Útil para serializar de forma consistente.
 */
export function parseStoredGrant(areasValue: unknown, scopesValue: unknown): OperacionesGrant {
  return normalizeCustomGrant(parseStoredAreas(areasValue), parseStoredScopes(scopesValue))
}

/** Parseo seguro de áreas almacenadas como JSON string (filtra al allowlist, orden canónico). */
export function parseStoredAreas(value: unknown): OperacionesArea[] {
  const raw = typeof value === "string" ? safeJsonArray(value) : Array.isArray(value) ? value : []
  const areas = sanitizeAreas(raw)
  return OPERACIONES_AREAS.filter((area) => areas.has(area))
}

/** Parseo seguro de scopes almacenados como JSON string (filtra al allowlist, orden canónico). */
export function parseStoredScopes(value: unknown): OperacionesScope[] {
  const raw = typeof value === "string" ? safeJsonArray(value) : Array.isArray(value) ? value : []
  const scopes = new Set<string>()
  for (const item of raw) {
    if (typeof item === "string" && ALLOWED_SCOPES.has(item.trim())) scopes.add(item.trim())
  }
  return OPERACIONES_SCOPES.filter((scope) => scopes.has(scope))
}

function safeJsonArray(value: string): unknown[] {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
