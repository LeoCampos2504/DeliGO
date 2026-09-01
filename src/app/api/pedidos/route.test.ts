/// <reference types="bun-types" />

// ============================================
// P2-T01 — POST /api/pedidos: seguimientoDeliveryHabilitado snapshot
// ============================================
// Focal test for the ONE thing P2-T01 adds to pedido creation: the
// immutable tracking-eligibility snapshot (Pedido.seguimientoDeliveryHabilitado,
// P2T01-01/02/03/20). Deliberately does NOT re-test the rest of this route's
// creation logic (items, pricing, idempotency, mesa, horarios, ...) — that
// is already covered by the existing real-DB integration suites that also
// exercise POST /api/pedidos (dark-kitchen-solo-delivery.integration.test.ts,
// negocio-salon.test.ts, review-moderation-final.integration.test.ts, ...).
// Uses the REAL route (POST_FOR_TESTS) against PostgreSQL TESTING — never
// mocks Prisma — following the exact same fixture pattern as those files.
// All fixtures use the `test-p2t01-` prefix and are cleaned up in `afterAll`.

import { randomUUID } from "crypto"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createSession, SESSION_COOKIE_NAME } from "@/lib/auth"
import { POST_FOR_TESTS as crearPedido } from "@/app/api/pedidos/route"

setDefaultTimeout(60_000)

const prefix = "test-p2t01-"

async function ensureNegocio(suffix: string, seguimientoDeliveryActivo: boolean) {
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
      ofreceDelivery: true,
      ofreceRetiro: true,
      seguimientoDeliveryActivo,
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

function pedidoBody(params: { negocioId: string; productoId: string; metodoEntrega: "retiro" | "domicilio" }) {
  return {
    negocioId: params.negocioId,
    items: [
      { productoId: params.productoId, cantidad: 1, agregados: [], secciones: {}, ingredientesQuitados: [], talle: "", color: "" },
    ],
    metodoEntrega: params.metodoEntrega,
    metodoPago: "efectivo",
    notas: null,
    direccion: params.metodoEntrega === "domicilio" ? "Calle Falsa 123" : null,
    referencia: null,
    lat: params.metodoEntrega === "domicilio" ? -34.6 : null,
    lng: params.metodoEntrega === "domicilio" ? -58.4 : null,
    mesaId: null,
    mesaNumero: null,
    empleadoCodigo: null,
    fingerprint: null,
    mesaGeolocation: null,
  }
}

// `x-forwarded-for` único por request — mismo motivo que el resto de la
// suite real-DB de este directorio (rate limit "order" 5/5min + lock de
// concurrencia de POST /api/pedidos usan la IP cuando no hay cookie de
// cliente).
function reqPedido(body: unknown, cookie: string): NextRequest {
  return new NextRequest("http://localhost/api/pedidos", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": randomUUID(),
      cookie: `${SESSION_COOKIE_NAME}=${cookie}`,
    },
  })
}

async function crear(negocioId: string, productoId: string, metodoEntrega: "retiro" | "domicilio", clienteSuffix: string) {
  const cliente = await ensureCliente(clienteSuffix)
  const token = await createSession(cliente.id, "cliente")
  return crearPedido(reqPedido(pedidoBody({ negocioId, productoId, metodoEntrega }), token), {})
}

async function cleanup() {
  const negocios = await db.negocio.findMany({ where: { slug: { startsWith: prefix } }, select: { id: true } })
  const negocioIds = negocios.map((n) => n.id)
  const clientes = await db.cliente.findMany({ where: { email: { startsWith: prefix } }, select: { id: true } })
  const clienteIds = clientes.map((c) => c.id)

  if (negocioIds.length) {
    await db.pedido.deleteMany({ where: { negocioId: { in: negocioIds } } })
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

describe("P2T01-01/02/03/20 — POST /api/pedidos snapshots seguimientoDeliveryHabilitado at creation time, immutably", () => {
  test("P2T01-01: negocio con tracking OFF + domicilio -> snapshot false", async () => {
    const negocio = await ensureNegocio("a-off", false)
    const productoId = await ensureProducto(negocio.id)

    const res = await crear(negocio.id, productoId, "domicilio", "a-off-cliente")
    expect(res.status).toBe(201)
    const body = await res.json()

    const fresh = await db.pedido.findUniqueOrThrow({ where: { id: body.id } })
    expect(fresh.seguimientoDeliveryHabilitado).toBe(false)
  })

  test("P2T01-02: negocio con tracking ON + domicilio -> snapshot true", async () => {
    const negocio = await ensureNegocio("b-on", true)
    const productoId = await ensureProducto(negocio.id)

    const res = await crear(negocio.id, productoId, "domicilio", "b-on-cliente")
    expect(res.status).toBe(201)
    const body = await res.json()

    const fresh = await db.pedido.findUniqueOrThrow({ where: { id: body.id } })
    expect(fresh.seguimientoDeliveryHabilitado).toBe(true)
  })

  test("P2T01-03: activar el negocio DESPUÉS de crear un pedido con snapshot false no lo cambia retroactivamente (DECISION-TRACK-01)", async () => {
    const negocio = await ensureNegocio("c-retro", false)
    const productoId = await ensureProducto(negocio.id)

    const res = await crear(negocio.id, productoId, "domicilio", "c-retro-cliente")
    expect(res.status).toBe(201)
    const body = await res.json()

    let fresh = await db.pedido.findUniqueOrThrow({ where: { id: body.id } })
    expect(fresh.seguimientoDeliveryHabilitado).toBe(false)

    // El negocio activa tracking DESPUÉS — sólo afecta pedidos futuros.
    await db.negocio.update({ where: { id: negocio.id }, data: { seguimientoDeliveryActivo: true } })

    fresh = await db.pedido.findUniqueOrThrow({ where: { id: body.id } })
    expect(fresh.seguimientoDeliveryHabilitado).toBe(false)

    // Un pedido NUEVO, creado después de activar, sí queda en true.
    const cliente2 = await ensureCliente("c-retro-cliente-2")
    const token2 = await createSession(cliente2.id, "cliente")
    const res2 = await crearPedido(
      reqPedido(pedidoBody({ negocioId: negocio.id, productoId, metodoEntrega: "domicilio" }), token2),
      {}
    )
    expect(res2.status).toBe(201)
    const body2 = await res2.json()
    const fresh2 = await db.pedido.findUniqueOrThrow({ where: { id: body2.id } })
    expect(fresh2.seguimientoDeliveryHabilitado).toBe(true)
  })

  test("P2T01-20: retiro (no-domicilio) siempre snapshot false, incluso con negocio tracking ON", async () => {
    const negocio = await ensureNegocio("d-retiro", true)
    const productoId = await ensureProducto(negocio.id)

    const res = await crear(negocio.id, productoId, "retiro", "d-retiro-cliente")
    expect(res.status).toBe(201)
    const body = await res.json()

    const fresh = await db.pedido.findUniqueOrThrow({ where: { id: body.id } })
    expect(fresh.seguimientoDeliveryHabilitado).toBe(false)
  })
})

describe("P2-T08 F-T08-01 — autorización de mesa fail-closed ante excepción", () => {
  test("negocio calibrado/enforce: una excepción del autorizador devuelve 503 y no crea Pedido", async () => {
    const suffix = randomUUID()
    const negocio = await db.negocio.create({
      data: {
        nombre: `${prefix}f01-${suffix}`,
        slug: `${prefix}f01-${suffix}`,
        usuario: `${prefix}f01-${suffix}`,
        email: `${prefix}f01-${suffix}@example.test`,
        password: "fixture",
        aprobado: true,
        suspendido: false,
        salonActivo: true,
        horarioMode: "simple",
        abiertoManual: true,
        lat: -34.6037,
        lng: -58.3816,
        ubicacionCalibradaEn: new Date(),
      },
    })
    const producto = await db.producto.create({
      data: { nombre: `${prefix}f01-producto-${suffix}`, precio: 100, negocioId: negocio.id },
    })
    const mesa = await db.mesa.create({ data: { negocioId: negocio.id, numero: 9000 + Math.floor(Math.random() * 500) } })

    const response = await crearPedido(
      new NextRequest("http://localhost/api/pedidos", {
        method: "POST",
        body: JSON.stringify({
          negocioId: negocio.id,
          items: [{ productoId: producto.id, cantidad: 1, agregados: [], secciones: {}, ingredientesQuitados: [], talle: "", color: "" }],
          metodoEntrega: "mesa",
          metodoPago: "efectivo",
          notas: null,
          direccion: null,
          referencia: null,
          lat: null,
          lng: null,
          mesaId: mesa.id,
          mesaNumero: mesa.numero,
          empleadoCodigo: null,
          fingerprint: null,
          mesaGeolocation: { lat: -34.6037, lng: -58.3816, accuracy: 10 },
        }),
        headers: { "content-type": "application/json", "x-forwarded-for": randomUUID() },
      }),
      {
        authorizeStaffForNegocio: async () => {
          throw new Error("p2-t08 injected authorization failure")
        },
      }
    )

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({ code: "MESA_AUTH_UNAVAILABLE" })
    expect(await db.pedido.count({ where: { negocioId: negocio.id } })).toBe(0)
  })
})
