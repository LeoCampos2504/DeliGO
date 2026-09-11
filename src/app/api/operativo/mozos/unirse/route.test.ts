/// <reference types="bun-types" />

import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createOperationalSession, deleteOperationalSession, OPERATIONAL_SESSION_COOKIE_NAME } from "@/lib/auth"
import { generateMozoInvitationCode, getMozoInvitationExpiresAt, hashMozoInvitationCode } from "@/lib/mozo-invitations"
import { POST } from "./route"

setDefaultTimeout(60_000)

const testDatabaseUrl = process.env.DELIGO_TEST_DATABASE_URL
if (!testDatabaseUrl || process.env.DATABASE_URL !== testDatabaseUrl) {
  throw new Error(
    "Este test de integración requiere DELIGO_TEST_DATABASE_URL y DATABASE_URL apuntando a la misma base TESTING."
  )
}

type Fixture = {
  negocioId: string
  empleadoId: string
  cuentaId: string
  sessionToken: string
  code: string
  invitationId: string
}

const fixtures: Fixture[] = []

async function createFixture(prefix: string, options: { areaOperativa?: string; accountSuffix?: string } = {}): Promise<Fixture> {
  const suffix = randomUUID()
  const negocio = await db.negocio.create({
    data: {
      slug: `${prefix}-${suffix}`,
      nombre: `${prefix} ${suffix}`,
      usuario: `${prefix}-${suffix}`,
      email: `${prefix}-${suffix}@example.test`,
      password: "fixture",
      aprobado: true,
      suspendido: false,
      salonActivo: true,
      empleadosActivos: true,
    },
  })
  const cuenta = await db.cuentaOperativa.create({
    data: {
      nombre: `Identidad personal ${suffix}`,
      email: `${prefix}-${options.accountSuffix ?? suffix}@example.test`,
      activo: true,
      eliminado: false,
    },
  })
  const empleado = await db.empleado.create({
    data: {
      nombre: "Pendiente de vinculación",
      codigo: `MZ${suffix.slice(0, 8).toUpperCase()}`,
      rol: "mozo",
      areaOperativa: options.areaOperativa ?? "mozo",
      negocioId: negocio.id,
      cuentaOperativaId: null,
      activo: true,
      eliminado: false,
    },
  })
  const code = generateMozoInvitationCode()
  const invitation = await db.codigoIncorporacionMozo.create({
    data: {
      negocioId: negocio.id,
      empleadoObjetivoId: empleado.id,
      rol: "mozo",
      codeHash: hashMozoInvitationCode(code),
      codePrefix: "TEST",
      expiresAt: getMozoInvitationExpiresAt(),
    },
  })
  const sessionToken = await createOperationalSession(cuenta.id)
  const fixture = { negocioId: negocio.id, empleadoId: empleado.id, cuentaId: cuenta.id, sessionToken, code, invitationId: invitation.id }
  fixtures.push(fixture)
  return fixture
}

function joinRequest(code: string, sessionToken: string, extra: Record<string, unknown> = {}) {
  return new NextRequest("http://localhost/api/operativo/mozos/unirse", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `${OPERATIONAL_SESSION_COOKIE_NAME}=${sessionToken}`,
    },
    body: JSON.stringify({ codigo: code, ...extra }),
  })
}

afterAll(async () => {
  for (const fixture of fixtures) {
    await deleteOperationalSession(fixture.sessionToken)
    await db.codigoIncorporacionMozo.deleteMany({ where: { id: fixture.invitationId } })
    await db.empleado.deleteMany({ where: { id: fixture.empleadoId } })
    await db.negocio.deleteMany({ where: { id: fixture.negocioId } })
    await db.cuentaOperativa.deleteMany({ where: { id: fixture.cuentaId } })
  }
})

describe("P2-T43-R1 — POST /api/operativo/mozos/unirse", () => {
  test("CASE A: existing account joins and response uses CuentaOperativa identity", async () => {
    const fixture = await createFixture("test-p2-t43-r1-existing")
    const before = await db.cuentaOperativa.count({ where: { id: fixture.cuentaId } })
    const account = await db.cuentaOperativa.findUnique({ where: { id: fixture.cuentaId }, select: { nombre: true } })

    const response = await POST(joinRequest(fixture.code, fixture.sessionToken))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.vinculo.empleado.nombre).toBe(account?.nombre)
    expect(body.vinculo.empleado.displayName).toBe(account?.nombre)
    expect(body.vinculo.empleado.identityLinked).toBe(true)
    expect(body.vinculo.empleado.areaOperativaEfectiva).toBe("mozo")
    expect(await db.cuentaOperativa.count({ where: { id: fixture.cuentaId } })).toBe(before)
    expect((await db.empleado.findUnique({ where: { id: fixture.empleadoId } }))?.cuentaOperativaId).toBe(fixture.cuentaId)
  })

  test("CASE B: a previously registered new account creates one account and one membership", async () => {
    const fixture = await createFixture("test-p2-t43-r1-new")
    const response = await POST(joinRequest(fixture.code, fixture.sessionToken))
    expect(response.status).toBe(200)
    expect(await db.empleado.count({ where: { cuentaOperativaId: fixture.cuentaId, negocioId: fixture.negocioId } })).toBe(1)
    expect(await db.cuentaOperativa.count({ where: { id: fixture.cuentaId } })).toBe(1)
  })

  test("CASE C/D: client-supplied business, employee, role, area and permissions do not change server authority", async () => {
    const fixture = await createFixture("test-p2-t43-r1-authority", { areaOperativa: "salon" })
    const otherBusiness = await db.negocio.create({
      data: {
        slug: `test-p2-t43-r1-other-${randomUUID()}`,
        nombre: `Other P2-T43 ${randomUUID()}`,
        usuario: `other-p2-t43-${randomUUID()}`,
        email: `other-p2-t43-${randomUUID()}@example.test`,
        password: "fixture",
        aprobado: true,
        salonActivo: true,
        empleadosActivos: true,
      },
    })
    const response = await POST(joinRequest(fixture.code, fixture.sessionToken, {
      negocioId: otherBusiness.id,
      empleadoId: "arbitrary-client-target",
      rol: "admin",
      areaOperativa: "pyr",
      permisos: ["gestion_empleados"],
      actor: "negocio",
    }))
    expect(response.status).toBe(200)
    const employee = await db.empleado.findUnique({ where: { id: fixture.empleadoId } })
    expect(employee?.negocioId).toBe(fixture.negocioId)
    expect(employee?.rol).toBe("mozo")
    expect(employee?.areaOperativa).toBe("salon")
    expect(employee?.permisos).not.toContain("gestion_empleados")
    await db.negocio.delete({ where: { id: otherBusiness.id } })
  })

  test("CASE E: used, revoked and expired codes keep the generic non-enumerating error", async () => {
    const used = await createFixture("test-p2-t43-r1-used")
    await db.codigoIncorporacionMozo.update({ where: { id: used.invitationId }, data: { usedAt: new Date() } })
    expect((await POST(joinRequest(used.code, used.sessionToken))).status).toBe(400)

    const revoked = await createFixture("test-p2-t43-r1-revoked")
    await db.codigoIncorporacionMozo.update({ where: { id: revoked.invitationId }, data: { revokedAt: new Date() } })
    expect((await POST(joinRequest(revoked.code, revoked.sessionToken))).status).toBe(400)

    const expired = await createFixture("test-p2-t43-r1-expired")
    await db.codigoIncorporacionMozo.update({ where: { id: expired.invitationId }, data: { expiresAt: new Date(Date.now() - 1000) } })
    const response = await POST(joinRequest(expired.code, expired.sessionToken))
    expect(response.status).toBe(400)
    expect((await response.json()).error).toBe("Código inválido, vencido o ya utilizado")
  })

  test("CASE F: replay and concurrent requests produce at most one membership", async () => {
    const fixture = await createFixture("test-p2-t43-r1-replay")
    const responses = await Promise.all([
      POST(joinRequest(fixture.code, fixture.sessionToken)),
      POST(joinRequest(fixture.code, fixture.sessionToken)),
    ])
    expect(responses.filter((response) => response.status === 200)).toHaveLength(1)
    expect(responses.every((response) => [200, 400, 409].includes(response.status))).toBe(true)
    expect(await db.empleado.count({ where: { cuentaOperativaId: fixture.cuentaId, negocioId: fixture.negocioId } })).toBe(1)
  })

  test("CASE G: an already linked account cannot create a second membership in the same business", async () => {
    const fixture = await createFixture("test-p2-t43-r1-duplicate")
    expect((await POST(joinRequest(fixture.code, fixture.sessionToken))).status).toBe(200)
    const secondEmployee = await db.empleado.create({
      data: {
        nombre: "Otro pendiente",
        codigo: `MZ2${randomUUID().slice(0, 7).toUpperCase()}`,
        negocioId: fixture.negocioId,
        rol: "mozo",
        areaOperativa: "mozo",
        activo: true,
        eliminado: false,
      },
    })
    const secondCode = generateMozoInvitationCode()
    const secondInvitation = await db.codigoIncorporacionMozo.create({
      data: {
        negocioId: fixture.negocioId,
        empleadoObjetivoId: secondEmployee.id,
        rol: "mozo",
        codeHash: hashMozoInvitationCode(secondCode),
        codePrefix: "TEST",
        expiresAt: getMozoInvitationExpiresAt(),
      },
    })
    expect((await POST(joinRequest(secondCode, fixture.sessionToken))).status).toBe(409)
    expect(await db.empleado.count({ where: { negocioId: fixture.negocioId, cuentaOperativaId: fixture.cuentaId } })).toBe(1)
    await db.codigoIncorporacionMozo.delete({ where: { id: secondInvitation.id } })
    await db.empleado.delete({ where: { id: secondEmployee.id } })
  })
})
