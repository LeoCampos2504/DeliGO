/// <reference types="bun-types" />
// ============================================
// F4-C5 (D5, option B) — verification and definitive closure of uncertain
// commercial attempts (REAL ephemeral PostgreSQL)
// ============================================
// Real owner and cashier routes + the services, against PostgreSQL with every
// migration applied (DELIGO_EPHEMERAL_TEST_DB=1). Proves the operator's
// conditions: a verification NEVER performs the operation; REGISTRADO returns
// the original; NO_REGISTRADO only after the closure committed; a late original
// is refused without writing; original vs verification → exactly one survives
// (deterministic orders with a REAL lock wait, and free races); business,
// origin, actor, key and content fingerprint are all checked; timeouts and
// double clicks are idempotent; claims are immutable. Exchanges AND linked
// additional sales. Isolated fixtures (random ids).

import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { createOperationalSession, createSession, OPERATIONAL_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/auth"
import { POST as postVentaOwner } from "@/app/api/negocio/caja/ventas/route"
import { POST as postCambioOwner } from "@/app/api/negocio/caja/ventas/[id]/cambios/route"
import { POST as postVerificarCambioOwner } from "@/app/api/negocio/caja/ventas/[id]/cambios/verificacion/route"
import { POST as postAdicionalOwner } from "@/app/api/negocio/caja/ventas/[id]/adicionales/route"
import { POST as postVerificarAdicionalOwner } from "@/app/api/negocio/caja/ventas/[id]/adicionales/verificacion/route"
import { POST as postCambioCajero } from "@/app/api/operativo/caja/[slug]/ventas/[id]/cambios/route"
import { POST as postVerificarCambioCajero } from "@/app/api/operativo/caja/[slug]/ventas/[id]/cambios/verificacion/route"
import { POST as postVerificarAdicionalCajero } from "@/app/api/operativo/caja/[slug]/ventas/[id]/adicionales/verificacion/route"
import { ejecutarSerializableCambio } from "@/lib/caja-ejecutor-cambio"
import { parseVentaCajaRequestBody } from "@/lib/caja-venta-service"
import { parseCambioBody, registrarCambioVenta, registrarVentaAdicional, verificarCambioVenta, verificarVentaAdicional } from "@/lib/caja-cambios-service"

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
const ephemeralTest = isEphemeralIntegrationDb ? test : test.skip

afterAll(async () => {
  await db.$disconnect()
})

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

async function escenario() {
  const suffix = randomUUID()
  const negocio = await db.negocio.create({
    data: { slug: `test-f4c5-${suffix}`, nombre: `Test F4-C5 ${suffix}`, usuario: `test-f4c5-${suffix}`, email: `test-f4c5-${suffix}@example.test`, password: "fixture", rubro: "negocio", aprobado: true, suspendido: false, empleadosActivos: true, salonActivo: true, cajaTurnosModo: "OPCIONAL" },
  })
  const owner = `${SESSION_COOKIE_NAME}=${await createSession(negocio.id, "negocio")}`
  const saphirus = await db.producto.create({ data: { nombre: "Saphirus", precio: 2000, negocioId: negocio.id, controlStock: true, stockCantidad: 5 } })
  const redmi = await db.producto.create({ data: { nombre: "Redmi", precio: 1000, negocioId: negocio.id, controlStock: true, stockCantidad: 10 } })
  return { negocio, owner, saphirus, redmi }
}
type Escenario = Awaited<ReturnType<typeof escenario>>

async function crearCajero(negocioId: string) {
  const nombre = `Cajero ${randomUUID().slice(0, 6)}`
  const cuenta = await db.cuentaOperativa.create({ data: { nombre, email: `test-f4c5-${randomUUID()}@example.test`, activo: true, eliminado: false } })
  const empleado = await db.empleado.create({ data: { nombre, codigo: randomUUID().slice(0, 8).toUpperCase(), negocioId, cuentaOperativaId: cuenta.id, areaOperativa: "caja", activo: true, eliminado: false } })
  return { empleado, cookie: `${OPERATIONAL_SESSION_COOKIE_NAME}=${await createOperationalSession(cuenta.id)}` }
}

const json = async (res: Response) => ({ status: res.status, replayed: res.headers.get("Idempotency-Replayed") === "true", body: await res.json() })
const req = (url: string, cookie: string, body: unknown, key?: string) =>
  new NextRequest(`http://localhost${url}`, { method: "POST", headers: { cookie, "content-type": "application/json", ...(key ? { "idempotency-key": key } : {}) }, body: JSON.stringify(body) })
const idCtx = (id: string) => ({ params: Promise.resolve({ id }) })
const slugIdCtx = (slug: string, id: string) => ({ params: Promise.resolve({ slug, id }) })

async function ventaOwner(e: Escenario, cantidad = 2) {
  const r = await json(await postVentaOwner(req("/api/negocio/caja/ventas", e.owner, { metodoPago: "EFECTIVO", items: [{ productoId: e.saphirus.id, cantidad }] }, randomUUID())))
  expect(r.status).toBe(201)
  return r.body as { id: string; items: Array<{ id: string; productoId: string }> }
}

/** Saphirus $2.000 out (back to stock) → 2 Redmi $1.000 in: same value, no money moves. */
const cuerpoCambio = (venta: { items: Array<{ id: string }> }, e: Escenario, motivo = "Prefiere otro") => ({
  motivo,
  salen: [{ ventaItemId: venta.items[0].id, cantidad: 1, reingresaStock: true }],
  entran: [{ productoId: e.redmi.id, cantidad: 2 }],
  esperado: { salida: "2000.00", entrada: "2000.00" },
  confirmo: true,
})
const cuerpoAdicional = (e: Escenario) => ({ metodoPago: "EFECTIVO", items: [{ productoId: e.redmi.id, cantidad: 1 }] })

const cambioOwner = async (e: Escenario, ventaId: string, body: unknown, key: string) => json(await postCambioOwner(req(`/api/negocio/caja/ventas/${ventaId}/cambios`, e.owner, body, key), idCtx(ventaId)))
const verificarCambioOwner = async (cookie: string, ventaId: string, body: unknown, key?: string) =>
  json(await postVerificarCambioOwner(req(`/api/negocio/caja/ventas/${ventaId}/cambios/verificacion`, cookie, body, key), idCtx(ventaId)))
const adicionalOwner = async (e: Escenario, ventaId: string, body: unknown, key: string) => json(await postAdicionalOwner(req(`/api/negocio/caja/ventas/${ventaId}/adicionales`, e.owner, body, key), idCtx(ventaId)))
const verificarAdicionalOwner = async (cookie: string, ventaId: string, body: unknown, key: string) =>
  json(await postVerificarAdicionalOwner(req(`/api/negocio/caja/ventas/${ventaId}/adicionales/verificacion`, cookie, body, key), idCtx(ventaId)))

/** Every row a commercial operation (or its verification) can write, per business. */
async function huella(e: Escenario) {
  const negocioId = e.negocio.id
  const [ventas, cobros, operaciones, devoluciones, cambios, inventario, avisos, productos, reservas, cerrados, auditorias] = await Promise.all([
    db.venta.count({ where: { negocioId } }),
    db.cobroVenta.count({ where: { negocioId } }),
    db.operacionFinanciera.count({ where: { negocioId } }),
    db.devolucionVenta.count({ where: { negocioId } }),
    db.cambioVenta.count({ where: { negocioId } }),
    db.movimientoInventario.count({ where: { negocioId } }),
    db.notificacion.count({ where: { negocioId } }),
    db.producto.findMany({ where: { negocioId }, select: { id: true, stockCantidad: true }, orderBy: { id: "asc" } }),
    db.intentoCajaComercial.count({ where: { negocioId, estado: "REGISTRADO" } }),
    db.intentoCajaComercial.count({ where: { negocioId, estado: "CERRADO" } }),
    db.auditLog.count({ where: { recurso: "venta", detalle: { contains: negocioId } } }),
  ])
  return { ventas, cobros, operaciones, devoluciones, cambios, inventario, avisos, productos, reservas, cerrados, auditorias }
}

const auditoriasCierre = (negocioId: string) => db.auditLog.count({ where: { accion: "venta.intento_comercial_cerrado", detalle: { contains: negocioId } } })

function solicitudCambio(venta: { items: Array<{ id: string }> }, e: Escenario) {
  const parsed = parseCambioBody(cuerpoCambio(venta, e), "REGISTRAR")
  if (!parsed.ok) throw new Error(parsed.error)
  return parsed.value
}
function lineasAdicional(e: Escenario) {
  const parsed = parseVentaCajaRequestBody(cuerpoAdicional(e))
  if (!parsed.ok) throw new Error(parsed.error)
  return parsed.lines
}

/** Executor that holds its FIRST attempt open after doing all its work, before committing. */
function ejecutorEnPausa() {
  let liberar!: () => void
  const pausa = new Promise<void>((resolve) => (liberar = resolve))
  let avisar!: () => void
  const listo = new Promise<void>((resolve) => (avisar = resolve))
  const ejecutor = ((cliente, fn, opciones) =>
    ejecutarSerializableCambio(cliente, async (tx, contexto) => {
      const r = await fn(tx, contexto)
      if (contexto.intento === 1) {
        avisar()
        await pausa
      }
      return r
    }, opciones)) as typeof ejecutarSerializableCambio
  return { ejecutor, listo, liberar }
}

/** Waits until some backend of this database is blocked on a lock (the unique-key wait). */
async function esperarBloqueo(timeoutMs = 6000) {
  const hasta = Date.now() + timeoutMs
  while (Date.now() < hasta) {
    const rows = await db.$queryRaw<Array<{ n: number }>>`SELECT COUNT(*)::int AS n FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'`
    if ((rows[0]?.n ?? 0) > 0) return true
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  return false
}

/** The SQL error text of a raw statement that must fail (PrismaPromise is lazy: await it here). */
async function errorSql(sql: PromiseLike<unknown>): Promise<string> {
  try {
    await sql
    return ""
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

const timeoutP2028 = () => new Prisma.PrismaClientKnownRequestError("Transaction already closed: a commit cannot be executed on an expired transaction", { code: "P2028", clientVersion: "test" })

// ---------------------------------------------------------------------------
// Exchanges
// ---------------------------------------------------------------------------

describe("F4-C5 — verification of an uncertain exchange", () => {
  ephemeralTest("REGISTRADO: the original result, and verifying writes NOTHING", async () => {
    const e = await escenario()
    const venta = await ventaOwner(e)
    const key = randomUUID()
    const creado = await cambioOwner(e, venta.id, cuerpoCambio(venta, e), key)
    expect(creado.status).toBe(201)
    expect(await db.intentoCajaComercial.findUnique({ where: { negocioId_idempotencyKey: { negocioId: e.negocio.id, idempotencyKey: key } } })).toMatchObject({ tipo: "CAMBIO", estado: "REGISTRADO", cambioVentaId: creado.body.cambio.id })
    const antes = await huella(e)
    const v = await verificarCambioOwner(e.owner, venta.id, cuerpoCambio(venta, e), key)
    expect(v.status).toBe(200)
    expect(v.body).toMatchObject({ ok: true, estado: "REGISTRADO", replayed: true, cambio: { id: creado.body.cambio.id, importes: creado.body.cambio.importes } })
    expect(v.body.ventaNueva.id).toBe(creado.body.cambio.ventaNuevaId)
    expect(await huella(e)).toEqual(antes)
  })

  ephemeralTest("NO_REGISTRADO: the key is closed (one audit), nothing commercial is written, verifying again is idempotent", async () => {
    const e = await escenario()
    const venta = await ventaOwner(e)
    const key = randomUUID()
    const antes = await huella(e)
    const v = await verificarCambioOwner(e.owner, venta.id, cuerpoCambio(venta, e), key)
    expect(v.status).toBe(200)
    expect(v.body).toMatchObject({ ok: true, estado: "NO_REGISTRADO" })
    const despues = await huella(e)
    expect(despues).toEqual({ ...antes, cerrados: antes.cerrados + 1, auditorias: antes.auditorias + 1 }) // never the operation
    expect(await auditoriasCierre(e.negocio.id)).toBe(1)
    const otra = await verificarCambioOwner(e.owner, venta.id, cuerpoCambio(venta, e), key)
    expect(otra.body).toEqual(v.body) // same closure, same date
    expect(await huella(e)).toEqual(despues)
  })

  ephemeralTest("a LATE original after the closure is refused (owner and cashier) without writing anything", async () => {
    const e = await escenario()
    const venta = await ventaOwner(e)
    const key = randomUUID()
    expect((await verificarCambioOwner(e.owner, venta.id, cuerpoCambio(venta, e), key)).body.estado).toBe("NO_REGISTRADO")
    const antes = await huella(e)
    const tarde = await cambioOwner(e, venta.id, cuerpoCambio(venta, e), key)
    expect(tarde.status).toBe(409)
    expect(tarde.body.code).toBe("INTENTO_CERRADO")
    expect(await huella(e)).toEqual(antes)

    const cajero = await crearCajero(e.negocio.id)
    const keyCajero = randomUUID()
    const vc = json(await postVerificarCambioCajero(req(`/api/operativo/caja/${e.negocio.slug}/ventas/${venta.id}/cambios/verificacion`, cajero.cookie, cuerpoCambio(venta, e), keyCajero), slugIdCtx(e.negocio.slug, venta.id)))
    expect((await vc).body.estado).toBe("NO_REGISTRADO")
    const antes2 = await huella(e)
    const tardeCajero = await json(await postCambioCajero(req(`/api/operativo/caja/${e.negocio.slug}/ventas/${venta.id}/cambios`, cajero.cookie, cuerpoCambio(venta, e), keyCajero), slugIdCtx(e.negocio.slug, venta.id)))
    expect([tardeCajero.status, tardeCajero.body.code]).toEqual([409, "INTENTO_CERRADO"])
    expect(await huella(e)).toEqual(antes2)
  })

  ephemeralTest("business, origin sale, actor, key and content are all validated", async () => {
    const e = await escenario()
    const venta = await ventaOwner(e)
    const otraVenta = await ventaOwner(e, 1)
    const key = randomUUID()
    expect((await cambioOwner(e, venta.id, cuerpoCambio(venta, e), key)).status).toBe(201)
    // other content with the same key
    const otroContenido = await verificarCambioOwner(e.owner, venta.id, cuerpoCambio(venta, e, "Otro motivo"), key)
    expect([otroContenido.status, otroContenido.body.code]).toEqual([409, "IDEMPOTENCY_KEY_REUSED"])
    // another origin sale with the same key
    const otroOrigen = await verificarCambioOwner(e.owner, otraVenta.id, cuerpoCambio(otraVenta, e), key)
    expect([otroOrigen.status, otroOrigen.body.code]).toEqual([409, "IDEMPOTENCY_KEY_REUSED"])
    // another actor (a cashier of the same business) with the same key
    const cajero = await crearCajero(e.negocio.id)
    const otroActor = await json(await postVerificarCambioCajero(req(`/api/operativo/caja/${e.negocio.slug}/ventas/${venta.id}/cambios/verificacion`, cajero.cookie, cuerpoCambio(venta, e), key), slugIdCtx(e.negocio.slug, venta.id)))
    expect([otroActor.status, otroActor.body.code]).toEqual([409, "IDEMPOTENCY_KEY_REUSED"])
    // another business: the sale does not exist there; nothing is closed
    const ajeno = await escenario()
    const k2 = randomUUID()
    const otroNegocio = await verificarCambioOwner(ajeno.owner, venta.id, cuerpoCambio(venta, e), k2)
    expect(otroNegocio.status).toBe(404)
    expect(await db.intentoCajaComercial.count({ where: { idempotencyKey: k2 } })).toBe(0)
    // a key closed for one content refuses another content (and never closes twice)
    const k3 = randomUUID()
    expect((await verificarCambioOwner(e.owner, venta.id, cuerpoCambio(venta, e), k3)).body.estado).toBe("NO_REGISTRADO")
    expect((await verificarCambioOwner(e.owner, venta.id, cuerpoCambio(venta, e, "Distinto"), k3)).body.code).toBe("IDEMPOTENCY_KEY_REUSED")
    expect((await cambioOwner(e, venta.id, cuerpoCambio(venta, e, "Distinto"), k3)).body.code).toBe("IDEMPOTENCY_KEY_REUSED")
    // a key reserved by an ADICIONAL sale is never an exchange
    const k4 = randomUUID()
    expect((await adicionalOwner(e, venta.id, cuerpoAdicional(e), k4)).status).toBe(201)
    expect((await verificarCambioOwner(e.owner, venta.id, cuerpoCambio(venta, e), k4)).body.code).toBe("IDEMPOTENCY_KEY_REUSED")
    // missing key / invalid body / missing esperado: refused, nothing closed
    expect((await verificarCambioOwner(e.owner, venta.id, cuerpoCambio(venta, e))).status).toBe(400)
    const sinEsperado = { ...cuerpoCambio(venta, e), esperado: undefined }
    const k5 = randomUUID()
    expect((await verificarCambioOwner(e.owner, venta.id, sinEsperado, k5)).body.code).toBe("ESPERADO_REQUERIDO")
    expect(await db.intentoCajaComercial.count({ where: { idempotencyKey: k5 } })).toBe(0)
  })

  ephemeralTest("RACE (original first): the verification WAITS on the key and then returns the registered exchange — never a closure", async () => {
    const e = await escenario()
    const venta = await ventaOwner(e)
    const key = randomUUID()
    const input = { negocioId: e.negocio.id, actor: { tipo: "NEGOCIO" as const }, ventaId: venta.id, solicitud: solicitudCambio(venta, e), idempotencyKey: key }
    const pausa = ejecutorEnPausa()
    const original = registrarCambioVenta(db, input, { ejecutor: pausa.ejecutor })
    await pausa.listo // the exchange and its REGISTRADO claim exist, NOT committed
    const verificacion = verificarCambioVenta(db, input)
    expect(await esperarBloqueo()).toBe(true) // the verification really waits on the shared key
    pausa.liberar()
    const [o, v] = await Promise.all([original, verificacion])
    expect(o.ok && !o.value.replayed).toBe(true)
    expect(v.ok && v.value.estado).toBe("REGISTRADO")
    if (o.ok && v.ok && v.value.estado === "REGISTRADO") expect(v.value.operacion.id).toBe(o.value.cambio.id)
    const h = await huella(e)
    expect([h.cambios, h.reservas, h.cerrados]).toEqual([1, 1, 0])
  })

  ephemeralTest("RACE (verification first): the original WAITS on the key and is refused — nothing written, one closure", async () => {
    const e = await escenario()
    const venta = await ventaOwner(e)
    const key = randomUUID()
    const input = { negocioId: e.negocio.id, actor: { tipo: "NEGOCIO" as const }, ventaId: venta.id, solicitud: solicitudCambio(venta, e), idempotencyKey: key }
    const antes = await huella(e)
    const pausa = ejecutorEnPausa()
    const verificacion = verificarCambioVenta(db, input, { ejecutor: pausa.ejecutor })
    await pausa.listo // the CERRADO claim exists, NOT committed
    const original = registrarCambioVenta(db, input)
    expect(await esperarBloqueo()).toBe(true) // the original did its work and waits on the shared key
    pausa.liberar()
    const [v, o] = await Promise.all([verificacion, original])
    expect(v.ok && v.value.estado).toBe("NO_REGISTRADO")
    expect(o).toMatchObject({ ok: false, status: 409, code: "INTENTO_CERRADO" })
    expect(await huella(e)).toEqual({ ...antes, cerrados: 1, auditorias: antes.auditorias + 1 }) // the original's return, sale, stock: all rolled back
  })

  ephemeralTest("free races (×8): original vs verification → EXACTLY one survives, and both answers agree with the database", async () => {
    for (let i = 0; i < 8; i++) {
      const e = await escenario()
      const venta = await ventaOwner(e)
      const key = randomUUID()
      const input = { negocioId: e.negocio.id, actor: { tipo: "NEGOCIO" as const }, ventaId: venta.id, solicitud: solicitudCambio(venta, e), idempotencyKey: key }
      const [o, v] = await Promise.all([registrarCambioVenta(db, input), verificarCambioVenta(db, input)])
      const h = await huella(e)
      expect(h.cambios + h.cerrados).toBe(1)
      if (h.cambios === 1) {
        expect(o.ok).toBe(true)
        expect(!v.ok || v.value.estado === "REGISTRADO").toBe(true) // never NO_REGISTRADO with a registered exchange
        expect(v.ok ? "" : (v as { code?: string }).code).not.toBe("IDEMPOTENCY_KEY_REUSED")
      } else {
        expect(o).toMatchObject({ ok: false, code: "INTENTO_CERRADO" })
        expect(v.ok && v.value.estado).toBe("NO_REGISTRADO")
        expect(await db.devolucionVenta.count({ where: { negocioId: e.negocio.id } })).toBe(0)
      }
    }
  })

  ephemeralTest("timeout of the verification itself: 503 keeps it uncertain; verifying again settles it ONCE (committed or not)", async () => {
    const e = await escenario()
    const venta = await ventaOwner(e)
    const input = (key: string) => ({ negocioId: e.negocio.id, actor: { tipo: "NEGOCIO" as const }, ventaId: venta.id, solicitud: solicitudCambio(venta, e), idempotencyKey: key })
    // (1) the closure COMMITS but the caller sees a timeout
    const k1 = randomUUID()
    const incierta = await verificarCambioVenta(db, input(k1), { ejecutor: (async (cliente, fn, op) => { await ejecutarSerializableCambio(cliente, fn, op); throw timeoutP2028() }) as typeof ejecutarSerializableCambio })
    expect(incierta).toMatchObject({ ok: false, status: 503, code: "VERIFICACION_INCIERTA" })
    const again1 = await verificarCambioVenta(db, input(k1))
    expect(again1.ok && again1.value.estado).toBe("NO_REGISTRADO")
    // (2) nothing committed
    const k2 = randomUUID()
    const sinCommit = await verificarCambioVenta(db, input(k2), { ejecutor: (async () => { throw timeoutP2028() }) as typeof ejecutarSerializableCambio })
    expect(sinCommit).toMatchObject({ ok: false, status: 503, code: "VERIFICACION_INCIERTA" })
    expect(await db.intentoCajaComercial.count({ where: { idempotencyKey: k2 } })).toBe(0)
    const again2 = await verificarCambioVenta(db, input(k2))
    expect(again2.ok && again2.value.estado).toBe("NO_REGISTRADO")
    expect(await db.intentoCajaComercial.count({ where: { negocioId: e.negocio.id, estado: "CERRADO" } })).toBe(2)
    expect(await auditoriasCierre(e.negocio.id)).toBe(2)
    expect(await db.cambioVenta.count({ where: { negocioId: e.negocio.id } })).toBe(0)
  })

  ephemeralTest("double click on «Verificar»: one closure, one audit, the same answer twice", async () => {
    const e = await escenario()
    const venta = await ventaOwner(e)
    const key = randomUUID()
    const [a, b] = await Promise.all([
      verificarCambioOwner(e.owner, venta.id, cuerpoCambio(venta, e), key),
      verificarCambioOwner(e.owner, venta.id, cuerpoCambio(venta, e), key),
    ])
    expect([a.body.estado, b.body.estado]).toEqual(["NO_REGISTRADO", "NO_REGISTRADO"])
    expect(a.body.cerradoEn).toBe(b.body.cerradoEn)
    expect(await db.intentoCajaComercial.count({ where: { idempotencyKey: key } })).toBe(1)
    expect(await auditoriasCierre(e.negocio.id)).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Linked additional sales
// ---------------------------------------------------------------------------

describe("F4-C5 — verification of an uncertain linked additional sale", () => {
  ephemeralTest("REGISTRADO returns the original sale; NO_REGISTRADO closes the key; a late original is refused without writing", async () => {
    const e = await escenario()
    const venta = await ventaOwner(e)
    const key = randomUUID()
    const creada = await adicionalOwner(e, venta.id, cuerpoAdicional(e), key)
    expect(creada.status).toBe(201)
    expect(await db.intentoCajaComercial.findUnique({ where: { negocioId_idempotencyKey: { negocioId: e.negocio.id, idempotencyKey: key } } })).toMatchObject({ tipo: "ADICIONAL", estado: "REGISTRADO", ventaId: creada.body.venta.id })
    const antes = await huella(e)
    const v = await verificarAdicionalOwner(e.owner, venta.id, cuerpoAdicional(e), key)
    expect(v.body).toMatchObject({ ok: true, estado: "REGISTRADO", venta: { id: creada.body.venta.id } })
    expect(await huella(e)).toEqual(antes)

    const k2 = randomUUID()
    const nr = await verificarAdicionalOwner(e.owner, venta.id, cuerpoAdicional(e), k2)
    expect(nr.body.estado).toBe("NO_REGISTRADO")
    const despues = await huella(e)
    expect(despues).toEqual({ ...antes, cerrados: antes.cerrados + 1, auditorias: antes.auditorias + 1 })
    const tarde = await adicionalOwner(e, venta.id, cuerpoAdicional(e), k2)
    expect([tarde.status, tarde.body.code]).toEqual([409, "INTENTO_CERRADO"])
    expect(await huella(e)).toEqual(despues)
    // different content / a normal sale's key / another actor
    expect((await verificarAdicionalOwner(e.owner, venta.id, { metodoPago: "TRANSFERENCIA", items: cuerpoAdicional(e).items }, key)).body.code).toBe("IDEMPOTENCY_KEY_REUSED")
    const kNormal = randomUUID()
    expect((await json(await postVentaOwner(req("/api/negocio/caja/ventas", e.owner, cuerpoAdicional(e), kNormal)))).status).toBe(201)
    expect((await verificarAdicionalOwner(e.owner, venta.id, cuerpoAdicional(e), kNormal)).body.code).toBe("IDEMPOTENCY_KEY_REUSED")
    const cajero = await crearCajero(e.negocio.id)
    const otroActor = await json(await postVerificarAdicionalCajero(req(`/api/operativo/caja/${e.negocio.slug}/ventas/${venta.id}/adicionales/verificacion`, cajero.cookie, cuerpoAdicional(e), key), slugIdCtx(e.negocio.slug, venta.id)))
    expect([otroActor.status, otroActor.body.code]).toEqual([409, "IDEMPOTENCY_KEY_REUSED"])
  })

  ephemeralTest("RACE (verification first): the original additional sale waits on the key and is refused — nothing written", async () => {
    const e = await escenario()
    const venta = await ventaOwner(e)
    const key = randomUUID()
    const input = { negocioId: e.negocio.id, actor: { tipo: "NEGOCIO" as const }, ventaId: venta.id, metodoPago: "EFECTIVO" as const, lines: lineasAdicional(e), idempotencyKey: key, cajaFisicaId: null }
    const antes = await huella(e)
    const pausa = ejecutorEnPausa()
    const verificacion = verificarVentaAdicional(db, input, { ejecutor: pausa.ejecutor })
    await pausa.listo
    const original = registrarVentaAdicional(db, input)
    expect(await esperarBloqueo()).toBe(true)
    pausa.liberar()
    const [v, o] = await Promise.all([verificacion, original])
    expect(v.ok && v.value.estado).toBe("NO_REGISTRADO")
    expect(o).toMatchObject({ ok: false, status: 409, code: "INTENTO_CERRADO" })
    expect(await huella(e)).toEqual({ ...antes, cerrados: 1, auditorias: antes.auditorias + 1 })
  })

  ephemeralTest("RACE (original first): the verification waits and returns the registered additional sale", async () => {
    const e = await escenario()
    const venta = await ventaOwner(e)
    const key = randomUUID()
    const input = { negocioId: e.negocio.id, actor: { tipo: "NEGOCIO" as const }, ventaId: venta.id, metodoPago: "EFECTIVO" as const, lines: lineasAdicional(e), idempotencyKey: key, cajaFisicaId: null }
    const pausa = ejecutorEnPausa()
    const original = registrarVentaAdicional(db, input, { ejecutor: pausa.ejecutor })
    await pausa.listo
    const verificacion = verificarVentaAdicional(db, input)
    expect(await esperarBloqueo()).toBe(true)
    pausa.liberar()
    const [o, v] = await Promise.all([original, verificacion])
    expect(o.ok && !o.value.replayed).toBe(true)
    expect(v.ok && v.value.estado).toBe("REGISTRADO")
    const h = await huella(e)
    expect([h.reservas, h.cerrados]).toEqual([1, 0])
  })

  ephemeralTest("free races (×8) for additional sales: exactly one survives", async () => {
    for (let i = 0; i < 8; i++) {
      const e = await escenario()
      const venta = await ventaOwner(e)
      const key = randomUUID()
      const input = { negocioId: e.negocio.id, actor: { tipo: "NEGOCIO" as const }, ventaId: venta.id, metodoPago: "EFECTIVO" as const, lines: lineasAdicional(e), idempotencyKey: key, cajaFisicaId: null }
      const [o, v] = await Promise.all([registrarVentaAdicional(db, input), verificarVentaAdicional(db, input)])
      const h = await huella(e)
      expect(h.reservas + h.cerrados).toBe(1)
      if (h.reservas === 1) {
        expect(o.ok).toBe(true)
        expect(!v.ok || v.value.estado === "REGISTRADO").toBe(true)
      } else {
        expect(o).toMatchObject({ ok: false, code: "INTENTO_CERRADO" })
        expect(v.ok && v.value.estado).toBe("NO_REGISTRADO")
        expect(h.ventas).toBe(1) // only the origin sale
      }
    }
  })
})

// ---------------------------------------------------------------------------
// SQL guarantees
// ---------------------------------------------------------------------------

describe("F4-C5 — claims in SQL", () => {
  ephemeralTest("a claim never changes, and a closure only names a sale of the same business", async () => {
    const e = await escenario()
    const venta = await ventaOwner(e)
    const key = randomUUID()
    expect((await verificarCambioOwner(e.owner, venta.id, cuerpoCambio(venta, e), key)).body.estado).toBe("NO_REGISTRADO")
    expect(await errorSql(db.$executeRaw`UPDATE "intentos_caja_comerciales" SET "estado" = 'REGISTRADO' WHERE "idempotencyKey" = ${key}`)).toMatch(/immutable/)
    const ajeno = await escenario()
    expect(
      await errorSql(db.$executeRaw`INSERT INTO "intentos_caja_comerciales" ("negocioId", "idempotencyKey", "tipo", "estado", "ventaOrigenId", "actorTipo", "actorId", "idempotencyFingerprint") VALUES (${ajeno.negocio.id}, ${randomUUID()}, 'CAMBIO', 'CERRADO', ${venta.id}, 'NEGOCIO', ${ajeno.negocio.id}, 'x')`)
    ).toMatch(/same business/)
    expect(
      await errorSql(db.$executeRaw`INSERT INTO "intentos_caja_comerciales" ("negocioId", "idempotencyKey", "tipo", "estado", "ventaOrigenId") VALUES (${e.negocio.id}, ${randomUUID()}, 'CAMBIO', 'CERRADO', ${venta.id})`)
    ).toMatch(/intentos_caja_comerciales_forma_check/)
  })

  ephemeralTest("a closed key blocks an exchange row written directly in SQL (defense independent of the service)", async () => {
    const e = await escenario()
    const venta = await ventaOwner(e)
    const key = randomUUID()
    expect((await verificarCambioOwner(e.owner, venta.id, cuerpoCambio(venta, e), key)).body.estado).toBe("NO_REGISTRADO")
    // a real exchange with ANOTHER key works; re-using the closed key for its row is refused by the shared key
    const otro = await cambioOwner(e, venta.id, cuerpoCambio(venta, e), randomUUID())
    expect(otro.status).toBe(201)
    expect(
      await errorSql(db.$executeRaw`INSERT INTO "intentos_caja_comerciales" ("negocioId", "idempotencyKey", "tipo", "estado", "ventaOrigenId", "cambioVentaId") VALUES (${e.negocio.id}, ${key}, 'CAMBIO', 'REGISTRADO', ${venta.id}, ${otro.body.cambio.id})`)
    ).toMatch(/23505/)
  })
})
