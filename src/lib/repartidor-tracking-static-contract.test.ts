import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const fromSrc = (relativePath: string) => resolve(import.meta.dir, "..", relativePath)
const repartidorTracking = () => readFileSync(fromSrc("hooks/use-repartidor-tracking.ts"), "utf8")

describe("Repartidor tracking producer contract (server-authoritative)", () => {
  test("useRepartidorTracking still POSTs to the HTTP tracking endpoint", () => {
    const source = repartidorTracking()
    expect(source).toContain('fetch("/api/repartidor/ubicacion"')
    expect(source).toContain("Promise.allSettled")
  })

  test("useRepartidorTracking preserves the 5s GPS interval, getCurrentPosition and visibility gating", () => {
    const source = repartidorTracking()
    expect(source).toContain("setInterval(tick, 5000)")
    expect(source).toContain("navigator.geolocation.getCurrentPosition")
    expect(source).toContain('document.visibilityState !== "visible"')
  })

  test("useRepartidorTracking does not widen the GPS strategy beyond a plain interval", () => {
    const source = repartidorTracking()
    for (const forbidden of ["watchPosition", "distanceThreshold", "movementThreshold"]) {
      expect(source).not.toContain(forbidden)
    }
  })

  test("useRepartidorTracking no longer drives any realtime producer productively (server-authoritative)", () => {
    const source = repartidorTracking()
    // E: no productive sendTrackingLocation caller.
    expect(source).not.toContain("sendTrackingLocation")
    // I: no productive tracking:publish room acquisition — the browser no
    // longer needs a lease once the server is the sole realtime producer.
    expect(source).not.toContain("tracking:publish")
    expect(source).not.toContain("acquireOrderRoom")
    // Follows from removing every realtime call above: the shared realtime
    // client/hook is not used by this hook at all anymore.
    expect(source).not.toContain("useRealtime")
    expect(source).not.toContain("RealtimeRoomLease")
  })

  test("useRepartidorTracking exposes no raw Socket ownership, transport listeners, or legacy event literals", () => {
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

  test("useRepartidorTracking never touches the Internal Publish Bridge directly", () => {
    const source = repartidorTracking()
    for (const forbidden of [
      "internal/realtime/publish",
      "REALTIME_INTERNAL_PUBLISH_SECRET",
      "REALTIME_INTERNAL_SERVICE_URL",
      "publishRealtimeEvent",
      "X-DeliGO-Signature",
    ]) {
      expect(source).not.toContain(forbidden)
    }
  })

  test("useRepartidorTracking's only network call is the independent HTTP POST — no realtime dependency in the send path", () => {
    const source = repartidorTracking()
    const sendLocationStart = source.indexOf("const sendLocation")
    const sendLocationEnd = source.indexOf("const tick")
    expect(sendLocationStart).toBeGreaterThan(-1)
    expect(sendLocationEnd).toBeGreaterThan(sendLocationStart)
    const sendLocationBody = source.slice(sendLocationStart, sendLocationEnd)
    expect(sendLocationBody).toContain('fetch("/api/repartidor/ubicacion"')
    expect(sendLocationBody).not.toContain("client.")
    expect(sendLocationBody).not.toContain("lease")
  })
})
