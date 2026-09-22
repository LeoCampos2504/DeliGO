// P2-T40-R1 — focused unit test of applyOperationalLoginCookies()
// (STALE_PREVIOUS_OWNER_RULE handoff-minting for CuentaOperativa), mirroring
// src/app/api/auth/login/apply-login-cookies.test.ts. Mocks only what this
// function and its module's import graph actually need.
import { beforeEach, describe, expect, mock, test } from "bun:test"
import { NextRequest, NextResponse } from "next/server"
import { authMockState, installAuthMock, resetAuthMockState } from "@/lib/test-helpers/auth-mock"

// H4 canonical superset — see src/app/api/auth/login/apply-login-cookies.test.ts
// for why this must be the shared mock, never a file-local one.
installAuthMock()

mock.module("@/lib/db", () => ({ db: {} }))

process.env.PUSH_OWNER_HANDOFF_SECRET = "apply-operational-login-cookies-test-".repeat(2)

const { verifyPushOwnerHandoff } = await import("@/lib/push-owner-handoff")
const { applyOperationalLoginCookies } = await import("./route")

function reqWithCookie(token: string | null): NextRequest {
  return new NextRequest("http://localhost/api/operativo/login", {
    method: "POST",
    headers: token ? { cookie: `deligo_operativo_session=${token}` } : {},
  })
}

async function handoffFromResponse(res: NextResponse) {
  const token = res.cookies.get("deligo_push_handoff")?.value
  return verifyPushOwnerHandoff(token)
}

beforeEach(() => {
  resetAuthMockState()
})

describe("applyOperationalLoginCookies — STALE_PREVIOUS_OWNER_RULE handoff (CuentaOperativa)", () => {
  test("no previous cookie: handoff minted, prevOwner null", async () => {
    const req = reqWithCookie(null)
    const res = NextResponse.json({ ok: true })
    await applyOperationalLoginCookies(req, res, "new-token", "cuenta-B")

    expect(res.cookies.get("deligo_operativo_session")?.value).toBe("new-token")
    const claims = await handoffFromResponse(res)
    expect(claims?.family).toBe("cuenta_operativa")
    expect(claims?.prevOwnerType).toBeNull()
    expect(claims?.prevOwnerId).toBeNull()
  })

  test("previous cookie, different CuentaOperativa (shared tablet between shifts): handoff carries the exact previous owner", async () => {
    authMockState.sesionByToken.set("old-token", { token: "old-token", userId: "cuenta-A", userType: "cuenta_operativa", expiresAt: new Date(Date.now() + 3600_000) })
    const req = reqWithCookie("old-token")
    const res = NextResponse.json({ ok: true })
    await applyOperationalLoginCookies(req, res, "new-token", "cuenta-B")

    const claims = await handoffFromResponse(res)
    expect(claims?.prevOwnerType).toBe("cuenta_operativa")
    expect(claims?.prevOwnerId).toBe("cuenta-A")
  })

  test("same CuentaOperativa re-logging in: prevOwner is never itself", async () => {
    authMockState.sesionByToken.set("old-token", { token: "old-token", userId: "cuenta-A", userType: "cuenta_operativa", expiresAt: new Date(Date.now() + 3600_000) })
    const req = reqWithCookie("old-token")
    const res = NextResponse.json({ ok: true })
    await applyOperationalLoginCookies(req, res, "new-token", "cuenta-A")

    const claims = await handoffFromResponse(res)
    expect(claims?.prevOwnerType).toBeNull()
    expect(claims?.prevOwnerId).toBeNull()
  })

  test("a previous session of a different userType (defense in depth) is never surfaced as prevOwner", async () => {
    authMockState.sesionByToken.set("old-token", { token: "old-token", userId: "cliente-X", userType: "cliente", expiresAt: new Date(Date.now() + 3600_000) })
    const req = reqWithCookie("old-token")
    const res = NextResponse.json({ ok: true })
    await applyOperationalLoginCookies(req, res, "new-token", "cuenta-B")

    const claims = await handoffFromResponse(res)
    expect(claims?.prevOwnerType).toBeNull()
    expect(claims?.prevOwnerId).toBeNull()
  })
})
