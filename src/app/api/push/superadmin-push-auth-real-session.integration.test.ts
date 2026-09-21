// P2-T39-R3B — reproducción/regresión del 401 físico real reportado por el
// operador: POST /api/push/subscribe?actorFamily=superadmin devolvía 401
// con una sesión SuperAdmin real y válida (la misma sesión que
// GET /api/superadmin/dashboard aceptaba con 200). Este archivo usa el
// MISMO mecanismo real de login (createSuperadminSession, la función real
// que /api/superadmin/auth/google/callback usa tras un login exitoso —
// nunca un mock de auth) contra la DB real de Testing
// (DELIGO_TEST_DATABASE_URL), y encadena la MISMA cookie resultante a
// través de src/proxy.ts (el middleware Edge real, la capa donde vivía el
// bug) y luego al route handler real de dashboard y de subscribe.
//
// A diferencia de superadmin-actor-family-contract.test.ts (R3A, que mockea
// @/lib/superadmin-auth para aislar el contrato de la ruta) y de
// proxy.test.ts (que prueba proxy() con un token FABRICADO pero con el
// formato real), este archivo es el único que ejercita las TRES capas
// reales encadenadas: proxy() -> requireSuperadminSession() ->
// validateSuperadminSession() -> Sesion/SuperAdmin reales en Postgres.
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { NextRequest } from "next/server"
import { randomUUID } from "crypto"
import { db } from "@/lib/db"
import { createSuperadminSession, SUPERADMIN_SESSION_COOKIE_NAME } from "@/lib/superadmin-auth"
import { proxy } from "@/proxy"
import { GET as dashboardGET } from "@/app/api/superadmin/dashboard/route"
import { POST as subscribePOST } from "@/app/api/push/subscribe/route"

setDefaultTimeout(30_000)

const prefix = "test-t39-r3b-"

async function cleanup() {
  const superadmins = await db.superAdmin.findMany({ where: { email: { startsWith: prefix } }, select: { id: true } })
  const superadminIds = superadmins.map((s) => s.id)
  if (superadminIds.length) {
    await db.pushSubscription.deleteMany({ where: { ownerType: "superadmin", ownerId: { in: superadminIds } } })
    await db.sesion.deleteMany({ where: { userId: { in: superadminIds } } })
    await db.superAdmin.deleteMany({ where: { id: { in: superadminIds } } })
  }
}

beforeAll(async () => {
  await cleanup()
}, { timeout: 15_000 })

afterAll(async () => {
  await cleanup()
})

function reqWithCookie(url: string, cookie: string, init: { method?: string; body?: unknown } = {}): NextRequest {
  return new NextRequest(url, {
    method: init.method ?? "GET",
    headers: {
      cookie: `${SUPERADMIN_SESSION_COOKIE_NAME}=${cookie}`,
      "content-type": "application/json",
      origin: "http://localhost",
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
}

describe("P2-T39-R3B — sesión SuperAdmin real: dashboard 200 y push subscribe autentican con la MISMA cookie", () => {
  test("proxy() real NUNCA bloquea POST /api/push/subscribe?actorFamily=superadmin con una sesión SuperAdmin real (regresión del 401 físico)", async () => {
    const admin = await db.superAdmin.create({
      data: { email: `${prefix}${randomUUID()}@example.test`, googleSub: `${prefix}gsub-${randomUUID()}`, activo: true },
    })
    const token = await createSuperadminSession(admin.id)

    // Capa 1: el middleware real (src/proxy.ts) — acá vivía el bug.
    const proxyRes = proxy(
      new NextRequest("http://localhost/api/push/subscribe?actorFamily=superadmin", {
        method: "POST",
        headers: { cookie: `${SUPERADMIN_SESSION_COOKIE_NAME}=${token}`, origin: "http://localhost" },
      })
    )
    expect(proxyRes.status).not.toBe(401)

    // Capa 2: el route handler real, con la MISMA cookie, contra DB real.
    const dashboardRes = await dashboardGET(reqWithCookie("http://localhost/api/superadmin/dashboard", token))
    expect(dashboardRes.status).toBe(200)

    const subscribeRes = await subscribePOST(
      reqWithCookie("http://localhost/api/push/subscribe?actorFamily=superadmin", token, {
        method: "POST",
        body: { subscription: JSON.stringify({ endpoint: "https://push.example/r3b-real-session", expirationTime: null, keys: { p256dh: "P", auth: "A" } }) },
      })
    )
    expect(subscribeRes.status).not.toBe(401)
    expect(subscribeRes.status).toBe(200)

    const persisted = await db.pushSubscription.findFirst({ where: { ownerType: "superadmin", ownerId: admin.id } })
    expect(persisted).not.toBeNull()
    expect(persisted?.endpoint).toBe("https://push.example/r3b-real-session")
  })

  test("sin cookie SuperAdmin: dashboard y subscribe rechazan igual (401), ninguno queda abierto por el fix", async () => {
    const dashboardRes = await dashboardGET(new NextRequest("http://localhost/api/superadmin/dashboard"))
    expect(dashboardRes.status).toBe(401)

    const proxyRes = proxy(
      new NextRequest("http://localhost/api/push/subscribe?actorFamily=superadmin", {
        method: "POST",
        headers: { origin: "http://localhost" },
      })
    )
    expect(proxyRes.status).toBe(401)
  })
})
