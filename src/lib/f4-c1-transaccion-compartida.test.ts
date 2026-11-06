/// <reference types="bun-types" />

// F4-C1 — unit checks of the composed-transaction helpers (no database).

import { describe, expect, test } from "bun:test"
import { Prisma } from "@prisma/client"
import { exigirResultadoOk, resolverAbortoCompartido, TransaccionCompartidaAbortada } from "@/lib/caja-transaccion-compartida"
import { isStockSerializationConflict, runStockSerializable } from "@/lib/stock-lifecycle"
import { runSerializable } from "@/lib/caja-devoluciones-service"

type FakeClient = { $transaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown>; calls: number }

function fakeClient(): FakeClient {
  const client: FakeClient = {
    calls: 0,
    async $transaction(fn) {
      client.calls++
      return fn({})
    },
  }
  return client
}

const rechazo = { ok: false as const, status: 409, error: "Esa cantidad ya fue devuelta.", code: "CANTIDAD_DEVOLUCION_EXCEDIDA" }

describe("F4-C1 — composed transaction helpers", () => {
  test("exigirResultadoOk returns a successful result unchanged", () => {
    const ok = { ok: true as const, value: 42 }
    expect(exigirResultadoOk(ok)).toBe(ok)
  })

  test("exigirResultadoOk throws the refusal it receives", () => {
    let thrown: unknown
    try {
      exigirResultadoOk(rechazo)
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(TransaccionCompartidaAbortada)
    expect((thrown as TransaccionCompartidaAbortada).resultado).toEqual(rechazo)
  })

  test("an abort is never mistaken for a serialization conflict (never retried)", () => {
    expect(isStockSerializationConflict(new TransaccionCompartidaAbortada(rechazo))).toBe(false)
    const conflict = new Prisma.PrismaClientKnownRequestError("conflict", { code: "P2034", clientVersion: "test" })
    expect(isStockSerializationConflict(conflict)).toBe(true)
  })

  for (const [name, runner] of [
    ["runStockSerializable", (c: FakeClient, fn: () => Promise<unknown>) => runStockSerializable(c as never, fn)],
    ["runSerializable", (c: FakeClient, fn: () => Promise<unknown>) => runSerializable(c as never, fn)],
  ] as const) {
    test(`${name}: an abort leaves the transaction on the first attempt and comes back as the refusal`, async () => {
      const client = fakeClient()
      const result = await resolverAbortoCompartido(() =>
        runner(client, async () => {
          exigirResultadoOk({ ok: true as const, value: "primer motor" })
          return exigirResultadoOk(rechazo)
        })
      )
      expect(result).toEqual(rechazo)
      expect(client.calls).toBe(1)
    })
  }

  test("resolverAbortoCompartido propagates every other error unchanged", async () => {
    const boom = new Error("unrelated")
    let thrown: unknown
    try {
      await resolverAbortoCompartido(async () => {
        throw boom
      })
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBe(boom)
  })
})
