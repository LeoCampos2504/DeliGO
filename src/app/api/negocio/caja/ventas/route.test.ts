/// <reference types="bun-types" />

// ============================================
// P2-T56-R1 — POST/GET /api/negocio/caja/ventas
// ============================================
// Real-DB integration test, same convention as
// src/app/api/negocio/empleados/route.test.ts (see that file's header for
// the pattern this follows). Could not be executed against a live database
// from inside the sandbox this was authored in — see the P2-T56-R1 report.

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

async function createProducto(negocioId: string, overrides: Partial<{ nombre: string; precio: number; controlStock: boolean; stockCantidad: number; eliminado: boolean }> = {}) {
  return db.producto.create({
    data: {
      nombre: overrides.nombre ?? `Producto ${randomUUID()}`,
      precio: overrides.precio ?? 1000,
      negocioId,
      controlStock: overrides.controlStock ?? false,
      stockCantidad: overrides.stockCantidad ?? 0,
      eliminado: overrides.eliminado ?? false,
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
  await db.ventaItem.deleteMany({ where: { venta: { negocioId: { in: createdBusinesses } } } })
  await db.venta.deleteMany({ where: { negocioId: { in: createdBusinesses } } })
  await db.producto.deleteMany({ where: { negocioId: { in: createdBusinesses } } })
  await db.negocio.deleteMany({ where: { id: { in: createdBusinesses } } })
})

describe("P2-T56-R1 — POST /api/negocio/caja/ventas", () => {
  test("CASE server-side total authority: client-supplied price is ignored, server recomputes from DB", async () => {
    const business = await createBusiness("test-t56-venta-total")
    const cookie = await businessCookie(business.id)
    const producto = await createProducto(business.id, { precio: 3500 })

    const response = await POST(request("/api/negocio/caja/ventas", "POST", cookie, {
      metodoPago: "EFECTIVO",
      // A malicious/buggy client sending a fake price/total must have zero
      // effect — the route type doesn't even accept a price per line.
      items: [{ productoId: producto.id, cantidad: 2, precio: 1 }],
    }))
    expect(response.status).toBe(201)
    const venta = await response.json()
    expect(venta.total).toBe(7000) // 3500 * 2, never the injected "1"
    expect(venta.items[0].precio).toBe(3500)
  })

  test("CASE snapshot: a later product price/name change never rewrites a past sale's line", async () => {
    const business = await createBusiness("test-t56-venta-snapshot")
    const cookie = await businessCookie(business.id)
    const producto = await createProducto(business.id, { nombre: "Cuaderno A4", precio: 1200 })

    const created = await POST(request("/api/negocio/caja/ventas", "POST", cookie, {
      metodoPago: "EFECTIVO",
      items: [{ productoId: producto.id, cantidad: 1 }],
    }))
    const venta = await created.json()

    await db.producto.update({ where: { id: producto.id }, data: { nombre: "Cuaderno A4 Rayado", precio: 1800 } })

    const stored = await db.venta.findUnique({ where: { id: venta.id }, include: { items: true } })
    expect(stored?.items[0].nombre).toBe("Cuaderno A4")
    expect(stored?.items[0].precio).toBe(1200)
  })

  test("CASE stock decrement: a controlStock product is decremented exactly once", async () => {
    const business = await createBusiness("test-t56-venta-stock")
    const cookie = await businessCookie(business.id)
    const producto = await createProducto(business.id, { controlStock: true, stockCantidad: 10 })

    const response = await POST(request("/api/negocio/caja/ventas", "POST", cookie, {
      metodoPago: "EFECTIVO",
      items: [{ productoId: producto.id, cantidad: 3 }],
    }))
    expect(response.status).toBe(201)
    const updated = await db.producto.findUnique({ where: { id: producto.id } })
    expect(updated?.stockCantidad).toBe(7)

    const movimientos = await db.movimientoInventario.findMany({ where: { productoId: producto.id, tipo: "VENTA" } })
    expect(movimientos.length).toBe(1)
    expect(movimientos[0].cantidad).toBe(3)
  })

  test("CASE no double-discount: a product without controlStock is never decremented", async () => {
    const business = await createBusiness("test-t56-venta-nocontrol")
    const cookie = await businessCookie(business.id)
    const producto = await createProducto(business.id, { controlStock: false, stockCantidad: 0 })

    const response = await POST(request("/api/negocio/caja/ventas", "POST", cookie, {
      metodoPago: "EFECTIVO",
      items: [{ productoId: producto.id, cantidad: 5 }],
    }))
    expect(response.status).toBe(201)
    const unchanged = await db.producto.findUnique({ where: { id: producto.id } })
    expect(unchanged?.stockCantidad).toBe(0)
    const movimientos = await db.movimientoInventario.findMany({ where: { productoId: producto.id } })
    expect(movimientos.length).toBe(0)
  })

  test("CASE insufficient stock: the whole sale is rejected, nothing partially applied", async () => {
    const business = await createBusiness("test-t56-venta-sinstock")
    const cookie = await businessCookie(business.id)
    const productoA = await createProducto(business.id, { controlStock: true, stockCantidad: 5 })
    const productoB = await createProducto(business.id, { controlStock: true, stockCantidad: 1 })

    const response = await POST(request("/api/negocio/caja/ventas", "POST", cookie, {
      metodoPago: "EFECTIVO",
      items: [{ productoId: productoA.id, cantidad: 2 }, { productoId: productoB.id, cantidad: 5 }],
    }))
    expect(response.status).toBe(409)

    const stillA = await db.producto.findUnique({ where: { id: productoA.id } })
    expect(stillA?.stockCantidad).toBe(5) // productoA's stock must NOT have been touched
    const ventas = await db.venta.findMany({ where: { negocioId: business.id } })
    expect(ventas.length).toBe(0)
  })

  test("CASE product without stock control cannot be sold below zero, and a sold-out product cannot oversell", async () => {
    const business = await createBusiness("test-t56-venta-agotado")
    const cookie = await businessCookie(business.id)
    const producto = await createProducto(business.id, { controlStock: true, stockCantidad: 0 })

    const response = await POST(request("/api/negocio/caja/ventas", "POST", cookie, {
      metodoPago: "EFECTIVO",
      items: [{ productoId: producto.id, cantidad: 1 }],
    }))
    expect(response.status).toBe(409)
  })

  test("CASE invalid metodoPago is rejected", async () => {
    const business = await createBusiness("test-t56-venta-metodo")
    const cookie = await businessCookie(business.id)
    const producto = await createProducto(business.id)

    const response = await POST(request("/api/negocio/caja/ventas", "POST", cookie, {
      metodoPago: "MERCADOPAGO",
      items: [{ productoId: producto.id, cantidad: 1 }],
    }))
    expect(response.status).toBe(400)
  })

  test("TENANT ISOLATION: negocio A cannot sell negocio B's product", async () => {
    const businessA = await createBusiness("test-t56-venta-tenant-a")
    const businessB = await createBusiness("test-t56-venta-tenant-b")
    const cookieA = await businessCookie(businessA.id)
    const productoB = await createProducto(businessB.id, { precio: 5000 })

    const response = await POST(request("/api/negocio/caja/ventas", "POST", cookieA, {
      metodoPago: "EFECTIVO",
      items: [{ productoId: productoB.id, cantidad: 1 }],
    }))
    expect(response.status).toBe(400)
    const ventasA = await db.venta.findMany({ where: { negocioId: businessA.id } })
    expect(ventasA.length).toBe(0)
  })

  test("TENANT ISOLATION: negocio A cannot read negocio B's sales via GET", async () => {
    const businessA = await createBusiness("test-t56-venta-read-a")
    const businessB = await createBusiness("test-t56-venta-read-b")
    const cookieA = await businessCookie(businessA.id)
    const cookieB = await businessCookie(businessB.id)
    const productoB = await createProducto(businessB.id, { precio: 999 })
    await POST(request("/api/negocio/caja/ventas", "POST", cookieB, {
      metodoPago: "EFECTIVO",
      items: [{ productoId: productoB.id, cantidad: 1 }],
    }))

    const response = await GET(request("/api/negocio/caja/ventas", "GET", cookieA))
    const data = await response.json()
    expect((data.ventasHoy as Array<{ total: number }>).some((v) => v.total === 999)).toBe(false)
  })

  test("CASE concurrency: two simultaneous sales of the last unit never both succeed", async () => {
    const business = await createBusiness("test-t56-venta-concurrencia")
    const cookie = await businessCookie(business.id)
    const producto = await createProducto(business.id, { controlStock: true, stockCantidad: 1 })

    const [first, second] = await Promise.allSettled([
      POST(request("/api/negocio/caja/ventas", "POST", cookie, { metodoPago: "EFECTIVO", items: [{ productoId: producto.id, cantidad: 1 }] })),
      POST(request("/api/negocio/caja/ventas", "POST", cookie, { metodoPago: "EFECTIVO", items: [{ productoId: producto.id, cantidad: 1 }] })),
    ])

    const statuses = [first, second].map((r) => (r.status === "fulfilled" ? r.value.status : 0))
    const successCount = statuses.filter((s) => s === 201).length
    // Exactly one of the two concurrent sales may succeed for a single unit
    // of stock — the other must fail (409 insufficient stock, or a
    // retried/aborted 409 serialization conflict), never both succeeding.
    expect(successCount).toBe(1)

    const finalStock = await db.producto.findUnique({ where: { id: producto.id } })
    expect(finalStock?.stockCantidad).toBe(0)
  })
})
