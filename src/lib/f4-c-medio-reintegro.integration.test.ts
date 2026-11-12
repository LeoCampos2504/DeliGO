/// <reference types="bun-types" />
// ============================================
// The refund method recorded is EXACTLY the one chosen (REAL ephemeral PostgreSQL)
// ============================================
// 2026-11-11: the UI no longer preselects the sale's own method for a refund
// (caja-medio-reintegro.tsx). The server never inferred it either: these tests
// pin, on the real routes and every migration (DELIGO_EPHEMERAL_TEST_DB=1),
// that the method stored, the money that moves, the shift it is attributed to
// and the audit all follow the method SENT — independently of how the sale was
// charged — that a refund without a method is refused, and that the shift
// rules (OPCIONAL / OBLIGATORIO) and the blind close are unchanged.

import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createOperationalSession, createSession, OPERATIONAL_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/auth"
import { POST as postTurnoCajero } from "@/app/api/operativo/caja/[slug]/turno/route"
import { POST as postVentaCajero } from "@/app/api/operativo/caja/[slug]/ventas/route"
import { POST as postDevolucionCajero } from "@/app/api/operativo/caja/[slug]/ventas/[id]/devoluciones/route"
import { POST as postReintegroCajero } from "@/app/api/operativo/caja/[slug]/devoluciones/[id]/reintegro/route"
import { POST as postCambioOwner } from "@/app/api/negocio/caja/ventas/[id]/cambios/route"

setDefaultTimeout(240_000)

const testDatabaseUrl = process.env.DELIGO_TEST_DATABASE_URL
const isEphemeralIntegrationDb = process.env.DELIGO_EPHEMERAL_TEST_DB === "1"
if (!testDatabaseUrl || process.env.DATABASE_URL !== testDatabaseUrl) {
  throw new Error("Este test de integración requiere DELIGO_TEST_DATABASE_URL y DATABASE_URL apuntando a la misma base de prueba.")
}
const declaredEnvironment = process.env.DELIGO_ENVIRONMENT ?? process.env.RAILWAY_ENVIRONMENT_NAME ?? process.env.APP_ENV
if (!declaredEnvironment || declaredEnvironment.toUpperCase() !== "TESTING") {
  throw new Error("La suite del medio de reintegro sólo puede ejecutarse con DELIGO_ENVIRONMENT=TESTING.")
}
process.env.DELIGO_F10_B2_2_B_SHIFT_UI_ENABLED = "true"
// Writes real rows: only against the ephemeral test database.
const ephemeralTest = isEphemeralIntegrationDb ? test : test.skip

afterAll(async () => {
  await db.$disconnect()
})

type Res = { status: number; replayed: boolean; body: Record<string, any> }
const json = async (res: Response): Promise<Res> => ({ status: res.status, replayed: res.headers.get("Idempotency-Replayed") === "true", body: await res.json() })
const req = (url: string, cookie: string, body: unknown, key: string = randomUUID()) =>
  new NextRequest(`http://localhost${url}`, { method: "POST", headers: { cookie, "content-type": "application/json", "idempotency-key": key }, body: JSON.stringify(body) })

async function escenario(cajaTurnosModo: "OPCIONAL" | "OBLIGATORIO" = "OPCIONAL") {
  const suffix = randomUUID()
  const negocio = await db.negocio.create({
    data: { slug: `test-medrei-${suffix}`, nombre: `Test medio reintegro ${suffix}`, usuario: `test-medrei-${suffix}`, email: `test-medrei-${suffix}@example.test`, password: "fixture", rubro: "negocio", aprobado: true, suspendido: false, empleadosActivos: true, salonActivo: true, cajaTurnosModo },
  })
  const owner = `${SESSION_COOKIE_NAME}=${await createSession(negocio.id, "negocio")}`
  const cajero = async (nombre: string) => {
    const cuentaOp = await db.cuentaOperativa.create({ data: { nombre, email: `test-medrei-${randomUUID()}@example.test`, activo: true, eliminado: false } })
    const empleado = await db.empleado.create({ data: { nombre, codigo: randomUUID().slice(0, 8).toUpperCase(), negocioId: negocio.id, cuentaOperativaId: cuentaOp.id, areaOperativa: "caja", activo: true, eliminado: false } })
    const allowlist = new Set((process.env.DELIGO_F10_B2_2_B_CONTROLLED_EMPLOYEE_IDS ?? "").split(/[\s,;]+/).filter(Boolean))
    allowlist.add(empleado.id)
    process.env.DELIGO_F10_B2_2_B_CONTROLLED_EMPLOYEE_IDS = [...allowlist].join(",")
    return { empleado, cookie: `${OPERATIONAL_SESSION_COOKIE_NAME}=${await createOperationalSession(cuentaOp.id)}` }
  }
  const slugCtx = { params: Promise.resolve({ slug: negocio.slug }) }
  const ctx = (id: string) => ({ params: Promise.resolve({ slug: negocio.slug, id }) })
  // Ana: cashier with her own open shift (fund 0).
  const ana = await cajero("Ana")
  const abierto = await json(await postTurnoCajero(req(`/api/operativo/caja/${negocio.slug}/turno`, ana.cookie, { fondoInicial: 0 }), slugCtx))
  expect(abierto.status).toBe(201)
  const turno = await db.turnoCaja.findUniqueOrThrow({ where: { id: abierto.body.turno.id as string }, select: { id: true, cajaFisicaId: true } })
  const premium = await db.producto.create({ data: { nombre: "Yerba premium", precio: 4500, negocioId: negocio.id, controlStock: true, stockCantidad: 50 } })
  const comun = await db.producto.create({ data: { nombre: "Yerba común", precio: 3200, negocioId: negocio.id, controlStock: true, stockCantidad: 50 } })

  const vender = async (metodoPago: "EFECTIVO" | "TRANSFERENCIA", productoId = premium.id) => {
    const r = await json(await postVentaCajero(req(`/api/operativo/caja/${negocio.slug}/ventas`, ana.cookie, { metodoPago, items: [{ productoId, cantidad: 1 }] }), slugCtx))
    expect(r.status).toBe(201)
    return { id: r.body.id as string, itemId: r.body.items[0].id as string }
  }
  const devolver = async (cookie: string, venta: { id: string; itemId: string }, reintegro: unknown) =>
    json(await postDevolucionCajero(req(`/api/operativo/caja/${negocio.slug}/ventas/${venta.id}/devoluciones`, cookie, { tipo: "DEVOLUCION_PARCIAL", motivo: "No le gustó", items: [{ ventaItemId: venta.itemId, cantidad: 1, reingresaStock: true }], reintegro, confirmo: true }), ctx(venta.id)))
  const pagar = async (cookie: string, devolucionId: string, body: Record<string, unknown>) =>
    json(await postReintegroCajero(req(`/api/operativo/caja/${negocio.slug}/devoluciones/${devolucionId}/reintegro`, cookie, { confirmo: true, ...body }), ctx(devolucionId)))
  const cambiar = async (venta: { id: string; itemId: string }, reintegro: unknown) =>
    json(await postCambioOwner(req(`/api/negocio/caja/ventas/${venta.id}/cambios`, owner, { motivo: "Prefiere la común", salen: [{ ventaItemId: venta.itemId, cantidad: 1, reingresaStock: true }], entran: [{ productoId: comun.id, cantidad: 1 }], reintegro, esperado: { salida: "4500.00", entrada: "3200.00" }, confirmo: true }), { params: Promise.resolve({ id: venta.id }) }))

  /** Every refund outflow of the business: amount, shift and register account. */
  const salidas = async () =>
    (await db.operacionFinanciera.findMany({ where: { negocioId: negocio.id, tipo: "DEVOLUCION_VENTA" }, include: { movimientos: { include: { cuenta: true } } }, orderBy: { createdAt: "asc" } }))
      .map((o) => ({ turnoCajaId: o.turnoCajaId, importe: o.movimientos.map((m) => m.importeDecimal!.toFixed(2)).join(","), caja: o.movimientos[0]?.cuenta.cajaFisicaId ?? null }))
  const auditoria = async (accion: string) =>
    (await db.auditLog.findMany({ where: { accion, detalle: { contains: negocio.id } }, orderBy: { fecha: "asc" } })).map((a) => JSON.parse(a.detalle))
  return { negocio, owner, ana, turno, cajero, slugCtx, comun, vender, devolver, pagar, cambiar, salidas, auditoria }
}

describe("A. immediate return: the method chosen, never the sale's", () => {
  ephemeralTest("sale charged by TRANSFER, refund chosen in CASH: cash leaves the cashier's own shift; stored and audited as EFECTIVO", async () => {
    const e = await escenario()
    const venta = await e.vender("TRANSFERENCIA")
    const r = await e.devolver(e.ana.cookie, venta, { modo: "REALIZADO", medio: "EFECTIVO" })
    expect(r.status).toBe(201)
    const dev = await db.devolucionVenta.findUniqueOrThrow({ where: { id: r.body.devolucion.id } })
    expect([dev.reintegroEstado, dev.reintegroMedio, dev.reintegroTurnoCajaId]).toEqual(["REALIZADO", "EFECTIVO", e.turno.id])
    expect(await e.salidas()).toEqual([{ turnoCajaId: e.turno.id, importe: "-4500.00", caja: e.turno.cajaFisicaId }])
    const [audit] = await e.auditoria("venta.devolucion_parcial")
    expect(audit).toMatchObject({ reintegroEstado: "REALIZADO", reintegroMedio: "EFECTIVO", reintegroTurnoCajaId: e.turno.id })
  })

  ephemeralTest("sale charged in CASH, refund chosen by TRANSFER: no cash leaves; stored and audited as TRANSFERENCIA", async () => {
    const e = await escenario()
    const venta = await e.vender("EFECTIVO")
    const r = await e.devolver(e.ana.cookie, venta, { modo: "REALIZADO", medio: "TRANSFERENCIA" })
    expect(r.status).toBe(201)
    const dev = await db.devolucionVenta.findUniqueOrThrow({ where: { id: r.body.devolucion.id } })
    expect([dev.reintegroMedio, dev.reintegroTurnoCajaId, dev.reintegroOperacionId]).toEqual(["TRANSFERENCIA", null, null])
    expect(await e.salidas()).toEqual([])
    const [audit] = await e.auditoria("venta.devolucion_parcial")
    expect(audit).toMatchObject({ reintegroMedio: "TRANSFERENCIA", reintegroTurnoCajaId: null })
  })
})

describe("B. exchange with the difference refunded now", () => {
  ephemeralTest("sale by TRANSFER → difference refunded in CASH: one outflow of 1300 from the open register; by TRANSFER on a cash sale: no outflow", async () => {
    const e = await escenario()
    const r1 = await e.cambiar(await e.vender("TRANSFERENCIA"), { modo: "REALIZADO", medio: "EFECTIVO" })
    expect(r1.status).toBe(201)
    expect(await e.salidas()).toEqual([{ turnoCajaId: e.turno.id, importe: "-1300.00", caja: e.turno.cajaFisicaId }])
    const r2 = await e.cambiar(await e.vender("EFECTIVO"), { modo: "REALIZADO", medio: "TRANSFERENCIA" })
    expect(r2.status).toBe(201)
    expect(await e.salidas()).toHaveLength(1) // the transfer moved no cash
    const cambios = await e.auditoria("venta.cambio")
    expect(cambios.map((c) => [c.diferenciaReintegro, c.reintegroMedio])).toEqual([["1300.00", "EFECTIVO"], ["1300.00", "TRANSFERENCIA"]])
    const devs = await db.devolucionVenta.findMany({ where: { negocioId: e.negocio.id }, orderBy: { createdAt: "asc" } })
    expect(devs.map((d) => d.reintegroMedio)).toEqual(["EFECTIVO", "TRANSFERENCIA"])
  })
})

describe("C. later payment of a pending refund", () => {
  ephemeralTest("pending refund of a TRANSFER sale paid in CASH; of a CASH sale paid by TRANSFER: money and audit follow the method sent", async () => {
    const e = await escenario()
    const d1 = await e.devolver(e.ana.cookie, await e.vender("TRANSFERENCIA"), { modo: "PENDIENTE" })
    const d2 = await e.devolver(e.ana.cookie, await e.vender("EFECTIVO"), { modo: "PENDIENTE" })
    expect(await e.salidas()).toEqual([])
    expect((await e.pagar(e.ana.cookie, d1.body.devolucion.id, { medio: "EFECTIVO" })).status).toBe(201)
    expect((await e.pagar(e.ana.cookie, d2.body.devolucion.id, { medio: "TRANSFERENCIA" })).status).toBe(201)
    expect(await e.salidas()).toEqual([{ turnoCajaId: e.turno.id, importe: "-4500.00", caja: e.turno.cajaFisicaId }])
    const eventos = await e.auditoria("venta.devolucion_reintegro_registrado")
    expect(eventos.map((ev) => [ev.devolucionId, ev.reintegroMedio, ev.importeReintegrado, ev.cuentaFinanciera.evidencia])).toEqual([
      [d1.body.devolucion.id, "EFECTIVO", "4500.00", "VERIFICADA"],
      [d2.body.devolucion.id, "TRANSFERENCIA", "4500.00", "SIN_MOVIMIENTO"],
    ])
  })
})

describe("the server never infers a method", () => {
  ephemeralTest("money handed back with NO method is refused and writes nothing (return, exchange and later payment)", async () => {
    const e = await escenario()
    const venta = await e.vender("TRANSFERENCIA")
    const sinMedio = await e.devolver(e.ana.cookie, venta, { modo: "REALIZADO" })
    expect(sinMedio.status).toBe(400)
    const cambioSinMedio = await e.cambiar(venta, { modo: "REALIZADO" })
    expect(cambioSinMedio.status).toBe(400)
    expect(await db.devolucionVenta.count({ where: { negocioId: e.negocio.id } })).toBe(0)
    expect(await db.cambioVenta.count({ where: { negocioId: e.negocio.id } })).toBe(0)

    const pendiente = await e.devolver(e.ana.cookie, venta, { modo: "PENDIENTE" })
    for (const body of [{}, { medio: null }, { medio: "" }, { medio: "CHEQUE" }]) {
      const r = await e.pagar(e.ana.cookie, pendiente.body.devolucion.id, body)
      expect([r.status, r.body.code]).toEqual([400, "REINTEGRO_INVALIDO"])
    }
    const dev = await db.devolucionVenta.findUniqueOrThrow({ where: { id: pendiente.body.devolucion.id } })
    expect([dev.reintegroEstado, dev.reintegroMedio]).toEqual(["PENDIENTE", null])
    expect(await e.salidas()).toEqual([])
    expect(await e.auditoria("venta.devolucion_reintegro_registrado")).toEqual([])
  })
})

describe("shift rules and blind close are unchanged", () => {
  ephemeralTest("OBLIGATORIO: a cashier without an open shift cannot hand back CASH (nothing written); a TRANSFER needs no shift", async () => {
    const e = await escenario("OBLIGATORIO")
    const beto = await e.cajero("Beto") // no shift
    const pendiente = await e.devolver(e.ana.cookie, await e.vender("TRANSFERENCIA"), { modo: "PENDIENTE" })
    const efectivo = await e.pagar(beto.cookie, pendiente.body.devolucion.id, { medio: "EFECTIVO" })
    expect([efectivo.status, efectivo.body.code]).toEqual([409, "TURNO_REQUERIDO"])
    expect((await db.devolucionVenta.findUniqueOrThrow({ where: { id: pendiente.body.devolucion.id } })).reintegroEstado).toBe("PENDIENTE")
    expect(await e.salidas()).toEqual([])
    expect((await e.pagar(beto.cookie, pendiente.body.devolucion.id, { medio: "TRANSFERENCIA" })).status).toBe(201)
    expect(await e.salidas()).toEqual([])
  })

  ephemeralTest("OPCIONAL: a cashier without an open shift may hand back CASH; it is recorded without shift or register", async () => {
    const e = await escenario("OPCIONAL")
    const beto = await e.cajero("Beto") // no shift
    const pendiente = await e.devolver(e.ana.cookie, await e.vender("TRANSFERENCIA"), { modo: "PENDIENTE" })
    expect((await e.pagar(beto.cookie, pendiente.body.devolucion.id, { medio: "EFECTIVO" })).status).toBe(201)
    expect(await e.salidas()).toEqual([{ turnoCajaId: null, importe: "-4500.00", caja: null }])
  })

  ephemeralTest("blind close: only the CASH refunds lower the shift's expected cash; the cashier's close answer never reveals it", async () => {
    const e = await escenario()
    await e.vender("EFECTIVO", e.comun.id) // +3200 cash
    await e.devolver(e.ana.cookie, await e.vender("TRANSFERENCIA"), { modo: "REALIZADO", medio: "EFECTIVO" }) // −4500 cash (transfer sale)
    await e.devolver(e.ana.cookie, await e.vender("EFECTIVO"), { modo: "REALIZADO", medio: "TRANSFERENCIA" }) // +4500 cash sale, refund by transfer: no cash
    // Expected cash = 0 (fund) + 3200 + 4500 − 4500 = 3200.
    const cierre = await json(await postTurnoCajero(req(`/api/operativo/caja/${e.negocio.slug}/turno`, e.ana.cookie, { action: "close", turnoCajaId: e.turno.id, efectivoContado: "3200.00" }), e.slugCtx))
    expect(cierre.status).toBe(200)
    expect(JSON.stringify(cierre.body)).not.toMatch(/esperado|diferencia|3200/i)
    const turno = await db.turnoCaja.findUniqueOrThrow({ where: { id: e.turno.id } })
    expect([turno.estado, turno.efectivoEsperadoDecimal?.toFixed(2), turno.efectivoContadoDecimal?.toFixed(2)]).toEqual(["CERRADO_DECLARADO", "3200.00", "3200.00"])
  })
})
