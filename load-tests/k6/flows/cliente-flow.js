// OBSERVABILITY + LOAD/PERFORMANCE CERTIFICATION — flujo read-only de Cliente
// ============================================
// Usado por baseline-readonly.js. Sólo GETs — cero writes HTTP, cero
// checkout — para aislar el diagnóstico del harness (pool/cookies/checks/
// tags/summary/runner/cleanup) de cualquier bug del flujo de escritura
// (ver Fase A §32, secuencia A antes de B).
//
// Recibe el jar del Cliente ya creado (no lo crea acá) — el scenario lo
// crea UNA vez a nivel de módulo (persiste entre iteraciones de la misma
// VU, igual que una sesión de browser real se mantiene mientras la pestaña
// sigue abierta).

import http from "k6/http"
import { check } from "k6"
import { TARGET_URL } from "../../config/environments.js"

export function runClienteReadonlyRound(clienteJar, negocioIdentity) {
  const catalogRes = http.get(`${TARGET_URL}/api/negocios/${negocioIdentity.negocioSlug}`, {
    jar: clienteJar,
    tags: { name: "catalog_business" },
  })
  check(catalogRes, {
    "catalog_business: status 200": (r) => r.status === 200,
    "catalog_business: body has slug": (r) => {
      try {
        return JSON.parse(r.body).slug === negocioIdentity.negocioSlug
      } catch {
        return false
      }
    },
  })

  const ordersRes = http.get(`${TARGET_URL}/api/cliente/pedidos?estado=activos`, {
    jar: clienteJar,
    tags: { name: "client_orders" },
  })
  check(ordersRes, {
    "client_orders: status 200": (r) => r.status === 200,
  })

  const unreadRes = http.get(`${TARGET_URL}/api/chat/no-leidos`, {
    jar: clienteJar,
    tags: { name: "client_unread_chat" },
  })
  check(unreadRes, {
    "client_unread_chat: status 200": (r) => r.status === 200,
  })

  return { catalogRes, ordersRes, unreadRes }
}
