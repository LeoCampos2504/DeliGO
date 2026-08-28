/// <reference types="bun-types" />

// ============================================
// P2-T18-BLOCKER-AUTH2-R2 (Phase 1) — integración real (PostgreSQL TESTING)
// ============================================
// Nunca mockea Prisma. Prefijo `P2T18_AUTH2_R2_`, cada cuenta/sesión creada
// se trackea individualmente y se limpia en un afterAll acotado (nunca un
// delete global). Cubre el contrato de escritura de login/route.ts y logout/
// route.ts congelado en codex-reports/archive/P2-T18-BLOCKER-AUTH2-R1.md —
// la resolución de qué cookie real corresponde a cada request (src/proxy.ts)
// se testea por separado, sin DB, en src/proxy.test.ts.

import { randomUUID } from "crypto"
import { describe, expect, test, beforeAll, afterAll, setDefaultTimeout } from "bun:test"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { hashPassword, SESSION_COOKIE_NAME, FAMILY_SESSION_COOKIE_NAMES } from "@/lib/auth"

setDefaultTimeout(60_000)

const ts = Date.now()
const prefix = `P2T18_AUTH2_R2_${ts}_`
const PASSWORD = "CorrectHorseBattery42"

const clienteIds: string[] = []
const negocioIds: string[] = []

async function createCliente(suffix: string) {
  const password = await hashPassword(PASSWORD)
  const cliente = await db.cliente.create({
    data: {
      nombre: `${prefix}cliente-${suffix}`,
      // loginCliente normaliza el email a lowercase antes del lookup —
      // debe coincidir exactamente con lo que se busca en el login.
      email: `${prefix.toLowerCase()}cliente-${suffix}@example.test`,
      telefono: "",
      password,
      emailVerified: new Date(),
    },
  })
  clienteIds.push(cliente.id)
  return cliente
}

async function createNegocio(suffix: string) {
  const password = await hashPassword(PASSWORD)
  const negocio = await db.negocio.create({
    data: {
      nombre: `${prefix}negocio-${suffix}`,
      slug: `${prefix.toLowerCase()}negocio-${suffix}`,
      usuario: `${prefix.toLowerCase()}negusr-${suffix}`,
      email: `${prefix}negocio-${suffix}@example.test`,
      password,
      aprobado: true,
      emailVerified: new Date(),
    },
  })
  negocioIds.push(negocio.id)
  return negocio
}

function extractSetCookie(res: Response, name: string): string | null {
  const all = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [res.headers.get("set-cookie") ?? ""]
  const match = all.find((c) => c.startsWith(`${name}=`))
  if (!match) return null
  return match.split(";")[0]!.split("=")[1] ?? null
}

function hasSetCookie(res: Response, name: string): boolean {
  const all = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [res.headers.get("set-cookie") ?? ""]
  return all.some((c) => c.startsWith(`${name}=`))
}

let loginRoute: (req: NextRequest) => Promise<Response>
let logoutRoute: (req: NextRequest) => Promise<Response>

async function cleanup() {
  if (negocioIds.length) {
    await db.sesion.deleteMany({ where: { userId: { in: negocioIds } } })
    await db.negocio.deleteMany({ where: { id: { in: negocioIds } } })
  }
  if (clienteIds.length) {
    await db.sesion.deleteMany({ where: { userId: { in: clienteIds } } })
    await db.cliente.deleteMany({ where: { id: { in: clienteIds } } })
  }
}

beforeAll(async () => {
  await cleanup()
  loginRoute = (await import("@/app/api/auth/login/route")).POST as (req: NextRequest) => Promise<Response>
  logoutRoute = (await import("@/app/api/auth/logout/route")).POST as (req: NextRequest) => Promise<Response>
})

afterAll(async () => {
  await cleanup()
  const remainingClientes = clienteIds.length ? await db.cliente.count({ where: { id: { in: clienteIds } } }) : 0
  const remainingNegocios = negocioIds.length ? await db.negocio.count({ where: { id: { in: negocioIds } } }) : 0
  const remainingSessions =
    (clienteIds.length ? await db.sesion.count({ where: { userId: { in: clienteIds } } }) : 0) +
    (negocioIds.length ? await db.sesion.count({ where: { userId: { in: negocioIds } } }) : 0)
  expect(remainingClientes).toBe(0)
  expect(remainingNegocios).toBe(0)
  expect(remainingSessions).toBe(0)
  await db.$disconnect()
})

describe("LOGIN_WRITES_ONLY_OWN_FAMILY_COOKIE", () => {
  test("login Cliente escribe deligo_session_cliente, nunca deligo_session_negocio/repartidor ni el nombre legacy", async () => {
    const cliente = await createCliente("login-family")
    const req = new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ tipo: "cliente", email: cliente.email, password: PASSWORD }),
      headers: { "content-type": "application/json", "x-forwarded-for": randomUUID() },
    })
    const res = await loginRoute(req)
    expect(res.status).toBe(200)

    expect(extractSetCookie(res, FAMILY_SESSION_COOKIE_NAMES.cliente)).not.toBeNull()
    expect(hasSetCookie(res, FAMILY_SESSION_COOKIE_NAMES.negocio)).toBe(false)
    expect(hasSetCookie(res, FAMILY_SESSION_COOKIE_NAMES.repartidor)).toBe(false)
    expect(hasSetCookie(res, SESSION_COOKIE_NAME)).toBe(false) // LEGACY_COOKIE_TRANSITION: login nuevo nunca vuelve a escribir el nombre legacy
  })

  test("login Negocio escribe deligo_session_negocio, nunca deligo_session_cliente", async () => {
    const negocio = await createNegocio("login-family")
    const req = new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ tipo: "negocio", usuario: negocio.usuario, password: PASSWORD }),
      headers: { "content-type": "application/json" },
    })
    const res = await loginRoute(req)
    expect(res.status).toBe(200)

    expect(extractSetCookie(res, FAMILY_SESSION_COOKIE_NAMES.negocio)).not.toBeNull()
    expect(hasSetCookie(res, FAMILY_SESSION_COOKIE_NAMES.cliente)).toBe(false)
    expect(hasSetCookie(res, SESSION_COOKIE_NAME)).toBe(false)
  })
})

describe("LOGOUT_ACTOR_SCOPED — Phase 1 transitional contract", () => {
  test("logout con x-resolved-actor-family=cliente limpia SÓLO la cookie de Cliente + la legacy, y revoca únicamente la Sesion de Cliente", async () => {
    const cliente = await createCliente("logout-scoped")
    const negocio = await createNegocio("logout-scoped-sibling")

    // Simula el estado que src/proxy.ts ya habría dejado para este request:
    // SESSION_COOKIE_NAME resuelto al token de Cliente + header de familia.
    const clienteToken = await (await import("@/lib/auth")).createSession(cliente.id, "cliente")
    const negocioToken = await (await import("@/lib/auth")).createSession(negocio.id, "negocio")

    const sessionsBefore = await db.sesion.count({ where: { userId: { in: [cliente.id, negocio.id] } } })
    expect(sessionsBefore).toBe(2)

    const req = new NextRequest("http://localhost/api/auth/logout", {
      method: "POST",
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${clienteToken}`,
        "x-resolved-actor-family": "cliente",
      },
    })
    const res = await logoutRoute(req)
    expect(res.status).toBe(200)

    expect(hasSetCookie(res, FAMILY_SESSION_COOKIE_NAMES.cliente)).toBe(true) // limpiada
    expect(hasSetCookie(res, SESSION_COOKIE_NAME)).toBe(true) // legacy siempre limpiada también
    expect(hasSetCookie(res, FAMILY_SESSION_COOKIE_NAMES.negocio)).toBe(false) // LOGOUT_OTHER_FAMILY_COOKIE_UNTOUCHED

    const clienteSessionAfter = await db.sesion.count({ where: { userId: cliente.id } })
    const negocioSessionAfter = await db.sesion.count({ where: { userId: negocio.id } })
    expect(clienteSessionAfter).toBe(0) // revocada
    expect(negocioSessionAfter).toBe(1) // OTHER_FAMILY_DB_SESSION_REVOKED=NO — intacta
  })

  test("logout sin header de familia (legacy puro, sin cambio de comportamiento) sigue revocando la Sesion del token presentado", async () => {
    const cliente = await createCliente("logout-legacy")
    const token = await (await import("@/lib/auth")).createSession(cliente.id, "cliente")

    const req = new NextRequest("http://localhost/api/auth/logout", {
      method: "POST",
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
    })
    const res = await logoutRoute(req)
    expect(res.status).toBe(200)
    expect(hasSetCookie(res, SESSION_COOKIE_NAME)).toBe(true)
    expect(hasSetCookie(res, FAMILY_SESSION_COOKIE_NAMES.cliente)).toBe(false) // sin header -> no se intenta limpiar ninguna cookie de familia

    const remaining = await db.sesion.count({ where: { userId: cliente.id } })
    expect(remaining).toBe(0)
  })

  test("un header de familia MAL etiquetado (mismatch) nunca revoca la Sesion equivocada — deleteSession siempre opera sobre el token real, nunca sobre el label", async () => {
    const cliente = await createCliente("logout-mismatch")
    const clienteToken = await (await import("@/lib/auth")).createSession(cliente.id, "cliente")

    // Escenario defensivo: family="negocio" mal etiquetado (nunca ocurre con
    // src/proxy.ts sin manipular, pero deleteSession debe seguir siendo
    // seguro por construcción — nunca confía en el label para decidir QUÉ
    // Sesion borrar, sólo en el hash del token real presentado).
    const req = new NextRequest("http://localhost/api/auth/logout", {
      method: "POST",
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${clienteToken}`,
        "x-resolved-actor-family": "negocio",
      },
    })
    const res = await logoutRoute(req)
    expect(res.status).toBe(200)

    // La Sesion real (Cliente) SÍ se revoca -- deleteSession(token) ignora
    // el label por completo, opera sobre el hash del token presentado.
    const remaining = await db.sesion.count({ where: { userId: cliente.id } })
    expect(remaining).toBe(0)
    // La cookie borrada en la respuesta es la de "negocio" (label) + legacy
    // — intentar borrar deligo_session_negocio (que el navegador nunca tuvo
    // seteada, porque este Cliente sólo tiene deligo_session_cliente) es un
    // no-op inofensivo, nunca revela ni afecta ninguna otra sesión real.
    expect(hasSetCookie(res, FAMILY_SESSION_COOKIE_NAMES.negocio)).toBe(true)
    expect(hasSetCookie(res, SESSION_COOKIE_NAME)).toBe(true)
  })
})
