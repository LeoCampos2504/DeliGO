// DeliGO — F10-B2.0: backfill idempotente de las columnas de dinero exacto.
//
// DRY-RUN por defecto (sólo lee e informa cuántas filas tienen el *Decimal en
// NULL). Para escribir hacen falta --execute y --confirm=BACKFILL. Exige
// --expect-db=<huella> (sha256(system_identifier) truncado a 12) y aborta si
// la base no coincide. Misma regla que la migración 20261010120000:
// ROUND(float::numeric, 2) sólo donde el Decimal es NULL y el valor entra en
// NUMERIC(12,2); nunca toca las columnas Float. NO forma parte de
// start/build/deploy/migración ni de ningún cron: se invoca a mano, con
// autorización explícita (p. ej. tras el deploy que empieza a escribir doble).
//
//   bun scripts/money-decimal-backfill.ts --expect-db=<huella> [--execute --confirm=BACKFILL]
//
// La salida es un único JSON sin credenciales ni URL de la base.

import { createHash } from "node:crypto"
import { db } from "@/lib/db"
import { ejecutarMoneyBackfill, reportarMoneyBackfill } from "@/lib/money-backfill"

async function main(argv: string[]) {
  const arg = (name: string) => argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1]
  const expected = arg("expect-db")
  const execute = argv.includes("--execute")
  if (!expected) return { result: "ERROR", error: "--expect-db es obligatorio", exitCode: 2 }
  if (execute && arg("confirm") !== "BACKFILL") return { result: "ERROR", error: "--execute requiere --confirm=BACKFILL", exitCode: 2 }
  const sys = await db.$queryRaw<Array<{ id: string }>>`SELECT system_identifier::text AS id FROM pg_control_system()`
  const fingerprint = createHash("sha256").update(sys[0].id).digest("hex").slice(0, 12)
  if (fingerprint !== expected) return { result: "ABORTED_WRONG_DATABASE", fingerprint, exitCode: 3 }
  const tables = execute ? await ejecutarMoneyBackfill(db) : await reportarMoneyBackfill(db)
  return { result: execute ? "EXECUTED" : "DRY_RUN", fingerprint, tables, exitCode: 0 }
}

if (import.meta.main) {
  main(process.argv.slice(2))
    .then(({ exitCode, ...output }) => {
      console.log(JSON.stringify({ command: "money-decimal-backfill", ...output }, null, 2))
      process.exitCode = exitCode
    })
    .catch((error: unknown) => {
      console.error(JSON.stringify({ command: "money-decimal-backfill", result: "ERROR", errorName: error instanceof Error ? error.name : typeof error }))
      process.exitCode = 1
    })
    .finally(async () => {
      await db.$disconnect()
    })
}
