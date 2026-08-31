/// <reference types="bun-types" />

import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { GET as getPublicBusiness } from "@/app/api/negocios/[slug]/route"

const prefix = `test-product-gallery-public-render-r1-${randomUUID()}-`
const mainImage = "https://res.cloudinary.test/product-gallery-public-main.jpg"
const extraImages = [
  "https://res.cloudinary.test/product-gallery-public-extra-a.jpg",
  "https://res.cloudinary.test/product-gallery-public-extra-b.jpg",
  "https://res.cloudinary.test/product-gallery-public-extra-c.jpg",
]
setDefaultTimeout(60_000)

async function cleanup() {
  const businesses = await db.negocio.findMany({
    where: { slug: { startsWith: prefix } },
    select: { id: true },
  })
  const businessIds = businesses.map((business) => business.id)
  if (businessIds.length === 0) return
  await db.producto.deleteMany({ where: { negocioId: { in: businessIds } } })
  await db.negocio.deleteMany({ where: { id: { in: businessIds } } })
}

beforeAll(async () => {
  expect(process.env.DATABASE_URL).toBe(process.env.DELIGO_TEST_DATABASE_URL)
  await cleanup()
  const business = await db.negocio.create({
    data: {
      nombre: `${prefix}business`,
      slug: `${prefix}business`,
      usuario: `${prefix}business`,
      email: `${prefix}business@example.test`,
      password: "fixture",
      aprobado: true,
      suspendido: false,
    },
  })
  await db.producto.create({
    data: {
      negocioId: business.id,
      nombre: `${prefix}product`,
      precio: 100,
      imagenUrl: mainImage,
      imagenesExtra: JSON.stringify(extraImages),
      orden: 0,
    },
  })
})

afterAll(async () => {
  await cleanup()
  expect(await db.negocio.count({ where: { slug: { startsWith: prefix } } })).toBe(0)
})

describe("PRODUCT-GALLERY-PUBLIC-RENDER-HOTFIX-R1 — public API evidence", () => {
  test("PUBLIC_API_RAW/RESPONSE preserve MAIN=A and EXTRA=[B,C,D] in order", async () => {
    const response = await getPublicBusiness(
      new NextRequest(`http://localhost/api/negocios/${prefix}business`),
      { params: Promise.resolve({ slug: `${prefix}business` }) }
    )
    expect(response.status).toBe(200)
    const body = await response.json() as {
      productosSinSeccion: Array<{ imagenUrl: string | null; imagenesExtra: string[] }>
    }
    expect(body.productosSinSeccion).toHaveLength(1)
    expect(body.productosSinSeccion[0]?.imagenUrl).toBe(mainImage)
    expect(body.productosSinSeccion[0]?.imagenesExtra).toEqual(extraImages)
  })
})
