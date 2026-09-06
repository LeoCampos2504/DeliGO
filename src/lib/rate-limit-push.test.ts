/// <reference types="bun-types" />
// P2-T31-R8 (PUSH-RATE-LIMIT-429-STATE-CONSISTENCY-FIX): direct coverage of
// the split `pushStatus`/`pushMutation` buckets against the REAL
// `checkRateLimit` (src/lib/rate-limit.ts, in-memory store shared by the
// whole process) — no mocking, no network, no React. Uses `randomUUID()`
// suffixes on every key so tests never interfere with each other or with
// any other file's use of the same shared module-level store (same
// technique as rate-limit-mesa-cuenta.test.ts).
//
// Physical evidence (Leonardo's iPhone stress test) showed real HTTP 429s
// during ordinary interactive use — NOT automated abuse — because the old
// shared `push` bucket (10/min) counted every status READ (one per Perfil
// mount/remount/cold-launch, plus the diagnostic panel's own refreshes)
// against the SAME budget as deliberate subscribe()/unsubscribe() clicks.
// These tests certify the fix at exactly the layer where the bug lived:
// the rate limiter's own accounting, independent of any UI/hook behavior.
import { describe, expect, test } from "bun:test"
import { randomUUID } from "crypto"
import { checkRateLimit, RATE_LIMITS } from "./rate-limit"

function freshKey(label: string): string {
  return `${label}-${randomUUID()}`
}

describe("RATE_LIMITS.pushStatus / pushMutation — split, independent buckets", () => {
  test("pushStatus and pushMutation are genuinely separate configs, not aliases of the old shared bucket", () => {
    expect(RATE_LIMITS.pushStatus).toBeDefined()
    expect(RATE_LIMITS.pushMutation).toBeDefined()
    expect(RATE_LIMITS.pushStatus.maxRequests).not.toBe(RATE_LIMITS.pushMutation.maxRequests)
    // @ts-expect-error — the old shared "push" bucket no longer exists; this
    // line documents its removal (compiled out, never executed).
    expect(RATE_LIMITS.push).toBeUndefined()
  })

  test("pushStatus is materially more generous than the old 10/min shared bucket", () => {
    expect(RATE_LIMITS.pushStatus.maxRequests).toBeGreaterThan(10)
  })

  test("exhausting pushMutation for a key does NOT affect pushStatus for the SAME key — independent budgets", () => {
    const key = freshKey("independent")
    for (let i = 0; i < RATE_LIMITS.pushMutation.maxRequests; i += 1) {
      expect(checkRateLimit("pushMutation", key).allowed).toBe(true)
    }
    expect(checkRateLimit("pushMutation", key).allowed).toBe(false) // mutation bucket now exhausted

    // The SAME key's status bucket is completely untouched.
    const statusResult = checkRateLimit("pushStatus", key)
    expect(statusResult.allowed).toBe(true)
    expect(statusResult.remaining).toBe(RATE_LIMITS.pushStatus.maxRequests - 1)
  })

  test("exhausting pushStatus for a key does NOT affect pushMutation for the SAME key", () => {
    const key = freshKey("independent-reverse")
    for (let i = 0; i < RATE_LIMITS.pushStatus.maxRequests; i += 1) {
      expect(checkRateLimit("pushStatus", key).allowed).toBe(true)
    }
    expect(checkRateLimit("pushStatus", key).allowed).toBe(false)

    const mutationResult = checkRateLimit("pushMutation", key)
    expect(mutationResult.allowed).toBe(true)
    expect(mutationResult.remaining).toBe(RATE_LIMITS.pushMutation.maxRequests - 1)
  })
})

describe("NORMAL_HUMAN_STRESS_CAN_HIT_LIMIT=NO under the new model", () => {
  test("a realistic Perfil-visiting + toggling session (10 status reads + 7 mutation writes) never produces a 429", () => {
    // Mirrors the physical sequence: mount->status, subscribe, mount->status
    // (remount), unsubscribe, mount->status, subscribe, unsubscribe — plus
    // extra bare remounts (status-only) to model "open/close Perfil
        // repeatedly" from the R8 task's own human-stress criterion (§10).
    const statusKey = freshKey("human-status")
    const mutationKey = freshKey("human-mutation")

    const statusReads = 10 // several cold launches / remounts / diagnostic-panel refreshes
    const mutationWrites = 7 // a handful of ON/OFF toggles — reasonable, not automated

    for (let i = 0; i < statusReads; i += 1) {
      expect(checkRateLimit("pushStatus", statusKey).allowed).toBe(true)
    }
    for (let i = 0; i < mutationWrites; i += 1) {
      expect(checkRateLimit("pushMutation", mutationKey).allowed).toBe(true)
    }
  })

  test("10 remounts (status-only, e.g. Perfil <-> Favoritos ten times) never produce a 429", () => {
    const key = freshKey("remounts")
    for (let i = 0; i < 10; i += 1) {
      expect(checkRateLimit("pushStatus", key).allowed).toBe(true)
    }
  })

  test("a rapid human toggle burst — 10 full ON/OFF cycles (20 mutation requests) in one minute — fits exactly within the new pushMutation budget", () => {
    const key = freshKey("rapid-toggle")
    for (let cycle = 0; cycle < 10; cycle += 1) {
      expect(checkRateLimit("pushMutation", key).allowed).toBe(true) // ON
      expect(checkRateLimit("pushMutation", key).allowed).toBe(true) // OFF
    }
    // Exactly at the ceiling — the NEXT one is legitimately over budget,
    // proving this isn't "unlimited", just correctly sized for real use.
    expect(checkRateLimit("pushMutation", key).allowed).toBe(false)
  })

  test("several cold launches worth of status checks (well beyond the old 10/min ceiling) still succeed under pushStatus", () => {
    const key = freshKey("cold-launches")
    for (let i = 0; i < 25; i += 1) {
      expect(checkRateLimit("pushStatus", key).allowed).toBe(true)
    }
  })
})

describe("ABUSE_RESISTANCE_PRESERVED=SI — automated flood still produces 429", () => {
  test("a flood clearly beyond human stress still gets rate-limited on pushMutation", () => {
    const key = freshKey("abuse-mutation")
    let blockedCount = 0
    for (let i = 0; i < 40; i += 1) {
      if (!checkRateLimit("pushMutation", key).allowed) blockedCount += 1
    }
    expect(blockedCount).toBeGreaterThan(0)
    expect(blockedCount).toBe(40 - RATE_LIMITS.pushMutation.maxRequests)
  })

  test("a flood clearly beyond human stress still gets rate-limited on pushStatus", () => {
    const key = freshKey("abuse-status")
    let blockedCount = 0
    for (let i = 0; i < 100; i += 1) {
      if (!checkRateLimit("pushStatus", key).allowed) blockedCount += 1
    }
    expect(blockedCount).toBeGreaterThan(0)
    expect(blockedCount).toBe(100 - RATE_LIMITS.pushStatus.maxRequests)
  })

  test("a blocked request carries a positive retryAfterMs (Retry-After is derivable) on both buckets", () => {
    const statusKey = freshKey("retry-after-status")
    const mutationKey = freshKey("retry-after-mutation")
    for (let i = 0; i < RATE_LIMITS.pushStatus.maxRequests; i += 1) checkRateLimit("pushStatus", statusKey)
    for (let i = 0; i < RATE_LIMITS.pushMutation.maxRequests; i += 1) checkRateLimit("pushMutation", mutationKey)

    const statusBlocked = checkRateLimit("pushStatus", statusKey)
    const mutationBlocked = checkRateLimit("pushMutation", mutationKey)
    expect(statusBlocked.allowed).toBe(false)
    expect(mutationBlocked.allowed).toBe(false)
    expect(statusBlocked.retryAfterMs).toBeGreaterThan(0)
    expect(mutationBlocked.retryAfterMs).toBeGreaterThan(0)
  })

  test("different keys (different actor+IP) never share budget — cardinality is still unbounded per-key, same as every other bucket in this module", () => {
    const keys = Array.from({ length: 30 }, () => freshKey("cardinality"))
    for (const key of keys) {
      expect(checkRateLimit("pushStatus", key).allowed).toBe(true)
      expect(checkRateLimit("pushMutation", key).allowed).toBe(true)
    }
  })
})
