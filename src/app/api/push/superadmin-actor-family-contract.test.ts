// P2-T39-R3A — Pre-physical certification gate, §5: contratos de auth para
// la rama `actorFamily=superadmin` de las 3 rutas compartidas de push
// (subscribe/status/unsubscribe), agregada en P2-T39-R3. R3 mismo nunca
// certificó esta rama con tests — sólo la rama LEGACY (SESSION_COOKIE_NAME)
// ya tenía cobertura (ver route.test.ts de cada ruta, tests "superadmin:
// legacy-only"). Este archivo es dedicado (nunca modifica los tres
// route.test.ts existentes) para no arriesgar colisión de mock.module con
// sus propios mocks de @/lib/db — este archivo mockea @/lib/db con una
// forma distinta (sólo pushSubscription, sin cliente/negocio/repartidor/
// superAdmin legacy) y @/lib/superadmin-auth (nunca mockeado por los otros
// tres archivos, que sólo cubren la rama legacy vía @/lib/auth).
//
// requireSuperadminSession se mockea de forma COOKIE-AWARE (lee
// req.cookies.get("deligo_superadmin_session") de verdad) en vez de un
// stub que siempre responde igual — así los tests que envían la cookie
// EQUIVOCADA (u otra cookie de otra family) prueban el contrato real, no
// uno trivialmente cierto por construcción del mock.
import { beforeEach, describe, expect, mock, test } from "bun:test"
import { NextRequest } from "next/server"

interface PushRow {
  ownerType: string
  ownerId: string
  channel: string
  endpoint: string
  p256dh: string
  auth: string
  expirationTime: Date | null
}

let pushRows: PushRow[]

function matchOwnerChannelEndpoint(row: PushRow, key: { ownerType: string; ownerId: string; channel: string; endpoint: string }) {
  return row.ownerType === key.ownerType && row.ownerId === key.ownerId && row.channel === key.channel && row.endpoint === key.endpoint
}

mock.module("@/lib/db", () => ({
  db: {
    pushSubscription: {
      upsert: async (args: {
        where: { ownerType_ownerId_channel_endpoint: { ownerType: string; ownerId: string; channel: string; endpoint: string } }
        create: PushRow
        update: Partial<PushRow>
      }) => {
        const key = args.where.ownerType_ownerId_channel_endpoint
        const existing = pushRows.find((r) => matchOwnerChannelEndpoint(r, key))
        if (existing) {
          Object.assign(existing, args.update)
          return existing
        }
        const row: PushRow = { ...args.create }
        pushRows.push(row)
        return row
      },
      findFirst: async ({ where }: { where: { ownerType: string; ownerId: string; channel: string; endpoint: string } }) =>
        pushRows.find((r) => matchOwnerChannelEndpoint(r, where)) ?? null,
      deleteMany: async ({ where }: { where: { ownerType: string; ownerId: string; channel: string; endpoint: string; p256dh: string; auth: string } }) => {
        const before = pushRows.length
        pushRows = pushRows.filter(
          (r) => !(matchOwnerChannelEndpoint(r, where) && r.p256dh === where.p256dh && r.auth === where.auth)
        )
        return { count: before - pushRows.length }
      },
    },
  },
}))

const ADMIN_A_TOKEN = "valid-superadmin-token-a"
const ADMIN_A = { id: "superadmin-a", email: "admin-a@test.example" }
const ADMIN_B_TOKEN = "valid-superadmin-token-b"
const ADMIN_B = { id: "superadmin-b", email: "admin-b@test.example" }

// Cookie-aware: sólo un token EXACTO conocido concede sesión — cualquier
// otro valor (incluida una cookie de OTRA family, o ausente) es 401. Esto
// es lo que hace que los tests D/F más abajo prueben el contrato real y no
// una tautología del mock.
mock.module("@/lib/superadmin-auth", () => ({
  requireSuperadminSession: async (req: NextRequest) => {
    const token = req.cookies.get("deligo_superadmin_session")?.value
    if (token === ADMIN_A_TOKEN) return { ok: true, admin: ADMIN_A }
    if (token === ADMIN_B_TOKEN) return { ok: true, admin: ADMIN_B }
    return { ok: false, status: 401 }
  },
}))

mock.module("@/lib/log-safe-error", () => ({
  safeErrorForLog: (e: unknown) => e,
}))

const { POST: subscribePOST } = await import("./subscribe/route")
const { POST: statusPOST } = await import("./status/route")
const { POST: unsubscribePOST } = await import("./unsubscribe/route")

function req(
  path: string,
  opts: { ip: string; body?: unknown; cookie?: string; extraBody?: Record<string, unknown> }
): NextRequest {
  const headers: Record<string, string> = { "content-type": "application/json", "x-forwarded-for": opts.ip }
  if (opts.cookie) headers.cookie = opts.cookie
  return new NextRequest(`http://localhost${path}?actorFamily=superadmin`, {
    method: "POST",
    headers,
    body: JSON.stringify({ subscription: opts.body, ...(opts.extraBody ?? {}) }),
  })
}

function adminCookie(token: string): string {
  return `deligo_superadmin_session=${token}`
}

const SUB_E1 = JSON.stringify({ endpoint: "https://push.example/admin-e1", expirationTime: null, keys: { p256dh: "P1", auth: "A1" } })
const SUB_E2 = JSON.stringify({ endpoint: "https://push.example/admin-e2", expirationTime: null, keys: { p256dh: "P2", auth: "A2" } })
const SUB_SHARED = JSON.stringify({ endpoint: "https://push.example/admin-shared", expirationTime: null, keys: { p256dh: "PS", auth: "AS" } })

// Offset por encima de los rangos ya usados por subscribe/status/
// unsubscribe route.test.ts (hasta .65) — evita colisión de rate-limit
// compartido si algún día se corren en el mismo proceso bun.
let ipCounter = 200
function nextIp(): string {
  ipCounter += 1
  return `203.0.113.${ipCounter}`
}

beforeEach(() => {
  pushRows = []
})

describe("P2-T39-R3A §5 — auth contract de actorFamily=superadmin", () => {
  test("A: subscribe sin sesión SuperAdmin -> 401, sin escritura", async () => {
    const res = await subscribePOST(req("/api/push/subscribe", { ip: nextIp(), body: SUB_E1 }))
    expect(res.status).toBe(401)
    expect(pushRows.length).toBe(0)
  })

  test("B: status sin sesión SuperAdmin -> 401", async () => {
    const res = await statusPOST(req("/api/push/status", { ip: nextIp(), body: SUB_E1 }))
    expect(res.status).toBe(401)
  })

  test("C: unsubscribe sin sesión SuperAdmin -> 401", async () => {
    const res = await unsubscribePOST(req("/api/push/unsubscribe", { ip: nextIp(), body: SUB_E1 }))
    expect(res.status).toBe(401)
  })

  test("D: una cookie de OTRA family (nunca deligo_superadmin_session) no concede acceso — no basta con estar autenticado como otro actor", async () => {
    const res = await subscribePOST(
      req("/api/push/subscribe", { ip: nextIp(), body: SUB_E1, cookie: "deligo_session=some-cliente-or-negocio-session-token" })
    )
    expect(res.status).toBe(401)
    expect(pushRows.length).toBe(0)
  })

  test("E: un ownerId/userId falso en el body nunca reemplaza al admin autenticado real (server-derived)", async () => {
    const res = await subscribePOST(
      req("/api/push/subscribe", {
        ip: nextIp(),
        body: SUB_E1,
        cookie: adminCookie(ADMIN_A_TOKEN),
        extraBody: { ownerId: "superadmin-ATTACKER", userId: "superadmin-ATTACKER", ownerType: "cuenta_operativa" },
      })
    )
    expect(res.status).toBe(200)
    expect(pushRows.length).toBe(1)
    expect(pushRows[0].ownerId).toBe(ADMIN_A.id)
    expect(pushRows[0].ownerType).toBe("superadmin")
  })

  test("F: SuperAdmin A no puede leer ni borrar el binding de SuperAdmin B (mismo endpoint físico distinto owner)", async () => {
    const subRes = await subscribePOST(req("/api/push/subscribe", { ip: nextIp(), body: SUB_SHARED, cookie: adminCookie(ADMIN_B_TOKEN) }))
    expect(subRes.status).toBe(200)

    const statusRes = await statusPOST(req("/api/push/status", { ip: nextIp(), body: SUB_SHARED, cookie: adminCookie(ADMIN_A_TOKEN) }))
    const statusBody = (await statusRes.json()) as { subscribed: boolean }
    expect(statusBody.subscribed).toBe(false)

    const unsubRes = await unsubscribePOST(req("/api/push/unsubscribe", { ip: nextIp(), body: SUB_SHARED, cookie: adminCookie(ADMIN_A_TOKEN) }))
    const unsubBody = (await unsubRes.json()) as { removed: boolean }
    expect(unsubBody.removed).toBe(false)
    expect(pushRows.find((r) => r.ownerId === ADMIN_B.id)).toBeDefined()
  })

  test("G: subscribe deriva ownerType=superadmin + ownerId=admin autenticado + channel=default, siempre server-side", async () => {
    await subscribePOST(req("/api/push/subscribe", { ip: nextIp(), body: SUB_E1, cookie: adminCookie(ADMIN_A_TOKEN) }))
    expect(pushRows.length).toBe(1)
    expect(pushRows[0]).toMatchObject({ ownerType: "superadmin", ownerId: ADMIN_A.id, channel: "default" })
  })

  test("H: OFF (unsubscribe) borra únicamente la fila del SuperAdmin autenticado actual, nunca la de otro admin", async () => {
    await subscribePOST(req("/api/push/subscribe", { ip: nextIp(), body: SUB_E1, cookie: adminCookie(ADMIN_A_TOKEN) }))
    await subscribePOST(req("/api/push/subscribe", { ip: nextIp(), body: SUB_E2, cookie: adminCookie(ADMIN_B_TOKEN) }))
    expect(pushRows.length).toBe(2)

    const res = await unsubscribePOST(req("/api/push/unsubscribe", { ip: nextIp(), body: SUB_E1, cookie: adminCookie(ADMIN_A_TOKEN) }))
    expect((await res.json()).removed).toBe(true)
    expect(pushRows.find((r) => r.ownerId === ADMIN_A.id)).toBeUndefined()
    expect(pushRows.find((r) => r.ownerId === ADMIN_B.id)).toBeDefined()
  })

  test("§7: ON -> OFF -> un status-check posterior (simulando relogin/remount) reporta subscribed=false, nunca un auto-reenrollment silencioso", async () => {
    await subscribePOST(req("/api/push/subscribe", { ip: nextIp(), body: SUB_E1, cookie: adminCookie(ADMIN_A_TOKEN) }))
    const beforeOff = await statusPOST(req("/api/push/status", { ip: nextIp(), body: SUB_E1, cookie: adminCookie(ADMIN_A_TOKEN) }))
    expect((await beforeOff.json()).subscribed).toBe(true)

    const offRes = await unsubscribePOST(req("/api/push/unsubscribe", { ip: nextIp(), body: SUB_E1, cookie: adminCookie(ADMIN_A_TOKEN) }))
    expect((await offRes.json()).removed).toBe(true)

    // "Relogin"/remount: a fresh status check against the exact same
    // physical endpoint, with no intervening subscribe call — the only
    // write path this test ever exercised was the explicit unsubscribe
    // above, so a `true` here would prove a silent re-enrollment.
    const afterOff = await statusPOST(req("/api/push/status", { ip: nextIp(), body: SUB_E1, cookie: adminCookie(ADMIN_A_TOKEN) }))
    expect((await afterOff.json()).subscribed).toBe(false)
  })

  test("I: un endpoint físico compartido con otra family (cuenta_operativa) permanece intacto tras el unsubscribe de SuperAdmin", async () => {
    pushRows.push({
      ownerType: "cuenta_operativa",
      ownerId: "cuenta-1",
      channel: "default",
      endpoint: "https://push.example/admin-shared",
      p256dh: "PS",
      auth: "AS",
      expirationTime: null,
    })
    await subscribePOST(req("/api/push/subscribe", { ip: nextIp(), body: SUB_SHARED, cookie: adminCookie(ADMIN_A_TOKEN) }))
    expect(pushRows.length).toBe(2)

    const res = await unsubscribePOST(req("/api/push/unsubscribe", { ip: nextIp(), body: SUB_SHARED, cookie: adminCookie(ADMIN_A_TOKEN) }))
    expect((await res.json()).removed).toBe(true)
    expect(pushRows.find((r) => r.ownerType === "superadmin")).toBeUndefined()
    expect(pushRows.find((r) => r.ownerType === "cuenta_operativa" && r.ownerId === "cuenta-1")).toBeDefined()
  })
})
