/// <reference types="bun-types" />

// ============================================
// F10-B2.1 — physical registers, shifts and financial attribution (REAL TESTING DB)
// ============================================
// Real routes + real PostgreSQL TESTING (migration 20261011120000 applied).
// Isolated fixtures (random ids), real owner/operational sessions, cleanup by
// exact ids in FK order (audit rows of the fixture actors included).

import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { createOperationalSession, createSession, deleteSession, OPERATIONAL_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/auth"
import { GET as getCajas, POST as postCaja } from "@/app/api/negocio/caja/cajas/route"
import { PATCH as patchCaja } from "@/app/api/negocio/caja/cajas/[id]/route"
import { GET as getTurnosOwner, POST as postTurnoOwner } from "@/app/api/negocio/caja/turnos/route"
import { GET as getTurnoDetalle, POST as postCierreTurnoOwner } from "@/app/api/negocio/caja/turnos/[id]/route"
import { GET as getTurnosCerrados } from "@/app/api/negocio/caja/turnos/cerrados/route"
import { GET as getRevisionesTurno, POST as postRevisionTurno } from "@/app/api/negocio/caja/turnos/[id]/revisiones/route"
import { GET as getEntregasTurno, POST as postEntregaTurno } from "@/app/api/negocio/caja/turnos/[id]/entregas/route"
import { POST as postVentaOwner } from "@/app/api/negocio/caja/ventas/route"
import { GET as getTurnoCajero, POST as postTurnoCajero } from "@/app/api/operativo/caja/[slug]/turno/route"
import { POST as postVentaCajero } from "@/app/api/operativo/caja/[slug]/ventas/route"
import { registrarVentaCaja } from "@/lib/caja-venta-service"

setDefaultTimeout(240_000)

const testDatabaseUrl = process.env.DELIGO_TEST_DATABASE_URL
const isEphemeralIntegrationDb = process.env.DELIGO_EPHEMERAL_TEST_DB === "1"
if (!testDatabaseUrl || process.env.DATABASE_URL !== testDatabaseUrl) {
  throw new Error("Este test de integración requiere DELIGO_TEST_DATABASE_URL y DATABASE_URL apuntando a la misma base TESTING.")
}
const declaredEnvironment = process.env.DELIGO_ENVIRONMENT ?? process.env.RAILWAY_ENVIRONMENT_NAME ?? process.env.APP_ENV
if (!declaredEnvironment || declaredEnvironment.toUpperCase() !== "TESTING") {
  throw new Error("La suite F10-B2.1 sólo puede ejecutarse con DELIGO_ENVIRONMENT=TESTING.")
}
process.env.DELIGO_ENVIRONMENT = "TESTING"
process.env.DELIGO_F10_B2_2_B_SHIFT_UI_ENABLED = "true"

const negocios: string[] = []
const cuentas: string[] = []
const ownerTokens: string[] = []
const D = (v: string) => new Prisma.Decimal(v)
/** true when the DB rejects the write (PrismaPromise is a thenable, not a native Promise). */
async function fails(p: PromiseLike<unknown>) {
  try {
    await p
    return false
  } catch {
    return true
  }
}

async function crearNegocio(overrides: Partial<{ rubro: string; suspendido: boolean; cajaTurnosModo: string }> = {}) {
  const suffix = randomUUID()
  const negocio = await db.negocio.create({
    data: {
      slug: `test-f10b21-${suffix}`,
      nombre: `Test F10-B2.1 ${suffix}`,
      usuario: `test-f10b21-${suffix}`,
      email: `test-f10b21-${suffix}@example.test`,
      password: "fixture",
      rubro: overrides.rubro ?? "negocio",
      aprobado: true,
      suspendido: overrides.suspendido ?? false,
      empleadosActivos: true,
      salonActivo: true,
      cajaTurnosModo: overrides.cajaTurnosModo ?? "OPCIONAL",
    },
  })
  negocios.push(negocio.id)
  const token = await createSession(negocio.id, "negocio")
  ownerTokens.push(token)
  return { negocio, owner: `${SESSION_COOKIE_NAME}=${token}` }
}

async function crearCajero(negocioId: string, overrides: Partial<{ area: string; activo: boolean }> = {}) {
  const cuenta = await db.cuentaOperativa.create({
    data: { nombre: `Cajero B2.1 ${randomUUID()}`, email: `test-f10b21-${randomUUID()}@example.test`, activo: true, eliminado: false },
  })
  cuentas.push(cuenta.id)
  const empleado = await db.empleado.create({
    data: { nombre: `Cajero ${randomUUID().slice(0, 6)}`, codigo: randomUUID().slice(0, 8).toUpperCase(), negocioId, cuentaOperativaId: cuenta.id, areaOperativa: overrides.area ?? "caja", activo: overrides.activo ?? true, eliminado: false },
  })
  const allowlist = new Set((process.env.DELIGO_F10_B2_2_B_CONTROLLED_EMPLOYEE_IDS ?? "").split(/[\s,;]+/).filter(Boolean))
  allowlist.add(empleado.id)
  process.env.DELIGO_F10_B2_2_B_CONTROLLED_EMPLOYEE_IDS = [...allowlist].join(",")
  const token = await createOperationalSession(cuenta.id)
  return { empleado, cookie: `${OPERATIONAL_SESSION_COOKIE_NAME}=${token}` }
}

async function crearProducto(negocioId: string, precio: number, opts: { controlStock?: boolean; stockCantidad?: number } = {}) {
  return db.producto.create({ data: { nombre: `P ${randomUUID().slice(0, 6)}`, precio, negocioId, controlStock: opts.controlStock ?? false, stockCantidad: opts.stockCantidad ?? 0 } })
}

const json = async (res: Response) => ({ status: res.status, replayed: res.headers.get("Idempotency-Replayed") === "true", body: await res.json() })
const ownerReq = (url: string, cookie: string, method = "GET", body?: unknown, key?: string) =>
  new NextRequest(`http://localhost${url}`, {
    method,
    headers: { cookie, "content-type": "application/json", ...(key ? { "idempotency-key": key } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
const slugCtx = (slug: string) => ({ params: Promise.resolve({ slug }) })
const idCtx = (id: string) => ({ params: Promise.resolve({ id }) })

const listarCajas = async (owner: string) => json(await getCajas(ownerReq("/api/negocio/caja/cajas", owner)))
const crearCaja = async (owner: string, nombre: string) => json(await postCaja(ownerReq("/api/negocio/caja/cajas", owner, "POST", { nombre })))
const editarCaja = async (owner: string, id: string, body: unknown) => json(await patchCaja(ownerReq(`/api/negocio/caja/cajas/${id}`, owner, "PATCH", body), idCtx(id)))
const abrirOwner = async (owner: string, body: unknown, key: string | undefined = randomUUID()) =>
  json(await postTurnoOwner(ownerReq("/api/negocio/caja/turnos", owner, "POST", body, key)))
const detalle = async (owner: string, id: string) => json(await getTurnoDetalle(ownerReq(`/api/negocio/caja/turnos/${id}`, owner), idCtx(id)))
const turnosCerrados = async (owner: string) => json(await getTurnosCerrados(ownerReq("/api/negocio/caja/turnos/cerrados", owner)))
const revisionesTurno = async (owner: string, id: string) => json(await getRevisionesTurno(ownerReq(`/api/negocio/caja/turnos/${id}/revisiones`, owner), idCtx(id)))
const revisarTurno = async (owner: string, id: string, observacion: string | null, key = randomUUID()) => json(await postRevisionTurno(ownerReq(`/api/negocio/caja/turnos/${id}/revisiones`, owner, "POST", { observacion }, key), idCtx(id)))
const entregasTurno = async (owner: string, id: string) => json(await getEntregasTurno(ownerReq(`/api/negocio/caja/turnos/${id}/entregas`, owner), idCtx(id)))
const entregarTurno = async (owner: string, id: string, body: unknown, key = randomUUID()) => json(await postEntregaTurno(ownerReq(`/api/negocio/caja/turnos/${id}/entregas`, owner, "POST", body, key), idCtx(id)))
const turnoCajero = async (cookie: string, slug: string) => json(await getTurnoCajero(ownerReq(`/api/operativo/caja/${slug}/turno`, cookie), slugCtx(slug)))
const abrirCajero = async (cookie: string, slug: string, body: unknown, key: string | undefined = randomUUID()) =>
  json(await postTurnoCajero(ownerReq(`/api/operativo/caja/${slug}/turno`, cookie, "POST", body, key), slugCtx(slug)))
const cerrarCajero = async (cookie: string, slug: string, turnoCajaId: string, efectivoContado: unknown, key = randomUUID()) =>
  json(await postTurnoCajero(ownerReq(`/api/operativo/caja/${slug}/turno`, cookie, "POST", { action: "close", turnoCajaId, efectivoContado }, key), slugCtx(slug)))
const cerrarOwner = async (owner: string, turnoCajaId: string, efectivoContado: unknown, key = randomUUID()) =>
  json(await postCierreTurnoOwner(ownerReq(`/api/negocio/caja/turnos/${turnoCajaId}`, owner, "POST", { efectivoContado }, key), idCtx(turnoCajaId)))
const venderCajero = async (cookie: string, slug: string, body: unknown, key = randomUUID()) =>
  json(await postVentaCajero(ownerReq(`/api/operativo/caja/${slug}/ventas`, cookie, "POST", body, key), slugCtx(slug)))
const venderOwner = async (owner: string, body: unknown, key = randomUUID()) => json(await postVentaOwner(ownerReq("/api/negocio/caja/ventas", owner, "POST", body, key)))

async function cuentaDeCaja(negocioId: string, cajaFisicaId: string) {
  return db.cuentaFinanciera.findFirst({ where: { negocioId, cajaFisicaId, tipo: "EFECTIVO" } })
}
async function saldoCuenta(cuentaId: string | undefined) {
  if (!cuentaId) return D("0")
  const legs = await db.movimientoFinanciero.findMany({ where: { cuentaId }, select: { importeDecimal: true } })
  return legs.reduce((acc, l) => acc.plus(l.importeDecimal!), D("0"))
}

afterAll(async () => {
  if (isEphemeralIntegrationDb) {
    await db.$disconnect()
    return
  }
  for (const t of ownerTokens) await deleteSession(t)
  await db.sesion.deleteMany({ where: { userId: { in: cuentas } } })
  const empleados = await db.empleado.findMany({ where: { negocioId: { in: negocios } }, select: { id: true } })
  await db.auditLog.deleteMany({ where: { userId: { in: [...negocios, ...empleados.map((e) => e.id)] } } })
  await db.reservaStock.deleteMany({ where: { negocioId: { in: negocios } } })
  await db.pedidoItem.deleteMany({ where: { pedido: { negocioId: { in: negocios } } } })
  await db.pedido.deleteMany({ where: { negocioId: { in: negocios } } })
  await db.movimientoInventario.deleteMany({ where: { negocioId: { in: negocios } } })
  await db.revisionTurnoCaja.deleteMany({ where: { negocioId: { in: negocios } } })
  await db.entregaCustodiaTurnoCaja.deleteMany({ where: { negocioId: { in: negocios } } })
  await db.operacionFinanciera.deleteMany({ where: { negocioId: { in: negocios } } })
  await db.cuentaFinanciera.deleteMany({ where: { negocioId: { in: negocios } } })
  await db.ventaItem.deleteMany({ where: { venta: { negocioId: { in: negocios } } } })
  await db.venta.deleteMany({ where: { negocioId: { in: negocios } } })
  await db.turnoCaja.deleteMany({ where: { negocioId: { in: negocios } } })
  await db.cajaFisica.deleteMany({ where: { negocioId: { in: negocios } } })
  await db.empleado.deleteMany({ where: { negocioId: { in: negocios } } })
  await db.producto.deleteMany({ where: { negocioId: { in: negocios } } })
  await db.negocio.deleteMany({ where: { id: { in: negocios } } })
  await db.cuentaOperativa.deleteMany({ where: { id: { in: cuentas } } })
})

// ---------------------------------------------------------------------------

describe("F10-B2.1 — physical registers", () => {
  test("default register: 6 concurrent first reads create exactly ONE 'Caja principal'", async () => {
    const { negocio, owner } = await crearNegocio()
    const results = await Promise.all(Array.from({ length: 6 }, () => listarCajas(owner)))
    for (const r of results) expect(r.status).toBe(200)
    const cajas = await db.cajaFisica.findMany({ where: { negocioId: negocio.id } })
    expect(cajas).toHaveLength(1)
    expect(cajas[0]).toMatchObject({ nombre: "Caja principal", esPredeterminada: true, activa: true })
    expect(results[0].body.cajas[0]).toMatchObject({ nombre: "Caja principal", esPredeterminada: true, turnoAbierto: null })
  })

  test("create several registers; names unique ignoring case/spaces; invalid name → 400", async () => {
    const { negocio, owner } = await crearNegocio()
    expect((await crearCaja(owner, "Caja secundaria")).status).toBe(201)
    expect((await crearCaja(owner, "Mostrador")).status).toBe(201)
    const dup = await crearCaja(owner, "  caja   SECUNDARIA ")
    expect(dup.status).toBe(409)
    expect(dup.body.code).toBe("CAJA_NOMBRE_DUPLICADO")
    expect((await crearCaja(owner, "   ")).status).toBe(400)
    expect((await crearCaja(owner, "x".repeat(61))).status).toBe(400)
    const cajas = await db.cajaFisica.findMany({ where: { negocioId: negocio.id } })
    expect(cajas.map((c) => c.nombre).sort()).toEqual(["Caja principal", "Caja secundaria", "Mostrador"])
    expect(cajas.filter((c) => c.esPredeterminada)).toHaveLength(1)
  })

  test("default switch is atomic; the default cannot be deactivated; a free register can be deactivated and reactivated", async () => {
    const { negocio, owner } = await crearNegocio()
    const principal = (await listarCajas(owner)).body.cajas[0]
    const otra = (await crearCaja(owner, "Otra")).body
    expect((await editarCaja(owner, principal.id, { activa: false })).body.code).toBe("CAJA_PREDETERMINADA")
    expect((await editarCaja(owner, otra.id, { esPredeterminada: true })).status).toBe(200)
    const defaults = await db.cajaFisica.findMany({ where: { negocioId: negocio.id, esPredeterminada: true } })
    expect(defaults.map((c) => c.id)).toEqual([otra.id])
    const off = await editarCaja(owner, principal.id, { activa: false })
    expect(off.status).toBe(200)
    expect(off.body.activa).toBe(false)
    expect((await editarCaja(owner, principal.id, { activa: true, nombre: "Principal renombrada" })).body).toMatchObject({ activa: true, nombre: "Principal renombrada" })
    expect((await editarCaja(owner, otra.id, { esPredeterminada: false })).status).toBe(400)
  })

  test("a register with an open shift cannot be deactivated; an inactive register cannot open a shift", async () => {
    const { negocio, owner } = await crearNegocio()
    await listarCajas(owner)
    const segunda = (await crearCaja(owner, "Segunda")).body
    const { cookie } = await crearCajero(negocio.id)
    expect((await abrirCajero(cookie, negocio.slug, { cajaFisicaId: segunda.id, fondoInicial: 100 })).status).toBe(201)
    const off = await editarCaja(owner, segunda.id, { activa: false })
    expect(off.status).toBe(409)
    expect(off.body.code).toBe("CAJA_CON_TURNO_ABIERTO")
    const tercera = (await crearCaja(owner, "Tercera")).body
    expect((await editarCaja(owner, tercera.id, { activa: false })).status).toBe(200)
    const { cookie: cookie2 } = await crearCajero(negocio.id)
    const r = await abrirCajero(cookie2, negocio.slug, { cajaFisicaId: tercera.id, fondoInicial: 0 })
    expect(r.status).toBe(409)
    expect(r.body.code).toBe("CAJA_INACTIVA")
  })

  test("registers of another business are invisible: PATCH → 404, opening on them → 404; non-generic business → 403", async () => {
    const a = await crearNegocio()
    const b = await crearNegocio()
    const cajaB = (await listarCajas(b.owner)).body.cajas[0]
    expect((await editarCaja(a.owner, cajaB.id, { nombre: "robada" })).status).toBe(404)
    expect((await abrirOwner(a.owner, { cajaFisicaId: cajaB.id, fondoInicial: 1 })).status).toBe(404)
    const { cookie } = await crearCajero(a.negocio.id)
    expect((await abrirCajero(cookie, a.negocio.slug, { cajaFisicaId: cajaB.id, fondoInicial: 1 })).status).toBe(404)
    expect(await db.turnoCaja.count({ where: { negocioId: { in: [a.negocio.id, b.negocio.id] } } })).toBe(0)
    const resto = await crearNegocio({ rubro: "restaurante" })
    expect((await listarCajas(resto.owner)).status).toBe(403)
    expect(await db.cajaFisica.count({ where: { negocioId: resto.negocio.id } })).toBe(0)
  })

  test("PostgreSQL itself rejects: a 2nd active default, a shift on another business's register, a negative fund, an incoherent responsible person, a 2nd open shift", async () => {
    const a = await crearNegocio()
    const b = await crearNegocio()
    const cajaA = (await listarCajas(a.owner)).body.cajas[0]
    const cajaB = (await listarCajas(b.owner)).body.cajas[0]
    expect(await fails(db.cajaFisica.create({ data: { negocioId: a.negocio.id, nombre: "Otra default", esPredeterminada: true } }))).toBe(true)
    expect(await fails(db.cajaFisica.create({ data: { negocioId: a.negocio.id, nombre: "Default inactiva", esPredeterminada: true, activa: false } }))).toBe(true)
    const base = { responsableTipo: "NEGOCIO", fondoInicialDecimal: D("1.00") }
    expect(await fails(db.turnoCaja.create({ data: { ...base, negocioId: a.negocio.id, responsableId: a.negocio.id, cajaFisicaId: cajaB.id } }))).toBe(true)
    expect(await fails(db.turnoCaja.create({ data: { ...base, negocioId: a.negocio.id, responsableId: a.negocio.id, cajaFisicaId: cajaA.id, fondoInicialDecimal: D("-0.01") } }))).toBe(true)
    expect(await fails(db.turnoCaja.create({ data: { ...base, negocioId: a.negocio.id, responsableId: "otro", cajaFisicaId: cajaA.id } }))).toBe(true)
    await db.turnoCaja.create({ data: { ...base, negocioId: a.negocio.id, responsableId: a.negocio.id, cajaFisicaId: cajaA.id } })
    const { empleado } = await crearCajero(a.negocio.id)
    expect(await fails(db.turnoCaja.create({ data: { negocioId: a.negocio.id, cajaFisicaId: cajaA.id, responsableTipo: "EMPLEADO", responsableId: empleado.id, empleadoId: empleado.id, fondoInicialDecimal: D("0") } }))).toBe(true)
    expect(await fails(db.negocio.update({ where: { id: a.negocio.id }, data: { cajaTurnosModo: "QUIZAS" } }))).toBe(true)
  })
})

// ---------------------------------------------------------------------------

describe("F10-B2.1 — opening shifts", () => {
  test("shift opening route is limited to explicitly allowlisted employees in TESTING", async () => {
    const { negocio } = await crearNegocio()
    const { empleado, cookie } = await crearCajero(negocio.id)
    const original = process.env.DELIGO_F10_B2_2_B_CONTROLLED_EMPLOYEE_IDS ?? ""
    process.env.DELIGO_F10_B2_2_B_CONTROLLED_EMPLOYEE_IDS = original.split(/[\s,;]+/).filter((id) => id && id !== empleado.id).join(",")
    try {
      expect((await turnoCajero(cookie, negocio.slug)).body.aperturaHabilitada).toBe(false)
      expect((await abrirCajero(cookie, negocio.slug, { fondoInicial: 10 })).status).toBe(403)
      expect(await db.turnoCaja.count({ where: { negocioId: negocio.id } })).toBe(0)
    } finally {
      process.env.DELIGO_F10_B2_2_B_CONTROLLED_EMPLOYEE_IDS = original
    }
  })

  test("cashier opens the default register with an exact fund; replay returns it; reused key → 409; no ledger, no stock change", async () => {
    const { negocio, owner } = await crearNegocio()
    const producto = await crearProducto(negocio.id, 100, { controlStock: true, stockCantidad: 5 })
    const { empleado, cookie } = await crearCajero(negocio.id)
    const current = await turnoCajero(cookie, negocio.slug)
    expect(current.body.aperturaHabilitada).toBe(true)
    expect(current.body).not.toHaveProperty("efectivoEsperado")
    const enabled = process.env.DELIGO_F10_B2_2_B_SHIFT_UI_ENABLED
    process.env.DELIGO_F10_B2_2_B_SHIFT_UI_ENABLED = "false"
    const closedGate = await abrirCajero(cookie, negocio.slug, { fondoInicial: 1 })
    expect(closedGate.status).toBe(403)
    expect(await db.turnoCaja.count({ where: { negocioId: negocio.id } })).toBe(0)
    process.env.DELIGO_F10_B2_2_B_SHIFT_UI_ENABLED = enabled
    const key = randomUUID()
    const first = await abrirCajero(cookie, negocio.slug, { fondoInicial: "20000.00" }, key)
    expect(first.status).toBe(201)
    expect(first.body.turno).toMatchObject({ fondoInicial: 20000, caja: { nombre: "Caja principal" } })
    const replay = await abrirCajero(cookie, negocio.slug, { fondoInicial: 20000 }, key)
    expect(replay.status).toBe(200)
    expect(replay.replayed).toBe(true)
    expect(replay.body.turno.id).toBe(first.body.turno.id)
    const reused = await abrirCajero(cookie, negocio.slug, { fondoInicial: 1 }, key)
    expect(reused.status).toBe(409)
    expect(reused.body.code).toBe("IDEMPOTENCY_KEY_REUSED")
    const turno = await db.turnoCaja.findUniqueOrThrow({ where: { id: first.body.turno.id } })
    expect(turno).toMatchObject({ negocioId: negocio.id, responsableTipo: "EMPLEADO", responsableId: empleado.id, empleadoId: empleado.id, estado: "ABIERTO" })
    expect(turno.fondoInicialDecimal.toFixed(2)).toBe("20000.00")
    expect(await db.turnoCaja.count({ where: { negocioId: negocio.id } })).toBe(1)
    expect(await db.operacionFinanciera.count({ where: { negocioId: negocio.id } })).toBe(0)
    expect(await db.movimientoInventario.count({ where: { negocioId: negocio.id } })).toBe(0)
    expect((await db.producto.findUniqueOrThrow({ where: { id: producto.id } })).stockCantidad).toBe(5)
    expect(await db.auditLog.count({ where: { userId: empleado.id, accion: "turno_caja.abierto" } })).toBe(1)
    // owner sees it (without expected cash in the list)
    const cajas = await listarCajas(owner)
    expect(cajas.body.cajas[0].turnoAbierto).toMatchObject({ id: turno.id, responsableTipo: "EMPLEADO" })
  })

  test("fund validation: key required, negatives / >2 decimals / text / out of range rejected", async () => {
    const { negocio } = await crearNegocio()
    const { cookie } = await crearCajero(negocio.id)
    const noKey = await abrirCajero(cookie, negocio.slug, { fondoInicial: 10 }, "")
    expect(noKey.status).toBe(400)
    expect(noKey.body.code).toBe("IDEMPOTENCY_KEY_REQUIRED")
    for (const fondoInicial of [-1, "-1", "1.234", 1.234, "abc", "", null, 10_000_000_000, "1e5", true]) {
      expect((await abrirCajero(cookie, negocio.slug, { fondoInicial })).status).toBe(400)
    }
    expect(await db.turnoCaja.count({ where: { negocioId: negocio.id } })).toBe(0)
    const ok = await abrirCajero(cookie, negocio.slug, { fondoInicial: "0.10" })
    expect(ok.status).toBe(201)
    expect((await db.turnoCaja.findFirstOrThrow({ where: { negocioId: negocio.id } })).fondoInicialDecimal.toFixed(2)).toBe("0.10")
  })

  test("two cashiers race for ONE register (6 concurrent attempts) → exactly one shift, the rest controlled 409", async () => {
    const { negocio, owner } = await crearNegocio()
    const caja = (await listarCajas(owner)).body.cajas[0]
    const c1 = await crearCajero(negocio.id)
    const c2 = await crearCajero(negocio.id)
    const attempts = await Promise.all([c1, c2, c1, c2, c1, c2].map((c) => abrirCajero(c.cookie, negocio.slug, { cajaFisicaId: caja.id, fondoInicial: 500 })))
    expect(attempts.filter((a) => a.status === 201)).toHaveLength(1)
    for (const a of attempts) {
      expect([201, 409]).toContain(a.status)
      if (a.status === 409) expect(["CAJA_CON_TURNO_ABIERTO", "TURNO_YA_ABIERTO"]).toContain(a.body.code)
    }
    expect(await db.turnoCaja.count({ where: { cajaFisicaId: caja.id } })).toBe(1)
  })

  test("same key sent 5 times concurrently → one shift, one fund", async () => {
    const { negocio } = await crearNegocio()
    const { cookie } = await crearCajero(negocio.id)
    const key = randomUUID()
    const results = await Promise.all(Array.from({ length: 5 }, () => abrirCajero(cookie, negocio.slug, { fondoInicial: 750 }, key)))
    expect(results.filter((r) => r.status === 201)).toHaveLength(1)
    for (const r of results) expect([200, 201]).toContain(r.status)
    expect(new Set(results.map((r) => r.body.turno.id)).size).toBe(1)
    expect(await db.turnoCaja.count({ where: { negocioId: negocio.id } })).toBe(1)
  })

  test("two different registers open concurrently by two cashiers; one cashier cannot hold a 2nd shift; owner opens their own (once)", async () => {
    const { negocio, owner } = await crearNegocio()
    const principal = (await listarCajas(owner)).body.cajas[0]
    const segunda = (await crearCaja(owner, "Segunda")).body
    const tercera = (await crearCaja(owner, "Tercera")).body
    const c1 = await crearCajero(negocio.id)
    const c2 = await crearCajero(negocio.id)
    const [r1, r2] = await Promise.all([
      abrirCajero(c1.cookie, negocio.slug, { cajaFisicaId: principal.id, fondoInicial: 1000 }),
      abrirCajero(c2.cookie, negocio.slug, { cajaFisicaId: segunda.id, fondoInicial: 2000 }),
    ])
    expect([r1.status, r2.status]).toEqual([201, 201])
    const again = await abrirCajero(c1.cookie, negocio.slug, { cajaFisicaId: tercera.id, fondoInicial: 1 })
    expect(again.status).toBe(409)
    expect(again.body.code).toBe("TURNO_YA_ABIERTO")
    const own = await abrirOwner(owner, { cajaFisicaId: tercera.id, fondoInicial: "300.50" })
    expect(own.status).toBe(201)
    expect(own.body).toMatchObject({ responsableTipo: "NEGOCIO", fondoInicial: 300.5 })
    expect((await abrirOwner(owner, { cajaFisicaId: principal.id, fondoInicial: 1 })).status).toBe(409)
    const list = await json(await getTurnosOwner(ownerReq("/api/negocio/caja/turnos", owner)))
    expect(list.body.turnos).toHaveLength(3)
  })
})

// ---------------------------------------------------------------------------

describe("F10-B2.1 — sales and cash attributed to the shift", () => {
  test("employee and owner share one shift; cash counts both actors and transfer is excluded", async () => {
    const { negocio, owner } = await crearNegocio()
    const p = await crearProducto(negocio.id, 1000)
    const { cookie } = await crearCajero(negocio.id)
    const turno = (await abrirCajero(cookie, negocio.slug, { fondoInicial: "20000.00" })).body.turno
    const [cash, ownerCash] = await Promise.all([
      venderCajero(cookie, negocio.slug, { metodoPago: "EFECTIVO", items: [{ productoId: p.id, cantidad: 5 }] }),
      venderOwner(owner, { metodoPago: "EFECTIVO", items: [{ productoId: p.id, cantidad: 8 }] }),
    ])
    const transfer = await venderCajero(cookie, negocio.slug, { metodoPago: "TRANSFERENCIA", items: [{ productoId: p.id, cantidad: 10 }] })
    expect([cash.status, ownerCash.status, transfer.status]).toEqual([201, 201, 201])
    expect(Object.keys(cash.body).sort()).toEqual(["cantidadItems", "createdAt", "id", "items", "metodoPago", "total"])
    const ventas = await db.venta.findMany({ where: { negocioId: negocio.id }, include: { cobros: true } })
    for (const v of ventas) expect(v.turnoCajaId).toBe(turno.id)
    const cuenta = await cuentaDeCaja(negocio.id, turno.caja.id)
    expect(cuenta).toMatchObject({ tipo: "EFECTIVO", cajaFisicaId: turno.caja.id })
    expect((await saldoCuenta(cuenta!.id)).toFixed(2)).toBe("13000.00")
    const ops = await db.operacionFinanciera.findMany({ where: { negocioId: negocio.id } })
    expect(ops).toHaveLength(2)
    expect(ops.every((op) => op.turnoCajaId === turno.id)).toBe(true)
    const sinAsignar = await db.cuentaFinanciera.findFirst({ where: { negocioId: negocio.id, clave: "efectivo_caja_sin_asignar" } })
    expect(sinAsignar).toBeNull()
    const d = await detalle(owner, turno.id)
    expect(d.status).toBe(200)
    expect(d.body.efectivo).toEqual({ fondoInicial: 20000, ingresosEfectivo: 13000, salidasEfectivo: 0, esperado: 33000, contadoDeclarado: null, diferencia: null })
    expect(d.body.ventas).toEqual({ cantidad: 3, totalEfectivo: 13000, totalTransferencia: 10000, totalOtro: 0 })
    const ownerVenta = await db.venta.findUniqueOrThrow({ where: { id: ownerCash.body.id } })
    expect(ownerVenta).toMatchObject({ actorTipo: "NEGOCIO", actorId: negocio.id, turnoCajaId: turno.id, empleadoId: null })
    expect((await db.venta.findUniqueOrThrow({ where: { id: cash.body.id } })).actorTipo).toBe("EMPLEADO")
  })

  test("exact cents: fund 0.10 + cash 0.20 + cash 0.10×3 → expected exactly 0.60", async () => {
    const { negocio, owner } = await crearNegocio()
    const a = await crearProducto(negocio.id, 0.2)
    const b = await crearProducto(negocio.id, 0.1)
    const { cookie } = await crearCajero(negocio.id)
    const turno = (await abrirCajero(cookie, negocio.slug, { fondoInicial: "0.10" })).body.turno
    expect((await venderCajero(cookie, negocio.slug, { metodoPago: "EFECTIVO", items: [{ productoId: a.id, cantidad: 1 }] })).status).toBe(201)
    expect((await venderCajero(cookie, negocio.slug, { metodoPago: "EFECTIVO", items: [{ productoId: b.id, cantidad: 3 }] })).status).toBe(201)
    const d = await detalle(owner, turno.id)
    expect(d.body.efectivo.esperado).toBe(0.6)
    expect(D(String(d.body.efectivo.esperado)).equals(D("0.60"))).toBe(true)
  })

  test("two registers, two cashiers, concurrent sales: each register's cash account only holds its own sales", async () => {
    const { negocio, owner } = await crearNegocio()
    const p = await crearProducto(negocio.id, 100)
    const principal = (await listarCajas(owner)).body.cajas[0]
    const segunda = (await crearCaja(owner, "Segunda")).body
    const c1 = await crearCajero(negocio.id)
    const c2 = await crearCajero(negocio.id)
    const t1 = (await abrirCajero(c1.cookie, negocio.slug, { cajaFisicaId: principal.id, fondoInicial: 0 })).body.turno
    const t2 = (await abrirCajero(c2.cookie, negocio.slug, { cajaFisicaId: segunda.id, fondoInicial: 0 })).body.turno
    const res = await Promise.all([
      venderCajero(c1.cookie, negocio.slug, { metodoPago: "EFECTIVO", items: [{ productoId: p.id, cantidad: 3 }] }),
      venderCajero(c2.cookie, negocio.slug, { metodoPago: "EFECTIVO", items: [{ productoId: p.id, cantidad: 7 }] }),
      venderCajero(c1.cookie, negocio.slug, { metodoPago: "EFECTIVO", items: [{ productoId: p.id, cantidad: 1 }] }),
    ])
    for (const r of res) expect(r.status).toBe(201)
    expect((await saldoCuenta((await cuentaDeCaja(negocio.id, principal.id))!.id)).toFixed(2)).toBe("400.00")
    expect((await saldoCuenta((await cuentaDeCaja(negocio.id, segunda.id))!.id)).toFixed(2)).toBe("700.00")
    expect((await detalle(owner, t1.id)).body.efectivo.esperado).toBe(400)
    expect((await detalle(owner, t2.id)).body.efectivo.esperado).toBe(700)
  })

  test("transition (OPCIONAL): a cashier without a shift still sells (F10-B1), cash to the historical unassigned account", async () => {
    const { negocio } = await crearNegocio()
    const p = await crearProducto(negocio.id, 50)
    const { cookie } = await crearCajero(negocio.id)
    const r = await venderCajero(cookie, negocio.slug, { metodoPago: "EFECTIVO", items: [{ productoId: p.id, cantidad: 2 }] })
    expect(r.status).toBe(201)
    const v = await db.venta.findUniqueOrThrow({ where: { id: r.body.id } })
    expect(v.turnoCajaId).toBeNull()
    const cuenta = await db.cuentaFinanciera.findFirstOrThrow({ where: { negocioId: negocio.id, clave: "efectivo_caja_sin_asignar" } })
    expect(cuenta.cajaFisicaId).toBeNull()
    expect(await db.cajaFisica.count({ where: { negocioId: negocio.id } })).toBe(0)
  })

  test("OBLIGATORIO: a cashier without a shift cannot sell (409, nothing written); with a shift it sells; the owner is not forced (pending decision)", async () => {
    const { negocio, owner } = await crearNegocio({ cajaTurnosModo: "OBLIGATORIO" })
    const p = await crearProducto(negocio.id, 10)
    const { cookie } = await crearCajero(negocio.id)
    const blocked = await venderCajero(cookie, negocio.slug, { metodoPago: "EFECTIVO", items: [{ productoId: p.id, cantidad: 1 }] })
    expect(blocked.status).toBe(409)
    expect(blocked.body.code).toBe("TURNO_REQUERIDO")
    expect(await db.venta.count({ where: { negocioId: negocio.id } })).toBe(0)
    expect((await turnoCajero(cookie, negocio.slug)).body.modoTurnos).toBe("OBLIGATORIO")
    await abrirCajero(cookie, negocio.slug, { fondoInicial: 0 })
    expect((await venderCajero(cookie, negocio.slug, { metodoPago: "EFECTIVO", items: [{ productoId: p.id, cantidad: 1 }] })).status).toBe(201)
    const ownerSale = await venderOwner(owner, { metodoPago: "EFECTIVO", items: [{ productoId: p.id, cantidad: 1 }] })
    expect(ownerSale.status).toBe(201)
    expect(ownerSale.body.turnoCajaId).not.toBeNull()
  })

  test("one open register resolves automatically; multiple open registers require explicit owner selection", async () => {
    const { negocio, owner } = await crearNegocio()
    const p = await crearProducto(negocio.id, 10)
    await listarCajas(owner)
    const { cookie } = await crearCajero(negocio.id)
    const tEmp = (await abrirCajero(cookie, negocio.slug, { fondoInicial: 0 })).body.turno
    const active = await json(await getTurnosOwner(ownerReq("/api/negocio/caja/turnos", owner)))
    expect(active.body.turnos.find((t: { id: string }) => t.id === tEmp.id)).toMatchObject({ estado: "ABIERTO", responsableNombre: expect.any(String) })
    const emptySelection = await venderOwner(owner, { metodoPago: "EFECTIVO", cajaFisicaId: "", items: [{ productoId: p.id, cantidad: 1 }] })
    expect(emptySelection.status).toBe(400)
    const key = randomUUID()
    const auto = await venderOwner(owner, { metodoPago: "EFECTIVO", items: [{ productoId: p.id, cantidad: 1 }] }, key)
    expect(auto.status).toBe(201)
    expect(auto.body.turnoCajaId).toBe(tEmp.id)
    const segunda = (await crearCaja(owner, "Segunda")).body
    const cashier2 = await crearCajero(negocio.id)
    const t2 = (await abrirCajero(cashier2.cookie, negocio.slug, { cajaFisicaId: segunda.id, fondoInicial: 0 })).body.turno
    const ambiguous = await venderOwner(owner, { metodoPago: "EFECTIVO", items: [{ productoId: p.id, cantidad: 1 }] })
    expect(ambiguous.status).toBe(409)
    expect(ambiguous.body.code).toBe("CAJA_SELECCION_REQUERIDA")
    const selected = await venderOwner(owner, { metodoPago: "EFECTIVO", cajaFisicaId: segunda.id, items: [{ productoId: p.id, cantidad: 2 }] })
    expect(selected.status).toBe(201)
    expect(selected.body.turnoCajaId).toBe(t2.id)
    const v = await db.venta.findUniqueOrThrow({ where: { id: selected.body.id } })
    expect(v).toMatchObject({ actorTipo: "NEGOCIO", actorId: negocio.id, turnoCajaId: t2.id })
    expect((await detalle(owner, tEmp.id)).body.efectivo.esperado).toBe(10)
    expect((await detalle(owner, t2.id)).body.efectivo.esperado).toBe(20)
    const changedBox = await venderOwner(owner, { metodoPago: "EFECTIVO", cajaFisicaId: segunda.id, items: [{ productoId: p.id, cantidad: 1 }] }, key)
    expect(changedBox.status).toBe(409)
    expect(changedBox.body.code).toBe("IDEMPOTENCY_KEY_REUSED")
    const otro = await crearNegocio()
    const cajaAjena = (await listarCajas(otro.owner)).body.cajas[0]
    const foreign = await venderOwner(owner, { metodoPago: "EFECTIVO", cajaFisicaId: cajaAjena.id, items: [{ productoId: p.id, cantidad: 1 }] })
    expect(foreign.status).toBe(404)
    await db.turnoCaja.update({ where: { id: t2.id }, data: { estado: "CERRADO" } })
    const closed = await venderOwner(owner, { metodoPago: "EFECTIVO", cajaFisicaId: segunda.id, items: [{ productoId: p.id, cantidad: 1 }] })
    expect(closed.status).toBe(409)
    expect(closed.body.code).toBe("TURNO_NO_DISPONIBLE")
  })

  test("an exact owner replay keeps its original shift after that register is reopened", async () => {
    const { negocio, owner } = await crearNegocio()
    const p = await crearProducto(negocio.id, 10)
    const cashier = await crearCajero(negocio.id)
    const firstTurno = (await abrirCajero(cashier.cookie, negocio.slug, { fondoInicial: 0 })).body.turno
    const key = randomUUID()
    const body = { metodoPago: "EFECTIVO", items: [{ productoId: p.id, cantidad: 1 }] }
    const first = await venderOwner(owner, body, key)
    expect(first.status).toBe(201)
    await db.turnoCaja.update({ where: { id: firstTurno.id }, data: { estado: "CERRADO" } })
    const reopened = (await abrirCajero(cashier.cookie, negocio.slug, { cajaFisicaId: firstTurno.caja.id, fondoInicial: 50 })).body.turno
    expect(reopened.id).not.toBe(firstTurno.id)
    const replay = await venderOwner(owner, body, key)
    expect(replay.status).toBe(200)
    expect(replay.replayed).toBe(true)
    expect(replay.body.id).toBe(first.body.id)
    expect(replay.body.turnoCajaId).toBe(firstTurno.id)
    expect((await detalle(owner, reopened.id)).body.ventas.cantidad).toBe(0)
  })

  test("a shift the actor does not own is never accepted (engine: another employee's / the owner's / another business's) and the body cannot name a shift", async () => {
    const { negocio, owner } = await crearNegocio()
    const otro = await crearNegocio()
    const p = await crearProducto(negocio.id, 10)
    await listarCajas(owner)
    const segunda = (await crearCaja(owner, "Segunda")).body
    const c1 = await crearCajero(negocio.id)
    const c2 = await crearCajero(negocio.id)
    const t1 = (await abrirCajero(c1.cookie, negocio.slug, { fondoInicial: 0 })).body.turno
    const tOwner = (await abrirOwner(owner, { cajaFisicaId: segunda.id, fondoInicial: 0 })).body
    const c3 = await crearCajero(otro.negocio.id)
    const tOtro = (await abrirCajero(c3.cookie, otro.negocio.slug, { fondoInicial: 0 })).body.turno
    const lines = [{ productoId: p.id, cantidad: 1 }]
    const attempts = [
      { actor: { tipo: "EMPLEADO" as const, empleadoId: c2.empleado.id }, turnoCajaId: t1.id },
      { actor: { tipo: "EMPLEADO" as const, empleadoId: c1.empleado.id }, turnoCajaId: tOwner.id },
      { actor: { tipo: "NEGOCIO" as const }, turnoCajaId: t1.id },
      { actor: { tipo: "EMPLEADO" as const, empleadoId: c1.empleado.id }, turnoCajaId: tOtro.id },
    ]
    for (const a of attempts) {
      const r = await registrarVentaCaja(db, { negocioId: negocio.id, actor: a.actor, metodoPago: "EFECTIVO", lines, idempotencyKey: randomUUID(), turnoCajaId: a.turnoCajaId })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.code).toBe("TURNO_NO_DISPONIBLE")
    }
    expect(await db.venta.count({ where: { negocioId: negocio.id } })).toBe(0)
    // the body naming someone else's shift (and an actor / business) is ignored: the sale goes to the cashier's own shift
    const r = await venderCajero(c2.cookie, negocio.slug, { metodoPago: "EFECTIVO", items: lines, turnoCajaId: t1.id, turnoId: t1.id, actorId: c1.empleado.id, negocioId: otro.negocio.id })
    expect(r.status).toBe(201)
    const v = await db.venta.findUniqueOrThrow({ where: { id: r.body.id } })
    expect(v).toMatchObject({ negocioId: negocio.id, actorId: c2.empleado.id, turnoCajaId: null })
  })

  test("idempotent sale inside a shift: replay and double tap → one sale, one cobro, one cash leg", async () => {
    const { negocio } = await crearNegocio()
    const p = await crearProducto(negocio.id, 25, { controlStock: true, stockCantidad: 20 })
    const { cookie } = await crearCajero(negocio.id)
    const turno = (await abrirCajero(cookie, negocio.slug, { fondoInicial: 0 })).body.turno
    const key = randomUUID()
    const body = { metodoPago: "EFECTIVO", items: [{ productoId: p.id, cantidad: 2 }] }
    const results = await Promise.all(Array.from({ length: 6 }, () => venderCajero(cookie, negocio.slug, body, key)))
    expect(results.filter((r) => r.status === 201)).toHaveLength(1)
    for (const r of results) expect([200, 201, 409]).toContain(r.status)
    expect(await db.venta.count({ where: { negocioId: negocio.id } })).toBe(1)
    expect(await db.cobroVenta.count({ where: { negocioId: negocio.id } })).toBe(1)
    expect(await db.movimientoFinanciero.count({ where: { negocioId: negocio.id } })).toBe(1)
    expect((await db.producto.findUniqueOrThrow({ where: { id: p.id } })).stockCantidad).toBe(18)
    expect((await saldoCuenta((await cuentaDeCaja(negocio.id, turno.caja.id))!.id)).toFixed(2)).toBe("50.00")
  })

  test("R3A: an ACTIVA reservation still blocks reserved units inside a shift (409, nothing written)", async () => {
    const { negocio } = await crearNegocio()
    const p = await crearProducto(negocio.id, 100, { controlStock: true, stockCantidad: 1 })
    const pedido = await db.pedido.create({
      data: { negocioId: negocio.id, negocioSlug: negocio.slug, negocioNombre: "N", clienteNombre: "C", metodoEntrega: "retiro", estado: "recibido", total: 100, totalProductos: 100, idempotencyKey: `test-f10b21-${randomUUID()}` },
    })
    const item = await db.pedidoItem.create({ data: { pedidoId: pedido.id, productoId: p.id, nombre: "R", precio: 100, cantidad: 1 } })
    await db.reservaStock.create({ data: { negocioId: negocio.id, pedidoId: pedido.id, pedidoItemId: item.id, productoId: p.id, cantidad: 1, estado: "ACTIVA" } })
    const { cookie } = await crearCajero(negocio.id)
    await abrirCajero(cookie, negocio.slug, { fondoInicial: 0 })
    const r = await venderCajero(cookie, negocio.slug, { metodoPago: "EFECTIVO", items: [{ productoId: p.id, cantidad: 1 }] })
    expect(r.status).toBe(409)
    expect(r.body.code).toBe("STOCK_RESERVED_FOR_ORDERS")
    expect(await db.venta.count({ where: { negocioId: negocio.id } })).toBe(0)
    expect(await db.movimientoFinanciero.count({ where: { negocioId: negocio.id } })).toBe(0)
    expect((await db.producto.findUniqueOrThrow({ where: { id: p.id } })).stockCantidad).toBe(1)
  })
})

// ---------------------------------------------------------------------------

describe("F10-B2.1 — access and blind-close safety", () => {
  test("cashier shift route: no session 401, other area 403, inactive 403, suspended 403, non-generic 403", async () => {
    const { negocio } = await crearNegocio()
    expect((await turnoCajero("", negocio.slug)).status).toBe(401)
    expect((await abrirCajero("", negocio.slug, { fondoInicial: 1 })).status).toBe(401)
    const mozo = await crearCajero(negocio.id, { area: "mozo" })
    expect((await turnoCajero(mozo.cookie, negocio.slug)).status).toBe(403)
    expect((await abrirCajero(mozo.cookie, negocio.slug, { fondoInicial: 1 })).status).toBe(403)
    const inactivo = await crearCajero(negocio.id, { activo: false })
    expect((await abrirCajero(inactivo.cookie, negocio.slug, { fondoInicial: 1 })).status).toBe(403)
    expect((await venderCajero(inactivo.cookie, negocio.slug, { metodoPago: "EFECTIVO", items: [{ productoId: "foreign", cantidad: 1 }] })).status).toBe(403)
    const susp = await crearNegocio({ suspendido: true })
    const cs = await crearCajero(susp.negocio.id)
    expect((await abrirCajero(cs.cookie, susp.negocio.slug, { fondoInicial: 1 })).status).toBe(403)
    const resto = await crearNegocio({ rubro: "restaurante" })
    const cr = await crearCajero(resto.negocio.id)
    expect((await abrirCajero(cr.cookie, resto.negocio.slug, { fondoInicial: 1 })).status).toBe(403)
    expect(await db.turnoCaja.count({ where: { negocioId: { in: [negocio.id, susp.negocio.id, resto.negocio.id] } } })).toBe(0)
  })

  test("the cashier NEVER receives expected cash, totals or other people's shifts; owner routes reject the operational cookie", async () => {
    const { negocio, owner } = await crearNegocio()
    const p = await crearProducto(negocio.id, 1234)
    const c1 = await crearCajero(negocio.id)
    const c2 = await crearCajero(negocio.id)
    const t1 = (await abrirCajero(c1.cookie, negocio.slug, { fondoInicial: "777.00" })).body.turno
    await venderCajero(c1.cookie, negocio.slug, { metodoPago: "EFECTIVO", items: [{ productoId: p.id, cantidad: 1 }] })
    const own = await turnoCajero(c1.cookie, negocio.slug)
    expect(Object.keys(own.body).sort()).toEqual(["aperturaHabilitada", "cajas", "modoTurnos", "ok", "turno", "ultimoCierre"])
    expect(Object.keys(own.body.turno).sort()).toEqual(["abiertoEn", "caja", "fondoInicial", "id"])
    const text = JSON.stringify(own.body)
    for (const leak of ["esperado", "ingresos", "salidas", "diferencia", "saldo", "totalEfectivo", "2011"]) expect(text).not.toContain(leak)
    const other = await turnoCajero(c2.cookie, negocio.slug)
    expect(other.body.turno).toBeNull()
    expect(other.body.cajas[0]).toEqual({ id: t1.caja.id, nombre: "Caja principal", esPredeterminada: true, ocupada: true, fondoTransferible: null })
    expect(JSON.stringify(other.body)).not.toContain(c1.empleado.id)
    expect(JSON.stringify(other.body)).not.toContain("777")
    for (const res of [
      await getTurnoDetalle(ownerReq(`/api/negocio/caja/turnos/${t1.id}`, c1.cookie), idCtx(t1.id)),
      await getCajas(ownerReq("/api/negocio/caja/cajas", c1.cookie)),
      await getTurnosOwner(ownerReq("/api/negocio/caja/turnos", c1.cookie)),
      await postCaja(ownerReq("/api/negocio/caja/cajas", c1.cookie, "POST", { nombre: "x" })),
    ]) expect([401, 403]).toContain(res.status)
    // the owner of ANOTHER business cannot read this shift
    const otro = await crearNegocio()
    expect((await detalle(otro.owner, t1.id)).status).toBe(404)
    expect((await json(await getTurnosOwner(ownerReq("/api/negocio/caja/turnos", otro.owner)))).body.turnos).toHaveLength(0)
    // and this owner does see the administrative figure
    expect((await detalle(owner, t1.id)).body.efectivo.esperado).toBe(2011)
  })
})

describe("F10-B2.2-C — blind declared close", () => {
  test("responsible cashier closes once, replay is idempotent, shared owner cannot close it, and sales stop", async () => {
    const { negocio, owner } = await crearNegocio()
    const producto = await crearProducto(negocio.id, 7)
    await listarCajas(owner)
    const cashier = await crearCajero(negocio.id)
    const other = await crearCajero(negocio.id)
    const turno = (await abrirCajero(cashier.cookie, negocio.slug, { fondoInicial: "1.25" })).body.turno
    await venderOwner(owner, { metodoPago: "EFECTIVO", items: [{ productoId: producto.id, cantidad: 1 }] })
    await venderCajero(cashier.cookie, negocio.slug, { metodoPago: "EFECTIVO", items: [{ productoId: producto.id, cantidad: 1 }] })

    const unauthorized = await cerrarCajero(other.cookie, negocio.slug, turno.id, "15.25")
    expect(unauthorized.status).toBe(403)
    expect((await cerrarOwner(owner, turno.id, "15.25")).status).toBe(403)

    const key = randomUUID()
    const closed = await cerrarCajero(cashier.cookie, negocio.slug, turno.id, "15.25", key)
    expect(closed.status).toBe(200)
    expect(closed.body.turno).toMatchObject({ id: turno.id, estado: "CERRADO_DECLARADO" })
    expect(closed.body.turno.efectivoContado).toBeUndefined()
    expect(JSON.stringify(closed.body)).not.toMatch(/esperado|diferencia|15\.25/i)
    const replay = await cerrarCajero(cashier.cookie, negocio.slug, turno.id, "15.25", key)
    expect(replay.status).toBe(200)
    expect(replay.replayed).toBe(true)
    const reused = await cerrarCajero(cashier.cookie, negocio.slug, turno.id, "15.26", key)
    expect(reused.status).toBe(409)
    expect(reused.body.code).toBe("IDEMPOTENCY_KEY_REUSED")

    const saved = await db.turnoCaja.findUniqueOrThrow({ where: { id: turno.id } })
    expect(saved.estado).toBe("CERRADO_DECLARADO")
    expect(saved.efectivoContadoDecimal?.toFixed(2)).toBe("15.25")
    expect(saved.cerradoEn).toBeInstanceOf(Date)
    const employeeView = await turnoCajero(cashier.cookie, negocio.slug)
    expect(employeeView.body.turno).toBeNull()
    expect(employeeView.body.ultimoCierre).toMatchObject({ id: turno.id })
    const employeeJson = JSON.stringify(employeeView.body)
    for (const field of ["esperado", "diferencia", "efectivoContado", "15.25"]) expect(employeeJson).not.toContain(field)
    const saleAfterClose = await venderOwner(owner, { metodoPago: "EFECTIVO", cajaFisicaId: turno.caja.id, items: [{ productoId: producto.id, cantidad: 1 }] })
    expect(saleAfterClose.status).toBe(409)
    expect(saleAfterClose.body.code).toBe("TURNO_NO_DISPONIBLE")
  })

  test("the owner closes only their own NEGOCIO shift", async () => {
    const { negocio, owner } = await crearNegocio()
    const opened = await abrirOwner(owner, { fondoInicial: "0" })
    expect(opened.status).toBe(201)
    const turno = opened.body
    const result = await cerrarOwner(owner, turno.id, "0.10")
    expect(result.status).toBe(200)
    expect(result.body.turno.estado).toBe("CERRADO_DECLARADO")
    const saved = await db.turnoCaja.findUniqueOrThrow({ where: { id: turno.id } })
    expect(saved.responsableTipo).toBe("NEGOCIO")
    expect(saved.efectivoContadoDecimal?.toFixed(2)).toBe("0.10")
    const employee = await crearCajero(negocio.id)
    expect((await cerrarCajero(employee.cookie, negocio.slug, turno.id, "0.10")).status).toBe(403)
  })

  test("simultaneous closes resolve to one persisted declaration; missing and already-closed turns are rejected", async () => {
    const { negocio } = await crearNegocio()
    const cashier = await crearCajero(negocio.id)
    const turno = (await abrirCajero(cashier.cookie, negocio.slug, { fondoInicial: "0" })).body.turno
    const key = randomUUID()
    const attempts = await Promise.all(Array.from({ length: 6 }, () => cerrarCajero(cashier.cookie, negocio.slug, turno.id, "4.50", key)))
    expect(attempts.map((attempt) => ({ status: attempt.status, code: attempt.body.code ?? null }))).toEqual(
      Array.from({ length: 6 }, () => ({ status: 200, code: null }))
    )
    expect(attempts.filter((attempt) => !attempt.replayed)).toHaveLength(1)
    const row = await db.turnoCaja.findUniqueOrThrow({ where: { id: turno.id } })
    expect(row.estado).toBe("CERRADO_DECLARADO")
    expect(row.efectivoContadoDecimal?.toFixed(2)).toBe("4.50")
    expect((await cerrarCajero(cashier.cookie, negocio.slug, "missing-turno-id", "4.50")).status).toBe(404)
    const secondKey = randomUUID()
    const closedAgain = await cerrarCajero(cashier.cookie, negocio.slug, turno.id, "4.50", secondKey)
    expect(closedAgain.status).toBe(409)
    expect(closedAgain.body.code).toBe("TURNO_NO_ABIERTO")
  })

  test("concurrent sale and close are serialized; no sale can commit after closure", async () => {
    const { negocio, owner } = await crearNegocio()
    const producto = await crearProducto(negocio.id, 11)
    const cashier = await crearCajero(negocio.id)
    const turno = (await abrirCajero(cashier.cookie, negocio.slug, { fondoInicial: "0" })).body.turno
    const [sale, close] = await Promise.all([
      venderOwner(owner, { metodoPago: "EFECTIVO", cajaFisicaId: turno.caja.id, items: [{ productoId: producto.id, cantidad: 1 }] }),
      cerrarCajero(cashier.cookie, negocio.slug, turno.id, "11.00"),
    ])
    expect(close.status).toBe(200)
    expect([201, 409]).toContain(sale.status)
    const after = await db.turnoCaja.findUniqueOrThrow({ where: { id: turno.id } })
    expect(after.estado).toBe("CERRADO_DECLARADO")
    if (sale.status === 201) {
      const savedSale = await db.venta.findUniqueOrThrow({ where: { id: sale.body.id } })
      expect(savedSale.turnoCajaId).toBe(turno.id)
      expect(savedSale.createdAt.getTime()).toBeLessThanOrEqual(after.cerradoEn!.getTime())
    } else {
      expect(await db.venta.count({ where: { negocioId: negocio.id } })).toBe(0)
    }
  })
})

describe("F10-B2.2-D — owner review of closed shifts", () => {
  test("exact shared cash, match/shortage/surplus, immutable declaration, idempotent review and history after register reuse", async () => {
    const { negocio, owner } = await crearNegocio()
    const producto = await crearProducto(negocio.id, 0.1)
    const cashier = await crearCajero(negocio.id)
    const caja = (await listarCajas(owner)).body.cajas[0]

    const openClose = async (fund: string, count: string) => {
      const opened = await abrirCajero(cashier.cookie, negocio.slug, { cajaFisicaId: caja.id, fondoInicial: fund })
      expect(opened.status).toBe(201)
      const turno = opened.body.turno
      await venderOwner(owner, { metodoPago: "EFECTIVO", cajaFisicaId: caja.id, items: [{ productoId: producto.id, cantidad: 1 }] })
      await venderCajero(cashier.cookie, negocio.slug, { metodoPago: "EFECTIVO", items: [{ productoId: producto.id, cantidad: 1 }] })
      const close = await cerrarCajero(cashier.cookie, negocio.slug, turno.id, count)
      expect(close.status).toBe(200)
      return turno.id as string
    }

    const coincidente = await openClose("0.10", "0.30")
    const missing = await openClose("0.10", "0.29")
    const surplus = await openClose("0.10", "0.31")

    const listed = await turnosCerrados(owner)
    expect(listed.status).toBe(200)
    expect(listed.body.turnos).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: coincidente, efectivoEsperado: 0.3, efectivoContado: 0.3, diferencia: 0, resultado: "COINCIDE", estadoRevision: "PENDIENTE_REVISION" }),
      expect.objectContaining({ id: missing, efectivoEsperado: 0.3, efectivoContado: 0.29, diferencia: -0.01, resultado: "FALTANTE" }),
      expect.objectContaining({ id: surplus, efectivoEsperado: 0.3, efectivoContado: 0.31, diferencia: 0.01, resultado: "SOBRANTE" }),
    ]))

    expect((await revisarTurno(owner, coincidente, null)).status).toBe(201)
    const missingNoNote = await revisarTurno(owner, missing, null)
    expect(missingNoNote.status).toBe(400)
    expect(missingNoNote.body.code).toBe("OBSERVACION_REQUERIDA")
    const reviewKey = randomUUID()
    const missingReview = await revisarTurno(owner, missing, "Conteo verificado con responsable", reviewKey)
    expect(missingReview.status).toBe(201)
    expect(missingReview.body.revision).toMatchObject({ efectivoEsperado: 0.3, efectivoContado: 0.29, diferencia: -0.01 })
    const concurrentReplay = await Promise.all(Array.from({ length: 5 }, () => revisarTurno(owner, missing, "Conteo verificado con responsable", reviewKey)))
    expect(concurrentReplay.every((result) => [200, 201].includes(result.status))).toBe(true)
    expect(concurrentReplay.filter((result) => result.status === 201)).toHaveLength(0)
    const replay = await revisarTurno(owner, missing, "Conteo verificado con responsable", reviewKey)
    expect(replay.status).toBe(200)
    expect(replay.replayed).toBe(true)
    expect((await revisarTurno(owner, missing, "Otra observación", reviewKey)).body.code).toBe("IDEMPOTENCY_KEY_REUSED")
    expect((await revisarTurno(owner, surplus, "Diferencia registrada")).status).toBe(201)

    const events = await revisionesTurno(owner, missing)
    expect(events.body.revisiones).toHaveLength(1)
    expect(events.body.revisiones[0]).toMatchObject({ observacion: "Conteo verificado con responsable", diferencia: -0.01 })
    const saved = await db.turnoCaja.findUniqueOrThrow({ where: { id: missing } })
    expect(saved.efectivoContadoDecimal?.toFixed(2)).toBe("0.29")
    expect(saved.efectivoEsperadoDecimal?.toFixed(2)).toBe("0.30")

    const openedAgain = await abrirCajero(cashier.cookie, negocio.slug, { cajaFisicaId: caja.id, fondoInicial: "5.00" })
    expect(openedAgain.status).toBe(201)
    const afterReuse = await turnosCerrados(owner)
    expect(afterReuse.body.turnos.map((turno: { id: string }) => turno.id)).toEqual(expect.arrayContaining([coincidente, missing, surplus]))
    expect(afterReuse.body.turnos.find((turno: { id: string }) => turno.id === missing).estadoRevision).toBe("REVISADO")

    const otherBusiness = await crearNegocio()
    expect((await revisionesTurno(otherBusiness.owner, missing)).status).toBe(404)
    expect((await revisarTurno(otherBusiness.owner, missing, "Intento ajeno")).status).toBe(404)
    expect([401, 403]).toContain((await turnosCerrados(cashier.cookie)).status)
    expect([401, 403]).toContain((await revisionesTurno(cashier.cookie, missing)).status)
    expect([401, 403]).toContain((await revisarTurno(cashier.cookie, missing, "Intento de empleado")).status)
    const cashierView = await turnoCajero(cashier.cookie, negocio.slug)
    expect(JSON.stringify(cashierView.body)).not.toMatch(/esperado|diferencia|efectivoContado|0\.29|0\.30/i)
  })

  test("open shifts cannot be reviewed and review never writes financial movements", async () => {
    const { negocio, owner } = await crearNegocio()
    const cashier = await crearCajero(negocio.id)
    const turno = (await abrirCajero(cashier.cookie, negocio.slug, { fondoInicial: "9.00" })).body.turno
    const before = await db.movimientoFinanciero.count({ where: { negocioId: negocio.id } })
    expect((await revisarTurno(owner, turno.id, "Intento sobre turno abierto")).status).toBe(409)
    expect(await db.revisionTurnoCaja.count({ where: { negocioId: negocio.id } })).toBe(0)
    expect(await db.movimientoFinanciero.count({ where: { negocioId: negocio.id } })).toBe(before)
  })
})

describe("F10-B2.2-E — owner cash custody", () => {
  const ephemeralTest = isEphemeralIntegrationDb ? test : test.skip

  ephemeralTest("partial handover preserves declaration and review, is idempotent, owner-only, and rectifies append-only", async () => {
    const { negocio, owner } = await crearNegocio()
    const cashier = await crearCajero(negocio.id)
    const otherBusiness = await crearNegocio()
    const caja = (await listarCajas(owner)).body.cajas[0]
    const product = await crearProducto(negocio.id, 0.1)
    const turno = (await abrirCajero(cashier.cookie, negocio.slug, { cajaFisicaId: caja.id, fondoInicial: "0.10" })).body.turno
    await venderOwner(owner, { metodoPago: "EFECTIVO", cajaFisicaId: caja.id, items: [{ productoId: product.id, cantidad: 1 }] })
    const closed = await cerrarCajero(cashier.cookie, negocio.slug, turno.id, "0.19")
    expect(closed.status).toBe(200)
    expect((await revisarTurno(owner, turno.id, "Conteo de prueba verificado")).status).toBe(201)
    expect((await turnosCerrados(owner)).body.turnos.find((item: { id: string }) => item.id === turno.id).estadoEntrega).toBe("PENDIENTE_ENTREGA")
    expect((await abrirCajero(cashier.cookie, negocio.slug, { cajaFisicaId: caja.id, fondoInicial: "0.09" })).status).toBe(201)

    const beforeMovements = await db.movimientoFinanciero.count({ where: { negocioId: negocio.id } })
    const body = { tipo: "ENTREGA_CONFIRMADA", efectivoEntregado: "0.15", fondoRemanente: "0.04", destinoTipo: "RESGUARDO", destinoNombre: "Caja fuerte de prueba", observacion: "Entrega de prueba", confirmar: true }
    const cashierAttempt = await entregarTurno(cashier.cookie, turno.id, body)
    expect([401, 403]).toContain(cashierAttempt.status)
    expect((await entregarTurno(otherBusiness.owner, turno.id, body)).status).toBe(404)
    expect((await entregarTurno(owner, turno.id, { ...body, efectivoEntregado: "0.15", fondoRemanente: "0.03" })).body.code).toBe("SUMA_NO_COINCIDE")
    expect((await entregarTurno(owner, turno.id, { ...body, efectivoEntregado: "-0.01" })).status).toBe(400)
    expect((await entregarTurno(owner, turno.id, { ...body, confirmar: false })).body.code).toBe("CONFIRMACION_REQUERIDA")

    const key = randomUUID()
    const simultaneous = await Promise.all(Array.from({ length: 4 }, () => entregarTurno(owner, turno.id, body, key)))
    expect(simultaneous.every((item) => item.status === 200 || item.status === 201)).toBe(true)
    expect(simultaneous.filter((item) => item.status === 201)).toHaveLength(1)
    const first = simultaneous.find((item) => item.status === 201)!
    expect(first.body.entrega).toMatchObject({ efectivoContado: 0.19, efectivoEntregado: 0.15, fondoRemanente: 0.04, destinoTipo: "RESGUARDO", destinoNombre: "Caja fuerte de prueba" })
    expect(simultaneous.filter((item) => item.status === 200 && item.replayed)).toHaveLength(3)
    expect((await entregarTurno(owner, turno.id, body)).body.code).toBe("ENTREGA_YA_CONFIRMADA")
    expect((await entregarTurno(owner, turno.id, { ...body, efectivoEntregado: "0.14", fondoRemanente: "0.05" }, key)).body.code).toBe("IDEMPOTENCY_KEY_REUSED")

    const correction = await entregarTurno(owner, turno.id, { ...body, tipo: "RECTIFICACION", efectivoEntregado: "0.10", fondoRemanente: "0.09", observacion: "Corrección auditada" })
    expect(correction.status).toBe(201)
    const history = await entregasTurno(owner, turno.id)
    expect(history.status).toBe(200)
    expect(history.body.entregas).toHaveLength(2)
    expect(history.body.entregas.map((event: { tipo: string }) => event.tipo)).toEqual(["ENTREGA_CONFIRMADA", "RECTIFICACION"])
    expect(history.body.entregas[0]).toMatchObject({ efectivoContado: 0.19, efectivoEntregado: 0.15, fondoRemanente: 0.04 })
    expect(history.body.entregas[1]).toMatchObject({ efectivoContado: 0.19, efectivoEsperado: 0.2, diferencia: -0.01, efectivoEntregado: 0.1, fondoRemanente: 0.09 })
    expect(await fails(db.entregaCustodiaTurnoCaja.update({ where: { id: first.body.entrega.id }, data: { observacion: "alteración" } }))).toBe(true)
    expect(await fails(db.entregaCustodiaTurnoCaja.delete({ where: { id: first.body.entrega.id } }))).toBe(true)
    expect(await fails(db.entregaCustodiaTurnoCaja.delete({ where: { id: correction.body.entrega.id } }))).toBe(true)
    expect((await entregasTurno(otherBusiness.owner, turno.id)).status).toBe(404)
    expect([401, 403]).toContain((await entregasTurno(cashier.cookie, turno.id)).status)
    const saved = await db.turnoCaja.findUniqueOrThrow({ where: { id: turno.id } })
    expect(saved.efectivoContadoDecimal?.toFixed(2)).toBe("0.19")
    expect(saved.efectivoEsperadoDecimal?.toFixed(2)).toBe("0.20")
    expect(await db.revisionTurnoCaja.count({ where: { turnoCajaId: turno.id } })).toBe(1)
    expect(await db.movimientoFinanciero.count({ where: { negocioId: negocio.id } })).toBe(beforeMovements)
    expect((await turnosCerrados(owner)).body.turnos.find((item: { id: string }) => item.id === turno.id).estadoEntrega).toBe("ENTREGA_CONFIRMADA")
    const cashierJson = JSON.stringify((await turnoCajero(cashier.cookie, negocio.slug)).body)
    expect(cashierJson).not.toMatch(/efectivoEsperado|diferencia|efectivoEntregado|fondoRemanente|Caja fuerte de prueba/i)
  })

  ephemeralTest("custody history blocks deleting its shift and business", async () => {
    const { negocio, owner } = await crearNegocio()
    const cashier = await crearCajero(negocio.id)
    await listarCajas(owner)
    const turno = (await abrirCajero(cashier.cookie, negocio.slug, { fondoInicial: "0.00" })).body.turno
    expect((await cerrarCajero(cashier.cookie, negocio.slug, turno.id, "0.00")).status).toBe(200)
    const delivery = await entregarTurno(owner, turno.id, {
      tipo: "ENTREGA_CONFIRMADA",
      efectivoEntregado: "0.00",
      fondoRemanente: "0.00",
      destinoTipo: "DUENO",
      confirmar: true,
    })
    expect(delivery.status).toBe(201)
    expect(await fails(db.turnoCaja.delete({ where: { id: turno.id } }))).toBe(true)
    expect(await fails(db.negocio.delete({ where: { id: negocio.id } }))).toBe(true)
    expect(await db.entregaCustodiaTurnoCaja.count({ where: { turnoCajaId: turno.id } })).toBe(1)
    expect(await db.turnoCaja.count({ where: { id: turno.id } })).toBe(1)
    expect(await db.negocio.count({ where: { id: negocio.id } })).toBe(1)
  })

  ephemeralTest("supports all-cash-retained, full handover, and zero-cash handovers with exact decimals", async () => {
    const { negocio, owner } = await crearNegocio()
    const cashier = await crearCajero(negocio.id)
    const caja = (await listarCajas(owner)).body.cajas[0]
    const closeDeclared = async (count: string) => {
      const opened = await abrirCajero(cashier.cookie, negocio.slug, { cajaFisicaId: caja.id, fondoInicial: "0" })
      expect(opened.status).toBe(201)
      expect((await cerrarCajero(cashier.cookie, negocio.slug, opened.body.turno.id, count)).status).toBe(200)
      return opened.body.turno.id as string
    }
    const retained = await closeDeclared("12.34")
    const zeroDelivery = await entregarTurno(owner, retained, { tipo: "ENTREGA_CONFIRMADA", efectivoEntregado: "0.00", fondoRemanente: "12.34", destinoTipo: "DUENO", confirmar: true })
    expect(zeroDelivery.status).toBe(201)
    expect(zeroDelivery.body.entrega).toMatchObject({ efectivoEntregado: 0, fondoRemanente: 12.34 })
    const allHanded = await closeDeclared("8.90")
    const fullDelivery = await entregarTurno(owner, allHanded, { tipo: "ENTREGA_CONFIRMADA", efectivoEntregado: "8.90", fondoRemanente: "0.00", destinoTipo: "DUENO", confirmar: true })
    expect(fullDelivery.status).toBe(201)
    expect(fullDelivery.body.entrega).toMatchObject({ efectivoEntregado: 8.9, fondoRemanente: 0 })
    const handed = await closeDeclared("0.00")
    const emptyDelivery = await entregarTurno(owner, handed, { tipo: "ENTREGA_CONFIRMADA", efectivoEntregado: "0.00", fondoRemanente: "0.00", destinoTipo: "DUENO", confirmar: true })
    expect(emptyDelivery.status).toBe(201)
    expect(emptyDelivery.body.entrega).toMatchObject({ efectivoEntregado: 0, fondoRemanente: 0 })
    const raced = await closeDeclared("1.00")
    const contenders = await Promise.all([
      entregarTurno(owner, raced, { tipo: "ENTREGA_CONFIRMADA", efectivoEntregado: "0.40", fondoRemanente: "0.60", destinoTipo: "DUENO", confirmar: true }, randomUUID()),
      entregarTurno(owner, raced, { tipo: "ENTREGA_CONFIRMADA", efectivoEntregado: "0.30", fondoRemanente: "0.70", destinoTipo: "DUENO", confirmar: true }, randomUUID()),
    ])
    expect(contenders.filter((item) => item.status === 201)).toHaveLength(1)
    expect(contenders.filter((item) => item.status === 409)).toHaveLength(1)
  })
})

describe("F10-B2.2-F — carry over physical cash remainder", () => {
  const ephemeralTest = isEphemeralIntegrationDb ? test : test.skip

  async function closedShiftWithCustody(owner: string, negocio: { id: string; slug: string }, cashier: { cookie: string }, cajaFisicaId: string, amount: string, remainder: string) {
    const opened = await abrirCajero(cashier.cookie, negocio.slug, { cajaFisicaId, fondoInicial: "0.00" })
    expect(opened.status).toBe(201)
    const shiftId = opened.body.turno.id as string
    expect((await cerrarCajero(cashier.cookie, negocio.slug, shiftId, amount)).status).toBe(200)
    const delivery = await entregarTurno(owner, shiftId, {
      tipo: "ENTREGA_CONFIRMADA",
      efectivoEntregado: D(amount).minus(remainder).toFixed(2),
      fondoRemanente: remainder,
      destinoTipo: "DUENO",
      confirmar: true,
    })
    expect(delivery.status).toBe(201)
    return shiftId
  }

  ephemeralTest("transfers the exact latest confirmed remainder, replays once, and creates no financial movement", async () => {
    const { negocio, owner } = await crearNegocio()
    const previous = await crearCajero(negocio.id)
    const receiver = await crearCajero(negocio.id)
    const caja = (await listarCajas(owner)).body.cajas[0]
    const sourceShiftId = await closedShiftWithCustody(owner, negocio, previous, caja.id, "5000.00", "5000.00")
    const available = await turnoCajero(receiver.cookie, negocio.slug)
    expect(available.body.cajas.find((item: { id: string }) => item.id === caja.id).fondoTransferible).toMatchObject({ turnoOrigenId: sourceShiftId, importe: "5000.00" })
    const beforeMovements = await db.movimientoFinanciero.count({ where: { negocioId: negocio.id } })
    const key = randomUUID()
    const request = { cajaFisicaId: caja.id, fondoInicial: "5000.00", transferirDesdeTurnoCajaId: sourceShiftId, confirmoRecepcionFondo: true }
    const first = await abrirCajero(receiver.cookie, negocio.slug, request, key)
    expect(first.status).toBe(201)
    expect(first.body.turno.fondoInicial).toBe(5000)
    const replay = await abrirCajero(receiver.cookie, negocio.slug, request, key)
    expect(replay.status).toBe(200)
    expect(replay.replayed).toBe(true)
    const mismatchedReplay = await abrirCajero(receiver.cookie, negocio.slug, { ...request, fondoInicial: "4999.99" }, key)
    expect(mismatchedReplay.status).toBe(409)
    expect(mismatchedReplay.body.code).toBe("IDEMPOTENCY_KEY_REUSED")
    expect(await db.traspasoFondoTurnoCaja.count({ where: { turnoOrigenId: sourceShiftId } })).toBe(1)
    const savedTransfer = await db.traspasoFondoTurnoCaja.findFirstOrThrow({ where: { turnoOrigenId: sourceShiftId, negocioId: negocio.id, cajaFisicaId: caja.id } })
    expect(savedTransfer.montoDecimal.toFixed(2)).toBe("5000.00")
    expect(await fails(db.traspasoFondoTurnoCaja.update({ where: { id: savedTransfer.id }, data: { montoDecimal: D("1.00") } }))).toBe(true)
    expect(await fails(db.traspasoFondoTurnoCaja.delete({ where: { id: savedTransfer.id } }))).toBe(true)
    expect(await db.movimientoFinanciero.count({ where: { negocioId: negocio.id } })).toBe(beforeMovements)
    const employeeView = JSON.stringify((await turnoCajero(receiver.cookie, negocio.slug)).body)
    expect(employeeView).toContain("5000.00")
    expect(employeeView).not.toMatch(/efectivoEsperado|diferencia|efectivoEntregado|fondoRemanente|responsableNombre/i)
    const ownerHistory = await listarCajas(owner)
    expect(ownerHistory.body.traspasos).toHaveLength(1)
    expect(ownerHistory.body.traspasos[0]).toMatchObject({ importe: "5000.00", turnoOrigen: { id: sourceShiftId }, turnoDestino: { id: first.body.turno.id } })
  })

  ephemeralTest("does not offer zero or unconfirmed remainders; rejects cross-business and cross-register sources", async () => {
    const { negocio, owner } = await crearNegocio()
    const cashier = await crearCajero(negocio.id)
    const receiver = await crearCajero(negocio.id)
    const other = await crearNegocio()
    const caja = (await listarCajas(owner)).body.cajas[0]
    const sourceShiftId = await closedShiftWithCustody(owner, negocio, cashier, caja.id, "10.00", "0.00")
    expect((await turnoCajero(receiver.cookie, negocio.slug)).body.cajas.find((item: { id: string }) => item.id === caja.id).fondoTransferible).toBeNull()
    const noDelivery = await abrirCajero(cashier.cookie, negocio.slug, { cajaFisicaId: caja.id, fondoInicial: "0.00" })
    expect(noDelivery.status).toBe(201)
    expect((await cerrarCajero(cashier.cookie, negocio.slug, noDelivery.body.turno.id, "0.00")).status).toBe(200)
    expect((await turnoCajero(receiver.cookie, negocio.slug)).body.cajas.find((item: { id: string }) => item.id === caja.id).fondoTransferible).toBeNull()
    const foreignCashier = await crearCajero(other.negocio.id)
    const foreignAttempt = await abrirCajero(foreignCashier.cookie, other.negocio.slug, { cajaFisicaId: (await listarCajas(other.owner)).body.cajas[0].id, fondoInicial: "10.00", transferirDesdeTurnoCajaId: sourceShiftId, confirmoRecepcionFondo: true })
    expect(foreignAttempt.status).toBe(409)

    const { negocio: registerBusiness, owner: registerOwner } = await crearNegocio()
    const originCashier = await crearCajero(registerBusiness.id)
    const targetCashier = await crearCajero(registerBusiness.id)
    const defaultRegister = (await listarCajas(registerOwner)).body.cajas[0]
    const secondRegister = await crearCaja(registerOwner, "Caja secundaria")
    expect(secondRegister.status).toBe(201)
    const origin = await closedShiftWithCustody(registerOwner, registerBusiness, originCashier, defaultRegister.id, "20.00", "20.00")
    const differentRegisterAttempt = await abrirCajero(targetCashier.cookie, registerBusiness.slug, { cajaFisicaId: secondRegister.body.id, fondoInicial: "20.00", transferirDesdeTurnoCajaId: origin, confirmoRecepcionFondo: true })
    expect(differentRegisterAttempt.status).toBe(409)
  })

  ephemeralTest("only one concurrent receiver consumes a remainder; later rectification is rejected", async () => {
    const { negocio, owner } = await crearNegocio()
    const previous = await crearCajero(negocio.id)
    const firstReceiver = await crearCajero(negocio.id)
    const secondReceiver = await crearCajero(negocio.id)
    const caja = (await listarCajas(owner)).body.cajas[0]
    const sourceShiftId = await closedShiftWithCustody(owner, negocio, previous, caja.id, "7.00", "5.00")
    const body = { cajaFisicaId: caja.id, fondoInicial: "5.00", transferirDesdeTurnoCajaId: sourceShiftId, confirmoRecepcionFondo: true }
    const contenders = await Promise.all([
      abrirCajero(firstReceiver.cookie, negocio.slug, body, randomUUID()),
      abrirCajero(secondReceiver.cookie, negocio.slug, body, randomUUID()),
    ])
    expect(contenders.filter((result) => result.status === 201)).toHaveLength(1)
    expect(contenders.filter((result) => result.status === 409)).toHaveLength(1)
    expect(await db.traspasoFondoTurnoCaja.count({ where: { turnoOrigenId: sourceShiftId } })).toBe(1)
    const correction = await entregarTurno(owner, sourceShiftId, { tipo: "RECTIFICACION", efectivoEntregado: "2.00", fondoRemanente: "5.00", destinoTipo: "DUENO", observacion: "Intento posterior al traspaso", confirmar: true })
    expect(correction.status).toBe(409)
    expect(correction.body.code).toBe("FONDO_REMANENTE_YA_TRANSFERIDO")
    expect(await db.entregaCustodiaTurnoCaja.count({ where: { turnoCajaId: sourceShiftId } })).toBe(1)
  })

  ephemeralTest("a manual opening does not create a transfer and makes the old remainder ineligible", async () => {
    const { negocio, owner } = await crearNegocio()
    const previous = await crearCajero(negocio.id)
    const next = await crearCajero(negocio.id)
    const caja = (await listarCajas(owner)).body.cajas[0]
    const sourceShiftId = await closedShiftWithCustody(owner, negocio, previous, caja.id, "5.00", "5.00")
    expect((await abrirCajero(next.cookie, negocio.slug, { cajaFisicaId: caja.id, fondoInicial: "5.00" })).status).toBe(201)
    expect(await db.traspasoFondoTurnoCaja.count({ where: { turnoOrigenId: sourceShiftId } })).toBe(0)
    expect((await turnoCajero(previous.cookie, negocio.slug)).body.cajas.find((item: { id: string }) => item.id === caja.id).fondoTransferible).toBeNull()
  })
})

