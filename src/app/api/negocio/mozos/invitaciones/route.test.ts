/// <reference types="bun-types" />

import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createSession, deleteSession, SESSION_COOKIE_NAME } from "@/lib/auth"
import { generateMozoInvitationCode, getMozoInvitationExpiresAt, hashMozoInvitationCode } from "@/lib/mozo-invitations"
import { GET } from "./route"

setDefaultTimeout(60_000)

const testDatabaseUrl = process.env.DELIGO_TEST_DATABASE_URL
if (!testDatabaseUrl || process.env.DATABASE_URL !== testDatabaseUrl) {
  throw new Error(
    "Este test de integración requiere DELIGO_TEST_DATABASE_URL y DATABASE_URL apuntando a la misma base TESTING."
  )
}

const createdBusinesses: string[] = []
const createdSessions: string[] = []
const createdInvitations: string[] = []
const createdEmployees: string[] = []

function request(cookie: string) {
  return new NextRequest("http://localhost/api/negocio/mozos/invitaciones", {
    method: "GET",
    headers: { cookie },
  })
}

async function createFixture() {
  const suffix = randomUUID()
  const business = await db.negocio.create({
    data: {
      slug: `test-p2-t43-r1-inv-${suffix}`,
      nombre: `T43 invitation ${suffix}`,
      usuario: `test-p2-t43-r1-inv-${suffix}`,
      email: `test-p2-t43-r1-inv-${suffix}@example.test`,
      password: "fixture",
      aprobado: true,
      suspendido: false,
      salonActivo: true,
      empleadosActivos: true,
    },
  })
  createdBusinesses.push(business.id)

  const employee = await db.empleado.create({
    data: {
      nombre: "Pendiente de vinculación",
      codigo: `INV${suffix.slice(0, 8).toUpperCase()}`,
      rol: "mozo",
      areaOperativa: "mozo",
      negocioId: business.id,
      activo: true,
      eliminado: false,
    },
  })
  createdEmployees.push(employee.id)

  const code = generateMozoInvitationCode()
  const invitation = await db.codigoIncorporacionMozo.create({
    data: {
      negocioId: business.id,
      empleadoObjetivoId: employee.id,
      rol: "mozo",
      codeHash: hashMozoInvitationCode(code),
      codePrefix: "T43R1INV",
      expiresAt: getMozoInvitationExpiresAt(),
    },
  })
  createdInvitations.push(invitation.id)

  const session = await createSession(business.id, "negocio")
  createdSessions.push(session)
  return { invitationId: invitation.id, cookie: `${SESSION_COOKIE_NAME}=${session}` }
}

afterAll(async () => {
  for (const token of createdSessions) await deleteSession(token)
  await db.codigoIncorporacionMozo.deleteMany({ where: { id: { in: createdInvitations } } })
  await db.empleado.deleteMany({ where: { id: { in: createdEmployees } } })
  await db.negocio.deleteMany({ where: { id: { in: createdBusinesses } } })
})

describe("P2-T43-R1 — GET /api/negocio/mozos/invitaciones", () => {
  test("CASE L: consumed invitations disappear from the admin pending list", async () => {
    const fixture = await createFixture()

    const pendingResponse = await GET(request(fixture.cookie))
    expect(pendingResponse.status).toBe(200)
    expect((await pendingResponse.json()).invitaciones.some((item: { id: string }) => item.id === fixture.invitationId)).toBe(true)

    await db.codigoIncorporacionMozo.update({
      where: { id: fixture.invitationId },
      data: { usedAt: new Date() },
    })

    const consumedResponse = await GET(request(fixture.cookie))
    expect(consumedResponse.status).toBe(200)
    expect((await consumedResponse.json()).invitaciones.some((item: { id: string }) => item.id === fixture.invitationId)).toBe(false)
  })
})
