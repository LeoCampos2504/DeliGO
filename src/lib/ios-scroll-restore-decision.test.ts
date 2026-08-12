/// <reference types="bun-types" />

// ============================================
// IOS-24-POSITION-FIX — tests focales de la lógica pura de decisión
// ============================================

import { describe, expect, test } from "bun:test"
import { decideScrollRestore, resolveCycleStart } from "./ios-scroll-restore-decision"

const TOLERANCE = 2

describe("decideScrollRestore", () => {
  test("CASE 1: pre=0, post=465, sin scroll de usuario, teclado cerrado -> restaura a 0", () => {
    const decision = decideScrollRestore({
      preFocusScrollY: 0,
      currentScrollY: 465,
      userScrolledDuringCycle: false,
      hasEditableFocus: false,
      keyboardOpen: false,
      toleranceRestorePx: TOLERANCE,
    })
    expect(decision).toEqual({ shouldRestore: true, target: 0 })
  })

  test("CASE 2: pre=820, post=1285, sin scroll de usuario -> restaura a 820", () => {
    const decision = decideScrollRestore({
      preFocusScrollY: 820,
      currentScrollY: 1285,
      userScrolledDuringCycle: false,
      hasEditableFocus: false,
      keyboardOpen: false,
      toleranceRestorePx: TOLERANCE,
    })
    expect(decision).toEqual({ shouldRestore: true, target: 820 })
  })

  test("CASE 3: pre=820, userScrolled=true -> NO restaura (se preserva el scroll intencional)", () => {
    const decision = decideScrollRestore({
      preFocusScrollY: 820,
      currentScrollY: 1285,
      userScrolledDuringCycle: true,
      hasEditableFocus: false,
      keyboardOpen: false,
      toleranceRestorePx: TOLERANCE,
    })
    expect(decision.shouldRestore).toBe(false)
    if (!decision.shouldRestore) expect(decision.reason).toBe("user-scrolled-intentionally")
  })

  test("CASE 4: editable sigue enfocado -> NO restaura", () => {
    const decision = decideScrollRestore({
      preFocusScrollY: 0,
      currentScrollY: 465,
      userScrolledDuringCycle: false,
      hasEditableFocus: true,
      keyboardOpen: false,
      toleranceRestorePx: TOLERANCE,
    })
    expect(decision.shouldRestore).toBe(false)
    if (!decision.shouldRestore) expect(decision.reason).toBe("editable-still-focused")
  })

  test("CASE 5: teclado sigue abierto -> NO restaura", () => {
    const decision = decideScrollRestore({
      preFocusScrollY: 0,
      currentScrollY: 465,
      userScrolledDuringCycle: false,
      hasEditableFocus: false,
      keyboardOpen: true,
      toleranceRestorePx: TOLERANCE,
    })
    expect(decision.shouldRestore).toBe(false)
    if (!decision.shouldRestore) expect(decision.reason).toBe("keyboard-still-open")
  })

  test("CASE 6: post está dentro de tolerancia del pre -> NO hace falta scroll", () => {
    const decision = decideScrollRestore({
      preFocusScrollY: 465,
      currentScrollY: 466,
      userScrolledDuringCycle: false,
      hasEditableFocus: false,
      keyboardOpen: false,
      toleranceRestorePx: TOLERANCE,
    })
    expect(decision.shouldRestore).toBe(false)
    if (!decision.shouldRestore) expect(decision.reason).toBe("already-within-tolerance")
  })

  test("sin preFocusScrollY capturado -> NO restaura (nunca hubo ciclo real)", () => {
    const decision = decideScrollRestore({
      preFocusScrollY: null,
      currentScrollY: 465,
      userScrolledDuringCycle: false,
      hasEditableFocus: false,
      keyboardOpen: false,
      toleranceRestorePx: TOLERANCE,
    })
    expect(decision.shouldRestore).toBe(false)
    if (!decision.shouldRestore) expect(decision.reason).toBe("no-prefocus-captured")
  })
})

describe("resolveCycleStart", () => {
  test("primer focus editable del ciclo -> captura scrollY actual", () => {
    const result = resolveCycleStart({
      keyboardCycleActive: false,
      preFocusScrollY: null,
      currentScrollY: 0,
    })
    expect(result).toEqual({ keyboardCycleActive: true, preFocusScrollY: 0 })
  })

  test("CASE 7: input A -> input B con teclado abierto -> conserva el preFocusScrollY original, no lo pisa con la posición ya desplazada", () => {
    const result = resolveCycleStart({
      keyboardCycleActive: true,
      preFocusScrollY: 0,
      currentScrollY: 465, // ya desplazado por el teclado en este punto
    })
    expect(result).toEqual({ keyboardCycleActive: true, preFocusScrollY: 0 })
  })

  test("ciclo nuevo tras uno previo resuelto -> vuelve a capturar desde la posición real actual", () => {
    const result = resolveCycleStart({
      keyboardCycleActive: false,
      preFocusScrollY: null,
      currentScrollY: 820,
    })
    expect(result).toEqual({ keyboardCycleActive: true, preFocusScrollY: 820 })
  })
})
