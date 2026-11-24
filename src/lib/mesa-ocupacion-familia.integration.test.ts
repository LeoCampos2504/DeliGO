/// <reference types="bun-types" />
// ============================================
// BUG-002 — ocupación de mesa con sesiones de familias distintas en el MISMO navegador (PostgreSQL efímero REAL)
// ============================================
// Reproduce lo que el handler recibe después del proxy cuando conviven 2+ cookies de familia: el proxy no copia
// ninguna a la cookie legacy `deligo_session`, así que llegan sólo las cookies de familia. Comprueba que la familia
// declarada (`?actorFamily=`) resuelve el actor correcto, sin elevar permisos, con aislamiento entre negocios y con
// 401/403/404/400 distinguibles; y que sin selector se conserva el comportamiento anterior.

import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createOperationalSession, createSession, getFamilySessionCookieName, OPERATIONAL_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/auth"
import { getTerminalSessionExpiry, sha256Hex, TERMINAL_SESSION_COOKIE_NAME } from "@/lib/operaciones-terminal-auth"
import { GET as getOcupacion, POST as postOcupacion } from "@/app/api/operaciones/mesas/[id]/ocupacion/route"

setDefaultTimeout(120_000)

const testDatabaseUrl = process.env.DELIGO_TEST_DATABASE_URL
const integracion = Boolean(testDatabaseUrl && process.env.DATABASE_URL === testDatabaseUrl && process.env.DELIGO_EPHEMERAL_TEST_DB === "1" && (process.env.DELIGO_ENVIRONMENT ?? "").toUpperCase() === "TESTING")
const ephemeralTest = integracion ? test : test.skip

afterAll(async () => {
  if (integracion) await db.$disconnect()
})

async function fixture() {
  const s = randomUUID().slice(0, 10)
  const neg = (k: string) => db.negocio.create({ data: { slug: `bug002-${k}-${s}`, nombre: `BUG002 ${k} ${s}`, usuario: `bug002-${k}-${s}`, email: `bug002-${k}-${s}@example.test`, password: "fixture", rubro: "negocio", aprobado: true, suspendido: false, empleadosActivos: true, salonActivo: true } })
  const a = await neg("a"), b = await neg("b")
  const cuenta = async (nombre: string) => db.cuentaOperativa.create({ data: { nombre, email: `bug002-${nombre.replace(/\W/g, "")}-${s}@example.test`, activo: true, eliminado: false } })
  const emp = async (negocioId: string, cuentaId: string, area: string, k: string) => db.empleado.create({ data: { nombre: `Empleado ${k}`, codigo: `${k}${s.slice(0, 6)}`.toUpperCase(), rol: area === "mozo" ? "mozo" : "cajero", areaOperativa: area, negocioId, cuentaOperativaId: cuentaId } })
  const [cCaja, cMozo, cSalon, cOtro] = await Promise.all([cuenta("Caja"), cuenta("Mozo"), cuenta("Salon"), cuenta("Otro")])
  const mozo = await emp(a.id, cMozo.id, "mozo", "M")
  await emp(a.id, cCaja.id, "caja", "K")
  await emp(a.id, cSalon.id, "salon", "S")
  await emp(b.id, cOtro.id, "salon", "O")
  const mesaAsignada = await db.mesa.create({ data: { negocioId: a.id, numero: 1, nombre: "Mesa 1", empleadoId: mozo.id } })
  const mesaLibre = await db.mesa.create({ data: { negocioId: a.id, numero: 2, nombre: "Mesa 2" } })
  const terminal = await db.terminalOperativa.create({ data: { negocioId: a.id, nombre: `bug002-terminal-${s}`, estado: "activo", perfil: "salon_completo", areas: JSON.stringify(["salon"]), scopes: JSON.stringify(["salon.ver"]) } })
  const tokenTerminal = `t-${randomUUID()}`
  await db.sesionTerminalOperativa.create({ data: { terminalSalonId: terminal.id, tokenHash: sha256Hex(tokenTerminal), expiresAt: getTerminalSessionExpiry() } })
  const familiaDueno = getFamilySessionCookieName("negocio")
  return {
    a, b, mesaAsignada, mesaLibre,
    duenoA: `${familiaDueno}=${await createSession(a.id, "negocio")}`,
    duenoALegacy: `${SESSION_COOKIE_NAME}=${await createSession(a.id, "negocio")}`,
    duenoB: `${familiaDueno}=${await createSession(b.id, "negocio")}`,
    opCaja: `${OPERATIONAL_SESSION_COOKIE_NAME}=${await createOperationalSession(cCaja.id)}`,
    opMozo: `${OPERATIONAL_SESSION_COOKIE_NAME}=${await createOperationalSession(cMozo.id)}`,
    opSalon: `${OPERATIONAL_SESSION_COOKIE_NAME}=${await createOperationalSession(cSalon.id)}`,
    opOtro: `${OPERATIONAL_SESSION_COOKIE_NAME}=${await createOperationalSession(cOtro.id)}`,
    terminal: `${TERMINAL_SESSION_COOKIE_NAME}=${tokenTerminal}`,
  }
}

const consultar = async (mesaId: string, cookies: string[], familia?: string) => {
  const url = `http://localhost/api/operaciones/mesas/${mesaId}/ocupacion${familia ? `?actorFamily=${familia}` : ""}`
  const r = await getOcupacion(new NextRequest(url, { headers: cookies.length ? { cookie: cookies.join("; ") } : {} }), { params: Promise.resolve({ id: mesaId }) })
  return r.status
}

describe("BUG-002: ocupación de mesa con sesiones simultáneas", () => {
  ephemeralTest("8/9. dueño sólo y dueño + cuenta operativa en el mismo navegador (pantalla del dueño)", async () => {
    const f = await fixture()
    expect(await consultar(f.mesaLibre.id, [f.duenoA], "negocio")).toBe(200)
    expect(await consultar(f.mesaLibre.id, [f.duenoA, f.opCaja], "negocio")).toBe(200)
    // Compatibilidad: sin selector, el dueño sigue entrando por la cookie legacy que completa el proxy.
    expect(await consultar(f.mesaLibre.id, [f.duenoALegacy], undefined)).toBe(200)
    // Antes de la corrección este era el resultado con ambas cookies: el handler no veía al dueño.
    expect(await consultar(f.mesaLibre.id, [f.duenoA, f.opCaja], undefined)).toBe(403)
  })

  ephemeralTest("10. cuenta operativa autorizada y no autorizada; la sesión del dueño nunca eleva una pantalla operativa", async () => {
    const f = await fixture()
    expect(await consultar(f.mesaLibre.id, [f.opSalon], "cuenta_operativa")).toBe(200)
    expect(await consultar(f.mesaAsignada.id, [f.opMozo], "cuenta_operativa")).toBe(200)
    expect(await consultar(f.mesaLibre.id, [f.opMozo], "cuenta_operativa")).toBe(403)
    expect(await consultar(f.mesaLibre.id, [f.opCaja], "cuenta_operativa")).toBe(403)
    // Mismo navegador con el dueño: la pantalla operativa sigue limitada a su propia credencial.
    expect(await consultar(f.mesaLibre.id, [f.duenoA, f.opMozo], "cuenta_operativa")).toBe(403)
    expect(await consultar(f.mesaLibre.id, [f.duenoA, f.opCaja], "cuenta_operativa")).toBe(403)
    // Pedir como dueño sin sesión de dueño: 401 (no hay credencial de esa familia).
    expect(await consultar(f.mesaLibre.id, [f.opSalon], "negocio")).toBe(401)
    // Terminal de Salón del negocio.
    expect(await consultar(f.mesaLibre.id, [f.terminal], "terminal")).toBe(200)
    expect(await consultar(f.mesaLibre.id, [f.duenoA], "terminal")).toBe(401)
  })

  ephemeralTest("11. otro negocio: dueño u operativo de B nunca acceden a mesas de A (404, sin revelar la mesa)", async () => {
    const f = await fixture()
    expect(await consultar(f.mesaLibre.id, [f.duenoB], "negocio")).toBe(404)
    expect(await consultar(f.mesaLibre.id, [f.opOtro], "cuenta_operativa")).toBe(404)
    expect(await consultar(f.mesaLibre.id, [f.duenoB, f.opOtro], undefined)).toBe(404)
    expect(await consultar("mesa-inexistente", [f.duenoA], "negocio")).toBe(404)
    expect(await consultar(f.mesaLibre.id, [], "negocio")).toBe(401)
    expect(await consultar(f.mesaLibre.id, [], undefined)).toBe(401)
    expect(await consultar(f.mesaLibre.id, [f.duenoA], "superadmin")).toBe(400)
  })

  ephemeralTest("POST (cierre técnico) con ambas sesiones: el dueño se reconoce; la pantalla operativa no autorizada no cierra", async () => {
    const f = await fixture()
    const cerrar = async (cookies: string[], familia: string) => (await postOcupacion(new NextRequest(`http://localhost/api/operaciones/mesas/${f.mesaLibre.id}/ocupacion?actorFamily=${familia}`, { method: "POST", headers: { cookie: cookies.join("; "), "content-type": "application/json" }, body: JSON.stringify({ expectedOcupacionId: "inexistente" }) }), { params: Promise.resolve({ id: f.mesaLibre.id }) }))
    const dueno = await cerrar([f.duenoA, f.opCaja], "negocio")
    expect(dueno.status).toBe(200)
    expect(await dueno.json()).toEqual({ success: true, status: "no_active" })
    expect((await cerrar([f.duenoA, f.opCaja], "cuenta_operativa")).status).toBe(403)
  })
})
