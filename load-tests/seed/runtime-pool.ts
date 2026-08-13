// OBSERVABILITY + LOAD/PERFORMANCE CERTIFICATION — runtime secret pool
// ============================================
// Los tokens crudos (session tokens) NUNCA viven dentro del repo. Este
// archivo vive exclusivamente en %TEMP%\deligo-loadcert\<runId>\ (Windows) —
// si el runner muere, un token crudo ni siquiera aparece como untracked
// dentro del repo. Nunca se copia a load-tests/results/, nunca se imprime,
// se borra al finalizar el run (éxito, threshold fail, SIGINT/SIGTERM, o vía
// el comando de cleanup manual).

import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

export interface ActorIdentity {
  role: "cliente" | "negocio"
  /** índice estable dentro del pool — usado por exec.vu.idInTest / exec.scenario.iterationInTest */
  index: number
  id: string
  email: string
  /** token de sesión CRUDO — nunca el hash. Sólo vive en este archivo. */
  sessionToken: string
  /** sólo presente para el actor "negocio" — usado por el flujo de checkout */
  negocioSlug?: string
  productoId?: string
}

export interface RuntimePool {
  runId: string
  identities: ActorIdentity[]
  /** no es secreto (es sólo un UUID de idempotencia), pero viaja junto al pool para que k6 no tenga que generarlo por su cuenta — precomputado por el seed, tal como exige el diseño (§42 Fase B). */
  idempotencyKeys: string[]
}

export function runtimeDir(runId: string): string {
  // %TEMP% en Windows, /tmp equivalente en otros — siempre fuera del repo.
  return join(tmpdir(), "deligo-loadcert", runId)
}

export function runtimePoolPath(runId: string): string {
  return join(runtimeDir(runId), "runtime-secrets.json")
}

export function writeRuntimePool(pool: RuntimePool): string {
  const dir = runtimeDir(pool.runId)
  mkdirSync(dir, { recursive: true })
  const path = runtimePoolPath(pool.runId)
  // { identities: [...], idempotencyKeys: [...] } — `identities` es el
  // array que SharedArray de k6 exige (el callback debe devolver un ARRAY,
  // nunca el objeto raíz); `idempotencyKeys` se lee aparte, fuera de
  // SharedArray, con un JSON.parse(open(...)) simple (no es sensible ni
  // necesita el mecanismo de dato compartido de sólo lectura pesado).
  writeFileSync(
    path,
    JSON.stringify({ identities: pool.identities, idempotencyKeys: pool.idempotencyKeys }, null, 2),
    "utf-8"
  )
  return path
}

export function readRuntimePool(runId: string): RuntimePool {
  const path = runtimePoolPath(runId)
  if (!existsSync(path)) {
    throw new Error(`Runtime secret pool no encontrado: ${path}`)
  }
  const parsed = JSON.parse(readFileSync(path, "utf-8")) as { identities: ActorIdentity[]; idempotencyKeys: string[] }
  return { runId, identities: parsed.identities, idempotencyKeys: parsed.idempotencyKeys }
}

/** Borra el archivo de secrets Y el directorio efímero que lo contiene. */
export function deleteRuntimePool(runId: string): void {
  const dir = runtimeDir(runId)
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true })
  }
}

export function runtimePoolExists(runId: string): boolean {
  return existsSync(runtimePoolPath(runId))
}
