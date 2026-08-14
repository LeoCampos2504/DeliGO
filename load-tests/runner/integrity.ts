// Read-only integrity validation for Fase B/C fixtures. DB access is always
// gated by DELIGO_TEST_DATABASE_URL; DATABASE_URL is never a fallback.
import type { FixtureManifest } from "../seed/manifest"

function requireTestDatabaseUrl(): string {
  const value = process.env.DELIGO_TEST_DATABASE_URL
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error("TEST_DB_HARD_GATE: DELIGO_TEST_DATABASE_URL no está disponible para integrity")
  }
  return value
}

export interface IntegrityVerdict {
  pedidoId: string | null
  pedidosMatchingIdempotencyKey: number
  belongsToCliente: boolean
  belongsToNegocio: boolean
  itemsBelongToPedido: boolean
  productoMatches: boolean
  estadoFinal: string | null
  estadoValid: boolean
  duplicateIdempotencyKey: boolean
  deudaTarifaReconciled: boolean
  allPass: boolean
}

export async function validateOneOrderIntegrity(manifest: FixtureManifest): Promise<IntegrityVerdict> {
  process.env.DATABASE_URL = requireTestDatabaseUrl()
  const { db } = await import("@/lib/db")
  const negocioId = manifest.negocioIds[0]
  const clienteId = manifest.clienteIds[0]
  const productoId = manifest.productoIds[0]
  const idempotencyKey = manifest.idempotencyKeys[0]
  if (!negocioId || !clienteId || !productoId || !idempotencyKey) throw new Error("Manifest incompleto")

  const matching = await db.pedido.findMany({ where: { negocioId, idempotencyKey }, include: { items: true } })
  const pedido = matching[0] ?? null
  const belongsToCliente = pedido ? pedido.clienteId === clienteId : false
  const belongsToNegocio = pedido ? pedido.negocioId === negocioId : false
  const itemsBelongToPedido = pedido ? pedido.items.length > 0 && pedido.items.every((item) => item.pedidoId === pedido.id) : false
  const productoMatches = pedido ? pedido.items.length > 0 && pedido.items.every((item) => item.productoId === productoId) : false
  const estadoFinal = pedido ? pedido.estado : null
  const estadoValid = estadoFinal === "entregado" && Boolean(pedido?.clienteConfirmaRecibido)
  const duplicateIdempotencyKey = matching.length > 1
  const negocio = await db.negocio.findUnique({ where: { id: negocioId }, select: { deudaTarifa: true } })
  const deudaTarifaReconciled = Boolean(pedido && negocio && Math.abs(negocio.deudaTarifa - pedido.tarifaServicio) < 0.0001)
  const allPass = matching.length === 1 && belongsToCliente && belongsToNegocio && itemsBelongToPedido && productoMatches && estadoValid && !duplicateIdempotencyKey && deudaTarifaReconciled
  return { pedidoId: pedido?.id ?? null, pedidosMatchingIdempotencyKey: matching.length, belongsToCliente, belongsToNegocio, itemsBelongToPedido, productoMatches, estadoFinal, estadoValid, duplicateIdempotencyKey, deudaTarifaReconciled, allPass }
}

export interface Compressed50IntegrityVerdict {
  totalExpectedOrders: number
  totalMatchedOrders: number
  duplicatedIdempotencyKeys: number
  missingOrders: number
  extraOrders: number
  relationalIntegrity: boolean
  noOrphanItems: boolean
  financialReconciliation: boolean
  unexpectedSessionRows: number
  sessionIntegrity: boolean
  finalStatesValid: boolean
  allPass: boolean
  pedidoIds: string[]
}

export async function validateCompressed50Integrity(manifest: FixtureManifest): Promise<Compressed50IntegrityVerdict> {
  process.env.DATABASE_URL = requireTestDatabaseUrl()
  const { db } = await import("@/lib/db")
  const negocioId = manifest.negocioIds[0]
  if (!negocioId || manifest.clienteIds.length < 50 || manifest.idempotencyKeys.length !== 50) {
    throw new Error("Manifest incompleto para COMPRESSED50")
  }
  const keys = new Set(manifest.idempotencyKeys)
  const allOrders = await db.pedido.findMany({
    where: { negocioId },
    include: { items: true },
    orderBy: { createdAt: "asc" },
  })
  const matched = allOrders.filter((order) => order.idempotencyKey && keys.has(order.idempotencyKey))
  const counts = new Map<string, number>()
  for (const order of matched) counts.set(order.idempotencyKey as string, (counts.get(order.idempotencyKey as string) ?? 0) + 1)
  const duplicated = [...counts.values()].filter((count) => count > 1).reduce((sum, count) => sum + count - 1, 0)
  const missing = manifest.idempotencyKeys.filter((key) => !counts.has(key)).length
  const extra = allOrders.filter((order) => !order.idempotencyKey || !keys.has(order.idempotencyKey)).length
  const pedidoIds = matched.map((order) => order.id)
  const relationalIntegrity = matched.length === 50 && matched.every((order) => order.negocioId === negocioId && Boolean(order.clienteId) && manifest.clienteIds.includes(order.clienteId as string) && order.items.length > 0 && order.items.every((item) => item.pedidoId === order.id && item.productoId === manifest.productoIds[0]))
  const noOrphanItems = matched.every((order) => order.items.every((item) => item.pedidoId === order.id))
  const finalStatesValid = matched.length === 50 && matched.every((order) => order.estado === "entregado" && order.clienteConfirmaRecibido)
  const negocio = await db.negocio.findUnique({ where: { id: negocioId }, select: { deudaTarifa: true } })
  const expectedDebt = matched.reduce((sum, order) => sum + order.tarifaServicio, 0)
  const financialReconciliation = Boolean(negocio && Math.abs(negocio.deudaTarifa - expectedDebt) < 0.0001)
  const sessionOwners = [...manifest.clienteIds, ...manifest.negocioIds, ...manifest.repartidorIds, ...manifest.cuentaOperativaIds]
  const sessionRows = await db.sesion.count({ where: { userId: { in: sessionOwners } } })
  const unexpectedSessionRows = Math.max(0, sessionRows - manifest.sessionTokenHashes.length)
  const sessionIntegrity = sessionRows === manifest.sessionTokenHashes.length
  const allPass = matched.length === 50 && duplicated === 0 && missing === 0 && extra === 0 && relationalIntegrity && noOrphanItems && financialReconciliation && finalStatesValid && sessionIntegrity
  return { totalExpectedOrders: 50, totalMatchedOrders: matched.length, duplicatedIdempotencyKeys: duplicated, missingOrders: missing, extraOrders: extra, relationalIntegrity, noOrphanItems, financialReconciliation, unexpectedSessionRows, sessionIntegrity, finalStatesValid, allPass, pedidoIds }
}

export async function validateRealistic20Integrity(manifest: FixtureManifest) {
  process.env.DATABASE_URL = requireTestDatabaseUrl()
  const { db } = await import("@/lib/db")
  const negocioId = manifest.negocioIds[0]
  const orderCount = negocioId ? await db.pedido.count({ where: { negocioId } }) : -1
  const expectedFixtureRows = manifest.clienteIds.length === 14 && manifest.negocioIds.length === 1 && manifest.repartidorIds.length === 2 && manifest.cuentaOperativaIds.length === 1
  return { noOrdersCreated: orderCount === 0, orderCount, expectedFixtureRows, allPass: orderCount === 0 && expectedFixtureRows }
}
