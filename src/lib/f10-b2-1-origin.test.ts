/// <reference types="bun-types" />

// ============================================
// F10-B2.1 — origin protection of the new register/shift mutations (proxy, no DB)
// ============================================
// Owner routes live under /api/negocio/caja (protected since F10-B2.0) and the
// cashier shift route under /api/operativo (protected before F10). Cross-origin
// or origin-less mutations → 403 before any handler; same-origin passes; reads
// are not origin-checked.

import { describe, expect, test } from "bun:test"
import { NextRequest } from "next/server"
import { proxy } from "@/proxy"

const owner = `deligo_session_negocio=${crypto.randomUUID()}`
const cashier = `deligo_operativo_session=${crypto.randomUUID()}`

function req(path: string, method: string, cookie: string, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost${path}`, { method, headers: { cookie, ...headers }, body: method === "GET" ? undefined : "{}" })
}
async function originBlocked(res: Response) {
  if (res.status !== 403) return false
  return ((await res.clone().json().catch(() => ({}))) as { error?: string }).error === "Origen no permitido"
}

const MUTATIONS: Array<[string, string, string]> = [
  ["/api/negocio/caja/cajas", "POST", owner],
  ["/api/negocio/caja/cajas/abc", "PATCH", owner],
  ["/api/negocio/caja/turnos", "POST", owner],
  ["/api/operativo/caja/kiosco/turno", "POST", cashier],
]

describe("F10-B2.1 — register/shift mutations are origin-protected", () => {
  for (const [path, method, cookie] of MUTATIONS) {
    test(`${method} ${path}: cross-origin → 403, no origin → 403, same-origin passes`, async () => {
      expect(await originBlocked(proxy(req(path, method, cookie, { origin: "https://evil.example" })))).toBe(true)
      expect(await originBlocked(proxy(req(path, method, cookie)))).toBe(true)
      expect(await originBlocked(proxy(req(path, method, cookie, { origin: "http://localhost" })))).toBe(false)
    })
  }

  test("reads are not origin-checked", async () => {
    expect(await originBlocked(proxy(req("/api/negocio/caja/turnos", "GET", owner, { origin: "https://evil.example" })))).toBe(false)
    expect(await originBlocked(proxy(req("/api/operativo/caja/kiosco/turno", "GET", cashier, { origin: "https://evil.example" })))).toBe(false)
  })
})
