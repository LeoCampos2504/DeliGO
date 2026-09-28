/// <reference types="bun-types" />

// ============================================
// P2-T56-R2C — POST /api/negocio/productos/[id]/variantes
// ============================================
// Real-DB integration test, same convention as
// src/app/api/negocio/inventario/movimientos/route.test.ts.

import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createSession, deleteSession, SESSION_COOKIE_NAME } from "@/lib/auth"
import { POST } from "./route"

setDefaultTimeout(60_000)

const testDatabaseUrl = process.env.DELIGO_TEST_DATABASE_URL
if (!testDatabaseUrl || process.env.DATABASE_URL !== testDatabaseUrl) {
  throw new Error(
    "Este test de integración requiere DELIGO_TEST_DATABASE_URL y DATABASE_URL apuntando a la misma base TESTING."
  )
}

const createdBusinesses: string[] = []
const createdSessions: string[] = []

async function createBusiness(prefix: string) {
  const suffix = randomUUID()
  const business = await db.negocio.create({
    data: {
      slug: `${prefix}-${suffix}`,
      nombre: `${prefix} ${suffix}`,
      usuario: `${prefix}-${suffix}`,
      email: `${prefix}-${suffix}@example.test`,
      password: "fixture",
      rubro: "negocio",
      aprobado: true,
      suspendido: false,
    },
  })
  createdBusinesses.push(business.id)
  return business
}

async function createProducto(negocioId: string) {
  return db.producto.create({ data: { nombre: `Producto ${randomUUID()}`, precio: 1000, negocioId } })
}

async function businessCookie(businessId: string) {
  const token = await createSession(businessId, "negocio")
  createdSessions.push(token)
  return `${SESSION_COOKIE_NAME}=${token}`
}

function request(cookie: string, body: unknown) {
  return new NextRequest("http://localhost/api/negocio/productos/x/variantes", {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

function paramsFor(id: string) {
  return { params: Promise.resolve({ id }) }
}

afterAll(async () => {
  for (const token of createdSessions) await deleteSession(token)
  await db.producto.deleteMany({ where: { negocioId: { in: createdBusinesses } } })
  await db.negocio.deleteMany({ where: { id: { in: createdBusinesses } } })
})

describe("P2-T56-R2C — POST /api/negocio/productos/[id]/variantes", () => {
  test("creates a variant with the minimum required fields", async () => {
    const business = await createBusiness("test-r2c-variante-create")
    const cookie = await businessCookie(business.id)
    const producto = await createProducto(business.id)

    const response = await POST(request(cookie, { nombre: "500 ml", precio: 2000 }), paramsFor(producto.id))
    expect(response.status).toBe(201)
    const data = await response.json()
    expect(data.nombre).toBe("500 ml")
    expect(data.precio).toBe(2000)
    expect(data.activo).toBe(true)
    expect(data.productoId).toBe(producto.id)
  })

  test("accepts the full optional field set", async () => {
    const business = await createBusiness("test-r2c-variante-full")
    const cookie = await businessCookie(business.id)
    const producto = await createProducto(business.id)

    const response = await POST(
      request(cookie, {
        nombre: "1,5 L",
        precio: 3200,
        costo: 2000,
        sku: "COC15L",
        codigoBarras: "7791234567890",
        controlStock: true,
        stockCantidad: 8,
        stockMinimo: 2,
      }),
      paramsFor(producto.id)
    )
    expect(response.status).toBe(201)
    const data = await response.json()
    expect(data.costo).toBe(2000)
    expect(data.sku).toBe("COC15L")
    expect(data.controlStock).toBe(true)
    expect(data.stockCantidad).toBe(8)
  })

  test("rejects a blank nombre", async () => {
    const business = await createBusiness("test-r2c-variante-blank")
    const cookie = await businessCookie(business.id)
    const producto = await createProducto(business.id)

    const response = await POST(request(cookie, { nombre: "   ", precio: 100 }), paramsFor(producto.id))
    expect(response.status).toBe(400)
  })

  test("rejects a non-positive precio", async () => {
    const business = await createBusiness("test-r2c-variante-precio")
    const cookie = await businessCookie(business.id)
    const producto = await createProducto(business.id)

    const response = await POST(request(cookie, { nombre: "X", precio: 0 }), paramsFor(producto.id))
    expect(response.status).toBe(400)
  })

  test("rejects a negative costo", async () => {
    const business = await createBusiness("test-r2c-variante-costo")
    const cookie = await businessCookie(business.id)
    const producto = await createProducto(business.id)

    const response = await POST(request(cookie, { nombre: "X", precio: 100, costo: -5 }), paramsFor(producto.id))
    expect(response.status).toBe(400)
  })

  test("TENANT ISOLATION: negocio A cannot create a variant on negocio B's product", async () => {
    const businessA = await createBusiness("test-r2c-variante-tenant-a")
    const businessB = await createBusiness("test-r2c-variante-tenant-b")
    const cookieA = await businessCookie(businessA.id)
    const productoB = await createProducto(businessB.id)

    const response = await POST(request(cookieA, { nombre: "X", precio: 100 }), paramsFor(productoB.id))
    expect(response.status).toBe(404)
    const variantes = await db.productoVariante.findMany({ where: { productoId: productoB.id } })
    expect(variantes).toHaveLength(0)
  })
})
