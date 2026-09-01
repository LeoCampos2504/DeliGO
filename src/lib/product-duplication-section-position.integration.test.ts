/// <reference types="bun-types" />

// ============================================
// PRODUCT-DUPLICATION-SECTION-POSITION-R1 — real integration test
// ============================================
// Nunca mockea Prisma. Prefijo `test-product-dup-section-position-r1-`,
// cleanup obligatorio en beforeAll/afterAll.

import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createSession, SESSION_COOKIE_NAME } from "@/lib/auth"
import { POST as duplicateProduct } from "@/app/api/negocio/productos/[id]/duplicar/route"
import { PATCH as reorderSectionProducts } from "@/app/api/negocio/secciones/[id]/productos/orden/route"
import { GET as getPublicBusiness } from "@/app/api/negocios/[slug]/route"

const prefix = `test-product-dup-section-position-r1-${randomUUID()}-`
setDefaultTimeout(60_000)

let negocioId = ""
let negocioSlug = ""
let token = ""

async function cleanup() {
  const negocios = await db.negocio.findMany({ where: { slug: { startsWith: prefix } }, select: { id: true } })
  const negocioIds = negocios.map((n) => n.id)
  if (negocioIds.length) {
    await db.sesion.deleteMany({ where: { userId: { in: negocioIds } } })
    await db.negocio.deleteMany({ where: { id: { in: negocioIds } } })
  }
}

function request(path: string, method: string, body?: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${token}`,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

async function createSeccion(label: string, orden = 0) {
  return db.seccionCatalogo.create({
    data: { negocioId, nombre: `${prefix}${label}`, orden },
  })
}

async function createProducto(label: string, orden = 0) {
  return db.producto.create({
    data: { negocioId, nombre: `${prefix}${label}`, precio: 100, orden },
  })
}

async function link(seccionId: string, productoId: string, orden: number) {
  return db.seccionProducto.create({ data: { seccionId, productoId, orden } })
}

async function sectionOrdenRows(seccionId: string) {
  return db.seccionProducto.findMany({
    where: { seccionId },
    select: { productoId: true, orden: true },
    orderBy: { orden: "asc" },
  })
}

beforeAll(async () => {
  expect(process.env.DATABASE_URL).toBe(process.env.DELIGO_TEST_DATABASE_URL)
  await cleanup()
  const negocio = await db.negocio.create({
    data: {
      nombre: `${prefix}negocio`,
      slug: `${prefix}negocio`,
      usuario: `${prefix}negocio`,
      email: `${prefix}negocio@example.test`,
      password: "fixture",
      aprobado: true,
      suspendido: false,
    },
  })
  negocioId = negocio.id
  negocioSlug = negocio.slug
  token = await createSession(negocioId, "negocio")
})

afterAll(async () => {
  await cleanup()
  expect(await db.negocio.count({ where: { slug: { startsWith: prefix } } })).toBe(0)
})

describe("PRODUCT-DUPLICATION-SECTION-POSITION-R1 — per-section append", () => {
  test("source in one section: duplicate lands at max+1, source untouched", async () => {
    const seccion = await createSeccion("uno")
    const a = await createProducto("a", 0)
    const source = await createProducto("source1", 1)
    await link(seccion.id, a.id, 0)
    await link(seccion.id, source.id, 1)

    const res = await duplicateProduct(request(`/api/negocio/productos/${source.id}/duplicar`, "POST"), params(source.id))
    expect(res.status).toBe(201)
    const dup = await res.json()

    const rows = await sectionOrdenRows(seccion.id)
    expect(rows).toEqual([
      { productoId: a.id, orden: 0 },
      { productoId: source.id, orden: 1 },
      { productoId: dup.id, orden: 2 },
    ])
  })

  test("source not at the end of its section: duplicate still lands at the true end, not next to the source", async () => {
    const seccion = await createSeccion("notatend")
    const source = await createProducto("source2", 0)
    const after1 = await createProducto("after1", 0)
    const after2 = await createProducto("after2", 0)
    await link(seccion.id, source.id, 0)
    await link(seccion.id, after1.id, 1)
    await link(seccion.id, after2.id, 5)

    const res = await duplicateProduct(request(`/api/negocio/productos/${source.id}/duplicar`, "POST"), params(source.id))
    expect(res.status).toBe(201)
    const dup = await res.json()

    const rows = await sectionOrdenRows(seccion.id)
    expect(rows.at(-1)).toEqual({ productoId: dup.id, orden: 6 })
    // Nothing else moved.
    expect(rows.find((r) => r.productoId === source.id)).toEqual({ productoId: source.id, orden: 0 })
    expect(rows.find((r) => r.productoId === after1.id)).toEqual({ productoId: after1.id, orden: 1 })
    expect(rows.find((r) => r.productoId === after2.id)).toEqual({ productoId: after2.id, orden: 5 })
  })

  test("multi-section: each section computes its own independent max+1", async () => {
    const seccionA = await createSeccion("multiA")
    const seccionB = await createSeccion("multiB")
    const seccionC = await createSeccion("multiC")
    const source = await createProducto("multisource", 0)
    const fillerA = await createProducto("fillerA", 0)
    const fillerB = await createProducto("fillerB", 0)
    await link(seccionA.id, fillerA.id, 2)
    await link(seccionA.id, source.id, 0)
    await link(seccionB.id, fillerB.id, 8)
    await link(seccionB.id, source.id, 1)
    await link(seccionC.id, source.id, 0) // seccionC's only member is the source itself

    const res = await duplicateProduct(request(`/api/negocio/productos/${source.id}/duplicar`, "POST"), params(source.id))
    expect(res.status).toBe(201)
    const dup = await res.json()

    expect((await sectionOrdenRows(seccionA.id)).find((r) => r.productoId === dup.id)).toEqual({ productoId: dup.id, orden: 3 })
    expect((await sectionOrdenRows(seccionB.id)).find((r) => r.productoId === dup.id)).toEqual({ productoId: dup.id, orden: 9 })
    expect((await sectionOrdenRows(seccionC.id)).find((r) => r.productoId === dup.id)).toEqual({ productoId: dup.id, orden: 1 })
  })

  test("legacy gaps [0,2,9] -> duplicate lands at 10, gaps untouched", async () => {
    const seccion = await createSeccion("gaps")
    const source = await createProducto("gapsource", 0)
    const p2 = await createProducto("gapp2", 0)
    const p9 = await createProducto("gapp9", 0)
    await link(seccion.id, source.id, 0)
    await link(seccion.id, p2.id, 2)
    await link(seccion.id, p9.id, 9)

    const res = await duplicateProduct(request(`/api/negocio/productos/${source.id}/duplicar`, "POST"), params(source.id))
    expect(res.status).toBe(201)
    const dup = await res.json()

    const rows = await sectionOrdenRows(seccion.id)
    expect(rows).toEqual([
      { productoId: source.id, orden: 0 },
      { productoId: p2.id, orden: 2 },
      { productoId: p9.id, orden: 9 },
      { productoId: dup.id, orden: 10 },
    ])
  })

  test("legacy ties [0,0,5] -> duplicate lands at 6, no renormalization of the existing ties", async () => {
    const seccion = await createSeccion("ties")
    const source = await createProducto("tiesource", 0)
    const tied = await createProducto("tied", 0)
    const p5 = await createProducto("tiesp5", 0)
    await link(seccion.id, source.id, 0)
    await link(seccion.id, tied.id, 0)
    await link(seccion.id, p5.id, 5)

    const res = await duplicateProduct(request(`/api/negocio/productos/${source.id}/duplicar`, "POST"), params(source.id))
    expect(res.status).toBe(201)
    const dup = await res.json()

    const rows = await sectionOrdenRows(seccion.id)
    const withoutDup = rows.filter((r) => r.productoId !== dup.id)
    expect(withoutDup).toEqual([
      { productoId: source.id, orden: 0 },
      { productoId: tied.id, orden: 0 },
      { productoId: p5.id, orden: 5 },
    ])
    expect(rows.find((r) => r.productoId === dup.id)).toEqual({ productoId: dup.id, orden: 6 })
  })

  test("global Producto.orden still appends at the active-business max, unaffected by section fixes", async () => {
    const maxBefore = await db.producto.aggregate({ where: { negocioId, eliminado: false }, _max: { orden: true } })
    const source = await createProducto("globalorder", (maxBefore._max.orden ?? -1) + 1)

    const res = await duplicateProduct(request(`/api/negocio/productos/${source.id}/duplicar`, "POST"), params(source.id))
    expect(res.status).toBe(201)
    const dup = await res.json()
    const maxAfterSource = await db.producto.aggregate({
      where: { negocioId, eliminado: false, id: { not: dup.id } },
      _max: { orden: true },
    })
    expect(dup.orden).toBe((maxAfterSource._max.orden ?? -1) + 1)
  })

  test("SeccionCatalogo.orden and every other SeccionProducto row are untouched by a duplication", async () => {
    const seccion = await createSeccion("untouched", 42)
    const source = await createProducto("untouchedsource", 0)
    const other = await createProducto("untouchedother", 0)
    await link(seccion.id, source.id, 0)
    await link(seccion.id, other.id, 3)

    await duplicateProduct(request(`/api/negocio/productos/${source.id}/duplicar`, "POST"), params(source.id))

    const seccionAfter = await db.seccionCatalogo.findUniqueOrThrow({ where: { id: seccion.id }, select: { orden: true } })
    expect(seccionAfter.orden).toBe(42)
    const otherLink = await db.seccionProducto.findFirstOrThrow({ where: { seccionId: seccion.id, productoId: other.id } })
    expect(otherLink.orden).toBe(3)
  })

  test("duplicate belongs to exactly the same sections as the source — no section gained or lost", async () => {
    const seccionA = await createSeccion("membershipA")
    const seccionB = await createSeccion("membershipB")
    const source = await createProducto("membershipsource", 0)
    await link(seccionA.id, source.id, 0)
    await link(seccionB.id, source.id, 0)

    const res = await duplicateProduct(request(`/api/negocio/productos/${source.id}/duplicar`, "POST"), params(source.id))
    const dup = await res.json()

    const dupSections = await db.seccionProducto.findMany({ where: { productoId: dup.id }, select: { seccionId: true } })
    expect(new Set(dupSections.map((s) => s.seccionId))).toEqual(new Set([seccionA.id, seccionB.id]))
  })

  test("source with no section membership: duplication succeeds, no SeccionProducto rows created", async () => {
    const source = await createProducto("nosection", 0)
    const res = await duplicateProduct(request(`/api/negocio/productos/${source.id}/duplicar`, "POST"), params(source.id))
    expect(res.status).toBe(201)
    const dup = await res.json()
    expect(await db.seccionProducto.count({ where: { productoId: dup.id } })).toBe(0)
  })

  test("public catalog shows the duplicate at the end of the section, in SeccionProducto.orden order", async () => {
    const seccion = await createSeccion("public")
    const a = await createProducto("publica", 0)
    const source = await createProducto("publicsource", 1)
    await link(seccion.id, a.id, 0)
    await link(seccion.id, source.id, 1)

    const res = await duplicateProduct(request(`/api/negocio/productos/${source.id}/duplicar`, "POST"), params(source.id))
    const dup = await res.json()

    const publicRes = await getPublicBusiness(
      new NextRequest(`http://localhost/api/negocios/${negocioSlug}`),
      { params: Promise.resolve({ slug: negocioSlug }) }
    )
    expect(publicRes.status).toBe(200)
    const body = (await publicRes.json()) as { secciones: Array<{ id: string; productos: Array<{ id: string }> }> }
    const publicSection = body.secciones.find((s) => s.id === seccion.id)!
    expect(publicSection.productos.map((p) => p.id)).toEqual([a.id, source.id, dup.id])
  })

  test("section product reorder works normally on the duplicate after it lands at the end", async () => {
    const seccion = await createSeccion("reorderafter")
    const a = await createProducto("reordera", 0)
    const source = await createProducto("reordersource", 1)
    await link(seccion.id, a.id, 0)
    await link(seccion.id, source.id, 1)

    const res = await duplicateProduct(request(`/api/negocio/productos/${source.id}/duplicar`, "POST"), params(source.id))
    const dup = await res.json()
    expect((await sectionOrdenRows(seccion.id)).map((r) => r.productoId)).toEqual([a.id, source.id, dup.id])

    const reorderRes = await reorderSectionProducts(
      request(`/api/negocio/secciones/${seccion.id}/productos/orden`, "PATCH", {
        productIds: [dup.id, a.id, source.id],
      }),
      params(seccion.id)
    )
    expect(reorderRes.status).toBe(200)
    expect((await sectionOrdenRows(seccion.id)).map((r) => r.productoId)).toEqual([dup.id, a.id, source.id])
  })

  test("two concurrent duplications of products sharing a section never end up with the same order", async () => {
    const seccion = await createSeccion("concurrent")
    const sourceA = await createProducto("concurrentA", 0)
    const sourceB = await createProducto("concurrentB", 1)
    await link(seccion.id, sourceA.id, 0)
    await link(seccion.id, sourceB.id, 1)

    const [resA, resB] = await Promise.all([
      duplicateProduct(request(`/api/negocio/productos/${sourceA.id}/duplicar`, "POST"), params(sourceA.id)),
      duplicateProduct(request(`/api/negocio/productos/${sourceB.id}/duplicar`, "POST"), params(sourceB.id)),
    ])
    expect([201, 409]).toContain(resA.status)
    expect([201, 409]).toContain(resB.status)

    const rows = await sectionOrdenRows(seccion.id)
    const ordenes = rows.map((r) => r.orden)
    expect(new Set(ordenes).size).toBe(ordenes.length)
  })
})
