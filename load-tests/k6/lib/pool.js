// OBSERVABILITY + LOAD/PERFORMANCE CERTIFICATION — pool loader (k6 init context)
// ============================================
// Carga el pool de identidades UNA sola vez, compartido entre VUs, vía
// SharedArray + open() — patrón oficial de k6 para datos de sólo lectura
// grandes (confirmado contra la documentación oficial vigente antes de
// escribir este archivo). El callback de SharedArray DEBE devolver un
// ARRAY, nunca el objeto raíz — por eso runtime-pool.ts ya escribe
// { identities: [...] } y acá extraemos `.identities`.
//
// k6 NUNCA importa Prisma/@/lib/db/@/lib/auth — sólo lee este JSON, que fue
// generado por el orquestador Bun ANTES de que este proceso k6 arrancara.

import { SharedArray } from "k6/data"

const poolFile = __ENV.K6_POOL_FILE
if (!poolFile) {
  throw new Error("K6_POOL_FILE no está definida — el runner debe pasar la ruta absoluta al pool de identidades.")
}

export const identities = new SharedArray("loadcert-identities", function () {
  return JSON.parse(open(poolFile)).identities
})

// No es un array — no puede ir dentro de SharedArray (que exige que el
// callback devuelva un array). Se lee aparte con un JSON.parse(open(...))
// simple; no es dato sensible ni pesado, no necesita el mecanismo de dato
// compartido de sólo lectura.
export const idempotencyKeys = JSON.parse(open(poolFile)).idempotencyKeys

export function findIdentity(role, index) {
  const match = identities.find((identity) => identity.role === role && identity.index === index)
  if (!match) {
    throw new Error(`No se encontró identidad role=${role} index=${index} en el pool.`)
  }
  return match
}
