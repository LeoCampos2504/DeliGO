/// <reference types="bun-types" />
// ============================================
// T5 — cashier shift opening/closing for EVERY authorized cashier (no TESTING pilot gate), on a REAL ephemeral PostgreSQL
// ============================================
// Operator decision (2026-11-27): any active employee with área caja of an eligible business opens and closes THEIR
// OWN shift, in TESTING and in Production, without flags or a manual allowlist. The authority is the personal
// operational session resolver (account, business, rubro, linked active employee, área caja) plus the shift service.
// This suite proves the gate removal did not widen anything else: every former rejection that did not depend on the
// pilot still holds, and the cashier never receives owner-only cash figures.

import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createOperationalSession, createSession, OPERATIONAL_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/auth"
import { asegurarCajaPredeterminada, crearCajaFisica } from "@/lib/caja-turnos-service"

setDefaultTimeout(300_000)

const testDatabaseUrl = process.env.DELIGO_TEST_DATABASE_URL
const isEphemeralIntegrationDb = process.env.DELIGO_EPHEMERAL_TEST_DB === "1"
if (!testDatabaseUrl || process.env.DATABASE_URL !== testDatabaseUrl) {
  throw new Error("Este test de integración requiere DELIGO_TEST_DATABASE_URL y DATABASE_URL apuntando a la misma base de prueba.")
}
const declaredEnvironment = process.env.DELIGO_ENVIRONMENT ?? process.env.RAILWAY_ENVIRONMENT_NAME ?? process.env.APP_ENV
if (!declaredEnvironment || declaredEnvironment.toUpperCase() !== "TESTING") {
  throw new Error("La suite T5 sólo puede ejecutarse con DELIGO_ENVIRONMENT=TESTING.")
}
const ephemeralTest = isEphemeralIntegrationDb ? test : test.skip

const { GET: getTurnoCajero, POST: postTurnoCajero } = await import("@/app/api/operativo/caja/[slug]/turno/route")
const { GET: getTurnoOwner } = await import("@/app/api/negocio/caja/turnos/[id]/route")

afterAll(async () => {
  await db.$disconnect()
})

type Res = { status: number; body: Record<string, any>; raw: string }
const json = async (res: Response): Promise<Res> => {
  const raw = await res.text()
  let body: Record<string, any> = {}
  try { body = JSON.parse(raw) } catch { /* empty */ }
  return { status: res.status, body, raw }
}
const req = (method: string, url: string, cookie: string, body?: unknown) =>
  new NextRequest(`http://localhost${url}`, { method, headers: { cookie, "content-type": "application/json", "idempotency-key": randomUUID() }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
const PRIVADO = /esperado|diferencia|saldo|balance|totalEfectivo|ingresosEfectivo|salidasEfectivo/i
const ENV_PILOTO = ["DELIGO_F10_B2_2_B_SHIFT_UI_ENABLED", "DELIGO_F10_B2_2_B_CONTROLLED_EMPLOYEE_IDS", "DELIGO_ENVIRONMENT", "RAILWAY_ENVIRONMENT_NAME", "APP_ENV"] as const

/** Runs `fn` with the environment of a Production deployment: not TESTING and without the former pilot variables. */
async function comoProduction<T>(fn: () => Promise<T>): Promise<T> {
  const previo = Object.fromEntries(ENV_PILOTO.map((k) => [k, process.env[k]]))
  for (const k of ENV_PILOTO) delete process.env[k]
  process.env.RAILWAY_ENVIRONMENT_NAME = "production"
  try { return await fn() } finally {
    for (const k of ENV_PILOTO) { if (previo[k] === undefined) delete process.env[k]; else process.env[k] = previo[k] }
  }
}

async function escenario() {
  const suffix = randomUUID().slice(0, 12)
  const crearNegocio = (tag: string) => db.negocio.create({
    data: { slug: `test-t5-${tag}-${suffix}`, nombre: `Test T5 ${tag} ${suffix}`, usuario: `test-t5-${tag}-${suffix}`, email: `test-t5-${tag}-${suffix}@example.test`, password: "fixture", rubro: "negocio", aprobado: true, suspendido: false, empleadosActivos: true, salonActivo: true, cajaTurnosModo: "OPCIONAL" },
  })
  const negocio = await crearNegocio("a")
  const otro = await crearNegocio("b")
  const empleado = async (negocioId: string, nombre: string, area = "caja") => {
    const cuenta = await db.cuentaOperativa.create({ data: { nombre, email: `${nombre.toLowerCase().replace(/\W+/g, "")}-${randomUUID().slice(0, 8)}@example.test`, activo: true, eliminado: false } })
    const e = await db.empleado.create({ data: { nombre, codigo: `T5${randomUUID().slice(0, 6)}`.toUpperCase(), negocioId, cuentaOperativaId: cuenta.id, areaOperativa: area, activo: true, eliminado: false } })
    return { empleado: e, cookie: `${OPERATIONAL_SESSION_COOKIE_NAME}=${await createOperationalSession(cuenta.id)}` }
  }
  const cajaA = await asegurarCajaPredeterminada(db, negocio.id)
  const cajaB = await crearCajaFisica(db, negocio.id, { nombre: "Caja B" })
  if (!cajaB.ok) throw new Error("fixture: caja B")
  const base = `/api/operativo/caja/${negocio.slug}/turno`
  const ctx = { params: Promise.resolve({ slug: negocio.slug }) }
  const ver = async (cookie: string) => json(await getTurnoCajero(req("GET", base, cookie), ctx))
  const abrir = async (cookie: string, cajaFisicaId = cajaA.id, fondoInicial: unknown = "1000") => json(await postTurnoCajero(req("POST", base, cookie, { cajaFisicaId, fondoInicial }), ctx))
  const cerrar = async (cookie: string, turnoCajaId: string, efectivoContado: unknown = "1000") => json(await postTurnoCajero(req("POST", base, cookie, { action: "close", turnoCajaId, efectivoContado }), ctx))
  const turnos = () => db.turnoCaja.count({ where: { negocioId: { in: [negocio.id, otro.id] } } })
  return { negocio, otro, empleado, cajaA, cajaB: cajaB.value, ver, abrir, cerrar, turnos }
}

describe("T5 — every authorized cashier opens and closes their own shift", () => {
  ephemeralTest("simulated Production (not TESTING, no flag, no allowlist): GET says enabled and the cashier opens and blind-closes their own shift", async () => {
    const e = await escenario()
    const a = await e.empleado(e.negocio.id, "Cajera Production")
    await comoProduction(async () => {
      const vista = await e.ver(a.cookie)
      expect([vista.status, vista.body.aperturaHabilitada]).toEqual([200, true])
      expect(vista.raw).not.toMatch(PRIVADO)
      const abierto = await e.abrir(a.cookie)
      expect(abierto.status).toBe(201)
      expect(abierto.raw).not.toMatch(PRIVADO)
      const turnoId = abierto.body.turno.id as string
      expect((await e.ver(a.cookie)).body.turno.id).toBe(turnoId)
      const cerrado = await e.cerrar(a.cookie, turnoId, "900")
      expect([cerrado.status, cerrado.body.turno.estado]).toEqual([200, "CERRADO_DECLARADO"])
      expect(cerrado.raw).not.toMatch(PRIVADO)
    })
    const t = await db.turnoCaja.findFirstOrThrow({ where: { negocioId: e.negocio.id } })
    expect([t.responsableTipo, t.empleadoId, t.estado]).toEqual(["EMPLEADO", a.empleado.id, "CERRADO_DECLARADO"])
  })

  ephemeralTest("TESTING with the former pilot ON and an allowlist that does NOT include the cashier: they operate normally (the second-cashier case of T4)", async () => {
    const e = await escenario()
    const a = await e.empleado(e.negocio.id, "Segundo Cajero")
    const previo = { flag: process.env.DELIGO_F10_B2_2_B_SHIFT_UI_ENABLED, lista: process.env.DELIGO_F10_B2_2_B_CONTROLLED_EMPLOYEE_IDS }
    process.env.DELIGO_F10_B2_2_B_SHIFT_UI_ENABLED = "true"
    process.env.DELIGO_F10_B2_2_B_CONTROLLED_EMPLOYEE_IDS = "otro-empleado-qa"
    try {
      expect((await e.ver(a.cookie)).body.aperturaHabilitada).toBe(true)
      const abierto = await e.abrir(a.cookie, e.cajaB.id)
      expect(abierto.status).toBe(201)
      expect((await e.cerrar(a.cookie, abierto.body.turno.id)).status).toBe(200)
    } finally {
      if (previo.flag === undefined) delete process.env.DELIGO_F10_B2_2_B_SHIFT_UI_ENABLED; else process.env.DELIGO_F10_B2_2_B_SHIFT_UI_ENABLED = previo.flag
      if (previo.lista === undefined) delete process.env.DELIGO_F10_B2_2_B_CONTROLLED_EMPLOYEE_IDS; else process.env.DELIGO_F10_B2_2_B_CONTROLLED_EMPLOYEE_IDS = previo.lista
    }
  })
})

describe("T5 — the real authority still rejects (GET and POST agree), with no shift written", () => {
  ephemeralTest("no área caja, deactivated, deleted, área revoked after login, invalid session, another business's cashier", async () => {
    const e = await escenario()
    const mozo = await e.empleado(e.negocio.id, "Mozo Sin Caja", "mozo")
    const inactivo = await e.empleado(e.negocio.id, "Cajero Inactivo")
    const eliminado = await e.empleado(e.negocio.id, "Cajero Eliminado")
    const revocado = await e.empleado(e.negocio.id, "Cajero Revocado")
    const ajeno = await e.empleado(e.otro.id, "Cajero Ajeno")
    await db.empleado.update({ where: { id: inactivo.empleado.id }, data: { activo: false } })
    await db.empleado.update({ where: { id: eliminado.empleado.id }, data: { eliminado: true } })
    expect((await e.ver(revocado.cookie)).body.aperturaHabilitada).toBe(true)
    await db.empleado.update({ where: { id: revocado.empleado.id }, data: { areaOperativa: "mozo" } })
    await comoProduction(async () => {
      for (const actor of [mozo, inactivo, eliminado, revocado, ajeno, { cookie: `${OPERATIONAL_SESSION_COOKIE_NAME}=token-invalido` }]) {
        const vista = await e.ver(actor.cookie)
        const abierto = await e.abrir(actor.cookie)
        expect([401, 403]).toContain(vista.status)
        expect([401, 403]).toContain(abierto.status)
        expect(vista.body.aperturaHabilitada).toBeUndefined()
      }
    })
    expect(await e.turnos()).toBe(0)
  })

  ephemeralTest("a cashier cannot close another cashier's shift, cannot open a second own shift nor take an occupied register; the owner's figures stay owner-only", async () => {
    const e = await escenario()
    const a = await e.empleado(e.negocio.id, "Cajera A")
    const b = await e.empleado(e.negocio.id, "Cajero B")
    await comoProduction(async () => {
      const turnoA = (await e.abrir(a.cookie)).body.turno.id as string
      // B cannot close A's shift (only their own shift is ever addressed).
      const ajeno = await e.cerrar(b.cookie, turnoA)
      expect(ajeno.status).toBeGreaterThanOrEqual(400)
      expect((await db.turnoCaja.findUniqueOrThrow({ where: { id: turnoA } })).estado).toBe("ABIERTO")
      // A second own shift, and a register already occupied by A, are refused.
      expect((await e.abrir(a.cookie, e.cajaB.id)).status).toBe(409)
      expect((await e.abrir(b.cookie, e.cajaA.id)).status).toBe(409)
      expect(await db.turnoCaja.count({ where: { negocioId: e.negocio.id } })).toBe(1)
      // The owner-only shift detail (expected cash) is never reachable with a cashier session.
      expect([401, 403]).toContain((await getTurnoOwner(req("GET", `/api/negocio/caja/turnos/${turnoA}`, a.cookie), { params: Promise.resolve({ id: turnoA }) })).status)
      const owner = `${SESSION_COOKIE_NAME}=${await createSession(e.negocio.id, "negocio")}`
      expect((await getTurnoOwner(req("GET", `/api/negocio/caja/turnos/${turnoA}`, owner), { params: Promise.resolve({ id: turnoA }) })).status).toBe(200)
      // The cashier's own view never carries expected cash or differences, also with an open shift.
      expect((await e.ver(a.cookie)).raw).not.toMatch(PRIVADO)
    })
  })
})
