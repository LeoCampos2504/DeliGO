/// <reference types="bun-types" />
// ============================================
// F10-C1c — owner supervision, corrections (compensations) and reports, on a REAL ephemeral PostgreSQL
// ============================================
// Through the real owner and cashier routes: explicit register + the shift the
// owner saw, compensation in the open shift (REVERSION, original untouched,
// idempotent, once, audited in the same transaction, racing the close),
// post-close compensation BLOCKED (no write, frozen shift intact), reviews and
// withdrawal confirmations that never move money, notices without duplicates,
// pending supervision, filters, isolation between businesses, the cashier's
// read-only administrative state, and the shift / daily reports reconciled
// with the ledger.

import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createOperationalSession, createSession, OPERATIONAL_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/auth"
import { abrirTurnoCaja, asegurarCajaPredeterminada, cerrarTurnoCaja, crearCajaFisica } from "@/lib/caja-turnos-service"
import { calcularSnapshotEfectivoTurno } from "@/lib/caja-turnos-snapshot"

setDefaultTimeout(300_000)

const testDatabaseUrl = process.env.DELIGO_TEST_DATABASE_URL
const isEphemeralIntegrationDb = process.env.DELIGO_EPHEMERAL_TEST_DB === "1"
if (!testDatabaseUrl || process.env.DATABASE_URL !== testDatabaseUrl) {
  throw new Error("Este test de integración requiere DELIGO_TEST_DATABASE_URL y DATABASE_URL apuntando a la misma base de prueba.")
}
const declaredEnvironment = process.env.DELIGO_ENVIRONMENT ?? process.env.RAILWAY_ENVIRONMENT_NAME ?? process.env.APP_ENV
if (!declaredEnvironment || declaredEnvironment.toUpperCase() !== "TESTING") {
  throw new Error("La suite F10-C1c sólo puede ejecutarse con DELIGO_ENVIRONMENT=TESTING.")
}
const ephemeralTest = isEphemeralIntegrationDb ? test : test.skip

const { GET: getEgresosOwner, POST: postEgresoOwner } = await import("@/app/api/negocio/caja/egresos/route")
const { GET: getEgresoOwner } = await import("@/app/api/negocio/caja/egresos/[id]/route")
const { POST: postRevision } = await import("@/app/api/negocio/caja/egresos/[id]/revision/route")
const { POST: postConfirmacion } = await import("@/app/api/negocio/caja/egresos/[id]/confirmacion-retiro/route")
const { POST: postCompensacion } = await import("@/app/api/negocio/caja/egresos/[id]/compensacion/route")
const { PATCH: patchConfig } = await import("@/app/api/negocio/caja/configuracion-egresos/route")
const { GET: getEgresosCajero, POST: postEgresoCajero } = await import("@/app/api/operativo/caja/[slug]/egresos/route")
const { POST: postVentaCajero } = await import("@/app/api/operativo/caja/[slug]/ventas/route")
const { GET: getTurnoOwner } = await import("@/app/api/negocio/caja/turnos/[id]/route")
const { GET: getTurnosCerrados } = await import("@/app/api/negocio/caja/turnos/cerrados/route")
const { GET: getVentasOwner } = await import("@/app/api/negocio/caja/ventas/route")

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
const jitter = () => new Promise((r) => setTimeout(r, Math.floor(Math.random() * 6)))

async function cajero(negocioId: string, suffix: string, nombre: string, prefijo: string) {
  const cuenta = await db.cuentaOperativa.create({ data: { nombre, email: `${nombre.toLowerCase().replace(/\W+/g, "")}-${suffix}@example.test`, activo: true, eliminado: false } })
  const empleado = await db.empleado.create({ data: { nombre, codigo: `${prefijo}${suffix.slice(0, 6)}`.toUpperCase(), negocioId, cuentaOperativaId: cuenta.id, areaOperativa: "caja", activo: true, eliminado: false } })
  return { empleado, cookie: `${OPERATIONAL_SESSION_COOKIE_NAME}=${await createOperationalSession(cuenta.id)}` }
}

async function escenario(opts: { fondo?: string } = {}) {
  const suffix = randomUUID().slice(0, 12)
  const negocio = await db.negocio.create({
    data: { slug: `test-c1c-${suffix}`, nombre: `Test C1c ${suffix}`, usuario: `test-c1c-${suffix}`, email: `test-c1c-${suffix}@example.test`, password: "fixture", rubro: "negocio", aprobado: true, suspendido: false, empleadosActivos: true, salonActivo: true, cajaTurnosModo: "OPCIONAL" },
  })
  const n = negocio.id
  const owner = `${SESSION_COOKIE_NAME}=${await createSession(n, "negocio")}`
  const a = await cajero(n, suffix, "Cajera A", "XA")
  const b = await cajero(n, suffix, "Cajero B", "XB")
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
  const listar = async (qs = "", cookie = owner) => json(await getEgresosOwner(get(`/api/negocio/caja/egresos${qs ? `?${qs}` : ""}`, cookie)))
  const detalle = async (id: string, cookie = owner) => json(await getEgresoOwner(get(`/api/negocio/caja/egresos/${id}`, cookie), idCtx(id)))
  const revisar = async (id: string, body: unknown, key: string = randomUUID(), cookie = owner) => json(await postRevision(post(`/api/negocio/caja/egresos/${id}/revision`, cookie, body, key), idCtx(id)))
  const confirmar = async (id: string, body: unknown, key: string = randomUUID(), cookie = owner) => json(await postConfirmacion(post(`/api/negocio/caja/egresos/${id}/confirmacion-retiro`, cookie, body, key), idCtx(id)))
  const compensar = async (id: string, body: unknown = { motivo: "Registrado por error: el efectivo nunca salió", confirmoEfectivoEnCaja: true }, key: string | null = randomUUID(), cookie = owner) =>
    json(await postCompensacion(post(`/api/negocio/caja/egresos/${id}/compensacion`, cookie, body, key ?? undefined), idCtx(id)))
  const esperado = async (turnoId: string) => (await calcularSnapshotEfectivoTurno(db, n, turnoId))!.esperado.toFixed(2)
  const foto = async () => ({
    operaciones: await db.operacionFinanciera.count({ where: { negocioId: n } }),
    movimientos: await db.movimientoFinanciero.count({ where: { negocioId: n } }),
    egresos: await db.egresoCaja.count({ where: { negocioId: n } }),
    revisiones: await db.revisionEgresoCaja.count({ where: { negocioId: n } }),
    compensaciones: await db.compensacionEgresoCaja.count({ where: { negocioId: n } }),
    notificaciones: await db.notificacion.count({ where: { negocioId: n, tipo: "caja_egreso" } }),
    auditorias: await db.auditLog.count({ where: { recurso: "egreso_caja", OR: [{ userId: n }, { userId: a.empleado.id }, { userId: b.empleado.id }] } }),
  })
  /** Everything about one outflow that must never change: its row (money fields), operation and leg. */
  const original = async (egresoId: string) => {
    const e = await db.egresoCaja.findUniqueOrThrow({ where: { id: egresoId } })
    const op = await db.operacionFinanciera.findUniqueOrThrow({ where: { id: e.operacionId }, include: { movimientos: true } })
    return {
      egreso: [e.operacionId, e.turnoCajaId, e.cajaFisicaId, e.naturaleza, e.categoria, e.importeDecimal.toFixed(2), e.motivo, e.actorTipo, e.actorId, e.esperadoPrevioDecimal.toFixed(2), e.createdAt.toISOString()],
      op: [op.tipo, op.turnoCajaId, op.actorTipo, op.actorId, op.revierteOperacionId, op.createdAt.toISOString()],
      legs: op.movimientos.map((m) => [m.id, m.cuentaId, m.importeDecimal?.toFixed(2)]),
    }
  }
  const turnoCongelado = async (turnoId: string) => {
    const t = await db.turnoCaja.findUniqueOrThrow({ where: { id: turnoId } })
    return [t.estado, t.efectivoEsperadoDecimal?.toFixed(2), t.efectivoContadoDecimal?.toFixed(2), t.fondoInicialDecimal.toFixed(2), t.cerradoEn?.toISOString(), t.cierreOrigen]
  }
  return { negocio, n, owner, a, b, cajaA, cajaB, producto, abrir, cerrar, venderCajero, egresoCajero, egresosDelCajero, egresoOwner, listar, detalle, revisar, confirmar, compensar, esperado, foto, original, turnoCongelado }
}

const gasto = (importe: string | number, extra: Record<string, unknown> = {}) => ({ naturaleza: "GASTO", categoria: "INSUMOS", importe, motivo: "Bolsas y servilletas", ...extra })
const pago = (importe: string | number, extra: Record<string, unknown> = {}) => ({ naturaleza: "PAGO_PROVEEDOR", importe, motivo: "Pago de mercadería", proveedorNombre: "Distribuidora Sur", ...extra })
const retiro = (importe: string | number, extra: Record<string, unknown> = {}) => ({ naturaleza: "RETIRO_DUENO", importe, motivo: "Retiro del mediodía", destinatarioTipo: "DUENO", destinatarioNombre: "Paula (dueña)", ...extra })
const PALABRAS_PRIVADAS = /esperado|alerta|excede|umbral|justific|diferencia|observaci|NO_RECIBIDO|compensacion/i

describe("F10-C1c — owner registration on an explicitly chosen register", () => {
  ephemeralTest("the owner registers on the register AND the open shift they saw; a stale shift (closed and reopened meanwhile) writes nothing", async () => {
    const e = await escenario()
    const t1 = await e.abrir(e.a.empleado.id, e.cajaA.id)
    await e.abrir(e.b.empleado.id, e.cajaB.id)
    const ok = await e.egresoOwner(gasto(300, { cajaFisicaId: e.cajaA.id, turnoCajaId: t1.id }))
    expect([ok.status, ok.body.egreso.cajaFisicaId, ok.body.egreso.turnoCajaId, ok.body.egreso.registradoPor.tipo]).toEqual([201, e.cajaA.id, t1.id, "NEGOCIO"])
    // The owner saw t1, but caja A now has another shift: nothing lands on a shift nobody chose.
    expect((await e.cerrar(e.a.empleado.id, t1.id, "9700")).ok).toBe(true)
    const t2 = await e.abrir(e.a.empleado.id, e.cajaA.id)
    const antes = await e.foto()
    const viejo = await e.egresoOwner(gasto(300, { cajaFisicaId: e.cajaA.id, turnoCajaId: t1.id }))
    expect([viejo.status, viejo.body.code]).toEqual([409, "TURNO_CAMBIO"])
    // A shift without the register, or a cashier sending a shift, is refused before anything.
    expect((await e.egresoOwner(gasto(300, { turnoCajaId: t2.id }))).body.code).toBe("CAJA_SELECCION_REQUERIDA")
    expect((await e.egresoCajero(e.a.cookie, gasto(300, { turnoCajaId: t2.id }))).body.code).toBe("CAMPOS_NO_PERMITIDOS")
    expect(await e.foto()).toEqual(antes)
    expect(await e.esperado(t2.id)).toBe("10000.00")
  })

  ephemeralTest("an owner's outflow creates no notice for the owner; an employee's does — once, even across replays and a same-key burst", async () => {
    const e = await escenario()
    const t = await e.abrir(e.a.empleado.id, e.cajaA.id)
    await e.egresoOwner(gasto(100, { cajaFisicaId: e.cajaA.id, turnoCajaId: t.id }))
    expect((await e.foto()).notificaciones).toBe(0)
    const key: string = randomUUID()
    const rs = await Promise.all(Array.from({ length: 5 }, () => e.egresoCajero(e.a.cookie, retiro(700), key)))
    expect(rs.filter((r) => r.status === 201)).toHaveLength(1)
    for (let i = 0; i < 3; i++) expect((await e.egresoCajero(e.a.cookie, retiro(700), key)).replayed).toBe(true)
    const avisos = await db.notificacion.findMany({ where: { negocioId: e.n, tipo: "caja_egreso" } })
    expect(avisos).toHaveLength(1)
    expect(JSON.parse(avisos[0].datos)).toMatchObject({ prioridad: "ALTA", alertas: { retiro: true } })
    expect(await db.operacionFinanciera.count({ where: { negocioId: e.n, tipo: "RETIRO_DUENO" } })).toBe(1)
  })
})

describe("F10-C1c — compensation while the shift is open", () => {
  ephemeralTest("one REVERSION with one positive leg on the same account and shift; the original row, operation and leg are untouched; expected cash goes back up; audit in the same transaction; history keeps both", async () => {
    const e = await escenario()
    const t = await e.abrir(e.a.empleado.id, e.cajaA.id)
    const r = await e.egresoCajero(e.a.cookie, gasto("1500.50"))
    const id = r.body.egreso.id
    expect(await e.esperado(t.id)).toBe("8499.50")
    const antes = await e.original(id)
    const c = await e.compensar(id)
    expect(c.status).toBe(201)
    expect(await e.original(id)).toEqual(antes)
    expect(await e.esperado(t.id)).toBe("10000.00")

    const comp = await db.compensacionEgresoCaja.findUniqueOrThrow({ where: { egresoId: id } })
    const op = await db.operacionFinanciera.findUniqueOrThrow({ where: { id: comp.operacionId }, include: { movimientos: true } })
    const egreso = await db.egresoCaja.findUniqueOrThrow({ where: { id } })
    const pataOriginal = await db.movimientoFinanciero.findFirstOrThrow({ where: { operacionId: egreso.operacionId } })
    expect([op.tipo, op.turnoCajaId, op.revierteOperacionId, op.actorTipo, op.actorId]).toEqual(["REVERSION", t.id, egreso.operacionId, "NEGOCIO", e.n])
    expect(op.movimientos.map((m) => [m.cuentaId, m.importeDecimal?.toFixed(2)])).toEqual([[pataOriginal.cuentaId, "1500.50"]])
    expect([comp.momento, comp.turnoCajaId, comp.importeDecimal.toFixed(2)]).toEqual(["TURNO_ABIERTO", t.id, "1500.50"])

    const xmin = await db.$queryRaw<Array<{ audit: string; leg: string; comp: string }>>`
      SELECT (SELECT xmin::text FROM audit_logs WHERE accion = 'caja.egreso_compensado' AND "recursoId" = ${id}) AS audit,
             (SELECT xmin::text FROM movimientos_financieros WHERE "operacionId" = ${comp.operacionId}) AS leg,
             (SELECT xmin::text FROM compensaciones_egresos_caja WHERE "id" = ${comp.id}) AS comp`
    expect([xmin[0].audit, xmin[0].comp]).toEqual([xmin[0].leg, xmin[0].leg])
    const audit = await db.auditLog.findFirstOrThrow({ where: { accion: "caja.egreso_compensado", recursoId: id } })
    expect(JSON.parse(audit.detalle ?? "{}")).toMatchObject({ importe: "1500.50", momento: "TURNO_ABIERTO", operacionOriginalId: egreso.operacionId, operacionCompensacionId: comp.operacionId })

    expect(c.body.egreso).toMatchObject({ compensacion: { momento: "TURNO_ABIERTO", importe: 1500.5 }, compensacionDisponible: false, pendienteSupervision: false })
    // The cashier sees «Anulada» on their own outflow (no owner text) — the cash is expected in the drawer.
    const cajeroVe = await e.egresosDelCajero(e.a.cookie)
    expect(cajeroVe.body.egresos[0]).toMatchObject({ id, estadoAdministrativo: "ANULADO", importe: 1500.5 })
    expect(cajeroVe.raw).not.toMatch(PALABRAS_PRIVADAS)
    expect(cajeroVe.raw).not.toContain("nunca salió")
    // The blind close counts the compensation through the unchanged formula.
    expect((await e.cerrar(e.a.empleado.id, t.id, "10000")).ok).toBe(true)
    const cerrado = await db.turnoCaja.findUniqueOrThrow({ where: { id: t.id } })
    expect([cerrado.efectivoEsperadoDecimal?.toFixed(2), cerrado.efectivoContadoDecimal?.toFixed(2)]).toEqual(["10000.00", "10000.00"])
  })

  ephemeralTest("idempotent and once: replay answers the same; a reused key with another motive is 409; a second compensation is 409; double click (same-key burst) and different-key bursts produce exactly one", async () => {
    const e = await escenario()
    await e.abrir(e.a.empleado.id, e.cajaA.id)
    const g1 = (await e.egresoCajero(e.a.cookie, gasto(400))).body.egreso.id
    const g2 = (await e.egresoCajero(e.a.cookie, gasto(250))).body.egreso.id
    const key: string = randomUUID()
    const body = { motivo: "Se cargó dos veces", confirmoEfectivoEnCaja: true }
    const primero = await e.compensar(g1, body, key)
    expect(primero.status).toBe(201)
    const despues = await e.foto()
    const replay = await e.compensar(g1, body, key.toUpperCase())
    expect([replay.status, replay.replayed]).toEqual([200, true])
    expect((await e.compensar(g1, { ...body, motivo: "Otro motivo" }, key)).body.code).toBe("IDEMPOTENCY_KEY_REUSED")
    expect((await e.compensar(g2, body, key)).body.code).toBe("IDEMPOTENCY_KEY_REUSED")
    const segunda = await e.compensar(g1, body)
    expect([segunda.status, segunda.body.code]).toEqual([409, "EGRESO_YA_COMPENSADO"])
    expect(await e.foto()).toEqual(despues)

    const k2: string = randomUUID()
    const mismos = await Promise.all(Array.from({ length: 6 }, () => e.compensar(g2, body, k2)))
    expect(mismos.filter((r) => r.status === 201)).toHaveLength(1)
    expect(mismos.every((r) => r.status === 201 || (r.status === 200 && r.replayed))).toBe(true)
    const g3 = (await e.egresoCajero(e.a.cookie, gasto(90))).body.egreso.id
    const distintos = await Promise.all(Array.from({ length: 6 }, () => e.compensar(g3, body)))
    expect(distintos.filter((r) => r.status === 201)).toHaveLength(1)
    expect(distintos.filter((r) => r.status === 409).map((r) => r.body.code)).toEqual(Array(5).fill("EGRESO_YA_COMPENSADO"))
    expect(await db.operacionFinanciera.count({ where: { negocioId: e.n, tipo: "REVERSION" } })).toBe(3)
    expect(await db.auditLog.count({ where: { accion: "caja.egreso_compensado", userId: e.n } })).toBe(3)
  })

  ephemeralTest("validation and permissions: motive and the physical-cash confirmation are required; key required; cashier and another business are refused; nothing is written", async () => {
    const e = await escenario()
    const otro = await escenario()
    await e.abrir(e.a.empleado.id, e.cajaA.id)
    const id = (await e.egresoCajero(e.a.cookie, gasto(100))).body.egreso.id
    const antes = await e.foto()
    expect((await e.compensar(id, { motivo: " ", confirmoEfectivoEnCaja: true })).body.code).toBe("MOTIVO_COMPENSACION_REQUERIDO")
    expect((await e.compensar(id, { motivo: "x" })).body.code).toBe("CONFIRMACION_EFECTIVO_REQUERIDA")
    expect((await e.compensar(id, { motivo: "x", confirmoEfectivoEnCaja: "true" })).body.code).toBe("CONFIRMACION_EFECTIVO_REQUERIDA")
    expect((await e.compensar(id, undefined, null)).body.code).toBe("IDEMPOTENCY_KEY_REQUIRED")
    const cajeroIntenta = await e.compensar(id, undefined, randomUUID(), e.a.cookie)
    expect([401, 403]).toContain(cajeroIntenta.status)
    const ajeno = await e.compensar(id, undefined, randomUUID(), otro.owner)
    expect([ajeno.status, ajeno.body.code]).toEqual([404, "EGRESO_NO_ENCONTRADO"])
    expect((await e.detalle(id, otro.owner)).status).toBe(404)
    expect((await e.listar("", otro.owner)).body.egresos).toEqual([])
    expect(await e.foto()).toEqual(antes)
  })

  ephemeralTest("racing the close: either the compensation commits first (and the frozen expected cash includes it) or it gets 409 and writes nothing — never half", async () => {
    const e = await escenario()
    const resultados: string[] = []
    for (let i = 0; i < 12; i++) {
      const t = await e.abrir(e.a.empleado.id, e.cajaA.id)
      const id = (await e.egresoCajero(e.a.cookie, gasto(300))).body.egreso.id
      const [c, cierre] = await Promise.all([
        (async () => { if (i % 2) await jitter(); return e.compensar(id) })(),
        (async () => { if (i % 2 === 0) await jitter(); return e.cerrar(e.a.empleado.id, t.id, "10000") })(),
      ])
      expect(cierre.ok).toBe(true)
      const congelado = (await db.turnoCaja.findUniqueOrThrow({ where: { id: t.id } })).efectivoEsperadoDecimal?.toFixed(2)
      const existe = await db.compensacionEgresoCaja.count({ where: { egresoId: id } })
      if (c.status === 201) {
        expect([congelado, existe]).toEqual(["10000.00", 1])
        resultados.push("compensacion-primero")
      } else {
        expect([c.status, c.body.code, congelado, existe]).toEqual([409, "COMPENSACION_POSTERIOR_BLOQUEADA", "9700.00", 0])
        resultados.push("cierre-primero")
      }
      expect(await e.esperado(t.id)).toBe(congelado!)
    }
    expect(resultados).toHaveLength(12)
    console.log(`F10-C1c carrera compensación/cierre: ${resultados.filter((r) => r === "compensacion-primero").length} compensación primero, ${resultados.filter((r) => r === "cierre-primero").length} cierre primero`)
  })
})

describe("F10-C1c — after the close", () => {
  ephemeralTest("compensation is BLOCKED (409, nothing written) and the closed shift stays exactly as it was; an observation is still possible and moves no money", async () => {
    const e = await escenario()
    const t = await e.abrir(e.a.empleado.id, e.cajaA.id)
    const id = (await e.egresoCajero(e.a.cookie, gasto(450))).body.egreso.id
    expect((await e.cerrar(e.a.empleado.id, t.id, "9550")).ok).toBe(true)
    const congelado = await e.turnoCongelado(t.id)
    const antes = await e.foto()
    const original = await e.original(id)
    const c = await e.compensar(id)
    expect([c.status, c.body.code]).toEqual([409, "COMPENSACION_POSTERIOR_BLOQUEADA"])
    expect(c.body.error).toContain("No se modificó nada")
    expect(await e.foto()).toEqual(antes)
    expect(await e.turnoCongelado(t.id)).toEqual(congelado)
    expect(await e.original(id)).toEqual(original)

    const vista = await e.detalle(id)
    expect(vista.body.egreso).toMatchObject({ turnoAbierto: false, compensacionDisponible: false, compensacionBloqueada: "TURNO_CERRADO", compensacion: null })
    const obs = await e.revisar(id, { resultado: "OBSERVADO", observacion: "El ticket decía $45: corregir en la conciliación" })
    expect(obs.status).toBe(201)
    const despues = await e.foto()
    expect([despues.operaciones, despues.movimientos, despues.compensaciones]).toEqual([antes.operaciones, antes.movimientos, antes.compensaciones])
    expect(await e.turnoCongelado(t.id)).toEqual(congelado)
    expect(await e.esperado(t.id)).toBe("9550.00")
  })
})

describe("F10-C1c — supervision without money", () => {
  ephemeralTest("confirming a withdrawal never discounts the cash twice; observing never changes the balance; a compensated withdrawal cannot be confirmed but can still be reviewed", async () => {
    const e = await escenario()
    const t = await e.abrir(e.a.empleado.id, e.cajaA.id)
    const w1 = (await e.egresoCajero(e.a.cookie, retiro(2000))).body.egreso.id
    const w2 = (await e.egresoCajero(e.a.cookie, retiro(500))).body.egreso.id
    expect(await e.esperado(t.id)).toBe("7500.00")
    const legs = async () => db.movimientoFinanciero.findMany({ where: { negocioId: e.n }, select: { id: true, importeDecimal: true }, orderBy: { id: "asc" } })
    const libro = await legs()
    expect((await e.confirmar(w1, { resultado: "CONFIRMADO" })).status).toBe(201)
    expect((await e.revisar(w1, { resultado: "OBSERVADO", observacion: "Faltó firmar el recibo" })).status).toBe(201)
    expect((await e.revisar(w1, { resultado: "REVISADO" })).status).toBe(201)
    expect(await legs()).toEqual(libro)
    expect(await e.esperado(t.id)).toBe("7500.00")
    // The cashier sees «Confirmado» (the last review is REVISADO), never the observation text.
    const visto = (await e.egresosDelCajero(e.a.cookie)).body.egresos.find((x: any) => x.id === w1)
    expect(visto.estadoAdministrativo).toBe("CONFIRMADO")

    expect((await e.compensar(w2, { motivo: "El dueño no se lo llevó: quedó en el cajón", confirmoEfectivoEnCaja: true })).status).toBe(201)
    expect(await e.esperado(t.id)).toBe("8000.00")
    const conf = await e.confirmar(w2, { resultado: "CONFIRMADO" })
    expect([conf.status, conf.body.code]).toEqual([409, "EGRESO_COMPENSADO"])
    expect((await e.revisar(w2, { resultado: "REVISADO" })).status).toBe(201)
    expect(await e.esperado(t.id)).toBe("8000.00")
    const cajero = (await e.egresosDelCajero(e.a.cookie)).body.egresos
    expect(cajero.find((x: any) => x.id === w2).estadoAdministrativo).toBe("ANULADO")
  })

  ephemeralTest("cashier's read-only state: PENDIENTE → OBSERVADO for «not received» (never the raw value or the text); other natures and owner outflows carry no state", async () => {
    const e = await escenario()
    const t = await e.abrir(e.a.empleado.id, e.cajaA.id)
    const w = (await e.egresoCajero(e.a.cookie, retiro(1000))).body.egreso.id
    const g = (await e.egresoCajero(e.a.cookie, gasto(50))).body.egreso.id
    const d = (await e.egresoOwner(gasto(70, { cajaFisicaId: e.cajaA.id, turnoCajaId: t.id }))).body.egreso.id
    const estados = async () => Object.fromEntries((await e.egresosDelCajero(e.a.cookie)).body.egresos.map((x: any) => [x.id, x.estadoAdministrativo]))
    expect(await estados()).toEqual({ [w]: "PENDIENTE", [g]: null, [d]: null })
    expect((await e.confirmar(w, { resultado: "NO_RECIBIDO", observacion: "Nunca me llegó el sobre" })).status).toBe(201)
    const lista = await e.egresosDelCajero(e.a.cookie)
    expect(await estados()).toEqual({ [w]: "OBSERVADO", [g]: null, [d]: null })
    expect(lista.raw).not.toMatch(PALABRAS_PRIVADAS)
    expect(lista.raw).not.toContain("sobre")
  })

  ephemeralTest("pending supervision: counts and filter follow confirmations, reviews and compensations; alerts (withdrawal, threshold, negative expected cash) are owner-only", async () => {
    const e = await escenario({ fondo: "1000" })
    const t = await e.abrir(e.a.empleado.id, e.cajaA.id)
    expect((await json(await patchConfig(patch("/api/negocio/caja/configuracion-egresos", e.owner, { umbralAviso: "800" })))).status).toBe(200)
    const w = (await e.egresoCajero(e.a.cookie, retiro(100))).body.egreso.id
    const grande = await e.egresoCajero(e.a.cookie, gasto(850))
    expect(grande.raw).not.toMatch(PALABRAS_PRIVADAS)
    const negativo = await e.egresoCajero(e.a.cookie, pago(200))
    expect(negativo.raw).not.toMatch(PALABRAS_PRIVADAS)
    const propio = (await e.egresoOwner(gasto(10, { cajaFisicaId: e.cajaA.id, turnoCajaId: t.id, justificacion: "Cambio chico" }))).body.egreso
    expect(propio.pendienteSupervision).toBe(true) // owner outflow leaving the expected cash negative waits for a review
    const l1 = await e.listar()
    expect(l1.body.pendientes).toEqual({ confirmacionRetiro: 1, revision: 4, total: 4 })
    const porId = Object.fromEntries(l1.body.egresos.map((x: any) => [x.id, x]))
    expect(porId[grande.body.egreso.id].alertas).toMatchObject({ superaUmbral: true, excedeEsperado: false, umbralAviso: 800 })
    expect(porId[negativo.body.egreso.id].alertas).toMatchObject({ excedeEsperado: true, efectivoEsperadoPrevio: 50, efectivoEsperadoResultante: -150 })
    const avisos = await db.notificacion.findMany({ where: { negocioId: e.n, tipo: "caja_egreso" }, orderBy: { createdAt: "asc" } })
    expect(avisos.map((x) => JSON.parse(x.datos).prioridad)).toEqual(["ALTA", "ALTA", "ALTA"])
    expect(avisos.map((x) => JSON.parse(x.datos).alertas)).toEqual([
      { retiro: true, excedeEsperado: false, superaUmbral: false },
      { retiro: false, excedeEsperado: false, superaUmbral: true },
      { retiro: false, excedeEsperado: true, superaUmbral: false },
    ])

    await e.confirmar(w, { resultado: "CONFIRMADO" })
    expect((await e.listar()).body.pendientes).toEqual({ confirmacionRetiro: 0, revision: 4, total: 4 })
    await e.revisar(w, { resultado: "REVISADO" })
    await e.compensar(grande.body.egreso.id)
    const l2 = await e.listar("pendienteSupervision=true")
    expect(l2.body.pendientes).toEqual({ confirmacionRetiro: 0, revision: 2, total: 2 })
    expect(l2.body.egresos.map((x: any) => x.id).sort()).toEqual([negativo.body.egreso.id, propio.id].sort())
    // Reviewing/compensating never added notices.
    expect(await db.notificacion.count({ where: { negocioId: e.n, tipo: "caja_egreso" } })).toBe(3)
  })

  ephemeralTest("filters: dates, register, who registered (employee or owner), nature, category, review state, compensated; filter options list the owner and employees by name", async () => {
    const e = await escenario()
    const ta = await e.abrir(e.a.empleado.id, e.cajaA.id)
    await e.abrir(e.b.empleado.id, e.cajaB.id)
    const g1 = (await e.egresoCajero(e.a.cookie, gasto(10, { categoria: "SERVICIOS" }))).body.egreso.id
    const p1 = (await e.egresoCajero(e.b.cookie, pago(20))).body.egreso.id
    const r1 = (await e.egresoCajero(e.a.cookie, retiro(30))).body.egreso.id
    const d1 = (await e.egresoOwner(gasto(40, { cajaFisicaId: e.cajaA.id, turnoCajaId: ta.id }))).body.egreso.id
    await e.revisar(g1, { resultado: "OBSERVADO", observacion: "Sin ticket" })
    await e.compensar(p1)
    const ids = async (qs: string) => (await e.listar(qs)).body.egresos.map((x: any) => x.id).sort()
    expect(await ids(`cajaFisicaId=${e.cajaB.id}`)).toEqual([p1])
    expect(await ids(`empleadoId=${e.a.empleado.id}`)).toEqual([g1, r1].sort())
    expect(await ids("empleadoId=DUENO")).toEqual([d1])
    expect(await ids("naturaleza=GASTO")).toEqual([g1, d1].sort())
    expect(await ids("categoria=SERVICIOS")).toEqual([g1])
    expect(await ids("estadoRevision=OBSERVADO")).toEqual([g1])
    expect(await ids("compensado=true")).toEqual([p1])
    const manana = new Date(Date.now() + 86_400_000).toISOString()
    expect(await ids(`desde=${manana}`)).toEqual([])
    expect((await ids(`hasta=${manana}`)).length).toBe(4)
    expect((await e.listar("categoria=NADA")).status).toBe(400)
    expect((await e.listar()).body.responsables).toEqual([{ id: "DUENO", nombre: "Dueño" }, { id: e.a.empleado.id, nombre: "Cajera A" }, { id: e.b.empleado.id, nombre: "Cajero B" }])
  })
})

describe("F10-C1c — reports reconciled with the ledger", () => {
  ephemeralTest("shift detail and closed shifts: sales, outflows by nature and compensations apart; fondo + parts = expected cash (live and frozen); the daily summary never merges natures", async () => {
    const e = await escenario()
    const t = await e.abrir(e.a.empleado.id, e.cajaA.id)
    expect((await e.venderCajero(e.a.cookie, 3)).status).toBe(201)
    const g = (await e.egresoCajero(e.a.cookie, gasto(200))).body.egreso.id
    await e.egresoCajero(e.a.cookie, pago(500))
    await e.egresoCajero(e.a.cookie, retiro(1000))
    await e.egresoCajero(e.a.cookie, gasto(50, { categoria: "TRANSPORTE" }))
    await e.compensar(g)
    const vivo = await json(await getTurnoOwner(get(`/api/negocio/caja/turnos/${t.id}`, e.owner), idCtx(t.id)))
    expect(vivo.body.desgloseEfectivo).toEqual({
      fondoInicial: 10000, ventasEfectivo: 3000, reintegros: 0, gastos: 250, pagosProveedor: 500, retirosDueno: 1000, compensaciones: 200,
      compensacionesPorNaturaleza: { GASTO: 200, PAGO_PROVEEDOR: 0, RETIRO_DUENO: 0 }, recuperosEgresos: 0, otrosIngresos: 0, otrasSalidas: 0, esperadoCalculado: 11450, cuadra: true,
    })
    expect(vivo.body.efectivo.esperado).toBe(11450)
    expect((await e.cerrar(e.a.empleado.id, t.id, "11450")).ok).toBe(true)
    const cerrados = await json(await getTurnosCerrados(get("/api/negocio/caja/turnos/cerrados", e.owner)))
    const fila = cerrados.body.turnos.find((x: any) => x.id === t.id)
    expect([fila.desgloseEfectivo.esperadoCalculado, fila.desgloseEfectivo.cuadra, fila.efectivoEsperado]).toEqual([11450, true, 11450])

    const hoy = await json(await getVentasOwner(get("/api/negocio/caja/ventas", e.owner)))
    expect(hoy.body.egresosHoy).toEqual({
      // F10-D1: + effective (recorded − compensated − conciliated), recovered today and net, per nature.
      GASTO: { cantidad: 2, importe: 250, cantidadCompensaciones: 1, compensado: 200, conciliado: 0, efectivo: 50, recuperado: 0, neto: 50 },
      PAGO_PROVEEDOR: { cantidad: 1, importe: 500, cantidadCompensaciones: 0, compensado: 0, conciliado: 0, efectivo: 500, recuperado: 0, neto: 500 },
      RETIRO_DUENO: { cantidad: 1, importe: 1000, cantidadCompensaciones: 0, compensado: 0, conciliado: 0, efectivo: 1000, recuperado: 0, neto: 1000 },
      gastosPorCategoria: { INSUMOS: 200, TRANSPORTE: 50 },
      recuperosEgresos: { cantidad: 0, importe: 0 },
      conciliacionesEgresosAnteriores: { cantidad: 0, importe: 0 },
    })
    // The sales summary contract is unchanged: outflows are not returns.
    expect(hoy.body.resumenHoy).toMatchObject({ totalEfectivo: 3000, totalDevuelto: 0 })
    // A cashier can never read these owner routes.
    expect([401, 403]).toContain((await getTurnoOwner(get(`/api/negocio/caja/turnos/${t.id}`, e.a.cookie), idCtx(t.id))).status)
    expect([401, 403]).toContain((await getVentasOwner(get("/api/negocio/caja/ventas", e.a.cookie))).status)
  })
})
