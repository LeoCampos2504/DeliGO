/// <reference types="bun-types" />

// ============================================
// SEC-DEVICE-1 — Identidad de dispositivo server-managed, contra PostgreSQL
// TESTING real (register / login / checkout).
// ============================================
// Nunca mockea Prisma. Prefijo `test-sec-device-1-`, cleanup obligatorio.
// Nunca imprime un token/hash real — sólo aserciones de formato/igualdad.

import { randomUUID, createHash } from "crypto"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createSession, SESSION_COOKIE_NAME } from "@/lib/auth"
import { DEVICE_COOKIE_NAME } from "@/lib/device-identity"
import { POST as registerRoute } from "@/app/api/auth/register/route"
import { POST as loginRoute } from "@/app/api/auth/login/route"
import { POST_FOR_TESTS as crearPedido } from "@/app/api/pedidos/route"

setDefaultTimeout(60_000)

const prefix = "test-sec-device-1-"
const clienteIds: string[] = []
const negocioIds: string[] = []

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}

function randomDeviceToken(): string {
  // Mismo formato que genera el helper real (43 caracteres base64url) —
  // sintético, nunca un token real capturado de tráfico.
  return Buffer.from(randomUUID() + randomUUID()).toString("base64url").slice(0, 43)
}

function extractSetCookie(res: Response, name: string): string | null {
  // Bun/undici exponen múltiples Set-Cookie vía getSetCookie(); fallback a
  // el header único por si el runtime no lo soporta.
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

async function ensureCliente(suffix: string, dispositivoFingerprint = "") {
  const cliente = await db.cliente.create({
    data: {
      nombre: `${prefix}${suffix}`,
      email: `${prefix}${suffix}@example.test`,
      telefono: "",
      password: "fixture-not-real-hash",
      emailVerified: new Date(),
      dispositivoFingerprint,
    },
  })
  clienteIds.push(cliente.id)
  return cliente
}

async function ensureProducto(negocioId: string) {
  const producto = await db.producto.create({ data: { nombre: `${prefix}producto`, precio: 100, negocioId } })
  return producto.id
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

function reqPedido(body: unknown, opts: { sessionToken?: string; deviceCookie?: string; bodyFingerprint?: string } = {}): NextRequest {
  const cookies: string[] = []
  if (opts.sessionToken) cookies.push(`${SESSION_COOKIE_NAME}=${opts.sessionToken}`)
  if (opts.deviceCookie) cookies.push(`${DEVICE_COOKIE_NAME}=${opts.deviceCookie}`)
  const finalBody = opts.bodyFingerprint ? { ...(body as object), fingerprint: opts.bodyFingerprint } : body
  return new NextRequest("http://localhost/api/pedidos", {
    method: "POST",
    body: JSON.stringify(finalBody),
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": randomUUID(),
      ...(cookies.length ? { cookie: cookies.join("; ") } : {}),
    },
  })
}

function reqRegister(email: string, deviceCookie?: string): NextRequest {
  return new NextRequest("http://localhost/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ tipo: "cliente", termsAccepted: "true", nombre: `${prefix}reg`, email, password: "password123" }),
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": randomUUID(),
      ...(deviceCookie ? { cookie: `${DEVICE_COOKIE_NAME}=${deviceCookie}` } : {}),
    },
  })
}

function reqLogin(email: string, password: string, deviceCookie?: string): NextRequest {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ tipo: "cliente", email, password }),
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": randomUUID(),
      ...(deviceCookie ? { cookie: `${DEVICE_COOKIE_NAME}=${deviceCookie}` } : {}),
    },
  })
}

async function cleanup() {
  await db.pedido.deleteMany({ where: { negocioId: { in: negocioIds } } })
  await db.producto.deleteMany({ where: { negocioId: { in: negocioIds } } })
  await db.negocio.deleteMany({ where: { id: { in: negocioIds } } })
  if (clienteIds.length) {
    await db.sesion.deleteMany({ where: { userId: { in: clienteIds } } })
  }
  await db.cliente.deleteMany({ where: { email: { startsWith: prefix } } })
}

beforeAll(cleanup)

afterAll(async () => {
  await cleanup()
  const remainingClientes = await db.cliente.count({ where: { email: { startsWith: prefix } } })
  const remainingNegocios = await db.negocio.count({ where: { id: { in: negocioIds } } })
  expect(remainingClientes).toBe(0)
  expect(remainingNegocios).toBe(0)
})

describe("SEC-DEVICE-1 — Register", () => {
  test("sin device cookie: responde normalmente, setea cookie nueva, Cliente recibe el hash derivado (nunca el token crudo)", async () => {
    const email = `${prefix}reg-${randomUUID()}@example.test`
    const res = await registerRoute(reqRegister(email))
    expect(res.status).toBe(200)

    const setToken = extractSetCookie(res, DEVICE_COOKIE_NAME)
    expect(setToken).not.toBeNull()
    expect(setToken).toMatch(/^[A-Za-z0-9_-]{43}$/)

    const cliente = await db.cliente.findUnique({ where: { email } })
    clienteIds.push(cliente!.id)
    expect(cliente?.dispositivoFingerprint).toBe(sha256Hex(setToken!))
    expect(cliente?.dispositivoFingerprint).not.toBe(setToken)
  })

  test("con device cookie válida existente: reutiliza la misma identidad, no rota", async () => {
    const email = `${prefix}reg-${randomUUID()}@example.test`
    const existingToken = randomDeviceToken()
    const res = await registerRoute(reqRegister(email, existingToken))
    expect(res.status).toBe(200)

    const setToken = extractSetCookie(res, DEVICE_COOKIE_NAME)
    expect(setToken).toBeNull() // no se reemplaza una cookie ya válida

    const cliente = await db.cliente.findUnique({ where: { email } })
    clienteIds.push(cliente!.id)
    expect(cliente?.dispositivoFingerprint).toBe(sha256Hex(existingToken))
  })
})

describe("SEC-DEVICE-1 — Login", () => {
  test("Cliente con dispositivoFingerprint vacío + sin cookie: se rellena con el device id nuevo", async () => {
    const cliente = await ensureCliente(`login-empty-${randomUUID()}`, "")
    // La contraseña real del fixture no coincide con el hash guardado
    // (`ensureCliente` no hashea) — se prueba directamente el helper de
    // backfill sin depender de un login exitoso completo, actualizando el
    // password a un hash real conocido.
    const { hashPassword } = await import("@/lib/auth")
    await db.cliente.update({ where: { id: cliente.id }, data: { password: await hashPassword("password123") } })

    const res = await loginRoute(reqLogin(cliente.email, "password123"))
    expect(res.status).toBe(200)
    const setToken = extractSetCookie(res, DEVICE_COOKIE_NAME)
    expect(setToken).not.toBeNull()

    const after = await db.cliente.findUnique({ where: { id: cliente.id } })
    expect(after?.dispositivoFingerprint).toBe(sha256Hex(setToken!))
  })

  test("Cliente que YA tiene dispositivoFingerprint: login con otra cookie NO lo sobrescribe", async () => {
    const originalHash = sha256Hex(randomDeviceToken())
    const cliente = await ensureCliente(`login-existing-${randomUUID()}`, originalHash)
    const { hashPassword } = await import("@/lib/auth")
    await db.cliente.update({ where: { id: cliente.id }, data: { password: await hashPassword("password123") } })

    const otroDeviceToken = randomDeviceToken()
    const res = await loginRoute(reqLogin(cliente.email, "password123", otroDeviceToken))
    expect(res.status).toBe(200)

    const after = await db.cliente.findUnique({ where: { id: cliente.id } })
    expect(after?.dispositivoFingerprint).toBe(originalHash)
    expect(after?.dispositivoFingerprint).not.toBe(sha256Hex(otroDeviceToken))
  })
})

describe("SEC-DEVICE-1 — Checkout: spoofing de body.fingerprint", () => {
  test("body.fingerprint arbitrario NUNCA termina persistido — gana el device id server-derived", async () => {
    const negocio = await ensureNegocio(`spoof-${randomUUID()}`)
    const cliente = await ensureCliente(`spoof-${randomUUID()}`)
    const productoId = await ensureProducto(negocio.id)
    const token = await createSession(cliente.id, "cliente")

    const res = await crearPedido(
      reqPedido(pedidoBody({ negocioId: negocio.id, productoId }), {
        sessionToken: token,
        bodyFingerprint: "ATTACKER_CONTROLLED_VALUE",
      }),
      {}
    )
    expect(res.status).toBe(201)

    const after = await db.cliente.findUnique({ where: { id: cliente.id } })
    expect(after?.dispositivoFingerprint).not.toBe("ATTACKER_CONTROLLED_VALUE")
    expect(after?.dispositivoFingerprint).toMatch(/^[0-9a-f]{64}$/)

    const setToken = extractSetCookie(res, DEVICE_COOKIE_NAME)
    expect(setToken).not.toBeNull()
    expect(after?.dispositivoFingerprint).toBe(sha256Hex(setToken!))
  })

  test("checkout SIEMPRE actualiza dispositivoFingerprint con el device actual (a diferencia de login)", async () => {
    const negocio = await ensureNegocio(`overwrite-${randomUUID()}`)
    const previousHash = sha256Hex(randomDeviceToken())
    const cliente = await ensureCliente(`overwrite-${randomUUID()}`, previousHash)
    const productoId = await ensureProducto(negocio.id)
    const token = await createSession(cliente.id, "cliente")
    const newDeviceToken = randomDeviceToken()

    const res = await crearPedido(
      reqPedido(pedidoBody({ negocioId: negocio.id, productoId }), { sessionToken: token, deviceCookie: newDeviceToken }),
      {}
    )
    expect(res.status).toBe(201)

    const after = await db.cliente.findUnique({ where: { id: cliente.id } })
    expect(after?.dispositivoFingerprint).not.toBe(previousHash)
    expect(after?.dispositivoFingerprint).toBe(sha256Hex(newDeviceToken))
  })
})

describe("SEC-DEVICE-1 — Señal cross-account (sin bloqueo, sólo demuestra la señal)", () => {
  test("misma cookie de dispositivo en dos cuentas distintas → mismo deviceId derivado en ambas", async () => {
    const negocio = await ensureNegocio(`cross-${randomUUID()}`)
    const productoId = await ensureProducto(negocio.id)
    const clienteA = await ensureCliente(`cross-a-${randomUUID()}`)
    const clienteB = await ensureCliente(`cross-b-${randomUUID()}`)
    const tokenA = await createSession(clienteA.id, "cliente")
    const tokenB = await createSession(clienteB.id, "cliente")
    const sharedDeviceToken = randomDeviceToken()

    const resA = await crearPedido(
      reqPedido(pedidoBody({ negocioId: negocio.id, productoId }), { sessionToken: tokenA, deviceCookie: sharedDeviceToken }),
      {}
    )
    const resB = await crearPedido(
      reqPedido(pedidoBody({ negocioId: negocio.id, productoId }), { sessionToken: tokenB, deviceCookie: sharedDeviceToken }),
      {}
    )
    expect(resA.status).toBe(201)
    expect(resB.status).toBe(201)

    const afterA = await db.cliente.findUnique({ where: { id: clienteA.id } })
    const afterB = await db.cliente.findUnique({ where: { id: clienteB.id } })
    expect(afterA?.dispositivoFingerprint).toBe(sha256Hex(sharedDeviceToken))
    expect(afterB?.dispositivoFingerprint).toBe(sha256Hex(sharedDeviceToken))
    expect(afterA?.dispositivoFingerprint).toBe(afterB?.dispositivoFingerprint)

    // Ningún bloqueo se activa por esta coincidencia — SEC-DEVICE-1 no
    // implementa enforcement todavía.
    expect(afterA?.bloqueado).toBe(false)
    expect(afterB?.bloqueado).toBe(false)
  })

  test("cookies de dispositivo distintas → deviceId distintos", async () => {
    const negocio = await ensureNegocio(`diff-${randomUUID()}`)
    const productoId = await ensureProducto(negocio.id)
    const clienteA = await ensureCliente(`diff-a-${randomUUID()}`)
    const clienteB = await ensureCliente(`diff-b-${randomUUID()}`)
    const tokenA = await createSession(clienteA.id, "cliente")
    const tokenB = await createSession(clienteB.id, "cliente")

    await crearPedido(reqPedido(pedidoBody({ negocioId: negocio.id, productoId }), { sessionToken: tokenA, deviceCookie: randomDeviceToken() }), {})
    await crearPedido(reqPedido(pedidoBody({ negocioId: negocio.id, productoId }), { sessionToken: tokenB, deviceCookie: randomDeviceToken() }), {})

    const afterA = await db.cliente.findUnique({ where: { id: clienteA.id } })
    const afterB = await db.cliente.findUnique({ where: { id: clienteB.id } })
    expect(afterA?.dispositivoFingerprint).not.toBe(afterB?.dispositivoFingerprint)
  })
})
