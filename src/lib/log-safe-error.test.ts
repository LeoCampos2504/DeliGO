/// <reference types="bun-types" />

// ============================================
// GLOBAL-LOGS-PII-1B — safeErrorForLog
// ============================================
// Cubre los 3 escenarios exigidos: Prisma-like (P2002 y, sobre todo, el
// caso REAL demostrado de PrismaClientValidationError incluyendo valores
// crudos), provider-like (statusCode/body/endpoint/headers), y Error
// genérico con metadata anidada (cause/stack/propiedades extra). Todos los
// sentinels son sintéticos, nunca datos reales.

import { describe, expect, test } from "bun:test"
import { Prisma } from "@prisma/client"
import { safeErrorForLog } from "./log-safe-error"

const SENTINELS = [
  "secret-user-99@example.test",
  "Bearer secret-token-123",
  "session-secret-456",
  "203.0.113.77",
  "private-public-id-test",
  "sensitive-address-test",
]

function assertNoSentinelsLeaked(serialized: string) {
  for (const sentinel of SENTINELS) {
    expect(serialized).not.toContain(sentinel)
  }
}

describe("GLOBAL-LOGS-PII-1B — safeErrorForLog: Prisma P2002 (known request error)", () => {
  test("conserva code y target (nombres de campo); nunca el valor real", () => {
    // Contrato real de Prisma: el mensaje/meta de P2002 SÓLO trae nombres de
    // campo, nunca el valor que violó la constraint — igual se agrega el
    // sentinel al mensaje para demostrar que, aunque estuviera, el helper
    // jamás lo reenvía (defensa en profundidad).
    const error = new Prisma.PrismaClientKnownRequestError(
      `Unique constraint failed on the fields: (\`email\`) — attempted value ${SENTINELS[0]}`,
      { code: "P2002", clientVersion: "6.19.2", meta: { target: ["email"] } }
    )

    const result = safeErrorForLog(error)
    const serialized = JSON.stringify(result)

    expect(result.errorType).toBe("PrismaClientKnownRequestError")
    expect(result.code).toBe("P2002")
    expect(result.target).toEqual(["email"])
    assertNoSentinelsLeaked(serialized)
  })
})

describe("GLOBAL-LOGS-PII-1B — safeErrorForLog: PrismaClientValidationError (caso REAL demostrado)", () => {
  test("nunca reenvía .message — verificado empíricamente que Prisma SÍ embebe valores crudos ahí", () => {
    // Este es el escenario real reproducido contra PostgreSQL TESTING
    // durante la auditoría: un query mal tipado hace que Prisma renderice
    // el objeto `where`/`data` completo dentro de `.message`, incluyendo
    // el valor real pasado. El helper debe blindar esto sin excepción.
    const error = new Prisma.PrismaClientValidationError(
      `Invalid \`prisma.cliente.findUnique()\` invocation:\n\n{\n  where: {\n    email: "${SENTINELS[0]}",\n    thisFieldDoesNotExist: true\n  }\n}\n\nUnknown argument.`,
      { clientVersion: "6.19.2" }
    )

    const result = safeErrorForLog(error)
    const serialized = JSON.stringify(result)

    expect(result.errorType).toBe("PrismaClientValidationError")
    expect(result.message).toBeUndefined()
    assertNoSentinelsLeaked(serialized)
  })
})

describe("GLOBAL-LOGS-PII-1B — safeErrorForLog: provider-like (statusCode/body/endpoint/headers)", () => {
  test("statusCode visible; body/endpoint/headers/message con sentinels NUNCA visibles", () => {
    class FakeProviderError extends Error {
      statusCode = 410
      body = `{"error":"gone","echoed":"${SENTINELS[1]}"}`
      endpoint = `https://push.example.test/${SENTINELS[3]}`
      headers = { authorization: SENTINELS[1] }
      constructor() {
        super(`Provider request failed, endpoint=${SENTINELS[3]} body=${SENTINELS[1]}`)
        this.name = "FakeProviderError"
      }
    }
    const error = new FakeProviderError()

    const result = safeErrorForLog(error)
    const serialized = JSON.stringify(result)

    expect(result.errorType).toBe("FakeProviderError")
    expect(result.code).toBe(410)
    expect(result.message).toBeUndefined()
    assertNoSentinelsLeaked(serialized)
  })

  test("objeto plano (no Error) con forma de provider (statusCode/body) -> mismo tratamiento", () => {
    const plainProviderError = {
      statusCode: 429,
      body: `rate limited, retry token ${SENTINELS[1]}`,
    }

    const result = safeErrorForLog(plainProviderError)
    const serialized = JSON.stringify(result)

    expect(result.code).toBe(429)
    assertNoSentinelsLeaked(serialized)
  })
})

describe("GLOBAL-LOGS-PII-1B — safeErrorForLog: Error genérico con metadata anidada", () => {
  test("cause/stack/propiedades extra NUNCA se reenvían, sólo errorType + message", () => {
    const error = new Error("fallo interno de aplicación") as Error & {
      cause?: unknown
      extra?: unknown
    }
    error.cause = { token: SENTINELS[1], nested: { session: SENTINELS[2] } }
    error.extra = { ip: SENTINELS[3], publicId: SENTINELS[4], address: SENTINELS[5] }
    error.stack = `Error: fallo interno\n    at handler (${SENTINELS[3]})`

    const result = safeErrorForLog(error)
    const serialized = JSON.stringify(result)

    expect(result.errorType).toBe("Error")
    expect(result.message).toBe("fallo interno de aplicación")
    assertNoSentinelsLeaked(serialized)
    // Nunca se reenvían cause/stack/extra — el resultado sólo tiene 2 keys.
    expect(Object.keys(result).sort()).toEqual(["errorType", "message"])
  })

  test("valor no-Error (string/objeto plano de provider) -> nunca se serializa tal cual", () => {
    const weirdValue = { secret: SENTINELS[1], email: SENTINELS[0] }
    const result = safeErrorForLog(weirdValue)
    const serialized = JSON.stringify(result)

    assertNoSentinelsLeaked(serialized)
    expect(result.errorType).toBe("object")
    expect(Object.keys(result)).toEqual(["errorType"])
  })

  test("nunca lanza para ningún input (undefined/null/string)", () => {
    expect(() => safeErrorForLog(undefined)).not.toThrow()
    expect(() => safeErrorForLog(null)).not.toThrow()
    expect(() => safeErrorForLog("plain string error")).not.toThrow()
  })
})
