// DeliGO — Vencimiento automático de solicitudes de revisión de reseñas (19-G)
//
// Proceso de UNA sola corrida: procesa el lote pendiente y termina. Pensado
// como Start Command de un Railway Cron Service (nunca queda corriendo en
// segundo plano ni abre ningún puerto/endpoint), mismo patrón que
// scripts/expire-mesa-occupancies.ts:
//
//   bun scripts/expire-review-moderation.ts
//
// No ejecutar este script apuntando a la base de datos real fuera de un
// entorno de cron controlado — usa DATABASE_URL del entorno tal cual la
// resuelve @/lib/db, sin ningún override ni parámetro de este script. Nunca
// acepta argumentos de CLI (IDs, batch, fechas, negocioId, solicitudId): el
// batch productivo siempre usa REVIEW_MODERATION_EXPIRY_BATCH_LIMIT, definido
// junto al core en src/lib/review-moderation-expiry.ts.

import { db } from "@/lib/db"
import { expireReviewModerationRequests, type ExpireReviewModerationRequestsResult } from "@/lib/review-moderation-expiry"

// `errors` son fallos inesperados reales de candidatas (p. ej. una
// inconsistencia de invariante que el core nunca intenta reparar en
// silencio) — deben reflejarse en el código de salida del proceso. Los
// conflictos de serialización (`conflicts`, P2034 agotado tras el reintento
// acotado del core) son concurrencia normal contra decisiones humanas
// (aprobar/rechazar/pedir información/aportar información) y NUNCA por sí
// solos convierten una corrida sana en un fallo del proceso — igual
// filosofía que getExpirationExitCode en scripts/expire-mesa-occupancies.ts.
export function getExpirationExitCode(result: Pick<ExpireReviewModerationRequestsResult, "errors">): 0 | 1 {
  return result.errors > 0 ? 1 : 0
}

async function main(): Promise<void> {
  const startedAt = Date.now()
  const result = await expireReviewModerationRequests()
  const durationMs = Date.now() - startedAt

  // Única salida de resumen agregado y sanitizado por corrida — nunca
  // solicitudId, resenaId, negocioId, nombres, emails, ni ningún dato de
  // Cliente, Pedido, evidencia, storageKey, Cloudinary o credenciales.
  console.info("[ReviewModerationExpiry]", { event: "review_moderation_expiry_summary", ...result, durationMs })

  // Nunca se fuerza la salida del proceso aquí: se deja que `finally` cierre
  // la conexión antes de que el proceso termine.
  if (getExpirationExitCode(result) === 1) {
    process.exitCode = 1
  }
}

// Detección idiomática de Bun (`import.meta.main`): sólo ejecuta `main()`
// cuando este archivo es el entrypoint real de `bun run`. Si otro módulo
// (p. ej. un test) lo importa únicamente para reutilizar
// `getExpirationExitCode`, no dispara ningún efecto secundario (no corre el
// barrido, no conecta ni desconecta Prisma).
if (import.meta.main) {
  main()
    .catch((error: unknown) => {
      process.exitCode = 1
      // Única línea fatal, sanitizada: nunca `error.message` (podría incluir
      // datos de conexión o de la base), nunca el objeto de error completo,
      // nunca un stack.
      console.error("[ReviewModerationExpiry]", {
        event: "review_moderation_expiry_fatal",
        errorName: error instanceof Error ? error.name : typeof error,
        prismaCode:
          error && typeof error === "object" && "code" in error && typeof (error as { code?: unknown }).code === "string"
            ? (error as { code: string }).code
            : undefined,
      })
    })
    .finally(async () => {
      await db.$disconnect()
    })
}
