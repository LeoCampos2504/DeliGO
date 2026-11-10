/// <reference types="bun-types" />
// ============================================
// F4-C4 H2/H3-H — the F4-A return audit never depends on the later detail read
// (REAL ephemeral PostgreSQL; own process: process-wide module mock)
// ============================================
// The return service module is replaced by itself plus two switchable
// failures: the post-commit detail read (detalleVentaConDevoluciones) and the
// inherited-price evidence read (lineasDevueltasConPrecioHeredado). Proves:
//   - a committed return keeps exactly ONE audit even when the detail read
//     afterwards fails (the client then gets a 500 and its retry with the same
//     key is a replay: no second audit);
//   - the inherited-price evidence is recorded as VERIFICADA (ids, possibly
//     none) or NO_DISPONIBLE when it could not be read — never an empty list
//     presented as a successful check.

import { afterAll, describe, expect, mock, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createSession, SESSION_COOKIE_NAME } from "@/lib/auth"
import * as servicioReal from "@/lib/caja-devoluciones-service"

setDefaultTimeout(240_000)

const testDatabaseUrl = process.env.DELIGO_TEST_DATABASE_URL
const isEphemeralIntegrationDb = process.env.DELIGO_EPHEMERAL_TEST_DB === "1"
if (!testDatabaseUrl || process.env.DATABASE_URL !== testDatabaseUrl) {
  throw new Error("Este test de integración requiere DELIGO_TEST_DATABASE_URL y DATABASE_URL apuntando a la misma base de prueba.")
}
const declaredEnvironment = process.env.DELIGO_ENVIRONMENT ?? process.env.RAILWAY_ENVIRONMENT_NAME ?? process.env.APP_ENV
if (!declaredEnvironment || declaredEnvironment.toUpperCase() !== "TESTING") {
  throw new Error("La suite F4-C4 (auditoría F4-A) sólo puede ejecutarse con DELIGO_ENVIRONMENT=TESTING.")
}
const ephemeralTest = isEphemeralIntegrationDb ? test : test.skip

// Snapshot of the real exports BEFORE mocking (mock.module patches the module in place).
const real = { ...servicioReal }
const fallas = { detalle: false, evidencia: false }
mock.module("@/lib/caja-devoluciones-service", () => ({
  ...real,
  detalleVentaConDevoluciones: async (...args: Parameters<typeof real.detalleVentaConDevoluciones>) => {
    if (fallas.detalle) throw new Error("lectura del detalle fallida (simulada)")
    return real.detalleVentaConDevoluciones(...args)
  },
  lineasDevueltasConPrecioHeredado: async (...args: Parameters<typeof real.lineasDevueltasConPrecioHeredado>) => {
    if (fallas.evidencia) throw new Error("lectura de evidencia fallida (simulada)")
    return real.lineasDevueltasConPrecioHeredado(...args)
  },
}))
const { POST: postVentaOwner } = await import("@/app/api/negocio/caja/ventas/route")
const { POST: postDevolucionOwner } = await import("@/app/api/negocio/caja/ventas/[id]/devoluciones/route")

afterAll(async () => {
  await db.$disconnect()
})

const json = async (res: Response) => ({ status: res.status, replayed: res.headers.get("Idempotency-Replayed") === "true", body: await res.json() })
const req = (url: string, cookie: string, body: unknown, key: string) =>
  new NextRequest(`http://localhost${url}`, { method: "POST", headers: { cookie, "content-type": "application/json", "idempotency-key": key }, body: JSON.stringify(body) })

async function escenario() {
  const suffix = randomUUID()
  const negocio = await db.negocio.create({
    data: { slug: `test-f4c4a-${suffix}`, nombre: `Test F4-C4 A ${suffix}`, usuario: `test-f4c4a-${suffix}`, email: `test-f4c4a-${suffix}@example.test`, password: "fixture", rubro: "negocio", aprobado: true, suspendido: false, empleadosActivos: true, salonActivo: true, cajaTurnosModo: "OPCIONAL" },
  })
  const owner = `${SESSION_COOKIE_NAME}=${await createSession(negocio.id, "negocio")}`
  const producto = await db.producto.create({ data: { nombre: "Saphirus", precio: 2000, negocioId: negocio.id } })
  const venta = await json(await postVentaOwner(req("/api/negocio/caja/ventas", owner, { metodoPago: "EFECTIVO", items: [{ productoId: producto.id, cantidad: 2 }] }, randomUUID())))
  expect(venta.status).toBe(201)
  const ventaId: string = venta.body.id
  const itemId: string = venta.body.items[0].id
  const devolver = async (key: string) =>
    json(await postDevolucionOwner(req(`/api/negocio/caja/ventas/${ventaId}/devoluciones`, owner, { tipo: "DEVOLUCION_PARCIAL", motivo: "Devuelve", items: [{ ventaItemId: itemId, cantidad: 1, reingresaStock: false }], reintegro: { modo: "PENDIENTE" }, confirmo: true }, key), { params: Promise.resolve({ id: ventaId }) }))
  const auditorias = async () => db.auditLog.findMany({ where: { accion: "venta.devolucion_parcial", recursoId: ventaId } })
  return { negocio, ventaId, devolver, auditorias }
}

describe("F4-C4 — F4-A return audit is independent of the later detail read", () => {
  ephemeralTest("the detail read fails after commit: the return is kept with exactly ONE audit; the same-key retry replays without a second audit", async () => {
    const e = await escenario()
    const key = randomUUID()
    fallas.detalle = true
    try {
      const r = await e.devolver(key)
      expect(r.status).toBe(500)
      expect(r.body.error).toContain("Podés reintentar sin duplicarla")
    } finally {
      fallas.detalle = false
    }
    expect(await db.devolucionVenta.count({ where: { ventaId: e.ventaId } })).toBe(1)
    const audits = await e.auditorias()
    expect(audits).toHaveLength(1)
    expect(JSON.parse(audits[0].detalle).precioHeredado).toEqual({ evidencia: "VERIFICADA", ventaItemIds: [] })
    const again = await e.devolver(key)
    expect([again.status, again.replayed]).toEqual([200, true])
    expect(await e.auditorias()).toHaveLength(1)
    expect(await db.devolucionVenta.count({ where: { ventaId: e.ventaId } })).toBe(1)
  })

  ephemeralTest("the evidence cannot be read: the audit is written and says NO_DISPONIBLE (no list presented as checked)", async () => {
    const e = await escenario()
    fallas.evidencia = true
    try {
      expect((await e.devolver(randomUUID())).status).toBe(201)
    } finally {
      fallas.evidencia = false
    }
    const audits = await e.auditorias()
    expect(audits).toHaveLength(1)
    const detalle = JSON.parse(audits[0].detalle)
    expect(detalle.precioHeredado).toEqual({ evidencia: "NO_DISPONIBLE" })
    expect(detalle.items).toHaveLength(1) // the rest of the F4-A audit is intact
  })

  ephemeralTest("normal path: the evidence is VERIFICADA and the F4-A response is unchanged", async () => {
    const e = await escenario()
    const r = await e.devolver(randomUUID())
    expect(r.status).toBe(201)
    expect(r.body.devolucion).toMatchObject({ tipo: "DEVOLUCION_PARCIAL", importe: 2000, reintegroEstado: "PENDIENTE" })
    expect(r.body.venta.estadoDevolucion).toBe("DEVOLUCION_PARCIAL")
    const audits = await e.auditorias()
    expect(audits).toHaveLength(1)
    expect(JSON.parse(audits[0].detalle).precioHeredado).toEqual({ evidencia: "VERIFICADA", ventaItemIds: [] })
  })
})
