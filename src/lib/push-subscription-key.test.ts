// P2-T31-R3 (ANDROID-WEB-PUSH-DELIVERY-CROSS-ENV-AUDIT): pure unit tests for
// urlBase64ToUint8Array (pre-existing, previously untested) and
// applicationServerKeyMatches (new — the VAPID-staleness guard added to
// use-push-notifications.ts's subscribe()). Both are framework-agnostic, no
// browser PushManager needed — this repo has neither jsdom nor React
// Testing Library.
import { describe, expect, test } from "bun:test"
import { applicationServerKeyMatches, unsubscribeStalePushSubscription, urlBase64ToUint8Array } from "./push-subscription-key"

describe("urlBase64ToUint8Array", () => {
  test("decodes a base64url string (with - and _ substitutions) to the expected bytes", () => {
    // "hello" in base64 is "aGVsbG8=" — base64url form has no padding and no +/ chars.
    const result = urlBase64ToUint8Array("aGVsbG8")
    expect(Array.from(result)).toEqual([104, 101, 108, 108, 111]) // "hello"
  })

  test("handles - and _ substitutions correctly (real VAPID keys use these)", () => {
    // Bytes [0xfb, 0xff] -> standard base64 "+/8=" -> base64url "-_8"
    const result = urlBase64ToUint8Array("-_8")
    expect(Array.from(result)).toEqual([0xfb, 0xff])
  })

  test("round-trips with btoa/atob for an arbitrary byte sequence", () => {
    const bytes = new Uint8Array([1, 2, 3, 255, 0, 128, 64])
    let binary = ""
    for (const b of bytes) binary += String.fromCharCode(b)
    const base64url = globalThis.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
    const decoded = urlBase64ToUint8Array(base64url)
    expect(Array.from(decoded)).toEqual(Array.from(bytes))
  })
})

describe("applicationServerKeyMatches", () => {
  const keyA = urlBase64ToUint8Array("aGVsbG8") // "hello"
  const keyAAgain = urlBase64ToUint8Array("aGVsbG8")
  const keyB = urlBase64ToUint8Array("d29ybGQ") // "world"

  test("returns true when the existing ArrayBuffer holds the exact same bytes as expected", () => {
    expect(applicationServerKeyMatches(keyAAgain.buffer as ArrayBuffer, keyA)).toBe(true)
  })

  test("returns false when the existing key's bytes differ from expected (the VAPID mismatch case)", () => {
    expect(applicationServerKeyMatches(keyB.buffer as ArrayBuffer, keyA)).toBe(false)
  })

  test("returns false (fail-closed) when there is no existing key at all", () => {
    expect(applicationServerKeyMatches(null, keyA)).toBe(false)
  })

  test("returns false when lengths differ, even if the shared prefix bytes are identical", () => {
    const shorter = keyA.slice(0, 3)
    expect(applicationServerKeyMatches(shorter.buffer as ArrayBuffer, keyA)).toBe(false)
  })

  test("is order/position sensitive — a single differing byte anywhere fails the match", () => {
    const almostA = new Uint8Array(keyA)
    almostA[almostA.length - 1] ^= 0xff
    expect(applicationServerKeyMatches(almostA.buffer, keyA)).toBe(false)
  })
})

// P2-T31-R5A (PUSH-SUBSCRIPTION-FAILURE-CONTRACT-HARDENING): direct
// behavioral coverage — no real browser PushSubscription/PushManager
// needed, both dependencies are injected per the established
// dependency-injection pattern (see push-personal-status-check.ts).
describe("unsubscribeStalePushSubscription", () => {
  test("STALE_REPLACEMENT_SUCCESS: unsubscribe() resolves true AND getCurrentSubscription confirms null -> true (safe to recreate)", async () => {
    const existing = { unsubscribe: async () => true }
    const getCurrentSubscription = async () => null
    expect(await unsubscribeStalePushSubscription(existing, getCurrentSubscription)).toBe(true)
  })

  test("UNSUBSCRIBE_FALSE: unsubscribe() resolves false -> false, getCurrentSubscription is never even consulted (fail-closed immediately)", async () => {
    let getCurrentSubscriptionCalled = false
    const existing = { unsubscribe: async () => false }
    const getCurrentSubscription = async () => {
      getCurrentSubscriptionCalled = true
      return null
    }
    expect(await unsubscribeStalePushSubscription(existing, getCurrentSubscription)).toBe(false)
    expect(getCurrentSubscriptionCalled).toBe(false)
  })

  test("REMOVAL_NOT_CONFIRMED: unsubscribe() resolves true but a subscription is STILL present afterwards -> false (never trust the boolean alone)", async () => {
    const existing = { unsubscribe: async () => true }
    const getCurrentSubscription = async () => ({ endpoint: "https://push.example/still-there" })
    expect(await unsubscribeStalePushSubscription(existing, getCurrentSubscription)).toBe(false)
  })

  test("UNSUBSCRIBE_THROW: a rejected unsubscribe() propagates (caller's own try/catch decides the outcome) rather than being silently swallowed here", async () => {
    const existing = { unsubscribe: async () => { throw new Error("simulated unsubscribe failure") } }
    const getCurrentSubscription = async () => null
    await expect(unsubscribeStalePushSubscription(existing, getCurrentSubscription)).rejects.toThrow(
      "simulated unsubscribe failure"
    )
  })
})
