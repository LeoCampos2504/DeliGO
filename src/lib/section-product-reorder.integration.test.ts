/// <reference types="bun-types" />

// ============================================
// CATALOG-SECTION-PRODUCT-REORDER-R1 — real integration test
// ============================================
// SeccionProducto.orden: order of products WITHIN one section. Distinct
// from Producto.orden (global) and SeccionCatalogo.orden (order of
// sections) — both are asserted unchanged throughout. Mirrors the fixture/
// request conventions of product-reorder.integration.test.ts and
// section-reorder.integration.test.ts.

import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createSession, SESSION_COOKIE_NAME } from "@/lib/auth"
import { PUT as updateSeccion } from "@/app/api/negocio/secciones/[id]/route"
import { PATCH as reorderSectionProducts } from "@/app/api/negocio/secciones/[id]/productos/orden/route"
import { GET as getPublicBusiness } from "@/app/api/negocios/[slug]/route"

const prefix = `test-section-product-reorder-r1-${randomUUID()}-`
setDefaultTimeout(60_000)

let negocioAId = ""
let negocioBId = ""
let clienteId = ""
let negocioASlug = ""
let tokenA = ""
let tokenB = ""
let clienteToken = ""

let seccionUnoId = ""
let seccionDosId = ""
let seccionEmptyId = ""
let foreignSeccionId = ""

let productAId = ""
let productBId = ""
let productCId = ""
let productDId = ""
let productStockFalseId = ""
let productStandaloneId = ""
let foreignProductId = ""

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

async function readSectionOrders(seccionId: string) {
  return db.seccionProducto.findMany({
    where: { seccionId },
    select: { productoId: true, orden: true },
    orderBy: { orden: "asc" },
  })
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

  const [productA, productB, productC, productD, productStockFalse, productStandalone] = await Promise.all([
    db.producto.create({ data: { negocioId: negocioAId, nombre: `${prefix}A`, precio: 100 } }),
    db.producto.create({ data: { negocioId: negocioAId, nombre: `${prefix}B`, precio: 100 } }),
    db.producto.create({ data: { negocioId: negocioAId, nombre: `${prefix}C`, precio: 100 } }),
    db.producto.create({ data: { negocioId: negocioAId, nombre: `${prefix}D`, precio: 100 } }),
    db.producto.create({ data: { negocioId: negocioAId, nombre: `${prefix}stockfalse`, precio: 100, stock: false } }),
    db.producto.create({ data: { negocioId: negocioAId, nombre: `${prefix}standalone`, precio: 100 } }),
  ])
  productAId = productA.id
  productBId = productB.id
  productCId = productC.id
  productDId = productD.id
  productStockFalseId = productStockFalse.id
  productStandaloneId = productStandalone.id

  foreignProductId = (await db.producto.create({
    data: { negocioId: negocioBId, nombre: `${prefix}foreign-product`, precio: 100 },
  })).id

  const [seccionUno, seccionDos, seccionEmpty] = await Promise.all([
    db.seccionCatalogo.create({ data: { negocioId: negocioAId, nombre: `${prefix}uno`, orden: 0 } }),
    db.seccionCatalogo.create({ data: { negocioId: negocioAId, nombre: `${prefix}dos`, orden: 1 } }),
    db.seccionCatalogo.create({ data: { negocioId: negocioAId, nombre: `${prefix}vacia`, orden: 2 } }),
  ])
  seccionUnoId = seccionUno.id
  seccionDosId = seccionDos.id
  seccionEmptyId = seccionEmpty.id

  foreignSeccionId = (await db.seccionCatalogo.create({
    data: { negocioId: negocioBId, nombre: `${prefix}foreign-seccion`, orden: 0 },
  })).id

  // seccionUno: A, B, C, stockFalse (0..3) — the main reorder target.
  await db.seccionProducto.createMany({
    data: [
      { seccionId: seccionUnoId, productoId: productAId, orden: 0 },
      { seccionId: seccionUnoId, productoId: productBId, orden: 1 },
      { seccionId: seccionUnoId, productoId: productCId, orden: 2 },
      { seccionId: seccionUnoId, productoId: productStockFalseId, orden: 3 },
    ],
  })
  // seccionDos: A (shared with seccionUno) + D — multi-section isolation target.
  await db.seccionProducto.createMany({
    data: [
      { seccionId: seccionDosId, productoId: productAId, orden: 0 },
      { seccionId: seccionDosId, productoId: productDId, orden: 1 },
    ],
  })
})

afterAll(async () => {
  await cleanup()
  expect(await db.negocio.count({ where: { slug: { startsWith: prefix } } })).toBe(0)
  expect(await db.cliente.count({ where: { email: { startsWith: prefix } } })).toBe(0)
})

describe("CATALOG-SECTION-PRODUCT-REORDER-R1 — per-section SeccionProducto.orden", () => {
  test("reorders one section's full member list, reindexes 0..n-1, reaches the public catalog, and leaves the other section + global orders untouched", async () => {
    const producto_ordenBefore = await db.producto.findUniqueOrThrow({ where: { id: productAId }, select: { orden: true } })
    const seccionUnoOrdenBefore = await db.seccionCatalogo.findUniqueOrThrow({ where: { id: seccionUnoId }, select: { orden: true } })
    const otherSectionBefore = await readSectionOrders(seccionDosId)

    const desired = [productCId, productAId, productStockFalseId, productBId] // C, A, stockFalse, B
    const response = await reorderSectionProducts(
      request(`/api/negocio/secciones/${seccionUnoId}/productos/orden`, "PATCH", authCookie(tokenA), { productIds: desired }),
      params(seccionUnoId)
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ products: desired.map((productoId, orden) => ({ productoId, orden })) })
    expect(await readSectionOrders(seccionUnoId)).toEqual(desired.map((productoId, orden) => ({ productoId, orden })))

    const publicResponse = await getPublicBusiness(request(`/api/negocios/${negocioASlug}`, "GET"), { params: Promise.resolve({ slug: negocioASlug }) })
    expect(publicResponse.status).toBe(200)
    const publicBody = await publicResponse.json() as { secciones: Array<{ id: string; productos: Array<{ id: string; stock: boolean }> }> }
    const publicSeccionUno = publicBody.secciones.find((s) => s.id === seccionUnoId)
    expect(publicSeccionUno?.productos.map((p) => p.id)).toEqual(desired)
    // stock=false stays IN the ordered set — it's "Sin stock", not hidden.
    const stockFalseEntry = publicSeccionUno?.productos.find((p) => p.id === productStockFalseId)
    expect(stockFalseEntry?.stock).toBe(false)

    // Isolation: the other section, the global Producto.orden, and
    // SeccionCatalogo.orden must be byte-identical to before.
    expect(await readSectionOrders(seccionDosId)).toEqual(otherSectionBefore)
    expect(await db.producto.findUniqueOrThrow({ where: { id: productAId }, select: { orden: true } })).toEqual(producto_ordenBefore)
    expect(await db.seccionCatalogo.findUniqueOrThrow({ where: { id: seccionUnoId }, select: { orden: true } })).toEqual(seccionUnoOrdenBefore)
  })

  test("rejects partial, duplicate, non-member, foreign-product and nonexistent IDs without any write — including when the offending ID is last", async () => {
    const before = await readSectionOrders(seccionUnoId)
    const invalidLists = [
      [productCId, productAId, productStockFalseId], // partial (missing productB)
      [productCId, productCId, productAId, productStockFalseId, productBId], // duplicate
      [productAId, productStockFalseId, productBId, productStandaloneId], // non-member of this section, last
      [productAId, productStockFalseId, productBId, foreignProductId], // foreign product, last
      [productAId, productStockFalseId, productBId, "missing-product-id"], // nonexistent, last
    ]
    for (const productIdsCandidate of invalidLists) {
      const response = await reorderSectionProducts(
        request(`/api/negocio/secciones/${seccionUnoId}/productos/orden`, "PATCH", authCookie(tokenA), { productIds: productIdsCandidate }),
        params(seccionUnoId)
      )
      expect(response.status).toBe(400)
      expect(await readSectionOrders(seccionUnoId)).toEqual(before)
    }
  })

  test("enforces auth, ownership (foreign section -> 404), ignores negocioId spoofing, and allows [] only for an empty section", async () => {
    const currentIds = (await readSectionOrders(seccionUnoId)).map((sp) => sp.productoId)
    expect((await reorderSectionProducts(
      request(`/api/negocio/secciones/${seccionUnoId}/productos/orden`, "PATCH", undefined, { productIds: currentIds }),
      params(seccionUnoId)
    )).status).toBe(401)
    expect((await reorderSectionProducts(
      request(`/api/negocio/secciones/${seccionUnoId}/productos/orden`, "PATCH", authCookie(clienteToken), { productIds: currentIds }),
      params(seccionUnoId)
    )).status).toBe(403)
    expect((await reorderSectionProducts(
      request(`/api/negocio/secciones/${foreignSeccionId}/productos/orden`, "PATCH", authCookie(tokenA), { productIds: [] }),
      params(foreignSeccionId)
    )).status).toBe(404)

    const spoofed = await reorderSectionProducts(
      request(`/api/negocio/secciones/${seccionUnoId}/productos/orden`, "PATCH", authCookie(tokenA), {
        negocioId: negocioBId,
        productIds: currentIds,
      }),
      params(seccionUnoId)
    )
    expect(spoofed.status).toBe(200)
    expect(await readSectionOrders(seccionUnoId)).toEqual(currentIds.map((productoId, orden) => ({ productoId, orden })))

    const emptySection = await reorderSectionProducts(
      request(`/api/negocio/secciones/${seccionEmptyId}/productos/orden`, "PATCH", authCookie(tokenA), { productIds: [] }),
      params(seccionEmptyId)
    )
    expect(emptySection.status).toBe(200)
    expect(await emptySection.json()).toEqual({ products: [] })
  })

  test("serializable concurrent reorders leave either a complete winner or a conflict, never partial positions", async () => {
    const currentIds = (await readSectionOrders(seccionUnoId)).map((sp) => sp.productoId)
    const [first, second] = await Promise.all([
      reorderSectionProducts(
        request(`/api/negocio/secciones/${seccionUnoId}/productos/orden`, "PATCH", authCookie(tokenA), { productIds: [...currentIds].reverse() }),
        params(seccionUnoId)
      ),
      reorderSectionProducts(
        request(`/api/negocio/secciones/${seccionUnoId}/productos/orden`, "PATCH", authCookie(tokenA), { productIds: currentIds }),
        params(seccionUnoId)
      ),
    ])
    expect([200, 409]).toContain(first.status)
    expect([200, 409]).toContain(second.status)
    const final = await readSectionOrders(seccionUnoId)
    expect(new Set(final.map((sp) => sp.productoId))).toEqual(new Set(currentIds))
    expect(final.map((sp) => sp.orden)).toEqual(currentIds.map((_, index) => index))
  })
})

describe("CATALOG-SECTION-PRODUCT-REORDER-R1 — generic section PUT never silently reorders membership", () => {
  let seccionMembershipId = ""
  let m1 = "", m2 = "", m3 = "", m4 = "", m5 = ""

  beforeAll(async () => {
    const [p1, p2, p3, p4, p5] = await Promise.all([
      db.producto.create({ data: { negocioId: negocioAId, nombre: `${prefix}m1`, precio: 100 } }),
      db.producto.create({ data: { negocioId: negocioAId, nombre: `${prefix}m2`, precio: 100 } }),
      db.producto.create({ data: { negocioId: negocioAId, nombre: `${prefix}m3`, precio: 100 } }),
      db.producto.create({ data: { negocioId: negocioAId, nombre: `${prefix}m4`, precio: 100 } }),
      db.producto.create({ data: { negocioId: negocioAId, nombre: `${prefix}m5`, precio: 100 } }),
    ])
    m1 = p1.id; m2 = p2.id; m3 = p3.id; m4 = p4.id; m5 = p5.id

    const seccion = await db.seccionCatalogo.create({ data: { negocioId: negocioAId, nombre: `${prefix}membership`, orden: 5 } })
    seccionMembershipId = seccion.id
    await db.seccionProducto.createMany({
      data: [
        { seccionId: seccionMembershipId, productoId: m1, orden: 0 },
        { seccionId: seccionMembershipId, productoId: m2, orden: 1 },
        { seccionId: seccionMembershipId, productoId: m3, orden: 2 },
      ],
    })
    // Explicit reorder via the dedicated endpoint: M3, M1, M2.
    const reordered = await reorderSectionProducts(
      request(`/api/negocio/secciones/${seccionMembershipId}/productos/orden`, "PATCH", authCookie(tokenA), { productIds: [m3, m1, m2] }),
      params(seccionMembershipId)
    )
    expect(reordered.status).toBe(200)
  })

  test("A. editing only nombre/color leaves the internal reorder completely untouched", async () => {
    const before = await readSectionOrders(seccionMembershipId)
    const response = await updateSeccion(
      request(`/api/negocio/secciones/${seccionMembershipId}`, "PUT", authCookie(tokenA), { nombre: `${prefix}membership-renamed`, color: "#123456" }),
      params(seccionMembershipId)
    )
    expect(response.status).toBe(200)
    expect(await readSectionOrders(seccionMembershipId)).toEqual(before)
  })

  test("B. adding a product via the membership PUT preserves existing relative order and appends the new one at the end — even if the body lists them in a different order", async () => {
    const response = await updateSeccion(
      // Body order is A,B,C,D (creation order) — NOT the actual section order (C,A,B) — proving the array's ORDER is never trusted, only its SET.
      request(`/api/negocio/secciones/${seccionMembershipId}`, "PUT", authCookie(tokenA), { productoIds: [m1, m2, m3, m4] }),
      params(seccionMembershipId)
    )
    expect(response.status).toBe(200)
    expect(await readSectionOrders(seccionMembershipId)).toEqual([
      { productoId: m3, orden: 0 },
      { productoId: m1, orden: 1 },
      { productoId: m2, orden: 2 },
      { productoId: m4, orden: 3 },
    ])
  })

  test("C. removing a product via the membership PUT preserves the relative order of the remaining ones", async () => {
    // Remove m1 — remaining were C(0), A(1)=m1 removed, B(2), D(3).
    const response = await updateSeccion(
      request(`/api/negocio/secciones/${seccionMembershipId}`, "PUT", authCookie(tokenA), { productoIds: [m4, m2, m3] }),
      params(seccionMembershipId)
    )
    expect(response.status).toBe(200)
    expect(await readSectionOrders(seccionMembershipId)).toEqual([
      { productoId: m3, orden: 0 },
      { productoId: m2, orden: 1 },
      { productoId: m4, orden: 2 },
    ])
  })

  test("D. simultaneous add + remove is atomic and correct in one PUT", async () => {
    // Current: C(0), B(1)=m2, D(2)=m4. Remove m2, add m5.
    const response = await updateSeccion(
      request(`/api/negocio/secciones/${seccionMembershipId}`, "PUT", authCookie(tokenA), { productoIds: [m4, m5, m3] }),
      params(seccionMembershipId)
    )
    expect(response.status).toBe(200)
    expect(await readSectionOrders(seccionMembershipId)).toEqual([
      { productoId: m3, orden: 0 },
      { productoId: m4, orden: 1 },
      { productoId: m5, orden: 2 },
    ])
  })

  test("E. an invalid membership PUT (unknown product ID) leaves the section's order completely unchanged", async () => {
    const before = await readSectionOrders(seccionMembershipId)
    const response = await updateSeccion(
      request(`/api/negocio/secciones/${seccionMembershipId}`, "PUT", authCookie(tokenA), { productoIds: [m3, m4, "not-a-real-product-id"] }),
      params(seccionMembershipId)
    )
    expect(response.status).toBe(403)
    expect(await readSectionOrders(seccionMembershipId)).toEqual(before)
  })
})
