import http from "k6/http"
import { check } from "k6"
import { TARGET_URL } from "../../config/environments.js"
import { recordResponse } from "../lib/metrics.js"

export function runOperacionesSalonRound(operacionesJar, negocioIdentity) {
  const response = http.get(`${TARGET_URL}/api/operativo/salon/panel/${negocioIdentity.negocioSlug}`, {
    jar: operacionesJar,
    tags: { name: "operations_salon_panel" },
  })
  recordResponse(response, "operations_salon_panel", "operaciones")
  check(response, { "operations_salon_panel: status 200": (r) => r.status === 200 })
}
