/// <reference types="bun-types" />
// ============================================
// BUG-003 — superficies de la vista del cliente: aislamiento entre negocios y privacidad de empleados
// (PostgreSQL efímero REAL, rutas reales)
// ============================================
// /api/negocio/mesas-public: sólo la sesión de dueño del MISMO negocio (otro negocio → 404 sin datos) y sin datos de
// empleados. /api/empleados/by-codigo: sigue validando el código de un mozo activo del negocio, pero sin nombre ni datos
// de la cuenta operativa. nombrePublicoMostrable: el marcador nunca se muestra al cliente.

import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createOperationalSession, createSession, OPERATIONAL_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/auth"
import { NOMBRE_EMPLEADO_PENDIENTE, nombrePublicoMostrable } from "@/lib/empleado-identidad"
import { GET as getMesasPublic } from "@/app/api/negocio/mesas-public/route"
import { GET as getByCodigo } from "@/app/api/empleados/by-codigo/route"

setDefaultTimeout(120_000)

const testDatabaseUrl = process.env.DELIGO_TEST_DATABASE_URL
const integracion = Boolean(testDatabaseUrl && process.env.DATABASE_URL === testDatabaseUrl && process.env.DELIGO_EPHEMERAL_TEST_DB === "1" && (process.env.DELIGO_ENVIRONMENT ?? "").toUpperCase() === "TESTING")
const ephemeralTest = integracion ? test : test.skip

afterAll(async () => {
  if (integracion) await db.$disconnect()
})

describe("nombrePublicoMostrable (unidad)", () => {
  test("el marcador, vacíos y no-textos nunca se muestran; un texto válido sí", () => {
    expect(nombrePublicoMostrable(NOMBRE_EMPLEADO_PENDIENTE)).toBeNull()
    expect(nombrePublicoMostrable(`  ${NOMBRE_EMPLEADO_PENDIENTE} `)).toBeNull()
    expect(nombrePublicoMostrable("   ")).toBeNull()
    expect(nombrePublicoMostrable(null)).toBeNull()
    expect(nombrePublicoMostrable(undefined)).toBeNull()
    expect(nombrePublicoMostrable({ nombre: "x" })).toBeNull()
    expect(nombrePublicoMostrable(" Ana ")).toBe("Ana")
  })
})

async function fixture() {
  const s = randomUUID().slice(0, 10)
  const neg = (k: string) => db.negocio.create({ data: { slug: `bug003-${k}-${s}`, nombre: `BUG003 ${k} ${s}`, usuario: `bug003-${k}-${s}`, email: `bug003-${k}-${s}@example.test`, password: "fixture", rubro: "negocio", aprobado: true, suspendido: false, empleadosActivos: true, salonActivo: true } })
  const a = await neg("a"), b = await neg("b")
  const cuenta = await db.cuentaOperativa.create({ data: { nombre: `Persona Privada ${s}`, email: `bug003-privada-${s}@example.test`, activo: true, eliminado: false } })
  const vinculado = await db.empleado.create({ data: { nombre: NOMBRE_EMPLEADO_PENDIENTE, codigo: `V${s.slice(0, 6)}`.toUpperCase(), rol: "mozo", areaOperativa: "mozo", negocioId: a.id, cuentaOperativaId: cuenta.id } })
  const heredado = await db.empleado.create({ data: { nombre: `Nombre Heredado ${s}`, codigo: `H${s.slice(0, 6)}`.toUpperCase(), rol: "mozo", areaOperativa: "mozo", negocioId: a.id } })
  await db.mesa.create({ data: { negocioId: a.id, numero: 1, nombre: "Mesa 1", empleadoId: vinculado.id } })
  await db.mesa.create({ data: { negocioId: a.id, numero: 2, nombre: "Mesa 2", empleadoId: heredado.id } })
  await db.mesa.create({ data: { negocioId: b.id, numero: 1, nombre: "Mesa B1" } })
  const prohibidos = [NOMBRE_EMPLEADO_PENDIENTE, heredado.nombre, cuenta.nombre, cuenta.email, cuenta.id, vinculado.codigo, heredado.codigo, vinculado.id, heredado.id]
  return {
    a, b, cuenta, vinculado, heredado, prohibidos,
    duenoA: `${SESSION_COOKIE_NAME}=${await createSession(a.id, "negocio")}`,
    duenoB: `${SESSION_COOKIE_NAME}=${await createSession(b.id, "negocio")}`,
    operativa: `${OPERATIONAL_SESSION_COOKIE_NAME}=${await createOperationalSession(cuenta.id)}`,
  }
}
const mesasPublic = async (slug: string, cookie?: string) => {
  const r = await getMesasPublic(new NextRequest(`http://localhost/api/negocio/mesas-public?slug=${slug}`, { headers: cookie ? { cookie } : {} }))
  return { status: r.status, texto: await r.text() }
}
const byCodigo = async (codigo: string, negocioId: string) => {
  const r = await getByCodigo(new NextRequest(`http://localhost/api/empleados/by-codigo?codigo=${codigo}&negocioId=${negocioId}`))
  return { status: r.status, texto: await r.text() }
}

describe("BUG-003B aislamiento entre negocios — /api/negocio/mesas-public", () => {
  ephemeralTest("dueño del negocio: 200; dueño de OTRO negocio: 404 sin datos (igual que un slug inexistente); sin sesión de dueño: 401", async () => {
    const f = await fixture()
    const propio = await mesasPublic(f.a.slug, f.duenoA)
    expect(propio.status).toBe(200)
    expect(JSON.parse(propio.texto).mesas.map((m: { numero: number }) => m.numero)).toEqual([1, 2])
    const ajeno = await mesasPublic(f.a.slug, f.duenoB)
    const inexistente = await mesasPublic(`no-existe-${randomUUID().slice(0, 8)}`, f.duenoB)
    expect([ajeno.status, inexistente.status]).toEqual([404, 404])
    expect(ajeno.texto).toBe(inexistente.texto)
    expect(ajeno.texto).not.toContain("Mesa")
    expect((await mesasPublic(f.b.slug, f.duenoB)).status).toBe(200)
    expect((await mesasPublic(f.a.slug)).status).toBe(401)
    expect((await mesasPublic(f.a.slug, f.operativa)).status).toBe(401)
  })
})

describe("BUG-003A/B privacidad — sin marcador ni datos de empleados o cuentas", () => {
  ephemeralTest("mesas-public no expone códigos, nombres, ids ni datos de la cuenta; mozoAsignado siempre null", async () => {
    const f = await fixture()
    const r = await mesasPublic(f.a.slug, f.duenoA)
    for (const dato of f.prohibidos) expect(r.texto).not.toContain(dato)
    expect(JSON.parse(r.texto).mesas.map((m: { mozoAsignado: unknown }) => m.mozoAsignado)).toEqual([null, null])
  })

  ephemeralTest("by-codigo sigue validando el código del mozo del negocio, sin nombre ni datos de la cuenta; otro negocio → 404", async () => {
    const f = await fixture()
    for (const emp of [f.vinculado, f.heredado]) {
      const r = await byCodigo(emp.codigo, f.a.id)
      expect(r.status).toBe(200)
      expect(Object.keys(JSON.parse(r.texto)).sort()).toEqual(["activo", "codigo", "rol"])
      for (const dato of [NOMBRE_EMPLEADO_PENDIENTE, f.heredado.nombre, f.cuenta.nombre, f.cuenta.email, f.cuenta.id, emp.id]) expect(r.texto).not.toContain(dato)
    }
    expect((await byCodigo(f.vinculado.codigo, f.b.id)).status).toBe(404)
  })
})
