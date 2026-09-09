// P2-T31-R6 (INTERMITTENT-IPHONE-PUSH-LIFECYCLE-DIAGNOSTIC): pure unit tests —
// no browser, no DOM, no network — same style as push-personal-status-check.test.ts.
import { describe, expect, test } from "bun:test"
import {
  collectPushDebugSnapshot,
  fingerprintActorId,
  fingerprintPushEndpoint,
  formatPushDebugSnapshot,
  type PushDebugSnapshotDeps,
} from "./push-debug-snapshot"

function baseDeps(overrides: Partial<PushDebugSnapshotDeps> = {}): PushDebugSnapshotDeps {
  return {
    now: () => "2026-09-05T00:00:00.000Z",
    actorFamily: "cliente",
    authHasHydrated: true,
    pathname: "/cliente/perfil",
    visibilityState: "visible",
    permission: "granted",
    serviceWorkerSupported: true,
    pushManagerSupported: true,
    getRegistrationInfo: async () => ({ exists: true, activeState: "activated" }),
    getCurrentSubscription: async () => ({
      endpoint: "https://push.example/abc123",
      options: { applicationServerKey: new Uint8Array([1, 2, 3]).buffer },
      toJSON: () => ({
        endpoint: "https://push.example/abc123",
        expirationTime: null,
        keys: { p256dh: "p", auth: "a" },
      }),
    }),
    fetchVapidKey: async () => "current-vapid-key",
    applicationServerKeyMatches: () => true,
    fetchBackendStatus: async () => ({ httpStatus: 200, subscribed: true }),
    mutationInFlight: false,
    hookIsSubscribed: true,
    hookLoading: false,
    uiSwitch: true,
    ...overrides,
  }
}

// P2-T31-R7 (DEBUG HYGIENE): F-P2-T31-RAW-ACTOR-ID-EXPOSED-01 — a physical
// trace Leonardo copied showed `actorFamily=cliente:<raw internal id>`
// because the panel used to pass the composite `${family}:${id}` key
// straight into this field. `actorFingerprint` is the safe replacement for
// distinguishing "same actor" across two captures.
describe("fingerprintActorId", () => {
  test("deterministic — same actor id always produces the same fingerprint", () => {
    const a = fingerprintActorId("cliente-internal-id-12345")
    const b = fingerprintActorId("cliente-internal-id-12345")
    expect(a).toBe(b)
  })

  test("different actor ids produce different fingerprints", () => {
    const a = fingerprintActorId("actor-A")
    const b = fingerprintActorId("actor-B")
    expect(a).not.toBe(b)
  })

  test("never includes any substring of the real actor id", () => {
    const actorId = "cliente-internal-db-id-abcdef123456"
    const fp = fingerprintActorId(actorId)
    expect(actorId).not.toContain(fp)
    expect(fp.length).toBe(8)
  })

  test("is 8 lowercase hex characters, same shape as fingerprintPushEndpoint", () => {
    expect(fingerprintActorId("any-id")).toMatch(/^[0-9a-f]{8}$/)
  })
})

describe("fingerprintPushEndpoint", () => {
  test("deterministic — same input always produces the same fingerprint", () => {
    const a = fingerprintPushEndpoint("https://push.example/abc123")
    const b = fingerprintPushEndpoint("https://push.example/abc123")
    expect(a).toBe(b)
  })

  test("different endpoints produce different fingerprints", () => {
    const a = fingerprintPushEndpoint("https://push.example/abc123")
    const b = fingerprintPushEndpoint("https://push.example/xyz789")
    expect(a).not.toBe(b)
  })

  test("never includes any substring of the real endpoint", () => {
    const endpoint = "https://fcm.googleapis.com/fcm/send/super-secret-token-123456"
    const fp = fingerprintPushEndpoint(endpoint)
    expect(endpoint).not.toContain(fp)
    expect(fp.length).toBe(8)
  })

  test("is 8 lowercase hex characters", () => {
    const fp = fingerprintPushEndpoint("anything")
    expect(fp).toMatch(/^[0-9a-f]{8}$/)
  })
})

describe("collectPushDebugSnapshot — happy path", () => {
  test("reports every field truthfully from a fully-healthy set of deps", async () => {
    const snapshot = await collectPushDebugSnapshot(baseDeps())
    expect(snapshot.actorFamily).toBe("cliente")
    expect(snapshot.authHasHydrated).toBe(true)
    expect(snapshot.registrationExists).toBe(true)
    expect(snapshot.registrationActiveState).toBe("activated")
    expect(snapshot.physicalSubscription).toBe(true)
    expect(snapshot.existingKeyPresent).toBe(true)
    expect(snapshot.vapidFetched).toBe(true)
    expect(snapshot.vapidMatch).toBe("true")
    expect(snapshot.backendStatusHttp).toBe("200")
    expect(snapshot.backendSubscribed).toBe("true")
    expect(snapshot.hookSubscribed).toBe(true)
    expect(snapshot.hookLoading).toBe(false)
    expect(snapshot.mutationInFlight).toBe(false)
    expect(snapshot.uiSwitch).toBe(true)
    expect(snapshot.error).toBe("none")
  })

  test("P2-T31-R7: actorFingerprint defaults to 'n/a' when the caller doesn't supply one", async () => {
    const snapshot = await collectPushDebugSnapshot(baseDeps())
    expect(snapshot.actorFingerprint).toBe("n/a")
  })

  test("P2-T31-R7: actorFingerprint round-trips the caller-supplied fingerprint, never the raw actor id", async () => {
    const fp = fingerprintActorId("cliente-internal-db-id-999")
    const snapshot = await collectPushDebugSnapshot(baseDeps({ actorFingerprint: fp }))
    expect(snapshot.actorFingerprint).toBe(fp)
    expect(JSON.stringify(snapshot)).not.toContain("cliente-internal-db-id-999")
  })

  test("never includes the real endpoint anywhere in the snapshot", async () => {
    const snapshot = await collectPushDebugSnapshot(baseDeps())
    const serialized = JSON.stringify(snapshot)
    expect(serialized).not.toContain("https://push.example/abc123")
  })
})

describe("collectPushDebugSnapshot — no physical subscription", () => {
  test("physicalSubscription=false, downstream VAPID/backend fields become n/a instead of guessing", async () => {
    const snapshot = await collectPushDebugSnapshot(
      baseDeps({ getCurrentSubscription: async () => null, hookIsSubscribed: false, uiSwitch: false })
    )
    expect(snapshot.physicalSubscription).toBe(false)
    expect(snapshot.endpointFingerprint).toBe("n/a")
    expect(snapshot.existingKeyPresent).toBe(false)
    expect(snapshot.vapidMatch).toBe("n/a")
    expect(snapshot.backendStatusHttp).toBe("n/a")
    expect(snapshot.backendSubscribed).toBe("n/a")
    expect(snapshot.error).toBe("none")
  })
})

describe("collectPushDebugSnapshot — unsupported browser", () => {
  test("serviceWorker unsupported: never calls getRegistrationInfo, reports registrationExists=false", async () => {
    let called = false
    const snapshot = await collectPushDebugSnapshot(
      baseDeps({
        serviceWorkerSupported: false,
        getRegistrationInfo: async () => {
          called = true
          return { exists: true, activeState: "activated" }
        },
      })
    )
    expect(called).toBe(false)
    expect(snapshot.registrationExists).toBe(false)
    expect(snapshot.registrationActiveState).toBe("null")
  })

  test("PushManager unsupported: never calls getCurrentSubscription, reports physicalSubscription=false", async () => {
    let called = false
    const snapshot = await collectPushDebugSnapshot(
      baseDeps({
        pushManagerSupported: false,
        getCurrentSubscription: async () => {
          called = true
          return null
        },
      })
    )
    expect(called).toBe(false)
    expect(snapshot.physicalSubscription).toBe(false)
  })
})

describe("collectPushDebugSnapshot — per-layer failure isolation", () => {
  test("registration read throwing does not prevent the rest of the snapshot from being collected", async () => {
    const snapshot = await collectPushDebugSnapshot(
      baseDeps({
        getRegistrationInfo: async () => {
          throw new Error("boom")
        },
      })
    )
    expect(snapshot.registrationExists).toBe(false)
    expect(snapshot.physicalSubscription).toBe(true) // unaffected
    expect(snapshot.error).toContain("registration:Error")
  })

  test("VAPID fetch throwing leaves vapidFetched=false and vapidMatch=n/a, backend read still runs", async () => {
    const snapshot = await collectPushDebugSnapshot(
      baseDeps({
        fetchVapidKey: async () => {
          throw new Error("network down")
        },
      })
    )
    expect(snapshot.vapidFetched).toBe(false)
    expect(snapshot.vapidMatch).toBe("n/a")
    expect(snapshot.backendStatusHttp).toBe("200") // backend read is independent
    expect(snapshot.error).toContain("vapid:Error")
  })

  test("backend status fetch throwing is captured as backendStatusHttp=error, rest of snapshot intact", async () => {
    const snapshot = await collectPushDebugSnapshot(
      baseDeps({
        fetchBackendStatus: async () => {
          throw new Error("fetch failed")
        },
      })
    )
    expect(snapshot.backendStatusHttp).toBe("error")
    expect(snapshot.backendSubscribed).toBe("n/a")
    expect(snapshot.physicalSubscription).toBe(true)
    expect(snapshot.error).toContain("backend:Error")
  })

  test("multiple simultaneous layer failures are all captured, joined, none swallowed", async () => {
    const snapshot = await collectPushDebugSnapshot(
      baseDeps({
        getRegistrationInfo: async () => {
          throw new Error("reg-fail")
        },
        fetchVapidKey: async () => {
          throw new Error("vapid-fail")
        },
      })
    )
    expect(snapshot.error).toContain("registration:Error")
    expect(snapshot.error).toContain("vapid:Error")
  })
})

describe("collectPushDebugSnapshot — never mutates", () => {
  test("does not call subscribe/unsubscribe — deps contract only exposes reads", async () => {
    // Structural guarantee: PushDebugSnapshotDeps has no subscribe/unsubscribe
    // field at all, so there is nothing mutating for this function to call
    // even by mistake — verified by TypeScript at compile time. This test
    // documents that guarantee for a reader who only sees .test.ts files.
    const deps = baseDeps()
    expect((deps as unknown as Record<string, unknown>).subscribe).toBeUndefined()
    expect((deps as unknown as Record<string, unknown>).unsubscribe).toBeUndefined()
  })
})

describe("formatPushDebugSnapshot", () => {
  test("produces the exact KEY=value line format from the R6 spec", async () => {
    const snapshot = await collectPushDebugSnapshot(baseDeps())
    const text = formatPushDebugSnapshot(snapshot)
    const lines = text.split("\n")
    expect(lines[0]).toBe("PUSH_DEBUG_VERSION=1")
    for (const key of [
      "timestamp",
      "actorFamily",
      "actorFingerprint",
      "path",
      "visibility",
      "permission",
      "swSupported",
      "physicalSubscription",
      "endpointFingerprint",
      "existingKeyPresent",
      "vapidFetched",
      "vapidMatch",
      "backendStatusHttp",
      "backendSubscribed",
      "hookSubscribed",
      "mutationInFlight",
      "uiSwitch",
      "error",
    ]) {
      expect(lines.some((l) => l.startsWith(`${key}=`))).toBe(true)
    }
  })

  test("never contains the literal substring 'endpoint=' followed by an https URL", async () => {
    const snapshot = await collectPushDebugSnapshot(baseDeps())
    const text = formatPushDebugSnapshot(snapshot)
    expect(text).not.toMatch(/https?:\/\//)
  })
})
