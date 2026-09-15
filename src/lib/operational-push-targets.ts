import type { PushSubscription } from "@prisma/client"
import {
  mergePushFanoutTargets,
  resolveCorePushTargetsFromNormalized,
  type PushFanoutTarget,
} from "@/lib/push"
import { getPushSubscriptionsForOwners } from "@/lib/push-subscription-repository"
import { safeErrorForLog } from "@/lib/log-safe-error"

export type OperationalPushEmployee = {
  id: string
  cuentaOperativaId: string | null
  pushSubscription: string | null
}

/**
 * Cuenta-level is the authority for new operational subscriptions. Employee
 * rows remain a deliberately narrow compatibility fallback for old sessions:
 * only accounts without any account-level row use them, and every event is
 * deduped by physical endpoint.
 */
export async function resolveOperationalPushTargets(
  employees: readonly OperationalPushEmployee[]
): Promise<PushFanoutTarget[]> {
  const accountIds = Array.from(
    new Set(employees.map((employee) => employee.cuentaOperativaId).filter((id): id is string => Boolean(id)))
  )
  const employeeIds = employees.map((employee) => employee.id)
  let accountRows = new Map<string, PushSubscription[]>()
  let employeeRows = new Map<string, PushSubscription[]>()

  try {
    accountRows = await getPushSubscriptionsForOwners("cuenta_operativa", accountIds, "default")
  } catch (error) {
    console.error("[Push/Operaciones] Error leyendo subscriptions de cuenta:", safeErrorForLog(error))
  }

  const legacyFallbackAccountIds = new Set(
    accountIds.filter((accountId) => (accountRows.get(accountId) ?? []).length === 0)
  )
  const fallbackEmployeeIds = employees
    .filter((employee) => employee.cuentaOperativaId && legacyFallbackAccountIds.has(employee.cuentaOperativaId))
    .map((employee) => employee.id)

  if (fallbackEmployeeIds.length > 0) {
    try {
      employeeRows = await getPushSubscriptionsForOwners("empleado", fallbackEmployeeIds, "default")
    } catch (error) {
      console.error("[Push/Operaciones] Error leyendo fallback legacy de empleado:", safeErrorForLog(error))
    }
  }

  const perAccountTargets: PushFanoutTarget[][] = []
  for (const accountId of accountIds) {
    const normalizedAccountRows = accountRows.get(accountId) ?? []
    if (normalizedAccountRows.length > 0) {
      perAccountTargets.push(
        resolveCorePushTargetsFromNormalized("cuenta_operativa", accountId, null, normalizedAccountRows)
      )
      continue
    }

    for (const employee of employees) {
      if (employee.cuentaOperativaId !== accountId) continue
      perAccountTargets.push(
        resolveCorePushTargetsFromNormalized(
          "empleado",
          employee.id,
          employee.pushSubscription,
          employeeRows.get(employee.id) ?? []
        )
      )
    }
  }

  return mergePushFanoutTargets(perAccountTargets)
}
