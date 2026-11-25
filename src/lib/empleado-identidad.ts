// ============================================
// Identidad visible de un empleado — regla ÚNICA para todas las vistas internas
// ============================================
// Un empleado (Empleado = vínculo persona↔negocio) puede estar vinculado a una
// CuentaOperativa (la persona, global). Por diseño (P2-T43-R2) la vinculación NO
// reescribe Empleado.nombre: un alta sin nombre conserva para siempre el marcador
// «Pendiente de vinculación» y un alta con nombre conserva ese nombre heredado.
//
// Regla (decisión del operador, 2026-11-24, BUG-001):
//   1. Vínculo activo (cuenta presente y no eliminada, con nombre) → CuentaOperativa.nombre,
//      aunque Empleado.nombre tenga otro nombre heredado.
//   2. Sin vínculo activo → Empleado.nombre tal cual (el marcador «Pendiente de
//      vinculación» es entonces verdad).
//   3. Sin dato utilizable → «Empleado».
// Sólo lectura: nunca se escribe en la base, nunca se renombra, nunca se tocan
// vínculos ni registros históricos. La proyección siempre parte de la fila
// Empleado del negocio consultado (nunca mezcla negocios).
// NO usar en superficies públicas (cliente final): exponen sólo Empleado.nombre.

import type { Prisma, PrismaClient } from "@prisma/client"

export const NOMBRE_EMPLEADO_PENDIENTE = "Pendiente de vinculación"

/** Select de Prisma para `empleado` en cualquier lugar donde se muestre su nombre. */
export const EMPLEADO_NOMBRE_SELECT = {
  nombre: true,
  cuentaOperativa: { select: { nombre: true, eliminado: true } },
} as const

export type EmpleadoConNombre = {
  nombre: string | null
  cuentaOperativa?: { nombre: string | null; eliminado: boolean } | null
} | null | undefined

/**
 * BUG-003 — superficies PÚBLICAS (cliente final): defensa del lado de la vista. Devuelve el texto sólo si es un
 * nombre no vacío y distinto del marcador «Pendiente de vinculación»; si no, null (la vista oculta el campo). Hoy las
 * rutas públicas no envían nombres de empleados (no existe un nombre de atención destinado al público); esto evita que
 * el marcador llegue a mostrarse aunque alguna respuesta lo traiga. Nunca usar datos de CuentaOperativa en público.
 */
export function nombrePublicoMostrable(nombre: unknown): string | null {
  if (typeof nombre !== "string") return null
  const t = nombre.trim()
  return t && t !== NOMBRE_EMPLEADO_PENDIENTE ? t : null
}

/** true si el empleado tiene una CuentaOperativa vinculada utilizable (no eliminada, con nombre). */
export function empleadoVinculado(empleado: EmpleadoConNombre): boolean {
  const cuenta = empleado?.cuentaOperativa
  return Boolean(cuenta && !cuenta.eliminado && (cuenta.nombre?.trim() ?? ""))
}

export function nombreVisibleEmpleado(empleado: EmpleadoConNombre): string {
  if (empleadoVinculado(empleado)) return empleado!.cuentaOperativa!.nombre!.trim()
  const propio = empleado?.nombre?.trim() ?? ""
  return propio || "Empleado"
}

type Db = PrismaClient | Prisma.TransactionClient

/**
 * Nombres visibles de varios empleados de UN negocio, por id. Los ids que no
 * pertenecen a ese negocio simplemente no aparecen en el mapa (aislamiento).
 */
export async function mapaNombresVisibles(db: Db, negocioId: string, ids: Iterable<string | null | undefined>): Promise<Map<string, string>> {
  const unicos = [...new Set([...ids].filter((x): x is string => typeof x === "string" && x.length > 0))]
  if (!unicos.length) return new Map()
  const filas = await db.empleado.findMany({ where: { negocioId, id: { in: unicos } }, select: { id: true, ...EMPLEADO_NOMBRE_SELECT } })
  return new Map(filas.map((e) => [e.id, nombreVisibleEmpleado(e)]))
}

/**
 * Para filas con una foto histórica de nombre (p. ej. pedidos con empleadoId + empleadoNombre) de UN negocio:
 * devuelve las mismas filas con
 *   - `empleadoNombre`: el nombre a MOSTRAR (la foto, o el nombre actual sólo si la foto es el marcador y la relación
 *     es inequívoca: mismo empleadoId, fila del MISMO negocio y vínculo activo);
 *   - `empleadoNombreRegistrado`: la foto original, intacta;
 *   - `empleadoNombreResuelto`: true cuando se mostró el nombre actual en lugar de la foto.
 * Nunca escribe en la base.
 */
export async function conNombresHistoricosVisibles<T extends { empleadoId?: string | null; empleadoNombre: string | null }>(
  db: Db,
  negocioId: string,
  filas: T[]
): Promise<Array<T & { empleadoNombreRegistrado: string | null; empleadoNombreResuelto: boolean }>> {
  const ids = [...new Set(filas.filter((f) => f.empleadoNombre?.trim() === NOMBRE_EMPLEADO_PENDIENTE && f.empleadoId).map((f) => f.empleadoId!))]
  const actuales = ids.length
    ? new Map((await db.empleado.findMany({ where: { negocioId, id: { in: ids } }, select: { id: true, ...EMPLEADO_NOMBRE_SELECT } })).map((e) => [e.id, e]))
    : new Map<string, EmpleadoConNombre>()
  return filas.map((f) => {
    const v = nombreHistoricoVisible(f.empleadoNombre, f.empleadoId ? actuales.get(f.empleadoId) : null)
    return { ...f, empleadoNombre: v.nombre, empleadoNombreRegistrado: f.empleadoNombre, empleadoNombreResuelto: v.resuelto }
  })
}

/**
 * Nombre a MOSTRAR para un nombre histórico guardado (p. ej. Pedido.empleadoNombre).
 * El dato histórico nunca se modifica. Sólo si la foto es exactamente el marcador
 * «Pendiente de vinculación» y hay una relación inequívoca con el empleado actual
 * (misma fila por id, del mismo negocio, resuelta por el llamador) se muestra el
 * nombre actualmente resuelto, y `resuelto` lo indica para no confundirlo con la
 * identidad registrada originalmente.
 */
export function nombreHistoricoVisible(guardado: string | null | undefined, empleadoActual: EmpleadoConNombre): { nombre: string | null; resuelto: boolean } {
  const foto = guardado ?? null
  if (foto?.trim() === NOMBRE_EMPLEADO_PENDIENTE && empleadoActual && empleadoVinculado(empleadoActual)) {
    return { nombre: nombreVisibleEmpleado(empleadoActual), resuelto: true }
  }
  return { nombre: foto, resuelto: false }
}
