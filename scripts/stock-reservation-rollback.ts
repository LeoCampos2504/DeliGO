// DeliGO — P2-T56-R3A-I5-P0: recuperación extraordinaria de reservas (hard rollback).
//
// DRY-RUN por defecto. Sólo con stockReservaModo=DRAINING, sólo por IDs
// exactos de UN negocio y sólo para reservas ACTIVA cuyo pedido ya está
// CANCELADO (anomalía). Un pedido pendiente se rechaza: se resuelve por el
// flujo normal (cancelar → libera; preparar → consume). Toda escritura pasa
// por liberarReservasPorRollback (src/lib/stock-lifecycle.ts) dentro de
// runStockSerializable, con AuditLog en la misma transacción. Nunca borra
// reservas ni toca stock. NO forma parte de ningún start/build/deploy/cron.
//
//   bun scripts/stock-reservation-rollback.ts --env=TESTING --expect-db=<huella> \
//     --negocio=<negocioId> --reserva-ids=<id1,id2> --actor-email=<superadmin> \
//     --reason="<motivo>" [--operation-ref=<id>] [--execute --confirm=ROLLBACK:<n>]

import { db } from "@/lib/db"
import { runStockSerializable } from "@/lib/stock-lifecycle"
import { prismaStockOpsDeps, runStockRollbackCommand } from "@/lib/stock-reservation-ops"

if (import.meta.main) {
  const deps = prismaStockOpsDeps(db, (fn) => runStockSerializable(db, fn))
  runStockRollbackCommand(process.argv.slice(2), deps)
    .then((outcome) => {
      console.log(JSON.stringify(outcome.output, null, 2))
      process.exitCode = outcome.exitCode
    })
    .catch((error: unknown) => {
      console.error(JSON.stringify({ command: "stock-reservation-rollback", result: "ERROR", errorName: error instanceof Error ? error.name : typeof error }))
      process.exitCode = 1
    })
    .finally(async () => {
      await db.$disconnect()
    })
}
