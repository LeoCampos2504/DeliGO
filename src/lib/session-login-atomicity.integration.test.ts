/// <reference types="bun-types" />

// ============================================
// SESSION_LOGIN_ATOMICITY_DEBT — integración real (PostgreSQL TESTING)
// ============================================
// Nunca mockea Prisma. Prefijo `sessionatomicity-e2e-<timestamp>-`, cada
// cuenta/sesión/fila ClienteBloqueado creada se trackea individualmente y se
// limpia en un afterAll acotado (nunca un delete global). El ÚNICO mock de
// este archivo reemplaza `@/lib/client-block-security` para poder forzar,
// de forma controlada y sin tocar código productivo, un throw DENTRO de la
// transacción de loginCliente — el pass-through (usado por todos los demás
// tests) es una réplica fiel de la implementación real, nunca modificada
// (ver src/lib/client-block-security.ts, confirmado idéntico a HEAD por el
// contrato estático de este mismo turno).

import { randomUUID, createHash } from "crypto"
import type { Prisma } from "@prisma/client"
import { afterAll, beforeAll, describe, expect, mock, setDefaultTimeout, test } from "bun:test"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createSession, hashPassword, hashSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { DEVICE_COOKIE_NAME } from "@/lib/device-identity"

setDefaultTimeout(60_000)

const ts = Date.now()
const prefix = `sessionatomicity-e2e-${ts}-`
const TEST_FIXTURE_PASSWORD = "CorrectHorseBattery42" // pasa Password Policy, no blocklisted (mismo valor ya validado en client-block-security.integration.test.ts)

// ---- flag mutable para inyección de fallo focal (§30 del pedido) ----
let forceBlockEnrichmentThrow = false

// Réplica fiel de ensureClienteBloqueadoRecordForDevice (src/lib/client-block-security.ts,
// NUNCA modificada este turno — confirmado por el contrato estático). Se usa
// como pass-through para que las aserciones de los demás tests de este
// archivo (filas ClienteBloqueado creadas) sigan siendo válidas con el
// módulo mockeado; sólo lanza cuando forceBlockEnrichmentThrow===true.
mock.module("@/lib/client-block-security", () => ({
  ensureClienteBloqueadoRecordForDevice: async (
    client: Prisma.TransactionClient,
    params: { clienteId: string; clienteNombre: string; deviceId: string; ip: string }
  ): Promise<void> => {
    if (forceBlockEnrichmentThrow) {
      throw new Error("SESSION_LOGIN_ATOMICITY_DEBT: fallo forzado por test (SEC-BLOCK-1 enrichment)")
    }
    const { clienteId, clienteNombre, deviceId, ip } = params
    if (!deviceId) return
    const existing = await client.clienteBloqueado.findFirst({
      where: { clienteId, fingerprint: deviceId },
      select: { id: true },
    })
    if (existing) return
    await client.clienteBloqueado.create({
      data: { clienteId, clienteNombre, fingerprint: deviceId, ip: ip || "" },
    })
  },
}))

// Importado dinámicamente DESPUÉS de registrar el mock (beforeAll) para
// garantizar que su cadena de imports resuelva @/lib/client-block-security
// ya mockeado — evitar el import estático de esta ruta específica es
// deliberado, nunca un patrón a copiar en otros archivos de este repo.
let loginRoute: (req: NextRequest) => Promise<Response>

function hashDeviceToken(token: string): string {
  // Misma primitiva que la función privada hashDeviceToken de
  // src/lib/device-identity.ts (SHA-256 simple, sin secreto) — nunca se
  // importa porque no está exportada; nunca se reimplementa distinto.
  return createHash("sha256").update(token).digest("hex")
}

function randomDeviceToken(): string {
  // 43 caracteres base64url — mismo formato que exige DEVICE_TOKEN_PATTERN
  // en device-identity.ts, sintético, nunca un token real capturado.
  return Buffer.from(randomUUID() + randomUUID()).toString("base64url").slice(0, 43)
}

function extractSetCookie(res: Response, name: string): string | null {
  const all = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [res.headers.get("set-cookie") ?? ""]
  const match = all.find((c) => c.startsWith(`${name}=`))
  if (!match) return null
  return match.split(";")[0]!.split("=")[1] ?? null
}

// ---- tracking para cleanup ----
const clienteIds: string[] = []

async function createCliente(
  suffix: string,
  extra: Partial<{ emailVerified: Date | null; bloqueado: boolean; dispositivoFingerprint: string }> = {}
) {
  const password = await hashPassword(TEST_FIXTURE_PASSWORD)
  const cliente = await db.cliente.create({
    data: {
      nombre: `${prefix}cliente-${suffix}`,
      email: `${prefix}cliente-${suffix}@example.test`,
      telefono: "",
      password,
      emailVerified: extra.emailVerified === undefined ? new Date() : extra.emailVerified,
      bloqueado: extra.bloqueado ?? false,
      dispositivoFingerprint: extra.dispositivoFingerprint ?? "",
    },
  })
  clienteIds.push(cliente.id)
  return cliente
}

function reqClienteLogin(email: string, password: string, opts: { deviceCookie?: string; ip?: string } = {}): NextRequest {
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

// ---- cleanup ----
async function cleanup() {
  if (clienteIds.length) {
    await db.clienteBloqueado.deleteMany({ where: { clienteId: { in: clienteIds } } })
    await db.sesion.deleteMany({ where: { userId: { in: clienteIds } } })
    await db.cliente.deleteMany({ where: { id: { in: clienteIds } } })
  }
}

beforeAll(async () => {
  await cleanup()
  const routeModule = await import("@/app/api/auth/login/route")
  loginRoute = routeModule.POST as (req: NextRequest) => Promise<Response>
})

afterAll(async () => {
  await cleanup()
  const remainingClientes = await db.cliente.count({ where: { email: { startsWith: prefix } } })
  const remainingSessions = clienteIds.length ? await db.sesion.count({ where: { userId: { in: clienteIds } } }) : 0
  const remainingBlockRows = clienteIds.length ? await db.clienteBloqueado.count({ where: { clienteId: { in: clienteIds } } }) : 0
  expect(remainingClientes).toBe(0)
  expect(remainingSessions).toBe(0)
  expect(remainingBlockRows).toBe(0)
  await db.$disconnect()
})

// ============================================
// 27. Normal Cliente success
// ============================================
describe("NORMAL_CLIENT_SUCCESS", () => {
  test("Cliente con device cookie ya válida + login correcto -> 200, exactamente 1 nueva Sesion, cookie de sesión presente", async () => {
    const deviceToken = randomDeviceToken()
    const cliente = await createCliente("normal", { dispositivoFingerprint: hashDeviceToken(deviceToken) })
    const before = await db.sesion.count({ where: { userId: cliente.id } })

    const res = await loginRoute(reqClienteLogin(cliente.email, TEST_FIXTURE_PASSWORD, { deviceCookie: deviceToken }))
    expect(res.status).toBe(200)

    const after = await db.sesion.count({ where: { userId: cliente.id } })
    expect(after - before).toBe(1)
    expect(extractSetCookie(res, SESSION_COOKIE_NAME)).not.toBeNull()
  })
})

// ============================================
// 28. New device consistency (crítico — el hallazgo de este turno)
// ============================================
describe("NEW_DEVICE_COOKIE_MATCHES_STORED_FINGERPRINT", () => {
  test("Cliente SIN device cookie válida + login correcto -> Cliente.dispositivoFingerprint === hash de la cookie REALMENTE devuelta", async () => {
    const cliente = await createCliente("newdevice")
    const res = await loginRoute(reqClienteLogin(cliente.email, TEST_FIXTURE_PASSWORD))
    expect(res.status).toBe(200)

    const deviceCookieValue = extractSetCookie(res, DEVICE_COOKIE_NAME)
    expect(deviceCookieValue).not.toBeNull() // isNew=true -> debe entregarse

    const expectedFingerprint = hashDeviceToken(deviceCookieValue!)
    const updated = await db.cliente.findUnique({ where: { id: cliente.id }, select: { dispositivoFingerprint: true } })
    expect(updated?.dispositivoFingerprint).toBe(expectedFingerprint) // NEW_DEVICE_COOKIE_MATCHES_STORED_FINGERPRINT=PASS
    // token raw / fingerprint completo nunca impresos en este test.
  })
})

// ============================================
// 29. Blocked Cliente success
// ============================================
describe("BLOCKED_CLIENT_SUCCESS", () => {
  test("Cliente bloqueado + login correcto -> 200, 1 nueva Sesion, SEC-BLOCK-1 enrichment presente, cookies correctas", async () => {
    const cliente = await createCliente("blocked", { bloqueado: true })
    const res = await loginRoute(reqClienteLogin(cliente.email, TEST_FIXTURE_PASSWORD))
    expect(res.status).toBe(200)

    const sessionCount = await db.sesion.count({ where: { userId: cliente.id } })
    expect(sessionCount).toBe(1)

    const blockRows = await db.clienteBloqueado.count({ where: { clienteId: cliente.id } })
    expect(blockRows).toBeGreaterThanOrEqual(1)

    expect(extractSetCookie(res, SESSION_COOKIE_NAME)).not.toBeNull()
    expect(extractSetCookie(res, DEVICE_COOKIE_NAME)).not.toBeNull() // device nuevo -> isNew=true
  })
})

// ============================================
// 30-31. Forced failure DESPUÉS de session insert + fingerprint backfill
//         -> rollback completo (el caso de rollback más fuerte)
// ============================================
describe("TX_BLOCK_FAILURE_ROLLBACK", () => {
  test("Cliente bloqueado, SIN fingerprint previo, SEC-BLOCK-1 enrichment forzado a fallar -> rollback de session + fingerprint + block, sin cookies", async () => {
    const cliente = await createCliente("blocked-fail", { bloqueado: true })
    const sessionsBefore = await db.sesion.count({ where: { userId: cliente.id } })
    const blockBefore = await db.clienteBloqueado.count({ where: { clienteId: cliente.id } })

    forceBlockEnrichmentThrow = true
    let res: Response
    try {
      res = await loginRoute(reqClienteLogin(cliente.email, TEST_FIXTURE_PASSWORD))
    } finally {
      forceBlockEnrichmentThrow = false
    }

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe("Error interno del servidor")

    const sessionsAfter = await db.sesion.count({ where: { userId: cliente.id } })
    expect(sessionsAfter).toBe(sessionsBefore) // TX_BLOCK_FAILURE_SESSION_ROLLBACK=PASS

    const clienteAfter = await db.cliente.findUnique({ where: { id: cliente.id }, select: { dispositivoFingerprint: true } })
    expect(clienteAfter?.dispositivoFingerprint).toBe("") // TX_BLOCK_FAILURE_FINGERPRINT_ROLLBACK=PASS (el backfill, que sí llegó a ejecutarse antes del throw, quedó revertido)

    const blockAfter = await db.clienteBloqueado.count({ where: { clienteId: cliente.id } })
    expect(blockAfter).toBe(blockBefore) // TX_BLOCK_FAILURE_BLOCK_ROLLBACK=PASS

    expect(extractSetCookie(res, SESSION_COOKIE_NAME)).toBeNull() // TX_BLOCK_FAILURE_COOKIES_ABSENT=PASS
    expect(extractSetCookie(res, DEVICE_COOKIE_NAME)).toBeNull()
  })
})

// ============================================
// 34. Preexisting session preservation
// ============================================
describe("PREEXISTING_SESSION_PRESERVED", () => {
  test("Session A preexistente permanece intacta cuando un login B posterior falla por transacción forzada", async () => {
    const cliente = await createCliente("preexisting-session", { bloqueado: true })
    const sessionAToken = await createSession(cliente.id, "cliente")
    const sessionARow = await db.sesion.findUnique({ where: { token: hashSessionToken(sessionAToken) } })
    expect(sessionARow).not.toBeNull()

    forceBlockEnrichmentThrow = true
    let res: Response
    try {
      res = await loginRoute(reqClienteLogin(cliente.email, TEST_FIXTURE_PASSWORD))
    } finally {
      forceBlockEnrichmentThrow = false
    }
    expect(res.status).toBe(500)

    const sessionAStill = await db.sesion.findUnique({ where: { token: hashSessionToken(sessionAToken) } })
    expect(sessionAStill).not.toBeNull() // PREEXISTING_SESSION_PRESERVED=PASS — nunca se borró por userId

    const totalSessions = await db.sesion.count({ where: { userId: cliente.id } })
    expect(totalSessions).toBe(1) // sólo A; la B fallida nunca se persistió
  })
})

// ============================================
// 35. Preexisting fingerprint — sin backfill, sin regresión
// ============================================
describe("PREEXISTING_FINGERPRINT_PRESERVED", () => {
  test("Cliente con dispositivoFingerprint ya establecido + device cookie válida correspondiente -> sin backfill, 1 Sesion, fingerprint sin cambios", async () => {
    const deviceToken = randomDeviceToken()
    const fp = hashDeviceToken(deviceToken)
    const cliente = await createCliente("preexisting-fp", { dispositivoFingerprint: fp })

    const res = await loginRoute(reqClienteLogin(cliente.email, TEST_FIXTURE_PASSWORD, { deviceCookie: deviceToken }))
    expect(res.status).toBe(200)

    const after = await db.cliente.findUnique({ where: { id: cliente.id }, select: { dispositivoFingerprint: true } })
    expect(after?.dispositivoFingerprint).toBe(fp) // PREEXISTING_FINGERPRINT_PRESERVED=PASS

    const sessionCount = await db.sesion.count({ where: { userId: cliente.id } })
    expect(sessionCount).toBe(1)

    // cookie de dispositivo entrante ya era válida -> isNew=false -> no se reemite
    expect(extractSetCookie(res, DEVICE_COOKIE_NAME)).toBeNull()
  })
})

// ============================================
// 36. Concurrent successful logins
// ============================================
describe("CONCURRENT_LOGIN_RESPONSES", () => {
  test("dos logins concurrentes exitosos del mismo Cliente -> 2 sesiones distintas, sin excepción, sin serialización por userId", async () => {
    // Device identity ya establecida en ambas requests (misma cookie válida)
    // a propósito — la carrera de backfill con device NUEVA es un caso
    // aparte, ya cubierto y con su semántica histórica preservada (SEC-DEVICE-1
    // "only if empty"), y no se reabre acá (§37 del pedido).
    const deviceToken = randomDeviceToken()
    const fp = hashDeviceToken(deviceToken)
    const cliente = await createCliente("concurrent", { dispositivoFingerprint: fp })

    const [res1, res2] = await Promise.all([
      loginRoute(reqClienteLogin(cliente.email, TEST_FIXTURE_PASSWORD, { deviceCookie: deviceToken, ip: randomUUID() })),
      loginRoute(reqClienteLogin(cliente.email, TEST_FIXTURE_PASSWORD, { deviceCookie: deviceToken, ip: randomUUID() })),
    ])
    expect(res1.status).toBe(200) // CONCURRENT_LOGIN_RESPONSES=2_PASS
    expect(res2.status).toBe(200)

    const sessionCount = await db.sesion.count({ where: { userId: cliente.id } })
    expect(sessionCount).toBe(2) // CONCURRENT_SESSION_ROWS=2
  })
})
