/// <reference types="bun-types" />

// ============================================
// F4-A — anulación completa y devolución parcial (REAL ephemeral PostgreSQL)
// ============================================
// Real routes + real PostgreSQL with every migration applied (CI service
// container, DELIGO_EPHEMERAL_TEST_DB=1). Isolated fixtures (random ids).

import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { createOperationalSession, createSession, OPERATIONAL_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/auth"
import { GET as getCajas, POST as postCaja } from "@/app/api/negocio/caja/cajas/route"
import { POST as postVentaOwner, GET as getVentasHoy } from "@/app/api/negocio/caja/ventas/route"
import { POST as postTurnoCajero } from "@/app/api/operativo/caja/[slug]/turno/route"
import { POST as postVentaCajero } from "@/app/api/operativo/caja/[slug]/ventas/route"
import * as ventaCajeroModule from "@/app/api/operativo/caja/[slug]/ventas/route"
import * as devolucionCajeroModule from "@/app/api/operativo/caja/[slug]/ventas/[id]/devoluciones/route"
import { GET as getHistorialCajero } from "@/app/api/operativo/caja/[slug]/ventas/historial/route"
import { GET as getDetalleCajero, POST as postDevolucionCajero } from "@/app/api/operativo/caja/[slug]/ventas/[id]/devoluciones/route"
import { POST as postReintegroCajero } from "@/app/api/operativo/caja/[slug]/devoluciones/[id]/reintegro/route"
import { GET as getDetalleOwner, POST as postDevolucionOwner } from "@/app/api/negocio/caja/ventas/[id]/devoluciones/route"
import { POST as postReintegroOwner } from "@/app/api/negocio/caja/devoluciones/[id]/reintegro/route"
import { GET as getDevolucionesOwner } from "@/app/api/negocio/caja/devoluciones/route"
import { GET as getHistorialOwner } from "@/app/api/negocio/caja/ventas/historial/route"
import { calcularSnapshotEfectivoTurno } from "@/lib/caja-turnos-snapshot"

setDefaultTimeout(240_000)

const testDatabaseUrl = process.env.DELIGO_TEST_DATABASE_URL
const isEphemeralIntegrationDb = process.env.DELIGO_EPHEMERAL_TEST_DB === "1"
if (!testDatabaseUrl || process.env.DATABASE_URL !== testDatabaseUrl) {
  throw new Error("Este test de integración requiere DELIGO_TEST_DATABASE_URL y DATABASE_URL apuntando a la misma base de prueba.")
}
const declaredEnvironment = process.env.DELIGO_ENVIRONMENT ?? process.env.RAILWAY_ENVIRONMENT_NAME ?? process.env.APP_ENV
if (!declaredEnvironment || declaredEnvironment.toUpperCase() !== "TESTING") {
  throw new Error("La suite F4-A sólo puede ejecutarse con DELIGO_ENVIRONMENT=TESTING.")
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

async function crearNegocio(overrides: Partial<{ cajaTurnosModo: string }> = {}) {
  const suffix = randomUUID()
  const negocio = await db.negocio.create({
    data: {
      slug: `test-f4a-${suffix}`,
      nombre: `Test F4-A ${suffix}`,
      usuario: `test-f4a-${suffix}`,
      email: `test-f4a-${suffix}@example.test`,
      password: "fixture",
      rubro: "negocio",
      aprobado: true,
      suspendido: false,
      empleadosActivos: true,
      salonActivo: true,
      cajaTurnosModo: overrides.cajaTurnosModo ?? "OPCIONAL",
    },
  })
  const token = await createSession(negocio.id, "negocio")
  return { negocio, owner: `${SESSION_COOKIE_NAME}=${token}` }
}

async function crearCajero(negocioId: string, nombre = `Cajero ${randomUUID().slice(0, 6)}`, area = "caja") {
  const cuenta = await db.cuentaOperativa.create({
    data: { nombre, email: `test-f4a-${randomUUID()}@example.test`, activo: true, eliminado: false },
  })
  const empleado = await db.empleado.create({
    data: { nombre, codigo: randomUUID().slice(0, 8).toUpperCase(), negocioId, cuentaOperativaId: cuenta.id, areaOperativa: area, activo: true, eliminado: false },
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
const crearCaja = async (owner: string, nombre: string) => json(await postCaja(req("/api/negocio/caja/cajas", owner, "POST", { nombre })))
const abrirCajero = async (cookie: string, slug: string, body: unknown) =>
  json(await postTurnoCajero(req(`/api/operativo/caja/${slug}/turno`, cookie, "POST", body, randomUUID()), slugCtx(slug)))
const cerrarCajero = async (cookie: string, slug: string, turnoCajaId: string, efectivoContado: string) =>
  json(await postTurnoCajero(req(`/api/operativo/caja/${slug}/turno`, cookie, "POST", { action: "close", turnoCajaId, efectivoContado }, randomUUID()), slugCtx(slug)))
const venderCajero = async (cookie: string, slug: string, body: unknown) =>
  json(await postVentaCajero(req(`/api/operativo/caja/${slug}/ventas`, cookie, "POST", body, randomUUID()), slugCtx(slug)))
const venderOwner = async (owner: string, body: unknown) => json(await postVentaOwner(req("/api/negocio/caja/ventas", owner, "POST", body, randomUUID())))

const devolverCajero = async (cookie: string, slug: string, ventaId: string, body: unknown, key: string | undefined = randomUUID()) =>
  json(await postDevolucionCajero(req(`/api/operativo/caja/${slug}/ventas/${ventaId}/devoluciones`, cookie, "POST", body, key), slugIdCtx(slug, ventaId)))
const devolverOwner = async (owner: string, ventaId: string, body: unknown, key: string | undefined = randomUUID()) =>
  json(await postDevolucionOwner(req(`/api/negocio/caja/ventas/${ventaId}/devoluciones`, owner, "POST", body, key), idCtx(ventaId)))
const reintegroCajero = async (cookie: string, slug: string, devolucionId: string, body: unknown, key: string | undefined = randomUUID()) =>
  json(await postReintegroCajero(req(`/api/operativo/caja/${slug}/devoluciones/${devolucionId}/reintegro`, cookie, "POST", body, key), slugIdCtx(slug, devolucionId)))
const reintegroOwner = async (owner: string, devolucionId: string, body: unknown, key: string | undefined = randomUUID()) =>
  json(await postReintegroOwner(req(`/api/negocio/caja/devoluciones/${devolucionId}/reintegro`, owner, "POST", body, key), idCtx(devolucionId)))
const detalleCajero = async (cookie: string, slug: string, ventaId: string) =>
  json(await getDetalleCajero(req(`/api/operativo/caja/${slug}/ventas/${ventaId}/devoluciones`, cookie), slugIdCtx(slug, ventaId)))
const detalleOwner = async (owner: string, ventaId: string) => json(await getDetalleOwner(req(`/api/negocio/caja/ventas/${ventaId}/devoluciones`, owner), idCtx(ventaId)))

const itemDe = (venta: { items: Array<{ id: string; productoId: string | null }> }, productoId: string) => venta.items.find((item) => item.productoId === productoId)!.id
const parcial = (items: Array<{ ventaItemId: string; cantidad: number; reingresaStock: boolean }>, reintegro: unknown, motivo = "El cliente devolvió el producto") =>
  ({ tipo: "DEVOLUCION_PARCIAL", motivo, confirmo: true, reintegro, items })
const anulacion = (items: Array<{ ventaItemId: string; reingresaStock: boolean }>, reintegro: unknown, motivo = "Venta cargada por error") =>
  ({ tipo: "ANULACION", motivo, confirmo: true, reintegro, items })
const EFECTIVO = { modo: "REALIZADO", medio: "EFECTIVO" }

async function esperado(negocioId: string, turnoId: string) {
  return (await calcularSnapshotEfectivoTurno(db, negocioId, turnoId))!.esperado.toFixed(2)
}
async function stockDe(productoId: string) {
  return (await db.producto.findUniqueOrThrow({ where: { id: productoId } })).stockCantidad
}

describe("F4-A — returns against closed shifts, cash in the current shift", () => {
  ephemeralTest("manual scenario: 3 products sold in a closed shift; next day another employee returns one in cash", async () => {
    const { negocio, owner } = await crearNegocio()
    const gaseosa = await crearProducto(negocio.id, "Gaseosa", 2000, { controlStock: true, stockCantidad: 10 })
    const yerba = await crearProducto(negocio.id, "Yerba", 5000, { controlStock: true, stockCantidad: 5 })
    const galletitas = await crearProducto(negocio.id, "Galletitas", 1500)
    const caja = (await listarCajas(owner)).body.cajas[0]
    const ana = await crearCajero(negocio.id, "Ana")
    const beto = await crearCajero(negocio.id, "Beto")

    // Day 1 — Ana sells and closes normally.
    const turnoA = await abrirCajero(ana.cookie, negocio.slug, { cajaFisicaId: caja.id, fondoInicial: "1000.00" })
    expect(turnoA.status).toBe(201)
    const venta = await venderCajero(ana.cookie, negocio.slug, {
      metodoPago: "EFECTIVO",
      items: [{ productoId: gaseosa.id, cantidad: 2 }, { productoId: yerba.id, cantidad: 1 }, { productoId: galletitas.id, cantidad: 1 }],
    })
    expect(venta.status).toBe(201)
    expect(venta.body.total).toBe(10500)
    expect(await esperado(negocio.id, turnoA.body.turno.id)).toBe("11500.00")
    expect((await cerrarCajero(ana.cookie, negocio.slug, turnoA.body.turno.id, "11500.00")).status).toBe(200)
    const cierreA = await db.turnoCaja.findUniqueOrThrow({ where: { id: turnoA.body.turno.id } })
    expect(cierreA.efectivoEsperadoDecimal?.toFixed(2)).toBe("11500.00")

    // Day 2 — Beto opens his own shift.
    const turnoB = await abrirCajero(beto.cookie, negocio.slug, { cajaFisicaId: caja.id, fondoInicial: "3000.00" })
    expect(turnoB.status).toBe(201)
    expect(await esperado(negocio.id, turnoB.body.turno.id)).toBe("3000.00")

    // He finds the sale by its reference and sees its products (no private cash data).
    const ref = (venta.body.id as string).slice(0, 8)
    const found = await json(await getHistorialCajero(req(`/api/operativo/caja/${negocio.slug}/ventas/historial?ref=${ref}`, beto.cookie), slugCtx(negocio.slug)))
    expect(found.status).toBe(200)
    expect(found.body.ventas).toHaveLength(1)
    expect(found.body.ventas[0]).toMatchObject({ id: venta.body.id, total: 10500, totalDevuelto: 0, totalNeto: 10500, estadoDevolucion: "VIGENTE" })
    expect(JSON.stringify(found.body)).not.toMatch(/esperado|diferencia|fondo|turnoCajaId|actorId|empleadoId|negocioId/i)

    // Validation never writes.
    const gaseosaItem = itemDe(venta.body, gaseosa.id)
    const base = parcial([{ ventaItemId: gaseosaItem, cantidad: 1, reingresaStock: true }], EFECTIVO, "Producto equivocado")
    expect((await devolverCajero(beto.cookie, negocio.slug, venta.body.id, { ...base, motivo: "  " })).body.code).toBe("MOTIVO_DEVOLUCION_REQUERIDO")
    expect((await devolverCajero(beto.cookie, negocio.slug, venta.body.id, { ...base, confirmo: false })).body.code).toBe("CONFIRMACION_DEVOLUCION_REQUERIDA")
    expect((await devolverCajero(beto.cookie, negocio.slug, venta.body.id, { ...base, reintegro: { modo: "REALIZADO" } })).body.code).toBe("REINTEGRO_INVALIDO")
    expect((await devolverCajero(beto.cookie, negocio.slug, venta.body.id, { ...base, items: [{ ventaItemId: gaseosaItem, cantidad: 1 }] })).body.code).toBe("STOCK_DECISION_REQUERIDA")
    expect((await devolverCajero(beto.cookie, negocio.slug, venta.body.id, base, "")).body.code).toBe("IDEMPOTENCY_KEY_REQUIRED")
    expect(await db.devolucionVenta.count({ where: { negocioId: negocio.id } })).toBe(0)

    // The return: 1 gaseosa at the price actually charged, cash handed back now.
    const key = randomUUID()
    const devolucion = await devolverCajero(beto.cookie, negocio.slug, venta.body.id, { ...base, importe: 1, precio: 1 }, key)
    expect(devolucion.status).toBe(201)
    expect(devolucion.body.devolucion).toMatchObject({ tipo: "DEVOLUCION_PARCIAL", importe: 2000, registradaPor: "Vos", reintegroEstado: "REALIZADO", reintegroMedio: "EFECTIVO" })
    expect(devolucion.body.venta).toMatchObject({ total: 10500, totalDevuelto: 2000, totalNeto: 8500, estadoDevolucion: "DEVOLUCION_PARCIAL" })
    expect(JSON.stringify(devolucion.body)).not.toMatch(/esperado|diferencia|fondoInicial/i)

    // Current shift: expected cash goes down by exactly the refund.
    expect(await esperado(negocio.id, turnoB.body.turno.id)).toBe("1000.00")
    // Ana's closing stays exactly as it was.
    const cierreADespues = await db.turnoCaja.findUniqueOrThrow({ where: { id: turnoA.body.turno.id } })
    expect(cierreADespues).toMatchObject({ estado: "CERRADO_DECLARADO", efectivoContadoDecimal: cierreA.efectivoContadoDecimal, efectivoEsperadoDecimal: cierreA.efectivoEsperadoDecimal, cerradoEn: cierreA.cerradoEn })
    expect(await esperado(negocio.id, turnoA.body.turno.id)).toBe("11500.00")
    // The original sale and its cobro / VENTA_COBRO operation are untouched; one DEVOLUCION_VENTA outflow.
    const ventaRow = await db.venta.findUniqueOrThrow({ where: { id: venta.body.id }, include: { cobros: true } })
    expect(ventaRow.totalDecimal?.toFixed(2)).toBe("10500.00")
    expect(ventaRow.turnoCajaId).toBe(turnoA.body.turno.id)
    const ops = await db.operacionFinanciera.findMany({ where: { negocioId: negocio.id }, include: { movimientos: true }, orderBy: { createdAt: "asc" } })
    expect(ops.map((o) => [o.tipo, o.turnoCajaId, o.movimientos[0].importeDecimal?.toFixed(2)])).toEqual([
      ["VENTA_COBRO", turnoA.body.turno.id, "10500.00"],
      ["DEVOLUCION_VENTA", turnoB.body.turno.id, "-2000.00"],
    ])
    expect(await db.venta.count({ where: { negocioId: negocio.id } })).toBe(1)
    // Stock: one gaseosa back (10 − 2 + 1), one auditable movement.
    expect(await stockDe(gaseosa.id)).toBe(9)
    expect(await stockDe(yerba.id)).toBe(4)
    const movimientos = await db.movimientoInventario.findMany({ where: { negocioId: negocio.id, tipo: "DEVOLUCION" } })
    expect(movimientos).toHaveLength(1)
    expect(movimientos[0]).toMatchObject({ productoId: gaseosa.id, cantidad: 1, stockAntes: 8, stockDespues: 9, ventaId: venta.body.id })
    // Owner notice: persistent, with employee, sale, products, amount, reason and refund.
    const avisos = await db.notificacion.findMany({ where: { userId: negocio.id, userType: "negocio", tipo: "caja_devolucion" } })
    expect(avisos).toHaveLength(1)
    expect(avisos[0].titulo).toBe("Devolución parcial")
    expect(avisos[0].cuerpo).toContain("Beto")
    expect(avisos[0].cuerpo).toContain(`#${ref}`)
    expect(avisos[0].cuerpo).toContain("1 × Gaseosa")
    expect(avisos[0].cuerpo).toContain("Producto equivocado")
    expect(avisos[0].cuerpo).toContain("reintegrado en efectivo")
    expect(JSON.parse(avisos[0].datos)).toMatchObject({ navigateTo: { negocio: "caja" }, empleadoNombre: "Beto", importe: 2000, reintegroEstado: "REALIZADO", productos: [{ nombre: "Gaseosa", cantidad: 1 }] })
    expect(await db.auditLog.count({ where: { recursoId: venta.body.id, accion: "venta.devolucion_parcial" } })).toBe(1)

    // Double click / retry with the same key: same result, nothing duplicated.
    const replay = await devolverCajero(beto.cookie, negocio.slug, venta.body.id, { ...base, importe: 1, precio: 1 }, key)
    expect(replay.status).toBe(200)
    expect(replay.replayed).toBe(true)
    expect(replay.body.devolucion.id).toBe(devolucion.body.devolucion.id)
    expect((await devolverCajero(beto.cookie, negocio.slug, venta.body.id, { ...base, motivo: "Otro" }, key)).body.code).toBe("IDEMPOTENCY_KEY_REUSED")
    expect(await db.devolucionVenta.count({ where: { negocioId: negocio.id } })).toBe(1)
    expect(await db.operacionFinanciera.count({ where: { negocioId: negocio.id, tipo: "DEVOLUCION_VENTA" } })).toBe(1)
    expect(await stockDe(gaseosa.id)).toBe(9)
    expect(await db.notificacion.count({ where: { userId: negocio.id, tipo: "caja_devolucion" } })).toBe(1)

    // History shows the original sale AND the return; the owner sees who did it.
    const ownerView = await detalleOwner(owner, venta.body.id)
    expect(ownerView.body.venta.devoluciones[0]).toMatchObject({ registradaPor: "Beto", motivo: "Producto equivocado", importe: 2000 })
    const ownerList = await json(await getDevolucionesOwner(req(`/api/negocio/caja/devoluciones?desde=${new Date(Date.now() - 86_400_000).toISOString()}&hasta=${new Date(Date.now() + 86_400_000).toISOString()}`, owner)))
    expect(ownerList.body.devoluciones).toHaveLength(1)
    const hoy = await json(await getVentasHoy(req("/api/negocio/caja/ventas", owner)))
    expect(hoy.body.resumenHoy).toMatchObject({ totalVendido: 10500, totalDevuelto: 2000, totalNeto: 8500 })
    expect(hoy.body.devolucionesPorVenta[venta.body.id]).toEqual({ totalDevuelto: 2000, estadoDevolucion: "DEVOLUCION_PARCIAL" })

    // Beto's blind close: his snapshot reflects the outflow; still blind for him.
    const cierreB = await cerrarCajero(beto.cookie, negocio.slug, turnoB.body.turno.id, "1000.00")
    expect(cierreB.status).toBe(200)
    expect(JSON.stringify(cierreB.body)).not.toMatch(/esperado|diferencia/i)
    expect((await db.turnoCaja.findUniqueOrThrow({ where: { id: turnoB.body.turno.id } })).efectivoEsperadoDecimal?.toFixed(2)).toBe("1000.00")
    // A closed shift can never receive a refund leg afterwards (DB guard).
    const cuenta = await db.cuentaFinanciera.findFirstOrThrow({ where: { negocioId: negocio.id, cajaFisicaId: caja.id } })
    expect(await fails(db.operacionFinanciera.create({ data: { negocioId: negocio.id, tipo: "DEVOLUCION_VENTA", actorTipo: "NEGOCIO", actorId: negocio.id, turnoCajaId: turnoB.body.turno.id, movimientos: { create: [{ negocioId: negocio.id, cuentaId: cuenta.id, importe: -1, importeDecimal: D("-1") }] } } }))).toBe(true)
  })

  ephemeralTest("successive partial returns, then a void of what is left; never more units or money than sold", async () => {
    const { negocio, owner } = await crearNegocio()
    const gaseosa = await crearProducto(negocio.id, "Gaseosa", 2000, { controlStock: true, stockCantidad: 10 })
    const yerba = await crearProducto(negocio.id, "Yerba", 5000, { controlStock: true, stockCantidad: 5 })
    const centavos = await crearProducto(negocio.id, "Caramelo", 3.33)
    const cajero = await crearCajero(negocio.id)
    const venta = await venderCajero(cajero.cookie, negocio.slug, { metodoPago: "EFECTIVO", items: [{ productoId: gaseosa.id, cantidad: 3 }, { productoId: yerba.id, cantidad: 1 }, { productoId: centavos.id, cantidad: 3 }] })
    expect(venta.status).toBe(201)
    expect(venta.body.total).toBe(11009.99)
    const g = itemDe(venta.body, gaseosa.id)
    const y = itemDe(venta.body, yerba.id)
    const c = itemDe(venta.body, centavos.id)

    const r1 = await devolverCajero(cajero.cookie, negocio.slug, venta.body.id, parcial([{ ventaItemId: g, cantidad: 1, reingresaStock: true }, { ventaItemId: c, cantidad: 1, reingresaStock: false }], { modo: "NO_CORRESPONDE" }))
    expect(r1.status).toBe(201)
    expect(r1.body.devolucion.importe).toBe(2003.33)
    const r2 = await devolverCajero(cajero.cookie, negocio.slug, venta.body.id, parcial([{ ventaItemId: g, cantidad: 1, reingresaStock: false }, { ventaItemId: c, cantidad: 1, reingresaStock: false }], { modo: "PENDIENTE" }))
    expect(r2.body.devolucion.importe).toBe(2003.33)
    // More than what is left is rejected and writes nothing.
    const excess = await devolverCajero(cajero.cookie, negocio.slug, venta.body.id, parcial([{ ventaItemId: g, cantidad: 2, reingresaStock: true }], { modo: "NO_CORRESPONDE" }))
    expect(excess.status).toBe(409)
    expect(excess.body.code).toBe("CANTIDAD_DEVOLUCION_EXCEDIDA")
    // Void: only the units still not returned (1 gaseosa, the yerba, 1 caramelo = the exact remainder).
    const anul = await devolverOwner(owner, venta.body.id, anulacion([{ ventaItemId: g, reingresaStock: true }, { ventaItemId: y, reingresaStock: false }, { ventaItemId: c, reingresaStock: false }], EFECTIVO))
    expect(anul.status).toBe(201)
    expect(anul.body.devolucion.importe).toBe(7003.33)
    expect(anul.body.devolucion.items.map((i: { cantidad: number }) => i.cantidad).sort()).toEqual([1, 1, 1])
    expect(anul.body.venta).toMatchObject({ totalDevuelto: 11009.99, totalNeto: 0, estadoDevolucion: "ANULADA" })
    // The owner's own operation does not notify the owner.
    expect(await db.notificacion.count({ where: { userId: negocio.id, tipo: "caja_devolucion" } })).toBe(2)
    // Nothing left: further operations are refused.
    expect((await devolverOwner(owner, venta.body.id, anulacion([{ ventaItemId: g, reingresaStock: true }], EFECTIVO))).body.code).toBe("VENTA_SIN_SALDO_DEVOLVIBLE")
    expect((await devolverCajero(cajero.cookie, negocio.slug, venta.body.id, parcial([{ ventaItemId: y, cantidad: 1, reingresaStock: true }], EFECTIVO))).body.code).toBe("CANTIDAD_DEVOLUCION_EXCEDIDA")
    // Stock: gaseosa back twice (r1 + void), yerba not returned.
    expect(await stockDe(gaseosa.id)).toBe(9)
    expect(await stockDe(yerba.id)).toBe(4)
    // SQL caps even a direct write.
    const dev = await db.devolucionVenta.findFirstOrThrow({ where: { negocioId: negocio.id } })
    expect(await fails(db.devolucionVentaItem.create({ data: { devolucionId: dev.id, negocioId: negocio.id, ventaId: venta.body.id, ventaItemId: g, cantidad: 1, importeDecimal: D("0"), stockResultado: "NO_REINGRESA" } }))).toBe(true)
    // Immutable history.
    expect(await fails(db.devolucionVenta.update({ where: { id: dev.id }, data: { motivo: "cambiado" } }))).toBe(true)
    expect(await fails(db.devolucionVentaItem.updateMany({ where: { devolucionId: dev.id }, data: { cantidad: 5 } }))).toBe(true)
  })

  ephemeralTest("transfer sale: refund pending, then confirmed once by transfer (declared, no ledger); cash later leaves the shift open then", async () => {
    const { negocio, owner } = await crearNegocio()
    const producto = await crearProducto(negocio.id, "Auriculares", 8000)
    const cajero = await crearCajero(negocio.id, "Carla")
    const venta = await venderCajero(cajero.cookie, negocio.slug, { metodoPago: "TRANSFERENCIA", items: [{ productoId: producto.id, cantidad: 2 }] })
    expect(venta.status).toBe(201)
    const item = itemDe(venta.body, producto.id)

    const pend = await devolverCajero(cajero.cookie, negocio.slug, venta.body.id, parcial([{ ventaItemId: item, cantidad: 1, reingresaStock: false }], { modo: "PENDIENTE" }))
    expect(pend.status).toBe(201)
    expect(pend.body.devolucion).toMatchObject({ reintegroEstado: "PENDIENTE", reintegroMedio: null, importe: 8000 })
    expect(await db.operacionFinanciera.count({ where: { negocioId: negocio.id } })).toBe(0)
    // A REALIZADO cash refund without its ledger operation is impossible.
    expect(await fails(db.devolucionVenta.update({ where: { id: pend.body.devolucion.id }, data: { reintegroEstado: "REALIZADO", reintegroMedio: "EFECTIVO", reintegroRegistradoEn: new Date(), reintegroActorTipo: "EMPLEADO", reintegroActorId: cajero.empleado.id } }))).toBe(true)

    expect((await reintegroCajero(cajero.cookie, negocio.slug, pend.body.devolucion.id, { medio: "TRANSFERENCIA" })).body.code).toBe("CONFIRMACION_REINTEGRO_REQUERIDA")
    const key = randomUUID()
    const done = await reintegroCajero(cajero.cookie, negocio.slug, pend.body.devolucion.id, { medio: "TRANSFERENCIA", confirmo: true }, key)
    expect(done.status).toBe(201)
    const replay = await reintegroCajero(cajero.cookie, negocio.slug, pend.body.devolucion.id, { medio: "TRANSFERENCIA", confirmo: true }, key)
    expect(replay.status).toBe(200)
    const again = await reintegroCajero(cajero.cookie, negocio.slug, pend.body.devolucion.id, { medio: "EFECTIVO", confirmo: true })
    expect(again.status).toBe(409)
    expect(again.body.code).toBe("REINTEGRO_YA_REGISTRADO")
    const row = await db.devolucionVenta.findUniqueOrThrow({ where: { id: pend.body.devolucion.id } })
    expect(row).toMatchObject({ reintegroEstado: "REALIZADO", reintegroMedio: "TRANSFERENCIA", reintegroOperacionId: null, reintegroActorId: cajero.empleado.id })
    expect(await db.operacionFinanciera.count({ where: { negocioId: negocio.id } })).toBe(0)
    const detalle = await detalleCajero(cajero.cookie, negocio.slug, venta.body.id)
    expect(detalle.body.venta.devoluciones[0].reintegroDescripcion).toContain("sin verificación bancaria")
    // Notices: the return and the later refund.
    expect(await db.notificacion.count({ where: { userId: negocio.id, tipo: "caja_devolucion" } })).toBe(2)

    // Second unit: pending today, paid in cash tomorrow from the shift open at that moment.
    const pend2 = await devolverCajero(cajero.cookie, negocio.slug, venta.body.id, parcial([{ ventaItemId: item, cantidad: 1, reingresaStock: true }], { modo: "PENDIENTE" }))
    const caja = (await listarCajas(owner)).body.cajas[0]
    const turno = await abrirCajero(cajero.cookie, negocio.slug, { cajaFisicaId: caja.id, fondoInicial: "10000.00" })
    expect(turno.status).toBe(201)
    const cash = await reintegroCajero(cajero.cookie, negocio.slug, pend2.body.devolucion.id, { medio: "EFECTIVO", confirmo: true })
    expect(cash.status).toBe(201)
    expect(await esperado(negocio.id, turno.body.turno.id)).toBe("2000.00")
    const op = await db.operacionFinanciera.findFirstOrThrow({ where: { negocioId: negocio.id, tipo: "DEVOLUCION_VENTA" } })
    expect(op.turnoCajaId).toBe(turno.body.turno.id)
    expect((await db.devolucionVenta.findUniqueOrThrow({ where: { id: pend2.body.devolucion.id } })).reintegroTurnoCajaId).toBe(turno.body.turno.id)
  })

  ephemeralTest("stock: not returned, no stock control, and active order reservations untouched", async () => {
    const { negocio, owner } = await crearNegocio()
    const controlado = await crearProducto(negocio.id, "Shampoo", 3000, { controlStock: true, stockCantidad: 5 })
    const libre = await crearProducto(negocio.id, "Servicio", 1000)
    const venta = await venderOwner(owner, { metodoPago: "EFECTIVO", items: [{ productoId: controlado.id, cantidad: 2 }, { productoId: libre.id, cantidad: 1 }] })
    expect(venta.status).toBe(201)
    const res = await devolverOwner(owner, venta.body.id, parcial([
      { ventaItemId: itemDe(venta.body, controlado.id), cantidad: 1, reingresaStock: false },
      { ventaItemId: itemDe(venta.body, libre.id), cantidad: 1, reingresaStock: true },
    ], { modo: "NO_CORRESPONDE" }, "Producto abierto"))
    expect(res.status).toBe(201)
    expect(res.body.devolucion.items.map((i: { stockResultado: string }) => i.stockResultado).sort()).toEqual(["NO_REINGRESA", "SIN_CONTROL_STOCK"])
    expect(await stockDe(controlado.id)).toBe(3)
    expect(await db.movimientoInventario.count({ where: { negocioId: negocio.id, tipo: "DEVOLUCION" } })).toBe(0)
    // NO_CORRESPONDE: no ledger outflow.
    expect(await db.operacionFinanciera.count({ where: { negocioId: negocio.id, tipo: "DEVOLUCION_VENTA" } })).toBe(0)
  })
})

describe("F4-A — concurrency, idempotency, permissions and shift modes", () => {
  ephemeralTest("burst with the same key → one return; two employees returning the last unit → exactly one wins", async () => {
    const { negocio } = await crearNegocio()
    const producto = await crearProducto(negocio.id, "Vino", 9000, { controlStock: true, stockCantidad: 4 })
    const a = await crearCajero(negocio.id, "A")
    const b = await crearCajero(negocio.id, "B")
    const venta = await venderCajero(a.cookie, negocio.slug, { metodoPago: "EFECTIVO", items: [{ productoId: producto.id, cantidad: 2 }] })
    const item = itemDe(venta.body, producto.id)
    const body = parcial([{ ventaItemId: item, cantidad: 1, reingresaStock: true }], { modo: "PENDIENTE" })

    const key = randomUUID()
    const burst = await Promise.all(Array.from({ length: 5 }, () => devolverCajero(a.cookie, negocio.slug, venta.body.id, body, key)))
    expect(burst.every((r) => r.status === 201 || r.status === 200)).toBe(true)
    expect(burst.filter((r) => r.status === 201)).toHaveLength(1)
    expect(new Set(burst.map((r) => r.body.devolucion.id)).size).toBe(1)
    expect(await db.devolucionVenta.count({ where: { negocioId: negocio.id } })).toBe(1)
    expect(await stockDe(producto.id)).toBe(3)

    // One unit left; two employees try to return it at the same time.
    const race = await Promise.all([
      devolverCajero(a.cookie, negocio.slug, venta.body.id, body),
      devolverCajero(b.cookie, negocio.slug, venta.body.id, body),
    ])
    expect(race.map((r) => r.status).sort()).toEqual([201, 409])
    expect(race.find((r) => r.status === 409)!.body.code).toBe("CANTIDAD_DEVOLUCION_EXCEDIDA")
    const items = await db.devolucionVentaItem.findMany({ where: { ventaItemId: item } })
    expect(items.reduce((acc, i) => acc + i.cantidad, 0)).toBe(2)
    expect(await stockDe(producto.id)).toBe(4)
    expect(await db.movimientoInventario.count({ where: { negocioId: negocio.id, tipo: "DEVOLUCION" } })).toBe(2)
  })

  ephemeralTest("tenant isolation, área caja only, no edit route; amounts never come from the body", async () => {
    const { negocio, owner } = await crearNegocio()
    const producto = await crearProducto(negocio.id, "Libro", 7000)
    const cajero = await crearCajero(negocio.id)
    const venta = await venderOwner(owner, { metodoPago: "EFECTIVO", items: [{ productoId: producto.id, cantidad: 1 }] })
    const body = parcial([{ ventaItemId: itemDe(venta.body, producto.id), cantidad: 1, reingresaStock: false }], { modo: "PENDIENTE" })

    const otro = await crearNegocio()
    const cajeroOtro = await crearCajero(otro.negocio.id)
    expect((await devolverOwner(otro.owner, venta.body.id, body)).status).toBe(404)
    expect((await devolverCajero(cajeroOtro.cookie, otro.negocio.slug, venta.body.id, body)).status).toBe(404)
    expect((await detalleOwner(otro.owner, venta.body.id)).status).toBe(404)
    expect((await detalleCajero(cajeroOtro.cookie, otro.negocio.slug, venta.body.id)).status).toBe(404)
    // The other business's cashier cannot reach this business through its slug.
    expect([401, 403, 404]).toContain((await devolverCajero(cajeroOtro.cookie, negocio.slug, venta.body.id, body)).status)
    // An employee of another área cannot use Caja returns.
    const mozo = await crearCajero(negocio.id, "Mozo", "salon")
    expect([401, 403]).toContain((await devolverCajero(mozo.cookie, negocio.slug, venta.body.id, body)).status)
    // Owner history search of another business returns nothing of this one.
    const otroHistorial = await json(await getHistorialOwner(req(`/api/negocio/caja/ventas/historial?ref=${(venta.body.id as string).slice(0, 8)}`, otro.owner)))
    expect(otroHistorial.body.ventas).toHaveLength(0)
    expect(await db.devolucionVenta.count({ where: { ventaId: venta.body.id } })).toBe(0)

    // Employees have no way to edit sales: only GET/POST of returns, POST of sales.
    expect(Object.keys(devolucionCajeroModule).sort()).toEqual(["GET", "POST"])
    expect(Object.keys(ventaCajeroModule).filter((k) => ["PATCH", "PUT", "DELETE"].includes(k))).toEqual([])
    // Prices/amounts in the body are ignored: the amount is what was charged.
    const res = await devolverCajero(cajero.cookie, negocio.slug, venta.body.id, { ...body, importe: 1, items: [{ ...body.items[0], precio: 1, importe: 1 }] })
    expect(res.status).toBe(201)
    expect(res.body.devolucion.importe).toBe(7000)
    expect((await db.venta.findUniqueOrThrow({ where: { id: venta.body.id } })).total).toBe(7000)
  })

  ephemeralTest("OPCIONAL without shift: cash refund goes to the unassigned cash account; OBLIGATORIO employee needs a shift for cash", async () => {
    const opcional = await crearNegocio()
    const p1 = await crearProducto(opcional.negocio.id, "Taza", 1200)
    const cajero = await crearCajero(opcional.negocio.id)
    const venta = await venderOwner(opcional.owner, { metodoPago: "EFECTIVO", items: [{ productoId: p1.id, cantidad: 1 }] })
    const res = await devolverCajero(cajero.cookie, opcional.negocio.slug, venta.body.id, parcial([{ ventaItemId: itemDe(venta.body, p1.id), cantidad: 1, reingresaStock: false }], EFECTIVO))
    expect(res.status).toBe(201)
    const op = await db.operacionFinanciera.findFirstOrThrow({ where: { negocioId: opcional.negocio.id, tipo: "DEVOLUCION_VENTA" }, include: { movimientos: { include: { cuenta: true } } } })
    expect(op.turnoCajaId).toBeNull()
    expect(op.movimientos[0].cuenta.clave).toBe("efectivo_caja_sin_asignar")
    expect(op.movimientos[0].importeDecimal?.toFixed(2)).toBe("-1200.00")
    expect(await db.turnoCaja.count({ where: { negocioId: opcional.negocio.id } })).toBe(0)

    const obligatorio = await crearNegocio({ cajaTurnosModo: "OBLIGATORIO" })
    const p2 = await crearProducto(obligatorio.negocio.id, "Plato", 2500)
    const cajero2 = await crearCajero(obligatorio.negocio.id)
    const venta2 = await venderOwner(obligatorio.owner, { metodoPago: "EFECTIVO", items: [{ productoId: p2.id, cantidad: 2 }] })
    expect(venta2.status).toBe(201)
    const item2 = itemDe(venta2.body, p2.id)
    const sinTurno = await devolverCajero(cajero2.cookie, obligatorio.negocio.slug, venta2.body.id, parcial([{ ventaItemId: item2, cantidad: 1, reingresaStock: false }], EFECTIVO))
    expect(sinTurno.status).toBe(409)
    expect(sinTurno.body.code).toBe("TURNO_REQUERIDO")
    expect(await db.devolucionVenta.count({ where: { negocioId: obligatorio.negocio.id } })).toBe(0)
    const pendiente = await devolverCajero(cajero2.cookie, obligatorio.negocio.slug, venta2.body.id, parcial([{ ventaItemId: item2, cantidad: 1, reingresaStock: false }], { modo: "PENDIENTE" }))
    expect(pendiente.status).toBe(201)
  })

  ephemeralTest("owner with two open registers chooses where the cash leaves from", async () => {
    const { negocio, owner } = await crearNegocio()
    const producto = await crearProducto(negocio.id, "Lámpara", 15000)
    const principal = (await listarCajas(owner)).body.cajas[0]
    const segunda = (await crearCaja(owner, "Mostrador 2")).body
    const a = await crearCajero(negocio.id, "Ana")
    const b = await crearCajero(negocio.id, "Beto")
    const turnoA = await abrirCajero(a.cookie, negocio.slug, { cajaFisicaId: principal.id, fondoInicial: "0.00" })
    expect(turnoA.status).toBe(201)
    const turnoB = await abrirCajero(b.cookie, negocio.slug, { cajaFisicaId: segunda.id, fondoInicial: "20000.00" })
    expect(turnoB.status).toBe(201)
    const venta = await venderCajero(a.cookie, negocio.slug, { metodoPago: "EFECTIVO", items: [{ productoId: producto.id, cantidad: 1 }] })
    const body = anulacion([{ ventaItemId: itemDe(venta.body, producto.id), reingresaStock: false }], EFECTIVO)
    const choose = await devolverOwner(owner, venta.body.id, body)
    expect(choose.status).toBe(409)
    expect(choose.body.code).toBe("CAJA_SELECCION_REQUERIDA")
    const cajaB = segunda.id
    const res = await devolverOwner(owner, venta.body.id, { ...body, cajaFisicaId: cajaB })
    expect(res.status).toBe(201)
    expect(res.body.devolucion.registradaPor).toBe("Dueño")
    expect(await esperado(negocio.id, turnoB.body.turno.id)).toBe("5000.00")
    expect(await esperado(negocio.id, turnoA.body.turno.id)).toBe("15000.00")
    // Owner operation: no notice to the owner; audit present.
    expect(await db.notificacion.count({ where: { userId: negocio.id, tipo: "caja_devolucion" } })).toBe(0)
    expect(await db.auditLog.count({ where: { recursoId: venta.body.id, accion: "venta.anulada" } })).toBe(1)
    // Its refund is already registered: a second one is refused.
    const reintegroSinCaja = await reintegroOwner(owner, res.body.devolucion.id, { medio: "EFECTIVO", confirmo: true })
    expect(reintegroSinCaja.body.code).toBe("REINTEGRO_YA_REGISTRADO")
  })
})
