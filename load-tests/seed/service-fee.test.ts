import { describe, expect, test } from "bun:test"
import { buildFinancialFixturePlanFromFee } from "./service-fee"

describe("service fee financial plan", () => {
  test("uses the configured fee value and preserves the certified 50-order equivalence", () => {
    const plan = buildFinancialFixturePlanFromFee(250, 50)
    expect(plan).toMatchObject({
      serviceFeeForRun: 250,
      requiredDebtCapacity: 12_500,
      fixtureDebtLimit: 13_750,
      debtHeadroom: 1_250,
      serviceFeeSource: "ConfigPlataforma:platform",
    })
  })

  test("accepts zero fee without artificial debt capacity", () => {
    expect(buildFinancialFixturePlanFromFee(0, 50)).toMatchObject({
      requiredDebtCapacity: 0,
      fixtureDebtLimit: 0,
      debtHeadroom: 0,
    })
  })

  test("keeps a positive integer fee as the only financial input", () => {
    const plan = buildFinancialFixturePlanFromFee(200, 50)
    expect(plan.requiredDebtCapacity).toBe(10_000)
    expect(plan.serviceFeeSource).toBe("ConfigPlataforma:platform")
  })
})
