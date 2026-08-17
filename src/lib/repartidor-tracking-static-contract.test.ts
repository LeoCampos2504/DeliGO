import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const fromSrc = (relativePath: string) => resolve(import.meta.dir, "..", relativePath)
const repartidorTracking = () => readFileSync(fromSrc("hooks/use-repartidor-tracking.ts"), "utf8")

describe("Shared realtime client repartidor tracking producer contract", () => {
  test("useRepartidorTracking uses the shared provider and leases tracking:publish per pedido", () => {
    const source = repartidorTracking()
    expect(source).toContain('from "@/hooks/use-realtime"')
    expect(source).toContain('client.acquireOrderRoom(id, ["tracking:publish"], { signal: controller.signal })')
    expect(source).toContain('client.sendTrackingLocation(delivery.id,')
    expect(source).toContain("new AbortController()")
    expect(source).toContain("controller.abort()")
  })

  test("useRepartidorTracking tracks leases in a per-pedido Map keyed by a stable id-set string", () => {
    const source = repartidorTracking()
    expect(source).toContain("useRef<Map<string, RealtimeRoomLease>>(new Map())")
    expect(source).toContain("const enCaminoKey = useMemo(() => {")
    expect(source).toContain("}, [enCaminoKey, client])")
  })

  test("useRepartidorTracking retries a failed lease acquisition with bounded backoff, not on every render", () => {
    const source = repartidorTracking()
    expect(source).toContain("LEASE_RETRY_BASE_MS")
    expect(source).toContain("LEASE_RETRY_MAX_MS")
    expect(source).toContain("retryTimers")
    expect(source).toContain("clearTimeout(timer)")
  })

  test("useRepartidorTracking exposes no raw Socket ownership or transport listeners", () => {
    const source = repartidorTracking()
    for (const forbidden of [
      "socket.io-client",
      "socketRef",
      "getSocket",
      "socket.on",
      "socket.off",
      "socket.emit",
      "leave-all-rooms",
      "join-order-room",
      "location-update",
      "\"io(",
      " io(",
      "reconnectionAttempts",
      "reconnectionDelay",
      "fetchRealtimeToken",
      "authorizeRealtimeRoom",
      "getRealtimeSocketUrl",
    ]) {
      expect(source).not.toContain(forbidden)
    }
  })

  test("useRepartidorTracking releases every held lease on unmount and on id-set changes", () => {
    const source = repartidorTracking()
    expect(source).toContain("lease.release()")
    expect(source).toContain("leasesRef.current.delete(id)")
    expect(source).toContain("leasesRef.current.clear()")
    expect(source).toContain("cancelled = true")
  })

  test("useRepartidorTracking preserves HTTP persistence ordering before the realtime publish", () => {
    const source = repartidorTracking()
    const httpIndex = source.indexOf('fetch("/api/repartidor/ubicacion"')
    const publishIndex = source.indexOf("client.sendTrackingLocation(delivery.id,")
    expect(httpIndex).toBeGreaterThan(-1)
    expect(publishIndex).toBeGreaterThan(-1)
    expect(httpIndex).toBeLessThan(publishIndex)
    expect(source).toContain("Promise.allSettled")
  })

  test("useRepartidorTracking preserves the 5s GPS interval and visibility gating", () => {
    const source = repartidorTracking()
    expect(source).toContain("setInterval(tick, 5000)")
    expect(source).toContain('document.visibilityState !== "visible"')
    expect(source).toContain("navigator.geolocation.getCurrentPosition")
  })

  test("useRepartidorTracking does not widen the GPS strategy beyond a plain interval", () => {
    const source = repartidorTracking()
    for (const forbidden of ["watchPosition", "distanceThreshold", "movementThreshold"]) {
      expect(source).not.toContain(forbidden)
    }
  })
})
