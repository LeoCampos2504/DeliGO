/// <reference types="bun-types" />
// ============================================
// F10-C2a — compras y recepciones de mercadería, sobre PostgreSQL REAL efímero
// ============================================
// Por las rutas reales del dueño y del cajero: borradores que no mueven nada, recepción completa y
// parcial contra un pedido, excedentes y dañados, costos con descuentos / impuestos / percepciones /
// cargos accesorios, productos sin control de stock, aprobación y rechazo (sólo dueño), doble clic,
// replays y aprobaciones concurrentes (el stock entra UNA vez), versión vista, anticipos con el motor
// de F5 (y rollback total si fallan), último costo en orden real, comprobantes duplicados, pedidos
// cerrados / anulados, auditoría en la transacción y rollback, aislamiento, y guardas SQL.

import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import type { Prisma, PrismaClient } from "@prisma/client"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createOperationalSession, createSession, OPERATIONAL_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/auth"
import { aprobarRecepcion } from "@/lib/compras-recepciones-service"
import { conPrecioDeCatalogoEnTx } from "@/lib/etiquetas-precio-service"
import { CatalogoError, editarProductoEmpleado } from "@/lib/catalogo-empleado-service"
import { ejecutarImportacion, previsualizarImportacion } from "@/lib/importacion-productos-service"

setDefaultTimeout(300_000)

const testDatabaseUrl = process.env.DELIGO_TEST_DATABASE_URL
const isEphemeralIntegrationDb = process.env.DELIGO_EPHEMERAL_TEST_DB === "1"
if (!testDatabaseUrl || process.env.DATABASE_URL !== testDatabaseUrl) {
  throw new Error("Este test de integración requiere DELIGO_TEST_DATABASE_URL y DATABASE_URL apuntando a la misma base de prueba.")
}
const declaredEnvironment = process.env.DELIGO_ENVIRONMENT ?? process.env.RAILWAY_ENVIRONMENT_NAME ?? process.env.APP_ENV
if (!declaredEnvironment || declaredEnvironment.toUpperCase() !== "TESTING") {
  throw new Error("La suite F10-C2a sólo puede ejecutarse con DELIGO_ENVIRONMENT=TESTING.")
}
const ephemeralTest = isEphemeralIntegrationDb ? test : test.skip

const { GET: getRecepciones, POST: postRecepcion } = await import("@/app/api/negocio/recepciones/route")
const { GET: getRecepcion, PUT: putRecepcion } = await import("@/app/api/negocio/recepciones/[id]/route")
const { GET: getVistaPrevia } = await import("@/app/api/negocio/recepciones/[id]/vista-previa/route")
const { POST: postAprobacion } = await import("@/app/api/negocio/recepciones/[id]/aprobacion/route")
const { POST: postAccion } = await import("@/app/api/negocio/recepciones/[id]/[accion]/route")
const { POST: postCompra } = await import("@/app/api/negocio/compras/route")
const { GET: getCompra } = await import("@/app/api/negocio/compras/[id]/route")
const { POST: postAccionCompra } = await import("@/app/api/negocio/compras/[id]/[accion]/route")
const { PATCH: patchConfig } = await import("@/app/api/negocio/compras/configuracion/route")
const { GET: getRecepcionesCajero, POST: postRecepcionCajero } = await import("@/app/api/operativo/caja/[slug]/recepciones/route")
const { GET: getRecepcionCajero, PUT: putRecepcionCajero } = await import("@/app/api/operativo/caja/[slug]/recepciones/[id]/route")
const { POST: postAccionCajero } = await import("@/app/api/operativo/caja/[slug]/recepciones/[id]/[accion]/route")
const { GET: getDatosCajero } = await import("@/app/api/operativo/caja/[slug]/recepciones-datos/route")
const { POST: postCredito } = await import("@/app/api/negocio/proveedores/[id]/creditos/route")
const { POST: postAccionCredito } = await import("@/app/api/negocio/proveedores/creditos/[creditoId]/[accion]/route")
const { GET: getCuenta } = await import("@/app/api/negocio/proveedores/[id]/cuenta/route")
const { POST: postAnularObligacion } = await import("@/app/api/negocio/proveedores/obligaciones/[obligacionId]/anulacion/route")
const { POST: postTurnoCajero } = await import("@/app/api/operativo/caja/[slug]/turno/route")
const { POST: postEgresoCajero } = await import("@/app/api/operativo/caja/[slug]/egresos/route")
const { GET: getSinVincularD7 } = await import("@/app/api/negocio/proveedores/pagos-caja-sin-vincular/route")
const { POST: postVincularD7 } = await import("@/app/api/negocio/proveedores/[id]/creditos/caja/route")
const { GET: getCajasD7 } = await import("@/app/api/negocio/caja/cajas/route")

afterAll(async () => {
  await db.$disconnect()
})

type Res = { status: number; replayed: boolean; body: Record<string, any> }
const json = async (res: Response): Promise<Res> => {
  const raw = await res.text()
  let body: Record<string, any> = {}
  try { body = JSON.parse(raw) } catch { /* vacío */ }
  return { status: res.status, replayed: res.headers.get("Idempotency-Replayed") === "true", body }
}
const req = (method: string, url: string, cookie: string, body?: unknown, key?: string) =>
  new NextRequest(`http://localhost${url}`, { method, headers: { cookie, "content-type": "application/json", ...(key ? { "idempotency-key": key } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
const ctx = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) })
const enPromesa = <T,>(p: PromiseLike<T>): Promise<T> => Promise.resolve().then(() => p)
const K = () => randomUUID()
function barrera() {
  let liberar!: () => void
  const espera = new Promise<void>((resolve) => { liberar = resolve })
  return { espera, liberar }
}
async function esperarBloqueosPrecio(minimos: number) {
  const limite = Date.now() + 10_000
  while (Date.now() < limite) {
    const filas = await db.$queryRaw<Array<{ cantidad: number }>>`
      SELECT count(*)::int AS cantidad FROM pg_stat_activity
      WHERE datname = current_database() AND wait_event_type = 'Lock' AND query ILIKE '%productos%'`
    if ((filas[0]?.cantidad ?? 0) >= minimos) return true
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  return false
}

async function escenario() {
  const suffix = randomUUID().slice(0, 12)
  const negocio = await db.negocio.create({
    data: { slug: `test-c2a-${suffix}`, nombre: `Test C2a ${suffix}`, usuario: `test-c2a-${suffix}`, email: `test-c2a-${suffix}@example.test`, password: "fixture", rubro: "negocio", aprobado: true, suspendido: false, empleadosActivos: true, salonActivo: true, cajaTurnosModo: "OPCIONAL" },
  })
  const n = negocio.id
  const slug = negocio.slug
  const owner = `${SESSION_COOKIE_NAME}=${await createSession(n, "negocio")}`
  const cuenta = await db.cuentaOperativa.create({ data: { nombre: "Cajero C2a", email: `cajero-c2a-${suffix}@example.test`, activo: true, eliminado: false } })
  const empleado = await db.empleado.create({ data: { nombre: "Cajero C2a", codigo: `C2${suffix.slice(0, 6)}`.toUpperCase(), negocioId: n, cuentaOperativaId: cuenta.id, areaOperativa: "caja", activo: true, eliminado: false } })
  const cajero = `${OPERATIONAL_SESSION_COOKIE_NAME}=${await createOperationalSession(cuenta.id)}`
  const proveedor = async (nombre: string) => (await db.proveedor.create({ data: { negocioId: n, nombre, nombreNormalizado: nombre.toLowerCase(), actorId: n, idempotencyKey: K() } })).id
  const p1 = await proveedor("Distribuidora Uno")
  const p2 = await proveedor("Transportes Dos")
  const yerba = await db.producto.create({ data: { nombre: "Yerba 1kg", precio: 3000, negocioId: n, controlStock: true, stockCantidad: 10, costo: 1500 } })
  const azucar = await db.producto.create({ data: { nombre: "Azúcar 1kg", precio: 1200, negocioId: n, controlStock: true, stockCantidad: 0 } })
  const servicio = await db.producto.create({ data: { nombre: "Bolsas (sin control)", precio: 10, negocioId: n, controlStock: false, stockCantidad: 0 } })
  const remera = await db.producto.create({ data: { nombre: "Remera", precio: 9000, negocioId: n, controlStock: false, stockCantidad: 0 } })
  const talleM = await db.productoVariante.create({ data: { productoId: remera.id, nombre: "M", precio: 9000, controlStock: true, stockCantidad: 2, activo: true } })

  const crear = async (body: unknown, key = K(), cookie = owner) => json(await postRecepcion(req("POST", "/api/negocio/recepciones", cookie, body, key)))
  const lista = async (qs = "", cookie = owner) => json(await getRecepciones(req("GET", `/api/negocio/recepciones${qs}`, cookie)))
  const detalle = async (id: string, cookie = owner) => json(await getRecepcion(req("GET", `/api/negocio/recepciones/${id}`, cookie), ctx({ id })))
  const editar = async (id: string, body: unknown, cookie = owner) => json(await putRecepcion(req("PUT", `/api/negocio/recepciones/${id}`, cookie, body), ctx({ id })))
  const vista = async (id: string, qs = "", cookie = owner) => json(await getVistaPrevia(req("GET", `/api/negocio/recepciones/${id}/vista-previa${qs}`, cookie), ctx({ id })))
  const aprobar = async (id: string, body: Record<string, unknown>, key = K(), cookie = owner) => json(await postAprobacion(req("POST", `/api/negocio/recepciones/${id}/aprobacion`, cookie, body, key), ctx({ id })))
  const accion = async (id: string, accion: string, body: Record<string, unknown>, key = K(), cookie = owner) => json(await postAccion(req("POST", `/api/negocio/recepciones/${id}/${accion}`, cookie, body, key), ctx({ id, accion })))
  const compra = async (body: unknown, key = K()) => json(await postCompra(req("POST", "/api/negocio/compras", owner, body, key)))
  const verCompra = async (id: string) => json(await getCompra(req("GET", `/api/negocio/compras/${id}`, owner), ctx({ id })))
  const accionCompra = async (id: string, accion: string, motivo: string, key = K()) => json(await postAccionCompra(req("POST", `/api/negocio/compras/${id}/${accion}`, owner, { motivo }, key), ctx({ id, accion })))
  const cajeroCrear = async (body: unknown, key = K(), cookie = cajero) => json(await postRecepcionCajero(req("POST", `/api/operativo/caja/${slug}/recepciones`, cookie, body, key), ctx({ slug })))
  const cajeroLista = async () => json(await getRecepcionesCajero(req("GET", `/api/operativo/caja/${slug}/recepciones`, cajero), ctx({ slug })))
  const cajeroVer = async (id: string, cookie = cajero) => json(await getRecepcionCajero(req("GET", `/api/operativo/caja/${slug}/recepciones/${id}`, cookie), ctx({ slug, id })))
  const cajeroEditar = async (id: string, body: unknown) => json(await putRecepcionCajero(req("PUT", `/api/operativo/caja/${slug}/recepciones/${id}`, cajero, body), ctx({ slug, id })))
  const cajeroAccion = async (id: string, accion: string, body: Record<string, unknown>, key = K()) => json(await postAccionCajero(req("POST", `/api/operativo/caja/${slug}/recepciones/${id}/${accion}`, cajero, body, key), ctx({ slug, id, accion })))
  const cajeroDatos = async (qs = "") => json(await getDatosCajero(req("GET", `/api/operativo/caja/${slug}/recepciones-datos${qs}`, cajero), ctx({ slug })))
  const cuentaProv = async (pid: string) => (await json(await getCuenta(req("GET", `/api/negocio/proveedores/${pid}/cuenta`, owner), ctx({ id: pid })))).body.cuenta
  const pagoConfirmado = async (pid: string, importe: string) => {
    const c = await json(await postCredito(req("POST", `/api/negocio/proveedores/${pid}/creditos`, owner, { origen: "PAGO_DECLARADO", medio: "TRANSFERENCIA", importe, fechaPago: "2026-11-01", referencia: `ant-${K().slice(0, 8)}`, confirmoNoSalioDeCaja: true }, K()), ctx({ id: pid })))
    if (c.status !== 201) throw new Error(`fixture: crédito ${JSON.stringify(c.body)}`)
    await json(await postAccionCredito(req("POST", `/api/negocio/proveedores/creditos/${c.body.creditoId}/confirmacion`, owner, {}, K()), ctx({ creditoId: c.body.creditoId, accion: "confirmacion" })))
    return c.body.creditoId as string
  }
  const stock = async (productoId: string) => (await db.producto.findUniqueOrThrow({ where: { id: productoId } })).stockCantidad
  const foto = async () => ({
    stockYerba: await stock(yerba.id), stockAzucar: await stock(azucar.id),
    movInv: await db.movimientoInventario.count({ where: { negocioId: n } }),
    obligaciones: await db.obligacionProveedor.count({ where: { negocioId: n } }),
    asignaciones: await db.asignacionPago.count({ where: { negocioId: n } }),
    costosVigentes: await db.costoVigente.count({ where: { negocioId: n } }),
    opFin: await db.operacionFinanciera.count({ where: { negocioId: n } }),
    movFin: await db.movimientoFinanciero.count({ where: { negocioId: n } }),
    egresos: await db.egresoCaja.count({ where: { negocioId: n } }),
    aprobadas: await db.recepcion.count({ where: { negocioId: n, estado: "APROBADA" } }),
  })
  const linea = (productoId: string, recibida: string, costo: string, extra: Record<string, unknown> = {}) => ({ productoId, cantidadRecibida: recibida, costoUnitario: costo, ...extra })
  const borrador = (lineas: unknown[], extra: Record<string, unknown> = {}) => ({ proveedorId: p1, fechaRecepcion: "2026-11-15", lineas, ...extra })
  /** Crea, envía y aprueba (sin confirmaciones). */
  const recibir = async (body: Record<string, unknown>, opciones: Record<string, unknown> = {}) => {
    const c = await crear(body)
    if (c.status !== 201) throw new Error(`fixture: crear ${JSON.stringify(c.body)}`)
    const a = await aprobar(c.body.recepcionId, { version: 1, ...opciones })
    return { id: c.body.recepcionId as string, aprobacion: a }
  }
  return { negocio, n, slug, owner, cajero, empleado, p1, p2, yerba, azucar, servicio, remera, talleM, crear, lista, detalle, editar, vista, aprobar, accion, compra, verCompra, accionCompra, cajeroCrear, cajeroLista, cajeroVer, cajeroEditar, cajeroAccion, cajeroDatos, cuentaProv, pagoConfirmado, stock, foto, linea, borrador, recibir }
}

describe("F10-C2a — borradores, preparación por cajero y aprobación del dueño", () => {
  ephemeralTest("el cajero prepara y envía; nada se mueve hasta que el dueño aprueba; la aprobación aplica stock, costo, deuda y auditoría juntos", async () => {
    const e = await escenario()
    const antes = await e.foto()
    const datos = await e.cajeroDatos()
    expect(datos.body.proveedores.map((p: any) => p.nombre).sort()).toEqual(["Distribuidora Uno", "Transportes Dos"])
    expect(datos.body.proveedores[0].saldo).toBeUndefined()
    const c = await e.cajeroCrear(e.borrador([e.linea(e.yerba.id, "6", "1600", { alicuotaImpuestoPct: "21" }), e.linea(e.talleM.productoId, "3", "4000", { productoVarianteId: e.talleM.id })], { comprobanteTipo: "Factura A", comprobanteNumero: "0001-00000077" }))
    expect(c.status).toBe(201)
    const id = c.body.recepcionId
    const ed = await e.cajeroEditar(id, { version: 1, ...e.borrador([e.linea(e.yerba.id, "6", "1600", { alicuotaImpuestoPct: "21" }), e.linea(e.talleM.productoId, "3", "4000", { productoVarianteId: e.talleM.id }), e.linea(e.servicio.id, "100", "5")], { comprobanteTipo: "Factura A", comprobanteNumero: "0001-00000077" }) })
    expect(ed.body.version).toBe(2)
    expect((await e.cajeroAccion(id, "envio", { version: 2 })).status).toBe(201)
    expect(await e.foto()).toEqual(antes) // borrador y pendiente: ni stock, ni deuda, ni costos
    // el cajero no aprueba, no rechaza ni devuelve
    expect((await e.cajeroAccion(id, "rechazo", { version: 3, motivo: "x" })).status).toBe(403)
    expect((await e.cajeroAccion(id, "aprobacion", { version: 3 })).status).toBe(404)
    expect([401, 403]).toContain((await e.aprobar(id, { version: 3 }, K(), e.cajero)).status)
    expect([401, 403]).toContain((await e.vista(id, "", e.cajero)).status)
    // vista previa del dueño
    const v = await e.vista(id)
    expect(v.body.vistaPrevia.totales.totalObligacion).toBe(24116) // 6×1600×1,21 + 3×4000 + 100×5 = 11616 + 12000 + 500
    expect(v.body.vistaPrevia.lineas.map((l: any) => l.controlStock)).toEqual([true, true, false])
    const ap = await e.aprobar(id, { version: 3 })
    expect(ap.status).toBe(201)
    expect(ap.body.movimientosInventario.length).toBe(2) // la línea sin control de stock no mueve inventario
    expect(await e.stock(e.yerba.id)).toBe(16)
    expect((await db.productoVariante.findUniqueOrThrow({ where: { id: e.talleM.id } })).stockCantidad).toBe(5)
    const movs = await db.movimientoInventario.findMany({ where: { negocioId: e.n, tipo: "RECEPCION" }, orderBy: { createdAt: "asc" } })
    expect(movs.map((m) => [m.cantidad, m.stockAntes, m.stockDespues])).toEqual([[6, 10, 16], [3, 2, 5]])
    expect(movs.every((m) => m.recepcionLineaId)).toBe(true)
    // costo histórico congelado y último costo (IVA integra el costo por defecto)
    const det = (await e.detalle(id)).body.recepcion
    expect(det.estado).toBe("APROBADA")
    expect(det.lineas.map((l: any) => l.aprobacion.costoUnitarioInventario)).toEqual([1936, 4000, 5])
    expect((await db.producto.findUniqueOrThrow({ where: { id: e.yerba.id } })).costo).toBe(1936)
    expect((await db.productoVariante.findUniqueOrThrow({ where: { id: e.talleM.id } })).costo).toBe(4000)
    // UNA obligación RECEPCION en la cuenta del proveedor
    const ob = await db.obligacionProveedor.findMany({ where: { negocioId: e.n } })
    expect(ob.map((o) => [o.origen, o.recepcionId, o.importeDecimal.toFixed(2)])).toEqual([["RECEPCION", id, "24116.00"]])
    expect((await e.cuentaProv(e.p1)).totales).toMatchObject({ deudaExigible: 24116, identidadOk: true })
    // nada del libro financiero ni de egresos
    const despues = await e.foto()
    expect([despues.opFin, despues.movFin, despues.egresos]).toEqual([antes.opFin, antes.movFin, antes.egresos])
    // auditoría en la transacción + historia de eventos
    expect((await db.auditLog.findMany({ where: { recursoId: id }, select: { accion: true, userType: true } })).map((a) => `${a.userType}:${a.accion}`).sort())
      .toEqual(["empleado:recepcion.creada", "empleado:recepcion.editada", "empleado:recepcion.enviada", "negocio:recepcion.aprobada"].sort())
    expect(det.historial.map((h: any) => h.tipo)).toEqual(["ENVIO", "APROBACION"])
    // aprobada: inmutable (API y SQL)
    expect((await e.editar(id, { version: 4, ...e.borrador([e.linea(e.yerba.id, "1", "1")]) })).body.code).toBe("RECEPCION_NO_EDITABLE")
    expect((await e.aprobar(id, { version: 4 })).body.code).toBe("RECEPCION_YA_APROBADA")
    await expect(enPromesa(db.$executeRaw`UPDATE "recepcion_lineas" SET "costoUnitarioInventarioDecimal" = 1 WHERE "recepcionId" = ${id}`)).rejects.toThrow(/immutable/)
    await expect(enPromesa(db.$executeRaw`UPDATE "recepciones" SET "notas" = 'x' WHERE "id" = ${id}`)).rejects.toThrow(/immutable/)
    await expect(enPromesa(db.$executeRaw`DELETE FROM "recepcion_lineas" WHERE "recepcionId" = ${id}`)).rejects.toThrow()
    // la deuda de una recepción no se anula (se corrige con ajuste o devolución)
    const anul = await json(await postAnularObligacion(req("POST", `/api/negocio/proveedores/obligaciones/${ob[0].id}/anulacion`, e.owner, { motivo: "x" }, K()), ctx({ obligacionId: ob[0].id })))
    expect(anul.body.code).toBe("OBLIGACION_DE_RECEPCION")
  })

  ephemeralTest("el cajero sólo ve y toca SUS recepciones; el dueño rechaza o devuelve con motivo sin mover nada", async () => {
    const e = await escenario()
    const delDueno = await e.crear(e.borrador([e.linea(e.yerba.id, "1", "100")]))
    expect((await e.cajeroVer(delDueno.body.recepcionId)).status).toBe(404)
    expect((await e.cajeroAccion(delDueno.body.recepcionId, "descarte", { version: 1 })).status).toBe(404)
    const mia = await e.cajeroCrear(e.borrador([e.linea(e.yerba.id, "1", "100")]))
    expect((await e.cajeroLista()).body.recepciones.map((r: any) => r.id)).toEqual([mia.body.recepcionId])
    expect((await e.cajeroLista()).body.recepciones[0].totalObligacion).toBeUndefined()
    await e.cajeroAccion(mia.body.recepcionId, "envio", { version: 1 })
    const antes = await e.foto()
    expect((await e.accion(mia.body.recepcionId, "devolucion", { version: 2 })).body.code).toBe("MOTIVO_REQUERIDO")
    expect((await e.accion(mia.body.recepcionId, "devolucion", { version: 2, motivo: "Falta el número de factura" })).status).toBe(201)
    expect((await e.cajeroVer(mia.body.recepcionId)).body.recepcion.estado).toBe("BORRADOR")
    await e.cajeroAccion(mia.body.recepcionId, "envio", { version: 3 })
    expect((await e.accion(mia.body.recepcionId, "rechazo", { version: 4, motivo: "No es de este proveedor" })).status).toBe(201)
    expect(await e.foto()).toEqual(antes)
    const r = (await e.detalle(mia.body.recepcionId)).body.recepcion
    expect([r.estado, r.motivoRechazo]).toEqual(["RECHAZADA", "No es de este proveedor"])
    expect((await e.aprobar(mia.body.recepcionId, { version: 5 })).body.code).toBe("RECEPCION_CERRADA")
    // descartar un borrador propio
    const otra = await e.cajeroCrear(e.borrador([e.linea(e.yerba.id, "1", "100")]))
    expect((await e.cajeroAccion(otra.body.recepcionId, "descarte", { version: 1 })).status).toBe(201)
    expect((await e.cajeroVer(otra.body.recepcionId)).body.recepcion.estado).toBe("DESCARTADA")
  })
})

describe("F10-C2a — idempotencia, versión y concurrencia", () => {
  ephemeralTest("doble clic en crear y en aprobar: una sola recepción, una sola entrada de stock y una sola deuda", async () => {
    const e = await escenario()
    const key = K()
    const body = e.borrador([e.linea(e.yerba.id, "5", "1500")])
    const cs = await Promise.all([1, 2, 3].map(() => e.crear(body, key)))
    expect(cs.filter((r) => r.status === 201).length).toBe(1)
    expect(new Set(cs.map((r) => r.body.recepcionId)).size).toBe(1)
    expect((await e.crear({ ...body, notas: "otra" }, key)).body.code).toBe("IDEMPOTENCY_KEY_REUSED")
    const id = cs[0].body.recepcionId
    const akey = K()
    const as = await Promise.all([1, 2, 3].map(() => e.aprobar(id, { version: 1 }, akey)))
    expect(as.filter((r) => r.status === 201).length).toBe(1)
    expect(as.filter((r) => r.status === 200 && r.replayed).length).toBe(2)
    expect(new Set(as.map((r) => r.body.obligacionId)).size).toBe(1)
    expect(await e.stock(e.yerba.id)).toBe(15)
    expect(await db.obligacionProveedor.count({ where: { negocioId: e.n } })).toBe(1)
    expect(await db.auditLog.count({ where: { recursoId: id, accion: "recepcion.aprobada" } })).toBe(1)
  })

  ephemeralTest("dos aprobaciones concurrentes con claves distintas: el stock entra UNA vez (CAS + índice único)", async () => {
    const e = await escenario()
    for (let i = 0; i < 4; i++) {
      const c = await e.crear(e.borrador([e.linea(e.azucar.id, "10", "500")]))
      const rs = await Promise.all([e.aprobar(c.body.recepcionId, { version: 1 }), e.aprobar(c.body.recepcionId, { version: 1 })])
      expect(rs.filter((r) => r.status === 201).length).toBe(1)
      expect(rs.filter((r) => r.status === 409).length).toBe(1)
      expect(["RECEPCION_YA_APROBADA", "VERSION_CAMBIADA"]).toContain(rs.find((r) => r.status === 409)!.body.code)
    }
    expect(await e.stock(e.azucar.id)).toBe(40)
    expect(await db.movimientoInventario.count({ where: { negocioId: e.n, tipo: "RECEPCION" } })).toBe(4)
    expect(await db.obligacionProveedor.count({ where: { negocioId: e.n, origen: "RECEPCION" } })).toBe(4)
    // la base también impide una segunda entrada para la misma línea
    const l = await db.recepcionLinea.findFirstOrThrow({ where: { negocioId: e.n } })
    await expect(enPromesa(db.movimientoInventario.create({ data: { negocioId: e.n, productoId: e.azucar.id, tipo: "RECEPCION", cantidad: 10, stockAntes: 40, stockDespues: 50, recepcionLineaId: l.id } }))).rejects.toThrow()
  })

  ephemeralTest("se aprueba lo que el dueño vio: una edición posterior invalida la versión", async () => {
    const e = await escenario()
    const c = await e.crear(e.borrador([e.linea(e.yerba.id, "5", "1000")]))
    await e.editar(c.body.recepcionId, { version: 1, ...e.borrador([e.linea(e.yerba.id, "50", "1000")]) })
    expect((await e.aprobar(c.body.recepcionId, { version: 1 })).body.code).toBe("VERSION_CAMBIADA")
    // reenviar la MISMA edición es un replay, no un conflicto
    const rep = await e.editar(c.body.recepcionId, { version: 1, ...e.borrador([e.linea(e.yerba.id, "50", "1000")]) })
    expect([rep.status, rep.replayed, rep.body.version]).toEqual([200, true, 2])
    expect(await e.stock(e.yerba.id)).toBe(10)
  })

  ephemeralTest("si la auditoría falla, NADA queda aplicado (stock, costos, deuda, estado)", async () => {
    const e = await escenario()
    const c = await e.crear(e.borrador([e.linea(e.yerba.id, "5", "1500")]))
    const antes = await e.foto()
    await expect(aprobarRecepcion(db, { negocioId: e.n, recepcionId: c.body.recepcionId, body: { version: 1 }, idempotencyKey: K() }, { auditar: async () => { throw new Error("auditoría caída") } })).rejects.toThrow("auditoría caída")
    expect(await e.foto()).toEqual(antes)
    expect((await e.detalle(c.body.recepcionId)).body.recepcion.estado).toBe("BORRADOR")
    expect((await db.recepcionLinea.findFirstOrThrow({ where: { recepcionId: c.body.recepcionId } })).costoInventarioTotalDecimal).toBeNull()
  })
})

describe("F10-C2a — pedidos: recepciones parciales, excedentes, dañados, cierre y anulación", () => {
  ephemeralTest("parcial: la deuda y el stock sólo por lo aceptado; excedente sobre lo pendiente exige confirmación; dañados con motivo", async () => {
    const e = await escenario()
    const c = await e.compra({ proveedorId: e.p1, fechaPedido: "2026-11-01", lineas: [{ productoId: e.azucar.id, cantidadPedida: "10", costoUnitarioAcordado: "500" }] })
    expect(c.status).toBe(201)
    const compra = (await e.verCompra(c.body.compraId)).body.compra
    const cl = compra.lineas[0].id
    // el cajero ve el pedido abierto sin costos acordados
    const paraCajero = (await e.cajeroDatos(`?compraId=${c.body.compraId}`)).body.compra
    expect(paraCajero.lineas[0].costoUnitarioAcordado).toBeUndefined()
    // 1ª entrega: llegan 6, 2 dañados → se aceptan 4
    expect((await e.crear(e.borrador([e.linea(e.azucar.id, "6", "500", { compraLineaId: cl, cantidadAceptada: "4" })], { compraId: c.body.compraId }))).body.code).toBe("MOTIVO_RECHAZO_REQUERIDO")
    const r1 = await e.recibir(e.borrador([e.linea(e.azucar.id, "6", "500", { compraLineaId: cl, cantidadAceptada: "4", motivoRechazo: "DANADO", detalleRechazo: "bolsas rotas" })], { compraId: c.body.compraId }))
    expect(r1.aprobacion.status).toBe(201)
    expect(await e.stock(e.azucar.id)).toBe(4)
    expect((await db.obligacionProveedor.findFirstOrThrow({ where: { recepcionId: r1.id } })).importeDecimal.toFixed(2)).toBe("2000.00")
    let v = (await e.verCompra(c.body.compraId)).body.compra
    expect([v.estadoRecepcion, v.lineas[0].recibida, v.lineas[0].pendiente]).toEqual(["PARCIAL", 4, 6])
    // 2ª entrega: llegan 7 (1 más de lo pendiente) → excedente: se confirma explícitamente
    const c2 = await e.crear(e.borrador([e.linea(e.azucar.id, "7", "500", { compraLineaId: cl })], { compraId: c.body.compraId, fechaRecepcion: "2026-11-16" }))
    const antes = await e.foto()
    const sin = await e.aprobar(c2.body.recepcionId, { version: 1 })
    expect(sin.body.code).toBe("EXCEDENTE_SOBRE_PEDIDO")
    expect(sin.body.detalle.excedentes).toMatchObject([{ pendiente: 6, aceptadaAhora: 7, excedente: 1 }])
    expect(await e.foto()).toEqual(antes)
    expect((await e.aprobar(c2.body.recepcionId, { version: 1, confirmoExcedentes: true })).status).toBe(201)
    expect(await e.stock(e.azucar.id)).toBe(11)
    v = (await e.verCompra(c.body.compraId)).body.compra
    expect([v.estadoRecepcion, v.lineas[0].recibida, v.lineas[0].pendiente]).toEqual(["COMPLETA", 11, 0])
    // un pedido con mercadería recibida no se anula; se cierra
    expect((await e.accionCompra(c.body.compraId, "anulacion", "ya no")).body.code).toBe("COMPRA_CON_RECEPCIONES")
    expect((await e.accionCompra(c.body.compraId, "cierre", "Completo")).status).toBe(201)
    expect((await e.crear(e.borrador([e.linea(e.azucar.id, "1", "500", { compraLineaId: cl })], { compraId: c.body.compraId }))).body.code).toBe("COMPRA_CERRADA")
  })

  ephemeralTest("dos recepciones del mismo pedido aprobadas en simultáneo: nunca suman más de lo pendiente sin confirmación (candado del pedido)", async () => {
    const e = await escenario()
    for (let i = 0; i < 3; i++) {
      const c = await e.compra({ proveedorId: e.p1, lineas: [{ productoId: e.azucar.id, cantidadPedida: "10" }] })
      const cl = (await e.verCompra(c.body.compraId)).body.compra.lineas[0].id
      const a = await e.crear(e.borrador([e.linea(e.azucar.id, "6", "100", { compraLineaId: cl })], { compraId: c.body.compraId }))
      const b = await e.crear(e.borrador([e.linea(e.azucar.id, "6", "100", { compraLineaId: cl })], { compraId: c.body.compraId }))
      const rs = await Promise.all([e.aprobar(a.body.recepcionId, { version: 1 }), e.aprobar(b.body.recepcionId, { version: 1 })])
      expect(rs.filter((r) => r.status === 201).length).toBe(1)
      expect(rs.find((r) => r.status !== 201)!.body.code).toBe("EXCEDENTE_SOBRE_PEDIDO")
      expect((await e.verCompra(c.body.compraId)).body.compra.lineas[0]).toMatchObject({ recibida: 6, pendiente: 4 })
    }
    expect(await e.stock(e.azucar.id)).toBe(18)
  })

  ephemeralTest("un producto que no estaba pedido es excedente; un pedido sin recepciones aprobadas se anula; un renglón de otro pedido se rechaza", async () => {
    const e = await escenario()
    const c = await e.compra({ proveedorId: e.p1, lineas: [{ productoId: e.azucar.id, cantidadPedida: "2" }] })
    const otro = await e.compra({ proveedorId: e.p1, lineas: [{ productoId: e.yerba.id, cantidadPedida: "2" }] })
    const lineaOtro = (await e.verCompra(otro.body.compraId)).body.compra.lineas[0].id
    expect((await e.crear(e.borrador([e.linea(e.yerba.id, "1", "10", { compraLineaId: lineaOtro })], { compraId: c.body.compraId }))).body.code).toBe("LINEA_DE_OTRA_COMPRA")
    const r = await e.crear(e.borrador([e.linea(e.yerba.id, "1", "10")], { compraId: c.body.compraId }))
    expect((await e.aprobar(r.body.recepcionId, { version: 1 })).body.detalle.excedentes).toMatchObject([{ compraLineaId: null, excedente: 1 }])
    // con una recepción pendiente no se cierra ni anula
    await e.accion(r.body.recepcionId, "envio", { version: 1 })
    expect((await e.accionCompra(c.body.compraId, "anulacion", "error")).body.code).toBe("COMPRA_CON_RECEPCIONES_PENDIENTES")
    await e.accion(r.body.recepcionId, "rechazo", { version: 2, motivo: "no corresponde" })
    expect((await e.accionCompra(c.body.compraId, "anulacion", "Pedido cargado por error")).status).toBe(201)
    expect((await e.verCompra(c.body.compraId)).body.compra.estado).toBe("ANULADA")
    // un pedido es de UN proveedor
    expect((await e.crear(e.borrador([e.linea(e.yerba.id, "1", "10")], { compraId: otro.body.compraId, proveedorId: e.p2 }))).body.code).toBe("COMPRA_DE_OTRO_PROVEEDOR")
  })
})

describe("F10-C2a — costos, impuestos, descuentos, cargos accesorios y último costo", () => {
  ephemeralTest("caso completo: costo por línea, obligación de la recepción, cargo de otro proveedor y gasto con obligación propia", async () => {
    const e = await escenario()
    const r = await e.recibir(e.borrador(
      [e.linea(e.yerba.id, "10", "100", { descuentoPct: "10", alicuotaImpuestoPct: "21" }), e.linea(e.azucar.id, "5", "50", { cantidadAceptada: "4", motivoRechazo: "DANADO", alicuotaImpuestoPct: "10.5" })],
      {
        descuentoGlobal: "55", percepciones: "21.45",
        cargos: [
          { tipo: "ATRIBUIBLE", concepto: "Flete", importe: "104.50", distribucion: "VALOR" },
          { tipo: "ATRIBUIBLE", concepto: "Transporte", importe: "20.90", distribucion: "CANTIDAD", proveedorId: e.p2 },
          { tipo: "NO_ATRIBUIBLE", concepto: "Carga y descarga general", importe: "40" },
        ],
      }
    ), { confirmoDiferenciasCosto: true })
    expect(r.aprobacion.status).toBe(201)
    const det = (await e.detalle(r.id)).body.recepcion
    expect(det.lineas.map((l: any) => l.aprobacion.costoUnitarioInventario)).toEqual([115.253, 59.705])
    expect(det.totalesAprobacion).toMatchObject({ tratamientoImpuestos: "IMPUESTOS_INTEGRAN_COSTO", neto: 1045, totalObligacion: 1370.45 })
    const obs = await db.obligacionProveedor.findMany({ where: { negocioId: e.n }, orderBy: { createdAt: "asc" } })
    expect(obs.map((o) => [o.origen, o.proveedorId === e.p1 ? "p1" : "p2", o.importeDecimal.toFixed(2)])).toEqual([["RECEPCION", "p1", "1370.45"], ["CARGO_ACCESORIO", "p2", "20.90"], ["CARGO_ACCESORIO", "p1", "40.00"]])
    expect(await e.stock(e.yerba.id)).toBe(20)
    expect(await e.stock(e.azucar.id)).toBe(4)
    // la base no acepta una segunda obligación para la misma recepción ni una por un cargo del mismo proveedor que ya va en la recepción
    const flete = await db.recepcionCargo.findFirstOrThrow({ where: { recepcionId: r.id, concepto: "Flete" } })
    await expect(enPromesa(db.obligacionProveedor.create({ data: { negocioId: e.n, proveedorId: e.p1, origen: "CARGO_ACCESORIO", recepcionCargoId: flete.id, importeDecimal: "104.50", fecha: new Date(), descripcion: "x", actorId: e.n, idempotencyKey: K(), idempotencyFingerprint: "x" } }))).rejects.toThrow(/same supplier/)
    await expect(enPromesa(db.obligacionProveedor.create({ data: { negocioId: e.n, proveedorId: e.p1, origen: "RECEPCION", recepcionId: r.id, importeDecimal: "1370.45", fecha: new Date(), descripcion: "x", actorId: e.n, idempotencyKey: K(), idempotencyFingerprint: "x" } }))).rejects.toThrow()
  })

  ephemeralTest("impuestos recuperables (configuración del negocio): el IVA no entra al costo pero sí a la deuda", async () => {
    const e = await escenario()
    expect((await json(await patchConfig(req("PATCH", "/api/negocio/compras/configuracion", e.owner, { tratamientoImpuestos: "IMPUESTOS_RECUPERABLES" })))).status).toBe(200)
    const r = await e.recibir(e.borrador([e.linea(e.azucar.id, "10", "100", { alicuotaImpuestoPct: "21" })]))
    const det = (await e.detalle(r.id)).body.recepcion
    expect(det.lineas[0].aprobacion.costoUnitarioInventario).toBe(100)
    expect(det.totalesAprobacion.totalObligacion).toBe(1210)
  })

  ephemeralTest("diferencia de costo grande exige confirmación; el último costo respeta el orden REAL de las recepciones", async () => {
    const e = await escenario()
    // referencia: costo del producto 1500 → 2000 es +33 %
    const c = await e.crear(e.borrador([e.linea(e.yerba.id, "1", "2000")], { fechaRecepcion: "2026-11-10" }))
    const d = await e.aprobar(c.body.recepcionId, { version: 1 })
    expect(d.body.code).toBe("DIFERENCIA_DE_COSTO")
    expect(d.body.detalle.diferenciasCosto).toMatchObject([{ referencia: 1500, origenReferencia: "PRODUCTO", diferenciaPct: 33.33 }])
    expect((await e.aprobar(c.body.recepcionId, { version: 1, confirmoDiferenciasCosto: true })).status).toBe(201)
    expect((await db.producto.findUniqueOrThrow({ where: { id: e.yerba.id } })).costo).toBe(2000)
    // una recepción ATRASADA (fecha anterior) aprobada después no pisa el costo vigente
    const vieja = await e.recibir(e.borrador([e.linea(e.yerba.id, "1", "1900")], { fechaRecepcion: "2026-11-05" }))
    expect(vieja.aprobacion.status).toBe(201)
    expect((await db.producto.findUniqueOrThrow({ where: { id: e.yerba.id } })).costo).toBe(2000)
    // una más nueva sí (la referencia ahora es la última recepción)
    const nueva = await e.recibir(e.borrador([e.linea(e.yerba.id, "1", "2100")], { fechaRecepcion: "2026-11-12" }))
    expect(nueva.aprobacion.status).toBe(201)
    expect((await db.producto.findUniqueOrThrow({ where: { id: e.yerba.id } })).costo).toBe(2100)
    const cv = await db.costoVigente.findFirstOrThrow({ where: { negocioId: e.n, productoId: e.yerba.id } })
    expect(cv.costoUnitarioDecimal.toFixed(4)).toBe("2100.0000")
    // los costos históricos de cada recepción quedan intactos
    expect((await e.detalle(vieja.id)).body.recepcion.lineas[0].aprobacion.costoUnitarioInventario).toBe(1900)
  })

  ephemeralTest("comprobante repetido del mismo proveedor (otro formato) no se envía ni se aprueba dos veces; en otro proveedor sí", async () => {
    const e = await escenario()
    const a = await e.recibir(e.borrador([e.linea(e.azucar.id, "1", "10")], { comprobanteTipo: "Factura A", comprobanteNumero: "0001-00001234" }))
    expect(a.aprobacion.status).toBe(201)
    const b = await e.crear(e.borrador([e.linea(e.azucar.id, "1", "10")], { comprobanteTipo: "factura a", comprobanteNumero: "1-00001234" }))
    expect((await e.accion(b.body.recepcionId, "envio", { version: 1 })).body.code).toBe("COMPROBANTE_DUPLICADO")
    expect((await e.aprobar(b.body.recepcionId, { version: 1 })).body.code).toBe("COMPROBANTE_DUPLICADO")
    const otroProv = await e.recibir(e.borrador([e.linea(e.azucar.id, "1", "10")], { proveedorId: e.p2, comprobanteTipo: "Factura A", comprobanteNumero: "0001-00001234" }))
    expect(otroProv.aprobacion.status).toBe(201)
  })
})

describe("F10-C2a — anticipos con el motor único de F5 y aislamiento", () => {
  ephemeralTest("pago anticipado aplicado al aprobar; pagos parciales; un anticipo inválido revierte TODA la aprobación", async () => {
    const e = await escenario()
    const anticipo = await e.pagoConfirmado(e.p1, "3000")
    const otroProv = await e.pagoConfirmado(e.p2, "500")
    const c = await e.crear(e.borrador([e.linea(e.azucar.id, "10", "500")]))
    const v = await e.vista(c.body.recepcionId)
    expect(v.body.vistaPrevia.anticiposDisponibles).toMatchObject([{ creditoId: anticipo, disponible: 3000 }])
    const antes = await e.foto()
    // anticipo de OTRO proveedor: la aprobación entera se revierte (stock, costos, deuda, estado)
    const mal = await e.aprobar(c.body.recepcionId, { version: 1, aplicarAnticipos: [{ creditoId: anticipo, importe: "1000" }, { creditoId: otroProv, importe: "500" }] })
    expect(mal.status).toBe(404)
    expect(mal.body.code).toBe("RENGLON_DE_OTRO_PROVEEDOR")
    expect(await e.foto()).toEqual(antes)
    expect((await e.detalle(c.body.recepcionId)).body.recepcion.estado).toBe("BORRADOR")
    expect((await e.aprobar(c.body.recepcionId, { version: 1, aplicarAnticipos: [{ creditoId: anticipo, importe: "6000" }] })).body.code).toBe("ANTICIPOS_EXCEDEN_OBLIGACION")
    // pago parcial con el anticipo: 3000 de 5000
    const ok = await e.aprobar(c.body.recepcionId, { version: 1, aplicarAnticipos: [{ creditoId: anticipo, importe: "3000" }] })
    expect(ok.status).toBe(201)
    expect(ok.body.operacionAnticiposId).toBeTruthy()
    const cuenta = await e.cuentaProv(e.p1)
    expect(cuenta.totales).toMatchObject({ deudaVigente: 5000, creditosConfirmados: 3000, deudaExigible: 2000, anticiposDisponibles: 0, obligacionesPendientes: 2000, identidadOk: true })
    expect(cuenta.obligaciones[0]).toMatchObject({ origen: "RECEPCION", importe: 5000, asignado: 3000, pendiente: 2000 })
    // los pagos existentes nunca se registran como movimientos financieros nuevos
    const despues = await e.foto()
    expect([despues.opFin, despues.movFin, despues.egresos]).toEqual([antes.opFin, antes.movFin, antes.egresos])
  })

  ephemeralTest("aislamiento: otro negocio no ve ni aprueba; productos, proveedores y cargos de otro negocio se rechazan", async () => {
    const e = await escenario()
    const x = await escenario()
    const c = await e.crear(e.borrador([e.linea(e.yerba.id, "1", "100")]))
    expect((await x.detalle(c.body.recepcionId)).status).toBe(404)
    expect((await x.aprobar(c.body.recepcionId, { version: 1 })).status).toBe(404)
    expect((await x.accion(c.body.recepcionId, "rechazo", { version: 1, motivo: "x" })).status).toBe(404)
    expect((await x.vista(c.body.recepcionId)).status).toBe(404)
    expect((await e.crear(e.borrador([e.linea(x.yerba.id, "1", "100")]))).body.code).toBe("PRODUCTO_NO_ENCONTRADO")
    expect((await e.crear({ ...e.borrador([e.linea(e.yerba.id, "1", "100")]), proveedorId: x.p1 })).body.code).toBe("PROVEEDOR_NO_ENCONTRADO")
    expect((await e.crear(e.borrador([e.linea(e.yerba.id, "1", "100")], { cargos: [{ tipo: "ATRIBUIBLE", concepto: "Flete", importe: "10", proveedorId: x.p1 }] }))).body.code).toBe("PROVEEDOR_NO_ENCONTRADO")
    expect((await x.lista()).body.recepciones.length).toBe(0)
    // variantes: un producto con variantes exige elegir una
    expect((await e.crear(e.borrador([e.linea(e.remera.id, "1", "100")]))).body.code).toBe("VARIANTE_REQUERIDA")
    // la base exige que el producto sea del negocio
    await expect(enPromesa(db.recepcionLinea.create({ data: { negocioId: e.n, recepcionId: c.body.recepcionId, orden: 99, productoId: x.yerba.id, productoNombre: "x", cantidadRecibidaDecimal: "1", cantidadAceptadaDecimal: "1", cantidadRechazadaDecimal: "0", costoUnitarioDecimal: "1" } }))).rejects.toThrow(/belong to the business/)
    expect(await x.stock(x.yerba.id)).toBe(10)
  })

  ephemeralTest("el stock nunca entra por fuera de una recepción aprobada; borrar un producto conserva la historia", async () => {
    const e = await escenario()
    const c = await e.crear(e.borrador([e.linea(e.azucar.id, "3", "100")]))
    const l = await db.recepcionLinea.findFirstOrThrow({ where: { recepcionId: c.body.recepcionId } })
    await expect(enPromesa(db.movimientoInventario.create({ data: { negocioId: e.n, productoId: e.azucar.id, tipo: "RECEPCION", cantidad: 3, stockAntes: 0, stockDespues: 3, recepcionLineaId: l.id } }))).rejects.toThrow(/approved reception/)
    await expect(enPromesa(db.movimientoInventario.create({ data: { negocioId: e.n, productoId: e.azucar.id, tipo: "RECEPCION", cantidad: 3, stockAntes: 0, stockDespues: 3 } }))).rejects.toThrow(/requires its reception line/)
    await e.aprobar(c.body.recepcionId, { version: 1 })
    await db.producto.delete({ where: { id: e.azucar.id } })
    const det = (await e.detalle(c.body.recepcionId)).body.recepcion
    expect([det.lineas[0].productoId, det.lineas[0].producto, det.lineas[0].aprobacion.costoUnitarioInventario]).toEqual([null, "Azúcar 1kg", 100])
  })
})

describe("F10-C2b — unidades de medida y pago en efectivo al recibir (D-7)", () => {
  ephemeralTest("cantidades enteras para productos por unidad; decimales para unidades fraccionables (servidor)", async () => {
    const e = await escenario()
    const queso = await db.producto.create({ data: { nombre: "Queso", precio: 1, negocioId: e.n, controlStock: true, stockCantidad: 0, unidadMedida: "kg" } })
    expect((await e.crear(e.borrador([e.linea(e.azucar.id, "1.5", "10")]))).body.code).toBe("CANTIDAD_ENTERA_REQUERIDA")
    const ok = await e.recibir(e.borrador([e.linea(queso.id, "2.375", "9000")]))
    expect(ok.aprobacion.status).toBe(201)
    expect(await e.stock(queso.id)).toBe(2.375)
    expect((await e.compra({ proveedorId: e.p1, lineas: [{ productoId: e.azucar.id, cantidadPedida: "0.5" }] })).body.code).toBe("CANTIDAD_ENTERA_REQUERIDA")
  })

  ephemeralTest("el cajero paga en efectivo con su turno (UN movimiento); el dueño lo vincula y lo aplica al aprobar sin otro movimiento; un rechazo no lo anula", async () => {
    process.env.DELIGO_F10_B2_2_B_SHIFT_UI_ENABLED = "true"
    const e = await escenario()
    const allow = new Set((process.env.DELIGO_F10_B2_2_B_CONTROLLED_EMPLOYEE_IDS ?? "").split(/[\s,;]+/).filter(Boolean))
    allow.add(e.empleado.id)
    process.env.DELIGO_F10_B2_2_B_CONTROLLED_EMPLOYEE_IDS = [...allow].join(",")
    const caja = (await json(await getCajasD7(req("GET", "/api/negocio/caja/cajas", e.owner)))).body.cajas[0]
    const turno = await json(await postTurnoCajero(req("POST", `/api/operativo/caja/${e.slug}/turno`, e.cajero, { cajaFisicaId: caja.id, fondoInicial: "20000.00" }, K()), ctx({ slug: e.slug })))
    expect(turno.status).toBe(201)
    const c = await e.cajeroCrear(e.borrador([e.linea(e.azucar.id, "10", "500")]))
    const numero = c.body.numero
    const antes = await e.foto()
    // pago al recibir: salida PAGO_PROVEEDOR de F10-C1 con la referencia de la recepción (antes de aprobarla)
    const pagoBody = { naturaleza: "PAGO_PROVEEDOR", importe: "3000.00", motivo: `Pago de mercadería al recibir — Recepción N° ${numero}`, proveedorNombre: "Distribuidora Uno", comprobanteReferencia: `Recepción N° ${numero}` }
    const key = K()
    const pagar = async () => json(await postEgresoCajero(req("POST", `/api/operativo/caja/${e.slug}/egresos`, e.cajero, pagoBody, key), ctx({ slug: e.slug })))
    const dobleClic = await Promise.all([pagar(), pagar()])
    expect(dobleClic.map((r) => r.status).sort()).toEqual([200, 201])
    expect((await pagar()).replayed).toBe(true)
    const mid = await e.foto()
    expect(mid.egresos - antes.egresos).toBe(1) // doble clic: un solo egreso
    expect(mid.movFin - antes.movFin).toBe(1) // y un solo movimiento financiero
    expect([mid.stockAzucar, mid.obligaciones]).toEqual([antes.stockAzucar, antes.obligaciones]) // la recepción no movió nada
    // el dueño lo encuentra por la referencia y lo vincula (F5): sin movimiento nuevo
    const sinVincular = (await json(await getSinVincularD7(req("GET", "/api/negocio/proveedores/pagos-caja-sin-vincular", e.owner)))).body.pagos
    const pago = sinVincular.find((x: any) => x.comprobante === `Recepción N° ${numero}`)
    expect(pago).toBeTruthy()
    const v = await json(await postVincularD7(req("POST", `/api/negocio/proveedores/${e.p1}/creditos/caja`, e.owner, { egresoCajaId: pago.id }, K()), ctx({ id: e.p1 })))
    expect(v.status).toBe(201)
    // aprobar y aplicar ese pago como anticipo
    await e.cajeroAccion(c.body.recepcionId, "envio", { version: 1 })
    const ap = await e.aprobar(c.body.recepcionId, { version: 2, aplicarAnticipos: [{ creditoId: v.body.creditoId, importe: "3000" }] })
    expect(ap.status).toBe(201)
    const fin = await e.foto()
    expect(fin.movFin).toBe(mid.movFin) // vincular y aplicar NUNCA crean otro movimiento financiero
    expect(fin.egresos).toBe(mid.egresos)
    expect((await e.cuentaProv(e.p1)).totales).toMatchObject({ deudaVigente: 5000, creditosConfirmados: 3000, deudaExigible: 2000, identidadOk: true })
    // el cajero ve su recepción aprobada, pero nunca la deuda generada ni el vínculo con la cuenta
    const vistaCajero = (await e.cajeroVer(c.body.recepcionId)).body.recepcion
    expect([vistaCajero.estado, vistaCajero.totalesAprobacion, vistaCajero.obligacionId]).toEqual(["APROBADA", null, undefined])
    // otra recepción pagada y luego RECHAZADA: el pago sigue registrado y sin vincular (se trata aparte)
    const c2 = await e.cajeroCrear(e.borrador([e.linea(e.azucar.id, "1", "500")]))
    const p2 = await json(await postEgresoCajero(req("POST", `/api/operativo/caja/${e.slug}/egresos`, e.cajero, { ...pagoBody, importe: "500.00", comprobanteReferencia: `Recepción N° ${c2.body.numero}` }, K()), ctx({ slug: e.slug })))
    expect(p2.status).toBe(201)
    await e.cajeroAccion(c2.body.recepcionId, "envio", { version: 1 })
    expect((await e.accion(c2.body.recepcionId, "rechazo", { version: 2, motivo: "Mercadería equivocada" })).status).toBe(201)
    const siguen = (await json(await getSinVincularD7(req("GET", "/api/negocio/proveedores/pagos-caja-sin-vincular", e.owner)))).body.pagos
    expect(siguen.some((x: any) => x.comprobante === `Recepción N° ${c2.body.numero}`)).toBe(true)
    expect(await db.compensacionEgresoCaja.count({ where: { negocioId: e.n } })).toBe(0)
  })
})

describe("T2 — etiqueta pendiente y escrituras de precio", () => {
  ephemeralTest("una etiqueta registrada primero bloquea al empleado; una importación atrasada conserva precio y etiqueta, pero aplica los demás campos", async () => {
    const e = await escenario()
    const id = K()
    const empleado = await db.empleado.create({ data: { negocioId: e.n, nombre: "Editor catálogo", codigo: `ED${id.slice(0, 6)}`.toUpperCase(), catalogoHasta: new Date(Date.now() + 3600_000), catalogoEditar: true, catalogoPrecios: true, catalogoCostos: true, catalogoImportar: true, catalogoCrear: true } })
    const importActor = { tipo: "NEGOCIO" as const }
    const importBase = { campos: ["nombre", "precio", "categoria", "costo"], filas: [{ fila: 2, nombre: "Yerba 1kg", precio: "4.000", categoria: "Importación T2", costo: "1.700" }] }
    const previa = await previsualizarImportacion(db, { negocioId: e.n, actor: importActor, body: importBase })
    if (!previa.ok) throw new Error(previa.code)
    expect(previa.value.grupos[0].tipo).toBe("EXISTENTE")
    expect(previa.value.grupos[0].cambios.some((c) => c.startsWith("precio:"))).toBe(true)

    const c = await e.crear(e.borrador([e.linea(e.yerba.id, "1", "1600")]))
    expect(c.status).toBe(201)
    const vista = await e.vista(c.body.recepcionId)
    const propuesta = vista.body.vistaPrevia.preciosVenta.find((p: { productoId: string; estado: string }) => p.productoId === e.yerba.id && p.estado === "PROPUESTO")
    expect(propuesta).toBeTruthy()
    const etiquetaCreada = barrera(), continuarAprobacion = barrera()
    type TxFn = (tx: Prisma.TransactionClient) => Promise<unknown>
    type TxOptions = { isolationLevel?: Prisma.TransactionIsolationLevel; maxWait?: number; timeout?: number }
    const instrumentada = new Proxy(db, { get(target, prop, receiver) {
      if (prop === "$transaction") return (fn: TxFn, options?: TxOptions) => db.$transaction(async (tx) => {
        const etiquetas = new Proxy(tx.etiquetaPrecio, { get(delegate, key, targetDelegate) {
          if (key === "create") {
            const crear = Reflect.get(delegate, key, targetDelegate) as typeof tx.etiquetaPrecio.create
            return async (args: Parameters<typeof tx.etiquetaPrecio.create>[0]) => {
              const nueva = await crear.call(delegate, args)
              etiquetaCreada.liberar()
              await continuarAprobacion.espera
              return nueva
            }
          }
          return Reflect.get(delegate, key, targetDelegate)
        } })
        const txControlada = new Proxy(tx, { get(actual, key, recv) { return key === "etiquetaPrecio" ? etiquetas : Reflect.get(actual, key, recv) } })
        return fn(txControlada)
      }, options)
      return Reflect.get(target, prop, receiver)
    } })
    const aprobacionEnCurso = aprobarRecepcion(instrumentada as PrismaClient, { negocioId: e.n, recepcionId: c.body.recepcionId, body: { version: 1, actualizarPrecios: [{ clave: propuesta.clave, precioPropuesto: propuesta.precioPropuesto }] }, idempotencyKey: K() })
    await etiquetaCreada.espera
    const empleadoEnCurso = editarProductoEmpleado(db, { negocioId: e.n, empleadoId: empleado.id, productoId: e.yerba.id, body: { precio: 3500 } })
    const importacionEnCurso = ejecutarImportacion(db, { negocioId: e.n, actor: importActor, body: { ...importBase, clave: K(), archivo: "precio-atrasado.csv", decisiones: { [previa.value.grupos[0].clave]: "actualizar" } } })
    const esperaronPorProducto = await esperarBloqueosPrecio(2)
    continuarAprobacion.liberar()
    const aprobacion = await aprobacionEnCurso
    expect(aprobacion.ok).toBe(true)
    const etiqueta = await db.etiquetaPrecio.findFirstOrThrow({ where: { negocioId: e.n, productoId: e.yerba.id, estado: "PENDIENTE" } })
    const productoTrasAprobacion = await db.producto.findUniqueOrThrow({ where: { id: e.yerba.id }, select: { stockCantidad: true } })
    const movimientosTrasAprobacion = await db.movimientoInventario.count({ where: { negocioId: e.n, productoId: e.yerba.id } })
    await expect(empleadoEnCurso).rejects.toBeInstanceOf(CatalogoError)
    const confirmacion = await importacionEnCurso
    expect(esperaronPorProducto).toBe(true)
    expect(confirmacion.ok).toBe(true)
    if (!confirmacion.ok) throw new Error(confirmacion.code)
    expect(confirmacion.value.resultados[0].resultado).toBe("ACTUALIZADO")
    expect(confirmacion.value.resultados[0].detalle).toContain("Precio conservado")
    const producto = await db.producto.findUniqueOrThrow({ where: { id: e.yerba.id } })
    expect(producto.precio).toBe(3000)
    expect(producto.costo).toBe(1700)
    expect(producto.categoria).toBe("Importación T2")
    expect(producto.stockCantidad).toBe(productoTrasAprobacion.stockCantidad)
    expect((await db.etiquetaPrecio.findUniqueOrThrow({ where: { id: etiqueta.id } })).estado).toBe("PENDIENTE")
    expect(await db.activacionPrecioVenta.count({ where: { negocioId: e.n, productoId: e.yerba.id } })).toBe(0)
    expect(await db.movimientoInventario.count({ where: { negocioId: e.n, productoId: e.yerba.id } })).toBe(movimientosTrasAprobacion)
    const audit = await db.auditLog.findFirstOrThrow({ where: { recurso: "producto", recursoId: e.yerba.id, accion: "producto.modificado" }, orderBy: { fecha: "desc" } })
    expect(JSON.parse(audit.detalle).precioProtegidoPorEtiqueta).toBe(true)
  })

  ephemeralTest("si el catálogo confirma primero, la aprobación con propuesta vieja se rechaza y la relectura usa el precio nuevo", async () => {
    const e = await escenario()
    await db.producto.update({ where: { id: e.azucar.id }, data: { costo: 500 } })
    const c = await e.crear(e.borrador([e.linea(e.azucar.id, "1", "600")]))
    expect(c.status).toBe(201)
    const vistaAnterior = await e.vista(c.body.recepcionId)
    const propuestaAnterior = vistaAnterior.body.vistaPrevia.preciosVenta.find((p: { productoId: string; estado: string }) => p.productoId === e.azucar.id && p.estado === "PROPUESTO")
    expect(propuestaAnterior).toBeTruthy()

    await db.$transaction((tx) => conPrecioDeCatalogoEnTx(tx, { negocioId: e.n, productoId: e.azucar.id, varianteId: null }, () => tx.producto.update({ where: { id: e.azucar.id }, data: { precio: 1500 } }), null, { etiquetas: "DUEÑO" }))
    const obsoleta = await e.aprobar(c.body.recepcionId, { version: 1, actualizarPrecios: [{ clave: propuestaAnterior.clave, precioPropuesto: propuestaAnterior.precioPropuesto }] })
    expect(obsoleta.status).toBe(409)
    expect(obsoleta.body.code).toBe("PRECIOS_CAMBIARON")
    expect((await db.producto.findUniqueOrThrow({ where: { id: e.azucar.id } })).precio).toBe(1500)
    expect(await db.etiquetaPrecio.count({ where: { negocioId: e.n, productoId: e.azucar.id, estado: "PENDIENTE" } })).toBe(0)
    expect(await db.cambioPrecioVenta.count({ where: { negocioId: e.n, recepcionId: c.body.recepcionId } })).toBe(0)
    expect(await e.stock(e.azucar.id)).toBe(0)

    const vistaNueva = await e.vista(c.body.recepcionId)
    const propuestaNueva = vistaNueva.body.vistaPrevia.preciosVenta.find((p: { productoId: string; estado: string }) => p.productoId === e.azucar.id && p.estado === "PROPUESTO")
    expect(propuestaNueva.precioPropuesto).not.toBe(propuestaAnterior.precioPropuesto)
    const aprobada = await e.aprobar(c.body.recepcionId, { version: 1, actualizarPrecios: [{ clave: propuestaNueva.clave, precioPropuesto: propuestaNueva.precioPropuesto }] })
    expect(aprobada.status).toBe(201)
    const etiqueta = await db.etiquetaPrecio.findFirstOrThrow({ where: { negocioId: e.n, productoId: e.azucar.id, estado: "PENDIENTE" } })
    expect(etiqueta.precioAnteriorDecimal.toFixed(2)).toBe("1500.00")
    expect((await db.producto.findUniqueOrThrow({ where: { id: e.azucar.id } })).precio).toBe(1500)
    expect(await e.stock(e.azucar.id)).toBe(1)
  })
})
