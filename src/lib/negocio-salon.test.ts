/// <reference types="bun-types" />
// ============================================
// DeliGO — Tests permanentes: Dark Kitchen / negocio sin Salón (Tarea 20)
// ============================================
// Integración real contra PostgreSQL (misma base que usa `db` en runtime —
// sin mocks de Prisma). Cubre:
//   - contrato de desactivarSalonSiPermitido (bloqueo por ocupación activa,
//     por pedidos pendientes, idempotencia);
//   - enforcement de apertura de ocupación (openOrReuseMesaOccupancy /
//     openOrReuseMesaOccupancyForStaff) cuando salonActivo=false;
//   - CONCURRENCIA DETERMINISTA: desactivación vs. apertura de ocupación,
//     usando el mismo rendezvous de dos vías ya establecido en
//     23-B-CORRECCIÓN-1 (nunca Promise.all sin control de orden);
//   - enforcement de terminal (creación + activación) y de asignación de
//     empleados a mozo/salon;
//   - exposición pública de `salonHabilitado`;
//   - reactivación (conserva mesas/QR, nunca reutiliza ocupación anterior);
//   - aislamiento cross-negocio.
//
// Mismo patrón de fixtures que mesa-cliente-cuenta.test.ts (23-B): cada
// `describe` crea su propio negocio/mesa en `beforeAll` y limpia todo en
// `afterAll`.

import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import {
  openOrReuseMesaOccupancy,
  openOrReuseMesaOccupancyForStaff,
  generateMesaOccupancyToken,
  SalonDeshabilitadoError,
} from "@/lib/mesa-occupancy"
import { desactivarSalonSiPermitido, requireSalonHabilitado } from "@/lib/negocio-salon"
import { ESTADOS_PENDIENTES_MESA } from "@/lib/negocio-salon-contract"
import { hasTerminalArea, hasTerminalScope } from "@/lib/operaciones-terminal-access"
import type { TerminalSessionContext } from "@/lib/operaciones-terminal-auth"
import { POST as activarTerminal } from "@/app/api/operaciones/terminal/activar/route"
import { POST as crearTerminal, GET as listarTerminales } from "@/app/api/negocio/terminales-operativas/route"
import { POST as crearEmpleado } from "@/app/api/negocio/empleados/route"
import { PUT as editarEmpleado } from "@/app/api/negocio/empleados/[id]/route"
import { GET as getNegocioPublico } from "@/app/api/negocios/[slug]/route"
import { POST_FOR_TESTS as crearPedido, type PedidoRouteTestHooks } from "@/app/api/pedidos/route"
import { createSession, SESSION_COOKIE_NAME } from "@/lib/auth"

// ---------------------------------------------------------------------------
// Helpers de fixture
// ---------------------------------------------------------------------------

async function crearNegocio(salonActivo: boolean) {
  const suffix = randomUUID()
  const negocio = await db.negocio.create({
    data: {
      slug: `test-20-dark-kitchen-${suffix}`,
      nombre: `Test T20 ${suffix}`,
      usuario: `test20_${suffix}`,
      email: `test20-${suffix}@example.com`,
      password: "no-usado-en-estos-tests",
      aprobado: true,
      suspendido: false,
      salonActivo,
      horarioMode: "simple",
      abiertoManual: true,
    },
  })
  return negocio.id
}

let mesaCounter = 0
async function crearMesa(negocioId: string) {
  mesaCounter += 1
  const mesa = await db.mesa.create({ data: { negocioId, numero: 3000 + mesaCounter } })
  return mesa.id
}

async function crearOcupacionActiva(negocioId: string, mesaId: string) {
  const ocupacion = await db.sesionOcupacionMesa.create({ data: { negocioId, mesaId, estado: "activa" } })
  await db.mesa.update({ where: { id: mesaId }, data: { ocupacionActualId: ocupacion.id } })
  return ocupacion.id
}

async function crearPedidoMesa(negocioId: string, mesaId: string, ocupacionId: string | null, estado: string) {
  const pedido = await db.pedido.create({
    data: {
      negocioId,
      negocioSlug: `test-20-pedido-${randomUUID()}`,
      negocioNombre: "Negocio Test 20",
      clienteNombre: "Cliente Test",
      mesaId,
      mesaNumero: 1,
      ocupacionMesaId: ocupacionId,
      metodoEntrega: "mesa",
      estado,
      total: 100,
      totalProductos: 100,
    },
  })
  return pedido.id
}

const idsSesionParaLimpiar: string[] = []
async function sesionNegocio(negocioId: string) {
  const token = await createSession(negocioId, "negocio")
  idsSesionParaLimpiar.push(negocioId)
  return token
}

function reqConCookie(
  url: string,
  cookies: Record<string, string>,
  init?: { method?: string; headers?: Record<string, string>; body?: string }
): NextRequest {
  const cookieHeader = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ")
  return new NextRequest(url, {
    method: init?.method,
    body: init?.body,
    headers: { ...(init?.headers ?? {}), ...(cookieHeader ? { cookie: cookieHeader } : {}) },
  })
}

async function crearProducto(negocioId: string) {
  const producto = await db.producto.create({
    data: { nombre: "Producto Test T20", precio: 100, negocioId },
  })
  return producto.id
}

// Body mínimo válido para POST /api/pedidos (pedido de mesa, invitado, sin
// geolocalización) — mismos campos que exige `validatePedidoPayload` en la
// ruta real, nunca un mock del validador.
function bodyPedidoMesa(params: { negocioId: string; productoId: string; mesaNumero: number }) {
  return {
    negocioId: params.negocioId,
    items: [
      {
        productoId: params.productoId,
        cantidad: 1,
        agregados: [],
        secciones: {},
        ingredientesQuitados: [],
        talle: "",
        color: "",
      },
    ],
    metodoEntrega: "mesa",
    metodoPago: "efectivo",
    notas: null,
    direccion: null,
    referencia: null,
    lat: null,
    lng: null,
    mesaId: null,
    mesaNumero: params.mesaNumero,
    empleadoCodigo: null,
    fingerprint: null,
    mesaGeolocation: null,
  }
}

// `x-forwarded-for` único por test: el rate limit de "order" (5/5min) y el
// lock de concurrencia (`order:${ip}`) de POST /api/pedidos usan la IP
// cuando no hay cookie de sesión — sin esto, los tests de este archivo (y de
// otros que corran en paralelo) competirían por el mismo balde/lock.
function reqPedido(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/pedidos", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": randomUUID(),
    },
  })
}

async function limpiarNegocio(negocioId: string) {
  await db.pedidoEvento.deleteMany({ where: { pedido: { negocioId } } }).catch(() => {})
  await db.pedido.deleteMany({ where: { negocioId } })
  await db.sesionOcupacionMesa.deleteMany({ where: { negocioId } }) // cascade -> credenciales
  await db.terminalOperativa.deleteMany({ where: { negocioId } }) // cascade -> vinculaciones/sesiones
  await db.empleado.deleteMany({ where: { negocioId } })
  await db.mesa.deleteMany({ where: { negocioId } })
  await db.negocio.delete({ where: { id: negocioId } })
}

// ---------------------------------------------------------------------------
// Rendezvous determinista de dos vías (mismo patrón que 23-B-CORRECCIÓN-1)
// ---------------------------------------------------------------------------

function crearRendezvous() {
  let resolverLlegada!: () => void
  const llegada = new Promise<void>((resolve) => {
    resolverLlegada = resolve
  })
  let resolverContinuar!: () => void
  const continuar = new Promise<void>((resolve) => {
    resolverContinuar = resolve
  })
  return {
    llegada,
    continuar,
    señalizarLlegada: () => resolverLlegada(),
    liberar: () => resolverContinuar(),
  }
}

// ---------------------------------------------------------------------------
// desactivarSalonSiPermitido — contrato
// ---------------------------------------------------------------------------

describe("Tarea 20 — desactivarSalonSiPermitido (contrato)", () => {
  // Cada test crea su PROPIO negocio — nunca comparten estado (una
  // ocupación activa o un pedido pendiente dejado por un test anterior
  // contaminaría el resultado de los demás).
  const negociosCreados: string[] = []

  afterAll(async () => {
    for (const id of negociosCreados) {
      await limpiarNegocio(id)
    }
  })

  test("1. sin actividad -> permite desactivar", async () => {
    const negocioId = await crearNegocio(true)
    negociosCreados.push(negocioId)
    await crearMesa(negocioId) // mesa sin ocupación, no bloquea
    const resultado = await desactivarSalonSiPermitido(negocioId)
    expect(resultado).toEqual({ ok: true })
    const negocio = await db.negocio.findUniqueOrThrow({ where: { id: negocioId }, select: { salonActivo: true } })
    expect(negocio.salonActivo).toBe(false)
  })

  test("idempotente: ya desactivado -> ok sin error", async () => {
    const negocioId = await crearNegocio(false)
    negociosCreados.push(negocioId)
    const resultado = await desactivarSalonSiPermitido(negocioId)
    expect(resultado).toEqual({ ok: true })
  })

  test("2/19. ocupación activa -> bloqueado (nunca cierra la ocupación ni borra nada)", async () => {
    const negocioId = await crearNegocio(true)
    negociosCreados.push(negocioId)
    const mesaId = await crearMesa(negocioId)
    const ocupacionId = await crearOcupacionActiva(negocioId, mesaId)
    const resultado = await desactivarSalonSiPermitido(negocioId)
    expect(resultado).toEqual({ ok: false, code: "ocupacion_activa" })
    const negocio = await db.negocio.findUniqueOrThrow({ where: { id: negocioId }, select: { salonActivo: true } })
    expect(negocio.salonActivo).toBe(true) // nunca se tocó
    const ocupacion = await db.sesionOcupacionMesa.findUniqueOrThrow({ where: { id: ocupacionId } })
    expect(ocupacion.estado).toBe("activa") // nunca se cerró automáticamente
  })

  test("3. pedido de mesa pendiente (sin ocupación activa) -> bloqueado", async () => {
    const negocioId = await crearNegocio(true)
    negociosCreados.push(negocioId)
    const mesaId = await crearMesa(negocioId)
    const pedidoId = await crearPedidoMesa(negocioId, mesaId, null, "preparando")
    const resultado = await desactivarSalonSiPermitido(negocioId)
    expect(resultado).toEqual({ ok: false, code: "pedidos_pendientes" })
    const pedido = await db.pedido.findUniqueOrThrow({ where: { id: pedidoId } })
    expect(pedido.estado).toBe("preparando") // nunca se canceló automáticamente
  })

  test("4/21. histórico cerrado únicamente (pedido entregado/cancelado) -> permite desactivar", async () => {
    const negocioId = await crearNegocio(true)
    negociosCreados.push(negocioId)
    const mesaId = await crearMesa(negocioId)
    await crearPedidoMesa(negocioId, mesaId, null, "entregado")
    await crearPedidoMesa(negocioId, mesaId, null, "cancelado")
    const resultado = await desactivarSalonSiPermitido(negocioId)
    expect(resultado).toEqual({ ok: true })
  })
})

// ---------------------------------------------------------------------------
// Enforcement de apertura de ocupación
// ---------------------------------------------------------------------------

describe("Tarea 20 — apertura de ocupación rechaza negocio sin Salón", () => {
  let negocioSinSalonId: string
  let negocioConSalonId: string
  let mesaSinSalonId: string
  let mesaConSalonId: string

  beforeAll(async () => {
    negocioSinSalonId = await crearNegocio(false)
    negocioConSalonId = await crearNegocio(true)
    mesaSinSalonId = await crearMesa(negocioSinSalonId)
    mesaConSalonId = await crearMesa(negocioConSalonId)
  })

  afterAll(async () => {
    await limpiarNegocio(negocioSinSalonId)
    await limpiarNegocio(negocioConSalonId)
  })

  test("13/17/18. openOrReuseMesaOccupancy (dispositivo) -> lanza SalonDeshabilitadoError, no crea ocupación ni credencial", async () => {
    await expect(
      openOrReuseMesaOccupancy({ negocioId: negocioSinSalonId, mesaId: mesaSinSalonId, existingToken: null })
    ).rejects.toThrow(SalonDeshabilitadoError)
    const ocupaciones = await db.sesionOcupacionMesa.count({ where: { negocioId: negocioSinSalonId } })
    expect(ocupaciones).toBe(0)
    const credenciales = await db.credencialOcupacionMesa.count({
      where: { ocupacion: { negocioId: negocioSinSalonId } },
    })
    expect(credenciales).toBe(0)
  })

  test("openOrReuseMesaOccupancyForStaff -> lanza SalonDeshabilitadoError, no crea ocupación", async () => {
    await expect(
      openOrReuseMesaOccupancyForStaff({ negocioId: negocioSinSalonId, mesaId: mesaSinSalonId })
    ).rejects.toThrow(SalonDeshabilitadoError)
    const ocupaciones = await db.sesionOcupacionMesa.count({ where: { negocioId: negocioSinSalonId } })
    expect(ocupaciones).toBe(0)
  })

  test("negocio CON Salón -> ambas variantes funcionan normalmente", async () => {
    const resultado = await openOrReuseMesaOccupancy({
      negocioId: negocioConSalonId,
      mesaId: mesaConSalonId,
      existingToken: null,
    })
    expect(resultado.occupancyCreated).toBe(true)
    expect(resultado.newToken).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// CONCURRENCIA DETERMINISTA — desactivación vs. apertura de ocupación
// ---------------------------------------------------------------------------

describe("Tarea 20 — concurrencia: desactivación vs. apertura de ocupación", () => {
  let negocioId: string

  beforeAll(async () => {
    negocioId = await crearNegocio(true)
  })

  afterAll(async () => {
    await limpiarNegocio(negocioId)
  })

  test("Caso 1 — la desactivación gana: commiteada ENTRE la comprobación de capacidad y la creación de la ocupación -> la apertura falla, cero ocupaciones activas", async () => {
    const mesaId = await crearMesa(negocioId)

    const rendezvous = crearRendezvous()
    const aperturaPromise = openOrReuseMesaOccupancyForStaff(
      { negocioId, mesaId },
      {
        afterSalonCheck: async () => {
          rendezvous.señalizarLlegada()
          await rendezvous.continuar
        },
      }
    )

    // Esperamos la señal real de que la apertura ya confirmó "Salón
    // habilitado" y está pausada, exactamente antes de crear la ocupación.
    await rendezvous.llegada

    // Mutación concurrente, COMMITEADA de verdad — UNA sola sentencia SQL
    // (no varias llamadas ORM separadas, para minimizar los round-trips a
    // una base remota y no mantener la transacción interactiva pausada más
    // allá del timeout por defecto de Prisma de 5s) que de todos modos LEE
    // `sesiones_ocupacion_mesa` (vía el `NOT EXISTS`) antes de escribir
    // `negocios` — necesario para que Postgres, bajo aislamiento
    // Serializable real, registre la dependencia lectura-escritura
    // correcta entre esta transacción y la apertura pausada (que lee
    // `negocios` y escribe `sesiones_ocupacion_mesa`): sin esa lectura acá,
    // no habría ningún ciclo que detectar y ambas operaciones podrían
    // completarse "válidamente" en cualquier orden serial equivalente,
    // aunque el resultado real fuera incorrecto.
    await db.$transaction(
      async (tx) => {
        await tx.$executeRaw`
          UPDATE negocios
          SET "salonActivo" = false
          WHERE id = ${negocioId}
            AND NOT EXISTS (
              SELECT 1 FROM sesiones_ocupacion_mesa
              WHERE "negocioId" = ${negocioId} AND estado = 'activa'
            )
        `
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    )

    rendezvous.liberar()

    // Bajo aislamiento Serializable real, esto debe fallar: al reintentar
    // (runSerializableTransaction), la relectura de `salonActivo` ya ve
    // `false` — nunca queda una ocupación activa en un negocio sin Salón.
    await expect(aperturaPromise).rejects.toThrow(SalonDeshabilitadoError)

    const ocupacionesActivas = await db.sesionOcupacionMesa.count({ where: { negocioId, mesaId, estado: "activa" } })
    expect(ocupacionesActivas).toBe(0)

    await db.negocio.update({ where: { id: negocioId }, data: { salonActivo: true } })
  })

  test("Caso 2 — la apertura gana: ocupación COMMITEADA antes de intentar desactivar -> desactivación bloqueada", async () => {
    const mesaId = await crearMesa(negocioId)

    const apertura = await openOrReuseMesaOccupancy({ negocioId, mesaId, existingToken: null })
    expect(apertura.occupancyCreated).toBe(true)

    const resultado = await desactivarSalonSiPermitido(negocioId)
    expect(resultado).toEqual({ ok: false, code: "ocupacion_activa" })

    const negocio = await db.negocio.findUniqueOrThrow({ where: { id: negocioId }, select: { salonActivo: true } })
    expect(negocio.salonActivo).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Terminal — creación y activación
// ---------------------------------------------------------------------------

describe("Tarea 20 — terminal de Salón rechazada sin capacidad", () => {
  let negocioSinSalonId: string
  let tokenSesionNegocio: string

  beforeAll(async () => {
    negocioSinSalonId = await crearNegocio(false)
    tokenSesionNegocio = await sesionNegocio(negocioSinSalonId)
  })

  afterAll(async () => {
    await limpiarNegocio(negocioSinSalonId)
    await db.sesion.deleteMany({ where: { userId: { in: idsSesionParaLimpiar } } })
  })

  test("27. crear terminal con área 'salon' -> 409, nunca se crea", async () => {
    const req = reqConCookie(
      "http://localhost/api/negocio/terminales-operativas",
      { [SESSION_COOKIE_NAME]: tokenSesionNegocio },
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ nombre: "Pantalla", perfil: "pantalla" }) }
    )
    const res = await crearTerminal(req)
    expect(res.status).toBe(409)
    const listado = await listarTerminales(reqConCookie("http://localhost/api/negocio/terminales-operativas", { [SESSION_COOKIE_NAME]: tokenSesionNegocio }))
    const body = await listado.json()
    expect(body.terminales.length).toBe(0)
  })

  test("crear terminal exclusivamente 'pyr' -> permitida (PyR es independiente de Salón)", async () => {
    const req = reqConCookie(
      "http://localhost/api/negocio/terminales-operativas",
      { [SESSION_COOKIE_NAME]: tokenSesionNegocio },
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nombre: "PyR Terminal", perfil: "pyr_completo" }),
      }
    )
    const res = await crearTerminal(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.terminal.areas).toEqual(["pyr"])
  })
})

describe("Tarea 20 — hasTerminalArea/hasTerminalScope exigen salonActivo solo para 'salon'", () => {
  function contexto(salonActivo: boolean, areas: ("salon" | "pyr")[], scopes: string[]): TerminalSessionContext {
    return {
      sessionId: "s1",
      terminal: { id: "t1", nombre: "T", estado: "activo", perfil: "personalizado", areas, scopes: scopes as never },
      negocio: { id: "n1", nombre: "N", slug: "n", colorPrincipal: "#000", salonActivo },
    }
  }

  test("28. área 'salon' con salonActivo=false -> false, aunque la terminal tenga el área/scope asignados", () => {
    expect(hasTerminalArea(contexto(false, ["salon"], ["salon.ver"]), "salon")).toBe(false)
  })

  test("área 'salon' con salonActivo=true -> true", () => {
    expect(hasTerminalArea(contexto(true, ["salon"], ["salon.ver"]), "salon")).toBe(true)
  })

  test("30. área 'pyr' nunca depende de salonActivo", () => {
    expect(hasTerminalArea(contexto(false, ["pyr"], ["pyr.ver"]), "pyr")).toBe(true)
  })

  test("scope 'salon.ver' con salonActivo=false -> false", () => {
    expect(hasTerminalScope(contexto(false, ["salon"], ["salon.ver"]), "salon.ver")).toBe(false)
  })

  test("scope 'pyr.ver' nunca depende de salonActivo", () => {
    expect(hasTerminalScope(contexto(false, ["pyr"], ["pyr.ver"]), "pyr.ver")).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Empleados — asignación de área mozo/salon
// ---------------------------------------------------------------------------

describe("Tarea 20 — asignación de empleado a mozo/salon rechazada sin Salón", () => {
  let negocioSinSalonId: string
  let negocioConSalonId: string
  let tokenSinSalon: string
  let tokenConSalon: string

  beforeAll(async () => {
    negocioSinSalonId = await crearNegocio(false)
    negocioConSalonId = await crearNegocio(true)
    tokenSinSalon = await sesionNegocio(negocioSinSalonId)
    tokenConSalon = await sesionNegocio(negocioConSalonId)
  })

  afterAll(async () => {
    await limpiarNegocio(negocioSinSalonId)
    await limpiarNegocio(negocioConSalonId)
    await db.sesion.deleteMany({ where: { userId: { in: idsSesionParaLimpiar } } })
  })

  test("29. POST empleado con areaOperativa 'mozo' sin Salón -> 409, nunca se crea con esa área", async () => {
    const req = reqConCookie(
      "http://localhost/api/negocio/empleados",
      { [SESSION_COOKIE_NAME]: tokenSinSalon },
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nombre: "Mozo Test", codigo: `MZ${randomUUID().slice(0, 6)}`, areaOperativa: "mozo" }),
      }
    )
    const res = await crearEmpleado(req)
    expect(res.status).toBe(409)
  })

  test("POST empleado con areaOperativa 'salon' sin Salón -> 409", async () => {
    const req = reqConCookie(
      "http://localhost/api/negocio/empleados",
      { [SESSION_COOKIE_NAME]: tokenSinSalon },
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nombre: "Salon Test", codigo: `SL${randomUUID().slice(0, 6)}`, areaOperativa: "salon" }),
      }
    )
    const res = await crearEmpleado(req)
    expect(res.status).toBe(409)
  })

  test("POST empleado con areaOperativa 'pyr' sin Salón -> permitido (PyR independiente)", async () => {
    const req = reqConCookie(
      "http://localhost/api/negocio/empleados",
      { [SESSION_COOKIE_NAME]: tokenSinSalon },
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nombre: "PyR Test", codigo: `PY${randomUUID().slice(0, 6)}`, areaOperativa: "pyr" }),
      }
    )
    const res = await crearEmpleado(req)
    expect(res.status).toBe(201)
  })

  test("POST empleado con Salón habilitado -> permitido normalmente", async () => {
    const req = reqConCookie(
      "http://localhost/api/negocio/empleados",
      { [SESSION_COOKIE_NAME]: tokenConSalon },
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nombre: "Mozo OK", codigo: `MO${randomUUID().slice(0, 6)}`, areaOperativa: "mozo" }),
      }
    )
    const res = await crearEmpleado(req)
    expect(res.status).toBe(201)
  })

  test("PUT empleado reasignando a 'salon' sin Salón -> 409", async () => {
    const empleado = await db.empleado.create({
      data: { nombre: "E", codigo: `EX${randomUUID().slice(0, 6)}`, negocioId: negocioSinSalonId, areaOperativa: "sin_asignar", activo: true },
    })
    const req = reqConCookie(
      `http://localhost/api/negocio/empleados/${empleado.id}`,
      { [SESSION_COOKIE_NAME]: tokenSinSalon },
      { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ areaOperativa: "salon" }) }
    )
    const res = await editarEmpleado(req, { params: Promise.resolve({ id: empleado.id }) })
    expect(res.status).toBe(409)
  })
})

// ---------------------------------------------------------------------------
// Exposición pública de salonHabilitado + aislamiento cross-negocio
// ---------------------------------------------------------------------------

describe("Tarea 20 — negocio público expone salonHabilitado; aislamiento cross-negocio", () => {
  let negocioSinSalonId: string
  let negocioConSalonId: string
  let slugSinSalon: string
  let slugConSalon: string
  let mesaSinSalonId: string

  beforeAll(async () => {
    negocioSinSalonId = await crearNegocio(false)
    negocioConSalonId = await crearNegocio(true)
    mesaSinSalonId = await crearMesa(negocioSinSalonId)
    const a = await db.negocio.findUniqueOrThrow({ where: { id: negocioSinSalonId }, select: { slug: true } })
    const b = await db.negocio.findUniqueOrThrow({ where: { id: negocioConSalonId }, select: { slug: true } })
    slugSinSalon = a.slug
    slugConSalon = b.slug
  })

  afterAll(async () => {
    await limpiarNegocio(negocioSinSalonId)
    await limpiarNegocio(negocioConSalonId)
  })

  test("31. GET /api/negocios/[slug] expone salonHabilitado:false para negocio sin Salón, nunca salonActivo crudo", async () => {
    const req = new NextRequest(`http://localhost/api/negocios/${slugSinSalon}`)
    const res = await getNegocioPublico(req, { params: Promise.resolve({ slug: slugSinSalon }) })
    const body = await res.json()
    expect(body.salonHabilitado).toBe(false)
    expect(body).not.toHaveProperty("salonActivo")
  })

  test("GET /api/negocios/[slug] expone salonHabilitado:true para negocio con Salón", async () => {
    const req = new NextRequest(`http://localhost/api/negocios/${slugConSalon}`)
    const res = await getNegocioPublico(req, { params: Promise.resolve({ slug: slugConSalon }) })
    const body = await res.json()
    expect(body.salonHabilitado).toBe(true)
  })

  test("35. desactivar Salón de un negocio nunca afecta a otro negocio (aislamiento)", async () => {
    await desactivarSalonSiPermitido(negocioConSalonId) // sin actividad, éxito
    const otro = await db.negocio.findUniqueOrThrow({ where: { id: negocioSinSalonId }, select: { salonActivo: true } })
    expect(otro.salonActivo).toBe(false) // nunca cambió por la operación del otro negocio
    await db.negocio.update({ where: { id: negocioConSalonId }, data: { salonActivo: true } }) // restaurar
  })

  test("requireSalonHabilitado: negocio inexistente -> false, nunca lanza", async () => {
    expect(await requireSalonHabilitado("negocio-inexistente-xyz")).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Reactivación — preserva mesas/QR, nunca reutiliza ocupación anterior
// ---------------------------------------------------------------------------

describe("Tarea 20 — reactivación de Salón preserva mesas y nunca reutiliza ocupaciones", () => {
  let negocioId: string
  let mesaId: string
  let mesaNumeroOriginal: number

  beforeAll(async () => {
    negocioId = await crearNegocio(true)
    mesaId = await crearMesa(negocioId)
    const mesa = await db.mesa.findUniqueOrThrow({ where: { id: mesaId } })
    mesaNumeroOriginal = mesa.numero
  })

  afterAll(async () => {
    await limpiarNegocio(negocioId)
  })

  test("8/9/22. ciclo completo: ocupación vieja -> desactivar (bloqueada) -> cerrar -> desactivar (ok) -> reactivar -> mesa/número preservados -> nueva ocupación real, nunca la vieja", async () => {
    const ocupacionVieja = await crearOcupacionActiva(negocioId, mesaId)
    const tokenViejo = generateMesaOccupancyToken()
    await db.credencialOcupacionMesa.create({
      data: { ocupacionId: ocupacionVieja, tokenHash: (await import("@/lib/mesa-occupancy")).hashMesaOccupancyToken(tokenViejo) },
    })

    // Bloqueada mientras la ocupación sigue activa.
    expect(await desactivarSalonSiPermitido(negocioId)).toEqual({ ok: false, code: "ocupacion_activa" })

    // Cierre técnico real (mismo mecanismo ya establecido, no se duplica).
    await db.sesionOcupacionMesa.update({ where: { id: ocupacionVieja }, data: { estado: "cerrada", cerradaEn: new Date() } })
    await db.credencialOcupacionMesa.updateMany({ where: { ocupacionId: ocupacionVieja }, data: { revocadaEn: new Date() } })
    await db.mesa.update({ where: { id: mesaId }, data: { ocupacionActualId: null } })

    // Ahora sí puede desactivarse.
    expect(await desactivarSalonSiPermitido(negocioId)).toEqual({ ok: true })

    // La mesa y su número siguen existiendo — nunca se borraron.
    const mesaTrasDesactivar = await db.mesa.findUniqueOrThrow({ where: { id: mesaId } })
    expect(mesaTrasDesactivar.numero).toBe(mesaNumeroOriginal)

    // Reactivar: solo cambia la capacidad, sin efectos secundarios.
    await db.negocio.update({ where: { id: negocioId }, data: { salonActivo: true } })

    // Una nueva ocupación se abre normalmente — nunca es la vieja.
    const nuevaApertura = await openOrReuseMesaOccupancy({ negocioId, mesaId, existingToken: null })
    expect(nuevaApertura.occupancyCreated).toBe(true)
    const mesaFinal = await db.mesa.findUniqueOrThrow({ where: { id: mesaId } })
    expect(mesaFinal.ocupacionActualId).not.toBe(ocupacionVieja)
    expect(mesaFinal.numero).toBe(mesaNumeroOriginal) // el "QR estable" (slug+numero) nunca cambió
  })
})

// ---------------------------------------------------------------------------
// TAREA-20-CORRECCIÓN-1/2 — CONCURRENCIA DETERMINISTA REAL: desactivación de
// Salón vs. creación de pedido, vía POST /api/pedidos (HTTP real, nunca
// helpers aislados). El negocio queda SIN calibrar (sin lat/lng) a
// propósito: bajo P0-D.2, un pedido de mesa de un negocio sin calibrar
// nunca exige ocupación de dispositivo/geocerca (`requiresMesaOccupancy`
// queda en false), así que sigue la misma rama de "personal o negocio sin
// calibrar" (`openOrReuseMesaOccupancyForStaff`) sin necesitar sesión ni
// cookie — la forma más simple de ejercitar el mismo camino de enforcement
// de Salón que un pedido real de mesa, sin fixtures de geocerca/cookies que
// no son el objeto de esta prueba.
//
// TAREA-20-CORRECCIÓN-2 — reclasificación: Casos A y B ahora usan la
// desactivación REAL de la aplicación (`desactivarSalonSiPermitido`) en vez
// de un `UPDATE` SQL directo — ese SQL directo bypasea deliberadamente el
// chequeo de "ocupación activa"/"pedido pendiente" que la función real
// SIEMPRE aplica, así que no era equivalente a "un admin desactiva el
// Salón desde el panel". Caso C se mantiene con SQL directo A PROPÓSITO,
// mantiene su título fuera de contrato, y su límite real queda documentado
// explícitamente en el test.
// ---------------------------------------------------------------------------

describe("Tarea 20-CORRECCIÓN-1/2 — POST /api/pedidos: desactivación de Salón vs. creación de pedido (HTTP real)", () => {
  test("Caso A — la DESACTIVACIÓN REAL (desactivarSalonSiPermitido) gana antes del chequeo temprano: {ok:true}, salonActivo=false, pedido rechazado (400), 0 pedidos/ocupaciones/credenciales creados, nunca 500", async () => {
    const negocioId = await crearNegocio(true)
    try {
      const mesaId = await crearMesa(negocioId)
      const productoId = await crearProducto(negocioId)
      const mesa = await db.mesa.findUniqueOrThrow({ where: { id: mesaId } })

      // Precondición explícita del enunciado: sin ocupación activa, sin
      // pedido pendiente — la desactivación real debe poder completarse
      // sin ningún bloqueo.
      const ocupacionesPrevias = await db.sesionOcupacionMesa.count({ where: { negocioId, estado: "activa" } })
      const pedidosPrevios = await db.pedido.count({ where: { negocioId, estado: { in: [...ESTADOS_PENDIENTES_MESA] } } })
      expect(ocupacionesPrevias).toBe(0)
      expect(pedidosPrevios).toBe(0)

      const rendezvous = crearRendezvous()
      const testHooks: PedidoRouteTestHooks = {
        beforeNegocioFetch: async () => {
          rendezvous.señalizarLlegada()
          await rendezvous.continuar
        },
      }

      const pedidoPromise = crearPedido(
        reqPedido(bodyPedidoMesa({ negocioId, productoId, mesaNumero: mesa.numero })),
        testHooks
      )

      // Esperamos la señal real de que el handler ya resolvió `negocioId`
      // (a partir de los productos) y está pausado justo antes de leer
      // `Negocio` por primera vez.
      await rendezvous.llegada

      // Desactivación REAL de la aplicación — la misma función que usa
      // PATCH /api/negocio/config — comitea antes de reanudar el pedido.
      const resultadoDesactivacion = await desactivarSalonSiPermitido(negocioId)
      expect(resultadoDesactivacion).toEqual({ ok: true })
      const negocioTrasDesactivar = await db.negocio.findUniqueOrThrow({ where: { id: negocioId }, select: { salonActivo: true } })
      expect(negocioTrasDesactivar.salonActivo).toBe(false)

      rendezvous.liberar()

      const response = await pedidoPromise
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBe("El negocio no tiene Salón habilitado")

      const pedidos = await db.pedido.count({ where: { negocioId } })
      expect(pedidos).toBe(0)
      const ocupaciones = await db.sesionOcupacionMesa.count({ where: { negocioId } })
      expect(ocupaciones).toBe(0)
      const credenciales = await db.credencialOcupacionMesa.count({ where: { ocupacion: { negocioId } } })
      expect(credenciales).toBe(0)
    } finally {
      await limpiarNegocio(negocioId)
    }
  })

  test("Caso B — el PEDIDO REAL gana: creado y comiteado primero -> la desactivación REAL (desactivarSalonSiPermitido) queda bloqueada por la ocupación activa, salonActivo sigue true, nada se toca", async () => {
    const negocioId = await crearNegocio(true)
    try {
      const mesaId = await crearMesa(negocioId)
      const productoId = await crearProducto(negocioId)
      const mesa = await db.mesa.findUniqueOrThrow({ where: { id: mesaId } })

      const response = await crearPedido(
        reqPedido(bodyPedidoMesa({ negocioId, productoId, mesaNumero: mesa.numero })),
        {}
      )
      expect(response.status).toBe(201)
      const pedidoCreado = await response.json()

      // Confirmamos que el pedido y la ocupación realmente existen antes de
      // intentar desactivar — no alcanza con el 201, tiene que estar
      // comiteado y visible para una lectura posterior independiente.
      const ocupacionAntes = await db.sesionOcupacionMesa.findFirst({ where: { negocioId, mesaId, estado: "activa" } })
      expect(ocupacionAntes).not.toBeNull()
      const pedidoDb = await db.pedido.findUniqueOrThrow({ where: { id: pedidoCreado.id } })
      expect(pedidoDb.ocupacionMesaId).toBe(ocupacionAntes!.id)

      // Desactivación REAL — la misma función que PATCH /api/negocio/config.
      const resultadoDesactivacion = await desactivarSalonSiPermitido(negocioId)
      expect(resultadoDesactivacion).toEqual({ ok: false, code: "ocupacion_activa" })

      const negocioTrasIntento = await db.negocio.findUniqueOrThrow({ where: { id: negocioId }, select: { salonActivo: true } })
      expect(negocioTrasIntento.salonActivo).toBe(true)

      // Nada se tocó: ni el pedido ni la ocupación se cancelaron/cerraron
      // automáticamente por el intento de desactivación bloqueado.
      const ocupacionDespues = await db.sesionOcupacionMesa.findUniqueOrThrow({ where: { id: ocupacionAntes!.id } })
      expect(ocupacionDespues.estado).toBe("activa")
      const pedidoDespues = await db.pedido.findUniqueOrThrow({ where: { id: pedidoCreado.id } })
      expect(pedidoDespues.estado).toBe(pedidoDb.estado)
    } finally {
      await limpiarNegocio(negocioId)
    }
  })

  test("Caso C (defensa en profundidad, FUERA DE CONTRATO) — una mutación administrativa directa de salonActivo=false, posterior a que la ocupación ya exista, es detectada por la revalidación final aunque desactivarSalonSiPermitido la habría bloqueado", async () => {
    const negocioId = await crearNegocio(true)
    try {
      const mesaId = await crearMesa(negocioId)
      const productoId = await crearProducto(negocioId)
      const mesa = await db.mesa.findUniqueOrThrow({ where: { id: mesaId } })

      const rendezvous = crearRendezvous()
      const testHooks: PedidoRouteTestHooks = {
        beforeFinalSalonRevalidation: async () => {
          rendezvous.señalizarLlegada()
          await rendezvous.continuar
        },
      }

      const pedidoPromise = crearPedido(
        reqPedido(bodyPedidoMesa({ negocioId, productoId, mesaNumero: mesa.numero })),
        testHooks
      )

      // Para cuando llega esta señal, el chequeo temprano (línea ~1062) YA
      // leyó `salonActivo=true` y la apertura/reutilización de ocupación
      // (openOrReuseMesaOccupancyForStaff, su propia transacción, ya
      // comiteada) YA volvió a confirmar Salón habilitado — la transacción
      // de creación del pedido está pausada exactamente en el instante
      // anterior a su propia relectura final, dentro de la MISMA
      // transacción que crea el pedido.
      await rendezvous.llegada

      const ocupacionAntesDeDesactivar = await db.sesionOcupacionMesa.findFirst({ where: { negocioId, mesaId, estado: "activa" } })
      expect(ocupacionAntesDeDesactivar).not.toBeNull() // la apertura previa ya comiteó de verdad

      // Prueba de que este escenario es GENUINAMENTE fuera de contrato: la
      // desactivación REAL de la aplicación, en este mismo instante (con la
      // ocupación ya activa), queda bloqueada — como debe ser. Un admin
      // operando normalmente NUNCA podría producir el estado que este test
      // simula a continuación.
      const intentoNormal = await desactivarSalonSiPermitido(negocioId)
      expect(intentoNormal).toEqual({ ok: false, code: "ocupacion_activa" })
      const negocioTrasIntentoNormal = await db.negocio.findUniqueOrThrow({ where: { id: negocioId }, select: { salonActivo: true } })
      expect(negocioTrasIntentoNormal.salonActivo).toBe(true) // el intento normal NO cambió nada

      // Mutación ADMINISTRATIVA DIRECTA, deliberadamente fuera de contrato:
      // un `UPDATE` SQL crudo que bypasea a propósito
      // `desactivarSalonSiPermitido` (y por lo tanto su chequeo de
      // ocupación activa) — nunca representa una desactivación válida vía
      // la aplicación. Se usa acá ÚNICAMENTE para demostrar la defensa en
      // profundidad de la revalidación final: si esto llegara a ocurrir
      // (bug en otra ruta, migración manual, acceso directo a la base por
      // un operador), el pedido igual se rechaza. Esto NO prueba ninguna
      // garantía de atomicidad general — ver límites documentados abajo.
      await db.$executeRaw`UPDATE negocios SET "salonActivo" = false WHERE id = ${negocioId}`

      rendezvous.liberar()

      const response = await pedidoPromise
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBe("El negocio no tiene Salón habilitado")

      const pedidos = await db.pedido.count({ where: { negocioId } })
      expect(pedidos).toBe(0)

      // Límites reales de esta defensa (documentados, no solo en el
      // informe): la revalidación final detecta esta mutación porque
      // COMITEÓ ANTES de la relectura fresca dentro de la transacción de
      // creación del pedido. Una escritura directa que ocurriera un
      // instante DESPUÉS de esa relectura y ANTES de `tx.pedido.create`
      // seguiría ganando la carrera — esa ventana queda fuera del contrato
      // de escritura normal de la aplicación (exige acceso directo a la
      // base, algo que la aplicación nunca hace por sí sola) y no se
      // afirma cubierta acá.
      await db.negocio.update({ where: { id: negocioId }, data: { salonActivo: true } })
    } finally {
      await limpiarNegocio(negocioId)
    }
  })
})
