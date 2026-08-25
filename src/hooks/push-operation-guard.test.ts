// P2-T05 Stage3R2 (F-P2-T05-14): unit tests for the pure latest-operation
// guard — no React, no browser, no mocks needed.
import { describe, expect, test } from "bun:test"
import { createLatestOperationGate } from "./push-operation-guard"

describe("createLatestOperationGate", () => {
  test("begin() returns strictly increasing ids", () => {
    const gate = createLatestOperationGate()
    const a = gate.begin()
    const b = gate.begin()
    const c = gate.begin()
    expect(b).toBeGreaterThan(a)
    expect(c).toBeGreaterThan(b)
  })

  test("the most recently begun operation is current, earlier ones are not", () => {
    const gate = createLatestOperationGate()
    const a = gate.begin()
    const b = gate.begin()
    expect(gate.isCurrent(a)).toBe(false)
    expect(gate.isCurrent(b)).toBe(true)
  })

  test("a single begun operation with no successor is current", () => {
    const gate = createLatestOperationGate()
    const a = gate.begin()
    expect(gate.isCurrent(a)).toBe(true)
  })

  test("invalidate() makes the last begun operation stale, and a subsequent begin() is current", () => {
    const gate = createLatestOperationGate()
    const a = gate.begin()
    expect(gate.isCurrent(a)).toBe(true)
    gate.invalidate()
    expect(gate.isCurrent(a)).toBe(false)
    const b = gate.begin()
    expect(gate.isCurrent(a)).toBe(false)
    expect(gate.isCurrent(b)).toBe(true)
  })

  test("three overlapping operations: only the latest begun stays current regardless of arrival order", () => {
    const gate = createLatestOperationGate()
    const first = gate.begin()
    const second = gate.begin()
    const third = gate.begin()
    expect(gate.isCurrent(first)).toBe(false)
    expect(gate.isCurrent(second)).toBe(false)
    expect(gate.isCurrent(third)).toBe(true)
  })
})
