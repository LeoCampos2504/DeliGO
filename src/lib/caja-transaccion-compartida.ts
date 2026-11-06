// ============================================
// F4-C1 — composing Caja engines inside ONE Serializable transaction
// ============================================
// The sale engine (registrarVentaCajaEnTx) and the return engine
// (registrarDevolucionVentaEnTx) expose their in-transaction cores so a future
// F4-C operation can run both inside a single PostgreSQL Serializable
// transaction opened by one of the existing runners (runStockSerializable /
// runSerializable — same isolation level, same maxWait/timeout constants and
// the same serialization-conflict classifier, isStockSerializationConflict).
//
// A core reports a business refusal by RETURNING { ok: false, … } — it never
// throws for it, so a lone engine commits nothing but still answers normally.
// Inside a composed transaction that is not enough: an earlier core may have
// written rows already. exigirResultadoOk turns a refusal into a throw, which
// makes the runner roll the WHOLE transaction back (the abort is not a
// serialization conflict, so it is never retried); resolverAbortoCompartido,
// wrapped around the runner call, turns that throw back into the original
// refusal. Nothing here creates sales, returns, credits or money movements.

export type ResultadoRechazado = { ok: false; status: number; error: string; code?: string }

/** Thrown inside a composed transaction to roll it back with a business refusal. */
export class TransaccionCompartidaAbortada extends Error {
  readonly resultado: ResultadoRechazado

  constructor(resultado: ResultadoRechazado) {
    super(`Transacción compartida abortada: ${resultado.code ?? resultado.status}`)
    this.name = "TransaccionCompartidaAbortada"
    this.resultado = resultado
  }
}

/** Returns the successful result, or throws (→ full rollback) on a refusal. */
export function exigirResultadoOk<R extends { ok: boolean }>(resultado: R): Extract<R, { ok: true }> {
  if (!resultado.ok) throw new TransaccionCompartidaAbortada(resultado as unknown as ResultadoRechazado)
  return resultado as Extract<R, { ok: true }>
}

/**
 * Runs `ejecutar` (the runner call that opens the composed transaction) and
 * converts an abort raised by exigirResultadoOk into the refusal it carries.
 * Every other error propagates unchanged (stock errors, exhausted conflicts…).
 */
export async function resolverAbortoCompartido<T>(ejecutar: () => Promise<T>): Promise<T | ResultadoRechazado> {
  try {
    return await ejecutar()
  } catch (error) {
    if (error instanceof TransaccionCompartidaAbortada) return error.resultado
    throw error
  }
}
