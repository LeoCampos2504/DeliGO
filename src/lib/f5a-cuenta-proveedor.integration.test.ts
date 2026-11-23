/// <reference types="bun-types" />
// ============================================
// F5-A — proveedores + motor ÚNICO de cuenta corriente, sobre PostgreSQL REAL efímero
// ============================================
// Por las rutas reales del dueño: CUIT válido/inválido/duplicado, nombres similares,
// saldo inicial y ajustes con naturaleza, pagos parciales y anticipos, pagos declarados
// (declarado / confirmado / rechazado), asignar / desafectar / reasignar, vínculo con pagos
// de Caja de F10-C1 sin tocar el egreso y su bloqueo mutuo con la compensación (ambos
// órdenes y en carrera), doble clic / replays / claves reutilizadas, auditoría en la misma
// transacción, rollback, permisos (sólo dueño), aislamiento entre negocios y proveedores,
// y las guardas SQL (append-only, FKs compuestas, CUIT, compensación bloqueada).

import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createOperationalSession, createSession, OPERATIONAL_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/auth"
import { abrirTurnoCaja, asegurarCajaPredeterminada } from "@/lib/caja-turnos-service"
import { registrarObligacion } from "@/lib/cuenta-proveedor-service"

setDefaultTimeout(300_000)

const testDatabaseUrl = process.env.DELIGO_TEST_DATABASE_URL
const isEphemeralIntegrationDb = process.env.DELIGO_EPHEMERAL_TEST_DB === "1"
if (!testDatabaseUrl || process.env.DATABASE_URL !== testDatabaseUrl) {
  throw new Error("Este test de integración requiere DELIGO_TEST_DATABASE_URL y DATABASE_URL apuntando a la misma base de prueba.")
}
const declaredEnvironment = process.env.DELIGO_ENVIRONMENT ?? process.env.RAILWAY_ENVIRONMENT_NAME ?? process.env.APP_ENV
if (!declaredEnvironment || declaredEnvironment.toUpperCase() !== "TESTING") {
  throw new Error("La suite F5-A sólo puede ejecutarse con DELIGO_ENVIRONMENT=TESTING.")
}
const ephemeralTest = isEphemeralIntegrationDb ? test : test.skip

const { GET: getProveedores, POST: postProveedor } = await import("@/app/api/negocio/proveedores/route")
const { GET: getFicha, PATCH: patchFicha } = await import("@/app/api/negocio/proveedores/[id]/route")
const { GET: getCuenta } = await import("@/app/api/negocio/proveedores/[id]/cuenta/route")
const { POST: postObligacion } = await import("@/app/api/negocio/proveedores/[id]/obligaciones/route")
const { POST: postCredito } = await import("@/app/api/negocio/proveedores/[id]/creditos/route")
const { POST: postVincular } = await import("@/app/api/negocio/proveedores/[id]/creditos/caja/route")
const { GET: getSugerencia } = await import("@/app/api/negocio/proveedores/[id]/sugerencia/route")
const { POST: postAsignaciones } = await import("@/app/api/negocio/proveedores/[id]/asignaciones/route")
const { POST: postAnularObligacion } = await import("@/app/api/negocio/proveedores/obligaciones/[obligacionId]/anulacion/route")
const { POST: postAccionCredito } = await import("@/app/api/negocio/proveedores/creditos/[creditoId]/[accion]/route")
const { GET: getSinVincular } = await import("@/app/api/negocio/proveedores/pagos-caja-sin-vincular/route")
const { POST: postEgresoOwner } = await import("@/app/api/negocio/caja/egresos/route")
const { GET: getEgresoOwner } = await import("@/app/api/negocio/caja/egresos/[id]/route")
const { POST: postCompensacion } = await import("@/app/api/negocio/caja/egresos/[id]/compensacion/route")

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
/** PrismaPromise es perezosa: la convertimos en una Promise real para `.rejects`. */
const enPromesa = <T,>(p: PromiseLike<T>): Promise<T> => Promise.resolve().then(() => p)

const CUIT_A = "20-12345678-6"
const CUIT_B = "30712345671"
const CUIT_C = "27333333339"

async function cajero(negocioId: string, suffix: string) {
  const cuenta = await db.cuentaOperativa.create({ data: { nombre: "Cajera F5", email: `cajera-f5-${suffix}@example.test`, activo: true, eliminado: false } })
  const empleado = await db.empleado.create({ data: { nombre: "Cajera F5", codigo: `F5${suffix.slice(0, 6)}`.toUpperCase(), negocioId, cuentaOperativaId: cuenta.id, areaOperativa: "caja", activo: true, eliminado: false } })
  return { empleado, cookie: `${OPERATIONAL_SESSION_COOKIE_NAME}=${await createOperationalSession(cuenta.id)}` }
}

async function escenario(opts: { rubro?: string } = {}) {
  const suffix = randomUUID().slice(0, 12)
  const negocio = await db.negocio.create({
    data: { slug: `test-f5a-${suffix}`, nombre: `Test F5A ${suffix}`, usuario: `test-f5a-${suffix}`, email: `test-f5a-${suffix}@example.test`, password: "fixture", rubro: opts.rubro ?? "negocio", aprobado: true, suspendido: false, empleadosActivos: true, salonActivo: true, cajaTurnosModo: "OPCIONAL" },
  })
  const n = negocio.id
  const owner = `${SESSION_COOKIE_NAME}=${await createSession(n, "negocio")}`
  const a = await cajero(n, suffix)
  const K = () => randomUUID()

  const crear = async (body: unknown, key: string = K(), cookie = owner) => json(await postProveedor(req("POST", "/api/negocio/proveedores", cookie, body, key)))
  const lista = async (cookie = owner) => json(await getProveedores(req("GET", "/api/negocio/proveedores?inactivos=1", cookie)))
  const ficha = async (id: string, cookie = owner) => json(await getFicha(req("GET", `/api/negocio/proveedores/${id}`, cookie), ctx({ id })))
  const editar = async (id: string, body: unknown, cookie = owner) => json(await patchFicha(req("PATCH", `/api/negocio/proveedores/${id}`, cookie, body), ctx({ id })))
  const cuenta = async (id: string, cookie = owner) => json(await getCuenta(req("GET", `/api/negocio/proveedores/${id}/cuenta`, cookie), ctx({ id })))
  const obligacion = async (id: string, body: unknown, key: string | null = K(), cookie = owner) => json(await postObligacion(req("POST", `/api/negocio/proveedores/${id}/obligaciones`, cookie, body, key ?? undefined), ctx({ id })))
  const credito = async (id: string, body: unknown, key: string = K(), cookie = owner) => json(await postCredito(req("POST", `/api/negocio/proveedores/${id}/creditos`, cookie, body, key), ctx({ id })))
  const vincular = async (id: string, egresoCajaId: string, key: string = K(), cookie = owner) => json(await postVincular(req("POST", `/api/negocio/proveedores/${id}/creditos/caja`, cookie, { egresoCajaId }, key), ctx({ id })))
  const sugerencia = async (id: string, creditoId: string, cookie = owner) => json(await getSugerencia(req("GET", `/api/negocio/proveedores/${id}/sugerencia?creditoId=${creditoId}`, cookie), ctx({ id })))
  const asignaciones = async (id: string, body: unknown, key: string = K(), cookie = owner) => json(await postAsignaciones(req("POST", `/api/negocio/proveedores/${id}/asignaciones`, cookie, body, key), ctx({ id })))
  const anularObl = async (obligacionId: string, motivo: string, key: string = K(), cookie = owner) => json(await postAnularObligacion(req("POST", `/api/negocio/proveedores/obligaciones/${obligacionId}/anulacion`, cookie, { motivo }, key), ctx({ obligacionId })))
  const accionCredito = async (creditoId: string, accion: string, motivo?: string, key: string = K(), cookie = owner) => json(await postAccionCredito(req("POST", `/api/negocio/proveedores/creditos/${creditoId}/${accion}`, cookie, { motivo }, key), ctx({ creditoId, accion })))
  const sinVincular = async (cookie = owner) => json(await getSinVincular(req("GET", "/api/negocio/proveedores/pagos-caja-sin-vincular", cookie)))
  const egresoOwner = async (body: unknown) => json(await postEgresoOwner(req("POST", "/api/negocio/caja/egresos", owner, body, K())))
  const egresoDetalle = async (id: string) => json(await getEgresoOwner(req("GET", `/api/negocio/caja/egresos/${id}`, owner), ctx({ id })))
  const compensar = async (id: string, key: string = K()) => json(await postCompensacion(req("POST", `/api/negocio/caja/egresos/${id}/compensacion`, owner, { motivo: "Registrado por error", confirmoEfectivoEnCaja: true }, key), ctx({ id })))

  let turno: { id: string; cajaFisicaId: string } | null = null
  const turnoAbierto = async () => {
    if (turno) return turno
    const caja = await asegurarCajaPredeterminada(db, n)
    const r = await abrirTurnoCaja(db, { negocioId: n, actor: { tipo: "EMPLEADO", empleadoId: a.empleado.id }, cajaFisicaId: caja.id, fondoInicial: "90000", idempotencyKey: K() })
    if (!r.ok) throw new Error(`fixture: abrir turno ${JSON.stringify(r)}`)
    turno = { id: r.value.turno.id, cajaFisicaId: caja.id }
    return turno
  }
  const pagoCaja = async (importe: string, naturaleza = "PAGO_PROVEEDOR") => {
    const t = await turnoAbierto()
    const body = naturaleza === "PAGO_PROVEEDOR"
      ? { naturaleza, importe, motivo: "Pago de mercadería", proveedorNombre: "Distribuidora Sur", cajaFisicaId: t.cajaFisicaId, turnoCajaId: t.id }
      : { naturaleza: "GASTO", categoria: "INSUMOS", importe, motivo: "Bolsas", cajaFisicaId: t.cajaFisicaId, turnoCajaId: t.id }
    const r = await egresoOwner(body)
    if (r.status !== 201) throw new Error(`fixture: egreso ${JSON.stringify(r.body)}`)
    return r.body.egreso.id as string
  }
  const nuevoProveedor = async (nombre: string, cuit?: string) => {
    const r = await crear({ nombre, cuit, confirmoNombreSimilar: true })
    if (r.status !== 201) throw new Error(`fixture: proveedor ${JSON.stringify(r.body)}`)
    return r.body.proveedor.id as string
  }
  const deuda = async (pid: string, importe: string, descripcion = "Factura A", origen = "AJUSTE_DEUDA") => {
    const r = await obligacion(pid, { origen, naturalezaAjuste: origen === "AJUSTE_DEUDA" ? "DIFERENCIA_ACORDADA" : undefined, importe, fecha: "2026-11-01", descripcion })
    if (r.status !== 201) throw new Error(`fixture: obligación ${JSON.stringify(r.body)}`)
    return r.body.obligacionId as string
  }
  const pagoConfirmado = async (pid: string, importe: string) => {
    const r = await credito(pid, { origen: "PAGO_DECLARADO", confirmoNoSalioDeCaja: true, medio: "TRANSFERENCIA", importe, fechaPago: "2026-11-02", referencia: `op-${K().slice(0, 6)}` })
    if (r.status !== 201) throw new Error(`fixture: crédito ${JSON.stringify(r.body)}`)
    const c = await accionCredito(r.body.creditoId, "confirmacion")
    if (c.status !== 201) throw new Error(`fixture: confirmar ${JSON.stringify(c.body)}`)
    return r.body.creditoId as string
  }
  const totales = async (pid: string) => (await cuenta(pid)).body.cuenta.totales as Record<string, number | boolean>
  const foto = async () => ({
    proveedores: await db.proveedor.count({ where: { negocioId: n } }),
    obligaciones: await db.obligacionProveedor.count({ where: { negocioId: n } }),
    creditos: await db.creditoProveedor.count({ where: { negocioId: n } }),
    eventos: await db.eventoCuentaProveedor.count({ where: { negocioId: n } }),
    operaciones: await db.operacionAsignacion.count({ where: { negocioId: n } }),
    asignaciones: await db.asignacionPago.count({ where: { negocioId: n } }),
    compensaciones: await db.compensacionEgresoCaja.count({ where: { negocioId: n } }),
    movimientos: await db.movimientoFinanciero.count({ where: { negocioId: n } }),
    auditorias: await db.auditLog.count({ where: { userId: n, recurso: { in: ["cuenta_proveedor", "proveedor", "egreso_caja"] } } }),
  })
  return { negocio, n, owner, a, K, crear, lista, ficha, editar, cuenta, obligacion, credito, vincular, sugerencia, asignaciones, anularObl, accionCredito, sinVincular, egresoDetalle, compensar, pagoCaja, nuevoProveedor, deuda, pagoConfirmado, totales, foto, turnoAbierto }
}

// ---------------------------------------------------------------------------

describe("F5-A — ficha de proveedor: CUIT y nombres similares", () => {
  ephemeralTest("CUIT válido se guarda normalizado; inválido 400; duplicado (aun con otro formato) 409; mismo CUIT en OTRO negocio permitido", async () => {
    const e = await escenario()
    const ok = await e.crear({ nombre: "Distribuidora Sur", cuit: CUIT_A })
    expect(ok.status).toBe(201)
    expect(ok.body.proveedor.cuit).toBe("20123456786")
    expect(ok.body.proveedor.cuitFormateado).toBe("20-12345678-6")
    for (const malo of ["20-12345678-0", "12123456786", "2012345678", "20-1234567A-6"]) {
      const r = await e.crear({ nombre: `Otro ${malo}`, cuit: malo })
      expect(r.status).toBe(400)
      expect(r.body.code).toBe("CUIT_INVALIDO")
    }
    const dup = await e.crear({ nombre: "Otra razón social", cuit: "20 12345678 6" })
    expect(dup.status).toBe(409)
    expect(dup.body.code).toBe("PROVEEDOR_CUIT_DUPLICADO")
    const otro = await escenario()
    expect((await otro.crear({ nombre: "Distribuidora Sur", cuit: CUIT_A })).status).toBe(201)
    // la base repite la regla: un CUIT inválido no entra ni saltando el servicio
    await expect(enPromesa(db.$executeRaw`UPDATE "proveedores" SET "cuit" = '20123456780' WHERE "id" = ${ok.body.proveedor.id}`)).rejects.toThrow()
    expect(await db.proveedor.count({ where: { negocioId: e.n } })).toBe(1)
  })

  ephemeralTest("dos altas simultáneas con el mismo CUIT: exactamente una", async () => {
    const e = await escenario()
    const rs = await Promise.all([1, 2, 3, 4].map((i) => e.crear({ nombre: `Proveedor carrera ${i}`, cuit: CUIT_B, confirmoNombreSimilar: true })))
    expect(rs.filter((r) => r.status === 201).length).toBe(1)
    expect(rs.filter((r) => r.status === 409 && r.body.code === "PROVEEDOR_CUIT_DUPLICADO").length).toBe(3)
    expect(await db.proveedor.count({ where: { negocioId: e.n, cuit: "30712345671" } })).toBe(1)
  })

  ephemeralTest("nombre similar advierte (no bloquea): con confirmación se crea; doble clic y replay no duplican; clave reutilizada con otros datos 409", async () => {
    const e = await escenario()
    expect((await e.crear({ nombre: "Lácteos del Sur S.A." })).status).toBe(201)
    const aviso = await e.crear({ nombre: "lacteos del sur sa" })
    expect(aviso.status).toBe(409)
    expect(aviso.body.code).toBe("PROVEEDOR_NOMBRE_SIMILAR")
    expect(aviso.body.detalle.coincidencias[0].nombre).toBe("Lácteos del Sur S.A.")
    const key = randomUUID()
    const rs = await Promise.all([1, 2, 3].map(() => e.crear({ nombre: "Lacteos del Sur (sucursal)", confirmoNombreSimilar: true }, key)))
    expect(rs.filter((r) => r.status === 201).length).toBe(1)
    expect(rs.filter((r) => r.status === 200 && r.replayed).length).toBe(2)
    expect(new Set(rs.map((r) => r.body.proveedor.id)).size).toBe(1)
    expect((await e.crear({ nombre: "Otro nombre", confirmoNombreSimilar: true }, key)).body.code).toBe("IDEMPOTENCY_KEY_REUSED")
    expect(await db.proveedor.count({ where: { negocioId: e.n } })).toBe(2)
    expect(await db.auditLog.count({ where: { userId: e.n, accion: "proveedor.creado" } })).toBe(2)
  })

  ephemeralTest("editar la ficha deja historial (valores anteriores) y auditoría; nunca borra", async () => {
    const e = await escenario()
    const id = await e.nuevoProveedor("Panificadora Norte")
    const r = await e.editar(id, { cuit: CUIT_C, telefono: "11 5555-0000" })
    expect(r.status).toBe(200)
    expect(r.body.campos.sort()).toEqual(["cuit", "telefono"])
    expect((await e.editar(id, { cuit: "27-33333333-0" })).body.code).toBe("CUIT_INVALIDO")
    expect((await e.editar(id, { activo: false })).status).toBe(200)
    const f = await e.ficha(id)
    expect(f.body.historial.length).toBe(2)
    expect(f.body.historial.find((h: any) => h.campos.includes("cuit")).valoresAnteriores.cuit).toBeNull()
    await expect(enPromesa(db.$executeRaw`DELETE FROM "proveedor_cambios" WHERE "proveedorId" = ${id}`)).rejects.toThrow(/append-only/)
    // inactivo: no admite movimientos nuevos
    expect((await e.obligacion(id, { origen: "SALDO_INICIAL", importe: "100", fecha: "2026-11-01", descripcion: "x" })).body.code).toBe("PROVEEDOR_INACTIVO")
  })
})

describe("F5-A — obligaciones: saldo inicial identificable y ajustes con naturaleza", () => {
  ephemeralTest("un saldo inicial vigente por proveedor; ajuste exige naturaleza; replay sin duplicar; anulación con evento", async () => {
    const e = await escenario()
    const id = await e.nuevoProveedor("Bebidas Oeste")
    const key = randomUUID()
    const body = { origen: "SALDO_INICIAL", importe: "15000.50", fecha: "2026-10-31", descripcion: "Saldo según libreta al 31/10" }
    const rs = await Promise.all([1, 2, 3].map(() => e.obligacion(id, body, key)))
    expect(rs.filter((r) => r.status === 201).length).toBe(1)
    expect(rs.filter((r) => r.replayed).length).toBe(2)
    expect((await e.obligacion(id, { ...body, descripcion: "otro" }, key)).body.code).toBe("IDEMPOTENCY_KEY_REUSED")
    expect((await e.obligacion(id, { ...body, descripcion: "Segundo saldo inicial" })).body.code).toBe("SALDO_INICIAL_EXISTENTE")
    expect((await e.obligacion(id, { origen: "AJUSTE_DEUDA", importe: "100", descripcion: "Recargo" })).body.code).toBe("NATURALEZA_AJUSTE_INVALIDA")
    expect((await e.obligacion(id, { origen: "RECEPCION", importe: "100", descripcion: "x" })).body.code).toBe("ORIGEN_INVALIDO")
    expect((await e.obligacion(id, { origen: "AJUSTE_DEUDA", naturalezaAjuste: "RECARGO", importe: "1.005", descripcion: "x" })).body.code).toBe("IMPORTE_INVALIDO")
    expect((await e.obligacion(id, { origen: "AJUSTE_DEUDA", naturalezaAjuste: "RECARGO", importe: "100", descripcion: "Recargo" }, null)).body.code).toBe("IDEMPOTENCY_KEY_REQUIRED")
    const aj = await e.obligacion(id, { origen: "AJUSTE_DEUDA", naturalezaAjuste: "RECARGO", importe: "250", descripcion: "Recargo por mora" })
    expect(aj.status).toBe(201)
    let t = await e.totales(id)
    expect(t.deudaVigente).toBe(15250.5)
    expect(t.deudaExigible).toBe(15250.5)

    const saldo = rs[0].body.obligacionId
    expect((await e.anularObl(saldo, "")).body.code).toBe("MOTIVO_REQUERIDO")
    const an = await e.anularObl(saldo, "Cargado con el importe equivocado")
    expect(an.status).toBe(201)
    expect((await e.anularObl(saldo, "otra vez")).body.code).toBe("OBLIGACION_NO_VIGENTE")
    t = await e.totales(id)
    expect(t.deudaVigente).toBe(250)
    // anulado: se puede cargar un nuevo saldo inicial
    expect((await e.obligacion(id, { ...body, importe: "15500" })).status).toBe(201)
    // inmutable en la base
    await expect(enPromesa(db.$executeRaw`UPDATE "obligaciones_proveedor" SET "importeDecimal" = 1 WHERE "id" = ${aj.body.obligacionId}`)).rejects.toThrow(/immutable/)
    await expect(enPromesa(db.$executeRaw`UPDATE "obligaciones_proveedor" SET "estado" = 'ANULADA', "anuladaEn" = now() WHERE "id" = ${aj.body.obligacionId}`)).rejects.toThrow(/requires its event/)
    await expect(enPromesa(db.$executeRaw`INSERT INTO "obligaciones_proveedor" ("id","negocioId","proveedorId","origen","importeDecimal","fecha","descripcion","recepcionId","estado","actorId","idempotencyKey","idempotencyFingerprint") VALUES (${randomUUID()}, ${e.n}, ${id}, 'AJUSTE_DEUDA', 10, now(), 'x', 'rec-1', 'VIGENTE', ${e.n}, ${randomUUID()}, 'x')`)).rejects.toThrow()
    expect(await db.auditLog.count({ where: { userId: e.n, recurso: "cuenta_proveedor", accion: "cuenta_proveedor.obligacion_registrada" } })).toBe(3)
  })
})

describe("F5-A — pagos declarados: no reducen la deuda hasta confirmarlos", () => {
  ephemeralTest("declarado → no resta ni se asigna; confirmado → resta; rechazado → nunca restó; anulación sólo sin asignaciones", async () => {
    const e = await escenario()
    const id = await e.nuevoProveedor("Carnes Centro")
    const ob = await e.deuda(id, "1000")
    const d = await e.credito(id, { origen: "PAGO_DECLARADO", confirmoNoSalioDeCaja: true, medio: "TRANSFERENCIA", importe: "600", fechaPago: "2026-11-03", referencia: "TRX-1", cuentaOrigenDeclarada: "Banco X" })
    expect(d.status).toBe(201)
    let t = await e.totales(id)
    expect(t.deudaExigible).toBe(1000)
    expect(t.pagosDeclaradosPendientes).toBe(600)
    expect(t.creditosConfirmados).toBe(0)
    const noAsigna = await e.asignaciones(id, { tipo: "ASIGNAR", asignar: [{ creditoId: d.body.creditoId, obligacionId: ob, importe: "100" }] })
    expect(noAsigna.body.code).toBe("CREDITO_NO_EFECTIVO")
    expect((await e.sugerencia(id, d.body.creditoId)).body.code).toBe("CREDITO_NO_EFECTIVO")
    // la base también lo impide (saltando el servicio)
    const op = await db.operacionAsignacion.create({ data: { negocioId: e.n, proveedorId: id, tipo: "ASIGNAR", actorId: e.n, idempotencyKey: randomUUID(), idempotencyFingerprint: "x" } })
    await expect(enPromesa(db.asignacionPago.create({ data: { negocioId: e.n, proveedorId: id, operacionId: op.id, creditoId: d.body.creditoId, obligacionId: ob, tipo: "ASIGNACION", importeDecimal: "100" } }))).rejects.toThrow(/effective/)
    await expect(enPromesa(db.$executeRaw`UPDATE "creditos_proveedor" SET "estado" = 'CONFIRMADO_DUENO', "confirmadoEn" = now() WHERE "id" = ${d.body.creditoId}`)).rejects.toThrow(/requires its event/)

    const key = randomUUID()
    const cs = await Promise.all([1, 2].map(() => e.accionCredito(d.body.creditoId, "confirmacion", undefined, key)))
    expect(cs.filter((r) => r.status === 201).length).toBe(1)
    expect(cs.filter((r) => r.replayed).length).toBe(1)
    t = await e.totales(id)
    expect(t.deudaExigible).toBe(400)
    expect(t.pagosDeclaradosPendientes).toBe(0)
    expect(t.anticiposDisponibles).toBe(600)
    expect(t.identidadOk).toBe(true)
    expect((await e.accionCredito(d.body.creditoId, "rechazo", "no llegó")).body.code).toBe("TRANSICION_NO_PERMITIDA")

    const r2 = await e.credito(id, { origen: "PAGO_DECLARADO", confirmoNoSalioDeCaja: true, medio: "MERCADO_PAGO", importe: "300" })
    expect((await e.accionCredito(r2.body.creditoId, "rechazo")).body.code).toBe("MOTIVO_REQUERIDO")
    expect((await e.accionCredito(r2.body.creditoId, "rechazo", "El proveedor no lo recibió")).status).toBe(201)
    expect((await e.accionCredito(r2.body.creditoId, "confirmacion")).body.code).toBe("TRANSICION_NO_PERMITIDA")
    t = await e.totales(id)
    expect(t.deudaExigible).toBe(400)

    // anular un confirmado: sólo sin asignaciones
    await e.asignaciones(id, { tipo: "ASIGNAR", asignar: [{ creditoId: d.body.creditoId, obligacionId: ob, importe: "600" }] })
    expect((await e.accionCredito(d.body.creditoId, "anulacion", "duplicado")).body.code).toBe("TIENE_ASIGNACIONES")
    const cr = await db.creditoProveedor.findUniqueOrThrow({ where: { id: d.body.creditoId } })
    expect(cr.estado).toBe("CONFIRMADO_DUENO")
    expect(cr.conciliacionEstado).toBeNull() // confirmación del dueño ≠ conciliación bancaria (F10-D)
    expect(await db.eventoCuentaProveedor.count({ where: { creditoId: d.body.creditoId } })).toBe(1)
  })

  ephemeralTest("ajuste a favor: exige naturaleza y motivo; resta sin mover dinero; anulación con evento", async () => {
    const e = await escenario()
    const id = await e.nuevoProveedor("Verdulería Mayorista")
    await e.deuda(id, "500")
    expect((await e.credito(id, { origen: "AJUSTE_A_FAVOR", importe: "50", motivo: "x" })).body.code).toBe("NATURALEZA_AJUSTE_INVALIDA")
    expect((await e.credito(id, { origen: "AJUSTE_A_FAVOR", naturalezaAjuste: "BONIFICACION", importe: "50" })).body.code).toBe("MOTIVO_REQUERIDO")
    const antes = await e.foto()
    const aj = await e.credito(id, { origen: "AJUSTE_A_FAVOR", naturalezaAjuste: "BONIFICACION", importe: "50", motivo: "Bonificación por volumen" })
    expect(aj.status).toBe(201)
    expect((await e.totales(id)).deudaExigible).toBe(450)
    expect((await e.foto()).movimientos).toBe(antes.movimientos)
    expect((await e.accionCredito(aj.body.creditoId, "anulacion", "Mal cargado")).status).toBe(201)
    expect((await e.totales(id)).deudaExigible).toBe(500)
  })
})

describe("F5-A — motor único: pagos parciales, anticipos, asignar / desafectar / reasignar", () => {
  ephemeralTest("parciales y anticipos con fórmulas explícitas; topes por crédito y por deuda; sugerencia FIFO editable", async () => {
    const e = await escenario()
    const id = await e.nuevoProveedor("Almacén Mayorista")
    const ob1 = await e.deuda(id, "1000", "Factura 1")
    const ob2 = await e.deuda(id, "500", "Factura 2")
    const c1 = await e.pagoConfirmado(id, "700")
    expect((await e.asignaciones(id, { tipo: "ASIGNAR", asignar: [{ creditoId: c1, obligacionId: ob1, importe: "700" }] })).status).toBe(201)
    const c2 = await e.pagoConfirmado(id, "1200")
    const sug = await e.sugerencia(id, c2)
    expect(sug.status).toBe(200)
    expect(sug.body.esSugerencia).toBe(true)
    expect(sug.body.sugerencia.renglones).toEqual([{ obligacionId: ob1, importe: 300, pendiente: 300 }, { obligacionId: ob2, importe: 500, pendiente: 500 }])
    expect(sug.body.sugerencia.quedaComoAnticipo).toBe(400)
    // la sugerencia no escribe nada
    expect(await db.asignacionPago.count({ where: { negocioId: e.n, creditoId: c2 } })).toBe(0)

    expect((await e.asignaciones(id, { tipo: "ASIGNAR", asignar: [{ creditoId: c2, obligacionId: ob1, importe: "300.01" }] })).body.code).toBe("ASIGNACION_EXCEDE_OBLIGACION")
    expect((await e.asignaciones(id, { tipo: "ASIGNAR", asignar: [{ creditoId: c1, obligacionId: ob2, importe: "0.01" }] })).body.code).toBe("ASIGNACION_EXCEDE_CREDITO")
    // el mismo crédito en dos renglones que juntos superan el disponible
    const c3 = await e.pagoConfirmado(id, "100")
    expect((await e.asignaciones(id, { tipo: "ASIGNAR", asignar: [{ creditoId: c3, obligacionId: ob1, importe: "60" }, { creditoId: c3, obligacionId: ob2, importe: "60" }] })).body.code).toBe("ASIGNACION_EXCEDE_CREDITO")
    expect(await db.asignacionPago.count({ where: { negocioId: e.n, creditoId: c3 } })).toBe(0)
    expect((await e.accionCredito(c3, "anulacion", "No corresponde")).status).toBe(201)

    expect((await e.asignaciones(id, { tipo: "ASIGNAR", asignar: [{ creditoId: c2, obligacionId: ob1, importe: "300" }, { creditoId: c2, obligacionId: ob2, importe: "500" }] })).status).toBe(201)
    const t = await e.totales(id)
    expect(t).toMatchObject({ deudaVigente: 1500, creditosConfirmados: 1900, creditosAsignados: 1500, obligacionesPendientes: 0, anticiposDisponibles: 400, pagosDeclaradosPendientes: 0, saldoNeto: -400, deudaExigible: 0, saldoAFavor: 400, identidadOk: true })
    const c = (await e.cuenta(id)).body.cuenta
    expect(c.obligaciones.map((o: any) => o.pendiente)).toEqual([0, 0])
    expect(c.creditos.find((x: any) => x.id === c2).disponible).toBe(400)
    // una deuda sin pendiente no recibe más (ni saltando el servicio)
    const op = await db.operacionAsignacion.create({ data: { negocioId: e.n, proveedorId: id, tipo: "ASIGNAR", actorId: e.n, idempotencyKey: randomUUID(), idempotencyFingerprint: "x" } })
    await expect(enPromesa(db.asignacionPago.create({ data: { negocioId: e.n, proveedorId: id, operacionId: op.id, creditoId: c2, obligacionId: ob1, tipo: "ASIGNACION", importeDecimal: "0.01" } }))).rejects.toThrow(/pending obligation/)
  })

  ephemeralTest("dos asignaciones simultáneas del mismo crédito por el total: el dinero no se descuenta dos veces", async () => {
    const e = await escenario()
    const id = await e.nuevoProveedor("Fiambres Este")
    const ob1 = await e.deuda(id, "800", "F1")
    const ob2 = await e.deuda(id, "800", "F2")
    const c = await e.pagoConfirmado(id, "800")
    for (let i = 0; i < 3; i++) {
      const rs = await Promise.all([ob1, ob2].map((ob) => e.asignaciones(id, { tipo: "ASIGNAR", asignar: [{ creditoId: c, obligacionId: ob, importe: "800" }] })))
      const oks = rs.filter((r) => r.status === 201)
      if (i === 0) expect(oks.length).toBe(1)
      else expect(oks.length).toBe(0)
      expect(rs.filter((r) => r.status === 409).length).toBe(2 - oks.length)
    }
    const t = await e.totales(id)
    expect(t.creditosAsignados).toBe(800)
    expect(t.anticiposDisponibles).toBe(0)
    expect(t.identidadOk).toBe(true)
  })

  ephemeralTest("desafectar y reasignar en una sola operación; la historia se conserva; doble clic no duplica; anulación de deuda sólo sin asignaciones", async () => {
    const e = await escenario()
    const id = await e.nuevoProveedor("Limpieza Total")
    const ob1 = await e.deuda(id, "1000", "Remito 10")
    const ob2 = await e.deuda(id, "400", "Remito 11")
    const c = await e.pagoConfirmado(id, "1000")
    await e.asignaciones(id, { tipo: "ASIGNAR", asignar: [{ creditoId: c, obligacionId: ob1, importe: "1000" }] })
    expect((await e.anularObl(ob1, "error")).body.code).toBe("TIENE_ASIGNACIONES")
    const asig = (await e.cuenta(id)).body.cuenta.asignaciones.find((a: any) => a.vigente)
    // reasignar: 400 a la otra deuda en la MISMA operación; 600 vuelven a anticipo
    const key = randomUUID()
    const body = { tipo: "REASIGNAR", desafectar: [asig.id], asignar: [{ creditoId: c, obligacionId: ob2, importe: "400" }], motivo: "Era para el remito 11" }
    const rs = await Promise.all([1, 2, 3].map(() => e.asignaciones(id, body, key)))
    expect(rs.filter((r) => r.status === 201).length).toBe(1)
    expect(rs.filter((r) => r.replayed).length).toBe(2)
    let cuenta = (await e.cuenta(id)).body.cuenta
    expect(cuenta.asignaciones.length).toBe(3) // ASIGNACION original + DESAFECTACION + nueva ASIGNACION
    expect(cuenta.asignaciones.filter((a: any) => a.vigente).map((a: any) => [a.obligacionId, a.importe])).toEqual([[ob2, 400]])
    expect(cuenta.totales).toMatchObject({ creditosAsignados: 400, anticiposDisponibles: 600, deudaExigible: 400, saldoAFavor: 0, identidadOk: true })
    // desafectar algo ya desafectado → 409; misma clave con otro contenido → 409
    expect((await e.asignaciones(id, { tipo: "DESAFECTAR", desafectar: [asig.id], motivo: "x" })).body.code).toBe("ASIGNACION_NO_VIGENTE")
    expect((await e.asignaciones(id, { ...body, motivo: "otro" }, key)).body.code).toBe("IDEMPOTENCY_KEY_REUSED")
    // tipos de operación coherentes
    expect((await e.asignaciones(id, { tipo: "REASIGNAR", desafectar: [asig.id] })).body.code).toBe("OPERACION_INVALIDA")
    expect((await e.asignaciones(id, { tipo: "ASIGNAR", asignar: [] })).body.code).toBe("OPERACION_INVALIDA")
    // ahora la deuda 1 se puede anular
    expect((await e.anularObl(ob1, "Remito duplicado")).status).toBe(201)
    cuenta = (await e.cuenta(id)).body.cuenta
    expect(cuenta.totales).toMatchObject({ deudaVigente: 400, saldoNeto: -600, deudaExigible: 0, saldoAFavor: 600, anticiposDisponibles: 600, obligacionesPendientes: 0, identidadOk: true })
    // append-only en la base
    await expect(enPromesa(db.$executeRaw`DELETE FROM "asignaciones_pago" WHERE "proveedorId" = ${id}`)).rejects.toThrow()
    await expect(enPromesa(db.$executeRaw`UPDATE "asignaciones_pago" SET "importeDecimal" = 1 WHERE "proveedorId" = ${id}`)).rejects.toThrow(/immutable/)
    await expect(enPromesa(db.$executeRaw`DELETE FROM "operaciones_asignacion" WHERE "proveedorId" = ${id}`)).rejects.toThrow(/append-only/)
    expect(await db.auditLog.count({ where: { userId: e.n, accion: "cuenta_proveedor.asignacion" } })).toBe(2)
  })
})

describe("F5-A — pagos de Caja (F10-C1): vínculo sin tocar el egreso y bloqueo mutuo con la compensación", () => {
  ephemeralTest("vincula por el importe exacto, sin modificar el egreso ni el libro; no se registra dos veces; sólo PAGO_PROVEEDOR", async () => {
    const e = await escenario()
    const p1 = await e.nuevoProveedor("Distribuidora Sur", CUIT_A)
    const p2 = await e.nuevoProveedor("Distribuidora Norte")
    await e.deuda(p1, "5000")
    const egresoId = await e.pagoCaja("1234.56")
    const gastoId = await e.pagoCaja("100", "GASTO")
    expect((await e.sinVincular()).body.pagos.map((x: any) => x.id)).toEqual([egresoId])
    const antes = await db.egresoCaja.findUniqueOrThrow({ where: { id: egresoId } })
    const movs = await db.movimientoFinanciero.count({ where: { negocioId: e.n } })
    const key = randomUUID()
    const rs = await Promise.all([1, 2, 3].map(() => e.vincular(p1, egresoId, key)))
    expect(rs.filter((r) => r.status === 201).length).toBe(1)
    expect(rs.filter((r) => r.replayed).length).toBe(2)
    expect((await e.vincular(p1, egresoId)).body.code).toBe("PAGO_YA_VINCULADO")
    const otro = await e.vincular(p2, egresoId)
    expect(otro.body.code).toBe("PAGO_YA_VINCULADO")
    expect(otro.body.error).toContain("Distribuidora Sur")
    expect((await e.vincular(p1, gastoId)).body.code).toBe("EGRESO_NO_ES_PAGO_PROVEEDOR")
    const cr = await db.creditoProveedor.findFirstOrThrow({ where: { egresoCajaId: egresoId } })
    expect([cr.origen, cr.estado, cr.importeDecimal.toFixed(2)]).toEqual(["PAGO_CAJA", "VIGENTE", "1234.56"])
    expect(await db.egresoCaja.findUniqueOrThrow({ where: { id: egresoId } })).toEqual(antes)
    expect(await db.movimientoFinanciero.count({ where: { negocioId: e.n } })).toBe(movs)
    expect((await e.totales(p1)).deudaExigible).toBe(3765.44)
    expect((await e.sinVincular()).body.pagos.length).toBe(0)
    // la base exige el importe exacto y un solo vínculo vigente
    await expect(enPromesa(db.creditoProveedor.create({ data: { negocioId: e.n, proveedorId: p2, origen: "PAGO_CAJA", importeDecimal: "1234.56", estado: "VIGENTE", egresoCajaId: egresoId, actorId: e.n, idempotencyKey: randomUUID(), idempotencyFingerprint: "x" } }))).rejects.toThrow()
    const e2 = await e.pagoCaja("10")
    await expect(enPromesa(db.creditoProveedor.create({ data: { negocioId: e.n, proveedorId: p2, origen: "PAGO_CAJA", importeDecimal: "11", estado: "VIGENTE", egresoCajaId: e2, actorId: e.n, idempotencyKey: randomUUID(), idempotencyFingerprint: "x" } }))).rejects.toThrow(/exact outflow amount/)
  })

  ephemeralTest("vinculado → la compensación se bloquea (API y base, nada escrito); desvinculado → se puede compensar; compensado → no se puede vincular", async () => {
    const e = await escenario()
    const p = await e.nuevoProveedor("Proveedor Bloqueo")
    const egresoId = await e.pagoCaja("700")
    const v = await e.vincular(p, egresoId)
    expect(v.status).toBe(201)
    const vista = (await e.egresoDetalle(egresoId)).body.egreso
    expect(vista.vinculoProveedor).toMatchObject({ proveedorId: p, proveedorNombre: "Proveedor Bloqueo" })
    expect(vista.compensacionDisponible).toBe(false)
    expect(vista.compensacionBloqueada).toBe("VINCULADO_A_PROVEEDOR")
    const antes = await e.foto()
    const bloqueada = await e.compensar(egresoId)
    expect(bloqueada.status).toBe(409)
    expect(bloqueada.body.code).toBe("PAGO_VINCULADO_A_PROVEEDOR")
    expect(await e.foto()).toEqual(antes)
    // la base también lo bloquea (insert directo de la compensación, saltando el servicio)
    const eg = await db.egresoCaja.findUniqueOrThrow({ where: { id: egresoId } })
    await expect(db.$transaction(async (tx) => {
      const op = await tx.operacionFinanciera.create({ data: { negocioId: e.n, tipo: "REVERSION", actorTipo: "NEGOCIO", actorId: e.n, turnoCajaId: eg.turnoCajaId, revierteOperacionId: eg.operacionId } })
      await tx.compensacionEgresoCaja.create({ data: { negocioId: e.n, egresoId, operacionId: op.id, momento: "TURNO_ABIERTO", turnoCajaId: eg.turnoCajaId, cajaFisicaId: eg.cajaFisicaId, importeDecimal: eg.importeDecimal, motivo: "directo", actorId: e.n, idempotencyKey: randomUUID(), idempotencyFingerprint: "x" } })
    })).rejects.toThrow(/linked to a supplier credit/)
    expect(await e.foto()).toEqual(antes)

    expect((await e.accionCredito(v.body.creditoId, "desvinculacion")).body.code).toBe("MOTIVO_REQUERIDO")
    expect((await e.accionCredito(v.body.creditoId, "desvinculacion", "Era de otro proveedor")).status).toBe(201)
    expect((await e.totales(p)).creditosConfirmados).toBe(0)
    const comp = await e.compensar(egresoId)
    expect(comp.status).toBe(201)
    expect((await e.vincular(p, egresoId)).body.code).toBe("EGRESO_COMPENSADO")
    expect((await e.sinVincular()).body.pagos.length).toBe(0)
    const credito = await db.creditoProveedor.findUniqueOrThrow({ where: { id: v.body.creditoId } })
    expect(credito.estado).toBe("DESVINCULADO")
  })

  ephemeralTest("un pago de Caja con asignaciones no se desvincula hasta desafectarlas", async () => {
    const e = await escenario()
    const p = await e.nuevoProveedor("Proveedor Asignado")
    const ob = await e.deuda(p, "700")
    const egresoId = await e.pagoCaja("700")
    const cr = (await e.vincular(p, egresoId)).body.creditoId
    await e.asignaciones(p, { tipo: "ASIGNAR", asignar: [{ creditoId: cr, obligacionId: ob, importe: "700" }] })
    expect((await e.accionCredito(cr, "desvinculacion", "error")).body.code).toBe("TIENE_ASIGNACIONES")
    await expect(db.$transaction(async (tx) => {
      await tx.eventoCuentaProveedor.create({ data: { negocioId: e.n, creditoId: cr, tipo: "DESVINCULACION", motivo: "x", actorId: e.n, idempotencyKey: randomUUID(), idempotencyFingerprint: "x", createdAt: new Date("2026-11-19T10:00:00Z") } })
      await tx.creditoProveedor.update({ where: { id: cr }, data: { estado: "DESVINCULADO", cerradoEn: new Date("2026-11-19T10:00:00Z") } })
    })).rejects.toThrow(/active assignments/)
  })

  for (const orden of ["vincular primero", "compensar primero"] as const) {
    ephemeralTest(`orden secuencial (${orden}): gana el primero y el segundo no escribe nada`, async () => {
      const e = await escenario()
      const p = await e.nuevoProveedor(`Proveedor ${orden}`)
      const egresoId = await e.pagoCaja("300")
      if (orden === "vincular primero") {
        expect((await e.vincular(p, egresoId)).status).toBe(201)
        const antes = await e.foto()
        expect((await e.compensar(egresoId)).body.code).toBe("PAGO_VINCULADO_A_PROVEEDOR")
        expect(await e.foto()).toEqual(antes)
      } else {
        expect((await e.compensar(egresoId)).status).toBe(201)
        const antes = await e.foto()
        expect((await e.vincular(p, egresoId)).body.code).toBe("EGRESO_COMPENSADO")
        expect(await e.foto()).toEqual(antes)
      }
    })
  }

  ephemeralTest("en carrera (vincular ∥ compensar, 8 rondas): nunca ambos; exactamente uno gana en cada ronda", async () => {
    const e = await escenario()
    const p = await e.nuevoProveedor("Proveedor Carrera")
    for (let i = 0; i < 8; i++) {
      const egresoId = await e.pagoCaja(`${100 + i}`)
      const [v, c] = await Promise.all(i % 2 === 0 ? [e.vincular(p, egresoId), e.compensar(egresoId)] : [e.compensar(egresoId), e.vincular(p, egresoId)].reverse())
      const vinculado = v.status === 201
      const compensado = c.status === 201
      expect(vinculado !== compensado).toBe(true)
      if (vinculado) expect(c.body.code).toBe("PAGO_VINCULADO_A_PROVEEDOR")
      else expect(v.body.code).toBe("EGRESO_COMPENSADO")
      const nCred = await db.creditoProveedor.count({ where: { egresoCajaId: egresoId, estado: "VIGENTE" } })
      const nComp = await db.compensacionEgresoCaja.count({ where: { egresoId } })
      expect(nCred + nComp).toBe(1)
    }
  })
})

describe("F5-A — revisión: pagos duplicados por carga humana", () => {
  const hoy = () => new Date().toISOString().slice(0, 10)
  const declarado = (importe: string, extra: Record<string, unknown> = {}) => ({ origen: "PAGO_DECLARADO", medio: "TRANSFERENCIA", importe, fechaPago: hoy(), confirmoNoSalioDeCaja: true, ...extra })

  ephemeralTest("un pago declarado exige declarar que no salió del efectivo de Caja; «Otro medio» exige decir cuál", async () => {
    const e = await escenario()
    const p = await e.nuevoProveedor("Proveedor Declaración")
    const antes = await e.foto()
    expect((await e.credito(p, declarado("100", { confirmoNoSalioDeCaja: undefined }))).body.code).toBe("CONFIRMACION_FUERA_DE_CAJA_REQUERIDA")
    expect((await e.credito(p, declarado("100", { confirmoNoSalioDeCaja: "true" }))).body.code).toBe("CONFIRMACION_FUERA_DE_CAJA_REQUERIDA")
    expect((await e.credito(p, declarado("100", { medio: "OTRO" }))).body.code).toBe("MEDIO_DETALLE_REQUERIDO")
    expect(await e.foto()).toEqual(antes)
    const ok = await e.credito(p, declarado("100", { medio: "OTRO", motivo: "Cheque 0012 del Banco X" }))
    expect(ok.status).toBe(201)
    const audit = await db.auditLog.findFirstOrThrow({ where: { userId: e.n, accion: "cuenta_proveedor.pago_declarado", recursoId: ok.body.creditoId } })
    expect(JSON.parse(audit.detalle)).toMatchObject({ confirmoNoSalioDeCaja: true, duplicadosAdvertidos: [] })
  })

  ephemeralTest("declarar un pago que coincide con un pago de Caja sin vincular advierte (nada escrito) y sugiere vincularlo; confirmable", async () => {
    const e = await escenario()
    const p = await e.nuevoProveedor("Proveedor Caja Duplicada")
    const egresoId = await e.pagoCaja("2500")
    const antes = await e.foto()
    const r = await e.credito(p, declarado("2500", { medio: "OTRO", motivo: "efectivo" }))
    expect(r.status).toBe(409)
    expect(r.body.code).toBe("POSIBLE_PAGO_DUPLICADO")
    expect(r.body.error).toContain("Vincular pago de Caja")
    expect(r.body.detalle.candidatos).toMatchObject([{ tipo: "PAGO_CAJA_SIN_VINCULAR", id: egresoId, importe: 2500 }])
    expect(await e.foto()).toEqual(antes)
    // lo correcto: vincular el egreso (fuente única del efectivo)
    expect((await e.vincular(p, egresoId)).status).toBe(201)
    // y si igual se intenta declarar, el pago de Caja ya vinculado sigue advirtiendo
    const otra = await e.credito(p, declarado("2500", { medio: "OTRO", motivo: "efectivo" }))
    expect(otra.body.detalle.candidatos).toMatchObject([{ tipo: "PAGO_CAJA_VINCULADO", id: egresoId }])
    // un pago distinto legítimo del mismo importe: el dueño confirma y queda registrado (advertencia auditada)
    const conf = await e.credito(p, declarado("2500", { referencia: "TRX-777", confirmoNoDuplicado: true }))
    expect(conf.status).toBe(201)
    const audit = await db.auditLog.findFirstOrThrow({ where: { userId: e.n, recursoId: conf.body.creditoId } })
    expect(JSON.parse(audit.detalle).duplicadosAdvertidos).toEqual([{ tipo: "PAGO_CAJA_VINCULADO", id: egresoId }])
    expect(await db.creditoProveedor.count({ where: { negocioId: e.n, egresoCajaId: egresoId } })).toBe(1)
  })

  ephemeralTest("vincular un pago de Caja advierte si ya hay un pago declarado del mismo proveedor e importe en fechas cercanas", async () => {
    const e = await escenario()
    const p = await e.nuevoProveedor("Proveedor Declaró Antes")
    const d = await e.credito(p, declarado("3000", { referencia: "efectivo" }))
    expect(d.status).toBe(201)
    const egresoId = await e.pagoCaja("3000")
    const antes = await e.foto()
    const v = await e.vincular(p, egresoId)
    expect(v.body.code).toBe("POSIBLE_PAGO_DUPLICADO")
    expect(v.body.detalle.candidatos).toMatchObject([{ tipo: "PAGO_DECLARADO", id: d.body.creditoId, estado: "DECLARADO" }])
    expect(await e.foto()).toEqual(antes)
    // era el mismo pago: se rechaza el declarado y el egreso queda como fuente única
    expect((await e.accionCredito(d.body.creditoId, "rechazo", "Era el pago en efectivo de Caja")).status).toBe(201)
    expect((await e.vincular(p, egresoId)).status).toBe(201)
    expect((await e.totales(p)).creditosConfirmados).toBe(3000)
  })

  ephemeralTest("no bloquea pagos legítimos: mismo importe en otra fecha no advierte; misma referencia o mismo importe y fecha sí; un pago de Caja de OTRO proveedor no cuenta", async () => {
    const e = await escenario()
    const p = await e.nuevoProveedor("Proveedor Pagos Iguales")
    const q = await e.nuevoProveedor("Otro Proveedor")
    expect((await e.credito(p, declarado("1000", { fechaPago: "2026-11-01", referencia: "TRX-AAA-1" }))).status).toBe(201)
    expect((await e.credito(p, declarado("1000", { fechaPago: "2026-11-05", referencia: "TRX-BBB-2" }))).status).toBe(201)
    const ref = await e.credito(p, declarado("700", { fechaPago: "2026-11-10", referencia: "trx aaa 1" }))
    expect(ref.body.code).toBe("POSIBLE_PAGO_DUPLICADO")
    expect(ref.body.detalle.candidatos).toMatchObject([{ tipo: "PAGO_DECLARADO", coincidencia: "REFERENCIA" }])
    const mismoDia = await e.credito(p, declarado("1000", { fechaPago: "2026-11-05", referencia: "TRX-CCC-3" }))
    expect(mismoDia.body.detalle.candidatos).toMatchObject([{ tipo: "PAGO_DECLARADO", coincidencia: "IMPORTE_Y_FECHA" }])
    // otro proveedor con su propio pago en Caja vinculado: no es duplicado de p
    const egresoQ = await e.pagoCaja("4200")
    expect((await e.vincular(q, egresoQ)).status).toBe(201)
    expect((await e.credito(p, declarado("4200"))).status).toBe(201)
    // otro negocio nunca aparece
    const x = await escenario()
    await x.pagoCaja("5100")
    expect((await e.credito(p, declarado("5100"))).status).toBe(201)
    expect(await db.creditoProveedor.count({ where: { negocioId: e.n, proveedorId: p } })).toBe(4)
  })
})

describe("F5-A — revisión: deuda exigible, saldo neto, saldo a favor y anticipos", () => {
  ephemeralTest("más créditos confirmados que deuda = saldo a favor (nunca deuda exigible negativa); anticipos sin asignar ≠ saldo a favor", async () => {
    const e = await escenario()
    const p = await e.nuevoProveedor("Proveedor Saldos")
    const ob = await e.deuda(p, "1000")
    const c1 = await e.pagoConfirmado(p, "400")
    let t = await e.totales(p)
    // anticipo sin asignar con deuda exigible: los dos a la vez
    expect(t).toMatchObject({ saldoNeto: 600, deudaExigible: 600, saldoAFavor: 0, anticiposDisponibles: 400, identidadOk: true })
    await e.pagoConfirmado(p, "1100")
    t = await e.totales(p)
    expect(t).toMatchObject({ deudaVigente: 1000, creditosConfirmados: 1500, saldoNeto: -500, deudaExigible: 0, saldoAFavor: 500, anticiposDisponibles: 1500, identidadOk: true })
    expect(t.deudaExigible).toBeGreaterThanOrEqual(0)
    // asignar no cambia ningún saldo (sólo el anticipo sin asignar)
    await e.asignaciones(p, { tipo: "ASIGNAR", asignar: [{ creditoId: c1, obligacionId: ob, importe: "400" }] })
    t = await e.totales(p)
    expect(t).toMatchObject({ saldoNeto: -500, deudaExigible: 0, saldoAFavor: 500, anticiposDisponibles: 1100, obligacionesPendientes: 600, identidadOk: true })
    // la lista usa las mismas cifras
    const fila = (await e.lista()).body.proveedores.find((x: any) => x.id === p)
    expect(fila.totales).toMatchObject({ deudaExigible: 0, saldoAFavor: 500 })
    expect(fila.totales.saldoExigible).toBeUndefined()
  })
})

describe("F5-A — auditoría, rollback, permisos y aislamiento", () => {
  ephemeralTest("auditoría en la MISMA transacción: si la auditoría falla no queda nada; los replays no auditan de nuevo", async () => {
    const e = await escenario()
    const p = await e.nuevoProveedor("Proveedor Rollback")
    const antes = await e.foto()
    await expect(registrarObligacion(db, { negocioId: e.n, proveedorId: p, body: { origen: "SALDO_INICIAL", importe: "10", fecha: "2026-11-01", descripcion: "x" }, idempotencyKey: randomUUID() }, {
      auditar: async () => { throw new Error("auditoría caída") },
    })).rejects.toThrow("auditoría caída")
    expect(await e.foto()).toEqual(antes)
    const key = randomUUID()
    await e.obligacion(p, { origen: "SALDO_INICIAL", importe: "10", fecha: "2026-11-01", descripcion: "x" }, key)
    await e.obligacion(p, { origen: "SALDO_INICIAL", importe: "10", fecha: "2026-11-01", descripcion: "x" }, key)
    const fila = await db.auditLog.findMany({ where: { userId: e.n, accion: "cuenta_proveedor.obligacion_registrada" } })
    expect(fila.length).toBe(1)
    expect(JSON.parse(fila[0].detalle)).toMatchObject({ negocioId: e.n, proveedorId: p, origen: "SALDO_INICIAL", importe: "10.00" })
  })

  ephemeralTest("nada se borra (ni el proveedor): sólo la cascada al eliminar el negocio completo", async () => {
    const e = await escenario()
    const p = await e.nuevoProveedor("Proveedor Borrado")
    const ob = await e.deuda(p, "100")
    const cr = await e.pagoConfirmado(p, "100")
    await e.asignaciones(p, { tipo: "ASIGNAR", asignar: [{ creditoId: cr, obligacionId: ob, importe: "100" }] })
    await e.editar(p, { telefono: "123" })
    for (const tabla of ["asignaciones_pago", "operaciones_asignacion", "eventos_cuenta_proveedor", "creditos_proveedor", "obligaciones_proveedor", "proveedor_cambios", "proveedores"]) {
      await expect(enPromesa(db.$executeRawUnsafe(`DELETE FROM "${tabla}" WHERE "negocioId" = $1`, e.n))).rejects.toThrow(/append-only/)
    }
    expect((await e.foto()).asignaciones).toBe(1)
    await db.negocio.delete({ where: { id: e.n } })
    expect(await db.proveedor.count({ where: { negocioId: e.n } })).toBe(0)
    expect(await db.asignacionPago.count({ where: { negocioId: e.n } })).toBe(0)
  })

  ephemeralTest("sólo el dueño: un cajero no accede a ninguna ruta; un negocio no genérico tampoco", async () => {
    const e = await escenario()
    const p = await e.nuevoProveedor("Proveedor Permisos")
    const ob = await e.deuda(p, "100")
    const cr = await e.pagoConfirmado(p, "50")
    const c = e.a.cookie
    const intentos = [
      await e.lista(c), await e.crear({ nombre: "X" }, randomUUID(), c), await e.ficha(p, c), await e.editar(p, { nombre: "Y" }, c), await e.cuenta(p, c),
      await e.obligacion(p, { origen: "SALDO_INICIAL", importe: "1", fecha: "2026-11-01", descripcion: "x" }, randomUUID(), c),
      await e.credito(p, { origen: "PAGO_DECLARADO", confirmoNoSalioDeCaja: true, medio: "OTRO", importe: "1" }, randomUUID(), c),
      await e.vincular(p, "x", randomUUID(), c), await e.sugerencia(p, cr, c),
      await e.asignaciones(p, { tipo: "ASIGNAR", asignar: [{ creditoId: cr, obligacionId: ob, importe: "1" }] }, randomUUID(), c),
      await e.anularObl(ob, "x", randomUUID(), c), await e.accionCredito(cr, "anulacion", "x", randomUUID(), c), await e.sinVincular(c),
    ]
    for (const r of intentos) expect([401, 403]).toContain(r.status)
    const resto = await escenario({ rubro: "restaurante" })
    expect((await resto.lista()).status).toBe(403)
    expect((await resto.crear({ nombre: "X" })).status).toBe(403)
  })

  ephemeralTest("aislamiento: otro negocio no ve ni toca nada; no hay asignaciones entre proveedores ni negocios (API y FKs compuestas)", async () => {
    const e = await escenario()
    const x = await escenario()
    const p = await e.nuevoProveedor("Proveedor A")
    const q = await e.nuevoProveedor("Proveedor B")
    const obP = await e.deuda(p, "100")
    const obQ = await e.deuda(q, "100")
    const crP = await e.pagoConfirmado(p, "100")
    const egresoX = await x.pagoCaja("100")
    const antes = await e.foto()
    // otro negocio
    expect((await x.ficha(p)).status).toBe(404)
    expect((await x.cuenta(p)).status).toBe(404)
    expect((await x.obligacion(p, { origen: "SALDO_INICIAL", importe: "1", fecha: "2026-11-01", descripcion: "x" })).status).toBe(404)
    expect((await x.anularObl(obP, "x")).status).toBe(404)
    expect((await x.accionCredito(crP, "anulacion", "x")).status).toBe(404)
    expect((await x.asignaciones(p, { tipo: "ASIGNAR", asignar: [{ creditoId: crP, obligacionId: obP, importe: "1" }] })).status).toBe(404)
    expect((await e.vincular(p, egresoX)).status).toBe(404)
    expect((await x.lista()).body.proveedores.length).toBe(0)
    // otro proveedor del mismo negocio
    expect((await e.asignaciones(q, { tipo: "ASIGNAR", asignar: [{ creditoId: crP, obligacionId: obQ, importe: "1" }] })).body.code).toBe("RENGLON_DE_OTRO_PROVEEDOR")
    expect((await e.asignaciones(p, { tipo: "ASIGNAR", asignar: [{ creditoId: crP, obligacionId: obQ, importe: "1" }] })).body.code).toBe("RENGLON_DE_OTRO_PROVEEDOR")
    expect(await e.foto()).toEqual(antes)
    // la base lo hace imposible aun saltando el servicio
    const op = await db.operacionAsignacion.create({ data: { negocioId: e.n, proveedorId: p, tipo: "ASIGNAR", actorId: e.n, idempotencyKey: randomUUID(), idempotencyFingerprint: "x" } })
    await expect(enPromesa(db.asignacionPago.create({ data: { negocioId: e.n, proveedorId: p, operacionId: op.id, creditoId: crP, obligacionId: obQ, tipo: "ASIGNACION", importeDecimal: "1" } }))).rejects.toThrow()
    await expect(enPromesa(db.asignacionPago.create({ data: { negocioId: x.n, proveedorId: p, operacionId: op.id, creditoId: crP, obligacionId: obP, tipo: "ASIGNACION", importeDecimal: "1" } }))).rejects.toThrow()
    await expect(enPromesa(db.creditoProveedor.create({ data: { negocioId: e.n, proveedorId: p, origen: "PAGO_CAJA", importeDecimal: "100", estado: "VIGENTE", egresoCajaId: egresoX, actorId: e.n, idempotencyKey: randomUUID(), idempotencyFingerprint: "x" } }))).rejects.toThrow()
  })
})
