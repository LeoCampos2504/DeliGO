/// <reference types="bun-types" />

// ============================================
// SEC-BLOCK-1 — Enforcement anti-evasión de ClienteBloqueado, contra
// PostgreSQL TESTING real (login / checkout / denuncias / desbloqueo).
// ============================================
// Nunca mockea Prisma. Prefijo `test-sec-block-1-`, cleanup obligatorio.
// Señal fuerte = deviceId (SEC-DEVICE-1) exacto. La IP nunca dispara un
// bloqueo por sí sola — varios tests acá prueban explícitamente eso.

import { randomUUID, createHash } from "crypto"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createSession, SESSION_COOKIE_NAME } from "@/lib/auth"
import { createSuperadminSession, SUPERADMIN_SESSION_COOKIE_NAME } from "@/lib/superadmin-auth"
import { DEVICE_COOKIE_NAME } from "@/lib/device-identity"
import { POST as registerRoute } from "@/app/api/auth/register/route"
import { POST as loginRoute } from "@/app/api/auth/login/route"
import { POST_FOR_TESTS as crearPedido } from "@/app/api/pedidos/route"
import { POST as denunciaRoute } from "@/app/api/denuncias/route"
import { POST as desbloquearRoute } from "@/app/api/superadmin/clientes/[id]/desbloquear/route"
import { GET as perfilRoute } from "@/app/api/cliente/perfil/route"

setDefaultTimeout(60_000)

const prefix = "test-sec-block-1-"
const BLOCKED_MESSAGE = "Tu cuenta ha sido bloqueada. Contactá a soporte para más información."

const clienteIds: string[] = []
const negocioIds: string[] = []
const superAdminIds: string[] = []

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}

function randomDeviceToken(): string {
  // Mismo formato que genera el helper real (43 caracteres base64url) —
  // sintético, nunca un token real capturado de tráfico.
  return Buffer.from(randomUUID() + randomUUID()).toString("base64url").slice(0, 43)
}

function extractSetCookie(res: Response, name: string): string | null {
  const all = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [res.headers.get("set-cookie") ?? ""]
  const match = all.find((c) => c.startsWith(`${name}=`))
  if (!match) return null
  return match.split(";")[0].split("=")[1] ?? null
}

async function ensureNegocio(suffix: string) {
  const negocio = await db.negocio.create({
    data: {
      nombre: `${prefix}${suffix}`,
      slug: `${prefix}${suffix}`,
      usuario: `${prefix}${suffix}`,
      email: `${prefix}${suffix}@example.test`,
      password: "fixture",
      aprobado: true,
      suspendido: false,
      horarioMode: "simple",
      abiertoManual: true,
      ofreceDelivery: false,
      ofreceRetiro: true,
    },
  })
  negocioIds.push(negocio.id)
  return negocio
}

async function ensureCliente(suffix: string, extra: Partial<{ dispositivoFingerprint: string; bloqueado: boolean; ultimoIp: string }> = {}) {
  const cliente = await db.cliente.create({
    data: {
      nombre: `${prefix}${suffix}`,
      email: `${prefix}${suffix}@example.test`,
      telefono: "",
      password: "fixture-not-real-hash",
      emailVerified: new Date(),
      dispositivoFingerprint: extra.dispositivoFingerprint ?? "",
      bloqueado: extra.bloqueado ?? false,
      bloqueadoFecha: extra.bloqueado ? new Date() : null,
      ultimoIp: extra.ultimoIp ?? "",
    },
  })
  clienteIds.push(cliente.id)
  return cliente
}

async function ensureSuperAdmin(suffix: string) {
  const admin = await db.superAdmin.create({
    data: {
      email: `${prefix}${suffix}@example.test`,
      googleSub: `${prefix}googlesub-${suffix}-${randomUUID()}`,
      activo: true,
    },
  })
  superAdminIds.push(admin.id)
  return admin
}

async function ensureProducto(negocioId: string) {
  const producto = await db.producto.create({ data: { nombre: `${prefix}producto`, precio: 100, negocioId } })
  return producto.id
}

async function ensureOrphanBlockRecord(fingerprint: string, ip = "") {
  return db.clienteBloqueado.create({
    data: { clienteId: null, clienteNombre: `${prefix}orphan`, fingerprint, ip },
  })
}

function pedidoBody(params: { negocioId: string; productoId: string }) {
  return {
    negocioId: params.negocioId,
    items: [{ productoId: params.productoId, cantidad: 1, agregados: [], secciones: {}, ingredientesQuitados: [], talle: "", color: "" }],
    metodoEntrega: "retiro",
    metodoPago: "efectivo",
    notas: null,
    direccion: null,
    referencia: null,
    lat: null,
    lng: null,
    mesaId: null,
    mesaNumero: null,
    empleadoCodigo: null,
    mesaGeolocation: null,
  }
}

function reqPedido(
  body: unknown,
  opts: { sessionToken?: string; deviceCookie?: string; bodyFingerprint?: string; ip?: string } = {}
): NextRequest {
  const cookies: string[] = []
  if (opts.sessionToken) cookies.push(`${SESSION_COOKIE_NAME}=${opts.sessionToken}`)
  if (opts.deviceCookie) cookies.push(`${DEVICE_COOKIE_NAME}=${opts.deviceCookie}`)
  const finalBody = opts.bodyFingerprint ? { ...(body as object), fingerprint: opts.bodyFingerprint } : body
  return new NextRequest("http://localhost/api/pedidos", {
    method: "POST",
    body: JSON.stringify(finalBody),
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": opts.ip ?? randomUUID(),
      ...(cookies.length ? { cookie: cookies.join("; ") } : {}),
    },
  })
}

function reqRegister(email: string, opts: { deviceCookie?: string; ip?: string } = {}): NextRequest {
  return new NextRequest("http://localhost/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ tipo: "cliente", termsAccepted: "true", nombre: `${prefix}reg`, email, password: "password123" }),
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": opts.ip ?? randomUUID(),
      ...(opts.deviceCookie ? { cookie: `${DEVICE_COOKIE_NAME}=${opts.deviceCookie}` } : {}),
    },
  })
}

function reqLogin(email: string, password: string, opts: { deviceCookie?: string; ip?: string } = {}): NextRequest {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ tipo: "cliente", email, password }),
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": opts.ip ?? randomUUID(),
      ...(opts.deviceCookie ? { cookie: `${DEVICE_COOKIE_NAME}=${opts.deviceCookie}` } : {}),
    },
  })
}

function reqDenuncia(cookie: string, body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/denuncias", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", "x-forwarded-for": randomUUID(), cookie },
  })
}

function reqDesbloquear(clienteId: string, cookie: string): NextRequest {
  return new NextRequest(`http://localhost/api/superadmin/clientes/${clienteId}/desbloquear`, {
    method: "POST",
    headers: { cookie },
  })
}

function reqPerfil(cookie: string): NextRequest {
  return new NextRequest("http://localhost/api/cliente/perfil", { headers: { cookie } })
}

async function cookieForCliente(clienteId: string) {
  const token = await createSession(clienteId, "cliente")
  return `${SESSION_COOKIE_NAME}=${token}`
}

async function cookieForNegocio(negocioId: string) {
  const token = await createSession(negocioId, "negocio")
  return `${SESSION_COOKIE_NAME}=${token}`
}

async function cookieForSuperadmin(superAdminId: string) {
  const token = await createSuperadminSession(superAdminId)
  return `${SUPERADMIN_SESSION_COOKIE_NAME}=${token}`
}

async function ensurePedidoRealizado(params: { clienteId: string; negocioId: string }) {
  return db.pedido.create({
    data: {
      negocioId: params.negocioId,
      negocioSlug: `${prefix}negocio`,
      negocioNombre: `${prefix}negocio`,
      clienteId: params.clienteId,
      clienteNombre: `${prefix}cliente`,
      total: 100,
      totalProductos: 100,
      metodoEntrega: "retiro",
      estado: "recibido",
    },
  })
}

async function cleanup() {
  await db.denuncia.deleteMany({ where: { OR: [{ clienteId: { in: clienteIds } }, { negocioId: { in: negocioIds } }] } })
  await db.pedido.deleteMany({ where: { OR: [{ negocioId: { in: negocioIds } }, { clienteId: { in: clienteIds } }] } })
  await db.clienteBloqueado.deleteMany({ where: { clienteNombre: { startsWith: prefix } } })
  await db.producto.deleteMany({ where: { negocioId: { in: negocioIds } } })
  await db.negocio.deleteMany({ where: { id: { in: negocioIds } } })
  if (clienteIds.length) {
    await db.sesion.deleteMany({ where: { userId: { in: clienteIds } } })
  }
  await db.cliente.deleteMany({ where: { email: { startsWith: prefix } } })
  if (superAdminIds.length) {
    await db.sesion.deleteMany({ where: { userId: { in: superAdminIds } } })
  }
  await db.superAdmin.deleteMany({ where: { email: { startsWith: prefix } } })
}

beforeAll(cleanup)

afterAll(async () => {
  await cleanup()
  const remainingClientes = await db.cliente.count({ where: { email: { startsWith: prefix } } })
  const remainingNegocios = await db.negocio.count({ where: { id: { in: negocioIds } } })
  const remainingBlocks = await db.clienteBloqueado.count({ where: { clienteNombre: { startsWith: prefix } } })
  const remainingSuperAdmins = await db.superAdmin.count({ where: { email: { startsWith: prefix } } })
  expect(remainingClientes).toBe(0)
  expect(remainingNegocios).toBe(0)
  expect(remainingBlocks).toBe(0)
  expect(remainingSuperAdmins).toBe(0)
})

describe("SEC-BLOCK-1 — Login de cuenta ya bloqueada", () => {
  test("sigue devolviendo 200 y crea sesión, pero enriquece ClienteBloqueado con el dispositivo actual", async () => {
    const { hashPassword } = await import("@/lib/auth")
    const cliente = await ensureCliente(`login-blocked-${randomUUID()}`, { bloqueado: true })
    await db.cliente.update({ where: { id: cliente.id }, data: { password: await hashPassword("password123") } })
    const deviceToken = randomDeviceToken()

    const res = await loginRoute(reqLogin(cliente.email, "password123", { deviceCookie: deviceToken }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)

    const row = await db.clienteBloqueado.findFirst({
      where: { clienteId: cliente.id, fingerprint: sha256Hex(deviceToken) },
    })
    expect(row).not.toBeNull()

    // La cuenta sigue bloqueada exactamente igual que antes (el login nunca desbloquea).
    const after = await db.cliente.findUnique({ where: { id: cliente.id } })
    expect(after?.bloqueado).toBe(true)
  })

  test("login normal (cuenta NO bloqueada) nunca crea filas ClienteBloqueado", async () => {
    const { hashPassword } = await import("@/lib/auth")
    const cliente = await ensureCliente(`login-normal-${randomUUID()}`)
    await db.cliente.update({ where: { id: cliente.id }, data: { password: await hashPassword("password123") } })

    const res = await loginRoute(reqLogin(cliente.email, "password123", { deviceCookie: randomDeviceToken() }))
    expect(res.status).toBe(200)

    const count = await db.clienteBloqueado.count({ where: { clienteId: cliente.id } })
    expect(count).toBe(0)
  })
})

describe("SEC-BLOCK-1 — Checkout de cuenta ya bloqueada", () => {
  test("403 igual que antes, enriquece el registro del dispositivo actual y setea la cookie si es nueva", async () => {
    const negocio = await ensureNegocio(`chk-blocked-${randomUUID()}`)
    const productoId = await ensureProducto(negocio.id)
    const cliente = await ensureCliente(`chk-blocked-${randomUUID()}`, { bloqueado: true })
    const sessionToken = await createSession(cliente.id, "cliente")

    const res = await crearPedido(
      reqPedido(pedidoBody({ negocioId: negocio.id, productoId }), { sessionToken }),
      {}
    )
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe(BLOCKED_MESSAGE)

    const setToken = extractSetCookie(res, DEVICE_COOKIE_NAME)
    expect(setToken).not.toBeNull()

    const row = await db.clienteBloqueado.findFirst({
      where: { clienteId: cliente.id, fingerprint: sha256Hex(setToken!) },
    })
    expect(row).not.toBeNull()

    // Nunca se crea un Pedido para una cuenta bloqueada.
    const pedidosCount = await db.pedido.count({ where: { clienteId: cliente.id } })
    expect(pedidosCount).toBe(0)
  })
})

describe("SEC-BLOCK-1 — Auto-bloqueo por evasión de dispositivo", () => {
  test("cuenta nueva desde un dispositivo huérfano (cuenta eliminada) ya bloqueado: 403 en el primer pedido, misma respuesta genérica", async () => {
    const negocio = await ensureNegocio(`evasion-orphan-${randomUUID()}`)
    const productoId = await ensureProducto(negocio.id)
    const deviceToken = randomDeviceToken()
    await ensureOrphanBlockRecord(sha256Hex(deviceToken))

    const cliente = await ensureCliente(`evasion-orphan-${randomUUID()}`)
    const sessionToken = await createSession(cliente.id, "cliente")

    const res = await crearPedido(
      reqPedido(pedidoBody({ negocioId: negocio.id, productoId }), { sessionToken, deviceCookie: deviceToken }),
      {}
    )
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe(BLOCKED_MESSAGE)

    const after = await db.cliente.findUnique({ where: { id: cliente.id } })
    expect(after?.bloqueado).toBe(true)
    expect(after?.bloqueadoFecha).not.toBeNull()

    const linkedRow = await db.clienteBloqueado.findFirst({
      where: { clienteId: cliente.id, fingerprint: sha256Hex(deviceToken) },
    })
    expect(linkedRow).not.toBeNull()

    const pedidosCount = await db.pedido.count({ where: { clienteId: cliente.id } })
    expect(pedidosCount).toBe(0)
  })

  test("cuenta nueva desde un dispositivo vinculado a OTRA cuenta ya bloqueada: auto-bloqueo también", async () => {
    const negocio = await ensureNegocio(`evasion-cross-${randomUUID()}`)
    const productoId = await ensureProducto(negocio.id)
    const deviceToken = randomDeviceToken()

    const clienteOriginal = await ensureCliente(`evasion-cross-orig-${randomUUID()}`, { bloqueado: true })
    await db.clienteBloqueado.create({
      data: {
        clienteId: clienteOriginal.id,
        clienteNombre: clienteOriginal.nombre,
        fingerprint: sha256Hex(deviceToken),
        ip: "",
      },
    })

    const clienteEvasor = await ensureCliente(`evasion-cross-nuevo-${randomUUID()}`)
    const sessionToken = await createSession(clienteEvasor.id, "cliente")

    const res = await crearPedido(
      reqPedido(pedidoBody({ negocioId: negocio.id, productoId }), { sessionToken, deviceCookie: deviceToken }),
      {}
    )
    expect(res.status).toBe(403)

    const after = await db.cliente.findUnique({ where: { id: clienteEvasor.id } })
    expect(after?.bloqueado).toBe(true)

    // La cuenta original nunca se toca por el auto-bloqueo de la nueva.
    const original = await db.cliente.findUnique({ where: { id: clienteOriginal.id } })
    expect(original?.bloqueado).toBe(true)
  })

  test("dispositivo compartido pero SIN ninguna fila ClienteBloqueado previa: ninguna de las dos cuentas se bloquea", async () => {
    const negocio = await ensureNegocio(`shared-nomatch-${randomUUID()}`)
    const productoId = await ensureProducto(negocio.id)
    const sharedDevice = randomDeviceToken()

    const clienteA = await ensureCliente(`shared-nomatch-a-${randomUUID()}`)
    const clienteB = await ensureCliente(`shared-nomatch-b-${randomUUID()}`)
    const tokenA = await createSession(clienteA.id, "cliente")
    const tokenB = await createSession(clienteB.id, "cliente")

    const resA = await crearPedido(
      reqPedido(pedidoBody({ negocioId: negocio.id, productoId }), { sessionToken: tokenA, deviceCookie: sharedDevice }),
      {}
    )
    expect(resA.status).toBe(201)
    const resB = await crearPedido(
      reqPedido(pedidoBody({ negocioId: negocio.id, productoId }), { sessionToken: tokenB, deviceCookie: sharedDevice }),
      {}
    )
    expect(resB.status).toBe(201)

    const afterA = await db.cliente.findUnique({ where: { id: clienteA.id } })
    const afterB = await db.cliente.findUnique({ where: { id: clienteB.id } })
    expect(afterA?.bloqueado).toBe(false)
    expect(afterB?.bloqueado).toBe(false)
  })
})

describe("SEC-BLOCK-1 — IP nunca dispara un bloqueo por sí sola", () => {
  test("misma IP, fingerprints DISTINTOS, uno de los dos bloqueado: la cuenta nueva con dispositivo propio nunca se bloquea", async () => {
    const negocio = await ensureNegocio(`ip-only-${randomUUID()}`)
    const productoId = await ensureProducto(negocio.id)
    const sharedIp = randomUUID()

    // Bloqueado por IP (fila ip-only, fingerprint vacío) — mismo patrón que
    // ya crea src/app/api/denuncias/route.ts cuando dispositivoFingerprint
    // está vacío.
    const clienteBloqueadoPorIp = await ensureCliente(`ip-only-blocked-${randomUUID()}`, { bloqueado: true, ultimoIp: sharedIp })
    await db.clienteBloqueado.create({
      data: { clienteId: clienteBloqueadoPorIp.id, clienteNombre: clienteBloqueadoPorIp.nombre, fingerprint: "", ip: sharedIp },
    })

    const clienteLegitimo = await ensureCliente(`ip-only-legit-${randomUUID()}`)
    const sessionToken = await createSession(clienteLegitimo.id, "cliente")

    const res = await crearPedido(
      reqPedido(pedidoBody({ negocioId: negocio.id, productoId }), {
        sessionToken,
        deviceCookie: randomDeviceToken(),
        ip: sharedIp,
      }),
      {}
    )
    expect(res.status).toBe(201)

    const after = await db.cliente.findUnique({ where: { id: clienteLegitimo.id } })
    expect(after?.bloqueado).toBe(false)
  })

  test("mismo fingerprint pero IP DISTINTA: sí bloquea (la señal fuerte es el dispositivo, nunca la IP)", async () => {
    const negocio = await ensureNegocio(`device-diffip-${randomUUID()}`)
    const productoId = await ensureProducto(negocio.id)
    const deviceToken = randomDeviceToken()
    await ensureOrphanBlockRecord(sha256Hex(deviceToken), randomUUID())

    const cliente = await ensureCliente(`device-diffip-${randomUUID()}`)
    const sessionToken = await createSession(cliente.id, "cliente")

    const res = await crearPedido(
      reqPedido(pedidoBody({ negocioId: negocio.id, productoId }), {
        sessionToken,
        deviceCookie: deviceToken,
        ip: randomUUID(), // deliberadamente una IP distinta a la de la fila original
      }),
      {}
    )
    expect(res.status).toBe(403)

    const after = await db.cliente.findUnique({ where: { id: cliente.id } })
    expect(after?.bloqueado).toBe(true)
  })
})

describe("SEC-BLOCK-1 — body.fingerprint spoofed sigue sin tener ningún efecto", () => {
  test("un body.fingerprint arbitrario no evade la detección ni cambia qué cuenta se bloquea", async () => {
    const negocio = await ensureNegocio(`spoof-block-${randomUUID()}`)
    const productoId = await ensureProducto(negocio.id)
    const deviceToken = randomDeviceToken()
    await ensureOrphanBlockRecord(sha256Hex(deviceToken))

    const cliente = await ensureCliente(`spoof-block-${randomUUID()}`)
    const sessionToken = await createSession(cliente.id, "cliente")

    const res = await crearPedido(
      reqPedido(pedidoBody({ negocioId: negocio.id, productoId }), {
        sessionToken,
        deviceCookie: deviceToken,
        bodyFingerprint: "ATTACKER_CONTROLLED_VALUE",
      }),
      {}
    )
    expect(res.status).toBe(403)
  })
})

describe("SEC-BLOCK-1 — Registro no cambia de comportamiento", () => {
  test("registrar una cuenta nueva desde un dispositivo ya vinculado a un bloqueo: el registro sigue permitido (200), sin bloquear en ese momento", async () => {
    const deviceToken = randomDeviceToken()
    await ensureOrphanBlockRecord(sha256Hex(deviceToken))
    const email = `${prefix}reg-evasion-${randomUUID()}@example.test`

    const res = await registerRoute(reqRegister(email, { deviceCookie: deviceToken }))
    expect(res.status).toBe(200)

    const cliente = await db.cliente.findUnique({ where: { email } })
    clienteIds.push(cliente!.id)
    expect(cliente?.bloqueado).toBe(false)
  })
})

describe("SEC-BLOCK-1 — Recuperación/desbloqueo por Superadmin", () => {
  test("desbloqueo borra todas las filas del cliente + las de fingerprint compartido en otras cuentas, preserva bloqueos no relacionados", async () => {
    const superAdmin = await ensureSuperAdmin(`unblock-${randomUUID()}`)
    const superAdminCookie = await cookieForSuperadmin(superAdmin.id)

    const sharedDevice = randomDeviceToken()
    const clienteA = await ensureCliente(`unblock-a-${randomUUID()}`, { bloqueado: true, dispositivoFingerprint: sha256Hex(sharedDevice) })
    await db.clienteBloqueado.create({
      data: { clienteId: clienteA.id, clienteNombre: clienteA.nombre, fingerprint: sha256Hex(sharedDevice), ip: "" },
    })
    // Fila huérfana vieja del mismo dispositivo (p. ej. de una cuenta eliminada previa).
    await ensureOrphanBlockRecord(sha256Hex(sharedDevice))
    // Fila histórica ip-only de A con un valor de IP viejo, distinto al actual.
    await db.clienteBloqueado.create({
      data: { clienteId: clienteA.id, clienteNombre: clienteA.nombre, fingerprint: "", ip: "203.0.113.7" },
    })

    // Cliente no relacionado — nunca debe tocarse.
    const clienteNoRelacionado = await ensureCliente(`unblock-unrelated-${randomUUID()}`, { bloqueado: true, dispositivoFingerprint: sha256Hex(randomDeviceToken()) })
    await db.clienteBloqueado.create({
      data: { clienteId: clienteNoRelacionado.id, clienteNombre: clienteNoRelacionado.nombre, fingerprint: clienteNoRelacionado.dispositivoFingerprint, ip: "" },
    })

    const res = await desbloquearRoute(reqDesbloquear(clienteA.id, superAdminCookie), { params: Promise.resolve({ id: clienteA.id }) })
    expect(res.status).toBe(200)

    const afterA = await db.cliente.findUnique({ where: { id: clienteA.id } })
    expect(afterA?.bloqueado).toBe(false)
    expect(afterA?.bloqueadoFecha).toBeNull()

    const remainingForA = await db.clienteBloqueado.count({ where: { clienteId: clienteA.id } })
    expect(remainingForA).toBe(0)
    const remainingOrphanForDevice = await db.clienteBloqueado.count({ where: { fingerprint: sha256Hex(sharedDevice) } })
    expect(remainingOrphanForDevice).toBe(0)

    const unrelated = await db.clienteBloqueado.findFirst({ where: { clienteId: clienteNoRelacionado.id } })
    expect(unrelated).not.toBeNull()
    const unrelatedCliente = await db.cliente.findUnique({ where: { id: clienteNoRelacionado.id } })
    expect(unrelatedCliente?.bloqueado).toBe(true)
  })

  test("tras el desbloqueo, un nuevo pedido desde el mismo dispositivo ya NO re-bloquea automáticamente", async () => {
    const superAdmin = await ensureSuperAdmin(`postunblock-${randomUUID()}`)
    const superAdminCookie = await cookieForSuperadmin(superAdmin.id)
    const negocio = await ensureNegocio(`postunblock-${randomUUID()}`)
    const productoId = await ensureProducto(negocio.id)
    const deviceToken = randomDeviceToken()

    const clienteBloqueado = await ensureCliente(`postunblock-orig-${randomUUID()}`, { bloqueado: true, dispositivoFingerprint: sha256Hex(deviceToken) })
    await db.clienteBloqueado.create({
      data: { clienteId: clienteBloqueado.id, clienteNombre: clienteBloqueado.nombre, fingerprint: sha256Hex(deviceToken), ip: "" },
    })

    const clienteNuevo = await ensureCliente(`postunblock-nuevo-${randomUUID()}`)
    const sessionTokenNuevo = await createSession(clienteNuevo.id, "cliente")

    const resBloqueado = await crearPedido(
      reqPedido(pedidoBody({ negocioId: negocio.id, productoId }), { sessionToken: sessionTokenNuevo, deviceCookie: deviceToken }),
      {}
    )
    expect(resBloqueado.status).toBe(403)
    expect((await db.cliente.findUnique({ where: { id: clienteNuevo.id } }))?.bloqueado).toBe(true)

    // Superadmin desbloquea la cuenta ORIGINAL (fuente del match) — esto
    // limpia también la fila de fingerprint compartido creada por la evasión.
    const desbloqueoOriginal = await desbloquearRoute(reqDesbloquear(clienteBloqueado.id, superAdminCookie), { params: Promise.resolve({ id: clienteBloqueado.id }) })
    expect(desbloqueoOriginal.status).toBe(200)
    const desbloqueoNuevo = await desbloquearRoute(reqDesbloquear(clienteNuevo.id, superAdminCookie), { params: Promise.resolve({ id: clienteNuevo.id }) })
    expect(desbloqueoNuevo.status).toBe(200)

    const resSegundoIntento = await crearPedido(
      reqPedido(pedidoBody({ negocioId: negocio.id, productoId }), { sessionToken: sessionTokenNuevo, deviceCookie: deviceToken }),
      {}
    )
    expect(resSegundoIntento.status).toBe(201)
    expect((await db.cliente.findUnique({ where: { id: clienteNuevo.id } }))?.bloqueado).toBe(false)
  })
})

describe("SEC-BLOCK-1 — Aislamiento entre clientes", () => {
  test("cliente con dispositivo/IP totalmente distintos nunca se ve afectado por el bloqueo de otro", async () => {
    const negocio = await ensureNegocio(`isolation-${randomUUID()}`)
    const productoId = await ensureProducto(negocio.id)
    await ensureOrphanBlockRecord(sha256Hex(randomDeviceToken()))

    const clienteAjeno = await ensureCliente(`isolation-${randomUUID()}`)
    const sessionToken = await createSession(clienteAjeno.id, "cliente")

    const res = await crearPedido(
      reqPedido(pedidoBody({ negocioId: negocio.id, productoId }), { sessionToken, deviceCookie: randomDeviceToken() }),
      {}
    )
    expect(res.status).toBe(201)
    expect((await db.cliente.findUnique({ where: { id: clienteAjeno.id } }))?.bloqueado).toBe(false)
  })
})

describe("SEC-BLOCK-1 — Regresión: denuncias siguen bloqueando con fingerprint real", () => {
  test("3 denuncias reales bloquean al cliente y su fingerprint real dispara la detección de evasión en una cuenta nueva", async () => {
    const negocio = await ensureNegocio(`denuncia-regresion-${randomUUID()}`)
    const negocioCookie = await cookieForNegocio(negocio.id)
    const productoId = await ensureProducto(negocio.id)
    const deviceToken = randomDeviceToken()

    const clienteDenunciado = await ensureCliente(`denuncia-regresion-${randomUUID()}`)
    const sessionToken = await createSession(clienteDenunciado.id, "cliente")

    // Genera 3 pedidos reales (fija el fingerprint real vía checkout, igual
    // que en producción) para poder denunciar cada uno.
    const pedidoIds: string[] = []
    for (let i = 0; i < 3; i++) {
      const res = await crearPedido(
        reqPedido(pedidoBody({ negocioId: negocio.id, productoId }), { sessionToken, deviceCookie: deviceToken }),
        {}
      )
      expect(res.status).toBe(201)
      const pedido = await res.json()
      pedidoIds.push(pedido.id)
    }

    let lastRes
    for (const pedidoId of pedidoIds) {
      lastRes = await denunciaRoute(
        reqDenuncia(negocioCookie, { clienteId: clienteDenunciado.id, pedidoId, motivoTipo: "comportamiento", motivo: `${prefix}motivo` })
      )
    }
    expect(lastRes!.status).toBe(201)
    const lastBody = await lastRes!.json()
    expect(lastBody.bloqueado).toBe(true)

    const clienteFinal = await db.cliente.findUnique({ where: { id: clienteDenunciado.id } })
    expect(clienteFinal?.bloqueado).toBe(true)
    expect(clienteFinal?.dispositivoFingerprint).toBe(sha256Hex(deviceToken))

    const fpRow = await db.clienteBloqueado.findFirst({ where: { clienteId: clienteDenunciado.id, fingerprint: sha256Hex(deviceToken) } })
    expect(fpRow).not.toBeNull()

    // El mismo fingerprint real (creado por denuncias, no por SEC-BLOCK-1)
    // dispara la detección de evasión para una cuenta nueva.
    const clienteEvasor = await ensureCliente(`denuncia-regresion-evasor-${randomUUID()}`)
    const sessionEvasor = await createSession(clienteEvasor.id, "cliente")
    const resEvasion = await crearPedido(
      reqPedido(pedidoBody({ negocioId: negocio.id, productoId }), { sessionToken: sessionEvasor, deviceCookie: deviceToken }),
      {}
    )
    expect(resEvasion.status).toBe(403)
    expect((await db.cliente.findUnique({ where: { id: clienteEvasor.id } }))?.bloqueado).toBe(true)
  })
})

describe("SEC-BLOCK-1 — La sesión sobrevive al bloqueo, ningún pedido previo se toca", () => {
  test("GET /api/cliente/perfil sigue devolviendo 200 después del auto-bloqueo (sin invalidar la sesión)", async () => {
    const negocio = await ensureNegocio(`session-survives-${randomUUID()}`)
    const productoId = await ensureProducto(negocio.id)
    const deviceToken = randomDeviceToken()
    await ensureOrphanBlockRecord(sha256Hex(deviceToken))

    const cliente = await ensureCliente(`session-survives-${randomUUID()}`)
    const sessionToken = await createSession(cliente.id, "cliente")
    const cookie = `${SESSION_COOKIE_NAME}=${sessionToken}`

    const resPedido = await crearPedido(
      reqPedido(pedidoBody({ negocioId: negocio.id, productoId }), { sessionToken, deviceCookie: deviceToken }),
      {}
    )
    expect(resPedido.status).toBe(403)

    const resPerfil = await perfilRoute(reqPerfil(cookie))
    expect(resPerfil.status).toBe(200)
    const perfilBody = await resPerfil.json()
    expect(perfilBody.ok).toBe(true)
  })

  test("un pedido previo del cliente no se toca cuando la cuenta se bloquea después por evasión en un negocio distinto", async () => {
    const negocioOriginal = await ensureNegocio(`prev-order-orig-${randomUUID()}`)
    const productoOriginal = await ensureProducto(negocioOriginal.id)
    const negocioEvasion = await ensureNegocio(`prev-order-evasion-${randomUUID()}`)
    const productoEvasion = await ensureProducto(negocioEvasion.id)
    const deviceToken = randomDeviceToken()

    const cliente = await ensureCliente(`prev-order-${randomUUID()}`)
    const sessionToken = await createSession(cliente.id, "cliente")

    const resPrimero = await crearPedido(
      reqPedido(pedidoBody({ negocioId: negocioOriginal.id, productoId: productoOriginal }), { sessionToken, deviceCookie: deviceToken }),
      {}
    )
    expect(resPrimero.status).toBe(201)
    const pedidoPrevio = await resPrimero.json()

    // Ahora el mismo dispositivo queda vinculado a un bloqueo ajeno.
    await ensureOrphanBlockRecord(sha256Hex(deviceToken))

    const resSegundo = await crearPedido(
      reqPedido(pedidoBody({ negocioId: negocioEvasion.id, productoId: productoEvasion }), { sessionToken, deviceCookie: deviceToken }),
      {}
    )
    expect(resSegundo.status).toBe(403)

    const pedidoPrevioDespues = await db.pedido.findUnique({ where: { id: pedidoPrevio.id } })
    expect(pedidoPrevioDespues).not.toBeNull()
    expect(pedidoPrevioDespues?.estado).toBe("recibido")
    expect(pedidoPrevioDespues?.clienteId).toBe(cliente.id)
  })
})

describe("SEC-BLOCK-1 — Indistinguibilidad de la respuesta bloqueada", () => {
  test("bloqueo preexistente y bloqueo por evasión devuelven exactamente el mismo status/shape/mensaje", async () => {
    const negocio = await ensureNegocio(`indistinguish-${randomUUID()}`)
    const productoId = await ensureProducto(negocio.id)

    const clientePreexistente = await ensureCliente(`indistinguish-pre-${randomUUID()}`, { bloqueado: true })
    const sessionPre = await createSession(clientePreexistente.id, "cliente")
    const resPre = await crearPedido(
      reqPedido(pedidoBody({ negocioId: negocio.id, productoId }), { sessionToken: sessionPre, deviceCookie: randomDeviceToken() }),
      {}
    )

    const deviceEvasion = randomDeviceToken()
    await ensureOrphanBlockRecord(sha256Hex(deviceEvasion))
    const clienteEvasion = await ensureCliente(`indistinguish-evasion-${randomUUID()}`)
    const sessionEvasion = await createSession(clienteEvasion.id, "cliente")
    const resEvasion = await crearPedido(
      reqPedido(pedidoBody({ negocioId: negocio.id, productoId }), { sessionToken: sessionEvasion, deviceCookie: deviceEvasion }),
      {}
    )

    expect(resPre.status).toBe(resEvasion.status)
    expect(resPre.status).toBe(403)
    const bodyPre = await resPre.json()
    const bodyEvasion = await resEvasion.json()
    expect(bodyPre).toEqual(bodyEvasion)
    expect(Object.keys(bodyPre).sort()).toEqual(["error"])
  })
})
