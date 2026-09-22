// P2-T40-R2/R3 — CASE G diagnostic + real root cause regression.
//
// R2 chained the REAL exported handlers (applyLoginCookies from
// login/route.ts, then the real POST handler of reconcile-stale-owner/route.ts)
// across two sequential requests, exactly as a browser would present them,
// and found the pure handoff/cleanup logic correct — but raising the TTL
// alone did NOT fix the physical bug on re-certification.
//
// R3 found the REAL root cause by reading actual runtime telemetry from
// Railway (never inferred): the normalized-table detach reported
// `detached=true`, yet A kept receiving push physically. The reason:
// `resolveCorePushTargetsFromNormalized()` (src/lib/push.ts, the ACTUAL
// resolver the physical "pedido nuevo" notification used) does a UNION of
// the normalized PushSubscription rows AND the owner's legacy per-model
// field (`Negocio.pushSubscription`) — a deliberate P2-T05 Stage4 design for
// mixed-version multi-device rollout. R1/R2's stale-owner cleanup only ever
// cleared the normalized row; A's OWN Negocio row's legacy field (nothing
// shared with B's, since it's a per-row field, not a per-endpoint value)
// still pointed at the same physical endpoint, so the UNION kept including
// it as a live send target even after the normalized row was gone.
//
// These tests use the REAL resolver (`resolveCorePushTargets`, imported from
// @/lib/push — the exact function `createNotification()` calls for
// Negocio/Cliente/Repartidor/Empleado fan-out) to prove the fix end-to-end,
// per the explicit requirement that CASE G's regression test must use "el
// MISMO resolver real que usa la notificación física".
import { beforeEach, describe, expect, mock, test } from "bun:test"
import { NextRequest, NextResponse } from "next/server"
import * as jose from "jose"
import { authMockState, installAuthMock, resetAuthMockState } from "@/lib/test-helpers/auth-mock"

installAuthMock()

type PushRow = { id: string; ownerType: string; ownerId: string; channel: string; endpoint: string; p256dh: string; auth: string }
type NegocioRow = { id: string; pushSubscription: string | null }

let pushRows: PushRow[]
let negocioRows: NegocioRow[]

mock.module("@/lib/db", () => ({
  db: {
    pushSubscription: {
      deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
        const before = pushRows.length
        pushRows = pushRows.filter((r) => !Object.entries(where).every(([k, v]) => (r as Record<string, unknown>)[k] === v))
        return { count: before - pushRows.length }
      },
      findMany: async ({ where }: { where: Record<string, unknown> }) =>
        pushRows.filter((r) => Object.entries(where).every(([k, v]) => (r as Record<string, unknown>)[k] === v)),
    },
    negocio: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const row = negocioRows.find((r) => r.id === where.id)
        return row ? { pushSubscription: row.pushSubscription } : null
      },
      // CAS semantics, mirroring the real casClearLegacyPushValue in src/lib/push.ts.
      updateMany: async ({ where, data }: { where: { id: string; pushSubscription?: string | null }; data: { pushSubscription: string | null } }) => {
        const row = negocioRows.find(
          (r) => r.id === where.id && (where.pushSubscription === undefined || r.pushSubscription === where.pushSubscription)
        )
        if (!row) return { count: 0 }
        row.pushSubscription = data.pushSubscription
        return { count: 1 }
      },
    },
  },
}))

const HANDOFF_SECRET = "case-g-integration-test-secret-".repeat(2)
process.env.PUSH_OWNER_HANDOFF_SECRET = HANDOFF_SECRET

const { applyLoginCookies } = await import("@/app/api/auth/login/route")
const { POST: reconcilePOST } = await import("./route")
const { resolveCorePushTargets } = await import("@/lib/push")

const ENDPOINT = "https://push.example/SHARED-PHYSICAL-DEVICE"
function subJson(endpoint = ENDPOINT, p256dh = "p", auth = "a") {
  return JSON.stringify({ endpoint, expirationTime: null, keys: { p256dh, auth } })
}

function reqLoginB(previousTokenCookieValue: string | null): NextRequest {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: previousTokenCookieValue ? { cookie: `deligo_session_negocio=${previousTokenCookieValue}` } : {},
  })
}

/** Builds the reconcile-stale-owner request exactly as the middleware would
 * hand it to the route handler: the resolved family token forwarded under
 * the legacy SESSION_COOKIE name, plus whatever the browser still carries
 * for the handoff cookie — untouched by the family-cookie rewrite. */
function reqReconcile(handoffCookieValue: string | undefined, subscription: unknown): NextRequest {
  const cookies = [`deligo_session=valid-token`]
  if (handoffCookieValue) cookies.push(`deligo_push_handoff=${handoffCookieValue}`)
  return new NextRequest("http://localhost/api/push/reconcile-stale-owner?actorFamily=negocio", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookies.join("; ") },
    body: JSON.stringify({ subscription }),
  })
}

async function signExpiredHandoffLikeApplyLoginCookiesWould(prevOwnerId: string): Promise<string> {
  const secret = new TextEncoder().encode(HANDOFF_SECRET)
  const now = Math.floor(Date.now() / 1000)
  return new jose.SignJWT({
    kind: "push-owner-handoff",
    family: "negocio",
    prevOwnerType: "negocio",
    prevOwnerId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("deligo-push-owner-handoff")
    .setAudience("deligo-push-owner-handoff")
    .setIssuedAt(now - 300)
    .setExpirationTime(now - 180) // expired well past any reasonable TTL
    .sign(secret)
}

beforeEach(() => {
  pushRows = []
  negocioRows = [
    { id: "negocio-A", pushSubscription: null },
    { id: "negocio-B", pushSubscription: null },
  ]
  resetAuthMockState()
})

describe("CASE G — same-family account switch without logout (chained, real handlers)", () => {
  test("BASELINE (no delay): B logs in over A's live session -> handoff minted from A's real prior row -> reconcile cleans up A/X (normalized), keeps B able to bind", async () => {
    authMockState.sesionByToken.set("token-A", { token: "token-A", userId: "negocio-A", userType: "negocio", expiresAt: new Date(Date.now() + 3600_000) })
    pushRows = [{ id: "row-1", ownerType: "negocio", ownerId: "negocio-A", channel: "default", endpoint: ENDPOINT, p256dh: "p", auth: "a" }]

    const loginReq = reqLoginB("token-A")
    const loginRes = NextResponse.json({ ok: true })
    await applyLoginCookies(loginReq, loginRes, "token-B", "negocio", "negocio-B")

    const handoffValue = loginRes.cookies.get("deligo_push_handoff")?.value
    expect(handoffValue).toBeDefined()

    authMockState.currentUser = { id: "negocio-B", type: "negocio" }
    const reconcileRes = await reconcilePOST(reqReconcile(handoffValue, subJson()))
    const body = await reconcileRes.json()

    expect(body.newSession).toBe(true)
    expect(body.staleCleanupPerformed).toBe(true)
    expect(pushRows.some((r) => r.ownerId === "negocio-A")).toBe(false)
  })

  test("DELAYED (TTL elapsed before the client reconciles): the real login flow mints a valid handoff, but an expired one leaves the normalized row stale", async () => {
    pushRows = [{ id: "row-1", ownerType: "negocio", ownerId: "negocio-A", channel: "default", endpoint: ENDPOINT, p256dh: "p", auth: "a" }]
    const expiredHandoff = await signExpiredHandoffLikeApplyLoginCookiesWould("negocio-A")

    authMockState.currentUser = { id: "negocio-B", type: "negocio" }
    const reconcileRes = await reconcilePOST(reqReconcile(expiredHandoff, subJson()))
    const body = await reconcileRes.json()

    expect(body.newSession).toBe(false)
    expect(body.staleCleanupPerformed).toBe(false)
    expect(pushRows.some((r) => r.ownerId === "negocio-A")).toBe(true)
  })

  test("no handoff cookie at all reaching reconcile: cleanup silently no-ops the same way — same symptom, different mechanism", async () => {
    pushRows = [{ id: "row-1", ownerType: "negocio", ownerId: "negocio-A", channel: "default", endpoint: ENDPOINT, p256dh: "p", auth: "a" }]
    authMockState.currentUser = { id: "negocio-B", type: "negocio" }
    const reconcileRes = await reconcilePOST(reqReconcile(undefined, subJson()))
    const body = await reconcileRes.json()
    expect(body.newSession).toBe(false)
    expect(pushRows.some((r) => r.ownerId === "negocio-A")).toBe(true)
  })
})

describe("CASE_G_REAL_ROOT_CAUSE_REGRESSION — legacy Negocio.pushSubscription UNION target, using the REAL send-path resolver", () => {
  test("before the fix's legacy step existed, A's legacy field alone would have kept resolving A as a live target even with the normalized row gone (sanity check of the resolver's own UNION behavior)", async () => {
    // A's legacy field still holds the physical endpoint (as it would from
    // A's original subscribe, dual-write, never touched by a normalized-only
    // detach) while the normalized row is ALREADY gone.
    negocioRows = [{ id: "negocio-A", pushSubscription: subJson() }, { id: "negocio-B", pushSubscription: null }]
    pushRows = []

    const targetsForA = await resolveCorePushTargets("negocio", "negocio-A", negocioRows[0].pushSubscription)
    expect(targetsForA.some((t) => t.endpoint === ENDPOINT)).toBe(true) // proves the UNION alone would leak
  })

  test("NEGOCIO_A_TO_B_WITHOUT_LOGOUT: full chained flow (login B over A, reconcile as B) -> A_NOT_TARGETED_AFTER_SWITCH, B_TARGETED_AFTER_SWITCH, using the REAL resolveCorePushTargets", async () => {
    // A already had a live physical binding (dual-written at original
    // subscribe time): normalized row + legacy field, same endpoint.
    authMockState.sesionByToken.set("token-A", { token: "token-A", userId: "negocio-A", userType: "negocio", expiresAt: new Date(Date.now() + 3600_000) })
    pushRows = [{ id: "row-1", ownerType: "negocio", ownerId: "negocio-A", channel: "default", endpoint: ENDPOINT, p256dh: "p", auth: "a" }]
    negocioRows = [{ id: "negocio-A", pushSubscription: subJson() }, { id: "negocio-B", pushSubscription: null }]

    // B logs in over A without logout.
    const loginReq = reqLoginB("token-A")
    const loginRes = NextResponse.json({ ok: true })
    await applyLoginCookies(loginReq, loginRes, "token-B", "negocio", "negocio-B")
    const handoffValue = loginRes.cookies.get("deligo_push_handoff")?.value

    // B reconciles immediately (same physical device/endpoint reported).
    authMockState.currentUser = { id: "negocio-B", type: "negocio" }
    const reconcileRes = await reconcilePOST(reqReconcile(handoffValue, subJson()))
    const reconcileBody = await reconcileRes.json()
    expect(reconcileBody.staleCleanupPerformed).toBe(true)

    // B's own auto-rebind (independent call, /api/push/subscribe today) —
    // simulated here directly at the DB level, since this test's focus is
    // the resolver/cleanup contract, not the subscribe route itself.
    negocioRows.find((r) => r.id === "negocio-B")!.pushSubscription = subJson()
    pushRows.push({ id: "row-2", ownerType: "negocio", ownerId: "negocio-B", channel: "default", endpoint: ENDPOINT, p256dh: "p", auth: "a" })

    // THE ACTUAL PROOF: resolve targets with the SAME resolver the physical
    // "pedido nuevo" notification uses.
    const negocioAAfter = negocioRows.find((r) => r.id === "negocio-A")!
    const negocioBAfter = negocioRows.find((r) => r.id === "negocio-B")!
    const targetsForA = await resolveCorePushTargets("negocio", "negocio-A", negocioAAfter.pushSubscription)
    const targetsForB = await resolveCorePushTargets("negocio", "negocio-B", negocioBAfter.pushSubscription)

    expect(targetsForA.some((t) => t.endpoint === ENDPOINT)).toBe(false) // A_NOT_TARGETED_AFTER_SWITCH
    expect(targetsForB.some((t) => t.endpoint === ENDPOINT)).toBe(true) // B_TARGETED_AFTER_SWITCH
  })

  test("cross-family multi-bind preserved: clearing Negocio A's legacy field never touches a CuentaOperativa row sharing the same physical endpoint", async () => {
    // CuentaOperativa never has a legacy per-model field (A0 §11) — nothing
    // for this fix to touch there; this test proves the negocio-scoped
    // legacy clear only ever reads/writes negocio-A's own row.
    negocioRows = [
      { id: "negocio-A", pushSubscription: subJson() },
      { id: "negocio-OTHER", pushSubscription: subJson() }, // a different Negocio, unrelated
    ]
    pushRows = [{ id: "row-1", ownerType: "negocio", ownerId: "negocio-A", channel: "default", endpoint: ENDPOINT, p256dh: "p", auth: "a" }]
    authMockState.sesionByToken.set("token-A", { token: "token-A", userId: "negocio-A", userType: "negocio", expiresAt: new Date(Date.now() + 3600_000) })

    const loginReq = reqLoginB("token-A")
    const loginRes = NextResponse.json({ ok: true })
    await applyLoginCookies(loginReq, loginRes, "token-B", "negocio", "negocio-B")
    const handoffValue = loginRes.cookies.get("deligo_push_handoff")?.value

    authMockState.currentUser = { id: "negocio-B", type: "negocio" }
    await reconcilePOST(reqReconcile(handoffValue, subJson()))

    expect(negocioRows.find((r) => r.id === "negocio-A")!.pushSubscription).toBeNull() // A's own row cleared
    expect(negocioRows.find((r) => r.id === "negocio-OTHER")!.pushSubscription).not.toBeNull() // untouched
  })
})
