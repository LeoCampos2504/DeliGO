/// <reference types="bun-types" />
import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createOperationalSession, OPERATIONAL_SESSION_COOKIE_NAME } from "@/lib/auth"

setDefaultTimeout(180_000)
if (!process.env.DELIGO_TEST_DATABASE_URL || process.env.DATABASE_URL !== process.env.DELIGO_TEST_DATABASE_URL || process.env.DELIGO_ENVIRONMENT !== "TESTING" || process.env.DELIGO_EPHEMERAL_TEST_DB !== "1") throw new Error("T2 requiere PostgreSQL efímero declarado")
const { POST: inicio } = await import("@/app/api/operativo/caja/[slug]/ventas/inicio/route")
const { POST: venta } = await import("@/app/api/operativo/caja/[slug]/ventas/route")

describe("T2 venta sin precio", () => {
  test("la ruta real rechaza sin efectos y el mismo actor puede vender un producto válido", async () => {
    const id = randomUUID()
    const negocio = await db.negocio.create({ data: { slug: `t2v-${id}`, nombre: `T2 V ${id}`, usuario: `t2v-${id}`, email: `t2v-${id}@example.test`, password: "fixture", rubro: "negocio", aprobado: true, empleadosActivos: true, suspendido: false } })
    const cuenta = await db.cuentaOperativa.create({ data: { nombre: "T2", email: `t2v-c-${id}@example.test`, activo: true, eliminado: false } })
    await db.empleado.create({ data: { negocioId: negocio.id, cuentaOperativaId: cuenta.id, nombre: "T2", codigo: id.slice(0, 8), areaOperativa: "caja", activo: true, eliminado: false } })
    const sinPrecio = await db.producto.create({ data: { negocioId: negocio.id, nombre: "Sin precio", precio: 0, controlStock: true, stockCantidad: 3 } })
    const valido = await db.producto.create({ data: { negocioId: negocio.id, nombre: "Con precio", precio: 1000, controlStock: true, stockCantidad: 3 } })
    const cookie = `${OPERATIONAL_SESSION_COOKIE_NAME}=${await createOperationalSession(cuenta.id)}`
    const ctx = { params: Promise.resolve({ slug: negocio.slug }) }
    const url = `http://localhost/api/operativo/caja/${negocio.slug}/ventas`
    const arranque = await inicio(new NextRequest(`${url}/inicio`, { method: "POST", headers: { cookie, "content-type": "application/json" }, body: "{}" }), ctx)
    expect(arranque.status).toBe(201)
    const inicioId = (await arranque.json()).inicio.id as string
    const enviar = (productoId: string, totalMostrado: number) => venta(new NextRequest(url, { method: "POST", headers: { cookie, "content-type": "application/json", "idempotency-key": randomUUID() }, body: JSON.stringify({ metodoPago: "EFECTIVO", items: [{ productoId, cantidad: 1 }], inicioVentaId: inicioId, totalMostrado }) }), ctx)
    const r = await enviar(sinPrecio.id, 0)
    expect(r.status).toBe(400)
    expect((await r.json()).code).toBe("PRODUCTO_SIN_PRECIO")
    expect(await db.venta.count({ where: { negocioId: negocio.id } })).toBe(0)
    expect(await db.cobroVenta.count({ where: { negocioId: negocio.id } })).toBe(0)
    expect(await db.operacionFinanciera.count({ where: { negocioId: negocio.id } })).toBe(0)
    expect(await db.movimientoFinanciero.count({ where: { negocioId: negocio.id } })).toBe(0)
    expect(await db.movimientoInventario.count({ where: { negocioId: negocio.id } })).toBe(0)
    expect(await db.turnoCaja.count({ where: { negocioId: negocio.id } })).toBe(0)
    expect((await db.producto.findUniqueOrThrow({ where: { id: sinPrecio.id } })).stockCantidad).toBe(3)
    const ok = await enviar(valido.id, 1000)
    expect(ok.status).toBe(201)
    expect(await db.venta.count({ where: { negocioId: negocio.id } })).toBe(1)
    expect((await db.producto.findUniqueOrThrow({ where: { id: valido.id } })).stockCantidad).toBe(2)
  })
})
