import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const fromSrc = (relativePath: string) => resolve(import.meta.dir, "..", relativePath)
const trackingMap = () => readFileSync(fromSrc("components/tracking/delivery-tracking-map.tsx"), "utf8")

describe("Shared realtime client Tracking consumer contract", () => {
  test("DeliveryTrackingMap uses the shared provider, leases tracking:watch and subscribes through the registry", () => {
    const source = trackingMap()
    expect(source).toContain('from "@/hooks/use-realtime"')
    expect(source).toContain('client.acquireOrderRoom(pedidoId, ["tracking:watch"], { signal: controller.signal })')
    expect(source).toContain('client.subscribe("repartidor-location"')
    expect(source).toContain("new AbortController()")
    expect(source).toContain("controller.abort()")
    expect(source).toContain("{ signal: controller.signal }")
    expect(source).not.toContain("authorizeRealtimeRoom")
    expect(source).not.toContain("fetchRealtimeToken")
    expect(source).not.toContain("getRealtimeSocketUrl")
  })

  test("DeliveryTrackingMap exposes no raw Socket ownership or transport listeners", () => {
    const source = trackingMap()
    for (const forbidden of [
      "socket.io-client",
      "socketRef",
      "getSocket",
      "socket.on",
      "socket.off",
      "socket.emit",
      "leave-all-rooms",
      "join-order-room",
      "\"io(",
      " io(",
      "reconnectionAttempts",
      "reconnectionDelay",
    ]) {
      expect(source).not.toContain(forbidden)
    }
  })

  test("DeliveryTrackingMap releases the lease and unsubscribes on every cleanup path", () => {
    const source = trackingMap()
    expect(source).toContain("lease?.release()")
    expect(source).toContain("unsubscribe()")
    expect(source).toContain("cancelled = true")
  })

  test("DeliveryTrackingMap preserves the HTTP fetch/polling fallback", () => {
    const source = trackingMap()
    expect(source).toContain("fetchTracking")
    expect(source).toContain("/api/pedidos/${pedidoId}/tracking")
    expect(source).toContain("POLL_INTERVAL")
    expect(source).toContain("SOCKET_POLL_HEARTBEAT")
  })

  test("isLiveSocket reflects the shared transport's current connection state, not a one-shot lease flag", () => {
    const source = trackingMap()
    expect(source).toContain('const { client, snapshot } = useRealtime()')
    expect(source).toContain('isTrackingRoomJoined && snapshot.state === "connected"')
    expect(source).toContain("setIsTrackingRoomJoined(true)")
    expect(source).toContain("setIsTrackingRoomJoined(false)")
  })

  test("DeliveryTrackingMap preserves the exact fallback/heartbeat poll cadence (never touched by the freshness guard)", () => {
    const source = trackingMap()
    expect(source).toContain("const POLL_INTERVAL = 8_000")
    expect(source).toContain("const SOCKET_POLL_HEARTBEAT = 20_000")
  })

  test("DeliveryTrackingMap uses the clock-independent tracking-freshness guard (generation/httpSequence + DB-backed server version), never any timestamp/Date comparison", () => {
    const source = trackingMap()
    expect(source).toContain('from "@/lib/tracking-freshness"')
    expect(source).toContain("beginTrackingGeneration")
    expect(source).toContain("beginTrackingHttpRequest")
    expect(source).toContain("isTrackingHttpResponseSuperseded")
    expect(source).toContain("applyTrackingServerVersion")
    expect(source).toContain("isTrustedTrackingServerVersion")
    expect(source).toContain("canUntrustedTrackingSourceOverridePosition")
    expect(source).toContain("const freshnessRef = useRef(createTrackingFreshnessTracker(pedidoId))")
  })

  test("the freshness generation is bumped on every pedido switch and every open/close transition, before any fetch or state reset", () => {
    const source = trackingMap()
    const generationIndex = source.indexOf("beginTrackingGeneration(freshnessRef.current, pedidoId)")
    const resetIndex = source.indexOf("setTrackingData(null)", generationIndex)
    const fetchCallIndex = source.indexOf("fetchTracking()", generationIndex)
    expect(generationIndex).toBeGreaterThan(-1)
    expect(resetIndex).toBeGreaterThan(generationIndex)
    expect(fetchCallIndex).toBeGreaterThan(resetIndex)
    expect(source).toContain("}, [open, pedidoId])")
  })

  test("every realtime position write validates and applies through the server version authority before ever touching state", () => {
    const source = trackingMap()
    const subscribeIndex = source.indexOf('client.subscribe("repartidor-location"')
    const trustedIndex = source.indexOf("isTrustedTrackingServerVersion(data.version)", subscribeIndex)
    const applyIndex = source.indexOf("shouldApplyPosition", subscribeIndex)
    const setTrackingDataIndex = source.indexOf("setTrackingData((prev) => {", subscribeIndex)
    expect(subscribeIndex).toBeGreaterThan(-1)
    expect(trustedIndex).toBeGreaterThan(subscribeIndex)
    expect(applyIndex).toBeGreaterThan(trustedIndex)
    expect(applyIndex).toBeLessThan(setTrackingDataIndex)
    expect(source).toContain("if (!shouldApplyPosition) return")
  })

  test("a legacy (no trusted version) realtime event only moves the position while no server version has ever been observed", () => {
    const source = trackingMap()
    expect(source).toContain("canUntrustedTrackingSourceOverridePosition(freshnessRef.current)")
    expect(source).toContain("applyTrackingServerVersion(freshnessRef.current, trustedVersion)")
  })

  test("realtime updates remain filtered to the currently-authorized pedido before any freshness bookkeeping runs (cross-pedido isolation)", () => {
    const source = trackingMap()
    const subscribeIndex = source.indexOf('client.subscribe("repartidor-location"')
    const filterIndex = source.indexOf("if (data.pedidoId !== pedidoId) return", subscribeIndex)
    const trustedIndex = source.indexOf("isTrustedTrackingServerVersion(data.version)", subscribeIndex)
    expect(filterIndex).toBeGreaterThan(subscribeIndex)
    expect(trustedIndex).toBeGreaterThan(filterIndex)
    // The lease/subscription effect itself is re-run (unsubscribe + resubscribe)
    // on every pedidoId change, so a stale handler from a previous pedido can
    // never still be registered when a cross-pedido event would arrive.
    expect(source).toContain('}, [open, pedidoId, client])')
  })

  test("fetchTracking never applies a superseded response, and never overwrites a fresher server-versioned position without preserving HTTP-only fields", () => {
    const source = trackingMap()
    expect(source).toContain("if (isTrackingHttpResponseSuperseded(ticket, freshnessRef.current)) return")
    expect(source).toContain("isTrustedTrackingServerVersion(data.version)")
    expect(source).toContain("applyTrackingServerVersion(freshnessRef.current, trustedVersion)")
    expect(source).toContain("if (!shouldApplyPosition && prev)")
    expect(source).toContain("repartidorLat: prev.repartidorLat")
    expect(source).toContain("repartidorLng: prev.repartidorLng")
    expect(source).toContain("repartidorLastUpdate: prev.repartidorLastUpdate")
  })

  test("the server version authority is never derived from any timestamp, Date, or client clock value", () => {
    const source = trackingMap()
    expect(source).not.toContain("Date.now()")
    expect(source).not.toMatch(/applyTrackingServerVersion\([^)]*timestamp/i)
    expect(source).not.toMatch(/canUntrustedTrackingSourceOverridePosition\([^)]*timestamp/i)
  })

  test("DB Migration / Precommit fix: an unversioned/invalid HTTP response can never override a known server version — it does not unconditionally apply", () => {
    const source = trackingMap()
    const fetchTrackingIndex = source.indexOf("const fetchTracking = useCallback")
    const trustedVersionIndex = source.indexOf("const trustedVersion = isTrustedTrackingServerVersion(data.version)", fetchTrackingIndex)
    const shouldApplyIndex = source.indexOf("const shouldApplyPosition = trustedVersion === null", fetchTrackingIndex)
    expect(fetchTrackingIndex).toBeGreaterThan(-1)
    expect(trustedVersionIndex).toBeGreaterThan(fetchTrackingIndex)
    expect(shouldApplyIndex).toBeGreaterThan(trustedVersionIndex)
    // The bug this guards against: `trustedVersion === null ? true : ...`
    // (always apply when unversioned) must never reappear.
    const shouldApplyBlock = source.slice(shouldApplyIndex, shouldApplyIndex + 200)
    expect(shouldApplyBlock).not.toMatch(/trustedVersion === null\s*\?\s*true/)
    expect(shouldApplyBlock).toMatch(/trustedVersion === null\s*\?\s*canUntrustedTrackingSourceOverridePosition\(freshnessRef\.current\)/)
  })

  test("Same-Pedido Close/Reopen Focal Fix: the freshness tracker is created with the current pedido identity, not pedido-agnostic", () => {
    const source = trackingMap()
    expect(source).toContain("const freshnessRef = useRef(createTrackingFreshnessTracker(pedidoId))")
  })

  test("Same-Pedido Close/Reopen Focal Fix: every generation reset passes the current pedidoId through, so a same-pedido reopen recovers its own floor instead of blindly erasing it", () => {
    const source = trackingMap()
    expect(source).toContain("beginTrackingGeneration(freshnessRef.current, pedidoId)")
    // The old pedido-agnostic call (which unconditionally wiped the server
    // version floor on every reopen, not just on a genuine pedido switch)
    // must never reappear.
    expect(source).not.toContain("beginTrackingGeneration(freshnessRef.current)")
  })

  test("Same-Pedido Close/Reopen Focal Fix: pedido identity is threaded through the exact same effect that already resets the HTTP lifecycle on every open/pedidoId transition", () => {
    const source = trackingMap()
    const effectIndex = source.indexOf("beginTrackingGeneration(freshnessRef.current, pedidoId)")
    const depsIndex = source.indexOf("}, [open, pedidoId])", effectIndex)
    expect(effectIndex).toBeGreaterThan(-1)
    expect(depsIndex).toBeGreaterThan(effectIndex)
  })

  test("DeliveryTrackingMap never persists any freshness/version state outside browser memory", () => {
    const source = trackingMap()
    for (const forbidden of ["localStorage", "sessionStorage", "indexedDB", "document.cookie"]) {
      expect(source).not.toContain(forbidden)
    }
  })
})
