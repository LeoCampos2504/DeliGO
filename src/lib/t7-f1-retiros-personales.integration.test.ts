/// <reference types="bun-types" />
// ============================================
// T7-F1 — retiros personales de mercadería desde Caja, sobre PostgreSQL EFÍMERO real
// ============================================
// A través de las rutas reales del dueño y del cajero: registro (dueño, cajero para sí mismo, otro empleado,
// familiar, dueño), carrito con variantes / sin control de stock / costo desconocido, stock disponible y reservas,
// atomicidad, idempotencia y concurrencia, permisos y revocación, aislamiento entre negocios, manipulación del
// cliente, inmutabilidad histórica, ausencia de dinero (ventas, cobros, operaciones, libro, efectivo esperado),
// resumen por persona y período, decisiones de recuperación, anulaciones y devoluciones, auditoría y avisos.

import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { createOperationalSession, createSession, OPERATIONAL_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/auth"
import { abrirTurnoCaja, asegurarCajaPredeterminada } from "@/lib/caja-turnos-service"
import { calcularSnapshotEfectivoTurno } from "@/lib/caja-turnos-snapshot"

setDefaultTimeout(300_000)

const testDatabaseUrl = process.env.DELIGO_TEST_DATABASE_URL
const isEphemeralIntegrationDb = process.env.DELIGO_EPHEMERAL_TEST_DB === "1"
if (!testDatabaseUrl || process.env.DATABASE_URL !== testDatabaseUrl) {
  throw new Error("Este test de integración requiere DELIGO_TEST_DATABASE_URL y DATABASE_URL apuntando a la misma base de prueba.")
}
const declaredEnvironment = process.env.DELIGO_ENVIRONMENT ?? process.env.RAILWAY_ENVIRONMENT_NAME ?? process.env.APP_ENV
if (!declaredEnvironment || declaredEnvironment.toUpperCase() !== "TESTING") {
  throw new Error("La suite T7-F1 sólo puede ejecutarse con DELIGO_ENVIRONMENT=TESTING.")
}
const ephemeralTest = isEphemeralIntegrationDb ? test : test.skip

const { GET: getRetirosOwner, POST: postRetiroOwner } = await import("@/app/api/negocio/caja/retiros-personales/route")
const { GET: getContextoOwner } = await import("@/app/api/negocio/caja/retiros-personales/contexto/route")
const { GET: getResumen } = await import("@/app/api/negocio/caja/retiros-personales/resumen/route")
const { GET: getDecisiones, POST: postDecision } = await import("@/app/api/negocio/caja/retiros-personales/decisiones/route")
const { POST: postAnularDecision } = await import("@/app/api/negocio/caja/retiros-personales/decisiones/[id]/anulacion/route")
const { POST: postDevolucion } = await import("@/app/api/negocio/caja/retiros-personales/[id]/devoluciones/route")
const { GET: getPermisos, PUT: putPermiso } = await import("@/app/api/negocio/empleados/permisos-retiro/route")
const { POST: postRetiroCajero } = await import("@/app/api/operativo/caja/[slug]/retiros-personales/route")
const { GET: getContextoCajero } = await import("@/app/api/operativo/caja/[slug]/retiros-personales/contexto/route")
const { POST: postVentaCajero } = await import("@/app/api/operativo/caja/[slug]/ventas/route")
const { GET: getVentasOwner } = await import("@/app/api/negocio/caja/ventas/route")

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
const K = () => randomUUID()
const p = <T extends Record<string, string>>(params: T) => ({ params: Promise.resolve(params) })
const enPromesa = <T,>(q: PromiseLike<T>): Promise<T> => Promise.resolve().then(() => q)

async function empleado(negocioId: string, suffix: string, nombre: string, area: string) {
  const cuenta = await db.cuentaOperativa.create({ data: { nombre, email: `${nombre.toLowerCase().replace(/\W+/g, "")}-${suffix}-${randomUUID().slice(0, 4)}@example.test`, activo: true, eliminado: false } })
  const e = await db.empleado.create({ data: { nombre, codigo: `R${randomUUID().slice(0, 7)}`.toUpperCase(), negocioId, cuentaOperativaId: cuenta.id, areaOperativa: area, activo: true, eliminado: false } })
  return { empleado: e, cookie: `${OPERATIONAL_SESSION_COOKIE_NAME}=${await createOperationalSession(cuenta.id)}` }
}

async function escenario() {
  const suffix = randomUUID().slice(0, 12)
  const negocio = await db.negocio.create({
    data: { slug: `test-rp-${suffix}`, nombre: `Test RP ${suffix}`, usuario: `test-rp-${suffix}`, email: `test-rp-${suffix}@example.test`, password: "fixture", rubro: "negocio", aprobado: true, suspendido: false, empleadosActivos: true, salonActivo: false, cajaTurnosModo: "OPCIONAL" },
  })
  const n = negocio.id
  const owner = `${SESSION_COOKIE_NAME}=${await createSession(n, "negocio")}`
  const a = await empleado(n, suffix, "Cajera Ana", "caja")
  const b = await empleado(n, suffix, "Cajero Beto", "caja")
  const mozo = await empleado(n, suffix, "Mozo Carlos", "mozo")
  const prod = (data: Partial<Prisma.ProductoUncheckedCreateInput>) => db.producto.create({ data: { nombre: `Prod ${randomUUID().slice(0, 6)}`, precio: 1000, negocioId: n, controlStock: false, stockCantidad: 0, ...data } as Prisma.ProductoUncheckedCreateInput })
  const conStock = await prod({ nombre: "Yerba", precio: 1000, costo: 600, controlStock: true, stockCantidad: 10 })
  const libre = await prod({ nombre: "Pan", precio: 500, costo: null, controlStock: false })
  const remera = await prod({ nombre: "Remera", precio: 2000, costo: 1100 })
  const roja = await db.productoVariante.create({ data: { productoId: remera.id, nombre: "Roja", precio: 2000, costo: 1200, controlStock: true, stockCantidad: 5, activo: true } })
  const azul = await db.productoVariante.create({ data: { productoId: remera.id, nombre: "Azul", precio: 2500, controlStock: true, stockCantidad: 1, activo: true } })
  const caja = await asegurarCajaPredeterminada(db, n)

  const permiso = async (empleadoId: string, habilitado: boolean, cookie = owner) => json(await putPermiso(req("PUT", "/api/negocio/empleados/permisos-retiro", cookie, { empleadoId, habilitado })))
  const retiroOwner = async (body: Record<string, unknown>, key: string | null = K(), cookie = owner) => json(await postRetiroOwner(req("POST", "/api/negocio/caja/retiros-personales", cookie, { confirmado: true, ...body }, key ?? undefined)))
  const retiroCajero = async (cookie: string, body: Record<string, unknown>, key: string | null = K()) =>
    json(await postRetiroCajero(req("POST", `/api/operativo/caja/${negocio.slug}/retiros-personales`, cookie, { confirmado: true, ...body }, key ?? undefined), p({ slug: negocio.slug })))
  const contextoCajero = async (cookie: string) => json(await getContextoCajero(req("GET", `/api/operativo/caja/${negocio.slug}/retiros-personales/contexto`, cookie), p({ slug: negocio.slug })))
  const contextoOwner = async () => json(await getContextoOwner(req("GET", "/api/negocio/caja/retiros-personales/contexto", owner)))
  const periodo = (extra = "", desde = new Date(Date.now() - 86_400_000), hasta = new Date(Date.now() + 86_400_000)) => `?desde=${encodeURIComponent(desde.toISOString())}&hasta=${encodeURIComponent(hasta.toISOString())}${extra}`
  const resumen = async (extra = "", cookie = owner) => json(await getResumen(req("GET", `/api/negocio/caja/retiros-personales/resumen${periodo(extra)}`, cookie)))
  const lista = async (extra = "", cookie = owner) => json(await getRetirosOwner(req("GET", `/api/negocio/caja/retiros-personales${periodo(extra)}`, cookie)))
  const decidir = async (body: Record<string, unknown>, cookie = owner) => json(await postDecision(req("POST", "/api/negocio/caja/retiros-personales/decisiones", cookie, body)))
  const historial = async (empleadoId: string) => json(await getDecisiones(req("GET", `/api/negocio/caja/retiros-personales/decisiones?empleadoId=${empleadoId}`, owner)))
  const anularDecision = async (id: string, cookie = owner) => json(await postAnularDecision(req("POST", `/api/negocio/caja/retiros-personales/decisiones/${id}/anulacion`, cookie, {}), p({ id })))
  const devolver = async (id: string, body: Record<string, unknown>, key: string | null = K(), cookie = owner) => json(await postDevolucion(req("POST", `/api/negocio/caja/retiros-personales/${id}/devoluciones`, cookie, body, key ?? undefined), p({ id })))
  const stock = async () => ({
    yerba: (await db.producto.findUniqueOrThrow({ where: { id: conStock.id } })).stockCantidad,
    pan: (await db.producto.findUniqueOrThrow({ where: { id: libre.id } })).stockCantidad,
    roja: (await db.productoVariante.findUniqueOrThrow({ where: { id: roja.id } })).stockCantidad,
    azul: (await db.productoVariante.findUniqueOrThrow({ where: { id: azul.id } })).stockCantidad,
  })
  /** Todo lo que un retiro NUNCA debe tocar: ventas, cobros, operaciones y movimientos financieros. */
  const dinero = async () => ({
    ventas: await db.venta.count({ where: { negocioId: n } }),
    cobros: await db.cobroVenta.count({ where: { venta: { negocioId: n } } }),
    operaciones: await db.operacionFinanciera.count({ where: { negocioId: n } }),
    movimientos: await db.movimientoFinanciero.count({ where: { negocioId: n } }),
    egresos: await db.egresoCaja.count({ where: { negocioId: n } }),
  })
  const conteos = async () => ({
    retiros: await db.retiroPersonal.count({ where: { negocioId: n } }),
    lineas: await db.retiroPersonalLinea.count({ where: { negocioId: n } }),
    familiares: await db.familiarRetiro.count({ where: { negocioId: n } }),
    movInv: await db.movimientoInventario.count({ where: { negocioId: n } }),
    auditorias: await db.auditLog.count({ where: { recurso: { in: ["retiro_personal", "decision_recupero_retiro"] }, detalle: { contains: n } } }),
  })
  const reservar = async (productoId: string, cantidad: number) => {
    const pedido = await db.pedido.create({ data: { negocioId: n, negocioSlug: negocio.slug, negocioNombre: negocio.nombre, clienteNombre: "Cliente RP", metodoEntrega: "retiro", estado: "recibido", total: 100, totalProductos: 100, idempotencyKey: `test-rp-${randomUUID()}` } })
    const item = await db.pedidoItem.create({ data: { pedidoId: pedido.id, productoId, nombre: "Reservado", precio: 100, cantidad } })
    await db.reservaStock.create({ data: { negocioId: n, pedidoId: pedido.id, pedidoItemId: item.id, productoId, cantidad, estado: "ACTIVA" } })
  }
  return { negocio, n, owner, a, b, mozo, conStock, libre, remera, roja, azul, caja, permiso, retiroOwner, retiroCajero, contextoCajero, contextoOwner, resumen, lista, decidir, historial, anularDecision, devolver, stock, dinero, conteos, reservar }
}

const DUENO = { tipo: "DUENO" }

describe("T7-F1 — registro de retiros personales", () => {
  ephemeralTest("dueño: carrito con variantes, sin control de stock y costo desconocido; sólo se mueve el stock controlado y nada de dinero", async () => {
    const s = await escenario()
    const dinero0 = await s.dinero()
    const r = await s.retiroOwner({
      beneficiario: DUENO,
      items: [{ productoId: s.conStock.id, cantidad: 2 }, { productoId: s.libre.id, cantidad: 3 }, { productoId: s.remera.id, varianteId: s.roja.id, cantidad: 1 }],
      observaciones: "  Para la casa  ",
    })
    expect(r.status).toBe(201)
    const ret = r.body.retiro
    expect(ret.beneficiarioTipo).toBe("DUENO")
    expect(ret.beneficiarioNombre).toBe(s.negocio.nombre)
    expect(ret.registradoPorTipo).toBe("NEGOCIO")
    expect(ret.valorComercial).toBe(2000 + 1500 + 2000)
    expect(ret.costoConocido).toBe(1200 + 1200) // yerba 2×600 + roja 1×1200; el pan tiene costo desconocido
    expect(ret.costoCompleto).toBe(false)
    expect(ret.observaciones).toBe("Para la casa")
    expect(ret.admiteDecision).toBe(false)
    const pan = ret.lineas.find((l: any) => l.nombre === "Pan")
    expect(pan.costoUnitario).toBeNull() // desconocido, NUNCA 0
    expect(pan.movioStock).toBe(false)
    expect(ret.lineas.find((l: any) => l.varianteNombre === "Roja").movioStock).toBe(true)
    expect(await s.stock()).toEqual({ yerba: 8, pan: 0, roja: 4, azul: 1 })
    const movs = await db.movimientoInventario.findMany({ where: { negocioId: s.n }, orderBy: { createdAt: "asc" } })
    expect(movs.map((m) => [m.tipo, m.retiroPersonalId, m.ventaId, m.cantidad]).sort()).toEqual([["RETIRO_PERSONAL", ret.id, null, 1], ["RETIRO_PERSONAL", ret.id, null, 2]].sort())
    expect(await s.dinero()).toEqual(dinero0)
    expect(await db.auditLog.count({ where: { accion: "retiro_personal.registrado", recursoId: ret.id, userId: s.n } })).toBe(1)
    expect(await db.notificacion.count({ where: { userId: s.n, tipo: "caja_retiro_personal" } })).toBe(0) // lo registró el dueño
    // el producto sin control sigue sin control (no se activa automáticamente)
    expect((await db.producto.findUniqueOrThrow({ where: { id: s.libre.id } })).controlStock).toBe(false)
  })

  ephemeralTest("cajero autorizado: para sí mismo y para otro empleado; identidad real del registrante, turno como contexto y efectivo esperado intacto", async () => {
    const s = await escenario()
    expect((await s.permiso(s.a.empleado.id, true)).status).toBe(200)
    const turno = await abrirTurnoCaja(db, { negocioId: s.n, actor: { tipo: "EMPLEADO", empleadoId: s.a.empleado.id }, cajaFisicaId: s.caja.id, fondoInicial: "10000", idempotencyKey: K() })
    if (!turno.ok) throw new Error("fixture turno")
    const esperado0 = (await calcularSnapshotEfectivoTurno(db, s.n, turno.value.turno.id))!.esperado.toFixed(2)
    const dinero0 = await s.dinero()

    const ctx = await s.contextoCajero(s.a.cookie)
    expect(ctx.body.habilitado).toBe(true)
    expect(ctx.body.propioEmpleadoId).toBe(s.a.empleado.id)
    expect(ctx.body.empleados.map((e: any) => e.id).sort()).toEqual([s.a.empleado.id, s.b.empleado.id, s.mozo.empleado.id].sort())
    expect(JSON.stringify(ctx.body)).not.toMatch(/costo/i)

    const propio = await s.retiroCajero(s.a.cookie, { beneficiario: { tipo: "EMPLEADO", empleadoId: s.a.empleado.id }, items: [{ productoId: s.conStock.id, cantidad: 1 }] })
    expect(propio.status).toBe(201)
    expect(JSON.stringify(propio.body)).not.toMatch(/costo|decision/i) // el cajero nunca ve costos ni decisiones
    const otro = await s.retiroCajero(s.a.cookie, { beneficiario: { tipo: "EMPLEADO", empleadoId: s.mozo.empleado.id }, items: [{ productoId: s.libre.id, cantidad: 1 }] })
    expect(otro.status).toBe(201)

    const filas = await db.retiroPersonal.findMany({ where: { negocioId: s.n }, orderBy: { createdAt: "asc" } })
    expect(filas.map((f) => [f.beneficiarioTipo, f.beneficiarioEmpleadoId, f.registradoPorTipo, f.registradoPorEmpleadoId, f.registradoPorNombre, f.turnoCajaId])).toEqual([
      ["EMPLEADO", s.a.empleado.id, "EMPLEADO", s.a.empleado.id, "Cajera Ana", turno.value.turno.id],
      ["EMPLEADO", s.mozo.empleado.id, "EMPLEADO", s.a.empleado.id, "Cajera Ana", turno.value.turno.id],
    ])
    expect((await calcularSnapshotEfectivoTurno(db, s.n, turno.value.turno.id))!.esperado.toFixed(2)).toBe(esperado0)
    expect(await s.dinero()).toEqual(dinero0)
    const avisos = await db.notificacion.findMany({ where: { userId: s.n, userType: "negocio", tipo: "caja_retiro_personal" } })
    expect(avisos).toHaveLength(2)
    expect(avisos.every((x) => x.cuerpo.includes("Cajera Ana") && x.cuerpo.includes("No ingresó dinero") && JSON.parse(x.datos).navigateTo.negocio === "administracion")).toBe(true)
    expect(await db.auditLog.count({ where: { accion: "retiro_personal.registrado", userId: s.a.empleado.id, userType: "empleado" } })).toBe(2)
  })

  ephemeralTest("familiares: alta, reutilización explícita y dos personas con el mismo nombre nunca se fusionan automáticamente", async () => {
    const s = await escenario()
    const nuevo = await s.retiroOwner({ beneficiario: { tipo: "FAMILIAR", nuevoNombre: "  Ana   Pérez " }, items: [{ productoId: s.libre.id, cantidad: 1 }] })
    expect(nuevo.status).toBe(201)
    expect(nuevo.body.retiro.beneficiarioNombre).toBe("Ana Pérez")
    const fam = await db.familiarRetiro.findFirstOrThrow({ where: { negocioId: s.n } })
    expect(fam.nombreNormalizado).toBe("ana perez")
    // mismo nombre (mayúsculas/acentos distintos) escrito como NUEVO → no se asume la misma persona
    const antes = await s.conteos()
    const igual = await s.retiroOwner({ beneficiario: { tipo: "FAMILIAR", nuevoNombre: "ANA PEREZ" }, items: [{ productoId: s.conStock.id, cantidad: 1 }] })
    expect(igual.status).toBe(409)
    expect(igual.body.code).toBe("FAMILIAR_NOMBRE_EXISTENTE")
    expect(igual.body.familiar).toEqual({ id: fam.id, nombre: "Ana Pérez" })
    expect(await s.conteos()).toEqual(antes)
    expect((await s.stock()).yerba).toBe(10)
    // la misma persona se elige explícitamente; otra persona se distingue con otro nombre
    expect((await s.retiroOwner({ beneficiario: { tipo: "FAMILIAR", familiarId: fam.id }, items: [{ productoId: s.libre.id, cantidad: 1 }] })).status).toBe(201)
    expect((await s.retiroOwner({ beneficiario: { tipo: "FAMILIAR", nuevoNombre: "Ana Pérez (sobrina)" }, items: [{ productoId: s.libre.id, cantidad: 1 }] })).status).toBe(201)
    const familiares = (await s.contextoOwner()).body.familiares.map((f: any) => f.nombre).sort()
    expect(familiares).toEqual(["Ana Pérez", "Ana Pérez (sobrina)"])
    // dos altas simultáneas del mismo nombre nuevo: una sola persona creada, la otra recibe el aviso
    const carrera = await Promise.all([0, 1, 2].map(() => s.retiroOwner({ beneficiario: { tipo: "FAMILIAR", nuevoNombre: "Luis Gómez" }, items: [{ productoId: s.libre.id, cantidad: 1 }] })))
    expect(carrera.filter((x) => x.status === 201)).toHaveLength(1)
    expect(carrera.filter((x) => x.status === 409).every((x) => ["FAMILIAR_NOMBRE_EXISTENTE", "RETIRO_CONFLICTO_CONCURRENTE"].includes(x.body.code))).toBe(true)
    expect(await db.familiarRetiro.count({ where: { negocioId: s.n, nombreNormalizado: "luis gomez" } })).toBe(1)
    // un familiar no necesita cuenta de DeliGO
    expect(await db.cuentaOperativa.count({ where: { nombre: "Luis Gómez" } })).toBe(0)
  })
})

describe("T7-F1 — stock, atomicidad, idempotencia y concurrencia", () => {
  ephemeralTest("stock insuficiente, stock reservado para pedidos y una línea inválida rechazan TODO el retiro", async () => {
    const s = await escenario()
    const antes = await s.conteos()
    const insuf = await s.retiroOwner({ beneficiario: DUENO, items: [{ productoId: s.remera.id, varianteId: s.azul.id, cantidad: 2 }] })
    expect([insuf.status, insuf.body.code]).toEqual([409, "STOCK_INSUFFICIENT"])
    await s.reservar(s.conStock.id, 9) // 10 físicos, 9 reservados → 1 disponible
    const reservado = await s.retiroOwner({ beneficiario: DUENO, items: [{ productoId: s.conStock.id, cantidad: 2 }] })
    expect([reservado.status, reservado.body.code]).toEqual([409, "STOCK_RESERVED_FOR_ORDERS"])
    // atomicidad: la primera línea alcanzaría, la segunda no → nada (ni stock, ni familiar nuevo, ni retiro)
    const mixto = await s.retiroOwner({ beneficiario: { tipo: "FAMILIAR", nuevoNombre: "Marta" }, items: [{ productoId: s.remera.id, varianteId: s.roja.id, cantidad: 2 }, { productoId: s.conStock.id, cantidad: 5 }] })
    expect(mixto.status).toBe(409)
    // líneas repetidas de la misma clave se suman antes de validar
    const repetidas = await s.retiroOwner({ beneficiario: DUENO, items: [{ productoId: s.remera.id, varianteId: s.azul.id, cantidad: 1 }, { productoId: s.remera.id, varianteId: s.azul.id, cantidad: 1 }] })
    expect(repetidas.status).toBe(409)
    // producto inexistente / de otro negocio
    const otro = await escenario()
    const ajeno = await s.retiroOwner({ beneficiario: DUENO, items: [{ productoId: s.libre.id, cantidad: 1 }, { productoId: otro.conStock.id, cantidad: 1 }] })
    expect(ajeno.status).toBe(400)
    expect(await s.conteos()).toEqual(antes)
    expect(await s.stock()).toEqual({ yerba: 10, pan: 0, roja: 5, azul: 1 })
    expect((await otro.stock()).yerba).toBe(10)
    // sólo la unidad disponible
    expect((await s.retiroOwner({ beneficiario: DUENO, items: [{ productoId: s.conStock.id, cantidad: 1 }] })).status).toBe(201)
    expect((await s.stock()).yerba).toBe(9)
  })

  ephemeralTest("idempotencia: reintento exacto, clave reutilizada con otro contenido y envíos concurrentes con la misma clave", async () => {
    const s = await escenario()
    const key = K()
    const body = { beneficiario: DUENO, items: [{ productoId: s.conStock.id, cantidad: 3 }] }
    const r1 = await s.retiroOwner(body, key)
    const r2 = await s.retiroOwner(body, key)
    expect([r1.status, r2.status, r2.replayed, r2.body.retiro.id]).toEqual([201, 200, true, r1.body.retiro.id])
    const r3 = await s.retiroOwner({ ...body, items: [{ productoId: s.conStock.id, cantidad: 4 }] }, key)
    expect([r3.status, r3.body.code]).toEqual([409, "IDEMPOTENCY_KEY_REUSED"])
    expect((await s.stock()).yerba).toBe(7)
    const k2 = K()
    const paralelo = await Promise.all([0, 1, 2, 3, 4].map(() => s.retiroOwner({ beneficiario: DUENO, items: [{ productoId: s.conStock.id, cantidad: 1 }] }, k2)))
    expect(paralelo.every((x) => x.status === 200 || x.status === 201 || (x.status === 409 && x.body.code === "RETIRO_CONFLICTO_CONCURRENTE"))).toBe(true)
    expect(new Set(paralelo.filter((x) => x.status < 300).map((x) => x.body.retiro.id)).size).toBe(1)
    expect(await db.retiroPersonal.count({ where: { negocioId: s.n } })).toBe(2)
    expect((await s.stock()).yerba).toBe(6)
    // sin clave o sin confirmación explícita → nada
    expect((await s.retiroOwner(body, null)).status).toBe(400)
    expect((await json(await postRetiroOwner(req("POST", "/api/negocio/caja/retiros-personales", s.owner, { beneficiario: DUENO, items: body.items }, K())))).status).toBe(400)
  })

  ephemeralTest("concurrencia: varios retiros distintos compiten por la última unidad; nunca queda stock negativo", async () => {
    const s = await escenario()
    expect((await s.permiso(s.a.empleado.id, true)).status).toBe(200)
    const intentos = await Promise.all([
      s.retiroOwner({ beneficiario: DUENO, items: [{ productoId: s.remera.id, varianteId: s.azul.id, cantidad: 1 }] }),
      s.retiroOwner({ beneficiario: DUENO, items: [{ productoId: s.remera.id, varianteId: s.azul.id, cantidad: 1 }] }),
      s.retiroCajero(s.a.cookie, { beneficiario: { tipo: "EMPLEADO", empleadoId: s.a.empleado.id }, items: [{ productoId: s.remera.id, varianteId: s.azul.id, cantidad: 1 }] }),
      s.retiroCajero(s.a.cookie, { beneficiario: { tipo: "EMPLEADO", empleadoId: s.b.empleado.id }, items: [{ productoId: s.remera.id, varianteId: s.azul.id, cantidad: 1 }] }),
    ])
    expect(intentos.filter((x) => x.status === 201)).toHaveLength(1)
    expect(intentos.filter((x) => x.status !== 201).every((x) => x.status === 409)).toBe(true)
    expect((await s.stock()).azul).toBe(0)
    expect(await db.movimientoInventario.count({ where: { negocioId: s.n, tipo: "RETIRO_PERSONAL" } })).toBe(1)
  })

  ephemeralTest("el cliente no puede fijar precios, costos, totales ni registrante; un total desactualizado no registra nada", async () => {
    const s = await escenario()
    const r = await s.retiroOwner({
      beneficiario: DUENO,
      items: [{ productoId: s.conStock.id, cantidad: 1, precio: 1, costo: 0, subtotal: 1 }],
      valorComercial: 1, costoConocido: 0, registradoPorNombre: "Otro", registradoPorTipo: "EMPLEADO", negocioId: "otro",
    })
    expect(r.status).toBe(201)
    expect([r.body.retiro.valorComercial, r.body.retiro.costoConocido, r.body.retiro.registradoPorTipo]).toEqual([1000, 600, "NEGOCIO"])
    const antes = await s.conteos()
    const desactualizado = await s.retiroOwner({ beneficiario: DUENO, items: [{ productoId: s.conStock.id, cantidad: 1 }], totalMostrado: 900 })
    expect([desactualizado.status, desactualizado.body.code]).toEqual([409, "PRECIOS_CAMBIARON"])
    expect(await s.conteos()).toEqual(antes)
    // un producto sin precio de venta no se retira (como en una venta)
    const sinPrecio = await db.producto.create({ data: { nombre: "Sin precio", precio: 0, negocioId: s.n } })
    expect((await s.retiroOwner({ beneficiario: DUENO, items: [{ productoId: sinPrecio.id, cantidad: 1 }] })).body.code).toBe("PRODUCTO_SIN_PRECIO")
  })

  ephemeralTest("inmutabilidad histórica: cambiar precio, costo, nombres o el empleado no altera retiros registrados", async () => {
    const s = await escenario()
    expect((await s.permiso(s.a.empleado.id, true)).status).toBe(200)
    const r = await s.retiroCajero(s.a.cookie, { beneficiario: { tipo: "EMPLEADO", empleadoId: s.mozo.empleado.id }, items: [{ productoId: s.remera.id, varianteId: s.roja.id, cantidad: 2 }] })
    expect(r.status).toBe(201)
    await db.producto.update({ where: { id: s.remera.id }, data: { nombre: "Remera nueva", precio: 9999, costo: 9999 } })
    await db.productoVariante.update({ where: { id: s.roja.id }, data: { nombre: "Bordó", precio: 9999, costo: 9999 } })
    await db.empleado.update({ where: { id: s.mozo.empleado.id }, data: { nombre: "Otro nombre" } })
    await db.cuentaOperativa.update({ where: { id: s.mozo.empleado.cuentaOperativaId! }, data: { nombre: "Otro nombre" } })
    const det = (await s.lista()).body.retiros[0]
    expect([det.beneficiarioNombre, det.valorComercial, det.costoConocido, det.lineas[0].nombre, det.lineas[0].varianteNombre, det.lineas[0].precioUnitario, det.lineas[0].costoUnitario]).toEqual(["Mozo Carlos", 4000, 2400, "Remera", "Roja", 2000, 1200])
  })
})

describe("T7-F1 — permisos, aislamiento y exclusión de ventas", () => {
  ephemeralTest("sin permiso no se registra (ni llamando la API); la revocación vale para la sesión abierta; sólo empleados de Caja", async () => {
    const s = await escenario()
    const body = { beneficiario: { tipo: "EMPLEADO", empleadoId: s.b.empleado.id }, items: [{ productoId: s.conStock.id, cantidad: 1 }] }
    expect((await s.retiroCajero(s.b.cookie, body)).body.code).toBe("RETIRO_NO_HABILITADO")
    expect((await s.contextoCajero(s.b.cookie)).body).toMatchObject({ habilitado: false, empleados: [], familiares: [] })
    expect((await db.empleado.findUniqueOrThrow({ where: { id: s.a.empleado.id } })).retiroPersonalHabilitado).toBe(false) // conservador
    expect((await s.permiso(s.b.empleado.id, true)).status).toBe(200)
    expect((await s.retiroCajero(s.b.cookie, body)).status).toBe(201)
    expect((await s.permiso(s.b.empleado.id, false)).status).toBe(200)
    expect((await s.retiroCajero(s.b.cookie, body)).status).toBe(403) // misma sesión, permiso revocado
    expect((await s.permiso(s.mozo.empleado.id, true)).body.code).toBe("EMPLEADO_NO_ES_CAJA")
    expect((await s.retiroCajero(s.mozo.cookie, body)).status).toBe(403) // no es del área Caja
    expect(await db.auditLog.count({ where: { accion: "empleado.permiso_retiro_personal", recursoId: s.b.empleado.id } })).toBe(2)
    const permisos = json(await getPermisos(req("GET", "/api/negocio/empleados/permisos-retiro", s.owner)))
    expect((await permisos).body.empleados.map((e: any) => e.id).sort()).toEqual([s.a.empleado.id, s.b.empleado.id].sort())
    // el cajero no llega a las rutas del dueño (resumen, decisiones, devoluciones, permisos)
    expect((await s.resumen("", s.b.cookie)).status).toBe(401)
    expect((await s.decidir({ empleadoId: s.b.empleado.id, retiroIds: ["x"], importe: "0" }, s.b.cookie)).status).toBe(401)
    expect((await s.devolver("x", { tipo: "ANULACION", motivo: "x", confirmado: true }, K(), s.b.cookie)).status).toBe(401)
    expect((await s.permiso(s.b.empleado.id, true, s.b.cookie)).status).toBe(401)
  })

  ephemeralTest("aislamiento: otro negocio no ve, decide ni corrige; beneficiarios y familiares ajenos se rechazan", async () => {
    const s = await escenario()
    const otro = await escenario()
    const r = await s.retiroOwner({ beneficiario: { tipo: "EMPLEADO", empleadoId: s.mozo.empleado.id }, items: [{ productoId: s.conStock.id, cantidad: 1 }] })
    expect(r.status).toBe(201)
    expect((await otro.lista()).body.retiros).toHaveLength(0)
    expect((await otro.resumen()).body.resumen.cantidadRetiros).toBe(0)
    expect((await otro.decidir({ empleadoId: s.mozo.empleado.id, retiroIds: [r.body.retiro.id], importe: "0" })).status).toBe(404)
    expect((await otro.devolver(r.body.retiro.id, { tipo: "ANULACION", motivo: "ajeno", confirmado: true })).status).toBe(404)
    expect((await s.retiroOwner({ beneficiario: { tipo: "EMPLEADO", empleadoId: otro.mozo.empleado.id }, items: [{ productoId: s.conStock.id, cantidad: 1 }] })).body.code).toBe("BENEFICIARIO_INVALIDO")
    const famOtro = await otro.retiroOwner({ beneficiario: { tipo: "FAMILIAR", nuevoNombre: "Pedro" }, items: [{ productoId: otro.libre.id, cantidad: 1 }] })
    const famOtroId = (await db.familiarRetiro.findFirstOrThrow({ where: { negocioId: otro.n } })).id
    expect(famOtro.status).toBe(201)
    expect((await s.retiroOwner({ beneficiario: { tipo: "FAMILIAR", familiarId: famOtroId }, items: [{ productoId: s.conStock.id, cantidad: 1 }] })).body.code).toBe("BENEFICIARIO_INVALIDO")
    // la sesión de un cajero vale sólo para SU negocio
    expect((await s.permiso(s.a.empleado.id, true)).status).toBe(200)
    expect((await json(await postRetiroCajero(req("POST", `/api/operativo/caja/${otro.negocio.slug}/retiros-personales`, s.a.cookie, { confirmado: true, beneficiario: DUENO, items: [{ productoId: otro.conStock.id, cantidad: 1 }] }, K()), p({ slug: otro.negocio.slug })))).status).toBe(403)
  })

  ephemeralTest("los retiros no son ventas: el resumen de ventas y los cobros no cambian; una venta normal sigue funcionando", async () => {
    const s = await escenario()
    expect((await s.permiso(s.a.empleado.id, true)).status).toBe(200)
    expect((await s.retiroOwner({ beneficiario: DUENO, items: [{ productoId: s.conStock.id, cantidad: 2 }] })).status).toBe(201)
    expect((await s.retiroCajero(s.a.cookie, { beneficiario: { tipo: "EMPLEADO", empleadoId: s.a.empleado.id }, items: [{ productoId: s.libre.id, cantidad: 2 }] })).status).toBe(201)
    const ventas = await json(await getVentasOwner(req("GET", "/api/negocio/caja/ventas", s.owner)))
    expect([ventas.body.resumenHoy.cantidadVentas, ventas.body.resumenHoy.totalVendido, ventas.body.ventasHoy.length]).toEqual([0, 0, 0])
    const venta = await json(await postVentaCajero(req("POST", `/api/operativo/caja/${s.negocio.slug}/ventas`, s.a.cookie, { metodoPago: "EFECTIVO", items: [{ productoId: s.conStock.id, cantidad: 1 }] }, K()), p({ slug: s.negocio.slug })))
    expect(venta.status).toBe(201)
    expect((await s.stock()).yerba).toBe(7)
    const ventas2 = await json(await getVentasOwner(req("GET", "/api/negocio/caja/ventas", s.owner)))
    expect([ventas2.body.resumenHoy.cantidadVentas, ventas2.body.resumenHoy.totalVendido]).toEqual([1, 1000])
    expect((await s.resumen()).body.resumen.valorComercial).toBe(2000 + 1000)
  })
})

describe("T7-F1 — resumen, decisiones, anulaciones y devoluciones", () => {
  async function conRetirosDeEmpleado() {
    const s = await escenario()
    const E = { tipo: "EMPLEADO", empleadoId: s.mozo.empleado.id }
    const ids: string[] = []
    for (const cantidad of [2, 1, 3]) {
      const r = await s.retiroOwner({ beneficiario: E, items: [{ productoId: s.conStock.id, cantidad }] }) // 2000, 1000, 3000
      expect(r.status).toBe(201)
      ids.push(r.body.retiro.id)
    }
    return { s, ids, empleadoId: s.mozo.empleado.id }
  }

  ephemeralTest("resumen por período, tipo y persona", async () => {
    const { s } = await conRetirosDeEmpleado()
    expect((await s.retiroOwner({ beneficiario: DUENO, items: [{ productoId: s.libre.id, cantidad: 2 }] })).status).toBe(201)
    expect((await s.retiroOwner({ beneficiario: { tipo: "FAMILIAR", nuevoNombre: "Rosa" }, items: [{ productoId: s.remera.id, varianteId: s.roja.id, cantidad: 1 }] })).status).toBe(201)
    const r = (await s.resumen()).body.resumen
    expect([r.cantidadRetiros, r.valorComercial, r.costoConocido, r.porTipo, r.importeDecididoRecuperar, r.importePendienteDecision, r.importeRecuperadoRegistrado, r.retirosConCostoIncompleto])
      .toEqual([5, 6000 + 1000 + 2000, 3600 + 1200, { EMPLEADO: 6000, FAMILIAR: 2000, DUENO: 1000 }, 0, 6000, null, 1])
    const mozo = r.personas.find((x: any) => x.clave === `EMPLEADO:${s.mozo.empleado.id}`)
    expect([mozo.nombre, mozo.cantidad, mozo.valor, mozo.pendiente]).toEqual(["Mozo Carlos", 3, 6000, 6000])
    expect((await s.resumen("&tipo=FAMILIAR")).body.resumen.valorComercial).toBe(2000)
    expect((await s.lista(`&persona=EMPLEADO:${s.mozo.empleado.id}`)).body.retiros).toHaveLength(3)
    const futuro = await json(await getResumen(req("GET", `/api/negocio/caja/retiros-personales/resumen?desde=${encodeURIComponent(new Date(Date.now() + 2 * 86_400_000).toISOString())}&hasta=${encodeURIComponent(new Date(Date.now() + 3 * 86_400_000).toISOString())}`, s.owner)))
    expect(futuro.body.resumen.cantidadRetiros).toBe(0)
    expect((await json(await getResumen(req("GET", "/api/negocio/caja/retiros-personales/resumen?desde=x&hasta=y", s.owner)))).status).toBe(400)
  })

  ephemeralTest("decisiones: parcial (del más antiguo al más nuevo), total, nula, sin duplicados ni excesos, modificación con historial y vuelta a pendiente", async () => {
    const { s, ids, empleadoId } = await conRetirosDeEmpleado()
    const dinero0 = await s.dinero()
    expect((await s.decidir({ empleadoId, retiroIds: ids, importe: "6000.01" })).body.code).toBe("IMPORTE_EXCEDE_ELEGIBLE")
    const parcial = await s.decidir({ empleadoId, retiroIds: ids, importe: "2500", motivo: "Asumo el resto" })
    expect(parcial.status).toBe(201)
    const items = await db.decisionRecuperoRetiroItem.findMany({ where: { decisionId: parcial.body.decisionId }, include: { retiro: true }, orderBy: { retiro: { createdAt: "asc" } } })
    expect(items.map((i) => i.asignadoDecimal.toFixed(2))).toEqual(["2000.00", "500.00", "0.00"])
    expect((await s.decidir({ empleadoId, retiroIds: [ids[0]], importe: "100" })).body.code).toBe("RETIRO_YA_DECIDIDO")
    let r = (await s.resumen()).body.resumen
    expect([r.importeDecididoRecuperar, r.importePendienteDecision]).toEqual([2500, 0])
    // modificar = reemplazar (la anterior queda en el historial)
    const total = await s.decidir({ empleadoId, retiroIds: ids, importe: "6000", reemplazaDecisionId: parcial.body.decisionId })
    expect(total.status).toBe(201)
    expect((await s.decidir({ empleadoId, retiroIds: ids, importe: "0", reemplazaDecisionId: parcial.body.decisionId })).body.code).toBe("DECISION_NO_VIGENTE")
    // vuelta a pendiente y decisión nula
    expect((await s.anularDecision(total.body.decisionId)).status).toBe(200)
    r = (await s.resumen()).body.resumen
    expect([r.importeDecididoRecuperar, r.importePendienteDecision]).toEqual([0, 6000])
    expect((await s.decidir({ empleadoId, retiroIds: [ids[1]], importe: "0" })).status).toBe(201)
    const hist = (await s.historial(empleadoId)).body.decisiones.map((d: any) => [d.estado, d.importeRecuperar])
    expect(hist).toEqual([["VIGENTE", 0], ["ANULADA", 6000], ["REEMPLAZADA", 2500]])
    expect(await db.auditLog.count({ where: { recurso: "decision_recupero_retiro", userId: s.n } })).toBe(4)
    // una decisión nunca mueve dinero ni se cuenta como recuperado
    expect(await s.dinero()).toEqual(dinero0)
    expect((await s.resumen()).body.resumen.importeRecuperadoRegistrado).toBeNull()
    // retiros de un familiar o del dueño no admiten decisión; dos decisiones simultáneas: una sola gana
    const fam = await s.retiroOwner({ beneficiario: { tipo: "FAMILIAR", nuevoNombre: "Tía" }, items: [{ productoId: s.libre.id, cantidad: 1 }] })
    expect((await s.decidir({ empleadoId, retiroIds: [fam.body.retiro.id], importe: "0" })).body.code).toBe("RETIRO_DE_OTRA_PERSONA")
    const carrera = await Promise.all([s.decidir({ empleadoId, retiroIds: [ids[2]], importe: "100" }), s.decidir({ empleadoId, retiroIds: [ids[2]], importe: "200" })])
    expect(carrera.filter((x) => x.status === 201)).toHaveLength(1)
    expect(await db.decisionRecuperoRetiroItem.count({ where: { retiroId: ids[2], vigente: true } })).toBe(1)
  })

  ephemeralTest("devoluciones y anulaciones: reingreso exacto, sin duplicar stock, idempotentes y coherentes con las decisiones", async () => {
    const s = await escenario()
    const r = await s.retiroOwner({ beneficiario: { tipo: "EMPLEADO", empleadoId: s.mozo.empleado.id }, items: [{ productoId: s.conStock.id, cantidad: 4 }, { productoId: s.libre.id, cantidad: 2 }, { productoId: s.remera.id, varianteId: s.roja.id, cantidad: 2 }] })
    expect(r.status).toBe(201)
    const id = r.body.retiro.id
    const linea = (nombre: string, variante: string | null = null) => r.body.retiro.lineas.find((l: any) => l.nombre === nombre && l.varianteNombre === variante).id
    expect(await s.stock()).toEqual({ yerba: 6, pan: 0, roja: 3, azul: 1 })
    const dinero0 = await s.dinero()
    // decisión por todo el valor → una devolución que la dejaría por encima del elegible se rechaza sin tocar nada
    const dec = await s.decidir({ empleadoId: s.mozo.empleado.id, retiroIds: [id], importe: String(r.body.retiro.valorComercial) })
    expect(dec.status).toBe(201)
    const bloqueada = await s.devolver(id, { tipo: "DEVOLUCION", motivo: "Devolvió", lineas: [{ lineaId: linea("Yerba"), cantidad: 1 }] })
    expect(bloqueada.body.code).toBe("DECISION_REQUIERE_REVISION")
    expect(await s.stock()).toEqual({ yerba: 6, pan: 0, roja: 3, azul: 1 })
    expect((await s.anularDecision(dec.body.decisionId)).status).toBe(200)
    // devolución parcial: vuelve exactamente lo devuelto; el pan (sin control) no crea stock
    const key = K()
    const dev = await s.devolver(id, { tipo: "DEVOLUCION", motivo: "Devolvió dos yerbas y un pan", lineas: [{ lineaId: linea("Yerba"), cantidad: 2 }, { lineaId: linea("Pan"), cantidad: 1 }] }, key)
    expect(dev.status).toBe(201)
    expect(dev.body.retiro.valorVigente).toBe(4000 + 1000 + 4000 - 2000 - 500)
    const replay = await s.devolver(id, { tipo: "DEVOLUCION", motivo: "Devolvió dos yerbas y un pan", lineas: [{ lineaId: linea("Yerba"), cantidad: 2 }, { lineaId: linea("Pan"), cantidad: 1 }] }, key)
    expect([replay.status, replay.replayed]).toEqual([200, true])
    expect(await s.stock()).toEqual({ yerba: 8, pan: 0, roja: 3, azul: 1 })
    expect((await s.devolver(id, { tipo: "DEVOLUCION", motivo: "De más", lineas: [{ lineaId: linea("Yerba"), cantidad: 3 }] })).body.code).toBe("DEVOLUCION_EXCEDE_RETIRADO")
    // si el control de stock se desactivó después, la devolución no mueve stock
    await db.productoVariante.update({ where: { id: s.roja.id }, data: { controlStock: false } })
    // anulación: el resto vuelve (sólo lo controlado), el original se conserva y el estado queda ANULADO
    const anul = await s.devolver(id, { tipo: "ANULACION", motivo: "Se registró por error", confirmado: true })
    expect(anul.status).toBe(201)
    expect([anul.body.retiro.estado, anul.body.retiro.valorVigente]).toEqual(["ANULADO", 0])
    expect(await s.stock()).toEqual({ yerba: 10, pan: 0, roja: 3, azul: 1 })
    expect((await s.devolver(id, { tipo: "ANULACION", motivo: "Otra vez", confirmado: true })).body.code).toBe("RETIRO_ANULADO")
    const reingresos = await db.movimientoInventario.findMany({ where: { negocioId: s.n, tipo: "RETIRO_PERSONAL_REINGRESO" } })
    expect(reingresos.map((m) => m.cantidad).sort()).toEqual([2, 2])
    expect(reingresos.every((m) => m.devolucionRetiroId && !m.retiroPersonalId)).toBe(true)
    const original = await db.retiroPersonal.findUniqueOrThrow({ where: { id }, include: { lineas: true } })
    expect([original.valorComercialDecimal.toFixed(2), original.lineas.length]).toEqual(["9000.00", 3])
    expect(await s.dinero()).toEqual(dinero0)
    expect(await db.auditLog.count({ where: { recursoId: id, accion: { in: ["retiro_personal.devolucion", "retiro_personal.anulado"] } } })).toBe(2)
    expect((await s.decidir({ empleadoId: s.mozo.empleado.id, retiroIds: [id], importe: "0" })).body.code).toBe("RETIRO_ANULADO")
  })

  ephemeralTest("las guardas SQL rechazan escrituras directas inconsistentes", async () => {
    const s = await escenario()
    const r = await s.retiroOwner({ beneficiario: DUENO, items: [{ productoId: s.conStock.id, cantidad: 1 }] })
    const lineaId = r.body.retiro.lineas[0].id
    const dev = await db.devolucionRetiroPersonal.create({ data: { negocioId: s.n, retiroId: r.body.retiro.id, tipo: "DEVOLUCION", motivo: "sql", registradoPorNombre: "x", valorDecimal: 0, costoConocidoDecimal: 0, idempotencyKey: K(), idempotencyFingerprint: "x" } })
    await expect(enPromesa(db.devolucionRetiroLinea.create({ data: { negocioId: s.n, devolucionId: dev.id, retiroLineaId: lineaId, cantidad: 2, valorDecimal: 0, reingresoStock: false } }))).rejects.toThrow()
    await expect(enPromesa(db.retiroPersonal.update({ where: { id: r.body.retiro.id }, data: { beneficiarioTipo: "EMPLEADO" } }))).rejects.toThrow()
    await expect(enPromesa(db.movimientoInventario.create({ data: { negocioId: s.n, productoId: s.conStock.id, tipo: "VENTA", cantidad: 1, stockAntes: 1, stockDespues: 0, retiroPersonalId: r.body.retiro.id } }))).rejects.toThrow()
  })
})

describe("T7-F1 — revisión: resumen completo, variante borrada y reglas de cantidad", () => {
  ephemeralTest("más de 2.000 retiros: el resumen suma TODOS los del período y el detalle pagina sin perder ni repetir", async () => {
    const s = await escenario()
    const base = Date.now() - 3_600_000
    const fila = (i: number, empleado: boolean) => ({
      negocioId: s.n,
      beneficiarioTipo: empleado ? "EMPLEADO" : "DUENO",
      beneficiarioEmpleadoId: empleado ? s.mozo.empleado.id : null,
      beneficiarioNombre: empleado ? "Mozo Carlos" : s.negocio.nombre,
      registradoPorTipo: "NEGOCIO",
      registradoPorNombre: s.negocio.nombre,
      valorComercialDecimal: empleado ? "10.00" : "7.50",
      costoConocidoDecimal: empleado ? "6.00" : "0.00",
      costoCompleto: empleado,
      cantidadLineas: 1,
      idempotencyKey: randomUUID(),
      idempotencyFingerprint: "volumen",
      createdAt: new Date(base + i),
    })
    await db.retiroPersonal.createMany({ data: Array.from({ length: 1200 }, (_, i) => fila(i, true)) })
    await db.retiroPersonal.createMany({ data: Array.from({ length: 850 }, (_, i) => fila(1200 + i, false)) })
    const r = (await s.resumen()).body.resumen
    expect([r.registrosIncluidos, r.cantidadRetiros, r.valorComercial, r.costoConocido, r.porTipo, r.importePendienteDecision, r.retirosConCostoIncompleto])
      .toEqual([2050, 2050, 12000 + 6375, 7200, { EMPLEADO: 12000, FAMILIAR: 0, DUENO: 6375 }, 12000, 850])
    const mozo = r.personas.find((x: any) => x.clave === `EMPLEADO:${s.mozo.empleado.id}`)
    expect([mozo.cantidad, mozo.valor, mozo.costo]).toEqual([1200, 12000, 7200])
    expect((await s.resumen(`&persona=EMPLEADO:${s.mozo.empleado.id}`)).body.resumen.valorComercial).toBe(12000)
    // detalle: páginas explícitas de 100, sin huecos ni repetidos
    const vistos = new Set<string>()
    let cursor: string | null = null
    let paginas = 0
    do {
      const pagina = await s.lista(cursor ? `&cursor=${cursor}` : "")
      expect(pagina.status).toBe(200)
      expect(pagina.body.retiros.length).toBeLessThanOrEqual(100)
      for (const x of pagina.body.retiros) { expect(vistos.has(x.id)).toBe(false); vistos.add(x.id) }
      cursor = pagina.body.siguienteCursor
      paginas++
    } while (cursor)
    expect([vistos.size, paginas]).toEqual([2050, 21])
    expect((await s.lista("&cursor=no valido")).status).toBe(400)
  })

  ephemeralTest("devolución de una línea cuya variante fue borrada: nunca reingresa stock al producto padre", async () => {
    const s = await escenario()
    await db.producto.update({ where: { id: s.remera.id }, data: { controlStock: true, stockCantidad: 7 } })
    const r = await s.retiroOwner({ beneficiario: DUENO, items: [{ productoId: s.remera.id, varianteId: s.roja.id, cantidad: 2 }] })
    expect(r.status).toBe(201)
    const lineaId = r.body.retiro.lineas[0].id
    await db.productoVariante.delete({ where: { id: s.roja.id } })
    const linea = await db.retiroPersonalLinea.findUniqueOrThrow({ where: { id: lineaId } })
    expect([linea.lineaDeVariante, linea.productoVarianteId, linea.varianteNombre, linea.productoId]).toEqual([true, null, "Roja", s.remera.id])
    const dev = await s.devolver(r.body.retiro.id, { tipo: "DEVOLUCION", motivo: "Devolvió una", lineas: [{ lineaId, cantidad: 1 }] })
    expect(dev.status).toBe(201)
    expect((await db.producto.findUniqueOrThrow({ where: { id: s.remera.id } })).stockCantidad).toBe(7) // el padre no recibe nada
    expect(await db.movimientoInventario.count({ where: { negocioId: s.n, tipo: "RETIRO_PERSONAL_REINGRESO" } })).toBe(0)
    expect((await db.devolucionRetiroLinea.findFirstOrThrow({ where: { retiroLineaId: lineaId } })).reingresoStock).toBe(false)
    // una línea de producto nunca puede apuntar a una variante (CHECK)
    await expect(enPromesa(db.retiroPersonalLinea.update({ where: { id: lineaId }, data: { lineaDeVariante: false, productoVarianteId: s.azul.id } }))).rejects.toThrow()
  })

  ephemeralTest("cantidades de devolución: mismas reglas que las ventas (> 0, hasta 3 decimales), comparación exacta del remanente", async () => {
    const s = await escenario()
    const r = await s.retiroOwner({ beneficiario: DUENO, items: [{ productoId: s.conStock.id, cantidad: 1.5 }] })
    expect(r.status).toBe(201)
    expect((await s.stock()).yerba).toBe(8.5)
    const id = r.body.retiro.id
    const lineaId = r.body.retiro.lineas[0].id
    for (const cantidad of [0, -1, 0.0001, "1.0001", "abc", "12345678"]) {
      expect({ cantidad, status: (await s.devolver(id, { tipo: "DEVOLUCION", motivo: "x", lineas: [{ lineaId, cantidad }] })).status }).toEqual({ cantidad, status: 400 })
    }
    expect((await s.devolver(id, { tipo: "DEVOLUCION", motivo: "media", lineas: [{ lineaId, cantidad: "0.5" }] })).status).toBe(201)
    expect((await s.stock()).yerba).toBe(9)
    expect((await s.devolver(id, { tipo: "DEVOLUCION", motivo: "de más", lineas: [{ lineaId, cantidad: 1.001 }] })).body.code).toBe("DEVOLUCION_EXCEDE_RETIRADO")
    const final = await s.devolver(id, { tipo: "DEVOLUCION", motivo: "el resto", lineas: [{ lineaId, cantidad: 1 }] })
    expect(final.status).toBe(201)
    expect([final.body.retiro.valorVigente, final.body.retiro.valorDevuelto, final.body.retiro.lineas[0].devuelto]).toEqual([0, 1500, 1.5])
    expect((await s.stock()).yerba).toBe(10)
    expect((await s.devolver(id, { tipo: "DEVOLUCION", motivo: "otra", lineas: [{ lineaId, cantidad: 0.001 }] })).body.code).toBe("DEVOLUCION_EXCEDE_RETIRADO")
  })
})
