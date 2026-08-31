/// <reference types="bun-types" />

// ============================================
// IOS-STANDALONE-REAL-DEVICE-FIX-R3 §18 — contrato estático focal
// ============================================
// Protege que la instrumentación diagnóstica del restore de scroll sea
// puramente observacional: escribe un snapshot de sólo lectura en
// window.__iosScrollRestoreDebug exactamente en el punto donde la
// decisión YA se toma — nunca antes, nunca cambia qué decide
// decideScrollRestore ni cuándo se llama performRestore. No agrega
// setTimeout (prohibido por ios-scroll-restore-static-contract.test.ts,
// test C) ni cambia ningún comportamiento de restauración existente.
// REAL_IPHONE_VERIFICATION_REQUIRED=SI

import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const IOS_KEYBOARD_FIX = join(process.cwd(), "src", "components", "pwa", "ios-keyboard-fix.tsx")

describe("IOS-STANDALONE-REAL-DEVICE-FIX-R3 — instrumentación diagnóstica del restore", () => {
  test("A. el snapshot se escribe INMEDIATAMENTE después de decideScrollRestore, nunca antes de la decisión real", () => {
    const source = readFileSync(IOS_KEYBOARD_FIX, "utf-8")
    const decisionIdx = source.indexOf("const decision = decideScrollRestore(")
    const writeIdx = source.indexOf("window.__iosScrollRestoreDebug = {")
    expect(decisionIdx).toBeGreaterThan(-1)
    expect(writeIdx).toBeGreaterThan(decisionIdx)
    // La escritura debe ocurrir ANTES del if que actúa sobre la decisión,
    // pero después de calcularla — es decir, entre ambos.
    const actIdx = source.indexOf("if (decision.shouldRestore) {")
    expect(writeIdx).toBeLessThan(actIdx)
  })

  test("B. el snapshot refleja la decisión real, nunca la reescribe ni la condiciona", () => {
    const source = readFileSync(IOS_KEYBOARD_FIX, "utf-8")
    const writeBlock = source.slice(
      source.indexOf("window.__iosScrollRestoreDebug = {"),
      source.indexOf("if (decision.shouldRestore) {")
    )
    expect(writeBlock).toContain("shouldRestore: decision.shouldRestore")
    expect(writeBlock).toContain("restoreReason: decision.shouldRestore ? null : decision.reason")
    expect(writeBlock).toContain("restoreTargetScrollY: decision.shouldRestore ? decision.target : null")
    // `decision` es const — no puede reasignarse entre el cálculo y el uso.
    expect(source).toContain("const decision = decideScrollRestore(")
  })

  test("C. se limpia en el cleanup del efecto (no queda expuesto tras desmontar)", () => {
    const source = readFileSync(IOS_KEYBOARD_FIX, "utf-8")
    expect(source).toContain("delete window.__iosScrollRestoreDebug")
  })

  test("D. no introduce setTimeout (sigue prohibido por el contrato de restore existente)", () => {
    const source = readFileSync(IOS_KEYBOARD_FIX, "utf-8")
    expect(source).not.toMatch(/setTimeout/)
  })

  test("E. no captura valores de input/mensajes — sólo números de scroll y un motivo de texto fijo (los mismos ya devueltos por decideScrollRestore)", () => {
    const source = readFileSync(IOS_KEYBOARD_FIX, "utf-8")
    const declStart = source.indexOf("__iosScrollRestoreDebug?: {")
    const declEnd = source.indexOf("}", declStart)
    const decl = source.slice(declStart, declEnd)
    expect(decl).toContain("preFocusScrollY: number | null")
    expect(decl).toContain("currentScrollYAtDecision: number")
    expect(decl).toContain("shouldRestore: boolean")
    expect(decl).toContain("restoreReason: string | null")
    expect(decl).toContain("restoreTargetScrollY: number | null")
    expect(decl).not.toMatch(/value|message|token|password|email/i)
  })
})
