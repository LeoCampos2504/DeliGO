import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import {
  ROUTE_TO_DESTINATION_BATCH_SIZE,
  ROUTE_TO_DESTINATION_DESTINATION,
  ROUTE_TO_DESTINATION_TURNS,
  batchDistanceMeters,
  buildLegacyHeartbeatPayload,
  buildBatches,
  buildRecoveryTrajectory,
  haversineDistanceMeters,
  recoveryTrajectoryDistanceMeters,
  routeFor,
} from "./t23-trajectory-replay"

const harness = readFileSync(`${import.meta.dir}/t23-trajectory-replay.ts`, "utf8")

describe("P2-T23-R3B Testing trajectory replay harness contract", () => {
  test("is local-only, explicitly Testing-gated, and never targets Production", () => {
    expect(harness).toContain("--confirm-testing")
    expect(harness).toContain('environment !== "TESTING"')
    expect(harness).toContain('process.env.NODE_ENV === "production"')
    expect(harness).toContain('host === "deligo.ar"')
    expect(harness).toContain('host.endsWith(".deligo.ar")')
    expect(harness).toContain("DATABASE_URL must equal DELIGO_TEST_DATABASE_URL")
    expect(harness).not.toContain("/api/debug")
    expect(harness).not.toContain("railway up")
  })

  test("uses the real authenticated tracking endpoint and bounded fixture scenarios", () => {
    expect(harness).toContain("/api/repartidor/ubicacion")
    expect(harness).toContain("Cookie: `deligo_session=${fixture.repartidorSession}`")
    expect(harness).toContain("TEST_T23_")
    for (const scenario of ["smooth-route", "curve", "stationary", "stale", "complete", "route-to-destination", "recovery-once"]) {
      expect(harness).toContain(`\"${scenario}\"`)
    }
    expect(harness).toContain("HARNESS_REPLAY_NOT_STARTED=SI")
    expect(harness).toContain("T23_HARNESS_ERROR=")
    expect(harness).toContain("if (import.meta.main)")
    expect(harness).not.toContain("db.pedido.update")
    expect(harness).not.toContain("db.repartidor.update")
    expect(harness).not.toContain("$queryRaw")
    expect(harness).toContain("GET_TRACKING_CURRENT_POINT")
    expect(harness).toContain("RECOVERY_POST_COUNT=1")
  })

  test("keeps completion on the real client-then-driver endpoint sequence", () => {
    const trajectoryIndex = harness.indexOf("const batches = buildBatches(route")
    const confirmIndex = harness.indexOf('action: "confirmar"')
    const deliverIndex = harness.indexOf("/api/repartidor/pedidos/${fixture.pedidoId}/entregar")

    expect(trajectoryIndex).toBeGreaterThanOrEqual(0)
    expect(confirmIndex).toBeGreaterThan(trajectoryIndex)
    expect(deliverIndex).toBeGreaterThan(confirmIndex)
    expect(harness).toContain("Cookie: `deligo_session=${fixture.clienteSession}`")
    expect(harness).toContain("Cookie: `deligo_session=${fixture.repartidorSession}`")
    expect(harness).toContain("Origin: baseUrl")
    expect(harness).toContain('if (!clientConfirmation.ok) fail')
    expect(harness).toContain('if (!delivered.ok) fail')
    expect(harness).toContain('if (scenario === "complete")')
  })

  test("prepares a deterministic multi-turn route ending at the real destination", () => {
    const route = routeFor("route-to-destination")
    const batches = buildBatches(route, ROUTE_TO_DESTINATION_BATCH_SIZE)

    expect(route.length).toBeGreaterThan(routeFor("smooth-route").length)
    expect(route.length).toBe(36)
    expect(ROUTE_TO_DESTINATION_TURNS.length).toBeGreaterThanOrEqual(3)
    expect(ROUTE_TO_DESTINATION_TURNS.map((turn) => turn.pointIndex)).toEqual([6, 12, 18, 25, 31])
    expect(batches.length).toBe(9)
    expect(Math.max(...batches.map((batch) => batch.length))).toBeLessThanOrEqual(12)
    expect(Math.max(...batches.map(batchDistanceMeters))).toBeLessThanOrEqual(150)
    expect(haversineDistanceMeters(route.at(-1)!, ROUTE_TO_DESTINATION_DESTINATION)).toBe(0)
  })

  test("builds a stationary heartbeat from the current server point", () => {
    const currentServerPoint = { lat: -12.3456, lng: -65.4321 }
    const payload = buildLegacyHeartbeatPayload("TEST_T23_ORDER", currentServerPoint)

    expect(payload).toEqual({ pedidoId: "TEST_T23_ORDER", lat: -12.3456, lng: -65.4321 })
    expect(payload).not.toHaveProperty("trajectory")
    expect(payload).not.toHaveProperty("businessLat")
    expect(payload).not.toHaveProperty("routeStart")
  })

  test("builds exactly one bounded recovery batch from the runtime current point", () => {
    const currentServerPoint = { lat: -34.6037, lng: -58.3816 }
    const trajectory = buildRecoveryTrajectory(currentServerPoint)
    const batches = buildBatches(trajectory, trajectory.length)
    const finalPoint = trajectory.at(-1)!

    expect(batches).toHaveLength(1)
    expect(trajectory).toHaveLength(4)
    expect(trajectory[0]).toBe(currentServerPoint)
    expect(recoveryTrajectoryDistanceMeters(currentServerPoint)).toBeGreaterThanOrEqual(30)
    expect(recoveryTrajectoryDistanceMeters(currentServerPoint)).toBeLessThanOrEqual(100)
    expect(finalPoint).toEqual({ lat: currentServerPoint.lat + 0.0003, lng: currentServerPoint.lng + 0.00045 })
    expect(finalPoint).toEqual({ lat: trajectory[trajectory.length - 1].lat, lng: trajectory[trajectory.length - 1].lng })
  })
})
