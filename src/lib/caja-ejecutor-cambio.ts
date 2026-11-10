// ============================================
// F4-C4 — Serializable executor of the commercial exchange operations
// ============================================
// Decision D1 (operator, 2026-11-09): the exchange and the linked additional
// sale run in ONE PostgreSQL Serializable transaction with a bounded retry of
// their own. The existing runners of normal sales (runStockSerializable: 3
// attempts, no wait), returns, corrections and shifts (runSerializable: 8
// attempts, linear wait) are NOT changed.
//
// Policy:
//   - only a serialization conflict or a deadlock is retried (40001 / 40P01,
//     Prisma P2034 or a raw P2010 with that SQLSTATE). A business refusal, a
//     transaction timeout (P2028) or any other error propagates at once;
//   - up to 6 attempts; between attempts a random wait in
//     [0, min(250 ms, 20 ms × 2^(n−1))) ("full jitter"), so concurrent cashiers
//     stop colliding in lockstep (the F10-B2.1 pattern);
//   - at most 2 s of accumulated waiting;
//   - a global limit of 10 s for the WHOLE operation: each attempt receives a
//     connection wait (maxWait) and a transaction timeout that fit in the
//     remaining time, and no new attempt starts with less than 1.5 s left. The
//     first attempt gets maxWait 2 s + timeout 8 s.
//
// No ambiguous duplicates: every attempt is a complete transaction (rows,
// stock, cobros, ledger, notice and audit are all inside it), so a failed
// attempt leaves nothing behind; a retry re-runs the same function with the
// same Idempotency-Key, whose first step is the replay of an already
// committed exchange. A timeout is never retried here: its outcome is
// reported as uncertain and the client retries with the SAME key, which either
// replays the committed exchange or performs it once.

import { Prisma, type PrismaClient } from "@prisma/client"
import { isStockSerializationConflict } from "@/lib/stock-lifecycle"

export interface PoliticaEjecutorCambio {
  intentosMax: number
  esperaBaseMs: number
  esperaMaxMs: number
  presupuestoEsperaMs: number
  limiteGlobalMs: number
  maxWaitMs: number
  timeoutTxMs: number
  minimoIntentoMs: number
}

export const POLITICA_CAMBIO: PoliticaEjecutorCambio = Object.freeze({
  intentosMax: 6,
  esperaBaseMs: 20,
  esperaMaxMs: 250,
  presupuestoEsperaMs: 2_000,
  limiteGlobalMs: 10_000,
  maxWaitMs: 2_000,
  timeoutTxMs: 8_000,
  minimoIntentoMs: 1_500,
})

/** The serialization conflicts this executor retries (and nothing else). */
export function esConflictoSerializacion(error: unknown): boolean {
  if (isStockSerializationConflict(error)) return true
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2010") {
    const code = (error.meta as { code?: unknown } | undefined)?.code
    return code === "40P01"
  }
  return error instanceof Prisma.PrismaClientUnknownRequestError && /\b(40001|40P01)\b/.test(String(error.message))
}

/** An interactive-transaction timeout / closed transaction: the outcome must be treated as uncertain. */
export function esTimeoutTransaccion(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2028"
}

/** Retries exhausted (or the time budget spent) on serialization conflicts: nothing was written. */
export class ConflictoCambioAgotado extends Error {
  readonly intentos: number
  readonly causa: unknown

  constructor(intentos: number, causa: unknown) {
    super(`Conflicto concurrente persistente tras ${intentos} intento(s)`)
    this.name = "ConflictoCambioAgotado"
    this.intentos = intentos
    this.causa = causa
  }
}

export interface ContextoIntento {
  /** 1-based attempt number (recorded in the audit of the operation). */
  intento: number
}

export interface OpcionesEjecutorCambio {
  politica?: PoliticaEjecutorCambio
  /** Test seams: clock, sleep and random source. */
  ahora?: () => number
  esperar?: (ms: number) => Promise<void>
  aleatorio?: () => number
}

type ClienteTransaccional = Pick<PrismaClient, "$transaction">

/** Random wait before attempt n+1 (n = attempts already made). Exported for unit tests. */
export function esperaAntesDelReintento(politica: PoliticaEjecutorCambio, intentosHechos: number, aleatorio: () => number): number {
  const techo = Math.min(politica.esperaMaxMs, politica.esperaBaseMs * 2 ** (intentosHechos - 1))
  return Math.floor(Math.max(0, Math.min(0.999999, aleatorio())) * techo)
}

export async function ejecutarSerializableCambio<T>(
  db: ClienteTransaccional,
  fn: (tx: Prisma.TransactionClient, contexto: ContextoIntento) => Promise<T>,
  opciones: OpcionesEjecutorCambio = {}
): Promise<T> {
  const politica = opciones.politica ?? POLITICA_CAMBIO
  const ahora = opciones.ahora ?? (() => Date.now())
  const esperar = opciones.esperar ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  const aleatorio = opciones.aleatorio ?? Math.random
  const inicio = ahora()
  let esperaAcumulada = 0
  let ultimoConflicto: unknown = null
  let intento = 0

  while (intento < politica.intentosMax) {
    const restante = politica.limiteGlobalMs - (ahora() - inicio)
    if (intento > 0 && restante < politica.minimoIntentoMs) break
    intento++
    const maxWait = Math.max(1, Math.min(politica.maxWaitMs, Math.floor(restante * 0.2)))
    const timeout = Math.max(1, Math.min(politica.timeoutTxMs, restante - maxWait))
    const numero = intento
    try {
      return await db.$transaction((tx) => fn(tx, { intento: numero }), {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait,
        timeout,
      })
    } catch (error) {
      if (!esConflictoSerializacion(error)) throw error
      ultimoConflicto = error
      if (intento >= politica.intentosMax) break
      const espera = esperaAntesDelReintento(politica, intento, aleatorio)
      if (esperaAcumulada + espera > politica.presupuestoEsperaMs) break
      if (ahora() - inicio + espera > politica.limiteGlobalMs - politica.minimoIntentoMs) break
      esperaAcumulada += espera
      if (espera > 0) await esperar(espera)
    }
  }
  throw new ConflictoCambioAgotado(intento, ultimoConflicto)
}
