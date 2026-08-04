import { db } from "@/lib/db"
import { MESA_OCCUPANCY_MAX_DURATION_MS, runSerializableTransaction, isSerializationConflict } from "@/lib/mesa-occupancy"

// ============================================
// DeliGO — Expiración automática de ocupaciones de mesa (P0-D.3C)
// ============================================
// Cierre técnico por límite máximo absoluto de tiempo, contado exclusivamente
// desde `iniciadaEn` (nunca desde `ultimaActividadEn`): una ocupación nunca
// vive más de MESA_OCCUPANCY_MAX_DURATION_MS sin importar cuánta actividad,
// pedidos o credenciales nuevas haya tenido. Pensado para ejecutarse desde
// un proceso de una sola corrida (Railway Cron Service) — ver
// scripts/expire-mesa-occupancies.ts. Nunca toca pedidos, pagos, tickets ni
// el cierre comercial de la cuenta; reutiliza el mismo motor de transacción
// Serializable + reintento P2034 que ya usa el cierre manual de P0-D.3A
// (runSerializableTransaction, exportado desde src/lib/mesa-occupancy.ts),
// sin duplicarlo.

const DEFAULT_BATCH_LIMIT = 200

// Distintos de MANUAL_STAFF_CLOSE_REASON (P0-D.3A) — un cierre automático
// nunca debe poder confundirse en logs/reportes con un cierre humano.
const SYSTEM_CLOSE_ACTOR_TYPE = "sistema"
const MAX_DURATION_CLOSE_REASON = "max_duration_expired"

export interface ExpireStaleMesaOccupanciesOptions {
  /** Instante de referencia — inyectable para pruebas deterministas. Por defecto, `new Date()`. */
  now?: Date
  /** Tope de candidatas procesadas en esta corrida — nunca se cargan todas las ocupaciones activas en memoria. */
  batchLimit?: number
}

export interface ExpireStaleMesaOccupanciesResult {
  scanned: number
  expired: number
  skippedNotActive: number
  skippedNotDue: number
  skippedPointerChanged: number
  conflicts: number
  errors: number
}

// Error de dominio interno: bajo aislamiento Serializable, si ya confirmamos
// dentro de la MISMA transacción que la sesión está "activa" y que
// Mesa.ocupacionActualId apunta exactamente a ella, los `updateMany`
// posteriores con esa misma condición deberían afectar siempre exactamente
// una fila — que no lo hagan indicaría una inconsistencia que este proceso
// nunca debe intentar reparar en silencio. Se cuenta como error, nunca como
// "expired".
class MesaOccupancyExpirationInconsistentError extends Error {}

type CandidateOutcome = "expired" | "not_active" | "not_due" | "pointer_changed"

interface OccupancyCandidate {
  id: string
  mesaId: string
  negocioId: string
}

/**
 * Revalida y, si corresponde, cierra UNA candidata dentro de su propia
 * transacción Serializable. Nunca confía en la lectura del barrido inicial
 * como autorización — vuelve a leer todo dentro de la transacción. Orden de
 * escritura (mismo que closeMesaOccupancy, P0-D.3A, para evitar deadlocks):
 * 1) SesionOcupacionMesa, 2) CredencialOcupacionMesa, 3) Mesa.
 */
async function expireOneCandidate(candidate: OccupancyCandidate, now: Date, cutoff: Date): Promise<CandidateOutcome> {
  return runSerializableTransaction(
    async (tx) => {
      // 1) Releer la sesión por su ID — nunca asumir que sigue igual que en
      // el barrido inicial.
      const ocupacion = await tx.sesionOcupacionMesa.findUnique({ where: { id: candidate.id } })
      if (!ocupacion || ocupacion.mesaId !== candidate.mesaId || ocupacion.negocioId !== candidate.negocioId) {
        // Ya no existe, o (defensivo) no coincide con la mesa/negocio del
        // barrido inicial — nunca se cierra sobre datos que no coinciden.
        return "not_active"
      }
      if (ocupacion.estado !== "activa") {
        // Ya fue cerrada por otra corrida concurrente, por personal (P0-D.3A/B),
        // o por una corrida anterior de este mismo proceso — idempotente.
        return "not_active"
      }
      if (ocupacion.iniciadaEn > cutoff) {
        // Caso obligatorio de no-extensión: aunque `ultimaActividadEn` sea
        // reciente, la única fecha que importa es `iniciadaEn`. Si ya no está
        // vencida respecto del mismo cutoff (p. ej. el lote se procesó tarde
        // y otra ocupación más nueva quedó mezclada — no debería pasar dado
        // que el barrido ya filtró por `iniciadaEn <= cutoff`, pero se
        // revalida igual dentro de la transacción), no se toca.
        return "not_due"
      }

      // 2) Releer la Mesa correspondiente — el puntero debe seguir apuntando
      // EXACTAMENTE a esta sesión. Si la mesa ya abrió una ocupación nueva
      // (o el puntero está limpio), nunca se cierra ni se toca la Mesa.
      const mesa = await tx.mesa.findUnique({
        where: { id: candidate.mesaId },
        select: { id: true, ocupacionActualId: true },
      })
      if (!mesa || mesa.ocupacionActualId !== candidate.id) {
        return "pointer_changed"
      }

      // 3) Primera escritura: la ocupación activa -> cerrada por el sistema.
      const ocupacionUpdate = await tx.sesionOcupacionMesa.updateMany({
        where: { id: candidate.id, estado: "activa" },
        data: {
          estado: "cerrada",
          cerradaEn: now,
          cerradaPorTipo: SYSTEM_CLOSE_ACTOR_TYPE,
          cerradaPorId: null,
          motivoCierre: MAX_DURATION_CLOSE_REASON,
        },
      })
      if (ocupacionUpdate.count !== 1) {
        throw new MesaOccupancyExpirationInconsistentError("No se pudo cerrar la ocupación esperada")
      }

      // 4) Segunda escritura: revocar todas las credenciales todavía
      // vigentes de ESTA ocupación. Cero es un resultado válido, nunca un error.
      await tx.credencialOcupacionMesa.updateMany({
        where: { ocupacionId: candidate.id, revocadaEn: null },
        data: { revocadaEn: now },
      })

      // 5) Tercera escritura: limpiar el puntero de Mesa, condicionado por ID
      // esperado (nunca solo por mesaId) — si otra ocupación nueva ya tomó el
      // puntero entre la lectura de arriba y este update, esto afecta 0 filas
      // y NUNCA se acepta como cierre válido (revierte toda la transacción).
      const mesaUpdate = await tx.mesa.updateMany({
        where: { id: candidate.mesaId, ocupacionActualId: candidate.id },
        data: { ocupacionActualId: null },
      })
      if (mesaUpdate.count !== 1) {
        throw new MesaOccupancyExpirationInconsistentError("No se pudo limpiar el puntero de Mesa")
      }

      // Nunca se toca `Pedido` en ningún punto de esta transacción — el
      // cierre es técnico, no comercial (mismo principio que P0-D.3A).
      return "expired"
    },
    { isRetryable: isSerializationConflict }
  )
}

/**
 * Barre ocupaciones activas cuya antigüedad (desde `iniciadaEn`, nunca desde
 * `ultimaActividadEn`) alcanzó o superó MESA_OCCUPANCY_MAX_DURATION_MS, y
 * cierra cada una de forma segura tras revalidarla en su propia transacción
 * Serializable. Pensado para ejecutarse una vez por invocación (ver
 * scripts/expire-mesa-occupancies.ts) — no programa ningún temporizador ni
 * queda corriendo en segundo plano.
 */
export async function expireStaleMesaOccupancies(
  options?: ExpireStaleMesaOccupanciesOptions
): Promise<ExpireStaleMesaOccupanciesResult> {
  const now = options?.now ?? new Date()
  const batchLimit =
    typeof options?.batchLimit === "number" && options.batchLimit > 0 ? Math.floor(options.batchLimit) : DEFAULT_BATCH_LIMIT
  const cutoff = new Date(now.getTime() - MESA_OCCUPANCY_MAX_DURATION_MS)

  const result: ExpireStaleMesaOccupanciesResult = {
    scanned: 0,
    expired: 0,
    skippedNotActive: 0,
    skippedNotDue: 0,
    skippedPointerChanged: 0,
    conflicts: 0,
    errors: 0,
  }

  // La consulta inicial NUNCA autoriza por sí sola el cierre — solo acota el
  // universo de candidatas a revalidar. Ordenadas por `iniciadaEn` ascendente
  // (las más viejas primero) y acotadas por `batchLimit`: nunca se cargan
  // todas las ocupaciones activas en memoria de una sola vez.
  const candidatas = await db.sesionOcupacionMesa.findMany({
    where: { estado: "activa", iniciadaEn: { lte: cutoff } },
    orderBy: { iniciadaEn: "asc" },
    take: batchLimit,
    select: { id: true, mesaId: true, negocioId: true },
  })

  result.scanned = candidatas.length

  for (const candidata of candidatas) {
    try {
      const outcome = await expireOneCandidate(candidata, now, cutoff)
      if (outcome === "expired") result.expired += 1
      else if (outcome === "not_active") result.skippedNotActive += 1
      else if (outcome === "not_due") result.skippedNotDue += 1
      else if (outcome === "pointer_changed") result.skippedPointerChanged += 1
    } catch (error) {
      if (isSerializationConflict(error)) {
        // Otra corrida (o este mismo proceso en un reintento agotado) ganó
        // la carrera sobre la misma fila — idempotente, no es un error real.
        result.conflicts += 1
      } else {
        // P0-D.3C.1: el servicio de dominio nunca loguea por candidata (ni
        // siquiera sanitizado) — se limita a devolver contadores. El único
        // punto de logging de todo el proceso es el resumen agregado del
        // CLI (ver scripts/expire-mesa-occupancies.ts), que ya incluye
        // `errors` en ese resumen único.
        result.errors += 1
      }
      // Nunca se detiene el lote por un error puntual — se sigue con la
      // próxima candidata (a menos que sea un fallo de infraestructura que
      // haga fallar también las siguientes, en cuyo caso cada una se cuenta
      // igual como error, sin lanzar y abortar toda la ejecución).
    }
  }

  return result
}
