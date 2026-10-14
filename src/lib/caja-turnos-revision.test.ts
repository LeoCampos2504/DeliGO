import { describe, expect, test } from "bun:test"
import { Prisma } from "@prisma/client"
import { clasificarDiferencia, fingerprintRevision, normalizarObservacion } from "@/lib/caja-turnos-revision"

describe("F10-B2.2-D — exact review semantics", () => {
  test("classifies exact Decimal differences without float conversion", () => {
    expect(clasificarDiferencia(new Prisma.Decimal("0.00"))).toBe("COINCIDE")
    expect(clasificarDiferencia(new Prisma.Decimal("-0.01"))).toBe("FALTANTE")
    expect(clasificarDiferencia(new Prisma.Decimal("0.01"))).toBe("SOBRANTE")
  })

  test("normalizes optional observations and rejects oversized or non-text input", () => {
    expect(normalizarObservacion(undefined)).toBeNull()
    expect(normalizarObservacion("  revisado  ")).toBe("revisado")
    expect(normalizarObservacion(" ")).toBeNull()
    expect(normalizarObservacion("x".repeat(1001))).toBeUndefined()
    expect(normalizarObservacion(12)).toBeUndefined()
  })

  test("binds idempotency to business, shift and observation", () => {
    const base = fingerprintRevision("n1", "t1", "nota")
    expect(fingerprintRevision("n1", "t1", "nota")).toBe(base)
    expect(fingerprintRevision("n1", "t1", "otra")).not.toBe(base)
    expect(fingerprintRevision("n2", "t1", "nota")).not.toBe(base)
    expect(fingerprintRevision("n1", "t2", "nota")).not.toBe(base)
  })
})
