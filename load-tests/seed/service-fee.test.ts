import { describe, expect, test } from "bun:test"
import { buildFinancialFixturePlan, buildFinancialFixturePlanFromFee, parseServiceFeeSource, readCurrentServiceFee } from "./service-fee"

describe("service fee parser", () => {
  test("accepts the current declaration and a changed positive fee", () => {
    expect(parseServiceFeeSource("const SERVICE_FEE_FIXED = 250")).toBe(250)
    expect(parseServiceFeeSource("const SERVICE_FEE_FIXED = 200")).toBe(200)
  })

  test("accepts zero", () => {
    expect(parseServiceFeeSource("const SERVICE_FEE_FIXED = 0")).toBe(0)
  })

  test("rejects decimals, negatives, text and expressions", () => {
    for (const source of [
      "const SERVICE_FEE_FIXED = 250.5",
      "const SERVICE_FEE_FIXED = -1",
      "const SERVICE_FEE_FIXED = NaN",
      "const SERVICE_FEE_FIXED = Infinity",
      "const SERVICE_FEE_FIXED = Number(250)",
    ]) {
      expect(() => parseServiceFeeSource(source)).toThrow()
    }
  })

  test("rejects missing and ambiguous declarations", () => {
    expect(() => parseServiceFeeSource("const OTHER = 1")).toThrow()
    expect(() => parseServiceFeeSource([
      "const SERVICE_FEE_FIXED = 250",
      "const SERVICE_FEE_FIXED = 200",
    ].join("\n"))).toThrow()
  })

  test("rejects a missing source file", () => {
    expect(() => readCurrentServiceFee("load-tests/seed/__missing_service_fee_source__.ts")).toThrow()
  })

  test("reads the current product source", () => {
    expect(readCurrentServiceFee("src/app/api/pedidos/route.ts")).toBe(250)
  })

  test("preserves the certified financial equivalence", () => {
    const plan = buildFinancialFixturePlan(50)
    expect(plan.serviceFeeForRun).toBe(250)
    expect(plan.requiredDebtCapacity).toBe(12_500)
    expect(plan.fixtureDebtLimit).toBe(13_750)
    expect(plan.debtHeadroom).toBe(1_250)
  })

  test("does not require positive debt headroom for a zero fee", () => {
    const zeroPlan = buildFinancialFixturePlanFromFee(0, 50)
    expect(zeroPlan.requiredDebtCapacity).toBe(0)
    expect(zeroPlan.fixtureDebtLimit).toBe(0)
    expect(zeroPlan.debtHeadroom).toBe(0)
  })
})
