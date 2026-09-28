/// <reference types="bun-types" />

// ============================================
// P2-T56-R2C — PUT /api/negocio/productos/[id]/variantes/[varianteId]
// ============================================

import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createSession, deleteSession, SESSION_COOKIE_NAME } from "@/lib/auth"
import { PUT } from "./route"

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

async function createVariante(productoId: string, overrides: Partial<{ precio: number; activo: boolean }> = {}) {
  return db.productoVariante.create({
    data: { productoId, nombre: `Variante ${randomUUID()}`, precio: overrides.precio ?? 2000, activo: overrides.activo ?? true },
  })
}

async function businessCookie(businessId: string) {
  const token = await createSession(businessId, "negocio")
  createdSessions.push(token)
  return `${SESSION_COOKIE_NAME}=${token}`
}

function request(cookie: string, body: unknown) {
  return new NextRequest("http://localhost/api/negocio/productos/x/variantes/y", {
    method: "PUT",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

function paramsFor(id: string, varianteId: string) {
  return { params: Promise.resolve({ id, varianteId }) }
}

afterAll(async () => {
  for (const token of createdSessions) await deleteSession(token)
  await db.producto.deleteMany({ where: { negocioId: { in: createdBusinesses } } })
  await db.negocio.deleteMany({ where: { id: { in: createdBusinesses } } })
})

describe("P2-T56-R2C — PUT /api/negocio/productos/[id]/variantes/[varianteId]", () => {
  test("edits nombre/precio/costo", async () => {
    const business = await createBusiness("test-r2c-var-edit")
    const cookie = await businessCookie(business.id)
    const producto = await createProducto(business.id)
    const variante = await createVariante(producto.id)

    const response = await PUT(request(cookie, { nombre: "1,5 L", precio: 3200, costo: 2000 }), paramsFor(producto.id, variante.id))
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.nombre).toBe("1,5 L")
    expect(data.precio).toBe(3200)
    expect(data.costo).toBe(2000)
  })

  test("VARIANT_DELETE_BEHAVIOR: toggling activo=false soft-deactivates, never deletes the row", async () => {
    const business = await createBusiness("test-r2c-var-deactivate")
    const cookie = await businessCookie(business.id)
    const producto = await createProducto(business.id)
    const variante = await createVariante(producto.id)

    const response = await PUT(request(cookie, { activo: false }), paramsFor(producto.id, variante.id))
    expect(response.status).toBe(200)
    const stillExists = await db.productoVariante.findUnique({ where: { id: variante.id } })
    expect(stillExists).not.toBeNull()
    expect(stillExists?.activo).toBe(false)
  })

  test("there is no DELETE handler exported — hard delete is not supported", async () => {
    const routeModule = await import("./route")
    expect((routeModule as Record<string, unknown>).DELETE).toBeUndefined()
  })

  test("rejects a blank nombre", async () => {
    const business = await createBusiness("test-r2c-var-blank")
    const cookie = await businessCookie(business.id)
    const producto = await createProducto(business.id)
    const variante = await createVariante(producto.id)

    const response = await PUT(request(cookie, { nombre: "   " }), paramsFor(producto.id, variante.id))
    expect(response.status).toBe(400)
  })

  test("rejects a non-positive precio", async () => {
    const business = await createBusiness("test-r2c-var-precio")
    const cookie = await businessCookie(business.id)
    const producto = await createProducto(business.id)
    const variante = await createVariante(producto.id)

    const response = await PUT(request(cookie, { precio: 0 }), paramsFor(producto.id, variante.id))
    expect(response.status).toBe(400)
  })

  test("TENANT ISOLATION: negocio A cannot edit negocio B's variant", async () => {
    const businessA = await createBusiness("test-r2c-var-tenant-a")
    const businessB = await createBusiness("test-r2c-var-tenant-b")
    const cookieA = await businessCookie(businessA.id)
    const productoB = await createProducto(businessB.id)
    const varianteB = await createVariante(productoB.id, { precio: 2000 })

    const response = await PUT(request(cookieA, { precio: 9999 }), paramsFor(productoB.id, varianteB.id))
    expect(response.status).toBe(404)
    const unchanged = await db.productoVariante.findUnique({ where: { id: varianteB.id } })
    expect(unchanged?.precio).toBe(2000)
  })

  test("rejects a varianteId that doesn't belong to the given productoId (cross-product mismatch)", async () => {
    const business = await createBusiness("test-r2c-var-mismatch")
    const cookie = await businessCookie(business.id)
    const productoA = await createProducto(business.id)
    const productoB = await createProducto(business.id)
    const varianteOfB = await createVariante(productoB.id)

    const response = await PUT(request(cookie, { precio: 9999 }), paramsFor(productoA.id, varianteOfB.id))
    expect(response.status).toBe(404)
  })
})
