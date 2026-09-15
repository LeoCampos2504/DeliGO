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
    // P2-T23-H3B added a witness-only call inside the resync callback, so a
    // fixed byte window is no longer a safe bound here — search up to the
    // effect's own dependency array close, the same anchor tests below use.
    const end = source.indexOf("}, [open, pedidoId, client])", start)
    expect(end).toBeGreaterThan(start)
    const cleanupWindow = source.slice(start, end)
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
    expect(start).toBeGreaterThan(-1)
    // A plain positive toContain check — no fixed byte window needed (a
    // future witness-only addition inside this effect, like P2-T23-H3B's,
    // must not silently fall outside a magic-number slice).
    const afterBlock = source.slice(start)
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
