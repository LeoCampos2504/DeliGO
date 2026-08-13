/// <reference types="bun-types" />

// ============================================
// PASSWORD-POLICY-HARDENING — validatePassword (lógica pura)
// ============================================
// Sin DB, sin red — src/lib/password-policy.ts no depende de nada externo.
// Cubre los casos A-M pedidos por la tarea, más blocklist y la regresión de
// compatibilidad histórica (hashPassword/comparePassword de src/lib/auth.ts,
// que NUNCA deben importar ni aplicar esta política).

import { describe, expect, test } from "bun:test"
import { validatePassword, passwordCodePointLength } from "./password-policy"
import { hashPassword, comparePassword } from "./auth"
import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from "./password-policy-constants"

describe("validatePassword — longitud", () => {
  test("A. 9 caracteres -> reject (TOO_SHORT)", () => {
    const result = validatePassword("a".repeat(9))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe("TOO_SHORT")
  })

  test("B. 10 caracteres válidos -> accept", () => {
    const result = validatePassword("unaClaveOk")
    expect(result).toEqual({ ok: true })
  })

  test("H. 128 caracteres -> accept", () => {
    const result = validatePassword("a1".repeat(64)) // 128 chars, sin estar en la blocklist
    expect(result.ok).toBe(true)
  })

  test("I. 129 caracteres -> reject (TOO_LONG)", () => {
    const result = validatePassword("a1".repeat(64) + "x") // 129 chars
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe("TOO_LONG")
  })
})

describe("validatePassword — sin reglas de composición", () => {
  test("C. 10+ sin mayúscula -> accept", () => {
    expect(validatePassword("miclavelarga").ok).toBe(true)
  })

  test("D. 10+ sin número -> accept", () => {
    expect(validatePassword("solo letras aqui").ok).toBe(true)
  })

  test("E. 10+ sin símbolo -> accept", () => {
    expect(validatePassword("passphraseSinSimbolos").ok).toBe(true)
  })

  test("G. passphrase larga válida -> accept", () => {
    expect(validatePassword("mate dulce cada mañana").ok).toBe(true)
  })

  test("J. espacios internos -> accept (no se trimean ni rechazan)", () => {
    expect(validatePassword("una frase larga con espacios").ok).toBe(true)
  })
})

describe("validatePassword — blocklist local", () => {
  test("F. contraseña común de 10+ caracteres -> reject (COMMON_PASSWORD)", () => {
    const result = validatePassword("1234567890")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe("COMMON_PASSWORD")
  })

  test("§33 — 1234567890 -> reject", () => {
    expect(validatePassword("1234567890").ok).toBe(false)
  })

  test("§33 — password123 -> reject", () => {
    expect(validatePassword("password123").ok).toBe(false)
  })

  test("§33 — qwerty12345 -> reject", () => {
    expect(validatePassword("qwerty12345").ok).toBe(false)
  })

  test("§33 — variante DeliGO de 10+ -> reject", () => {
    expect(validatePassword("deligo123456").ok).toBe(false)
    expect(validatePassword("DeliGO123456").ok).toBe(false) // canonicaliza a lowercase
  })

  test("§33 — una passphrase normal NO queda rechazada por contener una palabra parcial de la blocklist", () => {
    // Contiene "admin" como substring pero el string completo no está en la
    // blocklist — debe aceptarse (comparación exacta, nunca por substring).
    expect(validatePassword("yo uso admin en el trabajo").ok).toBe(true)
    // Contiene "password" como substring dentro de una frase más larga.
    expect(validatePassword("mi password favorita es esta").ok).toBe(true)
  })
})

describe("validatePassword — Unicode y no transformación", () => {
  test("K. no trimea: espacios líder/final cuentan como caracteres reales", () => {
    // 8 letras + 2 espacios = 10 code points — sólo pasa si NO se trimea.
    const withSpaces = "  abcdefgh"
    expect(passwordCodePointLength(withSpaces)).toBe(10)
    expect(validatePassword(withSpaces).ok).toBe(true)
  })

  test("L. Unicode no explota (emoji, acentos, alfabetos no latinos)", () => {
    expect(() => validatePassword("contraseñaÑoño🎉🎉")).not.toThrow()
    expect(validatePassword("парольабвгдеёжз").ok).toBe(true) // cirílico, 16 code points
  })

  test("M. la longitud se calcula por code points Unicode, no por .length (UTF-16 code units)", () => {
    // Cada emoji de este bloque es un par subrogado: .length cuenta 2 por
    // emoji, Array.from()/passwordCodePointLength cuenta 1.
    const fiveEmojiPassword = "🎉🎊🎈🎁🎀" + "abcde" // 5 emoji + 5 letras = 10 code points
    expect(fiveEmojiPassword.length).toBe(15) // UTF-16: 5*2 + 5
    expect(passwordCodePointLength(fiveEmojiPassword)).toBe(10)
    expect(validatePassword(fiveEmojiPassword).ok).toBe(true)

    // Con sólo 4 emoji + 5 letras (9 code points) debe rechazarse por corta,
    // aunque .length (13) sea mayor a 10 — prueba que el conteo NO usa .length.
    const nineCodePoints = "🎉🎊🎈🎁" + "abcde"
    expect(nineCodePoints.length).toBe(13)
    expect(passwordCodePointLength(nineCodePoints)).toBe(9)
    const result = validatePassword(nineCodePoints)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe("TOO_SHORT")
  })
})

describe("PRE-COMMIT CORRECTION — paridad Unicode UI/server (§12 A-E)", () => {
  // Todas las contraseñas de este bloque son SOLO emoji (fuera del BMP: cada
  // uno ocupa un par subrogado en UTF-16, .length cuenta 2 por emoji) para
  // que la diferencia entre code points y code units sea máxima e inequívoca.
  const emoji = "🎉"

  test("A. 5 emojis -> codePointLength=5 -> reject (TOO_SHORT)", () => {
    const password = emoji.repeat(5)
    expect(passwordCodePointLength(password)).toBe(5)
    expect(password.length).toBe(10) // UTF-16: 5 pares subrogados
    const result = validatePassword(password)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe("TOO_SHORT")
  })

  test("B. 10 emojis -> codePointLength=10 -> accept (no está blocklisted)", () => {
    const password = emoji.repeat(10)
    expect(passwordCodePointLength(password)).toBe(10)
    expect(password.length).toBe(20)
    expect(validatePassword(password)).toEqual({ ok: true })
  })

  test("C. 128 emojis -> codePointLength=128 -> accept", () => {
    const password = emoji.repeat(128)
    expect(passwordCodePointLength(password)).toBe(128)
    expect(password.length).toBe(256)
    expect(validatePassword(password)).toEqual({ ok: true })
  })

  test("D. 129 emojis -> codePointLength=129 -> reject (TOO_LONG)", () => {
    const password = emoji.repeat(129)
    expect(passwordCodePointLength(password)).toBe(129)
    const result = validatePassword(password)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe("TOO_LONG")
  })

  test("E. mezcla acentos + ASCII + emoji: cliente y servidor miden con el mismo helper (passwordCodePointLength)", () => {
    // "café" (con acento compuesto NFD sería 2 code points para la é, pero
    // aquí usamos NFC precompuesto: 4 code points) + 5 ASCII + 2 emoji.
    const mixed = "caféABCDE" + emoji.repeat(2) // 9 + 2 = 11 code points
    expect(passwordCodePointLength(mixed)).toBe(11)
    expect(validatePassword(mixed)).toEqual({ ok: true })
    // La UI de cada flujo (registro/reset/cambio) importa esta MISMA función
    // desde @/lib/password-policy-constants — verificado por
    // password-policy-wiring-static-contract.test.ts, que confirma el import
    // literal en los 6 archivos y que src/lib/password-policy.ts no duplica
    // su propia versión de Array.from(password).length.
  })
})

describe("validatePassword — constantes centrales", () => {
  test("usa PASSWORD_MIN_LENGTH=10 y PASSWORD_MAX_LENGTH=128 desde el módulo de constantes", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(10)
    expect(PASSWORD_MAX_LENGTH).toBe(128)
  })
})

describe("Compatibilidad histórica — hashPassword/comparePassword NUNCA aplican la política nueva", () => {
  test("§29 — una contraseña histórica de 6 caracteres se hashea y verifica correctamente, sin ninguna validación de longitud", async () => {
    const legacyPassword = "abc123" // 6 caracteres, por debajo del nuevo mínimo de 10
    const hash = await hashPassword(legacyPassword)
    expect(await comparePassword(legacyPassword, hash)).toBe(true)
    expect(await comparePassword("wrongpw", hash)).toBe(false)
  })

  test("§29 — una contraseña histórica de 9 caracteres (justo bajo el nuevo mínimo) también verifica sin problema", async () => {
    const legacyPassword = "nine char"
    const hash = await hashPassword(legacyPassword)
    expect(await comparePassword(legacyPassword, hash)).toBe(true)
  })
})
