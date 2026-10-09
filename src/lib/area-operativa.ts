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
  // F10-B1: Caja personal del cajero. Sólo negocios genéricos; NO exige Salón y
  // NO concede ninguna capacidad de Mozo, Salón ni PyR.
  "caja",
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
 *   4. areaOperativa === "caja"      → "caja" (F10-B1)
 *   5. "sin_asignar" / inválido      → "sin_asignar"
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
  if (area === "caja") return "caja"

  return "sin_asignar"
}

/**
 * Tarea 20: PyR personal es independiente de la capacidad de Salón. Todas
 * las demás áreas conservan el gate de Salón; en particular, `sin_asignar`
 * queda denegada por defecto y no amplía el acceso histórico.
 * F10-B1: `caja` tampoco depende de Salón (un almacén sin mesas vende igual).
 */
export function areaOperativaRequiereSalon(area: AreaOperativa): boolean {
  return area !== "pyr" && area !== "caja"
}

/**
 * F10-B1: rubro exigido por el área `caja` — mismo valor que la autoridad de
 * negocios genéricos (`STOCK_LIFECYCLE_RUBRO`; un contrato estático verifica que
 * coincidan). Se repite como literal para que este helper siga siendo PURO.
 */
export const AREA_CAJA_RUBRO = "negocio"

export function areaOperativaRequiereRubroGenerico(area: AreaOperativa): boolean {
  return area === "caja"
}

/**
 * Única regla de disponibilidad de un área para un negocio: gate de Salón para las
 * áreas que lo requieren y rubro genérico para `caja`. La usan el resolver personal
 * (resolveOperativoAreaForSlug), /api/operativo/me y la administración de empleados.
 */
export function areaOperativaDisponibleEnNegocio(
  area: AreaOperativa,
  negocio: { salonActivo: boolean | null | undefined; rubro: string | null | undefined }
): boolean {
  if (areaOperativaRequiereSalon(area) && negocio.salonActivo !== true) return false
  if (areaOperativaRequiereRubroGenerico(area) && negocio.rubro !== AREA_CAJA_RUBRO) return false
  return true
}

/** True si el área efectiva del empleado es Mozo. */
export function esAreaMozoEfectiva(input: { areaOperativa: unknown; rol: unknown }): boolean {
  return resolveAreaOperativaEfectiva(input) === "mozo"
}
