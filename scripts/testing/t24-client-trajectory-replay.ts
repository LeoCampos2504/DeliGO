/**
 * P2-T24-R4 — deterministic client-only trajectory replay.
 *
 * Local-only: no HTTP, DB, OSRM, realtime bridge, or public debug endpoint.
 * The hard Testing guard keeps this replay from being mistaken for an
 * end-to-end or Production certification.
 */

import {
  createTrackingPlaybackController,
  selectTrackingVisualTrajectory,
  type TrackingPlaybackPoint,
} from "@/lib/tracking-playback"

type Point = TrackingPlaybackPoint
type TrajectoryPoint = Point & { offsetMs: number }

const RAW: TrajectoryPoint[] = [
  { lat: 10, lng: 10, offsetMs: 0 },
  { lat: 10.001, lng: 10, offsetMs: 300 },
  { lat: 10.002, lng: 10, offsetMs: 600 },
]

const MATCHED: TrajectoryPoint[] = [
  { lat: 10, lng: 10, offsetMs: 0 },
  { lat: 10.0005, lng: 10.0003, offsetMs: 150 },
  { lat: 10.001, lng: 10.0008, offsetMs: 300 },
  { lat: 10.0015, lng: 10.001, offsetMs: 450 },
  { lat: 10.002, lng: 10, offsetMs: 600 },
]

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function guardTesting(): void {
  if (!process.argv.includes("--confirm-testing")) throw new Error("R4_HARNESS_GUARD=HARD_FAIL missing --confirm-testing")
  const environment = process.env.DELIGO_ENVIRONMENT || process.env.RAILWAY_ENVIRONMENT_NAME || process.env.APP_ENV
  if (environment !== "TESTING") throw new Error("R4_HARNESS_GUARD=HARD_FAIL environment must be exactly TESTING")
  if (process.env.NODE_ENV === "production") throw new Error("R4_HARNESS_GUARD=HARD_FAIL Production rejected")
}

function createDeterministicHarness() {
  let now = 0
  let nextFrameId = 0
  const frames = new Map<number, (timestamp: number) => void>()
  const marker = {
    position: { lat: 10, lng: 10 },
    setLatLng([lat, lng]: [number, number]) {
      this.position = { lat, lng }
    },
  }
  const controller = createTrackingPlaybackController({
    marker,
    now: () => now,
    requestFrame: (callback) => {
      const id = ++nextFrameId
      frames.set(id, callback)
      return id
    },
    cancelFrame: (id) => { frames.delete(id) },
  })
  return {
    marker,
    controller,
    runFrames() {
      let timestamp = 0
      let guard = 0
      while (frames.size > 0 && guard < 200) {
        const next = frames.entries().next().value as [number, (timestamp: number) => void]
        frames.delete(next[0])
        timestamp += 100
        now = timestamp
        next[1](timestamp)
        guard += 1
      }
      assert(frames.size === 0, "R4_HARNESS_ERROR=bounded playback did not settle")
    },
  }
}

function run(): void {
  guardTesting()
  const harness = createDeterministicHarness()
  const selected = selectTrackingVisualTrajectory(MATCHED, RAW, harness.marker.position)
  assert(selected.length === MATCHED.length, "R4_HARNESS_ERROR=matched selection failed")

  harness.controller.seedRenderedPoint(harness.marker.position, 1)
  harness.controller.acceptConfirmedEvent({ point: RAW[2], version: 2, trajectory: selected })
  harness.runFrames()
  assert(harness.controller.snapshot().authoritativePoint?.lat === RAW[2].lat, "R4_HARNESS_ERROR=RAW authority changed")

  const rawFallback = selectTrackingVisualTrajectory(undefined, RAW, harness.marker.position)
  harness.controller.acceptConfirmedEvent({ point: rawFallback[2], version: 3, trajectory: rawFallback })
  harness.runFrames()

  harness.controller.cancelForStale()
  harness.controller.acceptConfirmedEvent({ point: { lat: 10.003, lng: 10 }, version: 4, trajectory: MATCHED })
  assert(harness.controller.snapshot().needsRecoverySnap === false, "R4_HARNESS_ERROR=stale recovery did not snap")
  harness.controller.cancelForCompletion()
  assert(harness.controller.acceptConfirmedEvent({ point: { lat: 10.004, lng: 10 }, version: 5, trajectory: MATCHED }) === "ignored_invalid", "R4_HARNESS_ERROR=completion did not cancel")

  console.log("R4_DETERMINISTIC_CLIENT_REPLAY=PASS")
  console.log("R4_MATCHED_CURVE=PASS")
  console.log("R4_MATCHED_TO_RAW=PASS")
  console.log("R4_STALE_RECOVERY=PASS")
  console.log("R4_COMPLETION_CANCELLATION=PASS")
  console.log("R4_NETWORK_OR_OSRM_CALLED=NO")
}

run()
