/// <reference types="bun-types" />

// ============================================
// F4-C2 — Caja summaries read the money from the real cobros (REAL ephemeral PostgreSQL)
// ============================================
// The owner daily summary (GET /api/negocio/caja/ventas) and the owner shift
// detail (GET /api/negocio/caja/turnos/[id]) now compute the money by method
// from CobroVenta. These tests compare them, on the SAME rows, with the former
// formula (Venta.total grouped by Venta.metodoPago, kept below as the reference):
// cash / transfer / other sales, pre-F10-B0 sales without cobros (also a
// Float-only row), partial returns, an owner correction, open and closed
// shifts. Nothing may change, nothing may be counted twice, the closing
// snapshot stays frozen and the cashier never receives these figures.
// Isolated fixtures (random ids); no CambioVenta / CREDITO_CAMBIO exist yet.

import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createOperationalSession, createSession, OPERATIONAL_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/auth"
import { GET as getCajas } from "@/app/api/negocio/caja/cajas/route"
import { GET as getVentasHoy, POST as postVentaOwner } from "@/app/api/negocio/caja/ventas/route"
import { GET as getTurnoOwner } from "@/app/api/negocio/caja/turnos/[id]/route"
import { POST as postTurnoCajero } from "@/app/api/operativo/caja/[slug]/turno/route"
import { POST as postVentaCajero } from "@/app/api/operativo/caja/[slug]/ventas/route"
import { POST as postDevolucionOwner } from "@/app/api/negocio/caja/ventas/[id]/devoluciones/route"
import * as correccionModule from "@/app/api/negocio/caja/ventas/[id]/correcciones/route"
import { resumenVentasTurno } from "@/lib/caja-turnos-admin"
import { addMoney, moneyToNumber, storedMoney } from "@/lib/money"

setDefaultTimeout(240_000)

const testDatabaseUrl = process.env.DELIGO_TEST_DATABASE_URL
const isEphemeralIntegrationDb = process.env.DELIGO_EPHEMERAL_TEST_DB === "1"
if (!testDatabaseUrl || process.env.DATABASE_URL !== testDatabaseUrl) {
  throw new Error("Este test de integración requiere DELIGO_TEST_DATABASE_URL y DATABASE_URL apuntando a la misma base de prueba.")
}
const declaredEnvironment = process.env.DELIGO_ENVIRONMENT ?? process.env.RAILWAY_ENVIRONMENT_NAME ?? process.env.APP_ENV
if (!declaredEnvironment || declaredEnvironment.toUpperCase() !== "TESTING") {
  throw new Error("La suite F4-C2 sólo puede ejecutarse con DELIGO_ENVIRONMENT=TESTING.")
}
process.env.DELIGO_ENVIRONMENT = "TESTING"
process.env.DELIGO_F10_B2_2_B_SHIFT_UI_ENABLED = "true"

// Writes real rows: only against the ephemeral test database.
const ephemeralTest = isEphemeralIntegrationDb ? test : test.skip

afterAll(async () => {
  await db.$disconnect()
})

async function crearNegocio() {
  const suffix = randomUUID()
  const negocio = await db.negocio.create({
    data: {
      slug: `test-f4c2-${suffix}`,
      nombre: `Test F4-C2 ${suffix}`,
      usuario: `test-f4c2-${suffix}`,
      email: `test-f4c2-${suffix}@example.test`,
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

async function crearCajero(negocioId: string, nombre: string) {
  const cuenta = await db.cuentaOperativa.create({ data: { nombre, email: `test-f4c2-${randomUUID()}@example.test`, activo: true, eliminado: false } })
  const empleado = await db.empleado.create({
    data: { nombre, codigo: randomUUID().slice(0, 8).toUpperCase(), negocioId, cuentaOperativaId: cuenta.id, areaOperativa: "caja", activo: true, eliminado: false },
  })
  const allowlist = new Set((process.env.DELIGO_F10_B2_2_B_CONTROLLED_EMPLOYEE_IDS ?? "").split(/[\s,;]+/).filter(Boolean))
  allowlist.add(empleado.id)
  process.env.DELIGO_F10_B2_2_B_CONTROLLED_EMPLOYEE_IDS = [...allowlist].join(",")
  const token = await createOperationalSession(cuenta.id)
  return { empleado, cookie: `${OPERATIONAL_SESSION_COOKIE_NAME}=${token}` }
}

const crearProducto = (negocioId: string, nombre: string, precio: number) => db.producto.create({ data: { nombre, precio, negocioId, controlStock: false, stockCantidad: 0 } })

const json = async (res: Response) => ({ status: res.status, body: await res.json() })
const req = (url: string, cookie: string, method = "GET", body?: unknown, key?: string) =>
  new NextRequest(`http://localhost${url}`, {
    method,
    headers: { cookie, "content-type": "application/json", ...(key ? { "idempotency-key": key } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
const slugCtx = (slug: string) => ({ params: Promise.resolve({ slug }) })
const idCtx = (id: string) => ({ params: Promise.resolve({ id }) })

const listarCajas = async (owner: string) => json(await getCajas(req("/api/negocio/caja/cajas", owner)))
const abrir = async (cookie: string, slug: string, cajaFisicaId: string, fondoInicial: string) =>
  json(await postTurnoCajero(req(`/api/operativo/caja/${slug}/turno`, cookie, "POST", { cajaFisicaId, fondoInicial }, randomUUID()), slugCtx(slug)))
const cerrar = async (cookie: string, slug: string, turnoCajaId: string, efectivoContado: string) =>
  json(await postTurnoCajero(req(`/api/operativo/caja/${slug}/turno`, cookie, "POST", { action: "close", turnoCajaId, efectivoContado }, randomUUID()), slugCtx(slug)))
const venderCajero = async (cookie: string, slug: string, metodoPago: string, items: Array<{ productoId: string; cantidad: number }>) =>
  json(await postVentaCajero(req(`/api/operativo/caja/${slug}/ventas`, cookie, "POST", { metodoPago, items }, randomUUID()), slugCtx(slug)))
const venderOwner = async (owner: string, metodoPago: string, items: Array<{ productoId: string; cantidad: number }>) =>
  json(await postVentaOwner(req("/api/negocio/caja/ventas", owner, "POST", { metodoPago, items }, randomUUID())))
const resumenOwner = async (owner: string) => json(await getVentasHoy(req("/api/negocio/caja/ventas", owner)))
const turnoOwner = async (owner: string, turnoId: string) => json(await getTurnoOwner(req(`/api/negocio/caja/turnos/${turnoId}`, owner), idCtx(turnoId)))
const devolverOwner = async (owner: string, ventaId: string, body: unknown) =>
  json(await postDevolucionOwner(req(`/api/negocio/caja/ventas/${ventaId}/devoluciones`, owner, "POST", body, randomUUID()), idCtx(ventaId)))
const corregir = async (owner: string, ventaId: string, body: unknown) =>
  json(await correccionModule.POST(req(`/api/negocio/caja/ventas/${ventaId}/correcciones`, owner, "POST", body, randomUUID()), idCtx(ventaId)))

const itemDe = (venta: { items: Array<{ id: string; productoId: string | null }> }, productoId: string) => venta.items.find((item) => item.productoId === productoId)!.id

// ---------------------------------------------------------------------------
// Reference: the formula the summaries used BEFORE F4-C2, on the same rows.
// ---------------------------------------------------------------------------
type VentaRow = { metodoPago: string; total: number; totalDecimal: import("@prisma/client").Prisma.Decimal | null }
function formulaAnterior(ventas: VentaRow[]) {
  const sumar = (metodo?: string) => moneyToNumber(addMoney(...ventas.filter((v) => !metodo || v.metodoPago === metodo).map((v) => storedMoney(v.totalDecimal, v.total))))
  return { total: sumar(), EFECTIVO: sumar("EFECTIVO"), TRANSFERENCIA: sumar("TRANSFERENCIA"), OTRO: sumar("OTRO") }
}
async function referenciaDia(negocioId: string) {
  // Same selection as the owner route: today's sales, newest first, at most 100.
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const ventas = await db.venta.findMany({ where: { negocioId, createdAt: { gte: startOfDay } }, orderBy: { createdAt: "desc" }, take: 100 })
  const devuelto = await db.devolucionVenta.findMany({ where: { negocioId, createdAt: { gte: startOfDay } }, select: { importeDecimal: true } })
  const f = formulaAnterior(ventas)
  const totalDevuelto = moneyToNumber(addMoney(...devuelto.map((d) => d.importeDecimal)))
  return {
    cantidadVentas: ventas.length,
    totalVendido: f.total,
    totalEfectivo: f.EFECTIVO,
    totalTransferencia: f.TRANSFERENCIA,
    totalOtro: f.OTRO,
    totalDevuelto,
    totalNeto: moneyToNumber(addMoney(...ventas.map((v) => storedMoney(v.totalDecimal, v.total))).minus(addMoney(...devuelto.map((d) => d.importeDecimal)))),
  }
}
async function referenciaTurno(negocioId: string, turnoId: string) {
  const ventas = await db.venta.findMany({ where: { negocioId, turnoCajaId: turnoId } })
  const f = formulaAnterior(ventas)
  return { cantidad: ventas.length, totalEfectivo: f.EFECTIVO, totalTransferencia: f.TRANSFERENCIA, totalOtro: f.OTRO }
}

async function expectResumenEquivalente(negocioId: string, owner: string) {
  const res = await resumenOwner(owner)
  expect(res.status).toBe(200)
  const referencia = await referenciaDia(negocioId)
  expect(res.body.resumenHoy).toEqual(referencia)
  // the JSON contract of the listed sales is unchanged: no cobros / Decimal keys leak
  for (const venta of res.body.ventasHoy as Array<Record<string, unknown>>) {
    expect(Object.keys(venta)).not.toContain("cobros")
    expect(Object.keys(venta)).not.toContain("totalDecimal")
  }
  // never counted twice: money by method adds up to the commercial total
  const r = res.body.resumenHoy
  expect(moneyToNumber(addMoney(...[r.totalEfectivo, r.totalTransferencia, r.totalOtro].map((n: number) => storedMoney(null, n))))).toBe(r.totalVendido)
  return res.body.resumenHoy
}
async function expectTurnoEquivalente(negocioId: string, owner: string, turnoId: string) {
  const detalle = await turnoOwner(owner, turnoId)
  expect(detalle.status).toBe(200)
  const referencia = await referenciaTurno(negocioId, turnoId)
  expect(detalle.body.ventas).toEqual(referencia)
  const directo = await resumenVentasTurno(db, negocioId, turnoId)
  expect({ cantidad: directo.cantidadVentas, totalEfectivo: moneyToNumber(directo.totalEfectivo), totalTransferencia: moneyToNumber(directo.totalTransferencia), totalOtro: moneyToNumber(directo.totalOtro) }).toEqual(referencia)
  return detalle.body
}

describe("F4-C2 — summaries from real cobros are identical to the former formula", () => {
  ephemeralTest("cash / transfer / other, legacy sales without cobros, returns, a correction, open and closed shifts", async () => {
    const { negocio, owner } = await crearNegocio()
    const cola = await crearProducto(negocio.id, "Gaseosa Cola", 2000)
    const lima = await crearProducto(negocio.id, "Gaseosa Lima", 2000)
    const yerba = await crearProducto(negocio.id, "Yerba", 5000)
    const centavos = await crearProducto(negocio.id, "Chicle", 0.1)
    const caja = (await listarCajas(owner)).body.cajas[0]
    const ana = await crearCajero(negocio.id, "Ana")

    // Shift A (Ana): every method, exact cents.
    const turnoA = (await abrir(ana.cookie, negocio.slug, caja.id, "1000.00")).body.turno
    const efectivo = await venderCajero(ana.cookie, negocio.slug, "EFECTIVO", [{ productoId: cola.id, cantidad: 2 }, { productoId: lima.id, cantidad: 1 }])
    const transferencia = await venderCajero(ana.cookie, negocio.slug, "TRANSFERENCIA", [{ productoId: yerba.id, cantidad: 1 }])
    const otro = await venderCajero(ana.cookie, negocio.slug, "OTRO", [{ productoId: lima.id, cantidad: 1 }])
    const chicles = await venderCajero(ana.cookie, negocio.slug, "EFECTIVO", [{ productoId: centavos.id, cantidad: 3 }])
    for (const v of [efectivo, transferencia, otro, chicles]) expect(v.status).toBe(201)

    // Pre-F10-B0 sales: no CobroVenta rows (one with the Decimal column, one Float-only), in shift A.
    await db.venta.create({ data: { negocioId: negocio.id, total: 1500, totalDecimal: "1500.00", metodoPago: "EFECTIVO", cantidadItems: 1, turnoCajaId: turnoA.id, items: { create: [{ productoId: yerba.id, nombre: "legacy", precio: 1500, cantidad: 1, subtotal: 1500 }] } } })
    await db.venta.create({ data: { negocioId: negocio.id, total: 0.7, metodoPago: "TRANSFERENCIA", cantidadItems: 1, turnoCajaId: turnoA.id, items: { create: [{ productoId: cola.id, nombre: "legacy float", precio: 0.7, cantidad: 1, subtotal: 0.7 }] } } })
    expect(await db.cobroVenta.count({ where: { negocioId: negocio.id } })).toBe(4)

    const r1 = await expectResumenEquivalente(negocio.id, owner)
    expect(r1).toEqual({ cantidadVentas: 6, totalVendido: 14501, totalEfectivo: 7500.3, totalTransferencia: 5000.7, totalOtro: 2000, totalDevuelto: 0, totalNeto: 14501 })
    const tA1 = await expectTurnoEquivalente(negocio.id, owner, turnoA.id)
    expect(tA1.ventas).toEqual({ cantidad: 6, totalEfectivo: 7500.3, totalTransferencia: 5000.7, totalOtro: 2000 })

    // An owner correction (F4-B, same-sale price) and a partial cash return (F4-A): cobros and sales untouched.
    const corr = await corregir(owner, efectivo.body.id, {
      motivo: "Se escaneó el sabor equivocado",
      confirmo: true,
      secuenciaEsperada: 0,
      lineas: [
        { ventaItemId: itemDe(efectivo.body, cola.id), productoId: lima.id, varianteId: null, cantidad: 2 },
        { ventaItemId: itemDe(efectivo.body, lima.id), productoId: lima.id, varianteId: null, cantidad: 1 },
      ],
    })
    expect(corr.status).toBe(201)
    const dev = await devolverOwner(owner, transferencia.body.id, {
      tipo: "DEVOLUCION_PARCIAL",
      motivo: "El cliente devolvió la yerba",
      confirmo: true,
      reintegro: { modo: "PENDIENTE" },
      items: [{ ventaItemId: transferencia.body.items[0].id, cantidad: 1, reingresaStock: false }],
    })
    expect(dev.status).toBe(201)
    const r2 = await expectResumenEquivalente(negocio.id, owner)
    expect(r2).toMatchObject({ totalVendido: r1.totalVendido, totalEfectivo: 7500.3, totalTransferencia: 5000.7, totalOtro: 2000, totalDevuelto: 5000, totalNeto: 9501 })
    expect(await db.cobroVenta.count({ where: { negocioId: negocio.id } })).toBe(4)
    await expectTurnoEquivalente(negocio.id, owner, turnoA.id)

    // Close shift A: the closing snapshot is frozen; the summary of the CLOSED shift is still identical.
    const cierre = await cerrar(ana.cookie, negocio.slug, turnoA.id, "8000.00")
    expect(cierre.status).toBe(200)
    const congelado = await db.turnoCaja.findUniqueOrThrow({ where: { id: turnoA.id } })
    const tA2 = await expectTurnoEquivalente(negocio.id, owner, turnoA.id)
    expect(tA2.estado).toBe("CERRADO_DECLARADO")
    expect(tA2.ventas).toEqual(tA1.ventas)

    // Shift B (another cashier) on the same register: shifts stay isolated.
    const beto = await crearCajero(negocio.id, "Beto")
    const turnoB = (await abrir(beto.cookie, negocio.slug, caja.id, "0.00")).body.turno
    expect((await venderCajero(beto.cookie, negocio.slug, "OTRO", [{ productoId: yerba.id, cantidad: 2 }])).status).toBe(201)
    const tB = await expectTurnoEquivalente(negocio.id, owner, turnoB.id)
    expect(tB.ventas).toEqual({ cantidad: 1, totalEfectivo: 0, totalTransferencia: 0, totalOtro: 10000 })
    expect((await expectTurnoEquivalente(negocio.id, owner, turnoA.id)).ventas).toEqual(tA1.ventas)
    await expectResumenEquivalente(negocio.id, owner)

    // An owner sale (auto-attributed to the sole open register, shift B) enters the day and shift B.
    expect((await venderOwner(owner, "EFECTIVO", [{ productoId: lima.id, cantidad: 1 }])).status).toBe(201)
    await expectResumenEquivalente(negocio.id, owner)
    expect((await expectTurnoEquivalente(negocio.id, owner, turnoB.id)).ventas).toEqual({ cantidad: 2, totalEfectivo: 2000, totalTransferencia: 0, totalOtro: 10000 })

    // The frozen closing of shift A never moved.
    const despues = await db.turnoCaja.findUniqueOrThrow({ where: { id: turnoA.id } })
    expect({ esperado: despues.efectivoEsperadoDecimal?.toFixed(2), contado: despues.efectivoContadoDecimal?.toFixed(2), cerradoEn: despues.cerradoEn }).toEqual({
      esperado: congelado.efectivoEsperadoDecimal?.toFixed(2),
      contado: congelado.efectivoContadoDecimal?.toFixed(2),
      cerradoEn: congelado.cerradoEn,
    })
  })

  ephemeralTest("an empty day and a shift without sales give zeros, exactly like before", async () => {
    const { negocio, owner } = await crearNegocio()
    const caja = (await listarCajas(owner)).body.cajas[0]
    const ana = await crearCajero(negocio.id, "Ana")
    const turno = (await abrir(ana.cookie, negocio.slug, caja.id, "0.00")).body.turno
    expect(await expectResumenEquivalente(negocio.id, owner)).toEqual({ cantidadVentas: 0, totalVendido: 0, totalEfectivo: 0, totalTransferencia: 0, totalOtro: 0, totalDevuelto: 0, totalNeto: 0 })
    expect((await expectTurnoEquivalente(negocio.id, owner, turno.id)).ventas).toEqual({ cantidad: 0, totalEfectivo: 0, totalTransferencia: 0, totalOtro: 0 })
  })

  ephemeralTest("blind close: the cashier's own routes never expose the summaries", async () => {
    const { negocio, owner } = await crearNegocio()
    const p = await crearProducto(negocio.id, "Agua", 1000)
    const caja = (await listarCajas(owner)).body.cajas[0]
    const ana = await crearCajero(negocio.id, "Ana")
    const turno = (await abrir(ana.cookie, negocio.slug, caja.id, "0.00")).body.turno
    const venta = await venderCajero(ana.cookie, negocio.slug, "EFECTIVO", [{ productoId: p.id, cantidad: 1 }])
    expect(venta.status).toBe(201)
    expect(JSON.stringify(venta.body)).not.toMatch(/resumen|totalEfectivo|cobros|esperado|diferencia/i)
    // The owner routes reject the operational cookie.
    expect((await resumenOwner(ana.cookie)).status).toBe(401)
    expect([401, 403]).toContain((await turnoOwner(ana.cookie, turno.id)).status)
  })
})
