import http from "k6/http"
import { check } from "k6"
import { TARGET_URL } from "../../config/environments.js"
import { recordResponse } from "../lib/metrics.js"

export function runRepartidorProfilePoll(repartidorJar) {
  const profile = http.get(`${TARGET_URL}/api/repartidor/perfil`, {
    jar: repartidorJar,
    tags: { name: "repartidor_profile" },
  })
  recordResponse(profile, "repartidor_profile", "repartidor")
  check(profile, { "repartidor_profile: status 200": (r) => r.status === 200 })

  return profile
}

export function runRepartidorOrdersPoll(repartidorJar) {
  const orders = http.get(`${TARGET_URL}/api/repartidor/pedidos?filter=all`, {
    jar: repartidorJar,
    tags: { name: "repartidor_orders" },
  })
  recordResponse(orders, "repartidor_orders", "repartidor")
  check(orders, { "repartidor_orders: status 200": (r) => r.status === 200 })

  return orders
}

export function runRepartidorDeliveredPoll(repartidorJar) {
  const delivered = http.get(`${TARGET_URL}/api/repartidor/pedidos-entregados`, {
    jar: repartidorJar,
    tags: { name: "repartidor_delivered" },
  })
  recordResponse(delivered, "repartidor_delivered", "repartidor")
  check(delivered, { "repartidor_delivered: status 200": (r) => r.status === 200 })
  return delivered
}

export function runRepartidorRealisticRound(repartidorJar) {
  const profile = runRepartidorProfilePoll(repartidorJar)
  const orders = runRepartidorOrdersPoll(repartidorJar)
  const delivered = runRepartidorDeliveredPoll(repartidorJar)
  return { profile, orders, delivered }
}
