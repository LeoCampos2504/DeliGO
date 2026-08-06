import { ESTADOS_PENDIENTES_MESA } from "@/lib/mesa-cuenta"

// ============================================
// DeliGO — Capacidad "Salón" del negocio (Tarea 20)
// ============================================
// Única fuente de verdad, client-safe, para "¿este negocio tiene Salón
// habilitado?". Reutiliza el campo YA EXISTENTE `Negocio.salonActivo`
// (Prisma) — ya funcionaba de hecho como esta capacidad: gatea la geocerca
// pública de mesa (mesa-geofence), la cuenta pública de mesa (mesa-cuenta),
// el listado público de mesas (mesas-public) y el acceso operativo
// personal de Mozo/Salón (resolveOperativoAreaForSlug). Esta tarea no crea
// ningún campo nuevo — centraliza el chequeo en un único lugar y CIERRA los
// puntos donde antes se confiaba en el booleano sin revalidar dentro de la
// operación segura (creación de pedido de mesa, apertura de ocupación
// server-side, terminal de Salón, asignación de empleados a mozo/salón).
//
// Deny-by-default: cualquier valor que no sea estrictamente `true` (falso,
// `undefined`, `null`, un objeto malformado) se trata como "sin Salón".

export interface NegocioConSalonCapacidad {
  salonActivo: unknown
}

export function tieneSalonHabilitado(negocio: NegocioConSalonCapacidad | null | undefined): boolean {
  return negocio?.salonActivo === true
}

// Reexportado — nunca se duplica la allowlist de estados de mesa todavía
// mutables (misma que ya usan mesa-cuenta.ts/mesa-occupancy.ts/mesa-cliente-cuenta.ts).
export { ESTADOS_PENDIENTES_MESA }

export type SalonDesactivacionBloqueo = "ocupacion_activa" | "pedidos_pendientes"

/** Mensaje fijo y accionable — nunca expone ids, SQL ni detalles Prisma. */
export function mensajeBloqueoDesactivacionSalon(code: SalonDesactivacionBloqueo): string {
  switch (code) {
    case "ocupacion_activa":
      return "No podés desactivar el salón mientras haya mesas ocupadas. Cerrá las cuentas abiertas primero."
    case "pedidos_pendientes":
      return "No podés desactivar el salón mientras haya pedidos de mesa pendientes. Entregalos o cancelalos primero."
  }
}
