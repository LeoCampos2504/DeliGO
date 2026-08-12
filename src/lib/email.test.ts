/// <reference types="bun-types" />

// ============================================
// GLOBAL-LOGS-PII-1 / 1B — email.ts: enmascarado de emails y eliminación
// de verification/reset secrets en logs runtime
// ============================================
// Cubre `maskEmailForLog` y el output real de consola de
// `sendVerificationEmail`/`sendPasswordResetEmail` en modo dev
// (RESEND_API_KEY ausente en este entorno — confirmado, nunca se envía un
// email real acá). Sentinels sintéticos, nunca datos reales.
//
// 1B: se retiró la aserción previa que consideraba "deseable" que el link de
// verificación sobreviviera en el log — un entorno de dev/testing también
// puede tener logs compartidos, CI output, terminal history o capturas de
// pantalla, así que el token/URL de verificación NUNCA debe aparecer, sin
// excepción por "sólo dev".

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { maskEmailForLog, sendPasswordResetEmail, sendVerificationEmail } from "./email"

describe("GLOBAL-LOGS-PII-1 — maskEmailForLog", () => {
  test("local-part largo: conserva sólo primer y último caracter", () => {
    expect(maskEmailForLog("secret-user-99@example.test")).toBe("s***9@example.test")
  })

  test("local-part corto (<=2 chars): conserva sólo el primer caracter", () => {
    expect(maskEmailForLog("ab@example.test")).toBe("a***@example.test")
  })

  test("nunca contiene el email completo en el resultado", () => {
    const sentinel = "user@example.test"
    const masked = maskEmailForLog(sentinel)
    expect(masked).not.toBe(sentinel)
    expect(masked).not.toContain("user@example.test")
  })

  test("preserva el dominio (señal operativa útil, no es secreto)", () => {
    expect(maskEmailForLog("cualquiera@dominio-de-prueba.test")).toContain("@dominio-de-prueba.test")
  })

  test("valor sin @ -> fallback seguro, nunca lanza", () => {
    expect(maskEmailForLog("no-es-un-email")).toBe("***")
  })
})

describe("GLOBAL-LOGS-PII-1B — sendVerificationEmail (modo dev, sin RESEND_API_KEY)", () => {
  const originalLog = console.log
  const originalError = console.error
  let captured: string[]

  beforeEach(() => {
    captured = []
    console.log = (...args: unknown[]) => {
      captured.push(args.map((a) => String(a)).join(" "))
    }
    console.error = (...args: unknown[]) => {
      captured.push(args.map((a) => String(a)).join(" "))
    }
  })

  afterEach(() => {
    console.log = originalLog
    console.error = originalError
  })

  test("el email completo NUNCA aparece en la salida de consola; el masked SÍ", async () => {
    const sentinelEmail = "secret-verification-target@example.test"
    const result = await sendVerificationEmail(sentinelEmail, "Usuario Sintetico", "fake-verification-token-123", "cliente")

    expect(result).toBe(true)
    const output = captured.join("\n")

    expect(output).not.toContain(sentinelEmail)
    expect(output).toContain(maskEmailForLog(sentinelEmail))
  })

  test("VERIFICATION_SECRET_NOT_LOGGED: ni el token ni la URL de verificación aparecen en ningún log", async () => {
    const sentinelToken = "verification-secret-token-123"
    const result = await sendVerificationEmail("otro-sentinel@example.test", "Usuario", sentinelToken, "negocio")

    expect(result).toBe(true)
    const output = captured.join("\n")

    // El token no debe aparecer en ninguna forma — ni crudo ni dentro de una URL.
    expect(output).not.toContain(sentinelToken)
    expect(output).not.toContain("verify-email?token=")
    expect(output).not.toContain("http://")
    expect(output).not.toContain("https://")

    // Señal operativa segura preservada: se sabe que el envío fue simulado.
    expect(output).toContain("[Email]")
    expect(output).toContain("simulated")
  })
})

describe("GLOBAL-LOGS-PII-1B — sendPasswordResetEmail (modo dev, sin RESEND_API_KEY)", () => {
  const originalLog = console.log
  const originalError = console.error
  let captured: string[]

  beforeEach(() => {
    captured = []
    console.log = (...args: unknown[]) => {
      captured.push(args.map((a) => String(a)).join(" "))
    }
    console.error = (...args: unknown[]) => {
      captured.push(args.map((a) => String(a)).join(" "))
    }
  })

  afterEach(() => {
    console.log = originalLog
    console.error = originalError
  })

  test("RESET_SECRET_NOT_LOGGED: ni el token ni la URL de reset aparecen en ningún log", async () => {
    const sentinelToken = "reset-secret-token-123"
    const result = await sendPasswordResetEmail("otro-sentinel@example.test", "Usuario", sentinelToken)

    // Comportamiento existente sin cambios: en modo dev, el reset real
    // devuelve `false` (nunca se considera "enviado") — el llamador
    // (forgot-password) depende de esto para revocar el token.
    expect(result).toBe(false)

    const output = captured.join("\n")
    expect(output).not.toContain(sentinelToken)
    expect(output).not.toContain("reset-password?token=")
    expect(output).not.toContain("http://")
    expect(output).not.toContain("https://")
  })
})
