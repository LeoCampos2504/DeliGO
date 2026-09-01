/// <reference types="bun-types" />

import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { hashSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import {
  EMAIL_VERIFICATION_TOKEN_TTL_MS,
  generateVerificationToken,
  getVerificationTokenExpiresAt,
  hashVerificationToken,
} from "@/lib/email"
import { GET as verifyEmail } from "@/app/api/auth/verify-email/route"
import { POST as resendVerification } from "@/app/api/auth/resend-verification/route"

const prefix = `test-p2-t07-email-${randomUUID()}-`
const clientIds: string[] = []
const businessIds: string[] = []
const courierIds: string[] = []
setDefaultTimeout(120_000)

beforeAll(async () => {
  expect(process.env.DATABASE_URL).toBe(process.env.DELIGO_TEST_DATABASE_URL)
  await cleanup()
})

async function createClient(suffix: string, token: string, expiresAt: Date | null) {
  const row = await db.cliente.create({
    data: {
      nombre: `${prefix}cliente-${suffix}`,
      email: `${prefix}cliente-${suffix}@example.test`,
      password: null,
      telefono: "",
      verificationToken: hashVerificationToken(token),
      verificationTokenExpiresAt: expiresAt,
    },
  })
  clientIds.push(row.id)
  return row
}

async function createBusiness(suffix: string, token: string, approved: boolean) {
  const row = await db.negocio.create({
    data: {
      nombre: `${prefix}negocio-${suffix}`,
      slug: `${prefix}negocio-${suffix}`,
      usuario: `${prefix}usuario-${suffix}`,
      email: `${prefix}negocio-${suffix}@example.test`,
      password: "fixture",
      aprobado: approved,
      suspendido: false,
      verificationToken: hashVerificationToken(token),
      verificationTokenExpiresAt: getVerificationTokenExpiresAt(),
    },
  })
  businessIds.push(row.id)
  return row
}

async function createCourier(suffix: string, token: string, active: boolean) {
  const row = await db.repartidor.create({
    data: {
      nombre: `${prefix}repartidor-${suffix}`,
      email: `${prefix}repartidor-${suffix}@example.test`,
      password: null,
      activo: active,
      verificationToken: hashVerificationToken(token),
      verificationTokenExpiresAt: getVerificationTokenExpiresAt(),
    },
  })
  courierIds.push(row.id)
  return row
}

function verificationRequest(token: string): NextRequest {
  return new NextRequest(`http://localhost/api/auth/verify-email?token=${encodeURIComponent(token)}`)
}

function resendRequest(email: string, userType: string): NextRequest {
  return new NextRequest("http://localhost/api/auth/resend-verification", {
    method: "POST",
    body: JSON.stringify({ email, userType }),
    headers: { "content-type": "application/json" },
  })
}

async function sessionCount(userIds: string[]) {
  return db.sesion.count({ where: { userId: { in: userIds } } })
}

async function cleanup() {
  const ids = [...clientIds, ...businessIds, ...courierIds]
  if (ids.length) await db.sesion.deleteMany({ where: { userId: { in: ids } } })
  if (clientIds.length) await db.cliente.deleteMany({ where: { id: { in: clientIds } } })
  if (businessIds.length) await db.negocio.deleteMany({ where: { id: { in: businessIds } } })
  if (courierIds.length) await db.repartidor.deleteMany({ where: { id: { in: courierIds } } })
  clientIds.length = 0
  businessIds.length = 0
  courierIds.length = 0
}

afterAll(async () => {
  await cleanup()
  await db.$disconnect()
})

describe("P2-T07 F-T07-01 — email verification bearer lifecycle", () => {
  test("generates high-entropy raw tokens, stores only SHA-256, and sets a bounded 24h expiry", () => {
    const raw = generateVerificationToken()
    expect(raw.length).toBeGreaterThanOrEqual(40)
    expect(hashVerificationToken(raw)).not.toBe(raw)
    expect(getVerificationTokenExpiresAt(new Date(0)).getTime()).toBe(EMAIL_VERIFICATION_TOKEN_TTL_MS)
  })

  test("fresh client, approved business, and active courier tokens verify and auto-login", async () => {
    const clientToken = generateVerificationToken()
    const businessToken = generateVerificationToken()
    const courierToken = generateVerificationToken()
    const client = await createClient("fresh-client", clientToken, getVerificationTokenExpiresAt())
    const business = await createBusiness("fresh-business", businessToken, true)
    const courier = await createCourier("fresh-courier", courierToken, true)

    for (const [token, id] of [
      [clientToken, client.id],
      [businessToken, business.id],
      [courierToken, courier.id],
    ] as const) {
      const response = await verifyEmail(verificationRequest(token))
      expect(response.status).toBe(200)
      const sessionToken = response.cookies.get(SESSION_COOKIE_NAME)?.value
      expect(sessionToken).toBeTruthy()
      expect(await db.sesion.findUnique({ where: { token: hashSessionToken(sessionToken!) } })).toMatchObject({ userId: id })
    }

    const [clientAfter, businessAfter, courierAfter] = await Promise.all([
      db.cliente.findUniqueOrThrow({ where: { id: client.id } }),
      db.negocio.findUniqueOrThrow({ where: { id: business.id } }),
      db.repartidor.findUniqueOrThrow({ where: { id: courier.id } }),
    ])
    expect(clientAfter.emailVerified).not.toBeNull()
    expect(clientAfter.verificationToken).toBeNull()
    expect(clientAfter.verificationTokenExpiresAt).toBeNull()
    expect(businessAfter.emailVerified).not.toBeNull()
    expect(businessAfter.verificationToken).toBeNull()
    expect(courierAfter.emailVerified).not.toBeNull()
    expect(courierAfter.verificationToken).toBeNull()
  })

  test("unapproved business verifies email but does not receive a session", async () => {
    const token = generateVerificationToken()
    const business = await createBusiness("pending-business", token, false)
    const response = await verifyEmail(verificationRequest(token))
    expect(response.status).toBe(200)
    expect(response.cookies.get(SESSION_COOKIE_NAME)).toBeUndefined()
    expect(await sessionCount([business.id])).toBe(0)
    expect((await db.negocio.findUniqueOrThrow({ where: { id: business.id } })).emailVerified).not.toBeNull()
  })

  test("inactive courier verifies email but cannot auto-login", async () => {
    const token = generateVerificationToken()
    const courier = await createCourier("inactive-courier", token, false)
    const response = await verifyEmail(verificationRequest(token))
    expect(response.status).toBe(200)
    expect(response.cookies.get(SESSION_COOKIE_NAME)).toBeUndefined()
    expect(await sessionCount([courier.id])).toBe(0)
    expect((await db.repartidor.findUniqueOrThrow({ where: { id: courier.id } })).emailVerified).not.toBeNull()
  })

  test("expired and legacy plaintext tokens fail closed without claiming or creating sessions", async () => {
    const expiredToken = generateVerificationToken()
    const legacyToken = generateVerificationToken()
    const nonexistentToken = generateVerificationToken()
    const expired = await createClient("expired", expiredToken, new Date(Date.now() - 1_000))
    const legacy = await db.cliente.create({
      data: {
        nombre: `${prefix}legacy`,
        email: `${prefix}legacy@example.test`,
        password: null,
        telefono: "",
        verificationToken: legacyToken,
        verificationTokenExpiresAt: null,
      },
    })
    clientIds.push(legacy.id)

    for (const token of [expiredToken, legacyToken, nonexistentToken]) {
      const response = await verifyEmail(verificationRequest(token))
      expect(response.status).toBe(200)
      expect(response.cookies.get(SESSION_COOKIE_NAME)).toBeUndefined()
      expect((await response.text()).toLowerCase()).toContain("expir")
    }
    expect(await sessionCount([expired.id, legacy.id])).toBe(0)
    expect((await db.cliente.findUniqueOrThrow({ where: { id: expired.id } })).emailVerified).toBeNull()
    expect((await db.cliente.findUniqueOrThrow({ where: { id: legacy.id } })).verificationToken).toBe(legacyToken)
  })

  test("replay is rejected after the first atomic claim", async () => {
    const token = generateVerificationToken()
    const client = await createClient("replay", token, getVerificationTokenExpiresAt())
    const first = await verifyEmail(verificationRequest(token))
    const second = await verifyEmail(verificationRequest(token))
    expect(first.cookies.get(SESSION_COOKIE_NAME)?.value).toBeTruthy()
    expect(second.cookies.get(SESSION_COOKIE_NAME)).toBeUndefined()
    expect((await second.text()).toLowerCase()).toContain("expir")
    expect(await sessionCount([client.id])).toBe(1)
  })

  test("resend replaces the old hash and assigns a fresh bounded expiry", async () => {
    const oldToken = generateVerificationToken()
    const client = await createClient("resend", oldToken, new Date(Date.now() - 1_000))
    const oldHash = hashVerificationToken(oldToken)
    const response = await resendVerification(resendRequest(client.email, "cliente"))
    expect(response.status).toBe(200)
    const replaced = await db.cliente.findUniqueOrThrow({ where: { id: client.id } })
    expect(replaced.verificationToken).not.toBe(oldHash)
    expect(replaced.verificationToken).not.toBe(oldToken)
    expect(replaced.verificationTokenExpiresAt).not.toBeNull()
    expect(replaced.verificationTokenExpiresAt!.getTime()).toBeGreaterThan(Date.now())
    const oldAttempt = await verifyEmail(verificationRequest(oldToken))
    expect(oldAttempt.cookies.get(SESSION_COOKIE_NAME)).toBeUndefined()
    expect(await sessionCount([client.id])).toBe(0)
  })
})
