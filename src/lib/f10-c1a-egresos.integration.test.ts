/// <reference types="bun-types" />
// ============================================
// F10-C1a — cash outflows of Caja on a REAL ephemeral PostgreSQL
// ============================================
// Through the real owner and cashier routes: open shift required, natures kept
// apart in the ledger, expected cash through the EXISTING formula, owner-only
// alerts (never to the cashier), withdrawal confirmation without a second
// movement, reviews with history, idempotency (replay / reused key / bursts),
// outflow vs blind close in both orders, isolation between registers,
// employees and businesses, and the SQL guards (immutability, closed shifts,
// prepared compensations that never touch a closed shift).

import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { createOperationalSession, createSession, OPERATIONAL_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/auth"
import { abrirTurnoCaja, asegurarCajaPredeterminada, cerrarTurnoCaja, crearCajaFisica } from "@/lib/caja-turnos-service"
import { calcularSnapshotEfectivoTurno } from "@/lib/caja-turnos-snapshot"
import { resumirCobrosCajaDesde } from "@/lib/caja-resumen-cobros"

setDefaultTimeout(240_000)

const testDatabaseUrl = process.env.DELIGO_TEST_DATABASE_URL
const isEphemeralIntegrationDb = process.env.DELIGO_EPHEMERAL_TEST_DB === "1"
if (!testDatabaseUrl || process.env.DATABASE_URL !== testDatabaseUrl) {
  throw new Error("Este test de integración requiere DELIGO_TEST_DATABASE_URL y DATABASE_URL apuntando a la misma base de prueba.")
}
const declaredEnvironment = process.env.DELIGO_ENVIRONMENT ?? process.env.RAILWAY_ENVIRONMENT_NAME ?? process.env.APP_ENV
if (!declaredEnvironment || declaredEnvironment.toUpperCase() !== "TESTING") {
  throw new Error("La suite F10-C1a sólo puede ejecutarse con DELIGO_ENVIRONMENT=TESTING.")
}
const ephemeralTest = isEphemeralIntegrationDb ? test : test.skip

const { GET: getEgresosOwner, POST: postEgresoOwner } = await import("@/app/api/negocio/caja/egresos/route")
const { GET: getEgresoOwner } = await import("@/app/api/negocio/caja/egresos/[id]/route")
const { POST: postRevision } = await import("@/app/api/negocio/caja/egresos/[id]/revision/route")
const { POST: postConfirmacion } = await import("@/app/api/negocio/caja/egresos/[id]/confirmacion-retiro/route")
const { GET: getConfig, PATCH: patchConfig } = await import("@/app/api/negocio/caja/configuracion-egresos/route")
const { GET: getEgresosCajero, POST: postEgresoCajero } = await import("@/app/api/operativo/caja/[slug]/egresos/route")
const { POST: postVentaCajero } = await import("@/app/api/operativo/caja/[slug]/ventas/route")

afterAll(async () => {
  await db.$disconnect()
})

type Res = { status: number; replayed: boolean; body: Record<string, any>; raw: string }
const json = async (res: Response): Promise<Res> => {
  const raw = await res.text()
  let body: Record<string, any> = {}
  try { body = JSON.parse(raw) } catch { /* empty */ }
  return { status: res.status, replayed: res.headers.get("Idempotency-Replayed") === "true", body, raw }
}
const post = (url: string, cookie: string, body: unknown, key?: string) =>
  new NextRequest(`http://localhost${url}`, { method: "POST", headers: { cookie, "content-type": "application/json", ...(key ? { "idempotency-key": key } : {}) }, body: JSON.stringify(body) })
const patch = (url: string, cookie: string, body: unknown) =>
  new NextRequest(`http://localhost${url}`, { method: "PATCH", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify(body) })
const get = (url: string, cookie: string) => new NextRequest(`http://localhost${url}`, { method: "GET", headers: { cookie } })
const idCtx = (id: string) => ({ params: Promise.resolve({ id }) })

async function cajero(negocioId: string, suffix: string, nombre: string, prefijo: string) {
  const cuenta = await db.cuentaOperativa.create({ data: { nombre, email: `${nombre.toLowerCase().replace(/\W+/g, "")}-${suffix}@example.test`, activo: true, eliminado: false } })
  const empleado = await db.empleado.create({ data: { nombre, codigo: `${prefijo}${suffix.slice(0, 6)}`.toUpperCase(), negocioId, cuentaOperativaId: cuenta.id, areaOperativa: "caja", activo: true, eliminado: false } })
  return { empleado, cookie: `${OPERATIONAL_SESSION_COOKIE_NAME}=${await createOperationalSession(cuenta.id)}` }
}

async function escenario(opts: { fondo?: string } = {}) {
  const suffix = randomUUID().slice(0, 12)
  const negocio = await db.negocio.create({
    data: { slug: `test-c1a-${suffix}`, nombre: `Test C1a ${suffix}`, usuario: `test-c1a-${suffix}`, email: `test-c1a-${suffix}@example.test`, password: "fixture", rubro: "negocio", aprobado: true, suspendido: false, empleadosActivos: true, salonActivo: true, cajaTurnosModo: "OPCIONAL" },
  })
  const n = negocio.id
  const owner = `${SESSION_COOKIE_NAME}=${await createSession(n, "negocio")}`
  const a = await cajero(n, suffix, "Cajera A", "CA")
  const b = await cajero(n, suffix, "Cajero B", "CB")
  const cajaA = await asegurarCajaPredeterminada(db, n)
  const cajaBRes = await crearCajaFisica(db, n, { nombre: "Caja B" })
  if (!cajaBRes.ok) throw new Error("fixture: caja B")
  const cajaB = cajaBRes.value
  const producto = await db.producto.create({ data: { nombre: "Alfajor", precio: 1000, negocioId: n, controlStock: false } })
  const abrir = async (empleadoId: string | null, cajaFisicaId: string, fondo = opts.fondo ?? "10000") => {
    const r = await abrirTurnoCaja(db, { negocioId: n, actor: empleadoId ? { tipo: "EMPLEADO", empleadoId } : { tipo: "NEGOCIO" }, cajaFisicaId, fondoInicial: fondo, idempotencyKey: randomUUID() })
    if (!r.ok) throw new Error(`fixture: abrir turno ${JSON.stringify(r)}`)
    return r.value.turno
  }
  const cerrar = (empleadoId: string, turnoCajaId: string, contado = "0") =>
    cerrarTurnoCaja(db, { negocioId: n, turnoCajaId, actor: { tipo: "EMPLEADO", empleadoId }, efectivoContado: contado, idempotencyKey: randomUUID() })
  const venderCajero = async (cookie: string, cantidad = 1) =>
    json(await postVentaCajero(post(`/api/operativo/caja/${negocio.slug}/ventas`, cookie, { metodoPago: "EFECTIVO", items: [{ productoId: producto.id, cantidad }] }, randomUUID()), { params: Promise.resolve({ slug: negocio.slug }) }))
  const egresoCajero = async (cookie: string, body: unknown, key: string = randomUUID()) =>
    json(await postEgresoCajero(post(`/api/operativo/caja/${negocio.slug}/egresos`, cookie, body, key), { params: Promise.resolve({ slug: negocio.slug }) }))
  const egresosDelCajero = async (cookie: string) => json(await getEgresosCajero(get(`/api/operativo/caja/${negocio.slug}/egresos`, cookie), { params: Promise.resolve({ slug: negocio.slug }) }))
  const egresoOwner = async (body: unknown, key: string = randomUUID(), cookie = owner) => json(await postEgresoOwner(post("/api/negocio/caja/egresos", cookie, body, key)))
  const revisar = async (id: string, body: unknown, key: string = randomUUID(), cookie = owner) => json(await postRevision(post(`/api/negocio/caja/egresos/${id}/revision`, cookie, body, key), idCtx(id)))
  const confirmar = async (id: string, body: unknown, key: string = randomUUID(), cookie = owner) => json(await postConfirmacion(post(`/api/negocio/caja/egresos/${id}/confirmacion-retiro`, cookie, body, key), idCtx(id)))
  const esperado = async (turnoId: string) => (await calcularSnapshotEfectivoTurno(db, n, turnoId))!.esperado.toFixed(2)
  const foto = async () => ({
    operaciones: await db.operacionFinanciera.count({ where: { negocioId: n } }),
    movimientos: await db.movimientoFinanciero.count({ where: { negocioId: n } }),
    egresos: await db.egresoCaja.count({ where: { negocioId: n } }),
    revisiones: await db.revisionEgresoCaja.count({ where: { negocioId: n } }),
    notificaciones: await db.notificacion.count({ where: { negocioId: n, tipo: "caja_egreso" } }),
    auditorias: await db.auditLog.count({ where: { recurso: "egreso_caja", OR: [{ userId: n }, { userId: a.empleado.id }, { userId: b.empleado.id }] } }),
  })
  return { negocio, n, owner, a, b, cajaA, cajaB, producto, abrir, cerrar, venderCajero, egresoCajero, egresosDelCajero, egresoOwner, revisar, confirmar, esperado, foto }
}

const gasto = (importe: string | number, extra: Record<string, unknown> = {}) => ({ naturaleza: "GASTO", categoria: "INSUMOS", importe, motivo: "Bolsas y servilletas", ...extra })
const retiro = (importe: string | number, extra: Record<string, unknown> = {}) => ({ naturaleza: "RETIRO_DUENO", importe, motivo: "Retiro del mediodía", destinatarioTipo: "DUENO", destinatarioNombre: "Paula (dueña)", ...extra })
/** Message of the error a Prisma call rejects with (PrismaPromise is not a native Promise for expect().rejects). */
async function falla(p: PromiseLike<unknown>): Promise<string> {
  try {
    await p
    return "SIN_ERROR"
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}
const PALABRAS_PRIVADAS = /esperado|alerta|excede|umbral|justific|diferencia/i

describe("F10-C1a — registration, ledger and expected cash", () => {
  ephemeralTest("cashier expense on their own shift: one GASTO operation with ONE negative leg on the register account; expected cash goes down; owner notice; audit in the same transaction; cashier sees no private data", async () => {
    const e = await escenario()
    const turno = await e.abrir(e.a.empleado.id, e.cajaA.id)
    expect((await e.venderCajero(e.a.cookie, 2)).status).toBe(201)
    expect(await e.esperado(turno.id)).toBe("12000.00")
    const desde = new Date(Date.now() - 60_000)
    const resumenAntes = await resumirCobrosCajaDesde(db, e.n, desde)

    const r = await e.egresoCajero(e.a.cookie, gasto("1500.50"))
    expect(r.status).toBe(201)
    expect(r.raw).not.toMatch(PALABRAS_PRIVADAS)
    expect(r.body.egreso).toMatchObject({ naturaleza: "GASTO", categoria: "INSUMOS", importe: 1500.5, registradoPor: "PROPIO" })
    expect(await e.esperado(turno.id)).toBe("10499.50")

    const egreso = await db.egresoCaja.findUniqueOrThrow({ where: { id: r.body.egreso.id } })
    const op = await db.operacionFinanciera.findUniqueOrThrow({ where: { id: egreso.operacionId }, include: { movimientos: { include: { cuenta: true } } } })
    expect([op.tipo, op.turnoCajaId, op.actorTipo, op.actorId]).toEqual(["GASTO", turno.id, "EMPLEADO", e.a.empleado.id])
    expect(op.movimientos.map((m) => [m.importeDecimal?.toFixed(2), m.cuenta.cajaFisicaId, m.cuenta.tipo])).toEqual([["-1500.50", e.cajaA.id, "EFECTIVO"]])
    expect([egreso.esperadoPrevioDecimal.toFixed(2), egreso.excedeEsperado, egreso.superaUmbral, egreso.estadoRevision]).toEqual(["12000.00", false, false, "SIN_REVISAR"])

    const avisos = await db.notificacion.findMany({ where: { negocioId: e.n, tipo: "caja_egreso" } })
    expect(avisos).toHaveLength(1)
    expect(avisos[0].cuerpo).toContain("Cajera A registró una salida de efectivo de $1.500,5 (gasto) en Caja principal.")
    expect(JSON.parse(avisos[0].datos)).toMatchObject({ egresoId: egreso.id, prioridad: "NORMAL", alertas: { retiro: false, excedeEsperado: false, superaUmbral: false } })

    // R1 evidence: the audit row and the never-updated ledger leg share the same transaction id.
    const xmin = await db.$queryRaw<Array<{ audit: string; leg: string }>>`
      SELECT (SELECT xmin::text FROM audit_logs WHERE accion = 'caja.egreso_registrado' AND "recursoId" = ${egreso.id}) AS audit,
             (SELECT xmin::text FROM movimientos_financieros WHERE "operacionId" = ${egreso.operacionId}) AS leg`
    expect(xmin[0].audit).toBe(xmin[0].leg)
    expect(await db.auditLog.count({ where: { accion: "caja.egreso_registrado", recursoId: egreso.id } })).toBe(1)

    // Reports built from sales/cobros are untouched: an outflow is not a return nor a sale.
    expect(await resumirCobrosCajaDesde(db, e.n, desde)).toEqual(resumenAntes)

    const lista = await e.egresosDelCajero(e.a.cookie)
    expect(lista.status).toBe(200)
    expect(lista.raw).not.toMatch(PALABRAS_PRIVADAS)
    expect(lista.body).toMatchObject({ turnoAbierto: true })
    expect(lista.body.egresos.map((x: any) => x.importe)).toEqual([1500.5])
  })

  ephemeralTest("the three natures stay apart: GASTO / PAGO_PROVEEDOR / RETIRO_DUENO are three different ledger operation types; the close includes them through the unchanged formula", async () => {
    const e = await escenario()
    const turno = await e.abrir(e.a.empleado.id, e.cajaA.id)
    const g = await e.egresoCajero(e.a.cookie, gasto(100, { categoria: "SERVICIOS", comprobanteReferencia: "Ticket 0001-123" }))
    const p = await e.egresoCajero(e.a.cookie, { naturaleza: "PAGO_PROVEEDOR", importe: 2000, motivo: "Pago de mercadería entregada", proveedorNombre: "Distribuidora Sur", proveedorIdentificacion: "30-12345678-9" })
    const r = await e.egresoCajero(e.a.cookie, retiro(300))
    expect([g.status, p.status, r.status]).toEqual([201, 201, 201])
    const tipos = await db.operacionFinanciera.findMany({ where: { negocioId: e.n, turnoCajaId: turno.id }, select: { tipo: true }, orderBy: { createdAt: "asc" } })
    expect(tipos.map((t) => t.tipo)).toEqual(["GASTO", "PAGO_PROVEEDOR", "RETIRO_DUENO"])
    const pago = await db.egresoCaja.findUniqueOrThrow({ where: { id: p.body.egreso.id } })
    expect([pago.categoria, pago.proveedorNombre, pago.proveedorIdentificacion, pago.destinatarioTipo]).toEqual([null, "Distribuidora Sur", "30-12345678-9", null])
    expect(await e.esperado(turno.id)).toBe("7600.00")
    const cierre = await e.cerrar(e.a.empleado.id, turno.id, "7600")
    expect(cierre.ok).toBe(true)
    const cerrado = await db.turnoCaja.findUniqueOrThrow({ where: { id: turno.id } })
    expect([cerrado.estado, cerrado.efectivoEsperadoDecimal?.toFixed(2)]).toEqual(["CERRADO_DECLARADO", "7600.00"])
  })

  ephemeralTest("an open shift is always required (also in OPCIONAL mode); nothing is written when it is missing", async () => {
    const e = await escenario()
    const antes = await e.foto()
    const sinTurno = await e.egresoCajero(e.a.cookie, gasto(100))
    expect([sinTurno.status, sinTurno.body.code]).toEqual([409, "TURNO_REQUERIDO"])
    const dueno = await e.egresoOwner(gasto(100))
    expect([dueno.status, dueno.body.code]).toEqual([409, "TURNO_REQUERIDO"])
    // The owner cannot pick a register without an open shift either.
    const elegida = await e.egresoOwner(gasto(100, { cajaFisicaId: e.cajaB.id }))
    expect([elegida.status, elegida.body.code]).toEqual([409, "TURNO_REQUERIDO"])
    // Another employee's open shift does not count for this cashier.
    await e.abrir(e.b.empleado.id, e.cajaB.id)
    const ajeno = await e.egresoCajero(e.a.cookie, gasto(100))
    expect([ajeno.status, ajeno.body.code]).toEqual([409, "TURNO_REQUERIDO"])
    expect(await e.foto()).toEqual(antes)
  })

  ephemeralTest("validation rejections are returned without any write", async () => {
    const e = await escenario()
    await e.abrir(e.a.empleado.id, e.cajaA.id)
    const antes = await e.foto()
    const casos: Array<[unknown, string]> = [
      [{ ...gasto(100), motivo: "  " }, "MOTIVO_EGRESO_REQUERIDO"],
      [gasto(0), "IMPORTE_EGRESO_INVALIDO"],
      [gasto(-5), "IMPORTE_EGRESO_INVALIDO"],
      [gasto("1.234"), "IMPORTE_EGRESO_INVALIDO"],
      [gasto("abc"), "IMPORTE_EGRESO_INVALIDO"],
      [gasto("10000000000"), "IMPORTE_EGRESO_INVALIDO"],
      [{ naturaleza: "TRANSFERENCIA_INTERNA", importe: 10, motivo: "Depósito" }, "NATURALEZA_EGRESO_INVALIDA"],
      [{ naturaleza: "GASTO", importe: 10, motivo: "Sin categoría" }, "CATEGORIA_EGRESO_INVALIDA"],
      [{ naturaleza: "PAGO_PROVEEDOR", categoria: "INSUMOS", importe: 10, motivo: "x" }, "CATEGORIA_EGRESO_INVALIDA"],
      [{ naturaleza: "RETIRO_DUENO", importe: 10, motivo: "x" }, "DESTINATARIO_RETIRO_REQUERIDO"],
      [retiro(10, { destinatarioNombre: " " }), "DESTINATARIO_RETIRO_REQUERIDO"],
      [retiro(10, { proveedorNombre: "Alguien" }), "DATOS_PROVEEDOR_INVALIDOS"],
      [gasto(10, { destinatarioTipo: "DUENO", destinatarioNombre: "X" }), "DESTINATARIO_RETIRO_INVALIDO"],
      [gasto(10, { justificacion: "Porque sí" }), "CAMPOS_NO_PERMITIDOS"],
      [gasto(10, { cajaFisicaId: e.cajaB.id }), "CAMPOS_NO_PERMITIDOS"],
    ]
    for (const [body, code] of casos) {
      const r = await e.egresoCajero(e.a.cookie, body)
      expect({ code: r.body.code, status: r.status }).toEqual({ code, status: 400 })
    }
    const sinClave = await json(await postEgresoCajero(post(`/api/operativo/caja/${e.negocio.slug}/egresos`, e.a.cookie, gasto(10)), { params: Promise.resolve({ slug: e.negocio.slug }) }))
    expect([sinClave.status, sinClave.body.code]).toEqual([400, "IDEMPOTENCY_KEY_REQUIRED"])
    expect(await e.foto()).toEqual(antes)
  })
})

describe("F10-C1a — idempotency", () => {
  ephemeralTest("replay answers the original outflow (even after the shift closed); a reused key with other data is 409; nothing is duplicated", async () => {
    const e = await escenario()
    const turno = await e.abrir(e.a.empleado.id, e.cajaA.id)
    const key: string = randomUUID()
    const primero = await e.egresoCajero(e.a.cookie, gasto(250), key)
    expect(primero.status).toBe(201)
    const despues = await e.foto()
    const replay = await e.egresoCajero(e.a.cookie, gasto(250), key.toUpperCase())
    expect([replay.status, replay.replayed, replay.body.egreso.id]).toEqual([200, true, primero.body.egreso.id])
    const otro = await e.egresoCajero(e.a.cookie, gasto(251), key)
    expect([otro.status, otro.body.code]).toEqual([409, "IDEMPOTENCY_KEY_REUSED"])
    // Same key from ANOTHER actor (the owner, on the same open shift) is not a replay either.
    const otroActor = await e.egresoOwner(gasto(250), key)
    expect([otroActor.status, otroActor.body.code]).toEqual([409, "IDEMPOTENCY_KEY_REUSED"])
    expect(await e.foto()).toEqual(despues)
    expect((await e.cerrar(e.a.empleado.id, turno.id, "9750")).ok).toBe(true)
    const tardio = await e.egresoCajero(e.a.cookie, gasto(250), key)
    expect([tardio.status, tardio.replayed]).toEqual([200, true])
    expect(await e.foto()).toEqual(despues)
  })

  ephemeralTest("burst with the same key (double click): exactly one outflow, one operation, one leg, one notice, one audit", async () => {
    const e = await escenario()
    const turno = await e.abrir(e.a.empleado.id, e.cajaA.id)
    const key: string = randomUUID()
    const rs = await Promise.all(Array.from({ length: 6 }, () => e.egresoCajero(e.a.cookie, gasto(400), key)))
    expect(rs.every((r) => r.status === 201 || (r.status === 200 && r.replayed))).toBe(true)
    expect(rs.filter((r) => r.status === 201)).toHaveLength(1)
    expect(new Set(rs.map((r) => r.body.egreso.id)).size).toBe(1)
    expect(await e.foto()).toMatchObject({ operaciones: 1, movimientos: 1, egresos: 1, notificaciones: 1, auditorias: 1 })
    expect(await e.esperado(turno.id)).toBe("9600.00")
  })

  ephemeralTest("different keys in parallel on one shift: every outflow lands once with an exact, consistent expected-cash snapshot", async () => {
    const e = await escenario()
    const turno = await e.abrir(e.a.empleado.id, e.cajaA.id)
    const rs = await Promise.all([100, 200, 300, 400, 500].map((importe) => e.egresoCajero(e.a.cookie, gasto(importe))))
    expect(rs.map((r) => r.status)).toEqual([201, 201, 201, 201, 201])
    expect(await e.esperado(turno.id)).toBe("8500.00")
    const filas = await db.egresoCaja.findMany({ where: { negocioId: e.n }, orderBy: { createdAt: "asc" } })
    // Each snapshot equals the fund minus every outflow that committed before it (checked again by the SQL guard).
    const previos = filas.map((f) => f.esperadoPrevioDecimal.toFixed(2)).sort((x, y) => Number(y) - Number(x))
    expect(previos[0]).toBe("10000.00")
    expect(new Set(previos).size).toBe(5)
    expect(await e.foto()).toMatchObject({ operaciones: 5, movimientos: 5, egresos: 5, auditorias: 5 })
  })
})

describe("F10-C1a — outflow vs blind close", () => {
  ephemeralTest("racing the close in both orders: either the outflow commits first and enters the close's expected cash, or it gets 409 and writes nothing", async () => {
    const e = await escenario()
    const resultados: string[] = []
    const ITERACIONES = 20
    for (let i = 0; i < ITERACIONES; i++) {
      const turno = await e.abrir(e.a.empleado.id, e.cajaA.id, "1000")
      const egreso = () => e.egresoCajero(e.a.cookie, gasto(300))
      // The close calls the service directly (faster than the HTTP route), so it
      // starts after a small random delay to land in overlapping windows both ways.
      const cierre = async () => {
        await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 40)))
        return e.cerrar(e.a.empleado.id, turno.id, "0")
      }
      let r: Res
      let c: Awaited<ReturnType<typeof cierre>>
      if (i % 2 === 0) [r, c] = await Promise.all([egreso(), cierre()])
      else [c, r] = await Promise.all([cierre(), egreso()])
      expect(c.ok).toBe(true)
      const cerrado = await db.turnoCaja.findUniqueOrThrow({ where: { id: turno.id } })
      const filas = await db.egresoCaja.count({ where: { turnoCajaId: turno.id } })
      if (r.status === 201) {
        expect([filas, cerrado.efectivoEsperadoDecimal?.toFixed(2)]).toEqual([1, "700.00"])
        resultados.push("egreso-primero")
      } else {
        expect([r.status, ["TURNO_REQUERIDO", "TURNO_NO_DISPONIBLE"].includes(r.body.code)]).toEqual([409, true])
        expect([filas, cerrado.efectivoEsperadoDecimal?.toFixed(2)]).toEqual([0, "1000.00"])
        resultados.push("cierre-primero")
      }
      // The frozen close snapshot always equals the ledger of that shift.
      expect(cerrado.efectivoEsperadoDecimal?.toFixed(2)).toBe(await e.esperado(turno.id))
    }
    expect(resultados).toHaveLength(ITERACIONES)
    console.info(`[F10-C1a carrera egreso/cierre] egreso-primero=${resultados.filter((x) => x === "egreso-primero").length} cierre-primero=${resultados.filter((x) => x === "cierre-primero").length}`)
  })

  ephemeralTest("after the close no outflow can be attributed to that shift (API 409, SQL guard rejects a direct insert)", async () => {
    const e = await escenario()
    const turno = await e.abrir(e.a.empleado.id, e.cajaA.id)
    expect((await e.cerrar(e.a.empleado.id, turno.id, "10000")).ok).toBe(true)
    const r = await e.egresoCajero(e.a.cookie, gasto(10))
    expect([r.status, r.body.code]).toEqual([409, "TURNO_REQUERIDO"])
    expect(await falla(db.operacionFinanciera.create({ data: { negocioId: e.n, tipo: "GASTO", actorTipo: "NEGOCIO", actorId: e.n, turnoCajaId: turno.id } }))).toMatch(/cash outflow requires an open shift/)
  })
})

describe("F10-C1a — owner alerts (never shown to the cashier)", () => {
  ephemeralTest("insufficient expected cash never blocks: the cashier's outflow is registered with the exact flag and the owner gets a priority notice; the cashier response reveals nothing", async () => {
    const e = await escenario({ fondo: "500" })
    const turno = await e.abrir(e.a.empleado.id, e.cajaA.id)
    const r = await e.egresoCajero(e.a.cookie, gasto(800))
    expect(r.status).toBe(201)
    expect(r.raw).not.toMatch(PALABRAS_PRIVADAS)
    const fila = await db.egresoCaja.findUniqueOrThrow({ where: { id: r.body.egreso.id } })
    expect([fila.excedeEsperado, fila.esperadoPrevioDecimal.toFixed(2), fila.justificacion]).toEqual([true, "500.00", null])
    expect(await e.esperado(turno.id)).toBe("-300.00")
    const aviso = await db.notificacion.findFirstOrThrow({ where: { negocioId: e.n, tipo: "caja_egreso" } })
    expect(aviso.cuerpo).toContain("Atención: el efectivo esperado del turno quedó negativo.")
    expect(JSON.parse(aviso.datos)).toMatchObject({ prioridad: "ALTA", alertas: { excedeEsperado: true } })
    const lista = await e.egresosDelCajero(e.a.cookie)
    expect(lista.raw).not.toMatch(PALABRAS_PRIVADAS)
    const dueno = await json(await getEgresoOwner(get(`/api/negocio/caja/egresos/${fila.id}`, e.owner), idCtx(fila.id)))
    expect(dueno.body.egreso.alertas).toEqual({ excedeEsperado: true, efectivoEsperadoPrevio: 500, efectivoEsperadoResultante: -300, superaUmbral: false, umbralAviso: null })
  })

  ephemeralTest("the owner sees the figures and must justify an outflow that leaves the expected cash negative; without justification nothing is written", async () => {
    const e = await escenario({ fondo: "500" })
    await e.abrir(null, e.cajaA.id)
    const antes = await e.foto()
    const key: string = randomUUID()
    const sin = await e.egresoOwner(gasto(800), key)
    expect([sin.status, sin.body.code, sin.body.detalle]).toEqual([409, "JUSTIFICACION_REQUERIDA", { esperadoPrevio: "500.00", esperadoResultante: "-300.00" }])
    expect(await e.foto()).toEqual(antes)
    const con = await e.egresoOwner(gasto(800, { justificacion: "Pago urgente con dinero propio repuesto mañana" }), key)
    expect(con.status).toBe(201)
    expect(con.body.egreso).toMatchObject({ justificacion: "Pago urgente con dinero propio repuesto mañana", alertas: { excedeEsperado: true }, registradoPor: { tipo: "NEGOCIO" } })
    // An owner's own outflow creates no notice.
    expect((await e.foto()).notificaciones).toBe(0)
  })

  ephemeralTest("business threshold: an employee outflow at or above it is flagged and notified with priority; owner outflows are not; invalid thresholds are rejected; the change is audited", async () => {
    const e = await escenario()
    await e.abrir(e.a.empleado.id, e.cajaA.id)
    expect((await json(await patchConfig(patch("/api/negocio/caja/configuracion-egresos", e.owner, { umbralAviso: 0 })))).status).toBe(400)
    expect((await json(await patchConfig(patch("/api/negocio/caja/configuracion-egresos", e.owner, { umbralAviso: "12.345" })))).status).toBe(400)
    const okCfg = await json(await patchConfig(patch("/api/negocio/caja/configuracion-egresos", e.owner, { umbralAviso: "5000" })))
    expect([okCfg.status, okCfg.body.umbralAviso]).toEqual([200, 5000])
    expect((await json(await getConfig(get("/api/negocio/caja/configuracion-egresos", e.owner)))).body.umbralAviso).toBe(5000)
    expect(await db.auditLog.count({ where: { userId: e.n, accion: "negocio.config_cambiada" } })).toBe(1)
    // The cashier cannot read or change it.
    expect((await json(await getConfig(get("/api/negocio/caja/configuracion-egresos", e.a.cookie)))).status).toBe(401)

    const debajo = await e.egresoCajero(e.a.cookie, gasto("4999.99"))
    const encima = await e.egresoCajero(e.a.cookie, gasto(5000))
    expect([debajo.status, encima.status]).toEqual([201, 201])
    expect(encima.raw).not.toMatch(PALABRAS_PRIVADAS)
    const filas = await db.egresoCaja.findMany({ where: { negocioId: e.n }, orderBy: { importeDecimal: "asc" } })
    expect(filas.map((f) => [f.importeDecimal.toFixed(2), f.superaUmbral, f.umbralAvisoDecimal?.toFixed(2)])).toEqual([["4999.99", false, "5000.00"], ["5000.00", true, "5000.00"]])
    const avisos = await db.notificacion.findMany({ where: { negocioId: e.n, tipo: "caja_egreso" }, orderBy: { createdAt: "asc" } })
    expect(avisos.map((a) => JSON.parse(a.datos).prioridad)).toEqual(["NORMAL", "ALTA"])
    expect(avisos[1].cuerpo).toContain("Supera el umbral de aviso de $5.000.")
    const dueno = await e.egresoOwner(gasto(6000, { cajaFisicaId: e.cajaA.id, justificacion: "Pago grande del dueño" }))
    expect([dueno.status, dueno.body.egreso.alertas.superaUmbral]).toEqual([201, false])
    expect((await json(await patchConfig(patch("/api/negocio/caja/configuracion-egresos", e.owner, { umbralAviso: null })))).body.umbralAviso).toBe(null)
  })
})

describe("F10-C1a — withdrawals for the owner", () => {
  ephemeralTest("a cashier's withdrawal leaves the cash at once (PENDIENTE); the owner's single confirmation creates NO movement and keeps history and audit", async () => {
    const e = await escenario()
    const turno = await e.abrir(e.a.empleado.id, e.cajaA.id)
    const r = await e.egresoCajero(e.a.cookie, retiro(3000, { destinatarioTipo: "AUTORIZADO_POR_DUENO", destinatarioNombre: "Martín (encargado)" }))
    expect(r.status).toBe(201)
    // F10-C1c: the cashier sees a read-only administrative state, never the raw confirmation value.
    expect(r.body.egreso).toMatchObject({ naturaleza: "RETIRO_DUENO", destinatarioTipo: "AUTORIZADO_POR_DUENO", destinatarioNombre: "Martín (encargado)", estadoAdministrativo: "PENDIENTE" })
    expect(r.body.egreso).not.toHaveProperty("confirmacionRetiroEstado")
    expect(await e.esperado(turno.id)).toBe("7000.00")
    const aviso = await db.notificacion.findFirstOrThrow({ where: { negocioId: e.n, tipo: "caja_egreso" } })
    expect(aviso.titulo).toBe("Retiro de efectivo: confirmá la recepción")
    expect(aviso.cuerpo).toContain("Lo recibió: Martín (encargado).")
    expect(JSON.parse(aviso.datos)).toMatchObject({ prioridad: "ALTA", alertas: { retiro: true } })
    const libro = await e.foto()

    const id = r.body.egreso.id
    expect((await e.confirmar(id, { resultado: "NO_RECIBIDO" })).body.code).toBe("OBSERVACION_REQUERIDA")
    expect((await e.confirmar(id, { resultado: "TAL_VEZ" })).body.code).toBe("RESULTADO_INVALIDO")
    // The cashier can never confirm.
    expect((await e.confirmar(id, { resultado: "CONFIRMADO" }, randomUUID(), e.a.cookie)).status).toBe(401)
    const key: string = randomUUID()
    const c = await e.confirmar(id, { resultado: "CONFIRMADO" }, key)
    expect([c.status, c.body.egreso.confirmacionRetiro.estado]).toEqual([201, "CONFIRMADO"])
    const replay = await e.confirmar(id, { resultado: "CONFIRMADO" }, key)
    expect([replay.status, replay.replayed]).toEqual([200, true])
    const otra = await e.confirmar(id, { resultado: "NO_RECIBIDO", observacion: "No me llegó" })
    expect([otra.status, otra.body.code]).toEqual([409, "CONFIRMACION_YA_REGISTRADA"])

    const despues = await e.foto()
    expect([despues.operaciones, despues.movimientos]).toEqual([libro.operaciones, libro.movimientos])
    expect(despues.revisiones).toBe(1)
    expect(await e.esperado(turno.id)).toBe("7000.00")
    expect(await db.auditLog.count({ where: { accion: "caja.egreso_retiro_confirmado", recursoId: id } })).toBe(1)
    const fila = await db.egresoCaja.findUniqueOrThrow({ where: { id } })
    expect([fila.confirmacionRetiroEstado, fila.confirmacionRetiroActorId, fila.estadoRevision]).toEqual(["CONFIRMADO", e.n, "SIN_REVISAR"])
  })

  ephemeralTest("NO_RECIBIDO is recorded with its observation; a withdrawal the owner registered needs no confirmation", async () => {
    const e = await escenario()
    await e.abrir(e.a.empleado.id, e.cajaA.id)
    const r = await e.egresoCajero(e.a.cookie, retiro(200))
    const c = await e.confirmar(r.body.egreso.id, { resultado: "NO_RECIBIDO", observacion: "No recibí ese dinero" })
    expect([c.status, c.body.egreso.confirmacionRetiro.estado, c.body.egreso.historial[0].observacion]).toEqual([201, "NO_RECIBIDO", "No recibí ese dinero"])
    const propio = await e.egresoOwner(retiro(100, { cajaFisicaId: e.cajaA.id }))
    expect([propio.status, propio.body.egreso.confirmacionRetiro.estado]).toEqual([201, "NO_REQUERIDA"])
    const noAplica = await e.confirmar(propio.body.egreso.id, { resultado: "CONFIRMADO" })
    expect([noAplica.status, noAplica.body.code]).toEqual([409, "CONFIRMACION_NO_REQUERIDA"])
    const gastoFila = await e.egresoCajero(e.a.cookie, gasto(5))
    expect((await e.confirmar(gastoFila.body.egreso.id, { resultado: "CONFIRMADO" })).body.code).toBe("CONFIRMACION_NO_REQUERIDA")
  })
})

describe("F10-C1a — owner review", () => {
  ephemeralTest("REVISADO then OBSERVADO: current state + full history, idempotent, audited, never moves money", async () => {
    const e = await escenario()
    const turno = await e.abrir(e.a.empleado.id, e.cajaA.id)
    const r = await e.egresoCajero(e.a.cookie, gasto(700))
    const id = r.body.egreso.id
    const libro = await e.foto()
    expect((await e.revisar(id, { resultado: "OBSERVADO" })).body.code).toBe("OBSERVACION_REQUERIDA")
    const k1 = randomUUID()
    const rev = await e.revisar(id, { resultado: "REVISADO" }, k1)
    expect([rev.status, rev.body.egreso.revision.estado]).toEqual([201, "REVISADO"])
    expect((await e.revisar(id, { resultado: "REVISADO" }, k1)).replayed).toBe(true)
    expect((await e.revisar(id, { resultado: "OBSERVADO", observacion: "x" }, k1)).body.code).toBe("IDEMPOTENCY_KEY_REUSED")
    const obs = await e.revisar(id, { resultado: "OBSERVADO", observacion: "Falta el comprobante" })
    expect(obs.body.egreso.revision.estado).toBe("OBSERVADO")
    expect(obs.body.egreso.historial.map((h: any) => [h.accion, h.resultado, h.observacion])).toEqual([["REVISION", "REVISADO", null], ["REVISION", "OBSERVADO", "Falta el comprobante"]])
    const despues = await e.foto()
    expect([despues.operaciones, despues.movimientos, despues.revisiones]).toEqual([libro.operaciones, libro.movimientos, 2])
    expect(await db.auditLog.count({ where: { accion: "caja.egreso_revisado", recursoId: id } })).toBe(2)
    expect(await e.esperado(turno.id)).toBe("9300.00")
    // A closed shift can still be reviewed afterwards: the review never touches money.
    expect((await e.cerrar(e.a.empleado.id, turno.id, "9300")).ok).toBe(true)
    expect((await e.revisar(id, { resultado: "REVISADO" })).status).toBe(201)
  })

  ephemeralTest("concurrent reviews of one outflow are applied one after the other (no lost history row)", async () => {
    const e = await escenario()
    await e.abrir(e.a.empleado.id, e.cajaA.id)
    const id = (await e.egresoCajero(e.a.cookie, gasto(50))).body.egreso.id
    const rs = await Promise.all(Array.from({ length: 5 }, (_, i) => e.revisar(id, i % 2 ? { resultado: "REVISADO" } : { resultado: "OBSERVADO", observacion: `obs ${i}` })))
    expect(rs.map((r) => r.status)).toEqual([201, 201, 201, 201, 201])
    const fila = await db.egresoCaja.findUniqueOrThrow({ where: { id }, include: { revisiones: { orderBy: { createdAt: "asc" } } } })
    expect(fila.revisiones).toHaveLength(5)
    expect(fila.estadoRevision).toBe(fila.revisiones[4].resultado)
  })
})

describe("F10-C1a — permissions and isolation", () => {
  ephemeralTest("owner registers on an employee's shift (attributed to that shift, shown to that cashier as the owner's); several open registers need an explicit choice", async () => {
    const e = await escenario()
    const tA = await e.abrir(e.a.empleado.id, e.cajaA.id)
    const tB = await e.abrir(e.b.empleado.id, e.cajaB.id)
    const ambiguo = await e.egresoOwner(gasto(10))
    expect([ambiguo.status, ambiguo.body.code]).toEqual([409, "CAJA_SELECCION_REQUERIDA"])
    const r = await e.egresoOwner(gasto(900, { cajaFisicaId: e.cajaB.id }))
    expect(r.status).toBe(201)
    expect([r.body.egreso.turnoCajaId, r.body.egreso.cajaNombre]).toEqual([tB.id, "Caja B"])
    expect([await e.esperado(tA.id), await e.esperado(tB.id)]).toEqual(["10000.00", "9100.00"])
    const listaB = await e.egresosDelCajero(e.b.cookie)
    expect(listaB.body.egresos.map((x: any) => [x.importe, x.registradoPor])).toEqual([[900, "DUENO"]])
    expect((await e.egresosDelCajero(e.a.cookie)).body.egresos).toEqual([])
    // Owner's own outflow on an employee's shift: no notice to the owner.
    expect((await e.foto()).notificaciones).toBe(0)
    const inexistente = await e.egresoOwner(gasto(10, { cajaFisicaId: "no-existe" }))
    expect([inexistente.status, inexistente.body.code]).toEqual([404, "CAJA_NO_ENCONTRADA"])
  })

  ephemeralTest("isolation: a cashier only sees their own shift; another business cannot read, review or confirm; a cashier without área caja is denied", async () => {
    const e = await escenario()
    const otro = await escenario()
    await e.abrir(e.a.empleado.id, e.cajaA.id)
    await e.abrir(e.b.empleado.id, e.cajaB.id)
    const deA = await e.egresoCajero(e.a.cookie, retiro(100))
    await e.egresoCajero(e.b.cookie, gasto(20))
    expect((await e.egresosDelCajero(e.a.cookie)).body.egresos.map((x: any) => x.importe)).toEqual([100])
    expect((await e.egresosDelCajero(e.b.cookie)).body.egresos.map((x: any) => x.importe)).toEqual([20])
    const id = deA.body.egreso.id
    expect((await json(await getEgresoOwner(get(`/api/negocio/caja/egresos/${id}`, otro.owner), idCtx(id)))).status).toBe(404)
    expect((await e.revisar(id, { resultado: "REVISADO" }, randomUUID(), otro.owner)).status).toBe(404)
    expect((await e.confirmar(id, { resultado: "CONFIRMADO" }, randomUUID(), otro.owner)).status).toBe(404)
    expect((await json(await getEgresosOwner(get("/api/negocio/caja/egresos", otro.owner)))).body.egresos).toEqual([])
    // Owner list with filters.
    const lista = await json(await getEgresosOwner(get(`/api/negocio/caja/egresos?naturaleza=RETIRO_DUENO&confirmacionPendiente=true`, e.owner)))
    expect(lista.body.egresos.map((x: any) => x.id)).toEqual([id])
    expect((await json(await getEgresosOwner(get(`/api/negocio/caja/egresos?naturaleza=OTRA`, e.owner)))).status).toBe(400)
    // A cashier session from another business cannot use this business's slug.
    const ajeno = await json(await postEgresoCajero(post(`/api/operativo/caja/${e.negocio.slug}/egresos`, otro.a.cookie, gasto(5), randomUUID()), { params: Promise.resolve({ slug: e.negocio.slug }) }))
    expect([401, 403, 404]).toContain(ajeno.status)
    // An employee moved out of área caja is denied by the session gate.
    await db.empleado.update({ where: { id: e.b.empleado.id }, data: { areaOperativa: "mozo" } })
    expect([401, 403, 404]).toContain((await e.egresoCajero(e.b.cookie, gasto(5))).status)
  })
})

describe("F10-C1a — SQL guards (defense in depth)", () => {
  ephemeralTest("an outflow, its leg and its operation are immutable; review/confirmation need their history row", async () => {
    const e = await escenario()
    await e.abrir(e.a.empleado.id, e.cajaA.id)
    const id = (await e.egresoCajero(e.a.cookie, retiro(100))).body.egreso.id
    const fila = await db.egresoCaja.findUniqueOrThrow({ where: { id } })
    expect(await falla(db.egresoCaja.update({ where: { id }, data: { importeDecimal: new Prisma.Decimal("1") } }))).toMatch(/cash outflow is immutable/)
    expect(await falla(db.egresoCaja.update({ where: { id }, data: { motivo: "otro" } }))).toMatch(/cash outflow is immutable/)
    expect(await falla(db.egresoCaja.update({ where: { id }, data: { estadoRevision: "REVISADO", revisadoEn: new Date(), revisadoPorId: e.n } }))).toMatch(/requires its history row/)
    expect(await falla(db.egresoCaja.update({ where: { id }, data: { confirmacionRetiroEstado: "CONFIRMADO", confirmacionRetiroEn: new Date(), confirmacionRetiroActorId: e.n } }))).toMatch(/requires its history row/)
    expect(await falla(db.movimientoFinanciero.updateMany({ where: { operacionId: fila.operacionId }, data: { importeDecimal: new Prisma.Decimal("-1"), importe: -1 } }))).toMatch(/cash outflow movement is immutable/)
    expect(await falla(db.operacionFinanciera.update({ where: { id: fila.operacionId }, data: { turnoCajaId: null } }))).toMatch(/cash outflow operation is immutable/)
    const cuenta = await db.cuentaFinanciera.findFirstOrThrow({ where: { negocioId: e.n, cajaFisicaId: e.cajaA.id } })
    expect(await falla(db.movimientoFinanciero.create({ data: { negocioId: e.n, operacionId: fila.operacionId, cuentaId: cuenta.id, importe: -5, importeDecimal: new Prisma.Decimal("-5") } }))).toMatch(/exactly one movement/)
  })

  ephemeralTest("an outflow row must match its ledger leg and the exact expected cash before it", async () => {
    const e = await escenario()
    const turno = await e.abrir(e.a.empleado.id, e.cajaA.id)
    const cuenta = await db.cuentaFinanciera.create({ data: { negocioId: e.n, clave: `efectivo_caja_fisica:${e.cajaA.id}`, tipo: "EFECTIVO", nombre: "Efectivo", cajaFisicaId: e.cajaA.id } })
    const base = { negocioId: e.n, turnoCajaId: turno.id, cajaFisicaId: e.cajaA.id, naturaleza: "GASTO", categoria: "OTRO", importeDecimal: new Prisma.Decimal("100"), motivo: "x", actorTipo: "NEGOCIO", actorId: e.n, idempotencyFingerprint: "f" }
    const conOp = async (importe: string) => db.operacionFinanciera.create({ data: { negocioId: e.n, tipo: "GASTO", actorTipo: "NEGOCIO", actorId: e.n, turnoCajaId: turno.id, movimientos: { create: [{ negocioId: e.n, cuentaId: cuenta.id, importe: Number(importe), importeDecimal: new Prisma.Decimal(importe) }] } } })
    expect(await falla(db.operacionFinanciera.create({ data: { negocioId: e.n, tipo: "GASTO", actorTipo: "NEGOCIO", actorId: e.n, turnoCajaId: turno.id, movimientos: { create: [{ negocioId: e.n, cuentaId: cuenta.id, importe: 100, importeDecimal: new Prisma.Decimal("100") }] } } }))).toMatch(/must be negative/)
    const op1 = await conOp("-90")
    expect(await falla(db.egresoCaja.create({ data: { ...base, operacionId: op1.id, esperadoPrevioDecimal: new Prisma.Decimal("10000"), idempotencyKey: randomUUID() } }))).toMatch(/ledger leg is inconsistent/)
    const op2 = await conOp("-100")
    // esperado before op2 = 10000 - 90 (op1 is attributed to the shift) — a forged snapshot is refused.
    expect(await falla(db.egresoCaja.create({ data: { ...base, operacionId: op2.id, esperadoPrevioDecimal: new Prisma.Decimal("10000"), idempotencyKey: randomUUID() } }))).toMatch(/expected-cash snapshot is inconsistent/)
    // The flag itself must match the exact snapshot (CHECK after the trigger's checks).
    expect(await falla(db.egresoCaja.create({ data: { ...base, operacionId: op2.id, esperadoPrevioDecimal: new Prisma.Decimal("9910"), excedeEsperado: true, justificacion: "x", idempotencyKey: randomUUID() } }))).toMatch(/egresos_caja_esperado_check/)
    const ok = await db.egresoCaja.create({ data: { ...base, operacionId: op2.id, esperadoPrevioDecimal: new Prisma.Decimal("9910"), idempotencyKey: randomUUID() } })
    expect(ok.excedeEsperado).toBe(false)
  })

  ephemeralTest("prepared compensations: once, total, same account; in the open shift they restore the expected cash; after the close they are BLOCKED in SQL (F10-C1c) and the closed snapshot never changes", async () => {
    const e = await escenario()
    const turno = await e.abrir(e.a.empleado.id, e.cajaA.id)
    const g1 = await db.egresoCaja.findUniqueOrThrow({ where: { id: (await e.egresoCajero(e.a.cookie, gasto(400))).body.egreso.id } })
    const g2 = await db.egresoCaja.findUniqueOrThrow({ where: { id: (await e.egresoCajero(e.a.cookie, gasto(250))).body.egreso.id } })
    const cuenta = await db.cuentaFinanciera.findFirstOrThrow({ where: { negocioId: e.n, cajaFisicaId: e.cajaA.id } })
    const reversion = (egreso: typeof g1, turnoCajaId: string | null, importe = egreso.importeDecimal.toFixed(2)) =>
      db.operacionFinanciera.create({ data: { negocioId: e.n, tipo: "REVERSION", actorTipo: "NEGOCIO", actorId: e.n, turnoCajaId, revierteOperacionId: egreso.operacionId, movimientos: { create: [{ negocioId: e.n, cuentaId: cuenta.id, importe: Number(importe), importeDecimal: new Prisma.Decimal(importe) }] } } })
    const compensacion = (egreso: typeof g1, operacionId: string, momento: string, turnoCajaId: string | null) =>
      db.compensacionEgresoCaja.create({ data: { negocioId: e.n, egresoId: egreso.id, operacionId, momento, turnoCajaId, cajaFisicaId: egreso.cajaFisicaId, importeDecimal: egreso.importeDecimal, motivo: "Registrado por error", actorId: e.n, idempotencyKey: randomUUID(), idempotencyFingerprint: "f" } })

    // Partial reversals are refused (total only, exact amount, same account).
    expect(await falla(reversion(g1, turno.id, "100.00"))).toMatch(/exact amount to the same account/)
    // While the shift is open: same shift, expected cash goes back up.
    const op1 = await reversion(g1, turno.id)
    await compensacion(g1, op1.id, "TURNO_ABIERTO", turno.id)
    expect(await e.esperado(turno.id)).toBe("9750.00")
    expect(await falla(reversion(g1, turno.id))).toMatch(/Unique constraint|revierteOperacionId/)

    expect((await e.cerrar(e.a.empleado.id, turno.id, "9750")).ok).toBe(true)
    const congelado = (await db.turnoCaja.findUniqueOrThrow({ where: { id: turno.id } })).efectivoEsperadoDecimal?.toFixed(2)
    expect(congelado).toBe("9750.00")
    // After the close: never attributed to the closed shift (nor to another one).
    expect(await falla(reversion(g2, turno.id))).toMatch(/cannot change a closed shift/)
    const otroTurno = await e.abrir(e.b.empleado.id, e.cajaB.id)
    expect(await falla(reversion(g2, otroTurno.id))).toMatch(/own shift or have no shift/)
    // F10-C1c (migration 20261118150000): a shift-less reversion would add cash that no
    // drawer holds (the closed shift's cash already went to custody) — blocked until F10-D.
    expect(await falla(reversion(g2, null))).toMatch(/after the close is blocked until the closing reconciliation/)
    expect(await falla(compensacion(g2, op1.id, "POSTERIOR_AL_CIERRE", null))).toMatch(/after the close is blocked until the closing reconciliation/)
    const cerrado = await db.turnoCaja.findUniqueOrThrow({ where: { id: turno.id } })
    expect([cerrado.efectivoEsperadoDecimal?.toFixed(2), await e.esperado(turno.id)]).toEqual([congelado, "9750.00"])
    expect(await falla(db.compensacionEgresoCaja.updateMany({ where: { egresoId: g1.id }, data: { motivo: "otro" } }))).toMatch(/compensation is immutable/)
    expect(await db.operacionFinanciera.count({ where: { negocioId: e.n, tipo: "REVERSION" } })).toBe(1)
    const vista = await json(await getEgresoOwner(get(`/api/negocio/caja/egresos/${g2.id}`, e.owner), idCtx(g2.id)))
    expect([vista.body.egreso.compensacion, vista.body.egreso.compensacionBloqueada]).toEqual([null, "TURNO_CERRADO"])
  })
})
