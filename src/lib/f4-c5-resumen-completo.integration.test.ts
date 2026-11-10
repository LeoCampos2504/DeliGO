/// <reference types="bun-types" />
// ============================================
// F4-C5 (B1) — the owner daily summary counts EVERY sale of the day
// (REAL ephemeral PostgreSQL)
// ============================================
// The listing keeps its 100-sale limit; every financial total (count, sold,
// cash / transfer / other, net, exchanges, internal compensation, refunds
// paid and pending, returns) covers all sales. Expected figures are computed
// INDEPENDENTLY in integer cents (never with the money helpers). Also: stable
// pages (ties of createdAt across page boundaries, no omission nor duplicate),
// legacy sales without cobros, separation between businesses, the day
// boundary, and a point-in-time read while sales keep arriving.

import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { createSession, SESSION_COOKIE_NAME } from "@/lib/auth"
import { GET as getVentasHoy, POST as postVentaOwner } from "@/app/api/negocio/caja/ventas/route"
import { POST as postCambioOwner } from "@/app/api/negocio/caja/ventas/[id]/cambios/route"
import { POST as postDevolucionOwner } from "@/app/api/negocio/caja/ventas/[id]/devoluciones/route"
import { resumirCobrosCajaDesde } from "@/lib/caja-resumen-cobros"

setDefaultTimeout(600_000)

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

const inicioDelDia = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0) // the route's own day semantics
  return d
}

async function crearNegocio() {
  const suffix = randomUUID()
  const negocio = await db.negocio.create({
    data: { slug: `test-f4c5r-${suffix}`, nombre: `Test F4-C5 R ${suffix}`, usuario: `test-f4c5r-${suffix}`, email: `test-f4c5r-${suffix}@example.test`, password: "fixture", rubro: "negocio", aprobado: true, suspendido: false, empleadosActivos: true, salonActivo: true, cajaTurnosModo: "OPCIONAL" },
  })
  return { negocio, owner: `${SESSION_COOKIE_NAME}=${await createSession(negocio.id, "negocio")}` }
}

type Medio = "EFECTIVO" | "TRANSFERENCIA" | "OTRO"
const MEDIOS: Medio[] = ["EFECTIVO", "TRANSFERENCIA", "OTRO"]
/** Independent expectation, integer cents. */
type Esperado = { cantidad: number; vendido: number; porMedio: Record<Medio, number>; ids: string[] }
const vacio = (): Esperado => ({ cantidad: 0, vendido: 0, porMedio: { EFECTIVO: 0, TRANSFERENCIA: 0, OTRO: 0 }, ids: [] })

/**
 * n sales written directly (fast), with cobros, every 10th a LEGACY sale (Float
 * total only, no cobro), and createdAt values repeated in groups of `empates`
 * so many sales share the exact same instant.
 */
async function sembrar(negocioId: string, n: number, opts: { desde: Date; empates?: number; esperado: Esperado; offsetMs?: number }) {
  const empates = opts.empates ?? 4
  const filas = Array.from({ length: n }, (_, i) => {
    const medio = MEDIOS[i % 3]
    const legacy = i % 10 === 9
    const centavos = legacy ? 70 + (i % 5) * 10 : 1001 + (i % 13) * 37 // e.g. 10.01, 10.38, …
    return { i, medio, legacy, centavos, createdAt: new Date(opts.desde.getTime() + (opts.offsetMs ?? 60_000) + Math.floor(i / empates) * 1000) }
  })
  for (let k = 0; k < filas.length; k += 500) {
    const lote = filas.slice(k, k + 500)
    const ventas = await db.venta.createManyAndReturn({
      data: lote.map((f) => ({
        negocioId,
        total: f.centavos / 100,
        totalDecimal: f.legacy ? null : new Prisma.Decimal(f.centavos).dividedBy(100),
        metodoPago: f.medio,
        cantidadItems: 1,
        createdAt: f.createdAt,
      })),
      select: { id: true },
    })
    await db.cobroVenta.createMany({
      data: ventas.flatMap((v, j) => (lote[j].legacy ? [] : [{ negocioId, ventaId: v.id, metodo: lote[j].medio, importe: lote[j].centavos / 100, importeDecimal: new Prisma.Decimal(lote[j].centavos).dividedBy(100) }])),
    })
    ventas.forEach((v, j) => {
      opts.esperado.cantidad++
      opts.esperado.vendido += lote[j].centavos
      opts.esperado.porMedio[lote[j].medio] += lote[j].centavos
      opts.esperado.ids.push(v.id)
    })
  }
}

const json = async (res: Response) => ({ status: res.status, body: await res.json() })
const req = (url: string, cookie: string, method = "GET", body?: unknown, key?: string) =>
  new NextRequest(`http://localhost${url}`, { method, headers: { cookie, "content-type": "application/json", ...(key ? { "idempotency-key": key } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
const idCtx = (id: string) => ({ params: Promise.resolve({ id }) })
const cents = (n: number) => Math.round(n * 100)

async function resumenDelDia(owner: string) {
  const r = await json(await getVentasHoy(req("/api/negocio/caja/ventas", owner)))
  expect(r.status).toBe(200)
  return r.body as { ventasHoy: unknown[]; resumenHoy: Record<string, number>; desgloseHoy: Record<string, unknown> }
}

function esperarTotales(r: Awaited<ReturnType<typeof resumenDelDia>>, e: Esperado, devueltoCentavos = 0) {
  expect(r.resumenHoy.cantidadVentas).toBe(e.cantidad)
  expect(cents(r.resumenHoy.totalVendido)).toBe(e.vendido)
  expect(cents(r.resumenHoy.totalEfectivo)).toBe(e.porMedio.EFECTIVO)
  expect(cents(r.resumenHoy.totalTransferencia)).toBe(e.porMedio.TRANSFERENCIA)
  expect(cents(r.resumenHoy.totalOtro)).toBe(e.porMedio.OTRO)
  expect(cents(r.resumenHoy.totalDevuelto)).toBe(devueltoCentavos)
  expect(cents(r.resumenHoy.totalNeto)).toBe(e.vendido - devueltoCentavos)
  expect(r.ventasHoy.length).toBe(Math.min(e.cantidad, 100)) // the VISUAL listing keeps its limit
}

describe("F4-C5 (B1) — daily totals over every sale", () => {
  ephemeralTest("a day without sales: zeros, empty listing", async () => {
    const { owner } = await crearNegocio()
    const r = await resumenDelDia(owner)
    esperarTotales(r, vacio())
    expect(r.desgloseHoy.compensacionInterna).toBe(0)
  })

  for (const n of [100, 101, 500, 1000]) {
    ephemeralTest(`${n} sales (mixed methods, legacy rows without cobros, tied instants): every total is complete`, async () => {
      const { negocio, owner } = await crearNegocio()
      const e = vacio()
      await sembrar(negocio.id, n, { desde: inicioDelDia(), esperado: e })
      // another business with sales at the very same instants never leaks in
      const otro = await crearNegocio()
      await sembrar(otro.negocio.id, 150, { desde: inicioDelDia(), esperado: vacio() })
      // a sale of YESTERDAY (one millisecond before the day starts) is not today's
      await db.venta.create({ data: { negocioId: negocio.id, total: 99, totalDecimal: "99.00", metodoPago: "EFECTIVO", cantidadItems: 1, createdAt: new Date(inicioDelDia().getTime() - 1) } })
      const r = await resumenDelDia(owner)
      esperarTotales(r, e)
      expect(r.desgloseHoy.compensacionInterna).toBe(0)
      expect(r.desgloseHoy.porCambios).toEqual({ cantidadVentas: 0, ventas: 0, cantidadDevoluciones: 0, devuelto: 0 })
    })
  }

  ephemeralTest("exchanges, internal compensation, money differences, refunds paid and pending — on top of 495 other sales", async () => {
    const { negocio, owner } = await crearNegocio()
    const e = vacio()
    await sembrar(negocio.id, 495, { desde: inicioDelDia(), esperado: e, offsetMs: 1000 })
    const saphirus = await db.producto.create({ data: { nombre: "Saphirus", precio: 2000, negocioId: negocio.id } })
    const redmi = await db.producto.create({ data: { nombre: "Redmi", precio: 1000, negocioId: negocio.id } })
    const vender = async (productoId: string, cantidad: number, metodoPago: Medio) => {
      const v = await json(await postVentaOwner(req("/api/negocio/caja/ventas", owner, "POST", { metodoPago, items: [{ productoId, cantidad }] }, randomUUID())))
      expect(v.status).toBe(201)
      return v.body as { id: string; items: Array<{ id: string }> }
    }
    const cambiar = async (venta: { id: string; items: Array<{ id: string }> }, entra: string, salida: string, entrada: string, extra: Record<string, unknown>) => {
      const c = await json(await postCambioOwner(req(`/api/negocio/caja/ventas/${venta.id}/cambios`, owner, "POST", { motivo: "Cambio", salen: [{ ventaItemId: venta.items[0].id, cantidad: 1, reingresaStock: true }], entran: [{ productoId: entra, cantidad: 1 }], esperado: { salida, entrada }, confirmo: true, ...extra }, randomUUID()), idCtx(venta.id)))
      expect(c.status).toBe(201)
    }
    const a = await vender(saphirus.id, 3, "EFECTIVO") // 6000 cash
    await cambiar(a, redmi.id, "2000.00", "1000.00", { reintegro: { modo: "REALIZADO", medio: "EFECTIVO" } }) // CAMBIO sale 1000 (credit 1000), D− 1000 paid in cash
    await cambiar(a, redmi.id, "2000.00", "1000.00", { reintegro: { modo: "PENDIENTE" } }) // CAMBIO sale 1000 (credit 1000), D− 1000 pending
    const b = await vender(redmi.id, 1, "EFECTIVO") // 1000 cash
    await cambiar(b, saphirus.id, "1000.00", "2000.00", { medioDiferencia: "TRANSFERENCIA" }) // CAMBIO sale 2000 = credit 1000 + D+ 1000 by transfer
    const dev = await json(await postDevolucionOwner(req(`/api/negocio/caja/ventas/${a.id}/devoluciones`, owner, "POST", { tipo: "DEVOLUCION_PARCIAL", motivo: "Devuelve", items: [{ ventaItemId: a.items[0].id, cantidad: 1, reingresaStock: false }], reintegro: { modo: "REALIZADO", medio: "OTRO" }, confirmo: true }, randomUUID()), idCtx(a.id)))
    expect(dev.status).toBe(201) // plain F4-A return 2000 refunded by «otro»

    // independent expectation (cents)
    e.cantidad += 5
    e.vendido += 600000 + 100000 + 100000 + 100000 + 200000
    e.porMedio.EFECTIVO += 600000 + 100000 // the credit is NEVER money
    e.porMedio.TRANSFERENCIA += 100000 // only D+
    const r = await resumenDelDia(owner)
    esperarTotales(r, e, 200000 + 200000 + 100000 + 200000) // returns: 2 exchanges × 2000, 1 exchange × 1000, F4-A 2000
    expect(r.desgloseHoy).toEqual({
      porCambios: { cantidadVentas: 3, ventas: 4000, cantidadDevoluciones: 3, devuelto: 5000 },
      reintegrosPagados: { EFECTIVO: 1000, TRANSFERENCIA: 0, OTRO: 2000, total: 3000, cantidad: 2, porCambios: 1000 },
      reintegrosPendientes: { total: 1000, cantidad: 1 },
      reintegrosPendientesHoy: { total: 1000, cantidad: 1 },
      compensacionInterna: 3000,
    })
  })

  ephemeralTest("stable pages: ties of createdAt across many page boundaries → every sale exactly once, same totals as one big page", async () => {
    const { negocio } = await crearNegocio()
    const e = vacio()
    await sembrar(negocio.id, 101, { desde: inicioDelDia(), esperado: e, empates: 25 }) // only 5 distinct instants
    const leidas: string[] = []
    const espia = {
      venta: { findMany: (async (args: Parameters<typeof db.venta.findMany>[0]) => { const r = await db.venta.findMany(args); leidas.push(...r.map((v) => v.id)); return r }) as unknown as typeof db.venta.findMany },
      cobroVenta: db.cobroVenta,
    } as unknown as Parameters<typeof resumirCobrosCajaDesde>[0]
    const chico = await resumirCobrosCajaDesde(espia, negocio.id, inicioDelDia(), { tamanoPagina: 7 })
    expect(leidas.length).toBe(101)
    expect(new Set(leidas).size).toBe(101)
    expect([...leidas].sort()).toEqual([...e.ids].sort())
    const grande = await resumirCobrosCajaDesde(db, negocio.id, inicioDelDia(), { tamanoPagina: 10_000 })
    expect(chico.resumen).toEqual(grande.resumen)
    expect(chico.resumen.cantidadVentas).toBe(e.cantidad)
    expect(cents(Number(chico.resumen.ventasBrutas))).toBe(e.vendido)
    for (const m of MEDIOS) expect(cents(Number(chico.resumen.cobradoPorMedio[m]))).toBe(e.porMedio[m])
    expect(chico.resumen.ventasSinCobros).toBe(10)
  })

  ephemeralTest("point-in-time read: a sale committed while the pages are being read is not mixed into that result", async () => {
    const { negocio } = await crearNegocio()
    const e = vacio()
    await sembrar(negocio.id, 30, { desde: inicioDelDia(), esperado: e, empates: 1 })
    let insertada = false
    const total = await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY")
      const espia = {
        venta: { findMany: (async (args: Parameters<typeof tx.venta.findMany>[0]) => {
          const r = await tx.venta.findMany(args)
          if (!insertada) {
            insertada = true // another connection commits a new sale AFTER the snapshot, inside the range of a later page
            await db.venta.create({ data: { negocioId: negocio.id, total: 500, totalDecimal: "500.00", metodoPago: "EFECTIVO", cantidadItems: 1, createdAt: new Date(inicioDelDia().getTime() + 3_600_000) } })
          }
          return r
        }) as unknown as typeof tx.venta.findMany },
        cobroVenta: tx.cobroVenta,
      } as unknown as Parameters<typeof resumirCobrosCajaDesde>[0]
      return resumirCobrosCajaDesde(espia, negocio.id, inicioDelDia(), { tamanoPagina: 10 })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead })
    expect(insertada).toBe(true)
    expect(total.resumen.cantidadVentas).toBe(30)
    expect(cents(Number(total.resumen.ventasBrutas))).toBe(e.vendido)
    // the next read sees it
    const despues = await resumirCobrosCajaDesde(db, negocio.id, inicioDelDia())
    expect(despues.resumen.cantidadVentas).toBe(31)
  })
})
