/// <reference types="bun-types" />

// ============================================
// F10-B2.0 — origin protection of the owner Caja routes (proxy, no DB)
// ============================================
// /api/negocio/caja joins the EXISTING validateMutationOrigin allowlist
// (NEGOCIO_ORIGIN_PROTECTED_PREFIXES). Same policy as every other protected
// owner route: a mutating request needs an allowed Origin (or Referer);
// cross-origin and origin-less mutations → 403 before the handler. Reads are
// unaffected; the cashier route was already covered by "/api/operativo".

import { describe, expect, test } from "bun:test"
import { NextRequest } from "next/server"
import { proxy } from "@/proxy"

const NEGOCIO_COOKIE = "deligo_session_negocio"
const CUENTA_OPERATIVA_COOKIE = "deligo_operativo_session"

function req(path: string, init: { method?: string; headers?: Record<string, string>; cookie?: string } = {}) {
  return new NextRequest(`http://localhost${path}`, {
    method: init.method ?? "GET",
    headers: { ...(init.cookie ? { cookie: init.cookie } : {}), ...(init.headers ?? {}) },
    body: init.method && init.method !== "GET" ? "{}" : undefined,
  })
}

async function originBlocked(res: Response) {
  if (res.status !== 403) return false
  const body = await res.clone().json().catch(() => ({}))
  return (body as { error?: string }).error === "Origen no permitido"
}

const owner = `${NEGOCIO_COOKIE}=${crypto.randomUUID()}`
const cashier = `${CUENTA_OPERATIVA_COOKIE}=${crypto.randomUUID()}`

describe("F10-B2.0 — owner Caja origin protection", () => {
  test("legitimate same-origin owner checkout passes the proxy (handler decides auth)", async () => {
    const res = proxy(req("/api/negocio/caja/ventas", { method: "POST", cookie: owner, headers: { origin: "http://localhost" } }))
    expect(await originBlocked(res)).toBe(false)
  })

  test("same-origin Referer (no Origin header) also passes, like the rest of the panel", async () => {
    const res = proxy(req("/api/negocio/caja/ventas", { method: "POST", cookie: owner, headers: { referer: "http://localhost/negocio" } }))
    expect(await originBlocked(res)).toBe(false)
  })

  test("cross-origin POST → 403 Origen no permitido (never reaches the sale engine)", async () => {
    const res = proxy(req("/api/negocio/caja/ventas", { method: "POST", cookie: owner, headers: { origin: "https://evil.example" } }))
    expect(await originBlocked(res)).toBe(true)
  })

  test("cross-origin via Referer only → 403", async () => {
    const res = proxy(req("/api/negocio/caja/ventas", { method: "POST", cookie: owner, headers: { referer: "https://evil.example/x" } }))
    expect(await originBlocked(res)).toBe(true)
  })

  test("mutation without Origin and without Referer → 403 (DeliGO's existing policy)", async () => {
    const res = proxy(req("/api/negocio/caja/ventas", { method: "POST", cookie: owner }))
    expect(await originBlocked(res)).toBe(true)
  })

  test("reads are not origin-checked (GET summary keeps working; auth still in the handler)", async () => {
    const res = proxy(req("/api/negocio/caja/ventas", { cookie: owner, headers: { origin: "https://evil.example" } }))
    expect(await originBlocked(res)).toBe(false)
  })

  test("no session at all → still rejected (401 by the soft auth before origin)", () => {
    const res = proxy(req("/api/negocio/caja/ventas", { method: "POST", headers: { origin: "http://localhost" } }))
    expect(res.status).toBe(401)
  })

  test("cashier route keeps its protection: cross-origin → 403, same-origin passes", async () => {
    const bad = proxy(req("/api/operativo/caja/kiosco/ventas", { method: "POST", cookie: cashier, headers: { origin: "https://evil.example" } }))
    expect(await originBlocked(bad)).toBe(true)
    const ok = proxy(req("/api/operativo/caja/kiosco/ventas", { method: "POST", cookie: cashier, headers: { origin: "http://localhost" } }))
    expect(await originBlocked(ok)).toBe(false)
  })

  test("previously protected owner routes unchanged (productos cross-origin → 403)", async () => {
    const res = proxy(req("/api/negocio/productos", { method: "POST", cookie: owner, headers: { origin: "https://evil.example" } }))
    expect(await originBlocked(res)).toBe(true)
  })
})
