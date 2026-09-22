// P2-T40-R1 — focused unit test of applyLoginCookies() (STALE_PREVIOUS_OWNER_RULE
// handoff-minting), isolated from login/route.ts's unrelated dependencies
// (rate limiting, account throttle, device identity, password hashing) by
// mocking only what this one function actually touches: @/lib/auth's
// session-cookie helpers. Real handoff signing/verification (not mocked) —
// exercises the actual jose round-trip.
import { beforeEach, describe, expect, test } from "bun:test"
import { NextRequest, NextResponse } from "next/server"
import { authMockState, installAuthMock, resetAuthMockState } from "@/lib/test-helpers/auth-mock"

// H4 canonical superset (see src/lib/test-helpers/auth-mock.ts) — avoids the
// cross-file `mock.module("@/lib/auth", ...)` collision that a narrower,
// file-local mock would cause when this file runs in the same `bun test`
// invocation as the push/* route tests.
installAuthMock()

process.env.PUSH_OWNER_HANDOFF_SECRET = "apply-login-cookies-test-secret-".repeat(2)

const { verifyPushOwnerHandoff } = await import("@/lib/push-owner-handoff")
const { applyLoginCookies } = await import("./route")

function reqWithCookie(family: string, token: string | null): NextRequest {
  const cookie = token ? `deligo_session_${family}=${token}` : ""
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: cookie ? { cookie } : {},
  })
}

async function handoffFromResponse(res: NextResponse) {
  const token = res.cookies.get("deligo_push_handoff")?.value
  return verifyPushOwnerHandoff(token)
}

beforeEach(() => {
  resetAuthMockState()
})

describe("applyLoginCookies — STALE_PREVIOUS_OWNER_RULE handoff", () => {
  test("no previous cookie at all (fresh device / after explicit logout): handoff still minted, prevOwner null", async () => {
    const req = reqWithCookie("cliente", null)
    const res = NextResponse.json({ ok: true })
    await applyLoginCookies(req, res, "new-token", "cliente", "cliente-B")

    expect(res.cookies.get("deligo_session_cliente")?.value).toBe("new-token")
    const claims = await handoffFromResponse(res)
    expect(claims?.family).toBe("cliente")
    expect(claims?.prevOwnerType).toBeNull()
    expect(claims?.prevOwnerId).toBeNull()
  })

  test("previous cookie present, DIFFERENT owner (same-family replacement): handoff carries the exact previous owner", async () => {
    authMockState.sesionByToken.set("old-token", { token: "old-token", userId: "cliente-A", userType: "cliente", expiresAt: new Date(Date.now() + 3600_000) })
    const req = reqWithCookie("cliente", "old-token")
    const res = NextResponse.json({ ok: true })
    await applyLoginCookies(req, res, "new-token", "cliente", "cliente-B")

    const claims = await handoffFromResponse(res)
    expect(claims?.family).toBe("cliente")
    expect(claims?.prevOwnerType).toBe("cliente")
    expect(claims?.prevOwnerId).toBe("cliente-A")
  })

  test("previous cookie present but ALREADY EXPIRED: prevOwner is still surfaced (findSesionByToken never filters by expiresAt — the same-slot replacement risk exists regardless of TTL vs direct re-login)", async () => {
    authMockState.sesionByToken.set("old-token", { token: "old-token", userId: "cliente-A", userType: "cliente", expiresAt: new Date(Date.now() - 3600_000) })
    const req = reqWithCookie("cliente", "old-token")
    const res = NextResponse.json({ ok: true })
    await applyLoginCookies(req, res, "new-token", "cliente", "cliente-B")

    const claims = await handoffFromResponse(res)
    expect(claims?.prevOwnerId).toBe("cliente-A")
  })

  test("same owner re-logging in (re-login after explicit logout, same account): prevOwner is never itself", async () => {
    authMockState.sesionByToken.set("old-token", { token: "old-token", userId: "cliente-A", userType: "cliente", expiresAt: new Date(Date.now() + 3600_000) })
    const req = reqWithCookie("cliente", "old-token")
    const res = NextResponse.json({ ok: true })
    await applyLoginCookies(req, res, "new-token", "cliente", "cliente-A")

    const claims = await handoffFromResponse(res)
    expect(claims?.prevOwnerType).toBeNull()
    expect(claims?.prevOwnerId).toBeNull()
  })

  test("a session row of a DIFFERENT userType than the family being replaced is never surfaced as prevOwner (defense in depth against a corrupted/mismatched row)", async () => {
    authMockState.sesionByToken.set("old-token", { token: "old-token", userId: "negocio-X", userType: "negocio", expiresAt: new Date(Date.now() + 3600_000) })
    const req = reqWithCookie("cliente", "old-token")
    const res = NextResponse.json({ ok: true })
    await applyLoginCookies(req, res, "new-token", "cliente", "cliente-B")

    const claims = await handoffFromResponse(res)
    expect(claims?.prevOwnerType).toBeNull()
    expect(claims?.prevOwnerId).toBeNull()
  })

  test("never blocks on a missing PUSH_OWNER_HANDOFF_SECRET — cookie is set, handoff is simply omitted", async () => {
    const saved = process.env.PUSH_OWNER_HANDOFF_SECRET
    delete process.env.PUSH_OWNER_HANDOFF_SECRET
    try {
      const req = reqWithCookie("cliente", null)
      const res = NextResponse.json({ ok: true })
      await applyLoginCookies(req, res, "new-token", "cliente", "cliente-B")
      expect(res.cookies.get("deligo_session_cliente")?.value).toBe("new-token")
      expect(res.cookies.get("deligo_push_handoff")).toBeUndefined()
    } finally {
      process.env.PUSH_OWNER_HANDOFF_SECRET = saved
    }
  })
})
