// ============================================
// T7-F1 — retiros personales: constantes y reglas PURAS compartidas por cliente y servidor
// ============================================
// Sin Prisma ni Node: lo importan el formulario de Caja y el servicio (retiros-personales-service.ts).

export const BENEFICIARIO_TIPOS = ["EMPLEADO", "FAMILIAR", "DUENO"] as const
export type BeneficiarioTipo = (typeof BENEFICIARIO_TIPOS)[number]
export const ETIQUETA_BENEFICIARIO: Record<BeneficiarioTipo, string> = { EMPLEADO: "Empleado", FAMILIAR: "Familiar", DUENO: "Dueño" }

export const RETIRO_OBSERVACIONES_MAX = 300
export const FAMILIAR_NOMBRE_MAX = 80
export const RETIRO_MOTIVO_MAX = 300
export const RETIRO_MAX_LINEAS = 100
/** Rango máximo de un resumen o listado (días). */
export const RETIRO_RANGO_MAX_DIAS = 400

/** Texto obligatorio del formulario: el retiro no es una venta. */
export const RETIRO_AVISO_SIN_DINERO = "Esta operación registra una salida de mercadería sin ingreso de dinero a Caja."

/** Nombre visible de un familiar: espacios colapsados. */
export function limpiarNombreFamiliar(nombre: string): string {
  return nombre.replace(/\s+/g, " ").trim()
}

/** Clave de identidad de un familiar: sin acentos, minúsculas, espacios colapsados (evita duplicados accidentales). */
export function normalizarNombreFamiliar(nombre: string): string {
  return limpiarNombreFamiliar(nombre).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}
