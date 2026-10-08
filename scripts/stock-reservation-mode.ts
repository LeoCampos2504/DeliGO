// DeliGO — P2-T56-R3A-I5-P0: comando interno de transición de modo de reservas.
//
// DRY-RUN por defecto (sólo lee e informa). Para ejecutar hacen falta además
// --execute y --confirm exacto. Toda escritura pasa por cambiarModoReservaStock
// (src/lib/stock-lifecycle.ts) dentro de runStockSerializable, con AuditLog en
// la misma transacción. Transiciones: OFF->ON, ON->DRAINING, DRAINING->OFF
// (esta última sólo con 0 reservas ACTIVA). Sólo entornos habilitados en
// STOCK_RESERVATION_OPS_ENVIRONMENTS (hoy: TESTING) y sólo contra la base cuya
// huella coincide. NO forma parte de ningún start/build/deploy/migración ni
// de ningún cron: se invoca a mano, con autorización explícita.
//
//   bun scripts/stock-reservation-mode.ts --env=TESTING --expect-db=<huella> \
//     --from=OFF --to=ON --actor-email=<superadmin> --reason="<motivo>" \
//     [--operation-ref=<id>] [--execute --confirm=OFF->ON]
//
// La salida es un único JSON sin credenciales ni URL de la base.

import { db } from "@/lib/db"
import { runStockSerializable } from "@/lib/stock-lifecycle"
import { prismaStockOpsDeps, runStockModeCommand } from "@/lib/stock-reservation-ops"

// Detección idiomática de Bun (`import.meta.main`): sólo corre como proceso
// principal, nunca al importarse.
if (import.meta.main) {
  const deps = prismaStockOpsDeps(db, (fn) => runStockSerializable(db, fn))
  runStockModeCommand(process.argv.slice(2), deps)
    .then((outcome) => {
      console.log(JSON.stringify(outcome.output, null, 2))
      process.exitCode = outcome.exitCode
    })
    .catch((error: unknown) => {
      console.error(JSON.stringify({ command: "stock-reservation-mode", result: "ERROR", errorName: error instanceof Error ? error.name : typeof error }))
      process.exitCode = 1
    })
    .finally(async () => {
      await db.$disconnect()
    })
}
