// Ownership-B2 (P0 Legacy Mozo Push Unsubscribe Exact-Match Hardening):
// source-level contract for the legacy /m/[token] page's manual "Desactivar
// notificaciones" flow. Same static-contract style as
// src/lib/repartidor-tracking-static-contract.test.ts — asserts the wiring
// shape rather than rendering the full page component.
import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const source = () => readFileSync(resolve(import.meta.dir, "page.tsx"), "utf8")

describe("/m/[token] legacy push unsubscribe — exact-match ownership contract", () => {
  test("C1/C2: captures and serializes the current PushSubscription before physically unsubscribing", () => {
    const src = source()
    const start = src.indexOf("const unsubscribeFromPush")
    const end = src.indexOf("const openMenuForMesa")
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    const body = src.slice(start, end)

    const getSubscriptionIdx = body.indexOf("pushManager.getSubscription()")
    const serializeIdx = body.indexOf("JSON.stringify(subscription)")
    const unsubscribeIdx = body.indexOf("subscription.unsubscribe()")

    expect(getSubscriptionIdx).toBeGreaterThan(-1)
    expect(serializeIdx).toBeGreaterThan(-1)
    expect(unsubscribeIdx).toBeGreaterThan(-1)
    // Serialize the value BEFORE the physical unsubscribe call, so the
    // exact value sent to the server is never lost.
    expect(serializeIdx).toBeLessThan(unsubscribeIdx)
    expect(getSubscriptionIdx).toBeLessThan(serializeIdx)
  })

  test("C3/C4: sends the exact subscription to the server, no employee/negocio identity as client-supplied authority", () => {
    const src = source()
    const start = src.indexOf("const unsubscribeFromPush")
    const end = src.indexOf("const openMenuForMesa")
    const body = src.slice(start, end)

    expect(body).toContain('fetch("/api/mozo/push/unsubscribe"')
    expect(body).toContain("subscription: subscriptionJson")
    for (const forbidden of ["empleadoId", "negocioId", "cuentaOperativaId", "actorId"]) {
      expect(body).not.toContain(forbidden)
    }
  })

  test("C5: exactly one fetch call to the unsubscribe endpoint in the whole function", () => {
    const src = source()
    const start = src.indexOf("const unsubscribeFromPush")
    const end = src.indexOf("const openMenuForMesa")
    const body = src.slice(start, end)

    const fetchCount = body.split("fetch(").length - 1
    expect(fetchCount).toBe(1)
  })

  test("C6: no alternate/fallback clear call is issued regardless of the server response", () => {
    const src = source()
    const start = src.indexOf("const unsubscribeFromPush")
    const end = src.indexOf("const openMenuForMesa")
    const body = src.slice(start, end)

    // The fetch's result is never inspected to decide on a second write —
    // the flow always ends by reflecting local unsubscribed state.
    expect(body).not.toContain(".removed")
    expect(body).not.toContain("res.ok")
    expect(body).not.toContain("res.json()")
  })

  test("C7: the guarded unsubscribe() call is only ever invoked on this browser's own subscription object", () => {
    const src = source()
    const start = src.indexOf("const unsubscribeFromPush")
    const end = src.indexOf("const openMenuForMesa")
    const body = src.slice(start, end)

    expect(body).toContain("if (subscription) await subscription.unsubscribe()")
  })

  test("C8: subscribeToPush (enable flow) is untouched by this hardening", () => {
    const src = source()
    const start = src.indexOf("const subscribeToPush")
    const end = src.indexOf("const unsubscribeFromPush")
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    const body = src.slice(start, end)

    expect(body).toContain('fetch("/api/mozo/push/subscribe"')
    expect(body).toContain("subscription: JSON.stringify(subscription)")
  })
})
