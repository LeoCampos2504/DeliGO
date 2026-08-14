// Métricas auxiliares de Fase C. Sólo contienen tiempos agregados y contadores.
import { Counter, Trend } from "k6/metrics"

export const unexpected429 = new Counter("unexpected_429")
export const http5xx = new Counter("http_5xx")
export const requestTimeouts = new Counter("request_timeouts")
export const checkoutFailures = new Counter("checkout_failures")
export const preparingFailures = new Counter("preparing_failures")
export const readyFailures = new Counter("ready_failures")
export const clientConfirmFailures = new Counter("client_confirm_failures")
export const deliveredFailures = new Counter("delivered_failures")
export const compressed50BoundaryStarts = new Counter("compressed50_boundary_starts")
export const compressed50TargetIterations = new Counter("compressed50_target_iterations")

const roleIterations = {
  cliente: new Counter("realistic20_iterations_cliente"),
  negocio: new Counter("realistic20_iterations_negocio"),
  repartidor: new Counter("realistic20_iterations_repartidor"),
  operaciones: new Counter("realistic20_iterations_operaciones"),
}

const roleRequests = {
  cliente: new Counter("realistic20_requests_cliente"),
  negocio: new Counter("realistic20_requests_negocio"),
  repartidor: new Counter("realistic20_requests_repartidor"),
  operaciones: new Counter("realistic20_requests_operaciones"),
}

const roleIterationDurations = {
  cliente: new Trend("realistic20_iteration_duration_cliente", true),
  negocio: new Trend("realistic20_iteration_duration_negocio", true),
  repartidor: new Trend("realistic20_iteration_duration_repartidor", true),
  operaciones: new Trend("realistic20_iteration_duration_operaciones", true),
}

export const endpointTrends = {
  catalog_business: new Trend("endpoint_catalog_business", true),
  client_orders: new Trend("endpoint_client_orders", true),
  client_unread_chat: new Trend("endpoint_client_unread_chat", true),
  client_tracking: new Trend("endpoint_client_tracking", true),
  business_counts: new Trend("endpoint_business_counts", true),
  business_orders: new Trend("endpoint_business_orders", true),
  repartidor_profile: new Trend("endpoint_repartidor_profile", true),
  repartidor_orders: new Trend("endpoint_repartidor_orders", true),
  repartidor_delivered: new Trend("endpoint_repartidor_delivered", true),
  operations_salon_panel: new Trend("endpoint_operations_salon_panel", true),
  checkout: new Trend("checkout_duration", true),
  transition: new Trend("transition_duration", true),
  confirmation: new Trend("confirmation_duration", true),
}

const realisticPollEndpointNames = [
  "catalog_business",
  "client_orders",
  "client_unread_chat",
  "business_counts",
  "business_orders",
  "repartidor_profile",
  "repartidor_orders",
  "repartidor_delivered",
  "operations_salon_panel",
]

export const realisticPollStarts = Object.fromEntries(
  realisticPollEndpointNames.map((name) => [name, new Counter(`realistic20_poll_starts_${name}`)])
)

export const realisticPollIntervals = Object.fromEntries(
  realisticPollEndpointNames.map((name) => [name, new Trend(`realistic20_poll_interval_ms_${name}`, true)])
)

const lastRealisticPollAt = Object.create(null)

const lifecycleFailureCounters = {
  checkout: checkoutFailures,
  preparing: preparingFailures,
  ready: readyFailures,
  confirm: clientConfirmFailures,
  delivered: deliveredFailures,
}

export function recordResponse(response, endpointName, role, lifecyclePhase) {
  const status = response && response.status
  const duration = response && response.timings ? response.timings.duration : undefined
  if (duration !== undefined && endpointTrends[endpointName]) {
    endpointTrends[endpointName].add(duration)
  }
  if (role && roleRequests[role]) roleRequests[role].add(1)
  if (status === 429) unexpected429.add(1)
  if (status >= 500) http5xx.add(1)
  if (status === 0) requestTimeouts.add(1)
  if (lifecyclePhase && lifecycleFailureCounters[lifecyclePhase] && status !== 200 && status !== 201) {
    lifecycleFailureCounters[lifecyclePhase].add(1)
  }
}

export function recordRoleIteration(role, durationMs) {
  if (!roleIterations[role] || !roleIterationDurations[role]) return
  roleIterations[role].add(1)
  roleIterationDurations[role].add(durationMs)
}

export function recordRealisticPollStart(endpointName) {
  const counter = realisticPollStarts[endpointName]
  const interval = realisticPollIntervals[endpointName]
  if (!counter || !interval) return

  const nowMs = Date.now()
  counter.add(1)
  if (typeof lastRealisticPollAt[endpointName] === "number") {
    interval.add(nowMs - lastRealisticPollAt[endpointName])
  }
  lastRealisticPollAt[endpointName] = nowMs
}
