/// <reference types="bun-types" />

import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createSession, SESSION_COOKIE_NAME } from "@/lib/auth"
import { PAIRING_TTL_MS, sha256Hex, TERMINAL_SESSION_COOKIE_NAME } from "@/lib/operaciones-terminal-auth"
import { POST as generateActivation } from "@/app/api/negocio/terminales-operativas/[id]/activacion/route"
import { POST as activateTerminal } from "@/app/api/operaciones/terminal/activar/route"

const prefix = `test-p2-t07-terminal-${randomUUID()}-`
const businessIds: string[] = []
let businessId = ""
let businessSession = ""
setDefaultTimeout(120_000)

beforeAll(async () => {
  expect(process.env.DATABASE_URL).toBe(process.env.DELIGO_TEST_DATABASE_URL)
  await cleanup()
  const business = await db.negocio.create({
    data: {
      nombre: `${prefix}negocio`,
      slug: `${prefix}negocio`,
      usuario: `${prefix}usuario`,
      email: `${prefix}negocio@example.test`,
      password: "fixture",
      aprobado: true,
      suspendido: false,
      salonActivo: true,
    },
  })
  businessId = business.id
  businessIds.push(business.id)
  businessSession = await createSession(business.id, "negocio")
})

afterAll(async () => {
  await cleanup()
  expect(await db.negocio.count({ where: { slug: { startsWith: prefix } } })).toBe(0)
  await db.$disconnect()
})

function authRequest(path: string, body?: unknown, ip = randomUUID()): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${businessSession}`,
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
  })
}

function codeRequest(code: string, ip = randomUUID()): NextRequest {
  return new NextRequest("http://localhost/api/operaciones/terminal/activar", {
    method: "POST",
    body: JSON.stringify({ code }),
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
  })
}

async function createPendingTerminal(suffix: string) {
  return db.terminalOperativa.create({
    data: {
      negocioId: businessId,
      nombre: `${prefix}terminal-${suffix}`,
      estado: "pendiente",
      perfil: "pyr_completo",
      areas: JSON.stringify(["pyr"]),
      scopes: JSON.stringify(["pyr.ver"]),
    },
  })
}

async function createPairingFixture(suffix: string, state: "fresh" | "expired" | "revoked" | "used") {
  const terminal = await createPendingTerminal(suffix)
  const code = `${prefix}code-${suffix}-${randomUUID()}`
  await db.vinculacionTerminalOperativa.create({
    data: {
      negocioId: businessId,
      terminalSalonId: terminal.id,
      codeHash: sha256Hex(code),
      codePrefix: "qr",
      expiresAt: new Date(Date.now() + (state === "expired" ? -1_000 : PAIRING_TTL_MS)),
      revokedAt: state === "revoked" ? new Date() : null,
      usedAt: state === "used" ? new Date() : null,
    },
  })
  return { terminal, code }
}

async function cleanup() {
  const businesses = await db.negocio.findMany({ where: { slug: { startsWith: prefix } }, select: { id: true } })
  const ids = [...new Set([...businessIds, ...businesses.map((row) => row.id)])]
  if (ids.length) {
    await db.sesion.deleteMany({ where: { userId: { in: ids } } })
    await db.auditLog.deleteMany({ where: { userId: { in: ids } } })
    await db.negocio.deleteMany({ where: { id: { in: ids } } })
  }
  businessIds.length = 0
}

describe("P2-T07 F-T07-03 — terminal pairing lifecycle authority", () => {
  test("suspended or unapproved business cannot issue credentials, and an already-issued code cannot redeem", async () => {
    const terminal = await createPendingTerminal("issued-before-suspension")
    const generated = await generateActivation(
      authRequest(`/api/negocio/terminales-operativas/${terminal.id}/activacion`, undefined),
      { params: Promise.resolve({ id: terminal.id }) }
    )
    expect(generated.status).toBe(200)
    const payload = await generated.json()
    expect(typeof payload.manualCode).toBe("string")

    await db.negocio.update({ where: { id: businessId }, data: { suspendido: true } })
    const rejectedIssue = await generateActivation(
      authRequest(`/api/negocio/terminales-operativas/${terminal.id}/activacion`, undefined),
      { params: Promise.resolve({ id: terminal.id }) }
    )
    expect(rejectedIssue.status).toBe(401)

    const rejectedRedeem = await activateTerminal(codeRequest(payload.manualCode))
    expect(rejectedRedeem.status).toBe(400)
    expect(rejectedRedeem.headers.get("cache-control")).toContain("no-store")
    const linkage = await db.vinculacionTerminalOperativa.findFirstOrThrow({ where: { terminalSalonId: terminal.id } })
    expect(linkage.usedAt).toBeNull()
    expect(await db.sesionTerminalOperativa.count({ where: { terminalSalonId: terminal.id } })).toBe(0)
    expect((await db.terminalOperativa.findUniqueOrThrow({ where: { id: terminal.id } })).estado).toBe("pendiente")

    await db.negocio.update({ where: { id: businessId }, data: { suspendido: false, aprobado: false } })
    const rejectedUnapproved = await activateTerminal(codeRequest(payload.manualCode))
    expect(rejectedUnapproved.status).toBe(400)
    expect((await db.vinculacionTerminalOperativa.findFirstOrThrow({ where: { terminalSalonId: terminal.id } })).usedAt).toBeNull()
    await db.negocio.update({ where: { id: businessId }, data: { aprobado: true } })
  })

  test("same still-fresh code redeems after reactivation and creates exactly one terminal session", async () => {
    const fixture = await createPairingFixture("reactivation", "fresh")
    await db.negocio.update({ where: { id: businessId }, data: { suspendido: true } })
    expect((await activateTerminal(codeRequest(fixture.code))).status).toBe(400)
    await db.negocio.update({ where: { id: businessId }, data: { suspendido: false } })

    const response = await activateTerminal(codeRequest(fixture.code))
    expect(response.status).toBe(200)
    expect(response.headers.get("set-cookie")).toContain(TERMINAL_SESSION_COOKIE_NAME)
    expect((await db.vinculacionTerminalOperativa.findFirstOrThrow({ where: { terminalSalonId: fixture.terminal.id } })).usedAt).not.toBeNull()
    expect((await db.terminalOperativa.findUniqueOrThrow({ where: { id: fixture.terminal.id } })).estado).toBe("activo")
    expect(await db.sesionTerminalOperativa.count({ where: { terminalSalonId: fixture.terminal.id } })).toBe(1)
  })

  test("expired, revoked, and previously used credentials reject with no terminal/session mutation", async () => {
    for (const state of ["expired", "revoked", "used"] as const) {
      const fixture = await createPairingFixture(state, state)
      const response = await activateTerminal(codeRequest(fixture.code))
      expect(response.status).toBe(400)
      expect(response.headers.get("set-cookie") ?? "").not.toContain(TERMINAL_SESSION_COOKIE_NAME)
      const [terminal, linkage, sessions] = await Promise.all([
        db.terminalOperativa.findUniqueOrThrow({ where: { id: fixture.terminal.id } }),
        db.vinculacionTerminalOperativa.findFirstOrThrow({ where: { terminalSalonId: fixture.terminal.id } }),
        db.sesionTerminalOperativa.count({ where: { terminalSalonId: fixture.terminal.id } }),
      ])
      expect(terminal.estado).toBe("pendiente")
      if (state === "used") expect(linkage.usedAt).toEqual(expect.any(Date))
      else expect(linkage.usedAt).toBeNull()
      expect(sessions).toBe(0)
    }
  })

  test("concurrent redemption consumes the code once and creates at most one session", async () => {
    const fixture = await createPairingFixture("concurrent", "fresh")
    const responses = await Promise.all([
      activateTerminal(codeRequest(fixture.code, randomUUID())),
      activateTerminal(codeRequest(fixture.code, randomUUID())),
    ])
    expect(responses.filter((response) => response.status === 200)).toHaveLength(1)
    expect(responses.filter((response) => response.status !== 200)).toHaveLength(1)
    expect(await db.sesionTerminalOperativa.count({ where: { terminalSalonId: fixture.terminal.id } })).toBe(1)
    expect((await db.vinculacionTerminalOperativa.findFirstOrThrow({ where: { terminalSalonId: fixture.terminal.id } })).usedAt).not.toBeNull()
  })
})
