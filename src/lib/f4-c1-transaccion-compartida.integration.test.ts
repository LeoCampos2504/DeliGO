/// <reference types="bun-types" />

// ============================================
// F4-C1 — sale and return engines composed in ONE Serializable transaction
// (REAL ephemeral PostgreSQL)
// ============================================
// F4-C1 only prepares the engines: no CambioVenta, no CREDITO_CAMBIO, no new
// commercial operation. These tests prove the in-transaction cores can share
// one transaction opened by the existing runners: they commit together, any
// refusal or stock error rolls BOTH back, active order reservations are still
// respected, idempotent re-runs write nothing, and two composed transactions
// racing for the same unit never both commit. Isolated fixtures (random ids).

import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { registrarVentaCaja, registrarVentaCajaEnTx, type RegistrarVentaCajaInput } from "@/lib/caja-venta-service"
import { registrarDevolucionVentaEnTx, runSerializable, type RegistrarDevolucionInput } from "@/lib/caja-devoluciones-service"
import { exigirResultadoOk, resolverAbortoCompartido } from "@/lib/caja-transaccion-compartida"
import { isStockSerializationConflict, leerDisponibilidadStock, reservarStockPedido, runStockSerializable, StockLifecycleError } from "@/lib/stock-lifecycle"
import { stockKey } from "@/lib/stock-authority"

setDefaultTimeout(240_000)

const testDatabaseUrl = process.env.DELIGO_TEST_DATABASE_URL
const isEphemeralIntegrationDb = process.env.DELIGO_EPHEMERAL_TEST_DB === "1"
if (!testDatabaseUrl || process.env.DATABASE_URL !== testDatabaseUrl) {
  throw new Error("Este test de integración requiere DELIGO_TEST_DATABASE_URL y DATABASE_URL apuntando a la misma base de prueba.")
}
const declaredEnvironment = process.env.DELIGO_ENVIRONMENT ?? process.env.RAILWAY_ENVIRONMENT_NAME ?? process.env.APP_ENV
if (!declaredEnvironment || declaredEnvironment.toUpperCase() !== "TESTING") {
  throw new Error("La suite F4-C1 sólo puede ejecutarse con DELIGO_ENVIRONMENT=TESTING.")
}

// Writes real rows: only against the ephemeral test database.
const ephemeralTest = isEphemeralIntegrationDb ? test : test.skip

afterAll(async () => {
  await db.$disconnect()
})

const OWNER = { tipo: "NEGOCIO" as const }

async function crearNegocio() {
  const suffix = randomUUID()
  return db.negocio.create({
    data: {
      slug: `test-f4c1-${suffix}`,
      nombre: `Test F4-C1 ${suffix}`,
      usuario: `test-f4c1-${suffix}`,
      email: `test-f4c1-${suffix}@example.test`,
      password: "fixture",
      rubro: "negocio",
      aprobado: true,
      suspendido: false,
      empleadosActivos: true,
      salonActivo: true,
      cajaTurnosModo: "OPCIONAL",
    },
  })
}

async function crearProducto(negocioId: string, nombre: string, precio: number, stockCantidad: number) {
  return db.producto.create({ data: { nombre, precio, negocioId, controlStock: true, stockCantidad } })
}

const stockDe = async (productoId: string) => (await db.producto.findUniqueOrThrow({ where: { id: productoId }, select: { stockCantidad: true } })).stockCantidad

function entradaVenta(negocioId: string, lines: Array<{ productoId: string; cantidad: number }>, idempotencyKey = randomUUID()): RegistrarVentaCajaInput {
  return { negocioId, actor: OWNER, metodoPago: "EFECTIVO", lines, idempotencyKey }
}

async function vender(negocioId: string, lines: Array<{ productoId: string; cantidad: number }>) {
  const result = await registrarVentaCaja(db, entradaVenta(negocioId, lines))
  if (!result.ok) throw new Error(`venta rechazada: ${result.error}`)
  return result.venta
}

function entradaDevolucion(negocioId: string, ventaId: string, ventaItemId: string, cantidad: number, idempotencyKey = randomUUID()): RegistrarDevolucionInput {
  return {
    negocioId,
    actor: OWNER,
    ventaId,
    idempotencyKey,
    solicitud: {
      tipo: "DEVOLUCION_PARCIAL",
      motivo: "F4-C1: composición de motores",
      reintegro: { modo: "NO_CORRESPONDE" },
      lineas: [{ ventaItemId, cantidad: new Prisma.Decimal(cantidad), reingresaStock: true }],
      cajaFisicaId: null,
    },
  }
}

async function conteos(negocioId: string) {
  const [ventas, cobros, operaciones, devoluciones, movimientos] = await Promise.all([
    db.venta.count({ where: { negocioId } }),
    db.cobroVenta.count({ where: { negocioId } }),
    db.operacionFinanciera.count({ where: { negocioId } }),
    db.devolucionVenta.count({ where: { negocioId } }),
    db.movimientoInventario.count({ where: { negocioId } }),
  ])
  return { ventas, cobros, operaciones, devoluciones, movimientos }
}

// Return of the outgoing unit + sale of the incoming product, in this order,
// inside ONE transaction opened by `runner`.
function compuesta(devolucion: RegistrarDevolucionInput, venta: RegistrarVentaCajaInput) {
  return async (tx: Prisma.TransactionClient) => {
    const dev = exigirResultadoOk(await registrarDevolucionVentaEnTx(tx, devolucion))
    const nueva = exigirResultadoOk(await registrarVentaCajaEnTx(tx, venta))
    return { devolucion: dev.value.devolucion, devolucionReplayed: dev.value.replayed, venta: nueva.venta, ventaReplayed: nueva.replayed }
  }
}

describe("F4-C1 — engines composed in one Serializable transaction", () => {
  ephemeralTest("return + sale commit together: exact amounts, stock both ways, one cobro and one cash operation", async () => {
    const negocio = await crearNegocio()
    const cola = await crearProducto(negocio.id, "Gaseosa Cola", 2000, 10)
    const lima = await crearProducto(negocio.id, "Gaseosa Lima", 1000, 10)
    const original = await vender(negocio.id, [{ productoId: cola.id, cantidad: 2 }])
    const antes = await conteos(negocio.id)

    const result = await runStockSerializable(db, compuesta(
      entradaDevolucion(negocio.id, original.id, original.items[0].id, 1),
      entradaVenta(negocio.id, [{ productoId: lima.id, cantidad: 2 }]),
    ))

    expect(result.devolucionReplayed).toBe(false)
    expect(result.ventaReplayed).toBe(false)
    expect(result.devolucion.importeDecimal.toString()).toBe("2000")
    expect(result.devolucion.items.map((i) => i.stockResultado)).toEqual(["REINGRESADO"])
    expect(result.venta.total).toBe(2000)
    expect(await stockDe(cola.id)).toBe(9) // 10 − 2 sold + 1 returned
    expect(await stockDe(lima.id)).toBe(8)
    const despues = await conteos(negocio.id)
    expect(despues).toEqual({
      ventas: antes.ventas + 1,
      cobros: antes.cobros + 1,
      operaciones: antes.operaciones + 1, // the new cash sale; the return refunds nothing
      devoluciones: antes.devoluciones + 1,
      movimientos: antes.movimientos + 2, // DEVOLUCION (cola) + VENTA (lima)
    })
    // The original sale is never edited.
    expect(await db.venta.findUniqueOrThrow({ where: { id: original.id }, include: { items: true } })).toEqual(original)
  })

  ephemeralTest("a refusal of the second engine rolls back the first (nothing written)", async () => {
    const negocio = await crearNegocio()
    const otro = await crearNegocio()
    const cola = await crearProducto(negocio.id, "Gaseosa Cola", 2000, 10)
    const ajeno = await crearProducto(otro.id, "Producto ajeno", 1000, 10)
    const original = await vender(negocio.id, [{ productoId: cola.id, cantidad: 2 }])
    const antes = await conteos(negocio.id)

    const result = await resolverAbortoCompartido(() => runStockSerializable(db, compuesta(
      entradaDevolucion(negocio.id, original.id, original.items[0].id, 1),
      entradaVenta(negocio.id, [{ productoId: ajeno.id, cantidad: 1 }]),
    )))

    expect(result).toMatchObject({ ok: false, status: 400 })
    expect(await conteos(negocio.id)).toEqual(antes)
    expect(await stockDe(cola.id)).toBe(8) // the return's stock re-entry was rolled back
    expect(await stockDe(ajeno.id)).toBe(10)
  })

  ephemeralTest("a refusal of the first engine stops before the second (sale first, return over the sold quantity)", async () => {
    const negocio = await crearNegocio()
    const cola = await crearProducto(negocio.id, "Gaseosa Cola", 2000, 10)
    const lima = await crearProducto(negocio.id, "Gaseosa Lima", 1000, 10)
    const original = await vender(negocio.id, [{ productoId: cola.id, cantidad: 1 }])
    const antes = await conteos(negocio.id)

    const result = await resolverAbortoCompartido(() => runSerializable(db, async (tx) => {
      exigirResultadoOk(await registrarVentaCajaEnTx(tx, entradaVenta(negocio.id, [{ productoId: lima.id, cantidad: 3 }])))
      return exigirResultadoOk(await registrarDevolucionVentaEnTx(tx, entradaDevolucion(negocio.id, original.id, original.items[0].id, 2)))
    }))

    expect(result).toMatchObject({ ok: false, status: 409, code: "CANTIDAD_DEVOLUCION_EXCEDIDA" })
    expect(await conteos(negocio.id)).toEqual(antes) // the sale written first was rolled back
    expect(await stockDe(lima.id)).toBe(10)
    expect(await stockDe(cola.id)).toBe(9)
  })

  ephemeralTest("incoming stock respects ACTIVE order reservations; the stock error rolls back the return", async () => {
    const negocio = await crearNegocio()
    const cola = await crearProducto(negocio.id, "Gaseosa Cola", 2000, 10)
    const lima = await crearProducto(negocio.id, "Gaseosa Lima", 1000, 3)
    const original = await vender(negocio.id, [{ productoId: cola.id, cantidad: 2 }])
    await reservar(negocio, lima.id, 2) // physical 3, reserved 2 → available 1
    const antes = await conteos(negocio.id)

    let error: unknown
    try {
      await runStockSerializable(db, compuesta(
        entradaDevolucion(negocio.id, original.id, original.items[0].id, 1),
        entradaVenta(negocio.id, [{ productoId: lima.id, cantidad: 2 }]),
      ))
    } catch (e) {
      error = e
    }
    expect(error).toBeInstanceOf(StockLifecycleError)
    expect((error as StockLifecycleError).code).toBe("STOCK_RESERVED_FOR_ORDERS")
    expect(await conteos(negocio.id)).toEqual(antes)
    expect(await stockDe(cola.id)).toBe(8)
    expect(await stockDe(lima.id)).toBe(3)
    expect(await reservasActivas(negocio.id, lima.id)).toBe(2)

    // Within the available quantity the same composition commits.
    const ok = await runStockSerializable(db, compuesta(
      entradaDevolucion(negocio.id, original.id, original.items[0].id, 1),
      entradaVenta(negocio.id, [{ productoId: lima.id, cantidad: 1 }]),
    ))
    expect(ok.venta.total).toBe(1000)
    expect(await stockDe(lima.id)).toBe(2)
    expect(await reservasActivas(negocio.id, lima.id)).toBe(2)
  })

  ephemeralTest("re-running the composition with the same keys replays both engines and writes nothing", async () => {
    const negocio = await crearNegocio()
    const cola = await crearProducto(negocio.id, "Gaseosa Cola", 2000, 10)
    const lima = await crearProducto(negocio.id, "Gaseosa Lima", 1000, 10)
    const original = await vender(negocio.id, [{ productoId: cola.id, cantidad: 2 }])
    const devolucion = entradaDevolucion(negocio.id, original.id, original.items[0].id, 1)
    const venta = entradaVenta(negocio.id, [{ productoId: lima.id, cantidad: 1 }])

    const primera = await runStockSerializable(db, compuesta(devolucion, venta))
    const tras = await conteos(negocio.id)
    const segunda = await runStockSerializable(db, compuesta(devolucion, venta))

    expect(segunda.devolucionReplayed).toBe(true)
    expect(segunda.ventaReplayed).toBe(true)
    expect(segunda.devolucion.id).toBe(primera.devolucion.id)
    expect(segunda.venta.id).toBe(primera.venta.id)
    expect(await conteos(negocio.id)).toEqual(tras)
    expect(await stockDe(cola.id)).toBe(9)
    expect(await stockDe(lima.id)).toBe(9)
  })

  ephemeralTest("two composed transactions racing for the last unit: exactly one commits, nothing is written twice", async () => {
    const negocio = await crearNegocio()
    const cola = await crearProducto(negocio.id, "Gaseosa Cola", 2000, 10)
    const lima = await crearProducto(negocio.id, "Gaseosa Lima", 1000, 10)
    const original = await vender(negocio.id, [{ productoId: cola.id, cantidad: 1 }])
    const antes = await conteos(negocio.id)

    const intento = () => resolverAbortoCompartido(() => runSerializable(db, compuesta(
      entradaDevolucion(negocio.id, original.id, original.items[0].id, 1),
      entradaVenta(negocio.id, [{ productoId: lima.id, cantidad: 1 }]),
    ))).catch((error: unknown) => {
      if (isStockSerializationConflict(error)) return { ok: false as const, status: 409, error: "conflicto", code: "SERIALIZATION" }
      throw error
    })
    const resultados = await Promise.all([intento(), intento()])

    const confirmados = resultados.filter((r) => !("ok" in r && r.ok === false))
    expect(confirmados).toHaveLength(1)
    const rechazado = resultados.find((r) => "ok" in r && r.ok === false) as { code?: string }
    expect(["CANTIDAD_DEVOLUCION_EXCEDIDA", "SERIALIZATION"]).toContain(rechazado.code ?? "")
    const despues = await conteos(negocio.id)
    expect(despues.devoluciones).toBe(antes.devoluciones + 1)
    expect(despues.ventas).toBe(antes.ventas + 1)
    expect(despues.cobros).toBe(antes.cobros + 1)
    expect(await stockDe(cola.id)).toBe(10) // 10 − 1 sold + 1 returned once
    expect(await stockDe(lima.id)).toBe(9)
  })
})

// Active order reservations through the existing authorities (same pattern as
// the F4-B real-DB suite): availability by leerDisponibilidadStock and the
// ACTIVA row by reservarStockPedido, in a Serializable transaction.
class ReservaRechazada extends Error {}

async function reservar(negocio: { id: string; slug: string }, productoId: string, cantidad: number) {
  const pedido = await db.pedido.create({
    data: { negocioId: negocio.id, negocioSlug: negocio.slug, negocioNombre: "N", clienteNombre: "C", metodoEntrega: "retiro", estado: "recibido", total: 100, totalProductos: 100, idempotencyKey: `test-f4c1-${randomUUID()}` },
  })
  const item = await db.pedidoItem.create({ data: { pedidoId: pedido.id, productoId, productoVarianteId: null, nombre: "R", precio: 100, cantidad } })
  for (let attempt = 1; ; attempt++) {
    try {
      return await runStockSerializable(db, async (tx) => {
        const key = { productoId, productoVarianteId: null }
        const disponibilidad = await leerDisponibilidadStock(tx, { negocioId: negocio.id, key })
        if (!disponibilidad || cantidad > disponibilidad.available) throw new ReservaRechazada("sin disponible")
        return reservarStockPedido(tx, {
          negocioId: negocio.id,
          pedidoId: pedido.id,
          lines: [{ pedidoItemId: item.id, productoId, productoVarianteId: null, cantidad, controlStock: true }],
          plan: { reservar: true, mode: "ON", reservedKeys: new Set([stockKey(productoId, null)]) },
        })
      })
    } catch (error) {
      if (!isStockSerializationConflict(error) || attempt >= 8) throw error
    }
  }
}

async function reservasActivas(negocioId: string, productoId: string) {
  const rows = await db.reservaStock.findMany({ where: { negocioId, productoId, productoVarianteId: null, estado: "ACTIVA" }, select: { cantidad: true } })
  return rows.reduce((acc, r) => acc + r.cantidad, 0)
}
