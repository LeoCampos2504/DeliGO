/// <reference types="bun-types" />

import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createSession, SESSION_COOKIE_NAME } from "@/lib/auth"
import { POST as createProduct, GET as getProducts } from "@/app/api/negocio/productos/route"
import { PUT as updateProduct } from "@/app/api/negocio/productos/[id]/route"
import { POST as duplicateProduct } from "@/app/api/negocio/productos/[id]/duplicar/route"

const prefix = `test-product-gallery-hotfix-r1-${randomUUID()}-`
const mainUrl = "/uploads/productos/gallery-main.jpg"
const galleryA = "/uploads/productos/gallery-a.webp"
const galleryB = "/uploads/productos/gallery-b.webp"
const galleryC = "/uploads/productos/gallery-c.png"
setDefaultTimeout(60_000)

let negocioId = ""
let token = ""

async function cleanup() {
  const negocios = await db.negocio.findMany({
    where: { slug: { startsWith: prefix } },
    select: { id: true },
  })
  const negocioIds = negocios.map((negocio) => negocio.id)
  if (negocioIds.length) {
    await db.sesion.deleteMany({ where: { userId: { in: negocioIds } } })
    await db.negocio.deleteMany({ where: { id: { in: negocioIds } } })
  }
}

function request(method: string, path: string, body?: unknown) {
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

async function bodyOf(response: Response) {
  return response.json() as Promise<Record<string, unknown>>
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
  token = await createSession(negocioId, "negocio")
})

afterAll(async () => {
  await cleanup()
  expect(await db.negocio.count({ where: { slug: { startsWith: prefix } } })).toBe(0)
  expect(await db.producto.count({ where: { negocioId } })).toBe(0)
})

describe("PRODUCT-GALLERY-PERSISTENCE-HOTFIX-R1 — real Product API + TESTING Postgres", () => {
  test("PRODUCT_GALLERY_USER_REPORTED_REPRO: create, refetch and re-edit preserve three gallery images", async () => {
    const createResponse = await createProduct(request("POST", "/api/negocio/productos", {
      nombre: `${prefix}create`,
      precio: 100,
      imagenUrl: mainUrl,
      imagenesExtra: [galleryA, galleryB, galleryC],
    }))
    expect(createResponse.status).toBe(201)
    const created = await bodyOf(createResponse)
    expect(created.imagenUrl).toBe(mainUrl)
    expect(created.imagenesExtra).toEqual([galleryA, galleryB, galleryC])

    const stored = await db.producto.findUniqueOrThrow({ where: { id: String(created.id) } })
    expect(JSON.parse(stored.imagenesExtra)).toEqual([galleryA, galleryB, galleryC])

    const listResponse = await getProducts(request("GET", "/api/negocio/productos"))
    expect(listResponse.status).toBe(200)
    const listed = await listResponse.json() as Array<Record<string, unknown>>
    const listedProduct = listed.find((product) => product.id === created.id)
    expect(listedProduct?.imagenUrl).toBe(mainUrl)
    expect(listedProduct?.imagenesExtra).toEqual([galleryA, galleryB, galleryC])

    // This is the API value that previously reached ProductsTab and was passed
    // to JSON.parse despite already being an array.
    expect(Array.isArray(listedProduct?.imagenesExtra)).toBe(true)
    expect(listedProduct?.imagenesExtra).toEqual([galleryA, galleryB, galleryC])
  })

  test("PUT replaces/reorders/removes gallery while keeping the main image separate", async () => {
    const product = await db.producto.create({
      data: {
        negocioId,
        nombre: `${prefix}edit`,
        precio: 200,
        imagenUrl: mainUrl,
        imagenesExtra: JSON.stringify([galleryA, galleryB, galleryC]),
      },
    })

    const reordered = await updateProduct(
      request("PUT", `/api/negocio/productos/${product.id}`, {
        imagenesExtra: [galleryC, galleryA],
      }),
      params(product.id)
    )
    expect(reordered.status).toBe(200)
    const reorderedBody = await bodyOf(reordered)
    expect(reorderedBody.imagenUrl).toBe(mainUrl)
    expect(reorderedBody.imagenesExtra).toEqual([galleryC, galleryA])

    const storedAfterReorder = await db.producto.findUniqueOrThrow({ where: { id: product.id } })
    expect(JSON.parse(storedAfterReorder.imagenesExtra)).toEqual([galleryC, galleryA])

    const otherFieldOnly = await updateProduct(
      request("PUT", `/api/negocio/productos/${product.id}`, { descripcion: "updated without gallery" }),
      params(product.id)
    )
    expect(otherFieldOnly.status).toBe(200)
    const preservedBody = await bodyOf(otherFieldOnly)
    expect(preservedBody.imagenesExtra).toEqual([galleryC, galleryA])

    const invalid = await updateProduct(
      request("PUT", `/api/negocio/productos/${product.id}`, { imagenesExtra: "[]" }),
      params(product.id)
    )
    expect(invalid.status).toBe(400)
    const storedAfterInvalid = await db.producto.findUniqueOrThrow({ where: { id: product.id } })
    expect(JSON.parse(storedAfterInvalid.imagenesExtra)).toEqual([galleryC, galleryA])
  })

  test("duplicate preserves the persisted main image and gallery URLs", async () => {
    const source = await db.producto.create({
      data: {
        negocioId,
        nombre: `${prefix}duplicate-source`,
        precio: 300,
        imagenUrl: mainUrl,
        imagenesExtra: JSON.stringify([galleryA, galleryB, galleryC]),
      },
    })

    const response = await duplicateProduct(
      request("POST", `/api/negocio/productos/${source.id}/duplicar`),
      params(source.id)
    )
    expect(response.status).toBe(201)
    const duplicate = await bodyOf(response)
    expect(duplicate.imagenUrl).toBe(mainUrl)
    expect(duplicate.imagenesExtra).toEqual([galleryA, galleryB, galleryC])

    const duplicateStored = await db.producto.findUniqueOrThrow({ where: { id: String(duplicate.id) } })
    expect(JSON.parse(duplicateStored.imagenesExtra)).toEqual([galleryA, galleryB, galleryC])
    expect(duplicateStored.id).not.toBe(source.id)
  })

  test("invalid gallery URL is fail-closed and does not erase an existing gallery", async () => {
    const product = await db.producto.create({
      data: {
        negocioId,
        nombre: `${prefix}invalid`,
        precio: 400,
        imagenUrl: mainUrl,
        imagenesExtra: JSON.stringify([galleryA, galleryB]),
      },
    })

    const response = await updateProduct(
      request("PUT", `/api/negocio/productos/${product.id}`, {
        imagenesExtra: ["https://example.com/not-an-allowed-resource.jpg"],
      }),
      params(product.id)
    )
    expect(response.status).toBe(400)
    const stored = await db.producto.findUniqueOrThrow({ where: { id: product.id } })
    expect(JSON.parse(stored.imagenesExtra)).toEqual([galleryA, galleryB])
  })
})
