import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

// P2-T23-H2 (§18/§23): static-contract test mirroring the pattern already
// used for use-repartidor-tracking.ts's own contract and for
// delivery-tracking-map-stale-contract.test.ts — this component mounts a
// real Leaflet instance and is not unit-mounted anywhere in this repo, so
// the resync WIRING is verified by source inspection, exactly like chat's
// own contract (chat-consumer-static-contract.test.ts) verifies the
// analogous client.registerResync pattern there.
const source = readFileSync(
  resolve(import.meta.dir, "delivery-tracking-map.tsx"),
  "utf8"
)

describe("DeliveryTrackingMap realtime resync wiring contract (P2-T23-H2)", () => {
  test("registers client.registerResync and unregisters it on cleanup", () => {
    expect(source).toContain("client.registerResync(")
    const start = source.indexOf("const unregisterResync = client.registerResync(")
    expect(start).toBeGreaterThan(-1)
    const cleanupWindow = source.slice(start, start + 300)
    expect(cleanupWindow).toContain("return () => {")
    expect(cleanupWindow).toContain("unregisterResync()")
  })

  test("the resync callback always calls the CURRENT fetchTracking (via a ref, never a stale closure)", () => {
    expect(source).toContain("const fetchTrackingRef = useRef(fetchTracking)")
    expect(source).toContain("fetchTrackingRef.current = fetchTracking")
    const start = source.indexOf("const unregisterResync = client.registerResync(")
    const end = source.indexOf("unregisterResync()")
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    const registrationBlock = source.slice(start, end)
    expect(registrationBlock).toContain("fetchTrackingRef.current()")
  })

  test("resync registration is scoped to the current pedidoId (effect deps include pedidoId, remounts per pedido switch)", () => {
    const start = source.indexOf("const unregisterResync = client.registerResync(")
    const afterBlock = source.slice(start, start + 400)
    expect(afterBlock).toContain("}, [open, pedidoId, client])")
  })

  test("resync registration never re-acquires or duplicates the tracking:watch room lease — it is a separate effect from acquireOrderRoom", () => {
    const resyncStart = source.indexOf("const unregisterResync = client.registerResync(")
    const resyncEnd = source.indexOf("}, [open, pedidoId, client])", resyncStart)
    expect(resyncStart).toBeGreaterThan(-1)
    const resyncEffectBody = source.slice(resyncStart, resyncEnd)
    expect(resyncEffectBody).not.toContain("acquireOrderRoom")
    expect(resyncEffectBody).not.toContain("client.subscribe(")
  })

  test("resync registration never introduces its own polling timer — no setInterval/setTimeout in that effect", () => {
    const resyncStart = source.indexOf("const unregisterResync = client.registerResync(")
    const resyncEnd = source.indexOf("}, [open, pedidoId, client])", resyncStart)
    const resyncEffectBody = source.slice(resyncStart, resyncEnd)
    expect(resyncEffectBody).not.toContain("setInterval")
    expect(resyncEffectBody).not.toContain("setTimeout")
  })

  test("mirrors the same registerResync pattern already used by chat-view.tsx (consistency across this repo's realtime consumers)", () => {
    const chatSource = readFileSync(
      resolve(import.meta.dir, "..", "chat", "chat-view.tsx"),
      "utf8"
    )
    expect(chatSource).toContain("client.registerResync(")
    expect(source).toContain("client.registerResync(")
  })
})
