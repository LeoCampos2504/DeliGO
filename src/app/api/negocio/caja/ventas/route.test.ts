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

async function createVariante(
  productoId: string,
  overrides: Partial<{ nombre: string; precio: number; controlStock: boolean; stockCantidad: number; activo: boolean }> = {}
) {
  return db.productoVariante.create({
    data: {
      productoId,
      nombre: overrides.nombre ?? `Variante ${randomUUID()}`,
      precio: overrides.precio ?? 2000,
      controlStock: overrides.controlStock ?? false,
      stockCantidad: overrides.stockCantidad ?? 0,
      activo: overrides.activo ?? true,
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
  // F10-B0: a sale with a ledger record cannot be deleted alone (NO ACTION FK) — drop the
  // fixture ledger first (legs cascade from their operation), then the system cash account.
  await db.operacionFinanciera.deleteMany({ where: { negocioId: { in: createdBusinesses } } })
  await db.cuentaFinanciera.deleteMany({ where: { negocioId: { in: createdBusinesses } } })
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

// P2-T56-R2C — variant-aware sales (sections 22-24, 31)
describe("P2-T56-R2C — POST /api/negocio/caja/ventas (product variants)", () => {
  test("price authority comes from the VARIANT, never the parent Producto.precio nor the client", async () => {
    const business = await createBusiness("test-r2c-venta-precio")
    const cookie = await businessCookie(business.id)
    const producto = await createProducto(business.id, { precio: 1800 }) // base price must be ignored once a variante is requested
    const variante = await createVariante(producto.id, { nombre: "500 ml", precio: 2000 })

    const response = await POST(request("/api/negocio/caja/ventas", "POST", cookie, {
      metodoPago: "EFECTIVO",
      items: [{ productoId: producto.id, varianteId: variante.id, cantidad: 3, precio: 1 }], // injected fake price
    }))
    expect(response.status).toBe(201)
    const venta = await response.json()
    expect(venta.total).toBe(6000) // 2000 * 3
    expect(venta.items[0].precio).toBe(2000)
  })

  test("VentaItem snapshot records both the product name and the variant name", async () => {
    const business = await createBusiness("test-r2c-venta-snapshot")
    const cookie = await businessCookie(business.id)
    const producto = await createProducto(business.id, { nombre: "Coca Cola" })
    const variante = await createVariante(producto.id, { nombre: "500 ml", precio: 2000 })

    const created = await POST(request("/api/negocio/caja/ventas", "POST", cookie, {
      metodoPago: "EFECTIVO",
      items: [{ productoId: producto.id, varianteId: variante.id, cantidad: 1 }],
    }))
    const venta = await created.json()

    // Renaming both AFTER the sale must never rewrite the historical snapshot (section 23/38).
    await db.producto.update({ where: { id: producto.id }, data: { nombre: "Coca Cola Zero" } })
    await db.productoVariante.update({ where: { id: variante.id }, data: { nombre: "500 ml PET", precio: 9999 } })

    const stored = await db.venta.findUnique({ where: { id: venta.id }, include: { items: true } })
    expect(stored?.items[0].nombre).toBe("Coca Cola")
    expect(stored?.items[0].varianteNombre).toBe("500 ml")
    expect(stored?.items[0].precio).toBe(2000)
    expect(stored?.items[0].productoVarianteId).toBe(variante.id)
  })

  test("two DIFFERENT variants of the same product are two distinct VentaItem lines, never merged", async () => {
    const business = await createBusiness("test-r2c-venta-doslineas")
    const cookie = await businessCookie(business.id)
    const producto = await createProducto(business.id)
    const v500 = await createVariante(producto.id, { nombre: "500 ml", precio: 2000 })
    const v15l = await createVariante(producto.id, { nombre: "1,5 L", precio: 3200 })

    const response = await POST(request("/api/negocio/caja/ventas", "POST", cookie, {
      metodoPago: "EFECTIVO",
      items: [
        { productoId: producto.id, varianteId: v500.id, cantidad: 2 },
        { productoId: producto.id, varianteId: v15l.id, cantidad: 1 },
      ],
    }))
    expect(response.status).toBe(201)
    const venta = await response.json()
    expect(venta.items).toHaveLength(2)
    expect(venta.total).toBe(7200) // 2000*2 + 3200
  })

  test("stock decrements on the VARIANT only — the parent Producto's own stock is untouched", async () => {
    const business = await createBusiness("test-r2c-venta-stockvariante")
    const cookie = await businessCookie(business.id)
    const producto = await createProducto(business.id, { controlStock: true, stockCantidad: 999 })
    const variante = await createVariante(producto.id, { controlStock: true, stockCantidad: 10 })

    const response = await POST(request("/api/negocio/caja/ventas", "POST", cookie, {
      metodoPago: "EFECTIVO",
      items: [{ productoId: producto.id, varianteId: variante.id, cantidad: 3 }],
    }))
    expect(response.status).toBe(201)

    const updatedVariante = await db.productoVariante.findUnique({ where: { id: variante.id } })
    expect(updatedVariante?.stockCantidad).toBe(7)
    const unchangedProducto = await db.producto.findUnique({ where: { id: producto.id } })
    expect(unchangedProducto?.stockCantidad).toBe(999)

    const movimientos = await db.movimientoInventario.findMany({ where: { productoVarianteId: variante.id, tipo: "VENTA" } })
    expect(movimientos).toHaveLength(1)
    expect(movimientos[0].cantidad).toBe(3)
  })

  test("selling one variant never changes a SIBLING variant's stock", async () => {
    const business = await createBusiness("test-r2c-venta-hermana")
    const cookie = await businessCookie(business.id)
    const producto = await createProducto(business.id)
    const v500 = await createVariante(producto.id, { controlStock: true, stockCantidad: 10 })
    const v15l = await createVariante(producto.id, { controlStock: true, stockCantidad: 8 })

    await POST(request("/api/negocio/caja/ventas", "POST", cookie, {
      metodoPago: "EFECTIVO",
      items: [{ productoId: producto.id, varianteId: v500.id, cantidad: 4 }],
    }))

    const unchangedSibling = await db.productoVariante.findUnique({ where: { id: v15l.id } })
    expect(unchangedSibling?.stockCantidad).toBe(8)
  })

  test("rejects a sale when the requested variant has insufficient stock, without touching anything", async () => {
    const business = await createBusiness("test-r2c-venta-sinstockvariante")
    const cookie = await businessCookie(business.id)
    const producto = await createProducto(business.id)
    const variante = await createVariante(producto.id, { controlStock: true, stockCantidad: 1 })

    const response = await POST(request("/api/negocio/caja/ventas", "POST", cookie, {
      metodoPago: "EFECTIVO",
      items: [{ productoId: producto.id, varianteId: variante.id, cantidad: 5 }],
    }))
    expect(response.status).toBe(409)
    const unchanged = await db.productoVariante.findUnique({ where: { id: variante.id } })
    expect(unchanged?.stockCantidad).toBe(1)
    const ventas = await db.venta.findMany({ where: { negocioId: business.id } })
    expect(ventas).toHaveLength(0)
  })

  test("rejects an INACTIVE variant — it must not be resolvable for a new sale", async () => {
    const business = await createBusiness("test-r2c-venta-inactiva")
    const cookie = await businessCookie(business.id)
    const producto = await createProducto(business.id)
    const variante = await createVariante(producto.id, { activo: false })

    const response = await POST(request("/api/negocio/caja/ventas", "POST", cookie, {
      metodoPago: "EFECTIVO",
      items: [{ productoId: producto.id, varianteId: variante.id, cantidad: 1 }],
    }))
    expect(response.status).toBe(400)
  })

  test("rejects a varianteId that belongs to a DIFFERENT product", async () => {
    const business = await createBusiness("test-r2c-venta-mismatch")
    const cookie = await businessCookie(business.id)
    const productoA = await createProducto(business.id)
    const productoB = await createProducto(business.id)
    const varianteOfB = await createVariante(productoB.id)

    const response = await POST(request("/api/negocio/caja/ventas", "POST", cookie, {
      metodoPago: "EFECTIVO",
      items: [{ productoId: productoA.id, varianteId: varianteOfB.id, cantidad: 1 }],
    }))
    expect(response.status).toBe(400)
  })

  test("a product WITH variants can still be sold WITHOUT a varianteId, using its own precio (backward compatibility)", async () => {
    const business = await createBusiness("test-r2c-venta-sinvariante")
    const cookie = await businessCookie(business.id)
    const producto = await createProducto(business.id, { precio: 1800 })
    await createVariante(producto.id) // exists but not referenced by this sale

    const response = await POST(request("/api/negocio/caja/ventas", "POST", cookie, {
      metodoPago: "EFECTIVO",
      items: [{ productoId: producto.id, cantidad: 1 }],
    }))
    expect(response.status).toBe(201)
    const venta = await response.json()
    expect(venta.items[0].precio).toBe(1800)
    expect(venta.items[0].productoVarianteId).toBeNull()
  })

  test("TENANT ISOLATION: negocio A cannot sell a variant belonging to negocio B's product", async () => {
    const businessA = await createBusiness("test-r2c-venta-tenant-a")
    const businessB = await createBusiness("test-r2c-venta-tenant-b")
    const cookieA = await businessCookie(businessA.id)
    const productoB = await createProducto(businessB.id)
    const varianteB = await createVariante(productoB.id, { precio: 5000 })

    const response = await POST(request("/api/negocio/caja/ventas", "POST", cookieA, {
      metodoPago: "EFECTIVO",
      items: [{ productoId: productoB.id, varianteId: varianteB.id, cantidad: 1 }],
    }))
    expect(response.status).toBe(400)
    const ventasA = await db.venta.findMany({ where: { negocioId: businessA.id } })
    expect(ventasA).toHaveLength(0)
  })

  test("CONCURRENCY_VARIANT_STOCK_PASS: two simultaneous sales of the last unit of ONE variant never both succeed", async () => {
    const business = await createBusiness("test-r2c-venta-concurrencia-variante")
    const cookie = await businessCookie(business.id)
    const producto = await createProducto(business.id)
    const variante = await createVariante(producto.id, { controlStock: true, stockCantidad: 1 })

    const [first, second] = await Promise.allSettled([
      POST(request("/api/negocio/caja/ventas", "POST", cookie, { metodoPago: "EFECTIVO", items: [{ productoId: producto.id, varianteId: variante.id, cantidad: 1 }] })),
      POST(request("/api/negocio/caja/ventas", "POST", cookie, { metodoPago: "EFECTIVO", items: [{ productoId: producto.id, varianteId: variante.id, cantidad: 1 }] })),
    ])

    const statuses = [first, second].map((r) => (r.status === "fulfilled" ? r.value.status : 0))
    const successCount = statuses.filter((s) => s === 201).length
    expect(successCount).toBe(1)

    const finalStock = await db.productoVariante.findUnique({ where: { id: variante.id } })
    expect(finalStock?.stockCantidad).toBe(0)
  })
})
