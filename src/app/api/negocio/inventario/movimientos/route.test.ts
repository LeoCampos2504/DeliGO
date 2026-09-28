/// <reference types="bun-types" />

// ============================================
// P2-T56-R1 — POST/GET /api/negocio/inventario/movimientos
// ============================================
// Real-DB integration test, same convention as
// src/app/api/negocio/empleados/route.test.ts: creates real Negocio/Producto
// rows in the TESTING database via createSession-backed cookies, calls the
// route handlers directly (no HTTP layer), and cleans up in afterAll.
//
// NOTE for reviewers: this suite could not be executed against a live
// database from inside the sandbox this was authored in (Postgres
// connection unreachable there — see the P2-T56-R1 report's TESTING_GATE
// section). It follows the exact structure/assertions of the existing,
// passing route.test.ts suites in this repo and is expected to run
// wherever DELIGO_TEST_DATABASE_URL is reachable, same as the rest of the
// repo's DB-dependent tests.

import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createSession, deleteSession, SESSION_COOKIE_NAME } from "@/lib/auth"
import { GET, POST } from "./route"

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

async function createProducto(negocioId: string, overrides: Partial<{ controlStock: boolean; stockCantidad: number; stockMinimo: number }> = {}) {
  return db.producto.create({
    data: {
      nombre: `Producto ${randomUUID()}`,
      precio: 1000,
      negocioId,
      controlStock: overrides.controlStock ?? true,
      stockCantidad: overrides.stockCantidad ?? 10,
      stockMinimo: overrides.stockMinimo ?? 2,
    },
  })
}

async function createVariante(productoId: string, overrides: Partial<{ controlStock: boolean; stockCantidad: number; stockMinimo: number }> = {}) {
  return db.productoVariante.create({
    data: {
      productoId,
      nombre: `Variante ${randomUUID()}`,
      precio: 2000,
      controlStock: overrides.controlStock ?? true,
      stockCantidad: overrides.stockCantidad ?? 10,
      stockMinimo: overrides.stockMinimo ?? 2,
    },
  })
}

async function businessCookie(businessId: string) {
  const token = await createSession(businessId, "negocio")
  createdSessions.push(token)
  return `${SESSION_COOKIE_NAME}=${token}`
}

function request(url: string, method: string, cookie: string, body?: unknown) {
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers: { cookie, "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

afterAll(async () => {
  for (const token of createdSessions) await deleteSession(token)
  await db.movimientoInventario.deleteMany({ where: { negocioId: { in: createdBusinesses } } })
  await db.producto.deleteMany({ where: { negocioId: { in: createdBusinesses } } })
  await db.negocio.deleteMany({ where: { id: { in: createdBusinesses } } })
})

describe("P2-T56-R1 — POST /api/negocio/inventario/movimientos", () => {
  test("ENTRADA increases stock and is traced by a movement row", async () => {
    const business = await createBusiness("test-t56-mov-entrada")
    const cookie = await businessCookie(business.id)
    const producto = await createProducto(business.id, { stockCantidad: 10 })

    const response = await POST(request("/api/negocio/inventario/movimientos", "POST", cookie, {
      productoId: producto.id,
      tipo: "ENTRADA",
      cantidad: 5,
    }))
    expect(response.status).toBe(201)
    const data = await response.json()
    expect(data.producto.stockCantidad).toBe(15)
    expect(data.movimiento.stockAntes).toBe(10)
    expect(data.movimiento.stockDespues).toBe(15)
  })

  test("SALIDA cannot push stock below zero", async () => {
    const business = await createBusiness("test-t56-mov-salida")
    const cookie = await businessCookie(business.id)
    const producto = await createProducto(business.id, { stockCantidad: 3 })

    const response = await POST(request("/api/negocio/inventario/movimientos", "POST", cookie, {
      productoId: producto.id,
      tipo: "SALIDA",
      cantidad: 10,
    }))
    expect(response.status).toBe(400)
    const unchanged = await db.producto.findUnique({ where: { id: producto.id } })
    expect(unchanged?.stockCantidad).toBe(3)
  })

  test("AJUSTE sets an absolute recount", async () => {
    const business = await createBusiness("test-t56-mov-ajuste")
    const cookie = await businessCookie(business.id)
    const producto = await createProducto(business.id, { stockCantidad: 999 })

    const response = await POST(request("/api/negocio/inventario/movimientos", "POST", cookie, {
      productoId: producto.id,
      tipo: "AJUSTE",
      cantidad: 7,
      motivo: "Recuento físico",
    }))
    expect(response.status).toBe(201)
    expect((await response.json()).producto.stockCantidad).toBe(7)
  })

  test("rejects a movement on a product without controlStock", async () => {
    const business = await createBusiness("test-t56-mov-nocontrol")
    const cookie = await businessCookie(business.id)
    const producto = await createProducto(business.id, { controlStock: false })

    const response = await POST(request("/api/negocio/inventario/movimientos", "POST", cookie, {
      productoId: producto.id,
      tipo: "ENTRADA",
      cantidad: 1,
    }))
    expect(response.status).toBe(400)
  })

  test("rejects tipo=VENTA — only POST /api/negocio/caja/ventas may create a VENTA movement", async () => {
    const business = await createBusiness("test-t56-mov-venta-blocked")
    const cookie = await businessCookie(business.id)
    const producto = await createProducto(business.id)

    const response = await POST(request("/api/negocio/inventario/movimientos", "POST", cookie, {
      productoId: producto.id,
      tipo: "VENTA",
      cantidad: 1,
    }))
    expect(response.status).toBe(400)
  })

  test("TENANT ISOLATION: negocio A cannot adjust negocio B's product stock", async () => {
    const businessA = await createBusiness("test-t56-mov-tenant-a")
    const businessB = await createBusiness("test-t56-mov-tenant-b")
    const cookieA = await businessCookie(businessA.id)
    const productoB = await createProducto(businessB.id, { stockCantidad: 10 })

    const response = await POST(request("/api/negocio/inventario/movimientos", "POST", cookieA, {
      productoId: productoB.id,
      tipo: "ENTRADA",
      cantidad: 5,
    }))
    expect(response.status).toBe(404)
    const unchanged = await db.producto.findUnique({ where: { id: productoB.id } })
    expect(unchanged?.stockCantidad).toBe(10)
  })

  test("TENANT ISOLATION: negocio A cannot read negocio B's movement history", async () => {
    const businessA = await createBusiness("test-t56-mov-read-a")
    const businessB = await createBusiness("test-t56-mov-read-b")
    const cookieA = await businessCookie(businessA.id)
    const cookieB = await businessCookie(businessB.id)
    const productoB = await createProducto(businessB.id, { stockCantidad: 10 })
    await POST(request("/api/negocio/inventario/movimientos", "POST", cookieB, {
      productoId: productoB.id,
      tipo: "ENTRADA",
      cantidad: 1,
    }))

    const response = await GET(request(`/api/negocio/inventario/movimientos?productoId=${productoB.id}`, "GET", cookieA))
    expect(response.status).toBe(404)
  })
})

// P2-T56-R2C: variant-aware stock movements (section 25) — ajustar stock on
// a product WITH variants must target ONE variant, never a fictitious
// product-level "total".
describe("P2-T56-R2C — POST /api/negocio/inventario/movimientos (variant-aware)", () => {
  test("ENTRADA on a variant increases ITS stock and leaves the parent Producto's own stock untouched", async () => {
    const business = await createBusiness("test-r2c-mov-var-entrada")
    const cookie = await businessCookie(business.id)
    const producto = await createProducto(business.id, { stockCantidad: 999 }) // deliberately distinct from the variant's own stock
    const variante = await createVariante(producto.id, { stockCantidad: 10 })

    const response = await POST(request("/api/negocio/inventario/movimientos", "POST", cookie, {
      productoId: producto.id,
      productoVarianteId: variante.id,
      tipo: "ENTRADA",
      cantidad: 5,
    }))
    expect(response.status).toBe(201)
    const data = await response.json()
    expect(data.variante.stockCantidad).toBe(15)
    expect(data.producto).toBeNull()

    const unchangedProducto = await db.producto.findUnique({ where: { id: producto.id } })
    expect(unchangedProducto?.stockCantidad).toBe(999)
  })

  test("SALIDA on a variant cannot push its stock below zero", async () => {
    const business = await createBusiness("test-r2c-mov-var-salida")
    const cookie = await businessCookie(business.id)
    const producto = await createProducto(business.id)
    const variante = await createVariante(producto.id, { stockCantidad: 3 })

    const response = await POST(request("/api/negocio/inventario/movimientos", "POST", cookie, {
      productoId: producto.id,
      productoVarianteId: variante.id,
      tipo: "SALIDA",
      cantidad: 10,
    }))
    expect(response.status).toBe(400)
    const unchanged = await db.productoVariante.findUnique({ where: { id: variante.id } })
    expect(unchanged?.stockCantidad).toBe(3)
  })

  test("a movement can identify the affected variant via productoVarianteId on the row", async () => {
    const business = await createBusiness("test-r2c-mov-var-trace")
    const cookie = await businessCookie(business.id)
    const producto = await createProducto(business.id)
    const variante = await createVariante(producto.id, { stockCantidad: 10 })

    await POST(request("/api/negocio/inventario/movimientos", "POST", cookie, {
      productoId: producto.id,
      productoVarianteId: variante.id,
      tipo: "AJUSTE",
      cantidad: 7,
    }))

    const movimiento = await db.movimientoInventario.findFirst({ where: { productoId: producto.id } })
    expect(movimiento?.productoVarianteId).toBe(variante.id)
  })

  test("rejects a movement on a variant without controlStock", async () => {
    const business = await createBusiness("test-r2c-mov-var-nocontrol")
    const cookie = await businessCookie(business.id)
    const producto = await createProducto(business.id)
    const variante = await createVariante(producto.id, { controlStock: false })

    const response = await POST(request("/api/negocio/inventario/movimientos", "POST", cookie, {
      productoId: producto.id,
      productoVarianteId: variante.id,
      tipo: "ENTRADA",
      cantidad: 1,
    }))
    expect(response.status).toBe(400)
  })

  test("rejects a productoVarianteId that belongs to a DIFFERENT product", async () => {
    const business = await createBusiness("test-r2c-mov-var-mismatch")
    const cookie = await businessCookie(business.id)
    const productoA = await createProducto(business.id)
    const productoB = await createProducto(business.id)
    const varianteOfB = await createVariante(productoB.id)

    const response = await POST(request("/api/negocio/inventario/movimientos", "POST", cookie, {
      productoId: productoA.id,
      productoVarianteId: varianteOfB.id,
      tipo: "ENTRADA",
      cantidad: 1,
    }))
    expect(response.status).toBe(404)
  })

  test("TENANT ISOLATION: negocio A cannot adjust a variant belonging to negocio B's product", async () => {
    const businessA = await createBusiness("test-r2c-mov-var-tenant-a")
    const businessB = await createBusiness("test-r2c-mov-var-tenant-b")
    const cookieA = await businessCookie(businessA.id)
    const productoB = await createProducto(businessB.id)
    const varianteB = await createVariante(productoB.id, { stockCantidad: 10 })

    const response = await POST(request("/api/negocio/inventario/movimientos", "POST", cookieA, {
      productoId: productoB.id,
      productoVarianteId: varianteB.id,
      tipo: "ENTRADA",
      cantidad: 5,
    }))
    expect(response.status).toBe(404)
    const unchanged = await db.productoVariante.findUnique({ where: { id: varianteB.id } })
    expect(unchanged?.stockCantidad).toBe(10)
  })
})
