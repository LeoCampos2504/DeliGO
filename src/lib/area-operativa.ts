// ============================================
// DeliGO — Área operativa efectiva (Operaciones-1F)
// ============================================
// Helper PURO (sin cookies, headers, DB, Next.js, fetch, sesiones, tokens, window
// ni localStorage). Fuente única de verdad de la regla de "área efectiva" personal.
// Lo importan: resolveOperativoMozoForSlug, /api/operativo/me, administración de
// empleados y los guards de las APIs legacy de mozo. No duplicar esta lógica.

export const AREA_OPERATIVA_VALUES = [
  "sin_asignar",
  "mozo",
  "salon",
  "pyr",
] as const

export type AreaOperativa = (typeof AREA_OPERATIVA_VALUES)[number]

/** Normaliza a un valor del allowlist; cualquier valor desconocido → "sin_asignar". */
export function normalizeAreaOperativa(value: unknown): AreaOperativa {
  return typeof value === "string" && (AREA_OPERATIVA_VALUES as readonly string[]).includes(value)
    ? (value as AreaOperativa)
    : "sin_asignar"
}

/**
 * Área efectiva personal (Operaciones-1F.2, regla estricta). Se deriva EXCLUSIVAMENTE
 * de `areaOperativa`:
 *
 *   1. areaOperativa === "mozo"      → "mozo"
 *   2. areaOperativa === "salon"     → "salon"
 *   3. areaOperativa === "pyr"       → "pyr"
 *   4. "sin_asignar" / inválido      → "sin_asignar"
 *
 * `rol` se mantiene en la firma solo por compatibilidad de contrato con los
 * consumidores existentes (y para estadísticas/legacy no retiradas), pero NO
 * participa en la autorización de área: un empleado con `rol="mozo"` cuya área no
 * sea explícitamente "mozo" ya NO obtiene acceso de Mozo. La compatibilidad
 * histórica (sin_asignar + rol mozo → mozo) se cerró tras el backfill de datos
 * (migración `backfill_employee_operational_areas`).
 */
export function resolveAreaOperativaEfectiva(input: {
  areaOperativa: unknown
  rol: unknown
}): AreaOperativa {
  const area = normalizeAreaOperativa(input.areaOperativa)

  if (area === "mozo") return "mozo"
  if (area === "salon") return "salon"
  if (area === "pyr") return "pyr"

  return "sin_asignar"
}

/** True si el área efectiva del empleado es Mozo. */
export function esAreaMozoEfectiva(input: { areaOperativa: unknown; rol: unknown }): boolean {
  return resolveAreaOperativaEfectiva(input) === "mozo"
}
