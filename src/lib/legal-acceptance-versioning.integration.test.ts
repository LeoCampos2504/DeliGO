/// <reference types="bun-types" />

// ============================================
// LEGAL-TERMS-ACCEPTANCE-VERSIONING-R1 — real integration test
// ============================================
// Registration + LegalAcceptance evidence. Never mocks Prisma. Prefix
// `test-legal-acceptance-r1-`, cleanup obligatory in beforeAll/afterAll.

import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { POST as registerRoute } from "@/app/api/auth/register/route"
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from "@/lib/legal-versions"

const prefix = `test-legal-acceptance-r1-${randomUUID()}-`
const TEST_PASSWORD = "CorrectHorseBattery42"
setDefaultTimeout(60_000)

async function cleanup() {
  const negocios = await db.negocio.findMany({ where: { slug: { startsWith: prefix } }, select: { id: true } })
  const clientes = await db.cliente.findMany({ where: { email: { startsWith: prefix } }, select: { id: true } })
  const repartidores = await db.repartidor.findMany({ where: { email: { startsWith: prefix } }, select: { id: true } })
  const negocioIds = negocios.map((n) => n.id)
  const clienteIds = clientes.map((c) => c.id)
  const repartidorIds = repartidores.map((r) => r.id)

  if (negocioIds.length || clienteIds.length || repartidorIds.length) {
    await db.legalAcceptance.deleteMany({ where: { userId: { in: [...negocioIds, ...clienteIds, ...repartidorIds] } } })
  }
  if (negocioIds.length) {
    await db.sesion.deleteMany({ where: { userId: { in: negocioIds } } })
    await db.negocio.deleteMany({ where: { id: { in: negocioIds } } })
  }
  if (clienteIds.length) await db.cliente.deleteMany({ where: { id: { in: clienteIds } } })
  if (repartidorIds.length) await db.repartidor.deleteMany({ where: { id: { in: repartidorIds } } })
}

// `usuario` (Negocio's username) is validated server-side against
// /^[a-zA-Z0-9_]{3,30}$/ — independent of, and stricter than, `nombre_local`
// or `slug`. Our prefix (with hyphens, well over 30 chars) never satisfies
// that on its own, so every Negocio fixture needs its own short compliant
// value instead of reusing the descriptive slug-like string.
function shortUsuario(): string {
  return `neg${randomUUID().replace(/-/g, "").slice(0, 20)}`
}

function registerRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      // Register is IP rate-limited — vary it per request so this suite's
      // own volume never trips the limiter and masks a real assertion.
      "x-forwarded-for": randomUUID(),
    },
  })
}

async function acceptanceFor(userId: string) {
  return db.legalAcceptance.findMany({ where: { userId } })
}

beforeAll(async () => {
  expect(process.env.DATABASE_URL).toBe(process.env.DELIGO_TEST_DATABASE_URL)
  await cleanup()
})

afterAll(async () => {
  await cleanup()
  expect(await db.negocio.count({ where: { slug: { startsWith: prefix } } })).toBe(0)
  expect(await db.cliente.count({ where: { email: { startsWith: prefix } } })).toBe(0)
  expect(await db.repartidor.count({ where: { email: { startsWith: prefix } } })).toBe(0)
})

describe("LEGAL-TERMS-ACCEPTANCE-VERSIONING-R1 — Negocio", () => {
  test("rejects registration without termsAccepted, and with termsAccepted=false, creating nothing", async () => {
    const slug = `${prefix}nega`
    const missing = await registerRoute(registerRequest({
      tipo: "negocio", nombre_local: slug, usuario: shortUsuario(), email: `${slug}@example.test`, password: TEST_PASSWORD, rubro: "restaurante",
    }))
    expect(missing.status).toBe(400)

    const falsy = await registerRoute(registerRequest({
      tipo: "negocio", termsAccepted: "false", nombre_local: slug, usuario: shortUsuario(), email: `${slug}@example.test`, password: TEST_PASSWORD, rubro: "restaurante",
    }))
    expect(falsy.status).toBe(400)

    expect(await db.negocio.findUnique({ where: { slug } })).toBeNull()
  })

  test("accepted registration atomically creates the Negocio and a matching LegalAcceptance record, server-authoritative on version and timestamp", async () => {
    const slug = `${prefix}negb`
    const before = new Date()
    const res = await registerRoute(registerRequest({
      tipo: "negocio", termsAccepted: "true", nombre_local: slug, usuario: shortUsuario(), email: `${slug}@example.test`, password: TEST_PASSWORD, rubro: "restaurante",
      // Client-sent version/timestamp/actor spoof attempt — must be fully ignored.
      termsVersion: "999-spoofed", privacyVersion: "old-spoofed", acceptedAt: "2000-01-01T00:00:00.000Z", userId: "someone-elses-id",
    }))
    expect(res.status).toBe(200)

    const negocio = await db.negocio.findUniqueOrThrow({ where: { slug } })
    const records = await acceptanceFor(negocio.id)
    expect(records.length).toBe(1)
    const record = records[0]
    expect(record.userType).toBe("negocio")
    expect(record.termsVersion).toBe(CURRENT_TERMS_VERSION)
    expect(record.privacyVersion).toBe(CURRENT_PRIVACY_VERSION)
    expect(record.source).toBe("register")
    expect(record.userId).toBe(negocio.id)
    expect(record.acceptedAt.getTime()).toBeGreaterThanOrEqual(before.getTime())
    expect(record.acceptedAt.getTime()).toBeLessThanOrEqual(Date.now())
  })

  test("a duplicate registration attempt for the same slug/email never produces a second orphan acceptance record", async () => {
    const slug = `${prefix}negc`
    const first = await registerRoute(registerRequest({
      tipo: "negocio", termsAccepted: "true", nombre_local: slug, usuario: shortUsuario(), email: `${slug}@example.test`, password: TEST_PASSWORD, rubro: "restaurante",
    }))
    expect(first.status).toBe(200)

    const second = await registerRoute(registerRequest({
      tipo: "negocio", termsAccepted: "true", nombre_local: slug, usuario: shortUsuario(), email: `${slug}@example.test`, password: TEST_PASSWORD, rubro: "restaurante",
    }))
    expect(second.status).toBe(409)

    const negocios = await db.negocio.findMany({ where: { slug } })
    expect(negocios.length).toBe(1)
    expect((await acceptanceFor(negocios[0].id)).length).toBe(1)
  })
})

describe("LEGAL-TERMS-ACCEPTANCE-VERSIONING-R1 — Cliente", () => {
  test("rejects registration without acceptance, accepts and persists a correct record otherwise", async () => {
    const email = `${prefix}clienta@example.test`
    const rejected = await registerRoute(registerRequest({
      tipo: "cliente", nombre: `${prefix}clienta`, email, password: TEST_PASSWORD,
    }))
    expect(rejected.status).toBe(400)
    expect(await db.cliente.findUnique({ where: { email } })).toBeNull()

    const ok = await registerRoute(registerRequest({
      tipo: "cliente", termsAccepted: "true", nombre: `${prefix}clienta`, email, password: TEST_PASSWORD,
    }))
    expect(ok.status).toBe(200)

    const cliente = await db.cliente.findUniqueOrThrow({ where: { email } })
    const records = await acceptanceFor(cliente.id)
    expect(records.length).toBe(1)
    expect(records[0].userType).toBe("cliente")
    expect(records[0].termsVersion).toBe(CURRENT_TERMS_VERSION)
    expect(records[0].privacyVersion).toBe(CURRENT_PRIVACY_VERSION)
    expect(records[0].source).toBe("register")
  })
})

describe("LEGAL-TERMS-ACCEPTANCE-VERSIONING-R1 — Repartidor (same shared gate as Negocio/Cliente)", () => {
  test("also gets a persisted acceptance record — the shared termsAccepted gate covers all three account types identically", async () => {
    const email = `${prefix}repa@example.test`
    const ok = await registerRoute(registerRequest({
      tipo: "repartidor", termsAccepted: "true", nombre: `${prefix}repa`, email, password: TEST_PASSWORD,
    }))
    expect(ok.status).toBe(200)

    const repartidor = await db.repartidor.findUniqueOrThrow({ where: { email } })
    const records = await acceptanceFor(repartidor.id)
    expect(records.length).toBe(1)
    expect(records[0].userType).toBe("repartidor")
  })
})
