// REALISTIC-20 endpoint scheduler.
//
// k6 copies init-context globals into each VU runtime. This state therefore
// belongs to one VU and is never shared across VUs. See the official k6
// lifecycle/global-variable documentation referenced by the Fase C report.
import { sleep } from "k6"

export const REALISTIC_POLL_INTERVAL_MS = Object.freeze({
  CLIENT_ACTIVE_ORDERS_MS: 15_000,
  CLIENT_CHATFAB_MS: 15_000,
  BUSINESS_COUNTS_MS: 8_000,
  BUSINESS_ORDERS_MS: 15_000,
  DRIVER_PROFILE_MS: 30_000,
  DRIVER_ORDERS_MS: 8_000,
  DRIVER_DELIVERED_MS: 15_000,
  OPERATIONS_PERSONAL_SALON_MS: 15_000,
})

const MIN_SLEEP_SECONDS = 0.05

function advanceWithoutCatchUp(previousDue, cadenceMs, nowMs) {
  let nextDue = previousDue + cadenceMs
  if (nextDue <= nowMs) {
    const skippedWindows = Math.floor((nowMs - nextDue) / cadenceMs) + 1
    nextDue += skippedWindows * cadenceMs
  }
  return nextDue
}

export function createEndpointScheduler() {
  const nextDueByEndpoint = Object.create(null)
  let initialized = false

  function run(jobs) {
    const nowMs = Date.now()
    if (!initialized) {
      for (const [endpointName, job] of Object.entries(jobs)) {
        nextDueByEndpoint[endpointName] = job.once ? 0 : nowMs
      }
      initialized = true
    }

    const dueEndpoints = Object.entries(jobs).filter(([endpointName]) => {
      const nextDue = nextDueByEndpoint[endpointName]
      return typeof nextDue === "number" && nextDue <= nowMs
    })

    for (const [endpointName, job] of dueEndpoints) {
      const scheduledDue = nextDueByEndpoint[endpointName]
      job.run()

      if (job.once) {
        nextDueByEndpoint[endpointName] = null
        continue
      }

      const afterJobMs = Date.now()
      nextDueByEndpoint[endpointName] = advanceWithoutCatchUp(
        scheduledDue,
        job.cadenceMs,
        afterJobMs
      )
    }

    const nextDue = Object.values(nextDueByEndpoint)
      .filter((value) => typeof value === "number")
      .reduce((minimum, value) => Math.min(minimum, value), Infinity)

    if (Number.isFinite(nextDue)) {
      const sleepSeconds = Math.max(MIN_SLEEP_SECONDS, (nextDue - Date.now()) / 1000)
      sleep(sleepSeconds)
    }
  }

  return { run }
}
