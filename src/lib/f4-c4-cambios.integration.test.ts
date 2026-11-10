/// <reference types="bun-types" />
// ============================================
// F4-C4 — commercial exchanges and linked additional sales (REAL ephemeral PostgreSQL)
// ============================================
// Real owner and cashier routes + real PostgreSQL with every migration applied
// (DELIGO_EPHEMERAL_TEST_DB=1). Reference cases A–E of
// codex-reports/F4_C_SALE_EXCHANGES.md §12, successive exchanges, voids,
// pending refunds, double click, concurrency, exhausted retries and full
// rollbacks, stock and reservations, shifts (OPCIONAL / OBLIGATORIO / closed),
// permissions, owner notices, audit and the credit-vs-money separation.
// Isolated fixtures (random ids).

import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { createOperationalSession, createSession, OPERATIONAL_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/auth"
import { GET as getCajas, POST as postCaja } from "@/app/api/negocio/caja/cajas/route"
import { POST as postTurnoOwner } from "@/app/api/negocio/caja/turnos/route"
import { POST as postVentaOwner } from "@/app/api/negocio/caja/ventas/route"
import { POST as postTurnoCajero } from "@/app/api/operativo/caja/[slug]/turno/route"
import { POST as postVentaCajero } from "@/app/api/operativo/caja/[slug]/ventas/route"
import { POST as postDevolucionOwner } from "@/app/api/negocio/caja/ventas/[id]/devoluciones/route"
import { POST as postReintegroOwner } from "@/app/api/negocio/caja/devoluciones/[id]/reintegro/route"
import { POST as postCambioOwner } from "@/app/api/negocio/caja/ventas/[id]/cambios/route"
import { POST as postCotizacionOwner } from "@/app/api/negocio/caja/ventas/[id]/cambios/cotizacion/route"
import { POST as postAdicionalOwner } from "@/app/api/negocio/caja/ventas/[id]/adicionales/route"
import { POST as postCambioCajero } from "@/app/api/operativo/caja/[slug]/ventas/[id]/cambios/route"
import { POST as postCotizacionCajero } from "@/app/api/operativo/caja/[slug]/ventas/[id]/cambios/cotizacion/route"
import { POST as postAdicionalCajero } from "@/app/api/operativo/caja/[slug]/ventas/[id]/adicionales/route"
import { POST as postDevolucionCajero } from "@/app/api/operativo/caja/[slug]/ventas/[id]/devoluciones/route"
import { COBRO_RESUMEN_SELECT, agruparCobrosPorVenta, resumirCobrosCaja } from "@/lib/caja-resumen-cobros"
import { ejecutarSerializableCambio } from "@/lib/caja-ejecutor-cambio"
import { parseCambioBody, registrarCambioVenta } from "@/lib/caja-cambios-service"

setDefaultTimeout(240_000)

const testDatabaseUrl = process.env.DELIGO_TEST_DATABASE_URL
const isEphemeralIntegrationDb = process.env.DELIGO_EPHEMERAL_TEST_DB === "1"
if (!testDatabaseUrl || process.env.DATABASE_URL !== testDatabaseUrl) {
  throw new Error("Este test de integración requiere DELIGO_TEST_DATABASE_URL y DATABASE_URL apuntando a la misma base de prueba.")
}
const declaredEnvironment = process.env.DELIGO_ENVIRONMENT ?? process.env.RAILWAY_ENVIRONMENT_NAME ?? process.env.APP_ENV
if (!declaredEnvironment || declaredEnvironment.toUpperCase() !== "TESTING") {
  throw new Error("La suite F4-C4 sólo puede ejecutarse con DELIGO_ENVIRONMENT=TESTING.")
}
process.env.DELIGO_ENVIRONMENT = "TESTING"
process.env.DELIGO_F10_B2_2_B_SHIFT_UI_ENABLED = "true"

// Writes real rows: only against the ephemeral test database.
const ephemeralTest = isEphemeralIntegrationDb ? test : test.skip

afterAll(async () => {
  await db.$disconnect()
})

const D = (v: string | number) => new Prisma.Decimal(String(v))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

async function crearNegocio(overrides: Partial<{ cajaTurnosModo: string; cambioAvisoCadenaCambios: number }> = {}) {
  const suffix = randomUUID()
  const negocio = await db.negocio.create({
    data: {
      slug: `test-f4c4-${suffix}`,
      nombre: `Test F4-C4 ${suffix}`,
      usuario: `test-f4c4-${suffix}`,
      email: `test-f4c4-${suffix}@example.test`,
      password: "fixture",
      rubro: "negocio",
      aprobado: true,
      suspendido: false,
      empleadosActivos: true,
      salonActivo: true,
      cajaTurnosModo: overrides.cajaTurnosModo ?? "OPCIONAL",
      cambioAvisoCadenaCambios: overrides.cambioAvisoCadenaCambios ?? null,
    },
  })
  const token = await createSession(negocio.id, "negocio")
  return { negocio, owner: `${SESSION_COOKIE_NAME}=${token}` }
}

async function crearCajero(negocioId: string, nombre = `Cajero ${randomUUID().slice(0, 6)}`) {
  const cuenta = await db.cuentaOperativa.create({ data: { nombre, email: `test-f4c4-${randomUUID()}@example.test`, activo: true, eliminado: false } })
  const empleado = await db.empleado.create({
    data: { nombre, codigo: randomUUID().slice(0, 8).toUpperCase(), negocioId, cuentaOperativaId: cuenta.id, areaOperativa: "caja", activo: true, eliminado: false },
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

/** An ACTIVA R3A reservation of `cantidad` units for a pending order. */
async function reservar(negocio: { id: string; slug: string }, productoId: string, cantidad: number) {
  const pedido = await db.pedido.create({
    data: { negocioId: negocio.id, negocioSlug: negocio.slug, negocioNombre: "Negocio F4-C4", clienteNombre: "Cliente F4-C4", metodoEntrega: "retiro", estado: "recibido", total: 100, totalProductos: 100, idempotencyKey: `test-f4c4-${randomUUID()}` },
  })
  const item = await db.pedidoItem.create({ data: { pedidoId: pedido.id, productoId, nombre: "Reservado", precio: 100, cantidad } })
  return db.reservaStock.create({ data: { negocioId: negocio.id, pedidoId: pedido.id, pedidoItemId: item.id, productoId, cantidad, estado: "ACTIVA" } })
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

const venderOwner = async (owner: string, body: unknown) => json(await postVentaOwner(req("/api/negocio/caja/ventas", owner, "POST", body, randomUUID())))
const venderCajero = async (cookie: string, slug: string, body: unknown) => json(await postVentaCajero(req(`/api/operativo/caja/${slug}/ventas`, cookie, "POST", body, randomUUID()), slugCtx(slug)))
const abrirCajero = async (cookie: string, slug: string, body: unknown = { fondoInicial: 0 }) => json(await postTurnoCajero(req(`/api/operativo/caja/${slug}/turno`, cookie, "POST", body, randomUUID()), slugCtx(slug)))
const cerrarCajero = async (cookie: string, slug: string, turnoCajaId: string, efectivoContado: string) =>
  json(await postTurnoCajero(req(`/api/operativo/caja/${slug}/turno`, cookie, "POST", { action: "close", turnoCajaId, efectivoContado }, randomUUID()), slugCtx(slug)))
const abrirOwner = async (owner: string, body: unknown) => json(await postTurnoOwner(req("/api/negocio/caja/turnos", owner, "POST", body, randomUUID())))
const crearCaja = async (owner: string, nombre: string) => json(await postCaja(req("/api/negocio/caja/cajas", owner, "POST", { nombre })))
const cambioOwner = async (owner: string, ventaId: string, body: unknown, key: string = randomUUID()) => json(await postCambioOwner(req(`/api/negocio/caja/ventas/${ventaId}/cambios`, owner, "POST", body, key), idCtx(ventaId)))
const cotizarOwner = async (owner: string, ventaId: string, body: unknown) => json(await postCotizacionOwner(req(`/api/negocio/caja/ventas/${ventaId}/cambios/cotizacion`, owner, "POST", body), idCtx(ventaId)))
const adicionalOwner = async (owner: string, ventaId: string, body: unknown, key: string = randomUUID()) => json(await postAdicionalOwner(req(`/api/negocio/caja/ventas/${ventaId}/adicionales`, owner, "POST", body, key), idCtx(ventaId)))
const cambioCajero = async (cookie: string, slug: string, ventaId: string, body: unknown, key: string = randomUUID()) =>
  json(await postCambioCajero(req(`/api/operativo/caja/${slug}/ventas/${ventaId}/cambios`, cookie, "POST", body, key), slugIdCtx(slug, ventaId)))
const cotizarCajero = async (cookie: string, slug: string, ventaId: string, body: unknown) =>
  json(await postCotizacionCajero(req(`/api/operativo/caja/${slug}/ventas/${ventaId}/cambios/cotizacion`, cookie, "POST", body), slugIdCtx(slug, ventaId)))
const adicionalCajero = async (cookie: string, slug: string, ventaId: string, body: unknown, key: string = randomUUID()) =>
  json(await postAdicionalCajero(req(`/api/operativo/caja/${slug}/ventas/${ventaId}/adicionales`, cookie, "POST", body, key), slugIdCtx(slug, ventaId)))
const devolverOwner = async (owner: string, ventaId: string, body: unknown, key: string = randomUUID()) => json(await postDevolucionOwner(req(`/api/negocio/caja/ventas/${ventaId}/devoluciones`, owner, "POST", body, key), idCtx(ventaId)))
const devolverCajero = async (cookie: string, slug: string, ventaId: string, body: unknown, key: string = randomUUID()) =>
  json(await postDevolucionCajero(req(`/api/operativo/caja/${slug}/ventas/${ventaId}/devoluciones`, cookie, "POST", body, key), slugIdCtx(slug, ventaId)))
const reintegroOwner = async (owner: string, devolucionId: string, body: unknown, key: string = randomUUID()) =>
  json(await postReintegroOwner(req(`/api/negocio/caja/devoluciones/${devolucionId}/reintegro`, owner, "POST", body, key), idCtx(devolucionId)))

const itemDe = (venta: { items: Array<{ id: string; productoId: string | null }> }, productoId: string) => venta.items.find((item) => item.productoId === productoId)!.id

/** Every row an exchange can write, per business — for exact rollback checks. */
async function huella(negocioId: string, productoIds: string[] = []) {
  const [ventas, items, cobros, operaciones, movimientos, devoluciones, devItems, cambios, inventario, avisos, auditorias, productos] = await Promise.all([
    db.venta.count({ where: { negocioId } }),
    db.ventaItem.count({ where: { venta: { negocioId } } }),
    db.cobroVenta.count({ where: { negocioId } }),
    db.operacionFinanciera.count({ where: { negocioId } }),
    db.movimientoFinanciero.count({ where: { negocioId } }),
    db.devolucionVenta.count({ where: { negocioId } }),
    db.devolucionVentaItem.count({ where: { negocioId } }),
    db.cambioVenta.count({ where: { negocioId } }),
    db.movimientoInventario.count({ where: { negocioId } }),
    db.notificacion.count({ where: { negocioId } }),
    db.auditLog.count({ where: { recurso: "venta", detalle: { contains: negocioId } } }),
    db.producto.findMany({ where: { id: { in: productoIds } }, select: { id: true, stockCantidad: true }, orderBy: { id: "asc" } }),
  ])
  return { ventas, items, cobros, operaciones, movimientos, devoluciones, devItems, cambios, inventario, avisos, auditorias, productos }
}

async function resumenDia(negocioId: string) {
  const ventas = await db.venta.findMany({ where: { negocioId }, select: { id: true, metodoPago: true, total: true, totalDecimal: true } })
  const cobros = agruparCobrosPorVenta(await db.cobroVenta.findMany({ where: { negocioId }, select: { ventaId: true, ...COBRO_RESUMEN_SELECT } }))
  const r = resumirCobrosCaja(ventas.map((v) => ({ ...v, cobros: cobros.get(v.id) ?? [] })))
  return { bruto: r.ventasBrutas.toFixed(2), efectivo: r.cobradoPorMedio.EFECTIVO.toFixed(2), transferencia: r.cobradoPorMedio.TRANSFERENCIA.toFixed(2), dinero: r.cobradoTotal.toFixed(2), noDinero: r.noDinero.toFixed(2) }
}

const saldoCuenta = async (cuentaId: string) =>
  (await db.movimientoFinanciero.findMany({ where: { cuentaId }, select: { importeDecimal: true } })).reduce((acc, m) => acc.plus(m.importeDecimal ?? 0), D(0)).toFixed(2)

/** A business with Saphirus $2.000 (stock 5) and Redmi $1.000 / Funda $2.500 (stock 10), and an owner cash sale of 1 Saphirus. */
async function escenario(overrides: Parameters<typeof crearNegocio>[0] = {}) {
  const { negocio, owner } = await crearNegocio(overrides)
  const saphirus = await crearProducto(negocio.id, "Saphirus", 2000, { controlStock: true, stockCantidad: 5 })
  const redmi = await crearProducto(negocio.id, "Redmi", 1000, { controlStock: true, stockCantidad: 10 })
  const funda = await crearProducto(negocio.id, "Funda", 2500, { controlStock: true, stockCantidad: 10 })
  return { negocio, owner, saphirus, redmi, funda }
}
type Escenario = Awaited<ReturnType<typeof escenario>>

async function ventaOwner(e: Escenario, lines: Array<{ productoId: string; cantidad: number }>, metodoPago = "EFECTIVO") {
  const r = await venderOwner(e.owner, { metodoPago, items: lines })
  expect(r.status).toBe(201)
  return r.body as { id: string; items: Array<{ id: string; productoId: string }> }
}

const stock = async (productoId: string) => (await db.producto.findUniqueOrThrow({ where: { id: productoId }, select: { stockCantidad: true } })).stockCantidad

// ---------------------------------------------------------------------------
// Reference cases
// ---------------------------------------------------------------------------

describe("F4-C4 — reference cases (§12)", () => {
  ephemeralTest("A — same value: credit covers everything, no money moves; stock in and out; credit never money", async () => {
    const e = await escenario()
    const original = await ventaOwner(e, [{ productoId: e.saphirus.id, cantidad: 1 }])
    const antes = await resumenDia(e.negocio.id)
    expect(antes).toMatchObject({ bruto: "2000.00", efectivo: "2000.00", noDinero: "0.00" })

    const cot = await cotizarOwner(e.owner, original.id, { salen: [{ ventaItemId: itemDe(original, e.saphirus.id), cantidad: 1, reingresaStock: true }], entran: [{ productoId: e.redmi.id, cantidad: 2 }] })
    expect(cot.status).toBe(200)
    expect(cot.body.cotizacion.importes).toEqual({ salida: "2000.00", entrada: "2000.00", credito: "2000.00", diferenciaCobrada: "0.00", diferenciaReintegro: "0.00" })
    expect(await db.cambioVenta.count({ where: { negocioId: e.negocio.id } })).toBe(0) // the quote wrote nothing

    const r = await cambioOwner(e.owner, original.id, {
      motivo: "No le gustó el aroma",
      salen: [{ ventaItemId: itemDe(original, e.saphirus.id), cantidad: 1, reingresaStock: true }],
      entran: [{ productoId: e.redmi.id, cantidad: 2 }],
      esperado: { salida: "2000.00", entrada: "2000.00" },
      confirmo: true,
    })
    expect(r.status).toBe(201)
    expect(r.body.cambio).toMatchObject({ liquidacion: "SIN_DIFERENCIA", importes: { salida: "2000.00", entrada: "2000.00", credito: "2000.00", diferenciaCobrada: "0.00", diferenciaReintegro: "0.00" }, registradoPor: "Dueño" })
    expect(r.body.ventaOrigen.estadoDevolucion).toBe("DEVUELTA_TOTAL")

    const nueva = await db.venta.findUniqueOrThrow({ where: { id: r.body.cambio.ventaNuevaId }, include: { cobros: true } })
    expect(nueva).toMatchObject({ metodoPago: "CAMBIO", vinculoTipo: "CAMBIO", ventaOrigenId: original.id, total: 2000 })
    expect(nueva.cobros.map((c) => [c.metodo, c.importeDecimal?.toFixed(2), c.estadoConciliacion])).toEqual([["CREDITO_CAMBIO", "2000.00", "NO_APLICA"]])
    expect(await db.operacionFinanciera.count({ where: { cobroVentaId: nueva.cobros[0].id } })).toBe(0)
    const devolucion = await db.devolucionVenta.findUniqueOrThrow({ where: { id: r.body.cambio.devolucionId } })
    expect(devolucion).toMatchObject({ reintegroEstado: "NO_CORRESPONDE", metodoPagoVenta: "EFECTIVO" })
    expect(devolucion.importeCompensadoDecimal.toFixed(2)).toBe("2000.00")
    expect(await stock(e.saphirus.id)).toBe(5) // sold 1 (4) + returned apt (5)
    expect(await stock(e.redmi.id)).toBe(8)

    // Credit is never money: commercial volume grows, money does not.
    expect(await resumenDia(e.negocio.id)).toEqual({ bruto: "4000.00", efectivo: "2000.00", transferencia: "0.00", dinero: "2000.00", noDinero: "2000.00" })
    // The owner's own exchange: audited, no notice to the owner.
    expect(await db.notificacion.count({ where: { negocioId: e.negocio.id } })).toBe(0)
    const audit = await db.auditLog.findFirstOrThrow({ where: { accion: "venta.cambio", recursoId: original.id } })
    expect(JSON.parse(audit.detalle)).toMatchObject({ cambioId: r.body.cambio.id, liquidacion: "SIN_DIFERENCIA", intento: 1 })
  })

  ephemeralTest("C — cheaper, refunded in cash by the cashier from HIS register; one owner notice (no extra return notice)", async () => {
    const e = await escenario()
    const cajero = await crearCajero(e.negocio.id, "Ana")
    const turno = (await abrirCajero(cajero.cookie, e.negocio.slug)).body.turno
    const original = (await venderCajero(cajero.cookie, e.negocio.slug, { metodoPago: "EFECTIVO", items: [{ productoId: e.saphirus.id, cantidad: 1 }] })).body
    const cot = await cotizarCajero(cajero.cookie, e.negocio.slug, original.id, { salen: [{ ventaItemId: itemDe(original, e.saphirus.id), cantidad: 1, reingresaStock: false }], entran: [{ productoId: e.redmi.id, cantidad: 1 }] })
    expect(cot.body.cotizacion).toMatchObject({ liquidacion: "REINTEGRO", importes: { diferenciaReintegro: "1000.00" } })

    const r = await cambioCajero(cajero.cookie, e.negocio.slug, original.id, {
      motivo: "Prefiere el más barato",
      salen: [{ ventaItemId: itemDe(original, e.saphirus.id), cantidad: 1, reingresaStock: false }],
      entran: [{ productoId: e.redmi.id, cantidad: 1 }],
      reintegro: { modo: "REALIZADO", medio: "EFECTIVO" },
      esperado: { salida: "2000.00", entrada: "1000.00" }, confirmo: true,
    })
    expect(r.status).toBe(201)
    expect(r.body.cambio).toMatchObject({ liquidacion: "REINTEGRO", importes: { salida: "2000.00", entrada: "1000.00", credito: "1000.00", diferenciaCobrada: "0.00", diferenciaReintegro: "1000.00" }, registradoPor: "Vos" })
    const cambio = await db.cambioVenta.findUniqueOrThrow({ where: { id: r.body.cambio.id } })
    expect(cambio).toMatchObject({ turnoCajaId: turno.id, actorTipo: "EMPLEADO", empleadoId: cajero.empleado.id })
    const devolucion = await db.devolucionVenta.findUniqueOrThrow({ where: { id: cambio.devolucionId } })
    expect(devolucion).toMatchObject({ reintegroEstado: "REALIZADO", reintegroMedio: "EFECTIVO", reintegroTurnoCajaId: turno.id })
    const salida = await db.movimientoFinanciero.findMany({ where: { operacionId: devolucion.reintegroOperacionId! } })
    expect(salida.map((m) => m.importeDecimal?.toFixed(2))).toEqual(["-1000.00"])
    const cuenta = await db.cuentaFinanciera.findFirstOrThrow({ where: { negocioId: e.negocio.id, cajaFisicaId: turno.cajaFisicaId } })
    expect(await saldoCuenta(cuenta.id)).toBe("1000.00") // +2000 sale − 1000 refund
    expect(await stock(e.saphirus.id)).toBe(4) // did not come back (not apt)

    const avisos = await db.notificacion.findMany({ where: { negocioId: e.negocio.id } })
    expect(avisos.map((a) => a.tipo)).toEqual(["caja_cambio"])
    expect(avisos[0].cuerpo).toContain("Ana registró un cambio")
    expect(JSON.parse(avisos[0].datos)).toMatchObject({ cambioId: cambio.id, liquidacion: "REINTEGRO", reintegroEstado: "REALIZADO", reintegroMedio: "EFECTIVO" })
  })

  ephemeralTest("C — PENDING refund: paid later exactly once and for D− only (not the whole return)", async () => {
    const e = await escenario()
    const original = await ventaOwner(e, [{ productoId: e.saphirus.id, cantidad: 1 }])
    const r = await cambioOwner(e.owner, original.id, { motivo: "Cambio", salen: [{ ventaItemId: itemDe(original, e.saphirus.id), cantidad: 1, reingresaStock: true }], entran: [{ productoId: e.redmi.id, cantidad: 1 }], reintegro: { modo: "PENDIENTE" }, esperado: { salida: "2000.00", entrada: "1000.00" }, confirmo: true })
    expect(r.status).toBe(201)
    const devolucionId = r.body.cambio.devolucionId
    expect((await db.devolucionVenta.findUniqueOrThrow({ where: { id: devolucionId } })).reintegroEstado).toBe("PENDIENTE")
    const pago = await reintegroOwner(e.owner, devolucionId, { medio: "EFECTIVO", confirmo: true })
    expect(pago.status).toBe(201)
    const dev = await db.devolucionVenta.findUniqueOrThrow({ where: { id: devolucionId } })
    const movs = await db.movimientoFinanciero.findMany({ where: { operacionId: dev.reintegroOperacionId! } })
    expect(movs.map((m) => m.importeDecimal?.toFixed(2))).toEqual(["-1000.00"])
    expect((await reintegroOwner(e.owner, devolucionId, { medio: "EFECTIVO", confirmo: true })).body.code).toBe("REINTEGRO_YA_REGISTRADO")
  })

  ephemeralTest("D — more expensive: D+ charged in full with ONE real method (cash → ledger; transfer → declared, no ledger)", async () => {
    const e = await escenario()
    const original = await ventaOwner(e, [{ productoId: e.saphirus.id, cantidad: 2 }])
    const linea = itemDe(original, e.saphirus.id)
    const r = await cambioOwner(e.owner, original.id, { motivo: "Lleva más", salen: [{ ventaItemId: linea, cantidad: 1, reingresaStock: true }], entran: [{ productoId: e.redmi.id, cantidad: 1 }, { productoId: e.funda.id, cantidad: 1 }], medioDiferencia: "EFECTIVO", esperado: { salida: "2000.00", entrada: "3500.00" }, confirmo: true })
    expect(r.status).toBe(201)
    expect(r.body.cambio).toMatchObject({ liquidacion: "COBRO", importes: { salida: "2000.00", entrada: "3500.00", credito: "2000.00", diferenciaCobrada: "1500.00", diferenciaReintegro: "0.00" } })
    const nueva = await db.venta.findUniqueOrThrow({ where: { id: r.body.cambio.ventaNuevaId }, include: { cobros: { orderBy: { metodo: "asc" } } } })
    expect(nueva.cobros.map((c) => [c.metodo, c.importeDecimal?.toFixed(2)])).toEqual([["CREDITO_CAMBIO", "2000.00"], ["EFECTIVO", "1500.00"]])
    const op = await db.operacionFinanciera.findFirstOrThrow({ where: { cobroVentaId: nueva.cobros[1].id }, include: { movimientos: true } })
    expect(op.movimientos.map((m) => m.importeDecimal?.toFixed(2))).toEqual(["1500.00"])
    expect(await resumenDia(e.negocio.id)).toEqual({ bruto: "7500.00", efectivo: "5500.00", transferencia: "0.00", dinero: "5500.00", noDinero: "2000.00" })

    // Second exchange of the remaining unit, difference by declared transfer: no ledger.
    const t = await cambioOwner(e.owner, original.id, { motivo: "Otro", salen: [{ ventaItemId: linea, cantidad: 1, reingresaStock: true }], entran: [{ productoId: e.funda.id, cantidad: 1 }], medioDiferencia: "TRANSFERENCIA", esperado: { salida: "2000.00", entrada: "2500.00" }, confirmo: true })
    expect(t.status).toBe(201)
    const cobroT = await db.cobroVenta.findFirstOrThrow({ where: { ventaId: t.body.cambio.ventaNuevaId, metodo: "TRANSFERENCIA" } })
    expect([cobroT.importeDecimal?.toFixed(2), cobroT.estadoConciliacion]).toEqual(["500.00", "DECLARADO"])
    expect(await db.operacionFinanciera.count({ where: { cobroVentaId: cobroT.id } })).toBe(0)
  })

  ephemeralTest("B — linked additional sale by a cashier: normal cobro, linked, owner notice; P2: never on a voided or fully returned sale", async () => {
    const e = await escenario()
    const cajero = await crearCajero(e.negocio.id, "Beto")
    await abrirCajero(cajero.cookie, e.negocio.slug)
    const original = (await venderCajero(cajero.cookie, e.negocio.slug, { metodoPago: "EFECTIVO", items: [{ productoId: e.saphirus.id, cantidad: 2 }] })).body
    const a = await adicionalCajero(cajero.cookie, e.negocio.slug, original.id, { metodoPago: "TRANSFERENCIA", items: [{ productoId: e.redmi.id, cantidad: 1 }] })
    expect(a.status).toBe(201)
    expect(a.body.vinculo).toMatchObject({ tipo: "ADICIONAL", ventaOrigenId: original.id })
    const adicional = await db.venta.findUniqueOrThrow({ where: { id: a.body.venta.id }, include: { cobros: true } })
    expect(adicional).toMatchObject({ vinculoTipo: "ADICIONAL", ventaOrigenId: original.id, metodoPago: "TRANSFERENCIA", total: 1000 })
    expect(adicional.cobros.map((c) => [c.metodo, c.importeDecimal?.toFixed(2)])).toEqual([["TRANSFERENCIA", "1000.00"]])
    expect((await db.notificacion.findMany({ where: { negocioId: e.negocio.id } })).map((n) => n.tipo)).toEqual(["caja_venta_adicional"])
    expect(await db.auditLog.count({ where: { accion: "venta.adicional_vinculada", recursoId: original.id } })).toBe(1)

    // Fully returned (no formal void): refused.
    await devolverCajero(cajero.cookie, e.negocio.slug, original.id, { tipo: "DEVOLUCION_PARCIAL", motivo: "Devuelve", items: [{ ventaItemId: itemDe(original, e.saphirus.id), cantidad: 2, reingresaStock: true }], reintegro: { modo: "PENDIENTE" }, confirmo: true })
    const devuelta = await adicionalCajero(cajero.cookie, e.negocio.slug, original.id, { metodoPago: "EFECTIVO", items: [{ productoId: e.redmi.id, cantidad: 1 }] })
    expect([devuelta.status, devuelta.body.code]).toEqual([409, "VENTA_ORIGEN_DEVUELTA"])

    // Voided: refused; a new independent sale is the way.
    const otra = await ventaOwner(e, [{ productoId: e.redmi.id, cantidad: 1 }])
    expect((await devolverOwner(e.owner, otra.id, { tipo: "ANULACION", motivo: "Error", items: [{ ventaItemId: itemDe(otra, e.redmi.id), reingresaStock: true }], reintegro: { modo: "PENDIENTE" }, confirmo: true })).status).toBe(201)
    const anulada = await adicionalOwner(e.owner, otra.id, { metodoPago: "EFECTIVO", items: [{ productoId: e.funda.id, cantidad: 1 }] })
    expect([anulada.status, anulada.body.code]).toEqual([409, "VENTA_ORIGEN_ANULADA"])
    expect((await venderOwner(e.owner, { metodoPago: "EFECTIVO", items: [{ productoId: e.funda.id, cantidad: 1 }] })).status).toBe(201)

    // Defense in depth: SQL refuses a direct linked insert on the voided sale.
    const directo = await db.venta.create({ data: { negocioId: e.negocio.id, total: 1, totalDecimal: D(1), metodoPago: "EFECTIVO", cantidadItems: 1, actorTipo: "NEGOCIO", actorId: e.negocio.id, ventaOrigenId: otra.id, vinculoTipo: "ADICIONAL" } }).then(() => "ok", (error: Error) => error.message)
    expect(directo).toContain("additional sale cannot be linked to a voided sale")
  })

  ephemeralTest("E — successive exchanges: the CAMBIO sale is exchanged, returned and voided again (D2); chain warning; SQL method guard", async () => {
    const e = await escenario({ cambioAvisoCadenaCambios: 1 })
    const original = await ventaOwner(e, [{ productoId: e.saphirus.id, cantidad: 1 }])
    const c1 = await cambioOwner(e.owner, original.id, { motivo: "1", salen: [{ ventaItemId: itemDe(original, e.saphirus.id), cantidad: 1, reingresaStock: true }], entran: [{ productoId: e.redmi.id, cantidad: 2 }], esperado: { salida: "2000.00", entrada: "2000.00" }, confirmo: true })
    expect(c1.status).toBe(201)
    expect(c1.body.cambio.advertencias).toEqual([])
    const v1 = await db.venta.findUniqueOrThrow({ where: { id: c1.body.cambio.ventaNuevaId }, include: { items: true } })

    // Exchange of the CAMBIO sale: its return stores metodoPagoVenta = CAMBIO; chain warning (threshold 1).
    const c2 = await cambioOwner(e.owner, v1.id, { motivo: "2", salen: [{ ventaItemId: v1.items[0].id, cantidad: 1, reingresaStock: true }], entran: [{ productoId: e.funda.id, cantidad: 1 }], medioDiferencia: "EFECTIVO", esperado: { salida: "1000.00", entrada: "2500.00" }, confirmo: true })
    expect(c2.status).toBe(201)
    expect(c2.body.cambio).toMatchObject({ liquidacion: "COBRO", importes: { salida: "1000.00", entrada: "2500.00", credito: "1000.00", diferenciaCobrada: "1500.00" } })
    expect(c2.body.cambio.advertencias.map((a: { codigo: string }) => a.codigo)).toEqual(["CADENA_LARGA"])
    expect((await db.devolucionVenta.findUniqueOrThrow({ where: { id: c2.body.cambio.devolucionId } })).metodoPagoVenta).toBe("CAMBIO")

    // F4-A on CAMBIO sales: partial return of v1's remaining unit refunds real money up to its value…
    const dev = await devolverOwner(e.owner, v1.id, { tipo: "DEVOLUCION_PARCIAL", motivo: "Devuelve", items: [{ ventaItemId: v1.items[0].id, cantidad: 1, reingresaStock: true }], reintegro: { modo: "REALIZADO", medio: "EFECTIVO" }, confirmo: true })
    expect(dev.status).toBe(201)
    expect(dev.body.devolucion).toMatchObject({ importe: 1000, metodoPagoVenta: "CAMBIO", reintegroEstado: "REALIZADO" })
    // …and the second CAMBIO sale can be voided (refund of its whole value: 1000 credit + 1500 cash).
    const v2 = await db.venta.findUniqueOrThrow({ where: { id: c2.body.cambio.ventaNuevaId }, include: { items: true } })
    const anul = await devolverOwner(e.owner, v2.id, { tipo: "ANULACION", motivo: "Anula", items: [{ ventaItemId: v2.items[0].id, reingresaStock: true }], reintegro: { modo: "PENDIENTE" }, confirmo: true })
    expect(anul.status).toBe(201)
    expect(anul.body.devolucion).toMatchObject({ importe: 2500, metodoPagoVenta: "CAMBIO" })

    // SQL: a return of a CAMBIO sale can never pretend another method.
    const fake = await db.devolucionVenta.create({ data: { negocioId: e.negocio.id, ventaId: v1.id, tipo: "DEVOLUCION_PARCIAL", motivo: "x", actorTipo: "NEGOCIO", actorId: e.negocio.id, importeDecimal: D(0), metodoPagoVenta: "EFECTIVO", reintegroEstado: "NO_CORRESPONDE", idempotencyKey: randomUUID(), idempotencyFingerprint: "x" } }).then(() => "ok", (error: Error) => error.message)
    expect(fake).toContain("sale return payment method must match its sale")
  })
})

// ---------------------------------------------------------------------------
// Idempotency, concurrency, retries, rollback
// ---------------------------------------------------------------------------

describe("F4-C4 — idempotency, concurrency and rollback", () => {
  const cuerpoA = (original: { id: string; items: Array<{ id: string; productoId: string }> }, e: Escenario) => ({
    motivo: "Cambio",
    salen: [{ ventaItemId: itemDe(original, e.saphirus.id), cantidad: 1, reingresaStock: true }],
    entran: [{ productoId: e.redmi.id, cantidad: 2 }],
    esperado: { salida: "2000.00", entrada: "2000.00" }, confirmo: true,
  })

  ephemeralTest("exact replay → same exchange, nothing new; same key with other content or other actor → 409", async () => {
    const e = await escenario()
    const original = await ventaOwner(e, [{ productoId: e.saphirus.id, cantidad: 2 }])
    const key = randomUUID()
    const first = await cambioOwner(e.owner, original.id, cuerpoA(original, e), key)
    expect(first.status).toBe(201)
    const despues = await huella(e.negocio.id, [e.saphirus.id, e.redmi.id])
    const again = await cambioOwner(e.owner, original.id, cuerpoA(original, e), key)
    expect([again.status, again.replayed, again.body.cambio.id]).toEqual([200, true, first.body.cambio.id])
    expect(await huella(e.negocio.id, [e.saphirus.id, e.redmi.id])).toEqual(despues)
    const otro = await cambioOwner(e.owner, original.id, { ...cuerpoA(original, e), motivo: "Otro motivo" }, key)
    expect([otro.status, otro.body.code]).toEqual([409, "IDEMPOTENCY_KEY_REUSED"])
    const cajero = await crearCajero(e.negocio.id)
    const ajeno = await cambioCajero(cajero.cookie, e.negocio.slug, original.id, cuerpoA(original, e), key)
    expect([ajeno.status, ajeno.body.code]).toEqual([409, "IDEMPOTENCY_KEY_REUSED"])
    expect(await huella(e.negocio.id, [e.saphirus.id, e.redmi.id])).toEqual(despues)
  })

  ephemeralTest("double click (same key, concurrent): exactly ONE exchange, one credit, one stock movement each way", async () => {
    const e = await escenario()
    const original = await ventaOwner(e, [{ productoId: e.saphirus.id, cantidad: 2 }])
    const key = randomUUID()
    const results = await Promise.all([cambioOwner(e.owner, original.id, cuerpoA(original, e), key), cambioOwner(e.owner, original.id, cuerpoA(original, e), key)])
    expect(results.map((r) => r.status).sort()).toEqual([200, 201])
    expect(new Set(results.map((r) => r.body.cambio.id)).size).toBe(1)
    expect(await db.cambioVenta.count({ where: { negocioId: e.negocio.id } })).toBe(1)
    expect(await db.cobroVenta.count({ where: { negocioId: e.negocio.id, metodo: "CREDITO_CAMBIO" } })).toBe(1)
    expect(await stock(e.redmi.id)).toBe(8)
    expect(await stock(e.saphirus.id)).toBe(4) // 5 − 2 sold + 1 back
  })

  ephemeralTest("concurrent exchanges of the LAST unit: one wins, the other is refused; nothing returned twice", async () => {
    const e = await escenario()
    const original = await ventaOwner(e, [{ productoId: e.saphirus.id, cantidad: 1 }])
    const results = await Promise.all([cambioOwner(e.owner, original.id, cuerpoA(original, e)), cambioOwner(e.owner, original.id, { ...cuerpoA(original, e), entran: [{ productoId: e.funda.id, cantidad: 1 }], medioDiferencia: "EFECTIVO", esperado: { salida: "2000.00", entrada: "2500.00" } })])
    expect(results.map((r) => r.status).sort()).toEqual([201, 409])
    expect(results.find((r) => r.status === 409)!.body.code).toBe("CANTIDAD_DEVOLUCION_EXCEDIDA")
    expect(await db.cambioVenta.count({ where: { negocioId: e.negocio.id } })).toBe(1)
    expect(await db.devolucionVentaItem.count({ where: { negocioId: e.negocio.id } })).toBe(1)
  })

  ephemeralTest("exchange vs F4-A return of the same last unit, concurrently: exactly one succeeds", async () => {
    const e = await escenario()
    const original = await ventaOwner(e, [{ productoId: e.saphirus.id, cantidad: 1 }])
    const [c, d] = await Promise.all([
      cambioOwner(e.owner, original.id, cuerpoA(original, e)),
      devolverOwner(e.owner, original.id, { tipo: "DEVOLUCION_PARCIAL", motivo: "Devuelve", items: [{ ventaItemId: itemDe(original, e.saphirus.id), cantidad: 1, reingresaStock: true }], reintegro: { modo: "PENDIENTE" }, confirmo: true }),
    ])
    expect([c.status, d.status].sort()).toEqual([201, 409])
    expect(await db.devolucionVentaItem.count({ where: { negocioId: e.negocio.id } })).toBe(1)
  })

  ephemeralTest("stock race: exchange and a normal sale for the last unit of what comes in — one wins", async () => {
    const e = await escenario()
    const ultimo = await crearProducto(e.negocio.id, "Último", 1000, { controlStock: true, stockCantidad: 1 })
    const original = await ventaOwner(e, [{ productoId: e.saphirus.id, cantidad: 1 }])
    const [c, v] = await Promise.all([
      cambioOwner(e.owner, original.id, { ...cuerpoA(original, e), entran: [{ productoId: ultimo.id, cantidad: 1 }], reintegro: { modo: "PENDIENTE" }, esperado: { salida: "2000.00", entrada: "1000.00" } }),
      venderOwner(e.owner, { metodoPago: "EFECTIVO", items: [{ productoId: ultimo.id, cantidad: 1 }] }),
    ])
    expect([c.status, v.status].sort()).toEqual([201, 409])
    expect(await stock(ultimo.id)).toBe(0)
  })

  ephemeralTest("exhausted retries: 6 attempts, 409 CAMBIO_CONFLICTO_CONCURRENTE and a COMPLETE rollback", async () => {
    const e = await escenario()
    const cajero = await crearCajero(e.negocio.id)
    await abrirCajero(cajero.cookie, e.negocio.slug)
    const original = (await venderCajero(cajero.cookie, e.negocio.slug, { metodoPago: "EFECTIVO", items: [{ productoId: e.saphirus.id, cantidad: 1 }] })).body
    const antes = await huella(e.negocio.id, [e.saphirus.id, e.funda.id])
    const parsed = parseCambioBody({ ...cuerpoA(original, e), entran: [{ productoId: e.funda.id, cantidad: 1 }], medioDiferencia: "EFECTIVO", esperado: { salida: "2000.00", entrada: "2500.00" } }, "REGISTRAR")
    if (!parsed.ok) throw new Error(parsed.error)
    let intentos = 0
    const conflicto = new Prisma.PrismaClientKnownRequestError("Transaction failed due to a write conflict or a deadlock. Please retry your transaction", { code: "P2034", clientVersion: "test" })
    const r = await registrarCambioVenta(
      db,
      { negocioId: e.negocio.id, actor: { tipo: "EMPLEADO", empleadoId: cajero.empleado.id }, ventaId: original.id, solicitud: parsed.value, idempotencyKey: randomUUID(), turnoCajaId: (await db.turnoCaja.findFirstOrThrow({ where: { negocioId: e.negocio.id, estado: "ABIERTO" } })).id },
      {
        // Every attempt does ALL the work (return, sale, cobros, ledger, notice, audit) and then conflicts at "commit".
        ejecutor: (cliente, fn, opciones) => ejecutarSerializableCambio(cliente, async (tx, ctx) => { intentos++; await fn(tx, ctx); throw conflicto }, { ...opciones, esperar: async () => {} }),
      }
    )
    expect(r).toMatchObject({ ok: false, status: 409, code: "CAMBIO_CONFLICTO_CONCURRENTE" })
    expect(intentos).toBe(6)
    expect(await huella(e.negocio.id, [e.saphirus.id, e.funda.id])).toEqual(antes)
  })

  ephemeralTest("late failure rolls back everything: what comes in is out of stock / reserved / prices drifted / D+ without method", async () => {
    const e = await escenario()
    const agotado = await crearProducto(e.negocio.id, "Agotado", 500, { controlStock: true, stockCantidad: 0 })
    const reservado = await crearProducto(e.negocio.id, "Reservado", 500, { controlStock: true, stockCantidad: 3 })
    await reservar(e.negocio, reservado.id, 3)
    const original = await ventaOwner(e, [{ productoId: e.saphirus.id, cantidad: 1 }])
    const ids = [e.saphirus.id, agotado.id, reservado.id, e.funda.id]
    const antes = await huella(e.negocio.id, ids)
    const base = { motivo: "Cambio", salen: [{ ventaItemId: itemDe(original, e.saphirus.id), cantidad: 1, reingresaStock: true }], reintegro: { modo: "REALIZADO", medio: "EFECTIVO" }, confirmo: true }

    const sinStock = await cambioOwner(e.owner, original.id, { ...base, entran: [{ productoId: agotado.id, cantidad: 1 }], esperado: { salida: "2000.00", entrada: "500.00" } })
    expect([sinStock.status, sinStock.body.code]).toEqual([409, "STOCK_INSUFFICIENT"])
    const conReserva = await cambioOwner(e.owner, original.id, { ...base, entran: [{ productoId: reservado.id, cantidad: 1 }], esperado: { salida: "2000.00", entrada: "500.00" } })
    expect([conReserva.status, conReserva.body.code]).toEqual([409, "STOCK_RESERVED_FOR_ORDERS"])
    const precios = await cambioOwner(e.owner, original.id, { ...base, entran: [{ productoId: e.funda.id, cantidad: 1 }], medioDiferencia: "EFECTIVO", esperado: { salida: "2000.00", entrada: "2400.00" } })
    expect([precios.status, precios.body.code]).toEqual([409, "IMPORTES_CAMBIARON"])
    const sinMedio = await cambioOwner(e.owner, original.id, { ...base, entran: [{ productoId: e.funda.id, cantidad: 1 }], esperado: { salida: "2000.00", entrada: "2500.00" } })
    expect([sinMedio.status, sinMedio.body.code]).toEqual([400, "MEDIO_DIFERENCIA_REQUERIDO"])
    const sinReintegro = await cambioOwner(e.owner, original.id, { motivo: "x", salen: base.salen, entran: [{ productoId: e.redmi.id, cantidad: 1 }], esperado: { salida: "2000.00", entrada: "1000.00" }, confirmo: true })
    expect([sinReintegro.status, sinReintegro.body.code]).toEqual([400, "REINTEGRO_REQUERIDO"])

    // Every refusal above happened AFTER the return wrote rows and re-entered stock: nothing remains.
    expect(await huella(e.negocio.id, ids)).toEqual(antes)
    expect(await db.reservaStock.count({ where: { productoId: reservado.id, estado: "ACTIVA" } })).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Shifts, permissions, warnings
// ---------------------------------------------------------------------------

describe("F4-C4 — shifts, permissions and warnings", () => {
  ephemeralTest("OBLIGATORIO: a cashier without an open shift cannot exchange at all (even with no money); nothing written", async () => {
    const e = await escenario({ cajaTurnosModo: "OBLIGATORIO" })
    const original = await ventaOwner(e, [{ productoId: e.saphirus.id, cantidad: 1 }])
    const cajero = await crearCajero(e.negocio.id)
    const antes = await huella(e.negocio.id, [e.saphirus.id, e.redmi.id])
    const r = await cambioCajero(cajero.cookie, e.negocio.slug, original.id, { motivo: "x", salen: [{ ventaItemId: itemDe(original, e.saphirus.id), cantidad: 1, reingresaStock: true }], entran: [{ productoId: e.redmi.id, cantidad: 2 }], esperado: { salida: "2000.00", entrada: "2000.00" }, confirmo: true })
    expect([r.status, r.body.code]).toEqual([409, "TURNO_REQUERIDO"])
    expect(await huella(e.negocio.id, [e.saphirus.id, e.redmi.id])).toEqual(antes)
  })

  ephemeralTest("OPCIONAL without a shift: today's rules (no shift, cash of D+ to the unassigned cash account)", async () => {
    const e = await escenario()
    const cajero = await crearCajero(e.negocio.id)
    const original = (await venderCajero(cajero.cookie, e.negocio.slug, { metodoPago: "EFECTIVO", items: [{ productoId: e.saphirus.id, cantidad: 1 }] })).body
    const r = await cambioCajero(cajero.cookie, e.negocio.slug, original.id, { motivo: "x", salen: [{ ventaItemId: itemDe(original, e.saphirus.id), cantidad: 1, reingresaStock: true }], entran: [{ productoId: e.funda.id, cantidad: 1 }], medioDiferencia: "EFECTIVO", esperado: { salida: "2000.00", entrada: "2500.00" }, confirmo: true })
    expect(r.status).toBe(201)
    const cambio = await db.cambioVenta.findUniqueOrThrow({ where: { id: r.body.cambio.id } })
    expect(cambio.turnoCajaId).toBeNull()
    const sinAsignar = await db.cuentaFinanciera.findFirstOrThrow({ where: { negocioId: e.negocio.id, clave: "efectivo_caja_sin_asignar" } })
    expect(await saldoCuenta(sinAsignar.id)).toBe("2500.00") // 2000 sale + 500 difference
  })

  ephemeralTest("sale of a CLOSED shift: money goes to the open shift, the closure snapshot stays identical, warning recorded", async () => {
    const e = await escenario()
    const cajero = await crearCajero(e.negocio.id)
    const t1 = (await abrirCajero(cajero.cookie, e.negocio.slug)).body.turno
    const original = (await venderCajero(cajero.cookie, e.negocio.slug, { metodoPago: "EFECTIVO", items: [{ productoId: e.saphirus.id, cantidad: 1 }] })).body
    expect((await cerrarCajero(cajero.cookie, e.negocio.slug, t1.id, "2000.00")).status).toBe(200)
    const cerrado = await db.turnoCaja.findUniqueOrThrow({ where: { id: t1.id } })
    const t2 = (await abrirCajero(cajero.cookie, e.negocio.slug)).body.turno
    const r = await cambioCajero(cajero.cookie, e.negocio.slug, original.id, { motivo: "x", salen: [{ ventaItemId: itemDe(original, e.saphirus.id), cantidad: 1, reingresaStock: true }], entran: [{ productoId: e.funda.id, cantidad: 1 }], medioDiferencia: "EFECTIVO", esperado: { salida: "2000.00", entrada: "2500.00" }, confirmo: true })
    expect(r.status).toBe(201)
    expect(r.body.cambio.advertencias.map((a: { codigo: string }) => a.codigo)).toEqual(["VENTA_DE_TURNO_CERRADO"])
    expect((await db.cambioVenta.findUniqueOrThrow({ where: { id: r.body.cambio.id } })).turnoCajaId).toBe(t2.id)
    expect(await db.turnoCaja.findUniqueOrThrow({ where: { id: t1.id } })).toEqual(cerrado)
    const op = await db.operacionFinanciera.findFirstOrThrow({ where: { cobroVenta: { ventaId: r.body.cambio.ventaNuevaId } } })
    expect(op.turnoCajaId).toBe(t2.id)
  })

  ephemeralTest("owner with two open registers: must choose the register (same rule as a sale)", async () => {
    const e = await escenario()
    const original = await ventaOwner(e, [{ productoId: e.saphirus.id, cantidad: 2 }])
    const principal = (await json(await getCajas(req("/api/negocio/caja/cajas", e.owner)))).body.cajas[0]
    const segunda = (await crearCaja(e.owner, "Segunda")).body
    expect((await abrirOwner(e.owner, { cajaFisicaId: principal.id, fondoInicial: 0 })).status).toBe(201)
    const cajero = await crearCajero(e.negocio.id)
    expect((await abrirCajero(cajero.cookie, e.negocio.slug, { cajaFisicaId: segunda.id, fondoInicial: 0 })).status).toBe(201)
    const body = { motivo: "x", salen: [{ ventaItemId: itemDe(original, e.saphirus.id), cantidad: 1, reingresaStock: true }], entran: [{ productoId: e.redmi.id, cantidad: 2 }], esperado: { salida: "2000.00", entrada: "2000.00" }, confirmo: true }
    const sinCaja = await cambioOwner(e.owner, original.id, body)
    expect([sinCaja.status, sinCaja.body.code]).toEqual([409, "CAJA_SELECCION_REQUERIDA"])
    const conCaja = await cambioOwner(e.owner, original.id, { ...body, cajaFisicaId: segunda.id })
    expect(conCaja.status).toBe(201)
    const turnoSegunda = await db.turnoCaja.findFirstOrThrow({ where: { cajaFisicaId: segunda.id, estado: "ABIERTO" } })
    expect((await db.cambioVenta.findUniqueOrThrow({ where: { id: conCaja.body.cambio.id } })).turnoCajaId).toBe(turnoSegunda.id)
  })

  ephemeralTest("permissions: no session → refused; another business's sale → 404; nothing written", async () => {
    const e = await escenario()
    const original = await ventaOwner(e, [{ productoId: e.saphirus.id, cantidad: 1 }])
    const body = { motivo: "x", salen: [{ ventaItemId: itemDe(original, e.saphirus.id), cantidad: 1, reingresaStock: true }], entran: [{ productoId: e.redmi.id, cantidad: 2 }], esperado: { salida: "2000.00", entrada: "2000.00" }, confirmo: true }
    expect((await cambioOwner("", original.id, body)).status).toBeGreaterThanOrEqual(401)
    const otro = await escenario()
    const cajeroOtro = await crearCajero(otro.negocio.id)
    expect((await cambioCajero(cajeroOtro.cookie, otro.negocio.slug, original.id, body)).status).toBe(404)
    expect((await cambioOwner(otro.owner, original.id, body)).status).toBe(404)
    expect(await db.cambioVenta.count({ where: { ventaOrigenId: original.id } })).toBe(0)
    // Missing key → 400, nothing written.
    expect((await json(await postCambioOwner(req(`/api/negocio/caja/ventas/${original.id}/cambios`, e.owner, "POST", body), idCtx(original.id)))).body.code).toBe("IDEMPOTENCY_KEY_REQUIRED")
  })

  ephemeralTest("P1 warnings are informative only: an old sale (> 30 days) is exchanged anyway", async () => {
    const e = await escenario()
    const original = await ventaOwner(e, [{ productoId: e.saphirus.id, cantidad: 1 }])
    await db.$executeRaw`UPDATE "ventas_caja" SET "createdAt" = NOW() - INTERVAL '45 days' WHERE "id" = ${original.id}`
    const r = await cambioOwner(e.owner, original.id, { motivo: "x", salen: [{ ventaItemId: itemDe(original, e.saphirus.id), cantidad: 1, reingresaStock: true }], entran: [{ productoId: e.redmi.id, cantidad: 2 }], esperado: { salida: "2000.00", entrada: "2000.00" }, confirmo: true })
    expect(r.status).toBe(201)
    expect(r.body.cambio.advertencias).toEqual([{ codigo: "VENTA_ANTIGUA", nivel: "INFO", datos: { dias: 45 }, umbral: 30 }])
    const guardado = await db.cambioVenta.findUniqueOrThrow({ where: { id: r.body.cambio.id } })
    expect(guardado.advertencias).toMatchObject({ version: 1, items: [{ codigo: "VENTA_ANTIGUA" }] })
  })
})

// ---------------------------------------------------------------------------
// H1–H3 (operator, 2026-11-09): quoted amounts, quote footprint, exact audit
// and notice counts, cashier double click, uncertain timeouts
// ---------------------------------------------------------------------------

describe("F4-C4 — H1/H3 quote → confirmation, audit and notices, uncertain results", () => {
  const salenUno = (original: { items: Array<{ id: string; productoId: string }> }, e: Escenario) => [{ ventaItemId: itemDe(original, e.saphirus.id), cantidad: 1, reingresaStock: true }]
  const auditoriasCambio = (cambioId: string) => db.auditLog.count({ where: { accion: "venta.cambio", detalle: { contains: cambioId } } })

  ephemeralTest("A — a quote (cashier, cash refund and cash difference paths) leaves NO persistent change of any kind", async () => {
    const e = await escenario()
    const cajero = await crearCajero(e.negocio.id)
    await abrirCajero(cajero.cookie, e.negocio.slug)
    const original = (await venderCajero(cajero.cookie, e.negocio.slug, { metodoPago: "EFECTIVO", items: [{ productoId: e.saphirus.id, cantidad: 2 }] })).body
    const ids = [e.saphirus.id, e.redmi.id, e.funda.id]
    const antes = await huella(e.negocio.id, ids)
    const reintegro = await cotizarCajero(cajero.cookie, e.negocio.slug, original.id, { salen: salenUno(original, e), entran: [{ productoId: e.redmi.id, cantidad: 1 }], reintegro: { modo: "REALIZADO", medio: "EFECTIVO" } })
    expect([reintegro.status, reintegro.body.cotizacion.liquidacion]).toEqual([200, "REINTEGRO"])
    const cobro = await cotizarCajero(cajero.cookie, e.negocio.slug, original.id, { salen: salenUno(original, e), entran: [{ productoId: e.funda.id, cantidad: 1 }], medioDiferencia: "EFECTIVO" })
    expect([cobro.status, cobro.body.cotizacion.liquidacion]).toEqual([200, "COBRO"])
    // sales, items, cobros, ledger operations and legs, returns, exchanges, inventory movements, notices, audits, stock
    expect(await huella(e.negocio.id, ids)).toEqual(antes)
  })

  ephemeralTest("B — a confirmation without (or with invalid) quoted amounts is refused with 400 and writes nothing", async () => {
    const e = await escenario()
    const original = await ventaOwner(e, [{ productoId: e.saphirus.id, cantidad: 1 }])
    const antes = await huella(e.negocio.id, [e.saphirus.id, e.redmi.id])
    const body = { motivo: "x", salen: salenUno(original, e), entran: [{ productoId: e.redmi.id, cantidad: 2 }], confirmo: true }
    const sin = await cambioOwner(e.owner, original.id, body)
    expect([sin.status, sin.body.code]).toEqual([400, "ESPERADO_REQUERIDO"])
    const invalido = await cambioOwner(e.owner, original.id, { ...body, esperado: { salida: "2000.001", entrada: "2000" } })
    expect([invalido.status, invalido.body.code]).toEqual([400, "ESPERADO_INVALIDO"])
    const cajero = await crearCajero(e.negocio.id)
    const sinCajero = await cambioCajero(cajero.cookie, e.negocio.slug, original.id, body)
    expect([sinCajero.status, sinCajero.body.code]).toEqual([400, "ESPERADO_REQUERIDO"])
    expect(await huella(e.negocio.id, [e.saphirus.id, e.redmi.id])).toEqual(antes)
  })

  ephemeralTest("C + D — quote, a price changes, confirm → 409 with no effect and a new quote is asked; re-quote → confirm works", async () => {
    const e = await escenario()
    const cajero = await crearCajero(e.negocio.id)
    await abrirCajero(cajero.cookie, e.negocio.slug)
    const original = (await venderCajero(cajero.cookie, e.negocio.slug, { metodoPago: "EFECTIVO", items: [{ productoId: e.saphirus.id, cantidad: 1 }] })).body
    const pedido = { salen: salenUno(original, e), entran: [{ productoId: e.funda.id, cantidad: 1 }], medioDiferencia: "EFECTIVO" }
    const cot = (await cotizarCajero(cajero.cookie, e.negocio.slug, original.id, pedido)).body.cotizacion
    expect(cot.importes).toMatchObject({ salida: "2000.00", entrada: "2500.00", diferenciaCobrada: "500.00" })
    await db.producto.update({ where: { id: e.funda.id }, data: { precio: 2600 } }) // the catalog changes after the quote
    const antes = await huella(e.negocio.id, [e.saphirus.id, e.funda.id])
    const viejo = await cambioCajero(cajero.cookie, e.negocio.slug, original.id, { ...pedido, motivo: "x", esperado: { salida: cot.importes.salida, entrada: cot.importes.entrada }, confirmo: true })
    expect([viejo.status, viejo.body.code]).toEqual([409, "IMPORTES_CAMBIARON"])
    expect(viejo.body.error).toContain("pedí una nueva cotización")
    expect(await huella(e.negocio.id, [e.saphirus.id, e.funda.id])).toEqual(antes)

    const nueva = (await cotizarCajero(cajero.cookie, e.negocio.slug, original.id, pedido)).body.cotizacion
    expect(nueva.importes).toMatchObject({ entrada: "2600.00", diferenciaCobrada: "600.00" })
    const ok = await cambioCajero(cajero.cookie, e.negocio.slug, original.id, { ...pedido, motivo: "x", esperado: { salida: nueva.importes.salida, entrada: nueva.importes.entrada }, confirmo: true })
    expect(ok.status).toBe(201)
    expect(ok.body.cambio.importes).toEqual(nueva.importes)
  })

  ephemeralTest("E — retry with the same key after a catalog price change: the original exchange, nothing re-executed", async () => {
    const e = await escenario()
    const original = await ventaOwner(e, [{ productoId: e.saphirus.id, cantidad: 1 }])
    const body = { motivo: "x", salen: salenUno(original, e), entran: [{ productoId: e.funda.id, cantidad: 1 }], medioDiferencia: "EFECTIVO", esperado: { salida: "2000.00", entrada: "2500.00" }, confirmo: true }
    const key = randomUUID()
    const first = await cambioOwner(e.owner, original.id, body, key)
    expect(first.status).toBe(201)
    await db.producto.update({ where: { id: e.funda.id }, data: { precio: 9999 } })
    const despues = await huella(e.negocio.id, [e.saphirus.id, e.funda.id])
    const again = await cambioOwner(e.owner, original.id, body, key)
    expect([again.status, again.replayed, again.body.cambio.id, again.body.cambio.importes.entrada]).toEqual([200, true, first.body.cambio.id, "2500.00"])
    expect(await huella(e.negocio.id, [e.saphirus.id, e.funda.id])).toEqual(despues)
    expect(await auditoriasCambio(first.body.cambio.id)).toBe(1)
  })

  ephemeralTest("F — exactly ONE audit per exchange; ONE owner notice for a cashier, NONE for the owner", async () => {
    const e = await escenario()
    const cajero = await crearCajero(e.negocio.id)
    await abrirCajero(cajero.cookie, e.negocio.slug)
    const deCajero = (await venderCajero(cajero.cookie, e.negocio.slug, { metodoPago: "EFECTIVO", items: [{ productoId: e.saphirus.id, cantidad: 1 }] })).body
    const c = await cambioCajero(cajero.cookie, e.negocio.slug, deCajero.id, { motivo: "x", salen: salenUno(deCajero, e), entran: [{ productoId: e.redmi.id, cantidad: 2 }], esperado: { salida: "2000.00", entrada: "2000.00" }, confirmo: true })
    expect(c.status).toBe(201)
    expect(await auditoriasCambio(c.body.cambio.id)).toBe(1)
    const avisos = await db.notificacion.findMany({ where: { negocioId: e.negocio.id } })
    expect(avisos.map((a) => [a.tipo, JSON.parse(a.datos).cambioId])).toEqual([["caja_cambio", c.body.cambio.id]])
    // the inner return of an exchange writes no separate F4-A audit
    expect(await db.auditLog.count({ where: { accion: { in: ["venta.devolucion_parcial", "venta.anulada"] }, recursoId: deCajero.id } })).toBe(0)

    const delDueno = await ventaOwner(e, [{ productoId: e.saphirus.id, cantidad: 1 }])
    const o = await cambioOwner(e.owner, delDueno.id, { motivo: "x", salen: salenUno(delDueno, e), entran: [{ productoId: e.redmi.id, cantidad: 2 }], esperado: { salida: "2000.00", entrada: "2000.00" }, confirmo: true })
    expect(o.status).toBe(201)
    expect(await auditoriasCambio(o.body.cambio.id)).toBe(1)
    expect(await db.notificacion.count({ where: { negocioId: e.negocio.id } })).toBe(1) // still only the cashier's
  })

  ephemeralTest("G — cashier double click (same key, concurrent): one exchange, one audit, one notice, one cash movement, one stock movement each way", async () => {
    const e = await escenario()
    const cajero = await crearCajero(e.negocio.id)
    await abrirCajero(cajero.cookie, e.negocio.slug)
    const original = (await venderCajero(cajero.cookie, e.negocio.slug, { metodoPago: "EFECTIVO", items: [{ productoId: e.saphirus.id, cantidad: 1 }] })).body
    const antes = await huella(e.negocio.id, [e.saphirus.id, e.funda.id])
    const body = { motivo: "x", salen: salenUno(original, e), entran: [{ productoId: e.funda.id, cantidad: 1 }], medioDiferencia: "EFECTIVO", esperado: { salida: "2000.00", entrada: "2500.00" }, confirmo: true }
    const key = randomUUID()
    const results = await Promise.all([cambioCajero(cajero.cookie, e.negocio.slug, original.id, body, key), cambioCajero(cajero.cookie, e.negocio.slug, original.id, body, key)])
    expect(results.map((r) => r.status).sort()).toEqual([200, 201])
    const despues = await huella(e.negocio.id, [e.saphirus.id, e.funda.id])
    expect({
      cambios: despues.cambios - antes.cambios,
      devoluciones: despues.devoluciones - antes.devoluciones,
      ventas: despues.ventas - antes.ventas,
      cobros: despues.cobros - antes.cobros, // credit 2000 + cash difference 500
      operaciones: despues.operaciones - antes.operaciones, // the cash difference only
      inventario: despues.inventario - antes.inventario, // one back in, one out
      avisos: despues.avisos - antes.avisos,
      auditorias: despues.auditorias - antes.auditorias,
    }).toEqual({ cambios: 1, devoluciones: 1, ventas: 1, cobros: 2, operaciones: 1, inventario: 2, avisos: 1, auditorias: 1 })
    const stocks = new Map(despues.productos.map((p) => [p.id, p.stockCantidad]))
    expect([stocks.get(e.saphirus.id), stocks.get(e.funda.id)]).toEqual([5, 9])
  })

  ephemeralTest("J — uncertain timeout: committed → the retry with the same key recovers it; not committed → the retry performs it once", async () => {
    const e = await escenario()
    const original = await ventaOwner(e, [{ productoId: e.saphirus.id, cantidad: 2 }])
    const parsed = parseCambioBody({ motivo: "x", salen: salenUno(original, e), entran: [{ productoId: e.redmi.id, cantidad: 2 }], esperado: { salida: "2000.00", entrada: "2000.00" }, confirmo: true }, "REGISTRAR")
    if (!parsed.ok) throw new Error(parsed.error)
    const timeout = new Prisma.PrismaClientKnownRequestError("Transaction already closed: a commit cannot be executed on an expired transaction", { code: "P2028", clientVersion: "test" })
    const input = (key: string) => ({ negocioId: e.negocio.id, actor: { tipo: "NEGOCIO" as const }, ventaId: original.id, solicitud: parsed.value, idempotencyKey: key })
    const ids = [e.saphirus.id, e.redmi.id]

    // (1) The transaction COMMITS but the caller only sees a timeout (simulated commit/timeout race).
    const k1 = randomUUID()
    const incierto = await registrarCambioVenta(db, input(k1), { ejecutor: async (cliente, fn, op) => { await ejecutarSerializableCambio(cliente, fn, op); throw timeout } })
    expect(incierto).toMatchObject({ ok: false, status: 503, code: "CAMBIO_RESULTADO_INCIERTO" })
    const despues1 = await huella(e.negocio.id, ids)
    expect(despues1.cambios).toBe(1)
    const recuperado = await registrarCambioVenta(db, input(k1))
    expect(recuperado.ok && recuperado.value.replayed).toBe(true)
    expect(await huella(e.negocio.id, ids)).toEqual(despues1)

    // (2) The timeout happens BEFORE any commit: nothing exists; the retry performs it exactly once.
    const k2 = randomUUID()
    const sinCommit = await registrarCambioVenta(db, input(k2), { ejecutor: async () => { throw timeout } })
    expect(sinCommit).toMatchObject({ ok: false, status: 503, code: "CAMBIO_RESULTADO_INCIERTO" })
    expect(await huella(e.negocio.id, ids)).toEqual(despues1)
    const hecho = await registrarCambioVenta(db, input(k2))
    expect(hecho.ok && hecho.value.replayed).toBe(false)
    const final = await huella(e.negocio.id, ids)
    expect([final.cambios, final.auditorias - despues1.auditorias]).toEqual([2, 1])
    const otra = await registrarCambioVenta(db, input(k2))
    expect(otra.ok && otra.value.replayed).toBe(true)
    expect(await huella(e.negocio.id, ids)).toEqual(final)
  })
})
