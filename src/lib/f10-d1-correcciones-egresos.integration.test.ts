/// <reference types="bun-types" />
// ============================================
// F10-D1 — post-close corrections of cash outflows, on a REAL ephemeral PostgreSQL
// ============================================
// Through the real owner routes: conciliations (the cash never left / left less: no money, capped by the
// closed shift's surplus across ALL its outflows), recoveries (a new inflow in an OPEN shift of an
// explicitly chosen register, racing that shift's close), the shared per-outflow cap, idempotency,
// concurrency, compensated / still-open outflows, confirmed withdrawals, supplier adjustments through the
// single F5 writer (and the link / unlink / cancellation blocks that prevent duplicate adjustments),
// permissions and isolation, the direct SQL guards and the reports (no double counting).

import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { Prisma } from "@prisma/client"
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
  throw new Error("La suite F10-D1 sólo puede ejecutarse con DELIGO_ENVIRONMENT=TESTING.")
}
const ephemeralTest = isEphemeralIntegrationDb ? test : test.skip

const { POST: postEgresoOwner } = await import("@/app/api/negocio/caja/egresos/route")
const { GET: getEgresoOwner } = await import("@/app/api/negocio/caja/egresos/[id]/route")
const { POST: postConfirmacion } = await import("@/app/api/negocio/caja/egresos/[id]/confirmacion-retiro/route")
const { POST: postCompensacion } = await import("@/app/api/negocio/caja/egresos/[id]/compensacion/route")
const { POST: postConciliacion } = await import("@/app/api/negocio/caja/egresos/[id]/conciliacion/route")
const { POST: postRecupero } = await import("@/app/api/negocio/caja/egresos/[id]/recupero/route")
const { GET: getEgresosCajero, POST: postEgresoCajero } = await import("@/app/api/operativo/caja/[slug]/egresos/route")
const { GET: getTurnosCerrados } = await import("@/app/api/negocio/caja/turnos/cerrados/route")
const { GET: getTurnoOwner } = await import("@/app/api/negocio/caja/turnos/[id]/route")
const { GET: getVentasOwner } = await import("@/app/api/negocio/caja/ventas/route")
const { POST: postProveedor } = await import("@/app/api/negocio/proveedores/route")
const { GET: getCuenta } = await import("@/app/api/negocio/proveedores/[id]/cuenta/route")
const { POST: postObligacion } = await import("@/app/api/negocio/proveedores/[id]/obligaciones/route")
const { POST: postVincular } = await import("@/app/api/negocio/proveedores/[id]/creditos/caja/route")
const { POST: postAsignaciones } = await import("@/app/api/negocio/proveedores/[id]/asignaciones/route")
const { POST: postAnularObligacion } = await import("@/app/api/negocio/proveedores/obligaciones/[obligacionId]/anulacion/route")
const { POST: postAccionCredito } = await import("@/app/api/negocio/proveedores/creditos/[creditoId]/[accion]/route")

afterAll(async () => {
  await db.$disconnect()
})

type Res = { status: number; replayed: boolean; body: Record<string, any> }
const json = async (res: Response): Promise<Res> => {
  const raw = await res.text()
  let body: Record<string, any> = {}
  try { body = JSON.parse(raw) } catch { /* empty */ }
  return { status: res.status, replayed: res.headers.get("Idempotency-Replayed") === "true", body }
}
const req = (method: string, url: string, cookie: string, body?: unknown, key?: string) =>
  new NextRequest(`http://localhost${url}`, { method, headers: { cookie, "content-type": "application/json", ...(key ? { "idempotency-key": key } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
const ctx = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) })
const K = () => randomUUID()
const enPromesa = <T,>(p: PromiseLike<T>): Promise<T> => Promise.resolve().then(() => p)

async function cajero(negocioId: string, suffix: string, nombre: string, prefijo: string) {
  const cuenta = await db.cuentaOperativa.create({ data: { nombre, email: `${nombre.toLowerCase().replace(/\W+/g, "")}-${suffix}@example.test`, activo: true, eliminado: false } })
  const empleado = await db.empleado.create({ data: { nombre, codigo: `${prefijo}${suffix.slice(0, 6)}`.toUpperCase(), negocioId, cuentaOperativaId: cuenta.id, areaOperativa: "caja", activo: true, eliminado: false } })
  return { empleado, cookie: `${OPERATIONAL_SESSION_COOKIE_NAME}=${await createOperationalSession(cuenta.id)}` }
}

async function escenario() {
  const suffix = randomUUID().slice(0, 12)
  const negocio = await db.negocio.create({
    data: { slug: `test-d1-${suffix}`, nombre: `Test D1 ${suffix}`, usuario: `test-d1-${suffix}`, email: `test-d1-${suffix}@example.test`, password: "fixture", rubro: "negocio", aprobado: true, suspendido: false, empleadosActivos: true, salonActivo: true, cajaTurnosModo: "OPCIONAL" },
  })
  const n = negocio.id
  const owner = `${SESSION_COOKIE_NAME}=${await createSession(n, "negocio")}`
  const a = await cajero(n, suffix, "Cajera A", "DA")
  const b = await cajero(n, suffix, "Cajero B", "DB")
  const cajaA = await asegurarCajaPredeterminada(db, n)
  const cajaBRes = await crearCajaFisica(db, n, { nombre: "Caja B" })
  if (!cajaBRes.ok) throw new Error("fixture: caja B")
  const cajaB = cajaBRes.value
  const abrir = async (empleadoId: string, cajaFisicaId: string, fondo = "10000") => {
    const r = await abrirTurnoCaja(db, { negocioId: n, actor: { tipo: "EMPLEADO", empleadoId }, cajaFisicaId, fondoInicial: fondo, idempotencyKey: K() })
    if (!r.ok) throw new Error(`fixture: abrir turno ${JSON.stringify(r)}`)
    return r.value.turno
  }
  const esperado = async (turnoId: string) => (await calcularSnapshotEfectivoTurno(db, n, turnoId))!.esperado
  /** The cashier closes counting expected + `sobrante` (negative = shortage). */
  const cerrar = async (empleadoId: string, turnoCajaId: string, sobrante = "0") => {
    const contado = (await esperado(turnoCajaId)).plus(sobrante).toFixed(2)
    const r = await cerrarTurnoCaja(db, { negocioId: n, turnoCajaId, actor: { tipo: "EMPLEADO", empleadoId }, efectivoContado: contado, idempotencyKey: K() })
    if (!r.ok) throw new Error(`fixture: cerrar turno ${JSON.stringify(r)}`)
    return r
  }
  const egresoCajero = async (cookie: string, body: unknown) => {
    const r = await json(await postEgresoCajero(req("POST", `/api/operativo/caja/${negocio.slug}/egresos`, cookie, body, K()), ctx({ slug: negocio.slug })))
    if (r.status !== 201) throw new Error(`fixture: egreso ${JSON.stringify(r.body)}`)
    return r.body.egreso.id as string
  }
  const egresosDelCajero = async (cookie: string) => json(await getEgresosCajero(req("GET", `/api/operativo/caja/${negocio.slug}/egresos`, cookie), ctx({ slug: negocio.slug })))
  const detalle = async (id: string, cookie = owner) => json(await getEgresoOwner(req("GET", `/api/negocio/caja/egresos/${id}`, cookie), ctx({ id })))
  const confirmar = async (id: string, resultado: string, observacion: string | null = null) => json(await postConfirmacion(req("POST", `/api/negocio/caja/egresos/${id}/confirmacion-retiro`, owner, { resultado, observacion }, K()), ctx({ id })))
  const compensar = async (id: string) => json(await postCompensacion(req("POST", `/api/negocio/caja/egresos/${id}/compensacion`, owner, { motivo: "Registrado por error", confirmoEfectivoEnCaja: true }, K()), ctx({ id })))
  const conciliar = async (id: string, body: Record<string, unknown>, key: string | null = K(), cookie = owner) =>
    json(await postConciliacion(req("POST", `/api/negocio/caja/egresos/${id}/conciliacion`, cookie, { motivo: "El efectivo nunca salió de la caja", confirmoSinSalida: true, ...body }, key ?? undefined), ctx({ id })))
  const recuperar = async (id: string, body: Record<string, unknown>, key: string | null = K(), cookie = owner) =>
    json(await postRecupero(req("POST", `/api/negocio/caja/egresos/${id}/recupero`, cookie, { motivo: "Devolvieron el efectivo", confirmoEfectivoRecibido: true, ...body }, key ?? undefined), ctx({ id })))
  const cerrados = async () => json(await getTurnosCerrados(req("GET", "/api/negocio/caja/turnos/cerrados", owner)))
  const turnoOwner = async (id: string) => json(await getTurnoOwner(req("GET", `/api/negocio/caja/turnos/${id}`, owner), ctx({ id })))
  const ventasOwner = async () => json(await getVentasOwner(req("GET", "/api/negocio/caja/ventas", owner)))
  const foto = async () => ({
    operaciones: await db.operacionFinanciera.count({ where: { negocioId: n } }),
    movimientos: await db.movimientoFinanciero.count({ where: { negocioId: n } }),
    conciliaciones: await db.conciliacionEgresoCaja.count({ where: { negocioId: n } }),
    recuperos: await db.recuperoEgresoCaja.count({ where: { negocioId: n } }),
    obligaciones: await db.obligacionProveedor.count({ where: { negocioId: n } }),
    creditos: await db.creditoProveedor.count({ where: { negocioId: n } }),
    eventos: await db.eventoCuentaProveedor.count({ where: { negocioId: n } }),
    auditorias: await db.auditLog.count({ where: { userId: n } }),
  })
  /** Everything about one outflow that must never change: its row (money fields), operation and leg. */
  const original = async (egresoId: string) => {
    const e = await db.egresoCaja.findUniqueOrThrow({ where: { id: egresoId } })
    const op = await db.operacionFinanciera.findUniqueOrThrow({ where: { id: e.operacionId }, include: { movimientos: true } })
    return {
      egreso: [e.operacionId, e.turnoCajaId, e.cajaFisicaId, e.naturaleza, e.importeDecimal.toFixed(2), e.motivo, e.actorTipo, e.actorId, e.esperadoPrevioDecimal.toFixed(2), e.estadoRevision, e.confirmacionRetiroEstado, e.createdAt.toISOString()],
      op: [op.tipo, op.turnoCajaId, op.actorTipo, op.actorId, op.revierteOperacionId, op.createdAt.toISOString()],
      legs: op.movimientos.map((m) => [m.id, m.cuentaId, m.importeDecimal?.toFixed(2)]),
    }
  }
  /** The frozen closed shift, its deliveries and reviews, field by field. */
  const turnoCongelado = async (turnoId: string) => {
    const t = await db.turnoCaja.findUniqueOrThrow({ where: { id: turnoId }, include: { entregasCustodia: true, revisionesAdministrativas: true } })
    return [t.estado, t.efectivoEsperadoDecimal?.toFixed(2), t.efectivoContadoDecimal?.toFixed(2), t.fondoInicialDecimal.toFixed(2), t.cerradoEn?.toISOString(), t.cierreOrigen, t.updatedAt.toISOString(), t.entregasCustodia.length, t.revisionesAdministrativas.length,
      (await db.movimientoFinanciero.count({ where: { operacion: { turnoCajaId: turnoId } } }))]
  }
  return { negocio, n, owner, a, b, cajaA, cajaB, abrir, esperado, cerrar, egresoCajero, egresosDelCajero, detalle, confirmar, compensar, conciliar, recuperar, cerrados, turnoOwner, ventasOwner, foto, original, turnoCongelado }
}

const gasto = (importe: string) => ({ naturaleza: "GASTO", categoria: "INSUMOS", importe, motivo: "Bolsas y servilletas" })
const retiro = (importe: string) => ({ naturaleza: "RETIRO_DUENO", importe, motivo: "Retiro del mediodía", destinatarioTipo: "DUENO", destinatarioNombre: "Paula (dueña)" })

describe("F10-D1 — conciliation (the cash never left): no money, the closed shift intact", () => {
  ephemeralTest("E1 total: explains the whole surplus, moves nothing, idempotent, audited, reported; nothing else can be conciliated", async () => {
    const e = await escenario()
    const t1 = await e.abrir(e.a.empleado.id, e.cajaA.id)
    const g = await e.egresoCajero(e.a.cookie, gasto("300"))
    await e.cerrar(e.a.empleado.id, t1.id, "300")
    const congelado = await e.turnoCongelado(t1.id)
    const antes = await e.original(g)
    const f0 = await e.foto()

    const key = K()
    const r = await e.conciliar(g, { tipo: "SIN_SALIDA" }, key)
    expect(r.status).toBe(201)
    expect(r.body.egreso.correccion).toMatchObject({ registrado: 300, conciliado: 300, efectivo: 0, recuperado: 0, neto: 0, pendiente: 0, disponible: false, bloqueo: "SIN_PENDIENTE" })
    expect(r.body.contextoCorreccion.turnoCerrado).toEqual({ diferenciaOriginal: 300, conciliadoPorEgresos: 300, sinExplicar: 0, sobranteDisponible: 0 })
    const f1 = await e.foto()
    // No operation, no leg: only the conciliation row and its audit.
    expect([f1.operaciones - f0.operaciones, f1.movimientos - f0.movimientos, f1.conciliaciones - f0.conciliaciones, f1.auditorias - f0.auditorias]).toEqual([0, 0, 1, 1])
    expect(await e.turnoCongelado(t1.id)).toEqual(congelado)
    expect(await e.original(g)).toEqual(antes)
    const audit = await db.auditLog.findFirstOrThrow({ where: { userId: e.n, accion: "caja.egreso_conciliado" } })
    expect(JSON.parse(audit.detalle ?? "{}")).toMatchObject({ egresoId: g, tipo: "SIN_SALIDA", importeConciliado: "300.00", diferenciaCierre: "300.00", movimientos: [] })

    // Replay: same answer, nothing new. Same key, other content: rejected without effects.
    const replay = await e.conciliar(g, { tipo: "SIN_SALIDA" }, key)
    expect([replay.status, replay.replayed]).toEqual([200, true])
    expect((await e.conciliar(g, { tipo: "SIN_SALIDA", motivo: "Otro motivo" }, key)).body.code).toBe("IDEMPOTENCY_KEY_REUSED")
    expect((await e.conciliar(g, { tipo: "SIN_SALIDA" })).body.code).toBe("SIN_SALIDA_NO_DISPONIBLE")
    expect((await e.conciliar(g, { tipo: "IMPORTE_EXCEDENTE", importe: "1" })).body.code).toBe("EXCEDE_PENDIENTE")
    expect(await e.foto()).toEqual(f1)

    // Reports: the frozen difference never changes; the closed list says how much is explained.
    const lista = await e.cerrados()
    const fila = lista.body.turnos.find((t: { id: string }) => t.id === t1.id)
    expect([fila.diferencia, fila.conciliacionEgresos]).toEqual([300, { cantidad: 1, conciliado: 300, sinExplicar: 0 }])
    const det = await e.turnoOwner(t1.id)
    expect(det.body.efectivo).toMatchObject({ diferencia: 300, conciliadoPorEgresos: 300, sinExplicar: 0 })
    const hoy = (await e.ventasOwner()).body.egresosHoy
    expect(hoy.GASTO).toMatchObject({ cantidad: 1, importe: 300, conciliado: 300, efectivo: 0, recuperado: 0, neto: 0 })
  })

  ephemeralTest("E2 partial + per-shift cap: several outflows can never explain the same surplus twice; no surplus or a shortage admits nothing", async () => {
    const e = await escenario()
    const t1 = await e.abrir(e.a.empleado.id, e.cajaA.id)
    const g1 = await e.egresoCajero(e.a.cookie, gasto("300"))
    const g2 = await e.egresoCajero(e.a.cookie, gasto("200"))
    await e.cerrar(e.a.empleado.id, t1.id, "250")
    expect((await e.conciliar(g1, { tipo: "IMPORTE_EXCEDENTE", importe: "200" })).status).toBe(201)
    const excede = await e.conciliar(g2, { tipo: "IMPORTE_EXCEDENTE", importe: "100" })
    expect([excede.status, excede.body.code, excede.body.detalle]).toEqual([409, "EXCEDE_SOBRANTE_TURNO", { diferenciaCierre: 250, conciliadoEnTurno: 200, sobranteDisponible: 50 }])
    // SIN_SALIDA of g2 (200) also exceeds what is left of the surplus.
    expect((await e.conciliar(g2, { tipo: "SIN_SALIDA" })).body.code).toBe("EXCEDE_SOBRANTE_TURNO")
    expect((await e.conciliar(g2, { tipo: "IMPORTE_EXCEDENTE", importe: "50" })).status).toBe(201)
    expect((await e.conciliar(g1, { tipo: "IMPORTE_EXCEDENTE", importe: "0.01" })).body.code).toBe("EXCEDE_SOBRANTE_TURNO")
    const d1 = await e.detalle(g1)
    expect(d1.body.egreso.correccion).toMatchObject({ conciliado: 200, efectivo: 100, pendiente: 100, disponible: true })
    expect(d1.body.contextoCorreccion).toMatchObject({ turnoCerrado: { diferenciaOriginal: 250, conciliadoPorEgresos: 250, sinExplicar: 0, sobranteDisponible: 0 }, conciliacionPosible: 0 })

    // Exact close and shortage: nothing to explain, nothing written.
    const t2 = await e.abrir(e.a.empleado.id, e.cajaA.id)
    const g3 = await e.egresoCajero(e.a.cookie, gasto("400"))
    await e.cerrar(e.a.empleado.id, t2.id, "0")
    const t3 = await e.abrir(e.b.empleado.id, e.cajaB.id)
    const g4 = await e.egresoCajero(e.b.cookie, gasto("400"))
    await e.cerrar(e.b.empleado.id, t3.id, "-100")
    const f0 = await e.foto()
    for (const id of [g3, g4]) {
      const r = await e.conciliar(id, { tipo: "SIN_SALIDA" })
      expect([r.status, r.body.code]).toEqual([409, "SIN_SOBRANTE_EN_CIERRE"])
    }
    expect(await e.foto()).toEqual(f0)
  })

  ephemeralTest("an outflow of a still OPEN shift → USAR_COMPENSACION; a compensated one → EGRESO_COMPENSADO; nothing written", async () => {
    const e = await escenario()
    const t1 = await e.abrir(e.a.empleado.id, e.cajaA.id)
    const g = await e.egresoCajero(e.a.cookie, gasto("100"))
    const c = await e.egresoCajero(e.a.cookie, gasto("50"))
    const t2 = await e.abrir(e.b.empleado.id, e.cajaB.id)
    const f0 = await e.foto()
    expect((await e.conciliar(g, { tipo: "SIN_SALIDA" })).body.code).toBe("USAR_COMPENSACION")
    expect((await e.recuperar(g, { cajaFisicaId: e.cajaB.id, turnoCajaId: t2.id, importe: "10" })).body.code).toBe("USAR_COMPENSACION")
    expect(await e.foto()).toEqual(f0)
    expect((await e.detalle(g)).body.egreso.correccion).toMatchObject({ disponible: false, bloqueo: "TURNO_ABIERTO" })
    expect((await e.compensar(c)).status).toBe(201)
    await e.cerrar(e.a.empleado.id, t1.id, "100")
    const f1 = await e.foto()
    expect((await e.conciliar(c, { tipo: "SIN_SALIDA" })).body.code).toBe("EGRESO_COMPENSADO")
    expect((await e.recuperar(c, { cajaFisicaId: e.cajaB.id, turnoCajaId: t2.id, importe: "10" })).body.code).toBe("EGRESO_COMPENSADO")
    expect(await e.foto()).toEqual(f1)
    expect((await e.detalle(c)).body.egreso.correccion).toMatchObject({ disponible: false, bloqueo: "COMPENSADO" })
  })

  ephemeralTest("concurrency: parallel conciliations of one outflow never exceed it; the same key writes once", async () => {
    const e = await escenario()
    const t1 = await e.abrir(e.a.empleado.id, e.cajaA.id)
    const g = await e.egresoCajero(e.a.cookie, gasto("300"))
    const h = await e.egresoCajero(e.a.cookie, gasto("300"))
    await e.cerrar(e.a.empleado.id, t1.id, "450")
    const rs = await Promise.all([1, 2, 3, 4, 5].map(() => e.conciliar(g, { tipo: "IMPORTE_EXCEDENTE", importe: "100" })))
    expect(rs.filter((r) => r.status === 201).length).toBe(3)
    expect(rs.filter((r) => r.status !== 201).every((r) => r.status === 409)).toBe(true)
    // Two outflows of the same shift racing for the remaining surplus (150): never more than 150 together.
    const rs2 = await Promise.all([e.conciliar(h, { tipo: "IMPORTE_EXCEDENTE", importe: "100" }), e.conciliar(h, { tipo: "IMPORTE_EXCEDENTE", importe: "100" })])
    expect(rs2.filter((r) => r.status === 201).length).toBe(1)
    const total = await db.conciliacionEgresoCaja.aggregate({ where: { turnoCajaId: t1.id }, _sum: { importeDecimal: true } })
    expect(total._sum.importeDecimal!.toFixed(2)).toBe("400.00")
    const key = K()
    const same = await Promise.all([1, 2, 3].map(() => e.conciliar(h, { tipo: "IMPORTE_EXCEDENTE", importe: "50" }, key)))
    expect(same.every((r) => r.status === 201 || r.status === 200)).toBe(true)
    expect(await db.conciliacionEgresoCaja.count({ where: { negocioId: e.n, idempotencyKey: key } })).toBe(1)
  })
})

describe("F10-D1 — recovery (the cash came back): a new inflow in an OPEN shift", () => {
  ephemeralTest("E3 partial + total: positive leg on the receiving register, its expected cash goes up, the original stays; reports without double counting", async () => {
    const e = await escenario()
    const t1 = await e.abrir(e.a.empleado.id, e.cajaA.id)
    const g = await e.egresoCajero(e.a.cookie, gasto("500"))
    await e.cerrar(e.a.empleado.id, t1.id, "0")
    const congelado = await e.turnoCongelado(t1.id)
    const antes = await e.original(g)
    const t2 = await e.abrir(e.b.empleado.id, e.cajaB.id, "1000")
    expect((await e.esperado(t2.id)).toFixed(2)).toBe("1000.00")

    // The shift the owner saw changed → nothing written.
    const f0 = await e.foto()
    expect((await e.recuperar(g, { cajaFisicaId: e.cajaB.id, turnoCajaId: t1.id, importe: "200" })).body.code).toBe("TURNO_CAMBIO")
    expect((await e.recuperar(g, { cajaFisicaId: e.cajaA.id, turnoCajaId: t2.id, importe: "200" })).body.code).toBe("TURNO_REQUERIDO")
    expect(await e.foto()).toEqual(f0)

    const r1 = await e.recuperar(g, { cajaFisicaId: e.cajaB.id, turnoCajaId: t2.id, importe: "200" })
    expect(r1.status).toBe(201)
    expect(r1.body.egreso.correccion).toMatchObject({ registrado: 500, conciliado: 0, efectivo: 500, recuperado: 200, neto: 300, pendiente: 300, disponible: true, sinSalidaDisponible: false })
    const rec = await db.recuperoEgresoCaja.findFirstOrThrow({ where: { egresoId: g }, include: { operacion: { include: { movimientos: { include: { cuenta: true } } } } } })
    expect([rec.operacion.tipo, rec.operacion.turnoCajaId, rec.operacion.revierteOperacionId, rec.operacion.movimientos.length]).toEqual(["RECUPERO_EGRESO", t2.id, null, 1])
    expect([rec.operacion.movimientos[0].importeDecimal?.toFixed(2), rec.operacion.movimientos[0].cuenta.cajaFisicaId, rec.operacion.movimientos[0].cuenta.tipo]).toEqual(["200.00", e.cajaB.id, "EFECTIVO"])
    expect((await e.esperado(t2.id)).toFixed(2)).toBe("1200.00")
    expect(await e.turnoCongelado(t1.id)).toEqual(congelado)
    expect(await e.original(g)).toEqual(antes)
    const audit = await db.auditLog.findFirstOrThrow({ where: { userId: e.n, accion: "caja.egreso_recuperado" } })
    expect(JSON.parse(audit.detalle ?? "{}")).toMatchObject({ egresoId: g, importeRecuperado: "200.00", turnoOriginalId: t1.id, turnoReceptorId: t2.id, cajaReceptoraId: e.cajaB.id })

    expect((await e.recuperar(g, { cajaFisicaId: e.cajaB.id, turnoCajaId: t2.id, importe: "300.01" })).body.code).toBe("EXCEDE_PENDIENTE")
    expect((await e.recuperar(g, { cajaFisicaId: e.cajaB.id, turnoCajaId: t2.id, importe: "300" })).status).toBe(201)
    expect((await e.recuperar(g, { cajaFisicaId: e.cajaB.id, turnoCajaId: t2.id, importe: "0.01" })).body.code).toBe("EXCEDE_PENDIENTE")
    expect((await e.conciliar(g, { tipo: "IMPORTE_EXCEDENTE", importe: "1" })).body.code).toBe("EXCEDE_PENDIENTE")

    // The cashier of the receiving shift sees nothing new (blind close): own outflows only, no recovery.
    const vistaCajero = await e.egresosDelCajero(e.b.cookie)
    expect(vistaCajero.body.egresos).toEqual([])
    expect(JSON.stringify(vistaCajero.body)).not.toMatch(/recuper|conciliad|esperado/i)

    // Receiving shift: the recovery has its own line, and the breakdown still reconciles with the frozen expected cash.
    await e.cerrar(e.b.empleado.id, t2.id, "0")
    const t2Det = await e.turnoOwner(t2.id)
    expect([t2Det.body.efectivo.esperado, t2Det.body.desgloseEfectivo.recuperosEgresos, t2Det.body.desgloseEfectivo.otrosIngresos, t2Det.body.desgloseEfectivo.cuadra]).toEqual([1500, 500, 0, true])
    // Daily summary (DF-3): recorded and effective 500 today, 500 came back today → net 0; the recovery is not a sale.
    const ventas = (await e.ventasOwner()).body
    expect(ventas.egresosHoy.GASTO).toMatchObject({ importe: 500, conciliado: 0, efectivo: 500, recuperado: 500, neto: 0 })
    expect(ventas.egresosHoy.recuperosEgresos).toEqual({ cantidad: 2, importe: 500 })
    expect([ventas.resumenHoy.totalVendido, ventas.resumenHoy.totalEfectivo]).toEqual([0, 0])
  })

  ephemeralTest("a recovery racing the receiving shift's close: it either enters the frozen expected cash or writes nothing", async () => {
    for (let i = 0; i < 4; i++) {
      const e = await escenario()
      const t1 = await e.abrir(e.a.empleado.id, e.cajaA.id)
      const g = await e.egresoCajero(e.a.cookie, gasto("100"))
      await e.cerrar(e.a.empleado.id, t1.id, "0")
      const t2 = await e.abrir(e.b.empleado.id, e.cajaB.id, "1000")
      const [rec, cierre] = await Promise.all([
        e.recuperar(g, { cajaFisicaId: e.cajaB.id, turnoCajaId: t2.id, importe: "100" }),
        cerrarTurnoCaja(db, { negocioId: e.n, turnoCajaId: t2.id, actor: { tipo: "EMPLEADO", empleadoId: e.b.empleado.id }, efectivoContado: "1000", idempotencyKey: K() }),
      ])
      expect(cierre.ok).toBe(true)
      const t = await db.turnoCaja.findUniqueOrThrow({ where: { id: t2.id } })
      const recuperos = await db.recuperoEgresoCaja.count({ where: { egresoId: g } })
      if (rec.status === 201) expect([t.efectivoEsperadoDecimal?.toFixed(2), recuperos]).toEqual(["1100.00", 1])
      else {
        expect([rec.status, ["TURNO_REQUERIDO", "TURNO_NO_DISPONIBLE"].includes(rec.body.code)]).toEqual([409, true])
        expect([t.efectivoEsperadoDecimal?.toFixed(2), recuperos, await db.operacionFinanciera.count({ where: { negocioId: e.n, tipo: "RECUPERO_EGRESO" } })]).toEqual(["1000.00", 0, 0])
      }
    }
  })
})

describe("F10-D1 — owner withdrawals", () => {
  ephemeralTest("a CONFIRMED withdrawal: no SIN_SALIDA, never the whole amount, a partial conciliation and a recovery are allowed; NO_RECIBIDO with surplus can be conciliated", async () => {
    const e = await escenario()
    const t1 = await e.abrir(e.a.empleado.id, e.cajaA.id)
    const w = await e.egresoCajero(e.a.cookie, retiro("1000"))
    const x = await e.egresoCajero(e.a.cookie, retiro("200"))
    expect((await e.confirmar(w, "CONFIRMADO")).status).toBe(201)
    expect((await e.confirmar(x, "NO_RECIBIDO", "No llegó a mis manos")).status).toBe(201)
    await e.cerrar(e.a.empleado.id, t1.id, "1200")
    const f0 = await e.foto()
    expect((await e.conciliar(w, { tipo: "SIN_SALIDA" })).body.code).toBe("RETIRO_CONFIRMADO")
    expect((await e.conciliar(w, { tipo: "IMPORTE_EXCEDENTE", importe: "1000" })).body.code).toBe("RETIRO_CONFIRMADO")
    expect(await e.foto()).toEqual(f0)
    expect((await e.detalle(w)).body.egreso.correccion).toMatchObject({ sinSalidaDisponible: false, conciliacionMaxima: 999.99 })
    expect((await e.conciliar(w, { tipo: "IMPORTE_EXCEDENTE", importe: "400" })).status).toBe(201)
    expect((await e.conciliar(w, { tipo: "IMPORTE_EXCEDENTE", importe: "600" })).body.code).toBe("RETIRO_CONFIRMADO")
    const t2 = await e.abrir(e.b.empleado.id, e.cajaB.id)
    expect((await e.recuperar(w, { cajaFisicaId: e.cajaB.id, turnoCajaId: t2.id, importe: "600" })).status).toBe(201)
    expect((await e.conciliar(x, { tipo: "SIN_SALIDA" })).status).toBe(201)
    const hoy = (await e.ventasOwner()).body.egresosHoy
    expect(hoy.RETIRO_DUENO).toMatchObject({ importe: 1200, conciliado: 600, efectivo: 600, recuperado: 600, neto: 0 })
  })
})

describe("F10-D1 — supplier payments through the single F5 writer", () => {
  async function proveedores(e: Awaited<ReturnType<typeof escenario>>) {
    const crear = async (nombre: string) => {
      const r = await json(await postProveedor(req("POST", "/api/negocio/proveedores", e.owner, { nombre, confirmoNombreSimilar: true }, K())))
      if (r.status !== 201) throw new Error(`fixture: proveedor ${JSON.stringify(r.body)}`)
      return r.body.proveedor.id as string
    }
    const cuenta = async (id: string) => (await json(await getCuenta(req("GET", `/api/negocio/proveedores/${id}/cuenta`, e.owner), ctx({ id })))).body.cuenta
    const vincular = async (id: string, egresoCajaId: string) => json(await postVincular(req("POST", `/api/negocio/proveedores/${id}/creditos/caja`, e.owner, { egresoCajaId }, K()), ctx({ id })))
    const deuda = async (id: string, importe: string) => {
      const r = await json(await postObligacion(req("POST", `/api/negocio/proveedores/${id}/obligaciones`, e.owner, { origen: "AJUSTE_DEUDA", naturalezaAjuste: "DIFERENCIA_ACORDADA", importe, fecha: "2026-11-01", descripcion: "Factura A" }, K()), ctx({ id })))
      if (r.status !== 201) throw new Error(`fixture: deuda ${JSON.stringify(r.body)}`)
      return r.body.obligacionId as string
    }
    const asignar = async (id: string, creditoId: string, obligacionId: string, importe: string) => json(await postAsignaciones(req("POST", `/api/negocio/proveedores/${id}/asignaciones`, e.owner, { tipo: "ASIGNAR", asignar: [{ creditoId, obligacionId, importe }] }, K()), ctx({ id })))
    const anular = async (obligacionId: string) => json(await postAnularObligacion(req("POST", `/api/negocio/proveedores/obligaciones/${obligacionId}/anulacion`, e.owner, { motivo: "Prueba" }, K()), ctx({ obligacionId })))
    const desvincular = async (creditoId: string) => json(await postAccionCredito(req("POST", `/api/negocio/proveedores/creditos/${creditoId}/desvinculacion`, e.owner, { motivo: "Prueba" }, K()), ctx({ creditoId, accion: "desvinculacion" })))
    const pago = async (turno: { id: string }, cajaFisicaId: string, importe: string) => {
      const r = await json(await postEgresoOwner(req("POST", "/api/negocio/caja/egresos", e.owner, { naturaleza: "PAGO_PROVEEDOR", importe, motivo: "Pago de mercadería", proveedorNombre: "Distribuidora Sur", cajaFisicaId, turnoCajaId: turno.id }, K())))
      if (r.status !== 201) throw new Error(`fixture: pago ${JSON.stringify(r.body)}`)
      return r.body.egreso.id as string
    }
    return { crear, cuenta, vincular, deuda, asignar, anular, desvincular, pago }
  }

  ephemeralTest("linked payment: conciliation → ERROR_DE_CARGA, recovery → DIFERENCIA_ACORDADA in the same transaction; credit and assignments intact; unlink / adjustment cancellation blocked", async () => {
    const e = await escenario()
    const p = await proveedores(e)
    const prov = await p.crear("Distribuidora Sur")
    const t1 = await e.abrir(e.a.empleado.id, e.cajaA.id)
    const pagoId = await p.pago(t1, e.cajaA.id, "1000")
    const v = await p.vincular(prov, pagoId)
    expect(v.status).toBe(201)
    const factura = await p.deuda(prov, "1000")
    expect((await p.asignar(prov, v.body.creditoId, factura, "1000")).status).toBe(201)
    expect((await p.cuenta(prov)).totales).toMatchObject({ obligacionesPendientes: 0, saldoNeto: 0, identidadOk: true })
    await e.cerrar(e.a.empleado.id, t1.id, "400")

    const c = await e.conciliar(pagoId, { tipo: "IMPORTE_EXCEDENTE", importe: "400" })
    expect(c.status).toBe(201)
    const conc = await db.conciliacionEgresoCaja.findFirstOrThrow({ where: { egresoId: pagoId } })
    const ajuste = await db.obligacionProveedor.findUniqueOrThrow({ where: { id: conc.obligacionAjusteId! } })
    expect([ajuste.origen, ajuste.naturalezaAjuste, ajuste.importeDecimal.toFixed(2), ajuste.estado, ajuste.proveedorId, ajuste.comprobanteNumero]).toEqual(["AJUSTE_DEUDA", "ERROR_DE_CARGA", "400.00", "VIGENTE", prov, pagoId])
    expect(await db.auditLog.count({ where: { userId: e.n, accion: "cuenta_proveedor.obligacion_registrada", recursoId: ajuste.id } })).toBe(1)
    const credito = await db.creditoProveedor.findUniqueOrThrow({ where: { id: v.body.creditoId } })
    expect([credito.estado, credito.importeDecimal.toFixed(2)]).toEqual(["VIGENTE", "1000.00"])
    expect((await p.cuenta(prov)).totales).toMatchObject({ obligacionesPendientes: 400, saldoNeto: 400, identidadOk: true })

    const t2 = await e.abrir(e.b.empleado.id, e.cajaB.id)
    expect((await e.recuperar(pagoId, { cajaFisicaId: e.cajaB.id, turnoCajaId: t2.id, importe: "100" })).status).toBe(201)
    const rec = await db.recuperoEgresoCaja.findFirstOrThrow({ where: { egresoId: pagoId } })
    const ajuste2 = await db.obligacionProveedor.findUniqueOrThrow({ where: { id: rec.obligacionAjusteId! } })
    expect([ajuste2.naturalezaAjuste, ajuste2.importeDecimal.toFixed(2)]).toEqual(["DIFERENCIA_ACORDADA", "100.00"])
    expect((await p.cuenta(prov)).totales).toMatchObject({ obligacionesPendientes: 500, saldoNeto: 500, identidadOk: true })

    // No duplicate / orphan adjustment: the payment cannot be unlinked, nor the adjustments cancelled.
    const f0 = await e.foto()
    expect((await p.desvincular(v.body.creditoId)).body.code).toBe("EGRESO_CON_CORRECCIONES")
    expect((await p.anular(ajuste.id)).body.code).toBe("AJUSTE_DE_CORRECCION_DE_CAJA")
    expect((await p.anular(ajuste2.id)).body.code).toBe("AJUSTE_DE_CORRECCION_DE_CAJA")
    expect(await e.foto()).toEqual(f0)
  })

  ephemeralTest("unlinked payment: no adjustment; once corrected it can no longer be linked; an inactive supplier blocks the whole correction", async () => {
    const e = await escenario()
    const p = await proveedores(e)
    const prov = await p.crear("Mayorista Norte")
    const t1 = await e.abrir(e.a.empleado.id, e.cajaA.id)
    const suelto = await p.pago(t1, e.cajaA.id, "300")
    const vinculado = await p.pago(t1, e.cajaA.id, "200")
    expect((await p.vincular(prov, vinculado)).status).toBe(201)
    await e.cerrar(e.a.empleado.id, t1.id, "500")
    const f0 = await e.foto()
    expect((await e.conciliar(suelto, { tipo: "SIN_SALIDA" })).status).toBe(201)
    const f1 = await e.foto()
    expect([f1.obligaciones - f0.obligaciones, (await db.conciliacionEgresoCaja.findFirstOrThrow({ where: { egresoId: suelto } })).obligacionAjusteId]).toEqual([0, null])
    expect((await p.vincular(prov, suelto)).body.code).toBe("EGRESO_CON_CORRECCIONES")
    // Inactive supplier: the conciliation is rejected as a whole (no row, no adjustment, no audit).
    await db.proveedor.update({ where: { id: prov }, data: { activo: false } })
    const f2 = await e.foto()
    expect((await e.conciliar(vinculado, { tipo: "SIN_SALIDA" })).body.code).toBe("PROVEEDOR_INACTIVO")
    expect(await e.foto()).toEqual(f2)
  })
})

describe("F10-D1 — permissions, isolation and SQL guards", () => {
  ephemeralTest("cashier session, another business, missing key, invalid body: rejected without effects", async () => {
    const e = await escenario()
    const otro = await escenario()
    const t1 = await e.abrir(e.a.empleado.id, e.cajaA.id)
    const g = await e.egresoCajero(e.a.cookie, gasto("100"))
    await e.cerrar(e.a.empleado.id, t1.id, "100")
    const t2 = await e.abrir(e.b.empleado.id, e.cajaB.id)
    const f0 = await e.foto()
    expect([401, 403]).toContain((await e.conciliar(g, { tipo: "SIN_SALIDA" }, K(), e.a.cookie)).status)
    expect([401, 403]).toContain((await e.recuperar(g, { cajaFisicaId: e.cajaB.id, turnoCajaId: t2.id, importe: "10" }, K(), e.b.cookie)).status)
    expect((await e.conciliar(g, { tipo: "SIN_SALIDA" }, K(), otro.owner)).status).toBe(404)
    expect((await e.recuperar(g, { cajaFisicaId: e.cajaB.id, turnoCajaId: t2.id, importe: "10" }, K(), otro.owner)).status).toBe(404)
    expect((await e.conciliar(g, { tipo: "SIN_SALIDA" }, null)).body.code).toBe("IDEMPOTENCY_KEY_REQUIRED")
    expect((await e.conciliar(g, { tipo: "OTRO" })).status).toBe(400)
    expect((await e.conciliar(g, { tipo: "SIN_SALIDA", confirmoSinSalida: false })).body.code).toBe("CONFIRMACION_REQUERIDA")
    expect((await e.conciliar(g, { tipo: "SIN_SALIDA", motivo: " " })).body.code).toBe("MOTIVO_REQUERIDO")
    expect((await e.conciliar(g, { tipo: "IMPORTE_EXCEDENTE", importe: "-5" })).body.code).toBe("IMPORTE_INVALIDO")
    expect((await e.recuperar(g, { importe: "10" })).body.code).toBe("CAJA_REQUERIDA")
    expect((await e.recuperar(g, { cajaFisicaId: otro.cajaA.id, turnoCajaId: t2.id, importe: "10" })).status).toBe(404)
    expect((await e.detalle(g, otro.owner)).status).toBe(404)
    expect(await e.foto()).toEqual(f0)
  })

  ephemeralTest("direct SQL: the guards repeat every rule (caps, closed / open shifts, one positive leg, no orphan operation, immutability, supplier adjustment)", async () => {
    const e = await escenario()
    const t1 = await e.abrir(e.a.empleado.id, e.cajaA.id)
    const g = await e.egresoCajero(e.a.cookie, gasto("300"))
    await e.cerrar(e.a.empleado.id, t1.id, "100")
    const fila = (tipo: string, importe: string) => ({ id: `d1-${K()}`, negocioId: e.n, egresoId: g, turnoCajaId: t1.id, cajaFisicaId: e.cajaA.id, tipo, importeDecimal: new Prisma.Decimal(importe), motivo: "SQL", actorId: e.n, idempotencyKey: K(), idempotencyFingerprint: "x" })
    await expect(enPromesa(db.conciliacionEgresoCaja.create({ data: fila("IMPORTE_EXCEDENTE", "150") }))).rejects.toThrow(/closed shift surplus/)
    await expect(enPromesa(db.conciliacionEgresoCaja.create({ data: fila("SIN_SALIDA", "100") }))).rejects.toThrow(/whole outflow/)
    const ok = await db.conciliacionEgresoCaja.create({ data: fila("IMPORTE_EXCEDENTE", "100") })
    await expect(enPromesa(db.$executeRaw`UPDATE "conciliaciones_egresos_caja" SET "motivo" = 'otro' WHERE "id" = ${ok.id}`)).rejects.toThrow(/immutable/)
    await expect(enPromesa(db.$executeRaw`DELETE FROM "conciliaciones_egresos_caja" WHERE "id" = ${ok.id}`)).rejects.toThrow(/append-only/)

    // RECUPERO_EGRESO: never in a closed shift; one positive leg; never orphan (checked at commit).
    const cuenta = await db.cuentaFinanciera.findFirstOrThrow({ where: { negocioId: e.n, cajaFisicaId: e.cajaA.id } })
    await expect(enPromesa(db.operacionFinanciera.create({ data: { negocioId: e.n, tipo: "RECUPERO_EGRESO", actorTipo: "NEGOCIO", actorId: e.n, turnoCajaId: t1.id } }))).rejects.toThrow(/open shift/)
    const t2 = await e.abrir(e.b.empleado.id, e.cajaA.id)
    await expect(enPromesa(db.operacionFinanciera.create({ data: { negocioId: e.n, tipo: "RECUPERO_EGRESO", actorTipo: "NEGOCIO", actorId: e.n, turnoCajaId: t2.id, movimientos: { create: [{ negocioId: e.n, cuentaId: cuenta.id, importe: -10, importeDecimal: new Prisma.Decimal("-10") }] } } }))).rejects.toThrow(/positive/)
    await expect(enPromesa(db.operacionFinanciera.create({ data: { negocioId: e.n, tipo: "RECUPERO_EGRESO", actorTipo: "NEGOCIO", actorId: e.n, turnoCajaId: t2.id, movimientos: { create: [{ negocioId: e.n, cuentaId: cuenta.id, importe: 10, importeDecimal: new Prisma.Decimal("10") }] } } }))).rejects.toThrow(/requires its recovery row/)
    expect(await db.operacionFinanciera.count({ where: { negocioId: e.n, tipo: "RECUPERO_EGRESO" } })).toBe(0)
    // Recovery row exceeding the shared cap (300 − 100 conciliated = 200 left) is rejected in the same transaction.
    await expect(db.$transaction(async (tx) => {
      const op = await tx.operacionFinanciera.create({ data: { negocioId: e.n, tipo: "RECUPERO_EGRESO", actorTipo: "NEGOCIO", actorId: e.n, turnoCajaId: t2.id, movimientos: { create: [{ negocioId: e.n, cuentaId: cuenta.id, importe: 250, importeDecimal: new Prisma.Decimal("250") }] } } })
      await tx.recuperoEgresoCaja.create({ data: { negocioId: e.n, egresoId: g, operacionId: op.id, turnoCajaId: t2.id, cajaFisicaId: e.cajaA.id, importeDecimal: new Prisma.Decimal("250"), motivo: "SQL", actorId: e.n, idempotencyKey: K(), idempotencyFingerprint: "x" } })
    })).rejects.toThrow(/exceed the outflow amount/)
    expect(await db.operacionFinanciera.count({ where: { negocioId: e.n, tipo: "RECUPERO_EGRESO" } })).toBe(0)
  })
})

describe("F10-D1 — focused controls (T4 final review)", () => {
  // The register cash account exists from its first movement; create it the same way the service does.
  const cuentaCaja = async (n: string, cajaFisicaId: string) => {
    const { cuentaEfectivoCaja } = await import("@/lib/caja-egresos-service")
    return { id: await cuentaEfectivoCaja(db as unknown as Prisma.TransactionClient, n, cajaFisicaId) }
  }
  const fila = (e: Awaited<ReturnType<typeof escenario>>, egresoId: string, turnoCajaId: string, tipo: string, importe: string) =>
    ({ negocioId: e.n, egresoId, turnoCajaId, cajaFisicaId: e.cajaA.id, tipo, importeDecimal: new Prisma.Decimal(importe), motivo: "SQL", actorId: e.n, idempotencyKey: K(), idempotencyFingerprint: "x" })

  ephemeralTest("turn cap under concurrency: DIFFERENT outflows of one closed shift never explain the same surplus twice (API and direct SQL)", async () => {
    const e = await escenario()
    const t1 = await e.abrir(e.a.empleado.id, e.cajaA.id)
    const ids = [] as string[]
    for (let i = 0; i < 6; i++) ids.push(await e.egresoCajero(e.a.cookie, gasto("300")))
    await e.cerrar(e.a.empleado.id, t1.id, "600")
    // API: three different outflows race for a 600 surplus (300 each) → exactly two win.
    const api = await Promise.all(ids.slice(0, 3).map((id) => e.conciliar(id, { tipo: "SIN_SALIDA" })))
    expect(api.filter((r) => r.status === 201).length).toBe(2)
    expect(api.filter((r) => r.status !== 201).map((r) => r.body.code)).toEqual(["EXCEDE_SOBRANTE_TURNO"])
    // Direct SQL, bypassing the service, on separate connections: nothing left → all rejected by the guard.
    const sql = await Promise.allSettled(ids.slice(3).map((id) => db.$transaction((tx) => tx.conciliacionEgresoCaja.create({ data: fila(e, id, t1.id, "SIN_SALIDA", "300") }))))
    expect(sql.every((r) => r.status === "rejected" && /closed shift surplus/.test(String(r.reason)))).toBe(true)
    const total = await db.conciliacionEgresoCaja.aggregate({ where: { turnoCajaId: t1.id }, _sum: { importeDecimal: true } })
    expect(total._sum.importeDecimal!.toFixed(2)).toBe("600.00")
  })

  ephemeralTest("per-outflow cap under concurrency in SQL alone: parallel conciliations and recoveries never exceed the outflow", async () => {
    const e = await escenario()
    const t1 = await e.abrir(e.a.empleado.id, e.cajaA.id)
    const g = await e.egresoCajero(e.a.cookie, gasto("300"))
    await e.cerrar(e.a.empleado.id, t1.id, "1000")
    const t2 = await e.abrir(e.b.empleado.id, e.cajaB.id)
    const cuenta = await cuentaCaja(e.n, e.cajaB.id)
    const recupero = (importe: string) => db.$transaction(async (tx) => {
      const op = await tx.operacionFinanciera.create({ data: { negocioId: e.n, tipo: "RECUPERO_EGRESO", actorTipo: "NEGOCIO", actorId: e.n, turnoCajaId: t2.id, movimientos: { create: [{ negocioId: e.n, cuentaId: cuenta.id, importe: Number(importe), importeDecimal: new Prisma.Decimal(importe) }] } } })
      return tx.recuperoEgresoCaja.create({ data: { negocioId: e.n, egresoId: g, operacionId: op.id, turnoCajaId: t2.id, cajaFisicaId: e.cajaB.id, importeDecimal: new Prisma.Decimal(importe), motivo: "SQL", actorId: e.n, idempotencyKey: K(), idempotencyFingerprint: "x" } })
    })
    const rs = await Promise.allSettled([
      db.$transaction((tx) => tx.conciliacionEgresoCaja.create({ data: fila(e, g, t1.id, "IMPORTE_EXCEDENTE", "200") })),
      recupero("200"),
      db.$transaction((tx) => tx.conciliacionEgresoCaja.create({ data: fila(e, g, t1.id, "IMPORTE_EXCEDENTE", "200") })),
      recupero("200"),
    ])
    expect(rs.filter((r) => r.status === "fulfilled").length).toBe(1)
    const [c, r] = await Promise.all([
      db.conciliacionEgresoCaja.aggregate({ where: { egresoId: g }, _sum: { importeDecimal: true } }),
      db.recuperoEgresoCaja.aggregate({ where: { egresoId: g }, _sum: { importeDecimal: true } }),
    ])
    expect((c._sum.importeDecimal ?? new Prisma.Decimal(0)).plus(r._sum.importeDecimal ?? 0).toFixed(2)).toBe("200.00")
    // A rejected recovery leaves no orphan operation: every RECUPERO_EGRESO has its row.
    const ops = await db.operacionFinanciera.findMany({ where: { negocioId: e.n, tipo: "RECUPERO_EGRESO" }, include: { recuperoEgreso: true } })
    expect(ops.every((o) => o.recuperoEgreso !== null)).toBe(true)
    expect(ops.length).toBe(await db.recuperoEgresoCaja.count({ where: { egresoId: g } }))
  })

  ephemeralTest("direct SQL: compensated outflow, duplicate recovery operation, confirmed withdrawal by several partials, recovery into a closed shift", async () => {
    const e = await escenario()
    const t1 = await e.abrir(e.a.empleado.id, e.cajaA.id)
    const c = await e.egresoCajero(e.a.cookie, gasto("100"))
    const w = await e.egresoCajero(e.a.cookie, retiro("500"))
    const g = await e.egresoCajero(e.a.cookie, gasto("100"))
    expect((await e.compensar(c)).status).toBe(201)
    expect((await e.confirmar(w, "CONFIRMADO")).status).toBe(201)
    await e.cerrar(e.a.empleado.id, t1.id, "2000")
    await expect(enPromesa(db.conciliacionEgresoCaja.create({ data: fila(e, c, t1.id, "SIN_SALIDA", "100") }))).rejects.toThrow(/compensated/)
    // Confirmed withdrawal: partials allowed while some real outflow remains; never the whole amount, in any number of steps.
    await db.conciliacionEgresoCaja.create({ data: fila(e, w, t1.id, "IMPORTE_EXCEDENTE", "300") })
    await db.conciliacionEgresoCaja.create({ data: fila(e, w, t1.id, "IMPORTE_EXCEDENTE", "199.99") })
    await expect(enPromesa(db.conciliacionEgresoCaja.create({ data: fila(e, w, t1.id, "IMPORTE_EXCEDENTE", "0.01") }))).rejects.toThrow(/partially conciliated/)
    expect((await e.conciliar(w, { tipo: "IMPORTE_EXCEDENTE", importe: "0.01" })).body.code).toBe("RETIRO_CONFIRMADO")
    // A recovery: one row per operation; never into a shift that is closed.
    const t2 = await e.abrir(e.b.empleado.id, e.cajaB.id)
    expect((await e.recuperar(g, { cajaFisicaId: e.cajaB.id, turnoCajaId: t2.id, importe: "40" })).status).toBe(201)
    const rec = await db.recuperoEgresoCaja.findFirstOrThrow({ where: { egresoId: g } })
    await expect(enPromesa(db.recuperoEgresoCaja.create({ data: { negocioId: e.n, egresoId: g, operacionId: rec.operacionId, turnoCajaId: t2.id, cajaFisicaId: e.cajaB.id, importeDecimal: new Prisma.Decimal("40"), motivo: "SQL", actorId: e.n, idempotencyKey: K(), idempotencyFingerprint: "x" } }))).rejects.toThrow()
    await e.cerrar(e.b.empleado.id, t2.id, "0")
    const congelado = await e.turnoCongelado(t2.id)
    const cuenta = await cuentaCaja(e.n, e.cajaB.id)
    await expect(enPromesa(db.operacionFinanciera.create({ data: { negocioId: e.n, tipo: "RECUPERO_EGRESO", actorTipo: "NEGOCIO", actorId: e.n, turnoCajaId: t2.id, movimientos: { create: [{ negocioId: e.n, cuentaId: cuenta.id, importe: 10, importeDecimal: new Prisma.Decimal("10") }] } } }))).rejects.toThrow(/open shift/)
    expect((await e.recuperar(g, { cajaFisicaId: e.cajaB.id, turnoCajaId: t2.id, importe: "10" })).body.code).toBe("TURNO_REQUERIDO")
    expect(await e.turnoCongelado(t2.id)).toEqual(congelado)
    await expect(enPromesa(db.$executeRaw`UPDATE "recuperos_egresos_caja" SET "motivo" = 'x' WHERE "id" = ${rec.id}`)).rejects.toThrow(/immutable/)
    await expect(enPromesa(db.$executeRaw`UPDATE "movimientos_financieros" SET "importeDecimal" = 1 WHERE "operacionId" = ${rec.operacionId}`)).rejects.toThrow(/immutable/)
  })

  ephemeralTest("atomic: a failing audit rolls back the correction AND the supplier adjustment (no orphan F5 debt, no audit)", async () => {
    const { conciliarEgresoCerrado } = await import("@/lib/caja-egresos-correccion-service")
    const e = await escenario()
    const prov = await json(await postProveedor(req("POST", "/api/negocio/proveedores", e.owner, { nombre: "Proveedor Atómico", confirmoNombreSimilar: true }, K())))
    const t1 = await e.abrir(e.a.empleado.id, e.cajaA.id)
    const pago = await json(await postEgresoOwner(req("POST", "/api/negocio/caja/egresos", e.owner, { naturaleza: "PAGO_PROVEEDOR", importe: "500", motivo: "Pago", proveedorNombre: "Proveedor Atómico", cajaFisicaId: e.cajaA.id, turnoCajaId: t1.id }, K())))
    expect((await json(await postVincular(req("POST", `/api/negocio/proveedores/${prov.body.proveedor.id}/creditos/caja`, e.owner, { egresoCajaId: pago.body.egreso.id }, K()), ctx({ id: prov.body.proveedor.id })))).status).toBe(201)
    await e.cerrar(e.a.empleado.id, t1.id, "500")
    const f0 = await e.foto()
    await expect(conciliarEgresoCerrado(db, { negocioId: e.n, egresoId: pago.body.egreso.id, tipo: "SIN_SALIDA", importe: undefined, motivo: "No salió", confirmoSinSalida: true, idempotencyKey: K() }, {
      auditarProveedor: async () => {},
      auditar: async () => { throw new Error("audit down") },
    })).rejects.toThrow(/audit down/)
    expect(await e.foto()).toEqual(f0)
    // The same request with a working audit then succeeds once, with its adjustment and both audits.
    expect((await e.conciliar(pago.body.egreso.id, { tipo: "SIN_SALIDA" })).status).toBe(201)
    const f1 = await e.foto()
    expect([f1.conciliaciones - f0.conciliaciones, f1.obligaciones - f0.obligaciones, f1.auditorias - f0.auditorias, f1.movimientos - f0.movimientos]).toEqual([1, 1, 2, 0])
  })
})
