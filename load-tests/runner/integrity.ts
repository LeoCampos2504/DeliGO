// OBSERVABILITY + LOAD/PERFORMANCE CERTIFICATION — integrity check (baseline-one-order)
// ============================================
// Consulta PostgreSQL TESTING por negocioId+idempotencyKey EXACTA (nunca
// por rango/prefijo) y valida las propiedades mínimas de integridad de
// datos exigidas por el diseño (Fase A §29, Fase B §54-55). Mismo DB hard
// gate que el resto del runner (import dinámico después de fijar
// DATABASE_URL).

import type { FixtureManifest } from "../seed/manifest"

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
  const testDbUrl = process.env.DELIGO_TEST_DATABASE_URL
  if (!testDbUrl) {
    throw new Error("TEST_DB_HARD_GATE: DELIGO_TEST_DATABASE_URL no está definida — abortando integrity check.")
  }
  process.env.DATABASE_URL = testDbUrl

  const { db } = await import("@/lib/db")

  const negocioId = manifest.negocioIds[0]
  const clienteId = manifest.clienteIds[0]
  const productoId = manifest.productoIds[0]
  const idempotencyKey = manifest.idempotencyKeys[0]

  if (!negocioId || !clienteId || !productoId || !idempotencyKey) {
    throw new Error("Manifest incompleto para integrity check de baseline-one-order.")
  }

  const matching = await db.pedido.findMany({
    where: { negocioId, idempotencyKey },
    include: { items: true },
  })
  const pedidosMatchingIdempotencyKey = matching.length
  const pedido = matching[0] ?? null

  const belongsToCliente = pedido ? pedido.clienteId === clienteId : false
  const belongsToNegocio = pedido ? pedido.negocioId === negocioId : false
  const itemsBelongToPedido = pedido
    ? pedido.items.length > 0 && pedido.items.every((item) => item.pedidoId === pedido.id)
    : false
  const productoMatches = pedido ? pedido.items.every((item) => item.productoId === productoId) : false
  const estadoFinal = pedido ? pedido.estado : null
  const estadoValid = estadoFinal === "entregado"
  const duplicateIdempotencyKey = pedidosMatchingIdempotencyKey > 1

  let deudaTarifaReconciled = false
  if (pedido) {
    const negocio = await db.negocio.findUnique({ where: { id: negocioId }, select: { deudaTarifa: true } })
    // Negocio aislado de este run (creado por este mismo seed) — su
    // deudaTarifa debe ser EXACTAMENTE la tarifa de este único pedido
    // confirmado, nunca más ni menos.
    deudaTarifaReconciled = negocio ? negocio.deudaTarifa === pedido.tarifaServicio : false
  }

  const allPass =
    pedidosMatchingIdempotencyKey === 1 &&
    belongsToCliente &&
    belongsToNegocio &&
    itemsBelongToPedido &&
    productoMatches &&
    estadoValid &&
    !duplicateIdempotencyKey &&
    deudaTarifaReconciled

  return {
    pedidoId: pedido?.id ?? null,
    pedidosMatchingIdempotencyKey,
    belongsToCliente,
    belongsToNegocio,
    itemsBelongToPedido,
    productoMatches,
    estadoFinal,
    estadoValid,
    duplicateIdempotencyKey,
    deudaTarifaReconciled,
    allPass,
  }
}
