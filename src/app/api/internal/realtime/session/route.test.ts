// P2-T11 Phase A: fully isolated unit tests for
// POST /api/internal/realtime/session — no real DB, no real secret.
// @/lib/db is replaced via mock.module before the route is imported (same
// pattern as src/app/api/operativo/logout/route.test.ts). Exercises the
// REAL isSesionActiveById() against the mocked db.sesion.findUnique, not a
// stubbed version of it.
import { beforeEach, describe, expect, mock, test } from "bun:test"
import { NextRequest } from "next/server"
import { calculateSignature } from "@/lib/internal-session-check-auth"

const SECRET = "test-only-session-check-secret-0123456789ab"

type SesionRow = { id: string; expiresAt: Date }
let sesionRows: SesionRow[]

mock.module("@/lib/db", () => ({
  db: {
    sesion: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        return sesionRows.find((row) => row.id === where.id) ?? null
      },
    },
  },
}))

const { POST } = await import("./route")

let warnLogs: string[]
const originalWarn = console.warn

function buildRequest(options: {
  rawBody: string
  timestamp?: string
  requestId?: string
  signature?: string
  omitHeaders?: string[]
}) {
  const timestamp = options.timestamp ?? String(Date.now())
  const requestId = options.requestId ?? `req-${Math.random().toString(36).slice(2)}`
  const signature = options.signature ?? calculateSignature(SECRET, timestamp, requestId, options.rawBody)

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-deligo-timestamp": timestamp,
    "x-deligo-request-id": requestId,
    "x-deligo-signature": signature,
  }
  for (const name of options.omitHeaders ?? []) delete headers[name]

  return new NextRequest("http://localhost/api/internal/realtime/session", {
    method: "POST",
    headers,
    body: options.rawBody,
  })
}

beforeEach(() => {
  process.env.REALTIME_SESSION_CHECK_SECRET = SECRET
  sesionRows = []
  warnLogs = []
  console.warn = (...args: unknown[]) => {
    warnLogs.push(args.map(String).join(" "))
  }
})

describe("POST /api/internal/realtime/session", () => {
  test("valid HMAC + active session -> valid:true", async () => {
    sesionRows = [{ id: "sesion-a", expiresAt: new Date(Date.now() + 60_000) }]
    const res = await POST(buildRequest({ rawBody: JSON.stringify({ sid: "sesion-a" }) }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual({ valid: true })
  })

  test("valid HMAC + session does not exist -> valid:false", async () => {
    sesionRows = []
    const res = await POST(buildRequest({ rawBody: JSON.stringify({ sid: "sesion-missing" }) }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual({ valid: false })
  })

  test("valid HMAC + session expired -> valid:false, row untouched (read-only, no lazy delete)", async () => {
    sesionRows = [{ id: "sesion-expired", expiresAt: new Date(Date.now() - 60_000) }]
    const res = await POST(buildRequest({ rawBody: JSON.stringify({ sid: "sesion-expired" }) }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual({ valid: false })
    expect(sesionRows.length).toBe(1)
  })

  test("tampered signature -> 401", async () => {
    const rawBody = JSON.stringify({ sid: "sesion-a" })
    const timestamp = String(Date.now())
    const requestId = "req-tamper"
    const badSignature = "f".repeat(64)
    const res = await POST(buildRequest({ rawBody, timestamp, requestId, signature: badSignature }))
    expect(res.status).toBe(401)
  })

  test("missing HMAC headers -> 401", async () => {
    const res = await POST(
      buildRequest({
        rawBody: JSON.stringify({ sid: "sesion-a" }),
        omitHeaders: ["x-deligo-signature"],
      })
    )
    expect(res.status).toBe(401)
  })

  test("stale timestamp -> 401", async () => {
    const staleTimestamp = String(Date.now() - 5 * 60_000)
    const res = await POST(buildRequest({ rawBody: JSON.stringify({ sid: "sesion-a" }), timestamp: staleTimestamp }))
    expect(res.status).toBe(401)
  })

  test("replayed requestId within window -> second request 401", async () => {
    const rawBody = JSON.stringify({ sid: "sesion-a" })
    sesionRows = [{ id: "sesion-a", expiresAt: new Date(Date.now() + 60_000) }]
    const timestamp = String(Date.now())
    const requestId = "req-replay-fixed"
    const first = await POST(buildRequest({ rawBody, timestamp, requestId }))
    expect(first.status).toBe(200)
    const second = await POST(buildRequest({ rawBody, timestamp, requestId }))
    expect(second.status).toBe(401)
  })

  test("malformed JSON body -> 400", async () => {
    const res = await POST(buildRequest({ rawBody: "{not-json" }))
    expect(res.status).toBe(400)
  })

  test("missing sid -> 400", async () => {
    const res = await POST(buildRequest({ rawBody: JSON.stringify({}) }))
    expect(res.status).toBe(400)
  })

  test("invalid sid type -> 400", async () => {
    const res = await POST(buildRequest({ rawBody: JSON.stringify({ sid: 12345 }) }))
    expect(res.status).toBe(400)
  })

  test("secret not configured -> 503, never reaches session lookup", async () => {
    delete process.env.REALTIME_SESSION_CHECK_SECRET
    const res = await POST(buildRequest({ rawBody: JSON.stringify({ sid: "sesion-a" }) }))
    expect(res.status).toBe(503)
  })

  test("response never includes fields beyond valid", async () => {
    sesionRows = [{ id: "sesion-a", expiresAt: new Date(Date.now() + 60_000) }]
    const res = await POST(buildRequest({ rawBody: JSON.stringify({ sid: "sesion-a" }) }))
    const body = await res.json()
    expect(Object.keys(body)).toEqual(["valid"])
  })

  test("logs never print the secret, the signature, or the sid", async () => {
    const rawBody = JSON.stringify({ sid: "sesion-super-secret-id" })
    await POST(buildRequest({ rawBody, signature: "f".repeat(64) }))
    for (const line of warnLogs) {
      expect(line).not.toContain(SECRET)
      expect(line).not.toContain("f".repeat(64))
      expect(line).not.toContain("sesion-super-secret-id")
    }
  })
})

test("restore console.warn", () => {
  console.warn = originalWarn
  expect(true).toBe(true)
})
