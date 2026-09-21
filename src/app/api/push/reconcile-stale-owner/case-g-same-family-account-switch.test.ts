// P2-T40-R2 — CASE G diagnostic: chains the REAL exported handlers
// (applyLoginCookies from login/route.ts, then the real POST handler of
// reconcile-stale-owner/route.ts) across two sequential requests, exactly as
// a browser would present them, to determine whether the pure server-side
// logic holds up for the physically-reproduced bug: Negocio A authenticated
// with Push working, Negocio B logs in on the SAME browser WITHOUT A logging
// out first, and A's stale binding survives.
//
// This is deliberately NOT a copy of the existing isolated unit tests — those
// already proved each piece works with a HAND-CONSTRUCTED handoff cookie.
// This test constructs the handoff the way the REAL login flow does (via
// applyLoginCookies itself, fed A's real prior session row) and threads its
// literal Set-Cookie value into the second request, to catch any gap between
// "the logic is correct in isolation" and "the two requests actually agree
// on the same cookie value in sequence."
import { beforeEach, describe, expect, mock, test } from "bun:test"
import { NextRequest, NextResponse } from "next/server"
import * as jose from "jose"
import { authMockState, installAuthMock, resetAuthMockState } from "@/lib/test-helpers/auth-mock"

installAuthMock()

type PushRow = { id: string; ownerType: string; ownerId: string; channel: string; endpoint: string; p256dh: string; auth: string }
let pushRows: PushRow[]

mock.module("@/lib/db", () => ({
  db: {
    pushSubscription: {
      deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
        const before = pushRows.length
        pushRows = pushRows.filter((r) => !Object.entries(where).every(([k, v]) => (r as Record<string, unknown>)[k] === v))
        return { count: before - pushRows.length }
      },
    },
  },
}))

const HANDOFF_SECRET = "case-g-integration-test-secret-".repeat(2)
process.env.PUSH_OWNER_HANDOFF_SECRET = HANDOFF_SECRET

const { applyLoginCookies } = await import("@/app/api/auth/login/route")
const { POST: reconcilePOST } = await import("./route")

const ENDPOINT = "https://push.example/SHARED-PHYSICAL-DEVICE"
function subJson() {
  return JSON.stringify({ endpoint: ENDPOINT, expirationTime: null, keys: { p256dh: "p", auth: "a" } })
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
    .setExpirationTime(now - 180) // expired 3 minutes ago, well past the 120s TTL
    .sign(secret)
}

beforeEach(() => {
  pushRows = []
  resetAuthMockState()
})

describe("CASE G — same-family account switch without logout (chained, real handlers)", () => {
  test("BASELINE (no delay): B logs in over A's live session -> handoff minted from A's real prior row -> reconcile cleans up A/X, keeps B able to bind", async () => {
    // 1. A's prior session row exists (as it would after A's own earlier login).
    authMockState.sesionByToken.set("token-A", { token: "token-A", userId: "negocio-A", userType: "negocio", expiresAt: new Date(Date.now() + 3600_000) })
    // 2. A's physical binding already exists (Push was working for A).
    pushRows = [{ id: "row-1", ownerType: "negocio", ownerId: "negocio-A", channel: "default", endpoint: ENDPOINT, p256dh: "p", auth: "a" }]

    // 3. B logs in on the SAME browser, which still carries A's family cookie
    //    (no explicit logout happened) — applyLoginCookies is the REAL
    //    function login/route.ts calls, not a re-implementation.
    const loginReq = reqLoginB("token-A")
    const loginRes = NextResponse.json({ ok: true })
    await applyLoginCookies(loginReq, loginRes, "token-B", "negocio", "negocio-B")

    const handoffValue = loginRes.cookies.get("deligo_push_handoff")?.value
    expect(handoffValue).toBeDefined() // the real login flow DID mint a handoff

    // 4. Client reconciles as B IMMEDIATELY (no artificial delay) — the
    //    literal Set-Cookie value from step 3 is what the browser would
    //    actually present on the very next request.
    authMockState.currentUser = { id: "negocio-B", type: "negocio" }
    const reconcileRes = await reconcilePOST(reqReconcile(handoffValue, subJson()))
    const body = await reconcileRes.json()

    expect(body.newSession).toBe(true)
    expect(body.staleCleanupPerformed).toBe(true)
    expect(pushRows.some((r) => r.ownerId === "negocio-A")).toBe(false) // A/X is gone
  })

  test("DELAYED (>120s TTL elapsed before the client reconciles): the real login flow mints a valid handoff, but by the time the physical/manual flow reaches reconciliation it has expired — A/X survives", async () => {
    pushRows = [{ id: "row-1", ownerType: "negocio", ownerId: "negocio-A", channel: "default", endpoint: ENDPOINT, p256dh: "p", auth: "a" }]

    // Same handoff CONTENT applyLoginCookies would have produced from A's
    // real prior session, but signed with iat/exp shifted into the past —
    // simulating that > PUSH_OWNER_HANDOFF_TTL_SECONDS (120s) elapsed
    // between the login response and the client's reconciliation call (a
    // manual physical account-switch test plausibly takes longer than 2
    // minutes: reading the next step, typing a different account's
    // credentials, waiting for the page to reload).
    const expiredHandoff = await signExpiredHandoffLikeApplyLoginCookiesWould("negocio-A")

    authMockState.currentUser = { id: "negocio-B", type: "negocio" }
    const reconcileRes = await reconcilePOST(reqReconcile(expiredHandoff, subJson()))
    const body = await reconcileRes.json()

    // This is the EXACT symptom CASE G reported: cleanup silently no-ops.
    expect(body.newSession).toBe(false)
    expect(body.staleCleanupPerformed).toBe(false)
    expect(pushRows.some((r) => r.ownerId === "negocio-A")).toBe(true) // A/X SURVIVES — reproduces the leak
  })

  test("no handoff cookie at all reaching reconcile (e.g. it was dropped/never sent): cleanup silently no-ops the same way — same symptom, different mechanism", async () => {
    pushRows = [{ id: "row-1", ownerType: "negocio", ownerId: "negocio-A", channel: "default", endpoint: ENDPOINT, p256dh: "p", auth: "a" }]
    authMockState.currentUser = { id: "negocio-B", type: "negocio" }
    const reconcileRes = await reconcilePOST(reqReconcile(undefined, subJson()))
    const body = await reconcileRes.json()
    expect(body.newSession).toBe(false)
    expect(pushRows.some((r) => r.ownerId === "negocio-A")).toBe(true)
  })
})
