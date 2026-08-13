/// <reference types="bun-types" />

// ============================================
// PASSWORD-HASH-WORKFACTOR-MIGRATION — integración real (PostgreSQL TESTING)
// ============================================
// Nunca mockea Prisma. Prefijo `passwordhash-e2e-<timestamp>-`, cada
// cuenta/sesión/fila de LoginThrottle/token de reset creada se trackea
// individualmente y se limpia en un afterAll acotado (nunca un delete
// global). Los hashes "a medida" (legacy con distintos passwords, v2 con
// distintos work factors) se construyen localmente con la MISMA primitiva
// Web Crypto que usa src/lib/auth.ts — nunca se inspeccionan sus constantes
// internas (son privadas a propósito), y nunca se reimplementa PBKDF2 con
// otra librería.

import { randomUUID } from "crypto"
import { PrismaClient } from "@prisma/client"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createSession, evaluatePasswordHash } from "@/lib/auth"
import { maybeUpgradePasswordHash } from "@/lib/password-hash-upgrade"
import { hashPasswordResetToken, generatePasswordResetToken } from "@/lib/password-reset"
import { POST as loginRoute } from "@/app/api/auth/login/route"
import { POST as operativoLoginRoute } from "@/app/api/operativo/login/route"
import { POST as registerRoute } from "@/app/api/auth/register/route"
import { POST as resetPasswordRoute } from "@/app/api/auth/reset-password/route"
import { PUT as changeClientePasswordRoute } from "@/app/api/cliente/password/route"
import { PUT as changeRepartidorPerfilRoute } from "@/app/api/repartidor/perfil/route"

setDefaultTimeout(120_000)

const ts = Date.now()
const prefix = `passwordhash-e2e-${ts}-`
const PW = "PasswordHashE2E2026!"
const NEW_PW = "PasswordHashE2ENew2026!"

const KEY_LENGTH = 32
const SALT_LENGTH = 16

async function deriveKeyHex(password: string, saltHex: string, iterations: number): Promise<string> {
  const salt = hexToBytes(saltHex)
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"])
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" }, keyMaterial, KEY_LENGTH * 8)
  return bytesToHex(new Uint8Array(bits))
}
function bytesToHex(buffer: Uint8Array): string {
  return Array.from(buffer).map((b) => b.toString(16).padStart(2, "0")).join("")
}
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  return bytes
}
function randomSaltHex(): string {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(SALT_LENGTH)))
}
async function legacyHashFor(password: string): Promise<string> {
  const saltHex = randomSaltHex()
  const keyHex = await deriveKeyHex(password, saltHex, 100_000)
  return `${saltHex}:${keyHex}`
}
async function v2HashFor(password: string, iterations: number): Promise<string> {
  const saltHex = randomSaltHex()
  const keyHex = await deriveKeyHex(password, saltHex, iterations)
  return `v2$pbkdf2-sha256$${iterations}$${saltHex}$${keyHex}`
}

// ---- tracking para cleanup ----
const clienteIds: string[] = []
const negocioIds: string[] = []
const repartidorIds: string[] = []
const cuentaOperativaIds: string[] = []
const allAccountIds: string[] = []
const throttleKeysToTrack = new Set<string>()
const resetTokenIds: string[] = []

// ---- fixtures ----
async function createCliente(suffix: string, hash: string, extra: Partial<{ emailVerified: Date | null; bloqueado: boolean }> = {}) {
  const cliente = await db.cliente.create({
    data: {
      nombre: `${prefix}cliente-${suffix}`,
      email: `${prefix}cliente-${suffix}@example.test`,
      telefono: "",
      password: hash,
      emailVerified: extra.emailVerified === undefined ? new Date() : extra.emailVerified,
      bloqueado: extra.bloqueado ?? false,
    },
  })
  clienteIds.push(cliente.id)
  allAccountIds.push(cliente.id)
  return cliente
}
async function createNegocio(suffix: string, hash: string, extra: Partial<{ emailVerified: Date | null; aprobado: boolean; suspendido: boolean }> = {}) {
  const negocio = await db.negocio.create({
    data: {
      nombre: `${prefix}negocio-${suffix}`,
      slug: `${prefix}negocio-${suffix}`,
      usuario: `${prefix}negocio-${suffix}`,
      email: `${prefix}negocio-${suffix}@example.test`,
      password: hash,
      emailVerified: extra.emailVerified === undefined ? new Date() : extra.emailVerified,
      aprobado: extra.aprobado ?? true,
      suspendido: extra.suspendido ?? false,
      horarioMode: "simple",
      abiertoManual: true,
    },
  })
  negocioIds.push(negocio.id)
  allAccountIds.push(negocio.id)
  return negocio
}
async function createRepartidor(suffix: string, hash: string, extra: Partial<{ emailVerified: Date | null; activo: boolean }> = {}) {
  const repartidor = await db.repartidor.create({
    data: {
      nombre: `${prefix}repartidor-${suffix}`,
      email: `${prefix}repartidor-${suffix}@example.test`,
      password: hash,
      emailVerified: extra.emailVerified === undefined ? new Date() : extra.emailVerified,
      activo: extra.activo ?? true,
    },
  })
  repartidorIds.push(repartidor.id)
  allAccountIds.push(repartidor.id)
  return repartidor
}
async function createCuentaOperativa(suffix: string, hash: string, extra: Partial<{ activo: boolean; eliminado: boolean }> = {}) {
  const cuenta = await db.cuentaOperativa.create({
    data: {
      nombre: `${prefix}operativa-${suffix}`,
      email: `${prefix}operativa-${suffix}@example.test`,
      password: hash,
      activo: extra.activo ?? true,
      eliminado: extra.eliminado ?? false,
    },
  })
  cuentaOperativaIds.push(cuenta.id)
  allAccountIds.push(cuenta.id)
  return cuenta
}

// ---- requests ----
function reqClienteLogin(email: string, password: string, ip = randomUUID()): NextRequest {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ tipo: "cliente", email, password }),
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
  })
}
function reqNegocioLogin(usuario: string, password: string, ip = randomUUID()): NextRequest {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ tipo: "negocio", usuario, password }),
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
  })
}
function reqRepartidorLogin(email: string, password: string, ip = randomUUID()): NextRequest {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ tipo: "repartidor", email, password }),
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
  })
}
function reqOperativoLogin(email: string, password: string, ip = randomUUID()): NextRequest {
  return new NextRequest("http://localhost/api/operativo/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
  })
}
function reqRegister(email: string, password: string, ip = randomUUID()): NextRequest {
  return new NextRequest("http://localhost/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ tipo: "cliente", termsAccepted: "true", nombre: `${prefix}reg`, email, password }),
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
  })
}
function reqResetPassword(token: string, password: string, confirmPassword: string, ip = randomUUID()): NextRequest {
  return new NextRequest("http://localhost/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, password, confirmPassword }),
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
  })
}
function reqChangeClientePassword(cookie: string, passwordActual: string, passwordNueva: string): NextRequest {
  return new NextRequest("http://localhost/api/cliente/password", {
    method: "PUT",
    body: JSON.stringify({ passwordActual, passwordNueva }),
    headers: { "content-type": "application/json", "x-forwarded-for": randomUUID(), cookie },
  })
}
function reqChangeRepartidorPerfil(cookie: string, currentPassword: string, newPassword: string): NextRequest {
  return new NextRequest("http://localhost/api/repartidor/perfil", {
    method: "PUT",
    body: JSON.stringify({ currentPassword, newPassword }),
    headers: { "content-type": "application/json", "x-forwarded-for": randomUUID(), cookie },
  })
}

async function readPassword(model: "cliente" | "negocio" | "repartidor" | "cuentaOperativa", id: string): Promise<string | null> {
  const row = await (db[model] as { findUnique: (args: unknown) => Promise<{ password: string | null } | null> }).findUnique({
    where: { id },
    select: { password: true },
  })
  return row?.password ?? null
}

function expectV2Current(hash: string | null) {
  expect(hash).toMatch(/^v2\$pbkdf2-sha256\$600000\$[0-9a-f]{32}\$[0-9a-f]{64}$/)
}

// ---- cleanup ----
async function cleanup() {
  if (clienteIds.length) {
    // SEC-BLOCK-1: un Cliente bloqueado que loguea enriquece ClienteBloqueado
    // con el dispositivo actual — se limpia ANTES de borrar el Cliente
    // (aunque no hay FK que lo exija, se respeta el orden de dependencia real).
    await db.clienteBloqueado.deleteMany({ where: { clienteId: { in: clienteIds } } })
  }
  if (allAccountIds.length) {
    await db.sesion.deleteMany({ where: { userId: { in: allAccountIds } } })
  }
  if (clienteIds.length) await db.cliente.deleteMany({ where: { id: { in: clienteIds } } })
  if (negocioIds.length) await db.negocio.deleteMany({ where: { id: { in: negocioIds } } })
  if (repartidorIds.length) await db.repartidor.deleteMany({ where: { id: { in: repartidorIds } } })
  if (cuentaOperativaIds.length) await db.cuentaOperativa.deleteMany({ where: { id: { in: cuentaOperativaIds } } })
  if (throttleKeysToTrack.size) {
    await db.loginThrottle.deleteMany({ where: { throttleKey: { in: Array.from(throttleKeysToTrack) } } })
  }
  if (resetTokenIds.length) {
    await db.passwordResetToken.deleteMany({ where: { id: { in: resetTokenIds } } })
  }
  // Cuentas creadas por rutas reales (register/etc.) durante los tests, con
  // el mismo prefijo, pero cuyo ID no llegó a trackearse arriba porque la
  // ruta las creó internamente — se limpian también por email prefijado.
  await db.cliente.deleteMany({ where: { email: { startsWith: `${prefix}` } } })
}

beforeAll(cleanup)
afterAll(async () => {
  await cleanup()
  const remainingAccounts =
    (await db.cliente.count({ where: { email: { startsWith: prefix } } })) +
    (await db.negocio.count({ where: { id: { in: negocioIds } } })) +
    (await db.repartidor.count({ where: { id: { in: repartidorIds } } })) +
    (await db.cuentaOperativa.count({ where: { id: { in: cuentaOperativaIds } } }))
  const remainingSessions = allAccountIds.length ? await db.sesion.count({ where: { userId: { in: allAccountIds } } }) : 0
  const remainingThrottle = throttleKeysToTrack.size
    ? await db.loginThrottle.count({ where: { throttleKey: { in: Array.from(throttleKeysToTrack) } } })
    : 0
  const remainingTokens = resetTokenIds.length ? await db.passwordResetToken.count({ where: { id: { in: resetTokenIds } } }) : 0
  const remainingBlockRows = clienteIds.length ? await db.clienteBloqueado.count({ where: { clienteId: { in: clienteIds } } }) : 0
  expect(remainingAccounts).toBe(0)
  expect(remainingSessions).toBe(0)
  expect(remainingThrottle).toBe(0)
  expect(remainingTokens).toBe(0)
  expect(remainingBlockRows).toBe(0)
  await db.$disconnect()
})

// ============================================
// 1) Los 4 tipos de cuenta — rehash tras login exitoso con hash legacy
// ============================================
describe("FOUR_ACCOUNT_TYPES_REHASH", () => {
  test("CLIENT_REHASH: Cliente con hash legacy + password correcta -> login PASS, DB pasa a v2 current", async () => {
    const legacy = await legacyHashFor(PW)
    const cliente = await createCliente("rehash", legacy)
    const res = await loginRoute(reqClienteLogin(cliente.email, PW))
    expect(res.status).toBe(200)
    const stored = await readPassword("cliente", cliente.id)
    expectV2Current(stored)
    expect(stored).not.toBe(legacy)
  })

  test("BUSINESS_REHASH: Negocio con hash legacy + password correcta -> login PASS, DB pasa a v2 current", async () => {
    const legacy = await legacyHashFor(PW)
    const negocio = await createNegocio("rehash", legacy)
    const res = await loginRoute(reqNegocioLogin(negocio.usuario, PW))
    expect(res.status).toBe(200)
    const stored = await readPassword("negocio", negocio.id)
    expectV2Current(stored)
  })

  test("DRIVER_REHASH: Repartidor con hash legacy + password correcta -> login PASS, DB pasa a v2 current", async () => {
    const legacy = await legacyHashFor(PW)
    const repartidor = await createRepartidor("rehash", legacy)
    const res = await loginRoute(reqRepartidorLogin(repartidor.email, PW))
    expect(res.status).toBe(200)
    const stored = await readPassword("repartidor", repartidor.id)
    expectV2Current(stored)
  })

  test("OPERATIVE_REHASH: CuentaOperativa con hash legacy + password correcta -> login PASS, DB pasa a v2 current", async () => {
    const legacy = await legacyHashFor(PW)
    const cuenta = await createCuentaOperativa("rehash", legacy)
    const res = await operativoLoginRoute(reqOperativoLogin(cuenta.email, PW))
    expect(res.status).toBe(200)
    const stored = await readPassword("cuentaOperativa", cuenta.id)
    expectV2Current(stored)
  })
})

// ============================================
// 1b) Cliente BLOQUEADO + hash legacy — combinación focal pre-commit
// ============================================
// SEC-BLOCK-1 (ya validado en AUTH-LOGIN-THROTTLE-HARDENING) dice que el
// login de un Cliente bloqueado sigue permitido, sin cambios. Esta suite ya
// prueba "rehash legacy" (§ arriba) y "bloqueado" por separado en otras
// tareas — este bloque cierra específicamente la COMBINACIÓN de ambos: un
// Cliente bloqueado, con hash legacy 100k, que loguea correctamente, debe
// (a) autenticar igual que hoy, (b) terminar con el hash en v2 600k, y (c)
// seguir enriqueciendo ClienteBloqueado exactamente como antes.
describe("BLOCKED_CLIENT_LEGACY_REHASH (caso focal pre-commit)", () => {
  test("Cliente bloqueado + legacy 100k + password correcta -> login PASS, rehash a v2 600k, SEC-BLOCK-1 preservado, sin fila LoginThrottle activa", async () => {
    const legacy = await legacyHashFor(PW)

    // ---- 4. Precondiciones DB (antes del login) ----
    const cliente = await createCliente("blocked", legacy, { emailVerified: new Date(), bloqueado: true })
    const beforeRow = await db.cliente.findUnique({
      where: { id: cliente.id },
      select: { id: true, bloqueado: true, emailVerified: true, password: true },
    })
    expect(beforeRow).not.toBeNull() // CLIENT_EXISTS=SI
    expect(beforeRow!.bloqueado).toBe(true) // CLIENT_BLOCKED=SI
    expect(beforeRow!.emailVerified).not.toBeNull() // EMAIL_VERIFIED=SI
    const legacyMatch = /^([0-9a-fA-F]{32}):([0-9a-fA-F]{64})$/.exec(beforeRow!.password!)
    expect(legacyMatch).not.toBeNull() // PASSWORD_FORMAT_BEFORE=LEGACY (32 hex + ':' + 64 hex, nunca impreso)

    // ---- 5. Login real ----
    const res = await loginRoute(reqClienteLogin(cliente.email, PW))
    expect(res.status).toBe(200) // BLOCKED_CLIENT_LOGIN=PASS
    const body = await res.json()
    expect(body.ok).toBe(true)

    // ---- 6. Rehash ----
    const stored = await readPassword("cliente", cliente.id)
    expectV2Current(stored) // empieza v2$pbkdf2-sha256$600000$
    const finalEvaluation = await evaluatePasswordHash(PW, stored!)
    expect(finalEvaluation.valid).toBe(true)
    expect(finalEvaluation.needsUpgrade).toBe(false) // BLOCKED_CLIENT_LEGACY_TO_V2_REHASH=PASS

    // ---- 7. SEC-BLOCK-1 preservado ----
    const blockRows = await db.clienteBloqueado.findMany({ where: { clienteId: cliente.id } })
    expect(blockRows.length).toBeGreaterThanOrEqual(1) // enrichment real ejecutado, sin cambiar su lógica
    expect(blockRows[0]!.clienteNombre).toBe(cliente.nombre)

    // ---- 8. LoginThrottle sin fila activa ----
    const { loginThrottleKey } = await import("@/lib/auth-login-throttle")
    const throttleKey = loginThrottleKey("cliente", cliente.email)
    throttleKeysToTrack.add(throttleKey)
    const throttleRow = await db.loginThrottle.findUnique({ where: { throttleKey } })
    expect(throttleRow).toBeNull() // BLOCKED_CLIENT_LOGIN_THROTTLE_REGRESSION=PASS (nunca hubo fallos, nunca se escribió nada)

    // ---- 9. Segundo login (ya v2) — no debería volver a rehashear ----
    const res2 = await loginRoute(reqClienteLogin(cliente.email, PW))
    expect(res2.status).toBe(200) // BLOCKED_CLIENT_CURRENT_V2_SECOND_LOGIN=PASS
    const storedAfterSecond = await readPassword("cliente", cliente.id)
    expect(storedAfterSecond).toBe(stored) // BLOCKED_CLIENT_SECOND_LOGIN_DB_WRITE=NO (byte-idéntico, sin segundo rehash)
  })
})

// ============================================
// 2) LoginThrottle + rehash
// ============================================
describe("LOGIN_THROTTLE_SUCCESS_RESET_PRESERVED", () => {
  test("hash legacy + 3 fallos previos en LoginThrottle + password correcta -> verify PASS, throttle row eliminada, status gates PASS, password pasa a v2, login PASS", async () => {
    const legacy = await legacyHashFor(PW)
    const cliente = await createCliente("throttle-reset", legacy)
    const { loginThrottleKey } = await import("@/lib/auth-login-throttle")
    const throttleKey = loginThrottleKey("cliente", cliente.email)
    throttleKeysToTrack.add(throttleKey)
    const resetAt = new Date(Date.now() + 9 * 60 * 1000)
    await db.$executeRaw`
      INSERT INTO "login_throttle" ("throttle_key", "count", "reset_at", "updated_at")
      VALUES (${throttleKey}, 3, ${resetAt}, NOW())
    `

    const res = await loginRoute(reqClienteLogin(cliente.email, PW))
    expect(res.status).toBe(200)

    const throttleRow = await db.loginThrottle.findUnique({ where: { throttleKey } })
    expect(throttleRow).toBeNull()

    const stored = await readPassword("cliente", cliente.id)
    expectV2Current(stored)
  })
})

// ============================================
// 3) No-rehash: status gates que niegan la sesión
// ============================================
describe("STATUS_DENIALS_NO_REHASH", () => {
  test("UNVERIFIED_CLIENT_REHASH=NO: Cliente emailVerified=false + password correcta -> 403, hash sigue legacy exacto", async () => {
    const legacy = await legacyHashFor(PW)
    const cliente = await createCliente("unverified", legacy, { emailVerified: null })
    const res = await loginRoute(reqClienteLogin(cliente.email, PW))
    expect(res.status).toBe(403)
    const stored = await readPassword("cliente", cliente.id)
    expect(stored).toBe(legacy)
  })

  test("UNVERIFIED_BUSINESS_REHASH=NO: Negocio emailVerified=false + password correcta -> 403, hash sigue legacy exacto", async () => {
    const legacy = await legacyHashFor(PW)
    const negocio = await createNegocio("unverified", legacy, { emailVerified: null })
    const res = await loginRoute(reqNegocioLogin(negocio.usuario, PW))
    expect(res.status).toBe(403)
    const stored = await readPassword("negocio", negocio.id)
    expect(stored).toBe(legacy)
  })

  test("UNAPPROVED_BUSINESS_REHASH=NO: Negocio aprobado=false + password correcta -> 200 needsApproval (sin sesión), hash sigue legacy exacto", async () => {
    const legacy = await legacyHashFor(PW)
    const negocio = await createNegocio("unapproved", legacy, { aprobado: false })
    const res = await loginRoute(reqNegocioLogin(negocio.usuario, PW))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.needsApproval).toBe(true)
    const stored = await readPassword("negocio", negocio.id)
    expect(stored).toBe(legacy)
  })

  test("UNVERIFIED_DRIVER_REHASH=NO: Repartidor emailVerified=false + password correcta -> 403, hash sigue legacy exacto", async () => {
    const legacy = await legacyHashFor(PW)
    const repartidor = await createRepartidor("unverified", legacy, { emailVerified: null })
    const res = await loginRoute(reqRepartidorLogin(repartidor.email, PW))
    expect(res.status).toBe(403)
    const stored = await readPassword("repartidor", repartidor.id)
    expect(stored).toBe(legacy)
  })

  test("INACTIVE_DRIVER_REHASH=NO: Repartidor activo=false + password correcta -> 403, hash sigue legacy exacto", async () => {
    const legacy = await legacyHashFor(PW)
    const repartidor = await createRepartidor("inactive", legacy, { activo: false })
    const res = await loginRoute(reqRepartidorLogin(repartidor.email, PW))
    expect(res.status).toBe(403)
    const stored = await readPassword("repartidor", repartidor.id)
    expect(stored).toBe(legacy)
  })
})

// ============================================
// 4) Negocio suspendido — SÍ rehashea (crea sesión igual)
// ============================================
describe("SUSPENDED_BUSINESS_REHASH", () => {
  test("Negocio legacy + aprobado=true + suspendido=true + password correcta -> sesión creada (suspended:true) preservado, Y hash pasa a v2", async () => {
    const legacy = await legacyHashFor(PW)
    const negocio = await createNegocio("suspended", legacy, { suspendido: true })
    const res = await loginRoute(reqNegocioLogin(negocio.usuario, PW))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.suspended).toBe(true)
    const stored = await readPassword("negocio", negocio.id)
    expectV2Current(stored)
  })
})

// ============================================
// 5) Bad password / throttled — nunca rehashea
// ============================================
describe("BAD_PASSWORD_NO_REHASH / THROTTLED_NO_REHASH", () => {
  test("password incorrecta -> 401, hash DB idéntico byte-for-byte al legacy anterior", async () => {
    const legacy = await legacyHashFor(PW)
    const cliente = await createCliente("badpw", legacy)
    const res = await loginRoute(reqClienteLogin(cliente.email, "wrong-password"))
    expect(res.status).toBe(401)
    const stored = await readPassword("cliente", cliente.id)
    expect(stored).toBe(legacy)
  })

  test("cuenta ya throttled (429) -> hash DB idéntico, sin rehash", async () => {
    const legacy = await legacyHashFor(PW)
    const cliente = await createCliente("throttled", legacy)
    const { loginThrottleKey } = await import("@/lib/auth-login-throttle")
    const throttleKey = loginThrottleKey("cliente", cliente.email)
    throttleKeysToTrack.add(throttleKey)
    const resetAt = new Date(Date.now() + 9 * 60 * 1000)
    await db.$executeRaw`
      INSERT INTO "login_throttle" ("throttle_key", "count", "reset_at", "updated_at")
      VALUES (${throttleKey}, 10, ${resetAt}, NOW())
    `
    const res = await loginRoute(reqClienteLogin(cliente.email, PW))
    expect(res.status).toBe(429)
    const stored = await readPassword("cliente", cliente.id)
    expect(stored).toBe(legacy)
  })
})

// ============================================
// 6) CAS race — no pisa un reset/change concurrente
// ============================================
describe("CAS_PREVENTS_PASSWORD_RESET_OVERWRITE", () => {
  test("verify legacy A exitosamente, DB cambia a B por 'otro proceso' antes del CAS, rehash con old=A -> count=0, DB sigue B, nunca C", async () => {
    const legacyA = await legacyHashFor(PW)
    const cliente = await createCliente("cas-race", legacyA)

    const evaluation = await evaluatePasswordHash(PW, legacyA)
    expect(evaluation.valid).toBe(true)
    expect(evaluation.needsUpgrade).toBe(true)

    // Simula un reset/change concurrente: la DB pasa a B ANTES de que el CAS
    // del rehash (que todavía tiene oldStoredHash=A en memoria) se ejecute.
    const hashB = await v2HashFor("otro-password-cualquiera", 600_000)
    await db.cliente.update({ where: { id: cliente.id }, data: { password: hashB } })

    await maybeUpgradePasswordHash({
      accountType: "cliente",
      accountId: cliente.id,
      plainPassword: PW,
      oldStoredHash: legacyA,
      needsUpgrade: evaluation.needsUpgrade,
    })

    const stored = await readPassword("cliente", cliente.id)
    expect(stored).toBe(hashB)
    expect(stored).not.toBe(legacyA)
  })
})

// ============================================
// 7) Concurrencia — dos logins legacy simultáneos
// ============================================
describe("CONCURRENT_LEGACY_LOGINS", () => {
  test("dos logins concurrentes sobre el mismo hash legacy -> sin corrupción, hash final v2 válido, password original sigue autenticando, sin excepción", async () => {
    const legacy = await legacyHashFor(PW)
    const cliente = await createCliente("concurrent", legacy)

    const [res1, res2] = await Promise.all([
      loginRoute(reqClienteLogin(cliente.email, PW, randomUUID())),
      loginRoute(reqClienteLogin(cliente.email, PW, randomUUID())),
    ])
    expect(res1.status).toBe(200)
    expect(res2.status).toBe(200)

    const stored = await readPassword("cliente", cliente.id)
    expectV2Current(stored)
    const finalEvaluation = await evaluatePasswordHash(PW, stored!)
    expect(finalEvaluation.valid).toBe(true)
  })
})

// ============================================
// 8) v2 actual / v2 más fuerte — nunca escriben
// ============================================
describe("CURRENT_V2_LOGIN_REHASH_WRITE=NO / STRONGER_V2_NO_DOWNGRADE", () => {
  test("cuenta con v2 600k (actual) + login correcto -> hash DB idéntico (sin CAS)", async () => {
    const currentHash = await v2HashFor(PW, 600_000)
    const cliente = await createCliente("v2-current", currentHash)
    const res = await loginRoute(reqClienteLogin(cliente.email, PW))
    expect(res.status).toBe(200)
    const stored = await readPassword("cliente", cliente.id)
    expect(stored).toBe(currentHash)
  })

  test("STRONGER_V2_NO_DOWNGRADE_TEST=PASS: cuenta con v2 800k + login correcto -> valid, NO rehash, NO downgrade, hash idéntico", async () => {
    const strongerHash = await v2HashFor(PW, 800_000)
    const cliente = await createCliente("v2-stronger", strongerHash)
    const res = await loginRoute(reqClienteLogin(cliente.email, PW))
    expect(res.status).toBe(200)
    const stored = await readPassword("cliente", cliente.id)
    expect(stored).toBe(strongerHash)
  })
})

// ============================================
// 9) Lower v2 (100000-599999) — sí rehashea a 600000
// ============================================
describe("LOWER_V2_UPGRADES", () => {
  test("cuenta con v2 300k + login correcto -> rehash a v2 600k", async () => {
    const lowerHash = await v2HashFor(PW, 300_000)
    const cliente = await createCliente("v2-lower", lowerHash)
    const res = await loginRoute(reqClienteLogin(cliente.email, PW))
    expect(res.status).toBe(200)
    const stored = await readPassword("cliente", cliente.id)
    expectV2Current(stored)
    expect(stored).not.toBe(lowerHash)
  })
})

// ============================================
// 10) Nuevas escrituras — create/reset/change producen v2
// ============================================
describe("NEW_WRITE_BEHAVIOR (create / reset / change producen v2 current)", () => {
  test("registro de Cliente nuevo -> stored hash empieza v2$pbkdf2-sha256$600000$", async () => {
    const email = `${prefix}newreg@example.test`
    const res = await registerRoute(reqRegister(email, PW))
    expect(res.status).toBe(200)
    const cliente = await db.cliente.findUnique({ where: { email } })
    expect(cliente).not.toBeNull()
    clienteIds.push(cliente!.id)
    allAccountIds.push(cliente!.id)
    expectV2Current(cliente!.password)
  })

  test("reset de password (Cliente) -> nuevo hash v2 current, password nuevo verifica, password viejo deja de verificar", async () => {
    const legacy = await legacyHashFor(PW)
    const cliente = await createCliente("reset-flow", legacy)

    const rawToken = generatePasswordResetToken()
    const tokenHash = hashPasswordResetToken(rawToken)
    const resetToken = await db.passwordResetToken.create({
      data: {
        userId: cliente.id,
        userType: "cliente",
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    })
    resetTokenIds.push(resetToken.id)

    const res = await resetPasswordRoute(reqResetPassword(rawToken, NEW_PW, NEW_PW))
    expect(res.status).toBe(200)

    const stored = await readPassword("cliente", cliente.id)
    expectV2Current(stored)

    const newPwEval = await evaluatePasswordHash(NEW_PW, stored!)
    expect(newPwEval.valid).toBe(true)
    const oldPwEval = await evaluatePasswordHash(PW, stored!)
    expect(oldPwEval.valid).toBe(false)
  })

  test("change password Cliente (autenticado) -> nuevo hash v2 current, new PASS, old FAIL", async () => {
    const legacy = await legacyHashFor(PW)
    const cliente = await createCliente("change-cliente", legacy)
    const token = await createSession(cliente.id, "cliente")
    const cookie = `deligo_session=${token}`

    const res = await changeClientePasswordRoute(reqChangeClientePassword(cookie, PW, NEW_PW))
    expect(res.status).toBe(200)

    const stored = await readPassword("cliente", cliente.id)
    expectV2Current(stored)
    expect((await evaluatePasswordHash(NEW_PW, stored!)).valid).toBe(true)
    expect((await evaluatePasswordHash(PW, stored!)).valid).toBe(false)
  })

  test("change password Repartidor (autenticado) -> nuevo hash v2 current, new PASS, old FAIL (ruta productiva no modificada)", async () => {
    const legacy = await legacyHashFor(PW)
    const repartidor = await createRepartidor("change-repartidor", legacy)
    const token = await createSession(repartidor.id, "repartidor")
    const cookie = `deligo_session=${token}`

    const res = await changeRepartidorPerfilRoute(reqChangeRepartidorPerfil(cookie, PW, NEW_PW))
    expect(res.status).toBe(200)

    const stored = await readPassword("repartidor", repartidor.id)
    expectV2Current(stored)
    expect((await evaluatePasswordHash(NEW_PW, stored!)).valid).toBe(true)
    expect((await evaluatePasswordHash(PW, stored!)).valid).toBe(false)
  })
})

// ============================================
// 11) Rehash failure — no bloquea el login
// ============================================
describe("REHASH_FAILURE_NON_BLOCKING", () => {
  test("si el CAS lanza un error real (accountId de tipo inválido -> PrismaClientValidationError), maybeUpgradePasswordHash lo atrapa y no lanza", async () => {
    let threw = false
    try {
      await maybeUpgradePasswordHash({
        accountType: "cliente",
        // Fuerza un error de validación de Prisma (id numérico en vez de
        // string) sin tocar la conectividad real de la DB — nunca se llega
        // a ejecutar SQL, Prisma valida el tipo de argumento antes.
        accountId: 12345 as unknown as string,
        plainPassword: PW,
        oldStoredHash: "irrelevante",
        needsUpgrade: true,
      })
    } catch {
      threw = true
    }
    expect(threw).toBe(false)
  })

  test("con needsUpgrade=false, maybeUpgradePasswordHash no genera hash ni toca la DB (no-op inmediato)", async () => {
    const currentHash = await v2HashFor(PW, 600_000)
    const cliente = await createCliente("no-op", currentHash)
    await maybeUpgradePasswordHash({
      accountType: "cliente",
      accountId: cliente.id,
      plainPassword: PW,
      oldStoredHash: currentHash,
      needsUpgrade: false,
    })
    const stored = await readPassword("cliente", cliente.id)
    expect(stored).toBe(currentHash)
  })
})

// ============================================
// 12) seed.ts — confirmación estática (sin ejecutarlo)
// ============================================
describe("SEED_SCRIPT_UNCHANGED", () => {
  test("prisma/seed.ts sigue usando hashPassword() centralizado (emitirá v2 en futuras ejecuciones, sin modificarlo)", () => {
    const { readFileSync } = require("fs")
    const { join } = require("path")
    const src = readFileSync(join(process.cwd(), "prisma", "seed.ts"), "utf-8")
    expect(src).toContain('import { hashPassword } from "../src/lib/auth"')
    expect(src).toContain("hashPassword(")
  })
})

// ============================================
// 13) Shared store real — dos PrismaClient independientes ven el mismo rehash
// ============================================
describe("SHARED_STORE_REHASH_VISIBLE_CROSS_CLIENT", () => {
  test("el hash escrito por el rehash (vía el cliente Prisma singleton de la app) es visible inmediatamente desde una conexión independiente", async () => {
    const legacy = await legacyHashFor(PW)
    const cliente = await createCliente("shared-store", legacy)
    const res = await loginRoute(reqClienteLogin(cliente.email, PW))
    expect(res.status).toBe(200)

    const independentClient = new PrismaClient()
    try {
      const row = await independentClient.cliente.findUnique({ where: { id: cliente.id }, select: { password: true } })
      expectV2Current(row?.password ?? null)
    } finally {
      await independentClient.$disconnect()
    }
  })
})
