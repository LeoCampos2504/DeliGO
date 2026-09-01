/// <reference types="bun-types" />

import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createSuperadminSession, SUPERADMIN_SESSION_COOKIE_NAME } from "@/lib/superadmin-auth"
import { DELETE as deleteNegocio } from "@/app/api/superadmin/negocios/[id]/route"
import { PUT as togglePromocionado } from "@/app/api/superadmin/negocios/[id]/promocionar/route"

const prefix = `test-p2-t06-superadmin-${randomUUID()}-`
setDefaultTimeout(60_000)

let adminId = ""
let adminToken = ""

function request(path: string, method: string, body?: unknown, ip?: string) {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: {
      cookie: `${SUPERADMIN_SESSION_COOKIE_NAME}=${adminToken}`,
      ...(ip ? { "x-forwarded-for": ip } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

async function cleanup() {
  const negocios = await db.negocio.findMany({ where: { slug: { startsWith: prefix } }, select: { id: true } })
  const negocioIds = negocios.map((row) => row.id)
  const admins = await db.superAdmin.findMany({ where: { email: { startsWith: prefix } }, select: { id: true } })
  const adminIds = admins.map((row) => row.id)
  if (adminIds.length) {
    await db.sesion.deleteMany({ where: { userId: { in: adminIds } } })
    await db.auditLog.deleteMany({ where: { userId: { in: adminIds } } })
  }
  if (negocioIds.length) await db.auditLog.deleteMany({ where: { recursoId: { in: negocioIds } } })
  if (negocioIds.length) await db.negocio.deleteMany({ where: { id: { in: negocioIds } } })
  if (adminIds.length) await db.superAdmin.deleteMany({ where: { id: { in: adminIds } } })
}

async function createBusiness(label: string) {
  return db.negocio.create({
    data: {
      nombre: `${prefix}${label}`,
      slug: `${prefix}${label}`,
      usuario: `${prefix}${label}`,
      email: `${prefix}${label}@example.test`,
      password: "fixture",
      aprobado: true,
      suspendido: false,
    },
  })
}

beforeAll(async () => {
  expect(process.env.DATABASE_URL).toBe(process.env.DELIGO_TEST_DATABASE_URL)
  await cleanup()
  const admin = await db.superAdmin.create({
    data: { email: `${prefix}admin@example.test`, googleSub: `${prefix}google-sub`, activo: true },
  })
  adminId = admin.id
  adminToken = await createSuperadminSession(admin.id)
})

afterAll(async () => {
  await cleanup()
  expect(await db.superAdmin.count({ where: { email: { startsWith: prefix } } })).toBe(0)
})

describe("P2-T06 F4/F5 — auditoría SuperAdmin", () => {
  test("hard-delete deja AuditLog durable con actor/acción/target y sin secretos", async () => {
    const negocio = await createBusiness("hard-delete")
    const response = await deleteNegocio(request(`/api/superadmin/negocios/${negocio.id}`, "DELETE"), { params: Promise.resolve({ id: negocio.id }) })
    expect(response.status).toBe(200)
    expect(await db.negocio.findUnique({ where: { id: negocio.id } })).toBeNull()

    const audit = await db.auditLog.findFirstOrThrow({ where: { userId: adminId, recursoId: negocio.id, accion: "superadmin.negocio_eliminado" } })
    expect(audit.userType).toBe("superadmin")
    expect(JSON.parse(audit.detalle)).toMatchObject({ nombre: negocio.nombre, slug: negocio.slug, cascade: true })
    for (const secret of ["password", "token", "cookie", "DATABASE_URL", "dump"]) expect(audit.detalle).not.toContain(secret)
  })

  test("mutación representativa de promoción deja audit trail", async () => {
    const negocio = await createBusiness("promocion")
    const response = await togglePromocionado(
      request(`/api/superadmin/negocios/${negocio.id}/promocionar`, "PUT", { promocionado: true }),
      { params: Promise.resolve({ id: negocio.id }) },
    )
    expect(response.status).toBe(200)
    expect(await db.auditLog.findFirst({ where: { userId: adminId, recursoId: negocio.id, accion: "superadmin.negocio_promocionado" } })).not.toBeNull()
  })
})

describe("P2-T06 F6 — hard-delete rate limit", () => {
  test("overflow es 429 antes de cualquier eliminación", async () => {
    const missingId = `missing-${randomUUID()}`
    for (let attempt = 0; attempt < 5; attempt++) {
      const response = await deleteNegocio(request(`/api/superadmin/negocios/${missingId}`, "DELETE", undefined, "198.51.100.42"), { params: Promise.resolve({ id: missingId }) })
      expect(response.status).toBe(404)
    }
    const overflow = await deleteNegocio(request(`/api/superadmin/negocios/${missingId}`, "DELETE", undefined, "198.51.100.42"), { params: Promise.resolve({ id: missingId }) })
    expect(overflow.status).toBe(429)
    expect(await db.negocio.findUnique({ where: { id: missingId } })).toBeNull()
  })
})
