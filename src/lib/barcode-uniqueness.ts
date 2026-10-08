// ============================================
// F9 — server-side barcode uniqueness guard (one authority, 4 write paths)
// ============================================
// Rule (D3): inside one business, a code identifies at most one article
// across Producto AND ProductoVariante. Deleted products (eliminado=true)
// and their variants are excluded; inactive variants count. Different
// businesses may share a code. Keeping a row's own code is always valid,
// and a write that doesn't introduce/change a code never runs this guard,
// so historical duplicates never block unrelated edits.
//
// Atomicity: a plain "check, then save" races. Every write that introduces
// a code goes through `runBarcodeGuardedWrite`, which
//   1. opens ONE Serializable transaction with a bounded P2034 retry (same
//      explicit policy as R3A's runStockSerializable — maxWait 5 s, timeout
//      15 s, 3 attempts — but its own runner: this is not a stock operation,
//      so it stays out of R3A's exact runStockSerializable caller allowlist),
//   2. takes a transaction-scoped advisory lock per (business, canonical
//      code) — pg_advisory_xact_lock, auto-released at COMMIT/ROLLBACK,
//      keys hashed from a bound parameter (never interpolated SQL), sorted
//      so two writers claiming several codes can't deadlock each other,
//   3. re-reads the business's codes and rejects a conflict,
//   4. performs the write in that same transaction.
// Why both: under Serializable the transaction snapshot is taken when the
// lock statement STARTS, i.e. possibly before a concurrent writer commits,
// so the lock alone can't make the re-read see that writer. Correctness
// comes from every barcode writer being Serializable — PostgreSQL SSI then
// aborts the later writer (P2034), the bounded retry re-runs it with a
// fresh snapshot, and the re-read returns 409. The lock queues same-code
// writers so that retry is cheap. Verified against the real TESTING
// database in src/app/api/negocio/productos/route.barcode-uniqueness.test.ts.

import { Prisma, type PrismaClient } from "@prisma/client"
import {
  barcodeLookupKey,
  describeBarcodeConflict,
  findBarcodeConflict,
  findRepeatedBarcodes,
  type BarcodeConflict,
  type BarcodeConflictExclusion,
} from "@/lib/barcode"
type Tx = Prisma.TransactionClient

export const BARCODE_TX_MAX_ATTEMPTS = 3
export const BARCODE_TX_MAX_WAIT_MS = 5_000
export const BARCODE_TX_TIMEOUT_MS = 15_000

function isSerializationConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034"
}

/** Serializable interactive transaction, retried ONLY on P2034; the last P2034 is rethrown. */
async function runBarcodeSerializable<T>(client: Pick<PrismaClient, "$transaction">, fn: (tx: Tx) => Promise<T>): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= BARCODE_TX_MAX_ATTEMPTS; attempt++) {
    try {
      return await client.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: BARCODE_TX_MAX_WAIT_MS,
        timeout: BARCODE_TX_TIMEOUT_MS,
      })
    } catch (error) {
      if (!isSerializationConflict(error)) throw error
      lastError = error
    }
  }
  throw lastError
}

export const BARCODE_DUPLICATE_CODE = "CODIGO_BARRAS_DUPLICADO"

export class BarcodeDuplicateError extends Error {
  readonly status = 409
  readonly code = BARCODE_DUPLICATE_CODE
  constructor(message: string, readonly conflict: BarcodeConflict | null) {
    super(message)
    this.name = "BarcodeDuplicateError"
  }
}

export interface BarcodeClaim {
  /** The (already normalized, non-empty) code being written. */
  code: string
  /** The row being edited, whose current code is not a conflict. */
  exclude?: BarcodeConflictExclusion
}

/** Lock name per business + canonical code; hashed server-side to a bigint. */
export function barcodeLockName(negocioId: string, key: string): string {
  return `deligo:f9:barcode:${negocioId}:${key}`
}

async function lockBarcodeKeys(tx: Tx, negocioId: string, keys: ReadonlyArray<string>) {
  for (const key of [...new Set(keys)].sort()) {
    // $executeRaw: pg_advisory_xact_lock returns void, which $queryRaw can't deserialize.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${barcodeLockName(negocioId, key)}, 0))`
  }
}

/** Every live code of the business (deleted products excluded; inactive variants included). */
async function readBusinessBarcodes(tx: Tx, negocioId: string) {
  return tx.producto.findMany({
    where: { negocioId, eliminado: false },
    select: {
      id: true,
      nombre: true,
      codigoBarras: true,
      eliminado: true,
      variantes: { select: { id: true, nombre: true, codigoBarras: true, activo: true } },
    },
  })
}

/**
 * Runs `fn` atomically with the uniqueness check of `claims`. With no
 * claims it is just the shared Serializable transaction (no lock, no read).
 * Throws BarcodeDuplicateError (409) on a conflict, including a code
 * repeated inside the same request.
 */
export async function runBarcodeGuardedWrite<T>(
  client: Pick<PrismaClient, "$transaction">,
  params: { negocioId: string; claims: ReadonlyArray<BarcodeClaim> },
  fn: (tx: Tx) => Promise<T>
): Promise<T> {
  const repeated = findRepeatedBarcodes(params.claims.map((c) => c.code))
  if (repeated.length > 0) {
    throw new BarcodeDuplicateError(`El código de barras ${repeated[0]} está repetido en el formulario`, null)
  }
  const keys = params.claims.map((c) => barcodeLookupKey(c.code)).filter((k): k is string => k !== null)

  return runBarcodeSerializable(client, async (tx) => {
    if (keys.length > 0) {
      await lockBarcodeKeys(tx, params.negocioId, keys)
      const catalog = await readBusinessBarcodes(tx, params.negocioId)
      for (const claim of params.claims) {
        const conflict = findBarcodeConflict(catalog, claim.code, claim.exclude)
        if (conflict) throw new BarcodeDuplicateError(describeBarcodeConflict(conflict), conflict)
      }
    }
    return fn(tx)
  })
}

/** {status, body} for the guard's errors; null = not a barcode-guard error. */
export function mapBarcodeWriteError(
  error: unknown
): { status: number; body: { error: string; code: string; details?: Record<string, unknown> } } | null {
  if (error instanceof BarcodeDuplicateError) {
    const body: { error: string; code: string; details?: Record<string, unknown> } = {
      error: error.message,
      code: error.code,
    }
    if (error.conflict) {
      body.details = { productoId: error.conflict.productoId, varianteId: error.conflict.varianteId }
    }
    return { status: 409, body }
  }
  if (isSerializationConflict(error)) {
    return {
      status: 409,
      body: { error: "Otro cambio se guardó al mismo tiempo. Intentá nuevamente.", code: "CONFLICTO_CONCURRENTE" },
    }
  }
  return null
}
