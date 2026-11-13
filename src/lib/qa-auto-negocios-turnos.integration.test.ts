/// <reference types="bun-types" />
// ============================================
// QA automatizada — NEGOCIOS COMUNES: turnos OBLIGATORIO, cierre ciego,
// fondo remanente / traspasos y ventas concurrentes (T01–T20 + C1)
// ============================================
// Runs ONLY against the isolated local database `deligo_qa_auto` (PostgreSQL 18
// local). It refuses to start otherwise and checks current_database() before the
// first write. Every operation goes through the REAL DeliGO route handlers
// (owner / cashier sessions, Idempotency-Keys); SQL / Prisma reads are used only
// to prepare fixtures (business, products, cashier accounts) and to VERIFY the
// results. Each scenario records evidence (HTTP status / code and the exact
// before/after state of the business) into QA_EVIDENCE_FILE.

import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { writeFileSync } from "node:fs"
import { NextRequest } from "next/server"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { createOperationalSession, createSession, OPERATIONAL_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/auth"
import { GET as getCajas, POST as postCaja } from "@/app/api/negocio/caja/cajas/route"
import { POST as postTurnoOwner } from "@/app/api/negocio/caja/turnos/route"
import { GET as getTurnoDetalle, POST as postCierreTurnoOwner } from "@/app/api/negocio/caja/turnos/[id]/route"
import { GET as getTurnosCerrados } from "@/app/api/negocio/caja/turnos/cerrados/route"
import { POST as postEntregaTurno } from "@/app/api/negocio/caja/turnos/[id]/entregas/route"
import { POST as postVentaOwner } from "@/app/api/negocio/caja/ventas/route"
import { GET as getTurnoCajero, POST as postTurnoCajero } from "@/app/api/operativo/caja/[slug]/turno/route"
import { POST as postVentaCajero } from "@/app/api/operativo/caja/[slug]/ventas/route"
import { POST as postDevolucionCajero } from "@/app/api/operativo/caja/[slug]/ventas/[id]/devoluciones/route"
import { POST as postCambioCajero } from "@/app/api/operativo/caja/[slug]/ventas/[id]/cambios/route"
import { POST as postReintegroCajero } from "@/app/api/operativo/caja/[slug]/devoluciones/[id]/reintegro/route"

setDefaultTimeout(600_000)

// ---------------------------------------------------------------------------
// Isolation guards (before any import side effect can write)
// ---------------------------------------------------------------------------
// Two modes, decided ONLY by QA_AUTO:
//  - QA_AUTO unset or empty (general `bun test` runs, CI batteries that do not
//    configure QA): the whole suite is SKIPPED — no connection, no write.
//  - QA_AUTO=1 (certification): every guard below must hold or the file FAILS
//    explicitly; the connection itself is verified (current_database() + port)
//    before the first write, and every fixture writer refuses to run until then.
//  Any other QA_AUTO value is an error (never silently skipped nor run).
const QA_DB = "deligo_qa_auto"
const QA_PORT = 55420
const qaAuto = process.env.QA_AUTO ?? ""
const QA_ACTIVA = qaAuto === "1"
if (qaAuto !== "" && !QA_ACTIVA) {
  throw new Error(`QA_AUTO=${JSON.stringify(qaAuto)} no es válido: usá QA_AUTO=1 para certificar o dejala sin definir para omitir la suite.`)
}
if (QA_ACTIVA) {
  const url = process.env.DATABASE_URL ?? ""
  if (!url.includes(`/${QA_DB}?`) || process.env.DELIGO_TEST_DATABASE_URL !== url || !new RegExp(`@127\\.0\\.0\\.1:${QA_PORT}/`).test(url)) {
    throw new Error(`La QA automatizada sólo corre contra ${QA_DB} en PostgreSQL 18 local (127.0.0.1:${QA_PORT}).`)
  }
  if ((process.env.DELIGO_ENVIRONMENT ?? "").toUpperCase() !== "TESTING") {
    throw new Error("La QA automatizada requiere DELIGO_ENVIRONMENT=TESTING y QA_AUTO=1.")
  }
  process.env.DELIGO_F10_B2_2_B_SHIFT_UI_ENABLED = "true"
}
/** Every scenario block: skipped unless QA_AUTO=1. */
const describeQa = describe.skipIf(!QA_ACTIVA)
let conexionQaVerificada = false
/** Fixture writers call this first: nothing is written before the connection was verified. */
function exigirConexionQa() {
  if (!QA_ACTIVA || !conexionQaVerificada) throw new Error(`Escritura bloqueada: la conexión a ${QA_DB}:${QA_PORT} no fue verificada.`)
}
const EVIDENCE_FILE = process.env.QA_EVIDENCE_FILE
const ROUNDS = Number(process.env.QA_ROUNDS ?? "20")

type Evidencia = { id: string; titulo: string; esperado: string; obtenido: unknown; http?: unknown; antes?: unknown; despues?: unknown; notas?: string[] }
const evidencias: Evidencia[] = []
const ev = (e: Evidencia) => { evidencias.push(e) }

beforeAll(async () => {
  if (!QA_ACTIVA) return
  // Unreachable database → this query throws and the certification FAILS.
  const [row] = await db.$queryRaw<Array<{ db: string; port: number }>>`SELECT current_database() AS db, inet_server_port() AS port`
  if (row.db !== QA_DB || Number(row.port) !== QA_PORT) throw new Error(`Conexión inesperada: ${row.db}:${row.port}. No se escribe nada.`)
  conexionQaVerificada = true
  ev({ id: "PRE", titulo: "Conexión verificada antes de escribir", esperado: `${QA_DB}:${QA_PORT}`, obtenido: `${row.db}:${row.port}` })
})

afterAll(async () => {
  if (!QA_ACTIVA) return
  if (EVIDENCE_FILE) writeFileSync(EVIDENCE_FILE, JSON.stringify(evidencias, null, 2))
  await db.$disconnect()
})

// ---------------------------------------------------------------------------
// Fixtures (SQL/Prisma: only accounts, businesses and products — never sales)
// ---------------------------------------------------------------------------
const D = (v: string | number) => new Prisma.Decimal(v)

async function crearNegocio(nombre: string, cajaTurnosModo: "OPCIONAL" | "OBLIGATORIO") {
  exigirConexionQa()
  const suffix = randomUUID().slice(0, 8)
  const negocio = await db.negocio.create({
    data: { slug: `qa-${nombre.toLowerCase().replace(/\W+/g, "-")}-${suffix}`, nombre: `${nombre} ${suffix}`, usuario: `qa-${suffix}`, email: `qa-${suffix}@example.test`, password: "fixture", rubro: "negocio", aprobado: true, suspendido: false, empleadosActivos: true, salonActivo: true, cajaTurnosModo },
  })
  return { negocio, owner: `${SESSION_COOKIE_NAME}=${await createSession(negocio.id, "negocio")}` }
}
async function crearCajero(negocioId: string, nombre: string, habilitadoTurnos = true) {
  exigirConexionQa()
  const cuenta = await db.cuentaOperativa.create({ data: { nombre, email: `qa-${randomUUID()}@example.test`, activo: true, eliminado: false } })
  const empleado = await db.empleado.create({ data: { nombre, codigo: randomUUID().slice(0, 8).toUpperCase(), negocioId, cuentaOperativaId: cuenta.id, areaOperativa: "caja", activo: true, eliminado: false } })
  if (habilitadoTurnos) {
    const allowlist = new Set((process.env.DELIGO_F10_B2_2_B_CONTROLLED_EMPLOYEE_IDS ?? "").split(/[\s,;]+/).filter(Boolean))
    allowlist.add(empleado.id)
    process.env.DELIGO_F10_B2_2_B_CONTROLLED_EMPLOYEE_IDS = [...allowlist].join(",")
  }
  return { empleado, cookie: `${OPERATIONAL_SESSION_COOKIE_NAME}=${await createOperationalSession(cuenta.id)}` }
}
const crearProducto = (negocioId: string, nombre: string, precio: number, stock?: number) => {
  exigirConexionQa()
  return db.producto.create({ data: { nombre, precio, negocioId, controlStock: stock !== undefined, stockCantidad: stock ?? 0 } })
}

// ---------------------------------------------------------------------------
// Real routes
// ---------------------------------------------------------------------------
type Res = { status: number; replayed: boolean; body: Record<string, any> }
const json = async (res: Response): Promise<Res> => ({ status: res.status, replayed: res.headers.get("Idempotency-Replayed") === "true", body: await res.json().catch(() => ({})) })
const rq = (path: string, cookie: string, method = "GET", body?: unknown, key?: string) =>
  new NextRequest(`http://localhost${path}`, { method, headers: { cookie, "content-type": "application/json", ...(key ? { "idempotency-key": key } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
const slugCtx = (slug: string) => ({ params: Promise.resolve({ slug }) })
const idCtx = (id: string) => ({ params: Promise.resolve({ id }) })
const sidCtx = (slug: string, id: string) => ({ params: Promise.resolve({ slug, id }) })

const api = {
  cajas: async (owner: string) => json(await getCajas(rq("/api/negocio/caja/cajas", owner))),
  crearCaja: async (owner: string, nombre: string) => json(await postCaja(rq("/api/negocio/caja/cajas", owner, "POST", { nombre }))),
  turnoCajero: async (c: string, slug: string) => json(await getTurnoCajero(rq(`/api/operativo/caja/${slug}/turno`, c), slugCtx(slug))),
  abrir: async (c: string, slug: string, body: unknown, key = randomUUID()) => json(await postTurnoCajero(rq(`/api/operativo/caja/${slug}/turno`, c, "POST", body, key), slugCtx(slug))),
  cerrar: async (c: string, slug: string, turnoCajaId: string, efectivoContado: string, key = randomUUID()) =>
    json(await postTurnoCajero(rq(`/api/operativo/caja/${slug}/turno`, c, "POST", { action: "close", turnoCajaId, efectivoContado }, key), slugCtx(slug))),
  abrirOwner: async (owner: string, body: unknown, key = randomUUID()) => json(await postTurnoOwner(rq("/api/negocio/caja/turnos", owner, "POST", body, key))),
  cerrarOwner: async (owner: string, id: string, efectivoContado: string, key = randomUUID()) => json(await postCierreTurnoOwner(rq(`/api/negocio/caja/turnos/${id}`, owner, "POST", { efectivoContado }, key), idCtx(id))),
  detalleTurno: async (owner: string, id: string) => json(await getTurnoDetalle(rq(`/api/negocio/caja/turnos/${id}`, owner), idCtx(id))),
  cerrados: async (owner: string) => json(await getTurnosCerrados(rq("/api/negocio/caja/turnos/cerrados", owner))),
  entrega: async (owner: string, id: string, body: unknown, key = randomUUID()) => json(await postEntregaTurno(rq(`/api/negocio/caja/turnos/${id}/entregas`, owner, "POST", body, key), idCtx(id))),
  vender: async (c: string, slug: string, body: unknown, key = randomUUID()) => json(await postVentaCajero(rq(`/api/operativo/caja/${slug}/ventas`, c, "POST", body, key), slugCtx(slug))),
  venderOwner: async (owner: string, body: unknown, key = randomUUID()) => json(await postVentaOwner(rq("/api/negocio/caja/ventas", owner, "POST", body, key))),
  devolver: async (c: string, slug: string, ventaId: string, body: unknown, key = randomUUID()) => json(await postDevolucionCajero(rq(`/api/operativo/caja/${slug}/ventas/${ventaId}/devoluciones`, c, "POST", body, key), sidCtx(slug, ventaId))),
  cambiar: async (c: string, slug: string, ventaId: string, body: unknown, key = randomUUID()) => json(await postCambioCajero(rq(`/api/operativo/caja/${slug}/ventas/${ventaId}/cambios`, c, "POST", body, key), sidCtx(slug, ventaId))),
  pagarReintegro: async (c: string, slug: string, devolucionId: string, medio: string, key = randomUUID()) =>
    json(await postReintegroCajero(rq(`/api/operativo/caja/${slug}/devoluciones/${devolucionId}/reintegro`, c, "POST", { medio, confirmo: true }, key), sidCtx(slug, devolucionId))),
}
const http = (r: Res) => ({ status: r.status, code: r.body?.code ?? null, error: r.status >= 400 ? r.body?.error ?? null : null, replayed: r.replayed })

// ---------------------------------------------------------------------------
// Exact state of one business (verification only)
// ---------------------------------------------------------------------------
/**
 * Awaits the queries one by one. Prisma queries are lazy, so the verification
 * snapshot no longer opens a burst of new connections at once: on this Windows
 * machine such a burst intermittently fails with P1001 (reproduced without any
 * DeliGO code, see scripts/qa/p1001-experimento.ts). Test helper only.
 */
async function enOrden<T extends readonly unknown[]>(consultas: T): Promise<{ -readonly [K in keyof T]: Awaited<T[K]> }> {
  const resultados: unknown[] = []
  for (const consulta of consultas) resultados.push(await consulta)
  return resultados as { -readonly [K in keyof T]: Awaited<T[K]> }
}

async function foto(negocioId: string) {
  const [ventas, cobros, operaciones, movimientos, movInv, devoluciones, cambios, turnos, revisiones, entregas, traspasos, cuentas, productos] = await enOrden([
    db.venta.findMany({ where: { negocioId }, select: { id: true, metodoPago: true, totalDecimal: true, turnoCajaId: true } }),
    db.cobroVenta.findMany({ where: { negocioId }, select: { metodo: true, importeDecimal: true } }),
    db.operacionFinanciera.findMany({ where: { negocioId }, select: { tipo: true, turnoCajaId: true } }),
    db.movimientoFinanciero.count({ where: { negocioId } }),
    db.movimientoInventario.count({ where: { negocioId } }),
    db.devolucionVenta.findMany({ where: { negocioId }, select: { reintegroEstado: true, reintegroMedio: true, importeDecimal: true, importeCompensadoDecimal: true } }),
    db.cambioVenta.count({ where: { negocioId } }),
    db.turnoCaja.findMany({ where: { negocioId }, select: { id: true, estado: true, cajaFisicaId: true, fondoInicialDecimal: true, efectivoContadoDecimal: true, efectivoEsperadoDecimal: true, cerradoEn: true }, orderBy: { abiertoEn: "asc" } }),
    db.revisionTurnoCaja.count({ where: { negocioId } }),
    db.entregaCustodiaTurnoCaja.count({ where: { negocioId } }),
    db.traspasoFondoTurnoCaja.count({ where: { negocioId } }),
    db.cuentaFinanciera.findMany({ where: { negocioId }, select: { id: true, clave: true } }),
    db.producto.findMany({ where: { negocioId }, select: { nombre: true, stockCantidad: true }, orderBy: { nombre: "asc" } }),
  ] as const)
  const saldos: Record<string, string> = {}
  for (const c of cuentas) {
    const legs = await db.movimientoFinanciero.findMany({ where: { cuentaId: c.id }, select: { importeDecimal: true } })
    saldos[c.clave] = legs.reduce((acc, l) => acc.plus(l.importeDecimal!), D(0)).toFixed(2)
  }
  const empleados = await db.empleado.findMany({ where: { negocioId }, select: { id: true } })
  const auditoria = await db.auditLog.count({ where: { userId: { in: [negocioId, ...empleados.map((e) => e.id)] } } })
  return {
    ventas: ventas.length,
    totalVendido: ventas.reduce((a, v) => a.plus(v.totalDecimal ?? D(0)), D(0)).toFixed(2),
    cobros: cobros.length,
    cobrosPorMedio: Object.fromEntries(Object.entries(cobros.reduce<Record<string, Prisma.Decimal>>((a, c) => ({ ...a, [c.metodo]: (a[c.metodo] ?? D(0)).plus(c.importeDecimal ?? D(0)) }), {})).map(([k, v]) => [k, v.toFixed(2)])),
    operaciones: operaciones.length,
    operacionesPorTipo: operaciones.reduce<Record<string, number>>((a, o) => ({ ...a, [o.tipo]: (a[o.tipo] ?? 0) + 1 }), {}),
    movimientos,
    movimientosInventario: movInv,
    devoluciones: devoluciones.length,
    reintegrosPagados: devoluciones.filter((d) => d.reintegroEstado === "REALIZADO").length,
    reintegrosPendientes: devoluciones.filter((d) => d.reintegroEstado === "PENDIENTE").length,
    creditoInterno: devoluciones.reduce((a, d) => a.plus(d.importeCompensadoDecimal), D(0)).toFixed(2),
    cambios,
    turnos: turnos.map((t) => ({ id: t.id, estado: t.estado, caja: t.cajaFisicaId, fondo: t.fondoInicialDecimal.toFixed(2), contado: t.efectivoContadoDecimal?.toFixed(2) ?? null, esperado: t.efectivoEsperadoDecimal?.toFixed(2) ?? null, cerradoEn: t.cerradoEn?.toISOString() ?? null })),
    revisiones,
    entregas,
    traspasos,
    saldos,
    stock: Object.fromEntries(productos.map((p) => [p.nombre, p.stockCantidad])),
    auditoria,
  }
}
/** Cash expected for a shift with the same formula the close uses: fund + this register's cash legs attributed to the shift. */
async function esperadoTurno(turnoId: string) {
  const t = await db.turnoCaja.findUniqueOrThrow({ where: { id: turnoId } })
  const cuenta = await db.cuentaFinanciera.findFirst({ where: { negocioId: t.negocioId, cajaFisicaId: t.cajaFisicaId, tipo: "EFECTIVO" } })
  if (!cuenta) return t.fondoInicialDecimal.toFixed(2)
  const legs = await db.movimientoFinanciero.findMany({ where: { cuentaId: cuenta.id, operacion: { turnoCajaId: t.id } }, select: { importeDecimal: true } })
  return legs.reduce((a, l) => a.plus(l.importeDecimal!), t.fondoInicialDecimal).toFixed(2)
}
const sinCambios = async (negocioId: string, antes: Awaited<ReturnType<typeof foto>>) => expect(await foto(negocioId)).toEqual(antes)

// ===========================================================================
// T01–T14 — OBLIGATORIO mode: «Kiosco QA» (2 registers, cashiers Ana / Beto)
// ===========================================================================
describeQa("QA — modo OBLIGATORIO (T01–T14)", () => {
  let k: Awaited<ReturnType<typeof crearNegocio>>
  let ana: Awaited<ReturnType<typeof crearCajero>>
  let beto: Awaited<ReturnType<typeof crearCajero>>
  let cajaA: string, cajaB: string
  let pA: { id: string }, pB: { id: string }, pC: { id: string }
  let turnoAna: string
  const ventasAna: Array<{ id: string; itemId: string }> = []
  let pendienteT07: string
  const slug = () => k.negocio.slug
  const item = (productoId: string, cantidad = 1) => ({ productoId, cantidad })
  const vendeAna = async (metodoPago: string, productoId: string) => {
    const r = await api.vender(ana.cookie, slug(), { metodoPago, items: [item(productoId)] })
    expect(r.status).toBe(201)
    const v = { id: r.body.id as string, itemId: r.body.items[0].id as string }
    ventasAna.push(v)
    return v
  }

  beforeAll(async () => {
    k = await crearNegocio("Kiosco QA", "OBLIGATORIO")
    ana = await crearCajero(k.negocio.id, "Ana QA")
    beto = await crearCajero(k.negocio.id, "Beto QA")
    cajaA = (await api.cajas(k.owner)).body.cajas[0].id
    cajaB = (await api.crearCaja(k.owner, "Caja 2")).body.id
    pA = await crearProducto(k.negocio.id, "Alfajor", 1000, 50)
    pB = await crearProducto(k.negocio.id, "Bombon", 1000, 50)
    pC = await crearProducto(k.negocio.id, "Chocolate", 1500, 50)
    // Precondition (real routes): Ana opens Caja principal and sells, so Beto has sales to act on.
    const abierto = await api.abrir(ana.cookie, slug(), { cajaFisicaId: cajaA, fondoInicial: "2000.00" })
    expect(abierto.status).toBe(201)
    turnoAna = abierto.body.turno.id
    for (const p of [pA, pA, pA, pA, pA]) await vendeAna("EFECTIVO", p.id)
    ev({ id: "PRE-K", titulo: "Precondiciones Kiosco QA (OBLIGATORIO)", esperado: "negocio, 2 cajas, 2 cajeros, 3 productos, turno de Ana con 5 ventas en efectivo", obtenido: await foto(k.negocio.id) })
  })

  test("T01 — cajero sin turno vende en EFECTIVO → rechazado TURNO_REQUERIDO, sin escrituras", async () => {
    const antes = await foto(k.negocio.id)
    const r = await api.vender(beto.cookie, slug(), { metodoPago: "EFECTIVO", items: [item(pA.id)] })
    const despues = await foto(k.negocio.id)
    const cuentasNuevas = Object.keys(despues.saldos).filter((c) => !(c in antes.saldos))
    // Evidence first (kept even when the assertion below fails).
    ev({ id: "T01", titulo: "Venta en efectivo sin turno (OBLIGATORIO)", esperado: "409 TURNO_REQUERIDO; nada escrito (caja-venta-service: EMPLEADO sin turno en OBLIGATORIO)", obtenido: { rechazo: `${r.status} ${r.body.code}`, cuentasCreadasPorElRechazo: cuentasNuevas, ventas: [antes.ventas, despues.ventas], operaciones: [antes.operaciones, despues.operaciones], movimientos: [antes.movimientos, despues.movimientos] }, http: http(r), antes, despues })
    expect([r.status, r.body.code]).toEqual([409, "TURNO_REQUERIDO"])
    expect(despues).toEqual(antes)
  })

  test("T02 — cajero sin turno vende por TRANSFERENCIA → también rechazado (la regla no depende del medio)", async () => {
    const antes = await foto(k.negocio.id)
    const r = await api.vender(beto.cookie, slug(), { metodoPago: "TRANSFERENCIA", items: [item(pA.id)] })
    expect([r.status, r.body.code]).toEqual([409, "TURNO_REQUERIDO"])
    await sinCambios(k.negocio.id, antes)
    ev({ id: "T02", titulo: "Venta por transferencia sin turno", esperado: "409 TURNO_REQUERIDO; nada escrito", obtenido: "409 TURNO_REQUERIDO; foto idéntica", http: http(r) })
  })

  test("T03 — cambio SIN diferencia de dinero sin turno → rechazado (la venta vinculada exige turno); nada escrito, devolución revertida", async () => {
    const antes = await foto(k.negocio.id)
    const v = ventasAna[0]
    const r = await api.cambiar(beto.cookie, slug(), v.id, { motivo: "QA T03", salen: [{ ventaItemId: v.itemId, cantidad: 1, reingresaStock: true }], entran: [item(pB.id)], esperado: { salida: "1000.00", entrada: "1000.00" }, confirmo: true })
    expect(r.status).toBe(409)
    expect(r.body.code).toBe("TURNO_REQUERIDO")
    await sinCambios(k.negocio.id, antes)
    ev({ id: "T03", titulo: "Cambio sin diferencia, sin turno", esperado: "rechazado: el cambio crea una venta vinculada del cajero → TURNO_REQUERIDO; la devolución del mismo cambio se revierte", obtenido: "409 TURNO_REQUERIDO; foto idéntica", http: http(r) })
  })

  test("T04 — cambio con diferencia A COBRAR en efectivo sin turno → rechazado; nada escrito", async () => {
    const antes = await foto(k.negocio.id)
    const v = ventasAna[0]
    const r = await api.cambiar(beto.cookie, slug(), v.id, { motivo: "QA T04", salen: [{ ventaItemId: v.itemId, cantidad: 1, reingresaStock: true }], entran: [item(pC.id)], esperado: { salida: "1000.00", entrada: "1500.00" }, medioDiferencia: "EFECTIVO", confirmo: true })
    expect([r.status, r.body.code]).toEqual([409, "TURNO_REQUERIDO"])
    await sinCambios(k.negocio.id, antes)
    ev({ id: "T04", titulo: "Cambio con cobro en efectivo, sin turno", esperado: "409 TURNO_REQUERIDO; nada escrito", obtenido: "409 TURNO_REQUERIDO; foto idéntica", http: http(r) })
  })

  test("T05 — devolución con reintegro EN EFECTIVO sin turno → rechazado TURNO_REQUERIDO; nada escrito", async () => {
    const antes = await foto(k.negocio.id)
    const v = ventasAna[1]
    const r = await api.devolver(beto.cookie, slug(), v.id, { tipo: "DEVOLUCION_PARCIAL", motivo: "QA T05", items: [{ ventaItemId: v.itemId, cantidad: 1, reingresaStock: true }], reintegro: { modo: "REALIZADO", medio: "EFECTIVO" }, confirmo: true })
    expect([r.status, r.body.code]).toEqual([409, "TURNO_REQUERIDO"])
    await sinCambios(k.negocio.id, antes)
    ev({ id: "T05", titulo: "Devolución con reintegro en efectivo, sin turno", esperado: "409 TURNO_REQUERIDO (caja-devoluciones-service: efectivo exige turno en OBLIGATORIO)", obtenido: "409 TURNO_REQUERIDO; foto idéntica", http: http(r) })
  })

  test("T06 — devolución con reintegro POR TRANSFERENCIA sin turno → PERMITIDA (no mueve efectivo): devolución + stock, sin operación financiera", async () => {
    const antes = await foto(k.negocio.id)
    const v = ventasAna[1]
    const r = await api.devolver(beto.cookie, slug(), v.id, { tipo: "DEVOLUCION_PARCIAL", motivo: "QA T06", items: [{ ventaItemId: v.itemId, cantidad: 1, reingresaStock: true }], reintegro: { modo: "REALIZADO", medio: "TRANSFERENCIA" }, confirmo: true })
    expect(r.status).toBe(201)
    const despues = await foto(k.negocio.id)
    expect(despues.devoluciones).toBe(antes.devoluciones + 1)
    expect(despues.operaciones).toBe(antes.operaciones)
    expect(despues.movimientos).toBe(antes.movimientos)
    expect(despues.saldos).toEqual(antes.saldos)
    expect(despues.stock.Alfajor).toBe(antes.stock.Alfajor + 1)
    const d = await db.devolucionVenta.findUniqueOrThrow({ where: { id: r.body.devolucion.id } })
    expect([d.reintegroEstado, d.reintegroMedio, d.reintegroTurnoCajaId, d.reintegroOperacionId]).toEqual(["REALIZADO", "TRANSFERENCIA", null, null])
    ev({ id: "T06", titulo: "Devolución con reintegro por transferencia, sin turno", esperado: "permitida: la regla de turno sólo aplica al efectivo; devolución +1, stock +1, sin operación ni movimiento", obtenido: { devolucion: [d.reintegroEstado, d.reintegroMedio], deltas: { devoluciones: 1, stockAlfajor: 1, operaciones: 0 } }, http: http(r), antes, despues })
  })

  test("T07 — devolución con reintegro PENDIENTE sin turno → PERMITIDA, sin dinero", async () => {
    const antes = await foto(k.negocio.id)
    const v = ventasAna[2]
    const r = await api.devolver(beto.cookie, slug(), v.id, { tipo: "DEVOLUCION_PARCIAL", motivo: "QA T07", items: [{ ventaItemId: v.itemId, cantidad: 1, reingresaStock: true }], reintegro: { modo: "PENDIENTE" }, confirmo: true })
    expect(r.status).toBe(201)
    pendienteT07 = r.body.devolucion.id
    const despues = await foto(k.negocio.id)
    expect(despues.reintegrosPendientes).toBe(antes.reintegrosPendientes + 1)
    expect([despues.operaciones, despues.movimientos]).toEqual([antes.operaciones, antes.movimientos])
    ev({ id: "T07", titulo: "Reintegro pendiente sin turno", esperado: "permitido; pendiente +1; sin operación financiera", obtenido: { pendientes: despues.reintegrosPendientes, operaciones: despues.operaciones }, http: http(r), antes, despues })
  })

  test("T08 — pagar EN EFECTIVO un reintegro pendiente sin turno → rechazado TURNO_REQUERIDO; sigue PENDIENTE", async () => {
    const antes = await foto(k.negocio.id)
    const r = await api.pagarReintegro(beto.cookie, slug(), pendienteT07, "EFECTIVO")
    expect([r.status, r.body.code]).toEqual([409, "TURNO_REQUERIDO"])
    await sinCambios(k.negocio.id, antes)
    expect((await db.devolucionVenta.findUniqueOrThrow({ where: { id: pendienteT07 } })).reintegroEstado).toBe("PENDIENTE")
    ev({ id: "T08", titulo: "Pago en efectivo de reintegro pendiente, sin turno", esperado: "409 TURNO_REQUERIDO; sigue PENDIENTE; nada escrito", obtenido: "409 TURNO_REQUERIDO; PENDIENTE; foto idéntica", http: http(r) })
  })

  test("T09 — apertura: habilitado abre (fondo exacto, sin dinero); no habilitado 403; caja ocupada 409; misma clave repite", async () => {
    const carla = await crearCajero(k.negocio.id, "Carla QA (no habilitada)", false)
    const antes = await foto(k.negocio.id)
    const noHabilitada = await api.abrir(carla.cookie, slug(), { cajaFisicaId: cajaB, fondoInicial: "100.00" })
    expect(noHabilitada.status).toBe(403)
    const ocupada = await api.abrir(beto.cookie, slug(), { cajaFisicaId: cajaA, fondoInicial: "100.00" })
    expect(ocupada.status).toBe(409)
    await sinCambios(k.negocio.id, antes)
    const key = randomUUID()
    const ok = await api.abrir(beto.cookie, slug(), { cajaFisicaId: cajaB, fondoInicial: "1500.50" }, key)
    expect(ok.status).toBe(201)
    const replay = await api.abrir(beto.cookie, slug(), { cajaFisicaId: cajaB, fondoInicial: "1500.50" }, key)
    expect([replay.status, replay.replayed]).toEqual([200, true])
    const despues = await foto(k.negocio.id)
    const nuevo = despues.turnos.find((t) => t.id === ok.body.turno.id)!
    expect([nuevo.estado, nuevo.caja, nuevo.fondo]).toEqual(["ABIERTO", cajaB, "1500.50"])
    expect(despues.turnos).toHaveLength(antes.turnos.length + 1)
    expect([despues.operaciones, despues.movimientos]).toEqual([antes.operaciones, antes.movimientos])
    expect(JSON.stringify(ok.body)).not.toMatch(/esperado|diferencia/i)
    ev({ id: "T09", titulo: "Apertura autorizada", esperado: "no habilitada 403; caja ocupada 409; apertura 201 con fondo exacto; replay 200; sin dinero", obtenido: { noHabilitada: http(noHabilitada), ocupada: http(ocupada), apertura: http(ok), replay: http(replay), turno: nuevo }, antes, despues })
  })

  test("T10 — con turno (Beto, Caja 2): venta efectivo y transferencia, cambio sin diferencia, cambio con cobro, devolución en efectivo y pago del pendiente — todo atribuido a SU turno y SU caja", async () => {
    const turnoBeto = (await db.turnoCaja.findFirstOrThrow({ where: { negocioId: k.negocio.id, cajaFisicaId: cajaB, estado: "ABIERTO" } })).id
    const antes = await foto(k.negocio.id)
    const v1 = await api.vender(beto.cookie, slug(), { metodoPago: "EFECTIVO", items: [item(pA.id, 2)] }) // +2000
    const v2 = await api.vender(beto.cookie, slug(), { metodoPago: "TRANSFERENCIA", items: [item(pC.id)] }) // no cash
    expect([v1.status, v2.status]).toEqual([201, 201])
    const v1Item = v1.body.items[0].id
    const c1 = await api.cambiar(beto.cookie, slug(), v1.body.id, { motivo: "QA T10 igual", salen: [{ ventaItemId: v1Item, cantidad: 1, reingresaStock: true }], entran: [item(pB.id)], esperado: { salida: "1000.00", entrada: "1000.00" }, confirmo: true })
    const v3 = await api.vender(beto.cookie, slug(), { metodoPago: "EFECTIVO", items: [item(pA.id)] }) // +1000
    const c2 = await api.cambiar(beto.cookie, slug(), v3.body.id, { motivo: "QA T10 cobro", salen: [{ ventaItemId: v3.body.items[0].id, cantidad: 1, reingresaStock: true }], entran: [item(pC.id)], esperado: { salida: "1000.00", entrada: "1500.00" }, medioDiferencia: "EFECTIVO", confirmo: true }) // +500
    const d1 = await api.devolver(beto.cookie, slug(), v1.body.id, { tipo: "DEVOLUCION_PARCIAL", motivo: "QA T10 dev", items: [{ ventaItemId: v1Item, cantidad: 1, reingresaStock: true }], reintegro: { modo: "REALIZADO", medio: "EFECTIVO" }, confirmo: true }) // −1000
    const p1 = await api.pagarReintegro(beto.cookie, slug(), pendienteT07, "EFECTIVO") // −1000
    for (const r of [c1, v3, c2, d1, p1]) expect(r.status).toBe(201)
    const despues = await foto(k.negocio.id)
    const opsTurno = await db.operacionFinanciera.findMany({ where: { negocioId: k.negocio.id, createdAt: { gte: new Date(Date.now() - 600_000) }, turnoCajaId: turnoBeto }, include: { movimientos: { include: { cuenta: true } } } })
    // Every cash leg of these operations lands on Caja 2 and the shift is Beto's.
    for (const o of opsTurno) for (const m of o.movimientos) expect(m.cuenta.cajaFisicaId).toBe(cajaB)
    const neto = opsTurno.flatMap((o) => o.movimientos).reduce((a, m) => a.plus(m.importeDecimal!), D(0)).toFixed(2)
    expect(neto).toBe("1500.00") // +2000 +1000 +500 −1000 −1000
    expect(await esperadoTurno(turnoBeto)).toBe("3000.50") // fondo 1500.50 + 1500
    const pagado = await db.devolucionVenta.findUniqueOrThrow({ where: { id: pendienteT07 } })
    expect([pagado.reintegroEstado, pagado.reintegroMedio, pagado.reintegroTurnoCajaId]).toEqual(["REALIZADO", "EFECTIVO", turnoBeto])
    expect(despues.saldos[`efectivo_caja_fisica:${cajaA}`]).toBe(antes.saldos[`efectivo_caja_fisica:${cajaA}`]) // Ana's register untouched
    expect(despues.cambios).toBe(antes.cambios + 2)
    ev({ id: "T10", titulo: "Operaciones con turno abierto", esperado: "todas 201; efectivo neto del turno +1500.00 en Caja 2; esperado 3000.50; Caja principal sin cambios; pendiente pagado en el turno de Beto", obtenido: { http: [v1, v2, c1, v3, c2, d1, p1].map(http), netoTurno: neto, esperado: await esperadoTurno(turnoBeto), creditoInterno: despues.creditoInterno }, antes, despues })
  })

  test("T11 — cierre ciego: la respuesta no revela esperado; el servidor guarda el esperado exacto; conteo con faltante", async () => {
    const turnoBeto = (await db.turnoCaja.findFirstOrThrow({ where: { negocioId: k.negocio.id, cajaFisicaId: cajaB, estado: "ABIERTO" } })).id
    const vistaCajero = await api.turnoCajero(beto.cookie, slug())
    expect(JSON.stringify(vistaCajero.body)).not.toMatch(/esperado|diferencia|efectivoContado/i)
    const esperado = await esperadoTurno(turnoBeto)
    const antes = await foto(k.negocio.id)
    const key = randomUUID()
    const r = await api.cerrar(beto.cookie, slug(), turnoBeto, "2950.25", key)
    expect(r.status).toBe(200)
    expect(JSON.stringify(r.body)).not.toMatch(/esperado|diferencia|2950|3000/i)
    const t = await db.turnoCaja.findUniqueOrThrow({ where: { id: turnoBeto } })
    expect([t.estado, t.efectivoContadoDecimal?.toFixed(2), t.efectivoEsperadoDecimal?.toFixed(2)]).toEqual(["CERRADO_DECLARADO", "2950.25", esperado])
    const despues = await foto(k.negocio.id)
    expect([despues.operaciones, despues.movimientos, despues.ventas]).toEqual([antes.operaciones, antes.movimientos, antes.ventas])
    const owner = await api.cerrados(k.owner)
    const fila = owner.body.turnos.find((x: { id: string }) => x.id === turnoBeto)
    expect([fila.efectivoEsperado, fila.efectivoContado, fila.diferencia, fila.resultado]).toEqual([3000.5, 2950.25, -50.25, "FALTANTE"])
    ;(globalThis as Record<string, unknown>).__qaCierre = { turnoBeto, key }
    ev({ id: "T11", titulo: "Cierre ciego", esperado: "200 sin esperado/diferencia en la respuesta ni en la vista del cajero; guardado contado 2950.25, esperado 3000.50; dueño ve −50.25 FALTANTE; sin dinero", obtenido: { http: http(r), guardado: { contado: t.efectivoContadoDecimal?.toFixed(2), esperado: t.efectivoEsperadoDecimal?.toFixed(2) }, duenio: fila }, antes, despues })
  })

  test("T12 — segundo cierre: misma clave repite (200), misma clave con otro importe 409, clave nueva 409 TURNO_NO_ABIERTO, ráfaga concurrente sin efectos", async () => {
    const { turnoBeto, key } = (globalThis as Record<string, any>).__qaCierre
    const antes = await foto(k.negocio.id)
    const tAntes = await db.turnoCaja.findUniqueOrThrow({ where: { id: turnoBeto } })
    const replay = await api.cerrar(beto.cookie, slug(), turnoBeto, "2950.25", key)
    const reusada = await api.cerrar(beto.cookie, slug(), turnoBeto, "100.00", key)
    const nueva = await api.cerrar(beto.cookie, slug(), turnoBeto, "100.00")
    const rafaga = await Promise.all(Array.from({ length: 5 }, () => api.cerrar(beto.cookie, slug(), turnoBeto, "1.00")))
    expect([replay.status, replay.replayed]).toEqual([200, true])
    expect([reusada.status, reusada.body.code]).toEqual([409, "IDEMPOTENCY_KEY_REUSED"])
    expect([nueva.status, nueva.body.code]).toEqual([409, "TURNO_NO_ABIERTO"])
    expect(rafaga.every((x) => x.status === 409 && x.body.code === "TURNO_NO_ABIERTO")).toBe(true)
    const tDespues = await db.turnoCaja.findUniqueOrThrow({ where: { id: turnoBeto } })
    expect([tDespues.efectivoContadoDecimal?.toFixed(2), tDespues.cerradoEn?.toISOString(), tDespues.updatedAt.toISOString()]).toEqual([tAntes.efectivoContadoDecimal?.toFixed(2), tAntes.cerradoEn?.toISOString(), tAntes.updatedAt.toISOString()])
    await sinCambios(k.negocio.id, antes)
    expect(await db.auditLog.count({ where: { accion: "turno_caja.cerrado_declarado", recursoId: turnoBeto } })).toBe(1)
    ev({ id: "T12", titulo: "Segundo cierre", esperado: "replay 200; clave reusada 409 IDEMPOTENCY_KEY_REUSED; clave nueva y ráfaga 409 TURNO_NO_ABIERTO; cierre intacto; 1 evento de cierre", obtenido: { replay: http(replay), reusada: http(reusada), nueva: http(nueva), rafaga: rafaga.map(http) } })
  })

  test("T13 — después del cierre: venta, cambio y reintegro en efectivo del cajero rechazados; el dueño no puede vender sobre la caja cerrada", async () => {
    const antes = await foto(k.negocio.id)
    const venta = await api.vender(beto.cookie, slug(), { metodoPago: "EFECTIVO", items: [item(pA.id)] })
    const v = ventasAna[3]
    const cambio = await api.cambiar(beto.cookie, slug(), v.id, { motivo: "QA T13", salen: [{ ventaItemId: v.itemId, cantidad: 1, reingresaStock: true }], entran: [item(pB.id)], esperado: { salida: "1000.00", entrada: "1000.00" }, confirmo: true })
    const dev = await api.devolver(beto.cookie, slug(), v.id, { tipo: "DEVOLUCION_PARCIAL", motivo: "QA T13", items: [{ ventaItemId: v.itemId, cantidad: 1, reingresaStock: true }], reintegro: { modo: "REALIZADO", medio: "EFECTIVO" }, confirmo: true })
    const owner = await api.venderOwner(k.owner, { metodoPago: "EFECTIVO", cajaFisicaId: cajaB, items: [item(pA.id)] })
    expect([venta.status, venta.body.code]).toEqual([409, "TURNO_REQUERIDO"])
    expect([cambio.status, cambio.body.code]).toEqual([409, "TURNO_REQUERIDO"])
    expect([dev.status, dev.body.code]).toEqual([409, "TURNO_REQUERIDO"])
    expect(owner.status).toBe(409)
    await sinCambios(k.negocio.id, antes)
    ev({ id: "T13", titulo: "Operaciones después del cierre", esperado: "cajero: venta/cambio/reintegro efectivo 409 TURNO_REQUERIDO; dueño sobre Caja 2 cerrada: 409; nada escrito", obtenido: { venta: http(venta), cambio: http(cambio), devolucion: http(dev), duenio: http(owner) } })
  })

  test("T14 — aislamiento entre cajeros, cajas y negocios", async () => {
    const otro = await crearNegocio("Almacen QA", "OPCIONAL")
    const zoe = await crearCajero(otro.negocio.id, "Zoe QA")
    const antes = await foto(k.negocio.id)
    const antesOtro = await foto(otro.negocio.id)
    const zoeEnKiosco = await api.vender(zoe.cookie, slug(), { metodoPago: "EFECTIVO", items: [item(pA.id)] })
    const zoeTurnoKiosco = await api.turnoCajero(zoe.cookie, slug())
    const zoeCierraAna = await api.cerrar(zoe.cookie, otro.negocio.slug, turnoAna, "1.00")
    const betoCierraAna = await api.cerrar(beto.cookie, slug(), turnoAna, "1.00")
    const duenioCierraAna = await api.cerrarOwner(k.owner, turnoAna, "1.00")
    const cajeroEnRutaDuenio = await api.cerrados(beto.cookie)
    // The body cannot choose a shift: Beto (no shift now) naming Ana's shift is still TURNO_REQUERIDO.
    const cuerpoConTurno = await api.vender(beto.cookie, slug(), { metodoPago: "EFECTIVO", turnoCajaId: turnoAna, items: [item(pA.id)] })
    expect(zoeEnKiosco.status).toBe(403)
    expect(zoeTurnoKiosco.status).toBe(403)
    expect(zoeCierraAna.status).toBeGreaterThanOrEqual(400)
    expect(betoCierraAna.status).toBeGreaterThanOrEqual(400)
    expect(duenioCierraAna.status).toBe(403)
    expect(cajeroEnRutaDuenio.status).toBe(401)
    expect(cuerpoConTurno.status).toBeGreaterThanOrEqual(400)
    await sinCambios(k.negocio.id, antes)
    await sinCambios(otro.negocio.id, antesOtro)
    // Ana's own cash sale still lands only on Caja principal.
    const antesAna = await foto(k.negocio.id)
    const vAna = await api.vender(ana.cookie, slug(), { metodoPago: "EFECTIVO", items: [item(pA.id)] })
    expect(vAna.status).toBe(201)
    const despuesAna = await foto(k.negocio.id)
    expect(D(despuesAna.saldos[`efectivo_caja_fisica:${cajaA}`]).minus(antesAna.saldos[`efectivo_caja_fisica:${cajaA}`]).toFixed(2)).toBe("1000.00")
    expect(despuesAna.saldos[`efectivo_caja_fisica:${cajaB}`]).toBe(antesAna.saldos[`efectivo_caja_fisica:${cajaB}`])
    // Close Ana's shift (cleanup of the scenario; also a second regular blind close).
    const cierreAna = await api.cerrar(ana.cookie, slug(), turnoAna, await esperadoTurno(turnoAna))
    expect(cierreAna.status).toBe(200)
    ev({ id: "T14", titulo: "Aislamiento", esperado: "cajera de otro negocio 403; nadie cierra el turno de otro (cajero/otro negocio ≥400, dueño 403); ruta del dueño con cookie de cajero 401; el cuerpo no elige turno; efectivo de Ana sólo en Caja principal", obtenido: { zoeEnKiosco: http(zoeEnKiosco), zoeTurnoKiosco: http(zoeTurnoKiosco), zoeCierraAna: http(zoeCierraAna), betoCierraAna: http(betoCierraAna), duenioCierraAna: http(duenioCierraAna), cajeroEnRutaDuenio: http(cajeroEnRutaDuenio), cuerpoConTurno: http(cuerpoConTurno), cierreAna: http(cierreAna) } })
  })
})

// ===========================================================================
// T15–T20 — remaining fund and transfers between shifts
// ===========================================================================
describeQa("QA — fondo remanente y traspasos (T15–T20)", () => {
  let f: Awaited<ReturnType<typeof crearNegocio>>
  let pablo: Awaited<ReturnType<typeof crearCajero>>, rita: Awaited<ReturnType<typeof crearCajero>>, quique: Awaited<ReturnType<typeof crearCajero>>
  let caja1: string, caja2: string
  let origen: string, destino: string, origen2: string
  let prod: { id: string }
  const slug = () => f.negocio.slug
  const fondoOfrecido = async (c: string, caja: string) => (await api.turnoCajero(c, slug())).body.cajas.find((x: { id: string }) => x.id === caja).fondoTransferible

  beforeAll(async () => {
    f = await crearNegocio("Kiosco QA Fondos", "OBLIGATORIO")
    pablo = await crearCajero(f.negocio.id, "Pablo QA")
    rita = await crearCajero(f.negocio.id, "Rita QA")
    quique = await crearCajero(f.negocio.id, "Quique QA")
    caja1 = (await api.cajas(f.owner)).body.cajas[0].id
    caja2 = (await api.crearCaja(f.owner, "Caja 2")).body.id
    prod = await crearProducto(f.negocio.id, "Gaseosa", 500, 100)
  })

  test("T15 — cierre con fondo remanente: el dueño entrega 1000 y deja 500 en caja; sin dinero contable; se ofrece al próximo turno", async () => {
    const a = await api.abrir(pablo.cookie, slug(), { cajaFisicaId: caja1, fondoInicial: "1000.00" })
    origen = a.body.turno.id
    expect((await api.vender(pablo.cookie, slug(), { metodoPago: "EFECTIVO", items: [{ productoId: prod.id, cantidad: 1 }] })).status).toBe(201)
    expect((await api.cerrar(pablo.cookie, slug(), origen, "1500.00")).status).toBe(200)
    const antes = await foto(f.negocio.id)
    const e = await api.entrega(f.owner, origen, { tipo: "ENTREGA_CONFIRMADA", efectivoEntregado: "1000.00", fondoRemanente: "500.00", destinoTipo: "DUENO", confirmar: true })
    expect(e.status).toBe(201)
    const despues = await foto(f.negocio.id)
    expect([despues.entregas, despues.operaciones, despues.movimientos, despues.saldos]).toEqual([antes.entregas + 1, antes.operaciones, antes.movimientos, antes.saldos])
    const ofrecido = await fondoOfrecido(rita.cookie, caja1)
    expect(ofrecido).toEqual({ turnoOrigenId: origen, importe: "500.00" })
    ev({ id: "T15", titulo: "Cierre con fondo remanente", esperado: "entrega 201 (1000 + 500 = 1500 declarado); sin operaciones ni movimientos; Caja principal ofrece 500.00 del turno de Pablo", obtenido: { entrega: http(e), ofrecido }, antes, despues })
  })

  test("T16 — el siguiente turno recibe el fondo: fondo inicial 500.00, un traspaso, sin dinero contable", async () => {
    const antes = await foto(f.negocio.id)
    const key = randomUUID()
    const body = { cajaFisicaId: caja1, fondoInicial: "500.00", transferirDesdeTurnoCajaId: origen, confirmoRecepcionFondo: true }
    const r = await api.abrir(rita.cookie, slug(), body, key)
    expect(r.status).toBe(201)
    destino = r.body.turno.id
    ;(globalThis as Record<string, unknown>).__qaTraspaso = { key, body }
    const despues = await foto(f.negocio.id)
    expect(despues.traspasos).toBe(antes.traspasos + 1)
    expect([despues.operaciones, despues.movimientos, despues.saldos]).toEqual([antes.operaciones, antes.movimientos, antes.saldos])
    expect(await esperadoTurno(destino)).toBe("500.00")
    const tr = await db.traspasoFondoTurnoCaja.findFirstOrThrow({ where: { turnoOrigenId: origen } })
    expect([tr.montoDecimal.toFixed(2), tr.turnoDestinoId]).toEqual(["500.00", destino])
    ev({ id: "T16", titulo: "Apertura recibiendo el fondo anterior", esperado: "201; fondo 500.00; traspaso 1 (origen→destino); esperado del nuevo turno 500.00; sin dinero contable", obtenido: { http: http(r), traspaso: { monto: tr.montoDecimal.toFixed(2), origen, destino } }, antes, despues })
  })

  test("T17 — el fondo se recibe UNA vez: replay con la misma clave no duplica; ya no se ofrece", async () => {
    const { key, body } = (globalThis as Record<string, any>).__qaTraspaso
    const antes = await foto(f.negocio.id)
    const replay = await api.abrir(rita.cookie, slug(), body, key)
    expect([replay.status, replay.replayed]).toEqual([200, true])
    await sinCambios(f.negocio.id, antes)
    expect(await fondoOfrecido(quique.cookie, caja1)).toBeNull()
    ev({ id: "T17", titulo: "Fondo recibido una sola vez", esperado: "replay 200 sin cambios; traspasos sigue en 1; ya no se ofrece", obtenido: { replay: http(replay), traspasos: antes.traspasos } })
  })

  test("T18 — intentar recibir un fondo ya transferido → rechazado; sin turno nuevo ni traspaso", async () => {
    // Rita closes; Quique then tries to receive Pablo's (already transferred) fund on the same register.
    expect((await api.cerrar(rita.cookie, slug(), destino, "500.00")).status).toBe(200)
    const antes = await foto(f.negocio.id)
    const r = await api.abrir(quique.cookie, slug(), { cajaFisicaId: caja1, fondoInicial: "500.00", transferirDesdeTurnoCajaId: origen, confirmoRecepcionFondo: true })
    expect(r.status).toBe(409)
    expect(["FONDO_REMANENTE_YA_TRANSFERIDO", "FONDO_REMANENTE_NO_DISPONIBLE"]).toContain(r.body.code)
    await sinCambios(f.negocio.id, antes)
    ev({ id: "T18", titulo: "Fondo ya transferido", esperado: "409 (FONDO_REMANENTE_YA_TRANSFERIDO o NO_DISPONIBLE); nada escrito", obtenido: http(r) })
  })

  test("T19 — rectificación ANTES de usar el remanente: cambia lo ofrecido; el importe viejo se rechaza; el nuevo se recibe", async () => {
    const a = await api.abrir(quique.cookie, slug(), { cajaFisicaId: caja2, fondoInicial: "300.00" })
    origen2 = a.body.turno.id
    expect((await api.cerrar(quique.cookie, slug(), origen2, "300.00")).status).toBe(200)
    expect((await api.entrega(f.owner, origen2, { tipo: "ENTREGA_CONFIRMADA", efectivoEntregado: "0.00", fondoRemanente: "300.00", destinoTipo: "RESGUARDO", destinoNombre: "Caja fuerte QA", confirmar: true })).status).toBe(201)
    const antes = await foto(f.negocio.id)
    const rect = await api.entrega(f.owner, origen2, { tipo: "RECTIFICACION", efectivoEntregado: "100.00", fondoRemanente: "200.00", destinoTipo: "DUENO", observacion: "QA: se retiraron 100 antes del próximo turno", confirmar: true })
    expect(rect.status).toBe(201)
    expect(await fondoOfrecido(pablo.cookie, caja2)).toEqual({ turnoOrigenId: origen2, importe: "200.00" })
    const viejo = await api.abrir(pablo.cookie, slug(), { cajaFisicaId: caja2, fondoInicial: "300.00", transferirDesdeTurnoCajaId: origen2, confirmoRecepcionFondo: true })
    expect(viejo.status).toBe(409)
    const nuevo = await api.abrir(pablo.cookie, slug(), { cajaFisicaId: caja2, fondoInicial: "200.00", transferirDesdeTurnoCajaId: origen2, confirmoRecepcionFondo: true })
    expect(nuevo.status).toBe(201)
    const despues = await foto(f.negocio.id)
    expect([despues.entregas, despues.traspasos, despues.operaciones, despues.movimientos]).toEqual([antes.entregas + 1, antes.traspasos + 1, antes.operaciones, antes.movimientos])
    ;(globalThis as Record<string, unknown>).__qaT20 = nuevo.body.turno.id
    ev({ id: "T19", titulo: "Rectificación antes de usar el remanente", esperado: "rectificación 201; se ofrece 200.00; abrir con 300.00 → 409; con 200.00 → 201; sin dinero contable", obtenido: { rectificacion: http(rect), viejo: http(viejo), nuevo: http(nuevo) }, antes, despues })
  })

  test("T20 — rectificación DESPUÉS de que otro turno recibió el fondo → 409 FONDO_REMANENTE_YA_TRANSFERIDO; historial intacto", async () => {
    const antes = await foto(f.negocio.id)
    const r = await api.entrega(f.owner, origen2, { tipo: "RECTIFICACION", efectivoEntregado: "300.00", fondoRemanente: "0.00", destinoTipo: "DUENO", observacion: "QA: intento posterior al traspaso", confirmar: true })
    expect([r.status, r.body.code]).toEqual([409, "FONDO_REMANENTE_YA_TRANSFERIDO"])
    await sinCambios(f.negocio.id, antes)
    // Historical closings untouched by every custody / transfer step.
    const historico = await db.turnoCaja.findMany({ where: { id: { in: [origen, destino, origen2] } }, select: { id: true, efectivoContadoDecimal: true, efectivoEsperadoDecimal: true } })
    const resumen = Object.fromEntries(historico.map((t) => [t.id, [t.efectivoContadoDecimal?.toFixed(2), t.efectivoEsperadoDecimal?.toFixed(2)]]))
    expect(resumen[origen]).toEqual(["1500.00", "1500.00"])
    expect(resumen[destino]).toEqual(["500.00", "500.00"])
    expect(resumen[origen2]).toEqual(["300.00", "300.00"])
    ev({ id: "T20", titulo: "Rectificación tras el traspaso", esperado: "409 FONDO_REMANENTE_YA_TRANSFERIDO; nada escrito; cierres históricos intactos", obtenido: { http: http(r), cierres: resumen } })
  })
})

// ===========================================================================
// C1 — concurrent cash sales: two cashiers, two registers, separate shifts
// ===========================================================================
describeQa("QA — concurrencia de ventas en efectivo (C1)", () => {
  test(`C1 — ${ROUNDS} rondas de 3 ventas simultáneas (2 cajeros, 2 cajas): sin duplicados ni huérfanos; se registran los 409`, async () => {
    const c = await crearNegocio("Concurrencia QA", "OBLIGATORIO")
    const uno = await crearCajero(c.negocio.id, "Uno QA")
    const dos = await crearCajero(c.negocio.id, "Dos QA")
    const cajaUno = (await api.cajas(c.owner)).body.cajas[0].id
    const cajaDos = (await api.crearCaja(c.owner, "Caja 2")).body.id
    const p = await crearProducto(c.negocio.id, "Agua", 7)
    expect((await api.abrir(uno.cookie, c.negocio.slug, { cajaFisicaId: cajaUno, fondoInicial: "0.00" })).status).toBe(201)
    expect((await api.abrir(dos.cookie, c.negocio.slug, { cajaFisicaId: cajaDos, fondoInicial: "0.00" })).status).toBe(201)
    const resultados: Array<{ ronda: number; quien: string; cantidad: number; status: number; code: string | null; error: string | null }> = []
    for (let ronda = 1; ronda <= ROUNDS; ronda++) {
      const lote = [
        { quien: "uno", c: uno.cookie, cantidad: 3 },
        { quien: "dos", c: dos.cookie, cantidad: 7 },
        { quien: "uno", c: uno.cookie, cantidad: 1 },
      ]
      const res = await Promise.all(lote.map((l) => api.vender(l.c, c.negocio.slug, { metodoPago: "EFECTIVO", items: [{ productoId: p.id, cantidad: l.cantidad }] })))
      res.forEach((r, i) => resultados.push({ ronda, quien: lote[i].quien, cantidad: lote[i].cantidad, status: r.status, code: r.body?.code ?? null, error: r.status >= 400 ? r.body?.error ?? null : null }))
    }
    const ok = resultados.filter((r) => r.status === 201)
    const fallidas = resultados.filter((r) => r.status !== 201)
    // Invariants (always required, whatever the 409 count):
    const ventas = await db.venta.findMany({ where: { negocioId: c.negocio.id }, include: { cobros: true } })
    expect(ventas).toHaveLength(ok.length) // a refused sale left nothing behind
    for (const v of ventas) expect(v.cobros).toHaveLength(1)
    const ops = await db.operacionFinanciera.findMany({ where: { negocioId: c.negocio.id }, include: { movimientos: { include: { cuenta: true } } } })
    expect(ops).toHaveLength(ok.length) // one cash operation per sale, no orphans
    for (const o of ops) expect(o.cobroVentaId).toBeTruthy()
    const saldo = (caja: string) => ops.flatMap((o) => o.movimientos).filter((m) => m.cuenta.cajaFisicaId === caja).reduce((a, m) => a.plus(m.importeDecimal!), D(0)).toFixed(2)
    const esperadoUno = ok.filter((r) => r.quien === "uno").reduce((a, r) => a + r.cantidad * 7, 0).toFixed(2)
    const esperadoDos = ok.filter((r) => r.quien === "dos").reduce((a, r) => a + r.cantidad * 7, 0).toFixed(2)
    expect([saldo(cajaUno), saldo(cajaDos)]).toEqual([esperadoUno, esperadoDos])
    ev({ id: "C1", titulo: "Ventas simultáneas en efectivo (cuentas ya creadas desde la ronda 2)", esperado: "invariantes: 1 venta = 1 cobro = 1 operación; sin huérfanos; cada caja sólo con sus ventas. Además se cuentan los 409.", obtenido: { rondas: ROUNDS, solicitudes: resultados.length, aceptadas: ok.length, rechazadas: fallidas.length, rechazosPorRonda: fallidas.map((r) => ({ ronda: r.ronda, quien: r.quien, status: r.status, code: r.code, error: r.error })), saldos: { cajaUno: saldo(cajaUno), cajaDos: saldo(cajaDos) } } })
  })
})

// ===========================================================================
// C2 — the F10-B2.1 intermittence: the FIRST concurrent cash sales of fresh
// registers (each register's cash account is created by its first cash sale).
// ===========================================================================
describeQa("QA — concurrencia en las primeras ventas de cajas nuevas (C2)", () => {
  test(`C2 — ${ROUNDS} escenarios nuevos × 3 primeras ventas simultáneas: invariantes siempre; se cuentan y conservan los 409`, async () => {
    const duraciones: number[] = []
    const escenarios: Array<{ escenario: number; resultados: Array<{ quien: string; status: number; code: string | null; error: string | null }>; ventas: number; operaciones: number; cuentas: number; huérfanas: number }> = []
    for (let n = 1; n <= ROUNDS; n++) {
      const c = await crearNegocio(`Concurrencia QA C2 ${n}`, "OBLIGATORIO")
      const uno = await crearCajero(c.negocio.id, `Uno C2 ${n}`)
      const dos = await crearCajero(c.negocio.id, `Dos C2 ${n}`)
      const cajaUno = (await api.cajas(c.owner)).body.cajas[0].id
      const cajaDos = (await api.crearCaja(c.owner, "Caja 2")).body.id
      const p = await crearProducto(c.negocio.id, "Agua", 7)
      expect((await api.abrir(uno.cookie, c.negocio.slug, { cajaFisicaId: cajaUno, fondoInicial: "1.25" })).status).toBe(201)
      expect((await api.abrir(dos.cookie, c.negocio.slug, { cajaFisicaId: cajaDos, fondoInicial: "0.00" })).status).toBe(201)
      const lote = [{ quien: "uno", c: uno.cookie, q: 3 }, { quien: "dos", c: dos.cookie, q: 7 }, { quien: "uno", c: uno.cookie, q: 1 }]
      const res = await Promise.all(lote.map(async (l) => { const t0 = performance.now(); const r = await api.vender(l.c, c.negocio.slug, { metodoPago: "EFECTIVO", items: [{ productoId: p.id, cantidad: l.q }] }); duraciones.push(performance.now() - t0); return r }))
      const ok = res.filter((r) => r.status === 201).length
      const ventas = await db.venta.count({ where: { negocioId: c.negocio.id } })
      const ops = await db.operacionFinanciera.findMany({ where: { negocioId: c.negocio.id }, select: { cobroVentaId: true } })
      const cuentas = await db.cuentaFinanciera.count({ where: { negocioId: c.negocio.id } })
      const huérfanas = ops.filter((o) => !o.cobroVentaId).length
      // Invariants that must ALWAYS hold, even when a sale is refused under contention.
      expect(ventas).toBe(ok)
      expect(ops).toHaveLength(ok)
      expect(huérfanas).toBe(0)
      escenarios.push({ escenario: n, resultados: res.map((r, i) => ({ quien: lote[i].quien, status: r.status, code: r.body?.code ?? null, error: r.status >= 400 ? r.body?.error ?? null : null })), ventas, operaciones: ops.length, cuentas, huérfanas })
    }
    const solicitudes = escenarios.flatMap((e) => e.resultados)
    const orden = [...duraciones].sort((a, b) => a - b)
    const msDuracion = { min: Math.round(orden[0]), p50: Math.round(orden[Math.floor(orden.length * 0.5)]), p95: Math.round(orden[Math.floor(orden.length * 0.95)]), max: Math.round(orden[orden.length - 1]) }
    const rechazadas = solicitudes.filter((r) => r.status !== 201)
    ev({ id: "C2", titulo: "Primeras ventas simultáneas de cajas nuevas (intermitencia F10-B2.1)", esperado: "invariantes siempre (venta = cobro = operación, sin huérfanos); el test original exige además 3 × 201", obtenido: { msDuracion, escenarios: escenarios.length, solicitudes: solicitudes.length, aceptadas: solicitudes.length - rechazadas.length, rechazadas: rechazadas.length, escenariosConRechazo: escenarios.filter((e) => e.resultados.some((r) => r.status !== 201)).map((e) => ({ escenario: e.escenario, resultados: e.resultados, cuentas: e.cuentas })) } })
  })
})

// ===========================================================================
// E1 / G — account creation only for accepted sales; idempotency under load
// ===========================================================================
describeQa("QA — E1 (cuentas sólo para ventas aceptadas) y G (idempotencia concurrente)", () => {
  test("E1-OPCIONAL — sin turno en modo OPCIONAL la venta en efectivo se acepta y crea/usa la cuenta sin caja asignada; un rechazo previo por validación no crea nada", async () => {
    const o = await crearNegocio("Opcional QA E1", "OPCIONAL")
    const cajero = await crearCajero(o.negocio.id, "Opcional E1")
    const p = await crearProducto(o.negocio.id, "Yerba", 2500, 10)
    const antes = await foto(o.negocio.id)
    const invalida = await api.vender(cajero.cookie, o.negocio.slug, { metodoPago: "EFECTIVO", items: [{ productoId: "producto-inexistente", cantidad: 1 }] })
    expect(invalida.status).toBe(400)
    await sinCambios(o.negocio.id, antes) // E1: a refused cash sale leaves no account
    const sinStock = await api.vender(cajero.cookie, o.negocio.slug, { metodoPago: "EFECTIVO", items: [{ productoId: p.id, cantidad: 11 }] })
    expect(sinStock.status).toBe(409)
    expect(sinStock.body.error).toMatch(/stock/i) // a real stock refusal keeps a stock message
    await sinCambios(o.negocio.id, antes)
    const ok = await api.vender(cajero.cookie, o.negocio.slug, { metodoPago: "EFECTIVO", items: [{ productoId: p.id, cantidad: 2 }] })
    expect(ok.status).toBe(201)
    const despues = await foto(o.negocio.id)
    expect(despues.saldos).toEqual({ efectivo_caja_sin_asignar: "5000.00" })
    expect([despues.ventas, despues.cobros, despues.operaciones, despues.movimientos, despues.stock.Yerba]).toEqual([1, 1, 1, 1, 8])
    ev({ id: "E1-OPCIONAL", titulo: "Modo OPCIONAL y rechazos por validación/stock", esperado: "producto inexistente 400 y stock insuficiente 409 (mensaje de stock) sin crear cuentas; venta válida sin turno 201 que crea y usa efectivo_caja_sin_asignar", obtenido: { invalida: http(invalida), sinStock: http(sinStock), ok: http(ok), saldos: despues.saldos }, antes, despues })
  })

  test("E1-OBLIGATORIO — un rechazo por turno no crea cuentas; la primera venta válida con turno crea la cuenta de su caja y la usa", async () => {
    const n = await crearNegocio("Obligatorio QA E1", "OBLIGATORIO")
    const cajero = await crearCajero(n.negocio.id, "Obligatorio E1")
    const caja = (await api.cajas(n.owner)).body.cajas[0].id
    const p = await crearProducto(n.negocio.id, "Agua", 700)
    const antes = await foto(n.negocio.id)
    const rechazo = await api.vender(cajero.cookie, n.negocio.slug, { metodoPago: "EFECTIVO", items: [{ productoId: p.id, cantidad: 1 }] })
    expect([rechazo.status, rechazo.body.code]).toEqual([409, "TURNO_REQUERIDO"])
    await sinCambios(n.negocio.id, antes)
    expect((await api.abrir(cajero.cookie, n.negocio.slug, { cajaFisicaId: caja, fondoInicial: "0.00" })).status).toBe(201)
    const ok = await api.vender(cajero.cookie, n.negocio.slug, { metodoPago: "EFECTIVO", items: [{ productoId: p.id, cantidad: 1 }] })
    expect(ok.status).toBe(201)
    const despues = await foto(n.negocio.id)
    expect(despues.saldos).toEqual({ [`efectivo_caja_fisica:${caja}`]: "700.00" })
    ev({ id: "E1-OBLIGATORIO", titulo: "Rechazo por turno sin cuentas; venta válida crea la cuenta de su caja", esperado: "409 sin cuentas; 201 con una sola cuenta efectivo_caja_fisica de 700.00", obtenido: { rechazo: http(rechazo), ok: http(ok), saldos: despues.saldos } })
  })

  test(`G — ${ROUNDS} cajas nuevas: misma clave ×5 simultánea = 1 venta + 4 repeticiones; 5 claves distintas simultáneas = 5 ventas; sin duplicados`, async () => {
    const resultados: Array<{ ronda: number; mismaClave: number[]; distintas: number[] }> = []
    for (let n = 1; n <= ROUNDS; n++) {
      const g = await crearNegocio(`Idempotencia QA ${n}`, "OBLIGATORIO")
      const cajero = await crearCajero(g.negocio.id, `Idem ${n}`)
      const caja = (await api.cajas(g.owner)).body.cajas[0].id
      const p = await crearProducto(g.negocio.id, "Pan", 300, 100)
      expect((await api.abrir(cajero.cookie, g.negocio.slug, { cajaFisicaId: caja, fondoInicial: "0.00" })).status).toBe(201)
      const key = randomUUID()
      const body = { metodoPago: "EFECTIVO", items: [{ productoId: p.id, cantidad: 1 }] }
      const misma = await Promise.all(Array.from({ length: 5 }, () => api.vender(cajero.cookie, g.negocio.slug, body, key)))
      const distintas = await Promise.all(Array.from({ length: 5 }, () => api.vender(cajero.cookie, g.negocio.slug, body)))
      expect(misma.filter((r) => r.status === 201)).toHaveLength(1)
      expect(misma.filter((r) => r.status === 200 && r.replayed)).toHaveLength(4)
      expect(new Set(misma.map((r) => r.body.id)).size).toBe(1)
      expect(distintas.every((r) => r.status === 201)).toBe(true)
      const f = await foto(g.negocio.id)
      expect([f.ventas, f.cobros, f.operaciones, f.movimientos, f.stock.Pan]).toEqual([6, 6, 6, 6, 94])
      expect(f.saldos).toEqual({ [`efectivo_caja_fisica:${caja}`]: "1800.00" })
      resultados.push({ ronda: n, mismaClave: misma.map((r) => r.status), distintas: distintas.map((r) => r.status) })
    }
    ev({ id: "G", titulo: "Idempotencia bajo concurrencia en cajas nuevas", esperado: "misma clave: 1×201 + 4×200 repetidas (mismo id); claves distintas: 5×201; 6 ventas = 6 cobros = 6 operaciones; stock −6; saldo 1800.00", obtenido: { rondas: ROUNDS, resultados } })
  })
})
