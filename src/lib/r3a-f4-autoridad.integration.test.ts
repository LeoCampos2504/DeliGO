/// <reference types="bun-types" />
// ============================================
// R3A — autoridad ÚNICA de stock: venta, corrección (F4-B), devolución y anulación (F4-A) y
// recepción de mercadería (F10-C2a) sobre los MISMOS productos, en PostgreSQL REAL efímero.
// ============================================
// Después de centralizar en stock-lifecycle.ts las escrituras que F4-A / F4-B hacían por su cuenta:
// los resultados son los mismos de siempre y la cadena de movimientos de cada clave es íntegra
// (stockAntes de cada movimiento = stockDespues del anterior; el último = stock actual), también con
// operaciones concurrentes (sin doble devolución ni doble ingreso).

import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createOperationalSession, createSession, OPERATIONAL_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/auth"

setDefaultTimeout(300_000)

const testDatabaseUrl = process.env.DELIGO_TEST_DATABASE_URL
const isEphemeralIntegrationDb = process.env.DELIGO_EPHEMERAL_TEST_DB === "1"
if (!testDatabaseUrl || process.env.DATABASE_URL !== testDatabaseUrl) {
  throw new Error("Este test de integración requiere DELIGO_TEST_DATABASE_URL y DATABASE_URL apuntando a la misma base de prueba.")
}
const declaredEnvironment = process.env.DELIGO_ENVIRONMENT ?? process.env.RAILWAY_ENVIRONMENT_NAME ?? process.env.APP_ENV
if (!declaredEnvironment || declaredEnvironment.toUpperCase() !== "TESTING") {
  throw new Error("La suite R3A/F4 sólo puede ejecutarse con DELIGO_ENVIRONMENT=TESTING.")
}
process.env.DELIGO_F10_B2_2_B_SHIFT_UI_ENABLED = "true"
const ephemeralTest = isEphemeralIntegrationDb ? test : test.skip

const { GET: getCajas } = await import("@/app/api/negocio/caja/cajas/route")
const { POST: postTurnoCajero } = await import("@/app/api/operativo/caja/[slug]/turno/route")
const { POST: postVentaCajero } = await import("@/app/api/operativo/caja/[slug]/ventas/route")
const { POST: postDevolucionCajero } = await import("@/app/api/operativo/caja/[slug]/ventas/[id]/devoluciones/route")
const { POST: postDevolucionOwner } = await import("@/app/api/negocio/caja/ventas/[id]/devoluciones/route")
const correccionModule = await import("@/app/api/negocio/caja/ventas/[id]/correcciones/route")
const { POST: postRecepcion } = await import("@/app/api/negocio/recepciones/route")
const { POST: postAprobacion } = await import("@/app/api/negocio/recepciones/[id]/aprobacion/route")

afterAll(async () => {
  await db.$disconnect()
})

const json = async (res: Response) => ({ status: res.status, replayed: res.headers.get("Idempotency-Replayed") === "true", body: await res.json().catch(() => ({})) as Record<string, any> })
const req = (url: string, cookie: string, method = "GET", body?: unknown, key?: string) =>
  new NextRequest(`http://localhost${url}`, { method, headers: { cookie, "content-type": "application/json", ...(key ? { "idempotency-key": key } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
const K = () => randomUUID()

async function escenario() {
  const suffix = randomUUID().slice(0, 12)
  const negocio = await db.negocio.create({
    data: { slug: `test-r3a-${suffix}`, nombre: `Test R3A ${suffix}`, usuario: `test-r3a-${suffix}`, email: `test-r3a-${suffix}@example.test`, password: "fixture", rubro: "negocio", aprobado: true, suspendido: false, empleadosActivos: true, salonActivo: true, cajaTurnosModo: "OPCIONAL" },
  })
  const n = negocio.id, slug = negocio.slug
  const owner = `${SESSION_COOKIE_NAME}=${await createSession(n, "negocio")}`
  const cuenta = await db.cuentaOperativa.create({ data: { nombre: "Ana", email: `r3a-${suffix}@example.test`, activo: true, eliminado: false } })
  const empleado = await db.empleado.create({ data: { nombre: "Ana", codigo: `R3${suffix.slice(0, 6)}`.toUpperCase(), negocioId: n, cuentaOperativaId: cuenta.id, areaOperativa: "caja", activo: true, eliminado: false } })
  const allow = new Set((process.env.DELIGO_F10_B2_2_B_CONTROLLED_EMPLOYEE_IDS ?? "").split(/[\s,;]+/).filter(Boolean))
  allow.add(empleado.id)
  process.env.DELIGO_F10_B2_2_B_CONTROLLED_EMPLOYEE_IDS = [...allow].join(",")
  const cajero = `${OPERATIONAL_SESSION_COOKIE_NAME}=${await createOperationalSession(cuenta.id)}`
  const caja = (await json(await getCajas(req("/api/negocio/caja/cajas", owner)))).body.cajas[0]
  const turno = await json(await postTurnoCajero(req(`/api/operativo/caja/${slug}/turno`, cajero, "POST", { cajaFisicaId: caja.id, fondoInicial: "1000.00" }, K()), { params: Promise.resolve({ slug }) }))
  if (turno.status !== 201) throw new Error(`fixture: turno ${JSON.stringify(turno.body)}`)
  const proveedor = (await db.proveedor.create({ data: { negocioId: n, nombre: "Proveedor R3A", nombreNormalizado: "proveedor r3a", actorId: n, idempotencyKey: K() } })).id
  const producto = (nombre: string, stock: number, controlStock = true) => db.producto.create({ data: { nombre, precio: 2000, negocioId: n, controlStock, stockCantidad: stock } })
  const cola = await producto("Gaseosa Cola", 10)
  const lima = await producto("Gaseosa Lima", 10)
  const libre = await producto("Bolsa (sin control)", 0, false)
  const vender = async (items: Array<{ productoId: string; cantidad: number }>) => {
    const r = await json(await postVentaCajero(req(`/api/operativo/caja/${slug}/ventas`, cajero, "POST", { metodoPago: "EFECTIVO", items }, K()), { params: Promise.resolve({ slug }) }))
    if (r.status !== 201) throw new Error(`fixture: venta ${JSON.stringify(r.body)}`)
    return r.body as { id: string; items: Array<{ id: string; productoId: string | null }> }
  }
  const devolverCajero = async (ventaId: string, body: unknown, key = K()) => json(await postDevolucionCajero(req(`/api/operativo/caja/${slug}/ventas/${ventaId}/devoluciones`, cajero, "POST", body, key), { params: Promise.resolve({ slug, id: ventaId }) }))
  const devolverOwner = async (ventaId: string, body: unknown, key = K()) => json(await postDevolucionOwner(req(`/api/negocio/caja/ventas/${ventaId}/devoluciones`, owner, "POST", body, key), { params: Promise.resolve({ id: ventaId }) }))
  const corregir = async (ventaId: string, body: unknown, key = K()) => json(await correccionModule.POST(req(`/api/negocio/caja/ventas/${ventaId}/correcciones`, owner, "POST", body, key), { params: Promise.resolve({ id: ventaId }) }))
  const recibir = async (productoId: string, cantidad: string, costo = "2000") => {
    const c = await json(await postRecepcion(req("/api/negocio/recepciones", owner, "POST", { proveedorId: proveedor, fechaRecepcion: "2026-11-15", lineas: [{ productoId, cantidadRecibida: cantidad, costoUnitario: costo }] }, K())))
    if (c.status !== 201) throw new Error(`fixture: recepción ${JSON.stringify(c.body)}`)
    return { id: c.body.recepcionId as string, aprobar: async (key = K()) => json(await postAprobacion(req(`/api/negocio/recepciones/${c.body.recepcionId}/aprobacion`, owner, "POST", { version: 1, confirmoDiferenciasCosto: true }, key), { params: Promise.resolve({ id: c.body.recepcionId }) })) }
  }
  const stock = async (id: string) => (await db.producto.findUniqueOrThrow({ where: { id } })).stockCantidad
  /** Cadena íntegra: cada movimiento parte del anterior y el último coincide con el stock actual. */
  const cadenaIntegra = async (productoId: string, stockInicial: number) => {
    const movs = await db.movimientoInventario.findMany({ where: { negocioId: n, productoId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] })
    let actual = stockInicial
    for (const m of movs) {
      if (m.stockAntes !== actual) return { ok: false, en: m.tipo, esperado: actual, stockAntes: m.stockAntes }
      const signo = ["VENTA", "SALIDA", "CORRECCION_SALIDA", "PEDIDO"].includes(m.tipo) ? -1 : 1
      if (m.stockDespues !== m.stockAntes + signo * m.cantidad) return { ok: false, en: m.tipo, cantidad: m.cantidad }
      actual = m.stockDespues
    }
    return { ok: actual === (await stock(productoId)), final: actual, tipos: movs.map((m) => m.tipo) }
  }
  return { negocio, n, slug, owner, cajero, cola, lima, libre, vender, devolverCajero, devolverOwner, corregir, recibir, stock, cadenaIntegra }
}

const itemDe = (venta: { items: Array<{ id: string; productoId: string | null }> }, productoId: string) => venta.items.find((i) => i.productoId === productoId)!.id
const parcial = (items: Array<{ ventaItemId: string; cantidad: number; reingresaStock: boolean }>) => ({ tipo: "DEVOLUCION_PARCIAL", motivo: "El cliente devolvió el producto", confirmo: true, reintegro: { modo: "PENDIENTE" }, items })
const anulacion = (items: Array<{ ventaItemId: string; reingresaStock: boolean }>) => ({ tipo: "ANULACION", motivo: "Venta cargada por error", confirmo: true, reintegro: { modo: "PENDIENTE" }, items })
const correccion = (lineas: Array<{ ventaItemId: string; productoId: string; cantidad: number }>, secuenciaEsperada = 0) =>
  ({ motivo: "Se escaneó el sabor equivocado", confirmo: true, secuenciaEsperada, lineas: lineas.map((l) => ({ varianteId: null, ...l })) })

describe("R3A — una sola autoridad para venta, corrección, devolución, anulación y recepción", () => {
  ephemeralTest("ciclo completo: mismos resultados de siempre y cadena de movimientos íntegra por clave", async () => {
    const e = await escenario()
    // recepción: entra stock
    const r = await e.recibir(e.cola.id, "5")
    expect((await r.aprobar()).status).toBe(201)
    expect(await e.stock(e.cola.id)).toBe(15)
    // venta
    const v = await e.vender([{ productoId: e.cola.id, cantidad: 2 }, { productoId: e.lima.id, cantidad: 1 }])
    expect([await e.stock(e.cola.id), await e.stock(e.lima.id)]).toEqual([13, 9])
    // corrección (F4-B): las 2 colas eran lima → vuelven 2 colas, salen 2 limas
    const colaItem = itemDe(v, e.cola.id), limaItem = itemDe(v, e.lima.id)
    const c = await e.corregir(v.id, correccion([{ ventaItemId: colaItem, productoId: e.lima.id, cantidad: 2 }, { ventaItemId: limaItem, productoId: e.lima.id, cantidad: 1 }]))
    expect(c.status).toBe(201)
    expect([await e.stock(e.cola.id), await e.stock(e.lima.id)]).toEqual([15, 7])
    const movCorr = await db.movimientoInventario.findMany({ where: { negocioId: e.n, correccionVentaId: c.body.correccion.id }, orderBy: { tipo: "asc" } })
    expect(movCorr.map((m) => [m.tipo, m.cantidad, m.motivo?.startsWith("Corrección de venta #")])).toEqual([["CORRECCION_ENTRADA", 2, true], ["CORRECCION_SALIDA", 2, true]])
    // devolución parcial (F4-A) con reingreso
    const d = await e.devolverCajero(v.id, parcial([{ ventaItemId: limaItem, cantidad: 1, reingresaStock: true }]))
    expect(d.status).toBe(201)
    expect(await e.stock(e.lima.id)).toBe(8)
    const itemDev = await db.devolucionVentaItem.findFirstOrThrow({ where: { ventaItemId: limaItem }, include: { movimientoInventario: true } })
    expect([itemDev.stockResultado, itemDev.movimientoInventario?.tipo, itemDev.movimientoInventario?.motivo?.startsWith("Devolución de venta #")]).toEqual(["REINGRESADO", "DEVOLUCION", true])
    // anulación (F4-A) de otra venta, con y sin reingreso, y un producto sin control de stock
    const v2 = await e.vender([{ productoId: e.cola.id, cantidad: 3 }, { productoId: e.lima.id, cantidad: 1 }, { productoId: e.libre.id, cantidad: 1 }])
    expect([await e.stock(e.cola.id), await e.stock(e.lima.id)]).toEqual([12, 7])
    const a = await e.devolverOwner(v2.id, anulacion([{ ventaItemId: itemDe(v2, e.cola.id), reingresaStock: true }, { ventaItemId: itemDe(v2, e.lima.id), reingresaStock: false }, { ventaItemId: itemDe(v2, e.libre.id), reingresaStock: true }]))
    expect(a.status).toBe(201)
    expect([await e.stock(e.cola.id), await e.stock(e.lima.id), await e.stock(e.libre.id)]).toEqual([15, 7, 0])
    const resultados = await db.devolucionVentaItem.findMany({ where: { ventaId: v2.id }, include: { movimientoInventario: true } })
    const porProducto = new Map(resultados.map((x) => [x.ventaItemId, x]))
    expect(porProducto.get(itemDe(v2, e.cola.id))!.movimientoInventario?.motivo?.startsWith("Anulación de venta #")).toBe(true)
    expect(porProducto.get(itemDe(v2, e.lima.id))!.stockResultado).toBe("NO_REINGRESA")
    expect(porProducto.get(itemDe(v2, e.libre.id))!.stockResultado).toBe("SIN_CONTROL_STOCK")
    // cadena íntegra por clave
    expect(await e.cadenaIntegra(e.cola.id, 10)).toMatchObject({ ok: true, final: 15, tipos: ["RECEPCION", "VENTA", "CORRECCION_ENTRADA", "VENTA", "DEVOLUCION"] })
    expect(await e.cadenaIntegra(e.lima.id, 10)).toMatchObject({ ok: true, final: 7, tipos: ["VENTA", "CORRECCION_SALIDA", "DEVOLUCION", "VENTA"] })
    // la autoridad nunca toca reservas
    expect(await db.reservaStock.count({ where: { negocioId: e.n } })).toBe(0)
  })

  ephemeralTest("corrección sin stock suficiente: mismo rechazo de siempre y nada escrito", async () => {
    const e = await escenario()
    await db.producto.update({ where: { id: e.lima.id }, data: { stockCantidad: 1 } })
    const v = await e.vender([{ productoId: e.cola.id, cantidad: 2 }, { productoId: e.lima.id, cantidad: 1 }])
    const movs = await db.movimientoInventario.count({ where: { negocioId: e.n } })
    const c = await e.corregir(v.id, correccion([{ ventaItemId: itemDe(v, e.cola.id), productoId: e.lima.id, cantidad: 2 }, { ventaItemId: itemDe(v, e.lima.id), productoId: e.lima.id, cantidad: 1 }]))
    expect(c.status).toBe(409)
    expect(c.body.code).toBe("STOCK_INSUFICIENTE")
    expect(c.body.error).toContain("no tiene stock suficiente para la corrección")
    expect(await db.movimientoInventario.count({ where: { negocioId: e.n } })).toBe(movs)
    expect([await e.stock(e.cola.id), await e.stock(e.lima.id)]).toEqual([8, 0])
  })
})

describe("R3A — concurrencia: ni doble devolución ni doble ingreso", () => {
  ephemeralTest("dos devoluciones simultáneas del mismo ítem (claves distintas): el stock vuelve UNA vez", async () => {
    const e = await escenario()
    for (let i = 0; i < 3; i++) {
      const v = await e.vender([{ productoId: e.cola.id, cantidad: 1 }])
      const body = parcial([{ ventaItemId: v.items[0].id, cantidad: 1, reingresaStock: true }])
      const rs = await Promise.all([e.devolverCajero(v.id, body), e.devolverOwner(v.id, body)])
      expect(rs.filter((r) => r.status === 201).length).toBe(1)
      expect(await db.devolucionVentaItem.count({ where: { ventaId: v.id } })).toBe(1)
    }
    expect(await e.stock(e.cola.id)).toBe(10)
    expect(await e.cadenaIntegra(e.cola.id, 10)).toMatchObject({ ok: true, final: 10 })
  })

  ephemeralTest("devolución, venta, corrección y recepción concurrentes sobre el mismo producto: ninguna escritura se pierde", async () => {
    const e = await escenario()
    const v = await e.vender([{ productoId: e.cola.id, cantidad: 2 }, { productoId: e.lima.id, cantidad: 2 }])
    const r = await e.recibir(e.cola.id, "4")
    const [dev, venta, rec, corr] = await Promise.all([
      e.devolverCajero(v.id, parcial([{ ventaItemId: itemDe(v, e.cola.id), cantidad: 1, reingresaStock: true }])),
      json(await postVentaCajero(req(`/api/operativo/caja/${e.slug}/ventas`, e.cajero, "POST", { metodoPago: "EFECTIVO", items: [{ productoId: e.cola.id, cantidad: 1 }] }, K()), { params: Promise.resolve({ slug: e.slug }) })),
      r.aprobar(),
      e.corregir(v.id, correccion([{ ventaItemId: itemDe(v, e.cola.id), productoId: e.cola.id, cantidad: 2 }, { ventaItemId: itemDe(v, e.lima.id), productoId: e.cola.id, cantidad: 2 }])),
    ])
    expect([dev.status, venta.status, rec.status]).toEqual([201, 201, 201])
    expect([201, 409]).toContain(corr.status) // la corrección puede chocar con la devolución de la misma venta
    // pase lo que pase, la cadena de cada clave es íntegra y el stock final = suma exacta de lo aplicado
    const cola = await e.cadenaIntegra(e.cola.id, 10)
    const lima = await e.cadenaIntegra(e.lima.id, 10)
    expect(cola.ok).toBe(true)
    expect(lima.ok).toBe(true)
    const esperadoCola = 10 - 2 + 1 - 1 + 4 + (corr.status === 201 ? -2 : 0)
    expect(await e.stock(e.cola.id)).toBe(esperadoCola)
    expect(await db.movimientoInventario.count({ where: { negocioId: e.n, tipo: "RECEPCION" } })).toBe(1)
  })

  ephemeralTest("aprobación de recepción con doble clic y reintento: una sola entrada aun mezclada con ventas", async () => {
    const e = await escenario()
    const r = await e.recibir(e.lima.id, "6")
    const key = K()
    const rs = await Promise.all([r.aprobar(key), r.aprobar(key), e.vender([{ productoId: e.lima.id, cantidad: 3 }]).then(() => ({ status: 0 }))])
    expect(rs.filter((x) => x.status === 201).length).toBe(1)
    expect(await e.stock(e.lima.id)).toBe(13)
    expect(await db.movimientoInventario.count({ where: { negocioId: e.n, tipo: "RECEPCION" } })).toBe(1)
    expect(await e.cadenaIntegra(e.lima.id, 10)).toMatchObject({ ok: true, final: 13 })
  })
})
