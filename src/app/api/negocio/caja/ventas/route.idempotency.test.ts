/// <reference types="bun-types" />

// ============================================
// F10-B0 — Caja checkout: idempotency, actor, CobroVenta, cash ledger (REAL TESTING DB)
// ============================================
// Same convention as route.test.ts: isolated fixture businesses (random ids),
// real sessions, cleanup by exact ids. Exercises the REAL route + shared engine
// against PostgreSQL TESTING, including truly concurrent requests.

import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createSession, deleteSession, SESSION_COOKIE_NAME } from "@/lib/auth"
import { CUENTA_EFECTIVO_CAJA_SIN_ASIGNAR, registrarVentaCaja } from "@/lib/caja-venta-service"
import { POST } from "./route"

setDefaultTimeout(120_000)

const testDatabaseUrl = process.env.DELIGO_TEST_DATABASE_URL
if (!testDatabaseUrl || process.env.DATABASE_URL !== testDatabaseUrl) {
  throw new Error(
    "Este test de integración requiere DELIGO_TEST_DATABASE_URL y DATABASE_URL apuntando a la misma base TESTING."
  )
}

const createdBusinesses: string[] = []
const createdSessions: string[] = []

async function createBusiness(prefix: string) {
  const suffix = randomUUID()
  const business = await db.negocio.create({
    data: {
      slug: `${prefix}-${suffix}`,
      nombre: `${prefix} ${suffix}`,
      usuario: `${prefix}-${suffix}`,
      email: `${prefix}-${suffix}@example.test`,
      password: "fixture",
      rubro: "negocio",
      aprobado: true,
      suspendido: false,
    },
  })
  createdBusinesses.push(business.id)
  const token = await createSession(business.id, "negocio")
  createdSessions.push(token)
  return { business, cookie: `${SESSION_COOKIE_NAME}=${token}` }
}

async function createProducto(negocioId: string, overrides: Partial<{ precio: number; controlStock: boolean; stockCantidad: number }> = {}) {
  return db.producto.create({
    data: {
      nombre: `Producto ${randomUUID().slice(0, 8)}`,
      precio: overrides.precio ?? 1000,
      negocioId,
      controlStock: overrides.controlStock ?? false,
      stockCantidad: overrides.stockCantidad ?? 0,
    },
  })
}

function vender(cookie: string, body: unknown, key?: string) {
  const headers: Record<string, string> = { cookie, "content-type": "application/json" }
  if (key !== undefined) headers["idempotency-key"] = key
  return POST(new NextRequest("http://localhost/api/negocio/caja/ventas", { method: "POST", headers, body: JSON.stringify(body) }))
}

async function venderJson(cookie: string, body: unknown, key?: string) {
  const res = await vender(cookie, body, key)
  return { status: res.status, replayed: res.headers.get("Idempotency-Replayed") === "true", body: await res.json() }
}

async function counts(negocioId: string) {
  const [ventas, cobros, operaciones, movimientosFin, movimientosInv, cuentas] = await Promise.all([
    db.venta.count({ where: { negocioId } }),
    db.cobroVenta.count({ where: { negocioId } }),
    db.operacionFinanciera.count({ where: { negocioId } }),
    db.movimientoFinanciero.count({ where: { negocioId } }),
    db.movimientoInventario.count({ where: { negocioId } }),
    db.cuentaFinanciera.count({ where: { negocioId } }),
  ])
  return { ventas, cobros, operaciones, movimientosFin, movimientosInv, cuentas }
}

afterAll(async () => {
  for (const token of createdSessions) await deleteSession(token)
  await db.auditLog.deleteMany({ where: { userId: { in: createdBusinesses } } })
  await db.movimientoInventario.deleteMany({ where: { negocioId: { in: createdBusinesses } } })
  await db.operacionFinanciera.deleteMany({ where: { negocioId: { in: createdBusinesses } } })
  await db.cuentaFinanciera.deleteMany({ where: { negocioId: { in: createdBusinesses } } })
  await db.ventaItem.deleteMany({ where: { venta: { negocioId: { in: createdBusinesses } } } })
  await db.venta.deleteMany({ where: { negocioId: { in: createdBusinesses } } })
  await db.empleado.deleteMany({ where: { negocioId: { in: createdBusinesses } } })
  await db.producto.deleteMany({ where: { negocioId: { in: createdBusinesses } } })
  await db.negocio.deleteMany({ where: { id: { in: createdBusinesses } } })
})

describe("F10-B0 — sale, cobro and cash ledger", () => {
  test("A: first attempt (cash, controlled stock): 1 venta, 1 cobro, 1 operation + 1 leg, stock and VENTA movement once; actor from session", async () => {
    const { business, cookie } = await createBusiness("test-f10b0-a")
    const producto = await createProducto(business.id, { precio: 1500, controlStock: true, stockCantidad: 5 })
    const key = randomUUID()
    // the body tries to impersonate an employee/actor and a price: all ignored
    const res = await venderJson(cookie, { metodoPago: "EFECTIVO", items: [{ productoId: producto.id, cantidad: 2 }], empleadoId: "x", actorTipo: "EMPLEADO", total: 1 }, key)
    expect(res.status).toBe(201)
    expect(res.replayed).toBe(false)
    expect(res.body.total).toBe(3000)
    const venta = await db.venta.findUniqueOrThrow({ where: { id: res.body.id }, include: { cobros: true } })
    expect(venta.actorTipo).toBe("NEGOCIO")
    expect(venta.actorId).toBe(business.id)
    expect(venta.empleadoId).toBeNull()
    expect(venta.idempotencyKey).toBe(key)
    expect(venta.idempotencyFingerprint).toMatch(/^[0-9a-f]{64}$/)
    expect(venta.cobros).toHaveLength(1)
    expect(venta.cobros[0]).toMatchObject({ metodo: "EFECTIVO", importe: 3000, estadoConciliacion: "NO_APLICA" })
    const op = await db.operacionFinanciera.findUniqueOrThrow({ where: { cobroVentaId: venta.cobros[0].id }, include: { movimientos: { include: { cuenta: true } } } })
    expect(op).toMatchObject({ tipo: "VENTA_COBRO", actorTipo: "NEGOCIO", actorId: business.id, negocioId: business.id })
    expect(op.movimientos).toHaveLength(1)
    expect(op.movimientos[0]).toMatchObject({ importe: 3000, estado: "CONFIRMADO", negocioId: business.id })
    expect(op.movimientos[0].cuenta).toMatchObject({ clave: CUENTA_EFECTIVO_CAJA_SIN_ASIGNAR, tipo: "EFECTIVO", negocioId: business.id })
    expect((await db.producto.findUniqueOrThrow({ where: { id: producto.id } })).stockCantidad).toBe(3)
    expect(await counts(business.id)).toEqual({ ventas: 1, cobros: 1, operaciones: 1, movimientosFin: 1, movimientosInv: 1, cuentas: 1 })
  })

  test("B/E: same key + same content (lost response, retry) → original sale replayed (200), nothing written again", async () => {
    const { business, cookie } = await createBusiness("test-f10b0-b")
    const producto = await createProducto(business.id, { precio: 700, controlStock: true, stockCantidad: 10 })
    const key = randomUUID()
    const body = { metodoPago: "EFECTIVO", items: [{ productoId: producto.id, cantidad: 3 }] }
    const first = await venderJson(cookie, body, key)
    expect(first.status).toBe(201)
    const before = await counts(business.id)
    const retry = await venderJson(cookie, body, key)
    expect(retry.status).toBe(200)
    expect(retry.replayed).toBe(true)
    expect(retry.body.id).toBe(first.body.id)
    expect(retry.body.total).toBe(first.body.total)
    expect(await counts(business.id)).toEqual(before)
    expect((await db.producto.findUniqueOrThrow({ where: { id: producto.id } })).stockCantidad).toBe(7)
    // same key, lines reordered → same canonical content → replay as well
    const other = await createProducto(business.id, { precio: 100 })
    const key2 = randomUUID()
    const a = await venderJson(cookie, { metodoPago: "EFECTIVO", items: [{ productoId: producto.id, cantidad: 1 }, { productoId: other.id, cantidad: 2 }] }, key2)
    const b = await venderJson(cookie, { metodoPago: "EFECTIVO", items: [{ productoId: other.id, cantidad: 2 }, { productoId: producto.id, cantidad: 1 }] }, key2)
    expect(a.status).toBe(201)
    expect(b.status).toBe(200)
    expect(b.body.id).toBe(a.body.id)
  })

  test("C: same key + different content → 409 IDEMPOTENCY_KEY_REUSED, nothing new written", async () => {
    const { business, cookie } = await createBusiness("test-f10b0-c")
    const producto = await createProducto(business.id, { precio: 500 })
    const key = randomUUID()
    expect((await venderJson(cookie, { metodoPago: "EFECTIVO", items: [{ productoId: producto.id, cantidad: 1 }] }, key)).status).toBe(201)
    const before = await counts(business.id)
    const reused = await venderJson(cookie, { metodoPago: "EFECTIVO", items: [{ productoId: producto.id, cantidad: 2 }] }, key)
    expect(reused.status).toBe(409)
    expect(reused.body.code).toBe("IDEMPOTENCY_KEY_REUSED")
    const otherMethod = await venderJson(cookie, { metodoPago: "TRANSFERENCIA", items: [{ productoId: producto.id, cantidad: 1 }] }, key)
    expect(otherMethod.status).toBe(409)
    expect(await counts(business.id)).toEqual(before)
  })

  test("D: double tap — 6 truly concurrent requests with one key → exactly one sale, one cobro, one ledger leg, stock once", async () => {
    const { business, cookie } = await createBusiness("test-f10b0-d")
    const producto = await createProducto(business.id, { precio: 1200, controlStock: true, stockCantidad: 20 })
    const key = randomUUID()
    const body = { metodoPago: "EFECTIVO", items: [{ productoId: producto.id, cantidad: 2 }] }
    const results = await Promise.all(Array.from({ length: 6 }, () => venderJson(cookie, body, key)))
    const statuses = results.map((r) => r.status)
    console.log("[F10-B0 double tap] statuses:", JSON.stringify(statuses))
    expect(statuses.filter((s) => s === 201)).toHaveLength(1)
    expect(statuses.every((s) => s === 201 || s === 200)).toBe(true)
    expect(new Set(results.map((r) => r.body.id)).size).toBe(1)
    expect(await counts(business.id)).toEqual({ ventas: 1, cobros: 1, operaciones: 1, movimientosFin: 1, movimientosInv: 1, cuentas: 1 })
    expect((await db.producto.findUniqueOrThrow({ where: { id: producto.id } })).stockCantidad).toBe(18)
  })

  test("F: failure before commit (stock 409) → no venta/cobro/ledger/movement; the key is not burned and the same attempt succeeds later", async () => {
    const { business, cookie } = await createBusiness("test-f10b0-f")
    const producto = await createProducto(business.id, { precio: 900, controlStock: true, stockCantidad: 1 })
    const key = randomUUID()
    const body = { metodoPago: "EFECTIVO", items: [{ productoId: producto.id, cantidad: 3 }] }
    const failed = await venderJson(cookie, body, key)
    expect(failed.status).toBe(409)
    const after = await counts(business.id)
    expect({ ventas: after.ventas, cobros: after.cobros, operaciones: after.operaciones, movimientosFin: after.movimientosFin, movimientosInv: after.movimientosInv }).toEqual({ ventas: 0, cobros: 0, operaciones: 0, movimientosFin: 0, movimientosInv: 0 })
    expect((await db.producto.findUniqueOrThrow({ where: { id: producto.id } })).stockCantidad).toBe(1)
    await db.producto.update({ where: { id: producto.id }, data: { stockCantidad: 5 } }) // fixture restock
    const ok = await venderJson(cookie, body, key)
    expect(ok.status).toBe(201)
  })

  test("transfer and OTRO: cobro recorded (transfer DECLARADO, never verified), NO ledger movement, NO Mercado Pago account", async () => {
    const { business, cookie } = await createBusiness("test-f10b0-t")
    const producto = await createProducto(business.id, { precio: 15000 })
    const t = await venderJson(cookie, { metodoPago: "TRANSFERENCIA", items: [{ productoId: producto.id, cantidad: 1 }] }, randomUUID())
    const o = await venderJson(cookie, { metodoPago: "OTRO", items: [{ productoId: producto.id, cantidad: 1 }] }, randomUUID())
    expect([t.status, o.status]).toEqual([201, 201])
    const cobros = await db.cobroVenta.findMany({ where: { negocioId: business.id }, orderBy: { createdAt: "asc" } })
    expect(cobros.map((c) => [c.metodo, c.estadoConciliacion, c.importe])).toEqual([["TRANSFERENCIA", "DECLARADO", 15000], ["OTRO", "NO_APLICA", 15000]])
    expect(await db.operacionFinanciera.count({ where: { negocioId: business.id } })).toBe(0)
    expect(await db.cuentaFinanciera.count({ where: { negocioId: business.id } })).toBe(0)
  })

  test("uncontrolled product + variant: no inventory movement for uncontrolled lines; cash still recorded once", async () => {
    const { business, cookie } = await createBusiness("test-f10b0-v")
    const libre = await createProducto(business.id, { precio: 300 })
    const conVariantes = await createProducto(business.id, { precio: 1 })
    const variante = await db.productoVariante.create({ data: { productoId: conVariantes.id, nombre: "Grande", precio: 800, controlStock: true, stockCantidad: 4 } })
    const res = await venderJson(cookie, { metodoPago: "EFECTIVO", items: [{ productoId: libre.id, cantidad: 2 }, { productoId: conVariantes.id, varianteId: variante.id, cantidad: 1 }] }, randomUUID())
    expect(res.status).toBe(201)
    expect(res.body.total).toBe(1400)
    const movs = await db.movimientoInventario.findMany({ where: { negocioId: business.id } })
    expect(movs).toHaveLength(1)
    expect(movs[0].productoVarianteId).toBe(variante.id)
    const legs = await db.movimientoFinanciero.findMany({ where: { negocioId: business.id } })
    expect(legs.map((l) => l.importe)).toEqual([1400])
  })

  test("legacy client without Idempotency-Key: still works (no key stored); a malformed key is rejected with 400", async () => {
    const { business, cookie } = await createBusiness("test-f10b0-l")
    const producto = await createProducto(business.id, { precio: 250 })
    const legacy = await venderJson(cookie, { metodoPago: "EFECTIVO", items: [{ productoId: producto.id, cantidad: 1 }] })
    expect(legacy.status).toBe(201)
    const venta = await db.venta.findUniqueOrThrow({ where: { id: legacy.body.id }, include: { cobros: true } })
    expect(venta.idempotencyKey).toBeNull()
    expect(venta.cobros).toHaveLength(1)
    const bad = await venderJson(cookie, { metodoPago: "EFECTIVO", items: [{ productoId: producto.id, cantidad: 1 }] }, "not-a-uuid")
    expect(bad.status).toBe(400)
    expect(await db.venta.count({ where: { negocioId: business.id } })).toBe(1)
  })

  test("tenant isolation: the same key in two businesses creates two independent sales; cash accounts never shared", async () => {
    const a = await createBusiness("test-f10b0-ta")
    const b = await createBusiness("test-f10b0-tb")
    const pa = await createProducto(a.business.id, { precio: 100 })
    const pb = await createProducto(b.business.id, { precio: 100 })
    const key = randomUUID()
    const ra = await venderJson(a.cookie, { metodoPago: "EFECTIVO", items: [{ productoId: pa.id, cantidad: 1 }] }, key)
    const rb = await venderJson(b.cookie, { metodoPago: "EFECTIVO", items: [{ productoId: pb.id, cantidad: 1 }] }, key)
    expect([ra.status, rb.status]).toEqual([201, 201])
    expect(ra.body.id).not.toBe(rb.body.id)
    // business A cannot sell business B's product even with a valid key
    const cross = await venderJson(a.cookie, { metodoPago: "EFECTIVO", items: [{ productoId: pb.id, cantidad: 1 }] }, randomUUID())
    expect(cross.status).toBe(400)
    const cuentas = await db.cuentaFinanciera.findMany({ where: { negocioId: { in: [a.business.id, b.business.id] } } })
    expect(cuentas).toHaveLength(2)
    const legs = await db.movimientoFinanciero.findMany({ where: { negocioId: a.business.id }, include: { cuenta: true } })
    expect(legs.every((l) => l.cuenta.negocioId === a.business.id)).toBe(true)
  })

  test("engine rejects an arbitrary EMPLEADO actor from another business (defense for F10-B1)", async () => {
    const a = await createBusiness("test-f10b0-ea")
    const b = await createBusiness("test-f10b0-eb")
    const ajeno = await db.empleado.create({ data: { nombre: "Ajeno", codigo: `E${randomUUID().slice(0, 6)}`, negocioId: b.business.id } })
    const producto = await createProducto(a.business.id, { precio: 100 })
    const result = await registrarVentaCaja(db, { negocioId: a.business.id, actor: { tipo: "EMPLEADO", empleadoId: ajeno.id }, metodoPago: "EFECTIVO", lines: [{ productoId: producto.id, cantidad: 1 }], idempotencyKey: randomUUID() })
    expect(result).toMatchObject({ ok: false, status: 403 })
    expect(await db.venta.count({ where: { negocioId: a.business.id } })).toBe(0)
  })

  test("a sale with financial records cannot be silently deleted on its own (NO ACTION FK)", async () => {
    const { business, cookie } = await createBusiness("test-f10b0-fk")
    const producto = await createProducto(business.id, { precio: 100 })
    const res = await venderJson(cookie, { metodoPago: "EFECTIVO", items: [{ productoId: producto.id, cantidad: 1 }] }, randomUUID())
    await db.ventaItem.deleteMany({ where: { ventaId: res.body.id } })
    let deleted = true
    try {
      await db.venta.delete({ where: { id: res.body.id } })
    } catch {
      deleted = false
    }
    expect(deleted).toBe(false)
    expect(await db.venta.count({ where: { id: res.body.id } })).toBe(1)
  })
})
