// OBSERVABILITY + LOAD/PERFORMANCE CERTIFICATION — FixtureManifest
// ============================================
// Contiene ÚNICAMENTE lo necesario para encontrar/borrar filas creadas por
// un run de certificación — nunca secrets. Los tokens crudos viven en un
// archivo separado, fuera del repo (ver runtime-pool.ts). Este archivo SÍ
// puede quedar en load-tests/results/<runId>/ (gitignored igualmente, pero
// no es sensible si llegara a persistir).

import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"

export interface FixtureManifest {
  runId: string
  createdAt: string
  scenario: string
  clienteIds: string[]
  negocioIds: string[]
  repartidorIds: string[]
  cuentaOperativaIds: string[]
  productoIds: string[]
  pedidoIds: string[]
  /** hash SHA-256 del token de sesión (nunca el token crudo) */
  sessionTokenHashes: string[]
  clienteBloqueadoIds: string[]
  loginThrottleKeys: string[]
  idempotencyKeys: string[]
}

export function emptyManifest(runId: string, scenario: string): FixtureManifest {
  return {
    runId,
    createdAt: new Date().toISOString(),
    scenario,
    clienteIds: [],
    negocioIds: [],
    repartidorIds: [],
    cuentaOperativaIds: [],
    productoIds: [],
    pedidoIds: [],
    sessionTokenHashes: [],
    clienteBloqueadoIds: [],
    loginThrottleKeys: [],
    idempotencyKeys: [],
  }
}

export function resultsDir(): string {
  return join(__dirname, "..", "results")
}

export function manifestPath(runId: string): string {
  return join(resultsDir(), runId, "fixture-manifest.json")
}

export function writeManifest(manifest: FixtureManifest): void {
  const path = manifestPath(manifest.runId)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(manifest, null, 2), "utf-8")
}

export function readManifest(path: string): FixtureManifest {
  if (!existsSync(path)) {
    throw new Error(`FixtureManifest no encontrado: ${path}`)
  }
  return JSON.parse(readFileSync(path, "utf-8")) as FixtureManifest
}
