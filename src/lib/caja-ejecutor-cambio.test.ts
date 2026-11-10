/// <reference types="bun-types" />

// F4-C4 — Serializable executor of exchanges (unit, no database): which errors
// are retried, how many times, the waits, the 2 s wait budget and the 10 s
// global limit, and that every attempt gets a timeout that fits in it.

import { describe, expect, test } from "bun:test"
import { Prisma } from "@prisma/client"
import {
  ConflictoCambioAgotado,
  ejecutarSerializableCambio,
  esConflictoSerializacion,
  esperaAntesDelReintento,
  esTimeoutTransaccion,
  POLITICA_CAMBIO,
} from "@/lib/caja-ejecutor-cambio"

const conflicto = () => new Prisma.PrismaClientKnownRequestError("Transaction failed due to a write conflict or a deadlock. Please retry your transaction", { code: "P2034", clientVersion: "test" })
const conflictoRaw = (code: string) => new Prisma.PrismaClientKnownRequestError("raw", { code: "P2010", clientVersion: "test", meta: { code } })
const timeout = () => new Prisma.PrismaClientKnownRequestError("Transaction already closed", { code: "P2028", clientVersion: "test" })

/** A fake client: each $transaction call runs `fn` and then applies the next scripted outcome. */
function fakeDb(outcomes: Array<"ok" | Error>) {
  const calls: Array<{ maxWait: number; timeout: number; isolationLevel: unknown }> = []
  let i = 0
  const db = {
    async $transaction(fn: (tx: unknown) => Promise<unknown>, options: { maxWait: number; timeout: number; isolationLevel: unknown }) {
      calls.push(options)
      const result = await fn({})
      const outcome = outcomes[Math.min(i++, outcomes.length - 1)]
      if (outcome instanceof Error) throw outcome
      return result
    },
  }
  return { db: db as unknown as Parameters<typeof ejecutarSerializableCambio>[0], calls }
}

function reloj() {
  let t = 0
  return { ahora: () => t, avanzar: (ms: number) => { t += ms }, esperas: [] as number[] }
}

describe("F4-C4 — ejecutarSerializableCambio", () => {
  test("classifies only serialization conflicts / deadlocks as retryable; a timeout is uncertain, never retried", () => {
    expect(esConflictoSerializacion(conflicto())).toBe(true)
    expect(esConflictoSerializacion(conflictoRaw("40001"))).toBe(true)
    expect(esConflictoSerializacion(conflictoRaw("40P01"))).toBe(true)
    expect(esConflictoSerializacion(conflictoRaw("23505"))).toBe(false)
    expect(esConflictoSerializacion(timeout())).toBe(false)
    expect(esConflictoSerializacion(new Error("negocio"))).toBe(false)
    expect(esTimeoutTransaccion(timeout())).toBe(true)
    expect(esTimeoutTransaccion(conflicto())).toBe(false)
  })

  test("success on the first attempt: Serializable, maxWait 2 s + timeout 8 s (= the 10 s global limit)", async () => {
    const { db, calls } = fakeDb(["ok"])
    const intentos: number[] = []
    const r = await ejecutarSerializableCambio(db, async (_tx, ctx) => { intentos.push(ctx.intento); return "hecho" })
    expect(r).toBe("hecho")
    expect(intentos).toEqual([1])
    expect(calls).toHaveLength(1)
    expect(calls[0]).toEqual({ isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 2_000, timeout: 8_000 })
    expect(calls[0].maxWait + calls[0].timeout).toBeLessThanOrEqual(POLITICA_CAMBIO.limiteGlobalMs)
  })

  test("retries conflicts with a random exponential wait and succeeds; attempt number is passed on", async () => {
    const clock = reloj()
    const { db } = fakeDb([conflicto(), conflicto(), "ok"])
    const intentos: number[] = []
    const r = await ejecutarSerializableCambio(db, async (_tx, ctx) => { intentos.push(ctx.intento); return ctx.intento }, {
      ahora: clock.ahora,
      aleatorio: () => 0.5,
      esperar: async (ms) => { clock.esperas.push(ms); clock.avanzar(ms) },
    })
    expect(r).toBe(3)
    expect(intentos).toEqual([1, 2, 3])
    expect(clock.esperas).toEqual([10, 20]) // 0.5 × min(250, 20·2^0) ; 0.5 × min(250, 20·2^1)
  })

  test("never more than 6 attempts; exhausted conflicts → ConflictoCambioAgotado (nothing written by any attempt)", async () => {
    const { db, calls } = fakeDb([conflicto()])
    const error = await ejecutarSerializableCambio(db, async () => "x", { aleatorio: () => 0, esperar: async () => {} }).catch((e) => e)
    expect(error).toBeInstanceOf(ConflictoCambioAgotado)
    expect((error as ConflictoCambioAgotado).intentos).toBe(6)
    expect(calls).toHaveLength(6)
  })

  test("a business error or a timeout propagates at once (no retry)", async () => {
    const negocio = new Error("rechazo de negocio")
    const a = fakeDb([negocio])
    expect(await ejecutarSerializableCambio(a.db, async () => "x").catch((e) => e)).toBe(negocio)
    expect(a.calls).toHaveLength(1)
    const t = timeout()
    const b = fakeDb([t])
    expect(await ejecutarSerializableCambio(b.db, async () => "x").catch((e) => e)).toBe(t)
    expect(b.calls).toHaveLength(1)
  })

  test("waits stay inside [0, min(250, 20·2^(n−1))) and inside the 2 s budget", () => {
    for (let n = 1; n <= 10; n++) {
      expect(esperaAntesDelReintento(POLITICA_CAMBIO, n, () => 0)).toBe(0)
      expect(esperaAntesDelReintento(POLITICA_CAMBIO, n, () => 0.999999999)).toBeLessThan(Math.min(250, 20 * 2 ** (n - 1)))
    }
    const total = [1, 2, 3, 4, 5].reduce((acc, n) => acc + esperaAntesDelReintento(POLITICA_CAMBIO, n, () => 0.999999), 0)
    expect(total).toBeLessThanOrEqual(POLITICA_CAMBIO.presupuestoEsperaMs)
  })

  test("global 10 s limit: slow attempts stop the retries and every attempt's maxWait+timeout fits the remaining time", async () => {
    const clock = reloj()
    const calls: Array<{ maxWait: number; timeout: number }> = []
    const db = {
      async $transaction(_fn: unknown, options: { maxWait: number; timeout: number }) {
        calls.push(options)
        clock.avanzar(4_000) // each attempt burns 4 s before conflicting
        throw conflicto()
      },
    } as unknown as Parameters<typeof ejecutarSerializableCambio>[0]
    const error = await ejecutarSerializableCambio(db, async () => "x", { ahora: clock.ahora, aleatorio: () => 0, esperar: async () => {} }).catch((e) => e)
    expect(error).toBeInstanceOf(ConflictoCambioAgotado)
    // t=0 → 10 s left; t=4 s → 6 s left; t=8 s → 2 s left; t=12 s → stop (< 1.5 s)
    expect(calls).toHaveLength(3)
    let inicio = 0
    for (const call of calls) {
      expect(call.maxWait + call.timeout).toBeLessThanOrEqual(POLITICA_CAMBIO.limiteGlobalMs - inicio)
      inicio += 4_000
    }
  })

  test("the accumulated wait never exceeds the 2 s budget", async () => {
    const politica = { ...POLITICA_CAMBIO, intentosMax: 50, esperaMaxMs: 900 }
    const clock = reloj()
    const { db, calls } = fakeDb([conflicto()])
    await ejecutarSerializableCambio(db, async () => "x", {
      politica,
      ahora: clock.ahora,
      aleatorio: () => 0.99,
      esperar: async (ms) => { clock.esperas.push(ms); clock.avanzar(ms) },
    }).catch(() => null)
    expect(clock.esperas.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(2_000)
    expect(calls.length).toBeLessThan(50)
  })
})
