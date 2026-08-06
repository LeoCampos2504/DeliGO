import { db } from "@/lib/db"
import { runSerializableTransaction } from "@/lib/mesa-occupancy"
import { ESTADOS_PENDIENTES_MESA, tieneSalonHabilitado } from "@/lib/negocio-salon-contract"

// ============================================
// DeliGO — Desactivación segura de Salón (Tarea 20)
// ============================================
// Único punto de escritura que puede pasar `Negocio.salonActivo` de
// `true` a `false`. Nunca cierra mesas, nunca cancela pedidos, nunca borra
// nada — solo BLOQUEA la desactivación mientras exista actividad de mesa
// real, y lo hace de forma atómica y consistente frente a una apertura de
// ocupación concurrente (ver comentario de `openOrReuseMesaOccupancyCore`
// en src/lib/mesa-occupancy.ts, que ahora también lee `salonActivo` DENTRO
// de la MISMA clase de transacción `Serializable`).
//
// Punto de linealización: la transacción `Serializable` completa. Bajo
// aislamiento serializable real de PostgreSQL, dos transacciones que se
// solapan de esta forma —
//   (A) esta función: LEE ocupaciones/pedidos de mesa, ESCRIBE Negocio;
//   (B) apertura de ocupación: LEE Negocio, ESCRIBE una ocupación nueva —
// forman un ciclo de dependencias lectura-escritura clásico ("write skew")
// que PostgreSQL bajo SERIALIZABLE detecta y aborta con un conflicto de
// serialización (nunca bajo REPEATABLE READ, que no lo detectaría) — la
// transacción perdedora se reintenta automáticamente vía
// `runSerializableTransaction` (mismo motor ya usado por toda la apertura/
// cierre de ocupaciones, no se duplica). Nunca queda una ocupación activa
// en un negocio sin Salón, ni una desactivación fantasma sobre datos ya
// obsoletos.

export type DesactivarSalonResultado =
  | { ok: true }
  | { ok: false; code: "ocupacion_activa" | "pedidos_pendientes" }

/**
 * Intenta desactivar Salón para `negocioId`. Idempotente: si ya estaba
 * desactivado, no hace nada y devuelve `{ ok: true }`. Nunca cierra
 * ocupaciones, nunca cancela pedidos, nunca borra mesas/QR/históricos —
 * solo escribe `salonActivo: false` cuando es seguro hacerlo.
 */
export async function desactivarSalonSiPermitido(negocioId: string): Promise<DesactivarSalonResultado> {
  return runSerializableTransaction(async (tx) => {
    const ocupacionesActivas = await tx.sesionOcupacionMesa.count({
      where: { negocioId, estado: "activa" },
    })
    if (ocupacionesActivas > 0) {
      return { ok: false, code: "ocupacion_activa" as const }
    }

    const pedidosPendientes = await tx.pedido.count({
      where: { negocioId, metodoEntrega: "mesa", estado: { in: [...ESTADOS_PENDIENTES_MESA] } },
    })
    if (pedidosPendientes > 0) {
      return { ok: false, code: "pedidos_pendientes" as const }
    }

    await tx.negocio.update({ where: { id: negocioId }, data: { salonActivo: false } })
    return { ok: true as const }
  })
}

/** Server-only: resuelve la capacidad leyendo el negocio por id — para endpoints que todavía no lo tienen cargado. */
export async function requireSalonHabilitado(negocioId: string): Promise<boolean> {
  const negocio = await db.negocio.findUnique({ where: { id: negocioId }, select: { salonActivo: true } })
  return tieneSalonHabilitado(negocio)
}
