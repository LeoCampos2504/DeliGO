/// <reference types="bun-types" />

// ============================================
// F10-B2.0 — exact money dual write in the single Caja engine (REAL TESTING DB)
// ============================================
// Real routes (owner + cashier) and real PostgreSQL TESTING with migration
// 20261010120000 applied. Isolated fixtures (random ids), real sessions,
// cleanup by exact ids (including audit rows of the fixture actors). Proves:
// every money row is written to the Float AND the NUMERIC(12,2) column with
// the same cents, totals are exact sums, the owner's JSON contract is
// unchanged (no Decimal objects leaked), idempotency/replay/concurrency/R3A
// are intact, legacy Float-only rows are still read correctly.

import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { createOperationalSession, createSession, deleteSession, OPERATIONAL_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/auth"
import { GET as getVentasOwner, POST as postVentaOwner } from "@/app/api/negocio/caja/ventas/route"
import { POST as postVentaCajero } from "@/app/api/operativo/caja/[slug]/ventas/route"

setDefaultTimeout(180_000)

const testDatabaseUrl = process.env.DELIGO_TEST_DATABASE_URL
if (!testDatabaseUrl || process.env.DATABASE_URL !== testDatabaseUrl) {
  throw new Error("Este test de integración requiere DELIGO_TEST_DATABASE_URL y DATABASE_URL apuntando a la misma base TESTING.")
}

const negocios: string[] = []
const cuentas: string[] = []
const ownerTokens: string[] = []
const D = (v: string) => new Prisma.Decimal(v)

async function crearNegocio() {
  const suffix = randomUUID()
  const negocio = await db.negocio.create({
    data: {
      slug: `test-f10b20-${suffix}`,
      nombre: `Test F10-B2.0 ${suffix}`,
      usuario: `test-f10b20-${suffix}`,
      email: `test-f10b20-${suffix}@example.test`,
      password: "fixture",
      rubro: "negocio",
      aprobado: true,
      suspendido: false,
      empleadosActivos: true,
    },
  })
  negocios.push(negocio.id)
  const token = await createSession(negocio.id, "negocio")
  ownerTokens.push(token)
  return { negocio, cookie: `${SESSION_COOKIE_NAME}=${token}` }
}

async function crearCajero(negocioId: string) {
  const cuenta = await db.cuentaOperativa.create({
    data: { nombre: `Cajero B2.0 ${randomUUID()}`, email: `test-f10b20-${randomUUID()}@example.test`, activo: true, eliminado: false },
  })
  cuentas.push(cuenta.id)
  const empleado = await db.empleado.create({
    data: { nombre: "Cajero", codigo: randomUUID().slice(0, 8).toUpperCase(), negocioId, cuentaOperativaId: cuenta.id, areaOperativa: "caja", activo: true, eliminado: false },
  })
  const token = await createOperationalSession(cuenta.id)
  return { empleado, cookie: `${OPERATIONAL_SESSION_COOKIE_NAME}=${token}` }
}

async function crearProducto(negocioId: string, precio: number, opts: { controlStock?: boolean; stockCantidad?: number; variantes?: Array<{ nombre: string; precio: number }> } = {}) {
  return db.producto.create({
    data: {
      nombre: `P ${randomUUID().slice(0, 6)}`,
      precio,
      negocioId,
      controlStock: opts.controlStock ?? false,
      stockCantidad: opts.stockCantidad ?? 0,
      variantes: opts.variantes ? { create: opts.variantes.map((v) => ({ ...v, activo: true })) } : undefined,
    },
    include: { variantes: true },
  })
}

function ventaOwner(cookie: string, body: unknown, key?: string) {
  const headers: Record<string, string> = { cookie, "content-type": "application/json" }
  if (key) headers["idempotency-key"] = key
  return postVentaOwner(new NextRequest("http://localhost/api/negocio/caja/ventas", { method: "POST", headers, body: JSON.stringify(body) }))
}
function ventaCajero(cookie: string, slug: string, body: unknown, key: string) {
  return postVentaCajero(
    new NextRequest(`http://localhost/api/operativo/caja/${slug}/ventas`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json", "idempotency-key": key },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ slug }) }
  )
}

/** Every money row of a sale: Float and Decimal carry the same cents; total = Σ subtotal; cobro = total; leg = cobro. */
async function expectDualWrite(ventaId: string, expectedTotal: string) {
  const v = await db.venta.findUniqueOrThrow({ where: { id: ventaId }, include: { items: true, cobros: true } })
  expect(v.totalDecimal?.toFixed(2)).toBe(expectedTotal)
  expect(D(String(v.total)).equals(v.totalDecimal!)).toBe(true)
  const sumItems = v.items.reduce((acc, i) => acc.plus(i.subtotalDecimal!), D("0"))
  expect(sumItems.equals(v.totalDecimal!)).toBe(true)
  for (const i of v.items) expect(D(String(i.subtotal)).equals(i.subtotalDecimal!)).toBe(true)
  expect(v.cobros).toHaveLength(1)
  expect(v.cobros[0].importeDecimal!.equals(v.totalDecimal!)).toBe(true)
  expect(D(String(v.cobros[0].importe)).equals(v.cobros[0].importeDecimal!)).toBe(true)
  const op = await db.operacionFinanciera.findUnique({ where: { cobroVentaId: v.cobros[0].id }, include: { movimientos: true } })
  if (v.metodoPago === "EFECTIVO") {
    expect(op!.movimientos).toHaveLength(1)
    expect(op!.movimientos[0].importeDecimal!.equals(v.totalDecimal!)).toBe(true)
    expect(D(String(op!.movimientos[0].importe)).equals(op!.movimientos[0].importeDecimal!)).toBe(true)
  } else {
    expect(op).toBeNull()
  }
  return v
}

function noDecimalKeys(value: unknown) {
  expect(JSON.stringify(value)).not.toMatch(/Decimal"/)
}

async function counts(negocioId: string) {
  const [ventas, cobros, legs, movs] = await Promise.all([
    db.venta.count({ where: { negocioId } }),
    db.cobroVenta.count({ where: { negocioId } }),
    db.movimientoFinanciero.count({ where: { negocioId } }),
    db.movimientoInventario.count({ where: { negocioId } }),
  ])
  return { ventas, cobros, legs, movs }
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
  await db.empleado.deleteMany({ where: { negocioId: { in: negocios } } })
  await db.producto.deleteMany({ where: { negocioId: { in: negocios } } })
  await db.negocio.deleteMany({ where: { id: { in: negocios } } })
  await db.cuentaOperativa.deleteMany({ where: { id: { in: cuentas } } })
})

describe("F10-B2.0 — dual write from the owner Caja", () => {
  test("cash, cents prices (0.10 ×3 + 0.20): exact 0.50 in every Decimal column, same cents in Float, ledger leg exact", async () => {
    const { negocio, cookie } = await crearNegocio()
    const a = await crearProducto(negocio.id, 0.1, { controlStock: true, stockCantidad: 10 })
    const b = await crearProducto(negocio.id, 0.2)
    const res = await ventaOwner(cookie, { metodoPago: "EFECTIVO", items: [{ productoId: a.id, cantidad: 3 }, { productoId: b.id, cantidad: 1 }] }, randomUUID())
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.total).toBe(0.5)
    expect(body.items.map((i: { subtotal: number }) => i.subtotal).sort()).toEqual([0.2, 0.3])
    noDecimalKeys(body)
    await expectDualWrite(body.id, "0.50")
    expect((await db.producto.findUniqueOrThrow({ where: { id: a.id } })).stockCantidad).toBe(7)
  })

  test("transfer + variant: Decimal written, cobro DECLARADO, no ledger leg", async () => {
    const { negocio, cookie } = await crearNegocio()
    const p = await crearProducto(negocio.id, 1000, { variantes: [{ nombre: "1L", precio: 1999.99 }] })
    const res = await ventaOwner(cookie, { metodoPago: "TRANSFERENCIA", items: [{ productoId: p.id, varianteId: p.variantes[0].id, cantidad: 3 }] }, randomUUID())
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.total).toBe(5999.97)
    const v = await expectDualWrite(body.id, "5999.97")
    expect(v.items[0].precio).toBe(1999.99)
  })

  test("legacy client without Idempotency-Key still dual-writes", async () => {
    const { negocio, cookie } = await crearNegocio()
    const p = await crearProducto(negocio.id, 12.34)
    const res = await ventaOwner(cookie, { metodoPago: "OTRO", items: [{ productoId: p.id, cantidad: 2 }] })
    expect(res.status).toBe(201)
    await expectDualWrite((await res.json()).id, "24.68")
  })

  test("amount beyond NUMERIC(12,2) → 400, nothing written (was an unbounded Float before)", async () => {
    const { negocio, cookie } = await crearNegocio()
    const p = await crearProducto(negocio.id, 9999999999)
    const res = await ventaOwner(cookie, { metodoPago: "EFECTIVO", items: [{ productoId: p.id, cantidad: 2 }] }, randomUUID())
    expect(res.status).toBe(400)
    expect(await counts(negocio.id)).toEqual({ ventas: 0, cobros: 0, legs: 0, movs: 0 })
  })

  test("replay returns the original sale (same JSON, no Decimal keys) and writes nothing; different content → 409", async () => {
    const { negocio, cookie } = await crearNegocio()
    const p = await crearProducto(negocio.id, 0.1, { controlStock: true, stockCantidad: 10 })
    const key = randomUUID()
    const body = { metodoPago: "EFECTIVO", items: [{ productoId: p.id, cantidad: 3 }] }
    const first = await ventaOwner(cookie, body, key)
    const firstJson = await first.json()
    const before = await counts(negocio.id)
    const replay = await ventaOwner(cookie, body, key)
    expect(replay.status).toBe(200)
    expect(replay.headers.get("Idempotency-Replayed")).toBe("true")
    const replayJson = await replay.json()
    noDecimalKeys(replayJson)
    expect(replayJson).toEqual(firstJson)
    expect((await ventaOwner(cookie, { ...body, items: [{ productoId: p.id, cantidad: 4 }] }, key)).status).toBe(409)
    expect(await counts(negocio.id)).toEqual(before)
    expect((await db.producto.findUniqueOrThrow({ where: { id: p.id } })).stockCantidad).toBe(7)
  })

  test("double tap: 6 concurrent requests with one key → one sale, one cobro, one leg, one Decimal set", async () => {
    const { negocio, cookie } = await crearNegocio()
    const p = await crearProducto(negocio.id, 0.35, { controlStock: true, stockCantidad: 10 })
    const key = randomUUID()
    const body = { metodoPago: "EFECTIVO", items: [{ productoId: p.id, cantidad: 3 }] }
    const results = await Promise.all(Array.from({ length: 6 }, () => ventaOwner(cookie, body, key)))
    const statuses = results.map((r) => r.status)
    expect(statuses.filter((s) => s === 201)).toHaveLength(1)
    for (const s of statuses) expect([200, 201, 409]).toContain(s)
    expect(await counts(negocio.id)).toEqual({ ventas: 1, cobros: 1, legs: 1, movs: 1 })
    const venta = await db.venta.findFirstOrThrow({ where: { negocioId: negocio.id } })
    await expectDualWrite(venta.id, "1.05")
  })

  test("R3A: an ACTIVA reservation still blocks the reserved units (409, nothing written)", async () => {
    const { negocio, cookie } = await crearNegocio()
    const p = await crearProducto(negocio.id, 100, { controlStock: true, stockCantidad: 2 })
    const pedido = await db.pedido.create({
      data: { negocioId: negocio.id, negocioSlug: negocio.slug, negocioNombre: "N", clienteNombre: "C", metodoEntrega: "retiro", estado: "recibido", total: 100, totalProductos: 100, idempotencyKey: `test-f10b20-${randomUUID()}` },
    })
    const item = await db.pedidoItem.create({ data: { pedidoId: pedido.id, productoId: p.id, nombre: "R", precio: 100, cantidad: 2 } })
    await db.reservaStock.create({ data: { negocioId: negocio.id, pedidoId: pedido.id, pedidoItemId: item.id, productoId: p.id, cantidad: 2, estado: "ACTIVA" } })
    const res = await ventaOwner(cookie, { metodoPago: "EFECTIVO", items: [{ productoId: p.id, cantidad: 1 }] }, randomUUID())
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe("STOCK_RESERVED_FOR_ORDERS")
    expect(await counts(negocio.id)).toEqual({ ventas: 0, cobros: 0, legs: 0, movs: 0 })
    expect((await db.producto.findUniqueOrThrow({ where: { id: p.id } })).stockCantidad).toBe(2)
    expect(await db.reservaStock.count({ where: { negocioId: negocio.id, estado: "ACTIVA" } })).toBe(1)
  })
})

describe("F10-B2.0 — dual write from the cashier Caja (same engine)", () => {
  test("cash and transfer from the cashier: Decimal columns exact, actor EMPLEADO, response contract unchanged", async () => {
    const { negocio } = await crearNegocio()
    const { empleado, cookie } = await crearCajero(negocio.id)
    const p = await crearProducto(negocio.id, 0.1, { controlStock: true, stockCantidad: 10 })
    const efectivo = await ventaCajero(cookie, negocio.slug, { metodoPago: "EFECTIVO", items: [{ productoId: p.id, cantidad: 3 }] }, randomUUID())
    expect(efectivo.status).toBe(201)
    const ej = await efectivo.json()
    expect(Object.keys(ej).sort()).toEqual(["cantidadItems", "createdAt", "id", "items", "metodoPago", "total"])
    expect(ej.total).toBe(0.3)
    const v1 = await expectDualWrite(ej.id, "0.30")
    expect(v1.actorTipo).toBe("EMPLEADO")
    expect(v1.empleadoId).toBe(empleado.id)
    const transfer = await ventaCajero(cookie, negocio.slug, { metodoPago: "TRANSFERENCIA", items: [{ productoId: p.id, cantidad: 2 }] }, randomUUID())
    expect(transfer.status).toBe(201)
    await expectDualWrite((await transfer.json()).id, "0.20")
  })

  test("cashier replay is per actor (another person with the key → 409) and writes nothing", async () => {
    const { negocio, cookie: ownerCookie } = await crearNegocio()
    const { cookie } = await crearCajero(negocio.id)
    const p = await crearProducto(negocio.id, 50)
    const key = randomUUID()
    const body = { metodoPago: "EFECTIVO", items: [{ productoId: p.id, cantidad: 1 }] }
    expect((await ventaCajero(cookie, negocio.slug, body, key)).status).toBe(201)
    const before = await counts(negocio.id)
    expect((await ventaCajero(cookie, negocio.slug, body, key)).status).toBe(200)
    expect((await ventaOwner(ownerCookie, body, key)).status).toBe(409)
    expect(await counts(negocio.id)).toEqual(before)
  })
})

describe("F10-B2.0 — owner summary: exact sums, compatible JSON, legacy rows", () => {
  test("GET resumen sums exactly (0.10 + 0.20 = 0.3), lists sales without Decimal keys, and reads a legacy Float-only row", async () => {
    const { negocio, cookie } = await crearNegocio()
    const a = await crearProducto(negocio.id, 0.1)
    const b = await crearProducto(negocio.id, 0.2)
    expect((await ventaOwner(cookie, { metodoPago: "EFECTIVO", items: [{ productoId: a.id, cantidad: 1 }] }, randomUUID())).status).toBe(201)
    expect((await ventaOwner(cookie, { metodoPago: "EFECTIVO", items: [{ productoId: b.id, cantidad: 1 }] }, randomUUID())).status).toBe(201)
    // a row as a pre-F10-B2.0 deploy writes it (Float only, Decimal NULL)
    await db.venta.create({
      data: { negocioId: negocio.id, total: 0.7, metodoPago: "TRANSFERENCIA", cantidadItems: 1, items: { create: [{ productoId: a.id, nombre: "legacy", precio: 0.7, cantidad: 1, subtotal: 0.7 }] } },
    })
    const res = await getVentasOwner(new NextRequest("http://localhost/api/negocio/caja/ventas", { headers: { cookie } }))
    expect(res.status).toBe(200)
    const body = await res.json()
    noDecimalKeys(body)
    expect(body.resumenHoy).toEqual({ cantidadVentas: 3, totalVendido: 1, totalEfectivo: 0.3, totalTransferencia: 0.7, totalOtro: 0 })
    expect(body.ventasHoy).toHaveLength(3)
    for (const v of body.ventasHoy) expect(typeof v.total).toBe("number")
  })
})

describe("F10-B2.0 — idempotent backfill of rows written by the previous code", () => {
  test("fills NULL Decimals with ROUND(float, 2), never touches Floats, is idempotent, reports out-of-range rows", async () => {
    const { negocio } = await crearNegocio()
    const p = await crearProducto(negocio.id, 10.1)
    const cuenta = await db.cuentaFinanciera.create({ data: { negocioId: negocio.id, clave: "efectivo_caja_sin_asignar", tipo: "EFECTIVO", nombre: "Efectivo" } })
    // what a pre-F10-B2.0 deploy writes: Float columns only
    const legacy = await db.venta.create({
      data: {
        negocioId: negocio.id, total: 30.3, metodoPago: "EFECTIVO", cantidadItems: 1,
        items: { create: [{ productoId: p.id, nombre: "legacy", precio: 10.1, cantidad: 3, subtotal: 30.3 }] },
        cobros: { create: [{ negocioId: negocio.id, metodo: "EFECTIVO", importe: 30.3 }] },
      },
      include: { cobros: true },
    })
    await db.operacionFinanciera.create({
      data: { negocioId: negocio.id, tipo: "VENTA_COBRO", cobroVentaId: legacy.cobros[0].id, actorTipo: "NEGOCIO", actorId: negocio.id, movimientos: { create: [{ negocioId: negocio.id, cuentaId: cuenta.id, importe: 30.3 }] } },
    })
    const huge = await db.venta.create({ data: { negocioId: negocio.id, total: 2e10, metodoPago: "OTRO", cantidadItems: 0 } })

    const { reportarMoneyBackfill, ejecutarMoneyBackfill } = await import("@/lib/money-backfill")
    const report = await reportarMoneyBackfill(db, [negocio.id])
    expect(report.map((r) => [r.table, r.pendientes, r.fueraDeRango])).toEqual([
      ["ventas_caja", 1, 1],
      ["venta_items", 1, 0],
      ["cobros_venta", 1, 0],
      ["movimientos_financieros", 1, 0],
    ])
    const run = await ejecutarMoneyBackfill(db, [negocio.id])
    expect(run.map((r) => r.actualizadas)).toEqual([1, 1, 1, 1])
    await expectDualWrite(legacy.id, "30.30")
    const after = await db.venta.findUniqueOrThrow({ where: { id: legacy.id } })
    expect(after.total).toBe(30.3)
    const h = await db.venta.findUniqueOrThrow({ where: { id: huge.id } })
    expect(h.totalDecimal).toBeNull()
    expect(h.total).toBe(2e10)
    const again = await ejecutarMoneyBackfill(db, [negocio.id])
    expect(again.map((r) => r.actualizadas)).toEqual([0, 0, 0, 0])
    expect((await reportarMoneyBackfill(db, [negocio.id]))[0]).toEqual({ table: "ventas_caja", pendientes: 0, fueraDeRango: 1 })
  })
})
