/// <reference types="bun-types" />

import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import {
  getTerminalSessionExpiry,
  resolveTerminalSession,
  sha256Hex,
  TERMINAL_SESSION_COOKIE_NAME,
} from "@/lib/operaciones-terminal-auth"
import { GET as getContext } from "@/app/api/operaciones/terminal/contexto/route"
import { POST as postLogout } from "@/app/api/operaciones/terminal/logout/route"

const prefix = `test-p2-t06-terminal-${randomUUID()}-`
setDefaultTimeout(60_000)

let negocioId = ""
let terminalId = ""
let primaryToken = ""
let siblingToken = ""

function request(path: string, token?: string) {
  return new NextRequest(`http://localhost${path}`, {
    headers: token ? { cookie: `${TERMINAL_SESSION_COOKIE_NAME}=${token}` } : {},
  })
}

async function cleanup() {
  const negocios = await db.negocio.findMany({ where: { slug: { startsWith: prefix } }, select: { id: true } })
  const ids = negocios.map((row) => row.id)
  if (ids.length) await db.auditLog.deleteMany({ where: { userId: { in: ids } } })
  if (ids.length) await db.negocio.deleteMany({ where: { id: { in: ids } } })
}

beforeAll(async () => {
  expect(process.env.DATABASE_URL).toBe(process.env.DELIGO_TEST_DATABASE_URL)
  await cleanup()
  const negocio = await db.negocio.create({
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
  negocioId = negocio.id
  const terminal = await db.terminalOperativa.create({
    data: {
      negocioId,
      nombre: `${prefix}terminal`,
      estado: "activo",
      perfil: "pyr_completo",
      areas: JSON.stringify(["pyr"]),
      scopes: JSON.stringify(["pyr.ver"]),
    },
  })
  terminalId = terminal.id
  primaryToken = `primary-${randomUUID()}`
  siblingToken = `sibling-${randomUUID()}`
  await db.sesionTerminalOperativa.createMany({
    data: [
      { terminalSalonId: terminalId, tokenHash: sha256Hex(primaryToken), expiresAt: getTerminalSessionExpiry() },
      { terminalSalonId: terminalId, tokenHash: sha256Hex(siblingToken), expiresAt: getTerminalSessionExpiry() },
    ],
  })
})

afterAll(async () => {
  await cleanup()
  expect(await db.negocio.count({ where: { slug: { startsWith: prefix } } })).toBe(0)
})

describe("P2-T06 F1 — lifecycle centralizado de TerminalOperativa", () => {
  test("negocio aprobado y no suspendido acepta; suspendido y no aprobado rechazan", async () => {
    expect(await resolveTerminalSession(request("/api/operaciones/terminal/contexto", siblingToken))).not.toBeNull()

    await db.negocio.update({ where: { id: negocioId }, data: { suspendido: true } })
    expect(await resolveTerminalSession(request("/api/operaciones/terminal/contexto", siblingToken))).toBeNull()

    await db.negocio.update({ where: { id: negocioId }, data: { suspendido: false, aprobado: false } })
    expect(await resolveTerminalSession(request("/api/operaciones/terminal/contexto", siblingToken))).toBeNull()

    await db.negocio.update({ where: { id: negocioId }, data: { aprobado: true } })
    expect(await resolveTerminalSession(request("/api/operaciones/terminal/contexto", siblingToken))).not.toBeNull()
  })

  test("salonActivo=false no se confunde con lifecycle: la sesión sigue resolviendo", async () => {
    await db.negocio.update({ where: { id: negocioId }, data: { salonActivo: false } })
    const context = await resolveTerminalSession(request("/api/operaciones/terminal/contexto", siblingToken))
    expect(context).not.toBeNull()
    expect(context?.negocio.salonActivo).toBe(false)
    await db.negocio.update({ where: { id: negocioId }, data: { salonActivo: true } })
  })
})

describe("P2-T06 F2 — logout explícito, aislado e idempotente", () => {
  test("revoca sólo la sesión de la cookie actual, conserva terminal y sibling", async () => {
    const response = await postLogout(request("/api/operaciones/terminal/logout", primaryToken))
    expect(response.status).toBe(200)
    expect(response.cookies.get(TERMINAL_SESSION_COOKIE_NAME)?.value).toBe("")

    const [primary, sibling, terminal] = await Promise.all([
      db.sesionTerminalOperativa.findUniqueOrThrow({ where: { tokenHash: sha256Hex(primaryToken) } }),
      db.sesionTerminalOperativa.findUniqueOrThrow({ where: { tokenHash: sha256Hex(siblingToken) } }),
      db.terminalOperativa.findUniqueOrThrow({ where: { id: terminalId } }),
    ])
    expect(primary.revokedAt).not.toBeNull()
    expect(sibling.revokedAt).toBeNull()
    expect(terminal.revokedAt).toBeNull()
    expect(terminal.estado).toBe("activo")

    expect((await getContext(request("/api/operaciones/terminal/contexto", primaryToken))).status).toBe(401)
    expect((await getContext(request("/api/operaciones/terminal/contexto", siblingToken))).status).toBe(200)
  })

  test("repetir logout e invalid token son operaciones seguras", async () => {
    const repeat = await postLogout(request("/api/operaciones/terminal/logout", primaryToken))
    const invalid = await postLogout(request("/api/operaciones/terminal/logout", "not-a-session"))
    expect(repeat.status).toBe(200)
    expect(invalid.status).toBe(200)
    expect(repeat.cookies.get(TERMINAL_SESSION_COOKIE_NAME)?.value).toBe("")
    expect(invalid.cookies.get(TERMINAL_SESSION_COOKIE_NAME)?.value).toBe("")
  })
})
