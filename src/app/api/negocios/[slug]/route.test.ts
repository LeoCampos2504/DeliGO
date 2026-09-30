/// <reference types="bun-types" />

// ============================================
// P2-T56-R2C-F2 — GET /api/negocios/[slug] expone variantes públicas
// ============================================
// Real-DB integration test, mismo patrón que
// src/app/api/negocio/productos/[id]/variantes/route.test.ts.

import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { GET } from "./route"

setDefaultTimeout(60_000)

const testDatabaseUrl = process.env.DELIGO_TEST_DATABASE_URL
if (!testDatabaseUrl || process.env.DATABASE_URL !== testDatabaseUrl) {
  throw new Error(
    "Este test de integración requiere DELIGO_TEST_DATABASE_URL y DATABASE_URL apuntando a la misma base TESTING."
  )
}

const prefix = "test-r2cf2-pub-"
const createdNegocios: string[] = []

async function createNegocio() {
  const suffix = randomUUID()
  const negocio = await db.negocio.create({
    data: {
      slug: `${prefix}${suffix}`,
      nombre: `${prefix}${suffix}`,
      usuario: `${prefix}${suffix}`,
      email: `${prefix}${suffix}@example.test`,
      password: "fixture",
      rubro: "negocio",
      aprobado: true,
      suspendido: false,
    },
  })
  createdNegocios.push(negocio.id)
  return negocio
}

function paramsFor(slug: string) {
  return { params: Promise.resolve({ slug }) }
}

afterAll(async () => {
  await db.producto.deleteMany({ where: { negocioId: { in: createdNegocios } } })
  await db.negocio.deleteMany({ where: { id: { in: createdNegocios } } })
})

describe("P2-T56-R2C-F2 — GET /api/negocios/[slug]: variantes", () => {
  test("producto SIN variantes: tieneVariantes=false, variantes=[] (regresión)", async () => {
    const negocio = await createNegocio()
    await db.producto.create({ data: { nombre: "Producto simple", precio: 100, negocioId: negocio.id } })

    const res = await GET(new NextRequest("http://localhost/api/negocios/x"), paramsFor(negocio.slug))
    expect(res.status).toBe(200)
    const body = await res.json()
    const producto = body.productos[0]
    expect(producto.tieneVariantes).toBe(false)
    expect(producto.variantes).toEqual([])
  })

  test("producto CON variantes: solo expone las ACTIVAS, campos mínimos, nunca costo/sku/codigoBarras", async () => {
    const negocio = await createNegocio()
    const producto = await db.producto.create({
      data: { nombre: "Coca Cola", precio: 999999, negocioId: negocio.id },
    })
    await db.productoVariante.create({
      data: {
        productoId: producto.id,
        nombre: "500 ml",
        precio: 2000,
        costo: 800,
        sku: "SKU-500",
        codigoBarras: "111",
        controlStock: true,
        stockCantidad: 5,
      },
    })
    await db.productoVariante.create({
      data: { productoId: producto.id, nombre: "Descontinuada", precio: 1, activo: false },
    })

    const res = await GET(new NextRequest("http://localhost/api/negocios/x"), paramsFor(negocio.slug))
    expect(res.status).toBe(200)
    const body = await res.json()
    const productoOut = body.productos.find((p: { id: string }) => p.id === producto.id)

    expect(productoOut.tieneVariantes).toBe(true)
    expect(productoOut.variantes).toHaveLength(1)
    expect(productoOut.variantes[0]).toEqual({
      id: expect.any(String),
      nombre: "500 ml",
      precio: 2000,
      controlStock: true,
      stockCantidad: 5,
    })
    expect(productoOut.variantes[0]).not.toHaveProperty("costo")
    expect(productoOut.variantes[0]).not.toHaveProperty("sku")
    expect(productoOut.variantes[0]).not.toHaveProperty("codigoBarras")
  })

  test("producto cuyas variantes están TODAS inactivas: tieneVariantes=true pero variantes=[] (nunca cae al precio/stock base dormido)", async () => {
    const negocio = await createNegocio()
    const producto = await db.producto.create({
      data: { nombre: "Todas inactivas", precio: 555, negocioId: negocio.id },
    })
    await db.productoVariante.create({
      data: { productoId: producto.id, nombre: "Vieja", precio: 100, activo: false },
    })

    const res = await GET(new NextRequest("http://localhost/api/negocios/x"), paramsFor(negocio.slug))
    const body = await res.json()
    const productoOut = body.productos.find((p: { id: string }) => p.id === producto.id)

    expect(productoOut.tieneVariantes).toBe(true)
    expect(productoOut.variantes).toEqual([])
  })
})
