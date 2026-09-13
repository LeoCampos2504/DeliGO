import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"

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
    for (const scenario of ["smooth-route", "curve", "stationary", "stale", "complete"]) {
      expect(harness).toContain(`\"${scenario}\"`)
    }
    expect(harness).toContain("HARNESS_REPLAY_NOT_STARTED=SI")
    expect(harness).toContain("T23_HARNESS_ERROR=")
  })
})
