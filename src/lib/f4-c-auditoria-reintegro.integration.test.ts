/// <reference types="bun-types" />
// ============================================
// Audit of refunds: commercial value returned vs money actually handed back
// (REAL ephemeral PostgreSQL)
// ============================================
// Real owner / cashier routes + real PostgreSQL with every migration applied
// (DELIGO_EPHEMERAL_TEST_DB=1). The event venta.devolucion_reintegro_registrado
// keeps its historical `importe` (commercial value of the return) and, since
// detalleVersion 2, says exactly how much of it was compensated by an exchange,
// how much money was actually refunded, by which method, in which shift and
// from which financial account. Financial behaviour is unchanged: these tests
// also re-check that the money left exactly once and for the refundable amount.

import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createOperationalSession, createSession, OPERATIONAL_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/auth"
import { POST as postVentaOwner } from "@/app/api/negocio/caja/ventas/route"
import { POST as postTurnoCajero } from "@/app/api/operativo/caja/[slug]/turno/route"
import { POST as postDevolucionOwner } from "@/app/api/negocio/caja/ventas/[id]/devoluciones/route"
import { POST as postReintegroOwner } from "@/app/api/negocio/caja/devoluciones/[id]/reintegro/route"
import { POST as postCambioOwner } from "@/app/api/negocio/caja/ventas/[id]/cambios/route"

setDefaultTimeout(240_000)

const testDatabaseUrl = process.env.DELIGO_TEST_DATABASE_URL
const isEphemeralIntegrationDb = process.env.DELIGO_EPHEMERAL_TEST_DB === "1"
if (!testDatabaseUrl || process.env.DATABASE_URL !== testDatabaseUrl) {
  throw new Error("Este test de integración requiere DELIGO_TEST_DATABASE_URL y DATABASE_URL apuntando a la misma base de prueba.")
}
const declaredEnvironment = process.env.DELIGO_ENVIRONMENT ?? process.env.RAILWAY_ENVIRONMENT_NAME ?? process.env.APP_ENV
if (!declaredEnvironment || declaredEnvironment.toUpperCase() !== "TESTING") {
  throw new Error("La suite de auditoría de reintegros sólo puede ejecutarse con DELIGO_ENVIRONMENT=TESTING.")
}
process.env.DELIGO_F10_B2_2_B_SHIFT_UI_ENABLED = "true"
// Writes real rows: only against the ephemeral test database.
const ephemeralTest = isEphemeralIntegrationDb ? test : test.skip

afterAll(async () => {
  await db.$disconnect()
})

const json = async (res: Response) => ({ status: res.status, replayed: res.headers.get("Idempotency-Replayed") === "true", body: await res.json() })
const req = (url: string, cookie: string, body: unknown, key: string = randomUUID()) =>
  new NextRequest(`http://localhost${url}`, { method: "POST", headers: { cookie, "content-type": "application/json", "idempotency-key": key }, body: JSON.stringify(body) })
const idCtx = (id: string) => ({ params: Promise.resolve({ id }) })

async function escenario() {
  const suffix = randomUUID()
  const negocio = await db.negocio.create({
    data: { slug: `test-audrei-${suffix}`, nombre: `Test auditoría reintegro ${suffix}`, usuario: `test-audrei-${suffix}`, email: `test-audrei-${suffix}@example.test`, password: "fixture", rubro: "negocio", aprobado: true, suspendido: false, empleadosActivos: true, salonActivo: true, cajaTurnosModo: "OPCIONAL" },
  })
  const owner = `${SESSION_COOKIE_NAME}=${await createSession(negocio.id, "negocio")}`
  // An open cashier shift: the owner's cash refunds leave from that register.
  const cuentaOp = await db.cuentaOperativa.create({ data: { nombre: "Ana", email: `test-audrei-${randomUUID()}@example.test`, activo: true, eliminado: false } })
  const empleado = await db.empleado.create({ data: { nombre: "Ana", codigo: randomUUID().slice(0, 8).toUpperCase(), negocioId: negocio.id, cuentaOperativaId: cuentaOp.id, areaOperativa: "caja", activo: true, eliminado: false } })
  const allowlist = new Set((process.env.DELIGO_F10_B2_2_B_CONTROLLED_EMPLOYEE_IDS ?? "").split(/[\s,;]+/).filter(Boolean))
  allowlist.add(empleado.id)
  process.env.DELIGO_F10_B2_2_B_CONTROLLED_EMPLOYEE_IDS = [...allowlist].join(",")
  const cajero = `${OPERATIONAL_SESSION_COOKIE_NAME}=${await createOperationalSession(cuentaOp.id)}`
  const abierto = await json(await postTurnoCajero(req(`/api/operativo/caja/${negocio.slug}/turno`, cajero, { fondoInicial: 0 }), { params: Promise.resolve({ slug: negocio.slug }) }))
  expect(abierto.status).toBe(201)
  const turno = await db.turnoCaja.findUniqueOrThrow({ where: { id: abierto.body.turno.id as string }, select: { id: true, cajaFisicaId: true } })
  const premium = await db.producto.create({ data: { nombre: "Yerba premium", precio: 4500, negocioId: negocio.id, controlStock: true, stockCantidad: 10 } })
  const comun = await db.producto.create({ data: { nombre: "Yerba común", precio: 3200, negocioId: negocio.id, controlStock: true, stockCantidad: 10 } })

  const vender = async (productoId: string, cantidad: number) => {
    const r = await json(await postVentaOwner(req("/api/negocio/caja/ventas", owner, { metodoPago: "EFECTIVO", items: [{ productoId, cantidad }] })))
    expect(r.status).toBe(201)
    return { id: r.body.id as string, itemId: r.body.items[0].id as string }
  }
  const devolver = async (ventaId: string, body: unknown) => json(await postDevolucionOwner(req(`/api/negocio/caja/ventas/${ventaId}/devoluciones`, owner, body), idCtx(ventaId)))
  const cambiar = async (ventaId: string, body: unknown) => json(await postCambioOwner(req(`/api/negocio/caja/ventas/${ventaId}/cambios`, owner, body), idCtx(ventaId)))
  const pagar = async (devolucionId: string, medio: string, key: string = randomUUID()) =>
    json(await postReintegroOwner(req(`/api/negocio/caja/devoluciones/${devolucionId}/reintegro`, owner, { medio, confirmo: true }, key), idCtx(devolucionId)))
  const eventos = async (accion: string) =>
    (await db.auditLog.findMany({ where: { accion, detalle: { contains: negocio.id } }, orderBy: { fecha: "asc" } })).map((a) => JSON.parse(a.detalle))
  const salidas = async () =>
    (await db.operacionFinanciera.findMany({ where: { negocioId: negocio.id, tipo: "DEVOLUCION_VENTA" }, include: { movimientos: true } })).flatMap((o) => o.movimientos.map((m) => m.importeDecimal!.toFixed(2)))
  // The register's cash account is created by its first cash movement: read it afterwards.
  const cuentaCaja = () => db.cuentaFinanciera.findFirstOrThrow({ where: { negocioId: negocio.id, cajaFisicaId: turno.cajaFisicaId } })
  return { negocio, owner, turno, premium, comun, vender, devolver, cambiar, pagar, eventos, salidas, cuentaCaja }
}

/** Exchange 1 premium (4500) for 1 regular (3200): D− = 1300, with the given refund mode. */
const cambioMenorValor = (itemId: string, comunId: string, reintegro: unknown) => ({
  motivo: "Prefiere la común",
  salen: [{ ventaItemId: itemId, cantidad: 1, reingresaStock: true }],
  entran: [{ productoId: comunId, cantidad: 1 }],
  reintegro,
  esperado: { salida: "4500.00", entrada: "3200.00" },
  confirmo: true,
})

describe("Refund audit — commercial value returned vs money actually refunded", () => {
  ephemeralTest("plain F4-A return (nothing compensated), paid later in cash: returned = refunded; one outflow; account and shift recorded", async () => {
    const e = await escenario()
    const venta = await e.vender(e.premium.id, 2)
    const dev = await e.devolver(venta.id, { tipo: "DEVOLUCION_PARCIAL", motivo: "No le gustó", items: [{ ventaItemId: venta.itemId, cantidad: 1, reingresaStock: true }], reintegro: { modo: "PENDIENTE" }, confirmo: true })
    expect(dev.status).toBe(201)
    const pago = await e.pagar(dev.body.devolucion.id, "EFECTIVO")
    expect(pago.status).toBe(201)

    expect(await e.salidas()).toEqual(["-4500.00"])
    const [evento] = await e.eventos("venta.devolucion_reintegro_registrado")
    expect(evento).toMatchObject({
      devolucionId: dev.body.devolucion.id,
      importe: "4500", // historical field, unchanged meaning (commercial value)
      detalleVersion: 2,
      importeDevuelto: "4500.00",
      importeCompensado: "0.00",
      importeReintegrado: "4500.00",
      cambioId: null,
      reintegroMedio: "EFECTIVO",
      reintegroTurnoCajaId: e.turno.id,
      cuentaFinanciera: { evidencia: "VERIFICADA", movimientos: [{ cuentaFinancieraId: (await e.cuentaCaja()).id, clave: `efectivo_caja_fisica:${e.turno.cajaFisicaId}`, cajaFisicaId: e.turno.cajaFisicaId, importe: "-4500.00" }] },
    })
    expect(evento.reintegroOperacionId).toBeTruthy()
  })

  ephemeralTest("exchange with partial compensation and IMMEDIATE cash refund: the exchange audit separates 4500 / 3200 / 1300; one outflow of 1300; no refund event", async () => {
    const e = await escenario()
    const venta = await e.vender(e.premium.id, 2)
    const r = await e.cambiar(venta.id, cambioMenorValor(venta.itemId, e.comun.id, { modo: "REALIZADO", medio: "EFECTIVO" }))
    expect(r.status).toBe(201)
    expect(await e.salidas()).toEqual(["-1300.00"])
    const [cambio] = await e.eventos("venta.cambio")
    expect(cambio).toMatchObject({ salida: "4500.00", entrada: "3200.00", credito: "3200.00", diferenciaReintegro: "1300.00", liquidacion: "REINTEGRO", reintegroEstado: "REALIZADO", reintegroMedio: "EFECTIVO", reintegroTurnoCajaId: e.turno.id })
    expect(await e.eventos("venta.devolucion_reintegro_registrado")).toEqual([]) // paid inside the exchange: never a second money event
  })

  ephemeralTest("exchange with PENDING refund, paid later: no money until paid; then ONE outflow of 1300 and the event distinguishes 4500 / 3200 / 1300", async () => {
    const e = await escenario()
    const venta = await e.vender(e.premium.id, 2)
    const r = await e.cambiar(venta.id, cambioMenorValor(venta.itemId, e.comun.id, { modo: "PENDIENTE" }))
    expect(r.status).toBe(201)
    const devolucionId: string = r.body.cambio.devolucionId
    expect(await e.salidas()).toEqual([]) // pending: nothing left the register
    const [cambio] = await e.eventos("venta.cambio")
    expect(cambio).toMatchObject({ diferenciaReintegro: "1300.00", reintegroEstado: "PENDIENTE", reintegroMedio: null })

    const pago = await e.pagar(devolucionId, "EFECTIVO")
    expect(pago.status).toBe(201)
    expect(await e.salidas()).toEqual(["-1300.00"])
    const eventos = await e.eventos("venta.devolucion_reintegro_registrado")
    expect(eventos).toHaveLength(1)
    expect(eventos[0]).toMatchObject({
      devolucionId,
      importe: "4500",
      detalleVersion: 2,
      importeDevuelto: "4500.00",
      importeCompensado: "3200.00",
      importeReintegrado: "1300.00",
      cambioId: r.body.cambio.id,
      reintegroMedio: "EFECTIVO",
      reintegroTurnoCajaId: e.turno.id,
      cuentaFinanciera: { evidencia: "VERIFICADA", movimientos: [{ cuentaFinancieraId: (await e.cuentaCaja()).id, importe: "-1300.00" }] },
    })
    // The audit agrees with the ledger: refunded = −(outflow).
    expect(eventos[0].cuentaFinanciera.movimientos[0].importe).toBe(`-${eventos[0].importeReintegrado}`)
  })

  ephemeralTest("refund equal to zero: an equal-value exchange compensates everything — nothing to pay, no money, no refund event", async () => {
    const e = await escenario()
    const venta = await e.vender(e.comun.id, 2)
    const otra = await db.producto.create({ data: { nombre: "Yerba suave", precio: 3200, negocioId: e.negocio.id, controlStock: true, stockCantidad: 5 } })
    const r = await e.cambiar(venta.id, { motivo: "Otro sabor", salen: [{ ventaItemId: venta.itemId, cantidad: 1, reingresaStock: true }], entran: [{ productoId: otra.id, cantidad: 1 }], esperado: { salida: "3200.00", entrada: "3200.00" }, confirmo: true })
    expect(r.status).toBe(201)
    const devolucion = await db.devolucionVenta.findUniqueOrThrow({ where: { id: r.body.cambio.devolucionId } })
    expect([devolucion.importeDecimal.toFixed(2), devolucion.importeCompensadoDecimal.toFixed(2), devolucion.reintegroEstado]).toEqual(["3200.00", "3200.00", "NO_CORRESPONDE"])
    const intento = await e.pagar(devolucion.id, "EFECTIVO")
    expect([intento.status, intento.body.code]).toEqual([409, "REINTEGRO_YA_REGISTRADO"])
    expect(intento.body.error).toBe("Esta operación no tiene dinero a devolver.")
    expect(await e.salidas()).toEqual([])
    expect(await e.eventos("venta.devolucion_reintegro_registrado")).toEqual([])
  })

  ephemeralTest("paying an already-paid refund again: a NEW key is refused; the SAME key replays; never a second outflow nor a second event", async () => {
    const e = await escenario()
    const venta = await e.vender(e.premium.id, 2)
    const r = await e.cambiar(venta.id, cambioMenorValor(venta.itemId, e.comun.id, { modo: "PENDIENTE" }))
    const devolucionId: string = r.body.cambio.devolucionId
    const key = randomUUID()
    expect((await e.pagar(devolucionId, "EFECTIVO", key)).status).toBe(201)

    // A stale session (button still visible) sends a new attempt: refused, nothing written.
    const otra = await e.pagar(devolucionId, "EFECTIVO")
    expect([otra.status, otra.body.code]).toEqual([409, "REINTEGRO_YA_REGISTRADO"])
    expect(otra.body.error).toBe("El reintegro de esta devolución ya fue registrado.")
    // Another method does not open a door either.
    expect((await e.pagar(devolucionId, "TRANSFERENCIA")).body.code).toBe("REINTEGRO_YA_REGISTRADO")
    // The same attempt retried (network): idempotent replay, no new effect.
    const replay = await e.pagar(devolucionId, "EFECTIVO", key)
    expect([replay.status, replay.replayed]).toEqual([200, true])

    expect(await e.salidas()).toEqual(["-1300.00"])
    expect(await e.eventos("venta.devolucion_reintegro_registrado")).toHaveLength(1)
    const dev = await db.devolucionVenta.findUniqueOrThrow({ where: { id: devolucionId } })
    expect([dev.reintegroEstado, dev.reintegroMedio]).toEqual(["REALIZADO", "EFECTIVO"])
  })

  ephemeralTest("non-cash refund: the event records the method and that DeliGO moved no money of its own (no account movement)", async () => {
    const e = await escenario()
    const venta = await e.vender(e.premium.id, 2)
    const r = await e.cambiar(venta.id, cambioMenorValor(venta.itemId, e.comun.id, { modo: "PENDIENTE" }))
    expect((await e.pagar(r.body.cambio.devolucionId, "TRANSFERENCIA")).status).toBe(201)
    expect(await e.salidas()).toEqual([])
    const [evento] = await e.eventos("venta.devolucion_reintegro_registrado")
    expect(evento).toMatchObject({ importeDevuelto: "4500.00", importeCompensado: "3200.00", importeReintegrado: "1300.00", reintegroMedio: "TRANSFERENCIA", reintegroTurnoCajaId: null, reintegroOperacionId: null, cuentaFinanciera: { evidencia: "SIN_MOVIMIENTO" } })
  })
})
