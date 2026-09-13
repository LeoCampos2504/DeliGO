import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import {
  ROUTE_TO_DESTINATION_BATCH_SIZE,
  ROUTE_TO_DESTINATION_DESTINATION,
  ROUTE_TO_DESTINATION_TURNS,
  batchDistanceMeters,
  buildBatches,
  haversineDistanceMeters,
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
    for (const scenario of ["smooth-route", "curve", "stationary", "stale", "complete", "route-to-destination"]) {
      expect(harness).toContain(`\"${scenario}\"`)
    }
    expect(harness).toContain("HARNESS_REPLAY_NOT_STARTED=SI")
    expect(harness).toContain("T23_HARNESS_ERROR=")
    expect(harness).toContain("if (import.meta.main)")
    expect(harness).not.toContain("db.pedido.update")
    expect(harness).not.toContain("db.repartidor.update")
    expect(harness).not.toContain("$queryRaw")
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
})
