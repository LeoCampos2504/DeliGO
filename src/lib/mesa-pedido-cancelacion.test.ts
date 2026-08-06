/// <reference types="bun-types" />
// ============================================
// DeliGO — Tests permanentes: cancelación de pedidos de mesa (23-A1)
// ============================================
// Integración real contra PostgreSQL (misma base que usa `db` en runtime —
// sin mocks de Prisma). Cubre la matriz de la sección 21 del prompt 23-A1:
// validación de motivo, autenticación/autorización de las 4 superficies,
// estados cancelables, ocupación/cuenta, auditoría, consistencia con P2
// (buildCuentaMesa), PyR, y concurrencia real (Promise.all).
//
// Cada `describe` crea su propio "mundo" (negocio + empleados + terminal) en
// `beforeAll` y lo limpia en `afterAll`. Cada test crea su propia mesa fresca
// (`mesaFresca`) — nunca reutiliza una mesa entre tests: existe un índice
// único parcial real ("mesaId" WHERE estado='activa', migración
// 20260804000000_add_table_occupancy_sessions) que permite como máximo UNA
// ocupación activa por mesa a la vez, así que reutilizar una mesa entre tests
// que crean su propia ocupación activa violaría esa constraint.

import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { createSession, createOperationalSession, hashSessionToken, SESSION_COOKIE_NAME, OPERATIONAL_SESSION_COOKIE_NAME } from "@/lib/auth"
import { TERMINAL_SESSION_COOKIE_NAME, sha256Hex, generateOpaqueToken, getTerminalSessionExpiry } from "@/lib/operaciones-terminal-auth"
import { buildCuentaMesa, type CuentaPedidoInput } from "@/lib/mesa-cuenta"
import { POST as cancelarPedidoRoute } from "@/app/api/operaciones/pedidos/[id]/cancelar/route"
import {
  validarMotivoCancelacionMesa,
  resolverActorCancelacionMesa,
  cancelarPedidoMesa,
  MOTIVO_CANCELACION_MIN_LEN,
  MOTIVO_CANCELACION_MAX_LEN,
  type MesaPedidoCancelActor,
} from "./mesa-pedido-cancelacion"

// ---------------------------------------------------------------------------
// Helpers de fixture (reales, sin mocks)
// ---------------------------------------------------------------------------

async function crearNegocio(overrides: Partial<{ salonActivo: boolean; empleadosActivos: boolean }> = {}) {
  const suffix = randomUUID()
  const negocio = await db.negocio.create({
    data: {
      slug: `test-23a1-${suffix}`,
      nombre: `Test 23-A1 ${suffix}`,
      usuario: `test23a1_${suffix}`,
      email: `test23a1-${suffix}@example.com`,
      password: "no-usado-en-estos-tests",
      aprobado: true,
      suspendido: false,
      salonActivo: overrides.salonActivo ?? true,
      empleadosActivos: overrides.empleadosActivos ?? true,
    },
  })
  return negocio.id
}

let mesaCounter = 0
async function crearMesa(negocioId: string, empleadoId: string | null = null) {
  mesaCounter += 1
  const mesa = await db.mesa.create({
    data: { negocioId, numero: 1000 + mesaCounter, empleadoId },
  })
  return mesa.id
}

async function crearOcupacion(negocioId: string, mesaId: string, estado: "activa" | "cerrada" | "expirada" = "activa") {
  const ocupacion = await db.sesionOcupacionMesa.create({
    data: { negocioId, mesaId, estado, cerradaEn: estado === "activa" ? null : new Date() },
  })
  return ocupacion.id
}

async function crearCuentaOperativa() {
  const cuenta = await db.cuentaOperativa.create({
    data: { nombre: `Cuenta Test ${randomUUID()}`, email: `cuenta-${randomUUID()}@example.com`, activo: true, eliminado: false },
  })
  return cuenta.id
}

async function crearEmpleado(negocioId: string, cuentaOperativaId: string | null, areaOperativa: string, activo = true) {
  const empleado = await db.empleado.create({
    data: {
      nombre: `Empleado Test ${randomUUID()}`,
      codigo: randomUUID().slice(0, 8),
      negocioId,
      cuentaOperativaId,
      areaOperativa,
      activo,
      eliminado: false,
    },
  })
  return empleado.id
}

async function crearTerminal(negocioId: string, areas: string[]) {
  const terminal = await db.terminalOperativa.create({
    data: {
      negocioId,
      nombre: `Terminal Test ${randomUUID()}`,
      estado: "activo",
      areas: JSON.stringify(areas),
      scopes: JSON.stringify(areas.map((area) => `${area}.ver`)),
    },
  })
  return terminal.id
}

async function crearSesionTerminal(terminalId: string, options: { revocada?: boolean; vencida?: boolean } = {}) {
  const rawToken = generateOpaqueToken()
  await db.sesionTerminalOperativa.create({
    data: {
      terminalSalonId: terminalId,
      tokenHash: sha256Hex(rawToken),
      expiresAt: options.vencida ? new Date(Date.now() - 1000) : getTerminalSessionExpiry(),
      revokedAt: options.revocada ? new Date() : null,
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

async function sesionCliente() {
  const clienteId = randomUUID()
  const token = randomUUID()
  await db.sesion.create({
    data: { token: hashSessionToken(token), userId: clienteId, userType: "cliente", expiresAt: new Date(Date.now() + 3600_000) },
  })
  idsSesionParaLimpiar.push(clienteId)
  return token
}

function reqConCookies(cookies: Record<string, string>): NextRequest {
  const cookieHeader = Object.entries(cookies)
    .map(([key, value]) => `${key}=${value}`)
    .join("; ")
  return new NextRequest("http://localhost/api/operaciones/pedidos/test/cancelar", {
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  })
}

async function postCancelarPedido(params: { pedidoId: string; token: string; motivo?: string }) {
  const req = new NextRequest(`http://localhost/api/operaciones/pedidos/${params.pedidoId}/cancelar`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `${SESSION_COOKIE_NAME}=${params.token}`,
    },
    body: JSON.stringify({ motivo: params.motivo ?? "Motivo de prueba" }),
  })
  const response = await cancelarPedidoRoute(req, { params: Promise.resolve({ id: params.pedidoId }) })
  return { response, body: (await response.json()) as { ok: boolean; error?: string; code?: string } }
}

let contadorPedido = 0

async function crearPedidoMesa(params: {
  negocioId: string
  mesaId: string | null
  ocupacionMesaId: string | null
  estado: string
  total?: number
}) {
  contadorPedido += 1
  const pedido = await db.pedido.create({
    data: {
      negocioId: params.negocioId,
      negocioSlug: "test",
      negocioNombre: "Test",
      clienteNombre: "Cliente Test",
      total: params.total ?? 1000,
      totalProductos: params.total ?? 1000,
      metodoEntrega: "mesa",
      mesaId: params.mesaId,
      mesaNumero: 1,
      ocupacionMesaId: params.ocupacionMesaId,
      estado: params.estado,
      idempotencyKey: `test-23a1-${randomUUID()}-${contadorPedido}`,
    },
  })
  return pedido.id
}

async function crearPedidoNoMesa(negocioId: string, metodoEntrega: "domicilio" | "retiro") {
  contadorPedido += 1
  const pedido = await db.pedido.create({
    data: {
      negocioId,
      negocioSlug: "test",
      negocioNombre: "Test",
      clienteNombre: "Cliente Test",
      total: 1000,
      totalProductos: 1000,
      metodoEntrega,
      estado: "recibido",
      idempotencyKey: `test-23a1-${metodoEntrega}-${randomUUID()}-${contadorPedido}`,
    },
  })
  return pedido.id
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

const actorNegocioAdmin = (negocioId: string): MesaPedidoCancelActor => ({
  type: "negocio_admin",
  negocioId,
  actorId: negocioId,
  nombre: "",
})

// ---------------------------------------------------------------------------
// A. Validación del motivo (sección 11 / 21-A) — pura, sin DB
// ---------------------------------------------------------------------------

describe("23-A1 — validarMotivoCancelacionMesa", () => {
  test("1. rechaza undefined", () => {
    expect(validarMotivoCancelacionMesa(undefined).ok).toBe(false)
  })
  test("2. rechaza null", () => {
    expect(validarMotivoCancelacionMesa(null).ok).toBe(false)
  })
  test("3. rechaza número", () => {
    expect(validarMotivoCancelacionMesa(12345).ok).toBe(false)
  })
  test("4. rechaza booleano", () => {
    expect(validarMotivoCancelacionMesa(true).ok).toBe(false)
  })
  test("5. rechaza objeto", () => {
    expect(validarMotivoCancelacionMesa({ motivo: "pedido duplicado" }).ok).toBe(false)
  })
  test("6. rechaza array", () => {
    expect(validarMotivoCancelacionMesa(["pedido duplicado"]).ok).toBe(false)
  })
  test("7. rechaza string vacío", () => {
    expect(validarMotivoCancelacionMesa("").ok).toBe(false)
  })
  test("8. rechaza string solo espacios", () => {
    expect(validarMotivoCancelacionMesa("      ").ok).toBe(false)
  })
  test("9. rechaza por debajo del mínimo tras trim", () => {
    expect(validarMotivoCancelacionMesa("  hola  ").ok).toBe(false) // "hola" = 4 chars < 5
  })
  test("10. acepta exactamente el mínimo", () => {
    const motivo = "a".repeat(MOTIVO_CANCELACION_MIN_LEN)
    expect(validarMotivoCancelacionMesa(motivo).ok).toBe(true)
  })
  test("11. rechaza por encima del máximo", () => {
    const motivo = "a".repeat(MOTIVO_CANCELACION_MAX_LEN + 1)
    expect(validarMotivoCancelacionMesa(motivo).ok).toBe(false)
  })
  test("12. acepta exactamente el máximo", () => {
    const motivo = "a".repeat(MOTIVO_CANCELACION_MAX_LEN)
    expect(validarMotivoCancelacionMesa(motivo).ok).toBe(true)
  })
  test("13. hace trim pero no elimina contenido válido interno", () => {
    const r = validarMotivoCancelacionMesa("  Pedido cargado a la mesa equivocada  ")
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.motivo).toBe("Pedido cargado a la mesa equivocada")
  })
  test("14. preserva formato tipo HTML/markup como texto plano (no lo elimina)", () => {
    const r = validarMotivoCancelacionMesa("Cliente canceló <b>antes</b> de servir")
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.motivo).toContain("<b>antes</b>")
  })
})

// ---------------------------------------------------------------------------
// Mundo compartido para B-K
// ---------------------------------------------------------------------------

describe("23-A1 — cancelación de pedidos de mesa (integración real)", () => {
  let negocioId: string
  let negocioAjenoId: string
  let cuentaMozo1Id: string
  let cuentaMozo2Id: string
  let cuentaSalonId: string
  let cuentaPyrId: string
  let empleadoMozo1Id: string
  let empleadoMozo2Id: string
  let terminalSalonId: string
  let terminalPyrId: string

  const cuentasOperativasCreadas: string[] = []

  beforeAll(async () => {
    negocioId = await crearNegocio()
    negocioAjenoId = await crearNegocio()

    cuentaMozo1Id = await crearCuentaOperativa()
    cuentaMozo2Id = await crearCuentaOperativa()
    cuentaSalonId = await crearCuentaOperativa()
    cuentaPyrId = await crearCuentaOperativa()
    cuentasOperativasCreadas.push(cuentaMozo1Id, cuentaMozo2Id, cuentaSalonId, cuentaPyrId)

    empleadoMozo1Id = await crearEmpleado(negocioId, cuentaMozo1Id, "mozo")
    empleadoMozo2Id = await crearEmpleado(negocioId, cuentaMozo2Id, "mozo")
    await crearEmpleado(negocioId, cuentaSalonId, "salon")
    await crearEmpleado(negocioId, cuentaPyrId, "pyr")

    terminalSalonId = await crearTerminal(negocioId, ["salon"])
    terminalPyrId = await crearTerminal(negocioId, ["pyr"])
  })

  afterAll(async () => {
    await limpiarSesiones()
    await limpiarNegocio(negocioId)
    await limpiarNegocio(negocioAjenoId)
    await limpiarCuentasOperativas(cuentasOperativasCreadas)
  })

  // -------------------------------------------------------------------------
  // B. Autenticación (sección 21-B)
  // -------------------------------------------------------------------------

  describe("B. Autenticación", () => {
    test("1. sin ninguna cookie -> 401 no_session", async () => {
      const mesaId = await crearMesa(negocioId)
      const ocupacionId = await crearOcupacion(negocioId, mesaId)
      const pedidoId = await crearPedidoMesa({ negocioId, mesaId, ocupacionMesaId: ocupacionId, estado: "recibido" })
      const req = reqConCookies({})
      const result = await resolverActorCancelacionMesa(req, pedidoId)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.status).toBe(401)
        expect(result.reason).toBe("no_session")
      }
    })

    test("2. sesión de Cliente -> 403 no_permission (nunca 401, está autenticado)", async () => {
      const mesaId = await crearMesa(negocioId)
      const ocupacionId = await crearOcupacion(negocioId, mesaId)
      const pedidoId = await crearPedidoMesa({ negocioId, mesaId, ocupacionMesaId: ocupacionId, estado: "recibido" })
      const token = await sesionCliente()
      const req = reqConCookies({ [SESSION_COOKIE_NAME]: token })
      const result = await resolverActorCancelacionMesa(req, pedidoId)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.status).toBe(403)
    })

    test("3. token operativo inválido/inexistente -> 401 no_session", async () => {
      const mesaId = await crearMesa(negocioId)
      const ocupacionId = await crearOcupacion(negocioId, mesaId)
      const pedidoId = await crearPedidoMesa({ negocioId, mesaId, ocupacionMesaId: ocupacionId, estado: "recibido" })
      const req = reqConCookies({ [OPERATIONAL_SESSION_COOKIE_NAME]: "token-inexistente" })
      const result = await resolverActorCancelacionMesa(req, pedidoId)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.status).toBe(401)
    })

    test("4. terminal de otra área (solo pyr) -> 403 no_permission", async () => {
      const mesaId = await crearMesa(negocioId)
      const ocupacionId = await crearOcupacion(negocioId, mesaId)
      const pedidoId = await crearPedidoMesa({ negocioId, mesaId, ocupacionMesaId: ocupacionId, estado: "recibido" })
      const rawToken = await crearSesionTerminal(terminalPyrId)
      const req = reqConCookies({ [TERMINAL_SESSION_COOKIE_NAME]: rawToken })
      const result = await resolverActorCancelacionMesa(req, pedidoId)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.status).toBe(403)
    })

    test("5. empleado de OTRO negocio (mismo tipo de sesión) -> 404, nunca 403 (no filtra existencia cross-negocio)", async () => {
      const mesaId = await crearMesa(negocioId)
      const ocupacionId = await crearOcupacion(negocioId, mesaId)
      const pedidoId = await crearPedidoMesa({ negocioId, mesaId, ocupacionMesaId: ocupacionId, estado: "recibido" })
      const cuentaOtro = await crearCuentaOperativa()
      cuentasOperativasCreadas.push(cuentaOtro)
      await crearEmpleado(negocioAjenoId, cuentaOtro, "salon")
      const token = await sesionOperativa(cuentaOtro)
      const req = reqConCookies({ [OPERATIONAL_SESSION_COOKIE_NAME]: token })
      const result = await resolverActorCancelacionMesa(req, pedidoId)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.status).toBe(404)
    })

    test("6. admin de OTRO negocio -> 404, nunca 403", async () => {
      const mesaId = await crearMesa(negocioId)
      const ocupacionId = await crearOcupacion(negocioId, mesaId)
      const pedidoId = await crearPedidoMesa({ negocioId, mesaId, ocupacionMesaId: ocupacionId, estado: "recibido" })
      const token = await sesionNegocio(negocioAjenoId)
      const req = reqConCookies({ [SESSION_COOKIE_NAME]: token })
      const result = await resolverActorCancelacionMesa(req, pedidoId)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.status).toBe(404)
    })
  })

  // -------------------------------------------------------------------------
  // C. Permisos — Mozo
  // -------------------------------------------------------------------------

  describe("C. Permisos — Mozo", () => {
    test("1. mozo asignado a la mesa: actor resuelve y puede cancelar", async () => {
      const mesaId = await crearMesa(negocioId, empleadoMozo1Id)
      const ocupacionId = await crearOcupacion(negocioId, mesaId)
      const pedidoId = await crearPedidoMesa({ negocioId, mesaId, ocupacionMesaId: ocupacionId, estado: "recibido" })
      const token = await sesionOperativa(cuentaMozo1Id)
      const req = reqConCookies({ [OPERATIONAL_SESSION_COOKIE_NAME]: token })
      const auth = await resolverActorCancelacionMesa(req, pedidoId)
      expect(auth.ok).toBe(true)
      if (!auth.ok) return
      expect(auth.actor.type).toBe("mozo")
      const resultado = await cancelarPedidoMesa({ pedidoId, motivo: "Pedido cargado por error", actor: auth.actor })
      expect(resultado.kind).toBe("ok")
    })

    test("2. mozo NO asignado a esa mesa: actor resuelve (mismo negocio) pero cancelarPedidoMesa devuelve forbidden", async () => {
      const mesaId = await crearMesa(negocioId, empleadoMozo1Id) // asignada a mozo1
      const ocupacionId = await crearOcupacion(negocioId, mesaId)
      const pedidoId = await crearPedidoMesa({ negocioId, mesaId, ocupacionMesaId: ocupacionId, estado: "recibido" })
      const token = await sesionOperativa(cuentaMozo2Id) // sesión de mozo2, no asignado a esta mesa
      const req = reqConCookies({ [OPERATIONAL_SESSION_COOKIE_NAME]: token })
      const auth = await resolverActorCancelacionMesa(req, pedidoId)
      expect(auth.ok).toBe(true)
      if (!auth.ok) return
      const resultado = await cancelarPedidoMesa({ pedidoId, motivo: "Intento no autorizado", actor: auth.actor })
      expect(resultado.kind).toBe("forbidden")
    })

    test("3. reasignación de mesa ANTES del CAS (entre resolver y cancelar): cancelarPedidoMesa nunca confía en la lectura anterior", async () => {
      const mesaId = await crearMesa(negocioId, empleadoMozo1Id)
      const ocupacionId = await crearOcupacion(negocioId, mesaId)
      const pedidoId = await crearPedidoMesa({ negocioId, mesaId, ocupacionMesaId: ocupacionId, estado: "recibido" })
      const token = await sesionOperativa(cuentaMozo1Id)
      const req = reqConCookies({ [OPERATIONAL_SESSION_COOKIE_NAME]: token })
      const auth = await resolverActorCancelacionMesa(req, pedidoId)
      expect(auth.ok).toBe(true)
      if (!auth.ok) return

      // Simula una reasignación real ocurrida DESPUÉS de resolver el actor y
      // ANTES de llamar a cancelarPedidoMesa (p. ej. Salón reasigna la mesa).
      await db.mesa.update({ where: { id: mesaId }, data: { empleadoId: empleadoMozo2Id } })

      const resultado = await cancelarPedidoMesa({ pedidoId, motivo: "Mesa reasignada antes del CAS", actor: auth.actor })
      expect(resultado.kind).toBe("forbidden")

      const pedido = await db.pedido.findUniqueOrThrow({ where: { id: pedidoId } })
      expect(pedido.estado).toBe("recibido") // nunca se canceló
    })

    test("4. mozo de negocio ajeno (mismo id de mesa lógicamente equivalente en otro negocio): actor no resuelve, 404", async () => {
      const mesaId = await crearMesa(negocioId, empleadoMozo1Id)
      const ocupacionId = await crearOcupacion(negocioId, mesaId)
      const pedidoId = await crearPedidoMesa({ negocioId, mesaId, ocupacionMesaId: ocupacionId, estado: "recibido" })
      const cuentaAjena = await crearCuentaOperativa()
      cuentasOperativasCreadas.push(cuentaAjena)
      await crearEmpleado(negocioAjenoId, cuentaAjena, "mozo")
      const token = await sesionOperativa(cuentaAjena)
      const req = reqConCookies({ [OPERATIONAL_SESSION_COOKIE_NAME]: token })
      const auth = await resolverActorCancelacionMesa(req, pedidoId)
      expect(auth.ok).toBe(false)
      if (!auth.ok) expect(auth.status).toBe(404)
    })

    test("5. mozo nunca puede cancelar vía Terminal Operativa (área 'mozo' no existe en terminales)", async () => {
      const mesaId = await crearMesa(negocioId, empleadoMozo1Id)
      const ocupacionId = await crearOcupacion(negocioId, mesaId)
      const pedidoId = await crearPedidoMesa({ negocioId, mesaId, ocupacionMesaId: ocupacionId, estado: "recibido" })
      const rawToken = await crearSesionTerminal(terminalSalonId)
      const req = reqConCookies({ [TERMINAL_SESSION_COOKIE_NAME]: rawToken })
      const auth = await resolverActorCancelacionMesa(req, pedidoId)
      expect(auth.ok).toBe(true)
      if (auth.ok) expect(auth.actor.type).not.toBe("mozo")
    })
  })

  // -------------------------------------------------------------------------
  // D. Permisos — Salón (personal y terminal)
  // -------------------------------------------------------------------------

  describe("D. Permisos — Salón personal", () => {
    test("1. salón personal del mismo negocio puede cancelar", async () => {
      const mesaId = await crearMesa(negocioId)
      const ocupacionId = await crearOcupacion(negocioId, mesaId)
      const pedidoId = await crearPedidoMesa({ negocioId, mesaId, ocupacionMesaId: ocupacionId, estado: "preparando" })
      const token = await sesionOperativa(cuentaSalonId)
      const req = reqConCookies({ [OPERATIONAL_SESSION_COOKIE_NAME]: token })
      const auth = await resolverActorCancelacionMesa(req, pedidoId)
      expect(auth.ok).toBe(true)
      if (!auth.ok) return
      expect(auth.actor.type).toBe("salon_personal")
      const resultado = await cancelarPedidoMesa({ pedidoId, motivo: "Cargado en mesa equivocada", actor: auth.actor })
      expect(resultado.kind).toBe("ok")
    })

    test("2. empleado con área PyR (personal) nunca resuelve como actor de cancelación", async () => {
      const mesaId = await crearMesa(negocioId)
      const ocupacionId = await crearOcupacion(negocioId, mesaId)
      const pedidoId = await crearPedidoMesa({ negocioId, mesaId, ocupacionMesaId: ocupacionId, estado: "recibido" })
      const token = await sesionOperativa(cuentaPyrId)
      const req = reqConCookies({ [OPERATIONAL_SESSION_COOKIE_NAME]: token })
      const auth = await resolverActorCancelacionMesa(req, pedidoId)
      expect(auth.ok).toBe(false)
      if (!auth.ok) expect(auth.status).toBe(403)
    })

    test("3. empleado de salón de otro negocio -> 404", async () => {
      const mesaId = await crearMesa(negocioId)
      const ocupacionId = await crearOcupacion(negocioId, mesaId)
      const pedidoId = await crearPedidoMesa({ negocioId, mesaId, ocupacionMesaId: ocupacionId, estado: "recibido" })
      const cuentaAjena = await crearCuentaOperativa()
      cuentasOperativasCreadas.push(cuentaAjena)
      await crearEmpleado(negocioAjenoId, cuentaAjena, "salon")
      const token = await sesionOperativa(cuentaAjena)
      const req = reqConCookies({ [OPERATIONAL_SESSION_COOKIE_NAME]: token })
      const auth = await resolverActorCancelacionMesa(req, pedidoId)
      expect(auth.ok).toBe(false)
      if (!auth.ok) expect(auth.status).toBe(404)
    })

    test("4. empleado inactivo -> no resuelve (403, ya autenticado como cuenta operativa)", async () => {
      const cuentaInactiva = await crearCuentaOperativa()
      cuentasOperativasCreadas.push(cuentaInactiva)
      await crearEmpleado(negocioId, cuentaInactiva, "salon", false)
      const mesaId = await crearMesa(negocioId)
      const ocupacionId = await crearOcupacion(negocioId, mesaId)
      const pedidoId = await crearPedidoMesa({ negocioId, mesaId, ocupacionMesaId: ocupacionId, estado: "recibido" })
      const token = await sesionOperativa(cuentaInactiva)
      const req = reqConCookies({ [OPERATIONAL_SESSION_COOKIE_NAME]: token })
      const auth = await resolverActorCancelacionMesa(req, pedidoId)
      expect(auth.ok).toBe(false)
      if (!auth.ok) expect(auth.status).toBe(403)
    })

    test("5. cuenta operativa sin ningún empleado vinculado -> 403 (autenticada, pero sin permiso)", async () => {
      const cuentaSinEmpleado = await crearCuentaOperativa()
      cuentasOperativasCreadas.push(cuentaSinEmpleado)
      const mesaId = await crearMesa(negocioId)
      const ocupacionId = await crearOcupacion(negocioId, mesaId)
      const pedidoId = await crearPedidoMesa({ negocioId, mesaId, ocupacionMesaId: ocupacionId, estado: "recibido" })
      const token = await sesionOperativa(cuentaSinEmpleado)
      const req = reqConCookies({ [OPERATIONAL_SESSION_COOKIE_NAME]: token })
      const auth = await resolverActorCancelacionMesa(req, pedidoId)
      expect(auth.ok).toBe(false)
      if (!auth.ok) expect(auth.status).toBe(403)
    })
  })

  describe("D. Permisos — Salón terminal", () => {
    test("1. terminal con área salon del mismo negocio puede cancelar", async () => {
      const mesaId = await crearMesa(negocioId)
      const ocupacionId = await crearOcupacion(negocioId, mesaId)
      const pedidoId = await crearPedidoMesa({ negocioId, mesaId, ocupacionMesaId: ocupacionId, estado: "listo_para_retirar" })
      const rawToken = await crearSesionTerminal(terminalSalonId)
      const req = reqConCookies({ [TERMINAL_SESSION_COOKIE_NAME]: rawToken })
      const auth = await resolverActorCancelacionMesa(req, pedidoId)
      expect(auth.ok).toBe(true)
      if (!auth.ok) return
      expect(auth.actor.type).toBe("salon_terminal")
      const resultado = await cancelarPedidoMesa({ pedidoId, motivo: "Terminal cancela por error de carga", actor: auth.actor })
      expect(resultado.kind).toBe("ok")
    })

    test("2. terminal revocada -> 401", async () => {
      const mesaId = await crearMesa(negocioId)
      const ocupacionId = await crearOcupacion(negocioId, mesaId)
      const pedidoId = await crearPedidoMesa({ negocioId, mesaId, ocupacionMesaId: ocupacionId, estado: "recibido" })
      const rawToken = await crearSesionTerminal(terminalSalonId, { revocada: true })
      const req = reqConCookies({ [TERMINAL_SESSION_COOKIE_NAME]: rawToken })
      const auth = await resolverActorCancelacionMesa(req, pedidoId)
      expect(auth.ok).toBe(false)
      if (!auth.ok) expect(auth.status).toBe(401)
    })

    test("3. terminal con sesión vencida -> 401", async () => {
      const mesaId = await crearMesa(negocioId)
      const ocupacionId = await crearOcupacion(negocioId, mesaId)
      const pedidoId = await crearPedidoMesa({ negocioId, mesaId, ocupacionMesaId: ocupacionId, estado: "recibido" })
      const rawToken = await crearSesionTerminal(terminalSalonId, { vencida: true })
      const req = reqConCookies({ [TERMINAL_SESSION_COOKIE_NAME]: rawToken })
      const auth = await resolverActorCancelacionMesa(req, pedidoId)
      expect(auth.ok).toBe(false)
      if (!auth.ok) expect(auth.status).toBe(401)
    })

    test("4. terminal de OTRO negocio -> 404", async () => {
      const terminalAjena = await crearTerminal(negocioAjenoId, ["salon"])
      const mesaId = await crearMesa(negocioId)
      const ocupacionId = await crearOcupacion(negocioId, mesaId)
      const pedidoId = await crearPedidoMesa({ negocioId, mesaId, ocupacionMesaId: ocupacionId, estado: "recibido" })
      const rawToken = await crearSesionTerminal(terminalAjena)
      const req = reqConCookies({ [TERMINAL_SESSION_COOKIE_NAME]: rawToken })
      const auth = await resolverActorCancelacionMesa(req, pedidoId)
      expect(auth.ok).toBe(false)
      if (!auth.ok) expect(auth.status).toBe(404)
    })

    test("5. terminal sin área salon (solo pyr) nunca resuelve como salon_terminal", async () => {
      const mesaId = await crearMesa(negocioId)
      const ocupacionId = await crearOcupacion(negocioId, mesaId)
      const pedidoId = await crearPedidoMesa({ negocioId, mesaId, ocupacionMesaId: ocupacionId, estado: "recibido" })
      const rawToken = await crearSesionTerminal(terminalPyrId)
      const req = reqConCookies({ [TERMINAL_SESSION_COOKIE_NAME]: rawToken })
      const auth = await resolverActorCancelacionMesa(req, pedidoId)
      expect(auth.ok).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // E. Permisos — Negocio/admin
  // -------------------------------------------------------------------------

  describe("E. Permisos — Negocio/admin", () => {
    test("1. dueño del negocio puede cancelar cualquier mesa de su negocio", async () => {
      const mesaId = await crearMesa(negocioId)
      const ocupacionId = await crearOcupacion(negocioId, mesaId)
      const pedidoId = await crearPedidoMesa({ negocioId, mesaId, ocupacionMesaId: ocupacionId, estado: "recibido" })
      const token = await sesionNegocio(negocioId)
      const req = reqConCookies({ [SESSION_COOKIE_NAME]: token })
      const auth = await resolverActorCancelacionMesa(req, pedidoId)
      expect(auth.ok).toBe(true)
      if (!auth.ok) return
      expect(auth.actor.type).toBe("negocio_admin")
      const resultado = await cancelarPedidoMesa({ pedidoId, motivo: "Cancelado por el negocio", actor: auth.actor })
      expect(resultado.kind).toBe("ok")
    })

    test("2. token de sesión de negocio inexistente -> 401", async () => {
      const mesaId = await crearMesa(negocioId)
      const ocupacionId = await crearOcupacion(negocioId, mesaId)
      const pedidoId = await crearPedidoMesa({ negocioId, mesaId, ocupacionMesaId: ocupacionId, estado: "recibido" })
      const req = reqConCookies({ [SESSION_COOKIE_NAME]: "token-de-sesion-inexistente" })
      const auth = await resolverActorCancelacionMesa(req, pedidoId)
      expect(auth.ok).toBe(false)
      if (!auth.ok) expect(auth.status).toBe(401)
    })

    test("3. negocio_admin nunca puede cancelar un pedido de otro negocio (404)", async () => {
      const token = await sesionNegocio(negocioId)
      const mesaAjena = await crearMesa(negocioAjenoId)
      const ocupacionAjena = await crearOcupacion(negocioAjenoId, mesaAjena)
      const pedidoAjeno = await crearPedidoMesa({ negocioId: negocioAjenoId, mesaId: mesaAjena, ocupacionMesaId: ocupacionAjena, estado: "recibido" })
      const req = reqConCookies({ [SESSION_COOKIE_NAME]: token })
      const auth = await resolverActorCancelacionMesa(req, pedidoAjeno)
      expect(auth.ok).toBe(false)
      if (!auth.ok) expect(auth.status).toBe(404)
    })
  })

  // -------------------------------------------------------------------------
  // F. Estados cancelables (sección 7 / 21-F)
  // -------------------------------------------------------------------------

  describe("F. Estados cancelables (deny-by-default)", () => {
    for (const estado of ["recibido", "preparando", "listo_para_retirar"] as const) {
      test(`1. "${estado}" es cancelable`, async () => {
        const mesaId = await crearMesa(negocioId)
        const ocupacionId = await crearOcupacion(negocioId, mesaId)
        const pedidoId = await crearPedidoMesa({ negocioId, mesaId, ocupacionMesaId: ocupacionId, estado })
        const resultado = await cancelarPedidoMesa({ pedidoId, motivo: "Estado cancelable", actor: actorNegocioAdmin(negocioId) })
        expect(resultado.kind).toBe("ok")
      })
    }

    test("2. 'entregado' NO es cancelable", async () => {
      const mesaId = await crearMesa(negocioId)
      const ocupacionId = await crearOcupacion(negocioId, mesaId)
      const pedidoId = await crearPedidoMesa({ negocioId, mesaId, ocupacionMesaId: ocupacionId, estado: "entregado" })
      const resultado = await cancelarPedidoMesa({ pedidoId, motivo: "Intento sobre entregado", actor: actorNegocioAdmin(negocioId) })
      expect(resultado.kind).toBe("invalid_estado")
    })

    test("3. 'cancelado' (ya cancelado) NO es cancelable — sin segundo evento, sin sobrescribir", async () => {
      const mesaId = await crearMesa(negocioId)
      const ocupacionId = await crearOcupacion(negocioId, mesaId)
      const pedidoId = await crearPedidoMesa({ negocioId, mesaId, ocupacionMesaId: ocupacionId, estado: "recibido" })
      const primero = await cancelarPedidoMesa({ pedidoId, motivo: "Motivo original", actor: actorNegocioAdmin(negocioId) })
      expect(primero.kind).toBe("ok")

      const eventosAntes = await db.pedidoEvento.count({ where: { pedidoId } })

      const segundo = await cancelarPedidoMesa({ pedidoId, motivo: "Motivo distinto del segundo intento", actor: actorNegocioAdmin(negocioId) })
      expect(segundo.kind).toBe("invalid_estado")

      const eventosDespues = await db.pedidoEvento.count({ where: { pedidoId } })
      expect(eventosDespues).toBe(eventosAntes)

      const pedido = await db.pedido.findUniqueOrThrow({ where: { id: pedidoId } })
      expect(pedido.canceladoMotivo).toBe("Motivo original")
    })

    test("4. estado real pero no elegible para mesa ('en_camino') NO es cancelable — allowlist cerrada, no `!== entregado`", async () => {
      const mesaId = await crearMesa(negocioId)
      const ocupacionId = await crearOcupacion(negocioId, mesaId)
      const pedidoId = await crearPedidoMesa({ negocioId, mesaId, ocupacionMesaId: ocupacionId, estado: "en_camino" })
      const resultado = await cancelarPedidoMesa({ pedidoId, motivo: "Estado inesperado para mesa", actor: actorNegocioAdmin(negocioId) })
      expect(resultado.kind).toBe("invalid_estado")
    })
  })

  // -------------------------------------------------------------------------
  // G. Ocupación y cuenta (sección 8 / 21-G)
  // -------------------------------------------------------------------------

  describe("G. Ocupación y cuenta", () => {
    test("1. ocupación activa permite cancelar", async () => {
      const mesaId = await crearMesa(negocioId)
      const ocupacionId = await crearOcupacion(negocioId, mesaId, "activa")
      const pedidoId = await crearPedidoMesa({ negocioId, mesaId, ocupacionMesaId: ocupacionId, estado: "recibido" })
      const resultado = await cancelarPedidoMesa({ pedidoId, motivo: "Ocupación activa", actor: actorNegocioAdmin(negocioId) })
      expect(resultado.kind).toBe("ok")
    })

    test("2. ocupación cerrada bloquea la cancelación (409 conflict genérico)", async () => {
      const mesaId = await crearMesa(negocioId)
      const ocupacionId = await crearOcupacion(negocioId, mesaId, "cerrada")
      const pedidoId = await crearPedidoMesa({ negocioId, mesaId, ocupacionMesaId: ocupacionId, estado: "recibido" })
      const resultado = await cancelarPedidoMesa({ pedidoId, motivo: "Cuenta ya cerrada", actor: actorNegocioAdmin(negocioId) })
      expect(resultado.kind).toBe("conflict")
    })

    test("3. ocupación expirada bloquea la cancelación", async () => {
      const mesaId = await crearMesa(negocioId)
      const ocupacionId = await crearOcupacion(negocioId, mesaId, "expirada")
      const pedidoId = await crearPedidoMesa({ negocioId, mesaId, ocupacionMesaId: ocupacionId, estado: "recibido" })
      const resultado = await cancelarPedidoMesa({ pedidoId, motivo: "Ocupación expirada", actor: actorNegocioAdmin(negocioId) })
      expect(resultado.kind).toBe("conflict")
    })

    test("4. pedido de una ocupación ANTERIOR de la misma mesa, aunque haya una ocupación activa nueva, no se cancela", async () => {
      const mesaId = await crearMesa(negocioId)
      const ocupacionVieja = await crearOcupacion(negocioId, mesaId, "cerrada")
      const pedidoViejo = await crearPedidoMesa({ negocioId, mesaId, ocupacionMesaId: ocupacionVieja, estado: "recibido" })
      // Nueva ocupación activa sobre la MISMA mesa (rotación real) — la vieja
      // ya quedó "cerrada" antes de crear ésta, así que no viola el índice
      // único parcial (mesaId WHERE estado='activa').
      await crearOcupacion(negocioId, mesaId, "activa")

      const resultado = await cancelarPedidoMesa({ pedidoId: pedidoViejo, motivo: "No debería aplicar", actor: actorNegocioAdmin(negocioId) })
      expect(resultado.kind).toBe("conflict")
    })

    test("5. pedido legacy sin ocupacionMesaId -> sin_ocupacion, nunca se auto-vincula", async () => {
      const mesaId = await crearMesa(negocioId)
      const pedidoId = await crearPedidoMesa({ negocioId, mesaId, ocupacionMesaId: null, estado: "recibido" })
      const resultado = await cancelarPedidoMesa({ pedidoId, motivo: "Pedido legacy", actor: actorNegocioAdmin(negocioId) })
      expect(resultado.kind).toBe("sin_ocupacion")
      const pedido = await db.pedido.findUniqueOrThrow({ where: { id: pedidoId } })
      expect(pedido.ocupacionMesaId).toBeNull()
      expect(pedido.estado).toBe("recibido")
    })

    test("6. pedido de delivery (metodoEntrega distinto de mesa) -> not_found, nunca se cancela por esta vía", async () => {
      const pedidoId = await crearPedidoNoMesa(negocioId, "domicilio")
      const resultado = await cancelarPedidoMesa({ pedidoId, motivo: "No aplica a delivery", actor: actorNegocioAdmin(negocioId) })
      expect(resultado.kind).toBe("not_found")
    })

    test("7. pedido de retiro (pickup) -> not_found", async () => {
      const pedidoId = await crearPedidoNoMesa(negocioId, "retiro")
      const resultado = await cancelarPedidoMesa({ pedidoId, motivo: "No aplica a retiro", actor: actorNegocioAdmin(negocioId) })
      expect(resultado.kind).toBe("not_found")
    })

    test("8. pedido de una mesa de un negocio ajeno: cancelarPedidoMesa rechaza por negocioId (not_found)", async () => {
      const mesaAjena = await crearMesa(negocioAjenoId)
      const ocupacionAjena = await crearOcupacion(negocioAjenoId, mesaAjena)
      const pedidoAjeno = await crearPedidoMesa({ negocioId: negocioAjenoId, mesaId: mesaAjena, ocupacionMesaId: ocupacionAjena, estado: "recibido" })
      const resultado = await cancelarPedidoMesa({ pedidoId: pedidoAjeno, motivo: "Actor de otro negocio", actor: actorNegocioAdmin(negocioId) })
      expect(resultado.kind).toBe("not_found")
    })
  })

  // -------------------------------------------------------------------------
  // H. Auditoría (sección 12 / 21-H)
  // -------------------------------------------------------------------------

  describe("H. Auditoría", () => {
    test("1. cancelación exitosa crea exactamente un PedidoEvento transaccional con actor, estados, motivo y fecha únicos", async () => {
      const mesaId = await crearMesa(negocioId, empleadoMozo1Id)
      const ocupacionId = await crearOcupacion(negocioId, mesaId)
      const pedidoId = await crearPedidoMesa({ negocioId, mesaId, ocupacionMesaId: ocupacionId, estado: "preparando" })
      const actor: MesaPedidoCancelActor = { type: "mozo", negocioId, actorId: empleadoMozo1Id, nombre: "Mozo Test" }
      const resultado = await cancelarPedidoMesa({ pedidoId, motivo: "Motivo normalizado", actor })
      expect(resultado.kind).toBe("ok")
      if (resultado.kind !== "ok") return

      const [pedido, eventos] = await Promise.all([
        db.pedido.findUniqueOrThrow({ where: { id: pedidoId } }),
        db.pedidoEvento.findMany({ where: { pedidoId } }),
      ])
      expect(pedido.estado).toBe("cancelado")
      expect(pedido.canceladoPor).toBe("mozo")
      expect(pedido.canceladoMotivo).toBe("Motivo normalizado")
      expect(pedido.canceladoFecha).not.toBeNull()
      expect(eventos).toHaveLength(1)
      const evento = eventos[0]
      expect(evento.estado).toBe("cancelado")
      expect(evento.estadoAnterior).toBe("preparando")
      expect(evento.userId).toBe(empleadoMozo1Id)
      expect(evento.userType).toBe("mozo")
      expect(evento.nota).toBe("Motivo normalizado")
      expect(evento.fecha.getTime()).toBe(resultado.canceladoFecha.getTime())
      expect(evento.fecha.getTime()).toBe(pedido.canceladoFecha!.getTime())
    })

    test("2. segunda cancelación y rechazos de estado, ocupación o permiso no crean eventos", async () => {
      const mesaId = await crearMesa(negocioId, empleadoMozo1Id)
      const ocupacionId = await crearOcupacion(negocioId, mesaId)
      const pedidoId = await crearPedidoMesa({ negocioId, mesaId, ocupacionMesaId: ocupacionId, estado: "recibido" })
      const ganador = await cancelarPedidoMesa({ pedidoId, motivo: "Primera cancelación", actor: actorNegocioAdmin(negocioId) })
      expect(ganador.kind).toBe("ok")
      const segunda = await cancelarPedidoMesa({ pedidoId, motivo: "Segunda cancelación", actor: actorNegocioAdmin(negocioId) })
      expect(segunda.kind).toBe("invalid_estado")
      expect(await db.pedidoEvento.count({ where: { pedidoId } })).toBe(1)

      const mesaCerrada = await crearMesa(negocioId)
      const ocupacionCerrada = await crearOcupacion(negocioId, mesaCerrada, "cerrada")
      const pedidoCerrado = await crearPedidoMesa({ negocioId, mesaId: mesaCerrada, ocupacionMesaId: ocupacionCerrada, estado: "recibido" })
      expect((await cancelarPedidoMesa({ pedidoId: pedidoCerrado, motivo: "Ocupación cerrada", actor: actorNegocioAdmin(negocioId) })).kind).toBe("conflict")
      expect(await db.pedidoEvento.count({ where: { pedidoId: pedidoCerrado } })).toBe(0)

      const mesaAjena = await crearMesa(negocioId, empleadoMozo1Id)
      const ocupacionAjena = await crearOcupacion(negocioId, mesaAjena)
      const pedidoSinPermiso = await crearPedidoMesa({ negocioId, mesaId: mesaAjena, ocupacionMesaId: ocupacionAjena, estado: "recibido" })
      const mozoNoAsignado: MesaPedidoCancelActor = { type: "mozo", negocioId, actorId: empleadoMozo2Id, nombre: "Mozo sin mesa" }
      expect((await cancelarPedidoMesa({ pedidoId: pedidoSinPermiso, motivo: "Sin permiso", actor: mozoNoAsignado })).kind).toBe("forbidden")
      expect(await db.pedidoEvento.count({ where: { pedidoId: pedidoSinPermiso } })).toBe(0)
    })

    test("3. fallo de PedidoEvento.create revierte CAS y no persiste evento", async () => {
      const mesaId = await crearMesa(negocioId)
      const ocupacionId = await crearOcupacion(negocioId, mesaId)
      const pedidoId = await crearPedidoMesa({ negocioId, mesaId, ocupacionMesaId: ocupacionId, estado: "recibido" })
      const resultado = await cancelarPedidoMesa(
        { pedidoId, motivo: "Forzar fallo de auditoría", actor: actorNegocioAdmin(negocioId) },
        { crearPedidoEvento: async () => { throw new Error("Fallo focalizado de PedidoEvento.create") } }
      )
      expect(resultado.kind).toBe("server_error")
      const pedido = await db.pedido.findUniqueOrThrow({ where: { id: pedidoId } })
      expect(pedido.estado).toBe("recibido")
      expect(pedido.canceladoPor).toBeNull()
      expect(pedido.canceladoMotivo).toBeNull()
      expect(pedido.canceladoFecha).toBeNull()
      expect(await db.pedidoEvento.count({ where: { pedidoId } })).toBe(0)
    })

    test("4. P2034 tipado se convierte en conflict, revierte el pedido y no crea auditoría", async () => {
      const mesaId = await crearMesa(negocioId)
      const ocupacionId = await crearOcupacion(negocioId, mesaId)
      const pedidoId = await crearPedidoMesa({ negocioId, mesaId, ocupacionMesaId: ocupacionId, estado: "recibido" })
      const resultado = await cancelarPedidoMesa(
        { pedidoId, motivo: "Forzar P2034", actor: actorNegocioAdmin(negocioId) },
        {
          crearPedidoEvento: async () => {
            throw new Prisma.PrismaClientKnownRequestError("conflicto serializable de prueba", {
              code: "P2034",
              clientVersion: Prisma.prismaVersion.client,
            })
          },
        }
      )
      expect(resultado.kind).toBe("conflict")
      expect((await db.pedido.findUniqueOrThrow({ where: { id: pedidoId } })).estado).toBe("recibido")
      expect(await db.pedidoEvento.count({ where: { pedidoId } })).toBe(0)
    })

    test("5. terminal de Salón se identifica específicamente como 'salon_terminal', nunca genérico", async () => {
      const mesaId = await crearMesa(negocioId)
      const ocupacionId = await crearOcupacion(negocioId, mesaId)
      const pedidoId = await crearPedidoMesa({ negocioId, mesaId, ocupacionMesaId: ocupacionId, estado: "recibido" })
      const rawToken = await crearSesionTerminal(terminalSalonId)
      const req = reqConCookies({ [TERMINAL_SESSION_COOKIE_NAME]: rawToken })
      const auth = await resolverActorCancelacionMesa(req, pedidoId)
      expect(auth.ok).toBe(true)
      if (!auth.ok) return
      expect(auth.actor.type).toBe("salon_terminal")
      expect(auth.actor.actorId).toBe(terminalSalonId)
    })

    test("6. no se guarda ningún objeto de sesión completo — solo motivo, actorId y tipo ya normalizados", async () => {
      const mesaId = await crearMesa(negocioId)
      const ocupacionId = await crearOcupacion(negocioId, mesaId)
      const pedidoId = await crearPedidoMesa({ negocioId, mesaId, ocupacionMesaId: ocupacionId, estado: "recibido" })
      const resultado = await cancelarPedidoMesa({ pedidoId, motivo: "Sin datos de sesión", actor: actorNegocioAdmin(negocioId) })
      expect(resultado.kind).toBe("ok")
      const pedido = await db.pedido.findUniqueOrThrow({ where: { id: pedidoId } })
      // canceladoMotivo es EXACTAMENTE el motivo, nunca un volcado de sesión/cookies/token.
      expect(pedido.canceladoMotivo).toBe("Sin datos de sesión")
    })
  })

  // -------------------------------------------------------------------------
  // I. Consistencia con la cuenta comercial P2 (buildCuentaMesa) — sección 14
  // -------------------------------------------------------------------------

  describe("I. Consistencia con buildCuentaMesa (P2)", () => {
    test("1. tras cancelar, el pedido queda excluido del total pero sigue visible en la cuenta", async () => {
      const mesaId = await crearMesa(negocioId)
      const ocupacionId = await crearOcupacion(negocioId, mesaId)
      const pedidoCancelableId = await crearPedidoMesa({ negocioId, mesaId, ocupacionMesaId: ocupacionId, estado: "recibido", total: 5000 })
      const pedidoEntregadoId = await crearPedidoMesa({ negocioId, mesaId, ocupacionMesaId: ocupacionId, estado: "entregado", total: 3000 })

      const resultado = await cancelarPedidoMesa({ pedidoId: pedidoCancelableId, motivo: "Consistencia P2", actor: actorNegocioAdmin(negocioId) })
      expect(resultado.kind).toBe("ok")

      const pedidos = await db.pedido.findMany({ where: { id: { in: [pedidoCancelableId, pedidoEntregadoId] } }, include: { items: true } })
      const inputs: CuentaPedidoInput[] = pedidos.map((p) => ({
        id: p.id,
        estado: p.estado,
        fecha: p.fecha,
        total: p.total,
        items: p.items.map((i) => ({
          id: i.id,
          nombre: i.nombre,
          precio: i.precio,
          cantidad: i.cantidad,
          agregados: i.agregados,
          secciones: i.secciones,
          ingredientesQuitados: i.ingredientesQuitados,
          talle: i.talle,
          color: i.color,
        })),
      }))

      const cuenta = buildCuentaMesa(inputs)
      const lineaCancelada = cuenta.pedidos.find((p) => p.id === pedidoCancelableId)!
      expect(lineaCancelada.excluido).toBe(true)
      expect(lineaCancelada.incluido).toBe(false)
      expect(lineaCancelada.pendiente).toBe(false)
      // El total general SOLO incluye el pedido entregado (3000), nunca el cancelado (5000).
      expect(cuenta.totalGeneral).toBe(3000)
      expect(cuenta.pedidosExcluidosCount).toBe(1)
      expect(cuenta.pedidosIncluidosCount).toBe(1)
    })

    test("2. un pedido cancelado nunca bloquea el cierre de cuenta (puedeCerrar)", async () => {
      const mesaId = await crearMesa(negocioId)
      const ocupacionId = await crearOcupacion(negocioId, mesaId)
      const pedidoId = await crearPedidoMesa({ negocioId, mesaId, ocupacionMesaId: ocupacionId, estado: "recibido" })
      await cancelarPedidoMesa({ pedidoId, motivo: "No debe bloquear cierre", actor: actorNegocioAdmin(negocioId) })

      const pedido = await db.pedido.findUniqueOrThrow({ where: { id: pedidoId }, include: { items: true } })
      const cuenta = buildCuentaMesa([
        { id: pedido.id, estado: pedido.estado, fecha: pedido.fecha, total: pedido.total, items: [] },
      ])
      expect(cuenta.puedeCerrar).toBe(true)
      expect(cuenta.pedidosPendientesCount).toBe(0)
    })

    test("3. los ítems del pedido cancelado nunca se eliminan (siguen existiendo en la tabla)", async () => {
      const mesaId = await crearMesa(negocioId)
      const ocupacionId = await crearOcupacion(negocioId, mesaId)
      const pedidoId = await crearPedidoMesa({ negocioId, mesaId, ocupacionMesaId: ocupacionId, estado: "recibido" })
      await db.pedidoItem.create({ data: { pedidoId, nombre: "Producto Test", precio: 1000, cantidad: 1 } })
      await cancelarPedidoMesa({ pedidoId, motivo: "Ítems no se borran", actor: actorNegocioAdmin(negocioId) })
      const items = await db.pedidoItem.findMany({ where: { pedidoId } })
      expect(items.length).toBe(1)
    })

    test("4. el total histórico (Pedido.total) nunca se modifica al cancelar", async () => {
      const mesaId = await crearMesa(negocioId)
      const ocupacionId = await crearOcupacion(negocioId, mesaId)
      const pedidoId = await crearPedidoMesa({ negocioId, mesaId, ocupacionMesaId: ocupacionId, estado: "recibido", total: 7777 })
      await cancelarPedidoMesa({ pedidoId, motivo: "Total no cambia", actor: actorNegocioAdmin(negocioId) })
      const pedido = await db.pedido.findUniqueOrThrow({ where: { id: pedidoId } })
      expect(pedido.total).toBe(7777)
    })
  })

  // -------------------------------------------------------------------------
  // J. PyR no puede avanzar un pedido ya cancelado — sección 15 / 21-J
  // -------------------------------------------------------------------------

  describe("J. PyR / transición server-side compartida", () => {
    test("1. un pedido cancelado nunca puede 'avanzar' vía el mismo patrón CAS que usan Salón/PyR (recibido -> preparando)", async () => {
      const mesaId = await crearMesa(negocioId)
      const ocupacionId = await crearOcupacion(negocioId, mesaId)
      const pedidoId = await crearPedidoMesa({ negocioId, mesaId, ocupacionMesaId: ocupacionId, estado: "recibido" })
      const resultado = await cancelarPedidoMesa({ pedidoId, motivo: "PyR no debe avanzar esto", actor: actorNegocioAdmin(negocioId) })
      expect(resultado.kind).toBe("ok")

      // Mismo patrón CAS EXACTO que usan operativo/salon/pedidos/[id]/preparar y
      // operaciones/pyr/pedidos/[id]/estado: `estado: "recibido"` requerido.
      const intentoAvance = await db.pedido.updateMany({
        where: { id: pedidoId, negocioId, metodoEntrega: "mesa", estado: "recibido" },
        data: { estado: "preparando" },
      })
      expect(intentoAvance.count).toBe(0)

      const pedido = await db.pedido.findUniqueOrThrow({ where: { id: pedidoId } })
      expect(pedido.estado).toBe("cancelado")
    })

    test("2. transición concurrente (avance) que pierde contra una cancelación ya confirmada se resuelve de forma controlada (count 0, sin excepción)", async () => {
      const mesaId = await crearMesa(negocioId)
      const ocupacionId = await crearOcupacion(negocioId, mesaId)
      const pedidoId = await crearPedidoMesa({ negocioId, mesaId, ocupacionMesaId: ocupacionId, estado: "preparando" })
      await cancelarPedidoMesa({ pedidoId, motivo: "Gana la cancelación", actor: actorNegocioAdmin(negocioId) })

      const intentoAvance = await db.pedido.updateMany({
        where: { id: pedidoId, negocioId, metodoEntrega: "mesa", estado: "preparando" },
        data: { estado: "listo_para_retirar" },
      })
      expect(intentoAvance.count).toBe(0)
    })
  })

  // -------------------------------------------------------------------------
  // K. Concurrencia real (Promise.all, sin mocks) — sección 13 / 21-K
  // -------------------------------------------------------------------------

  describe("K. Concurrencia real", () => {
    test("1. dos cancelaciones simultáneas sobre el mismo pedido: exactamente una gana", async () => {
      const mesaId = await crearMesa(negocioId)
      const ocupacionId = await crearOcupacion(negocioId, mesaId)
      const pedidoId = await crearPedidoMesa({ negocioId, mesaId, ocupacionMesaId: ocupacionId, estado: "recibido" })
      const actorA = actorNegocioAdmin(negocioId)
      const actorB: MesaPedidoCancelActor = { type: "salon_personal", negocioId, actorId: "empleado-b", nombre: "Salón B" }

      const [r1, r2] = await Promise.all([
        cancelarPedidoMesa({ pedidoId, motivo: "Intento A", actor: actorA }),
        cancelarPedidoMesa({ pedidoId, motivo: "Intento B", actor: actorB }),
      ])

      const oks = [r1.kind, r2.kind].filter((k) => k === "ok")
      expect(oks.length).toBe(1)
      expect([r1.kind, r2.kind].filter((kind) => kind === "conflict")).toHaveLength(1)
      expect([r1.kind, r2.kind]).not.toContain("server_error")

      const [pedido, eventos] = await Promise.all([
        db.pedido.findUniqueOrThrow({ where: { id: pedidoId } }),
        db.pedidoEvento.findMany({ where: { pedidoId } }),
      ])
      expect(pedido.estado).toBe("cancelado")
      expect(pedido.canceladoMotivo).toBe(r1.kind === "ok" ? "Intento A" : "Intento B")
      expect(eventos).toHaveLength(1)
      expect(eventos[0].nota).toBe(r1.kind === "ok" ? "Intento A" : "Intento B")
    })

    test("2. cancelación concurrente contra un avance de estado legítimo: nunca ambos ganan", async () => {
      const mesaId = await crearMesa(negocioId)
      const ocupacionId = await crearOcupacion(negocioId, mesaId)
      const pedidoId = await crearPedidoMesa({ negocioId, mesaId, ocupacionMesaId: ocupacionId, estado: "recibido" })

      const [cancelacion, avance] = await Promise.all([
        cancelarPedidoMesa({ pedidoId, motivo: "Cancelación concurrente", actor: actorNegocioAdmin(negocioId) }),
        db.pedido.updateMany({
          where: { id: pedidoId, negocioId, metodoEntrega: "mesa", estado: "recibido" },
          data: { estado: "preparando" },
        }),
      ])

      const pedido = await db.pedido.findUniqueOrThrow({ where: { id: pedidoId } })
      if (cancelacion.kind === "ok") {
        expect(avance.count).toBe(0)
        expect(pedido.estado).toBe("cancelado")
      } else {
        expect(avance.count).toBe(1)
        expect(pedido.estado).toBe("preparando")
        expect(cancelacion.kind).toBe("conflict")
      }
    })

    test("3. cancelación concurrente contra el cierre de la ocupación: nunca queda inconsistente", async () => {
      const mesaId = await crearMesa(negocioId)
      const ocupacionId = await crearOcupacion(negocioId, mesaId, "activa")
      const pedidoId = await crearPedidoMesa({ negocioId, mesaId, ocupacionMesaId: ocupacionId, estado: "recibido" })

      const [cancelacion] = await Promise.all([
        cancelarPedidoMesa({ pedidoId, motivo: "Cancelación vs cierre", actor: actorNegocioAdmin(negocioId) }),
        db.sesionOcupacionMesa.updateMany({
          where: { id: ocupacionId, negocioId, estado: "activa" },
          data: { estado: "cerrada", cerradaEn: new Date() },
        }),
      ])

      const pedido = await db.pedido.findUniqueOrThrow({ where: { id: pedidoId } })
      if (cancelacion.kind === "ok") {
        expect(pedido.estado).toBe("cancelado")
      } else {
        expect(cancelacion.kind).toBe("conflict")
        expect(await db.pedidoEvento.count({ where: { pedidoId } })).toBe(0)
        expect(pedido.estado).toBe("recibido")
      }
    })

    test("4. reversión financiera: Negocio.deudaTarifa nunca queda alterado por una cancelación de mesa (tarifaServicio siempre 0 en mesa)", async () => {
      const negocioAntes = await db.negocio.findUniqueOrThrow({ where: { id: negocioId }, select: { deudaTarifa: true } })
      const mesaId = await crearMesa(negocioId)
      const ocupacionId = await crearOcupacion(negocioId, mesaId)
      const pedidoId = await crearPedidoMesa({ negocioId, mesaId, ocupacionMesaId: ocupacionId, estado: "recibido" })
      const resultado = await cancelarPedidoMesa({ pedidoId, motivo: "Reversión financiera no-op", actor: actorNegocioAdmin(negocioId) })
      expect(resultado.kind).toBe("ok")
      const negocioDespues = await db.negocio.findUniqueOrThrow({ where: { id: negocioId }, select: { deudaTarifa: true } })
      expect(negocioDespues.deudaTarifa).toBe(negocioAntes.deudaTarifa)
    })
  })

  // -------------------------------------------------------------------------
  // L. Contrato HTTP legacy y superficie de ruta
  // -------------------------------------------------------------------------

  describe("L. Contrato HTTP legacy", () => {
    test("1. pedido mesa legacy propio sin ocupación devuelve 409 sin_ocupacion y no se auto-vincula", async () => {
      const mesaId = await crearMesa(negocioId)
      const pedidoId = await crearPedidoMesa({ negocioId, mesaId, ocupacionMesaId: null, estado: "recibido" })
      const token = await sesionNegocio(negocioId)
      const { response, body } = await postCancelarPedido({ pedidoId, token })
      expect(response.status).toBe(409)
      expect(body.code).toBe("sin_ocupacion")
      const pedido = await db.pedido.findUniqueOrThrow({ where: { id: pedidoId } })
      expect(pedido.estado).toBe("recibido")
      expect(pedido.ocupacionMesaId).toBeNull()
      expect(await db.pedidoEvento.count({ where: { pedidoId } })).toBe(0)
    })

    test("2. pedido mesa legacy de otro negocio permanece 404 e indistinguible de inexistente", async () => {
      const mesaId = await crearMesa(negocioAjenoId)
      const pedidoAjenoId = await crearPedidoMesa({ negocioId: negocioAjenoId, mesaId, ocupacionMesaId: null, estado: "recibido" })
      const token = await sesionNegocio(negocioId)
      const ajeno = await postCancelarPedido({ pedidoId: pedidoAjenoId, token })
      const inexistente = await postCancelarPedido({ pedidoId: `inexistente-${randomUUID()}`, token })
      expect(ajeno.response.status).toBe(404)
      expect(inexistente.response.status).toBe(404)
      expect(ajeno.body.error).toBe(inexistente.body.error)
      expect(await db.pedidoEvento.count({ where: { pedidoId: pedidoAjenoId } })).toBe(0)
    })

    test("3. delivery y retiro continúan devolviendo 404", async () => {
      const token = await sesionNegocio(negocioId)
      const deliveryId = await crearPedidoNoMesa(negocioId, "domicilio")
      const retiroId = await crearPedidoNoMesa(negocioId, "retiro")
      expect((await postCancelarPedido({ pedidoId: deliveryId, token })).response.status).toBe(404)
      expect((await postCancelarPedido({ pedidoId: retiroId, token })).response.status).toBe(404)
      expect(await db.pedidoEvento.count({ where: { pedidoId: { in: [deliveryId, retiroId] } } })).toBe(0)
    })

    test("4. pedido mesa válido con ocupación activa sigue devolviendo 200 y un evento", async () => {
      const mesaId = await crearMesa(negocioId)
      const ocupacionId = await crearOcupacion(negocioId, mesaId)
      const pedidoId = await crearPedidoMesa({ negocioId, mesaId, ocupacionMesaId: ocupacionId, estado: "recibido" })
      const token = await sesionNegocio(negocioId)
      const { response, body } = await postCancelarPedido({ pedidoId, token, motivo: "Pedido válido de ruta" })
      expect(response.status).toBe(200)
      expect(body.ok).toBe(true)
      expect(await db.pedidoEvento.count({ where: { pedidoId } })).toBe(1)
    })
  })
})
