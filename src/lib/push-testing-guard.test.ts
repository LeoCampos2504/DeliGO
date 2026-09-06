import { describe, expect, test } from "bun:test"
import { isPushDebugAllowedEnvironment } from "./push-testing-guard"

describe("isPushDebugAllowedEnvironment", () => {
  test("TESTING (real Railway TESTING value) => true", () => {
    expect(isPushDebugAllowedEnvironment({ RAILWAY_ENVIRONMENT_NAME: "TESTING" })).toBe(true)
  })

  test("lowercase testing => true (case-insensitive)", () => {
    expect(isPushDebugAllowedEnvironment({ RAILWAY_ENVIRONMENT_NAME: "testing" })).toBe(true)
  })

  test("production (real Railway Production value) => false", () => {
    expect(isPushDebugAllowedEnvironment({ RAILWAY_ENVIRONMENT_NAME: "production" })).toBe(false)
  })

  test("PRODUCTION (any casing) => false", () => {
    expect(isPushDebugAllowedEnvironment({ RAILWAY_ENVIRONMENT_NAME: "PRODUCTION" })).toBe(false)
  })

  test("undefined (var absent, e.g. local dev without Railway) => false, fail-closed", () => {
    expect(isPushDebugAllowedEnvironment({})).toBe(false)
  })

  test("empty string => false", () => {
    expect(isPushDebugAllowedEnvironment({ RAILWAY_ENVIRONMENT_NAME: "" })).toBe(false)
  })

  test("unrecognized value (future third environment) => false, fail-closed", () => {
    expect(isPushDebugAllowedEnvironment({ RAILWAY_ENVIRONMENT_NAME: "staging" })).toBe(false)
  })

  test("substring match is not enough — 'testing-extra' => false", () => {
    expect(isPushDebugAllowedEnvironment({ RAILWAY_ENVIRONMENT_NAME: "testing-extra" })).toBe(false)
  })

  test("defaults to real process.env when no argument given", () => {
    const original = process.env.RAILWAY_ENVIRONMENT_NAME
    delete process.env.RAILWAY_ENVIRONMENT_NAME
    try {
      expect(isPushDebugAllowedEnvironment()).toBe(false)
    } finally {
      if (original === undefined) delete process.env.RAILWAY_ENVIRONMENT_NAME
      else process.env.RAILWAY_ENVIRONMENT_NAME = original
    }
  })
})
