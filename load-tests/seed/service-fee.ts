import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

export interface FinancialFixturePlan {
  serviceFeeForRun: number
  expectedConfirmedOrders: number
  requiredDebtCapacity: number
  fixtureDebtLimit: number | null
  debtHeadroom: number
  serviceFeeSource: string
}

const PRODUCT_FEE_SOURCE = resolve(process.cwd(), "src/app/api/pedidos/route.ts")
const SERVICE_FEE_DECLARATION = /^\s*(?:const|let|var)\s+SERVICE_FEE_FIXED\s*=\s*(.*?)\s*;?\s*$/
const DECIMAL_INTEGER_LITERAL = /^(?:0|[1-9]\d*)$/

function feeError(message: string, sourcePath: string): Error {
  return new Error(`${message} path=${sourcePath}`)
}

/**
 * Parses only the current, intentionally narrow product declaration syntax.
 * A future syntax change must fail closed instead of being guessed.
 */
export function parseServiceFeeSource(source: string, sourcePath = "<source>"): number {
  const declarations = source
    .split(/\r?\n/)
    .map((line) => line.match(SERVICE_FEE_DECLARATION))
    .filter((match): match is RegExpMatchArray => match !== null)

  if (declarations.length === 0) {
    throw feeError("SERVICE_FEE_SOURCE_UNREADABLE", sourcePath)
  }
  if (declarations.length !== 1) {
    throw feeError("SERVICE_FEE_SOURCE_AMBIGUOUS", sourcePath)
  }

  const literal = declarations[0][1].trim()
  if (!DECIMAL_INTEGER_LITERAL.test(literal)) {
    throw feeError("SERVICE_FEE_SOURCE_INVALID_INTEGER", sourcePath)
  }

  const fee = Number(literal)
  if (!Number.isSafeInteger(fee) || fee < 0) {
    throw feeError("SERVICE_FEE_SOURCE_INVALID_INTEGER", sourcePath)
  }
  return fee
}

export function readCurrentServiceFee(sourcePath: string): number {
  if (!existsSync(sourcePath)) {
    throw feeError("SERVICE_FEE_SOURCE_MISSING", sourcePath)
  }
  return parseServiceFeeSource(readFileSync(sourcePath, "utf8"), sourcePath)
}

export function readProductServiceFee(): number {
  return readCurrentServiceFee(PRODUCT_FEE_SOURCE)
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
      serviceFeeSource: "src/app/api/pedidos/route.ts:SERVICE_FEE_FIXED",
    }
  }

  // A zero service fee needs no artificial positive debt capacity. For a
  // positive fee, preserve the previously certified minimum headroom rule.
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
    serviceFeeSource: "src/app/api/pedidos/route.ts:SERVICE_FEE_FIXED",
  }
}

export function buildFinancialFixturePlan(expectedConfirmedOrders: number): FinancialFixturePlan {
  return buildFinancialFixturePlanFromFee(readProductServiceFee(), expectedConfirmedOrders)
}
