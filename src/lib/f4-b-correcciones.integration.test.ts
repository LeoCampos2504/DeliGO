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

describe("F4-B — owner corrects a sale of a closed shift: same total, stock moved, history kept", () => {
  ephemeralTest("main flow, replay, stale view, then F4-A returns follow the corrected product", async () => {
    const { negocio, owner } = await crearNegocio()
    const cola = await crearProducto(negocio.id, "Gaseosa Cola", 2000, { controlStock: true, stockCantidad: 10 })
    const lima = await crearProducto(negocio.id, "Gaseosa Lima", 2200, { controlStock: true, stockCantidad: 10 })
    const yerba = await crearProducto(negocio.id, "Yerba", 5000, { controlStock: true, stockCantidad: 5 })
    const caja = (await listarCajas(owner)).body.cajas[0]
    const ana = await crearCajero(negocio.id, "Ana")

    const turno = await abrirCajero(ana.cookie, negocio.slug, { cajaFisicaId: caja.id, fondoInicial: "1000.00" })
    expect(turno.status).toBe(201)
    const venta = await venderCajero(ana.cookie, negocio.slug, { metodoPago: "EFECTIVO", items: [{ productoId: cola.id, cantidad: 2 }, { productoId: yerba.id, cantidad: 1 }] })
    expect(venta.status).toBe(201)
    expect(venta.body.total).toBe(9000)
    expect((await cerrarCajero(ana.cookie, negocio.slug, turno.body.turno.id, "10000.00")).status).toBe(200)
    // An old sale: corrections are allowed days later.
    await db.venta.update({ where: { id: venta.body.id }, data: { createdAt: new Date(Date.now() - 10 * 86_400_000) } })
    const turnoAntes = await db.turnoCaja.findUniqueOrThrow({ where: { id: turno.body.turno.id } })
    const ventaAntes = await db.venta.findUniqueOrThrow({ where: { id: venta.body.id }, include: { items: true, cobros: true } })
    const opsAntes = await db.operacionFinanciera.count({ where: { negocioId: negocio.id } })
    const legsAntes = await db.movimientoFinanciero.count({ where: { negocioId: negocio.id } })

    const colaItem = itemDe(venta.body, cola.id)
    const yerbaItem = itemDe(venta.body, yerba.id)
    const swap = correccion([{ ventaItemId: colaItem, productoId: lima.id, cantidad: 2 }, { ventaItemId: yerbaItem, productoId: yerba.id, cantidad: 1 }])

    // Validation never writes.
    expect((await corregir(owner, venta.body.id, { ...swap, motivo: " " })).body.code).toBe("MOTIVO_CORRECCION_REQUERIDO")
    expect((await corregir(owner, venta.body.id, { ...swap, confirmo: false })).body.code).toBe("CONFIRMACION_CORRECCION_REQUERIDA")
    expect((await corregir(owner, venta.body.id, swap, "")).body.code).toBe("IDEMPOTENCY_KEY_REQUIRED")
    expect((await corregir(owner, venta.body.id, { ...swap, lineas: [swap.lineas[0]] })).body.code).toBe("LINEAS_CORRECCION_INVALIDAS")
    expect((await corregir(owner, venta.body.id, correccion([{ ventaItemId: colaItem, productoId: cola.id, cantidad: 2 }, { ventaItemId: yerbaItem, productoId: yerba.id, cantidad: 1 }]))).body.code).toBe("CORRECCION_SIN_CAMBIOS")
    // A quantity change that alters the charged total is refused before writing.
    const mas = await corregir(owner, venta.body.id, correccion([{ ventaItemId: colaItem, productoId: cola.id, cantidad: 3 }, { ventaItemId: yerbaItem, productoId: yerba.id, cantidad: 1 }]))
    expect(mas.status).toBe(409)
    expect(mas.body.code).toBe("TOTAL_CORRECCION_DISTINTO")
    expect(await db.correccionVenta.count({ where: { ventaId: venta.body.id } })).toBe(0)
    expect(await stockDe(cola.id)).toBe(8)

    // The correction: Cola → Lima at the price actually charged ($2.000, not Lima's $2.200).
    const key = randomUUID()
    const res = await corregir(owner, venta.body.id, { ...swap, precio: 1, total: 1 }, key)
    expect(res.status).toBe(201)
    expect(res.body.correccion).toMatchObject({ secuencia: 1, motivo: "Se escaneó el sabor equivocado", registradaPor: "Dueño", total: 9000 })
    expect(res.body.correccion.cambios).toEqual([{ ventaItemId: colaItem, precio: 2000, antes: { nombre: "Gaseosa Cola", cantidad: 2 }, despues: { nombre: "Gaseosa Lima", cantidad: 2 } }])
    expect(res.body.venta).toMatchObject({ total: 9000, corregida: true, correccionSecuencia: 1 })
    expect(res.body.venta.items.find((i: { id: string }) => i.id === colaItem)).toMatchObject({ productoId: lima.id, nombre: "Gaseosa Lima", precio: 2000, cantidad: 2, subtotal: 4000, corregida: true })

    // Nothing original changed: sale, lines, cobro, ledger, shift closure.
    const ventaDespues = await db.venta.findUniqueOrThrow({ where: { id: venta.body.id }, include: { items: true, cobros: true } })
    expect(ventaDespues).toEqual(ventaAntes)
    expect(await db.operacionFinanciera.count({ where: { negocioId: negocio.id } })).toBe(opsAntes)
    expect(await db.movimientoFinanciero.count({ where: { negocioId: negocio.id } })).toBe(legsAntes)
    expect(await db.turnoCaja.findUniqueOrThrow({ where: { id: turno.body.turno.id } })).toEqual(turnoAntes)
    expect((await calcularSnapshotEfectivoTurno(db, negocio.id, turno.body.turno.id))!.esperado.toFixed(2)).toBe("10000.00")
    // Stock: Cola back, Lima out — one compensating movement each, linked to the correction.
    expect(await stockDe(cola.id)).toBe(10)
    expect(await stockDe(lima.id)).toBe(8)
    expect(await stockDe(yerba.id)).toBe(4)
    const movs = await db.movimientoInventario.findMany({ where: { negocioId: negocio.id, tipo: { startsWith: "CORRECCION" } }, orderBy: { tipo: "asc" } })
    expect(movs.map((m) => [m.tipo, m.productoId, m.cantidad, m.ventaId])).toEqual([
      ["CORRECCION_ENTRADA", cola.id, 2, venta.body.id],
      ["CORRECCION_SALIDA", lima.id, 2, venta.body.id],
    ])
    const fila = await db.correccionVenta.findUniqueOrThrow({ where: { id: res.body.correccion.id }, include: { lineas: true } })
    expect(movs.every((m) => m.correccionVentaId === fila.id)).toBe(true)
    expect(fila).toMatchObject({ actorTipo: "NEGOCIO", actorId: negocio.id, secuencia: 1 })
    expect(fila.totalDecimal.toFixed(2)).toBe("9000.00")
    expect(fila.lineas.find((l) => l.ventaItemId === colaItem)).toMatchObject({ antesProductoId: cola.id, antesNombre: "Gaseosa Cola", antesCantidad: 2, productoId: lima.id, nombre: "Gaseosa Lima", cantidad: 2, precio: 2000 })
    expect(await db.auditLog.count({ where: { recursoId: venta.body.id, accion: "venta.corregida" } })).toBe(1)

    // Replay / reused key / stale view.
    const replay = await corregir(owner, venta.body.id, swap, key)
    expect(replay.status).toBe(200)
    expect(replay.replayed).toBe(true)
    expect((await corregir(owner, venta.body.id, { ...swap, motivo: "Otro" }, key)).body.code).toBe("IDEMPOTENCY_KEY_REUSED")
    expect((await corregir(owner, venta.body.id, correccion([{ ventaItemId: colaItem, productoId: cola.id, cantidad: 2 }, { ventaItemId: yerbaItem, productoId: yerba.id, cantidad: 1 }], 0))).body.code).toBe("VENTA_MODIFICADA")
    expect(await db.correccionVenta.count({ where: { ventaId: venta.body.id } })).toBe(1)
    expect(await stockDe(lima.id)).toBe(8)

    // Views: the owner sees the history; the cashier sees the corrected lines but no history.
    expect((await detalleOwner(owner, venta.body.id)).body.venta.correcciones).toHaveLength(1)
    const vistaCajero = await detalleCajero(ana.cookie, negocio.slug, venta.body.id)
    expect(vistaCajero.body.venta.correcciones).toEqual([])
    expect(vistaCajero.body.venta.items.find((i: { id: string }) => i.id === colaItem).nombre).toBe("Gaseosa Lima")

    // F4-A after a correction: the return restocks Lima (the product that left), at the charged price.
    const dev = await devolverCajero(ana.cookie, negocio.slug, venta.body.id, { tipo: "DEVOLUCION_PARCIAL", motivo: "No le gustó", confirmo: true, reintegro: { modo: "PENDIENTE" }, items: [{ ventaItemId: colaItem, cantidad: 1, reingresaStock: true }] })
    expect(dev.status).toBe(201)
    expect(dev.body.devolucion).toMatchObject({ importe: 2000 })
    expect(dev.body.devolucion.items[0]).toMatchObject({ nombre: "Gaseosa Lima", stockResultado: "REINGRESADO" })
    expect(await stockDe(lima.id)).toBe(9)
    expect(await stockDe(cola.id)).toBe(10)
    // Once it has returns, the sale can no longer be corrected.
    const tarde = await corregir(owner, venta.body.id, correccion([{ ventaItemId: colaItem, productoId: cola.id, cantidad: 2 }, { ventaItemId: yerbaItem, productoId: yerba.id, cantidad: 1 }], 1))
    expect(tarde.status).toBe(409)
    expect(tarde.body.code).toBe("VENTA_CON_DEVOLUCIONES")
    // F4-A cap still holds on the corrected line (1 left of 2).
    expect((await devolverCajero(ana.cookie, negocio.slug, venta.body.id, { tipo: "DEVOLUCION_PARCIAL", motivo: "m", confirmo: true, reintegro: { modo: "PENDIENTE" }, items: [{ ventaItemId: colaItem, cantidad: 2, reingresaStock: false }] })).body.code).toBe("CANTIDAD_DEVOLUCION_EXCEDIDA")

    // DB invariants: immutable history, exact total and charged price.
    expect(await fails(db.correccionVenta.update({ where: { id: fila.id }, data: { motivo: "cambiado" } }))).toBe(true)
    expect(await fails(db.correccionVentaLinea.updateMany({ where: { correccionId: fila.id }, data: { cantidad: 5 } }))).toBe(true)
  })
})

describe("F4-B — rules, permissions, stock and concurrency", () => {
  ephemeralTest("redistribution with the charged prices; variants; invalid products; stock limit", async () => {
    const { negocio, owner } = await crearNegocio()
    const a = await crearProducto(negocio.id, "Alfajor", 1000, { controlStock: true, stockCantidad: 10 })
    const b = await crearProducto(negocio.id, "Budín", 2000, { controlStock: true, stockCantidad: 10 })
    const conVariantes = await crearProducto(negocio.id, "Remera", 3000)
    const roja = await db.productoVariante.create({ data: { productoId: conVariantes.id, nombre: "Roja", precio: 9999, controlStock: true, stockCantidad: 1 } })
    const azul = await db.productoVariante.create({ data: { productoId: conVariantes.id, nombre: "Azul", precio: 3000, activo: false } })
    const escaso = await crearProducto(negocio.id, "Escaso", 500, { controlStock: true, stockCantidad: 1 })
    const venta = await venderOwner(owner, { metodoPago: "TRANSFERENCIA", items: [{ productoId: a.id, cantidad: 2 }, { productoId: b.id, cantidad: 1 }] })
    expect(venta.status).toBe(201)
    const ai = itemDe(venta.body, a.id)
    const bi = itemDe(venta.body, b.id)

    // Product of another business / inactive or missing variant / variant on a product without variants.
    const otro = await crearNegocio()
    const ajeno = await crearProducto(otro.negocio.id, "Ajeno", 1000)
    expect((await corregir(owner, venta.body.id, correccion([{ ventaItemId: ai, productoId: ajeno.id, cantidad: 2 }, { ventaItemId: bi, productoId: b.id, cantidad: 1 }]))).body.code).toBe("PRODUCTO_CORRECCION_INVALIDO")
    expect((await corregir(owner, venta.body.id, correccion([{ ventaItemId: ai, productoId: conVariantes.id, varianteId: azul.id, cantidad: 2 }, { ventaItemId: bi, productoId: b.id, cantidad: 1 }]))).body.code).toBe("PRODUCTO_CORRECCION_INVALIDO")
    expect((await corregir(owner, venta.body.id, correccion([{ ventaItemId: ai, productoId: conVariantes.id, cantidad: 2 }, { ventaItemId: bi, productoId: b.id, cantidad: 1 }]))).body.code).toBe("PRODUCTO_CORRECCION_INVALIDO")
    expect((await corregir(owner, venta.body.id, correccion([{ ventaItemId: ai, productoId: a.id, varianteId: roja.id, cantidad: 2 }, { ventaItemId: bi, productoId: b.id, cantidad: 1 }]))).body.code).toBe("PRODUCTO_CORRECCION_INVALIDO")
    // Not enough stock of the replacement → refused, nothing written.
    const sinStock = await corregir(owner, venta.body.id, correccion([{ ventaItemId: ai, productoId: escaso.id, cantidad: 2 }, { ventaItemId: bi, productoId: b.id, cantidad: 1 }]))
    expect(sinStock.status).toBe(409)
    expect(sinStock.body.code).toBe("STOCK_INSUFICIENTE")
    // Variant: 1 unit of a variant in stock, price $9.999 in the catalog → the line keeps $1.000 charged.
    // Redistribution: 2×A($1000) + 1×B($2000) = $4000 → 0×A + 2×B = $4000 (charged prices).
    const ok = await corregir(owner, venta.body.id, correccion([{ ventaItemId: ai, productoId: a.id, cantidad: 0 }, { ventaItemId: bi, productoId: b.id, cantidad: 2 }]))
    expect(ok.status).toBe(201)
    expect(ok.body.venta.total).toBe(4000)
    expect(await stockDe(a.id)).toBe(10)
    expect(await stockDe(b.id)).toBe(8)
    expect(await db.correccionVenta.count({ where: { ventaId: venta.body.id } })).toBe(1)
    // A second correction builds on the first (sequence 1 → 2), swapping B for the red variant is not
    // possible at $2.000 × 2 with only 1 in stock; one unit each keeps $4.000? no: 1×B + 1×Roja($2000 charged) = $4000.
    const variante = await corregir(owner, venta.body.id, correccion([{ ventaItemId: ai, productoId: a.id, cantidad: 0 }, { ventaItemId: bi, productoId: conVariantes.id, varianteId: roja.id, cantidad: 2 }], 1))
    expect(variante.body.code).toBe("STOCK_INSUFICIENTE")
    expect(await db.productoVariante.findUniqueOrThrow({ where: { id: roja.id } }).then((v) => v.stockCantidad)).toBe(1)
    const b2 = await corregir(owner, venta.body.id, correccion([{ ventaItemId: ai, productoId: a.id, cantidad: 2 }, { ventaItemId: bi, productoId: conVariantes.id, varianteId: roja.id, cantidad: 1 }], 1))
    expect(b2.status).toBe(201)
    expect(b2.body.venta.items.find((i: { id: string }) => i.id === bi)).toMatchObject({ nombre: "Remera", varianteNombre: "Roja", precio: 2000, cantidad: 1, subtotal: 2000 })
    expect(await db.productoVariante.findUniqueOrThrow({ where: { id: roja.id } }).then((v) => v.stockCantidad)).toBe(0)
    expect(await stockDe(b.id)).toBe(10)
    expect(await stockDe(a.id)).toBe(8)
    // The payment method and cobro never change.
    expect((await db.venta.findUniqueOrThrow({ where: { id: venta.body.id } })).metodoPago).toBe("TRANSFERENCIA")
    expect(await db.cobroVenta.count({ where: { ventaId: venta.body.id } })).toBe(1)
  })

  ephemeralTest("owner only: employee session, other business, no cashier route; SQL keeps total and price", async () => {
    const { negocio, owner } = await crearNegocio()
    const p = await crearProducto(negocio.id, "Libro", 7000)
    const q = await crearProducto(negocio.id, "Cuaderno", 9000)
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

    // SQL guards (defense in depth): wrong total, employee actor, wrong price.
    expect(await fails(db.correccionVenta.create({ data: { negocioId: negocio.id, ventaId: venta.body.id, secuencia: 1, motivo: "m", actorTipo: "NEGOCIO", actorId: negocio.id, totalDecimal: D("6999.99"), idempotencyKey: randomUUID(), idempotencyFingerprint: "x" } }))).toBe(true)
    expect(await fails(db.correccionVenta.create({ data: { negocioId: negocio.id, ventaId: venta.body.id, secuencia: 1, motivo: "m", actorTipo: "EMPLEADO", actorId: cajero.empleado.id, totalDecimal: D("7000"), idempotencyKey: randomUUID(), idempotencyFingerprint: "x" } }))).toBe(true)
    expect(await fails(db.correccionVenta.create({ data: {
      negocioId: negocio.id, ventaId: venta.body.id, secuencia: 1, motivo: "m", actorTipo: "NEGOCIO", actorId: negocio.id, totalDecimal: D("7000"), idempotencyKey: randomUUID(), idempotencyFingerprint: "x",
      lineas: { create: [{ negocioId: negocio.id, ventaId: venta.body.id, ventaItemId: item, antesNombre: "Libro", antesCantidad: 1, nombre: "Cuaderno", productoId: q.id, cantidad: 1, precio: 9000, subtotalDecimal: D("7000") }] },
    } }))).toBe(true)
    expect(await db.correccionVenta.count({ where: { ventaId: venta.body.id } })).toBe(0)
  })

  ephemeralTest("concurrency: two corrections from the same view → one wins; correction vs return never interleave", async () => {
    const { negocio, owner } = await crearNegocio()
    const x = await crearProducto(negocio.id, "X", 1500, { controlStock: true, stockCantidad: 10 })
    const y = await crearProducto(negocio.id, "Y", 1500, { controlStock: true, stockCantidad: 10 })
    const cajero = await crearCajero(negocio.id)
    const v1 = await venderOwner(owner, { metodoPago: "EFECTIVO", items: [{ productoId: x.id, cantidad: 2 }] })
    const i1 = itemDe(v1.body, x.id)
    const race = await Promise.all([
      corregir(owner, v1.body.id, correccion([{ ventaItemId: i1, productoId: y.id, cantidad: 2 }])),
      corregir(owner, v1.body.id, correccion([{ ventaItemId: i1, productoId: y.id, cantidad: 2 }], 0, "Otro motivo")),
    ])
    expect(race.map((r) => r.status).sort()).toEqual([201, 409])
    expect(race.find((r) => r.status === 409)!.body.code).toBe("VENTA_MODIFICADA")
    expect(await db.correccionVenta.count({ where: { ventaId: v1.body.id } })).toBe(1)
    expect(await stockDe(x.id)).toBe(10)
    expect(await stockDe(y.id)).toBe(8)

    // Burst with the same key → a single correction.
    const v2 = await venderOwner(owner, { metodoPago: "EFECTIVO", items: [{ productoId: x.id, cantidad: 1 }] })
    const i2 = itemDe(v2.body, x.id)
    const key = randomUUID()
    const burst = await Promise.all(Array.from({ length: 4 }, () => corregir(owner, v2.body.id, correccion([{ ventaItemId: i2, productoId: y.id, cantidad: 1 }]), key)))
    expect(burst.every((r) => r.status === 201 || r.status === 200)).toBe(true)
    expect(await db.correccionVenta.count({ where: { ventaId: v2.body.id } })).toBe(1)

    // Correction vs return on the same sale at the same time: either the correction
    // happened first (then the return applies to it), or the return won and the correction is refused.
    const v3 = await venderOwner(owner, { metodoPago: "EFECTIVO", items: [{ productoId: x.id, cantidad: 2 }] })
    const i3 = itemDe(v3.body, x.id)
    const [corr, dev] = await Promise.all([
      corregir(owner, v3.body.id, correccion([{ ventaItemId: i3, productoId: y.id, cantidad: 2 }])),
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
// P2-A (review 2026-10-28) — the owner's daily list carries the CURRENT lines of
// corrected sales; the sale objects stay the original records.
// ---------------------------------------------------------------------------
describe("F4-B P2-A — owner recent sales expose current lines of corrected sales", () => {
  ephemeralTest("GET /api/negocio/caja/ventas: correccionesPorVenta only for corrected sales; totals and sale rows unchanged", async () => {
    const { negocio, owner } = await crearNegocio()
    const cola = await crearProducto(negocio.id, "Gaseosa Cola", 2000)
    const lima = await crearProducto(negocio.id, "Gaseosa Lima", 2200)
    const yerba = await crearProducto(negocio.id, "Yerba", 5000)
    const corregida = await venderOwner(owner, { metodoPago: "EFECTIVO", items: [{ productoId: cola.id, cantidad: 2 }, { productoId: yerba.id, cantidad: 1 }] })
    const intacta = await venderOwner(owner, { metodoPago: "EFECTIVO", items: [{ productoId: yerba.id, cantidad: 1 }] })
    const antes = await json(await getVentasHoy(req("/api/negocio/caja/ventas", owner)))
    expect(antes.body.correccionesPorVenta).toEqual({})

    const res = await corregir(owner, corregida.body.id, correccion([
      { ventaItemId: itemDe(corregida.body, cola.id), productoId: lima.id, cantidad: 2 },
      { ventaItemId: itemDe(corregida.body, yerba.id), productoId: yerba.id, cantidad: 1 },
    ]))
    expect(res.status).toBe(201)

    const despues = await json(await getVentasHoy(req("/api/negocio/caja/ventas", owner)))
    expect(despues.status).toBe(200)
    expect(Object.keys(despues.body.correccionesPorVenta)).toEqual([corregida.body.id])
    expect(despues.body.correccionesPorVenta[corregida.body.id]).toEqual({
      secuencia: 1,
      items: [
        { id: itemDe(corregida.body, cola.id), productoId: lima.id, nombre: "Gaseosa Lima", varianteNombre: null, precio: 2000, cantidad: 2, subtotal: 4000 },
        { id: itemDe(corregida.body, yerba.id), productoId: yerba.id, nombre: "Yerba", varianteNombre: null, precio: 5000, cantidad: 1, subtotal: 5000 },
      ],
    })
    // The sale records themselves (and the daily totals) are unchanged.
    expect(despues.body.ventasHoy).toEqual(antes.body.ventasHoy)
    expect(despues.body.resumenHoy).toEqual(antes.body.resumenHoy)
    expect(despues.body.ventasHoy.find((v: { id: string }) => v.id === corregida.body.id).items.map((i: { nombre: string }) => i.nombre).sort()).toEqual(["Gaseosa Cola", "Yerba"])
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
    const lima = await crearProducto(negocio.id, "Gaseosa Lima", 2000, { controlStock: true, stockCantidad: 5 })
    const venta = await venderOwner(owner, { metodoPago: "EFECTIVO", items: [{ productoId: cola.id, cantidad: 2 }] })
    expect(venta.status).toBe(201)
    const item = itemDe(venta.body, cola.id)
    expect((await reservar(negocio, lima.id, null, 4)).count).toBe(1) // physical 5, reserved 4 → available 1

    const ventaAntes = await db.venta.findUniqueOrThrow({ where: { id: venta.body.id }, include: { items: true, cobros: true } })
    const rechazo = await corregir(owner, venta.body.id, correccion([{ ventaItemId: item, productoId: lima.id, cantidad: 2 }]))
    expect(rechazo.status).toBe(409)
    expect(rechazo.body.code).toBe("STOCK_INSUFICIENTE")
    expect(rechazo.body.error).toContain("reservadas para pedidos")
    expect(await db.correccionVenta.count({ where: { ventaId: venta.body.id } })).toBe(0)
    expect(await db.venta.findUniqueOrThrow({ where: { id: venta.body.id }, include: { items: true, cobros: true } })).toEqual(ventaAntes)
    expect(await stockDe(lima.id)).toBe(5)
    expect(await stockDe(cola.id)).toBe(8)
    expect(await reservasActivas(negocio.id, lima.id)).toBe(4)
    expect(await db.movimientoInventario.count({ where: { negocioId: negocio.id, tipo: { startsWith: "CORRECCION" } } })).toBe(0)

    // Second product with enough available stock next to its reservation.
    const naranja = await crearProducto(negocio.id, "Gaseosa Naranja", 2000, { controlStock: true, stockCantidad: 5 })
    expect((await reservar(negocio, naranja.id, null, 3)).count).toBe(1) // available 2
    const key = randomUUID()
    const ok = await corregir(owner, venta.body.id, correccion([{ ventaItemId: item, productoId: naranja.id, cantidad: 2 }]), key)
    expect(ok.status).toBe(201)
    expect(await stockDe(naranja.id)).toBe(3)
    expect(await stockDe(cola.id)).toBe(10)
    expect(await reservasActivas(negocio.id, naranja.id)).toBe(3) // reservation untouched
    expect(await reservasActivas(negocio.id, lima.id)).toBe(4)
    const movs = await db.movimientoInventario.findMany({ where: { negocioId: negocio.id, tipo: { startsWith: "CORRECCION" } }, orderBy: { tipo: "asc" } })
    expect(movs.map((m) => [m.tipo, m.productoId, m.cantidad, m.stockAntes, m.stockDespues])).toEqual([
      ["CORRECCION_ENTRADA", cola.id, 2, 8, 10],
      ["CORRECCION_SALIDA", naranja.id, 2, 5, 3],
    ])
    // Retries never duplicate the movements.
    const replay = await corregir(owner, venta.body.id, correccion([{ ventaItemId: item, productoId: naranja.id, cantidad: 2 }]), key)
    expect(replay.status).toBe(200)
    expect(await db.movimientoInventario.count({ where: { negocioId: negocio.id, tipo: { startsWith: "CORRECCION" } } })).toBe(2)
    expect(await stockDe(naranja.id)).toBe(3)
  })

  ephemeralTest("variant with stock control: same rules against the variant's reservations", async () => {
    const { negocio, owner } = await crearNegocio()
    const base = await crearProducto(negocio.id, "Alfajor", 1000, { controlStock: true, stockCantidad: 10 })
    const remera = await crearProducto(negocio.id, "Remera", 3000)
    const roja = await db.productoVariante.create({ data: { productoId: remera.id, nombre: "Roja", precio: 3000, controlStock: true, stockCantidad: 4 } })
    const venta = await venderOwner(owner, { metodoPago: "EFECTIVO", items: [{ productoId: base.id, cantidad: 2 }] })
    const item = itemDe(venta.body, base.id)
    const primera = await reservar(negocio, remera.id, roja.id, 3) // variant: physical 4, reserved 3 → available 1
    expect(primera.count).toBe(1)

    const rechazo = await corregir(owner, venta.body.id, correccion([{ ventaItemId: item, productoId: remera.id, varianteId: roja.id, cantidad: 2 }]))
    expect(rechazo.status).toBe(409)
    expect(rechazo.body.code).toBe("STOCK_INSUFICIENTE")
    expect((await db.productoVariante.findUniqueOrThrow({ where: { id: roja.id } })).stockCantidad).toBe(4)
    expect(await reservasActivas(negocio.id, remera.id, roja.id)).toBe(3)
    expect(await db.correccionVenta.count({ where: { ventaId: venta.body.id } })).toBe(0)

    // The order is cancelled (existing release authority) and a smaller one reserves 2 → available 2.
    expect(await liberar(negocio.id, primera.pedidoId)).toBe(1)
    expect((await reservar(negocio, remera.id, roja.id, 2)).count).toBe(1) // physical 4, reserved 2 → available 2
    const ok = await corregir(owner, venta.body.id, correccion([{ ventaItemId: item, productoId: remera.id, varianteId: roja.id, cantidad: 2 }]))
    expect(ok.status).toBe(201)
    expect((await db.productoVariante.findUniqueOrThrow({ where: { id: roja.id } })).stockCantidad).toBe(2)
    expect(await reservasActivas(negocio.id, remera.id, roja.id)).toBe(2)
    expect(await stockDe(base.id)).toBe(10)
    const movs = await db.movimientoInventario.findMany({ where: { negocioId: negocio.id, tipo: { startsWith: "CORRECCION" } }, orderBy: { tipo: "asc" } })
    expect(movs.map((m) => [m.tipo, m.productoId, m.productoVarianteId, m.cantidad])).toEqual([
      ["CORRECCION_ENTRADA", base.id, null, 2],
      ["CORRECCION_SALIDA", remera.id, roja.id, 2],
    ])
  })

  ephemeralTest("a correction and a reservation racing for the same units never commit both", async () => {
    const { negocio, owner } = await crearNegocio()
    const cola = await crearProducto(negocio.id, "Gaseosa Cola", 2000, { controlStock: true, stockCantidad: 10 })
    const lima = await crearProducto(negocio.id, "Gaseosa Lima", 2000, { controlStock: true, stockCantidad: 2 })
    let pedidoAnterior: string | null = null
    for (let ronda = 0; ronda < 3; ronda++) {
      // Reset between rounds: restore 2 units and cancel the previous round's order (if it reserved).
      await db.producto.update({ where: { id: lima.id }, data: { stockCantidad: 2 } })
      if (pedidoAnterior) await liberar(negocio.id, pedidoAnterior)
      pedidoAnterior = null
      const venta = await venderOwner(owner, { metodoPago: "EFECTIVO", items: [{ productoId: cola.id, cantidad: 2 }] })
      const item = itemDe(venta.body, cola.id)
      const [corr, reserva] = await Promise.all([
        corregir(owner, venta.body.id, correccion([{ ventaItemId: item, productoId: lima.id, cantidad: 2 }])),
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
