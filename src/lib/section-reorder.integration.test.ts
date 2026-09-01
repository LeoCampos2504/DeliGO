/// <reference types="bun-types" />

// ============================================
// CATALOG-SECTION-REORDER-ATOMICITY-R1 — real integration test
// ============================================
// Mirrors product-reorder.integration.test.ts exactly (same fixture/cleanup
// conventions, same request/session helpers) applied to
// SeccionCatalogo.orden instead of Producto.orden. SeccionCatalogo has no
// soft-delete field (unlike Producto.eliminado), so there is no
// "eliminated ID" case here — every row belonging to the business counts.

import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createSession, SESSION_COOKIE_NAME } from "@/lib/auth"
import { GET as getSecciones, POST as createSeccion } from "@/app/api/negocio/secciones/route"
import { PUT as updateSeccion } from "@/app/api/negocio/secciones/[id]/route"
import { PATCH as reorderSecciones } from "@/app/api/negocio/secciones/orden/route"
import { GET as getPublicBusiness } from "@/app/api/negocios/[slug]/route"

const prefix = `test-section-reorder-atomicity-r1-${randomUUID()}-`
setDefaultTimeout(60_000)

let negocioAId = ""
let negocioBId = ""
let clienteId = ""
let negocioASlug = ""
let tokenA = ""
let tokenB = ""
let clienteToken = ""
let sectionIds: string[] = []
let foreignSectionId = ""
let productAId = ""
let productBId = ""

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
  const secciones = await db.seccionCatalogo.findMany({
    where: { negocioId: negocioAId },
    select: { id: true, orden: true },
    orderBy: { orden: "asc" },
  })
  return secciones
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

  const [productA, productB] = await Promise.all([
    db.producto.create({ data: { negocioId: negocioAId, nombre: `${prefix}prod-a`, precio: 100 } }),
    db.producto.create({ data: { negocioId: negocioAId, nombre: `${prefix}prod-b`, precio: 100 } }),
  ])
  productAId = productA.id
  productBId = productB.id

  const secciones = await Promise.all([
    db.seccionCatalogo.create({ data: { negocioId: negocioAId, nombre: `${prefix}A`, orden: 20 } }),
    db.seccionCatalogo.create({ data: { negocioId: negocioAId, nombre: `${prefix}B`, orden: 5 } }),
    db.seccionCatalogo.create({ data: { negocioId: negocioAId, nombre: `${prefix}C`, orden: 90 } }),
  ])
  sectionIds = secciones.map((seccion) => seccion.id)

  // Section "A" (index 0) owns two products with a deliberate, non-trivial
  // SeccionProducto.orden — this must survive a SeccionCatalogo reorder
  // completely untouched.
  await db.seccionProducto.createMany({
    data: [
      { seccionId: sectionIds[0], productoId: productBId, orden: 1 },
      { seccionId: sectionIds[0], productoId: productAId, orden: 0 },
    ],
  })

  foreignSectionId = (await db.seccionCatalogo.create({
    data: { negocioId: negocioBId, nombre: `${prefix}foreign`, orden: 0 },
  })).id
})

afterAll(async () => {
  await cleanup()
  expect(await db.negocio.count({ where: { slug: { startsWith: prefix } } })).toBe(0)
  expect(await db.cliente.count({ where: { email: { startsWith: prefix } } })).toBe(0)
})

describe("CATALOG-SECTION-REORDER-ATOMICITY-R1 — global SeccionCatalogo.orden", () => {
  test("reorders the complete section list, reindexes 0..n-1, reaches the public catalog, and leaves SeccionProducto.orden untouched", async () => {
    const desired = [sectionIds[2], sectionIds[0], sectionIds[1]] // C, A, B
    const response = await reorderSecciones(request("/api/negocio/secciones/orden", "PATCH", authCookie(tokenA), { sectionIds: desired }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      sections: desired.map((id, orden) => ({ id, orden })),
    })
    expect(await readOrders()).toEqual(desired.map((id, orden) => ({ id, orden })))

    const adminResponse = await getSecciones(request("/api/negocio/secciones", "GET", authCookie(tokenA)))
    const adminSecciones = await adminResponse.json() as Array<{ id: string; orden: number }>
    expect(adminSecciones.map((seccion) => seccion.id)).toEqual(desired)
    expect(adminSecciones.map((seccion) => seccion.orden)).toEqual([0, 1, 2])

    const publicResponse = await getPublicBusiness(request(`/api/negocios/${negocioASlug}`, "GET"), { params: Promise.resolve({ slug: negocioASlug }) })
    expect(publicResponse.status).toBe(200)
    const publicBody = await publicResponse.json() as {
      secciones: Array<{ id: string; productos: Array<{ id: string }> }>
    }
    expect(publicBody.secciones.map((seccion) => seccion.id)).toEqual(desired)

    // Section "A" is now at public index 1 (C, A, B) — its two products must
    // still read back in their original SeccionProducto.orden (B, A were
    // stored as orden 1/0 respectively -> productAId first).
    const sectionAPublic = publicBody.secciones.find((seccion) => seccion.id === sectionIds[0])
    expect(sectionAPublic?.productos.map((product) => product.id)).toEqual([productAId, productBId])
  })

  test("rejects partial, duplicate, missing and foreign IDs without any write — including when the offending ID is last (proves the whole transaction aborts, not just the first check)", async () => {
    const before = await readOrders()
    const invalidLists = [
      [sectionIds[0], sectionIds[2]], // partial (missing one)
      [sectionIds[0], sectionIds[0], sectionIds[1]], // duplicate
      [sectionIds[1], sectionIds[2], sectionIds[0], "missing-section-id"], // nonexistent, appended last
      [sectionIds[1], sectionIds[2], sectionIds[0], foreignSectionId], // foreign, appended last
    ]
    for (const sectionIdsCandidate of invalidLists) {
      const response = await reorderSecciones(request("/api/negocio/secciones/orden", "PATCH", authCookie(tokenA), { sectionIds: sectionIdsCandidate }))
      expect(response.status).toBe(400)
      expect(await readOrders()).toEqual(before)
    }
  })

  test("enforces auth, ignores negocioId spoofing, and allows [] only for an empty business", async () => {
    expect((await reorderSecciones(request("/api/negocio/secciones/orden", "PATCH", undefined, { sectionIds }))).status).toBe(401)
    expect((await reorderSecciones(request("/api/negocio/secciones/orden", "PATCH", authCookie(clienteToken), { sectionIds }))).status).toBe(403)

    const spoofed = await reorderSecciones(request("/api/negocio/secciones/orden", "PATCH", authCookie(tokenA), {
      negocioId: negocioBId,
      sectionIds,
    }))
    expect(spoofed.status).toBe(200)
    expect(await readOrders()).toEqual(sectionIds.map((id, orden) => ({ id, orden })))

    await db.seccionCatalogo.delete({ where: { id: foreignSectionId } })
    const emptyBusiness = await reorderSecciones(request("/api/negocio/secciones/orden", "PATCH", authCookie(tokenB), { sectionIds: [] }))
    expect(emptyBusiness.status).toBe(200)
    expect(await emptyBusiness.json()).toEqual({ sections: [] })
  })

  test("removes generic PUT order authority", async () => {
    const before = await db.seccionCatalogo.findUniqueOrThrow({ where: { id: sectionIds[0] }, select: { orden: true } })
    const response = await updateSeccion(
      request(`/api/negocio/secciones/${sectionIds[0]}`, "PUT", authCookie(tokenA), { orden: 999 }),
      params(sectionIds[0])
    )
    expect(response.status).toBe(400)
    expect(await db.seccionCatalogo.findUniqueOrThrow({ where: { id: sectionIds[0] }, select: { orden: true } })).toEqual(before)
  })

  test("appends normal creates after the active maximum and ignores any client order", async () => {
    const response = await createSeccion(request("/api/negocio/secciones", "POST", authCookie(tokenA), {
      nombre: `${prefix}created`,
      orden: -999,
    }))
    expect(response.status).toBe(201)
    const created = await response.json() as { id: string; orden: number }
    expect(created.orden).toBe(3)
    expect(await readOrders()).toEqual([
      ...sectionIds.map((id, orden) => ({ id, orden })),
      { id: created.id, orden: 3 },
    ])
  })

  test("serializable concurrent reorders leave either a complete winner or a conflict, never partial positions", async () => {
    const currentIds = (await readOrders()).map((seccion) => seccion.id)
    const [first, second] = await Promise.all([
      reorderSecciones(request("/api/negocio/secciones/orden", "PATCH", authCookie(tokenA), { sectionIds: [...currentIds].reverse() })),
      reorderSecciones(request("/api/negocio/secciones/orden", "PATCH", authCookie(tokenA), { sectionIds: currentIds })),
    ])
    expect([200, 409]).toContain(first.status)
    expect([200, 409]).toContain(second.status)
    const final = await readOrders()
    expect(new Set(final.map((seccion) => seccion.id))).toEqual(new Set(currentIds))
    expect(final.map((seccion) => seccion.orden)).toEqual(currentIds.map((_, index) => index))
  })
})
