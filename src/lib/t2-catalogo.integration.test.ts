/// <reference types="bun-types" />
import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "node:crypto"
import type { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { asociarProductos, desasociarProducto } from "@/lib/proveedor-productos-service"
import { CatalogoError, crearProductoEmpleado, editarProductoEmpleado, guardarPermisosCatalogo, listarCatalogoEmpleado, permisosCatalogo } from "@/lib/catalogo-empleado-service"

setDefaultTimeout(180_000)
if (!process.env.DELIGO_TEST_DATABASE_URL || process.env.DATABASE_URL !== process.env.DELIGO_TEST_DATABASE_URL || process.env.DELIGO_ENVIRONMENT !== "TESTING" || process.env.DELIGO_EPHEMERAL_TEST_DB !== "1") throw new Error("T2 requiere PostgreSQL efímero declarado")

describe("T2 catálogo: permisos independientes, costos y stock", () => {
  test("revocación parcial, vencimiento y datos de otro negocio no autorizan escrituras", async () => {
    const id = randomUUID()
    const a = await db.negocio.create({ data: { slug: `t2a-${id}`, nombre: `T2 A ${id}`, usuario: `t2a-${id}`, email: `t2a-${id}@example.test`, password: "fixture", rubro: "negocio", aprobado: true } })
    const b = await db.negocio.create({ data: { slug: `t2b-${id}`, nombre: `T2 B ${id}`, usuario: `t2b-${id}`, email: `t2b-${id}@example.test`, password: "fixture", rubro: "negocio", aprobado: true } })
    const empleado = await db.empleado.create({ data: { negocioId: a.id, nombre: "T2", codigo: id.slice(0, 8), catalogoHasta: new Date(Date.now() + 3600_000), catalogoCrear: true, catalogoEditar: true, catalogoPrecios: true, catalogoCostos: false } })
    const producto = await db.producto.create({ data: { negocioId: a.id, nombre: "Producto", precio: 10, costo: 7, controlStock: true, stockCantidad: 5, variantes: { create: [{ nombre: "A", precio: 10 }, { nombre: "B", precio: 20 }] } }, include: { variantes: true } })
    const ajeno = await db.producto.create({ data: { negocioId: b.id, nombre: "Ajeno", precio: 15, controlStock: true, stockCantidad: 3, variantes: { create: { nombre: "Ajena", precio: 15 } } }, include: { variantes: true } })
    const otroEmpleado = await db.empleado.create({ data: { negocioId: b.id, nombre: "Otro", codigo: id.slice(0, 8) } })
    const permisos = await permisosCatalogo(db, a.id, empleado.id)
    const lista = await listarCatalogoEmpleado(db, a.id, permisos)
    expect(JSON.stringify(lista)).not.toContain('"costo"')
    expect(lista.productos.some((p) => p.id === ajeno.id)).toBe(false)
    const entrada = { negocioId: a.id, empleadoId: empleado.id, productoId: producto.id }
    const costo = await editarProductoEmpleado(db, { ...entrada, body: { costo: 99 } })
    expect(costo.ok).toBe(false)
    if (!costo.ok) expect(costo.code).toBe("COSTO_SIN_PERMISO")
    const stock = await editarProductoEmpleado(db, { ...entrada, body: { stockCantidad: 99, controlStock: false } })
    expect(stock.ok).toBe(false)
    if (!stock.ok) expect(stock.code).toBe("STOCK_NO_PERMITIDO")
    const ajenoResultado = await editarProductoEmpleado(db, { ...entrada, productoId: ajeno.id, body: { nombre: "Invasión" } })
    expect(ajenoResultado.ok).toBe(false)
    if (!ajenoResultado.ok) expect(ajenoResultado.status).toBe(404)
    const varianteAjena = await editarProductoEmpleado(db, { ...entrada, body: { variantes: [{ id: ajeno.variantes[0].id, precio: 100 }] } })
    expect(varianteAjena.ok).toBe(false)
    if (!varianteAjena.ok) expect(varianteAjena.code).toBe("VARIANTE_INVALIDA")
    const permisoAjeno = await guardarPermisosCatalogo(db, a.id, { empleadoId: otroEmpleado.id, hasta: new Date(Date.now() + 3600_000).toISOString(), crear: true })
    expect(permisoAjeno.ok).toBe(false)
    if (!permisoAjeno.ok) expect(permisoAjeno.status).toBe(404)
    expect((await db.empleado.findUniqueOrThrow({ where: { id: otroEmpleado.id } })).catalogoCrear).toBe(false)
    await db.empleado.update({ where: { id: empleado.id }, data: { catalogoPrecios: false } })
    const precio = await editarProductoEmpleado(db, { ...entrada, body: { variantes: [{ id: producto.variantes[0].id, precio: 100 }] } })
    expect(precio.ok).toBe(false)
    if (!precio.ok) expect(precio.code).toBe("PRECIO_SIN_PERMISO")
    const nombre = await editarProductoEmpleado(db, { ...entrada, body: { nombre: "Permitido" } })
    expect(nombre.ok).toBe(true)
    const intentoStock = await crearProductoEmpleado(db, { negocioId: a.id, empleadoId: empleado.id, body: { nombre: "Rechazado", stockCantidad: 2 } })
    expect(intentoStock.ok).toBe(false)
    await db.empleado.update({ where: { id: empleado.id }, data: { catalogoHasta: new Date(Date.now() - 1000) } })
    expect((await editarProductoEmpleado(db, { ...entrada, body: { nombre: "Vencido" } })).ok).toBe(false)
    const final = await db.producto.findUniqueOrThrow({ where: { id: producto.id }, include: { variantes: true } })
    expect(final.nombre).toBe("Permitido")
    expect(final.costo).toBe(7)
    expect(final.stockCantidad).toBe(5)
    expect(final.controlStock).toBe(true)
    expect(final.variantes.map((v) => v.precio).sort((x, y) => x - y)).toEqual([10, 20])
    expect(await db.movimientoInventario.count({ where: { negocioId: a.id } })).toBe(0)
    expect((await db.producto.findUniqueOrThrow({ where: { id: ajeno.id } })).nombre).toBe("Ajeno")
  })

  test("revalida precios, costos y edición dentro de la transacción tras revocación parcial", async () => {
    const id = randomUUID()
    const negocio = await db.negocio.create({ data: { slug: `t2r-${id}`, nombre: `T2 R ${id}`, usuario: `t2r-${id}`, email: `t2r-${id}@example.test`, password: "fixture", rubro: "negocio", aprobado: true } })
    const empleado = await db.empleado.create({ data: { negocioId: negocio.id, nombre: "T2", codigo: id.slice(0, 8), catalogoHasta: new Date(Date.now() + 3600_000), catalogoCrear: true, catalogoEditar: true, catalogoPrecios: true, catalogoCostos: true } })
    const producto = await db.producto.create({ data: { negocioId: negocio.id, nombre: "Original", precio: 10 } })
    // Interleave a committed revocation after the initial read and before the real transaction.
    const revocarAntesDeTx = (campo: "catalogoPrecios" | "catalogoCostos" | "catalogoEditar") => new Proxy(db, {
      get(target, prop, receiver) {
        if (prop === "$transaction") return async (fn: (tx: Prisma.TransactionClient) => Promise<unknown>, options: { isolationLevel?: Prisma.TransactionIsolationLevel; maxWait?: number; timeout?: number }) => {
          await db.empleado.update({ where: { id: empleado.id }, data: { [campo]: false } })
          return db.$transaction(fn, options)
        }
        return Reflect.get(target, prop, receiver)
      },
    })
    const entrada = { negocioId: negocio.id, empleadoId: empleado.id }
    await expect(crearProductoEmpleado(revocarAntesDeTx("catalogoPrecios"), { ...entrada, body: { nombre: "Precio", precio: 100 } })).rejects.toBeInstanceOf(CatalogoError)
    await expect(crearProductoEmpleado(revocarAntesDeTx("catalogoCostos"), { ...entrada, body: { nombre: "Costo", costo: 5 } })).rejects.toBeInstanceOf(CatalogoError)
    await expect(editarProductoEmpleado(revocarAntesDeTx("catalogoEditar"), { ...entrada, productoId: producto.id, body: { nombre: "Alterado" } })).rejects.toBeInstanceOf(CatalogoError)
    expect(await db.producto.count({ where: { negocioId: negocio.id } })).toBe(1)
    expect((await db.producto.findUniqueOrThrow({ where: { id: producto.id } })).nombre).toBe("Original")
    expect(await db.auditLog.count({ where: { recurso: "producto", recursoId: producto.id } })).toBe(0)
  })


  test("asociaciones de proveedor revalidan autorización en la transacción", async () => {
    const id = randomUUID()
    const a = await db.negocio.create({ data: { slug: `t2p-${id}`, nombre: `T2 P ${id}`, usuario: `t2p-${id}`, email: `t2p-${id}@example.test`, password: "fixture", rubro: "negocio", aprobado: true } })
    const producto = await db.producto.create({ data: { negocioId: a.id, nombre: "Producto", precio: 10 } })
    const proveedor = await db.proveedor.create({ data: { negocioId: a.id, nombre: "Proveedor", nombreNormalizado: "proveedor", actorId: a.id, idempotencyKey: id } })
    const input = { negocioId: a.id, proveedorId: proveedor.id, body: { items: [{ productoId: producto.id }] } }
    const rechazado = await asociarProductos(db, input, { autorizar: async () => false })
    expect(rechazado.ok).toBe(false)
    if (!rechazado.ok) expect(rechazado.status).toBe(403)
    expect(await db.proveedorProducto.count({ where: { negocioId: a.id } })).toBe(0)
    const permitido = await asociarProductos(db, input, { autorizar: async () => true })
    expect(permitido.ok).toBe(true)
    const fila = await db.proveedorProducto.findFirstOrThrow({ where: { negocioId: a.id, proveedorId: proveedor.id, productoId: producto.id } })
    const quitar = await desasociarProducto(db, { negocioId: a.id, proveedorId: proveedor.id, asociacionId: fila.id }, { autorizar: async () => false })
    expect(quitar.ok).toBe(false)
    expect(await db.proveedorProducto.count({ where: { id: fila.id } })).toBe(1)
  })

})
