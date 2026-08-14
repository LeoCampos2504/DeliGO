import { getPlatformServiceFee } from "@/lib/platform-settings"

export interface FinancialFixturePlan {
  serviceFeeForRun: number
  expectedConfirmedOrders: number
  requiredDebtCapacity: number
  fixtureDebtLimit: number | null
  debtHeadroom: number
  serviceFeeSource: string
}

function requireTestDatabaseUrl(): string {
  const value = process.env.DELIGO_TEST_DATABASE_URL
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error("TEST_DB_HARD_GATE: DELIGO_TEST_DATABASE_URL no está disponible para service-fee")
  }
  return value
}

export function buildFinancialFixturePlanFromFee(serviceFeeForRun: number, expectedConfirmedOrders: number): FinancialFixturePlan {
  const requiredDebtCapacity = serviceFeeForRun * expectedConfirmedOrders
  if (expectedConfirmedOrders <= 0) {
    return {
      serviceFeeForRun,
      expectedConfirmedOrders,
      requiredDebtCapacity,
      fixtureDebtLimit: null,
      debtHeadroom: 0,
      serviceFeeSource: "ConfigPlataforma:platform",
    }
  }

  const safetyMargin = serviceFeeForRun === 0
    ? 0
    : Math.max(serviceFeeForRun, requiredDebtCapacity * 0.1)
  const fixtureDebtLimit = Math.ceil(requiredDebtCapacity + safetyMargin)
  return {
    serviceFeeForRun,
    expectedConfirmedOrders,
    requiredDebtCapacity,
    fixtureDebtLimit,
    debtHeadroom: fixtureDebtLimit - requiredDebtCapacity,
    serviceFeeSource: "ConfigPlataforma:platform",
  }
}

export async function readConfiguredServiceFee(): Promise<number> {
  process.env.DATABASE_URL = requireTestDatabaseUrl()
  const { db } = await import("@/lib/db")
  return getPlatformServiceFee(db)
}

export async function buildFinancialFixturePlan(expectedConfirmedOrders: number): Promise<FinancialFixturePlan> {
  return buildFinancialFixturePlanFromFee(
    await readConfiguredServiceFee(),
    expectedConfirmedOrders
  )
}
