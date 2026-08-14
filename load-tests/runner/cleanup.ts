// OBSERVABILITY + LOAD/PERFORMANCE CERTIFICATION — cleanup dirigido
// ============================================
// Borra ÚNICAMENTE las filas identificadas en un FixtureManifest — nunca
// TRUNCATE, nunca deleteMany sin where, nunca por prefijo global. Sesiones
// se borran por su hash EXACTO (nunca por userId — mismo principio ya
// aplicado en SESSION_LOGIN_ATOMICITY_DEBT: no arriesgar sesiones legítimas
// ajenas). Idempotente: correrlo dos veces es seguro (la segunda vez,
// 0 filas afectadas). Mismo DB hard gate que seed-pool.ts (ver ese archivo
// para la explicación de por qué los imports de Prisma son dinámicos).

import { readManifest, type FixtureManifest } from "../seed/manifest"
import { deleteRuntimePool, runtimePoolExists } from "../seed/runtime-pool"

export interface CleanupVerdict {
  remainingPedidos: number
  remainingSesiones: number
  remainingClienteBloqueado: number
  remainingLoginThrottle: number
  remainingProductos: number
  remainingClientes: number
  remainingNegocios: number
  remainingRepartidores: number
  remainingEmpleados: number
  remainingCuentasOperativas: number
  runtimeSecretsRemaining: boolean
  allClean: boolean
}

export async function cleanupByManifest(manifest: FixtureManifest): Promise<CleanupVerdict> {
  const testDbUrl = process.env.DELIGO_TEST_DATABASE_URL
  if (!testDbUrl) {
    throw new Error("TEST_DB_HARD_GATE: DELIGO_TEST_DATABASE_URL no está definida — abortando cleanup.")
  }
  process.env.DATABASE_URL = testDbUrl

  const { db } = await import("@/lib/db")
  const empleadoIds = manifest.empleadoIds ?? []

  if (manifest.pedidoIds.length) {
    await db.chatMensaje.deleteMany({ where: { pedidoId: { in: manifest.pedidoIds } } })
    await db.pedidoEvento.deleteMany({ where: { pedidoId: { in: manifest.pedidoIds } } })
    await db.resena.deleteMany({ where: { pedidoId: { in: manifest.pedidoIds } } })
    // PedidoItem cascadea con el Pedido (onDelete: Cascade) — se verifica igual abajo.
    await db.pedido.deleteMany({ where: { id: { in: manifest.pedidoIds } } })
  }

  if (manifest.sessionTokenHashes.length) {
    // Por hash EXACTO — nunca por userId.
    await db.sesion.deleteMany({ where: { token: { in: manifest.sessionTokenHashes } } })
  }

  if (manifest.clienteIds.length) {
    await db.clienteBloqueado.deleteMany({ where: { clienteId: { in: manifest.clienteIds } } })
  }

  if (manifest.loginThrottleKeys.length) {
    await db.loginThrottle.deleteMany({ where: { throttleKey: { in: manifest.loginThrottleKeys } } })
  }

  if (manifest.productoIds.length) {
    await db.producto.deleteMany({ where: { id: { in: manifest.productoIds } } })
  }
  if (manifest.clienteIds.length) {
    await db.cliente.deleteMany({ where: { id: { in: manifest.clienteIds } } })
  }
  if (empleadoIds.length) {
    await db.empleado.deleteMany({ where: { id: { in: empleadoIds } } })
  }
  if (manifest.negocioIds.length) {
    await db.negocio.deleteMany({ where: { id: { in: manifest.negocioIds } } })
  }
  if (manifest.repartidorIds.length) {
    await db.repartidor.deleteMany({ where: { id: { in: manifest.repartidorIds } } })
  }
  if (manifest.cuentaOperativaIds.length) {
    await db.cuentaOperativa.deleteMany({ where: { id: { in: manifest.cuentaOperativaIds } } })
  }

  const [
    remainingPedidos,
    remainingSesiones,
    remainingClienteBloqueado,
    remainingLoginThrottle,
    remainingProductos,
    remainingClientes,
    remainingNegocios,
    remainingRepartidores,
    remainingEmpleados,
    remainingCuentasOperativas,
  ] = await Promise.all([
    manifest.pedidoIds.length ? db.pedido.count({ where: { id: { in: manifest.pedidoIds } } }) : 0,
    manifest.sessionTokenHashes.length ? db.sesion.count({ where: { token: { in: manifest.sessionTokenHashes } } }) : 0,
    manifest.clienteIds.length ? db.clienteBloqueado.count({ where: { clienteId: { in: manifest.clienteIds } } }) : 0,
    manifest.loginThrottleKeys.length ? db.loginThrottle.count({ where: { throttleKey: { in: manifest.loginThrottleKeys } } }) : 0,
    manifest.productoIds.length ? db.producto.count({ where: { id: { in: manifest.productoIds } } }) : 0,
    manifest.clienteIds.length ? db.cliente.count({ where: { id: { in: manifest.clienteIds } } }) : 0,
    manifest.negocioIds.length ? db.negocio.count({ where: { id: { in: manifest.negocioIds } } }) : 0,
    manifest.repartidorIds.length ? db.repartidor.count({ where: { id: { in: manifest.repartidorIds } } }) : 0,
    empleadoIds.length ? db.empleado.count({ where: { id: { in: empleadoIds } } }) : 0,
    manifest.cuentaOperativaIds.length ? db.cuentaOperativa.count({ where: { id: { in: manifest.cuentaOperativaIds } } }) : 0,
  ])

  deleteRuntimePool(manifest.runId)
  const runtimeSecretsRemaining = runtimePoolExists(manifest.runId)

  const allClean =
    remainingPedidos === 0 &&
    remainingSesiones === 0 &&
    remainingClienteBloqueado === 0 &&
    remainingLoginThrottle === 0 &&
    remainingProductos === 0 &&
    remainingClientes === 0 &&
    remainingNegocios === 0 &&
    remainingRepartidores === 0 &&
    remainingEmpleados === 0 &&
    remainingCuentasOperativas === 0 &&
    !runtimeSecretsRemaining

  return {
    remainingPedidos,
    remainingSesiones,
    remainingClienteBloqueado,
    remainingLoginThrottle,
    remainingProductos,
    remainingClientes,
    remainingNegocios,
    remainingRepartidores,
    remainingEmpleados,
    remainingCuentasOperativas,
    runtimeSecretsRemaining,
    allClean,
  }
}

export async function disconnectCleanupDb(): Promise<void> {
  const { db } = await import("@/lib/db")
  await db.$disconnect()
}

// Invocación manual: `bun run load-tests/runner/cleanup.ts --manifest <path>`
// (recuperación de crash — el wrapper murió antes de correr su propio cleanup).
if (import.meta.main) {
  const args = process.argv.slice(2)
  const idx = args.indexOf("--manifest")
  const manifestPath = idx >= 0 ? args[idx + 1] : undefined
  if (!manifestPath) {
    console.error("Uso: bun run load-tests/runner/cleanup.ts --manifest <path>")
    process.exit(1)
  }
  const manifest = readManifest(manifestPath)
  cleanupByManifest(manifest)
    .then(async (verdict) => {
      console.log(JSON.stringify(verdict, null, 2))
      await disconnectCleanupDb()
      process.exit(verdict.allClean ? 0 : 1)
    })
    .catch(async (err) => {
      console.error("CLEANUP_FAILED", err)
      await disconnectCleanupDb().catch(() => {})
      process.exit(1)
    })
}
