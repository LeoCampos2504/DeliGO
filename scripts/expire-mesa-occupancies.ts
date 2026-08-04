// DeliGO — Expiración automática de ocupaciones de mesa (P0-D.3C / P0-D.3C.1)
//
// Proceso de UNA sola corrida: procesa el lote pendiente y termina. Pensado
// como Start Command de un Railway Cron Service (nunca queda corriendo en
// segundo plano ni abre ningún puerto/endpoint):
//
//   bun run cron:mesa-occupancy-expiration
//
// No ejecutar este script apuntando a la base de datos real fuera de un
// entorno de cron controlado — usa DATABASE_URL del entorno tal cual la
// resuelve @/lib/db, sin ningún override ni parámetro de este script.

import { db } from "@/lib/db"
import { expireStaleMesaOccupancies, type ExpireStaleMesaOccupanciesResult } from "@/lib/mesa-occupancy-expiration"

// P0-D.3C.1: función pura y testeable — decide el código de salida a partir
// del resumen agregado, sin ejecutar el CLI ni tocar la base. `errors > 0`
// (una o más candidatas con un error inesperado, no de serialización)
// siempre produce exit 1. `conflicts` (P2034 agotado: concurrencia
// transitoria y esperada) NUNCA obliga por sí solo a exit 1 — queda visible
// en el resumen para que una corrida posterior reintente esas candidatas.
export function getExpirationExitCode(result: Pick<ExpireStaleMesaOccupanciesResult, "errors">): 0 | 1 {
  return result.errors > 0 ? 1 : 0
}

async function main(): Promise<void> {
  const startedAt = Date.now()
  const result = await expireStaleMesaOccupancies()
  const durationMs = Date.now() - startedAt

  // Única salida de resumen agregado y sanitizado por corrida — nunca IDs de
  // ocupación, mesa, negocio o empleado, ni cookies, hashes, tokens, objetos
  // de Prisma, arrays de errores individuales ni una línea por candidata.
  console.info("[MesaOccupancyExpiration]", { event: "mesa_occupancy_expiration_summary", ...result, durationMs })

  // Un error inesperado en una o más candidatas debe reflejarse en el código
  // de salida del proceso, aunque el barrido en sí haya terminado y
  // devuelto un resumen normalmente (nunca `process.exit()`, nunca antes
  // del `finally` de abajo).
  if (getExpirationExitCode(result) === 1) {
    process.exitCode = 1
  }
}

// Detección idiomática de Bun (`import.meta.main`): solo ejecuta `main()`
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
      console.error("[MesaOccupancyExpiration]", {
        event: "mesa_occupancy_expiration_fatal",
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
