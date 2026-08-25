// P2-T05 Stage3 (F-P2-T05-01): unit tests for the shared HTTP
// PushSubscription shape parser/normalizer. Pure functions, no DB, no mocks.
import { describe, expect, test } from "bun:test"
import {
  arePushSubscriptionsEquivalent,
  extractEndpointForDetach,
  parsePushSubscriptionShape,
  resolvePushSubscriptionDetachInput,
  toLegacyPushSubscriptionString,
  toNormalizedPushSubscriptionInput,
} from "./push-subscription-http"

const validRaw = {
  endpoint: "https://push.example/abc123",
  expirationTime: null,
  keys: { p256dh: "P256DH_KEY", auth: "AUTH_SECRET" },
}

describe("parsePushSubscriptionShape", () => {
  test("A1: valid object shape accepted", () => {
    expect(parsePushSubscriptionShape(validRaw)).toEqual(validRaw)
  })

  test("A2: valid JSON string shape accepted (legacy client body)", () => {
    expect(parsePushSubscriptionShape(JSON.stringify(validRaw))).toEqual(validRaw)
  })

  test("A3: http:// endpoint rejected (must be https)", () => {
    expect(parsePushSubscriptionShape({ ...validRaw, endpoint: "http://push.example/abc" })).toBeNull()
  })

  test("A4: malformed endpoint URL rejected", () => {
    expect(parsePushSubscriptionShape({ ...validRaw, endpoint: "not-a-url" })).toBeNull()
  })

  test("A5: missing endpoint rejected", () => {
    const { endpoint: _endpoint, ...rest } = validRaw
    expect(parsePushSubscriptionShape(rest)).toBeNull()
  })

  test("A6: empty p256dh rejected", () => {
    expect(parsePushSubscriptionShape({ ...validRaw, keys: { ...validRaw.keys, p256dh: "" } })).toBeNull()
  })

  test("A7: empty auth rejected", () => {
    expect(parsePushSubscriptionShape({ ...validRaw, keys: { ...validRaw.keys, auth: "   " } })).toBeNull()
  })

  test("A8: expirationTime null accepted", () => {
    const parsed = parsePushSubscriptionShape({ ...validRaw, expirationTime: null })
    expect(parsed?.expirationTime).toBeNull()
  })

  test("A9: expirationTime valid epoch accepted", () => {
    const parsed = parsePushSubscriptionShape({ ...validRaw, expirationTime: 1893456000000 })
    expect(parsed?.expirationTime).toBe(1893456000000)
  })

  test("A10: expirationTime invalid (string) rejected", () => {
    expect(parsePushSubscriptionShape({ ...validRaw, expirationTime: "not-a-number" })).toBeNull()
  })

  test("A11: expirationTime invalid (NaN/Infinity) rejected", () => {
    expect(parsePushSubscriptionShape({ ...validRaw, expirationTime: Number.POSITIVE_INFINITY })).toBeNull()
    expect(parsePushSubscriptionShape({ ...validRaw, expirationTime: Number.NaN })).toBeNull()
  })

  test("A12: malformed JSON string rejected", () => {
    expect(parsePushSubscriptionShape("{not-json")).toBeNull()
  })

  test("A13: non-object value rejected", () => {
    expect(parsePushSubscriptionShape(42)).toBeNull()
    expect(parsePushSubscriptionShape(null)).toBeNull()
    expect(parsePushSubscriptionShape(undefined)).toBeNull()
  })

  test("A14: missing keys object rejected", () => {
    const { keys: _keys, ...rest } = validRaw
    expect(parsePushSubscriptionShape(rest)).toBeNull()
  })
})

describe("toNormalizedPushSubscriptionInput", () => {
  test("converts epoch-ms expirationTime to Date (never passes the raw number through)", () => {
    const parsed = parsePushSubscriptionShape({ ...validRaw, expirationTime: 1893456000000 })!
    const normalized = toNormalizedPushSubscriptionInput(parsed)
    expect(normalized?.expirationTime).toBeInstanceOf(Date)
    expect(normalized?.expirationTime?.getTime()).toBe(1893456000000)
  })

  test("null expirationTime stays null", () => {
    const parsed = parsePushSubscriptionShape(validRaw)!
    const normalized = toNormalizedPushSubscriptionInput(parsed)
    expect(normalized?.expirationTime).toBeNull()
  })

  test("carries endpoint/p256dh/auth through unchanged", () => {
    const parsed = parsePushSubscriptionShape(validRaw)!
    const normalized = toNormalizedPushSubscriptionInput(parsed)
    expect(normalized).toEqual({
      endpoint: validRaw.endpoint,
      p256dh: validRaw.keys.p256dh,
      auth: validRaw.keys.auth,
      expirationTime: null,
    })
  })
})

describe("toLegacyPushSubscriptionString (P2-T05 Stage3H3, F-P2-T05-16)", () => {
  test("H3-01: valid string input returns EXACTLY the same string (byte-for-byte, never re-parsed/re-stringified)", () => {
    const raw = JSON.stringify(validRaw)
    const parsed = parsePushSubscriptionShape(raw)!
    expect(toLegacyPushSubscriptionString(raw, parsed)).toBe(raw)
  })

  test("H3-01b: byte-for-byte preserved even when the raw string's formatting differs from canonical stringify (e.g. extra whitespace)", () => {
    const rawWithSpacing = `{ "endpoint": "${validRaw.endpoint}", "expirationTime": null, "keys": { "p256dh": "${validRaw.keys.p256dh}", "auth": "${validRaw.keys.auth}" } }`
    const parsed = parsePushSubscriptionShape(rawWithSpacing)!
    expect(toLegacyPushSubscriptionString(rawWithSpacing, parsed)).toBe(rawWithSpacing)
  })

  test("H3-02: valid parsed object input returns a canonical JSON string, never the object itself", () => {
    const parsed = parsePushSubscriptionShape(validRaw)!
    const result = toLegacyPushSubscriptionString(validRaw, parsed)
    expect(typeof result).toBe("string")
    expect(JSON.parse(result)).toEqual(validRaw)
  })

  test("H3-03: canonical object output contains exactly endpoint/expirationTime/keys.p256dh/keys.auth — no other keys", () => {
    const parsed = parsePushSubscriptionShape(validRaw)!
    const result = JSON.parse(toLegacyPushSubscriptionString(validRaw, parsed))
    expect(Object.keys(result).sort()).toEqual(["endpoint", "expirationTime", "keys"])
    expect(Object.keys(result.keys).sort()).toEqual(["auth", "p256dh"])
  })

  test("H3-04: extra properties on the original object are never persisted in the legacy canonical output", () => {
    const withExtras = {
      ...validRaw,
      ownerId: "attacker-controlled",
      channel: "salon",
      extra: { nested: "should-not-leak" },
    }
    const parsed = parsePushSubscriptionShape(withExtras)!
    const result = JSON.parse(toLegacyPushSubscriptionString(withExtras, parsed))
    expect(result).toEqual(validRaw)
    expect(result.ownerId).toBeUndefined()
    expect(result.channel).toBeUndefined()
    expect(result.extra).toBeUndefined()
  })

  test("H3-05: null expirationTime preserved correctly through object canonicalization", () => {
    const parsed = parsePushSubscriptionShape({ ...validRaw, expirationTime: null })!
    const result = JSON.parse(toLegacyPushSubscriptionString({ ...validRaw, expirationTime: null }, parsed))
    expect(result.expirationTime).toBeNull()
  })

  test("H3-06: finite epoch expirationTime preserved correctly through object canonicalization", () => {
    const original = { ...validRaw, expirationTime: 1893456000000 }
    const parsed = parsePushSubscriptionShape(original)!
    const result = JSON.parse(toLegacyPushSubscriptionString(original, parsed))
    expect(result.expirationTime).toBe(1893456000000)
  })

  test("H3-07: only reachable via an already-validated parsed shape — never called with the output of a rejected/null parse in production call sites", () => {
    // The function's own contract requires a non-null ParsedPushSubscriptionShape
    // as its second argument (TypeScript enforces this at every real call
    // site — both subscribe routes only call it after `if (!parsedShape) return`).
    // This test documents that guarantee: parsing invalid input never
    // produces a shape this helper could be handed.
    expect(parsePushSubscriptionShape({ ...validRaw, endpoint: "" })).toBeNull()
    expect(parsePushSubscriptionShape("{not-json")).toBeNull()
  })
})

describe("extractEndpointForDetach", () => {
  test("extracts endpoint from a valid JSON string", () => {
    expect(extractEndpointForDetach(JSON.stringify(validRaw))).toBe(validRaw.endpoint)
  })

  test("extracts endpoint from a plain object", () => {
    expect(extractEndpointForDetach(validRaw)).toBe(validRaw.endpoint)
  })

  test("returns null for malformed JSON", () => {
    expect(extractEndpointForDetach("{not-json")).toBeNull()
  })

  test("returns null when endpoint is missing/empty — tolerant, never throws", () => {
    expect(extractEndpointForDetach({ keys: validRaw.keys })).toBeNull()
    expect(extractEndpointForDetach({ endpoint: "   " })).toBeNull()
    expect(extractEndpointForDetach(42)).toBeNull()
    expect(extractEndpointForDetach(null)).toBeNull()
  })
})

describe("resolvePushSubscriptionDetachInput / arePushSubscriptionsEquivalent (P2-T05 Stage3H3R1, F-P2-T05-17)", () => {
  test("R1-H01: string input preserves rawString EXACTLY, even with non-canonical formatting", () => {
    const nonCanonical = `{ "keys": { "auth": "${validRaw.keys.auth}", "p256dh": "${validRaw.keys.p256dh}" }, "endpoint": "${validRaw.endpoint}", "expirationTime": null }`
    const result = resolvePushSubscriptionDetachInput(nonCanonical)
    expect(result.rawString).toBe(nonCanonical)
  })

  test("R1-H02: a valid string ALSO resolves a parsed shape and a canonical representation", () => {
    const raw = JSON.stringify(validRaw)
    const result = resolvePushSubscriptionDetachInput(raw)
    expect(result.parsed).toEqual(validRaw)
    expect(result.canonical).not.toBeNull()
    expect(JSON.parse(result.canonical!)).toEqual(validRaw)
    expect(result.endpoint).toBe(validRaw.endpoint)
  })

  test("R1-H03: a valid object resolves rawString=null, parsed shape, canonical string, endpoint", () => {
    const result = resolvePushSubscriptionDetachInput(validRaw)
    expect(result.rawString).toBeNull()
    expect(result.parsed).toEqual(validRaw)
    expect(result.endpoint).toBe(validRaw.endpoint)
    expect(typeof result.canonical).toBe("string")
    expect(JSON.parse(result.canonical!)).toEqual(validRaw)
  })

  test("R1-H04: object canonical strips client-supplied extra properties (ownerId/channel/etc.)", () => {
    const withExtras = { ...validRaw, ownerId: "attacker-controlled", channel: "salon" }
    const result = resolvePushSubscriptionDetachInput(withExtras)
    const canonicalParsed = JSON.parse(result.canonical!)
    expect(Object.keys(canonicalParsed).sort()).toEqual(["endpoint", "expirationTime", "keys"])
    expect(canonicalParsed.ownerId).toBeUndefined()
    expect(canonicalParsed.channel).toBeUndefined()
  })

  test("R1-H05: semantic equivalence ignores property order/whitespace — same fields, different serialization", () => {
    const orderA = parsePushSubscriptionShape(JSON.stringify(validRaw))!
    const orderB = parsePushSubscriptionShape(
      `{ "keys": { "auth": "${validRaw.keys.auth}", "p256dh": "${validRaw.keys.p256dh}" }, "endpoint": "${validRaw.endpoint}", "expirationTime": null }`
    )!
    expect(arePushSubscriptionsEquivalent(orderA, orderB)).toBe(true)
  })

  test("R1-H06: semantic equivalence ignores extra properties not part of the validated shape", () => {
    const base = parsePushSubscriptionShape(validRaw)!
    const withExtras = parsePushSubscriptionShape({ ...validRaw, ownerId: "x", channel: "salon", extra: { nested: true } })!
    expect(arePushSubscriptionsEquivalent(base, withExtras)).toBe(true)
  })

  test("R1-H07: different endpoint => not equivalent", () => {
    const a = parsePushSubscriptionShape(validRaw)!
    const b = parsePushSubscriptionShape({ ...validRaw, endpoint: "https://push.example/OTHER" })!
    expect(arePushSubscriptionsEquivalent(a, b)).toBe(false)
  })

  test("R1-H08: same endpoint but different p256dh => not equivalent (key rotation safety)", () => {
    const a = parsePushSubscriptionShape(validRaw)!
    const b = parsePushSubscriptionShape({ ...validRaw, keys: { ...validRaw.keys, p256dh: "OTHER_P256DH" } })!
    expect(arePushSubscriptionsEquivalent(a, b)).toBe(false)
  })

  test("R1-H09: same endpoint but different auth => not equivalent (key rotation safety)", () => {
    const a = parsePushSubscriptionShape(validRaw)!
    const b = parsePushSubscriptionShape({ ...validRaw, keys: { ...validRaw.keys, auth: "OTHER_AUTH" } })!
    expect(arePushSubscriptionsEquivalent(a, b)).toBe(false)
  })

  test("R1-H10: different expirationTime => not equivalent", () => {
    const a = parsePushSubscriptionShape({ ...validRaw, expirationTime: null })!
    const b = parsePushSubscriptionShape({ ...validRaw, expirationTime: 1893456000000 })!
    expect(arePushSubscriptionsEquivalent(a, b)).toBe(false)
  })

  test("R1-H11: malformed string preserves raw-exact compatibility, never a fabricated semantic match", () => {
    const result = resolvePushSubscriptionDetachInput("{not-json")
    expect(result.rawString).toBe("{not-json")
    expect(result.parsed).toBeNull()
    expect(result.canonical).toBeNull()
    expect(result.endpoint).toBeNull()
  })

  test("R1-H12: invalid object (fails full shape validation) resolves to all-null — fail-closed, never tolerated", () => {
    const result = resolvePushSubscriptionDetachInput({ foo: "bar" })
    expect(result.rawString).toBeNull()
    expect(result.parsed).toBeNull()
    expect(result.canonical).toBeNull()
    expect(result.endpoint).toBeNull()
  })

  test("R1-H13: missing/primitive input resolves to all-null", () => {
    expect(resolvePushSubscriptionDetachInput(undefined)).toEqual({ rawString: null, parsed: null, endpoint: null, canonical: null })
    expect(resolvePushSubscriptionDetachInput(null)).toEqual({ rawString: null, parsed: null, endpoint: null, canonical: null })
    expect(resolvePushSubscriptionDetachInput(42)).toEqual({ rawString: null, parsed: null, endpoint: null, canonical: null })
    expect(resolvePushSubscriptionDetachInput([validRaw])).toEqual({ rawString: null, parsed: null, endpoint: null, canonical: null })
  })
})
