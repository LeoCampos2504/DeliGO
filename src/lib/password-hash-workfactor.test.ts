/// <reference types="bun-types" />

// ============================================
// PASSWORD-HASH-WORKFACTOR-MIGRATION — matriz core (puro, sin DB)
// ============================================
// Cubre evaluatePasswordHash/comparePassword/hashPassword contra ambos
// formatos (legacy 100000 y v2 versionado). Los hashes legacy/v2 "a medida"
// (distintos work factors, malformados, etc.) se construyen localmente con
// la MISMA primitiva Web Crypto que usa src/lib/auth.ts — nunca se
// reimplementa PBKDF2 con una librería distinta, y nunca se inspeccionan las
// constantes internas del módulo (son privadas a propósito).

import { describe, expect, test } from "bun:test"
import { comparePassword, evaluatePasswordHash, hashPassword } from "./auth"

const KEY_LENGTH = 32
const SALT_LENGTH = 16

async function deriveKeyHex(password: string, saltHex: string, iterations: number): Promise<string> {
  const salt = hexToBytes(saltHex)
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"])
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" }, keyMaterial, KEY_LENGTH * 8)
  return bytesToHex(new Uint8Array(bits))
}

function bytesToHex(buffer: Uint8Array): string {
  return Array.from(buffer).map((b) => b.toString(16).padStart(2, "0")).join("")
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  return bytes
}

function randomSaltHex(): string {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(SALT_LENGTH)))
}

async function buildLegacyHash(password: string): Promise<string> {
  const saltHex = randomSaltHex()
  const keyHex = await deriveKeyHex(password, saltHex, 100_000)
  return `${saltHex}:${keyHex}`
}

async function buildV2Hash(password: string, iterations: number): Promise<string> {
  const saltHex = randomSaltHex()
  const keyHex = await deriveKeyHex(password, saltHex, iterations)
  return `v2$pbkdf2-sha256$${iterations}$${saltHex}$${keyHex}`
}

const PW = "TestPassword2026!"

describe("A-C: legacy — correct / wrong / needsUpgrade", () => {
  test("A: legacy + password correcta -> valid=true", async () => {
    const hash = await buildLegacyHash(PW)
    const result = await evaluatePasswordHash(PW, hash)
    expect(result.valid).toBe(true)
  })

  test("B: legacy + password incorrecta -> valid=false", async () => {
    const hash = await buildLegacyHash(PW)
    const result = await evaluatePasswordHash("wrong-password", hash)
    expect(result.valid).toBe(false)
    expect(result.needsUpgrade).toBe(false)
  })

  test("C: legacy válido -> needsUpgrade=true (siempre, está por debajo del work factor actual)", async () => {
    const hash = await buildLegacyHash(PW)
    const result = await evaluatePasswordHash(PW, hash)
    expect(result.valid).toBe(true)
    expect(result.needsUpgrade).toBe(true)
  })
})

describe("D-G: legacy — parser estricto", () => {
  test("D: forma legacy exacta (32 hex + ':' + 64 hex) es la única aceptada", async () => {
    const saltHex = randomSaltHex()
    const keyHex = await deriveKeyHex(PW, saltHex, 100_000)
    expect(saltHex.length).toBe(32)
    expect(keyHex.length).toBe(64)
    const hash = `${saltHex}:${keyHex}`
    const result = await evaluatePasswordHash(PW, hash)
    expect(result.valid).toBe(true)
  })

  test("E: un tercer ':' (contenido extra tras el hash legacy) -> malformed, valid=false", async () => {
    const hash = await buildLegacyHash(PW)
    const result = await evaluatePasswordHash(PW, `${hash}:extra`)
    expect(result.valid).toBe(false)
    expect(result.needsUpgrade).toBe(false)
  })

  test("F: hex inválido en salt o key -> valid=false, sin excepción", async () => {
    const badSalt = "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz" // 32 chars, no-hex
    const keyHex = "a".repeat(64)
    const result = await evaluatePasswordHash(PW, `${badSalt}:${keyHex}`)
    expect(result.valid).toBe(false)
  })

  test("G: longitudes incorrectas (salt corto, key largo, longitud impar) -> valid=false", async () => {
    const cases = [
      `${"a".repeat(31)}:${"b".repeat(64)}`, // salt corto
      `${"a".repeat(32)}:${"b".repeat(65)}`, // key largo
      `${"a".repeat(33)}:${"b".repeat(64)}`, // salt largo (impar total)
      "not-a-hash-at-all",
      "",
    ]
    for (const bad of cases) {
      const result = await evaluatePasswordHash(PW, bad)
      expect(result.valid).toBe(false)
      expect(result.needsUpgrade).toBe(false)
    }
  })
})

describe("H-J: v2 (work factor actual)", () => {
  test("H: v2 actual + password correcta -> valid=true", async () => {
    const hash = await hashPassword(PW)
    expect(hash.startsWith("v2$pbkdf2-sha256$600000$")).toBe(true)
    const result = await evaluatePasswordHash(PW, hash)
    expect(result.valid).toBe(true)
  })

  test("I: v2 actual + password incorrecta -> valid=false", async () => {
    const hash = await hashPassword(PW)
    const result = await evaluatePasswordHash("wrong-password", hash)
    expect(result.valid).toBe(false)
    expect(result.needsUpgrade).toBe(false)
  })

  test("J: v2 con work factor === actual (600000) -> needsUpgrade=false", async () => {
    const hash = await hashPassword(PW)
    const result = await evaluatePasswordHash(PW, hash)
    expect(result.valid).toBe(true)
    expect(result.needsUpgrade).toBe(false)
  })
})

describe("K-L: hashPassword — formato y unicidad", () => {
  test("K: hashPassword() siempre emite v2 (nunca legacy)", async () => {
    for (let i = 0; i < 3; i++) {
      const hash = await hashPassword(`sample-${i}-${PW}`)
      expect(hash).toMatch(/^v2\$pbkdf2-sha256\$600000\$[0-9a-f]{32}\$[0-9a-f]{64}$/)
    }
  })

  test("L: dos hashes del mismo password -> salts distintos, strings distintos", async () => {
    const h1 = await hashPassword(PW)
    const h2 = await hashPassword(PW)
    expect(h1).not.toBe(h2)
    const salt1 = h1.split("$")[3]
    const salt2 = h2.split("$")[3]
    expect(salt1).not.toBe(salt2)
    // Ambos deben seguir verificando el mismo password igual.
    expect((await evaluatePasswordHash(PW, h1)).valid).toBe(true)
    expect((await evaluatePasswordHash(PW, h2)).valid).toBe(true)
  })
})

describe("M-P: versión desconocida / v2 malformado / iteraciones fuera de rango", () => {
  test("M: versión desconocida (v1$..., v3$..., v99$...) -> FAIL CLOSED", async () => {
    const legacyHash = await buildLegacyHash(PW)
    const [saltHex, keyHex] = legacyHash.split(":")
    const unknownVersions = [
      `v1$pbkdf2-sha256$100000$${saltHex}$${keyHex}`,
      `v3$pbkdf2-sha256$600000$${saltHex}$${keyHex}`,
      `v99$pbkdf2-sha256$600000$${saltHex}$${keyHex}`,
    ]
    for (const bad of unknownVersions) {
      const result = await evaluatePasswordHash(PW, bad)
      expect(result.valid).toBe(false)
      expect(result.needsUpgrade).toBe(false)
    }
  })

  test("N: v2 con partes faltantes/sobrantes o algoritmo distinto -> false", async () => {
    const hash = await buildV2Hash(PW, 600_000)
    const parts = hash.split("$")
    const cases = [
      parts.slice(0, 4).join("$"), // faltan partes
      hash + "$extra", // sobra una parte
      `v2$argon2id$${parts[2]}$${parts[3]}$${parts[4]}`, // algoritmo no soportado
      `v2$PBKDF2-SHA256$${parts[2]}$${parts[3]}$${parts[4]}`, // sin alias, case-sensitive
    ]
    for (const bad of cases) {
      const result = await evaluatePasswordHash(PW, bad)
      expect(result.valid).toBe(false)
    }
  })

  test("O: v2 con hex inválido en salt/key -> false, sin excepción", async () => {
    const hash = await buildV2Hash(PW, 600_000)
    const parts = hash.split("$")
    const badSalt = `v2$${parts[1]}$${parts[2]}$${"z".repeat(32)}$${parts[4]}`
    const badKey = `v2$${parts[1]}$${parts[2]}$${parts[3]}$${"z".repeat(64)}`
    expect((await evaluatePasswordHash(PW, badSalt)).valid).toBe(false)
    expect((await evaluatePasswordHash(PW, badKey)).valid).toBe(false)
  })

  test("P: iterations no-decimal-canónico (ceros a la izquierda, negativo, no numérico, vacío) -> false, sin derivar", async () => {
    const hash = await buildV2Hash(PW, 600_000)
    const parts = hash.split("$")
    const badIterations = ["0600000", "-600000", "600000.0", "abc", "", "6e5"]
    for (const iter of badIterations) {
      const bad = `v2$${parts[1]}$${iter}$${parts[3]}$${parts[4]}`
      const result = await evaluatePasswordHash(PW, bad)
      expect(result.valid).toBe(false)
    }
  })

  test("Q: iterations por debajo del mínimo soportado (99999) -> false", async () => {
    // Construido manualmente (nunca generado por hashPassword) para simular
    // un valor corrupto/manipulado por debajo del piso soportado.
    const saltHex = randomSaltHex()
    const keyHex = await deriveKeyHex(PW, saltHex, 99_999)
    const hash = `v2$pbkdf2-sha256$99999$${saltHex}$${keyHex}`
    const result = await evaluatePasswordHash(PW, hash)
    expect(result.valid).toBe(false)
    expect(result.needsUpgrade).toBe(false)
  })

  test("R: iterations por encima del máximo soportado (2000001) -> false, sin derivar (evita costo arbitrario)", async () => {
    // No se deriva realmente con 2000001 iteraciones (sería lento y además
    // el parser debe rechazar el rango ANTES de derivar) — se construye el
    // string directamente con una key/salt cualquiera; el resultado debe
    // ser false de todas formas por el chequeo de rango, sin importar el
    // contenido de salt/key.
    const saltHex = randomSaltHex()
    const keyHex = "a".repeat(64)
    const hash = `v2$pbkdf2-sha256$2000001$${saltHex}$${keyHex}`
    const result = await evaluatePasswordHash(PW, hash)
    expect(result.valid).toBe(false)
    expect(result.needsUpgrade).toBe(false)
  })
})

describe("S: no-throw guarantee", () => {
  test("ninguna entrada malformada lanza una excepción", async () => {
    const inputs = [
      "",
      ":",
      "$",
      "v2$",
      "v2$pbkdf2-sha256$",
      "v2$pbkdf2-sha256$abc$salt$key",
      "null",
      "undefined",
      "🙂".repeat(50),
      "a".repeat(10000),
      ":".repeat(100),
      "$".repeat(100),
    ]
    for (const input of inputs) {
      let threw = false
      let result: { valid: boolean; needsUpgrade: boolean } | null = null
      try {
        result = await evaluatePasswordHash(PW, input)
      } catch {
        threw = true
      }
      expect(threw).toBe(false)
      expect(result?.valid).toBe(false)
    }
  })
})

describe("T-U: no downgrade / lower-v2 upgrades", () => {
  test("T: v2 con work factor MAYOR al actual (800000) + password correcta -> valid=true, needsUpgrade=false (NUNCA degradar)", async () => {
    const hash = await buildV2Hash(PW, 800_000)
    const result = await evaluatePasswordHash(PW, hash)
    expect(result.valid).toBe(true)
    expect(result.needsUpgrade).toBe(false)
  })

  test("v2 con el work factor máximo soportado exacto (2000000) + password correcta -> valid=true, needsUpgrade=false", async () => {
    const hash = await buildV2Hash(PW, 2_000_000)
    const result = await evaluatePasswordHash(PW, hash)
    expect(result.valid).toBe(true)
    expect(result.needsUpgrade).toBe(false)
  })

  test("U: v2 con work factor MENOR al actual (100000-599999) + password correcta -> valid=true, needsUpgrade=true", async () => {
    const hash = await buildV2Hash(PW, 300_000)
    const result = await evaluatePasswordHash(PW, hash)
    expect(result.valid).toBe(true)
    expect(result.needsUpgrade).toBe(true)
  })

  test("v2 en el piso exacto soportado (100000) + password correcta -> valid=true, needsUpgrade=true", async () => {
    const hash = await buildV2Hash(PW, 100_000)
    const result = await evaluatePasswordHash(PW, hash)
    expect(result.valid).toBe(true)
    expect(result.needsUpgrade).toBe(true)
  })
})

describe("comparePassword — wrapper delgado, compatibilidad de API preservada", () => {
  test("comparePassword sigue devolviendo boolean, coincide con evaluatePasswordHash(...).valid en todos los casos", async () => {
    const legacy = await buildLegacyHash(PW)
    const v2 = await hashPassword(PW)
    const malformed = "not-a-real-hash"

    expect(await comparePassword(PW, legacy)).toBe(true)
    expect(await comparePassword("wrong", legacy)).toBe(false)
    expect(await comparePassword(PW, v2)).toBe(true)
    expect(await comparePassword("wrong", v2)).toBe(false)
    expect(await comparePassword(PW, malformed)).toBe(false)
  })
})

describe("Semántica de password preservada (Password Policy congelada — no tocada acá)", () => {
  test("espacios se preservan (no trim)", async () => {
    const withSpaces = "  password con espacios  "
    const hash = await hashPassword(withSpaces)
    expect((await evaluatePasswordHash(withSpaces, hash)).valid).toBe(true)
    expect((await evaluatePasswordHash(withSpaces.trim(), hash)).valid).toBe(false)
  })

  test("Unicode se preserva (sin normalización NFC nueva)", async () => {
    const unicodePw = "contraseña-emoji-😀-ñ-é"
    const hash = await hashPassword(unicodePw)
    expect((await evaluatePasswordHash(unicodePw, hash)).valid).toBe(true)
  })

  test("case-sensitive (sin lowercase forzado)", async () => {
    const hash = await hashPassword("MixedCase123")
    expect((await evaluatePasswordHash("MixedCase123", hash)).valid).toBe(true)
    expect((await evaluatePasswordHash("mixedcase123", hash)).valid).toBe(false)
  })

  test("password legacy de 6 caracteres sigue verificando (sin política de longitud en el hashing)", async () => {
    const shortPw = "abc123"
    const hash = await buildLegacyHash(shortPw)
    const result = await evaluatePasswordHash(shortPw, hash)
    expect(result.valid).toBe(true)
    expect(result.needsUpgrade).toBe(true)
  })
})
