import exec from "k6/execution"
import { findIdentity } from "./pool.js"
import { createActorJar } from "./actors.js"
import {
  runClienteCatalogOnce,
  runClienteActiveOrdersPoll,
  runClienteChatFabPoll,
} from "../flows/cliente-flow.js"
import { runNegocioCountsPoll, runNegocioOrdersPoll } from "../flows/negocio-flow.js"
import {
  runRepartidorProfilePoll,
  runRepartidorOrdersPoll,
  runRepartidorDeliveredPoll,
} from "../flows/repartidor-flow.js"
import { runOperacionesSalonRound } from "../flows/operaciones-flow.js"
import { countIdentities } from "./pool.js"
import { createEndpointScheduler, REALISTIC_POLL_INTERVAL_MS } from "./scheduler.js"
import { recordRealisticPollStart, recordRoleIteration } from "./metrics.js"

function identityFor(role) {
  const zeroBased = Math.max(0, exec.vu.idInTest - 1)
  const poolSize = countIdentities(role)
  if (poolSize <= 0) throw new Error(`No hay identidades seeded para role=${role}`)
  return findIdentity(role, zeroBased % poolSize)
}

let clienteJar
let negocioJar
let repartidorJar
let operacionesJar
let clienteScheduler
let negocioScheduler
let repartidorScheduler
let operacionesScheduler

function poll(endpointName, run) {
  return () => {
    recordRealisticPollStart(endpointName)
    run()
  }
}

function finishRoleRound(role, startedAt) {
  recordRoleIteration(role, Date.now() - startedAt)
}

export function cliente() {
  if (!clienteJar) clienteJar = createActorJar(identityFor("cliente"))
  if (!clienteScheduler) clienteScheduler = createEndpointScheduler()
  const startedAt = Date.now()
  const negocioIdentity = findIdentity("negocio", 0)
  clienteScheduler.run({
    catalog_business: {
      once: true,
      run: poll("catalog_business", () => runClienteCatalogOnce(clienteJar, negocioIdentity)),
    },
    client_orders: {
      cadenceMs: REALISTIC_POLL_INTERVAL_MS.CLIENT_ACTIVE_ORDERS_MS,
      run: poll("client_orders", () => runClienteActiveOrdersPoll(clienteJar)),
    },
    client_unread_chat: {
      cadenceMs: REALISTIC_POLL_INTERVAL_MS.CLIENT_CHATFAB_MS,
      run: poll("client_unread_chat", () => runClienteChatFabPoll(clienteJar)),
    },
  })
  finishRoleRound("cliente", startedAt)
}

export function negocio() {
  if (!negocioJar) negocioJar = createActorJar(identityFor("negocio"))
  if (!negocioScheduler) negocioScheduler = createEndpointScheduler()
  const startedAt = Date.now()
  const negocioIdentity = identityFor("negocio")
  negocioScheduler.run({
    business_counts: {
      cadenceMs: REALISTIC_POLL_INTERVAL_MS.BUSINESS_COUNTS_MS,
      run: poll("business_counts", () => runNegocioCountsPoll(negocioJar)),
    },
    business_orders: {
      cadenceMs: REALISTIC_POLL_INTERVAL_MS.BUSINESS_ORDERS_MS,
      run: poll("business_orders", () => runNegocioOrdersPoll(negocioJar, negocioIdentity)),
    },
  })
  finishRoleRound("negocio", startedAt)
}

export function repartidor() {
  if (!repartidorJar) repartidorJar = createActorJar(identityFor("repartidor"))
  if (!repartidorScheduler) repartidorScheduler = createEndpointScheduler()
  const startedAt = Date.now()
  repartidorScheduler.run({
    repartidor_profile: {
      cadenceMs: REALISTIC_POLL_INTERVAL_MS.DRIVER_PROFILE_MS,
      run: poll("repartidor_profile", () => runRepartidorProfilePoll(repartidorJar)),
    },
    repartidor_orders: {
      cadenceMs: REALISTIC_POLL_INTERVAL_MS.DRIVER_ORDERS_MS,
      run: poll("repartidor_orders", () => runRepartidorOrdersPoll(repartidorJar)),
    },
    repartidor_delivered: {
      cadenceMs: REALISTIC_POLL_INTERVAL_MS.DRIVER_DELIVERED_MS,
      run: poll("repartidor_delivered", () => runRepartidorDeliveredPoll(repartidorJar)),
    },
  })
  finishRoleRound("repartidor", startedAt)
}

export function operaciones() {
  if (!operacionesScheduler) operacionesScheduler = createEndpointScheduler()
  if (!operacionesJar) operacionesJar = createActorJar(findIdentity("operaciones", 0))
  const startedAt = Date.now()
  operacionesScheduler.run({
    operations_salon_panel: {
      cadenceMs: REALISTIC_POLL_INTERVAL_MS.OPERATIONS_PERSONAL_SALON_MS,
      run: poll("operations_salon_panel", () => runOperacionesSalonRound(operacionesJar, findIdentity("negocio", 0))),
    },
  })
  finishRoleRound("operaciones", startedAt)
}
