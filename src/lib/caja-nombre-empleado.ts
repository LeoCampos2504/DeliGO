// ============================================
// Display name of an employee in the owner's Caja / shift views (display only)
// ============================================
// An employee created without a name keeps the placeholder below in
// Empleado.nombre until the owner renames it; once an operational account is
// linked, the person's real name lives in CuentaOperativa.nombre (the
// employees list already projects it). Shift views used to print
// Empleado.nombre as-is, so a linked cashier appeared as «Pendiente de
// vinculación». Rule (never written to the database, no historical record
// changes): a real own name wins; a placeholder/empty name falls back to the
// linked, non-deleted account's name; with no linked account the placeholder
// stays (it is then true).

export const NOMBRE_EMPLEADO_PENDIENTE = "Pendiente de vinculación"

/** Prisma select for `empleado` wherever a responsible name is shown. */
export const EMPLEADO_NOMBRE_SELECT = {
  nombre: true,
  cuentaOperativa: { select: { nombre: true, eliminado: true } },
} as const

export type EmpleadoConNombre = {
  nombre: string | null
  cuentaOperativa?: { nombre: string | null; eliminado: boolean } | null
} | null | undefined

export function nombreVisibleEmpleado(empleado: EmpleadoConNombre): string {
  const propio = empleado?.nombre?.trim() ?? ""
  if (propio && propio !== NOMBRE_EMPLEADO_PENDIENTE) return propio
  const cuenta = empleado?.cuentaOperativa && !empleado.cuentaOperativa.eliminado ? (empleado.cuentaOperativa.nombre?.trim() ?? "") : ""
  if (cuenta) return cuenta
  return propio || "Empleado"
}
