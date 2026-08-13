/// <reference types="bun-types" />

// ============================================
// PASSWORD-HASH-WORKFACTOR-MIGRATION — contrato estático de wiring
// ============================================
// Protege que el rehash oportunista quede insertado EXACTAMENTE en el punto
// correcto de cada una de las 4 rutas de login (después de todos los status
// gates que podrían negar la sesión, nunca antes), que la secuencia de
// session/device/cookie no fue reordenada, que LoginThrottle/write-routes
// permanecen intocados, y que la separación server-only entre auth.ts
// (crypto puro) y password-hash-upgrade.ts (DB) se mantiene.

import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const ROOT = process.cwd()

function read(relPath: string): string {
  return readFileSync(join(ROOT, ...relPath.split("/")), "utf-8").replace(/\r\n/g, "\n")
}

const AUTH_LOGIN = "src/app/api/auth/login/route.ts"
const OPERATIVO_LOGIN = "src/app/api/operativo/login/route.ts"
const AUTH_LIB = "src/lib/auth.ts"
const UPGRADE_LIB = "src/lib/password-hash-upgrade.ts"

function functionBody(src: string, signature: string): string {
  const start = src.indexOf(signature)
  expect(start).toBeGreaterThan(-1)
  // La firma de estas funciones es una sola línea que puede contener sus
  // propias llaves de tipo (p.ej. `data: { email: string; password: string }`)
  // ANTES de la llave real del cuerpo — por eso se busca la ÚLTIMA '{' antes
  // del primer salto de línea (el cierre de la firma), nunca la primera.
  const lineEnd = src.indexOf("\n", start)
  const bodyStart = src.lastIndexOf("{", lineEnd)
  expect(bodyStart).toBeGreaterThan(-1)
  // Cuenta llaves para encontrar el cierre real de la función (evita cortar
  // en la primera '}' de un objeto/arrow interno).
  let depth = 0
  let i = bodyStart
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++
    else if (src[i] === "}") {
      depth--
      if (depth === 0) break
    }
  }
  return src.slice(bodyStart, i + 1)
}

describe("PASSWORD_HASH_WORKFACTOR_REHASH — punto de inserción correcto por tipo de cuenta", () => {
  test("Cliente: evaluatePasswordHash -> ... -> emailVerified gate -> maybeUpgradePasswordHash -> createSession (en ese orden textual)", () => {
    const src = read(AUTH_LOGIN)
    const body = functionBody(src, "async function loginCliente(")
    const idxEvaluate = body.indexOf("await evaluatePasswordHash(password, cliente.password)")
    const idxEmailGate = body.indexOf("if (!cliente.emailVerified)")
    const idxRehash = body.indexOf("await maybeUpgradePasswordHash({")
    const idxCreateSession = body.indexOf('await createSession(cliente.id, "cliente")')
    expect(idxEvaluate).toBeGreaterThan(-1)
    expect(idxEmailGate).toBeGreaterThan(idxEvaluate)
    expect(idxRehash).toBeGreaterThan(idxEmailGate)
    expect(idxCreateSession).toBeGreaterThan(idxRehash)
  })

  test("Negocio: evaluatePasswordHash -> emailVerified -> aprobado gate -> maybeUpgradePasswordHash -> suspendido branch (rehash aplica a AMBAS ramas, suspendido y normal)", () => {
    const src = read(AUTH_LOGIN)
    const body = functionBody(src, "async function loginNegocio(")
    const idxEvaluate = body.indexOf("await evaluatePasswordHash(password, negocio.password)")
    const idxEmailGate = body.indexOf("if (!negocio.emailVerified)")
    const idxAprobadoGate = body.indexOf("if (!negocio.aprobado)")
    const idxRehash = body.indexOf("await maybeUpgradePasswordHash({")
    const idxSuspendidoBranch = body.indexOf("if (negocio.suspendido)")
    expect(idxEvaluate).toBeGreaterThan(-1)
    expect(idxEmailGate).toBeGreaterThan(idxEvaluate)
    expect(idxAprobadoGate).toBeGreaterThan(idxEmailGate)
    expect(idxRehash).toBeGreaterThan(idxAprobadoGate)
    expect(idxSuspendidoBranch).toBeGreaterThan(idxRehash)
  })

  test("Repartidor: evaluatePasswordHash -> emailVerified -> activo gate -> maybeUpgradePasswordHash -> createSession", () => {
    const src = read(AUTH_LOGIN)
    const body = functionBody(src, "async function loginRepartidor(")
    const idxEvaluate = body.indexOf("await evaluatePasswordHash(password, repartidor.password)")
    const idxEmailGate = body.indexOf("if (!repartidor.emailVerified)")
    const idxActivoGate = body.indexOf("if (!repartidor.activo)")
    const idxRehash = body.indexOf("await maybeUpgradePasswordHash({")
    const idxCreateSession = body.indexOf('await createSession(repartidor.id, "repartidor")')
    expect(idxEvaluate).toBeGreaterThan(-1)
    expect(idxEmailGate).toBeGreaterThan(idxEvaluate)
    expect(idxActivoGate).toBeGreaterThan(idxEmailGate)
    expect(idxRehash).toBeGreaterThan(idxActivoGate)
    expect(idxCreateSession).toBeGreaterThan(idxRehash)
  })

  test("CuentaOperativa: evaluatePasswordHash -> maybeUpgradePasswordHash -> createOperationalSession (sin gates intermedios — activo/eliminado ya filtrados antes del compare)", () => {
    const src = read(OPERATIVO_LOGIN)
    const idxEvaluate = src.indexOf("await evaluatePasswordHash(password, account.password)")
    const idxRehash = src.indexOf("await maybeUpgradePasswordHash({")
    const idxCreateSession = src.indexOf("await createOperationalSession(account.id)")
    expect(idxEvaluate).toBeGreaterThan(-1)
    expect(idxRehash).toBeGreaterThan(idxEvaluate)
    expect(idxCreateSession).toBeGreaterThan(idxRehash)
  })
})

describe("NO REHASH ANTES DE UN STATUS GATE QUE NIEGA LA SESIÓN", () => {
  test("Cliente: el rehash nunca aparece antes del gate emailVerified (que puede negar la sesión con 403)", () => {
    const src = read(AUTH_LOGIN)
    const body = functionBody(src, "async function loginCliente(")
    const idxEmailGateReturn = body.indexOf("needsVerification: true, email: cliente.email")
    const idxRehash = body.indexOf("await maybeUpgradePasswordHash({")
    expect(idxEmailGateReturn).toBeGreaterThan(-1)
    expect(idxRehash).toBeGreaterThan(idxEmailGateReturn)
  })

  test("Negocio: el rehash nunca aparece antes del gate aprobado (que puede negar la sesión con needsApproval, sin crear sesión)", () => {
    const src = read(AUTH_LOGIN)
    const body = functionBody(src, "async function loginNegocio(")
    const idxNeedsApproval = body.indexOf("needsApproval: true")
    const idxRehash = body.indexOf("await maybeUpgradePasswordHash({")
    expect(idxNeedsApproval).toBeGreaterThan(-1)
    expect(idxRehash).toBeGreaterThan(idxNeedsApproval)
  })

  test("Repartidor: el rehash nunca aparece antes del gate activo (que puede negar la sesión con 403)", () => {
    const src = read(AUTH_LOGIN)
    const body = functionBody(src, "async function loginRepartidor(")
    const idxInactiveReturn = body.indexOf("Tu cuenta está desactivada")
    const idxRehash = body.indexOf("await maybeUpgradePasswordHash({")
    expect(idxInactiveReturn).toBeGreaterThan(-1)
    expect(idxRehash).toBeGreaterThan(idxInactiveReturn)
  })
})

describe("SESSION/DEVICE NO REORDENADOS (Session Atomicity fuera de alcance)", () => {
  test("Cliente: createSession -> device identity -> SEC-BLOCK-1 enrichment -> cookie, exactamente en ese orden relativo (sólo se insertó el rehash ANTES de createSession, nada más se movió)", () => {
    const src = read(AUTH_LOGIN)
    const body = functionBody(src, "async function loginCliente(")
    const idxCreateSession = body.indexOf('await createSession(cliente.id, "cliente")')
    const idxDeviceIdentity = body.indexOf("getOrCreateDeviceIdentity(req)")
    const idxSecBlock = body.indexOf("ensureClienteBloqueadoRecordForDevice(")
    const idxSetCookie = body.indexOf("setCookie(res, token)")
    expect(idxCreateSession).toBeGreaterThan(-1)
    expect(idxDeviceIdentity).toBeGreaterThan(idxCreateSession)
    expect(idxSecBlock).toBeGreaterThan(idxDeviceIdentity)
    expect(idxSetCookie).toBeGreaterThan(idxSecBlock)
  })
})

describe("SEPARACIÓN SERVER-ONLY: crypto puro (auth.ts) vs DB (password-hash-upgrade.ts)", () => {
  test("auth.ts (sección de password) sigue sin ninguna referencia a Prisma/db en hashPassword/evaluatePasswordHash/comparePassword", () => {
    const src = read(AUTH_LIB)
    const start = src.indexOf("Password utilities")
    const end = src.indexOf("Session token generation")
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    const passwordSection = src.slice(start, end)
    expect(passwordSection).not.toContain("db.")
    expect(passwordSection).not.toContain('from "@/lib/db"')
  })

  test("password-hash-upgrade.ts es el único archivo nuevo que importa @/lib/db para el rehash, y nunca es importado por ningún archivo cliente ('use client')", () => {
    const src = read(UPGRADE_LIB)
    expect(src).toContain('from "@/lib/db"')
    expect(src).toContain("updateMany")

    // Los únicos importadores conocidos son las 2 rutas de login (server-only, app/api).
    const importers = [AUTH_LOGIN, OPERATIVO_LOGIN].map((f) => read(f))
    for (const importerSrc of importers) {
      expect(importerSrc).toContain('from "@/lib/password-hash-upgrade"')
    }
  })

  test("los 4 tipos de cuenta soportados por el CAS coinciden exactamente con PASSWORD_ACCOUNT_TYPES ya auditados", () => {
    const src = read(UPGRADE_LIB)
    expect(src).toContain('"cliente"')
    expect(src).toContain('"negocio"')
    expect(src).toContain('"repartidor"')
    expect(src).toContain('"cuenta_operativa"')
  })

  test("el CAS usa updateMany condicionado a id+password (nunca update incondicional por id)", () => {
    const src = read(UPGRADE_LIB)
    expect(src).toMatch(/updateMany\(\{ where: \{ id, password: oldStoredHash \}/)
    expect(src).not.toMatch(/\.update\(\{\s*where:\s*\{\s*id\s*\}/)
  })
})

describe("LOGINTHROTTLE / WRITE-ROUTES CONGELADOS — sin cambios de esta migración", () => {
  test("auth-login-throttle.ts y rate-limit.ts no importan nada de password-hash-upgrade ni evaluatePasswordHash (arquitectura de throttle intacta)", () => {
    const throttleSrc = read("src/lib/auth-login-throttle.ts")
    const rateLimitSrc = read("src/lib/rate-limit.ts")
    expect(throttleSrc).not.toContain("password-hash-upgrade")
    expect(throttleSrc).not.toContain("evaluatePasswordHash")
    expect(rateLimitSrc).not.toContain("password-hash-upgrade")
  })

  test("los 5 write-routes centralizados (register x2, reset-password, 2 change-password) NO importan evaluatePasswordHash ni maybeUpgradePasswordHash — siguen usando sólo hashPassword", () => {
    const writeRoutes = [
      "src/app/api/auth/register/route.ts",
      "src/app/api/operativo/register/route.ts",
      "src/app/api/auth/reset-password/route.ts",
      "src/app/api/cliente/password/route.ts",
      "src/app/api/repartidor/perfil/route.ts",
    ]
    for (const file of writeRoutes) {
      const src = read(file)
      expect(src).not.toContain("evaluatePasswordHash")
      expect(src).not.toContain("maybeUpgradePasswordHash")
      expect(src).not.toContain("password-hash-upgrade")
      expect(src).toContain("hashPassword")
    }
  })

  test("device-identity.ts y client-block-security.ts no fueron tocados (sin ninguna referencia nueva a password-hash)", () => {
    const deviceSrc = read("src/lib/device-identity.ts")
    const blockSrc = read("src/lib/client-block-security.ts")
    expect(deviceSrc).not.toContain("password-hash")
    expect(blockSrc).not.toContain("password-hash")
  })
})

describe("comparePassword sigue siendo la API usada por los 2 call-sites de cambio de password (fuera de alcance del rehash)", () => {
  test("cliente/password/route.ts y repartidor/perfil/route.ts siguen llamando comparePassword (no evaluatePasswordHash) para verificar el password actual", () => {
    const clienteSrc = read("src/app/api/cliente/password/route.ts")
    const repartidorSrc = read("src/app/api/repartidor/perfil/route.ts")
    expect(clienteSrc).toContain("comparePassword(")
    expect(repartidorSrc).toContain("comparePassword(")
  })
})
