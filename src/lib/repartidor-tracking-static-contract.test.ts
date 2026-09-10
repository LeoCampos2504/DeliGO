import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const fromSrc = (relativePath: string) => resolve(import.meta.dir, "..", relativePath)
const repartidorTracking = () => readFileSync(fromSrc("hooks/use-repartidor-tracking.ts"), "utf8")

// P2-T02-B3: this contract was written for MODEL-G1 (a plain 5s
// setInterval(tick, ...) polling getCurrentPosition) and never updated when
// the hook was rewritten to MODEL-E1 (event-driven watchPosition, P2-T02
// Stage 1B) — it kept failing 4/4 assertions ever since, a known documented
// debt (see P2_T02_REAL_ANDROID_GPS_DELIVERY_CERTIFICATION_R1.md). P2-T02-B3
// touches this exact architecture directly (OPTION-C background tracking),
// so this is the right moment to modernize it against the CURRENT
// MODEL-E1/B3 contract instead of continuing to carry dead assertions.
describe("Repartidor tracking producer contract (server-authoritative, MODEL-E1/B3)", () => {
  test("useRepartidorTracking still POSTs to the HTTP tracking endpoint, nothing else", () => {
    const source = repartidorTracking()
    expect(source).toContain('fetch("/api/repartidor/ubicacion"')
    // Exactly one call site for the POST itself (sendLocationForDelivery) —
    // no second, parallel network path was introduced.
    expect(source.split('fetch("/api/repartidor/ubicacion"').length - 1).toBe(1)
  })

  test("useRepartidorTracking uses a single event-driven watchPosition watcher, never a plain interval poll", () => {
    const source = repartidorTracking()
    expect(source).toContain("navigator.geolocation.watchPosition")
    // Exactly one watchPosition call site (startWatcherIfNeeded) — MODEL-E1's
    // single-watcher invariant (P2-T02 Stage 1B), never one-per-delivery.
    expect(source.split("navigator.geolocation.watchPosition(").length - 1).toBe(1)
    expect(source).toContain("navigator.geolocation.getCurrentPosition") // one-shot fresh-sample acquisition only, see ensureFreshSample
    expect(source).not.toContain("setInterval(tick") // MODEL-G1 polling model, retired
  })

  test("useRepartidorTracking preserves movement filtering, send throttle, and stationary heartbeat", () => {
    const source = repartidorTracking()
    expect(source).toContain("isSignificantMovement")
    expect(source).toContain("MIN_SEND_INTERVAL_MS")
    expect(source).toContain("STATIONARY_HEARTBEAT_MS")
  })

  test("useRepartidorTracking (P2-T02-B3/OPTION-C): hidden does NOT clearWatch or clear timers — only foreground bookkeeping", () => {
    const source = repartidorTracking()
    const start = source.indexOf("function handleVisibilityChange()")
    const end = source.indexOf("function handleWindowFocus()")
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    const hiddenBranch = source.slice(start, end)
    // The visible branch schedules a foreground check; the OPTION-C hidden
    // branch below must never stop the watcher or clear any timer just
    // because the page went hidden — that was OPTION-V2, retired by B3.
    expect(hiddenBranch).toContain('scheduleForegroundCheck()')
    expect(hiddenBranch).toContain("pendingForegroundRecoveryRef.current = true")
    expect(hiddenBranch).not.toContain("stopWatcher()")
    expect(hiddenBranch).not.toContain("clearWatchdog()")
    expect(hiddenBranch).not.toContain("clearDeliveryTimers")
  })

  test("useRepartidorTracking: starting/scheduling the watcher and watchdog no longer gate on document.visibilityState", () => {
    const source = repartidorTracking()
    const startWatcherStart = source.indexOf("function startWatcherIfNeeded()")
    const startWatcherEnd = source.indexOf("function performForcedRecovery")
    expect(startWatcherStart).toBeGreaterThan(-1)
    expect(source.slice(startWatcherStart, startWatcherEnd)).not.toContain("visibilityState")

    const scheduleWatchdogStart = source.indexOf("function scheduleWatchdog()")
    const scheduleWatchdogEnd = source.indexOf("function checkWatchdog")
    expect(scheduleWatchdogStart).toBeGreaterThan(-1)
    expect(source.slice(scheduleWatchdogStart, scheduleWatchdogEnd)).not.toContain("visibilityState")
  })

  test("useRepartidorTracking: a delivery leaving core-eligibility (props change) still stops the watcher when none remain", () => {
    const source = repartidorTracking()
    const start = source.indexOf("if (eligibleNow.length > 0) {")
    expect(start).toBeGreaterThan(-1)
    const block = source.slice(start, start + 200)
    expect(block).toContain("startWatcherIfNeeded()")
    expect(block).toContain("} else {")
    expect(block).toContain("stopWatcher()")
    expect(block).toContain("clearWatchdog()")
  })

  test("useRepartidorTracking: real unmount always tears down the watcher, watchdog, and all delivery state", () => {
    const source = repartidorTracking()
    const start = source.indexOf("isMountedRef.current = false")
    expect(start).toBeGreaterThan(-1)
    const teardown = source.slice(start, start + 250)
    expect(teardown).toContain("stopWatcher()")
    expect(teardown).toContain("clearWatchdog()")
    expect(teardown).toContain("cleanupDeliveryState(id)")
  })

  test("useRepartidorTracking: foreground recovery and the liveness watchdog both exist and share the same forced-restart path", () => {
    const source = repartidorTracking()
    expect(source).toContain("function performForcedRecovery(")
    expect(source).toContain("function checkWatchdog(")
    expect(source).toContain("FOREGROUND_WATCHDOG_WINDOW_MS")
    expect(source).toContain("ensureForegroundRecoverySendForDelivery")
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
    const sendLocationStart = source.indexOf("async function sendLocationForDelivery")
    const sendLocationEnd = source.indexOf("function ensureFreshSample")
    expect(sendLocationStart).toBeGreaterThan(-1)
    expect(sendLocationEnd).toBeGreaterThan(sendLocationStart)
    const sendLocationBody = source.slice(sendLocationStart, sendLocationEnd)
    expect(sendLocationBody).toContain('fetch("/api/repartidor/ubicacion"')
    expect(sendLocationBody).not.toContain("client.")
    expect(sendLocationBody).not.toContain("lease")
  })
})
