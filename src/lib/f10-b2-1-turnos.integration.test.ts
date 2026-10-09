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
import { GET as getTurnoDetalle } from "@/app/api/negocio/caja/turnos/[id]/route"
import { POST as postVentaOwner } from "@/app/api/negocio/caja/ventas/route"
import { GET as getTurnoCajero, POST as postTurnoCajero } from "@/app/api/operativo/caja/[slug]/turno/route"
import { POST as postVentaCajero } from "@/app/api/operativo/caja/[slug]/ventas/route"
import { registrarVentaCaja } from "@/lib/caja-venta-service"

setDefaultTimeout(240_000)

const testDatabaseUrl = process.env.DELIGO_TEST_DATABASE_URL
if (!testDatabaseUrl || process.env.DATABASE_URL !== testDatabaseUrl) {
  throw new Error("Este test de integración requiere DELIGO_TEST_DATABASE_URL y DATABASE_URL apuntando a la misma base TESTING.")
}

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
const turnoCajero = async (cookie: string, slug: string) => json(await getTurnoCajero(ownerReq(`/api/operativo/caja/${slug}/turno`, cookie), slugCtx(slug)))
const abrirCajero = async (cookie: string, slug: string, body: unknown, key: string | undefined = randomUUID()) =>
  json(await postTurnoCajero(ownerReq(`/api/operativo/caja/${slug}/turno`, cookie, "POST", body, key), slugCtx(slug)))
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
  for (const t of ownerTokens) await deleteSession(t)
  await db.sesion.deleteMany({ where: { userId: { in: cuentas } } })
  const empleados = await db.empleado.findMany({ where: { negocioId: { in: negocios } }, select: { id: true } })
  await db.auditLog.deleteMany({ where: { userId: { in: [...negocios, ...empleados.map((e) => e.id)] } } })
  await db.reservaStock.deleteMany({ where: { negocioId: { in: negocios } } })
  await db.pedidoItem.deleteMany({ where: { pedido: { negocioId: { in: negocios } } } })
  await db.pedido.deleteMany({ where: { negocioId: { in: negocios } } })
  await db.movimientoInventario.deleteMany({ where: { negocioId: { in: negocios } } })
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
  test("cashier opens the default register with an exact fund; replay returns it; reused key → 409; no ledger, no stock change", async () => {
    const { negocio, owner } = await crearNegocio()
    const producto = await crearProducto(negocio.id, 100, { controlStock: true, stockCantidad: 5 })
    const { empleado, cookie } = await crearCajero(negocio.id)
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
    expect(d.body.efectivo).toEqual({ fondoInicial: 20000, ingresosEfectivo: 13000, salidasEfectivo: 0, esperado: 33000 })
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
    expect(Object.keys(own.body).sort()).toEqual(["cajas", "modoTurnos", "ok", "turno"])
    expect(Object.keys(own.body.turno).sort()).toEqual(["abiertoEn", "caja", "fondoInicial", "id"])
    const text = JSON.stringify(own.body)
    for (const leak of ["esperado", "ingresos", "salidas", "diferencia", "saldo", "totalEfectivo", "2011"]) expect(text).not.toContain(leak)
    const other = await turnoCajero(c2.cookie, negocio.slug)
    expect(other.body.turno).toBeNull()
    expect(other.body.cajas[0]).toEqual({ id: t1.caja.id, nombre: "Caja principal", esPredeterminada: true, ocupada: true })
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
