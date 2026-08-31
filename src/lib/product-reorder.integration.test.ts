/// <reference types="bun-types" />

import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createSession, SESSION_COOKIE_NAME } from "@/lib/auth"
import { POST as duplicateProduct } from "@/app/api/negocio/productos/[id]/duplicar/route"
import { GET as getAdminProducts, POST as createProduct } from "@/app/api/negocio/productos/route"
import { PUT as updateProduct } from "@/app/api/negocio/productos/[id]/route"
import { PATCH as reorderProducts } from "@/app/api/negocio/productos/orden/route"
import { GET as getPublicBusiness } from "@/app/api/negocios/[slug]/route"

const prefix = `test-product-reorder-r1-${randomUUID()}-`
setDefaultTimeout(60_000)

let negocioAId = ""
let negocioBId = ""
let clienteId = ""
let negocioASlug = ""
let tokenA = ""
let tokenB = ""
let clienteToken = ""
let productIds: string[] = []
let foreignProductId = ""
let deletedProductId = ""

async function cleanup() {
  const negocios = await db.negocio.findMany({
    where: { slug: { startsWith: prefix } },
    select: { id: true },
  })
  const negocioIds = negocios.map((negocio) => negocio.id)
  const clientes = await db.cliente.findMany({
    where: { email: { startsWith: prefix } },
    select: { id: true },
  })
  const clienteIds = clientes.map((cliente) => cliente.id)

  if (negocioIds.length || clienteIds.length) {
    await db.sesion.deleteMany({ where: { userId: { in: [...negocioIds, ...clienteIds] } } })
  }
  if (negocioIds.length) await db.negocio.deleteMany({ where: { id: { in: negocioIds } } })
  if (clienteIds.length) await db.cliente.deleteMany({ where: { id: { in: clienteIds } } })
}

async function createBusiness(label: string) {
  return db.negocio.create({
    data: {
      nombre: `${prefix}${label}`,
      slug: `${prefix}${label}`,
      usuario: `${prefix}${label}`,
      email: `${prefix}${label}@example.test`,
      password: "fixture",
      aprobado: true,
      suspendido: false,
    },
  })
}

function request(path: string, method: string, cookie?: string, body?: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

function authCookie(token: string) {
  return `${SESSION_COOKIE_NAME}=${token}`
}

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

async function readOrders() {
  const products = await db.producto.findMany({
    where: { negocioId: negocioAId, eliminado: false },
    select: { id: true, orden: true },
    orderBy: { orden: "asc" },
  })
  return products
}

beforeAll(async () => {
  expect(process.env.DATABASE_URL).toBe(process.env.DELIGO_TEST_DATABASE_URL)
  await cleanup()
  const [negocioA, negocioB, cliente] = await Promise.all([
    createBusiness("a"),
    createBusiness("b"),
    db.cliente.create({
      data: { nombre: `${prefix}cliente`, email: `${prefix}cliente@example.test`, telefono: "" },
    }),
  ])
  negocioAId = negocioA.id
  negocioBId = negocioB.id
  negocioASlug = negocioA.slug
  clienteId = cliente.id
  tokenA = await createSession(negocioAId, "negocio")
  tokenB = await createSession(negocioBId, "negocio")
  clienteToken = await createSession(clienteId, "cliente")

  const products = await Promise.all([
    db.producto.create({ data: { negocioId: negocioAId, nombre: `${prefix}a`, precio: 100, orden: 20 } }),
    db.producto.create({ data: { negocioId: negocioAId, nombre: `${prefix}b`, precio: 100, orden: 5 } }),
    db.producto.create({ data: { negocioId: negocioAId, nombre: `${prefix}c`, precio: 100, orden: 90, stock: false } }),
  ])
  productIds = products.map((product) => product.id)
  foreignProductId = (await db.producto.create({
    data: { negocioId: negocioBId, nombre: `${prefix}foreign`, precio: 100, orden: 4 },
  })).id
  deletedProductId = (await db.producto.create({
    data: { negocioId: negocioAId, nombre: `${prefix}deleted`, precio: 100, orden: 100, eliminado: true },
  })).id
})

afterAll(async () => {
  await cleanup()
  expect(await db.negocio.count({ where: { slug: { startsWith: prefix } } })).toBe(0)
  expect(await db.cliente.count({ where: { email: { startsWith: prefix } } })).toBe(0)
})

describe("CATALOG-PRODUCT-REORDER-R1 — global Product.orden", () => {
  test("reorders the complete active list, reindexes 0..n-1, and reaches the public catalog", async () => {
    const desired = [productIds[2], productIds[0], productIds[1]]
    const response = await reorderProducts(request("/api/negocio/productos/orden", "PATCH", authCookie(tokenA), { productIds: desired }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      products: desired.map((id, orden) => ({ id, orden })),
    })
    expect(await readOrders()).toEqual(desired.map((id, orden) => ({ id, orden })))

    const adminResponse = await getAdminProducts(request("/api/negocio/productos", "GET", authCookie(tokenA)))
    const adminProducts = await adminResponse.json() as Array<{ id: string; orden: number }>
    expect(adminProducts.filter((product) => desired.includes(product.id)).map((product) => product.id)).toEqual(desired)
    expect(adminProducts.filter((product) => desired.includes(product.id)).map((product) => product.orden)).toEqual([0, 1, 2])

    const publicResponse = await getPublicBusiness(request(`/api/negocios/${negocioASlug}`, "GET"), { params: Promise.resolve({ slug: negocioASlug }) })
    expect(publicResponse.status).toBe(200)
    const publicBody = await publicResponse.json() as { productosSinSeccion: Array<{ id: string }> }
    expect(publicBody.productosSinSeccion.map((product) => product.id)).toEqual(desired)
  })

  test("rejects partial, duplicate, missing, foreign, mixed, nonexistent and eliminated IDs without writes", async () => {
    const before = await readOrders()
    const invalidLists = [
      [productIds[0], productIds[2]],
      [productIds[0], productIds[0], productIds[1]],
      [productIds[0], productIds[1], "missing-product-id"],
      [productIds[0], productIds[1], foreignProductId],
      [productIds[0], productIds[1], deletedProductId],
    ]
    for (const productIdsCandidate of invalidLists) {
      const response = await reorderProducts(request("/api/negocio/productos/orden", "PATCH", authCookie(tokenA), { productIds: productIdsCandidate }))
      expect(response.status).toBe(400)
      expect(await readOrders()).toEqual(before)
    }
  })

  test("enforces auth, ignores negocioId spoofing, and allows [] only for an empty business", async () => {
    expect((await reorderProducts(request("/api/negocio/productos/orden", "PATCH", undefined, { productIds: productIds }))).status).toBe(401)
    expect((await reorderProducts(request("/api/negocio/productos/orden", "PATCH", authCookie(clienteToken), { productIds: productIds }))).status).toBe(403)

    const spoofed = await reorderProducts(request("/api/negocio/productos/orden", "PATCH", authCookie(tokenA), {
      negocioId: negocioBId,
      productIds,
    }))
    expect(spoofed.status).toBe(200)
    expect(await readOrders()).toEqual(productIds.map((id, orden) => ({ id, orden })))

    await db.producto.delete({ where: { id: foreignProductId } })
    const emptyBusiness = await reorderProducts(request("/api/negocio/productos/orden", "PATCH", authCookie(tokenB), { productIds: [] }))
    expect(emptyBusiness.status).toBe(200)
    expect(await emptyBusiness.json()).toEqual({ products: [] })
  })

  test("removes generic PUT order authority", async () => {
    const before = await db.producto.findUniqueOrThrow({ where: { id: productIds[0] }, select: { orden: true } })
    const response = await updateProduct(
      request(`/api/negocio/productos/${productIds[0]}`, "PUT", authCookie(tokenA), { orden: 999 }),
      params(productIds[0])
    )
    expect(response.status).toBe(400)
    expect(await db.producto.findUniqueOrThrow({ where: { id: productIds[0] }, select: { orden: true } })).toEqual(before)
  })

  test("appends normal creates after the active global maximum and ignores client order", async () => {
    const response = await createProduct(request("/api/negocio/productos", "POST", authCookie(tokenA), {
      nombre: `${prefix}created`,
      precio: 150,
      imagenUrl: "",
      orden: -999,
    }))
    expect(response.status).toBe(201)
    const created = await response.json() as { id: string; orden: number }
    expect(created.orden).toBe(3)
    expect(await readOrders()).toEqual([
      ...productIds.map((id, orden) => ({ id, orden })),
      { id: created.id, orden: 3 },
    ])
  })

  test("keeps duplication global append after a reorder", async () => {
    const response = await duplicateProduct(
      request(`/api/negocio/productos/${productIds[0]}/duplicar`, "POST", authCookie(tokenA)),
      params(productIds[0])
    )
    expect(response.status).toBe(201)
    const duplicate = await response.json() as { id: string; orden: number }
    expect(duplicate.orden).toBe(4)
  })

  test("serializable concurrent reorders leave either a complete winner or a conflict, never partial positions", async () => {
    const currentIds = (await readOrders()).map((product) => product.id)
    const [first, second] = await Promise.all([
      reorderProducts(request("/api/negocio/productos/orden", "PATCH", authCookie(tokenA), { productIds: [...currentIds].reverse() })),
      reorderProducts(request("/api/negocio/productos/orden", "PATCH", authCookie(tokenA), { productIds: currentIds })),
    ])
    expect([200, 409]).toContain(first.status)
    expect([200, 409]).toContain(second.status)
    const final = await readOrders()
    expect(new Set(final.map((product) => product.id))).toEqual(new Set(currentIds))
    expect(final.map((product) => product.orden)).toEqual(currentIds.map((_, index) => index))
  })
})
