/// <reference types="bun-types" />

// ============================================
// SESSION_LOGIN_ATOMICITY_DEBT — contrato estático de wiring
// ============================================
// Protege que session INSERT + backfill de dispositivoFingerprint +
// enrichment SEC-BLOCK-1 vivan dentro de la MISMA transacción Prisma en
// loginCliente, que las cookies (sesión y dispositivo) sólo se configuren
// DESPUÉS de esa transacción, que el rehash de password permanezca fuera y
// antes, y que ningún otro flujo de login/helper relacionado haya sido
// tocado por este cambio (comparado byte a byte contra HEAD, el commit ya
// desplegado y validado antes de esta deuda).

import { describe, expect, test } from "bun:test"
import { execSync } from "child_process"
import { readFileSync } from "fs"
import { join } from "path"

const ROOT = process.cwd()

function read(relPath: string): string {
  return readFileSync(join(ROOT, ...relPath.split("/")), "utf-8").replace(/\r\n/g, "\n")
}

function readAtHead(relPath: string): string {
  return execSync(`git show HEAD:${relPath}`, { cwd: ROOT, encoding: "utf-8" }).replace(/\r\n/g, "\n")
}

const AUTH_LOGIN = "src/app/api/auth/login/route.ts"
const AUTH_LIB = "src/lib/auth.ts"
const OPERATIVO_LOGIN = "src/app/api/operativo/login/route.ts"
const CLIENT_BLOCK_SECURITY = "src/lib/client-block-security.ts"
const DEVICE_IDENTITY = "src/lib/device-identity.ts"
const VERIFY_EMAIL = "src/app/api/auth/verify-email/route.ts"
const GOOGLE_CALLBACK = "src/app/api/auth/google/callback/route.ts"

function functionBody(src: string, signature: string): string {
  const start = src.indexOf(signature)
  expect(start).toBeGreaterThan(-1)
  // Encuentra el cierre REAL de la lista de parámetros contando paréntesis
  // (esto ignora correctamente llaves de tipo embebidas dentro de un
  // parámetro, p.ej. `data: { email: string; password: string }`, porque
  // sólo cuenta '(' / ')' durante esta fase, nunca '{' / '}').
  const parenStart = src.indexOf("(", start)
  expect(parenStart).toBeGreaterThan(-1)
  let parenDepth = 0
  let i = parenStart
  for (; i < src.length; i++) {
    if (src[i] === "(") parenDepth++
    else if (src[i] === ")") {
      parenDepth--
      if (parenDepth === 0) break
    }
  }
  // Desde el cierre de la lista de parámetros, la primera '{' es el inicio
  // real del cuerpo — cubre tanto firmas de una sola línea (sin return type
  // anotado) como firmas multi-línea con `): Promise<string> {` (el return
  // type acá nunca contiene '{').
  const bodyStart = src.indexOf("{", i)
  expect(bodyStart).toBeGreaterThan(-1)
  let braceDepth = 0
  let j = bodyStart
  for (; j < src.length; j++) {
    if (src[j] === "{") braceDepth++
    else if (src[j] === "}") {
      braceDepth--
      if (braceDepth === 0) break
    }
  }
  return src.slice(bodyStart, j + 1)
}

function transactionCallbackBody(fnBody: string): string {
  const marker = "db.$transaction(async (tx) => {"
  const idx = fnBody.indexOf(marker)
  expect(idx).toBeGreaterThan(-1)
  const braceStart = idx + marker.length - 1
  expect(fnBody[braceStart]).toBe("{")
  let depth = 0
  let i = braceStart
  for (; i < fnBody.length; i++) {
    if (fnBody[i] === "{") depth++
    else if (fnBody[i] === "}") {
      depth--
      if (depth === 0) break
    }
  }
  return fnBody.slice(braceStart, i + 1)
}

describe("1-6. Transacción — contenido exacto", () => {
  test("1. loginCliente usa db.$transaction(async (tx) => {...})", () => {
    const body = functionBody(read(AUTH_LOGIN), "async function loginCliente(")
    expect(body).toContain("await db.$transaction(async (tx) => {")
  })

  test("2. getOrCreateDeviceIdentity ocurre ANTES del transaction (orden textual)", () => {
    const body = functionBody(read(AUTH_LOGIN), "async function loginCliente(")
    const idxDevice = body.indexOf("getOrCreateDeviceIdentity(req)")
    const idxTx = body.indexOf("await db.$transaction(async (tx) => {")
    expect(idxDevice).toBeGreaterThan(-1)
    expect(idxTx).toBeGreaterThan(idxDevice)
  })

  test("3. createSessionWithClient(tx, cliente.id, \"cliente\") está DENTRO de la transacción", () => {
    const body = functionBody(read(AUTH_LOGIN), "async function loginCliente(")
    const txBody = transactionCallbackBody(body)
    expect(txBody).toContain('createSessionWithClient(tx, cliente.id, "cliente")')
  })

  test("4. el backfill de fingerprint usa tx.cliente.updateMany DENTRO de la transacción", () => {
    const body = functionBody(read(AUTH_LOGIN), "async function loginCliente(")
    const txBody = transactionCallbackBody(body)
    expect(txBody).toContain("tx.cliente.updateMany({")
    expect(txBody).toContain('dispositivoFingerprint: ""')
  })

  test("5. loginCliente NUNCA usa db.cliente.updateMany para el backfill (sólo tx.cliente.updateMany)", () => {
    const body = functionBody(read(AUTH_LOGIN), "async function loginCliente(")
    expect(body).not.toContain("db.cliente.updateMany(")
  })

  test("6. ensureClienteBloqueadoRecordForDevice recibe tx (no db) DENTRO de la transacción", () => {
    const body = functionBody(read(AUTH_LOGIN), "async function loginCliente(")
    const txBody = transactionCallbackBody(body)
    expect(txBody).toContain("ensureClienteBloqueadoRecordForDevice(tx, {")
    expect(body).not.toContain("ensureClienteBloqueadoRecordForDevice(db,")
  })
})

describe("7-9. Cookies y rehash — orden relativo a la transacción", () => {
  test("7. setCookie(res, token, \"cliente\") ocurre DESPUÉS de que la transacción resuelve", () => {
    // P2-T18-BLOCKER-AUTH2-R2 (Phase 1): setCookie ahora recibe la familia
    // de actor explícita — único cambio autorizado a esta llamada, ver
    // codex-reports/archive/P2-T18-BLOCKER-AUTH2-R1.md. El orden relativo a
    // la transacción (lo que este test protege) no cambió.
    const body = functionBody(read(AUTH_LOGIN), "async function loginCliente(")
    const idxReturn = body.indexOf("return sessionToken")
    const idxSetCookie = body.indexOf("setCookie(res, token, \"cliente\")")
    expect(idxReturn).toBeGreaterThan(-1)
    expect(idxSetCookie).toBeGreaterThan(idxReturn)
  })

  test("8. setDeviceCookie ocurre DESPUÉS de que la transacción resuelve", () => {
    const body = functionBody(read(AUTH_LOGIN), "async function loginCliente(")
    const idxReturn = body.indexOf("return sessionToken")
    const idxSetDeviceCookie = body.indexOf("setDeviceCookie(res, deviceIdentity.token)")
    expect(idxReturn).toBeGreaterThan(-1)
    expect(idxSetDeviceCookie).toBeGreaterThan(idxReturn)
  })

  test("9. maybeUpgradePasswordHash ocurre ANTES y FUERA de la transacción (non-blocking, sin cambios)", () => {
    const body = functionBody(read(AUTH_LOGIN), "async function loginCliente(")
    const idxRehash = body.indexOf("await maybeUpgradePasswordHash({")
    const idxTx = body.indexOf("await db.$transaction(async (tx) => {")
    expect(idxRehash).toBeGreaterThan(-1)
    expect(idxTx).toBeGreaterThan(idxRehash)
    const txBody = transactionCallbackBody(body)
    expect(txBody).not.toContain("maybeUpgradePasswordHash")
  })
})

describe("10-14. Sin cambios en otros flujos (comparación byte a byte contra HEAD)", () => {
  test("10. loginNegocio: idéntico a HEAD salvo el único cambio autorizado de Fase 1 (setCookie con familia explícita, en ambos call sites)", () => {
    // P2-T18-BLOCKER-AUTH2-R2 (Phase 1): loginNegocio nunca fue tocado por
    // SESSION_LOGIN_ATOMICITY_DEBT (eso sigue siendo cierto — 0 líneas
    // relacionadas con la transacción cambiaron). Su ÚNICO diff frente a
    // HEAD es el argumento de familia agregado a setCookie(), en sus dos
    // call sites (suspendido y normal) — normalizado acá antes de comparar
    // para seguir protegiendo contra cualquier OTRO cambio no autorizado.
    const current = functionBody(read(AUTH_LOGIN), "async function loginNegocio(")
    const atHeadRaw = functionBody(readAtHead(AUTH_LOGIN), "async function loginNegocio(")
    const atHeadNormalized = atHeadRaw.replaceAll("setCookie(res, token)", "setCookie(res, token, \"negocio\")")
    expect(current).toBe(atHeadNormalized)
  })

  test("11. loginRepartidor: idéntico a HEAD salvo el único cambio autorizado de Fase 1 (setCookie con familia explícita)", () => {
    const current = functionBody(read(AUTH_LOGIN), "async function loginRepartidor(")
    const atHeadRaw = functionBody(readAtHead(AUTH_LOGIN), "async function loginRepartidor(")
    const atHeadNormalized = atHeadRaw.replaceAll("setCookie(res, token)", "setCookie(res, token, \"repartidor\")")
    expect(current).toBe(atHeadNormalized)
  })

  test("12. operativo/login/route.ts: archivo completo idéntico a HEAD (sin tocar)", () => {
    expect(read(OPERATIVO_LOGIN)).toBe(readAtHead(OPERATIVO_LOGIN))
  })

  test("13. client-block-security.ts: archivo completo idéntico a HEAD (ya aceptaba TransactionClient, sin tocar)", () => {
    expect(read(CLIENT_BLOCK_SECURITY)).toBe(readAtHead(CLIENT_BLOCK_SECURITY))
  })

  test("14. device-identity.ts: archivo completo idéntico a HEAD (sin tocar)", () => {
    expect(read(DEVICE_IDENTITY)).toBe(readAtHead(DEVICE_IDENTITY))
  })

  test("verify-email y google callback permanecen fuera del loginCliente debt, con sus gates P2-T07 explícitos", () => {
    const verify = read(VERIFY_EMAIL)
    const google = read(GOOGLE_CALLBACK)
    expect(verify).toContain("hashVerificationToken(token)")
    expect(verify).toContain("verificationTokenExpiresAt")
    expect(verify).toContain('createSessionWithClient(tx, cliente.id, "cliente")')
    expect(google).toContain("if (!repartidor.activo)")
  })
})

describe("15-17. auth.ts — createSessionWithClient / createSession wrapper", () => {
  test("15. createSessionWithClient existe, tipado con Prisma.TransactionClient, es la única implementación real", () => {
    const src = read(AUTH_LIB)
    expect(src).toContain("import { Prisma } from \"@prisma/client\"")
    expect(src).toContain("export async function createSessionWithClient(")
    expect(src).toContain("client: Prisma.TransactionClient")
    const body = functionBody(src, "export async function createSessionWithClient(")
    expect(body).toContain("generateSessionToken()")
    expect(body).toContain("hashSessionToken(token)")
    expect(body).toContain("client.sesion.create({")
  })

  test("16. createSession(userId, userType) es un wrapper delgado sobre createSessionWithClient(db, ...) — API pública sin cambios", () => {
    const src = read(AUTH_LIB)
    const body = functionBody(src, "export async function createSession(")
    const trimmed = body.replace(/\s+/g, " ").trim()
    expect(trimmed).toBe("{ return createSessionWithClient(db, userId, userType) }")
  })

  test("17. createOperationalSession no fue tocada (CuentaOperativa fuera de alcance de esta deuda)", () => {
    const current = functionBody(read(AUTH_LIB), "export async function createOperationalSession(")
    const atHead = functionBody(readAtHead(AUTH_LIB), "export async function createOperationalSession(")
    expect(current).toBe(atHead)
  })
})

describe("18. createSessionWithClient — call-sites transaccionales permitidos", () => {
  test("sólo loginCliente y verify-email usan createSessionWithClient fuera de la implementación", () => {
    // auth.ts la DEFINE (no cuenta como call-site de uso). P2-T07 añade
    // verify-email porque el claim del bearer y la sesión deben ser atómicos.
    const loginBody = read(AUTH_LOGIN)
    const verifyBody = read(VERIFY_EMAIL)
    expect(loginBody.split("createSessionWithClient(").length - 1).toBe(1)
    expect(verifyBody.split("createSessionWithClient(").length - 1).toBe(3)
  })
})
