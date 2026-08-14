// OBSERVABILITY + LOAD/PERFORMANCE CERTIFICATION — ciclo de vida de UN pedido real
// ============================================
// Usado por baseline-one-order.js. Ciclo confirmado leyendo el código
// actual (nunca supuesto): Cliente checkout -> Negocio "preparando" ->
// Negocio "listo_para_retirar" -> Cliente confirma recepción (sólo setea
// clienteConfirmaRecibido=true, el estado NO cambia todavía — confirmado en
// src/app/api/cliente/pedidos/[id]/route.ts) -> Negocio "entregado" (recién
// ahora permitido, porque clienteConfirmaRecibido ya es true — guard
// confirmado en src/app/api/negocio/pedidos/[id]/estado/route.ts). Usa
// metodoEntrega:"retiro" a propósito (Fase A/B): evita necesitar Repartidor/
// GPS/asignación de delivery en este primer harness.
//
// La identidad de Cliente/Negocio para este pedido se indexa por
// exec.scenario.iterationInTest (nunca por exec.vu.idInTest) — bajo un
// executor de iteraciones compartidas o arrival-rate, una misma VU puede
// ejecutar más de una iteración, así que la identidad debe depender de la
// iteración, no de la VU, para que futuros escenarios de arrival-rate
// (compressed-50, Fase C) mapeen 1 identidad por pedido sin colisión.
//
// CORRECCIÓN FOCAL: Cliente y Negocio usan jars LOCALES independientes
// (createActorJar), nunca el jar default del VU ni un "switch" que limpie
// cookies compartidas — ver actors.js para el porqué. Esto además permite
// validar una propiedad real de dos sesiones de browser independientes: la
// cookie `deligo_device` que el servidor le setea al Cliente en el checkout
// debe sobrevivir intacta en el jar del Cliente mientras el Negocio (con su
// propio jar, nunca tocado) hace sus transiciones.

import http from "k6/http"
import { check, fail } from "k6"
import { TARGET_URL } from "../../config/environments.js"
import { createActorJar, jarHasCookie, mutationHeaders } from "../lib/actors.js"
import { recordResponse } from "../lib/metrics.js"

const DEVICE_COOKIE_NAME = "deligo_device"

function checkoutPayload(negocioIdentity) {
  return JSON.stringify({
    negocioId: negocioIdentity.id,
    items: [
      {
        productoId: negocioIdentity.productoId,
        cantidad: 1,
        agregados: [],
        secciones: {},
        ingredientesQuitados: [],
        talle: "",
        color: "",
      },
    ],
    metodoEntrega: "retiro",
    metodoPago: "efectivo",
    notas: null,
    direccion: null,
    referencia: null,
    lat: null,
    lng: null,
    mesaId: null,
    mesaNumero: null,
    empleadoCodigo: null,
    mesaGeolocation: null,
  })
}

/** Devuelve { pedidoId, responses, deviceCookieContinuity } o llama fail() si algún paso no cumple su check crítico. Nunca expone valores de cookie — sólo booleanos. */
export function runOneOrderLifecycle(clienteIdentity, negocioIdentity, idempotencyKey) {
  const responses = {}
  const clienteJar = createActorJar(clienteIdentity)
  const negocioJar = createActorJar(negocioIdentity)

  // 1. Cliente — checkout (puede recibir Set-Cookie: deligo_device si la
  // identidad de dispositivo es nueva — se guarda en clienteJar, que nunca
  // se toca por el resto de esta función salvo para leer/agregar cookies
  // propias del Cliente).
  const checkoutRes = http.post(`${TARGET_URL}/api/pedidos`, checkoutPayload(negocioIdentity), {
    headers: mutationHeaders({ "idempotency-key": idempotencyKey }),
    jar: clienteJar,
    tags: { name: "checkout" },
  })
  responses.checkout = checkoutRes
  recordResponse(checkoutRes, "checkout", undefined, "checkout")
  const checkoutOk = check(checkoutRes, {
    "checkout: status 201": (r) => r.status === 201,
  })
  if (!checkoutOk) fail(`checkout falló: status=${checkoutRes.status}`)

  let pedidoId
  try {
    pedidoId = JSON.parse(checkoutRes.body).id
  } catch {
    pedidoId = undefined
  }
  if (!pedidoId) fail("checkout: respuesta sin id de pedido")

  // §8: validación focal — presencia (nunca el valor) de deligo_device en
  // el jar del Cliente inmediatamente después del checkout.
  const deviceCookieBeforeBusiness = jarHasCookie(clienteJar, DEVICE_COOKIE_NAME)
  check(null, {
    "client jar: deligo_device presente después del checkout": () => deviceCookieBeforeBusiness,
  })

  // 2. Negocio — recibido -> preparando (jar propio, independiente — nunca toca clienteJar)
  const preparandoRes = http.request(
    "PATCH",
    `${TARGET_URL}/api/negocio/pedidos/${pedidoId}/estado`,
    JSON.stringify({ estado: "preparando" }),
    { headers: mutationHeaders(), jar: negocioJar, tags: { name: "business_order_preparing" } }
  )
  responses.preparando = preparandoRes
  recordResponse(preparandoRes, "transition", undefined, "preparing")
  const preparandoOk = check(preparandoRes, {
    "business_order_preparing: status 200": (r) => r.status === 200,
  })
  if (!preparandoOk) fail(`transición a preparando falló: status=${preparandoRes.status}`)

  // 3. Negocio — preparando -> listo_para_retirar
  const listoRes = http.request(
    "PATCH",
    `${TARGET_URL}/api/negocio/pedidos/${pedidoId}/estado`,
    JSON.stringify({ estado: "listo_para_retirar" }),
    { headers: mutationHeaders(), jar: negocioJar, tags: { name: "business_order_ready" } }
  )
  responses.listoParaRetirar = listoRes
  recordResponse(listoRes, "transition", undefined, "ready")
  const listoOk = check(listoRes, {
    "business_order_ready: status 200": (r) => r.status === 200,
  })
  if (!listoOk) fail(`transición a listo_para_retirar falló: status=${listoRes.status}`)

  // §8: validación focal — la cookie del Cliente debe seguir intacta en su
  // propio jar después de que el Negocio (jar totalmente distinto) hizo 2
  // requests mutantes.
  const deviceCookieAfterBusiness = jarHasCookie(clienteJar, DEVICE_COOKIE_NAME)
  const deviceCookiePreserved = deviceCookieBeforeBusiness && deviceCookieAfterBusiness
  check(null, {
    "client jar: deligo_device preservada tras requests de Negocio": () => deviceCookiePreserved,
  })
  if (!deviceCookiePreserved) {
    fail(
      `Continuidad de cookie de dispositivo del Cliente rota: before=${deviceCookieBeforeBusiness} after=${deviceCookieAfterBusiness}`
    )
  }

  // 4. Cliente — confirma recepción (mismo clienteJar de siempre, nunca recreado)
  const confirmRes = http.request(
    "PUT",
    `${TARGET_URL}/api/cliente/pedidos/${pedidoId}`,
    JSON.stringify({ action: "confirmar" }),
    { headers: mutationHeaders(), jar: clienteJar, tags: { name: "client_confirm_order" } }
  )
  responses.confirmar = confirmRes
  recordResponse(confirmRes, "confirmation", undefined, "confirm")
  const confirmOk = check(confirmRes, {
    "client_confirm_order: status 200": (r) => r.status === 200,
  })
  if (!confirmOk) fail(`confirmación del cliente falló: status=${confirmRes.status}`)

  // 5. Negocio — listo_para_retirar -> entregado (permitido recién ahora)
  const entregadoRes = http.request(
    "PATCH",
    `${TARGET_URL}/api/negocio/pedidos/${pedidoId}/estado`,
    JSON.stringify({ estado: "entregado" }),
    { headers: mutationHeaders(), jar: negocioJar, tags: { name: "business_order_delivered" } }
  )
  responses.entregado = entregadoRes
  recordResponse(entregadoRes, "transition", undefined, "delivered")
  const entregadoOk = check(entregadoRes, {
    "business_order_delivered: status 200": (r) => r.status === 200,
  })
  if (!entregadoOk) fail(`transición a entregado falló: status=${entregadoRes.status}`)

  return {
    pedidoId,
    responses,
    deviceCookieContinuity: {
      before: deviceCookieBeforeBusiness,
      after: deviceCookieAfterBusiness,
      preserved: deviceCookiePreserved,
    },
  }
}
