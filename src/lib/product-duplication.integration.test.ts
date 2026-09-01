/// <reference types="bun-types" />

import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createSession, SESSION_COOKIE_NAME } from "@/lib/auth"
import { POST as duplicateProduct } from "@/app/api/negocio/productos/[id]/duplicar/route"

const prefix = `test-product-duplication-r1-${randomUUID()}-`
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
  if (negocioIds.length) await db.negocio.deleteMany({ where: { id: { in: negocioIds } } })
  if (clienteIds.length) await db.cliente.deleteMany({ where: { id: { in: clienteIds } } })
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

function request(path: string, cookie?: string, body?: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
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

async function createSharedOption(negocioId: string, label: string) {
  return db.opcionesCompartidas.create({
    data: {
      negocioId,
      nombre: `${prefix}${label}`,
      opciones: JSON.stringify([{ nombre: "Opción", precio: 250 }]),
      obligatorio: false,
      maximo: 0,
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
      data: { nombre: `${prefix}cliente`, email: `${prefix}cliente@example.test`, telefono: "" },
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

describe("PRODUCT-DUPLICATION-R1 — authenticated server-side clone", () => {
  test("rejects no session, wrong actor and missing/cross-business sources", async () => {
    const foreign = await db.producto.create({
      data: { negocioId: negocioBId, nombre: `${prefix}foreign`, precio: 100 },
    })

    expect((await duplicateProduct(request(`/api/negocio/productos/${foreign.id}/duplicar`), params(foreign.id))).status).toBe(401)
    expect((await duplicateProduct(request(`/api/negocio/productos/${foreign.id}/duplicar`, `${SESSION_COOKIE_NAME}=${clienteToken}`), params(foreign.id))).status).toBe(403)
    expect((await duplicateProduct(request(`/api/negocio/productos/${foreign.id}/duplicar`, `${SESSION_COOKIE_NAME}=${tokenA}`), params(foreign.id))).status).toBe(404)
    expect((await duplicateProduct(request(`/api/negocio/productos/missing/duplicar`, `${SESSION_COOKIE_NAME}=${tokenA}`), params("missing"))).status).toBe(404)
  })

  test("duplicates the complete catalog configuration with a new identity", async () => {
    const [shared, agregado, ingrediente, seccion] = await Promise.all([
      createSharedOption(negocioAId, "shared"),
      db.agregado.create({ data: { negocioId: negocioAId, nombre: `${prefix}agregado`, precio: 300, categoria: "extra" } }),
      db.ingrediente.create({ data: { negocioId: negocioAId, nombre: `${prefix}ingrediente`, categoria: "base" } }),
      db.seccionCatalogo.create({ data: { negocioId: negocioAId, nombre: `${prefix}seccion`, orden: 7 } }),
    ])
    const recommended = await db.producto.create({
      data: { negocioId: negocioAId, nombre: `${prefix}recommended`, precio: 50 },
    })
    const source = await db.producto.create({
      data: {
        negocioId: negocioAId,
        nombre: `${prefix}source`,
        precio: 123.45,
        categoria: "Especial",
        imagenUrl: null,
        imagenesExtra: JSON.stringify([]),
        stock: false,
        descuentoActivo: true,
        tipoDescuento: "porcentaje",
        valorDescuento: 20,
        descripcion: "Descripción completa",
        talles: JSON.stringify(["S", "M"]),
        colores: JSON.stringify(["Rojo"]),
        material: "Algodón",
        genero: "unisex",
        secciones: JSON.stringify([{ nombre: "Tamaño", opciones: ["Normal", { nombre: "Grande", precio: 250 }], obligatorio: true, maximo: 1 }]),
        recomendados: JSON.stringify([recommended.id]),
        opcionesCompartidasIds: JSON.stringify([{ id: shared.id, obligatorio: true, maximo: 2 }]),
        orden: 4,
      },
    })
    await Promise.all([
      db.productoAgregado.create({ data: { productoId: source.id, agregadoId: agregado.id } }),
      db.productoIngrediente.create({ data: { productoId: source.id, ingredienteId: ingrediente.id } }),
      db.seccionProducto.create({ data: { productoId: source.id, seccionId: seccion.id, orden: 3 } }),
    ])

    const before = await db.producto.findUniqueOrThrow({
      where: { id: source.id },
      include: { agregados: true, ingredientes: true, seccionItems: true },
    })
    const response = await duplicateProduct(
      request(`/api/negocio/productos/${source.id}/duplicar`, `${SESSION_COOKIE_NAME}=${tokenA}`, {
        negocioId: negocioBId,
        nombre: "spoofed client source",
        precio: 1,
      }),
      params(source.id)
    )
    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.id).not.toBe(source.id)
    expect(body.nombre).toBe(`${source.nombre} (copia)`)
    expect(body.negocioId).toBe(negocioAId)
    expect(body.precio).toBe(source.precio)
    expect(body.descripcion).toBe(source.descripcion)
    expect(body.stock).toBe(false)
    expect(body.descuentoActivo).toBe(true)
    expect(body.valorDescuento).toBe(20)
    expect(body.opcionesCompartidasIds).toEqual([{ id: shared.id, obligatorio: true, maximo: 2 }])
    expect(body.secciones).toEqual([{ nombre: "Tamaño", opciones: [{ nombre: "Normal", precio: 0 }, { nombre: "Grande", precio: 250 }], obligatorio: true, maximo: 1 }])

    const duplicate = await db.producto.findUniqueOrThrow({
      where: { id: body.id },
      include: { agregados: true, ingredientes: true, seccionItems: true, promociones: true },
    })
    expect(duplicate.agregados.map((item) => item.agregadoId)).toEqual([agregado.id])
    expect(duplicate.ingredientes.map((item) => item.ingredienteId)).toEqual([ingrediente.id])
    // PRODUCT-DUPLICATION-SECTION-POSITION-R1: the source's own SeccionProducto.orden
    // (3) is never copied — the copy is appended after the section's current
    // max (which IS 3, the source's own row, since it's the section's only
    // member here), landing at 4, never tied with the source.
    expect(duplicate.seccionItems).toEqual([{ id: duplicate.seccionItems[0].id, seccionId: seccion.id, productoId: duplicate.id, orden: 4 }])
    expect(duplicate.promociones).toHaveLength(1)
    expect(duplicate.promociones[0].precioPromo).toBeCloseTo(98.76)
    expect(duplicate.orden).toBeGreaterThan(source.orden)

    const after = await db.producto.findUniqueOrThrow({
      where: { id: source.id },
      include: { agregados: true, ingredientes: true, seccionItems: true },
    })
    expect(after).toEqual(before)
  })

  test("normalizes a legitimate legacy Shared Option reference without losing it", async () => {
    const shared = await createSharedOption(negocioAId, "legacy-shared")
    const source = await db.producto.create({
      data: {
        negocioId: negocioAId,
        nombre: `${prefix}legacy-source`,
        precio: 75,
        opcionesCompartidasIds: JSON.stringify([shared.id]),
      },
    })
    const response = await duplicateProduct(
      request(`/api/negocio/productos/${source.id}/duplicar`, `${SESSION_COOKIE_NAME}=${tokenA}`),
      params(source.id)
    )
    expect(response.status).toBe(201)
    const duplicate = await db.producto.findUniqueOrThrow({ where: { id: (await response.json()).id } })
    expect(JSON.parse(duplicate.opcionesCompartidasIds)).toEqual([{ id: shared.id, obligatorio: false, maximo: 0 }])
  })

  test("rejects foreign/stale references and malformed JSON before any copy is created", async () => {
    const foreignShared = await createSharedOption(negocioBId, "foreign-shared")
    const invalidReference = await db.producto.create({
      data: {
        negocioId: negocioAId,
        nombre: `${prefix}invalid-reference`,
        precio: 80,
        opcionesCompartidasIds: JSON.stringify([foreignShared.id]),
      },
    })
    const beforeInvalid = await db.producto.count({ where: { negocioId: negocioAId, nombre: { startsWith: `${prefix}invalid-reference (copia` } } })
    const foreignResponse = await duplicateProduct(
      request(`/api/negocio/productos/${invalidReference.id}/duplicar`, `${SESSION_COOKIE_NAME}=${tokenA}`),
      params(invalidReference.id)
    )
    expect(foreignResponse.status).toBe(403)
    expect(await db.producto.count({ where: { negocioId: negocioAId, nombre: { startsWith: `${prefix}invalid-reference (copia` } } })).toBe(beforeInvalid)

    const malformed = await db.producto.create({
      data: { negocioId: negocioAId, nombre: `${prefix}malformed`, precio: 80, secciones: "not-json" },
    })
    const beforeMalformed = await db.producto.count({ where: { negocioId: negocioAId, nombre: { startsWith: `${prefix}malformed (copia` } } })
    const malformedResponse = await duplicateProduct(
      request(`/api/negocio/productos/${malformed.id}/duplicar`, `${SESSION_COOKIE_NAME}=${tokenA}`),
      params(malformed.id)
    )
    expect(malformedResponse.status).toBe(400)
    expect(await db.producto.count({ where: { negocioId: negocioAId, nombre: { startsWith: `${prefix}malformed (copia` } } })).toBe(beforeMalformed)
  })
})
