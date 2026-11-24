// ============================================
// Display name of an employee in the owner's Caja / shift views (display only)
// ============================================
// Kept as a compatibility entry point: the single identity rule now lives in
// src/lib/empleado-identidad.ts (BUG-001, 2026-11-24). A linked, non-deleted
// operational account's name wins — even over an inherited own name; without a
// usable link Empleado.nombre stays (the «Pendiente de vinculación» placeholder
// is then true). Never written to the database; no historical record changes.

export { EMPLEADO_NOMBRE_SELECT, NOMBRE_EMPLEADO_PENDIENTE, nombreVisibleEmpleado } from "@/lib/empleado-identidad"
export type { EmpleadoConNombre } from "@/lib/empleado-identidad"
