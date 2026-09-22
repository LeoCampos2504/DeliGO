// P2-T40-R1 — fully isolated unit tests for POST /api/push/reconcile-stale-owner.
// No real DB, no mocked crypto: the handoff cookie is REAL-signed with
// signPushOwnerHandoff() so these tests exercise the actual verification
// path, not a stand-in. Mirrors the mock pattern already certified in
// src/app/api/push/unsubscribe/route.test.ts (H4 canonical @/lib/auth
// superset via src/lib/test-helpers/auth-mock.ts).
import { beforeEach, describe, expect, mock, test } from "bun:test"
import { NextRequest } from "next/server"
import {
  AUTH_MOCK_VALID_OPERATIONAL_TOKEN,
  AUTH_MOCK_VALID_TOKEN,
  authMockState,
  installAuthMock,
  resetAuthMockState,
} from "@/lib/test-helpers/auth-mock"

type PushRow = {
  id: string
  ownerType: string
  ownerId: string
  channel: string
  endpoint: string
  p256dh: string
  auth: string
}

let pushRows: PushRow[]
let idc = 0

function pushRow(ownerType: string, ownerId: string, endpoint: string, p256dh = "p", auth = "a"): PushRow {
  idc += 1
  return { id: `push-${idc}`, ownerType, ownerId, channel: "default", endpoint, p256dh, auth }
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

installAuthMock()

mock.module("@/lib/log-safe-error", () => ({
  safeErrorForLog: (e: unknown) => e,
}))

process.env.PUSH_OWNER_HANDOFF_SECRET = "test-secret-".repeat(3)

const { signPushOwnerHandoff } = await import("@/lib/push-owner-handoff")
const { POST } = await import("./route")

function subJson(endpoint: string, p256dh = "p", auth = "a") {
  return JSON.stringify({ endpoint, expirationTime: null, keys: { p256dh, auth } })
}

function callReconcile(opts: {
  actorFamily?: string
  cookies: Record<string, string>
  subscription?: unknown
}) {
  const cookieHeader = Object.entries(opts.cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ")
  const url = opts.actorFamily
    ? `http://localhost/api/push/reconcile-stale-owner?actorFamily=${opts.actorFamily}`
    : "http://localhost/api/push/reconcile-stale-owner"
  return POST(
    new NextRequest(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.10", cookie: cookieHeader },
      body: JSON.stringify({ subscription: opts.subscription }),
    })
  )
}

beforeEach(() => {
  pushRows = []
  idc = 0
  resetAuthMockState()
})

describe("POST /api/push/reconcile-stale-owner", () => {
  test("no session at all -> 401", async () => {
    const res = await callReconcile({ cookies: {} })
    expect(res.status).toBe(401)
  })

  test("valid session, no handoff cookie -> newSession:false, no cleanup", async () => {
    authMockState.currentUser = { id: "cliente-B", type: "cliente" }
    const res = await callReconcile({ cookies: { deligo_session: AUTH_MOCK_VALID_TOKEN } })
    const body = await res.json()
    expect(body).toEqual({ ok: true, newSession: false, staleCleanupPerformed: false })
  })

  test("STALE_PREVIOUS_OWNER_RULE: same family, different owner, exact endpoint match -> cleaned up, newSession:true", async () => {
    authMockState.currentUser = { id: "cliente-B", type: "cliente" }
    const endpoint = "https://push.example/SHARED-DEVICE"
    pushRows = [pushRow("cliente", "cliente-A", endpoint), pushRow("cliente", "cliente-B", "https://push.example/OTHER")]

    const handoff = await signPushOwnerHandoff({ family: "cliente", prevOwnerType: "cliente", prevOwnerId: "cliente-A" })
    const res = await callReconcile({
      cookies: { deligo_session: AUTH_MOCK_VALID_TOKEN, deligo_push_handoff: handoff! },
      subscription: subJson(endpoint),
    })
    const body = await res.json()

    expect(body).toEqual({ ok: true, newSession: true, staleCleanupPerformed: true })
    expect(pushRows.map((r) => r.ownerId)).toEqual(["cliente-B"]) // A's row gone, B's own row untouched
  })

  test("endpoint mismatch: prevOwner exists but physical endpoint differs -> nothing deleted (exact match required)", async () => {
    authMockState.currentUser = { id: "cliente-B", type: "cliente" }
    pushRows = [pushRow("cliente", "cliente-A", "https://push.example/OLD-DEVICE")]

    const handoff = await signPushOwnerHandoff({ family: "cliente", prevOwnerType: "cliente", prevOwnerId: "cliente-A" })
    const res = await callReconcile({
      cookies: { deligo_session: AUTH_MOCK_VALID_TOKEN, deligo_push_handoff: handoff! },
      subscription: subJson("https://push.example/DIFFERENT-DEVICE"),
    })
    const body = await res.json()

    expect(body).toEqual({ ok: true, newSession: true, staleCleanupPerformed: false })
    expect(pushRows).toHaveLength(1) // A's row on the OLD device survives untouched
  })

  test("LEGITIMATE_CROSS_FAMILY_MULTI_BIND: handoff minted for a different family is never consumed nor acted upon", async () => {
    // Two tabs raced: a cliente login minted a handoff, but THIS request is
    // authenticated as cuenta_operativa. The cuenta_operativa call must
    // never touch the cliente handoff or any cliente row.
    authMockState.currentOperationalAccount = { id: "cuenta-B" }
    const endpoint = "https://push.example/CROSS-FAMILY"
    pushRows = [pushRow("cliente", "cliente-A", endpoint), pushRow("cuenta_operativa", "cuenta-B", "https://push.example/OWN")]

    const handoff = await signPushOwnerHandoff({ family: "cliente", prevOwnerType: "cliente", prevOwnerId: "cliente-A" })
    const res = await callReconcile({
      actorFamily: "cuenta_operativa",
      cookies: { deligo_operativo_session: AUTH_MOCK_VALID_OPERATIONAL_TOKEN, deligo_push_handoff: handoff! },
      subscription: subJson(endpoint),
    })
    const body = await res.json()

    expect(body).toEqual({ ok: true, newSession: false, staleCleanupPerformed: false })
    expect(pushRows).toHaveLength(2) // nothing touched — cliente-A's row survives, mismatched family
  })

  test("same owner re-login (prevOwnerId === currentOwnerId): newSession:true but no cleanup attempted", async () => {
    authMockState.currentUser = { id: "cliente-A", type: "cliente" }
    const endpoint = "https://push.example/SAME-OWNER"
    pushRows = [pushRow("cliente", "cliente-A", endpoint)]

    const handoff = await signPushOwnerHandoff({ family: "cliente", prevOwnerType: "cliente", prevOwnerId: "cliente-A" })
    const res = await callReconcile({
      cookies: { deligo_session: AUTH_MOCK_VALID_TOKEN, deligo_push_handoff: handoff! },
      subscription: subJson(endpoint),
    })
    const body = await res.json()

    expect(body).toEqual({ ok: true, newSession: true, staleCleanupPerformed: false })
    expect(pushRows).toHaveLength(1) // own row never deleted by this endpoint
  })

  test("prevOwner null (fresh device / explicit logout before login): newSession:true, no cleanup, no crash", async () => {
    authMockState.currentUser = { id: "cliente-B", type: "cliente" }
    const handoff = await signPushOwnerHandoff({ family: "cliente", prevOwnerType: null, prevOwnerId: null })
    const res = await callReconcile({
      cookies: { deligo_session: AUTH_MOCK_VALID_TOKEN, deligo_push_handoff: handoff! },
      subscription: null,
    })
    const body = await res.json()
    expect(body).toEqual({ ok: true, newSession: true, staleCleanupPerformed: false })
  })

  test("tampered handoff cookie is treated as absent — no crash, no false cleanup", async () => {
    authMockState.currentUser = { id: "cliente-B", type: "cliente" }
    pushRows = [pushRow("cliente", "cliente-A", "https://push.example/X")]
    const res = await callReconcile({
      cookies: { deligo_session: AUTH_MOCK_VALID_TOKEN, deligo_push_handoff: "not-a-real-jwt" },
      subscription: subJson("https://push.example/X"),
    })
    const body = await res.json()
    expect(body).toEqual({ ok: true, newSession: false, staleCleanupPerformed: false })
    expect(pushRows).toHaveLength(1)
  })

  test("client cannot supply an arbitrary previous owner — only the value inside the server-signed handoff is ever used", async () => {
    // No handoff cookie at all: even if a hypothetical attacker could shape
    // the request body, there is no field this route reads to specify a
    // "previous owner" — the only source is the signed cookie.
    authMockState.currentUser = { id: "cliente-B", type: "cliente" }
    pushRows = [pushRow("cliente", "cliente-A", "https://push.example/X")]
    const res = await callReconcile({
      cookies: { deligo_session: AUTH_MOCK_VALID_TOKEN },
      subscription: subJson("https://push.example/X"),
    })
    const body = await res.json()
    expect(body.staleCleanupPerformed).toBe(false)
    expect(pushRows).toHaveLength(1)
  })

  test("idempotent replay: calling reconcile twice with the same (now-consumed) handoff only cleans up once", async () => {
    authMockState.currentUser = { id: "cliente-B", type: "cliente" }
    const endpoint = "https://push.example/REPLAY"
    pushRows = [pushRow("cliente", "cliente-A", endpoint)]
    const handoff = await signPushOwnerHandoff({ family: "cliente", prevOwnerType: "cliente", prevOwnerId: "cliente-A" })

    const first = await callReconcile({
      cookies: { deligo_session: AUTH_MOCK_VALID_TOKEN, deligo_push_handoff: handoff! },
      subscription: subJson(endpoint),
    })
    expect((await first.json()).staleCleanupPerformed).toBe(true)
    expect(pushRows).toHaveLength(0)

    // Second call still presents the SAME handoff value (simulating a client
    // that didn't yet see the Set-Cookie clearing it) — deleteMany on an
    // already-empty match is a safe no-op, never an error.
    const second = await callReconcile({
      cookies: { deligo_session: AUTH_MOCK_VALID_TOKEN, deligo_push_handoff: handoff! },
      subscription: subJson(endpoint),
    })
    const secondBody = await second.json()
    expect(secondBody.staleCleanupPerformed).toBe(false)
  })
})
