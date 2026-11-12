/// <reference types="bun-types" />
// ============================================
// Paying the SAME pending refund concurrently (REAL ephemeral PostgreSQL)
// ============================================
// The UI refreshing a stale tab is a convenience, never the protection: two
// devices, two sessions or two tabs can still send the payment of one pending
// refund at the same time. These tests fire the real owner and cashier routes
// concurrently against the ephemeral database (DELIGO_EPHEMERAL_TEST_DB=1) and
// require, every time: exactly one payment, one financial operation with one
// movement for the refundable amount, one audit event, and the losers refused
// (or replayed, for the same key) without writing anything.

import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createOperationalSession, createSession, OPERATIONAL_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/auth"
import { POST as postVentaOwner } from "@/app/api/negocio/caja/ventas/route"
import { POST as postTurnoCajero } from "@/app/api/operativo/caja/[slug]/turno/route"
import { POST as postDevolucionOwner } from "@/app/api/negocio/caja/ventas/[id]/devoluciones/route"
import { POST as postReintegroOwner } from "@/app/api/negocio/caja/devoluciones/[id]/reintegro/route"
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
  throw new Error("La suite de reintegros concurrentes sólo puede ejecutarse con DELIGO_ENVIRONMENT=TESTING.")
}
process.env.DELIGO_F10_B2_2_B_SHIFT_UI_ENABLED = "true"
// Writes real rows: only against the ephemeral test database.
const ephemeralTest = isEphemeralIntegrationDb ? test : test.skip

afterAll(async () => {
  await db.$disconnect()
})

type Res = { status: number; replayed: boolean; body: { ok?: boolean; code?: string; error?: string } & Record<string, unknown> }
const json = async (res: Response): Promise<Res> => ({ status: res.status, replayed: res.headers.get("Idempotency-Replayed") === "true", body: await res.json() })
const req = (url: string, cookie: string, body: unknown, key: string = randomUUID()) =>
  new NextRequest(`http://localhost${url}`, { method: "POST", headers: { cookie, "content-type": "application/json", "idempotency-key": key }, body: JSON.stringify(body) })
const idCtx = (id: string) => ({ params: Promise.resolve({ id }) })

const RONDAS = 5 // each scenario is raced several times: one lucky interleaving proves little

async function escenario() {
  const suffix = randomUUID()
  const negocio = await db.negocio.create({
    data: { slug: `test-reicon-${suffix}`, nombre: `Test reintegro concurrente ${suffix}`, usuario: `test-reicon-${suffix}`, email: `test-reicon-${suffix}@example.test`, password: "fixture", rubro: "negocio", aprobado: true, suspendido: false, empleadosActivos: true, salonActivo: true, cajaTurnosModo: "OPCIONAL" },
  })
  const owner = `${SESSION_COOKIE_NAME}=${await createSession(negocio.id, "negocio")}`
  // An independent session: cashier "Ana" with her own open shift (the only open register).
  const cuentaOp = await db.cuentaOperativa.create({ data: { nombre: "Ana", email: `test-reicon-${randomUUID()}@example.test`, activo: true, eliminado: false } })
  const empleado = await db.empleado.create({ data: { nombre: "Ana", codigo: randomUUID().slice(0, 8).toUpperCase(), negocioId: negocio.id, cuentaOperativaId: cuentaOp.id, areaOperativa: "caja", activo: true, eliminado: false } })
  const allowlist = new Set((process.env.DELIGO_F10_B2_2_B_CONTROLLED_EMPLOYEE_IDS ?? "").split(/[\s,;]+/).filter(Boolean))
  allowlist.add(empleado.id)
  process.env.DELIGO_F10_B2_2_B_CONTROLLED_EMPLOYEE_IDS = [...allowlist].join(",")
  const cajero = `${OPERATIONAL_SESSION_COOKIE_NAME}=${await createOperationalSession(cuentaOp.id)}`
  const abierto = await json(await postTurnoCajero(req(`/api/operativo/caja/${negocio.slug}/turno`, cajero, { fondoInicial: 0 }), { params: Promise.resolve({ slug: negocio.slug }) }))
  expect(abierto.status).toBe(201)
  const turnoId = (abierto.body.turno as { id: string }).id
  const premium = await db.producto.create({ data: { nombre: "Yerba premium", precio: 4500, negocioId: negocio.id, controlStock: true, stockCantidad: 100 } })
  const comun = await db.producto.create({ data: { nombre: "Yerba común", precio: 3200, negocioId: negocio.id, controlStock: true, stockCantidad: 100 } })

  const vender = async (productoId: string) => {
    const r = await json(await postVentaOwner(req("/api/negocio/caja/ventas", owner, { metodoPago: "EFECTIVO", items: [{ productoId, cantidad: 1 }] })))
    expect(r.status).toBe(201)
    return { id: r.body.id as string, itemId: (r.body.items as Array<{ id: string }>)[0].id }
  }
  /** A plain F4-A return of 4500 left PENDING (nothing compensated). */
  const devolucionPendiente = async () => {
    const venta = await vender(premium.id)
    const r = await json(await postDevolucionOwner(req(`/api/negocio/caja/ventas/${venta.id}/devoluciones`, owner, { tipo: "DEVOLUCION_PARCIAL", motivo: "No le gustó", items: [{ ventaItemId: venta.itemId, cantidad: 1, reingresaStock: true }], reintegro: { modo: "PENDIENTE" }, confirmo: true }), idCtx(venta.id)))
    expect(r.status).toBe(201)
    return (r.body.devolucion as { id: string }).id
  }
  /** An F4-C exchange 4500 → 3200 whose 1300 refund is left PENDING. */
  const cambioPendiente = async () => {
    const venta = await vender(premium.id)
    const r = await json(await postCambioOwner(req(`/api/negocio/caja/ventas/${venta.id}/cambios`, owner, { motivo: "Prefiere la común", salen: [{ ventaItemId: venta.itemId, cantidad: 1, reingresaStock: true }], entran: [{ productoId: comun.id, cantidad: 1 }], reintegro: { modo: "PENDIENTE" }, esperado: { salida: "4500.00", entrada: "3200.00" }, confirmo: true }), idCtx(venta.id)))
    expect(r.status).toBe(201)
    return (r.body.cambio as { devolucionId: string }).devolucionId
  }
  const pagoOwner = async (devolucionId: string, medio: string, key: string = randomUUID()) =>
    json(await postReintegroOwner(req(`/api/negocio/caja/devoluciones/${devolucionId}/reintegro`, owner, { medio, confirmo: true }, key), idCtx(devolucionId)))
  const pagoCajero = async (devolucionId: string, medio: string, key: string = randomUUID()) =>
    json(await postReintegroCajero(req(`/api/operativo/caja/${negocio.slug}/devoluciones/${devolucionId}/reintegro`, cajero, { medio, confirmo: true }, key), { params: Promise.resolve({ slug: negocio.slug, id: devolucionId }) }))

  /** Everything the payment of ONE refund may have written. */
  const efectos = async (devolucionId: string) => {
    const dev = await db.devolucionVenta.findUniqueOrThrow({ where: { id: devolucionId } })
    const operaciones = await db.operacionFinanciera.findMany({ where: { negocioId: negocio.id, tipo: "DEVOLUCION_VENTA", devolucionVenta: { id: devolucionId } }, include: { movimientos: true } })
    const eventos = (await db.auditLog.findMany({ where: { accion: "venta.devolucion_reintegro_registrado", detalle: { contains: devolucionId } } })).map((a) => JSON.parse(a.detalle))
    const avisos = await db.notificacion.count({ where: { userId: negocio.id, tipo: "caja_devolucion", datos: { contains: devolucionId } } })
    return { dev, operaciones, eventos, avisos }
  }
  /** Every DEVOLUCION_VENTA outflow of the business (to catch an orphan operation not linked to the refund). */
  const salidasNegocio = async () => db.operacionFinanciera.count({ where: { negocioId: negocio.id, tipo: "DEVOLUCION_VENTA" } })
  return { negocio, owner, cajero, empleado, turnoId, devolucionPendiente, cambioPendiente, pagoOwner, pagoCajero, efectos, salidasNegocio }
}

const YA_REGISTRADO = "REINTEGRO_YA_REGISTRADO"

/** Exactly one winner (201); every other answer is the controlled refusal — never a 500, never a second 201. */
function unGanador(results: Res[]) {
  const ganadores = results.filter((r) => r.status === 201)
  expect(ganadores).toHaveLength(1)
  for (const r of results.filter((x) => x.status !== 201)) {
    expect([r.status, r.body.code, r.body.error]).toEqual([409, YA_REGISTRADO, "El reintegro de esta devolución ya fue registrado."])
  }
  return results.indexOf(ganadores[0])
}

describe("Pending refund paid concurrently — the server, not the UI, prevents a second payment", () => {
  ephemeralTest("two INDEPENDENT stale sessions (owner + cashier), different keys, both in cash, at the same time: one payment, one outflow, one event", async () => {
    const e = await escenario()
    for (let ronda = 0; ronda < RONDAS; ronda++) {
      const devolucionId = await e.devolucionPendiente()
      const antes = await e.salidasNegocio()
      const results = await Promise.all([e.pagoOwner(devolucionId, "EFECTIVO"), e.pagoCajero(devolucionId, "EFECTIVO")])
      const ganador = unGanador(results)

      const { dev, operaciones, eventos, avisos } = await e.efectos(devolucionId)
      expect(await e.salidasNegocio()).toBe(antes + 1) // no orphan operation from the loser
      expect(operaciones).toHaveLength(1)
      expect(operaciones[0].movimientos.map((m) => m.importeDecimal!.toFixed(2))).toEqual(["-4500.00"])
      expect(eventos).toHaveLength(1)
      expect(eventos[0]).toMatchObject({ devolucionId, detalleVersion: 2, importeReintegrado: "4500.00", reintegroMedio: "EFECTIVO", reintegroTurnoCajaId: e.turnoId })
      // The row records the actual winner — and only the cashier's payment notifies the owner.
      expect(dev).toMatchObject({ reintegroEstado: "REALIZADO", reintegroMedio: "EFECTIVO", reintegroOperacionId: operaciones[0].id, reintegroActorTipo: ganador === 0 ? "NEGOCIO" : "EMPLEADO" })
      expect(avisos).toBe(ganador === 0 ? 0 : 1)
    }
  })

  ephemeralTest("two stale tabs of the SAME session, different keys, different methods (cash vs transfer), at the same time: only the winner's method is recorded", async () => {
    const e = await escenario()
    for (let ronda = 0; ronda < RONDAS; ronda++) {
      const devolucionId = await e.cambioPendiente() // F4-C: 4500 returned, 3200 compensated, 1300 owed
      const antes = await e.salidasNegocio()
      const medios = ["EFECTIVO", "TRANSFERENCIA"]
      const results = await Promise.all(medios.map((m) => e.pagoOwner(devolucionId, m)))
      const ganador = unGanador(results)

      const { dev, operaciones, eventos } = await e.efectos(devolucionId)
      expect(dev.reintegroMedio).toBe(medios[ganador])
      expect(eventos).toHaveLength(1)
      expect(eventos[0]).toMatchObject({ importeDevuelto: "4500.00", importeCompensado: "3200.00", importeReintegrado: "1300.00", reintegroMedio: medios[ganador] })
      if (medios[ganador] === "EFECTIVO") {
        expect(operaciones.map((o) => o.movimientos.map((m) => m.importeDecimal!.toFixed(2)))).toEqual([["-1300.00"]])
        expect(await e.salidasNegocio()).toBe(antes + 1)
      } else {
        expect(operaciones).toEqual([]) // the transfer won: no cash left, and the loser's cash attempt left nothing behind
        expect(await e.salidasNegocio()).toBe(antes)
      }
    }
  })

  ephemeralTest("a burst of 5 different keys (stale tabs / devices) on one refund: exactly one payment, four controlled refusals", async () => {
    const e = await escenario()
    for (let ronda = 0; ronda < RONDAS; ronda++) {
      const devolucionId = await e.devolucionPendiente()
      const antes = await e.salidasNegocio()
      const results = await Promise.all([
        e.pagoOwner(devolucionId, "EFECTIVO"),
        e.pagoCajero(devolucionId, "EFECTIVO"),
        e.pagoOwner(devolucionId, "EFECTIVO"),
        e.pagoCajero(devolucionId, "EFECTIVO"),
        e.pagoOwner(devolucionId, "EFECTIVO"),
      ])
      unGanador(results)
      const { operaciones, eventos } = await e.efectos(devolucionId)
      expect(operaciones).toHaveLength(1)
      expect(operaciones[0].movimientos.map((m) => m.importeDecimal!.toFixed(2))).toEqual(["-4500.00"])
      expect(await e.salidasNegocio()).toBe(antes + 1)
      expect(eventos).toHaveLength(1)
    }
  })

  ephemeralTest("double click / network retry: the SAME key sent 5 times at once is one payment and four idempotent replays", async () => {
    const e = await escenario()
    for (let ronda = 0; ronda < RONDAS; ronda++) {
      const devolucionId = await e.devolucionPendiente()
      const antes = await e.salidasNegocio()
      const key = randomUUID()
      const results = await Promise.all(Array.from({ length: 5 }, () => e.pagoOwner(devolucionId, "EFECTIVO", key)))
      expect(results.filter((r) => r.status === 201)).toHaveLength(1)
      const resto = results.filter((r) => r.status !== 201)
      expect(resto.every((r) => r.status === 200 && r.replayed)).toBe(true)
      const { operaciones, eventos } = await e.efectos(devolucionId)
      expect(operaciones).toHaveLength(1)
      expect(await e.salidasNegocio()).toBe(antes + 1)
      expect(eventos).toHaveLength(1) // a replay never writes a second audit event
    }
  })

  ephemeralTest("after the race, a stale session retrying later (new key) is still refused and changes nothing", async () => {
    const e = await escenario()
    const devolucionId = await e.cambioPendiente()
    unGanador(await Promise.all([e.pagoOwner(devolucionId, "EFECTIVO"), e.pagoCajero(devolucionId, "EFECTIVO")]))
    const antes = await e.efectos(devolucionId)
    const tarde = await Promise.all([e.pagoCajero(devolucionId, "EFECTIVO"), e.pagoOwner(devolucionId, "OTRO")])
    expect(tarde.map((r) => [r.status, r.body.code])).toEqual([[409, YA_REGISTRADO], [409, YA_REGISTRADO]])
    const despues = await e.efectos(devolucionId)
    expect(despues.dev).toEqual(antes.dev)
    expect(despues.operaciones.map((o) => o.id)).toEqual(antes.operaciones.map((o) => o.id))
    expect(despues.eventos).toHaveLength(1)
    expect(despues.avisos).toBe(antes.avisos)
  })
})
