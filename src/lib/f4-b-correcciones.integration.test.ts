/// <reference types="bun-types" />

// ============================================
// F4-B — owner sale corrections (REAL ephemeral PostgreSQL)
// ============================================
// Real routes + real PostgreSQL with every migration applied (CI service
// container, DELIGO_EPHEMERAL_TEST_DB=1). Isolated fixtures (random ids).

import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { NextRequest } from "next/server"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { createOperationalSession, createSession, OPERATIONAL_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/auth"
import { GET as getCajas } from "@/app/api/negocio/caja/cajas/route"
import { GET as getVentasHoy, POST as postVentaOwner } from "@/app/api/negocio/caja/ventas/route"
import { POST as postTurnoCajero } from "@/app/api/operativo/caja/[slug]/turno/route"
import { POST as postVentaCajero } from "@/app/api/operativo/caja/[slug]/ventas/route"
import { GET as getDetalleCajero, POST as postDevolucionCajero } from "@/app/api/operativo/caja/[slug]/ventas/[id]/devoluciones/route"
import { GET as getDetalleOwner } from "@/app/api/negocio/caja/ventas/[id]/devoluciones/route"
import * as correccionModule from "@/app/api/negocio/caja/ventas/[id]/correcciones/route"
import { calcularSnapshotEfectivoTurno } from "@/lib/caja-turnos-snapshot"
import { isStockSerializationConflict, leerDisponibilidadStock, liberarReservasPedido, reservarStockPedido, runStockSerializable } from "@/lib/stock-lifecycle"
import { stockKey } from "@/lib/stock-authority"

setDefaultTimeout(240_000)

const testDatabaseUrl = process.env.DELIGO_TEST_DATABASE_URL
const isEphemeralIntegrationDb = process.env.DELIGO_EPHEMERAL_TEST_DB === "1"
if (!testDatabaseUrl || process.env.DATABASE_URL !== testDatabaseUrl) {
  throw new Error("Este test de integración requiere DELIGO_TEST_DATABASE_URL y DATABASE_URL apuntando a la misma base de prueba.")
}
const declaredEnvironment = process.env.DELIGO_ENVIRONMENT ?? process.env.RAILWAY_ENVIRONMENT_NAME ?? process.env.APP_ENV
if (!declaredEnvironment || declaredEnvironment.toUpperCase() !== "TESTING") {
  throw new Error("La suite F4-B sólo puede ejecutarse con DELIGO_ENVIRONMENT=TESTING.")
}
process.env.DELIGO_ENVIRONMENT = "TESTING"
process.env.DELIGO_F10_B2_2_B_SHIFT_UI_ENABLED = "true"

// Writes real rows: only against the ephemeral CI database.
const ephemeralTest = isEphemeralIntegrationDb ? test : test.skip

afterAll(async () => {
  await db.$disconnect()
})

const D = (v: string) => new Prisma.Decimal(v)
async function fails(p: PromiseLike<unknown>) {
  try {
    await p
    return false
  } catch {
    return true
  }
}

async function crearNegocio() {
  const suffix = randomUUID()
  const negocio = await db.negocio.create({
    data: {
      slug: `test-f4b-${suffix}`,
      nombre: `Test F4-B ${suffix}`,
      usuario: `test-f4b-${suffix}`,
      email: `test-f4b-${suffix}@example.test`,
      password: "fixture",
      rubro: "negocio",
      aprobado: true,
      suspendido: false,
      empleadosActivos: true,
      salonActivo: true,
      cajaTurnosModo: "OPCIONAL",
    },
  })
  const token = await createSession(negocio.id, "negocio")
  return { negocio, owner: `${SESSION_COOKIE_NAME}=${token}` }
}

async function crearCajero(negocioId: string, nombre = `Cajero ${randomUUID().slice(0, 6)}`) {
  const cuenta = await db.cuentaOperativa.create({ data: { nombre, email: `test-f4b-${randomUUID()}@example.test`, activo: true, eliminado: false } })
  const empleado = await db.empleado.create({
    data: { nombre, codigo: randomUUID().slice(0, 8).toUpperCase(), negocioId, cuentaOperativaId: cuenta.id, areaOperativa: "caja", activo: true, eliminado: false },
  })
  const allowlist = new Set((process.env.DELIGO_F10_B2_2_B_CONTROLLED_EMPLOYEE_IDS ?? "").split(/[\s,;]+/).filter(Boolean))
  allowlist.add(empleado.id)
  process.env.DELIGO_F10_B2_2_B_CONTROLLED_EMPLOYEE_IDS = [...allowlist].join(",")
  const token = await createOperationalSession(cuenta.id)
  return { empleado, cookie: `${OPERATIONAL_SESSION_COOKIE_NAME}=${token}` }
}

async function crearProducto(negocioId: string, nombre: string, precio: number, opts: { controlStock?: boolean; stockCantidad?: number } = {}) {
  return db.producto.create({ data: { nombre, precio, negocioId, controlStock: opts.controlStock ?? false, stockCantidad: opts.stockCantidad ?? 0 } })
}

const json = async (res: Response) => ({ status: res.status, replayed: res.headers.get("Idempotency-Replayed") === "true", body: await res.json() })
const req = (url: string, cookie: string, method = "GET", body?: unknown, key?: string) =>
  new NextRequest(`http://localhost${url}`, {
    method,
    headers: { cookie, "content-type": "application/json", ...(key ? { "idempotency-key": key } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
const slugCtx = (slug: string) => ({ params: Promise.resolve({ slug }) })
const slugIdCtx = (slug: string, id: string) => ({ params: Promise.resolve({ slug, id }) })
const idCtx = (id: string) => ({ params: Promise.resolve({ id }) })

const listarCajas = async (owner: string) => json(await getCajas(req("/api/negocio/caja/cajas", owner)))
const abrirCajero = async (cookie: string, slug: string, body: unknown) =>
  json(await postTurnoCajero(req(`/api/operativo/caja/${slug}/turno`, cookie, "POST", body, randomUUID()), slugCtx(slug)))
const cerrarCajero = async (cookie: string, slug: string, turnoCajaId: string, efectivoContado: string) =>
  json(await postTurnoCajero(req(`/api/operativo/caja/${slug}/turno`, cookie, "POST", { action: "close", turnoCajaId, efectivoContado }, randomUUID()), slugCtx(slug)))
const venderCajero = async (cookie: string, slug: string, body: unknown) =>
  json(await postVentaCajero(req(`/api/operativo/caja/${slug}/ventas`, cookie, "POST", body, randomUUID()), slugCtx(slug)))
const venderOwner = async (owner: string, body: unknown) => json(await postVentaOwner(req("/api/negocio/caja/ventas", owner, "POST", body, randomUUID())))
const corregir = async (cookie: string, ventaId: string, body: unknown, key: string | undefined = randomUUID()) =>
  json(await correccionModule.POST(req(`/api/negocio/caja/ventas/${ventaId}/correcciones`, cookie, "POST", body, key), idCtx(ventaId)))
const devolverCajero = async (cookie: string, slug: string, ventaId: string, body: unknown) =>
  json(await postDevolucionCajero(req(`/api/operativo/caja/${slug}/ventas/${ventaId}/devoluciones`, cookie, "POST", body, randomUUID()), slugIdCtx(slug, ventaId)))
const detalleOwner = async (owner: string, ventaId: string) => json(await getDetalleOwner(req(`/api/negocio/caja/ventas/${ventaId}/devoluciones`, owner), idCtx(ventaId)))
const detalleCajero = async (cookie: string, slug: string, ventaId: string) =>
  json(await getDetalleCajero(req(`/api/operativo/caja/${slug}/ventas/${ventaId}/devoluciones`, cookie), slugIdCtx(slug, ventaId)))

const itemDe = (venta: { items: Array<{ id: string; productoId: string | null }> }, productoId: string) => venta.items.find((item) => item.productoId === productoId)!.id
const stockDe = async (productoId: string) => (await db.producto.findUniqueOrThrow({ where: { id: productoId } })).stockCantidad
const correccion = (lineas: Array<{ ventaItemId: string; productoId: string | null; varianteId?: string | null; cantidad: number }>, secuenciaEsperada = 0, motivo = "Se escaneó el sabor equivocado") =>
  ({ motivo, confirmo: true, secuenciaEsperada, lineas: lineas.map((l) => ({ varianteId: null, ...l })) })

// Price rule revised by the operator (2026-11-05 / 2026-11-04): a corrected line
// keeps the unit price actually charged and may only name its own product,
// another product of the SAME sale charged at exactly that price, or an enabled
// product/variant of the business whose CURRENT catalog price equals the charged
// price exactly (evidence stored; not proof of the historical price). Real
// exchanges with money differences and combinations belong to F4-C.
const UNJUSTIFIED = "PRECIO_NO_JUSTIFICADO"

describe("F4-B — owner corrects a sale of a closed shift: justified prices, same total, stock moved, history kept", () => {
  ephemeralTest("main flow: unjustified replacements refused; same-sale same-price replacement accepted; replay, stale view, F4-A after it", async () => {
    const { negocio, owner } = await crearNegocio()
    const cola = await crearProducto(negocio.id, "Gaseosa Cola", 2000, { controlStock: true, stockCantidad: 10 })
    const lima = await crearProducto(negocio.id, "Gaseosa Lima", 2000, { controlStock: true, stockCantidad: 10 })
    const yerba = await crearProducto(negocio.id, "Yerba", 5000, { controlStock: true, stockCantidad: 5 })
    const naranja = await crearProducto(negocio.id, "Gaseosa Naranja", 2100, { controlStock: true, stockCantidad: 10 }) // not in the sale, catalog ≠ charged
    const redmi = await crearProducto(negocio.id, "Redmi", 1000, { controlStock: true, stockCantidad: 10 }) // not in the sale, cheaper
    const caja = (await listarCajas(owner)).body.cajas[0]
    const ana = await crearCajero(negocio.id, "Ana")

    const turno = await abrirCajero(ana.cookie, negocio.slug, { cajaFisicaId: caja.id, fondoInicial: "1000.00" })
    expect(turno.status).toBe(201)
    const venta = await venderCajero(ana.cookie, negocio.slug, { metodoPago: "EFECTIVO", items: [{ productoId: cola.id, cantidad: 2 }, { productoId: lima.id, cantidad: 1 }, { productoId: yerba.id, cantidad: 1 }] })
    expect(venta.status).toBe(201)
    expect(venta.body.total).toBe(11000)
    expect((await cerrarCajero(ana.cookie, negocio.slug, turno.body.turno.id, "12000.00")).status).toBe(200)
    // The catalog price changes after the sale: the same-sale charged price still justifies.
    await db.producto.update({ where: { id: lima.id }, data: { precio: 2500 } })
    const turnoAntes = await db.turnoCaja.findUniqueOrThrow({ where: { id: turno.body.turno.id } })
    const ventaAntes = await db.venta.findUniqueOrThrow({ where: { id: venta.body.id }, include: { items: true, cobros: true } })
    const opsAntes = await db.operacionFinanciera.count({ where: { negocioId: negocio.id } })
    const legsAntes = await db.movimientoFinanciero.count({ where: { negocioId: negocio.id } })

    const colaItem = itemDe(venta.body, cola.id)
    const limaItem = itemDe(venta.body, lima.id)
    const yerbaItem = itemDe(venta.body, yerba.id)
    const lineas = (colaProducto: string, colaCantidad: number, limaCantidad = 1) => [
      { ventaItemId: colaItem, productoId: colaProducto, cantidad: colaCantidad },
      { ventaItemId: limaItem, productoId: lima.id, cantidad: limaCantidad },
      { ventaItemId: yerbaItem, productoId: yerba.id, cantidad: 1 },
    ]
    const swap = correccion(lineas(lima.id, 2))

    // Validation never writes.
    expect((await corregir(owner, venta.body.id, { ...swap, motivo: " " })).body.code).toBe("MOTIVO_CORRECCION_REQUERIDO")
    expect((await corregir(owner, venta.body.id, { ...swap, confirmo: false })).body.code).toBe("CONFIRMACION_CORRECCION_REQUERIDA")
    expect((await corregir(owner, venta.body.id, swap, "")).body.code).toBe("IDEMPOTENCY_KEY_REQUIRED")
    expect((await corregir(owner, venta.body.id, { ...swap, lineas: [swap.lineas[0]] })).body.code).toBe("LINEAS_CORRECCION_INVALIDAS")
    expect((await corregir(owner, venta.body.id, correccion(lineas(cola.id, 2)))).body.code).toBe("CORRECCION_SIN_CAMBIOS")
    // A quantity change that alters the charged total is refused before writing.
    const mas = await corregir(owner, venta.body.id, correccion(lineas(cola.id, 3)))
    expect(mas.status).toBe(409)
    expect(mas.body.code).toBe("TOTAL_CORRECCION_DISTINTO")

    // The reported bug: a replacement may NOT silently take another product's price.
    const redmiAlPrecioDeCola = await corregir(owner, venta.body.id, correccion(lineas(redmi.id, 2))) // same total, Redmi at $2.000
    expect(redmiAlPrecioDeCola.status).toBe(409)
    expect(redmiAlPrecioDeCola.body.code).toBe(UNJUSTIFIED)
    expect((await corregir(owner, venta.body.id, correccion(lineas(redmi.id, 4)))).body.code).toBe(UNJUSTIFIED) // 2 Saphirus → 4 Redmi: a combination, not supported
    expect((await corregir(owner, venta.body.id, correccion(lineas(naranja.id, 2)))).body.code).toBe(UNJUSTIFIED) // not in the sale and catalog $2.100 ≠ $2.000
    expect((await corregir(owner, venta.body.id, correccion(lineas(yerba.id, 2)))).body.code).toBe(UNJUSTIFIED) // in the sale, other price
    expect(await db.correccionVenta.count({ where: { ventaId: venta.body.id } })).toBe(0)
    expect(await stockDe(cola.id)).toBe(8)
    expect(await stockDe(redmi.id)).toBe(10)

    // Accepted: Cola → Lima, justified by Lima's own line in THIS sale at $2.000 (catalog now $2.500).
    const key = randomUUID()
    const res = await corregir(owner, venta.body.id, { ...swap, precio: 1, total: 1 }, key)
    expect(res.status).toBe(201)
    expect(res.body.correccion).toMatchObject({ secuencia: 1, motivo: "Se escaneó el sabor equivocado", registradaPor: "Dueño", total: 11000 })
    expect(res.body.correccion.cambios).toEqual([{ ventaItemId: colaItem, precio: 2000, criterioPrecio: "MISMA_VENTA", verificacionCatalogo: null, antes: { nombre: "Gaseosa Cola", cantidad: 2 }, despues: { nombre: "Gaseosa Lima", cantidad: 2 } }])
    expect(res.body.venta).toMatchObject({ total: 11000, corregida: true, correccionSecuencia: 1 })
    expect(res.body.venta.items.find((i: { id: string }) => i.id === colaItem)).toMatchObject({ productoId: lima.id, nombre: "Gaseosa Lima", precio: 2000, cantidad: 2, subtotal: 4000, corregida: true, precioHeredado: false })

    // Nothing original changed: sale, lines, cobro, ledger, shift closure.
    expect(await db.venta.findUniqueOrThrow({ where: { id: venta.body.id }, include: { items: true, cobros: true } })).toEqual(ventaAntes)
    expect(await db.operacionFinanciera.count({ where: { negocioId: negocio.id } })).toBe(opsAntes)
    expect(await db.movimientoFinanciero.count({ where: { negocioId: negocio.id } })).toBe(legsAntes)
    expect(await db.turnoCaja.findUniqueOrThrow({ where: { id: turno.body.turno.id } })).toEqual(turnoAntes)
    expect((await calcularSnapshotEfectivoTurno(db, negocio.id, turno.body.turno.id))!.esperado.toFixed(2)).toBe("12000.00")
    // Stock: Cola back, Lima out — one compensating movement each, linked to the correction.
    expect(await stockDe(cola.id)).toBe(10)
    expect(await stockDe(lima.id)).toBe(7)
    expect(await stockDe(yerba.id)).toBe(4)
    const movs = await db.movimientoInventario.findMany({ where: { negocioId: negocio.id, tipo: { startsWith: "CORRECCION" } }, orderBy: { tipo: "asc" } })
    expect(movs.map((m) => [m.tipo, m.productoId, m.cantidad, m.ventaId])).toEqual([
      ["CORRECCION_ENTRADA", cola.id, 2, venta.body.id],
      ["CORRECCION_SALIDA", lima.id, 2, venta.body.id],
    ])
    const fila = await db.correccionVenta.findUniqueOrThrow({ where: { id: res.body.correccion.id }, include: { lineas: true } })
    expect(movs.every((m) => m.correccionVentaId === fila.id)).toBe(true)
    expect(fila).toMatchObject({ actorTipo: "NEGOCIO", actorId: negocio.id, secuencia: 1 })
    expect(fila.totalDecimal.toFixed(2)).toBe("11000.00")
    expect(fila.lineas.find((l) => l.ventaItemId === colaItem)).toMatchObject({ antesProductoId: cola.id, antesNombre: "Gaseosa Cola", antesCantidad: 2, productoId: lima.id, nombre: "Gaseosa Lima", cantidad: 2, precio: 2000, criterioPrecio: "MISMA_VENTA" })
    expect(fila.lineas.find((l) => l.ventaItemId === yerbaItem)).toMatchObject({ criterioPrecio: "MISMO_PRODUCTO" })
    expect(await db.auditLog.count({ where: { recursoId: venta.body.id, accion: "venta.corregida" } })).toBe(1)

    // Replay / reused key / stale view.
    const replay = await corregir(owner, venta.body.id, swap, key)
    expect(replay.status).toBe(200)
    expect(replay.replayed).toBe(true)
    expect((await corregir(owner, venta.body.id, { ...swap, motivo: "Otro" }, key)).body.code).toBe("IDEMPOTENCY_KEY_REUSED")
    expect((await corregir(owner, venta.body.id, correccion(lineas(cola.id, 2), 0))).body.code).toBe("VENTA_MODIFICADA")
    expect(await db.correccionVenta.count({ where: { ventaId: venta.body.id } })).toBe(1)
    expect(await stockDe(lima.id)).toBe(7)

    // Views: the owner sees the history; the cashier sees the corrected lines but no history.
    expect((await detalleOwner(owner, venta.body.id)).body.venta.correcciones).toHaveLength(1)
    const vistaCajero = await detalleCajero(ana.cookie, negocio.slug, venta.body.id)
    expect(vistaCajero.body.venta.correcciones).toEqual([])
    expect(vistaCajero.body.venta.items.find((i: { id: string }) => i.id === colaItem).nombre).toBe("Gaseosa Lima")

    // F4-A after a correction: the return restocks Lima at the price justified for Lima ($2.000).
    const dev = await devolverCajero(ana.cookie, negocio.slug, venta.body.id, { tipo: "DEVOLUCION_PARCIAL", motivo: "No le gustó", confirmo: true, reintegro: { modo: "PENDIENTE" }, items: [{ ventaItemId: colaItem, cantidad: 1, reingresaStock: true }] })
    expect(dev.status).toBe(201)
    expect(dev.body.devolucion).toMatchObject({ importe: 2000 })
    expect(dev.body.devolucion.items[0]).toMatchObject({ nombre: "Gaseosa Lima", stockResultado: "REINGRESADO" })
    expect(await stockDe(lima.id)).toBe(8)
    expect(await stockDe(cola.id)).toBe(10)
    // Once it has returns, the sale can no longer be corrected.
    const tarde = await corregir(owner, venta.body.id, correccion(lineas(cola.id, 2), 1))
    expect(tarde.status).toBe(409)
    expect(tarde.body.code).toBe("VENTA_CON_DEVOLUCIONES")
    // F4-A cap still holds on the corrected line (1 left of 2).
    expect((await devolverCajero(ana.cookie, negocio.slug, venta.body.id, { tipo: "DEVOLUCION_PARCIAL", motivo: "m", confirmo: true, reintegro: { modo: "PENDIENTE" }, items: [{ ventaItemId: colaItem, cantidad: 2, reingresaStock: false }] })).body.code).toBe("CANTIDAD_DEVOLUCION_EXCEDIDA")

    // DB invariants: immutable history.
    expect(await fails(db.correccionVenta.update({ where: { id: fila.id }, data: { motivo: "cambiado" } }))).toBe(true)
    expect(await fails(db.correccionVentaLinea.updateMany({ where: { correccionId: fila.id }, data: { cantidad: 5 } }))).toBe(true)
  })
})

describe("F4-B — rules, permissions, stock and concurrency", () => {
  ephemeralTest("redistribution at the charged prices; variants; deleted/inactive justified products; stock limit", async () => {
    const { negocio, owner } = await crearNegocio()
    const a = await crearProducto(negocio.id, "Alfajor", 1000, { controlStock: true, stockCantidad: 10 })
    const b = await crearProducto(negocio.id, "Budín", 2000, { controlStock: true, stockCantidad: 10 })
    const venta = await venderOwner(owner, { metodoPago: "TRANSFERENCIA", items: [{ productoId: a.id, cantidad: 2 }, { productoId: b.id, cantidad: 1 }] })
    expect(venta.status).toBe(201)
    const ai = itemDe(venta.body, a.id)
    const bi = itemDe(venta.body, b.id)

    // A product of another business / a product not in the sale is never justified.
    const otro = await crearNegocio()
    const ajeno = await crearProducto(otro.negocio.id, "Ajeno", 1000)
    expect((await corregir(owner, venta.body.id, correccion([{ ventaItemId: ai, productoId: ajeno.id, cantidad: 2 }, { ventaItemId: bi, productoId: b.id, cantidad: 1 }]))).body.code).toBe("PRODUCTO_CORRECCION_INVALIDO")
    // Alfajor ($1.000) cannot be recorded on the Budín line ($2.000) and vice versa.
    expect((await corregir(owner, venta.body.id, correccion([{ ventaItemId: ai, productoId: a.id, cantidad: 2 }, { ventaItemId: bi, productoId: a.id, cantidad: 1 }]))).body.code).toBe(UNJUSTIFIED)
    // Not enough stock for a redistribution → refused, nothing written.
    await db.producto.update({ where: { id: b.id }, data: { stockCantidad: 0 } })
    const sinStock = await corregir(owner, venta.body.id, correccion([{ ventaItemId: ai, productoId: a.id, cantidad: 0 }, { ventaItemId: bi, productoId: b.id, cantidad: 2 }]))
    expect(sinStock.status).toBe(409)
    expect(sinStock.body.code).toBe("STOCK_INSUFICIENTE")
    await db.producto.update({ where: { id: b.id }, data: { stockCantidad: 9 } })
    // Redistribution: 2×A($1000) + 1×B($2000) = $4000 → 0×A + 2×B = $4000 (each at its own charged price).
    const ok = await corregir(owner, venta.body.id, correccion([{ ventaItemId: ai, productoId: a.id, cantidad: 0 }, { ventaItemId: bi, productoId: b.id, cantidad: 2 }]))
    expect(ok.status).toBe(201)
    expect(ok.body.venta.total).toBe(4000)
    expect(await stockDe(a.id)).toBe(10)
    expect(await stockDe(b.id)).toBe(8)
    expect((await db.venta.findUniqueOrThrow({ where: { id: venta.body.id } })).metodoPago).toBe("TRANSFERENCIA")
    expect(await db.cobroVenta.count({ where: { ventaId: venta.body.id } })).toBe(1)

    // Variants: two variants of the same product sold at the same price justify each other.
    const remera = await crearProducto(negocio.id, "Remera", 3000)
    const roja = await db.productoVariante.create({ data: { productoId: remera.id, nombre: "Roja", precio: 3000, controlStock: true, stockCantidad: 5 } })
    const azul = await db.productoVariante.create({ data: { productoId: remera.id, nombre: "Azul", precio: 3000, controlStock: true, stockCantidad: 5 } })
    const verde = await db.productoVariante.create({ data: { productoId: remera.id, nombre: "Verde", precio: 3500, controlStock: true, stockCantidad: 5 } })
    const v2 = await venderOwner(owner, { metodoPago: "EFECTIVO", items: [{ productoId: remera.id, varianteId: roja.id, cantidad: 1 }, { productoId: remera.id, varianteId: azul.id, cantidad: 1 }] })
    expect(v2.status).toBe(201)
    const rojaItem = v2.body.items.find((i: { productoVarianteId?: string | null }) => i.productoVarianteId === roja.id).id
    const azulItem = v2.body.items.find((i: { productoVarianteId?: string | null }) => i.productoVarianteId === azul.id).id
    // Verde was not in the sale and its catalog price ($3.500) is not the charged $3.000 → refused.
    expect((await corregir(owner, v2.body.id, correccion([{ ventaItemId: rojaItem, productoId: remera.id, varianteId: verde.id, cantidad: 1 }, { ventaItemId: azulItem, productoId: remera.id, varianteId: azul.id, cantidad: 1 }]))).body.code).toBe(UNJUSTIFIED)
    // A justified variant that was later deactivated cannot be used.
    await db.productoVariante.update({ where: { id: azul.id }, data: { activo: false } })
    expect((await corregir(owner, v2.body.id, correccion([{ ventaItemId: rojaItem, productoId: remera.id, varianteId: azul.id, cantidad: 1 }, { ventaItemId: azulItem, productoId: remera.id, varianteId: azul.id, cantidad: 1 }]))).body.code).toBe("PRODUCTO_CORRECCION_INVALIDO")
    await db.productoVariante.update({ where: { id: azul.id }, data: { activo: true } })
    const varOk = await corregir(owner, v2.body.id, correccion([{ ventaItemId: rojaItem, productoId: remera.id, varianteId: azul.id, cantidad: 1 }, { ventaItemId: azulItem, productoId: remera.id, varianteId: azul.id, cantidad: 1 }]))
    expect(varOk.status).toBe(201)
    expect(varOk.body.venta.items.find((i: { id: string }) => i.id === rojaItem)).toMatchObject({ nombre: "Remera", varianteNombre: "Azul", precio: 3000, cantidad: 1, subtotal: 3000 })
    expect((await db.productoVariante.findUniqueOrThrow({ where: { id: roja.id } })).stockCantidad).toBe(5)
    expect((await db.productoVariante.findUniqueOrThrow({ where: { id: azul.id } })).stockCantidad).toBe(3)
    expect((await db.productoVariante.findUniqueOrThrow({ where: { id: verde.id } })).stockCantidad).toBe(5)
  })

  ephemeralTest("owner only: employee session, other business, no cashier route; SQL keeps total, price and justification", async () => {
    const { negocio, owner } = await crearNegocio()
    const p = await crearProducto(negocio.id, "Libro", 7000)
    const q = await crearProducto(negocio.id, "Cuaderno", 6500)
    const cajero = await crearCajero(negocio.id)
    const venta = await venderOwner(owner, { metodoPago: "EFECTIVO", items: [{ productoId: p.id, cantidad: 1 }] })
    const item = itemDe(venta.body, p.id)
    const body = correccion([{ ventaItemId: item, productoId: q.id, cantidad: 1 }])

    expect([401, 403]).toContain((await corregir(cajero.cookie, venta.body.id, body)).status)
    expect([401, 403]).toContain((await corregir(`${cajero.cookie}; ${SESSION_COOKIE_NAME}=${randomUUID()}`, venta.body.id, { ...body, actorTipo: "NEGOCIO", negocioId: negocio.id })).status)
    const otro = await crearNegocio()
    expect((await corregir(otro.owner, venta.body.id, body)).status).toBe(404)
    expect(await db.correccionVenta.count({ where: { ventaId: venta.body.id } })).toBe(0)
    expect(Object.keys(correccionModule).sort()).toEqual(["POST"])
    expect(existsSync(join(process.cwd(), "src/app/api/operativo/caja/[slug]/ventas/[id]/correcciones"))).toBe(false)

    // SQL guards (defense in depth): wrong total, employee actor, wrong price, unjustified product.
    expect(await fails(db.correccionVenta.create({ data: { negocioId: negocio.id, ventaId: venta.body.id, secuencia: 1, motivo: "m", actorTipo: "NEGOCIO", actorId: negocio.id, totalDecimal: D("6999.99"), idempotencyKey: randomUUID(), idempotencyFingerprint: "x" } }))).toBe(true)
    expect(await fails(db.correccionVenta.create({ data: { negocioId: negocio.id, ventaId: venta.body.id, secuencia: 1, motivo: "m", actorTipo: "EMPLEADO", actorId: cajero.empleado.id, totalDecimal: D("7000"), idempotencyKey: randomUUID(), idempotencyFingerprint: "x" } }))).toBe(true)
    const conLinea = (linea: Record<string, unknown>) => db.correccionVenta.create({ data: {
      negocioId: negocio.id, ventaId: venta.body.id, secuencia: 1, motivo: "m", actorTipo: "NEGOCIO", actorId: negocio.id, totalDecimal: D("7000"), idempotencyKey: randomUUID(), idempotencyFingerprint: "x",
      lineas: { create: [{ negocioId: negocio.id, ventaId: venta.body.id, ventaItemId: item, antesNombre: "Libro", antesCantidad: 1, nombre: "Cuaderno", productoId: q.id, cantidad: 1, precio: 7000, subtotalDecimal: D("7000"), ...linea }] },
    } })
    expect(await fails(conLinea({ precio: 9000 }))).toBe(true) // not the charged price
    expect(await fails(conLinea({}))).toBe(true) // Cuaderno ($6.500 in the catalog) at Libro's $7.000: not in the sale, catalog ≠ charged
    expect(await db.correccionVenta.count({ where: { ventaId: venta.body.id } })).toBe(0)
  })

  ephemeralTest("concurrency: two corrections from the same view → one wins; correction vs return never interleave", async () => {
    const { negocio, owner } = await crearNegocio()
    const x = await crearProducto(negocio.id, "X", 1500, { controlStock: true, stockCantidad: 10 })
    const y = await crearProducto(negocio.id, "Y", 1500, { controlStock: true, stockCantidad: 10 })
    const cajero = await crearCajero(negocio.id)
    const venderXY = (cantidadX: number) => venderOwner(owner, { metodoPago: "EFECTIVO", items: [{ productoId: x.id, cantidad: cantidadX }, { productoId: y.id, cantidad: 1 }] })
    const xEnY = (venta: { items: Array<{ id: string; productoId: string | null }> }, cantidad: number, secuencia = 0, motivo?: string) =>
      correccion([{ ventaItemId: itemDe(venta, x.id), productoId: y.id, cantidad }, { ventaItemId: itemDe(venta, y.id), productoId: y.id, cantidad: 1 }], secuencia, motivo)

    const v1 = await venderXY(2)
    const race = await Promise.all([
      corregir(owner, v1.body.id, xEnY(v1.body, 2)),
      corregir(owner, v1.body.id, xEnY(v1.body, 2, 0, "Otro motivo")),
    ])
    expect(race.map((r) => r.status).sort()).toEqual([201, 409])
    expect(race.find((r) => r.status === 409)!.body.code).toBe("VENTA_MODIFICADA")
    expect(await db.correccionVenta.count({ where: { ventaId: v1.body.id } })).toBe(1)
    expect(await stockDe(x.id)).toBe(10)
    expect(await stockDe(y.id)).toBe(7)

    // Burst with the same key → a single correction.
    const v2 = await venderXY(1)
    const key = randomUUID()
    const burst = await Promise.all(Array.from({ length: 4 }, () => corregir(owner, v2.body.id, xEnY(v2.body, 1), key)))
    expect(burst.every((r) => r.status === 201 || r.status === 200)).toBe(true)
    expect(await db.correccionVenta.count({ where: { ventaId: v2.body.id } })).toBe(1)

    // Correction vs return on the same sale at the same time: either the correction
    // happened first (then the return applies to it), or the return won and the correction is refused.
    const v3 = await venderXY(2)
    const i3 = itemDe(v3.body, x.id)
    const [corr, dev] = await Promise.all([
      corregir(owner, v3.body.id, xEnY(v3.body, 2)),
      devolverCajero(cajero.cookie, negocio.slug, v3.body.id, { tipo: "DEVOLUCION_PARCIAL", motivo: "m", confirmo: true, reintegro: { modo: "PENDIENTE" }, items: [{ ventaItemId: i3, cantidad: 1, reingresaStock: true }] }),
    ])
    expect(dev.status).toBe(201)
    const corrRow = await db.correccionVenta.findFirst({ where: { ventaId: v3.body.id } })
    const devRow = await db.devolucionVenta.findFirstOrThrow({ where: { ventaId: v3.body.id } })
    if (corr.status === 201) {
      expect(corrRow!.createdAt.getTime()).toBeLessThanOrEqual(devRow.createdAt.getTime())
      expect(dev.body.devolucion.items[0].nombre).toBe("Y")
    } else {
      expect(corr.body.code).toBe("VENTA_CON_DEVOLUCIONES")
      expect(corrRow).toBeNull()
      expect(dev.body.devolucion.items[0].nombre).toBe("X")
    }
  })
})

// ---------------------------------------------------------------------------
// Catalog criterion (operator decision 2026-11-04): a product/variant NOT in the
// sale is accepted when its CURRENT catalog price equals the charged price
// exactly; the price consulted and the check time are stored as evidence (a
// coincidence at correction time — not proof of the historical price).
// ---------------------------------------------------------------------------
describe("F4-B — replacement justified by the current catalog price", () => {
  ephemeralTest("exact current price accepted with stored evidence; cheaper/costlier/deleted/inactive/foreign refused; evidence carried forward; F4-A refunds what was charged", async () => {
    const { negocio, owner } = await crearNegocio()
    const saphirus = await crearProducto(negocio.id, "Saphirus", 2000, { controlStock: true, stockCantidad: 10 })
    const lima = await crearProducto(negocio.id, "Gaseosa Lima", 2000, { controlStock: true, stockCantidad: 10 })
    const yerba = await crearProducto(negocio.id, "Yerba", 5000)
    const difusor = await crearProducto(negocio.id, "Difusor", 2000, { controlStock: true, stockCantidad: 5 }) // not in the sale
    const vela = await crearProducto(negocio.id, "Vela", 1000, { controlStock: true, stockCantidad: 5 }) // cheaper
    const caro = await crearProducto(negocio.id, "Difusor grande", 2000.01) // 1 cent more
    const viejo = await crearProducto(negocio.id, "Viejo", 2000)
    await db.producto.update({ where: { id: viejo.id }, data: { eliminado: true } })
    const aroma = await crearProducto(negocio.id, "Aroma", 9999)
    const lavanda = await db.productoVariante.create({ data: { productoId: aroma.id, nombre: "Lavanda", precio: 2000, controlStock: true, stockCantidad: 5 } })
    const coco = await db.productoVariante.create({ data: { productoId: aroma.id, nombre: "Coco", precio: 2000, activo: false } })
    const otro = await crearNegocio()
    const ajeno = await crearProducto(otro.negocio.id, "Ajeno", 2000)
    const cajero = await crearCajero(negocio.id)

    const venta = await venderOwner(owner, { metodoPago: "EFECTIVO", items: [{ productoId: saphirus.id, cantidad: 2 }, { productoId: lima.id, cantidad: 1 }, { productoId: yerba.id, cantidad: 1 }] })
    expect(venta.status).toBe(201)
    expect(venta.body.total).toBe(11000)
    const sItem = itemDe(venta.body, saphirus.id)
    const lItem = itemDe(venta.body, lima.id)
    const yItem = itemDe(venta.body, yerba.id)
    const lineas = (s: { productoId: string; varianteId?: string | null; cantidad?: number }, l: { productoId: string; varianteId?: string | null } = { productoId: lima.id }) => [
      { ventaItemId: sItem, productoId: s.productoId, varianteId: s.varianteId ?? null, cantidad: s.cantidad ?? 2 },
      { ventaItemId: lItem, productoId: l.productoId, varianteId: l.varianteId ?? null, cantidad: 1 },
      { ventaItemId: yItem, productoId: yerba.id, cantidad: 1 },
    ]

    // Refused, nothing written.
    const barata = await corregir(owner, venta.body.id, correccion(lineas({ productoId: vela.id })))
    expect(barata.status).toBe(409)
    expect(barata.body.code).toBe(UNJUSTIFIED)
    expect(barata.body.error).toContain("su precio de catálogo actual es")
    expect((await corregir(owner, venta.body.id, correccion(lineas({ productoId: vela.id, cantidad: 4 })))).body.code).toBe(UNJUSTIFIED) // 2 → 4 at $1.000: a combination (F4-C)
    expect((await corregir(owner, venta.body.id, correccion(lineas({ productoId: caro.id })))).body.code).toBe(UNJUSTIFIED) // exact equality only
    expect((await corregir(owner, venta.body.id, correccion(lineas({ productoId: yerba.id })))).body.code).toBe(UNJUSTIFIED) // in the sale at $5.000
    expect((await corregir(owner, venta.body.id, correccion(lineas({ productoId: viejo.id })))).body.code).toBe("PRODUCTO_CORRECCION_INVALIDO") // deleted
    expect((await corregir(owner, venta.body.id, correccion(lineas({ productoId: aroma.id, varianteId: coco.id })))).body.code).toBe("PRODUCTO_CORRECCION_INVALIDO") // inactive variant
    expect((await corregir(owner, venta.body.id, correccion(lineas({ productoId: aroma.id })))).body.code).toBe("PRODUCTO_CORRECCION_INVALIDO") // has variants: pick one
    expect((await corregir(owner, venta.body.id, correccion(lineas({ productoId: ajeno.id })))).body.code).toBe("PRODUCTO_CORRECCION_INVALIDO") // other business
    expect(await db.correccionVenta.count({ where: { ventaId: venta.body.id } })).toBe(0)
    expect(await stockDe(saphirus.id)).toBe(8)
    expect(await stockDe(difusor.id)).toBe(5)
    expect(await stockDe(vela.id)).toBe(5)

    // Accepted: Saphirus → Difusor (current catalog $2.000 = charged $2.000).
    const antes = Date.now()
    const key = randomUUID()
    const body1 = correccion(lineas({ productoId: difusor.id }), 0, "Se registró el aroma equivocado")
    const res = await corregir(owner, venta.body.id, body1, key)
    expect(res.status).toBe(201)
    const despues = Date.now()
    const cambio = res.body.correccion.cambios[0]
    expect(cambio).toMatchObject({ ventaItemId: sItem, precio: 2000, criterioPrecio: "PRECIO_CATALOGO_ACTUAL", verificacionCatalogo: { precio: 2000 }, antes: { nombre: "Saphirus", cantidad: 2 }, despues: { nombre: "Difusor", cantidad: 2 } })
    const consultadoEn = new Date(cambio.verificacionCatalogo.consultadoEn).getTime()
    expect(consultadoEn).toBeGreaterThanOrEqual(antes - 1000)
    expect(consultadoEn).toBeLessThanOrEqual(despues + 1000)
    expect(res.body.venta.items.find((i: { id: string }) => i.id === sItem)).toMatchObject({ nombre: "Difusor", precio: 2000, subtotal: 4000, precioHeredado: false, criterioPrecio: "PRECIO_CATALOGO_ACTUAL" })
    const fila1 = await db.correccionVentaLinea.findFirstOrThrow({ where: { correccionId: res.body.correccion.id, ventaItemId: sItem } })
    expect(fila1).toMatchObject({ productoId: difusor.id, precio: 2000, criterioPrecio: "PRECIO_CATALOGO_ACTUAL", precioCatalogoConsultado: 2000 })
    expect(fila1.precioCatalogoConsultadoEn!.getTime()).toBe(consultadoEn)
    // The other lines keep sale-based criteria and no catalog evidence.
    const otras = await db.correccionVentaLinea.findMany({ where: { correccionId: res.body.correccion.id, ventaItemId: { not: sItem } } })
    expect(otras.map((l) => [l.criterioPrecio, l.precioCatalogoConsultado, l.precioCatalogoConsultadoEn])).toEqual([["MISMO_PRODUCTO", null, null], ["MISMO_PRODUCTO", null, null]])
    // Audit keeps owner identity, reason and the evidence.
    const audit = await db.auditLog.findFirstOrThrow({ where: { recursoId: venta.body.id, accion: "venta.corregida" } })
    expect(audit.userId).toBe(negocio.id)
    expect(JSON.stringify(audit.detalle)).toContain("PRECIO_CATALOGO_ACTUAL")
    expect(JSON.stringify(audit.detalle)).toContain("Se registró el aroma equivocado")
    // Stock moved once; a replay adds nothing and returns the same evidence.
    expect(await stockDe(saphirus.id)).toBe(10)
    expect(await stockDe(difusor.id)).toBe(3)
    const replay = await corregir(owner, venta.body.id, body1, key)
    expect(replay.status).toBe(200)
    expect(replay.body.correccion.cambios[0].verificacionCatalogo).toEqual(cambio.verificacionCatalogo)
    expect(await db.movimientoInventario.count({ where: { negocioId: negocio.id, tipo: { startsWith: "CORRECCION" } } })).toBe(2)

    // The catalog price changes afterwards: the unchanged Difusor line keeps its
    // original evidence (not re-dated, not re-checked); the Lima line can still be
    // corrected — here to a variant justified by the current catalog.
    await db.producto.update({ where: { id: difusor.id }, data: { precio: 2600 } })
    const res2 = await corregir(owner, venta.body.id, correccion(lineas({ productoId: difusor.id }, { productoId: aroma.id, varianteId: lavanda.id }), 1, "Era lavanda"))
    expect(res2.status).toBe(201)
    const filas2 = await db.correccionVentaLinea.findMany({ where: { correccionId: res2.body.correccion.id } })
    const d2 = filas2.find((l) => l.ventaItemId === sItem)!
    expect([d2.criterioPrecio, d2.precioCatalogoConsultado, d2.precioCatalogoConsultadoEn!.getTime()]).toEqual(["PRECIO_CATALOGO_ACTUAL", 2000, consultadoEn])
    expect(filas2.find((l) => l.ventaItemId === lItem)).toMatchObject({ productoVarianteId: lavanda.id, criterioPrecio: "PRECIO_CATALOGO_ACTUAL", precioCatalogoConsultado: 2000 })
    expect(await stockDe(lima.id)).toBe(10)
    expect((await db.productoVariante.findUniqueOrThrow({ where: { id: lavanda.id } })).stockCantidad).toBe(4)
    // A NEW replacement on that line is checked against today's catalog: Vela ($1.000) is refused.
    expect((await corregir(owner, venta.body.id, correccion(lineas({ productoId: vela.id }, { productoId: aroma.id, varianteId: lavanda.id }), 2))).body.code).toBe(UNJUSTIFIED)
    expect(await db.correccionVenta.count({ where: { ventaId: venta.body.id } })).toBe(2)

    // F4-A after it: returning one Difusor refunds what was CHARGED ($2.000, not today's $2.600) and restocks Difusor.
    const dev = await devolverCajero(cajero.cookie, negocio.slug, venta.body.id, { tipo: "DEVOLUCION_PARCIAL", motivo: "m", confirmo: true, reintegro: { modo: "PENDIENTE" }, items: [{ ventaItemId: sItem, cantidad: 1, reingresaStock: true }] })
    expect(dev.status).toBe(201)
    expect(dev.body.devolucion).toMatchObject({ importe: 2000 })
    expect(dev.body.devolucion.items[0]).toMatchObject({ nombre: "Difusor", stockResultado: "REINGRESADO" })
    expect(await stockDe(difusor.id)).toBe(4)
    expect(await stockDe(saphirus.id)).toBe(10)

    // SQL defense in depth: a catalog-justified line whose catalog price does not match is refused by the guard.
    const v2 = await venderOwner(owner, { metodoPago: "EFECTIVO", items: [{ productoId: saphirus.id, cantidad: 1 }] })
    const v2Item = itemDe(v2.body, saphirus.id)
    const sql = (productoId: string, extra: Record<string, unknown> = {}) => db.correccionVenta.create({ data: {
      negocioId: negocio.id, ventaId: v2.body.id, secuencia: 1, motivo: "m", actorTipo: "NEGOCIO", actorId: negocio.id, totalDecimal: D("2000"), idempotencyKey: randomUUID(), idempotencyFingerprint: "x",
      lineas: { create: [{ negocioId: negocio.id, ventaId: v2.body.id, ventaItemId: v2Item, antesNombre: "Saphirus", antesCantidad: 1, nombre: "X", productoId, cantidad: 1, precio: 2000, subtotalDecimal: D("2000"), ...extra }] },
    } })
    expect(await fails(sql(difusor.id, { criterioPrecio: "PRECIO_CATALOGO_ACTUAL", precioCatalogoConsultado: 2000, precioCatalogoConsultadoEn: new Date() }))).toBe(true) // catalog now $2.600
    expect(await fails(sql(vela.id))).toBe(true)
    expect(await fails(sql(ajeno.id))).toBe(true)
    expect(await db.correccionVenta.count({ where: { ventaId: v2.body.id } })).toBe(0)
    // Matching catalog price: the guard itself records the criterion and the price it read.
    await sql(lima.id, { criterioPrecio: "MISMA_VENTA" }) // a forged criterion is overwritten
    const fila = await db.correccionVentaLinea.findFirstOrThrow({ where: { ventaId: v2.body.id } })
    expect([fila.criterioPrecio, fila.precioCatalogoConsultado]).toEqual(["PRECIO_CATALOGO_ACTUAL", 2000])
    expect(fila.precioCatalogoConsultadoEn).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Compatibility (2026-11-05): corrections recorded under the EARLIER rule (a
// replacement inherited another product's charged price) stay as immutable
// history. They are flagged; F4-A keeps refunding what was actually charged;
// a new correction must first give that line a justified product.
// ---------------------------------------------------------------------------
async function correccionReglaAnterior(params: { negocioId: string; ventaId: string; ventaItemId: string; antes: { id: string; nombre: string }; despues: { id: string; nombre: string }; precio: number; cantidad: number; total: number; otras: Array<{ ventaItemId: string; productoId: string; nombre: string; precio: number; cantidad: number }> }) {
  // Fixture: only possible with triggers bypassed for this transaction (the
  // current guard refuses such lines); mirrors rows written before 2026-11-05.
  return db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica")
    return tx.correccionVenta.create({
      data: {
        negocioId: params.negocioId, ventaId: params.ventaId, secuencia: 1, motivo: "Regla anterior", actorTipo: "NEGOCIO", actorId: params.negocioId,
        totalDecimal: D(String(params.total)), idempotencyKey: randomUUID(), idempotencyFingerprint: "legacy",
        lineas: {
          create: [
            { negocioId: params.negocioId, ventaId: params.ventaId, ventaItemId: params.ventaItemId, antesProductoId: params.antes.id, antesNombre: params.antes.nombre, antesCantidad: params.cantidad, productoId: params.despues.id, nombre: params.despues.nombre, cantidad: params.cantidad, precio: params.precio, subtotalDecimal: D(String(params.precio * params.cantidad)) },
            ...params.otras.map((o) => ({ negocioId: params.negocioId, ventaId: params.ventaId, ventaItemId: o.ventaItemId, antesProductoId: o.productoId, antesNombre: o.nombre, antesCantidad: o.cantidad, productoId: o.productoId, nombre: o.nombre, cantidad: o.cantidad, precio: o.precio, subtotalDecimal: D(String(o.precio * o.cantidad)) })),
          ],
        },
      },
    })
  })
}

describe("F4-B — compatibility with corrections recorded under the earlier inherited-price rule", () => {
  ephemeralTest("flagged in views, F4-A refunds the charged price, and the line must be justified before any new correction", async () => {
    const { negocio, owner } = await crearNegocio()
    const saphirus = await crearProducto(negocio.id, "Saphirus", 2000, { controlStock: true, stockCantidad: 10 })
    const redmi = await crearProducto(negocio.id, "Redmi", 1000, { controlStock: true, stockCantidad: 10 })
    const yerba = await crearProducto(negocio.id, "Yerba", 5000)
    const cajero = await crearCajero(negocio.id)

    // Sale A: 2 Saphirus + 1 Yerba, corrected under the earlier rule to 2 Redmi at $2.000.
    const a = await venderOwner(owner, { metodoPago: "EFECTIVO", items: [{ productoId: saphirus.id, cantidad: 2 }, { productoId: yerba.id, cantidad: 1 }] })
    const aSaph = itemDe(a.body, saphirus.id)
    const aYerba = itemDe(a.body, yerba.id)
    await correccionReglaAnterior({ negocioId: negocio.id, ventaId: a.body.id, ventaItemId: aSaph, antes: { id: saphirus.id, nombre: "Saphirus" }, despues: { id: redmi.id, nombre: "Redmi" }, precio: 2000, cantidad: 2, total: 9000, otras: [{ ventaItemId: aYerba, productoId: yerba.id, nombre: "Yerba", precio: 5000, cantidad: 1 }] })
    const vista = (await detalleOwner(owner, a.body.id)).body.venta
    expect(vista.items.find((i: { id: string }) => i.id === aSaph)).toMatchObject({ nombre: "Redmi", precio: 2000, precioHeredado: true, original: { productoId: saphirus.id, nombre: "Saphirus" } })
    expect(vista.correcciones[0].cambios[0]).toMatchObject({ criterioPrecio: null, antes: { nombre: "Saphirus" }, despues: { nombre: "Redmi" } })
    expect(await db.correccionVentaLinea.count({ where: { ventaId: a.body.id, criterioPrecio: null } })).toBe(2) // history untouched

    // Any new correction must first give that line a justified product.
    const mantiene = await corregir(owner, a.body.id, correccion([{ ventaItemId: aSaph, productoId: redmi.id, cantidad: 2 }, { ventaItemId: aYerba, productoId: yerba.id, cantidad: 1 }], 1, "Otro ajuste"))
    expect(mantiene.status).toBe(409)
    expect(mantiene.body.code).toBe(UNJUSTIFIED)
    expect(mantiene.body.error).toContain("por la regla anterior")
    expect(await db.correccionVenta.count({ where: { ventaId: a.body.id } })).toBe(1)
    // Reverting it to the original product is justified (stock moves back: +2 Redmi, −2 Saphirus).
    const saphAntes = await stockDe(saphirus.id)
    const redmiAntes = await stockDe(redmi.id)
    const revertir = await corregir(owner, a.body.id, correccion([{ ventaItemId: aSaph, productoId: saphirus.id, cantidad: 2 }, { ventaItemId: aYerba, productoId: yerba.id, cantidad: 1 }], 1, "Precio heredado de la regla anterior"))
    expect(revertir.status).toBe(201)
    expect(revertir.body.venta.items.find((i: { id: string }) => i.id === aSaph)).toMatchObject({ nombre: "Saphirus", precioHeredado: false })
    expect(await stockDe(saphirus.id)).toBe(saphAntes - 2)
    expect(await stockDe(redmi.id)).toBe(redmiAntes + 2)

    // Sale B: same earlier-rule correction, then an F4-A return — still refunds what was charged ($2.000).
    const b = await venderOwner(owner, { metodoPago: "EFECTIVO", items: [{ productoId: saphirus.id, cantidad: 2 }] })
    const bSaph = itemDe(b.body, saphirus.id)
    await correccionReglaAnterior({ negocioId: negocio.id, ventaId: b.body.id, ventaItemId: bSaph, antes: { id: saphirus.id, nombre: "Saphirus" }, despues: { id: redmi.id, nombre: "Redmi" }, precio: 2000, cantidad: 2, total: 4000, otras: [] })
    const dev = await devolverCajero(cajero.cookie, negocio.slug, b.body.id, { tipo: "DEVOLUCION_PARCIAL", motivo: "m", confirmo: true, reintegro: { modo: "PENDIENTE" }, items: [{ ventaItemId: bSaph, cantidad: 1, reingresaStock: false }] })
    expect(dev.status).toBe(201)
    expect(dev.body.devolucion).toMatchObject({ importe: 2000 })
    expect(dev.body.venta.items.find((i: { id: string }) => i.id === bSaph)).toMatchObject({ precioHeredado: true })
  })
})

// ---------------------------------------------------------------------------
// P2-A (review 2026-10-28) — the owner's daily list carries the CURRENT lines of
// corrected sales; the sale objects stay the original records.
// ---------------------------------------------------------------------------
describe("F4-B P2-A — owner recent sales expose current lines of corrected sales", () => {
  ephemeralTest("GET /api/negocio/caja/ventas: correccionesPorVenta only for corrected sales; totals and sale rows unchanged", async () => {
    const { negocio, owner } = await crearNegocio()
    const cola = await crearProducto(negocio.id, "Gaseosa Cola", 2000)
    const lima = await crearProducto(negocio.id, "Gaseosa Lima", 2000)
    const yerba = await crearProducto(negocio.id, "Yerba", 5000)
    const corregida = await venderOwner(owner, { metodoPago: "EFECTIVO", items: [{ productoId: cola.id, cantidad: 2 }, { productoId: lima.id, cantidad: 1 }, { productoId: yerba.id, cantidad: 1 }] })
    const intacta = await venderOwner(owner, { metodoPago: "EFECTIVO", items: [{ productoId: yerba.id, cantidad: 1 }] })
    const antes = await json(await getVentasHoy(req("/api/negocio/caja/ventas", owner)))
    expect(antes.body.correccionesPorVenta).toEqual({})

    const res = await corregir(owner, corregida.body.id, correccion([
      { ventaItemId: itemDe(corregida.body, cola.id), productoId: lima.id, cantidad: 2 },
      { ventaItemId: itemDe(corregida.body, lima.id), productoId: lima.id, cantidad: 1 },
      { ventaItemId: itemDe(corregida.body, yerba.id), productoId: yerba.id, cantidad: 1 },
    ]))
    expect(res.status).toBe(201)

    const despues = await json(await getVentasHoy(req("/api/negocio/caja/ventas", owner)))
    expect(despues.status).toBe(200)
    expect(Object.keys(despues.body.correccionesPorVenta)).toEqual([corregida.body.id])
    const items = despues.body.correccionesPorVenta[corregida.body.id].items as Array<{ id: string; nombre: string; precio: number; cantidad: number; subtotal: number }>
    expect(despues.body.correccionesPorVenta[corregida.body.id].secuencia).toBe(1)
    expect(items.find((i) => i.id === itemDe(corregida.body, cola.id))).toMatchObject({ nombre: "Gaseosa Lima", precio: 2000, cantidad: 2, subtotal: 4000 })
    expect(items.find((i) => i.id === itemDe(corregida.body, yerba.id))).toMatchObject({ nombre: "Yerba", precio: 5000, cantidad: 1, subtotal: 5000 })
    // The sale records themselves (and the daily totals) are unchanged.
    expect(despues.body.ventasHoy).toEqual(antes.body.ventasHoy)
    expect(despues.body.resumenHoy).toEqual(antes.body.resumenHoy)
    expect(despues.body.ventasHoy.find((v: { id: string }) => v.id === corregida.body.id).items.map((i: { nombre: string }) => i.nombre).sort()).toEqual(["Gaseosa Cola", "Gaseosa Lima", "Yerba"])
    expect(despues.body.correccionesPorVenta[intacta.body.id]).toBeUndefined()
    // Another business never sees it.
    const otro = await crearNegocio()
    expect((await json(await getVentasHoy(req("/api/negocio/caja/ventas", otro.owner)))).body.correccionesPorVenta).toEqual({})
  })
})

// ---------------------------------------------------------------------------
// P2-B (review 2026-10-28) — corrections against ACTIVE order reservations.
// Reservations are created with the existing authorities: availability read by
// leerDisponibilidadStock and the ACTIVA row written by reservarStockPedido in a
// Serializable transaction (runStockSerializable) — no parallel implementation,
// and the platform reservation mode is not switched (other suites share the DB).
// Under the 2026-11-05 price rule the replacement is always a product of the sale.
// ---------------------------------------------------------------------------
class ReservaRechazada extends Error {}

async function reservar(negocio: { id: string; slug: string }, productoId: string, productoVarianteId: string | null, cantidad: number) {
  const pedido = await db.pedido.create({
    data: { negocioId: negocio.id, negocioSlug: negocio.slug, negocioNombre: "N", clienteNombre: "C", metodoEntrega: "retiro", estado: "recibido", total: 100, totalProductos: 100, idempotencyKey: `test-f4b-${randomUUID()}` },
  })
  const item = await db.pedidoItem.create({ data: { pedidoId: pedido.id, productoId, productoVarianteId, nombre: "R", precio: 100, cantidad } })
  // Like a real order creator: Serializable, re-run on serialization conflicts.
  for (let attempt = 1; ; attempt++) {
    try {
      const count = await runStockSerializable(db, async (tx) => {
        const key = { productoId, productoVarianteId }
        const disponibilidad = await leerDisponibilidadStock(tx, { negocioId: negocio.id, key })
        if (!disponibilidad || cantidad > disponibilidad.available) throw new ReservaRechazada("sin disponible")
        return reservarStockPedido(tx, {
          negocioId: negocio.id,
          pedidoId: pedido.id,
          lines: [{ pedidoItemId: item.id, productoId, productoVarianteId, cantidad, controlStock: true }],
          plan: { reservar: true, mode: "ON", reservedKeys: new Set([stockKey(productoId, productoVarianteId)]) },
        })
      })
      return { count, pedidoId: pedido.id }
    } catch (error) {
      if (!isStockSerializationConflict(error) || attempt >= 8) throw error
    }
  }
}

async function liberar(negocioId: string, pedidoId: string) {
  return db.$transaction((tx) => liberarReservasPedido(tx, { negocioId, pedidoId, motivo: "CANCELADO_VENDEDOR" }))
}

async function reservasActivas(negocioId: string, productoId: string, productoVarianteId: string | null = null) {
  const rows = await db.reservaStock.findMany({ where: { negocioId, productoId, productoVarianteId, estado: "ACTIVA" }, select: { cantidad: true } })
  return rows.reduce((acc, r) => acc + r.cantidad, 0)
}

describe("F4-B P2-B — corrections respect active order reservations", () => {
  ephemeralTest("product: exceeding (physical − reserved) is refused and writes nothing; within it, exact compensating movements once", async () => {
    const { negocio, owner } = await crearNegocio()
    const cola = await crearProducto(negocio.id, "Gaseosa Cola", 2000, { controlStock: true, stockCantidad: 10 })
    const lima = await crearProducto(negocio.id, "Gaseosa Lima", 2000, { controlStock: true, stockCantidad: 6 })
    const venta = await venderOwner(owner, { metodoPago: "EFECTIVO", items: [{ productoId: cola.id, cantidad: 2 }, { productoId: lima.id, cantidad: 1 }] })
    expect(venta.status).toBe(201)
    const item = itemDe(venta.body, cola.id)
    const limaItem = itemDe(venta.body, lima.id)
    expect((await reservar(negocio, lima.id, null, 4)).count).toBe(1) // physical 5, reserved 4 → available 1

    const ventaAntes = await db.venta.findUniqueOrThrow({ where: { id: venta.body.id }, include: { items: true, cobros: true } })
    const rechazo = await corregir(owner, venta.body.id, correccion([{ ventaItemId: item, productoId: lima.id, cantidad: 2 }, { ventaItemId: limaItem, productoId: lima.id, cantidad: 1 }]))
    expect(rechazo.status).toBe(409)
    expect(rechazo.body.code).toBe("STOCK_INSUFICIENTE")
    expect(rechazo.body.error).toContain("reservadas para pedidos")
    expect(await db.correccionVenta.count({ where: { ventaId: venta.body.id } })).toBe(0)
    expect(await db.venta.findUniqueOrThrow({ where: { id: venta.body.id }, include: { items: true, cobros: true } })).toEqual(ventaAntes)
    expect(await stockDe(lima.id)).toBe(5)
    expect(await stockDe(cola.id)).toBe(8)
    expect(await reservasActivas(negocio.id, lima.id)).toBe(4)
    expect(await db.movimientoInventario.count({ where: { negocioId: negocio.id, tipo: { startsWith: "CORRECCION" } } })).toBe(0)

    // Second sale whose same-price product has enough available stock next to its reservation.
    const naranja = await crearProducto(negocio.id, "Gaseosa Naranja", 2000, { controlStock: true, stockCantidad: 6 })
    const venta2 = await venderOwner(owner, { metodoPago: "EFECTIVO", items: [{ productoId: cola.id, cantidad: 2 }, { productoId: naranja.id, cantidad: 1 }] })
    expect(venta2.status).toBe(201)
    const item2 = itemDe(venta2.body, cola.id)
    const naranjaItem = itemDe(venta2.body, naranja.id)
    expect((await reservar(negocio, naranja.id, null, 3)).count).toBe(1) // physical 5, reserved 3 → available 2
    const body2 = correccion([{ ventaItemId: item2, productoId: naranja.id, cantidad: 2 }, { ventaItemId: naranjaItem, productoId: naranja.id, cantidad: 1 }])
    const key = randomUUID()
    const ok = await corregir(owner, venta2.body.id, body2, key)
    expect(ok.status).toBe(201)
    expect(await stockDe(naranja.id)).toBe(3)
    expect(await stockDe(cola.id)).toBe(8)
    expect(await reservasActivas(negocio.id, naranja.id)).toBe(3) // reservation untouched
    expect(await reservasActivas(negocio.id, lima.id)).toBe(4)
    const movs = await db.movimientoInventario.findMany({ where: { negocioId: negocio.id, tipo: { startsWith: "CORRECCION" } }, orderBy: { tipo: "asc" } })
    expect(movs.map((m) => [m.tipo, m.productoId, m.cantidad, m.stockAntes, m.stockDespues])).toEqual([
      ["CORRECCION_ENTRADA", cola.id, 2, 6, 8],
      ["CORRECCION_SALIDA", naranja.id, 2, 5, 3],
    ])
    // Retries never duplicate the movements.
    const replay = await corregir(owner, venta2.body.id, body2, key)
    expect(replay.status).toBe(200)
    expect(await db.movimientoInventario.count({ where: { negocioId: negocio.id, tipo: { startsWith: "CORRECCION" } } })).toBe(2)
    expect(await stockDe(naranja.id)).toBe(3)
  })

  ephemeralTest("variant with stock control: same rules against the variant's reservations", async () => {
    const { negocio, owner } = await crearNegocio()
    const remera = await crearProducto(negocio.id, "Remera", 3000)
    const azul = await db.productoVariante.create({ data: { productoId: remera.id, nombre: "Azul", precio: 3000, controlStock: true, stockCantidad: 10 } })
    const roja = await db.productoVariante.create({ data: { productoId: remera.id, nombre: "Roja", precio: 3000, controlStock: true, stockCantidad: 5 } })
    const venta = await venderOwner(owner, { metodoPago: "EFECTIVO", items: [{ productoId: remera.id, varianteId: azul.id, cantidad: 2 }, { productoId: remera.id, varianteId: roja.id, cantidad: 1 }] })
    expect(venta.status).toBe(201)
    const azulItem = venta.body.items.find((i: { productoVarianteId?: string | null }) => i.productoVarianteId === azul.id).id
    const rojaItem = venta.body.items.find((i: { productoVarianteId?: string | null }) => i.productoVarianteId === roja.id).id
    const body = correccion([{ ventaItemId: azulItem, productoId: remera.id, varianteId: roja.id, cantidad: 2 }, { ventaItemId: rojaItem, productoId: remera.id, varianteId: roja.id, cantidad: 1 }])
    const primera = await reservar(negocio, remera.id, roja.id, 3) // variant: physical 4, reserved 3 → available 1
    expect(primera.count).toBe(1)

    const rechazo = await corregir(owner, venta.body.id, body)
    expect(rechazo.status).toBe(409)
    expect(rechazo.body.code).toBe("STOCK_INSUFICIENTE")
    expect((await db.productoVariante.findUniqueOrThrow({ where: { id: roja.id } })).stockCantidad).toBe(4)
    expect(await reservasActivas(negocio.id, remera.id, roja.id)).toBe(3)
    expect(await db.correccionVenta.count({ where: { ventaId: venta.body.id } })).toBe(0)

    // The order is cancelled (existing release authority) and a smaller one reserves 2 → available 2.
    expect(await liberar(negocio.id, primera.pedidoId)).toBe(1)
    expect((await reservar(negocio, remera.id, roja.id, 2)).count).toBe(1) // physical 4, reserved 2 → available 2
    const ok = await corregir(owner, venta.body.id, body)
    expect(ok.status).toBe(201)
    expect((await db.productoVariante.findUniqueOrThrow({ where: { id: roja.id } })).stockCantidad).toBe(2)
    expect((await db.productoVariante.findUniqueOrThrow({ where: { id: azul.id } })).stockCantidad).toBe(10)
    expect(await reservasActivas(negocio.id, remera.id, roja.id)).toBe(2)
    const movs = await db.movimientoInventario.findMany({ where: { negocioId: negocio.id, tipo: { startsWith: "CORRECCION" } }, orderBy: { tipo: "asc" } })
    expect(movs.map((m) => [m.tipo, m.productoId, m.productoVarianteId, m.cantidad])).toEqual([
      ["CORRECCION_ENTRADA", remera.id, azul.id, 2],
      ["CORRECCION_SALIDA", remera.id, roja.id, 2],
    ])
  })

  ephemeralTest("a correction and a reservation racing for the same units never commit both", async () => {
    const { negocio, owner } = await crearNegocio()
    const cola = await crearProducto(negocio.id, "Gaseosa Cola", 2000, { controlStock: true, stockCantidad: 10 })
    const lima = await crearProducto(negocio.id, "Gaseosa Lima", 2000, { controlStock: true, stockCantidad: 3 })
    let pedidoAnterior: string | null = null
    for (let ronda = 0; ronda < 3; ronda++) {
      // Reset between rounds: cancel the previous round's order (if it reserved) and
      // restore 3 units; the sale takes 1, leaving 2 to fight over.
      if (pedidoAnterior) await liberar(negocio.id, pedidoAnterior)
      pedidoAnterior = null
      await db.producto.update({ where: { id: lima.id }, data: { stockCantidad: 3 } })
      await db.producto.update({ where: { id: cola.id }, data: { stockCantidad: 10 } })
      const venta = await venderOwner(owner, { metodoPago: "EFECTIVO", items: [{ productoId: cola.id, cantidad: 2 }, { productoId: lima.id, cantidad: 1 }] })
      expect(venta.status).toBe(201)
      const item = itemDe(venta.body, cola.id)
      const limaItem = itemDe(venta.body, lima.id)
      const [corr, reserva] = await Promise.all([
        corregir(owner, venta.body.id, correccion([{ ventaItemId: item, productoId: lima.id, cantidad: 2 }, { ventaItemId: limaItem, productoId: lima.id, cantidad: 1 }])),
        reservar(negocio, lima.id, null, 2).then((r) => { pedidoAnterior = r.pedidoId; return "ok" as const }, (error) => (error instanceof ReservaRechazada ? "rechazada" as const : Promise.reject(error))),
      ])
      const fisico = await stockDe(lima.id)
      const reservado = await reservasActivas(negocio.id, lima.id)
      // Never both: the two units are either moved by the correction or reserved for the order.
      expect([corr.status === 201, reserva === "ok"].filter(Boolean)).toHaveLength(1)
      expect(fisico - reservado).toBeGreaterThanOrEqual(0)
      if (corr.status === 201) {
        expect([fisico, reservado]).toEqual([0, 0])
      } else {
        expect(corr.body.code).toBe("STOCK_INSUFICIENTE")
        expect([fisico, reservado]).toEqual([2, 2])
      }
    }
  })
})
