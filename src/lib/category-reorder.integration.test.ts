/// <reference types="bun-types" />

// ============================================
// CATALOG-CATEGORY-PILL-REORDER-R1 — real integration test
// ============================================
// Nunca mockea Prisma. Prefijo `test-category-pill-reorder-r1-`, cleanup
// obligatorio en beforeAll/afterAll.

import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createSession, SESSION_COOKIE_NAME } from "@/lib/auth"
import { GET as getCategorias, PUT as putCategorias, PATCH as patchRenameCategoria } from "@/app/api/negocio/categorias/route"
import { PATCH as reorderCategorias } from "@/app/api/negocio/categorias/orden/route"
import { GET as getPublicBusiness } from "@/app/api/negocios/[slug]/route"

const prefix = `test-category-pill-reorder-r1-${randomUUID()}-`
setDefaultTimeout(60_000)

let negocioAId = ""
let negocioBId = ""
let clienteId = ""
let negocioASlug = ""
let tokenA = ""
let tokenB = ""
let clienteToken = ""
let productoId = ""
let seccionId = ""

async function cleanup() {
  const negocios = await db.negocio.findMany({ where: { slug: { startsWith: prefix } }, select: { id: true } })
  const negocioIds = negocios.map((n) => n.id)
  const clientes = await db.cliente.findMany({ where: { email: { startsWith: prefix } }, select: { id: true } })
  const clienteIds = clientes.map((c) => c.id)
  if (negocioIds.length || clienteIds.length) {
    await db.sesion.deleteMany({ where: { userId: { in: [...negocioIds, ...clienteIds] } } })
  }
  if (negocioIds.length) await db.negocio.deleteMany({ where: { id: { in: negocioIds } } })
  if (clienteIds.length) await db.cliente.deleteMany({ where: { id: { in: clienteIds } } })
}

async function createBusiness(label: string, categorias: string[]) {
  return db.negocio.create({
    data: {
      nombre: `${prefix}${label}`,
      slug: `${prefix}${label}`,
      usuario: `${prefix}${label}`,
      email: `${prefix}${label}@example.test`,
      password: "fixture",
      aprobado: true,
      suspendido: false,
      categorias: JSON.stringify(categorias),
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

async function readCategorias(negocioId: string): Promise<string[]> {
  const negocio = await db.negocio.findUniqueOrThrow({ where: { id: negocioId }, select: { categorias: true } })
  return JSON.parse(negocio.categorias)
}

beforeAll(async () => {
  expect(process.env.DATABASE_URL).toBe(process.env.DELIGO_TEST_DATABASE_URL)
  await cleanup()
  const [negocioA, negocioB, cliente] = await Promise.all([
    createBusiness("a", ["A", "B", "C"]),
    createBusiness("b", ["X", "Y"]),
    db.cliente.create({ data: { nombre: `${prefix}cliente`, email: `${prefix}cliente@example.test`, telefono: "" } }),
  ])
  negocioAId = negocioA.id
  negocioBId = negocioB.id
  negocioASlug = negocioA.slug
  clienteId = cliente.id
  tokenA = await createSession(negocioAId, "negocio")
  tokenB = await createSession(negocioBId, "negocio")
  clienteToken = await createSession(clienteId, "cliente")
  void tokenB

  const producto = await db.producto.create({
    data: { negocioId: negocioAId, nombre: `${prefix}prod`, precio: 100, categoria: "B", orden: 7 },
  })
  productoId = producto.id

  const seccion = await db.seccionCatalogo.create({
    data: { negocioId: negocioAId, nombre: `${prefix}seccion`, orden: 3 },
  })
  seccionId = seccion.id
  await db.seccionProducto.create({ data: { seccionId, productoId, orden: 2 } })
})

afterAll(async () => {
  await cleanup()
  expect(await db.negocio.count({ where: { slug: { startsWith: prefix } } })).toBe(0)
  expect(await db.cliente.count({ where: { email: { startsWith: prefix } } })).toBe(0)
})

describe("CATALOG-CATEGORY-PILL-REORDER-R1 — Negocio.categorias order", () => {
  test("reorders A,B,C -> C,A,B, GET reflects it, and Producto/Seccion order stay untouched", async () => {
    const res = await reorderCategorias(
      request("/api/negocio/categorias/orden", "PATCH", authCookie(tokenA), { categorias: ["C", "A", "B"] })
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ categorias: ["C", "A", "B"] })
    expect(await readCategorias(negocioAId)).toEqual(["C", "A", "B"])

    const getRes = await getCategorias(request("/api/negocio/categorias", "GET", authCookie(tokenA)))
    expect(await getRes.json()).toEqual({ categorias: ["C", "A", "B"] })

    const producto = await db.producto.findUniqueOrThrow({ where: { id: productoId }, select: { categoria: true, orden: true } })
    expect(producto.categoria).toBe("B")
    expect(producto.orden).toBe(7)

    const seccion = await db.seccionCatalogo.findUniqueOrThrow({ where: { id: seccionId }, select: { orden: true } })
    expect(seccion.orden).toBe(3)

    const sp = await db.seccionProducto.findFirstOrThrow({ where: { seccionId, productoId }, select: { orden: true } })
    expect(sp.orden).toBe(2)
  })

  test("public catalog reflects the new persisted order, no server-side sort", async () => {
    const res = await getPublicBusiness(request(`/api/negocios/${negocioASlug}`, "GET"), {
      params: Promise.resolve({ slug: negocioASlug }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { categorias: string[] }
    expect(body.categorias).toEqual(["C", "A", "B"])
  })

  test("rejects partial list, duplicate, unknown category, and non-array bodies without writes", async () => {
    const before = await readCategorias(negocioAId)
    const invalid = [["C", "A"], ["C", "A", "A"], ["C", "A", "B", "D"], ["C", "A", ""]]
    for (const categorias of invalid) {
      const res = await reorderCategorias(
        request("/api/negocio/categorias/orden", "PATCH", authCookie(tokenA), { categorias })
      )
      expect(res.status).toBe(400)
      expect(await readCategorias(negocioAId)).toEqual(before)
    }
    const notArray = await reorderCategorias(
      request("/api/negocio/categorias/orden", "PATCH", authCookie(tokenA), { categorias: "C,A,B" })
    )
    expect(notArray.status).toBe(400)
    expect(await readCategorias(negocioAId)).toEqual(before)
  })

  test("enforces auth and ignores negocioId spoofing — session alone decides which negocio is reordered", async () => {
    expect(
      (await reorderCategorias(request("/api/negocio/categorias/orden", "PATCH", undefined, { categorias: ["C", "A", "B"] }))).status
    ).toBe(401)
    expect(
      (await reorderCategorias(request("/api/negocio/categorias/orden", "PATCH", authCookie(clienteToken), { categorias: ["C", "A", "B"] })))
        .status
    ).toBe(403)

    const spoofed = await reorderCategorias(
      request("/api/negocio/categorias/orden", "PATCH", authCookie(tokenA), {
        negocioId: negocioBId,
        categorias: ["A", "B", "C"],
      })
    )
    expect(spoofed.status).toBe(200)
    expect(await readCategorias(negocioAId)).toEqual(["A", "B", "C"])
    expect(await readCategorias(negocioBId)).toEqual(["X", "Y"])
  })

  test("empty list is accepted only for a business with zero configured categories", async () => {
    const rejectedEmpty = await reorderCategorias(
      request("/api/negocio/categorias/orden", "PATCH", authCookie(tokenA), { categorias: [] })
    )
    expect(rejectedEmpty.status).toBe(400)

    const emptyBiz = await createBusiness("empty", [])
    const emptyToken = await createSession(emptyBiz.id, "negocio")
    const acceptedEmpty = await reorderCategorias(
      request("/api/negocio/categorias/orden", "PATCH", authCookie(emptyToken), { categorias: [] })
    )
    expect(acceptedEmpty.status).toBe(200)
    expect(await acceptedEmpty.json()).toEqual({ categorias: [] })
  })

  test("concurrent reorders leave either a complete winner or a conflict, never a corrupted/partial array", async () => {
    const current = await readCategorias(negocioAId)
    const [first, second] = await Promise.all([
      reorderCategorias(request("/api/negocio/categorias/orden", "PATCH", authCookie(tokenA), { categorias: [...current].reverse() })),
      reorderCategorias(request("/api/negocio/categorias/orden", "PATCH", authCookie(tokenA), { categorias: current })),
    ])
    expect([200, 409]).toContain(first.status)
    expect([200, 409]).toContain(second.status)
    const final = await readCategorias(negocioAId)
    expect(new Set(final)).toEqual(new Set(current))
    expect(final.length).toBe(current.length)
  })

  test("create (base PUT route) appends at the end without reordering the rest", async () => {
    const before = await readCategorias(negocioAId)
    const res = await putCategorias(
      request("/api/negocio/categorias", "PUT", authCookie(tokenA), { categorias: [...before, "D"] })
    )
    expect(res.status).toBe(200)
    expect(await readCategorias(negocioAId)).toEqual([...before, "D"])
  })

  test("delete (base PUT route) preserves the relative order of the remaining categories", async () => {
    const before = await readCategorias(negocioAId)
    const withoutSecond = before.filter((_, i) => i !== 1)
    const res = await putCategorias(
      request("/api/negocio/categorias", "PUT", authCookie(tokenA), { categorias: withoutSecond })
    )
    expect(res.status).toBe(200)
    expect(await readCategorias(negocioAId)).toEqual(withoutSecond)
  })

  test("rename (base PATCH route) preserves position — never moves the renamed category", async () => {
    const before = await readCategorias(negocioAId)
    const target = before[0]
    const renamed = "Renombrada"
    const res = await patchRenameCategoria(
      request("/api/negocio/categorias", "PATCH", authCookie(tokenA), { oldName: target, newName: renamed })
    )
    expect(res.status).toBe(200)
    const after = await readCategorias(negocioAId)
    expect(after[0]).toBe(renamed)
    expect(after.slice(1)).toEqual(before.slice(1))
  })
})
