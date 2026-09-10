/// <reference types="bun-types" />
// ============================================
// DeliGO — Tests permanentes: P2-T41, Terminal Operativa de solo lectura
// para el cierre COMERCIAL de cuenta ("Cerrar cuenta")
// ============================================
// Integración real contra PostgreSQL (misma base que usa `db` en runtime —
// sin mocks de Prisma), invocando los handlers HTTP reales
// (`GET`/`POST /api/operaciones/ocupaciones/[id]/cuenta`) para probar la
// cadena completa, no solo el resolver de actor en aislamiento.
//
// Contexto (ver `src/lib/mesa-occupancy.ts`, `resolveMesaOccupancyCloseActor`
// y el POST de `ocupaciones/[id]/cuenta/route.ts`): antes de P2-T41, Terminal
// Operativa de área "salon" resolvía como actor `{ type: "salon" }` —
// indistinguible de Cuenta Operativa personal — y podía cerrar la cuenta
// comercial de una mesa igual que el personal. P2-T41 le da su propio tipo
// (`salon_terminal`) y el POST de esta ruta lo deniega explícitamente (403).
// El cierre TÉCNICO (`mesas/[id]/ocupacion`) NO cambia — se prueba acá que
// sigue funcionando para Terminal, para dejar evidencia de que
// `TERMINAL_GLOBAL_MUTATION_BAN=NO`.
//
// Cada describe crea su propio negocio/empleado/terminal en `beforeAll` y lo
// limpia en `afterAll` — nunca reutiliza fixtures entre archivos de test.

import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createSession, createOperationalSession, OPERATIONAL_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/auth"
import { TERMINAL_SESSION_COOKIE_NAME, sha256Hex, generateOpaqueToken, getTerminalSessionExpiry } from "@/lib/operaciones-terminal-auth"
import { GET as getCuentaRoute, POST as cerrarCuentaRoute } from "@/app/api/operaciones/ocupaciones/[id]/cuenta/route"
import { POST as cerrarOcupacionTecnicaRoute } from "@/app/api/operaciones/mesas/[id]/ocupacion/route"

// ---------------------------------------------------------------------------
// Helpers de fixture (reales, sin mocks) — mismo patrón que
// mesa-pedido-cancelacion.test.ts, duplicados acá a propósito porque son
// privados a ese archivo (cada test file es dueño de sus propias fixtures).
// ---------------------------------------------------------------------------

async function crearNegocio() {
  const suffix = randomUUID()
  const negocio = await db.negocio.create({
    data: {
      slug: `test-t41-${suffix}`,
      nombre: `Test P2-T41 ${suffix}`,
      usuario: `test_t41_${suffix}`,
      email: `test-t41-${suffix}@example.com`,
      password: "no-usado-en-estos-tests",
      aprobado: true,
      suspendido: false,
      salonActivo: true,
      empleadosActivos: true,
    },
  })
  return negocio.id
}

let mesaCounter = 0
async function crearMesa(negocioId: string) {
  mesaCounter += 1
  const mesa = await db.mesa.create({
    data: { negocioId, numero: 5000 + mesaCounter },
  })
  return mesa.id
}

async function crearOcupacion(negocioId: string, mesaId: string) {
  const ocupacion = await db.sesionOcupacionMesa.create({
    data: { negocioId, mesaId, estado: "activa", cerradaEn: null },
  })
  await db.mesa.update({ where: { id: mesaId }, data: { ocupacionActualId: ocupacion.id } })
  return ocupacion.id
}

async function crearCuentaOperativa() {
  const cuenta = await db.cuentaOperativa.create({
    data: { nombre: `Cuenta Test T41 ${randomUUID()}`, email: `cuenta-t41-${randomUUID()}@example.com`, activo: true, eliminado: false },
  })
  return cuenta.id
}

async function crearEmpleado(negocioId: string, cuentaOperativaId: string, areaOperativa: string) {
  const empleado = await db.empleado.create({
    data: {
      nombre: `Empleado Test T41 ${randomUUID()}`,
      codigo: randomUUID().slice(0, 8),
      negocioId,
      cuentaOperativaId,
      areaOperativa,
      activo: true,
      eliminado: false,
    },
  })
  return empleado.id
}

async function crearTerminal(negocioId: string, areas: string[]) {
  const terminal = await db.terminalOperativa.create({
    data: {
      negocioId,
      nombre: `Terminal Test T41 ${randomUUID()}`,
      estado: "activo",
      areas: JSON.stringify(areas),
      scopes: JSON.stringify(areas.map((area) => `${area}.ver`)),
    },
  })
  return terminal.id
}

async function crearSesionTerminal(terminalId: string) {
  const rawToken = generateOpaqueToken()
  await db.sesionTerminalOperativa.create({
    data: {
      terminalSalonId: terminalId,
      tokenHash: sha256Hex(rawToken),
      expiresAt: getTerminalSessionExpiry(),
      revokedAt: null,
    },
  })
  return rawToken
}

const idsSesionParaLimpiar: string[] = []

async function sesionNegocio(negocioId: string) {
  const token = await createSession(negocioId, "negocio")
  idsSesionParaLimpiar.push(negocioId)
  return token
}

async function sesionOperativa(cuentaOperativaId: string) {
  const token = await createOperationalSession(cuentaOperativaId)
  idsSesionParaLimpiar.push(cuentaOperativaId)
  return token
}

function getRequest(cookies: Record<string, string>): NextRequest {
  const cookieHeader = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ")
  return new NextRequest("http://localhost/api/operaciones/ocupaciones/test/cuenta", {
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  })
}

function postCuentaRequest(cookies: Record<string, string>): NextRequest {
  const cookieHeader = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ")
  return new NextRequest("http://localhost/api/operaciones/ocupaciones/test/cuenta", {
    method: "POST",
    headers: cookieHeader ? { cookie: cookieHeader, "content-type": "application/json" } : { "content-type": "application/json" },
    body: JSON.stringify({}),
  })
}

function postOcupacionTecnicaRequest(cookies: Record<string, string>, expectedOcupacionId: string): NextRequest {
  const cookieHeader = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ")
  return new NextRequest("http://localhost/api/operaciones/mesas/test/ocupacion", {
    method: "POST",
    headers: cookieHeader ? { cookie: cookieHeader, "content-type": "application/json" } : { "content-type": "application/json" },
    body: JSON.stringify({ expectedOcupacionId }),
  })
}

async function limpiarNegocio(negocioId: string) {
  await db.pedidoEvento.deleteMany({ where: { pedido: { negocioId } } }).catch(() => {})
  await db.pedido.deleteMany({ where: { negocioId } })
  await db.sesionOcupacionMesa.deleteMany({ where: { negocioId } })
  await db.mesa.deleteMany({ where: { negocioId } })
  await db.empleado.deleteMany({ where: { negocioId } })
  await db.terminalOperativa.deleteMany({ where: { negocioId } })
  await db.negocio.delete({ where: { id: negocioId } })
}

async function limpiarSesiones() {
  if (idsSesionParaLimpiar.length > 0) {
    await db.sesion.deleteMany({ where: { userId: { in: [...idsSesionParaLimpiar] } } })
    idsSesionParaLimpiar.length = 0
  }
}

async function limpiarCuentasOperativas(ids: string[]) {
  if (ids.length > 0) {
    await db.cuentaOperativa.deleteMany({ where: { id: { in: ids } } })
  }
}

// ---------------------------------------------------------------------------

describe("P2-T41 — Terminal Operativa (Salón) es de solo lectura para el cierre comercial de cuenta", () => {
  let negocioId: string
  let negocioAjenoId: string
  let cuentaSalonId: string
  let terminalSalonId: string
  let terminalPyrId: string
  let terminalAjenaId: string

  const cuentasOperativasCreadas: string[] = []

  beforeAll(async () => {
    negocioId = await crearNegocio()
    negocioAjenoId = await crearNegocio()

    cuentaSalonId = await crearCuentaOperativa()
    cuentasOperativasCreadas.push(cuentaSalonId)
    await crearEmpleado(negocioId, cuentaSalonId, "salon")

    terminalSalonId = await crearTerminal(negocioId, ["salon"])
    terminalPyrId = await crearTerminal(negocioId, ["pyr"])
    terminalAjenaId = await crearTerminal(negocioAjenoId, ["salon"])
  })

  afterAll(async () => {
    await limpiarSesiones()
    await limpiarNegocio(negocioId)
    await limpiarNegocio(negocioAjenoId)
    await limpiarCuentasOperativas(cuentasOperativasCreadas)
  })

  test("1. Terminal Salón PUEDE ver la cuenta (GET) — el contexto de solo lectura no pierde VIEW_ACCOUNT", async () => {
    const mesaId = await crearMesa(negocioId)
    const ocupacionId = await crearOcupacion(negocioId, mesaId)
    const rawToken = await crearSesionTerminal(terminalSalonId)
    const req = getRequest({ [TERMINAL_SESSION_COOKIE_NAME]: rawToken })
    const response = await getCuentaRoute(req, { params: Promise.resolve({ id: ocupacionId }) })
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.ok).toBe(true)
    expect(body.closed).toBe(false)
  })

  test("2. Terminal Salón NO PUEDE cerrar la cuenta vía el endpoint directo (POST) — 403, la ocupación sigue activa", async () => {
    const mesaId = await crearMesa(negocioId)
    const ocupacionId = await crearOcupacion(negocioId, mesaId)
    const rawToken = await crearSesionTerminal(terminalSalonId)
    const req = postCuentaRequest({ [TERMINAL_SESSION_COOKIE_NAME]: rawToken })
    const response = await cerrarCuentaRoute(req, { params: Promise.resolve({ id: ocupacionId }) })
    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.code).toBe("MESA_CUENTA_FORBIDDEN")

    const ocupacion = await db.sesionOcupacionMesa.findUniqueOrThrow({ where: { id: ocupacionId } })
    expect(ocupacion.estado).toBe("activa")
  })

  test("3. BOLA/IDOR: Terminal Salón de OTRO negocio no puede cerrar la cuenta de este negocio (denegado, la ocupación sigue activa)", async () => {
    const mesaId = await crearMesa(negocioId)
    const ocupacionId = await crearOcupacion(negocioId, mesaId)
    const rawToken = await crearSesionTerminal(terminalAjenaId)
    const req = postCuentaRequest({ [TERMINAL_SESSION_COOKIE_NAME]: rawToken })
    const response = await cerrarCuentaRoute(req, { params: Promise.resolve({ id: ocupacionId }) })
    expect([401, 403]).toContain(response.status)

    const ocupacion = await db.sesionOcupacionMesa.findUniqueOrThrow({ where: { id: ocupacionId } })
    expect(ocupacion.estado).toBe("activa")
  })

  test("4. Terminal con área solo PyR nunca resuelve como actor de cierre de Salón (regresión: no gana capacidad por error)", async () => {
    const mesaId = await crearMesa(negocioId)
    const ocupacionId = await crearOcupacion(negocioId, mesaId)
    const rawToken = await crearSesionTerminal(terminalPyrId)
    const req = postCuentaRequest({ [TERMINAL_SESSION_COOKIE_NAME]: rawToken })
    const response = await cerrarCuentaRoute(req, { params: Promise.resolve({ id: ocupacionId }) })
    expect(response.status).toBe(401)

    const ocupacion = await db.sesionOcupacionMesa.findUniqueOrThrow({ where: { id: ocupacionId } })
    expect(ocupacion.estado).toBe("activa")
  })

  test("5. Actor legítimo (Cuenta Operativa personal de Salón) SIGUE pudiendo cerrar la cuenta — P2-T41 no le quita capacidad a Salón personal", async () => {
    const mesaId = await crearMesa(negocioId)
    const ocupacionId = await crearOcupacion(negocioId, mesaId)
    const token = await sesionOperativa(cuentaSalonId)
    const req = postCuentaRequest({ [OPERATIONAL_SESSION_COOKIE_NAME]: token })
    const response = await cerrarCuentaRoute(req, { params: Promise.resolve({ id: ocupacionId }) })
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.ok).toBe(true)
    expect(body.closed).toBe(true)

    const ocupacion = await db.sesionOcupacionMesa.findUniqueOrThrow({ where: { id: ocupacionId } })
    expect(ocupacion.estado).toBe("cerrada")
    expect(ocupacion.cerradaPorTipo).toBe("salon")
  })

  test("6. Actor legítimo (Negocio dueño) SIGUE pudiendo cerrar la cuenta", async () => {
    const mesaId = await crearMesa(negocioId)
    const ocupacionId = await crearOcupacion(negocioId, mesaId)
    const token = await sesionNegocio(negocioId)
    const req = postCuentaRequest({ [SESSION_COOKIE_NAME]: token })
    const response = await cerrarCuentaRoute(req, { params: Promise.resolve({ id: ocupacionId }) })
    expect(response.status).toBe(200)

    const ocupacion = await db.sesionOcupacionMesa.findUniqueOrThrow({ where: { id: ocupacionId } })
    expect(ocupacion.estado).toBe("cerrada")
    expect(ocupacion.cerradaPorTipo).toBe("negocio")
  })

  test("7. Terminal Salón CONSERVA el cierre TÉCNICO (mesas/[id]/ocupacion) — P2-T41 no es un ban global de mutaciones de Terminal", async () => {
    const mesaId = await crearMesa(negocioId)
    const ocupacionId = await crearOcupacion(negocioId, mesaId)
    const rawToken = await crearSesionTerminal(terminalSalonId)
    const req = postOcupacionTecnicaRequest({ [TERMINAL_SESSION_COOKIE_NAME]: rawToken }, ocupacionId)
    const response = await cerrarOcupacionTecnicaRoute(req, { params: Promise.resolve({ id: mesaId }) })
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)

    const ocupacion = await db.sesionOcupacionMesa.findUniqueOrThrow({ where: { id: ocupacionId } })
    expect(ocupacion.estado).toBe("cerrada")
    expect(ocupacion.cerradaPorTipo).toBe("salon_terminal")
  })
})
