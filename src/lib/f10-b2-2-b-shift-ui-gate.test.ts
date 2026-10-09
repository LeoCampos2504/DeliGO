import { describe, expect, test } from "bun:test"
import { isControlledShiftUiEnabled } from "@/lib/f10-b2-2-b-shift-ui-gate"

describe("F10-B2.2-B controlled shift-opening gate", () => {
  const base = {
    DELIGO_ENVIRONMENT: "TESTING",
    DELIGO_F10_B2_2_B_SHIFT_UI_ENABLED: "true",
    DELIGO_F10_B2_2_B_CONTROLLED_EMPLOYEE_IDS: "employee-a, employee-b",
  }

  test("enables only allowlisted employee accounts in explicitly enabled TESTING", () => {
    expect(isControlledShiftUiEnabled("employee-a", base)).toBe(true)
    expect(isControlledShiftUiEnabled("employee-c", base)).toBe(false)
  })

  test("defaults closed and remains closed outside TESTING", () => {
    expect(isControlledShiftUiEnabled("employee-a", {})).toBe(false)
    expect(isControlledShiftUiEnabled("employee-a", { ...base, DELIGO_ENVIRONMENT: "PRODUCTION" })).toBe(false)
    expect(isControlledShiftUiEnabled("employee-a", { ...base, DELIGO_F10_B2_2_B_SHIFT_UI_ENABLED: "false" })).toBe(false)
  })
})
