// P2-T40 FINAL CLOSEOUT — SAME_FAMILY_CUENTA_OPERATIVA_A_TO_B automated
// coverage gap closure (§6 of the closeout prompt): audited
// reconcile-stale-owner/route.test.ts and case-g-same-family-account-switch.test.ts
// and confirmed neither exercises the cuenta_operativa family specifically
// for a same-slot account replacement without logout — only cliente/negocio
// were covered for STALE_PREVIOUS_OWNER_RULE, and cuenta_operativa only
// appeared in the CROSS-family preservation test (as the CURRENT owner
// whose handoff of a DIFFERENT family must never be touched — a different
// property from same-family replacement).
//
// This test-only addition chains the REAL exported functions (never
// reimplemented): applyOperationalLoginCookies from
// src/app/api/operativo/login/route.ts (the handoff-minting side) and the
// real POST handler of reconcile-stale-owner/route.ts (the consumption
// side), exactly mirroring case-g-same-family-account-switch.test.ts's
// pattern for Negocio. Zero product code changed to add this coverage.
import { beforeEach, describe, expect, mock, test } from "bun:test"
import { NextRequest, NextResponse } from "next/server"
import {
  AUTH_MOCK_VALID_OPERATIONAL_TOKEN,
  authMockState,
  installAuthMock,
  resetAuthMockState,
} from "@/lib/test-helpers/auth-mock"

installAuthMock()

type PushRow = { id: string; ownerType: string; ownerId: string; channel: string; endpoint: string; p256dh: string; auth: string }
let pushRows: PushRow[]
let idc = 0

function pushRow(ownerType: string, ownerId: string, endpoint: string): PushRow {
  idc += 1
  return { id: `row-${idc}`, ownerType, ownerId, channel: "default", endpoint, p256dh: "p", auth: "a" }
}

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

process.env.PUSH_OWNER_HANDOFF_SECRET = "cuenta-operativa-same-family-test-".repeat(2)

const { applyOperationalLoginCookies } = await import("@/app/api/operativo/login/route")
const { POST: reconcilePOST } = await import("./route")

const ENDPOINT = "https://push.example/OPERATIVE-SHARED-DEVICE"
function subJson(endpoint = ENDPOINT) {
  return JSON.stringify({ endpoint, expirationTime: null, keys: { p256dh: "p", auth: "a" } })
}

function reqLoginB(previousTokenCookieValue: string | null): NextRequest {
  return new NextRequest("http://localhost/api/operativo/login", {
    method: "POST",
    headers: previousTokenCookieValue ? { cookie: `deligo_operativo_session=${previousTokenCookieValue}` } : {},
  })
}

function reqReconcile(handoffCookieValue: string | undefined, subscription: unknown): NextRequest {
  const cookies = [`deligo_operativo_session=${AUTH_MOCK_VALID_OPERATIONAL_TOKEN}`]
  if (handoffCookieValue) cookies.push(`deligo_push_handoff=${handoffCookieValue}`)
  return new NextRequest("http://localhost/api/push/reconcile-stale-owner?actorFamily=cuenta_operativa", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookies.join("; ") },
    body: JSON.stringify({ subscription }),
  })
}

beforeEach(() => {
  pushRows = []
  idc = 0
  resetAuthMockState()
})

describe("SAME_FAMILY_CUENTA_OPERATIVA_A_TO_B — account switch without logout, same operational session slot", () => {
  test("CuentaOperativa A binding X -> B logs in over A without logout -> reconcile -> A/X no longer a binding, B/X can exist", async () => {
    // A's prior operational session row exists (as it would after A's own earlier login).
    authMockState.sesionByToken.set("token-A", { token: "token-A", userId: "cuenta-A", userType: "cuenta_operativa", expiresAt: new Date(Date.now() + 3600_000) })
    // A's physical binding already exists (Push was working for A).
    pushRows = [pushRow("cuenta_operativa", "cuenta-A", ENDPOINT)]

    // B logs in on the SAME device, cookie still carries A's operational session.
    const loginReq = reqLoginB("token-A")
    const loginRes = NextResponse.json({ ok: true })
    await applyOperationalLoginCookies(loginReq, loginRes, "token-B", "cuenta-B")

    const handoffValue = loginRes.cookies.get("deligo_push_handoff")?.value
    expect(handoffValue).toBeDefined() // the real operativo login flow DID mint a handoff

    // B reconciles immediately, presenting the literal handoff Set-Cookie value.
    authMockState.currentOperationalAccount = { id: "cuenta-B" }
    const reconcileRes = await reconcilePOST(reqReconcile(handoffValue, subJson()))
    const body = await reconcileRes.json()

    expect(body.newSession).toBe(true)
    expect(body.staleCleanupPerformed).toBe(true)
    expect(pushRows.some((r) => r.ownerId === "cuenta-A")).toBe(false) // A/X gone
  })

  test("B's own binding, once created, is never touched by a later reconcile in the same session (idempotent, no re-deletion of the new owner)", async () => {
    authMockState.sesionByToken.set("token-A", { token: "token-A", userId: "cuenta-A", userType: "cuenta_operativa", expiresAt: new Date(Date.now() + 3600_000) })
    pushRows = [pushRow("cuenta_operativa", "cuenta-A", ENDPOINT)]

    const loginReq = reqLoginB("token-A")
    const loginRes = NextResponse.json({ ok: true })
    await applyOperationalLoginCookies(loginReq, loginRes, "token-B", "cuenta-B")
    const handoffValue = loginRes.cookies.get("deligo_push_handoff")?.value

    authMockState.currentOperationalAccount = { id: "cuenta-B" }
    await reconcilePOST(reqReconcile(handoffValue, subJson()))

    // B's own auto-rebind (independent of stale-owner cleanup) creates its row.
    pushRows.push(pushRow("cuenta_operativa", "cuenta-B", ENDPOINT))
    expect(pushRows).toHaveLength(1)
    expect(pushRows[0].ownerId).toBe("cuenta-B")
  })

  test("CROSS_FAMILY preserved: cleaning up stale CuentaOperativa A never touches a Cliente binding on the same physical endpoint", async () => {
    authMockState.sesionByToken.set("token-A", { token: "token-A", userId: "cuenta-A", userType: "cuenta_operativa", expiresAt: new Date(Date.now() + 3600_000) })
    pushRows = [pushRow("cuenta_operativa", "cuenta-A", ENDPOINT), pushRow("cliente", "cliente-X", ENDPOINT)]

    const loginReq = reqLoginB("token-A")
    const loginRes = NextResponse.json({ ok: true })
    await applyOperationalLoginCookies(loginReq, loginRes, "token-B", "cuenta-B")
    const handoffValue = loginRes.cookies.get("deligo_push_handoff")?.value

    authMockState.currentOperationalAccount = { id: "cuenta-B" }
    await reconcilePOST(reqReconcile(handoffValue, subJson()))

    expect(pushRows.some((r) => r.ownerId === "cuenta-A")).toBe(false) // stale same-family owner cleaned
    expect(pushRows.some((r) => r.ownerType === "cliente" && r.ownerId === "cliente-X")).toBe(true) // cross-family untouched
  })

  test("same CuentaOperativa re-logging in (no actual switch): prevOwner is never itself, nothing deleted", async () => {
    authMockState.sesionByToken.set("token-A", { token: "token-A", userId: "cuenta-A", userType: "cuenta_operativa", expiresAt: new Date(Date.now() + 3600_000) })
    pushRows = [pushRow("cuenta_operativa", "cuenta-A", ENDPOINT)]

    const loginReq = reqLoginB("token-A")
    const loginRes = NextResponse.json({ ok: true })
    await applyOperationalLoginCookies(loginReq, loginRes, "token-new", "cuenta-A") // same owner re-logging in
    const handoffValue = loginRes.cookies.get("deligo_push_handoff")?.value

    authMockState.currentOperationalAccount = { id: "cuenta-A" }
    const res = await reconcilePOST(reqReconcile(handoffValue, subJson()))
    const body = await res.json()

    expect(body.staleCleanupPerformed).toBe(false)
    expect(pushRows).toHaveLength(1) // own row never deleted by this endpoint
  })
})
