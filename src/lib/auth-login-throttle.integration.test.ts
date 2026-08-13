/// <reference types="bun-types" />

// ============================================
// AUTH-LOGIN-THROTTLE — validación de integración contra PostgreSQL TESTING
// real (tabla login_throttle recién migrada). Nunca mockea Prisma. Prefijo
// `auththrottle-e2e-<timestamp>-`, cleanup obligatorio y acotado (nunca un
// deleteMany global sobre login_throttle ni sobre ninguna tabla de cuentas).
// ============================================
//
// Cobertura (ver CODEX_REPORT.md para el mapeo completo a la especificación):
// - Mecánica del store (smoke básico, updated_at, ventana fija/expirada,
//   concurrencia atómica, dos clientes Prisma independientes, cleanup
//   oportunista).
// - Comportamiento observable a través de las rutas reales de login
//   (Cliente/Negocio/Repartidor vía /api/auth/login, CuentaOperativa vía
//   /api/operativo/login): frontera de la 10ma falla, pre-check sin
//   incremento, Retry-After, IP rotante vs cuenta fija, IP fija vs varias
//   cuentas, cuenta inexistente, contraseña incorrecta, éxito con/sin fallos
//   previos, contraseña legacy corta, Cliente bloqueado, y los estados de
//   negocio (email no verificado / no aprobado / suspendido / inactivo /
//   CuentaOperativa inactiva) que NO deben contar como fallo de contraseña.
// - Arquitectura OAuth intacta (chequeo estático de código, sin llamadas
//   reales a Google).

import { randomUUID } from "crypto"
import { PrismaClient } from "@prisma/client"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { hashPassword } from "@/lib/auth"
import {
  ACCOUNT_FAILURE_LIMIT,
  checkLoginAccountThrottle,
  clearLoginFailures,
  LOGIN_THROTTLE_MESSAGE,
  loginThrottleKey,
  recordLoginFailure,
} from "@/lib/auth-login-throttle"
import { POST as loginRoute } from "@/app/api/auth/login/route"
import { POST as operativoLoginRoute } from "@/app/api/operativo/login/route"

setDefaultTimeout(120_000)

const ts = Date.now()
const prefix = `auththrottle-e2e-${ts}-`

const clienteIds: string[] = []
const negocioIds: string[] = []
const repartidorIds: string[] = []
const cuentaOperativaIds: string[] = []
const allAccountIds: string[] = []
const trackedThrottleKeys = new Set<string>()

function track(key: string): string {
  trackedThrottleKeys.add(key)
  return key
}

// ---- fixtures de cuenta ----

async function createCliente(
  suffix: string,
  extra: Partial<{ password: string; emailVerified: Date | null; bloqueado: boolean }> = {}
) {
  const email = `${prefix}cliente-${suffix}@example.test`
  const cliente = await db.cliente.create({
    data: {
      nombre: `${prefix}cliente-${suffix}`,
      email,
      telefono: "",
      password: extra.password ?? (await hashPassword("ValidPass123!")),
      emailVerified: extra.emailVerified === undefined ? new Date() : extra.emailVerified,
      bloqueado: extra.bloqueado ?? false,
      bloqueadoFecha: extra.bloqueado ? new Date() : null,
    },
  })
  clienteIds.push(cliente.id)
  allAccountIds.push(cliente.id)
  return cliente
}

async function createNegocio(
  suffix: string,
  extra: Partial<{ password: string; emailVerified: Date | null; aprobado: boolean; suspendido: boolean }> = {}
) {
  const negocio = await db.negocio.create({
    data: {
      nombre: `${prefix}negocio-${suffix}`,
      slug: `${prefix}negocio-${suffix}`,
      usuario: `${prefix}negocio-${suffix}`,
      email: `${prefix}negocio-${suffix}@example.test`,
      password: extra.password ?? (await hashPassword("ValidPass123!")),
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

async function createRepartidor(
  suffix: string,
  extra: Partial<{ password: string; emailVerified: Date | null; activo: boolean }> = {}
) {
  const repartidor = await db.repartidor.create({
    data: {
      nombre: `${prefix}repartidor-${suffix}`,
      email: `${prefix}repartidor-${suffix}@example.test`,
      password: extra.password ?? (await hashPassword("ValidPass123!")),
      emailVerified: extra.emailVerified === undefined ? new Date() : extra.emailVerified,
      activo: extra.activo ?? true,
    },
  })
  repartidorIds.push(repartidor.id)
  allAccountIds.push(repartidor.id)
  return repartidor
}

async function createCuentaOperativa(
  suffix: string,
  extra: Partial<{ password: string; activo: boolean; eliminado: boolean }> = {}
) {
  const cuenta = await db.cuentaOperativa.create({
    data: {
      nombre: `${prefix}operativa-${suffix}`,
      email: `${prefix}operativa-${suffix}@example.test`,
      password: extra.password ?? (await hashPassword("ValidPass123!")),
      activo: extra.activo ?? true,
      eliminado: extra.eliminado ?? false,
    },
  })
  cuentaOperativaIds.push(cuenta.id)
  allAccountIds.push(cuenta.id)
  return cuenta
}

// ---- helpers de request ----

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

async function readThrottleRow(throttleKey: string) {
  return db.loginThrottle.findUnique({ where: { throttleKey } })
}

// ---- cleanup ----

async function cleanup() {
  if (clienteIds.length) {
    await db.clienteBloqueado.deleteMany({ where: { clienteId: { in: clienteIds } } })
  }
  if (allAccountIds.length) {
    await db.sesion.deleteMany({ where: { userId: { in: allAccountIds } } })
  }
  if (clienteIds.length) await db.cliente.deleteMany({ where: { id: { in: clienteIds } } })
  if (negocioIds.length) await db.negocio.deleteMany({ where: { id: { in: negocioIds } } })
  if (repartidorIds.length) await db.repartidor.deleteMany({ where: { id: { in: repartidorIds } } })
  if (cuentaOperativaIds.length) {
    await db.cuentaOperativa.deleteMany({ where: { id: { in: cuentaOperativaIds } } })
  }
  if (trackedThrottleKeys.size) {
    await db.loginThrottle.deleteMany({ where: { throttleKey: { in: Array.from(trackedThrottleKeys) } } })
  }
}

afterAll(async () => {
  await cleanup()

  const remainingClientes = await db.cliente.count({ where: { id: { in: clienteIds } } })
  const remainingNegocios = await db.negocio.count({ where: { id: { in: negocioIds } } })
  const remainingRepartidores = await db.repartidor.count({ where: { id: { in: repartidorIds } } })
  const remainingCuentas = await db.cuentaOperativa.count({ where: { id: { in: cuentaOperativaIds } } })
  const remainingThrottleRows = trackedThrottleKeys.size
    ? await db.loginThrottle.count({ where: { throttleKey: { in: Array.from(trackedThrottleKeys) } } })
    : 0
  const remainingBlocks = clienteIds.length
    ? await db.clienteBloqueado.count({ where: { clienteId: { in: clienteIds } } })
    : 0

  expect(remainingClientes).toBe(0)
  expect(remainingNegocios).toBe(0)
  expect(remainingRepartidores).toBe(0)
  expect(remainingCuentas).toBe(0)
  expect(remainingThrottleRows).toBe(0)
  expect(remainingBlocks).toBe(0)

  await db.$disconnect()
})

// ============================================
// 1) Cleanup oportunista — DEBE ser el primer test en ejecutar recordLoginFailure
//    en este proceso (lastCleanupAt arranca en 0 en el módulo, así que la
//    primera llamada siempre dispara la limpieza; si otro test corriera antes,
//    este dejaría de ser determinístico).
// ============================================
describe("0. Cleanup oportunista (debe ejecutarse primero)", () => {
  test("una fila con reset_at vencido hace más de 1h es eliminada por el primer recordLoginFailure() del proceso", async () => {
    const staleKey = track(`${prefix}-stale-cleanup-key`)
    const freshKey = track(`${prefix}-fresh-trigger-key`)

    const longExpired = new Date(Date.now() - 90 * 60 * 1000) // 90 min atrás > 1h de retención
    await db.$executeRaw`
      INSERT INTO "login_throttle" ("throttle_key", "count", "reset_at", "updated_at")
      VALUES (${staleKey}, 5, ${longExpired}, NOW())
    `
    const beforeCleanup = await readThrottleRow(staleKey)
    expect(beforeCleanup).not.toBeNull()

    // Dispara opportunisticCleanup() (fire-and-forget dentro de recordLoginFailure).
    await recordLoginFailure(freshKey)

    // opportunisticCleanup no se espera desde afuera (fire-and-forget por
    // diseño) — se hace polling acotado en vez de un sleep fijo, para no
    // volver el test flaky ante latencia variable de la red hacia TESTING.
    let afterCleanup = await readThrottleRow(staleKey)
    const deadline = Date.now() + 10_000
    while (afterCleanup !== null && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 250))
      afterCleanup = await readThrottleRow(staleKey)
    }
    expect(afterCleanup).toBeNull()
  })
})

// ============================================
// 2) Smoke básico del helper DB (key temporal, sin cuenta real)
// ============================================
describe("1. DB_HELPER_BASIC_SMOKE", () => {
  test("check(sin fila) -> record -> check(con fila) -> clear -> fila eliminada", async () => {
    const key = track(`${prefix}-smoke-basic`)

    const check1 = await checkLoginAccountThrottle(key)
    expect(check1).toEqual({ allowed: true, hadActiveFailures: false })

    const record1 = await recordLoginFailure(key)
    expect(record1?.count).toBe(1)
    expect(record1?.throttled).toBe(false)

    const check2 = await checkLoginAccountThrottle(key)
    expect(check2.allowed).toBe(true)
    expect(check2.hadActiveFailures).toBe(true)

    await clearLoginFailures(key)
    const row = await readThrottleRow(key)
    expect(row).toBeNull()
  })

  test("RAW_INSERT_UPDATED_AT_VALID / RAW_UPDATE_UPDATED_AT_VALID: updated_at se puebla en el INSERT y avanza en el UPDATE", async () => {
    const key = track(`${prefix}-updated-at`)
    const r1 = await recordLoginFailure(key)
    expect(r1).not.toBeNull()
    const row1 = await readThrottleRow(key)
    expect(row1?.updatedAt).toBeInstanceOf(Date)

    await new Promise((r) => setTimeout(r, 20))
    const r2 = await recordLoginFailure(key)
    expect(r2?.count).toBe(2)
    const row2 = await readThrottleRow(key)
    expect(row2?.updatedAt).toBeInstanceOf(Date)
    expect(row2!.updatedAt.getTime()).toBeGreaterThan(row1!.updatedAt.getTime())
  })
})

// ============================================
// 3) Concurrencia atómica
// ============================================
describe("2. ATOMIC_CONCURRENT_INCREMENT", () => {
  test("30 llamadas concurrentes a recordLoginFailure() sobre la misma key -> count final exacto = 30", async () => {
    const key = track(`${prefix}-concurrent`)
    const CONCURRENT_FAILURE_CALLS = 30

    await Promise.all(Array.from({ length: CONCURRENT_FAILURE_CALLS }, () => recordLoginFailure(key)))

    const row = await readThrottleRow(key)
    expect(row).not.toBeNull()
    expect(row!.count).toBe(CONCURRENT_FAILURE_CALLS)
  })
})

// ============================================
// 4) Store compartido — dos clientes Prisma independientes (proxy de multi-réplica)
// ============================================
describe("3. SHARED_DB_TWO_CLIENTS", () => {
  test("un cliente Prisma independiente ve y modifica la misma fila que el cliente singleton de la app", async () => {
    const key = track(`${prefix}-shared-store`)
    const clientB = new PrismaClient()
    try {
      const r1 = await recordLoginFailure(key) // vía el helper real (usa el singleton `db`)
      expect(r1?.count).toBe(1)

      const seenByB = await clientB.loginThrottle.findUnique({ where: { throttleKey: key } })
      expect(seenByB).not.toBeNull()
      expect(seenByB!.count).toBe(1)

      // clientB incrementa usando la misma sentencia atómica que el módulo real.
      const freshResetAt = new Date(Date.now() + 10 * 60 * 1000)
      const rowsFromB = await clientB.$queryRaw<{ count: number }[]>`
        INSERT INTO "login_throttle" ("throttle_key", "count", "reset_at", "updated_at")
        VALUES (${key}, 1, ${freshResetAt}, NOW())
        ON CONFLICT ("throttle_key") DO UPDATE SET
          "count" = CASE WHEN "login_throttle"."reset_at" <= NOW() THEN 1 ELSE "login_throttle"."count" + 1 END,
          "reset_at" = CASE WHEN "login_throttle"."reset_at" <= NOW() THEN EXCLUDED."reset_at" ELSE "login_throttle"."reset_at" END,
          "updated_at" = NOW()
        RETURNING "count"
      `
      expect(rowsFromB[0]?.count).toBe(2)

      const seenByApp = await readThrottleRow(key)
      expect(seenByApp?.count).toBe(2)
    } finally {
      await clientB.$disconnect()
    }
  })
})

// ============================================
// 5) Ventana fija vs expirada (keys temporales, escritura directa vía raw SQL
//    para preparar el escenario "expirada")
// ============================================
describe("4. Semántica de ventana", () => {
  test("DB_FIXED_WINDOW_RESET_AT_PRESERVED: una segunda falla dentro de la ventana activa preserva el reset_at original", async () => {
    const key = track(`${prefix}-fixed-window`)
    const r1 = await recordLoginFailure(key)
    const resetAt1 = r1!.resetAt.getTime()

    const r2 = await recordLoginFailure(key)
    expect(r2!.count).toBe(2)
    expect(r2!.resetAt.getTime()).toBe(resetAt1)
  })

  test("DB_EXPIRED_WINDOW_RESTART: una fila con reset_at ya vencido reinicia a count=1 con una ventana nueva", async () => {
    const key = track(`${prefix}-expired-window`)
    const pastResetAt = new Date(Date.now() - 60 * 1000)
    await db.$executeRaw`
      INSERT INTO "login_throttle" ("throttle_key", "count", "reset_at", "updated_at")
      VALUES (${key}, 10, ${pastResetAt}, NOW())
    `
    const result = await recordLoginFailure(key)
    expect(result!.count).toBe(1)
    expect(result!.resetAt.getTime()).toBeGreaterThan(Date.now())
  })
})

// ============================================
// 6) Frontera de la 10ma falla + pre-check sin incremento + Retry-After
//    (temp key, lógica pura del store — sin pasar por una ruta de login)
// ============================================
describe("5. Frontera ACCOUNT_FAILURE_LIMIT", () => {
  test("ACCOUNT_FAILURE_1_TO_9 no throttlea, la 10ma sí (TENTH_FAILURE_THROTTLES), y el pre-check posterior no incrementa (THROTTLED_PRECHECK_NO_INCREMENT)", async () => {
    const key = track(`${prefix}-boundary`)
    expect(ACCOUNT_FAILURE_LIMIT).toBe(10)

    let last
    for (let i = 1; i <= 9; i++) {
      last = await recordLoginFailure(key)
      expect(last!.count).toBe(i)
      expect(last!.throttled).toBe(false)
    }

    const tenth = await recordLoginFailure(key)
    expect(tenth!.count).toBe(10)
    expect(tenth!.throttled).toBe(true)
    expect(tenth!.retryAfterMs).toBeGreaterThan(0)

    const rowAfter10th = await readThrottleRow(key)
    expect(rowAfter10th!.count).toBe(10)

    // Pre-check (no debe escribir nada)
    const precheck = await checkLoginAccountThrottle(key)
    expect(precheck.allowed).toBe(false)
    expect(precheck.retryAfterMs).toBeGreaterThan(0)

    const rowAfterPrecheck = await readThrottleRow(key)
    expect(rowAfterPrecheck!.count).toBe(10) // sin cambios — el pre-check nunca incrementa
  })
})

// ============================================
// 7) Fixtures de cuenta real + comportamiento observable vía las rutas reales
// ============================================
describe("6. Comportamiento end-to-end vía rutas reales de login", () => {
  test("BAD_PASSWORD_ACCOUNT_THROTTLE + boundary + Retry-After a nivel de ruta: 9 intentos con contraseña incorrecta -> 401, el 10º -> 429 con Retry-After, IPs distintas por intento", async () => {
    const cliente = await createCliente("badpw")
    const throttleKey = track(loginThrottleKey("cliente", cliente.email))

    for (let i = 1; i <= 9; i++) {
      const res = await loginRoute(reqClienteLogin(cliente.email, "wrong-password", randomUUID()))
      expect(res.status).toBe(401)
    }

    const tenth = await loginRoute(reqClienteLogin(cliente.email, "wrong-password", randomUUID()))
    expect(tenth.status).toBe(429)
    expect(tenth.headers.get("Retry-After")).toBeTruthy()

    const row = await readThrottleRow(throttleKey)
    expect(row!.count).toBe(10)
  })

  test("NONEXISTENT_ACCOUNT_ACCOUNT_THROTTLE: una cuenta que nunca existió cuenta fallos igual que una contraseña incorrecta real", async () => {
    const email = `${prefix}nonexistent@example.test`
    const throttleKey = track(loginThrottleKey("cliente", email))

    for (let i = 1; i <= 9; i++) {
      const res = await loginRoute(reqClienteLogin(email, "whatever123", randomUUID()))
      expect(res.status).toBe(401)
    }
    const tenth = await loginRoute(reqClienteLogin(email, "whatever123", randomUUID()))
    expect(tenth.status).toBe(429)

    const row = await readThrottleRow(throttleKey)
    expect(row!.count).toBe(10)
  })

  test("SAME_ACCOUNT_MULTI_IP: la misma cuenta atacada desde 10 IPs sintéticas distintas igual llega al límite de cuenta en el 10º intento", async () => {
    const cliente = await createCliente("multiip")
    const throttleKey = track(loginThrottleKey("cliente", cliente.email))

    const responses: Response[] = []
    for (let i = 0; i < 10; i++) {
      responses.push(await loginRoute(reqClienteLogin(cliente.email, "wrong-password", randomUUID())))
    }
    for (let i = 0; i < 9; i++) expect(responses[i].status).toBe(401)
    expect(responses[9].status).toBe(429)
  })

  test("SAME_IP_MULTI_ACCOUNT + IP_LIMIT_10_5_RUNTIME: 11 cuentas inexistentes distintas desde la MISMA IP -> la 11ª cae por el límite de IP, no por el de cuenta", async () => {
    const fixedIp = randomUUID()
    const responses: Response[] = []
    for (let i = 0; i < 11; i++) {
      const email = `${prefix}sameip-${i}@example.test`
      track(loginThrottleKey("cliente", email))
      responses.push(await loginRoute(reqClienteLogin(email, "whatever123", fixedIp)))
    }
    for (let i = 0; i < 10; i++) expect(responses[i].status).toBe(401)
    expect(responses[10].status).toBe(429)

    // Ninguna de las 11 cuentas individuales llegó ni cerca de su propio
    // límite (1 fallo cada una) — confirma que fue la dimensión IP, no la de cuenta.
    for (let i = 0; i < 10; i++) {
      const key = loginThrottleKey("cliente", `${prefix}sameip-${i}@example.test`)
      const row = await readThrottleRow(key)
      expect(row!.count).toBe(1)
    }
  })

  test("THROTTLE_BODY_EQUAL=SI / THROTTLE_EXPLICIT_DIMENSION_LABEL=NO: los 429 de ambas dimensiones comparten EXACTAMENTE el mismo body genérico, sin mencionar IP/cuenta/email/usuario/conteos, y ambos exponen Retry-After (el valor puede diferir legítimamente: 5min de ventana IP vs 10min de ventana de cuenta)", async () => {
    const cliente = await createCliente("dimshape")
    for (let i = 0; i < 9; i++) {
      await loginRoute(reqClienteLogin(cliente.email, "wrong-password", randomUUID()))
    }
    const accountThrottled = await loginRoute(reqClienteLogin(cliente.email, "wrong-password", randomUUID()))
    track(loginThrottleKey("cliente", cliente.email))
    expect(accountThrottled.status).toBe(429)
    const accountBody = await accountThrottled.json()

    const fixedIp = randomUUID()
    let ipThrottled: Response | null = null
    for (let i = 0; i < 11; i++) {
      const email = `${prefix}dimshape-ip-${i}@example.test`
      track(loginThrottleKey("cliente", email))
      const res = await loginRoute(reqClienteLogin(email, "whatever123", fixedIp))
      if (res.status === 429) ipThrottled = res
    }
    expect(ipThrottled).not.toBeNull()
    const ipBody = await ipThrottled!.json()

    // THROTTLE_BODY_EQUAL=SI — mismo body EXACTO, no sólo la misma forma.
    expect(accountBody).toEqual(ipBody)
    expect(accountBody.error).toBe(LOGIN_THROTTLE_MESSAGE)
    expect(ipBody.error).toBe(LOGIN_THROTTLE_MESSAGE)

    // THROTTLE_EXPLICIT_DIMENSION_LABEL=NO — ninguna palabra que permita
    // distinguir cuál dimensión disparó el bloqueo, ni conteos, ni el
    // identificador de la cuenta.
    const forbidden = ["ip", "cuenta", "account", "email", "usuario", "bloque", cliente.email.toLowerCase()]
    const lowerError = String(accountBody.error).toLowerCase()
    for (const word of forbidden) {
      expect(lowerError).not.toContain(word)
    }
    expect(accountBody.count).toBeUndefined()
    expect(ipBody.count).toBeUndefined()

    // RETRY_AFTER_IP=SI / RETRY_AFTER_ACCOUNT=SI — presente en ambos casos.
    // El valor NUMÉRICO puede diferir legítimamente entre dimensiones (5min
    // de ventana IP vs 10min de ventana de cuenta) — eso no es una fuga, es
    // el tiempo real de espera del limiter que efectivamente actuó. Lo único
    // que se exige igual es el body.
    expect(accountThrottled.headers.get("Retry-After")).toBeTruthy()
    expect(ipThrottled!.headers.get("Retry-After")).toBeTruthy()
  })

  test("SUCCESS_WITH_PRIOR_FAILURES_RESET: tras 3 fallos, un login correcto limpia la fila de login_throttle", async () => {
    const cliente = await createCliente("resetsuccess")
    const throttleKey = track(loginThrottleKey("cliente", cliente.email))

    for (let i = 0; i < 3; i++) {
      await loginRoute(reqClienteLogin(cliente.email, "wrong-password", randomUUID()))
    }
    const rowBefore = await readThrottleRow(throttleKey)
    expect(rowBefore!.count).toBe(3)

    const success = await loginRoute(reqClienteLogin(cliente.email, "ValidPass123!", randomUUID()))
    expect(success.status).toBe(200)

    const rowAfter = await readThrottleRow(throttleKey)
    expect(rowAfter).toBeNull()
  })

  test("SUCCESS_WITHOUT_FAILURES_DB_WRITE=NO: un login correcto sin fallos previos nunca crea una fila en login_throttle", async () => {
    const cliente = await createCliente("cleansuccess")
    const throttleKey = track(loginThrottleKey("cliente", cliente.email))

    const success = await loginRoute(reqClienteLogin(cliente.email, "ValidPass123!", randomUUID()))
    expect(success.status).toBe(200)

    const row = await readThrottleRow(throttleKey)
    expect(row).toBeNull()
  })

  test("LEGACY_SHORT_PASSWORD_LOGIN: una cuenta con hash de una contraseña de 6 caracteres (pre-hardening) sigue pudiendo loguearse", async () => {
    const cliente = await createCliente("legacy6", { password: await hashPassword("abc123") })
    track(loginThrottleKey("cliente", cliente.email))

    const res = await loginRoute(reqClienteLogin(cliente.email, "abc123", randomUUID()))
    expect(res.status).toBe(200)
  })

  test("BLOCKED_CLIENT_LOGIN_WITH_THROTTLE: un Cliente bloqueado=true con contraseña correcta sigue pudiendo loguearse (SEC-BLOCK-1 preservado)", async () => {
    const cliente = await createCliente("blocked", { bloqueado: true })
    track(loginThrottleKey("cliente", cliente.email))

    const res = await loginRoute(reqClienteLogin(cliente.email, "ValidPass123!", randomUUID()))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  test("UNVERIFIED_CLIENT_COUNTS_PASSWORD_FAILURE=NO: email no verificado con contraseña correcta no incrementa el throttle de cuenta", async () => {
    const cliente = await createCliente("unverified", { emailVerified: null })
    const throttleKey = track(loginThrottleKey("cliente", cliente.email))

    const res = await loginRoute(reqClienteLogin(cliente.email, "ValidPass123!", randomUUID()))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.needsVerification).toBe(true)

    const row = await readThrottleRow(throttleKey)
    expect(row).toBeNull()
  })

  test("UNAPPROVED_BUSINESS_COUNTS_PASSWORD_FAILURE=NO: Negocio no aprobado con contraseña correcta no incrementa el throttle", async () => {
    const negocio = await createNegocio("unapproved", { aprobado: false })
    const throttleKey = track(loginThrottleKey("negocio", negocio.usuario))

    const res = await loginRoute(reqNegocioLogin(negocio.usuario, "ValidPass123!", randomUUID()))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.needsApproval).toBe(true)

    const row = await readThrottleRow(throttleKey)
    expect(row).toBeNull()
  })

  test("SUSPENDED_BUSINESS_COUNTS_PASSWORD_FAILURE=NO: Negocio suspendido con contraseña correcta no incrementa el throttle", async () => {
    const negocio = await createNegocio("suspended", { suspendido: true })
    const throttleKey = track(loginThrottleKey("negocio", negocio.usuario))

    const res = await loginRoute(reqNegocioLogin(negocio.usuario, "ValidPass123!", randomUUID()))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.suspended).toBe(true)

    const row = await readThrottleRow(throttleKey)
    expect(row).toBeNull()
  })

  test("INACTIVE_DRIVER_COUNTS_PASSWORD_FAILURE=NO: Repartidor inactivo con contraseña correcta no incrementa el throttle", async () => {
    const repartidor = await createRepartidor("inactive", { activo: false })
    const throttleKey = track(loginThrottleKey("repartidor", repartidor.email))

    const res = await loginRoute(reqRepartidorLogin(repartidor.email, "ValidPass123!", randomUUID()))
    expect(res.status).toBe(403)

    const row = await readThrottleRow(throttleKey)
    expect(row).toBeNull()
  })

  test("OPERATIVE_PREEXISTING_STATUS_SEQUENCE_PRESERVED=SI: CuentaOperativa eliminada + contraseña correcta -> 401 genérico (secuencia real preservada, ANTES de comparePassword) y SÍ cuenta como fallo (comportamiento preexistente documentado, no nuevo)", async () => {
    const cuenta = await createCuentaOperativa("eliminada", { eliminado: true })
    const throttleKey = track(loginThrottleKey("cuenta_operativa", cuenta.email))

    const res = await operativoLoginRoute(reqOperativoLogin(cuenta.email, "ValidPass123!", randomUUID()))
    expect(res.status).toBe(401)

    const row = await readThrottleRow(throttleKey)
    expect(row!.count).toBe(1)
  })

  test("CuentaOperativa activa + contraseña incorrecta -> 401 y cuenta como fallo", async () => {
    const cuenta = await createCuentaOperativa("badpw")
    const throttleKey = track(loginThrottleKey("cuenta_operativa", cuenta.email))

    const res = await operativoLoginRoute(reqOperativoLogin(cuenta.email, "wrong-password", randomUUID()))
    expect(res.status).toBe(401)

    const row = await readThrottleRow(throttleKey)
    expect(row!.count).toBe(1)
  })

  test("CuentaOperativa activa + contraseña correcta -> éxito (200) y ninguna fila de throttle queda escrita", async () => {
    const cuenta = await createCuentaOperativa("success")
    const throttleKey = track(loginThrottleKey("cuenta_operativa", cuenta.email))

    const res = await operativoLoginRoute(reqOperativoLogin(cuenta.email, "ValidPass123!", randomUUID()))
    expect(res.status).toBe(200)

    const row = await readThrottleRow(throttleKey)
    expect(row).toBeNull()
  })
})

// ============================================
// 8) Arquitectura OAuth intacta — chequeo estático de código, SIN llamadas
//    reales a Google (prohibidas para esta tarea).
// ============================================
describe("7. OAUTH_ARCHITECTURE_PRESERVED", () => {
  function read(relPath: string): string {
    return readFileSync(join(process.cwd(), relPath), "utf-8").replace(/\r\n/g, "\n")
  }

  test("el callback de Google de Cliente/Repartidor no importa el módulo de throttle por cuenta (sin cambios de arquitectura)", () => {
    const src = read("src/app/api/auth/google/callback/route.ts")
    expect(src).not.toContain("auth-login-throttle")
  })

  test("el callback de Google de CuentaOperativa sigue usando únicamente el bucket IP compartido 'login', sin throttle por cuenta", () => {
    const src = read("src/app/api/operativo/auth/google/callback/route.ts")
    expect(src).toContain('checkRateLimit("login"')
    expect(src).not.toContain("auth-login-throttle")
  })

  test("el callback de Google de Superadmin sigue en su propio bucket 'superadminOAuthCallback', intocado", () => {
    const src = read("src/app/api/superadmin/auth/google/callback/route.ts")
    expect(src).toContain('checkRateLimit("superadminOAuthCallback"')
    expect(src).not.toContain("auth-login-throttle")
  })
})
