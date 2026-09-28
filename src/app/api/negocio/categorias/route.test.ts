/// <reference types="bun-types" />

// ============================================
// P2-T56-R2B — GET/PUT/PATCH /api/negocio/categorias
// ============================================
// This route pre-dates R2B (it already backs Restaurante/Ropa's category
// management in products-tab.tsx) but had no DB-integration test of its own.
// R2B reuses it as-is for the new generic-business category manager, adding
// only minimal server-side validation (blank/oversized name rejection) —
// see the R2B report for why. Same real-DB convention as
// src/app/api/negocio/inventario/movimientos/route.test.ts: real
// Negocio/Producto rows, real session cookies, route handlers called
// directly, cleanup in afterAll.

import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createSession, deleteSession, SESSION_COOKIE_NAME } from "@/lib/auth"
import { GET, PATCH, PUT } from "./route"

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

async function createProducto(negocioId: string, categoria?: string) {
  return db.producto.create({
    data: {
      nombre: `Producto ${randomUUID()}`,
      precio: 1000,
      negocioId,
      ...(categoria !== undefined ? { categoria } : {}),
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
  await db.producto.deleteMany({ where: { negocioId: { in: createdBusinesses } } })
  await db.negocio.deleteMany({ where: { id: { in: createdBusinesses } } })
})

describe("P2-T56-R2B — GET /api/negocio/categorias", () => {
  test("a fresh negocio has an empty category list", async () => {
    const business = await createBusiness("test-t56-cat-empty")
    const cookie = await businessCookie(business.id)

    const response = await GET(request("/api/negocio/categorias", "GET", cookie))
    expect(response.status).toBe(200)
    expect((await response.json()).categorias).toEqual([])
  })

  test("TENANT ISOLATION: negocio A never sees negocio B's categories", async () => {
    const businessA = await createBusiness("test-t56-cat-read-a")
    const businessB = await createBusiness("test-t56-cat-read-b")
    const cookieA = await businessCookie(businessA.id)
    const cookieB = await businessCookie(businessB.id)

    await PUT(request("/api/negocio/categorias", "PUT", cookieB, { categorias: ["Bebidas"] }))
    const responseA = await GET(request("/api/negocio/categorias", "GET", cookieA))
    expect((await responseA.json()).categorias).toEqual([])
  })
})

describe("P2-T56-R2B — PUT /api/negocio/categorias (create/list/safe-delete)", () => {
  test("creates categories via full-array replacement, reflected on GET", async () => {
    const business = await createBusiness("test-t56-cat-create")
    const cookie = await businessCookie(business.id)

    const putResponse = await PUT(request("/api/negocio/categorias", "PUT", cookie, { categorias: ["Bebidas", "Limpieza"] }))
    expect(putResponse.status).toBe(200)

    const getResponse = await GET(request("/api/negocio/categorias", "GET", cookie))
    expect((await getResponse.json()).categorias).toEqual(["Bebidas", "Limpieza"])
  })

  test("rejects a non-array body", async () => {
    const business = await createBusiness("test-t56-cat-notarray")
    const cookie = await businessCookie(business.id)

    const response = await PUT(request("/api/negocio/categorias", "PUT", cookie, { categorias: "Bebidas" }))
    expect(response.status).toBe(400)
  })

  test("rejects a blank/whitespace-only category name", async () => {
    const business = await createBusiness("test-t56-cat-blank")
    const cookie = await businessCookie(business.id)

    const response = await PUT(request("/api/negocio/categorias", "PUT", cookie, { categorias: ["Bebidas", "   "] }))
    expect(response.status).toBe(400)
    const unchanged = await GET(request("/api/negocio/categorias", "GET", cookie))
    expect((await unchanged.json()).categorias).toEqual([])
  })

  test("rejects an oversized category name (> 60 chars)", async () => {
    const business = await createBusiness("test-t56-cat-toolong")
    const cookie = await businessCookie(business.id)

    const response = await PUT(request("/api/negocio/categorias", "PUT", cookie, { categorias: ["a".repeat(61)] }))
    expect(response.status).toBe(400)
  })

  test("a name at exactly the 60-char boundary is still accepted (regression: valid input unaffected)", async () => {
    const business = await createBusiness("test-t56-cat-boundary")
    const cookie = await businessCookie(business.id)

    const response = await PUT(request("/api/negocio/categorias", "PUT", cookie, { categorias: ["a".repeat(60)] }))
    expect(response.status).toBe(200)
  })

  test("removing a category from the array reassigns its products to 'Sin Categoria' — never deletes them", async () => {
    const business = await createBusiness("test-t56-cat-delete")
    const cookie = await businessCookie(business.id)
    await PUT(request("/api/negocio/categorias", "PUT", cookie, { categorias: ["Bebidas"] }))
    const producto = await createProducto(business.id, "Bebidas")

    const response = await PUT(request("/api/negocio/categorias", "PUT", cookie, { categorias: [] }))
    expect(response.status).toBe(200)

    const stillExists = await db.producto.findUnique({ where: { id: producto.id } })
    expect(stillExists).not.toBeNull()
    expect(stillExists?.categoria).toBe("Sin Categoria")
  })

  test("TENANT ISOLATION: negocio A's PUT never touches negocio B's categories or products", async () => {
    const businessA = await createBusiness("test-t56-cat-write-a")
    const businessB = await createBusiness("test-t56-cat-write-b")
    const cookieA = await businessCookie(businessA.id)
    const cookieB = await businessCookie(businessB.id)
    await PUT(request("/api/negocio/categorias", "PUT", cookieB, { categorias: ["Bebidas"] }))
    const productoB = await createProducto(businessB.id, "Bebidas")

    await PUT(request("/api/negocio/categorias", "PUT", cookieA, { categorias: [] }))

    const bCategorias = await GET(request("/api/negocio/categorias", "GET", cookieB))
    expect((await bCategorias.json()).categorias).toEqual(["Bebidas"])
    const productoBUnchanged = await db.producto.findUnique({ where: { id: productoB.id } })
    expect(productoBUnchanged?.categoria).toBe("Bebidas")
  })
})

describe("P2-T56-R2B — PATCH /api/negocio/categorias (rename)", () => {
  test("renaming updates the config array AND every product that used the old name", async () => {
    const business = await createBusiness("test-t56-cat-rename")
    const cookie = await businessCookie(business.id)
    await PUT(request("/api/negocio/categorias", "PUT", cookie, { categorias: ["Bebidas"] }))
    const producto = await createProducto(business.id, "Bebidas")

    const response = await PATCH(request("/api/negocio/categorias", "PATCH", cookie, { oldName: "Bebidas", newName: "Bebidas y Snacks" }))
    expect(response.status).toBe(200)

    const categorias = await GET(request("/api/negocio/categorias", "GET", cookie))
    expect((await categorias.json()).categorias).toEqual(["Bebidas y Snacks"])
    const updatedProducto = await db.producto.findUnique({ where: { id: producto.id } })
    expect(updatedProducto?.categoria).toBe("Bebidas y Snacks")
  })

  test("rejects a blank new name", async () => {
    const business = await createBusiness("test-t56-cat-rename-blank")
    const cookie = await businessCookie(business.id)
    await PUT(request("/api/negocio/categorias", "PUT", cookie, { categorias: ["Bebidas"] }))

    const response = await PATCH(request("/api/negocio/categorias", "PATCH", cookie, { oldName: "Bebidas", newName: "   " }))
    expect(response.status).toBe(400)
  })

  test("rejects an oversized new name (> 60 chars)", async () => {
    const business = await createBusiness("test-t56-cat-rename-toolong")
    const cookie = await businessCookie(business.id)
    await PUT(request("/api/negocio/categorias", "PUT", cookie, { categorias: ["Bebidas"] }))

    const response = await PATCH(request("/api/negocio/categorias", "PATCH", cookie, { oldName: "Bebidas", newName: "a".repeat(61) }))
    expect(response.status).toBe(400)
  })

  test("TENANT ISOLATION: negocio A renaming a same-named category never touches negocio B's products", async () => {
    const businessA = await createBusiness("test-t56-cat-rename-a")
    const businessB = await createBusiness("test-t56-cat-rename-b")
    const cookieA = await businessCookie(businessA.id)
    const cookieB = await businessCookie(businessB.id)
    await PUT(request("/api/negocio/categorias", "PUT", cookieA, { categorias: ["Bebidas"] }))
    await PUT(request("/api/negocio/categorias", "PUT", cookieB, { categorias: ["Bebidas"] }))
    const productoB = await createProducto(businessB.id, "Bebidas")

    await PATCH(request("/api/negocio/categorias", "PATCH", cookieA, { oldName: "Bebidas", newName: "Refrescos" }))

    const productoBUnchanged = await db.producto.findUnique({ where: { id: productoB.id } })
    expect(productoBUnchanged?.categoria).toBe("Bebidas")
    const bCategorias = await GET(request("/api/negocio/categorias", "GET", cookieB))
    expect((await bCategorias.json()).categorias).toEqual(["Bebidas"])
  })
})
