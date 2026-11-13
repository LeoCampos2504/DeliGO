/// <reference types="bun-types" />
// ============================================
// R1 — the MANDATORY audit of every money/stock Caja operation is written in the
// SAME transaction as the operation (REAL ephemeral PostgreSQL; own process:
// process-wide module mock of @/lib/audit).
// ============================================
// The audit module is replaced by itself plus a switch that makes
// auditLogWithClient fail for one action, either with a JavaScript error or with
// a REAL SQL error inside the transaction (1/0). For owner and cashier sales,
// F4-A returns, F4-A refunds paid later, F4-B corrections and F4-C exchanges it
// proves: a failed audit leaves NOTHING behind (no sale, cobro, operation,
// movement, stock change, return, correction, exchange or audit row); the retry
// with the same Idempotency-Key then succeeds with exactly ONE audit; an exact
// replay writes no second audit; concurrent duplicates write one audit.

import { afterAll, describe, expect, mock, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createOperationalSession, createSession, OPERATIONAL_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/auth"
import * as auditReal from "@/lib/audit"

setDefaultTimeout(240_000)

const testDatabaseUrl = process.env.DELIGO_TEST_DATABASE_URL
const isEphemeralIntegrationDb = process.env.DELIGO_EPHEMERAL_TEST_DB === "1"
if (!testDatabaseUrl || process.env.DATABASE_URL !== testDatabaseUrl) {
  throw new Error("Este test de integración requiere DELIGO_TEST_DATABASE_URL y DATABASE_URL apuntando a la misma base de prueba.")
}
const declaredEnvironment = process.env.DELIGO_ENVIRONMENT ?? process.env.RAILWAY_ENVIRONMENT_NAME ?? process.env.APP_ENV
if (!declaredEnvironment || declaredEnvironment.toUpperCase() !== "TESTING") {
  throw new Error("La suite R1 sólo puede ejecutarse con DELIGO_ENVIRONMENT=TESTING.")
}
const ephemeralTest = isEphemeralIntegrationDb ? test : test.skip

// Snapshot of the real exports BEFORE mocking (mock.module patches the module in place).
const real = { ...auditReal }
const falla: { accion: string | null; modo: "JS" | "SQL" } = { accion: null, modo: "JS" }
mock.module("@/lib/audit", () => ({
  ...real,
  auditLogWithClient: async (client: Parameters<typeof real.auditLogWithClient>[0], params: Parameters<typeof real.auditLogWithClient>[1]) => {
    if (falla.accion === params.accion) {
      if (falla.modo === "SQL") await (client as unknown as { $executeRawUnsafe: (q: string) => Promise<number> }).$executeRawUnsafe("SELECT 1/0")
      throw new Error("escritura de auditoría fallida (simulada)")
    }
    return real.auditLogWithClient(client, params)
  },
}))
const { POST: postVentaOwner } = await import("@/app/api/negocio/caja/ventas/route")
const { POST: postVentaCajero } = await import("@/app/api/operativo/caja/[slug]/ventas/route")
const { POST: postDevolucionOwner } = await import("@/app/api/negocio/caja/ventas/[id]/devoluciones/route")
const { POST: postReintegroOwner } = await import("@/app/api/negocio/caja/devoluciones/[id]/reintegro/route")
const { POST: postCorreccion } = await import("@/app/api/negocio/caja/ventas/[id]/correcciones/route")
const { POST: postCambioOwner } = await import("@/app/api/negocio/caja/ventas/[id]/cambios/route")

afterAll(async () => {
  await db.$disconnect()
})

type Res = { status: number; replayed: boolean; body: Record<string, any> }
const json = async (res: Response): Promise<Res> => ({ status: res.status, replayed: res.headers.get("Idempotency-Replayed") === "true", body: await res.json().catch(() => ({})) })
const rq = (url: string, cookie: string, body: unknown, key: string) =>
  new NextRequest(`http://localhost${url}`, { method: "POST", headers: { cookie, "content-type": "application/json", "idempotency-key": key }, body: JSON.stringify(body) })
const idCtx = (id: string) => ({ params: Promise.resolve({ id }) })

async function conFalla<T>(accion: string, modo: "JS" | "SQL", fn: () => Promise<T>): Promise<T> {
  falla.accion = accion
  falla.modo = modo
  try {
    return await fn()
  } finally {
    falla.accion = null
  }
}

async function escenario() {
  const suffix = randomUUID().slice(0, 12)
  const negocio = await db.negocio.create({
    data: { slug: `test-r1-${suffix}`, nombre: `Test R1 ${suffix}`, usuario: `test-r1-${suffix}`, email: `test-r1-${suffix}@example.test`, password: "fixture", rubro: "negocio", aprobado: true, suspendido: false, empleadosActivos: true, salonActivo: true, cajaTurnosModo: "OPCIONAL" },
  })
  const owner = `${SESSION_COOKIE_NAME}=${await createSession(negocio.id, "negocio")}`
  const cuenta = await db.cuentaOperativa.create({ data: { nombre: "Cajera R1", email: `r1-${suffix}@example.test`, activo: true, eliminado: false } })
  const empleado = await db.empleado.create({ data: { nombre: "Cajera R1", codigo: `R1${suffix.slice(0, 6)}`.toUpperCase(), negocioId: negocio.id, cuentaOperativaId: cuenta.id, areaOperativa: "caja", activo: true, eliminado: false } })
  const cajero = `${OPERATIONAL_SESSION_COOKIE_NAME}=${await createOperationalSession(cuenta.id)}`
  const alfajor = await db.producto.create({ data: { nombre: "Alfajor", precio: 1000, negocioId: negocio.id, controlStock: true, stockCantidad: 50 } })
  const bombon = await db.producto.create({ data: { nombre: "Bombon", precio: 1000, negocioId: negocio.id, controlStock: true, stockCantidad: 50 } })
  const n = negocio.id
  const foto = async () => ({
    ventas: await db.venta.count({ where: { negocioId: n } }),
    cobros: await db.cobroVenta.count({ where: { negocioId: n } }),
    operaciones: await db.operacionFinanciera.count({ where: { negocioId: n } }),
    movimientos: await db.movimientoFinanciero.count({ where: { negocioId: n } }),
    movimientosInventario: await db.movimientoInventario.count({ where: { negocioId: n } }),
    devoluciones: await db.devolucionVenta.count({ where: { negocioId: n } }),
    reintegrosPagados: await db.devolucionVenta.count({ where: { negocioId: n, reintegroEstado: "REALIZADO" } }),
    correcciones: await db.correccionVenta.count({ where: { negocioId: n } }),
    cambios: await db.cambioVenta.count({ where: { negocioId: n } }),
    notificaciones: await db.notificacion.count({ where: { negocioId: n } }),
    stock: (await db.producto.findMany({ where: { negocioId: n }, select: { nombre: true, stockCantidad: true }, orderBy: { nombre: "asc" } })).map((p) => `${p.nombre}:${p.stockCantidad}`).join(","),
    auditorias: await db.auditLog.count({ where: { OR: [{ userId: n }, { userId: empleado.id }] } }),
  })
  const auditoriasDe = (accion: string) => db.auditLog.count({ where: { accion, OR: [{ userId: n }, { userId: empleado.id }] } })
  const venderOwner = async (key: string, items = [{ productoId: alfajor.id, cantidad: 2 }], metodoPago = "EFECTIVO") =>
    json(await postVentaOwner(rq("/api/negocio/caja/ventas", owner, { metodoPago, items }, key)))
  const venderCajero = async (key: string) =>
    json(await postVentaCajero(rq(`/api/operativo/caja/${negocio.slug}/ventas`, cajero, { metodoPago: "EFECTIVO", items: [{ productoId: alfajor.id, cantidad: 1 }] }, key), { params: Promise.resolve({ slug: negocio.slug }) }))
  return { negocio, owner, cajero, empleado, alfajor, bombon, foto, auditoriasDe, venderOwner, venderCajero }
}

describe("R1 — audit in the same transaction as the operation", () => {
  for (const modo of ["JS", "SQL"] as const) {
    ephemeralTest(`owner sale: a failed audit (${modo}) rolls the whole sale back; same-key retry = one sale + one audit; replay adds nothing`, async () => {
      const e = await escenario()
      const antes = await e.foto()
      const key = randomUUID()
      const fallida = await conFalla("venta.creada", modo, () => e.venderOwner(key))
      expect(fallida.status).toBe(500)
      expect(await e.foto()).toEqual(antes)
      const ok = await e.venderOwner(key)
      expect(ok.status).toBe(201)
      const replay = await e.venderOwner(key)
      expect([replay.status, replay.replayed, replay.body.id]).toEqual([200, true, ok.body.id])
      const despues = await e.foto()
      expect([despues.ventas, despues.cobros, despues.operaciones, despues.movimientos]).toEqual([1, 1, 1, 1])
      expect(await e.auditoriasDe("venta.creada")).toBe(1)
      expect(despues.stock).toBe("Alfajor:48,Bombon:50")
    })
  }

  ephemeralTest("cashier sale: a failed audit (SQL) rolls back; retry = one sale + one audit", async () => {
    const e = await escenario()
    const antes = await e.foto()
    const key = randomUUID()
    const fallida = await conFalla("venta.creada", "SQL", () => e.venderCajero(key))
    expect(fallida.status).toBe(500)
    expect(await e.foto()).toEqual(antes)
    expect((await e.venderCajero(key)).status).toBe(201)
    expect((await e.venderCajero(key)).replayed).toBe(true)
    expect((await e.foto()).ventas).toBe(1)
    expect(await e.auditoriasDe("venta.creada")).toBe(1)
  })

  ephemeralTest("concurrent same-key owner sales: one sale, one audit", async () => {
    const e = await escenario()
    const key = randomUUID()
    const rs = await Promise.all(Array.from({ length: 4 }, () => e.venderOwner(key)))
    expect(rs.filter((r) => r.status === 201)).toHaveLength(1)
    expect((await e.foto()).ventas).toBe(1)
    expect(await e.auditoriasDe("venta.creada")).toBe(1)
  })

  ephemeralTest("F4-A return with cash refund: a failed audit (JS and SQL) leaves no return, refund operation or stock change; retry = one return + one audit", async () => {
    const e = await escenario()
    const venta = await e.venderOwner(randomUUID())
    const body = { tipo: "DEVOLUCION_PARCIAL", motivo: "R1", items: [{ ventaItemId: venta.body.items[0].id, cantidad: 1, reingresaStock: true }], reintegro: { modo: "REALIZADO", medio: "EFECTIVO" }, confirmo: true }
    const devolver = async (key: string) => json(await postDevolucionOwner(rq(`/api/negocio/caja/ventas/${venta.body.id}/devoluciones`, e.owner, body, key), idCtx(venta.body.id)))
    const antes = await e.foto()
    const key = randomUUID()
    for (const modo of ["JS", "SQL"] as const) {
      const r = await conFalla("venta.devolucion_parcial", modo, () => devolver(key))
      expect(r.status).toBe(500)
      expect(await e.foto()).toEqual(antes)
    }
    expect((await devolver(key)).status).toBe(201)
    expect((await devolver(key)).replayed).toBe(true)
    const despues = await e.foto()
    expect([despues.devoluciones, despues.operaciones - antes.operaciones, despues.stock]).toEqual([1, 1, "Alfajor:49,Bombon:50"])
    expect(await e.auditoriasDe("venta.devolucion_parcial")).toBe(1)
  })

  ephemeralTest("F4-A refund paid later: a failed audit keeps the return PENDING with no operation; retry = paid once + one audit", async () => {
    const e = await escenario()
    const venta = await e.venderOwner(randomUUID())
    const anul = await json(await postDevolucionOwner(rq(`/api/negocio/caja/ventas/${venta.body.id}/devoluciones`, e.owner, { tipo: "ANULACION", motivo: "R1", items: [{ ventaItemId: venta.body.items[0].id, cantidad: 2, reingresaStock: true }], reintegro: { modo: "PENDIENTE" }, confirmo: true }, randomUUID()), idCtx(venta.body.id)))
    expect(anul.status).toBe(201)
    const devId: string = anul.body.devolucion.id
    const pagar = async (key: string) => json(await postReintegroOwner(rq(`/api/negocio/caja/devoluciones/${devId}/reintegro`, e.owner, { medio: "EFECTIVO", confirmo: true }, key), idCtx(devId)))
    const antes = await e.foto()
    const key = randomUUID()
    const r = await conFalla("venta.devolucion_reintegro_registrado", "SQL", () => pagar(key))
    expect(r.status).toBe(500)
    expect(await e.foto()).toEqual(antes)
    expect((await db.devolucionVenta.findUniqueOrThrow({ where: { id: devId } })).reintegroEstado).toBe("PENDIENTE")
    expect((await pagar(key)).status).toBe(201)
    expect((await pagar(key)).replayed).toBe(true)
    const despues = await e.foto()
    expect([despues.reintegrosPagados, despues.operaciones - antes.operaciones]).toEqual([1, 1])
    expect(await e.auditoriasDe("venta.devolucion_reintegro_registrado")).toBe(1)
  })

  ephemeralTest("F4-B correction: a failed audit leaves no correction and no stock change; retry = one correction + one audit", async () => {
    const e = await escenario()
    const venta = await e.venderOwner(randomUUID(), [{ productoId: e.alfajor.id, cantidad: 1 }])
    const body = { motivo: "R1 producto equivocado", confirmo: true, secuenciaEsperada: 0, lineas: [{ ventaItemId: venta.body.items[0].id, productoId: e.bombon.id, varianteId: null, cantidad: 1 }] }
    const corregir = async (key: string) => json(await postCorreccion(rq(`/api/negocio/caja/ventas/${venta.body.id}/correcciones`, e.owner, body, key), idCtx(venta.body.id)))
    const antes = await e.foto()
    const key = randomUUID()
    const r = await conFalla("venta.corregida", "JS", () => corregir(key))
    expect(r.status).toBe(500)
    expect(await e.foto()).toEqual(antes)
    expect((await corregir(key)).status).toBe(201)
    expect((await corregir(key)).replayed).toBe(true)
    const despues = await e.foto()
    expect([despues.correcciones, despues.stock]).toEqual([1, "Alfajor:50,Bombon:49"])
    expect(await e.auditoriasDe("venta.corregida")).toBe(1)
  })

  ephemeralTest("F4-C exchange (already transactional): a failed audit leaves no exchange, return or linked sale; retry = one exchange + one audit", async () => {
    const e = await escenario()
    const venta = await e.venderOwner(randomUUID(), [{ productoId: e.alfajor.id, cantidad: 1 }])
    const body = { motivo: "R1 cambio", salen: [{ ventaItemId: venta.body.items[0].id, cantidad: 1, reingresaStock: true }], entran: [{ productoId: e.bombon.id, cantidad: 1 }], esperado: { salida: "1000.00", entrada: "1000.00" }, confirmo: true }
    const cambiar = async (key: string) => json(await postCambioOwner(rq(`/api/negocio/caja/ventas/${venta.body.id}/cambios`, e.owner, body, key), idCtx(venta.body.id)))
    const antes = await e.foto()
    const key = randomUUID()
    const r = await conFalla("venta.cambio", "SQL", () => cambiar(key))
    expect(r.status).toBeGreaterThanOrEqual(500)
    expect(await e.foto()).toEqual(antes)
    expect((await cambiar(key)).status).toBe(201)
    const despues = await e.foto()
    expect([despues.cambios, despues.devoluciones, despues.ventas - antes.ventas]).toEqual([1, 1, 1])
    expect(await e.auditoriasDe("venta.cambio")).toBe(1)
  })
})
