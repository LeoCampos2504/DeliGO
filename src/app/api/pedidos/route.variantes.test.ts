/// <reference types="bun-types" />

// ============================================
// P2-T56-R2C-F2 — POST /api/pedidos: variantes en Cliente (normal + Mesa)
// ============================================
// Real-DB integration test, same convention as
// src/app/api/pedidos/route.test.ts and
// src/app/api/negocio/caja/ventas/route.test.ts (P2-T56-R2C). Exercises the
// server-side variant resolution added to POST /api/pedidos: a product with
// >=1 ProductoVariante always requires a valid, active, in-stock variante
// that belongs to it; price/stock are always re-derived from the DB, never
// trusted from the request body (the body doesn't even carry a price).

import { randomUUID } from "crypto"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createSession, SESSION_COOKIE_NAME } from "@/lib/auth"
import { POST_FOR_TESTS as crearPedido } from "@/app/api/pedidos/route"

setDefaultTimeout(60_000)

const testDatabaseUrl = process.env.DELIGO_TEST_DATABASE_URL
if (!testDatabaseUrl || process.env.DATABASE_URL !== testDatabaseUrl) {
  throw new Error(
    "Este test de integración requiere DELIGO_TEST_DATABASE_URL y DATABASE_URL apuntando a la misma base TESTING."
  )
}

const prefix = "test-r2cf2-"

async function ensureNegocio(suffix: string) {
  return db.negocio.create({
    data: {
      nombre: `${prefix}${suffix}`,
      slug: `${prefix}${suffix}-${randomUUID()}`,
      usuario: `${prefix}${suffix}-${randomUUID()}`,
      email: `${prefix}${suffix}-${randomUUID()}@example.test`,
      password: "fixture",
      rubro: "negocio",
      aprobado: true,
      suspendido: false,
      horarioMode: "simple",
      abiertoManual: true,
      ofreceDelivery: true,
      ofreceRetiro: true,
    },
  })
}

async function ensureCliente(suffix: string) {
  return db.cliente.create({
    data: { nombre: `${prefix}${suffix}`, email: `${prefix}${suffix}-${randomUUID()}@example.test`, telefono: "" },
  })
}

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

function baseBody(params: {
  negocioId: string
  productoId: string
  varianteId?: string | null
}) {
  return {
    negocioId: params.negocioId,
    items: [
      {
        productoId: params.productoId,
        varianteId: params.varianteId ?? null,
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
  }
}

async function crear(body: unknown, clienteId: string) {
  const token = await createSession(clienteId, "cliente")
  return crearPedido(reqPedido(body, token), {})
}

async function cleanup() {
  const negocios = await db.negocio.findMany({ where: { slug: { startsWith: prefix } }, select: { id: true } })
  const negocioIds = negocios.map((n) => n.id)
  const clientes = await db.cliente.findMany({ where: { email: { startsWith: prefix } }, select: { id: true } })
  const clienteIds = clientes.map((c) => c.id)

  if (negocioIds.length) {
    await db.pedido.deleteMany({ where: { negocioId: { in: negocioIds } } })
    await db.productoVariante.deleteMany({ where: { producto: { negocioId: { in: negocioIds } } } })
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
})

describe("P2-T56-R2C-F2 — POST /api/pedidos resuelve ProductoVariante server-side", () => {
  test("producto SIN variantes se comporta exactamente igual que antes (regresión)", async () => {
    const negocio = await ensureNegocio("sin-variantes")
    const cliente = await ensureCliente("sin-variantes")
    const producto = await db.producto.create({
      data: { nombre: `${prefix}producto-simple`, precio: 500, negocioId: negocio.id },
    })

    const res = await crear(baseBody({ negocioId: negocio.id, productoId: producto.id }), cliente.id)
    expect(res.status).toBe(201)
    const body = await res.json()

    const item = await db.pedidoItem.findFirstOrThrow({ where: { pedidoId: body.id } })
    expect(item.productoVarianteId).toBeNull()
    expect(item.varianteNombre).toBeNull()
    expect(item.precio).toBe(500)
  })

  test("producto CON variantes exige varianteId — sin ella, 400", async () => {
    const negocio = await ensureNegocio("exige-variante")
    const cliente = await ensureCliente("exige-variante")
    const producto = await db.producto.create({
      data: { nombre: `${prefix}producto-con-variantes`, precio: 999, negocioId: negocio.id },
    })
    await db.productoVariante.create({
      data: { productoId: producto.id, nombre: "500 ml", precio: 2000 },
    })

    const res = await crear(baseBody({ negocioId: negocio.id, productoId: producto.id }), cliente.id)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("Debe seleccionar una variante")
    expect(await db.pedido.count({ where: { negocioId: negocio.id } })).toBe(0)
  })

  test("variante válida y activa: precio/nombre snapshot correctos, nunca el precio base", async () => {
    const negocio = await ensureNegocio("variante-valida")
    const cliente = await ensureCliente("variante-valida")
    const producto = await db.producto.create({
      data: { nombre: `${prefix}coca-cola`, precio: 999999, negocioId: negocio.id },
    })
    const variante = await db.productoVariante.create({
      data: { productoId: producto.id, nombre: "1,5 L", precio: 3200 },
    })

    const res = await crear(
      baseBody({ negocioId: negocio.id, productoId: producto.id, varianteId: variante.id }),
      cliente.id
    )
    expect(res.status).toBe(201)
    const body = await res.json()

    const item = await db.pedidoItem.findFirstOrThrow({ where: { pedidoId: body.id } })
    expect(item.productoVarianteId).toBe(variante.id)
    expect(item.varianteNombre).toBe("1,5 L")
    expect(item.precio).toBe(3200)

    const pedido = await db.pedido.findUniqueOrThrow({ where: { id: body.id } })
    expect(pedido.totalProductos).toBe(3200)
  })

  test("variante de OTRO producto (mismo negocio) es rechazada", async () => {
    const negocio = await ensureNegocio("variante-otro-producto")
    const cliente = await ensureCliente("variante-otro-producto")
    const productoA = await db.producto.create({
      data: { nombre: `${prefix}producto-a`, precio: 100, negocioId: negocio.id },
    })
    const productoB = await db.producto.create({
      data: { nombre: `${prefix}producto-b`, precio: 100, negocioId: negocio.id },
    })
    await db.productoVariante.create({ data: { productoId: productoA.id, nombre: "A1", precio: 100 } })
    const varianteB = await db.productoVariante.create({
      data: { productoId: productoB.id, nombre: "B1", precio: 200 },
    })

    const res = await crear(
      baseBody({ negocioId: negocio.id, productoId: productoA.id, varianteId: varianteB.id }),
      cliente.id
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("Variante invalida")
  })

  test("variante de OTRO negocio (tenant) es rechazada", async () => {
    const negocioA = await ensureNegocio("tenant-a")
    const negocioB = await ensureNegocio("tenant-b")
    const cliente = await ensureCliente("tenant-a")
    const productoA = await db.producto.create({
      data: { nombre: `${prefix}tenant-a-producto`, precio: 100, negocioId: negocioA.id },
    })
    await db.productoVariante.create({ data: { productoId: productoA.id, nombre: "A1", precio: 100 } })
    const productoB = await db.producto.create({
      data: { nombre: `${prefix}tenant-b-producto`, precio: 100, negocioId: negocioB.id },
    })
    const varianteOtroTenant = await db.productoVariante.create({
      data: { productoId: productoB.id, nombre: "B1", precio: 200 },
    })

    const res = await crear(
      baseBody({ negocioId: negocioA.id, productoId: productoA.id, varianteId: varianteOtroTenant.id }),
      cliente.id
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("Variante invalida")
  })

  test("variante INACTIVA es rechazada", async () => {
    const negocio = await ensureNegocio("variante-inactiva")
    const cliente = await ensureCliente("variante-inactiva")
    const producto = await db.producto.create({
      data: { nombre: `${prefix}producto-inactiva`, precio: 100, negocioId: negocio.id },
    })
    const variante = await db.productoVariante.create({
      data: { productoId: producto.id, nombre: "Descontinuada", precio: 100, activo: false },
    })

    const res = await crear(
      baseBody({ negocioId: negocio.id, productoId: producto.id, varianteId: variante.id }),
      cliente.id
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("Variante invalida")
  })

  test("variante con stock controlado en 0 es rechazada", async () => {
    const negocio = await ensureNegocio("variante-sin-stock")
    const cliente = await ensureCliente("variante-sin-stock")
    const producto = await db.producto.create({
      data: { nombre: `${prefix}producto-sin-stock`, precio: 100, negocioId: negocio.id },
    })
    const variante = await db.productoVariante.create({
      data: { productoId: producto.id, nombre: "Agotada", precio: 100, controlStock: true, stockCantidad: 0 },
    })

    const res = await crear(
      baseBody({ negocioId: negocio.id, productoId: producto.id, varianteId: variante.id }),
      cliente.id
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("Variante sin stock")
  })

  test("varianteId enviado para un producto SIN variantes es rechazado", async () => {
    const negocio = await ensureNegocio("sin-variantes-con-id")
    const cliente = await ensureCliente("sin-variantes-con-id")
    const producto = await db.producto.create({
      data: { nombre: `${prefix}producto-sin-variantes-2`, precio: 100, negocioId: negocio.id },
    })

    const res = await crear(
      baseBody({ negocioId: negocio.id, productoId: producto.id, varianteId: randomUUID() }),
      cliente.id
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("Este producto no tiene variantes")
  })

  test("dos variantes distintas del mismo producto no se mezclan (identidad correcta)", async () => {
    const negocio = await ensureNegocio("dos-variantes")
    const cliente = await ensureCliente("dos-variantes")
    const producto = await db.producto.create({
      data: { nombre: `${prefix}coca-cola-2`, precio: 1, negocioId: negocio.id },
    })
    const v1 = await db.productoVariante.create({
      data: { productoId: producto.id, nombre: "500 ml", precio: 2000 },
    })
    const v2 = await db.productoVariante.create({
      data: { productoId: producto.id, nombre: "2,25 L", precio: 4500 },
    })

    const body = baseBody({ negocioId: negocio.id, productoId: producto.id, varianteId: v1.id })
    body.items.push({
      productoId: producto.id,
      varianteId: v2.id,
      cantidad: 2,
      agregados: [],
      secciones: {},
      ingredientesQuitados: [],
      talle: "",
      color: "",
    })

    const res = await crear(body, cliente.id)
    expect(res.status).toBe(201)
    const resBody = await res.json()

    const items = await db.pedidoItem.findMany({ where: { pedidoId: resBody.id }, orderBy: { precio: "asc" } })
    expect(items).toHaveLength(2)
    expect(items[0].productoVarianteId).toBe(v1.id)
    expect(items[0].varianteNombre).toBe("500 ml")
    expect(items[0].precio).toBe(2000)
    expect(items[1].productoVarianteId).toBe(v2.id)
    expect(items[1].varianteNombre).toBe("2,25 L")
    expect(items[1].precio).toBe(4500)

    const pedido = await db.pedido.findUniqueOrThrow({ where: { id: resBody.id } })
    expect(pedido.totalProductos).toBe(2000 + 4500 * 2)
  })
})
