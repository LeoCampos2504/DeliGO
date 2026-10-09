/// <reference types="bun-types" />

// ============================================
// F10-B1 — Cajero en DeliGO Operaciones (REAL TESTING DB)
// ============================================
// Real routes + real PostgreSQL TESTING, no Prisma mocks. Isolated fixtures
// (random ids/slugs), real personal operational sessions, cleanup by exact ids.
// Covers: authorization matrix of GET productos / POST ventas, slug/tenant
// manipulation, sale through the single F10-B0 engine with actor EMPLEADO,
// required Idempotency-Key (replay, conflict, concurrency, cross-actor reuse),
// stock + R3A ACTIVA reservations, catalog without cost/discounts, blind-close
// information access (the operational cookie never opens owner routes), and the
// owner-side rule that only generic businesses can assign área "caja".

import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import {
  createOperationalSession,
  createSession,
  deleteSession,
  OPERATIONAL_SESSION_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from "@/lib/auth"
import { GET as getProductosCaja } from "@/app/api/operativo/caja/[slug]/productos/route"
import { POST as postVentaCaja } from "@/app/api/operativo/caja/[slug]/ventas/route"
import { GET as getVentasOwner, POST as postVentaOwner } from "@/app/api/negocio/caja/ventas/route"
import { GET as getProductosOwner } from "@/app/api/negocio/productos/route"
import { GET as getMovimientosOwner } from "@/app/api/negocio/inventario/movimientos/route"
import { POST as postEmpleado } from "@/app/api/negocio/empleados/route"
import { PUT as putEmpleado } from "@/app/api/negocio/empleados/[id]/route"
import { GET as getOperativoMe } from "@/app/api/operativo/me/route"

setDefaultTimeout(180_000)

const testDatabaseUrl = process.env.DELIGO_TEST_DATABASE_URL
if (!testDatabaseUrl || process.env.DATABASE_URL !== testDatabaseUrl) {
  throw new Error(
    "Este test de integración requiere DELIGO_TEST_DATABASE_URL y DATABASE_URL apuntando a la misma base TESTING."
  )
}

type Rubro = "negocio" | "restaurante" | "ropa"
type Negocio = { id: string; slug: string }

const negocios: string[] = []
const cuentas: string[] = []
const ownerTokens: string[] = []

async function crearNegocio(
  overrides: Partial<{ rubro: Rubro; aprobado: boolean; suspendido: boolean; empleadosActivos: boolean; salonActivo: boolean }> = {}
): Promise<Negocio> {
  const suffix = randomUUID()
  const negocio = await db.negocio.create({
    data: {
      slug: `test-f10b1-${suffix}`,
      nombre: `Test F10-B1 ${suffix}`,
      usuario: `test-f10b1-${suffix}`,
      email: `test-f10b1-${suffix}@example.test`,
      password: "fixture",
      rubro: overrides.rubro ?? "negocio",
      aprobado: overrides.aprobado ?? true,
      suspendido: overrides.suspendido ?? false,
      empleadosActivos: overrides.empleadosActivos ?? true,
      salonActivo: overrides.salonActivo ?? false,
    },
  })
  negocios.push(negocio.id)
  return { id: negocio.id, slug: negocio.slug }
}

async function ownerCookie(negocioId: string) {
  const token = await createSession(negocioId, "negocio")
  ownerTokens.push(token)
  return `${SESSION_COOKIE_NAME}=${token}`
}

/** CuentaOperativa + Empleado (raw fixture: lets us build states the owner UI would refuse). */
async function crearEmpleado(
  negocioId: string,
  areaOperativa: string,
  overrides: Partial<{ activo: boolean; eliminado: boolean; cuentaOperativaId: string }> = {}
) {
  let cuentaOperativaId = overrides.cuentaOperativaId
  if (!cuentaOperativaId) {
    const cuenta = await db.cuentaOperativa.create({
      data: { nombre: `Cajero F10-B1 ${randomUUID()}`, email: `test-f10b1-${randomUUID()}@example.test`, activo: true, eliminado: false },
    })
    cuentas.push(cuenta.id)
    cuentaOperativaId = cuenta.id
  }
  const empleado = await db.empleado.create({
    data: {
      nombre: `Cajero ${randomUUID().slice(0, 8)}`,
      codigo: randomUUID().slice(0, 8).toUpperCase(),
      negocioId,
      cuentaOperativaId,
      areaOperativa,
      activo: overrides.activo ?? true,
      eliminado: overrides.eliminado ?? false,
    },
  })
  return { empleado, cuentaOperativaId }
}

async function sesionOperativa(cuentaOperativaId: string) {
  const token = await createOperationalSession(cuentaOperativaId)
  return `${OPERATIONAL_SESSION_COOKIE_NAME}=${token}`
}

async function cajero(negocioId: string, areaOperativa = "caja", overrides: Parameters<typeof crearEmpleado>[2] = {}) {
  const { empleado, cuentaOperativaId } = await crearEmpleado(negocioId, areaOperativa, overrides)
  return { empleado, cuentaOperativaId, cookie: await sesionOperativa(cuentaOperativaId) }
}

async function crearProducto(
  negocioId: string,
  overrides: Partial<{ precio: number; controlStock: boolean; stockCantidad: number; costo: number; descuentoActivo: boolean; valorDescuento: number }> = {}
) {
  return db.producto.create({
    data: {
      nombre: `Producto ${randomUUID().slice(0, 8)}`,
      precio: overrides.precio ?? 1000,
      negocioId,
      controlStock: overrides.controlStock ?? false,
      stockCantidad: overrides.stockCantidad ?? 0,
      costo: overrides.costo ?? null,
      descuentoActivo: overrides.descuentoActivo ?? false,
      valorDescuento: overrides.valorDescuento ?? 0,
    },
  })
}

/** An ACTIVA R3A reservation of `cantidad` units of `productoId` for a pending order. */
async function reservar(negocio: Negocio, productoId: string, cantidad: number) {
  const pedido = await db.pedido.create({
    data: {
      negocioId: negocio.id,
      negocioSlug: negocio.slug,
      negocioNombre: "Negocio F10-B1",
      clienteNombre: "Cliente F10-B1",
      metodoEntrega: "retiro",
      estado: "recibido",
      total: 100,
      totalProductos: 100,
      idempotencyKey: `test-f10b1-${randomUUID()}`,
    },
  })
  const item = await db.pedidoItem.create({ data: { pedidoId: pedido.id, productoId, nombre: "Reservado", precio: 100, cantidad } })
  await db.reservaStock.create({
    data: { negocioId: negocio.id, pedidoId: pedido.id, pedidoItemId: item.id, productoId, cantidad, estado: "ACTIVA" },
  })
}

const ctx = (slug: string) => ({ params: Promise.resolve({ slug }) })

async function productosCaja(cookie: string | null, slug: string) {
  const headers: Record<string, string> = cookie ? { cookie } : {}
  const res = await getProductosCaja(new NextRequest(`http://localhost/api/operativo/caja/${slug}/productos`, { headers }), ctx(slug))
  return { status: res.status, cacheControl: res.headers.get("cache-control"), body: await res.json() }
}

async function vender(cookie: string | null, slug: string, body: unknown, key?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" }
  if (cookie) headers.cookie = cookie
  if (key !== undefined) headers["idempotency-key"] = key
  const res = await postVentaCaja(
    new NextRequest(`http://localhost/api/operativo/caja/${slug}/ventas`, { method: "POST", headers, body: JSON.stringify(body) }),
    ctx(slug)
  )
  return { status: res.status, replayed: res.headers.get("Idempotency-Replayed") === "true", body: await res.json() }
}

async function counts(negocioId: string) {
  const [ventas, cobros, operaciones, movimientosFin, movimientosInv] = await Promise.all([
    db.venta.count({ where: { negocioId } }),
    db.cobroVenta.count({ where: { negocioId } }),
    db.operacionFinanciera.count({ where: { negocioId } }),
    db.movimientoFinanciero.count({ where: { negocioId } }),
    db.movimientoInventario.count({ where: { negocioId } }),
  ])
  return { ventas, cobros, operaciones, movimientosFin, movimientosInv }
}

const stockDe = async (productoId: string) => (await db.producto.findUniqueOrThrow({ where: { id: productoId } })).stockCantidad

afterAll(async () => {
  for (const token of ownerTokens) await deleteSession(token)
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

// ---------------------------------------------------------------------------

describe("F10-B1 — authorization (server-side, personal session + área caja)", () => {
  let negocio: Negocio
  let productoId: string
  beforeAll(async () => {
    negocio = await crearNegocio()
    productoId = (await crearProducto(negocio.id)).id
  })
  const venta = () => ({ metodoPago: "EFECTIVO", items: [{ productoId, cantidad: 1 }] })

  test("no session → 401 sin_sesion on both routes; nothing written", async () => {
    expect((await productosCaja(null, negocio.slug)).status).toBe(401)
    const res = await vender(null, negocio.slug, venta(), randomUUID())
    expect(res.status).toBe(401)
    expect(res.body.estado).toBe("sin_sesion")
    expect((await counts(negocio.id)).ventas).toBe(0)
  })

  test("owner (negocio) session is NOT a cashier session → 401 on the operativo routes", async () => {
    const cookie = await ownerCookie(negocio.id)
    expect((await productosCaja(cookie, negocio.slug)).status).toBe(401)
    expect((await vender(cookie, negocio.slug, venta(), randomUUID())).status).toBe(401)
  })

  test("employees with other areas (mozo/salon/pyr/sin_asignar) → 403 area_no_habilitada", async () => {
    const conSalon = await crearNegocio({ salonActivo: true })
    const prod = await crearProducto(conSalon.id)
    for (const area of ["mozo", "salon", "pyr", "sin_asignar"]) {
      const { cookie } = await cajero(conSalon.id, area)
      const cat = await productosCaja(cookie, conSalon.slug)
      expect(cat.status).toBe(403)
      expect(cat.body.estado).toBe("area_no_habilitada")
      const res = await vender(cookie, conSalon.slug, { metodoPago: "EFECTIVO", items: [{ productoId: prod.id, cantidad: 1 }] }, randomUUID())
      expect(res.status).toBe(403)
    }
    expect((await counts(conSalon.id)).ventas).toBe(0)
  })

  test("inactive or deleted cashier → 403 acceso_no_disponible", async () => {
    for (const overrides of [{ activo: false }, { eliminado: true }]) {
      const { cookie } = await cajero(negocio.id, "caja", overrides)
      const res = await vender(cookie, negocio.slug, venta(), randomUUID())
      expect(res.status).toBe(403)
      expect(res.body.estado).toBe("acceso_no_disponible")
      expect((await productosCaja(cookie, negocio.slug)).status).toBe(403)
    }
    expect((await counts(negocio.id)).ventas).toBe(0)
  })

  test("business suspended / not approved / employees disabled → 403", async () => {
    for (const overrides of [{ suspendido: true }, { aprobado: false }, { empleadosActivos: false }]) {
      const n = await crearNegocio(overrides)
      const prod = await crearProducto(n.id)
      const { cookie } = await cajero(n.id)
      expect((await productosCaja(cookie, n.slug)).status).toBe(403)
      expect((await vender(cookie, n.slug, { metodoPago: "EFECTIVO", items: [{ productoId: prod.id, cantidad: 1 }] }, randomUUID())).status).toBe(403)
      expect((await counts(n.id)).ventas).toBe(0)
    }
  })

  test("restaurante / ropa: área caja never works even if present in the data (rubro gate)", async () => {
    for (const rubro of ["restaurante", "ropa"] as const) {
      const n = await crearNegocio({ rubro, salonActivo: true })
      const prod = await crearProducto(n.id)
      const { cookie } = await cajero(n.id, "caja")
      const cat = await productosCaja(cookie, n.slug)
      expect(cat.status).toBe(403)
      expect(cat.body.estado).toBe("acceso_no_disponible")
      expect((await vender(cookie, n.slug, { metodoPago: "EFECTIVO", items: [{ productoId: prod.id, cantidad: 1 }] }, randomUUID())).status).toBe(403)
      expect((await counts(n.id)).ventas).toBe(0)
    }
  })

  test("slug manipulation: a cashier of A cannot read or sell in B (another business), even with B's product ids", async () => {
    const a = await cajero(negocio.id)
    const otro = await crearNegocio()
    const prodB = await crearProducto(otro.id, { controlStock: true, stockCantidad: 5 })
    expect((await productosCaja(a.cookie, otro.slug)).status).toBe(403)
    const res = await vender(a.cookie, otro.slug, { metodoPago: "EFECTIVO", items: [{ productoId: prodB.id, cantidad: 1 }] }, randomUUID())
    expect(res.status).toBe(403)
    expect(await counts(otro.id)).toEqual({ ventas: 0, cobros: 0, operaciones: 0, movimientosFin: 0, movimientosInv: 0 })
    expect(await stockDe(prodB.id)).toBe(5)
    // own slug + another business's product id → rejected by the engine, nothing written anywhere
    const cross = await vender(a.cookie, negocio.slug, { metodoPago: "EFECTIVO", items: [{ productoId: prodB.id, cantidad: 1 }] }, randomUUID())
    expect(cross.status).toBeGreaterThanOrEqual(400)
    expect(cross.status).toBeLessThan(500)
    expect((await counts(otro.id)).ventas).toBe(0)
    expect(await stockDe(prodB.id)).toBe(5)
  })

  test("unknown slug → 403 (no existence oracle beyond the employee's own links)", async () => {
    const { cookie } = await cajero(negocio.id)
    expect((await productosCaja(cookie, `no-existe-${randomUUID()}`)).status).toBe(403)
  })

  test("/api/operativo/me exposes área caja only for the generic business", async () => {
    const { cookie, cuentaOperativaId } = await cajero(negocio.id)
    const resto = await crearNegocio({ rubro: "restaurante" })
    await crearEmpleado(resto.id, "caja", { cuentaOperativaId })
    const res = await getOperativoMe(new NextRequest("http://localhost/api/operativo/me", { headers: { cookie } }))
    const body = await res.json()
    const vinculos = (body.vinculos ?? body.negocios ?? []) as Array<{ negocio: { slug: string }; empleado: { areaOperativaEfectiva?: string } }>
    const propio = vinculos.find((v) => v.negocio.slug === negocio.slug)
    expect(propio?.empleado.areaOperativaEfectiva).toBe("caja")
    const ajeno = vinculos.find((v) => v.negocio.slug === resto.slug)
    expect(ajeno?.empleado.areaOperativaEfectiva).not.toBe("caja")
  })
})

// ---------------------------------------------------------------------------

describe("F10-B1 — cashier catalog", () => {
  test("selling fields only (no costo / discounts), availability = físico − ACTIVA, only this business, no-store", async () => {
    const negocio = await crearNegocio()
    const otro = await crearNegocio()
    const controlado = await crearProducto(negocio.id, { precio: 2500, controlStock: true, stockCantidad: 10, costo: 1200, descuentoActivo: true, valorDescuento: 10 })
    const libre = await crearProducto(negocio.id, { precio: 800 })
    const eliminado = await crearProducto(negocio.id)
    await db.producto.update({ where: { id: eliminado.id }, data: { eliminado: true } })
    const ajeno = await crearProducto(otro.id)
    await reservar(negocio, controlado.id, 3)
    const { cookie, empleado } = await cajero(negocio.id)

    const res = await productosCaja(cookie, negocio.slug)
    expect(res.status).toBe(200)
    expect(res.cacheControl ?? "").toContain("no-store")
    expect(res.body.empleado).toEqual({ id: empleado.id, nombre: empleado.nombre })
    expect(res.body.negocio.id).toBe(negocio.id)
    const ids = (res.body.productos as Array<{ id: string }>).map((p) => p.id)
    expect(ids).toContain(controlado.id)
    expect(ids).toContain(libre.id)
    expect(ids).not.toContain(eliminado.id)
    expect(ids).not.toContain(ajeno.id)
    const c = (res.body.productos as Array<Record<string, unknown>>).find((p) => p.id === controlado.id)!
    expect(c.precio).toBe(2500)
    expect(c.stockDisponible).toBe(7)
    for (const forbidden of ["costo", "descuentoActivo", "tipoDescuento", "valorDescuento", "negocioId"]) {
      expect(forbidden in c).toBe(false)
    }
    expect(JSON.stringify(res.body)).not.toContain("1200")
  })
})

// ---------------------------------------------------------------------------

describe("F10-B1 — cashier sale through the single F10-B0 engine", () => {
  test("cash sale: 201, actor EMPLEADO + empleadoId from the session, no turno, server prices, cobro + ledger once, stock once", async () => {
    const negocio = await crearNegocio()
    const producto = await crearProducto(negocio.id, { precio: 1500, controlStock: true, stockCantidad: 5 })
    const { cookie, empleado } = await cajero(negocio.id)
    const key = randomUUID()
    // the body tries to choose business, employee, actor, price and total: all ignored
    const res = await vender(
      cookie,
      negocio.slug,
      {
        metodoPago: "EFECTIVO",
        items: [{ productoId: producto.id, cantidad: 2, precio: 1 }],
        negocioId: "otro",
        empleadoId: "otro",
        actorTipo: "NEGOCIO",
        actorId: "otro",
        total: 1,
        turnoId: "x",
      },
      key
    )
    expect(res.status).toBe(201)
    expect(res.body.total).toBe(3000)
    // cashier response: own sale only — no business ledger/summary fields
    expect(Object.keys(res.body).sort()).toEqual(["cantidadItems", "createdAt", "id", "items", "metodoPago", "total"])
    const venta = await db.venta.findUniqueOrThrow({ where: { id: res.body.id }, include: { cobros: true } })
    expect(venta.negocioId).toBe(negocio.id)
    expect(venta.actorTipo).toBe("EMPLEADO")
    expect(venta.actorId).toBe(empleado.id)
    expect(venta.empleadoId).toBe(empleado.id)
    expect(venta.idempotencyKey).toBe(key)
    expect("turnoId" in venta ? (venta as Record<string, unknown>).turnoId ?? null : null).toBeNull()
    expect(venta.cobros).toHaveLength(1)
    const op = await db.operacionFinanciera.findUniqueOrThrow({ where: { cobroVentaId: venta.cobros[0].id }, include: { movimientos: true } })
    expect(op).toMatchObject({ actorTipo: "EMPLEADO", actorId: empleado.id, negocioId: negocio.id })
    expect(op.movimientos).toHaveLength(1)
    expect(await stockDe(producto.id)).toBe(3)
    expect(await counts(negocio.id)).toEqual({ ventas: 1, cobros: 1, operaciones: 1, movimientosFin: 1, movimientosInv: 1 })
    const audit = await db.auditLog.findFirst({ where: { recursoId: venta.id } })
    expect(audit).toMatchObject({ userId: empleado.id, userType: "empleado", accion: "venta.creada" })
  })

  test("transfer: cobro DECLARADO, no ledger movement (same as owner)", async () => {
    const negocio = await crearNegocio()
    const producto = await crearProducto(negocio.id, { precio: 900 })
    const { cookie } = await cajero(negocio.id)
    const res = await vender(cookie, negocio.slug, { metodoPago: "TRANSFERENCIA", items: [{ productoId: producto.id, cantidad: 1 }] }, randomUUID())
    expect(res.status).toBe(201)
    expect(await counts(negocio.id)).toMatchObject({ ventas: 1, cobros: 1, movimientosFin: 0 })
  })

  test("invalid body → 400 with the owner's messages, nothing written", async () => {
    const negocio = await crearNegocio()
    const { cookie } = await cajero(negocio.id)
    expect((await vender(cookie, negocio.slug, { metodoPago: "BITCOIN", items: [] }, randomUUID())).body.error).toBe("Método de pago inválido")
    expect((await vender(cookie, negocio.slug, { metodoPago: "EFECTIVO", items: [] }, randomUUID())).body.error).toBe("La venta no tiene productos")
    expect((await counts(negocio.id)).ventas).toBe(0)
  })

  test("stock: physical shortage → 409, nothing written; R3A ACTIVA reservations are respected (409 STOCK_RESERVED_FOR_ORDERS)", async () => {
    const negocio = await crearNegocio()
    const corto = await crearProducto(negocio.id, { controlStock: true, stockCantidad: 1 })
    const reservado = await crearProducto(negocio.id, { controlStock: true, stockCantidad: 4 })
    await reservar(negocio, reservado.id, 3)
    const { cookie } = await cajero(negocio.id)

    const a = await vender(cookie, negocio.slug, { metodoPago: "EFECTIVO", items: [{ productoId: corto.id, cantidad: 2 }] }, randomUUID())
    expect(a.status).toBe(409)
    const b = await vender(cookie, negocio.slug, { metodoPago: "EFECTIVO", items: [{ productoId: reservado.id, cantidad: 2 }] }, randomUUID())
    expect(b.status).toBe(409)
    expect(b.body.code).toBe("STOCK_RESERVED_FOR_ORDERS")
    expect(await counts(negocio.id)).toMatchObject({ ventas: 0, cobros: 0, movimientosFin: 0, movimientosInv: 0 })
    expect(await stockDe(reservado.id)).toBe(4)
    // the 1 truly available unit can be sold; the reservation itself is untouched
    const c = await vender(cookie, negocio.slug, { metodoPago: "EFECTIVO", items: [{ productoId: reservado.id, cantidad: 1 }] }, randomUUID())
    expect(c.status).toBe(201)
    expect(await stockDe(reservado.id)).toBe(3)
    expect(await db.reservaStock.count({ where: { negocioId: negocio.id, estado: "ACTIVA" } })).toBe(1)
  })
})

// ---------------------------------------------------------------------------

describe("F10-B1 — idempotency (required for the cashier)", () => {
  test("missing or malformed Idempotency-Key → 400 IDEMPOTENCY_KEY_REQUIRED, nothing written", async () => {
    const negocio = await crearNegocio()
    const producto = await crearProducto(negocio.id)
    const { cookie } = await cajero(negocio.id)
    const body = { metodoPago: "EFECTIVO", items: [{ productoId: producto.id, cantidad: 1 }] }
    for (const key of [undefined, "", "no-es-uuid"]) {
      const res = await vender(cookie, negocio.slug, body, key)
      expect(res.status).toBe(400)
      expect(res.body.code).toBe("IDEMPOTENCY_KEY_REQUIRED")
    }
    expect((await counts(negocio.id)).ventas).toBe(0)
  })

  test("same key + same content → 200 replay of the original sale; different content → 409; nothing written again", async () => {
    const negocio = await crearNegocio()
    const producto = await crearProducto(negocio.id, { controlStock: true, stockCantidad: 10 })
    const { cookie } = await cajero(negocio.id)
    const key = randomUUID()
    const body = { metodoPago: "EFECTIVO", items: [{ productoId: producto.id, cantidad: 3 }] }
    const first = await vender(cookie, negocio.slug, body, key)
    expect(first.status).toBe(201)
    const before = await counts(negocio.id)
    const retry = await vender(cookie, negocio.slug, body, key.toUpperCase())
    expect(retry.status).toBe(200)
    expect(retry.replayed).toBe(true)
    expect(retry.body.id).toBe(first.body.id)
    const reused = await vender(cookie, negocio.slug, { ...body, items: [{ productoId: producto.id, cantidad: 4 }] }, key)
    expect(reused.status).toBe(409)
    expect(reused.body.code).toBe("IDEMPOTENCY_KEY_REUSED")
    expect(await counts(negocio.id)).toEqual(before)
    expect(await stockDe(producto.id)).toBe(7)
  })

  test("6 truly concurrent requests with one key → exactly one sale, one cobro, one ledger leg, stock once", async () => {
    const negocio = await crearNegocio()
    const producto = await crearProducto(negocio.id, { controlStock: true, stockCantidad: 10 })
    const { cookie } = await cajero(negocio.id)
    const key = randomUUID()
    const body = { metodoPago: "EFECTIVO", items: [{ productoId: producto.id, cantidad: 2 }] }
    const results = await Promise.all(Array.from({ length: 6 }, () => vender(cookie, negocio.slug, body, key)))
    const ok = results.filter((r) => r.status === 201 || r.status === 200)
    expect(results.filter((r) => r.status === 201)).toHaveLength(1)
    expect(new Set(ok.map((r) => r.body.id)).size).toBe(1)
    // anything not 200/201 must be a controlled, retryable conflict — never a second sale
    for (const r of results) expect([200, 201, 409]).toContain(r.status)
    expect(await counts(negocio.id)).toEqual({ ventas: 1, cobros: 1, operaciones: 1, movimientosFin: 1, movimientosInv: 1 })
    expect(await stockDe(producto.id)).toBe(8)
  })

  test("the same key used by ANOTHER person of the same business (cashier 2 or owner) → 409, never someone else's sale", async () => {
    const negocio = await crearNegocio()
    const producto = await crearProducto(negocio.id)
    const uno = await cajero(negocio.id)
    const dos = await cajero(negocio.id)
    const key = randomUUID()
    const body = { metodoPago: "EFECTIVO", items: [{ productoId: producto.id, cantidad: 1 }] }
    expect((await vender(uno.cookie, negocio.slug, body, key)).status).toBe(201)
    const otro = await vender(dos.cookie, negocio.slug, body, key)
    expect(otro.status).toBe(409)
    expect(otro.body.code).toBe("IDEMPOTENCY_KEY_REUSED")
    const owner = await postVentaOwner(
      new NextRequest("http://localhost/api/negocio/caja/ventas", {
        method: "POST",
        headers: { cookie: await ownerCookie(negocio.id), "content-type": "application/json", "idempotency-key": key },
        body: JSON.stringify(body),
      })
    )
    expect(owner.status).toBe(409)
    expect((await counts(negocio.id)).ventas).toBe(1)
  })

  test("tenant isolation: the same key in two businesses → two independent sales", async () => {
    const a = await crearNegocio()
    const b = await crearNegocio()
    const pa = await crearProducto(a.id)
    const pb = await crearProducto(b.id)
    const ca = await cajero(a.id)
    const cb = await cajero(b.id)
    const key = randomUUID()
    const ra = await vender(ca.cookie, a.slug, { metodoPago: "EFECTIVO", items: [{ productoId: pa.id, cantidad: 1 }] }, key)
    const rb = await vender(cb.cookie, b.slug, { metodoPago: "EFECTIVO", items: [{ productoId: pb.id, cantidad: 1 }] }, key)
    expect(ra.status).toBe(201)
    expect(rb.status).toBe(201)
    expect(ra.body.id).not.toBe(rb.body.id)
  })
})

// ---------------------------------------------------------------------------

describe("F10-B1 — information access (blind-close safety)", () => {
  test("the operational cookie never opens owner routes: GET caja/ventas (summary), POST caja/ventas, productos (cost), inventory movements", async () => {
    const negocio = await crearNegocio()
    const producto = await crearProducto(negocio.id)
    const { cookie } = await cajero(negocio.id)
    const resumen = await getVentasOwner(new NextRequest("http://localhost/api/negocio/caja/ventas", { headers: { cookie } }))
    expect([401, 403]).toContain(resumen.status)
    const ownerPost = await postVentaOwner(
      new NextRequest("http://localhost/api/negocio/caja/ventas", {
        method: "POST",
        headers: { cookie, "content-type": "application/json", "idempotency-key": randomUUID() },
        body: JSON.stringify({ metodoPago: "EFECTIVO", items: [{ productoId: producto.id, cantidad: 1 }] }),
      })
    )
    expect([401, 403]).toContain(ownerPost.status)
    const prods = await getProductosOwner(new NextRequest("http://localhost/api/negocio/productos", { headers: { cookie } }))
    expect([401, 403]).toContain(prods.status)
    const movs = await getMovimientosOwner(new NextRequest("http://localhost/api/negocio/inventario/movimientos", { headers: { cookie } }))
    expect([401, 403]).toContain(movs.status)
    expect((await counts(negocio.id)).ventas).toBe(0)
  })

  test("a cashier's catalog response carries no sales, totals, cash or other cashiers' data", async () => {
    const negocio = await crearNegocio()
    const producto = await crearProducto(negocio.id, { precio: 4321 })
    const otroCajero = await cajero(negocio.id)
    expect((await vender(otroCajero.cookie, negocio.slug, { metodoPago: "EFECTIVO", items: [{ productoId: producto.id, cantidad: 1 }] }, randomUUID())).status).toBe(201)
    const { cookie } = await cajero(negocio.id)
    const res = await productosCaja(cookie, negocio.slug)
    expect(Object.keys(res.body).sort()).toEqual(["empleado", "estado", "negocio", "ok", "productos"])
    const text = JSON.stringify(res.body)
    for (const leak of ["ventas", "totalHoy", "efectivoEsperado", "diferencia", "porMetodo", "saldo", otroCajero.empleado.id]) {
      expect(text).not.toContain(leak)
    }
  })
})

// ---------------------------------------------------------------------------

describe("F10-B1 — owner assigns área caja only in generic businesses", () => {
  test("POST /api/negocio/empleados: caja OK for negocio, 409 for restaurante/ropa", async () => {
    const generico = await crearNegocio()
    const ok = await postEmpleado(
      new NextRequest("http://localhost/api/negocio/empleados", {
        method: "POST",
        headers: { cookie: await ownerCookie(generico.id), "content-type": "application/json" },
        body: JSON.stringify({ nombre: "Cajera", codigo: `C${randomUUID().slice(0, 6)}`, areaOperativa: "caja" }),
      })
    )
    expect([200, 201]).toContain(ok.status)
    expect(await db.empleado.count({ where: { negocioId: generico.id, areaOperativa: "caja" } })).toBe(1)
    for (const rubro of ["restaurante", "ropa"] as const) {
      const n = await crearNegocio({ rubro })
      const res = await postEmpleado(
        new NextRequest("http://localhost/api/negocio/empleados", {
          method: "POST",
          headers: { cookie: await ownerCookie(n.id), "content-type": "application/json" },
          body: JSON.stringify({ nombre: "Cajera", codigo: `C${randomUUID().slice(0, 6)}`, areaOperativa: "caja" }),
        })
      )
      expect(res.status).toBe(409)
      expect(await db.empleado.count({ where: { negocioId: n.id } })).toBe(0)
    }
  })

  test("PUT /api/negocio/empleados/[id]: reassign to caja OK for negocio, 409 for restaurante (area unchanged)", async () => {
    const generico = await crearNegocio()
    const resto = await crearNegocio({ rubro: "restaurante", salonActivo: true })
    const { empleado: eg } = await crearEmpleado(generico.id, "pyr")
    const { empleado: er } = await crearEmpleado(resto.id, "pyr")
    const put = async (negocioId: string, id: string) =>
      putEmpleado(
        new NextRequest(`http://localhost/api/negocio/empleados/${id}`, {
          method: "PUT",
          headers: { cookie: await ownerCookie(negocioId), "content-type": "application/json" },
          body: JSON.stringify({ areaOperativa: "caja" }),
        }),
        { params: Promise.resolve({ id }) }
      )
    expect((await put(generico.id, eg.id)).status).toBe(200)
    expect((await db.empleado.findUniqueOrThrow({ where: { id: eg.id } })).areaOperativa).toBe("caja")
    expect((await put(resto.id, er.id)).status).toBe(409)
    expect((await db.empleado.findUniqueOrThrow({ where: { id: er.id } })).areaOperativa).toBe("pyr")
  })
})
