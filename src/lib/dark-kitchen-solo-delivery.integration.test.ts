/// <reference types="bun-types" />

// ============================================
// DeliGO — T20-DK1: capacidad de Retiro independiente + modalidad "solo delivery"
// ============================================
// Usa las rutas REALES (config de negocio, API pública, creación de pedido,
// cambio de estado de pedido) contra PostgreSQL TESTING real — nunca mockea
// Prisma. Todo fixture usa el prefijo `test-t20dk1-` y se limpia en
// `afterAll`. No repite lo que ya cubren los tests puros de
// mesa-checkout-transition.test.ts (derivación de método de entrega) ni
// negocio-canales-pedido.test.ts (política de "al menos un canal") — este
// archivo cubre el camino real de HTTP + DB de punta a punta.

import { randomUUID } from "crypto"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createSession, SESSION_COOKIE_NAME } from "@/lib/auth"
import { POST_FOR_TESTS as crearPedido } from "@/app/api/pedidos/route"
import { PATCH as patchNegocioConfig, GET as getNegocioConfig } from "@/app/api/negocio/config/route"
import { GET as getPublicBusiness } from "@/app/api/negocios/[slug]/route"
import { PATCH as patchPedidoEstado } from "@/app/api/negocio/pedidos/[id]/estado/route"

setDefaultTimeout(60_000)

const prefix = "test-t20dk1-"

async function ensureNegocio(
  suffix: string,
  overrides: Partial<{
    ofreceDelivery: boolean
    ofreceRetiro: boolean
    salonActivo: boolean
    zonaDeliveryActiva: boolean
    deliveryMode: string
    zonasDelivery: string
    precioDelivery: number
  }> = {}
) {
  return db.negocio.create({
    data: {
      nombre: `${prefix}${suffix}`,
      slug: `${prefix}${suffix}`,
      usuario: `${prefix}${suffix}`,
      email: `${prefix}${suffix}@example.test`,
      password: "fixture",
      aprobado: true,
      suspendido: false,
      horarioMode: "simple",
      abiertoManual: true,
      ofreceDelivery: overrides.ofreceDelivery ?? false,
      ofreceRetiro: overrides.ofreceRetiro ?? true,
      salonActivo: overrides.salonActivo ?? false,
      zonaDeliveryActiva: overrides.zonaDeliveryActiva ?? false,
      deliveryMode: overrides.deliveryMode ?? "",
      zonasDelivery: overrides.zonasDelivery ?? "[]",
      precioDelivery: overrides.precioDelivery ?? 0,
    },
  })
}

async function ensureCliente(suffix: string) {
  return db.cliente.create({
    data: { nombre: `${prefix}${suffix}`, email: `${prefix}${suffix}@example.test`, telefono: "" },
  })
}

async function ensureProducto(negocioId: string) {
  const producto = await db.producto.create({
    data: { nombre: `${prefix}producto`, precio: 100, negocioId },
  })
  return producto.id
}

function pedidoBody(params: {
  negocioId: string
  productoId: string
  metodoEntrega: "retiro" | "domicilio" | "mesa"
  direccion?: string | null
  lat?: number | null
  lng?: number | null
  mesaNumero?: number | null
}) {
  return {
    negocioId: params.negocioId,
    items: [
      { productoId: params.productoId, cantidad: 1, agregados: [], secciones: {}, ingredientesQuitados: [], talle: "", color: "" },
    ],
    metodoEntrega: params.metodoEntrega,
    metodoPago: "efectivo",
    notas: null,
    direccion: params.direccion ?? null,
    referencia: null,
    lat: params.lat ?? null,
    lng: params.lng ?? null,
    mesaId: null,
    mesaNumero: params.mesaNumero ?? null,
    empleadoCodigo: null,
    fingerprint: null,
    mesaGeolocation: null,
  }
}

// `x-forwarded-for` único por request: el rate limit de "order" (5/5min) y el
// lock de concurrencia de POST /api/pedidos usan la IP cuando no hay cookie
// de cliente — mismo patrón que negocio-salon.test.ts.
function reqPedido(body: unknown, cookie?: string): NextRequest {
  return new NextRequest("http://localhost/api/pedidos", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": randomUUID(),
      ...(cookie ? { cookie: `${SESSION_COOKIE_NAME}=${cookie}` } : {}),
    },
  })
}

function reqConCookie(
  url: string,
  cookies: Record<string, string>,
  init?: { method?: string; headers?: Record<string, string>; body?: string }
): NextRequest {
  const cookieHeader = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ")
  return new NextRequest(url, {
    method: init?.method,
    body: init?.body,
    headers: { ...(init?.headers ?? {}), ...(cookieHeader ? { cookie: cookieHeader } : {}) },
  })
}

async function cleanup() {
  const negocios = await db.negocio.findMany({ where: { slug: { startsWith: prefix } }, select: { id: true } })
  const negocioIds = negocios.map((n) => n.id)
  const clientes = await db.cliente.findMany({ where: { email: { startsWith: prefix } }, select: { id: true } })
  const clienteIds = clientes.map((c) => c.id)

  if (negocioIds.length) {
    await db.pedidoEvento.deleteMany({ where: { pedido: { negocioId: { in: negocioIds } } } }).catch(() => {})
    await db.pedido.deleteMany({ where: { negocioId: { in: negocioIds } } })
    await db.mesa.deleteMany({ where: { negocioId: { in: negocioIds } } })
    await db.producto.deleteMany({ where: { negocioId: { in: negocioIds } } })
    await db.negocio.deleteMany({ where: { id: { in: negocioIds } } })
  }
  if (clienteIds.length) {
    await db.sesion.deleteMany({ where: { userId: { in: clienteIds } } })
    await db.cliente.deleteMany({ where: { id: { in: clienteIds } } })
  }
}

beforeAll(async () => {
  await cleanup()
}, { timeout: 30_000 })

afterAll(async () => {
  await cleanup()
  const remaining = await db.negocio.count({ where: { slug: { startsWith: prefix } } })
  expect(remaining).toBe(0)
})

// ============================================
// A. Schema / default
// ============================================
describe("A. Schema — ofreceRetiro default", () => {
  test("un Negocio creado sin especificar ofreceRetiro queda en true (compatibilidad con negocios existentes)", async () => {
    const negocio = await ensureNegocio("a-default")
    const fresh = await db.negocio.findUniqueOrThrow({ where: { id: negocio.id } })
    expect(fresh.ofreceRetiro).toBe(true)
  })
})

// ============================================
// B. Config API negocio
// ============================================
describe("B. Config API — ofreceRetiro y política de canales", () => {
  test("PATCH acepta ofreceRetiro boolean y lo persiste", async () => {
    const negocio = await ensureNegocio("b-persist", { ofreceDelivery: true, ofreceRetiro: true })
    const token = await createSession(negocio.id, "negocio")

    const res = await patchNegocioConfig(
      reqConCookie(
        "http://localhost/api/negocio/config",
        { [SESSION_COOKIE_NAME]: token },
        { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ofreceRetiro: false }) }
      )
    )
    expect(res.status).toBe(200)

    const getRes = await getNegocioConfig(reqConCookie("http://localhost/api/negocio/config", { [SESSION_COOKIE_NAME]: token }))
    const getBody = await getRes.json()
    expect(getBody.ofreceRetiro).toBe(false)

    const fresh = await db.negocio.findUniqueOrThrow({ where: { id: negocio.id } })
    expect(fresh.ofreceRetiro).toBe(false)
  })

  test("PATCH rechaza ofreceRetiro no-booleano (string) sin coercionar", async () => {
    const negocio = await ensureNegocio("b-strict", { ofreceDelivery: true, ofreceRetiro: true })
    const token = await createSession(negocio.id, "negocio")

    const res = await patchNegocioConfig(
      reqConCookie(
        "http://localhost/api/negocio/config",
        { [SESSION_COOKIE_NAME]: token },
        { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ofreceRetiro: "false" }) }
      )
    )
    expect(res.status).toBe(400)

    const fresh = await db.negocio.findUniqueOrThrow({ where: { id: negocio.id } })
    expect(fresh.ofreceRetiro).toBe(true) // sin cambios
  })

  test("PATCH rechaza dejar salonActivo=false + ofreceDelivery=false + ofreceRetiro=false (0 canales)", async () => {
    const negocio = await ensureNegocio("b-cero-canales", { ofreceDelivery: false, ofreceRetiro: true, salonActivo: false })
    const token = await createSession(negocio.id, "negocio")

    const res = await patchNegocioConfig(
      reqConCookie(
        "http://localhost/api/negocio/config",
        { [SESSION_COOKIE_NAME]: token },
        { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ofreceRetiro: false }) }
      )
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).not.toMatch(/negocioId|prisma|sql/i)

    const fresh = await db.negocio.findUniqueOrThrow({ where: { id: negocio.id } })
    expect(fresh.ofreceRetiro).toBe(true) // sin cambios — el rechazo bloqueó la escritura
  })

  test("PATCH permite quedar en 'solo salón' (delivery/retiro OFF, salón ON)", async () => {
    const negocio = await ensureNegocio("b-solo-salon", { ofreceDelivery: false, ofreceRetiro: true, salonActivo: true })
    const token = await createSession(negocio.id, "negocio")

    const res = await patchNegocioConfig(
      reqConCookie(
        "http://localhost/api/negocio/config",
        { [SESSION_COOKIE_NAME]: token },
        { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ofreceRetiro: false }) }
      )
    )
    expect(res.status).toBe(200)

    const fresh = await db.negocio.findUniqueOrThrow({ where: { id: negocio.id } })
    expect(fresh.ofreceRetiro).toBe(false)
    expect(fresh.salonActivo).toBe(true)
  })
})

// ============================================
// C. API pública
// ============================================
describe("C. API pública — retiroHabilitado", () => {
  test("retiroHabilitado=true cuando ofreceRetiro=true, sin exponer el campo interno ofreceRetiro", async () => {
    const negocio = await ensureNegocio("c-true", { ofreceRetiro: true })
    const res = await getPublicBusiness(new NextRequest(`http://localhost/api/negocios/${negocio.slug}`), {
      params: Promise.resolve({ slug: negocio.slug }),
    })
    const body = await res.json()
    expect(body.retiroHabilitado).toBe(true)
    expect(body.ofreceRetiro).toBeUndefined()
  })

  test("retiroHabilitado=false cuando ofreceRetiro=false", async () => {
    const negocio = await ensureNegocio("c-false", { ofreceDelivery: true, ofreceRetiro: false })
    const res = await getPublicBusiness(new NextRequest(`http://localhost/api/negocios/${negocio.slug}`), {
      params: Promise.resolve({ slug: negocio.slug }),
    })
    const body = await res.json()
    expect(body.retiroHabilitado).toBe(false)
    expect(body.ofreceDelivery).toBe(true) // ofreceDelivery sí se expone tal cual (convención ya existente)
  })
})

// ============================================
// E/F/G. Creación de pedido — solo delivery
// ============================================
describe("E/F/G. POST /api/pedidos — Solo delivery (delivery ON, retiro OFF)", () => {
  test("domicilio: éxito, pedido queda con metodoEntrega=domicilio", async () => {
    const negocio = await ensureNegocio("g-solo-delivery-ok", { ofreceDelivery: true, ofreceRetiro: false })
    const cliente = await ensureCliente("g-solo-delivery-ok-cliente")
    const token = await createSession(cliente.id, "cliente")
    const productoId = await ensureProducto(negocio.id)

    const res = await crearPedido(
      reqPedido(
        pedidoBody({ negocioId: negocio.id, productoId, metodoEntrega: "domicilio", direccion: "Calle Falsa 123", lat: -34.6, lng: -58.4 }),
        token
      ),
      {}
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.metodoEntrega).toBe("domicilio")
  })

  test("retiro: rechazado con 400 'El negocio no ofrece retiro', 0 pedidos creados", async () => {
    const negocio = await ensureNegocio("f-solo-delivery-retiro-bloqueado", { ofreceDelivery: true, ofreceRetiro: false })
    const cliente = await ensureCliente("f-solo-delivery-retiro-bloqueado-cliente")
    const token = await createSession(cliente.id, "cliente")
    const productoId = await ensureProducto(negocio.id)

    const res = await crearPedido(
      reqPedido(pedidoBody({ negocioId: negocio.id, productoId, metodoEntrega: "retiro" }), token),
      {}
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("El negocio no ofrece retiro")

    const count = await db.pedido.count({ where: { negocioId: negocio.id } })
    expect(count).toBe(0)
  })
})

// ============================================
// H. Solo retiro — regresión
// ============================================
describe("H. POST /api/pedidos — Solo retiro (delivery OFF, retiro ON) — regresión", () => {
  test("retiro: éxito; domicilio: rechazado (gate de ofreceDelivery ya existente, sin cambios)", async () => {
    const negocio = await ensureNegocio("h-solo-retiro", { ofreceDelivery: false, ofreceRetiro: true })
    const cliente = await ensureCliente("h-solo-retiro-cliente")
    const token = await createSession(cliente.id, "cliente")
    const productoId = await ensureProducto(negocio.id)

    const okRes = await crearPedido(
      reqPedido(pedidoBody({ negocioId: negocio.id, productoId, metodoEntrega: "retiro" }), token),
      {}
    )
    expect(okRes.status).toBe(201)

    const failRes = await crearPedido(
      reqPedido(
        pedidoBody({ negocioId: negocio.id, productoId, metodoEntrega: "domicilio", direccion: "Calle Falsa 123", lat: -34.6, lng: -58.4 }),
        token
      ),
      {}
    )
    expect(failRes.status).toBe(400)
    const failBody = await failRes.json()
    expect(failBody.error).toBe("El negocio no ofrece delivery")
  })
})

// ============================================
// I. Delivery + retiro — regresión
// ============================================
describe("I. POST /api/pedidos — Delivery + retiro (ambos ON) — regresión", () => {
  test("ambos métodos funcionan para el mismo negocio", async () => {
    const negocio = await ensureNegocio("i-ambos", { ofreceDelivery: true, ofreceRetiro: true })
    const cliente = await ensureCliente("i-ambos-cliente")
    const token = await createSession(cliente.id, "cliente")
    const productoId = await ensureProducto(negocio.id)

    const retiroRes = await crearPedido(
      reqPedido(pedidoBody({ negocioId: negocio.id, productoId, metodoEntrega: "retiro" }), token),
      {}
    )
    expect(retiroRes.status).toBe(201)

    const domicilioRes = await crearPedido(
      reqPedido(
        pedidoBody({ negocioId: negocio.id, productoId, metodoEntrega: "domicilio", direccion: "Calle Falsa 123", lat: -34.6, lng: -58.4 }),
        token
      ),
      {}
    )
    expect(domicilioRes.status).toBe(201)
  })
})

// ============================================
// J. Fuera de zona
// ============================================
describe("J. Fuera de zona de delivery", () => {
  // Triángulo lejos de la coordenada que van a enviar los tests (-34.6,-58.4)
  // — cualquier lat/lng ahí queda fuera de zona ("outside_zones").
  const zonaLejana = JSON.stringify([
    { nombre: "Zona lejana", precio: 100, puntos: [{ lat: 10, lng: 10 }, { lat: 10, lng: 11 }, { lat: 11, lng: 10 }] },
  ])

  test("Solo delivery + fuera de zona: domicilio rechazado por zona, retiro rechazado por capability — ningún método completa el pedido", async () => {
    const negocio = await ensureNegocio("j-solo-delivery-fuera-zona", {
      ofreceDelivery: true,
      ofreceRetiro: false,
      zonaDeliveryActiva: true,
      deliveryMode: "expert",
      zonasDelivery: zonaLejana,
    })
    const cliente = await ensureCliente("j-solo-delivery-fuera-zona-cliente")
    const token = await createSession(cliente.id, "cliente")
    const productoId = await ensureProducto(negocio.id)

    const domicilioRes = await crearPedido(
      reqPedido(
        pedidoBody({ negocioId: negocio.id, productoId, metodoEntrega: "domicilio", direccion: "Calle Falsa 123", lat: -34.6, lng: -58.4 }),
        token
      ),
      {}
    )
    expect(domicilioRes.status).toBe(400)
    const domicilioBody = await domicilioRes.json()
    expect(domicilioBody.error).toBe("Tu ubicación está fuera de la zona de delivery")
    expect(domicilioBody.error).not.toMatch(/retiro/i)

    const retiroRes = await crearPedido(
      reqPedido(pedidoBody({ negocioId: negocio.id, productoId, metodoEntrega: "retiro" }), token),
      {}
    )
    expect(retiroRes.status).toBe(400)

    const count = await db.pedido.count({ where: { negocioId: negocio.id } })
    expect(count).toBe(0)
  })

  test("Delivery + retiro + fuera de zona: domicilio rechazado por zona, retiro sigue disponible (fallback existente preservado)", async () => {
    const negocio = await ensureNegocio("j-ambos-fuera-zona", {
      ofreceDelivery: true,
      ofreceRetiro: true,
      zonaDeliveryActiva: true,
      deliveryMode: "expert",
      zonasDelivery: zonaLejana,
    })
    const cliente = await ensureCliente("j-ambos-fuera-zona-cliente")
    const token = await createSession(cliente.id, "cliente")
    const productoId = await ensureProducto(negocio.id)

    const domicilioRes = await crearPedido(
      reqPedido(
        pedidoBody({ negocioId: negocio.id, productoId, metodoEntrega: "domicilio", direccion: "Calle Falsa 123", lat: -34.6, lng: -58.4 }),
        token
      ),
      {}
    )
    expect(domicilioRes.status).toBe(400)

    const retiroRes = await crearPedido(
      reqPedido(pedidoBody({ negocioId: negocio.id, productoId, metodoEntrega: "retiro" }), token),
      {}
    )
    expect(retiroRes.status).toBe(201)
  })
})

// ============================================
// K. Pedido histórico — capability es gate de creación, no retroactivo
// ============================================
describe("K. Pedidos históricos sobreviven a la desactivación de la capability", () => {
  test("un pedido de retiro ya creado sigue su ciclo de vida normal aunque el negocio desactive Retiro después", async () => {
    const negocio = await ensureNegocio("k-historico", { ofreceDelivery: true, ofreceRetiro: true })
    const cliente = await ensureCliente("k-historico-cliente")
    const clienteToken = await createSession(cliente.id, "cliente")
    const productoId = await ensureProducto(negocio.id)

    const creado = await crearPedido(
      reqPedido(pedidoBody({ negocioId: negocio.id, productoId, metodoEntrega: "retiro" }), clienteToken),
      {}
    )
    expect(creado.status).toBe(201)
    const pedido = await creado.json()

    const negocioToken = await createSession(negocio.id, "negocio")
    const desactivado = await patchNegocioConfig(
      reqConCookie(
        "http://localhost/api/negocio/config",
        { [SESSION_COOKIE_NAME]: negocioToken },
        { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ofreceRetiro: false }) }
      )
    )
    expect(desactivado.status).toBe(200)

    const transicion = await patchPedidoEstado(
      reqConCookie(
        `http://localhost/api/negocio/pedidos/${pedido.id}/estado`,
        { [SESSION_COOKIE_NAME]: negocioToken },
        { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ estado: "preparando" }) }
      ),
      { params: Promise.resolve({ id: pedido.id }) }
    )
    expect(transicion.status).toBe(200)
    const transicionBody = await transicion.json()
    expect(transicionBody.estado).toBe("preparando")
  })
})

// ============================================
// L/M. Salón — independiente de Retiro/Delivery
// ============================================
describe("L/M. Salón es independiente de las capabilities de Retiro/Delivery", () => {
  test("salón OFF: un pedido de mesa se rechaza igual, sin importar retiro/delivery", async () => {
    const negocio = await ensureNegocio("l-salon-off", { ofreceDelivery: true, ofreceRetiro: false, salonActivo: false })
    const productoId = await ensureProducto(negocio.id)

    const res = await crearPedido(
      reqPedido(pedidoBody({ negocioId: negocio.id, productoId, metodoEntrega: "mesa", mesaNumero: 1 })),
      {}
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("El negocio no tiene Salón habilitado")
  })

  test("salón ON + solo delivery: pedido de mesa funciona, pedido de retiro sigue bloqueado", async () => {
    const negocio = await ensureNegocio("m-salon-on-solo-delivery", { ofreceDelivery: true, ofreceRetiro: false, salonActivo: true })
    const productoId = await ensureProducto(negocio.id)
    const mesa = await db.mesa.create({ data: { negocioId: negocio.id, numero: 7 } })

    const mesaRes = await crearPedido(
      reqPedido(pedidoBody({ negocioId: negocio.id, productoId, metodoEntrega: "mesa", mesaNumero: mesa.numero })),
      {}
    )
    expect(mesaRes.status).toBe(201)

    const cliente = await ensureCliente("m-salon-on-solo-delivery-cliente")
    const clienteToken = await createSession(cliente.id, "cliente")
    const retiroRes = await crearPedido(
      reqPedido(pedidoBody({ negocioId: negocio.id, productoId, metodoEntrega: "retiro" }), clienteToken),
      {}
    )
    expect(retiroRes.status).toBe(400)
  })
})
