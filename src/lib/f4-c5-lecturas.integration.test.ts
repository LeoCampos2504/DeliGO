/// <reference types="bun-types" />
// ============================================
// F4-C5 — read-only links, chains, P1 thresholds and the D7 report breakdown
// (REAL ephemeral PostgreSQL)
// ============================================
// Sale detail links, the chain of exchanges / linked sales (privacy per actor),
// the owner-only thresholds endpoint, the owner daily breakdown (exchanges,
// refunds paid by method and payment day, pending refunds, internal
// compensation never money) and the exchanges line of the owner shift detail
// (a closed shift is never recalculated). The cashier never reaches owner data.

import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createOperationalSession, createSession, OPERATIONAL_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/auth"
import { GET as getVentasHoy, POST as postVentaOwner } from "@/app/api/negocio/caja/ventas/route"
import { POST as postVentaCajero } from "@/app/api/operativo/caja/[slug]/ventas/route"
import { POST as postTurnoCajero } from "@/app/api/operativo/caja/[slug]/turno/route"
import { GET as getTurnoOwner } from "@/app/api/negocio/caja/turnos/[id]/route"
import { POST as postCambioOwner } from "@/app/api/negocio/caja/ventas/[id]/cambios/route"
import { POST as postCambioCajero } from "@/app/api/operativo/caja/[slug]/ventas/[id]/cambios/route"
import { POST as postAdicionalOwner } from "@/app/api/negocio/caja/ventas/[id]/adicionales/route"
import { POST as postDevolucionOwner } from "@/app/api/negocio/caja/ventas/[id]/devoluciones/route"
import { POST as postReintegroOwner } from "@/app/api/negocio/caja/devoluciones/[id]/reintegro/route"
import { GET as getDetalleOwner } from "@/app/api/negocio/caja/ventas/[id]/devoluciones/route"
import { GET as getCadenaOwner } from "@/app/api/negocio/caja/ventas/[id]/cadena/route"
import { GET as getCadenaCajero } from "@/app/api/operativo/caja/[slug]/ventas/[id]/cadena/route"
import { GET as getConfig, PATCH as patchConfig } from "@/app/api/negocio/caja/configuracion-cambios/route"

setDefaultTimeout(240_000)

const testDatabaseUrl = process.env.DELIGO_TEST_DATABASE_URL
const isEphemeralIntegrationDb = process.env.DELIGO_EPHEMERAL_TEST_DB === "1"
if (!testDatabaseUrl || process.env.DATABASE_URL !== testDatabaseUrl) {
  throw new Error("Este test de integración requiere DELIGO_TEST_DATABASE_URL y DATABASE_URL apuntando a la misma base de prueba.")
}
const declaredEnvironment = process.env.DELIGO_ENVIRONMENT ?? process.env.RAILWAY_ENVIRONMENT_NAME ?? process.env.APP_ENV
if (!declaredEnvironment || declaredEnvironment.toUpperCase() !== "TESTING") {
  throw new Error("La suite F4-C5 sólo puede ejecutarse con DELIGO_ENVIRONMENT=TESTING.")
}
process.env.DELIGO_ENVIRONMENT = "TESTING"
process.env.DELIGO_F10_B2_2_B_SHIFT_UI_ENABLED = "true"
const ephemeralTest = isEphemeralIntegrationDb ? test : test.skip

afterAll(async () => {
  await db.$disconnect()
})

async function escenario() {
  const suffix = randomUUID()
  const negocio = await db.negocio.create({
    data: { slug: `test-f4c5l-${suffix}`, nombre: `Test F4-C5 L ${suffix}`, usuario: `test-f4c5l-${suffix}`, email: `test-f4c5l-${suffix}@example.test`, password: "fixture", rubro: "negocio", aprobado: true, suspendido: false, empleadosActivos: true, salonActivo: true, cajaTurnosModo: "OPCIONAL" },
  })
  const owner = `${SESSION_COOKIE_NAME}=${await createSession(negocio.id, "negocio")}`
  const saphirus = await db.producto.create({ data: { nombre: "Saphirus", precio: 2000, negocioId: negocio.id } })
  const redmi = await db.producto.create({ data: { nombre: "Redmi", precio: 1000, negocioId: negocio.id } })
  return { negocio, owner, saphirus, redmi }
}
type Escenario = Awaited<ReturnType<typeof escenario>>

async function crearCajero(negocioId: string) {
  const nombre = `Cajero ${randomUUID().slice(0, 6)}`
  const cuenta = await db.cuentaOperativa.create({ data: { nombre, email: `test-f4c5l-${randomUUID()}@example.test`, activo: true, eliminado: false } })
  const empleado = await db.empleado.create({ data: { nombre, codigo: randomUUID().slice(0, 8).toUpperCase(), negocioId, cuentaOperativaId: cuenta.id, areaOperativa: "caja", activo: true, eliminado: false } })
  const allowlist = new Set((process.env.DELIGO_F10_B2_2_B_CONTROLLED_EMPLOYEE_IDS ?? "").split(/[\s,;]+/).filter(Boolean))
  allowlist.add(empleado.id)
  process.env.DELIGO_F10_B2_2_B_CONTROLLED_EMPLOYEE_IDS = [...allowlist].join(",")
  return { empleado, cookie: `${OPERATIONAL_SESSION_COOKIE_NAME}=${await createOperationalSession(cuenta.id)}` }
}

const json = async (res: Response) => ({ status: res.status, body: await res.json() })
const req = (url: string, cookie: string, method = "GET", body?: unknown, key?: string) =>
  new NextRequest(`http://localhost${url}`, { method, headers: { cookie, "content-type": "application/json", ...(key ? { "idempotency-key": key } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
const idCtx = (id: string) => ({ params: Promise.resolve({ id }) })
const slugCtx = (slug: string) => ({ params: Promise.resolve({ slug }) })
const slugIdCtx = (slug: string, id: string) => ({ params: Promise.resolve({ slug, id }) })

async function ventaOwner(e: Escenario, productoId: string, cantidad: number) {
  const r = await json(await postVentaOwner(req("/api/negocio/caja/ventas", e.owner, "POST", { metodoPago: "EFECTIVO", items: [{ productoId, cantidad }] }, randomUUID())))
  expect(r.status).toBe(201)
  return r.body as { id: string; items: Array<{ id: string; productoId: string }> }
}
/** 1 unit of the sale's first line out → `entra` in, with the quoted amounts. */
const cuerpoCambio = (venta: { items: Array<{ id: string }> }, entra: string, salida: string, entrada: string, extra: Record<string, unknown> = {}) => ({
  motivo: "Cambio",
  salen: [{ ventaItemId: venta.items[0].id, cantidad: 1, reingresaStock: true }],
  entran: [{ productoId: entra, cantidad: 1 }],
  esperado: { salida, entrada },
  confirmo: true,
  ...extra,
})
const cambioOwner = async (e: Escenario, ventaId: string, body: unknown) => json(await postCambioOwner(req(`/api/negocio/caja/ventas/${ventaId}/cambios`, e.owner, "POST", body, randomUUID()), idCtx(ventaId)))

describe("F4-C5 — sale links and chains", () => {
  ephemeralTest("the detail tells how a sale was born and what it took part in; the chain lists every linked sale and exchange", async () => {
    const e = await escenario()
    const a = await ventaOwner(e, e.saphirus.id, 2)
    const c1 = await cambioOwner(e, a.id, cuerpoCambio(a, e.saphirus.id, "2000.00", "2000.00"))
    expect(c1.status).toBe(201)
    const b = c1.body.ventaNueva as { id: string; items: Array<{ id: string }> }
    const c2 = await cambioOwner(e, b.id, cuerpoCambio(b, e.saphirus.id, "2000.00", "2000.00"))
    expect(c2.status).toBe(201)
    const adicional = await json(await postAdicionalOwner(req(`/api/negocio/caja/ventas/${a.id}/adicionales`, e.owner, "POST", { metodoPago: "EFECTIVO", items: [{ productoId: e.redmi.id, cantidad: 1 }] }, randomUUID()), idCtx(a.id)))
    expect(adicional.status).toBe(201)

    const detA = await json(await getDetalleOwner(req(`/api/negocio/caja/ventas/${a.id}/devoluciones`, e.owner), idCtx(a.id)))
    expect(detA.body.venta.vinculo).toBeNull()
    expect(detA.body.venta.cambiosComoOrigen.map((x: { id: string }) => x.id)).toEqual([c1.body.cambio.id])
    expect(detA.body.venta.ventasAdicionales.map((x: { id: string }) => x.id)).toEqual([adicional.body.venta.id])
    expect(detA.body.venta.devoluciones[0]).toMatchObject({ cambioId: c1.body.cambio.id, importeReintegrable: 0 })
    const detB = await json(await getDetalleOwner(req(`/api/negocio/caja/ventas/${b.id}/devoluciones`, e.owner), idCtx(b.id)))
    expect(detB.body.venta.vinculo).toMatchObject({ tipo: "CAMBIO", ventaOrigenId: a.id })
    expect(detB.body.venta.cambioComoNueva).toMatchObject({ id: c1.body.cambio.id, ventaOrigenId: a.id })

    const cadena = await json(await getCadenaOwner(req(`/api/negocio/caja/ventas/${c2.body.ventaNueva.id}/cadena`, e.owner), idCtx(c2.body.ventaNueva.id)))
    expect(cadena.status).toBe(200)
    expect(new Set(cadena.body.ventas.map((v: { id: string }) => v.id))).toEqual(new Set([a.id, b.id, c2.body.ventaNueva.id, adicional.body.venta.id]))
    expect(cadena.body.cambios.map((x: { id: string }) => x.id)).toEqual([c1.body.cambio.id, c2.body.cambio.id])
    expect(cadena.body.cambios[0].registradoPor).toBe("Dueño")

    // cashier: same chain, privacy of who did it; another business: not found
    const cajero = await crearCajero(e.negocio.id)
    const cadenaCajero = await json(await getCadenaCajero(req(`/api/operativo/caja/${e.negocio.slug}/ventas/${a.id}/cadena`, cajero.cookie), slugIdCtx(e.negocio.slug, a.id)))
    expect(cadenaCajero.body.cambios.map((x: { registradoPor: string }) => x.registradoPor)).toEqual(["Responsable del negocio", "Responsable del negocio"])
    const ajeno = await escenario()
    expect((await json(await getCadenaOwner(req(`/api/negocio/caja/ventas/${a.id}/cadena`, ajeno.owner), idCtx(a.id)))).status).toBe(404)
  })
})

describe("F4-C5 — owner-only P1 thresholds", () => {
  ephemeralTest("defaults, valid values, null resets, invalid values refused, audit without values, cashier refused", async () => {
    const e = await escenario()
    const g = await json(await getConfig(req("/api/negocio/caja/configuracion-cambios", e.owner)))
    expect(g.body).toMatchObject({ configurados: { antiguedadDias: null, cadenaCambios: null }, vigentes: { antiguedadDias: 30, cadenaCambios: 3 } })
    const p = await json(await patchConfig(req("/api/negocio/caja/configuracion-cambios", e.owner, "PATCH", { antiguedadDias: 45, cadenaCambios: 5 })))
    expect(p.body.vigentes).toEqual({ antiguedadDias: 45, cadenaCambios: 5 })
    for (const malo of [{ antiguedadDias: 0 }, { antiguedadDias: 3651 }, { cadenaCambios: 1.5 }, { cadenaCambios: "10" }, { cadenaCambios: 1001 }, {}]) {
      expect((await patchConfig(req("/api/negocio/caja/configuracion-cambios", e.owner, "PATCH", malo))).status).toBe(400)
    }
    const reset = await json(await patchConfig(req("/api/negocio/caja/configuracion-cambios", e.owner, "PATCH", { cadenaCambios: null })))
    expect(reset.body.vigentes).toEqual({ antiguedadDias: 45, cadenaCambios: 3 })
    const audits = await db.auditLog.findMany({ where: { accion: "negocio.config_cambiada", recursoId: e.negocio.id } })
    expect(audits).toHaveLength(2)
    expect(audits.every((a) => !/45|"5"|: ?5\b/.test(a.detalle ?? ""))).toBe(true)
    const cajero = await crearCajero(e.negocio.id)
    expect([401, 403]).toContain((await patchConfig(req("/api/negocio/caja/configuracion-cambios", cajero.cookie, "PATCH", { antiguedadDias: 9 }))).status)
    expect([401, 403]).toContain((await getConfig(req("/api/negocio/caja/configuracion-cambios", cajero.cookie))).status)
  })
})

describe("F4-C5 — D7 owner breakdown", () => {
  ephemeralTest("exchanges apart; refunds paid by method and payment day; pending apart; compensation never money; resumenHoy unchanged", async () => {
    const e = await escenario()
    const venta = await ventaOwner(e, e.saphirus.id, 3) // $6.000 cash
    // exchange 1: 1 Saphirus ($2.000) → 1 Redmi ($1.000), D− $1.000 refunded now in cash
    const c1 = await cambioOwner(e, venta.id, cuerpoCambio(venta, e.redmi.id, "2000.00", "1000.00", { reintegro: { modo: "REALIZADO", medio: "EFECTIVO" } }))
    expect(c1.status).toBe(201)
    // exchange 2: same, D− left PENDING
    const c2 = await cambioOwner(e, venta.id, cuerpoCambio(venta, e.redmi.id, "2000.00", "1000.00", { reintegro: { modo: "PENDIENTE" } }))
    expect(c2.status).toBe(201)
    // a plain F4-A return of the last unit, refunded by transfer
    const dev = await json(await postDevolucionOwner(req(`/api/negocio/caja/ventas/${venta.id}/devoluciones`, e.owner, "POST", { tipo: "DEVOLUCION_PARCIAL", motivo: "Devuelve", items: [{ ventaItemId: venta.items[0].id, cantidad: 1, reingresaStock: false }], reintegro: { modo: "REALIZADO", medio: "TRANSFERENCIA" }, confirmo: true }, randomUUID()), idCtx(venta.id)))
    expect(dev.status).toBe(201)

    const hoy = await json(await getVentasHoy(req("/api/negocio/caja/ventas", e.owner)))
    expect(hoy.status).toBe(200)
    expect(Object.keys(hoy.body.resumenHoy).sort()).toEqual(["cantidadVentas", "totalDevuelto", "totalEfectivo", "totalNeto", "totalOtro", "totalTransferencia", "totalVendido"])
    expect(hoy.body.resumenHoy).toMatchObject({ totalVendido: 8000, totalEfectivo: 6000, totalDevuelto: 6000 }) // credit never in cash
    expect(hoy.body.desgloseHoy).toEqual({
      porCambios: { cantidadVentas: 2, ventas: 2000, cantidadDevoluciones: 2, devuelto: 4000 },
      reintegrosPagados: { EFECTIVO: 1000, TRANSFERENCIA: 2000, OTRO: 0, total: 3000, cantidad: 2, porCambios: 1000 },
      reintegrosPendientes: { total: 1000, cantidad: 1 },
      reintegrosPendientesHoy: { total: 1000, cantidad: 1 },
      compensacionInterna: 2000,
    })
    // paying the pending exchange difference moves it to «paid» (its payment day), never twice
    const pendiente = await db.devolucionVenta.findFirstOrThrow({ where: { negocioId: e.negocio.id, reintegroEstado: "PENDIENTE" } })
    expect((await json(await postReintegroOwner(req(`/api/negocio/caja/devoluciones/${pendiente.id}/reintegro`, e.owner, "POST", { medio: "OTRO", confirmo: true }, randomUUID()), idCtx(pendiente.id)))).status).toBe(201)
    const luego = await json(await getVentasHoy(req("/api/negocio/caja/ventas", e.owner)))
    expect(luego.body.desgloseHoy.reintegrosPagados).toEqual({ EFECTIVO: 1000, TRANSFERENCIA: 2000, OTRO: 1000, total: 4000, cantidad: 3, porCambios: 2000 })
    expect(luego.body.desgloseHoy.reintegrosPendientes).toEqual({ total: 0, cantidad: 0 })
    expect(luego.body.resumenHoy).toEqual(hoy.body.resumenHoy) // sales/money summary unchanged by the refund payment
  })

  ephemeralTest("shift detail: exchanges line of that shift; a CLOSED shift keeps its frozen figures; the cashier never reaches owner data", async () => {
    const e = await escenario()
    const cajero = await crearCajero(e.negocio.id)
    const abierto = await json(await postTurnoCajero(req(`/api/operativo/caja/${e.negocio.slug}/turno`, cajero.cookie, "POST", { fondoInicial: 0 }, randomUUID()), slugCtx(e.negocio.slug)))
    expect(abierto.status).toBeLessThan(300)
    const turnoId: string = abierto.body.turno?.id ?? abierto.body.id
    const venta = await json(await postVentaCajero(req(`/api/operativo/caja/${e.negocio.slug}/ventas`, cajero.cookie, "POST", { metodoPago: "EFECTIVO", items: [{ productoId: e.redmi.id, cantidad: 1 }] }, randomUUID()), slugCtx(e.negocio.slug)))
    expect(venta.status).toBe(201)
    // Redmi ($1.000) → Saphirus ($2.000): D+ $1.000 charged in cash in THIS shift, credit $1.000
    const cambio = await json(await postCambioCajero(req(`/api/operativo/caja/${e.negocio.slug}/ventas/${venta.body.id}/cambios`, cajero.cookie, "POST", cuerpoCambio(venta.body, e.saphirus.id, "1000.00", "2000.00", { medioDiferencia: "EFECTIVO" }), randomUUID()), slugIdCtx(e.negocio.slug, venta.body.id)))
    expect(cambio.status).toBe(201)
    const det = await json(await getTurnoOwner(req(`/api/negocio/caja/turnos/${turnoId}`, e.owner), idCtx(turnoId)))
    expect(det.body.cambios).toEqual({ cantidad: 1, diferenciaCobrada: 1000, reintegradoEfectivo: 0, compensacionInterna: 1000 })
    expect(det.body.efectivo.esperado).toBe(2000) // sale $1.000 + D+ $1.000, never the credit

    const cierre = await json(await postTurnoCajero(req(`/api/operativo/caja/${e.negocio.slug}/turno`, cajero.cookie, "POST", { action: "close", turnoCajaId: turnoId, efectivoContado: "2000.00" }, randomUUID()), slugCtx(e.negocio.slug)))
    expect(cierre.status).toBeLessThan(300)
    const cerrado = await json(await getTurnoOwner(req(`/api/negocio/caja/turnos/${turnoId}`, e.owner), idCtx(turnoId)))
    // a later exchange (owner, no shift) of the same sale never touches the closed shift
    const otra = await cambioOwner(e, cambio.body.ventaNueva.id, cuerpoCambio(cambio.body.ventaNueva, e.saphirus.id, "2000.00", "2000.00"))
    expect(otra.status).toBe(201)
    const despues = await json(await getTurnoOwner(req(`/api/negocio/caja/turnos/${turnoId}`, e.owner), idCtx(turnoId)))
    expect(despues.body.efectivo).toEqual(cerrado.body.efectivo)
    expect(despues.body.cambios).toEqual(cerrado.body.cambios)

    // blind close: owner endpoints refuse the cashier session
    for (const r of [
      await getVentasHoy(req("/api/negocio/caja/ventas", cajero.cookie)),
      await getTurnoOwner(req(`/api/negocio/caja/turnos/${turnoId}`, cajero.cookie), idCtx(turnoId)),
      await getConfig(req("/api/negocio/caja/configuracion-cambios", cajero.cookie)),
    ]) expect([401, 403]).toContain(r.status)
  })
})

describe("F4-C5 — partial compensation: only the refundable amount is money", () => {
  ephemeralTest("returned 2000, compensated 1500 with what is taken, 500 refundable: shown, pending and paid as 500 — never 2000, the credit never money", async () => {
    const e = await escenario()
    const funda = await db.producto.create({ data: { nombre: "Funda", precio: 1500, negocioId: e.negocio.id } })
    const venta = await ventaOwner(e, e.saphirus.id, 2) // $4.000 cash
    const cambio = await cambioOwner(e, venta.id, cuerpoCambio(venta, funda.id, "2000.00", "1500.00", { reintegro: { modo: "PENDIENTE" } }))
    expect(cambio.status).toBe(201)
    expect(cambio.body.cambio.importes).toEqual({ salida: "2000.00", entrada: "1500.00", credito: "1500.00", diferenciaCobrada: "0.00", diferenciaReintegro: "500.00" })

    // API: the return shows its commercial value and, apart, the refundable money
    const det = await json(await getDetalleOwner(req(`/api/negocio/caja/ventas/${venta.id}/devoluciones`, e.owner), idCtx(venta.id)))
    const devolucion = det.body.venta.devoluciones[0]
    expect(devolucion).toMatchObject({ importe: 2000, importeReintegrable: 500, cambioId: cambio.body.cambio.id, reintegroEstado: "PENDIENTE" })
    const hoy = await json(await getVentasHoy(req("/api/negocio/caja/ventas", e.owner)))
    expect(hoy.body.resumenHoy.totalEfectivo).toBe(4000) // the 1500 credit is never cash
    expect(hoy.body.desgloseHoy).toMatchObject({ reintegrosPendientes: { total: 500, cantidad: 1 }, reintegrosPendientesHoy: { total: 500, cantidad: 1 }, compensacionInterna: 1500 })
    expect(hoy.body.desgloseHoy.reintegrosPagados).toMatchObject({ total: 0, cantidad: 0 })

    // paying the pending difference hands back 500 in cash (the server decides the amount)
    const pago = await json(await postReintegroOwner(req(`/api/negocio/caja/devoluciones/${devolucion.id}/reintegro`, e.owner, "POST", { medio: "EFECTIVO", confirmo: true }, randomUUID()), idCtx(devolucion.id)))
    expect(pago.status).toBe(201)
    const fila = await db.devolucionVenta.findUniqueOrThrow({ where: { id: devolucion.id } })
    expect(fila.reintegroEstado).toBe("REALIZADO")
    const movimientos = await db.movimientoFinanciero.findMany({ where: { operacionId: fila.reintegroOperacionId! }, select: { importeDecimal: true } })
    expect(movimientos.map((m) => m.importeDecimal?.toFixed(2))).toEqual(["-500.00"])
    const luego = await json(await getVentasHoy(req("/api/negocio/caja/ventas", e.owner)))
    expect(luego.body.desgloseHoy.reintegrosPagados).toEqual({ EFECTIVO: 500, TRANSFERENCIA: 0, OTRO: 0, total: 500, cantidad: 1, porCambios: 500 })
    expect(luego.body.desgloseHoy.reintegrosPendientes).toEqual({ total: 0, cantidad: 0 })
    const despues = await json(await getDetalleOwner(req(`/api/negocio/caja/ventas/${venta.id}/devoluciones`, e.owner), idCtx(venta.id)))
    expect(despues.body.venta.devoluciones[0]).toMatchObject({ importe: 2000, importeReintegrable: 500, reintegroEstado: "REALIZADO", reintegroMedio: "EFECTIVO" })
  })
})
