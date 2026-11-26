/// <reference types="bun-types" />
// ============================================
// F10-C2c / Bloque 4 C5 — el servidor rechaza cobrar con un INICIO DE VENTA VENCIDO (PostgreSQL REAL efímero)
// ============================================
// Ruta real del cajero (POST /api/operativo/caja/[slug]/ventas) y motor real de ventas (registrarVentaCaja →
// tomarInicioVentaEnTx), sin mocks. Cada caso usa su propio negocio sintético (ids aleatorios), con un cajero real
// (sesión operativa) y un producto con control de stock.
//   1. Negativo: un inicio vencido (creado SÓLO como dato de prueba: iniciadaEn = ahora − 31 min, expiraEn = ahora − 1 min;
//      la restricción de plazo se cumple y el trigger de inicios_venta sólo protege las actualizaciones) → 409
//      INICIO_VENTA_VENCIDO sin escribir nada: ni venta, renglones, cobros, operaciones o movimientos financieros, ni
//      movimientos de stock, cuentas, turnos o auditoría; stock intacto; el inicio queda sin usar y con sus fechas.
//   2. Control positivo: con un inicio VIGENTE creado por la ruta real, la misma venta se registra (cobro, operación y
//      movimiento de efectivo, descuento de stock, auditoría) y el inicio queda usado; el replay no duplica y el mismo
//      inicio no se puede volver a usar. Así el rechazo del caso 1 se debe al vencimiento y no al entorno.
// No cambia relojes ni registros existentes. Sólo corre contra la base efímera de CI (DELIGO_EPHEMERAL_TEST_DB=1).

import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createOperationalSession, OPERATIONAL_SESSION_COOKIE_NAME } from "@/lib/auth"
import { INICIO_VENTA_MINUTOS, INICIO_VENTA_VENCIDO_CODE } from "@/lib/inicio-venta-service"

setDefaultTimeout(180_000)

const testDatabaseUrl = process.env.DELIGO_TEST_DATABASE_URL
if (!testDatabaseUrl || process.env.DATABASE_URL !== testDatabaseUrl) {
  throw new Error("Este test de integración requiere DELIGO_TEST_DATABASE_URL y DATABASE_URL apuntando a la misma base de prueba.")
}
const declaredEnvironment = process.env.DELIGO_ENVIRONMENT ?? process.env.RAILWAY_ENVIRONMENT_NAME ?? process.env.APP_ENV
if (!declaredEnvironment || declaredEnvironment.toUpperCase() !== "TESTING") {
  throw new Error("La suite F10-C2c (inicio vencido) sólo puede ejecutarse con DELIGO_ENVIRONMENT=TESTING.")
}
if (process.env.DELIGO_EPHEMERAL_TEST_DB !== "1") {
  throw new Error("C5 requiere DELIGO_EPHEMERAL_TEST_DB=1; no se omite la prueba.")
}
const ephemeralTest = test

const { POST: postVentaCaja } = await import("@/app/api/operativo/caja/[slug]/ventas/route")
const { POST: postInicioVenta } = await import("@/app/api/operativo/caja/[slug]/ventas/inicio/route")

const PRECIO = 1000
const STOCK_INICIAL = 3

/** Negocio genérico aprobado + cajero (área caja) con sesión operativa real + producto con control de stock. */
async function escenario() {
  const s = randomUUID()
  const negocio = await db.negocio.create({
    data: { slug: `test-f10c2c-${s}`, nombre: `Test F10-C2c ${s}`, usuario: `test-f10c2c-${s}`, email: `test-f10c2c-${s}@example.test`, password: "fixture", rubro: "negocio", aprobado: true, suspendido: false, empleadosActivos: true, salonActivo: false },
  })
  const cuenta = await db.cuentaOperativa.create({ data: { nombre: `Cajero F10-C2c ${s}`, email: `test-f10c2c-cajero-${s}@example.test`, activo: true, eliminado: false } })
  const empleado = await db.empleado.create({
    data: { nombre: `Cajero ${s.slice(0, 8)}`, codigo: s.slice(0, 8).toUpperCase(), negocioId: negocio.id, cuentaOperativaId: cuenta.id, areaOperativa: "caja", activo: true, eliminado: false },
  })
  const cookie = `${OPERATIONAL_SESSION_COOKIE_NAME}=${await createOperationalSession(cuenta.id)}`
  const producto = await db.producto.create({ data: { nombre: `Producto C5 ${s.slice(0, 8)}`, precio: PRECIO, negocioId: negocio.id, controlStock: true, stockCantidad: STOCK_INICIAL } })
  return { negocio, empleado, cookie, producto }
}
type Escenario = Awaited<ReturnType<typeof escenario>>

const ctx = (slug: string) => ({ params: Promise.resolve({ slug }) })
async function vender(e: Escenario, inicioVentaId: string, key = randomUUID()) {
  const body = { metodoPago: "EFECTIVO", items: [{ productoId: e.producto.id, cantidad: 1 }], inicioVentaId, totalMostrado: PRECIO }
  const res = await postVentaCaja(
    new NextRequest(`http://localhost/api/operativo/caja/${e.negocio.slug}/ventas`, { method: "POST", headers: { "content-type": "application/json", cookie: e.cookie, "idempotency-key": key }, body: JSON.stringify(body) }),
    ctx(e.negocio.slug)
  )
  return { status: res.status, replayed: res.headers.get("Idempotency-Replayed") === "true", body: (await res.json()) as Record<string, unknown> }
}

/** Todo lo que una venta escribe (o podría escribir) en el negocio del caso, más el stock del producto. */
async function estado(e: Escenario) {
  const negocioId = e.negocio.id
  const [ventas, renglones, cobros, operaciones, movimientosFinancieros, movimientosStock, cuentas, turnos, auditoriasVenta, producto] = await Promise.all([
    db.venta.count({ where: { negocioId } }),
    db.ventaItem.count({ where: { venta: { negocioId } } }),
    db.cobroVenta.count({ where: { negocioId } }),
    db.operacionFinanciera.count({ where: { negocioId } }),
    db.movimientoFinanciero.count({ where: { negocioId } }),
    db.movimientoInventario.count({ where: { negocioId } }),
    db.cuentaFinanciera.count({ where: { negocioId } }),
    db.turnoCaja.count({ where: { negocioId } }),
    db.auditLog.count({ where: { userId: e.empleado.id, accion: "venta.creada" } }),
    db.producto.findUniqueOrThrow({ where: { id: e.producto.id }, select: { stockCantidad: true } }),
  ])
  return { ventas, renglones, cobros, operaciones, movimientosFinancieros, movimientosStock, cuentas, turnos, auditoriasVenta, stock: producto.stockCantidad }
}

describe("Bloque 4 C5 — rechazo del servidor ante un inicio de venta vencido", () => {
  ephemeralTest("caso negativo: inicio vencido → 409 INICIO_VENTA_VENCIDO y nada escrito", async () => {
    const e = await escenario()
    const ahora = Date.now()
    // Dato de prueba: inicio del MISMO cajero vencido hace 1 min (empezó hace 31 min; plazo de 30 min).
    const vencido = await db.inicioVenta.create({
      data: { negocioId: e.negocio.id, actorTipo: "EMPLEADO", actorId: e.empleado.id, iniciadaEn: new Date(ahora - 31 * 60_000), expiraEn: new Date(ahora - 60_000) },
    })
    const antes = await estado(e)
    expect(antes).toEqual({ ventas: 0, renglones: 0, cobros: 0, operaciones: 0, movimientosFinancieros: 0, movimientosStock: 0, cuentas: 0, turnos: 0, auditoriasVenta: 0, stock: STOCK_INICIAL })

    const res = await vender(e, vencido.id)
    expect(res.status).toBe(409)
    expect(res.body.ok).toBe(false)
    expect(res.body.code).toBe(INICIO_VENTA_VENCIDO_CODE)
    expect(String(res.body.error)).toContain(`más de ${INICIO_VENTA_MINUTOS} minutos`)

    // Ninguna venta, renglón, cobro, operación ni movimiento financiero o de stock; ni cuentas, turnos ni auditoría.
    expect(await estado(e)).toEqual(antes)
    // El inicio vencido sigue sin usar y con sus fechas originales.
    const despues = await db.inicioVenta.findUniqueOrThrow({ where: { id: vencido.id } })
    expect(despues.ventaId).toBeNull()
    expect(despues.usadaEn).toBeNull()
    expect(despues.iniciadaEn.getTime()).toBe(vencido.iniciadaEn.getTime())
    expect(despues.expiraEn.getTime()).toBe(vencido.expiraEn.getTime())
  })

  ephemeralTest("control positivo: inicio vigente → venta, cobro, efectivo y stock; inicio usado una sola vez", async () => {
    const e = await escenario()
    // Inicio VIGENTE creado por la ruta real (el servidor fija la hora y el plazo).
    const resInicio = await postInicioVenta(new NextRequest(`http://localhost/api/operativo/caja/${e.negocio.slug}/ventas/inicio`, { method: "POST", headers: { "content-type": "application/json", cookie: e.cookie }, body: "{}" }), ctx(e.negocio.slug))
    expect(resInicio.status).toBe(201)
    const inicioId = String(((await resInicio.json()) as { inicio: { id: string } }).inicio.id)
    const inicio = await db.inicioVenta.findUniqueOrThrow({ where: { id: inicioId } })
    expect(inicio.actorTipo).toBe("EMPLEADO")
    expect(inicio.actorId).toBe(e.empleado.id)
    expect(inicio.expiraEn.getTime() - inicio.iniciadaEn.getTime()).toBe(INICIO_VENTA_MINUTOS * 60_000)
    expect(await estado(e)).toEqual({ ventas: 0, renglones: 0, cobros: 0, operaciones: 0, movimientosFinancieros: 0, movimientosStock: 0, cuentas: 0, turnos: 0, auditoriasVenta: 0, stock: STOCK_INICIAL })

    const key = randomUUID()
    const res = await vender(e, inicioId, key)
    expect(res.status).toBe(201)
    const ventaId = String(res.body.id)
    expect(Number(res.body.total)).toBe(PRECIO)

    const tras = await estado(e)
    expect(tras).toEqual({ ventas: 1, renglones: 1, cobros: 1, operaciones: 1, movimientosFinancieros: 1, movimientosStock: 1, cuentas: 1, turnos: 0, auditoriasVenta: 1, stock: STOCK_INICIAL - 1 })
    const item = await db.ventaItem.findFirstOrThrow({ where: { ventaId } })
    expect(item.productoId).toBe(e.producto.id)
    expect(Number(item.precio)).toBe(PRECIO)
    expect(Number(item.cantidad)).toBe(1)
    const cobro = await db.cobroVenta.findFirstOrThrow({ where: { ventaId } })
    expect(cobro.metodo).toBe("EFECTIVO")
    expect(Number(cobro.importeDecimal)).toBe(PRECIO)
    const operacion = await db.operacionFinanciera.findFirstOrThrow({ where: { cobroVentaId: cobro.id }, include: { movimientos: true } })
    expect(operacion.tipo).toBe("VENTA_COBRO")
    expect(operacion.actorTipo).toBe("EMPLEADO")
    expect(operacion.actorId).toBe(e.empleado.id)
    expect(operacion.movimientos).toHaveLength(1)
    expect(Number(operacion.movimientos[0].importeDecimal)).toBe(PRECIO)
    const movStock = await db.movimientoInventario.findFirstOrThrow({ where: { ventaId } })
    expect(movStock.tipo).toBe("VENTA")
    expect(movStock.cantidad).toBe(1)
    expect(movStock.stockAntes).toBe(STOCK_INICIAL)
    expect(movStock.stockDespues).toBe(STOCK_INICIAL - 1)
    // El inicio quedó ligado a esta venta.
    const usado = await db.inicioVenta.findUniqueOrThrow({ where: { id: inicioId } })
    expect(usado.ventaId).toBe(ventaId)
    expect(usado.usadaEn).not.toBeNull()

    // Sin duplicados: el replay de la misma clave devuelve la misma venta y no escribe nada.
    const replay = await vender(e, inicioId, key)
    expect(replay.status).toBe(200)
    expect(replay.replayed).toBe(true)
    expect(String(replay.body.id)).toBe(ventaId)
    expect(await estado(e)).toEqual(tras)
    // Uso único: el mismo inicio con otra clave se rechaza (409) sin escribir nada.
    const reuso = await vender(e, inicioId)
    expect(reuso.status).toBe(409)
    expect(reuso.body.code).toBe(INICIO_VENTA_VENCIDO_CODE)
    expect(await estado(e)).toEqual(tras)
  })
})
