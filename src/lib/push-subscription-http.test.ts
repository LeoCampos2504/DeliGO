// P2-T05 Stage3 (F-P2-T05-01): unit tests for the shared HTTP
// PushSubscription shape parser/normalizer. Pure functions, no DB, no mocks.
import { describe, expect, test } from "bun:test"
import {
  extractEndpointForDetach,
  parsePushSubscriptionShape,
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
