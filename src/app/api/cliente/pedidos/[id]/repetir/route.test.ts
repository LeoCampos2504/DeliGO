/// <reference types="bun-types" />

// ============================================
// P2-T56-R2C-F2 — PUT /api/cliente/pedidos/[id]/repetir: variantes
// ============================================
// Real-DB integration test. Repetir un pedido con una línea variant-aware
// debe re-validar la variante ACTUAL (nunca solo el producto base) — de lo
// contrario "repetir pedido" agregaría al carrito el producto sin variante,
// una regresión funcional introducida por R2C-F2 si no se cubriera acá.

import { randomUUID } from "crypto"
import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createSession, SESSION_COOKIE_NAME } from "@/lib/auth"
import { PUT } from "./route"

setDefaultTimeout(60_000)

const testDatabaseUrl = process.env.DELIGO_TEST_DATABASE_URL
if (!testDatabaseUrl || process.env.DATABASE_URL !== testDatabaseUrl) {
  throw new Error(
    "Este test de integración requiere DELIGO_TEST_DATABASE_URL y DATABASE_URL apuntando a la misma base TESTING."
  )
}

const prefix = "test-r2cf2-repetir-"
const createdNegocios: string[] = []
const createdClientes: string[] = []

async function ensureNegocio() {
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
      ofreceDelivery: true,
    },
  })
  createdNegocios.push(negocio.id)
  return negocio
}

async function ensureCliente() {
  const suffix = randomUUID()
  const cliente = await db.cliente.create({
    data: { nombre: `${prefix}${suffix}`, email: `${prefix}${suffix}@example.test`, telefono: "" },
  })
  createdClientes.push(cliente.id)
  return cliente
}

function requestFor(pedidoId: string, cookie: string) {
  return new NextRequest(`http://localhost/api/cliente/pedidos/${pedidoId}/repetir`, {
    method: "PUT",
    headers: { cookie: `${SESSION_COOKIE_NAME}=${cookie}` },
  })
}

function paramsFor(id: string) {
  return { params: Promise.resolve({ id }) }
}

afterAll(async () => {
  await db.pedido.deleteMany({ where: { negocioId: { in: createdNegocios } } })
  await db.productoVariante.deleteMany({ where: { producto: { negocioId: { in: createdNegocios } } } })
  await db.producto.deleteMany({ where: { negocioId: { in: createdNegocios } } })
  await db.negocio.deleteMany({ where: { id: { in: createdNegocios } } })
  await db.cliente.deleteMany({ where: { id: { in: createdClientes } } })
})

describe("P2-T56-R2C-F2 — PUT /api/cliente/pedidos/[id]/repetir re-valida la variante actual", () => {
  test("item con variante todavía activa y con stock: disponible=true, precio/varianteNombre actuales", async () => {
    const negocio = await ensureNegocio()
    const cliente = await ensureCliente()
    const producto = await db.producto.create({
      data: { nombre: "Coca Cola", precio: 999999, negocioId: negocio.id },
    })
    const variante = await db.productoVariante.create({
      data: { productoId: producto.id, nombre: "500 ml", precio: 2000, controlStock: true, stockCantidad: 3 },
    })
    const pedido = await db.pedido.create({
      data: {
        negocioId: negocio.id,
        negocioSlug: negocio.slug,
        negocioNombre: negocio.nombre,
        clienteId: cliente.id,
        clienteNombre: cliente.nombre,
        total: 2000,
        totalProductos: 2000,
        metodoEntrega: "retiro",
        items: {
          create: [
            {
              productoId: producto.id,
              productoVarianteId: variante.id,
              varianteNombre: "500 ml",
              nombre: "Coca Cola",
              precio: 2000,
              cantidad: 1,
            },
          ],
        },
      },
    })

    const token = await createSession(cliente.id, "cliente")
    const res = await PUT(requestFor(pedido.id, token), paramsFor(pedido.id))
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.items).toHaveLength(1)
    expect(body.items[0].disponible).toBe(true)
    expect(body.items[0].varianteId).toBe(variante.id)
    expect(body.items[0].varianteNombre).toBe("500 ml")
    expect(body.items[0].precioActual).toBe(2000)
  })

  test("item cuya variante fue INACTIVADA desde entonces: disponible=false, nunca cae al precio base", async () => {
    const negocio = await ensureNegocio()
    const cliente = await ensureCliente()
    const producto = await db.producto.create({
      data: { nombre: "Producto con variante descontinuada", precio: 111, negocioId: negocio.id },
    })
    const variante = await db.productoVariante.create({
      data: { productoId: producto.id, nombre: "Vieja", precio: 2000 },
    })
    const pedido = await db.pedido.create({
      data: {
        negocioId: negocio.id,
        negocioSlug: negocio.slug,
        negocioNombre: negocio.nombre,
        clienteId: cliente.id,
        clienteNombre: cliente.nombre,
        total: 2000,
        totalProductos: 2000,
        metodoEntrega: "retiro",
        items: {
          create: [
            {
              productoId: producto.id,
              productoVarianteId: variante.id,
              varianteNombre: "Vieja",
              nombre: "Producto con variante descontinuada",
              precio: 2000,
              cantidad: 1,
            },
          ],
        },
      },
    })
    // La variante se inactiva DESPUÉS de creado el pedido.
    await db.productoVariante.update({ where: { id: variante.id }, data: { activo: false } })

    const token = await createSession(cliente.id, "cliente")
    const res = await PUT(requestFor(pedido.id, token), paramsFor(pedido.id))
    const body = await res.json()

    expect(body.items[0].disponible).toBe(false)
    expect(body.items[0].motivoIndisponibilidad).toBe("Esta opción ya no está disponible")
  })

  test("item cuya variante ahora tiene stock 0: disponible=false, motivo 'Sin stock'", async () => {
    const negocio = await ensureNegocio()
    const cliente = await ensureCliente()
    const producto = await db.producto.create({
      data: { nombre: "Producto stock agotado luego", precio: 111, negocioId: negocio.id },
    })
    const variante = await db.productoVariante.create({
      data: { productoId: producto.id, nombre: "Talle único", precio: 500, controlStock: true, stockCantidad: 2 },
    })
    const pedido = await db.pedido.create({
      data: {
        negocioId: negocio.id,
        negocioSlug: negocio.slug,
        negocioNombre: negocio.nombre,
        clienteId: cliente.id,
        clienteNombre: cliente.nombre,
        total: 500,
        totalProductos: 500,
        metodoEntrega: "retiro",
        items: {
          create: [
            {
              productoId: producto.id,
              productoVarianteId: variante.id,
              varianteNombre: "Talle único",
              nombre: "Producto stock agotado luego",
              precio: 500,
              cantidad: 1,
            },
          ],
        },
      },
    })
    await db.productoVariante.update({ where: { id: variante.id }, data: { stockCantidad: 0 } })

    const token = await createSession(cliente.id, "cliente")
    const res = await PUT(requestFor(pedido.id, token), paramsFor(pedido.id))
    const body = await res.json()

    expect(body.items[0].disponible).toBe(false)
    expect(body.items[0].motivoIndisponibilidad).toBe("Sin stock")
  })

  test("item histórico SIN variante, producto ahora migrado a variantes: exige volver a elegir, nunca usa el precio base dormido", async () => {
    const negocio = await ensureNegocio()
    const cliente = await ensureCliente()
    const producto = await db.producto.create({
      data: { nombre: "Producto migrado a variantes", precio: 777, negocioId: negocio.id },
    })
    const pedido = await db.pedido.create({
      data: {
        negocioId: negocio.id,
        negocioSlug: negocio.slug,
        negocioNombre: negocio.nombre,
        clienteId: cliente.id,
        clienteNombre: cliente.nombre,
        total: 777,
        totalProductos: 777,
        metodoEntrega: "retiro",
        items: {
          create: [
            { productoId: producto.id, nombre: "Producto migrado a variantes", precio: 777, cantidad: 1 },
          ],
        },
      },
    })
    // El producto pasa a tener variantes DESPUÉS del pedido histórico.
    await db.productoVariante.create({ data: { productoId: producto.id, nombre: "Nueva variante", precio: 900 } })

    const token = await createSession(cliente.id, "cliente")
    const res = await PUT(requestFor(pedido.id, token), paramsFor(pedido.id))
    const body = await res.json()

    expect(body.items[0].disponible).toBe(false)
    expect(body.items[0].motivoIndisponibilidad).toContain("elegir una opción")
  })

  test("producto SIN variantes: comportamiento exactamente igual que antes (regresión)", async () => {
    const negocio = await ensureNegocio()
    const cliente = await ensureCliente()
    const producto = await db.producto.create({
      data: { nombre: "Producto simple", precio: 300, negocioId: negocio.id },
    })
    const pedido = await db.pedido.create({
      data: {
        negocioId: negocio.id,
        negocioSlug: negocio.slug,
        negocioNombre: negocio.nombre,
        clienteId: cliente.id,
        clienteNombre: cliente.nombre,
        total: 300,
        totalProductos: 300,
        metodoEntrega: "retiro",
        items: {
          create: [{ productoId: producto.id, nombre: "Producto simple", precio: 300, cantidad: 1 }],
        },
      },
    })

    const token = await createSession(cliente.id, "cliente")
    const res = await PUT(requestFor(pedido.id, token), paramsFor(pedido.id))
    const body = await res.json()

    expect(body.items[0].disponible).toBe(true)
    expect(body.items[0].varianteId).toBeNull()
    expect(body.items[0].precioActual).toBe(300)
  })
})
