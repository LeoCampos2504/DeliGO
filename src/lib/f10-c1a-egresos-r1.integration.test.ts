/// <reference types="bun-types" />
// ============================================
// F10-C1a × R1 — the MANDATORY audit of a cash outflow (and of its review /
// withdrawal confirmation / threshold change) is written in the SAME
// transaction (REAL ephemeral PostgreSQL; own process: process-wide module
// mock of @/lib/audit).
// ============================================
// auditLogWithClient fails for one action, with a JavaScript error or with a
// REAL SQL error inside the transaction (1/0). A failed audit leaves NOTHING
// behind (no operation, leg, outflow, history row, notice, state change or
// audit row); the retry with the same Idempotency-Key succeeds with exactly
// ONE audit; an exact replay writes no second audit.

import { afterAll, describe, expect, mock, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createOperationalSession, createSession, OPERATIONAL_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/auth"
import * as auditReal from "@/lib/audit"
import { abrirTurnoCaja, asegurarCajaPredeterminada } from "@/lib/caja-turnos-service"
import { calcularSnapshotEfectivoTurno } from "@/lib/caja-turnos-snapshot"

setDefaultTimeout(240_000)

const testDatabaseUrl = process.env.DELIGO_TEST_DATABASE_URL
const isEphemeralIntegrationDb = process.env.DELIGO_EPHEMERAL_TEST_DB === "1"
if (!testDatabaseUrl || process.env.DATABASE_URL !== testDatabaseUrl) {
  throw new Error("Este test de integración requiere DELIGO_TEST_DATABASE_URL y DATABASE_URL apuntando a la misma base de prueba.")
}
const declaredEnvironment = process.env.DELIGO_ENVIRONMENT ?? process.env.RAILWAY_ENVIRONMENT_NAME ?? process.env.APP_ENV
if (!declaredEnvironment || declaredEnvironment.toUpperCase() !== "TESTING") {
  throw new Error("La suite F10-C1a R1 sólo puede ejecutarse con DELIGO_ENVIRONMENT=TESTING.")
}
const ephemeralTest = isEphemeralIntegrationDb ? test : test.skip

const real = { ...auditReal }
const falla: { accion: string | null; modo: "JS" | "SQL" } = { accion: null, modo: "JS" }
mock.module("@/lib/audit", () => ({
  ...real,
  auditLogWithClient: async (client: Parameters<typeof real.auditLogWithClient>[0], params: Parameters<typeof real.auditLogWithClient>[1]) => {
    if (falla.accion === params.accion) {
      if (falla.modo === "SQL") await (client as unknown as { $executeRawUnsafe: (q: string) => Promise<number> }).$executeRawUnsafe("SELECT 1/0")
      throw new Error("escritura de auditoría fallida (simulada)")
    }
    return real.auditLogWithClient(client, params)
  },
}))
const { POST: postEgresoOwner } = await import("@/app/api/negocio/caja/egresos/route")
const { POST: postRevision } = await import("@/app/api/negocio/caja/egresos/[id]/revision/route")
const { POST: postConfirmacion } = await import("@/app/api/negocio/caja/egresos/[id]/confirmacion-retiro/route")
const { PATCH: patchConfig } = await import("@/app/api/negocio/caja/configuracion-egresos/route")
const { POST: postEgresoCajero } = await import("@/app/api/operativo/caja/[slug]/egresos/route")

afterAll(async () => {
  await db.$disconnect()
})

type Res = { status: number; replayed: boolean; body: Record<string, any> }
const json = async (res: Response): Promise<Res> => ({ status: res.status, replayed: res.headers.get("Idempotency-Replayed") === "true", body: await res.json().catch(() => ({})) })
const req = (method: string, url: string, cookie: string, body: unknown, key?: string) =>
  new NextRequest(`http://localhost${url}`, { method, headers: { cookie, "content-type": "application/json", ...(key ? { "idempotency-key": key } : {}) }, body: JSON.stringify(body) })
const idCtx = (id: string) => ({ params: Promise.resolve({ id }) })

async function conFalla<T>(accion: string, modo: "JS" | "SQL", fn: () => Promise<T>): Promise<T> {
  falla.accion = accion
  falla.modo = modo
  try {
    return await fn()
  } finally {
    falla.accion = null
  }
}

async function escenario() {
  const suffix = randomUUID().slice(0, 12)
  const negocio = await db.negocio.create({
    data: { slug: `test-c1a-r1-${suffix}`, nombre: `Test C1a R1 ${suffix}`, usuario: `test-c1a-r1-${suffix}`, email: `test-c1a-r1-${suffix}@example.test`, password: "fixture", rubro: "negocio", aprobado: true, suspendido: false, empleadosActivos: true, salonActivo: true, cajaTurnosModo: "OPCIONAL" },
  })
  const n = negocio.id
  const owner = `${SESSION_COOKIE_NAME}=${await createSession(n, "negocio")}`
  const cuenta = await db.cuentaOperativa.create({ data: { nombre: "Cajera R1", email: `c1a-r1-${suffix}@example.test`, activo: true, eliminado: false } })
  const empleado = await db.empleado.create({ data: { nombre: "Cajera R1", codigo: `CR${suffix.slice(0, 6)}`.toUpperCase(), negocioId: n, cuentaOperativaId: cuenta.id, areaOperativa: "caja", activo: true, eliminado: false } })
  const cajero = `${OPERATIONAL_SESSION_COOKIE_NAME}=${await createOperationalSession(cuenta.id)}`
  const caja = await asegurarCajaPredeterminada(db, n)
  const abierto = await abrirTurnoCaja(db, { negocioId: n, actor: { tipo: "EMPLEADO", empleadoId: empleado.id }, cajaFisicaId: caja.id, fondoInicial: "10000", idempotencyKey: randomUUID() })
  if (!abierto.ok) throw new Error("fixture: turno")
  const turno = abierto.value.turno
  const foto = async () => ({
    operaciones: await db.operacionFinanciera.count({ where: { negocioId: n } }),
    movimientos: await db.movimientoFinanciero.count({ where: { negocioId: n } }),
    egresos: await db.egresoCaja.count({ where: { negocioId: n } }),
    revisiones: await db.revisionEgresoCaja.count({ where: { negocioId: n } }),
    notificaciones: await db.notificacion.count({ where: { negocioId: n } }),
    estados: (await db.egresoCaja.findMany({ where: { negocioId: n }, select: { estadoRevision: true, confirmacionRetiroEstado: true }, orderBy: { createdAt: "asc" } })).map((e) => `${e.estadoRevision}/${e.confirmacionRetiroEstado}`).join(","),
    umbral: (await db.negocio.findUniqueOrThrow({ where: { id: n }, select: { cajaEgresoAvisoUmbralDecimal: true } })).cajaEgresoAvisoUmbralDecimal?.toFixed(2) ?? null,
    esperado: (await calcularSnapshotEfectivoTurno(db, n, turno.id))!.esperado.toFixed(2),
    auditorias: await db.auditLog.count({ where: { OR: [{ userId: n }, { userId: empleado.id }] } }),
  })
  const auditoriasDe = (accion: string) => db.auditLog.count({ where: { accion, OR: [{ userId: n }, { userId: empleado.id }] } })
  const egresoCajero = async (body: unknown, key: string) =>
    json(await postEgresoCajero(req("POST", `/api/operativo/caja/${negocio.slug}/egresos`, cajero, body, key), { params: Promise.resolve({ slug: negocio.slug }) }))
  return { negocio, n, owner, cajero, empleado, turno, foto, auditoriasDe, egresoCajero }
}

const retiro = { naturaleza: "RETIRO_DUENO", importe: "1200", motivo: "Retiro", destinatarioTipo: "DUENO", destinatarioNombre: "Dueña" }

describe("F10-C1a × R1 — audit in the same transaction", () => {
  for (const modo of ["JS", "SQL"] as const) {
    ephemeralTest(`cashier outflow: a failed audit (${modo}) rolls back operation, leg, outflow and notice; same-key retry = one outflow + one audit; replay adds nothing`, async () => {
      const e = await escenario()
      const antes = await e.foto()
      const key = randomUUID()
      const fallida = await conFalla("caja.egreso_registrado", modo, () => e.egresoCajero(retiro, key))
      expect(fallida.status).toBe(500)
      expect(await e.foto()).toEqual(antes)
      const ok = await e.egresoCajero(retiro, key)
      expect(ok.status).toBe(201)
      const replay = await e.egresoCajero(retiro, key)
      expect([replay.status, replay.replayed, replay.body.egreso.id]).toEqual([200, true, ok.body.egreso.id])
      const despues = await e.foto()
      expect([despues.operaciones, despues.movimientos, despues.egresos, despues.notificaciones, despues.esperado]).toEqual([1, 1, 1, 1, "8800.00"])
      expect(await e.auditoriasDe("caja.egreso_registrado")).toBe(1)
    })
  }

  ephemeralTest("owner outflow: a failed audit (SQL) rolls back; retry = one outflow + one audit", async () => {
    const e = await escenario()
    const antes = await e.foto()
    const key = randomUUID()
    const body = { naturaleza: "PAGO_PROVEEDOR", importe: 500, motivo: "Pago al distribuidor", proveedorNombre: "Distribuidora" }
    const fallida = await conFalla("caja.egreso_registrado", "SQL", async () => json(await postEgresoOwner(req("POST", "/api/negocio/caja/egresos", e.owner, body, key))))
    expect(fallida.status).toBe(500)
    expect(await e.foto()).toEqual(antes)
    expect((await json(await postEgresoOwner(req("POST", "/api/negocio/caja/egresos", e.owner, body, key)))).status).toBe(201)
    expect(await e.auditoriasDe("caja.egreso_registrado")).toBe(1)
  })

  for (const modo of ["JS", "SQL"] as const) {
    ephemeralTest(`review and withdrawal confirmation: a failed audit (${modo}) leaves neither history nor state change; the retry applies them once`, async () => {
      const e = await escenario()
      const id = (await e.egresoCajero(retiro, randomUUID())).body.egreso.id
      const antes = await e.foto()

      const kRev = randomUUID()
      const rev = async () => json(await postRevision(req("POST", `/api/negocio/caja/egresos/${id}/revision`, e.owner, { resultado: "OBSERVADO", observacion: "Revisar" }, kRev), idCtx(id)))
      expect((await conFalla("caja.egreso_revisado", modo, rev)).status).toBe(500)
      expect(await e.foto()).toEqual(antes)
      expect((await rev()).status).toBe(201)
      expect((await rev()).replayed).toBe(true)
      expect(await e.auditoriasDe("caja.egreso_revisado")).toBe(1)

      const mid = await e.foto()
      const kConf = randomUUID()
      const conf = async () => json(await postConfirmacion(req("POST", `/api/negocio/caja/egresos/${id}/confirmacion-retiro`, e.owner, { resultado: "CONFIRMADO" }, kConf), idCtx(id)))
      expect((await conFalla("caja.egreso_retiro_confirmado", modo, conf)).status).toBe(500)
      expect(await e.foto()).toEqual(mid)
      expect((await conf()).status).toBe(201)
      expect(await e.auditoriasDe("caja.egreso_retiro_confirmado")).toBe(1)
      const fin = await e.foto()
      expect([fin.operaciones, fin.movimientos, fin.revisiones, fin.estados]).toEqual([antes.operaciones, antes.movimientos, 2, "OBSERVADO/CONFIRMADO"])
    })
  }

  ephemeralTest("threshold change: a failed audit (SQL) keeps the previous value; the retry stores it with one audit", async () => {
    const e = await escenario()
    const cambiar = async () => json(await patchConfig(req("PATCH", "/api/negocio/caja/configuracion-egresos", e.owner, { umbralAviso: "3000" })))
    expect((await conFalla("negocio.config_cambiada", "SQL", cambiar)).status).toBe(500)
    expect((await e.foto()).umbral).toBe(null)
    expect((await cambiar()).status).toBe(200)
    expect((await e.foto()).umbral).toBe("3000.00")
    expect(await e.auditoriasDe("negocio.config_cambiada")).toBe(1)
    // Same value again: nothing changes, no second audit.
    expect((await cambiar()).status).toBe(200)
    expect(await e.auditoriasDe("negocio.config_cambiada")).toBe(1)
  })
})
