// Logout-B1 (P0 rollout-safe Phase O2): fully isolated unit tests for the
// canonical operative push-ownership client helper. No real browser, no
// real Service Worker, no real network — navigator/window/fetch are
// stubbed directly on globalThis per test (this module has no @/lib/*
// imports to intercept via mock.module).
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { getCurrentOperativePushSubscription, performOperativeLogout } from "./operativo-logout"

// Synthetic PushSubscription-like object. JSON.stringify(subscription)
// invokes toJSON() exactly like the browser's native PushSubscription does
// (per the Push API spec: endpoint, expirationTime, keys{p256dh,auth}) —
// this proves capture serialization parity directly, not by assumption.
function makeSubscription(endpoint = "https://push.example.test/synthetic-abc123") {
  const json = {
    endpoint,
    expirationTime: null,
    keys: { p256dh: "synthetic-p256dh", auth: "synthetic-auth" },
  }
  return {
    ...json,
    unsubscribe: mock(async () => true),
    toJSON: () => json,
  }
}

type FakeRegistration = { pushManager: { getSubscription: () => Promise<unknown> } } | null

function installBrowserGlobals(opts: {
  supportsServiceWorker?: boolean
  supportsPushManager?: boolean
  registration?: FakeRegistration
  getRegistrationThrows?: Error
}) {
  const supportsServiceWorker = opts.supportsServiceWorker ?? true
  const supportsPushManager = opts.supportsPushManager ?? true

  ;(globalThis as unknown as { window: unknown }).window = supportsPushManager
    ? { PushManager: function PushManager() {} }
    : {}

  const serviceWorker = supportsServiceWorker
    ? {
        getRegistration: async (_scope: string) => {
          if (opts.getRegistrationThrows) throw opts.getRegistrationThrows
          return opts.registration ?? null
        },
      }
    : undefined

  ;(globalThis as unknown as { navigator: unknown }).navigator = supportsServiceWorker
    ? { serviceWorker }
    : {}
}

function setGlobal(name: "window" | "navigator" | "fetch", value: unknown) {
  ;(globalThis as unknown as Record<string, unknown>)[name] = value
}

function getGlobal(name: "window" | "navigator" | "fetch"): unknown {
  return (globalThis as unknown as Record<string, unknown>)[name]
}

let originalWindow: unknown
let originalNavigator: unknown
let originalFetch: unknown

beforeEach(() => {
  originalWindow = getGlobal("window")
  originalNavigator = getGlobal("navigator")
  originalFetch = getGlobal("fetch")
})

afterEach(() => {
  setGlobal("window", originalWindow)
  setGlobal("navigator", originalNavigator)
  setGlobal("fetch", originalFetch)
})

describe("getCurrentOperativePushSubscription — capture only, never mutates", () => {
  test("subscription exists: returns the exact canonical JSON.stringify(subscription) string", async () => {
    const subscription = makeSubscription()
    installBrowserGlobals({ registration: { pushManager: { getSubscription: async () => subscription } } })

    const result = await getCurrentOperativePushSubscription()

    expect(result).toBe(JSON.stringify(subscription))
    expect(subscription.unsubscribe).not.toHaveBeenCalled()
  })

  test("no window/serviceWorker support at all: returns null", async () => {
    setGlobal("window", undefined)
    setGlobal("navigator", undefined)

    expect(await getCurrentOperativePushSubscription()).toBeNull()
  })

  test("serviceWorker not in navigator: returns null", async () => {
    installBrowserGlobals({ supportsServiceWorker: false })
    expect(await getCurrentOperativePushSubscription()).toBeNull()
  })

  test("PushManager not in window: returns null", async () => {
    installBrowserGlobals({ supportsPushManager: false, registration: { pushManager: { getSubscription: async () => makeSubscription() } } })
    expect(await getCurrentOperativePushSubscription()).toBeNull()
  })

  test("no registration for this scope: returns null", async () => {
    installBrowserGlobals({ registration: null })
    expect(await getCurrentOperativePushSubscription()).toBeNull()
  })

  test("registration exists but no active subscription: returns null", async () => {
    installBrowserGlobals({ registration: { pushManager: { getSubscription: async () => null } } })
    expect(await getCurrentOperativePushSubscription()).toBeNull()
  })

  test("getRegistration throws: swallowed, returns null (no exception escapes)", async () => {
    installBrowserGlobals({ getRegistrationThrows: new Error("simulated Service Worker failure") })
    expect(await getCurrentOperativePushSubscription()).toBeNull()
  })
})

describe("performOperativeLogout — exactly one server request, never throws", () => {
  test("subscription present: exactly one POST with the exact JSON body and headers", async () => {
    const subscription = makeSubscription()
    installBrowserGlobals({ registration: { pushManager: { getSubscription: async () => subscription } } })

    const calls: Array<{ url: string; init: RequestInit }> = []
    setGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    })

    await performOperativeLogout()

    expect(calls.length).toBe(1)
    expect(calls[0].url).toBe("/api/operativo/logout")
    expect(calls[0].init.method).toBe("POST")
    expect(calls[0].init.cache).toBe("no-store")
    expect(calls[0].init.headers).toEqual({ "Content-Type": "application/json" })
    expect(calls[0].init.body).toBe(JSON.stringify({ subscription: JSON.stringify(subscription) }))
    expect(subscription.unsubscribe).not.toHaveBeenCalled()
  })

  test("no subscription available: exactly one POST without a fabricated body", async () => {
    installBrowserGlobals({ registration: null })

    const calls: Array<{ url: string; init: RequestInit }> = []
    setGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    })

    await performOperativeLogout()

    expect(calls.length).toBe(1)
    expect(calls[0].url).toBe("/api/operativo/logout")
    expect(calls[0].init.method).toBe("POST")
    expect(calls[0].init.body).toBeUndefined()
    expect(calls[0].init.headers).toBeUndefined()
  })

  test("capture failure (Service Worker throws): logout POST is still attempted exactly once", async () => {
    installBrowserGlobals({ getRegistrationThrows: new Error("simulated Service Worker failure") })

    let callCount = 0
    setGlobal("fetch", async () => {
      callCount += 1
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    })

    await expect(performOperativeLogout()).resolves.toBeUndefined()
    expect(callCount).toBe(1)
  })

  test("fetch rejects (network failure): does not throw to the caller, no retry", async () => {
    installBrowserGlobals({ registration: null })

    let callCount = 0
    setGlobal("fetch", async () => {
      callCount += 1
      throw new Error("simulated network failure")
    })

    await expect(performOperativeLogout()).resolves.toBeUndefined()
    expect(callCount).toBe(1)
  })

  test("fetch resolves non-2xx: does not throw to the caller, no retry", async () => {
    installBrowserGlobals({ registration: null })

    let callCount = 0
    setGlobal("fetch", async () => {
      callCount += 1
      return new Response(JSON.stringify({ ok: false }), { status: 500 })
    })

    await expect(performOperativeLogout()).resolves.toBeUndefined()
    expect(callCount).toBe(1)
  })

  test("Policy A: never calls PushSubscription.unsubscribe() on the captured subscription", async () => {
    const subscription = makeSubscription()
    installBrowserGlobals({ registration: { pushManager: { getSubscription: async () => subscription } } })
    setGlobal("fetch", async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))

    await performOperativeLogout()

    expect(subscription.unsubscribe).not.toHaveBeenCalled()
  })
})
