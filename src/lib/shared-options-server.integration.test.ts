/// <reference types="bun-types" />

import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createSession, SESSION_COOKIE_NAME } from "@/lib/auth"
import { GET as listSharedOptions, POST as createSharedOption } from "@/app/api/negocio/opciones-compartidas/route"
import { DELETE as deleteSharedOption, PUT as updateSharedOption } from "@/app/api/negocio/opciones-compartidas/[id]/route"
import { POST as createProduct } from "@/app/api/negocio/productos/route"
import { PUT as updateProduct } from "@/app/api/negocio/productos/[id]/route"

const prefix = `test-shared-options-r1-${randomUUID()}-`
setDefaultTimeout(30_000)

let negocioAId = ""
let negocioBId = ""
let clienteId = ""
let tokenA = ""
let tokenB = ""
let clienteToken = ""

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
  if (negocioIds.length) {
    await db.negocio.deleteMany({ where: { id: { in: negocioIds } } })
  }
  if (clienteIds.length) {
    await db.cliente.deleteMany({ where: { id: { in: clienteIds } } })
  }
}

async function createFixtureNegocio(label: string) {
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

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

async function sharedOption(negocioId: string, label: string) {
  return db.opcionesCompartidas.create({
    data: {
      negocioId,
      nombre: `${prefix}${label}`,
      opciones: JSON.stringify([{ nombre: "Opción válida", precio: 0 }]),
      obligatorio: false,
      maximo: 0,
    },
  })
}

async function product(negocioId: string, label: string, options: unknown = []) {
  return db.producto.create({
    data: {
      negocioId,
      nombre: `${prefix}${label}`,
      precio: 100,
      opcionesCompartidasIds: JSON.stringify(options),
    },
  })
}

beforeAll(async () => {
  expect(process.env.DATABASE_URL).toBe(process.env.DELIGO_TEST_DATABASE_URL)
  await cleanup()
  const [negocioA, negocioB, cliente] = await Promise.all([
    createFixtureNegocio("a"),
    createFixtureNegocio("b"),
    db.cliente.create({
      data: {
        nombre: `${prefix}cliente`,
        email: `${prefix}cliente@example.test`,
        telefono: "",
      },
    }),
  ])
  negocioAId = negocioA.id
  negocioBId = negocioB.id
  clienteId = cliente.id
  tokenA = await createSession(negocioAId, "negocio")
  tokenB = await createSession(negocioBId, "negocio")
  clienteToken = await createSession(clienteId, "cliente")
})

afterAll(async () => {
  await cleanup()
  expect(await db.negocio.count({ where: { slug: { startsWith: prefix } } })).toBe(0)
  expect(await db.cliente.count({ where: { email: { startsWith: prefix } } })).toBe(0)
})

describe("SHARED-OPTIONS-SERVER-HARDENING-R1 — auth, scope and CRUD", () => {
  test("rejects unauthenticated and wrong-actor list requests", async () => {
    expect((await listSharedOptions(request("/api/negocio/opciones-compartidas", "GET"))).status).toBe(401)
    expect((await listSharedOptions(request("/api/negocio/opciones-compartidas", "GET", `${SESSION_COOKIE_NAME}=${clienteToken}`))).status).toBe(403)
  })

  test("derives create ownership from session and ignores negocioId spoofing", async () => {
    const response = await createSharedOption(request("/api/negocio/opciones-compartidas", "POST", `${SESSION_COOKIE_NAME}=${tokenA}`, {
      negocioId: negocioBId,
      nombre: `${prefix}created-by-a`,
      opciones: [{ nombre: "Propia", precio: 2500 }],
      obligatorio: true,
      maximo: 2,
    }))
    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.data.negocioId).toBe(negocioAId)
    expect(body.data.opciones).toBe(JSON.stringify([{ nombre: "Propia", precio: 2500 }]))
  })

  test("lists only the authenticated negocio scope and allows same-owner update", async () => {
    const ownA = await sharedOption(negocioAId, "list-a")
    const ownB = await sharedOption(negocioBId, "list-b")
    const responseA = await listSharedOptions(request("/api/negocio/opciones-compartidas", "GET", `${SESSION_COOKIE_NAME}=${tokenA}`))
    const responseB = await listSharedOptions(request("/api/negocio/opciones-compartidas", "GET", `${SESSION_COOKIE_NAME}=${tokenB}`))
    const bodyA = await responseA.json()
    const bodyB = await responseB.json()
    expect(bodyA.data.map((item: { id: string }) => item.id)).toContain(ownA.id)
    expect(bodyA.data).toHaveLength(2)
    expect(bodyB.data.map((item: { id: string }) => item.id)).toEqual([ownB.id])

    const update = await updateSharedOption(request(`/api/negocio/opciones-compartidas/${ownB.id}`, "PUT", `${SESSION_COOKIE_NAME}=${tokenB}`, { nombre: `${prefix}updated-b` }), params(ownB.id))
    expect(update.status).toBe(200)
    expect((await db.opcionesCompartidas.findUniqueOrThrow({ where: { id: ownB.id } })).nombre).toBe(`${prefix}updated-b`)
  })

  test("rejects malformed shared-option payloads before persistence", async () => {
    const invalidOptions = await createSharedOption(request("/api/negocio/opciones-compartidas", "POST", `${SESSION_COOKIE_NAME}=${tokenA}`, {
      nombre: `${prefix}invalid-options`,
      opciones: [{ nombre: "bad", precio: -1 }],
    }))
    expect(invalidOptions.status).toBe(400)

    const valid = await sharedOption(negocioAId, "invalid-config-target")
    const invalidConfig = await updateSharedOption(request(`/api/negocio/opciones-compartidas/${valid.id}`, "PUT", `${SESSION_COOKIE_NAME}=${tokenA}`, {
      maximo: "2",
    }), params(valid.id))
    expect(invalidConfig.status).toBe(400)
  })

  test("foreign read-by-id mutation attempts fail closed without changing the resource", async () => {
    const foreign = await sharedOption(negocioBId, "foreign-crud")
    const before = await db.opcionesCompartidas.findUniqueOrThrow({ where: { id: foreign.id } })
    const update = await updateSharedOption(request(`/api/negocio/opciones-compartidas/${foreign.id}`, "PUT", `${SESSION_COOKIE_NAME}=${tokenA}`, { nombre: "intruso" }), params(foreign.id))
    const deletion = await deleteSharedOption(request(`/api/negocio/opciones-compartidas/${foreign.id}`, "DELETE", `${SESSION_COOKIE_NAME}=${tokenA}`), params(foreign.id))
    expect(update.status).toBe(404)
    expect(deletion.status).toBe(404)
    expect(await db.opcionesCompartidas.findUniqueOrThrow({ where: { id: foreign.id } })).toEqual(before)
  })
})

describe("SHARED-OPTIONS-SERVER-HARDENING-R1 — Product association boundaries", () => {
  test("accepts same-business association and stores the validated canonical config", async () => {
    const own = await sharedOption(negocioAId, "same-business")
    const response = await createProduct(request("/api/negocio/productos", "POST", `${SESSION_COOKIE_NAME}=${tokenA}`, {
      nombre: `${prefix}product-own`,
      precio: 1000,
      imagenUrl: null,
      opcionesCompartidasIds: [{ id: own.id, obligatorio: true, maximo: 1 }],
    }))
    expect(response.status).toBe(201)
    const stored = await db.producto.findFirstOrThrow({ where: { nombre: `${prefix}product-own` } })
    expect(JSON.parse(stored.opcionesCompartidasIds)).toEqual([{ id: own.id, obligatorio: true, maximo: 1 }])
  })

  test("rejects foreign, nonexistent and mixed-owner references before creating a Product", async () => {
    const own = await sharedOption(negocioAId, "mixed-own")
    const foreign = await sharedOption(negocioBId, "mixed-foreign")
    const before = await db.producto.count({ where: { negocioId: negocioAId, nombre: { startsWith: `${prefix}rejected` } } })
    const foreignResponse = await createProduct(request("/api/negocio/productos", "POST", `${SESSION_COOKIE_NAME}=${tokenA}`, { nombre: `${prefix}rejected-foreign`, precio: 100, imagenUrl: null, opcionesCompartidasIds: [foreign.id] }))
    const missingResponse = await createProduct(request("/api/negocio/productos", "POST", `${SESSION_COOKIE_NAME}=${tokenA}`, { nombre: `${prefix}rejected-missing`, precio: 100, imagenUrl: null, opcionesCompartidasIds: ["missing-shared-option"] }))
    const mixedResponse = await createProduct(request("/api/negocio/productos", "POST", `${SESSION_COOKIE_NAME}=${tokenA}`, { nombre: `${prefix}rejected-mixed`, precio: 100, imagenUrl: null, opcionesCompartidasIds: [own.id, foreign.id] }))
    expect(foreignResponse.status).toBe(403)
    expect(missingResponse.status).toBe(403)
    expect(mixedResponse.status).toBe(403)
    expect(await db.producto.count({ where: { negocioId: negocioAId, nombre: { startsWith: `${prefix}rejected` } } })).toBe(before)
  })

  test("rejects foreign and malformed references on Product update without partial mutation", async () => {
    const own = await sharedOption(negocioAId, "update-own")
    const foreign = await sharedOption(negocioBId, "update-foreign")
    const item = await product(negocioAId, "update-target", [{ id: own.id, obligatorio: false, maximo: 0 }])
    const foreignResponse = await updateProduct(request(`/api/negocio/productos/${item.id}`, "PUT", `${SESSION_COOKIE_NAME}=${tokenA}`, { opcionesCompartidasIds: [foreign.id] }), params(item.id))
    const malformedResponse = await updateProduct(request(`/api/negocio/productos/${item.id}`, "PUT", `${SESSION_COOKIE_NAME}=${tokenA}`, { opcionesCompartidasIds: [{ id: own.id, maximo: "bad" }] }), params(item.id))
    expect(foreignResponse.status).toBe(403)
    expect(malformedResponse.status).toBe(400)
    expect(JSON.parse((await db.producto.findUniqueOrThrow({ where: { id: item.id } })).opcionesCompartidasIds)).toEqual([{ id: own.id, obligatorio: false, maximo: 0 }])
  })
})

describe("SHARED-OPTIONS-SERVER-HARDENING-R1 — atomic delete semantics", () => {
  test("deletes an own option and removes both canonical and legacy product references", async () => {
    const own = await sharedOption(negocioAId, "delete-in-use")
    const canonicalProduct = await product(negocioAId, "canonical-reference", [{ id: own.id, obligatorio: true, maximo: 2 }])
    const legacyProduct = await product(negocioAId, "legacy-reference", [own.id])
    const response = await deleteSharedOption(request(`/api/negocio/opciones-compartidas/${own.id}`, "DELETE", `${SESSION_COOKIE_NAME}=${tokenA}`), params(own.id))
    expect(response.status).toBe(200)
    expect(await db.opcionesCompartidas.findUnique({ where: { id: own.id } })).toBeNull()
    expect(JSON.parse((await db.producto.findUniqueOrThrow({ where: { id: canonicalProduct.id } })).opcionesCompartidasIds)).toEqual([])
    expect(JSON.parse((await db.producto.findUniqueOrThrow({ where: { id: legacyProduct.id } })).opcionesCompartidasIds)).toEqual([])
  })

  test("fails closed and rolls back when an in-scope product has malformed references", async () => {
    const own = await sharedOption(negocioAId, "delete-malformed")
    await product(negocioAId, "malformed-reference", "not-json")
    const response = await deleteSharedOption(request(`/api/negocio/opciones-compartidas/${own.id}`, "DELETE", `${SESSION_COOKIE_NAME}=${tokenA}`), params(own.id))
    expect(response.status).toBe(500)
    expect(await db.opcionesCompartidas.findUnique({ where: { id: own.id } })).not.toBeNull()
  })
})
