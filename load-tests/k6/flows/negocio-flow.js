import http from "k6/http"
import { check } from "k6"
import { TARGET_URL } from "../../config/environments.js"
import { recordResponse } from "../lib/metrics.js"

export function runNegocioCountsPoll(negocioJar) {
  const counts = http.get(`${TARGET_URL}/api/negocio/dashboard/counts`, {
    jar: negocioJar,
    tags: { name: "business_dashboard_counts" },
  })
  recordResponse(counts, "business_counts", "negocio")
  check(counts, { "business_dashboard_counts: status 200": (r) => r.status === 200 })

  return counts
}

export function runNegocioOrdersPoll(negocioJar, negocioIdentity) {
  const query = negocioIdentity?.id ? `?negocioId=${encodeURIComponent(negocioIdentity.id)}` : ""
  const orders = http.get(`${TARGET_URL}/api/negocio/pedidos${query}`, {
    jar: negocioJar,
    tags: { name: "business_orders" },
  })
  recordResponse(orders, "business_orders", "negocio")
  check(orders, { "business_orders: status 200": (r) => r.status === 200 })
  return orders
}

export function runNegocioRealisticRound(negocioJar, negocioIdentity) {
  const counts = runNegocioCountsPoll(negocioJar)
  const orders = runNegocioOrdersPoll(negocioJar, negocioIdentity)
  return { counts, orders }
}
