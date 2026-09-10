/// <reference types="bun-types" />
// ============================================
// DeliGO — Tests permanentes: P2-T42, PyR Employee + Terminal Order
// Workflow Parity (sort newest-first + modelo canónico aceptado/
// esperando_repartidor, paridad Employee/Terminal)
// ============================================
// Integración real contra PostgreSQL TESTING (misma base que usa `db` en
// runtime — sin mocks de Prisma), invocando los handlers HTTP reales (GET
// de listado, POST de las acciones fijas de Empleado, PATCH genérico de
// Terminal) para probar la cadena completa. Cada describe crea su propio
// negocio/empleado/terminal en `beforeAll` y lo limpia en `afterAll` —
// nunca reutiliza fixtures entre archivos de test.

import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createOperationalSession, OPERATIONAL_SESSION_COOKIE_NAME } from "@/lib/auth"
import { TERMINAL_SESSION_COOKIE_NAME, sha256Hex, generateOpaqueToken, getTerminalSessionExpiry } from "@/lib/operaciones-terminal-auth"
import { GET as getPedidosPyr } from "@/app/api/operativo/pyr/pedidos/route"
import { GET as getPanelPyr } from "@/app/api/operaciones/pyr/panel/route"
import { POST as postAceptar } from "@/app/api/operativo/pyr/pedidos/[id]/aceptar/route"
import { POST as postPreparar } from "@/app/api/operativo/pyr/pedidos/[id]/preparar/route"
import { POST as postBuscarRepartidor } from "@/app/api/operativo/pyr/pedidos/[id]/buscar-repartidor/route"
import { POST as postListoParaRetiro } from "@/app/api/operativo/pyr/pedidos/[id]/listo-para-retiro/route"
import { POST as postEntregar } from "@/app/api/operativo/pyr/pedidos/[id]/entregar/route"
import { PATCH as patchEstadoTerminal } from "@/app/api/operaciones/pyr/pedidos/[id]/estado/route"

// P2-T42: ~15+ escrituras reales secuenciales por describe (Negocio + Cuenta
// Operativa + Empleado + Terminal + Sesión + varios Pedido) contra Postgres
// remoto de Railway TESTING — mismo criterio de timeout ya documentado en
// todos los demás archivos `*.test.ts`/`*.integration.test.ts` de integración
// real de este proyecto (el default de bun:test, 5000ms, es insuficiente).
setDefaultTimeout(60_000)

const testDatabaseUrl = process.env.DELIGO_TEST_DATABASE_URL
if (!testDatabaseUrl || process.env.DATABASE_URL !== testDatabaseUrl) {
  throw new Error(
    "Este test de integración requiere DELIGO_TEST_DATABASE_URL y DATABASE_URL apuntando a la misma base TESTING."
  )
}

async function crearNegocio() {
  const suffix = randomUUID()
  const negocio = await db.negocio.create({
    data: {
      slug: `test-t42-${suffix}`,
      nombre: `Test P2-T42 ${suffix}`,
      usuario: `test_t42_${suffix}`,
      email: `test-t42-${suffix}@example.com`,
      password: "no-usado-en-estos-tests",
      aprobado: true,
      suspendido: false,
      salonActivo: false,
      empleadosActivos: true,
    },
  })
  return { id: negocio.id, slug: negocio.slug, nombre: negocio.nombre }
}

async function crearCuentaOperativa() {
  const cuenta = await db.cuentaOperativa.create({
    data: { nombre: `Cuenta Test T42 ${randomUUID()}`, email: `cuenta-t42-${randomUUID()}@example.com`, activo: true, eliminado: false },
  })
  return cuenta.id
}

async function crearEmpleado(negocioId: string, cuentaOperativaId: string, areaOperativa: string) {
  await db.empleado.create({
    data: {
      nombre: `Empleado Test T42 ${randomUUID()}`,
      codigo: randomUUID().slice(0, 8),
      negocioId,
      cuentaOperativaId,
      areaOperativa,
      activo: true,
      eliminado: false,
    },
  })
}

async function crearTerminal(negocioId: string, areas: string[], scopes: string[]) {
  const terminal = await db.terminalOperativa.create({
    data: {
      negocioId,
      nombre: `Terminal Test T42 ${randomUUID()}`,
      estado: "activo",
      areas: JSON.stringify(areas),
      scopes: JSON.stringify(scopes),
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

let contadorPedido = 0
async function crearPedido(params: {
  negocioId: string
  slug: string
  estado: string
  metodoEntrega: "domicilio" | "retiro"
  fecha?: Date
  clienteConfirmaRecibido?: boolean
}) {
  contadorPedido += 1
  const pedido = await db.pedido.create({
    data: {
      negocioId: params.negocioId,
      negocioSlug: params.slug,
      negocioNombre: "Test T42",
      clienteNombre: "Cliente Test",
      total: 1000,
      totalProductos: 1000,
      metodoEntrega: params.metodoEntrega,
      estado: params.estado,
      fecha: params.fecha ?? new Date(),
      clienteConfirmaRecibido: params.clienteConfirmaRecibido ?? false,
      idempotencyKey: `test-t42-${randomUUID()}-${contadorPedido}`,
    },
  })
  return pedido.id
}

function operativoRequest(cookies: Record<string, string>, url: string, method = "GET") {
  const cookieHeader = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ")
  return new NextRequest(url, {
    method,
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  })
}

function postOperativo(cookies: Record<string, string>, id: string, slug: string, segment: string) {
  return operativoRequest(cookies, `http://localhost/api/operativo/pyr/pedidos/${id}/${segment}?slug=${encodeURIComponent(slug)}`, "POST")
}

function patchTerminalEstado(rawToken: string, id: string, body: Record<string, unknown>) {
  const req = new NextRequest(`http://localhost/api/operaciones/pyr/pedidos/${id}/estado`, {
    method: "PATCH",
    headers: { cookie: `${TERMINAL_SESSION_COOKIE_NAME}=${rawToken}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  return patchEstadoTerminal(req, { params: Promise.resolve({ id }) })
}

async function limpiarNegocio(negocioId: string) {
  await db.pedidoEvento.deleteMany({ where: { pedido: { negocioId } } }).catch(() => {})
  await db.pedido.deleteMany({ where: { negocioId } })
  await db.empleado.deleteMany({ where: { negocioId } })
  await db.terminalOperativa.deleteMany({ where: { negocioId } })
  await db.negocio.delete({ where: { id: negocioId } })
}

// ---------------------------------------------------------------------------
// A. Sort — Employee y Terminal, ambos newest-first
// ---------------------------------------------------------------------------

describe("P2-T42 — sort newest-first (Employee y Terminal)", () => {
  let negocio: { id: string; slug: string }
  let cuentaId: string
  let terminalId: string
  let token: string
  let rawTerminalToken: string
  const cuentasCreadas: string[] = []

  beforeAll(async () => {
    negocio = await crearNegocio()
    cuentaId = await crearCuentaOperativa()
    cuentasCreadas.push(cuentaId)
    await crearEmpleado(negocio.id, cuentaId, "pyr")
    token = await createOperationalSession(cuentaId)
    terminalId = await crearTerminal(negocio.id, ["pyr"], ["pyr.ver", "pyr.pedidos.ver", "pyr.pedidos.gestionar"])
    rawTerminalToken = await crearSesionTerminal(terminalId)

    const now = Date.now()
    await crearPedido({ negocioId: negocio.id, slug: negocio.slug, estado: "recibido", metodoEntrega: "retiro", fecha: new Date(now - 60_000) }) // OLD
    await crearPedido({ negocioId: negocio.id, slug: negocio.slug, estado: "recibido", metodoEntrega: "retiro", fecha: new Date(now - 30_000) }) // MIDDLE
    await crearPedido({ negocioId: negocio.id, slug: negocio.slug, estado: "recibido", metodoEntrega: "retiro", fecha: new Date(now) }) // NEW
  })

  afterAll(async () => {
    await db.sesion.deleteMany({ where: { userId: { in: cuentasCreadas } } })
    await limpiarNegocio(negocio.id)
    await db.cuentaOperativa.deleteMany({ where: { id: { in: cuentasCreadas } } })
  })

  test("1. Employee GET /api/operativo/pyr/pedidos devuelve NEW, MIDDLE, OLD (nunca FIFO)", async () => {
    const req = operativoRequest({ [OPERATIONAL_SESSION_COOKIE_NAME]: token }, `http://localhost/api/operativo/pyr/pedidos?slug=${negocio.slug}`)
    const res = await getPedidosPyr(req)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.pedidos.length).toBe(3)
    const fechas = body.pedidos.map((p: { fecha: string }) => new Date(p.fecha).getTime())
    expect(fechas[0]).toBeGreaterThan(fechas[1])
    expect(fechas[1]).toBeGreaterThan(fechas[2])
  })

  test("2. Terminal GET /api/operaciones/pyr/panel devuelve NEW, MIDDLE, OLD (nunca FIFO)", async () => {
    const req = operativoRequest({ [TERMINAL_SESSION_COOKIE_NAME]: rawTerminalToken }, "http://localhost/api/operaciones/pyr/panel")
    const res = await getPanelPyr(req)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.pedidos.length).toBe(3)
    const fechas = body.pedidos.map((p: { fecha: string }) => new Date(p.fecha).getTime())
    expect(fechas[0]).toBeGreaterThan(fechas[1])
    expect(fechas[1]).toBeGreaterThan(fechas[2])
  })
})

// ---------------------------------------------------------------------------
// B. Workflow — Employee (CuentaOperativa personal), paridad con el modelo
// canónico de Negocio (aceptado antes de preparando, buscar-repartidor en
// vez de marcar en camino)
// ---------------------------------------------------------------------------

describe("P2-T42 — workflow canónico Employee PyR", () => {
  let negocio: { id: string; slug: string }
  let cuentaId: string
  let token: string
  const cuentasCreadas: string[] = []

  beforeAll(async () => {
    negocio = await crearNegocio()
    cuentaId = await crearCuentaOperativa()
    cuentasCreadas.push(cuentaId)
    await crearEmpleado(negocio.id, cuentaId, "pyr")
    token = await createOperationalSession(cuentaId)
  })

  afterAll(async () => {
    await db.sesion.deleteMany({ where: { userId: { in: cuentasCreadas } } })
    await limpiarNegocio(negocio.id)
    await db.cuentaOperativa.deleteMany({ where: { id: { in: cuentasCreadas } } })
  })

  test("1. domicilio: preparar directo desde recibido es DENEGADO (409) — el paso de aceptación es obligatorio", async () => {
    const pedidoId = await crearPedido({ negocioId: negocio.id, slug: negocio.slug, estado: "recibido", metodoEntrega: "domicilio" })
    const res = await postPreparar(postOperativo({ [OPERATIONAL_SESSION_COOKIE_NAME]: token }, pedidoId, negocio.slug, "preparar"), { params: Promise.resolve({ id: pedidoId }) })
    expect(res.status).toBe(409)
    expect((await db.pedido.findUniqueOrThrow({ where: { id: pedidoId } })).estado).toBe("recibido")
  })

  test("2. domicilio: aceptar → preparar → buscar-repartidor, cada paso muta al estado correcto", async () => {
    const pedidoId = await crearPedido({ negocioId: negocio.id, slug: negocio.slug, estado: "recibido", metodoEntrega: "domicilio" })

    const resAceptar = await postAceptar(postOperativo({ [OPERATIONAL_SESSION_COOKIE_NAME]: token }, pedidoId, negocio.slug, "aceptar"), { params: Promise.resolve({ id: pedidoId }) })
    expect(resAceptar.status).toBe(200)
    expect((await db.pedido.findUniqueOrThrow({ where: { id: pedidoId } })).estado).toBe("aceptado")

    const resPreparar = await postPreparar(postOperativo({ [OPERATIONAL_SESSION_COOKIE_NAME]: token }, pedidoId, negocio.slug, "preparar"), { params: Promise.resolve({ id: pedidoId }) })
    expect(resPreparar.status).toBe(200)
    expect((await db.pedido.findUniqueOrThrow({ where: { id: pedidoId } })).estado).toBe("preparando")

    const resBuscar = await postBuscarRepartidor(postOperativo({ [OPERATIONAL_SESSION_COOKIE_NAME]: token }, pedidoId, negocio.slug, "buscar-repartidor"), { params: Promise.resolve({ id: pedidoId }) })
    expect(resBuscar.status).toBe(200)
    expect((await db.pedido.findUniqueOrThrow({ where: { id: pedidoId } })).estado).toBe("esperando_repartidor")
  })

  test("3. retiro: buscar-repartidor es DENEGADO (409) — esa acción es exclusiva de domicilio", async () => {
    const pedidoId = await crearPedido({ negocioId: negocio.id, slug: negocio.slug, estado: "preparando", metodoEntrega: "retiro" })
    const res = await postBuscarRepartidor(postOperativo({ [OPERATIONAL_SESSION_COOKIE_NAME]: token }, pedidoId, negocio.slug, "buscar-repartidor"), { params: Promise.resolve({ id: pedidoId }) })
    expect(res.status).toBe(409)
    expect((await db.pedido.findUniqueOrThrow({ where: { id: pedidoId } })).estado).toBe("preparando")
  })

  test("4. retiro: aceptar → preparar → listo-para-retiro → entregar (paridad con Negocio, camino completo)", async () => {
    const pedidoId = await crearPedido({ negocioId: negocio.id, slug: negocio.slug, estado: "recibido", metodoEntrega: "retiro" })

    expect((await postAceptar(postOperativo({ [OPERATIONAL_SESSION_COOKIE_NAME]: token }, pedidoId, negocio.slug, "aceptar"), { params: Promise.resolve({ id: pedidoId }) })).status).toBe(200)
    expect((await postPreparar(postOperativo({ [OPERATIONAL_SESSION_COOKIE_NAME]: token }, pedidoId, negocio.slug, "preparar"), { params: Promise.resolve({ id: pedidoId }) })).status).toBe(200)
    expect((await postListoParaRetiro(postOperativo({ [OPERATIONAL_SESSION_COOKIE_NAME]: token }, pedidoId, negocio.slug, "listo-para-retiro"), { params: Promise.resolve({ id: pedidoId }) })).status).toBe(200)
    expect((await db.pedido.findUniqueOrThrow({ where: { id: pedidoId } })).estado).toBe("listo_para_retirar")

    // Sin confirmación real del cliente, la entrega sigue denegada (CAS exige clienteConfirmaRecibido:true).
    const resEntregarSinConfirmar = await postEntregar(postOperativo({ [OPERATIONAL_SESSION_COOKIE_NAME]: token }, pedidoId, negocio.slug, "entregar"), { params: Promise.resolve({ id: pedidoId }) })
    expect(resEntregarSinConfirmar.status).toBe(409)

    await db.pedido.update({ where: { id: pedidoId }, data: { clienteConfirmaRecibido: true } })
    const resEntregar = await postEntregar(postOperativo({ [OPERATIONAL_SESSION_COOKIE_NAME]: token }, pedidoId, negocio.slug, "entregar"), { params: Promise.resolve({ id: pedidoId }) })
    expect(resEntregar.status).toBe(200)
    expect((await db.pedido.findUniqueOrThrow({ where: { id: pedidoId } })).estado).toBe("entregado")
  })
})

// ---------------------------------------------------------------------------
// C. Workflow — Terminal Operativa PyR (canal genérico), paridad con Employee
// ---------------------------------------------------------------------------

describe("P2-T42 — workflow canónico Terminal PyR (paridad con Employee)", () => {
  let negocioA: { id: string; slug: string }
  let negocioB: { id: string; slug: string }
  let terminalId: string
  let terminalAjenoId: string
  let rawToken: string
  let rawTokenAjeno: string

  beforeAll(async () => {
    negocioA = await crearNegocio()
    negocioB = await crearNegocio()
    terminalId = await crearTerminal(negocioA.id, ["pyr"], ["pyr.ver", "pyr.pedidos.ver", "pyr.pedidos.gestionar"])
    terminalAjenoId = await crearTerminal(negocioB.id, ["pyr"], ["pyr.ver", "pyr.pedidos.ver", "pyr.pedidos.gestionar"])
    rawToken = await crearSesionTerminal(terminalId)
    rawTokenAjeno = await crearSesionTerminal(terminalAjenoId)
  })

  afterAll(async () => {
    await limpiarNegocio(negocioA.id)
    await limpiarNegocio(negocioB.id)
  })

  test("1. domicilio: aceptado → preparando → esperando_repartidor via PATCH genérico, mismos estados que Employee", async () => {
    const pedidoId = await crearPedido({ negocioId: negocioA.id, slug: negocioA.slug, estado: "recibido", metodoEntrega: "domicilio" })

    expect((await patchTerminalEstado(rawToken, pedidoId, { estado: "aceptado" })).status).toBe(200)
    expect((await db.pedido.findUniqueOrThrow({ where: { id: pedidoId } })).estado).toBe("aceptado")

    expect((await patchTerminalEstado(rawToken, pedidoId, { estado: "preparando" })).status).toBe(200)
    expect((await db.pedido.findUniqueOrThrow({ where: { id: pedidoId } })).estado).toBe("preparando")

    expect((await patchTerminalEstado(rawToken, pedidoId, { estado: "esperando_repartidor" })).status).toBe(200)
    expect((await db.pedido.findUniqueOrThrow({ where: { id: pedidoId } })).estado).toBe("esperando_repartidor")
  })

  test("2. BOLA/IDOR: Terminal de OTRO negocio no puede mutar este pedido (denegado, sin mutar)", async () => {
    const pedidoId = await crearPedido({ negocioId: negocioA.id, slug: negocioA.slug, estado: "recibido", metodoEntrega: "domicilio" })
    const res = await patchTerminalEstado(rawTokenAjeno, pedidoId, { estado: "aceptado" })
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect((await db.pedido.findUniqueOrThrow({ where: { id: pedidoId } })).estado).toBe("recibido")
  })

  test("3. cancelado desde aceptado sigue permitido vía Terminal (grafo rollout habilita cancelación en el estado nuevo)", async () => {
    const pedidoId = await crearPedido({ negocioId: negocioA.id, slug: negocioA.slug, estado: "aceptado", metodoEntrega: "domicilio" })
    const res = await patchTerminalEstado(rawToken, pedidoId, { estado: "cancelado", motivo: "sin stock" })
    expect(res.status).toBe(200)
    expect((await db.pedido.findUniqueOrThrow({ where: { id: pedidoId } })).estado).toBe("cancelado")
  })
})

// ---------------------------------------------------------------------------
// D. Autorización — sólo áreas/actores correctos ejecutan las acciones nuevas
// ---------------------------------------------------------------------------

describe("P2-T42 — autorización de las acciones nuevas (aceptar / buscar-repartidor)", () => {
  let negocio: { id: string; slug: string }
  let cuentaPyrId: string
  let cuentaSalonId: string
  let tokenPyr: string
  let tokenSalon: string
  const cuentasCreadas: string[] = []

  beforeAll(async () => {
    negocio = await crearNegocio()
    cuentaPyrId = await crearCuentaOperativa()
    cuentaSalonId = await crearCuentaOperativa()
    cuentasCreadas.push(cuentaPyrId, cuentaSalonId)
    await crearEmpleado(negocio.id, cuentaPyrId, "pyr")
    await crearEmpleado(negocio.id, cuentaSalonId, "salon")
    tokenPyr = await createOperationalSession(cuentaPyrId)
    tokenSalon = await createOperationalSession(cuentaSalonId)
  })

  afterAll(async () => {
    await db.sesion.deleteMany({ where: { userId: { in: cuentasCreadas } } })
    await limpiarNegocio(negocio.id)
    await db.cuentaOperativa.deleteMany({ where: { id: { in: cuentasCreadas } } })
  })

  test("1. área PyR autorizada puede aceptar (200)", async () => {
    const pedidoId = await crearPedido({ negocioId: negocio.id, slug: negocio.slug, estado: "recibido", metodoEntrega: "domicilio" })
    const res = await postAceptar(postOperativo({ [OPERATIONAL_SESSION_COOKIE_NAME]: tokenPyr }, pedidoId, negocio.slug, "aceptar"), { params: Promise.resolve({ id: pedidoId }) })
    expect(res.status).toBe(200)
  })

  test("2. área Salón (misma cuenta operativa, área distinta) NO puede aceptar un pedido PyR (403/estado inhabilitado)", async () => {
    const pedidoId = await crearPedido({ negocioId: negocio.id, slug: negocio.slug, estado: "recibido", metodoEntrega: "domicilio" })
    const res = await postAceptar(postOperativo({ [OPERATIONAL_SESSION_COOKIE_NAME]: tokenSalon }, pedidoId, negocio.slug, "aceptar"), { params: Promise.resolve({ id: pedidoId }) })
    expect(res.status).toBe(403)
    expect((await db.pedido.findUniqueOrThrow({ where: { id: pedidoId } })).estado).toBe("recibido")
  })
})
