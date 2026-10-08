/// <reference types="bun-types" />

// ============================================
// F9 — barcode uniqueness on the 4 REAL write routes (real TESTING DB)
// ============================================
// Same convention as src/app/api/negocio/productos/[id]/variantes/route.test.ts:
// isolated fixture businesses (random ids), real sessions, cleanup by exact
// ids in afterAll. Includes REAL concurrent writes: several requests claiming
// the same code at the same time must leave exactly one row with it.

import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createSession, deleteSession, SESSION_COOKIE_NAME } from "@/lib/auth"
import { barcodeLookupKey } from "@/lib/barcode"
import { POST as createProducto } from "./route"
import { PUT as updateProducto } from "./[id]/route"
import { POST as createVariante } from "./[id]/variantes/route"
import { PUT as updateVariante } from "./[id]/variantes/[varianteId]/route"

setDefaultTimeout(120_000)

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
  const token = await createSession(business.id, "negocio")
  createdSessions.push(token)
  return { business, cookie: `${SESSION_COOKIE_NAME}=${token}` }
}

/** A fresh, check-digit-valid EAN-13 per call (so reruns never collide). */
function freshEan13(): string {
  const body = `779${String(Date.now()).slice(-6)}${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`
  let sum = 0
  for (let i = body.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) sum += Number(body[i]) * w
  return body + String((10 - (sum % 10)) % 10)
}

/** A fresh valid UPC-A (12 digits). Its EAN-13 equivalent is "0" + it. */
function freshUpcA(): string {
  const body = `0${String(Date.now()).slice(-7)}${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`
  let sum = 0
  for (let i = body.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) sum += Number(body[i]) * w
  return body + String((10 - (sum % 10)) % 10)
}

function jsonRequest(method: string, cookie: string, body: unknown) {
  return new NextRequest("http://localhost/api/negocio/productos", {
    method,
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

const idParams = (id: string) => ({ params: Promise.resolve({ id }) })
const varParams = (id: string, varianteId: string) => ({ params: Promise.resolve({ id, varianteId }) })

async function postProducto(cookie: string, body: Record<string, unknown>) {
  const res = await createProducto(jsonRequest("POST", cookie, { precio: 1000, imagenUrl: null, ...body }))
  return { status: res.status, body: await res.json() }
}

async function countWithKey(negocioId: string, code: string) {
  const key = barcodeLookupKey(code)
  const productos = await db.producto.findMany({
    where: { negocioId, eliminado: false },
    select: { codigoBarras: true, variantes: { select: { codigoBarras: true } } },
  })
  let n = 0
  for (const p of productos) {
    if (barcodeLookupKey(p.codigoBarras) === key) n++
    for (const v of p.variantes) if (barcodeLookupKey(v.codigoBarras) === key) n++
  }
  return n
}

afterAll(async () => {
  for (const token of createdSessions) await deleteSession(token)
  await db.auditLog.deleteMany({ where: { userId: { in: createdBusinesses } } })
  await db.producto.deleteMany({ where: { negocioId: { in: createdBusinesses } } })
  await db.negocio.deleteMany({ where: { id: { in: createdBusinesses } } })
})

describe("F9 — duplicate protection on the 4 real routes", () => {
  test("POST producto: a new duplicate is rejected with 409 CODIGO_BARRAS_DUPLICADO naming the article", async () => {
    const { cookie } = await createBusiness("test-f9-dup-create")
    const code = freshEan13()
    const first = await postProducto(cookie, { nombre: "Sopa", codigoBarras: ` ${code} ` })
    expect({ status: first.status, error: first.body.error }).toEqual({ status: 201, error: undefined })
    expect(first.body.codigoBarras).toBe(code) // trimmed, still a string
    const second = await postProducto(cookie, { nombre: "Otra sopa", codigoBarras: code })
    expect(second.status).toBe(409)
    expect(second.body.code).toBe("CODIGO_BARRAS_DUPLICADO")
    expect(second.body.error).toContain('"Sopa"')
  })

  test("UPC-A and its EAN-13 form are the same code", async () => {
    const { cookie } = await createBusiness("test-f9-upc-ean")
    const upc = freshUpcA()
    expect((await postProducto(cookie, { nombre: "Arroz", codigoBarras: upc })).status).toBe(201)
    const dup = await postProducto(cookie, { nombre: "Arroz 2", codigoBarras: `0${upc}` })
    expect(dup.status).toBe(409)
    expect(dup.body.code).toBe("CODIGO_BARRAS_DUPLICADO")
  })

  test("POST producto with inline variants: repeated variant codes and product↔variant collisions are rejected", async () => {
    const { cookie } = await createBusiness("test-f9-inline")
    const code = freshEan13()
    const repeated = await postProducto(cookie, {
      nombre: "Gaseosa",
      variantes: [
        { nombre: "500 ml", precio: 900, codigoBarras: code },
        { nombre: "1 L", precio: 1500, codigoBarras: code },
      ],
    })
    expect(repeated.status).toBe(409)
    expect(repeated.body.code).toBe("CODIGO_BARRAS_DUPLICADO")

    const ok = await postProducto(cookie, { nombre: "Gaseosa", variantes: [{ nombre: "500 ml", precio: 900, codigoBarras: code }] })
    expect(ok.status).toBe(201)
    // a product whose base code equals an existing VARIANT code
    const productVsVariant = await postProducto(cookie, { nombre: "Otra", codigoBarras: code })
    expect(productVsVariant.status).toBe(409)
  })

  test("PUT producto: editing toward a used code → 409; keeping its own code → 200", async () => {
    const { cookie } = await createBusiness("test-f9-patch")
    const a = freshEan13()
    const b = freshEan13()
    const pa = await postProducto(cookie, { nombre: "A", codigoBarras: a })
    const pb = await postProducto(cookie, { nombre: "B", codigoBarras: b })
    const toUsed = await updateProducto(jsonRequest("PUT", cookie, { codigoBarras: a }), idParams(pb.body.id))
    expect(toUsed.status).toBe(409)
    expect((await toUsed.json()).code).toBe("CODIGO_BARRAS_DUPLICADO")
    const keepOwn = await updateProducto(jsonRequest("PUT", cookie, { codigoBarras: ` ${a} `, nombre: "A editado" }), idParams(pa.body.id))
    expect(keepOwn.status).toBe(200)
  })

  test("historical duplicates never block an edit that doesn't change the code", async () => {
    const { business, cookie } = await createBusiness("test-f9-historic")
    const code = freshEan13()
    // Seeded directly (pre-F9 data): two products sharing one code.
    const p1 = await db.producto.create({ data: { nombre: "Viejo 1", precio: 100, negocioId: business.id, codigoBarras: code } })
    await db.producto.create({ data: { nombre: "Viejo 2", precio: 100, negocioId: business.id, codigoBarras: code } })
    const rename = await updateProducto(jsonRequest("PUT", cookie, { nombre: "Viejo 1 renombrado", codigoBarras: code }), idParams(p1.id))
    expect(rename.status).toBe(200)
    const onlyPrice = await updateProducto(jsonRequest("PUT", cookie, { precio: 150 }), idParams(p1.id))
    expect(onlyPrice.status).toBe(200)
  })

  test("POST variante: collides with a product code and with another variant code", async () => {
    const { cookie } = await createBusiness("test-f9-var-create")
    const productCode = freshEan13()
    const variantCode = freshEan13()
    await postProducto(cookie, { nombre: "Fideos", codigoBarras: productCode })
    const host = await postProducto(cookie, { nombre: "Agua", variantes: [{ nombre: "500 ml", precio: 500, codigoBarras: variantCode }] })
    const vsProduct = await createVariante(jsonRequest("POST", cookie, { nombre: "2 L", precio: 900, codigoBarras: productCode }), idParams(host.body.id))
    expect(vsProduct.status).toBe(409)
    const vsVariant = await createVariante(jsonRequest("POST", cookie, { nombre: "2 L", precio: 900, codigoBarras: variantCode }), idParams(host.body.id))
    expect(vsVariant.status).toBe(409)
    const fine = await createVariante(jsonRequest("POST", cookie, { nombre: "2 L", precio: 900, codigoBarras: freshEan13() }), idParams(host.body.id))
    expect(fine.status).toBe(201)
  })

  test("PUT variante: inactive variants count; keeping its own code and toggling activo are fine", async () => {
    const { cookie } = await createBusiness("test-f9-var-put")
    const inactiveCode = freshEan13()
    const ownCode = freshEan13()
    const host = await postProducto(cookie, {
      nombre: "Jugo",
      variantes: [
        { nombre: "Naranja", precio: 500, codigoBarras: inactiveCode },
        { nombre: "Manzana", precio: 500, codigoBarras: ownCode },
      ],
    })
    const variantes = host.body.variantes as Array<{ id: string; nombre: string }>
    const naranja = variantes.find((v) => v.nombre === "Naranja")!
    const manzana = variantes.find((v) => v.nombre === "Manzana")!
    expect((await updateVariante(jsonRequest("PUT", cookie, { activo: false }), varParams(host.body.id, naranja.id))).status).toBe(200)
    const toInactiveCode = await updateVariante(jsonRequest("PUT", cookie, { codigoBarras: inactiveCode }), varParams(host.body.id, manzana.id))
    expect(toInactiveCode.status).toBe(409)
    const keepOwn = await updateVariante(jsonRequest("PUT", cookie, { codigoBarras: ownCode, precio: 600 }), varParams(host.body.id, manzana.id))
    expect(keepOwn.status).toBe(200)
    expect((await updateVariante(jsonRequest("PUT", cookie, { activo: true }), varParams(host.body.id, naranja.id))).status).toBe(200)
  })

  test("deleted products free their code; reactivating one whose code is now taken → 409", async () => {
    const { business, cookie } = await createBusiness("test-f9-deleted")
    const code = freshEan13()
    const deleted = await db.producto.create({ data: { nombre: "Discontinuado", precio: 100, negocioId: business.id, codigoBarras: code, eliminado: true } })
    expect((await postProducto(cookie, { nombre: "Nuevo", codigoBarras: code })).status).toBe(201)
    const reactivate = await updateProducto(jsonRequest("PUT", cookie, { eliminado: false }), idParams(deleted.id))
    expect(reactivate.status).toBe(409)
    expect((await db.producto.findUnique({ where: { id: deleted.id } }))?.eliminado).toBe(true)
  })

  test("different businesses may use the same code", async () => {
    const a = await createBusiness("test-f9-tenant-a")
    const b = await createBusiness("test-f9-tenant-b")
    const code = freshEan13()
    expect((await postProducto(a.cookie, { nombre: "Sopa A", codigoBarras: code })).status).toBe(201)
    expect((await postProducto(b.cookie, { nombre: "Sopa B", codigoBarras: code })).status).toBe(201)
  })

  test("malformed code (non-string) → 400, never stored as a number", async () => {
    const { cookie } = await createBusiness("test-f9-invalid")
    const res = await postProducto(cookie, { nombre: "X", codigoBarras: 7791234567898 })
    expect(res.status).toBe(400)
  })
})

describe("F9 — REAL concurrent writes with the same code", () => {
  test("8 simultaneous product creations with one code → exactly one row has it", async () => {
    const { business, cookie } = await createBusiness("test-f9-race-products")
    const code = freshEan13()
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) => postProducto(cookie, { nombre: `Carrera ${i}`, codigoBarras: code }))
    )
    const statuses = results.map((r) => r.status)
    console.log("[F9 race products] statuses:", JSON.stringify(statuses), "codes:", JSON.stringify(results.map((r) => r.body.code ?? null)))
    expect(statuses.filter((s) => s === 201)).toHaveLength(1)
    expect(statuses.filter((s) => s === 409)).toHaveLength(7)
    expect(await countWithKey(business.id, code)).toBe(1)
  })

  test("mixed race: product creates + variant creates + a product edit, UPC-A and EAN-13 forms → exactly one wins", async () => {
    const { business, cookie } = await createBusiness("test-f9-race-mixed")
    const upc = freshUpcA()
    const host = await postProducto(cookie, { nombre: "Host", variantes: [{ nombre: "Base", precio: 100 }] })
    const target = await postProducto(cookie, { nombre: "Target", codigoBarras: freshEan13() })
    const attempts = [
      () => postProducto(cookie, { nombre: "P1", codigoBarras: upc }),
      () => postProducto(cookie, { nombre: "P2", codigoBarras: `0${upc}` }),
      () => postProducto(cookie, { nombre: "P3", codigoBarras: upc }),
      async () => {
        const res = await createVariante(jsonRequest("POST", cookie, { nombre: "V1", precio: 100, codigoBarras: upc }), idParams(host.body.id))
        return { status: res.status, body: await res.json() }
      },
      async () => {
        const res = await createVariante(jsonRequest("POST", cookie, { nombre: "V2", precio: 100, codigoBarras: `0${upc}` }), idParams(host.body.id))
        return { status: res.status, body: await res.json() }
      },
      async () => {
        const res = await updateProducto(jsonRequest("PUT", cookie, { codigoBarras: upc }), idParams(target.body.id))
        return { status: res.status, body: await res.json() }
      },
    ]
    const results = await Promise.all(attempts.map((run) => run()))
    const statuses = results.map((r) => r.status)
    console.log("[F9 race mixed] statuses:", JSON.stringify(statuses), "codes:", JSON.stringify(results.map((r) => r.body.code ?? null)))
    expect(statuses.filter((s) => s === 200 || s === 201)).toHaveLength(1)
    expect(statuses.filter((s) => s === 409)).toHaveLength(5)
    expect(await countWithKey(business.id, upc)).toBe(1)
  })
})
