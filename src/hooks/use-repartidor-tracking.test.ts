// ============================================
// P2-T02 (P2T02-MODEL-E1) — useRepartidorTracking: watchPosition-based
// producer, movement/accuracy filtering, sample freshness, explicit
// pending-send scheduler, fresh-acquisition single-flight, stationary
// heartbeat, generation guard, and P2-T01 eligibility gate regression.
// ============================================
// Real DOM (happy-dom) + a real React commit cycle, same pattern as
// use-chat-message-presentation-commit.test.ts (registered per-file,
// restored in afterAll so no other test file is affected).
//
// Both `navigator.geolocation.{watchPosition,clearWatch,getCurrentPosition}`
// and global `setTimeout`/`clearTimeout` are replaced with controllable
// stand-ins so every timing decision (MIN_SEND_INTERVAL_MS,
// STATIONARY_HEARTBEAT_MS, SAMPLE_REUSE_MAX_AGE_MS) can be driven
// deterministically via a mocked `Date.now()` clock instead of real waits.
import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { GlobalRegistrator } from "@happy-dom/global-registrator"

GlobalRegistrator.register()
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

afterAll(() => {
  GlobalRegistrator.unregister()
})

const React = await import("react")
const { createRoot } = await import("react-dom/client")
const { useRepartidorTracking } = await import("./use-repartidor-tracking")

const { act } = React

interface ActiveDelivery {
  id: string
  estado: string
  repartidorId?: string | null
  trackingEligibleNow?: boolean
}

type HookApi = ReturnType<typeof useRepartidorTracking>

function delivery(id: string, overrides: Partial<ActiveDelivery> = {}): ActiveDelivery {
  return { id, estado: "en_camino", repartidorId: "repartidor-1", trackingEligibleNow: true, ...overrides }
}

// --- Controllable clock (Date.now) ------------------------------------------
let mockNowMs: number
const realDateNow = Date.now

function setMockNow(ms: number) {
  mockNowMs = ms
}

// --- Controllable global setTimeout/clearTimeout ----------------------------
interface FakeTimer {
  id: number
  fireAt: number
  delay: number
  callback: () => void
  cleared: boolean
  fired: boolean
}
let fakeTimers: FakeTimer[]
let nextTimerId: number
const realSetTimeout = globalThis.setTimeout
const realClearTimeout = globalThis.clearTimeout

// Distinguishes the explicit pending-send scheduler's timer (always
// <= MIN_SEND_INTERVAL_MS=5000) from the stationary heartbeat's timer
// (STATIONARY_HEARTBEAT_MS=60000, or a shorter "remaining" on foreground
// recovery) and the P2-T02 Stage 6J foreground-watchdog timer (a fixed
// FOREGROUND_WATCHDOG_WINDOW_MS=75000 — must match the hook's own constant
// exactly) purely by the delay it was scheduled with — the hook itself has
// no test-only tagging, this is inferred the same way an outside observer
// (a real browser's timer queue) would have to.
const FOREGROUND_WATCHDOG_WINDOW_MS = 75000

function pendingSendTimerCount(): number {
  return fakeTimers.filter((t) => !t.cleared && !t.fired && t.delay <= 5000).length
}

function heartbeatTimerCount(): number {
  return fakeTimers.filter(
    (t) => !t.cleared && !t.fired && t.delay > 5000 && t.delay !== FOREGROUND_WATCHDOG_WINDOW_MS
  ).length
}

function watchdogTimerCount(): number {
  return fakeTimers.filter((t) => !t.cleared && !t.fired && t.delay === FOREGROUND_WATCHDOG_WINDOW_MS).length
}

// Advances the mocked clock by `ms` and fires (in fireAt order, draining any
// timer newly scheduled by a fired callback with an already-due fireAt) every
// non-cleared timer whose fireAt is now <= the advanced clock.
function advanceTime(ms: number) {
  mockNowMs += ms
  act(() => {
    let fired = true
    while (fired) {
      fired = false
      const due = fakeTimers
        .filter((t) => !t.cleared && !t.fired && t.fireAt <= mockNowMs)
        .sort((a, b) => a.fireAt - b.fireAt)
      for (const t of due) {
        t.fired = true
        t.callback()
        fired = true
      }
    }
  })
}

// --- Controllable navigator.geolocation -------------------------------------
const GEO_ERROR_CODES = { PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as const
function makeGeoError(code: number) {
  return { code, ...GEO_ERROR_CODES }
}

interface WatchRegistration {
  id: number
  success: (pos: unknown) => void
  error: (err: unknown) => void
}
let watchRegistrations: Map<number, WatchRegistration>
let nextWatchId: number
let watchPositionMock: ReturnType<typeof mock>
let clearWatchMock: ReturnType<typeof mock>
let getCurrentPositionMock: ReturnType<typeof mock>

function activeWatchCount(): number {
  return watchRegistrations.size
}

function lastWatchId(): number {
  const ids = [...watchRegistrations.keys()]
  return ids[ids.length - 1]
}

function fireWatchSuccess(watchId: number, lat = -34.6, lng = -58.4, accuracy = 10, timestamp = mockNowMs) {
  const reg = watchRegistrations.get(watchId)
  if (!reg) throw new Error(`no watch registered with id ${watchId}`)
  act(() => reg.success({ coords: { latitude: lat, longitude: lng, accuracy }, timestamp }))
}

function fireWatchError(watchId: number, code: number) {
  const reg = watchRegistrations.get(watchId)
  if (!reg) throw new Error(`no watch registered with id ${watchId}`)
  act(() => reg.error(makeGeoError(code)))
}

function resolveNextFreshAcquisition(lat = -34.6, lng = -58.4, accuracy = 10, timestamp = mockNowMs) {
  const calls = getCurrentPositionMock.mock.calls
  const [success] = calls[calls.length - 1] as [(pos: unknown) => void, (err: unknown) => void]
  act(() => success({ coords: { latitude: lat, longitude: lng, accuracy }, timestamp }))
}

async function resolveNextFreshAcquisitionAsync(lat = -34.6, lng = -58.4, accuracy = 10, timestamp = mockNowMs) {
  const calls = getCurrentPositionMock.mock.calls
  const [success] = calls[calls.length - 1] as [(pos: unknown) => void, (err: unknown) => void]
  await act(async () => {
    success({ coords: { latitude: lat, longitude: lng, accuracy }, timestamp })
    await Promise.resolve()
    await Promise.resolve()
  })
}

async function rejectNextFreshAcquisitionAsync(code = GEO_ERROR_CODES.POSITION_UNAVAILABLE) {
  const calls = getCurrentPositionMock.mock.calls
  const [, error] = calls[calls.length - 1] as [unknown, (err: unknown) => void]
  await act(async () => {
    error(makeGeoError(code))
    await Promise.resolve()
    await Promise.resolve()
  })
}

// --- Controllable global fetch -----------------------------------------------
let pendingFetchResolvers: Array<(res: Response) => void>
let pendingFetchRejecters: Array<(err: unknown) => void>
let fetchMock: ReturnType<typeof mock>

async function resolveNextFetch(status: number) {
  const resolve = pendingFetchResolvers.shift()
  pendingFetchRejecters.shift()
  if (!resolve) throw new Error("no pending fetch call to resolve")
  await act(async () => {
    resolve(new Response(JSON.stringify({}), { status }))
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

async function rejectNextFetch() {
  pendingFetchResolvers.shift()
  const reject = pendingFetchRejecters.shift()
  if (!reject) throw new Error("no pending fetch call to reject")
  await act(async () => {
    reject(new Error("simulated network error"))
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

function fetchedPedidoIds(): string[] {
  return fetchMock.mock.calls.map((call: unknown[]) => {
    const [, init] = call as [string, { body: string }]
    return (JSON.parse(init.body) as { pedidoId: string }).pedidoId
  })
}

function fetchCallCountFor(pedidoId: string): number {
  return fetchedPedidoIds().filter((id) => id === pedidoId).length
}

beforeEach(() => {
  setMockNow(1_000_000)
  Date.now = () => mockNowMs

  fakeTimers = []
  nextTimerId = 1
  globalThis.setTimeout = ((cb: () => void, delay?: number) => {
    const id = nextTimerId++
    fakeTimers.push({ id, fireAt: mockNowMs + (delay ?? 0), delay: delay ?? 0, callback: cb, cleared: false, fired: false })
    return id as unknown as ReturnType<typeof setTimeout>
  }) as unknown as typeof setTimeout
  globalThis.clearTimeout = ((id: unknown) => {
    const t = fakeTimers.find((t) => t.id === id)
    if (t) t.cleared = true
  }) as unknown as typeof clearTimeout

  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true })

  watchRegistrations = new Map()
  nextWatchId = 1
  watchPositionMock = mock((success: (pos: unknown) => void, error: (err: unknown) => void) => {
    const id = nextWatchId++
    watchRegistrations.set(id, { id, success, error })
    return id
  })
  clearWatchMock = mock((id: number) => {
    watchRegistrations.delete(id)
  })
  getCurrentPositionMock = mock(() => {})
  Object.defineProperty(globalThis, "navigator", {
    value: {
      geolocation: {
        watchPosition: watchPositionMock,
        clearWatch: clearWatchMock,
        getCurrentPosition: getCurrentPositionMock,
      },
    },
    configurable: true,
    writable: true,
  })

  pendingFetchResolvers = []
  pendingFetchRejecters = []
  fetchMock = mock(
    () =>
      new Promise<Response>((resolve, reject) => {
        pendingFetchResolvers.push(resolve)
        pendingFetchRejecters.push(reject)
      })
  )
  globalThis.fetch = fetchMock as unknown as typeof fetch
})

afterEach(() => {
  globalThis.setTimeout = realSetTimeout
  globalThis.clearTimeout = realClearTimeout
  Date.now = realDateNow
})

function createController() {
  let latestApi: HookApi | null = null
  const hostDiv = document.createElement("div")
  document.body.appendChild(hostDiv)
  const root = createRoot(hostDiv)

  function Harness({ deliveries }: { deliveries: ActiveDelivery[] }) {
    const api = useRepartidorTracking(deliveries)
    React.useEffect(() => {
      latestApi = api
    })
    return null
  }

  function render(deliveries: ActiveDelivery[]) {
    act(() => {
      root.render(React.createElement(Harness, { deliveries }))
    })
  }

  function unmount() {
    act(() => {
      root.unmount()
    })
    hostDiv.remove()
  }

  return { render, unmount, getApi: () => latestApi as HookApi }
}

let controller: ReturnType<typeof createController> | null = null

afterEach(() => {
  controller?.unmount()
  controller = null
})

// ============================================
// T01-T05 — watcher lifecycle + initial send
// ============================================
describe("T01-T05 — watcher lifecycle + initial send", () => {
  test("T01: zero eligible deliveries -> zero watch / zero GPS acquisition", () => {
    controller = createController()
    controller.render([delivery("p1", { trackingEligibleNow: false })])
    expect(watchPositionMock).toHaveBeenCalledTimes(0)
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(0)
  })

  test("T02: one eligible delivery -> exactly one physical watch", () => {
    controller = createController()
    controller.render([delivery("p1")])
    expect(watchPositionMock).toHaveBeenCalledTimes(1)
    expect(activeWatchCount()).toBe(1)
  })

  test("T03: rerender with the same eligibility set -> no duplicate watch", () => {
    controller = createController()
    controller.render([delivery("p1")])
    expect(watchPositionMock).toHaveBeenCalledTimes(1)
    controller.render([delivery("p1")])
    expect(watchPositionMock).toHaveBeenCalledTimes(1)
  })

  test("T04: React Strict Mode mount->cleanup->remount leaves exactly one live watch, no duplicate timers", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    expect(watchPositionMock).toHaveBeenCalledTimes(1)
    const firstWatchId = lastWatchId()

    // Simulate a Strict Mode style unmount+remount.
    controller.unmount()
    expect(clearWatchMock).toHaveBeenCalledWith(firstWatchId)
    expect(activeWatchCount()).toBe(0)

    controller = createController()
    controller.render([delivery("p1")])
    expect(watchPositionMock).toHaveBeenCalledTimes(2)
    expect(activeWatchCount()).toBe(1)

    // A callback from the FIRST (now-cleared) watch must be ignored — wrong
    // watchId entirely (clearWatch already removed it from the registry).
    expect(watchRegistrations.has(firstWatchId)).toBe(false)
  })

  test("T05: first watch callback -> the first delivery receives an initial POST", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId = lastWatchId()

    fireWatchSuccess(watchId, -1, -2, 10)
    await act(async () => {
      await Promise.resolve()
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchedPedidoIds()).toEqual(["p1"])
  })
})

// Establishes p1 with a confirmed lastSentSample at the current mock clock —
// reused as a starting point by most of the movement/heartbeat tests below.
//
// Mounting an eligible delivery always also fires the mount effect's own
// `ensureInitialSendForDelivery` (since `latestObservedSample` starts null,
// it goes through the fresh-acquisition one-shot). That one-shot is almost
// always beaten by the direct `fireWatchSuccess` below, so it's left
// resolving in-flight here — exactly like a real browser's
// `getCurrentPosition` always eventually calls back (never hangs forever).
// Settling it explicitly keeps `getCurrentPositionMock`'s call count clean
// for later assertions; the implementation's own "already has a
// lastSentSample" guard makes this late resolution a safe no-op.
async function sendInitialAndResolve(pedidoId: string, watchId: number, lat: number, lng: number, accuracy = 10) {
  fireWatchSuccess(watchId, lat, lng, accuracy)
  await act(async () => {
    await Promise.resolve()
  })
  await resolveNextFetch(200)
  if (getCurrentPositionMock.mock.calls.length > 0) {
    await resolveNextFreshAcquisitionAsync(lat, lng, accuracy)
  }
  // Settled and irrelevant to what the test does next — reset the call
  // count so later assertions measure only NEW fresh-acquisition calls
  // triggered by the test's own subsequent actions.
  getCurrentPositionMock.mockClear()
}

// ============================================
// T06-T10 — movement filter + latest-sample-only pending coalescing
// ============================================
describe("T06-T10 — movement filter + pending coalescing", () => {
  test("T06: stationary jitter under the effective threshold -> no repeated POST", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId = lastWatchId()
    await sendInitialAndResolve("p1", watchId, -34.6, -58.4, 5)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    advanceTime(6000) // clear MIN_SEND_INTERVAL_MS so throttle is never the reason for suppression
    fireWatchSuccess(watchId, -34.59996, -58.4, 5) // ~5m north, well under max(15, 5+5)
    await act(async () => {
      await Promise.resolve()
    })
    expect(fetchMock).toHaveBeenCalledTimes(1) // still just the initial send
    expect(pendingSendTimerCount()).toBe(0)
  })

  test("T07: apparent movement fully explained by poor accuracy -> suppressed", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId = lastWatchId()
    await sendInitialAndResolve("p1", watchId, -34.6, -58.4, 40)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    advanceTime(6000)
    fireWatchSuccess(watchId, -34.59996, -58.4, 40) // ~5m, threshold is 40+40=80
    await act(async () => {
      await Promise.resolve()
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test("T08: significant real movement -> immediate POST once throttle allows it", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId = lastWatchId()
    await sendInitialAndResolve("p1", watchId, -34.6, -58.4, 5)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    advanceTime(6000)
    fireWatchSuccess(watchId, -34.59, -58.4, 5) // ~1.1km north
    await act(async () => {
      await Promise.resolve()
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchedPedidoIds()).toEqual(["p1", "p1"])
  })

  test("T09: a meaningful callback before MIN_SEND_INTERVAL_MS is throttled, not dropped — sends at the earliest allowed time", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId = lastWatchId()
    await sendInitialAndResolve("p1", watchId, -34.6, -58.4, 5)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    advanceTime(2000) // still within the 5000ms throttle window
    fireWatchSuccess(watchId, -34.59, -58.4, 5) // significant movement
    expect(fetchMock).toHaveBeenCalledTimes(1) // not sent yet — pending
    expect(pendingSendTimerCount()).toBe(1)

    advanceTime(3000) // reaches earliestNextSendAt (5000ms since the initial send)
    await act(async () => {
      await Promise.resolve()
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  test("T10: the latest meaningful sample replaces an older pending one — no FIFO", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId = lastWatchId()
    await sendInitialAndResolve("p1", watchId, -34.6, -58.4, 5)

    advanceTime(1000)
    fireWatchSuccess(watchId, -34.59, -58.4, 5) // first pending candidate
    expect(pendingSendTimerCount()).toBe(1)

    advanceTime(1000)
    fireWatchSuccess(watchId, -34.58, -58.4, 5) // replaces the pending sample — still exactly one timer
    expect(pendingSendTimerCount()).toBe(1)

    advanceTime(3000) // now at 5000ms since the initial send
    await act(async () => {
      await Promise.resolve()
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [, init] = fetchMock.mock.calls[1] as [string, { body: string }]
    const body = JSON.parse(init.body) as { lat: number }
    expect(body.lat).toBe(-34.58) // the newest pending sample, not the first
  })
})

// ============================================
// T11-T12 — stationary heartbeat + new delivery while stationary
// ============================================
describe("T11-T12 — heartbeat + new delivery while stationary", () => {
  test("T11: stationary heartbeat eventually sends a freshly-acquired POST", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId = lastWatchId()
    await sendInitialAndResolve("p1", watchId, -34.6, -58.4, 5)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    advanceTime(60000) // heartbeat due — latestObservedSample is now stale (>5000ms)
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1) // fresh one-shot acquisition

    await resolveNextFreshAcquisitionAsync(-34.6, -58.4, 5)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  test("T12: a new delivery becoming eligible while stationary gets an initial fresh send without affecting the existing one", async () => {
    controller = createController()
    controller.render([delivery("A")])
    const watchId = lastWatchId()
    await sendInitialAndResolve("A", watchId, -34.6, -58.4, 5)
    expect(fetchedPedidoIds()).toEqual(["A"])

    advanceTime(10000) // A stays stationary and quiet — well past freshness but before heartbeat
    controller.render([delivery("A"), delivery("B")])
    // B has no reusable fresh sample (latestObserved is now stale) -> fresh acquisition
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1)
    await resolveNextFreshAcquisitionAsync(-1, -1, 5)

    expect(fetchCallCountFor("B")).toBe(1)
    expect(fetchCallCountFor("A")).toBe(1) // unaffected, no re-send, no reset
  })
})

// ============================================
// T13-T15 — multi-delivery fan-out / removal / last-removed
// ============================================
describe("T13-T15 — multi-delivery fan-out and removal", () => {
  test("T13: mixed eligibility — only eligible deliveries are POSTed", async () => {
    controller = createController()
    controller.render([
      delivery("A", { trackingEligibleNow: true }),
      delivery("B", { trackingEligibleNow: true }),
      delivery("C", { trackingEligibleNow: false }),
    ])
    const watchId = lastWatchId()
    fireWatchSuccess(watchId, -1, -1, 5)
    await act(async () => {
      await Promise.resolve()
    })
    expect(fetchedPedidoIds().sort()).toEqual(["A", "B"])
  })

  test("T14: removing one delivery does not affect the others", async () => {
    controller = createController()
    controller.render([delivery("A"), delivery("B")])
    const watchId = lastWatchId()
    fireWatchSuccess(watchId, -1, -1, 5)
    await act(async () => {
      await Promise.resolve()
    })
    await resolveNextFetch(200) // A
    await resolveNextFetch(200) // B
    expect(fetchedPedidoIds().sort()).toEqual(["A", "B"])

    controller.render([delivery("B")]) // A removed
    advanceTime(6000)
    fireWatchSuccess(watchId, -34.59, -58.4, 5) // significant movement
    await act(async () => {
      await Promise.resolve()
    })
    expect(fetchCallCountFor("B")).toBe(2)
    expect(fetchCallCountFor("A")).toBe(1) // never sent again
  })

  test("T15: removing the last eligible delivery stops the watcher", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    expect(activeWatchCount()).toBe(1)

    controller.render([])
    expect(clearWatchMock).toHaveBeenCalledTimes(1)
    expect(activeWatchCount()).toBe(0)
  })
})

// ============================================
// T16-T19 — business disable / re-enable (P2-T01 regression)
// ============================================
describe("T16-T19 — business disable / re-enable", () => {
  test("T16: local eligibility turning false (business disable) stops the watcher once it was the last one", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    expect(activeWatchCount()).toBe(1)

    controller.render([delivery("p1", { trackingEligibleNow: false })])
    expect(clearWatchMock).toHaveBeenCalledTimes(1)
    expect(activeWatchCount()).toBe(0)
  })

  test("T17: a late callback from a cleared watch (captured before clearWatch) is ignored by the generation guard", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId = lastWatchId()
    const staleRegistration = watchRegistrations.get(watchId)!

    controller.render([delivery("p1", { trackingEligibleNow: false })]) // triggers clearWatch
    expect(clearWatchMock).toHaveBeenCalledTimes(1)

    // Simulate the browser still delivering a queued callback from the
    // already-cleared watcher — captured directly, bypassing the (now
    // empty) mock registry, exactly like a real stale async callback would.
    act(() => {
      staleRegistration.success({ coords: { latitude: -1, longitude: -1, accuracy: 5 }, timestamp: mockNowMs })
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(fetchMock).toHaveBeenCalledTimes(0)
  })

  test("T18: re-enable (trackingEligibleNow false->true) restarts the watcher and sends a fresh initial location", async () => {
    controller = createController()
    controller.render([delivery("p1", { trackingEligibleNow: false })])
    expect(watchPositionMock).toHaveBeenCalledTimes(0)

    controller.render([delivery("p1", { trackingEligibleNow: true })])
    expect(watchPositionMock).toHaveBeenCalledTimes(1) // restarted
    // No reusable fresh sample yet -> fresh one-shot acquisition for the initial send.
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1)
    await resolveNextFreshAcquisitionAsync(-1, -1, 5)
    expect(fetchedPedidoIds()).toEqual(["p1"])
  })

  test("T19: trackingEligibleNow=false (server snapshot disabled) never starts a watcher", () => {
    controller = createController()
    controller.render([delivery("p1", { trackingEligibleNow: false })])
    controller.render([delivery("p1", { trackingEligibleNow: false })])
    expect(watchPositionMock).toHaveBeenCalledTimes(0)
  })
})

// ============================================
// T20-T21 — permission / geolocation error handling
// ============================================
describe("T20-T21 — permission denied / position unavailable", () => {
  test("T20: PERMISSION_DENIED clears the watch and never auto-retries", () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId = lastWatchId()

    fireWatchError(watchId, GEO_ERROR_CODES.PERMISSION_DENIED)
    expect(clearWatchMock).toHaveBeenCalledTimes(1)
    expect(activeWatchCount()).toBe(0)

    // No new watch appears without an external eligibility/visibility change.
    expect(watchPositionMock).toHaveBeenCalledTimes(1)
  })

  test("T21: POSITION_UNAVAILABLE/TIMEOUT are non-destructive — watcher stays alive, no POST", () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId = lastWatchId()

    fireWatchError(watchId, GEO_ERROR_CODES.POSITION_UNAVAILABLE)
    expect(clearWatchMock).toHaveBeenCalledTimes(0)
    expect(activeWatchCount()).toBe(1)
    expect(fetchMock).toHaveBeenCalledTimes(0)

    fireWatchError(watchId, GEO_ERROR_CODES.TIMEOUT)
    expect(clearWatchMock).toHaveBeenCalledTimes(0)
    expect(fetchMock).toHaveBeenCalledTimes(0)
  })
})

// ============================================
// T22-T23 — visibility lifecycle (OPTION-V2)
// ============================================
describe("T22-T23 — visibility lifecycle", () => {
  test("T22: hidden clears the watch (OPTION-V2)", () => {
    controller = createController()
    controller.render([delivery("p1")])
    expect(activeWatchCount()).toBe(1)

    act(() => {
      Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true })
      document.dispatchEvent(new Event("visibilitychange"))
    })
    expect(clearWatchMock).toHaveBeenCalledTimes(1)
    expect(activeWatchCount()).toBe(0)
  })

  test("T23: returning to visible restarts the watcher", async () => {
    controller = createController()
    controller.render([delivery("p1")])

    act(() => {
      Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true })
      document.dispatchEvent(new Event("visibilitychange"))
    })
    expect(activeWatchCount()).toBe(0)

    await act(async () => {
      Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true })
      document.dispatchEvent(new Event("visibilitychange"))
      await Promise.resolve() // flush the coalesced foreground-recovery microtask
    })
    expect(watchPositionMock).toHaveBeenCalledTimes(2)
    expect(activeWatchCount()).toBe(1)
  })
})

// ============================================
// T24 — HTTP single-flight + newest-pending-wins
// ============================================
describe("T24 — HTTP single-flight", () => {
  test("T24: a newer sample arriving while a POST is in flight is queued as pending, not a second concurrent POST — sent automatically once the first resolves", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId = lastWatchId()

    fireWatchSuccess(watchId, -34.6, -58.4, 5) // initial — POST left pending
    await act(async () => {
      await Promise.resolve()
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    fireWatchSuccess(watchId, -34.59, -58.4, 5) // significant movement while in-flight
    expect(fetchMock).toHaveBeenCalledTimes(1) // no second concurrent POST

    await resolveNextFetch(200) // resolves the first — the pending one is now scheduled
    // MIN_SEND_INTERVAL_MS is still respected even across a single-flight
    // hand-off — the pending sample is not fired immediately, it's queued
    // for the earliest allowed time from the send that just committed.
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(pendingSendTimerCount()).toBe(1)

    advanceTime(5000)
    await act(async () => {
      await Promise.resolve()
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

// ============================================
// T25-T26 — normal cadence bound + server eligibility rejection
// ============================================
describe("T25-T26 — cadence bound + fail-closed eligibility rejection", () => {
  test("T25: back-to-back significant movement at exactly the minimum interval sends immediately each time (bounded at the same 12/min max as before)", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId = lastWatchId()
    await sendInitialAndResolve("p1", watchId, -34.6, -58.4, 5)

    advanceTime(5000) // exactly MIN_SEND_INTERVAL_MS
    fireWatchSuccess(watchId, -34.59, -58.4, 5)
    await act(async () => {
      await Promise.resolve()
    })
    expect(fetchMock).toHaveBeenCalledTimes(2) // sent immediately, not queued
  })

  test("T26: a server eligibility rejection (400) is fail-closed — the watcher stops for the sole delivery, and only a fresh eligible mios restarts it with a brand-new send", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId = lastWatchId()
    fireWatchSuccess(watchId, -34.6, -58.4, 5)
    await act(async () => {
      await Promise.resolve()
    })
    await resolveNextFetch(400)

    // p1 was the only eligible delivery -> zero remaining physical GPS
    // demand, the watcher stops (P2-T02 Stage 3 §11).
    expect(clearWatchMock).toHaveBeenCalledTimes(1)
    expect(activeWatchCount()).toBe(0)
    // Settled and irrelevant to what happens next — the initial mount's own
    // (never resolved) one-shot acquisition attempt shouldn't count toward
    // the recovery assertion below.
    getCurrentPositionMock.mockClear()

    // A late/stale callback from the now-cleared watch is simply impossible
    // to deliver (the mock registry no longer has it) — the only way back
    // is a fresh eligible mios.
    advanceTime(6000) // any previously observed sample is now stale
    controller.render([delivery("p1")]) // fresh eligible mios (new array reference)

    expect(watchPositionMock.mock.calls.length).toBe(2) // watcher restarted
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1) // no reusable fresh sample -> one-shot
    await resolveNextFreshAcquisitionAsync(-1, -1, 5)
    expect(fetchedPedidoIds()).toEqual(["p1", "p1"])
  })
})

// ============================================
// T27-T28 — teardown + per-delivery state cleanup
// ============================================
describe("T27-T28 — teardown and state cleanup", () => {
  test("T27: unmount clears the watch and all pending/heartbeat timers", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId = lastWatchId()
    await sendInitialAndResolve("p1", watchId, -34.6, -58.4, 5)

    controller.unmount()
    controller = null
    expect(clearWatchMock).toHaveBeenCalledTimes(1)

    // Advancing time after unmount must never fire the heartbeat/pending
    // timers that belonged to the unmounted instance.
    advanceTime(120000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test("T28: a delivery removed and re-added with the same id is treated as brand new (no leftover lastSentSample)", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId = lastWatchId()
    await sendInitialAndResolve("p1", watchId, -34.6, -58.4, 5) // establishes a real lastSentSample

    advanceTime(10000) // the observed sample is now stale by the time it's re-added
    controller.render([]) // removed — state cleaned up
    controller.render([delivery("p1")]) // re-added with the same id

    // Treated as a brand-new delivery: no reusable fresh sample (stale by
    // now) -> fresh one-shot acquisition required, never a silent resume
    // against the old lastSentSample.
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(1) // not sent yet, awaiting the fresh acquisition

    await resolveNextFreshAcquisitionAsync(-1, -1, 5)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

// ============================================
// T29 — model id documentation hygiene
// ============================================
describe("T29 — model id hygiene", () => {
  test("T29: the implementation never references the superseded/collided historical model id (MODEL-G3)", async () => {
    const fs = await import("fs")
    const source = fs.readFileSync(new URL("./use-repartidor-tracking.ts", import.meta.url), "utf-8")
    expect(source).not.toContain("MODEL-G3")
  })
})

// ============================================
// T30-T31 — new-delivery sample freshness (P2-T02 Stage 1B correction B)
// ============================================
describe("T30-T31 — new delivery sample freshness", () => {
  test("T30: a new delivery reuses a still-fresh observed sample immediately, without a fresh one-shot acquisition", async () => {
    controller = createController()
    controller.render([delivery("A")])
    const watchId = lastWatchId()
    await sendInitialAndResolve("A", watchId, -34.6, -58.4, 5) // latestObservedSample is now fresh

    controller.render([delivery("A"), delivery("B")]) // B is new, sample is <5000ms old
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(0) // reused immediately, no fresh acquisition
    await act(async () => {
      await Promise.resolve()
    })
    expect(fetchCallCountFor("B")).toBe(1)
  })

  test("T31: a new delivery with only a stale cached sample never sends it — requires a fresh acquisition first", async () => {
    controller = createController()
    controller.render([delivery("A")])
    const watchId = lastWatchId()
    await sendInitialAndResolve("A", watchId, -34.6, -58.4, 5)

    advanceTime(10000) // observed sample is now stale
    controller.render([delivery("A"), delivery("B")])
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1) // fresh acquisition required
    expect(fetchCallCountFor("B")).toBe(0) // nothing sent yet — never the stale sample

    await resolveNextFreshAcquisitionAsync(-1, -1, 5)
    expect(fetchCallCountFor("B")).toBe(1)
  })
})

// ============================================
// T32-T34 — heartbeat truthfulness (P2-T02 Stage 1B correction B)
// ============================================
describe("T32-T34 — heartbeat truthfulness", () => {
  test("T32: heartbeat with a fresh latestObservedSample sends directly, no fresh acquisition needed", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId = lastWatchId()
    await sendInitialAndResolve("p1", watchId, -34.6, -58.4, 5)

    // A fresh watch callback lands just before the heartbeat is due —
    // suppressed as non-significant movement, but it still refreshes
    // latestObservedSample.
    advanceTime(59000)
    fireWatchSuccess(watchId, -34.6, -58.4, 5)
    await act(async () => {
      await Promise.resolve()
    })
    expect(fetchMock).toHaveBeenCalledTimes(1) // suppressed as non-movement

    advanceTime(1000) // heartbeat due at 60000ms since lastSuccessfulSendAt
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(0) // fresh sample already available
    expect(fetchMock).toHaveBeenCalledTimes(2) // heartbeat sent it directly
  })

  test("T33: heartbeat with a stale sample requires a fresh one-shot acquisition before sending", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId = lastWatchId()
    await sendInitialAndResolve("p1", watchId, -34.6, -58.4, 5)

    advanceTime(60000) // no further watch callbacks — observed sample is stale
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(1) // not sent yet

    await resolveNextFreshAcquisitionAsync(-34.6, -58.4, 5)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  test("T34: a failed heartbeat fresh acquisition sends nothing and never fakes a refresh", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId = lastWatchId()
    await sendInitialAndResolve("p1", watchId, -34.6, -58.4, 5)

    advanceTime(60000)
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1)

    await rejectNextFreshAcquisitionAsync()
    expect(fetchMock).toHaveBeenCalledTimes(1) // no POST — the stale sample was never sent
  })
})

// ============================================
// T35-T36 — foreground/re-enable staleness (P2-T02 Stage 1B corrections)
// ============================================
describe("T35-T36 — foreground and re-enable staleness", () => {
  test("T35: after being hidden past the freshness window, becoming visible never sends the old sample directly — it requires a fresh recovery acquisition", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId = lastWatchId()
    await sendInitialAndResolve("p1", watchId, -34.6, -58.4, 5)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    act(() => {
      Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true })
      document.dispatchEvent(new Event("visibilitychange"))
    })
    advanceTime(120000) // well past SAMPLE_REUSE_MAX_AGE_MS

    await act(async () => {
      Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true })
      document.dispatchEvent(new Event("visibilitychange"))
      await Promise.resolve() // flush the coalesced foreground-recovery microtask
    })
    // The forced foreground recovery (P2-T02 Stage 6I, FINDING_P2T02_STAGE6H_01)
    // never sends the old cached sample directly — it must wait for a
    // genuinely fresh acquisition.
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1)

    await resolveNextFreshAcquisitionAsync(-1, -1, 5)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  test("T36: re-enabling after the cached sample went stale requires a fresh sample before the initial send", async () => {
    controller = createController()
    controller.render([delivery("p1", { trackingEligibleNow: false })])
    controller.render([delivery("p1", { trackingEligibleNow: true })])
    const watchId = lastWatchId()
    await sendInitialAndResolve("p1", watchId, -34.6, -58.4, 5)

    controller.render([delivery("p1", { trackingEligibleNow: false })]) // disabled again
    advanceTime(10000) // stale by the time it re-enables
    controller.render([delivery("p1", { trackingEligibleNow: true })]) // re-enabled

    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1) // fresh acquisition required, not the stale sample
  })
})

// ============================================
// T37-T39 — explicit pending-send scheduler
// ============================================
describe("T37-T39 — explicit pending-send scheduler", () => {
  test("T37: a meaningful callback at T+2s schedules exactly one wake-up for T+5s", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId = lastWatchId()
    await sendInitialAndResolve("p1", watchId, -34.6, -58.4, 5)

    advanceTime(2000)
    fireWatchSuccess(watchId, -34.59, -58.4, 5)
    expect(pendingSendTimerCount()).toBe(1)
    expect(fetchMock).toHaveBeenCalledTimes(1) // not yet
  })

  test("T38: three callbacks during the throttle window -> one timer, newest pending retained", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId = lastWatchId()
    await sendInitialAndResolve("p1", watchId, -34.6, -58.4, 5)

    advanceTime(1000)
    fireWatchSuccess(watchId, -34.59, -58.4, 5)
    advanceTime(1000)
    fireWatchSuccess(watchId, -34.58, -58.4, 5)
    advanceTime(1000)
    fireWatchSuccess(watchId, -34.57, -58.4, 5)
    expect(pendingSendTimerCount()).toBe(1)

    advanceTime(2000) // reaches 5000ms since the initial send
    await act(async () => {
      await Promise.resolve()
    })
    const [, init] = fetchMock.mock.calls[1] as [string, { body: string }]
    const body = JSON.parse(init.body) as { lat: number }
    expect(body.lat).toBe(-34.57)
  })

  test("T39: with no further callbacks, the scheduler still sends at the earliest allowed time", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId = lastWatchId()
    await sendInitialAndResolve("p1", watchId, -34.6, -58.4, 5)

    advanceTime(2000)
    fireWatchSuccess(watchId, -34.59, -58.4, 5) // one meaningful callback, then silence
    expect(fetchMock).toHaveBeenCalledTimes(1)

    advanceTime(3000) // no more callbacks — the scheduler alone must fire
    await act(async () => {
      await Promise.resolve()
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

// ============================================
// T40 — timer cancellation on delivery removal
// ============================================
describe("T40 — pending timer cancellation", () => {
  test("T40: removing a delivery with a pending send timer cancels it", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId = lastWatchId()
    await sendInitialAndResolve("p1", watchId, -34.6, -58.4, 5)

    advanceTime(2000)
    fireWatchSuccess(watchId, -34.59, -58.4, 5) // pending, timer scheduled
    expect(pendingSendTimerCount()).toBe(1)

    controller.render([]) // removed before the timer fires
    advanceTime(10000)
    expect(fetchMock).toHaveBeenCalledTimes(1) // never fired for the removed delivery
  })
})

// ============================================
// T41-T42 — fresh-acquisition single-flight + capture-time ordering
// ============================================
describe("T41-T42 — fresh acquisition single-flight and ordering", () => {
  test("T41: a heartbeat and a new-delivery fresh-acquisition need at the same time share a single getCurrentPosition call", async () => {
    controller = createController()
    controller.render([delivery("A")])
    const watchId = lastWatchId()
    await sendInitialAndResolve("A", watchId, -34.6, -58.4, 5)

    advanceTime(60000) // A's heartbeat becomes due, observed sample stale
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1)

    // While that one-shot is still in flight, a new delivery also needs a
    // fresh sample — must reuse the SAME in-flight acquisition.
    controller.render([delivery("A"), delivery("B")])
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1) // still just one physical call

    await resolveNextFreshAcquisitionAsync(-1, -1, 5)
    expect(fetchCallCountFor("A")).toBe(2)
    expect(fetchCallCountFor("B")).toBe(1)
  })

  test("T42: a newer watch callback beats a late-resolving older one-shot result", async () => {
    controller = createController()
    controller.render([delivery("A")])
    const watchId = lastWatchId()
    await sendInitialAndResolve("A", watchId, -34.6, -58.4, 5)

    advanceTime(60000) // triggers a fresh one-shot acquisition for the heartbeat
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1)
    const acquisitionStartedAt = mockNowMs

    // A newer watch callback arrives BEFORE the one-shot resolves.
    advanceTime(500)
    fireWatchSuccess(watchId, -1, -1, 5) // newer capturedAt than the pending one-shot will report

    // The one-shot now resolves with an OLDER timestamp than the watch
    // callback that already landed.
    const calls = getCurrentPositionMock.mock.calls
    const [success] = calls[calls.length - 1] as [(pos: unknown) => void, (err: unknown) => void]
    await act(async () => {
      success({ coords: { latitude: -34.6, longitude: -58.4, accuracy: 5 }, timestamp: acquisitionStartedAt })
      await Promise.resolve()
      await Promise.resolve()
    })

    // The heartbeat (or whichever send resulted) must have used the NEWER
    // watch-callback sample, never the older one-shot result.
    const lastCall = fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as [string, { body: string }]
    const body = JSON.parse(lastCall[1].body) as { lat: number }
    expect(body.lat).toBe(-1)
  })
})

// ============================================
// T43 — lastSentSample commit point (only on 2xx)
// ============================================
describe("T43 — commit point on success only", () => {
  test("T43: a failed POST never advances lastSentSample — recovery via a fresh mios starts from a clean baseline, not a silently-resumed movement comparison", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId = lastWatchId()
    fireWatchSuccess(watchId, -34.6, -58.4, 5)
    await act(async () => {
      await Promise.resolve()
    })
    await resolveNextFetch(403) // failed — commit point never reached, lastSentSample stays null

    // p1 was the sole eligible delivery -> the watcher stopped (P2-T02
    // Stage 3 §11) — the old watchId is gone, recovery only happens via a
    // fresh eligible mios (P2-T02 Stage 3 §12).
    expect(clearWatchMock).toHaveBeenCalledTimes(1)
    expect(activeWatchCount()).toBe(0)

    advanceTime(6000) // any previously observed sample is now stale
    controller.render([delivery("p1")]) // fresh eligible mios -> recovers as brand-new
    const newWatchId = lastWatchId()
    expect(newWatchId).not.toBe(watchId)

    // The recovered delivery has no baseline at all (lastSentSample was
    // never committed by the failed attempt, and the whole per-delivery
    // state was cleaned up on failure) — identical coordinates to the
    // failed attempt still count as significant movement, proving there is
    // no stale non-null baseline left over.
    fireWatchSuccess(newWatchId, -34.6, -58.4, 5)
    await act(async () => {
      await Promise.resolve()
    })
    expect(fetchCallCountFor("p1")).toBe(2) // the failed attempt (1) + this recovery send (2)
  })
})

// ============================================
// T44 — invalid capturedAt never causes arbitrary stale reuse
// ============================================
describe("T44 — invalid timestamp handling", () => {
  test("T44: a watch callback with a non-finite position.timestamp falls back to the current clock, and still ages out normally", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId = lastWatchId()

    fireWatchSuccess(watchId, -34.6, -58.4, 5, NaN as unknown as number) // invalid timestamp
    await act(async () => {
      await Promise.resolve()
    })
    expect(fetchMock).toHaveBeenCalledTimes(1) // still sent — fallback used the current clock, not rejected

    await resolveNextFetch(200)
    advanceTime(6000)
    fireWatchSuccess(watchId, -34.599, -58.4, 5) // small movement — must be judged against a real, aged baseline
    await act(async () => {
      await Promise.resolve()
    })
    // The fallback-timestamped sample ages out exactly like any other —
    // this movement is well above the threshold, so it must have sent.
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

// ============================================
// T45 — heartbeat failure never causes a retry storm
// ============================================
describe("T45 — heartbeat failure bounded retry", () => {
  test("T45: a failed heartbeat fresh acquisition does not retry immediately — only a new full STATIONARY_HEARTBEAT_MS window allows another attempt", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId = lastWatchId()
    await sendInitialAndResolve("p1", watchId, -34.6, -58.4, 5)

    advanceTime(60000)
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1)
    await rejectNextFreshAcquisitionAsync()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // Advancing well under a full new heartbeat window must NOT trigger a
    // second one-shot acquisition — no immediate retry loop/storm.
    advanceTime(30000)
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1)

    // Only after a full new STATIONARY_HEARTBEAT_MS window from the failed
    // attempt does a new bounded attempt happen.
    advanceTime(30000) // total 60000ms since the failed attempt
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(2)
  })
})

// ============================================
// T46-T55 — Stage 3 pre-commit review: postInFlight semantics, watcher
// demand reconciliation, generation-scoped fresh acquisition, and
// pending/heartbeat race safety
// ============================================
describe("T46-T55 — postInFlight semantics, watcher demand reconciliation, generation-scoped fresh acquisition, pending/heartbeat race safety", () => {
  test("T46: a POST in flight for the sole delivery never blocks the watcher from restarting after a hidden->visible transition", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId = lastWatchId()
    fireWatchSuccess(watchId, -34.6, -58.4, 5) // starts the initial POST -> postInFlight=true
    await act(async () => {
      await Promise.resolve()
    })
    expect(fetchMock).toHaveBeenCalledTimes(1) // still in flight, not resolved yet

    act(() => {
      Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true })
      document.dispatchEvent(new Event("visibilitychange"))
    })
    expect(activeWatchCount()).toBe(0) // hidden always clears the physical watch

    await act(async () => {
      Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true })
      document.dispatchEvent(new Event("visibilitychange"))
      await Promise.resolve() // flush the coalesced foreground-recovery microtask
    })

    // The delivery is still core-eligible — a POST in flight is NOT
    // tracking ineligibility — the watcher must restart.
    expect(activeWatchCount()).toBe(1)
    expect(watchPositionMock).toHaveBeenCalledTimes(2)

    await resolveNextFetch(200) // clean up the still-pending initial POST
  })

  test("T47: trackingActive never depends on whether a POST is currently in flight for the sole eligible delivery", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    expect(controller.getApi().trackingActive).toBe(true)

    const watchId = lastWatchId()
    fireWatchSuccess(watchId, -34.6, -58.4, 5) // starts the initial POST -> postInFlight=true
    await act(async () => {
      await Promise.resolve()
    })
    expect(fetchMock).toHaveBeenCalledTimes(1) // still in flight

    // Force a fresh render so `trackingActive` (recomputed every render, not
    // memoized) reflects the current instant while the POST is in flight.
    controller.render([delivery("p1")])
    expect(controller.getApi().trackingActive).toBe(true)

    await resolveNextFetch(200)
    expect(controller.getApi().trackingActive).toBe(true)
  })

  test("T48: a POST failure for the sole eligible delivery stops the watcher (all-known-ineligible -> zero remaining GPS demand)", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId = lastWatchId()
    fireWatchSuccess(watchId, -34.6, -58.4, 5)
    await act(async () => {
      await Promise.resolve()
    })
    await resolveNextFetch(500)

    expect(clearWatchMock).toHaveBeenCalledTimes(1)
    expect(activeWatchCount()).toBe(0)
  })

  test("T49: a fresh mios recovering a locally-ineligible delivery genuinely rearms its heartbeat, not just its initial send", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId = lastWatchId()
    fireWatchSuccess(watchId, -34.6, -58.4, 5)
    await act(async () => {
      await Promise.resolve()
    })
    await resolveNextFetch(500) // fails -> watcher stops, state fully cleaned up
    getCurrentPositionMock.mockClear() // the mount's own leftover one-shot is irrelevant here

    advanceTime(6000)
    controller.render([delivery("p1")]) // fresh eligible mios -> recovers as brand-new
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1)
    await resolveNextFreshAcquisitionAsync(-1, -1, 5) // recovery's own fresh acquisition
    await resolveNextFetch(200) // recovery's own POST succeeds -> heartbeat should now be armed
    expect(fetchCallCountFor("p1")).toBe(2) // failed attempt(1) + recovery(2)
    getCurrentPositionMock.mockClear()

    // The heartbeat must have been rearmed by this successful recovery send
    // — a full STATIONARY_HEARTBEAT_MS later it requires (and gets) a fresh
    // acquisition and sends, proving it is not permanently silenced by the
    // earlier failure.
    advanceTime(60000)
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1)
    await resolveNextFreshAcquisitionAsync(-1, -1, 5)
    expect(fetchCallCountFor("p1")).toBe(3)
  })

  test("T50: a heartbeat's fresh-acquisition racing an already-in-flight movement-triggered send never produces two POSTs for the same window", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId = lastWatchId()
    await sendInitialAndResolve("p1", watchId, -34.6, -58.4, 5) // T0, heartbeat armed for T0+60000

    advanceTime(60000) // heartbeat due, observed sample stale -> fresh one-shot in flight
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1)

    // A real, newer movement arrives and is sent immediately (single-flight
    // sets postInFlight=true) WHILE the heartbeat's one-shot is still
    // unresolved.
    fireWatchSuccess(watchId, -1, -1, 5)
    await act(async () => {
      await Promise.resolve()
    })
    expect(fetchMock).toHaveBeenCalledTimes(2) // initial(1) + this movement send(2), in flight

    // The heartbeat's fresh acquisition now resolves with an OLDER sample —
    // single-flight must queue it, never fire a concurrent second POST.
    await resolveNextFreshAcquisitionAsync(-34.6, -58.4, 5)
    expect(fetchMock).toHaveBeenCalledTimes(2) // still just the one in-flight POST

    await resolveNextFetch(200) // the movement send resolves
    // The heartbeat's result (same capturedAt as the movement sample that
    // just committed — a tie) gets requeued defensively, but never as a
    // second concurrent POST, and it is discarded once it ages out —
    // proving there is never a same-window duplicate POST.
    await act(async () => {
      await Promise.resolve()
    })
    advanceTime(10000)
    expect(fetchMock).toHaveBeenCalledTimes(2) // never a same-window duplicate
  })

  test("T51: a POST that resolves successfully after the tab went hidden does not recreate the heartbeat/pending timers (OPTION-V2: zero timers while hidden)", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId = lastWatchId()
    fireWatchSuccess(watchId, -34.6, -58.4, 5) // starts the initial POST
    await act(async () => {
      await Promise.resolve()
    })
    expect(fetchMock).toHaveBeenCalledTimes(1) // in flight

    act(() => {
      Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true })
      document.dispatchEvent(new Event("visibilitychange"))
    })
    expect(heartbeatTimerCount()).toBe(0)
    expect(pendingSendTimerCount()).toBe(0)

    await resolveNextFetch(200) // resolves while still hidden

    // A 2xx while hidden may still update local bookkeeping (harmless
    // data), but must NEVER create a heartbeat or pending-send timer — that
    // would violate OPTION-V2 (hidden = zero timers).
    expect(heartbeatTimerCount()).toBe(0)
    expect(pendingSendTimerCount()).toBe(0)
  })

  test("T52: a delivery removed while its POST is still in flight is not revived by a late 2xx (no leftover timers/state)", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId = lastWatchId()
    fireWatchSuccess(watchId, -34.6, -58.4, 5)
    await act(async () => {
      await Promise.resolve()
    })
    expect(fetchMock).toHaveBeenCalledTimes(1) // in flight

    controller.render([]) // removed -> cleanupDeliveryState("p1")
    await resolveNextFetch(200) // late success, arrives after removal

    // No new timers/state should exist for "p1" — advancing well past both
    // MIN_SEND_INTERVAL_MS and STATIONARY_HEARTBEAT_MS must never produce
    // another POST for it.
    advanceTime(120000)
    expect(fetchCallCountFor("p1")).toBe(1)
  })

  test("T52b: an unmounted hook's late-resolving POST never revives timers/state", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId = lastWatchId()
    fireWatchSuccess(watchId, -34.6, -58.4, 5)
    await act(async () => {
      await Promise.resolve()
    })
    expect(fetchMock).toHaveBeenCalledTimes(1) // in flight

    controller.unmount()
    controller = null
    await resolveNextFetch(200) // late success, arrives after unmount

    advanceTime(120000)
    expect(fetchMock).toHaveBeenCalledTimes(1) // no revival, no new POST
  })

  test("T53: a stale generation's fresh-acquisition promise never blocks a new generation from starting its own physical acquisition", async () => {
    controller = createController()
    controller.render([delivery("A")])
    const watchIdGen1 = lastWatchId()
    await sendInitialAndResolve("A", watchIdGen1, -34.6, -58.4, 5) // baseline established, heartbeat armed

    advanceTime(60000) // heartbeat due, observed sample stale -> generation-1 one-shot, never resolved
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1)

    // hidden -> visible bumps the watch generation while generation 1's
    // one-shot is still unresolved.
    act(() => {
      Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true })
      document.dispatchEvent(new Event("visibilitychange"))
    })
    await act(async () => {
      Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true })
      document.dispatchEvent(new Event("visibilitychange"))
      await Promise.resolve() // flush the coalesced foreground-recovery microtask
    })
    const watchIdGen2 = lastWatchId()
    expect(watchIdGen2).not.toBe(watchIdGen1)

    // Becoming visible forces a recovery (P2-T02 Stage 6I) that itself
    // starts a BRAND NEW physical acquisition under generation 2 — never
    // remaining blocked on generation 1's still-unresolved promise. The
    // heartbeat rearm (for essentially "now", since its full window had
    // already elapsed while hidden) shares that same single-flight instead
    // of starting a third physical call.
    advanceTime(100)
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(2)
  })

  test("T54: an older queued pending sample never fires after a newer sample has already been sent successfully", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId = lastWatchId()
    await sendInitialAndResolve("p1", watchId, -34.6, -58.4, 5) // T0, lastSuccessfulSendAt=T0

    setMockNow(mockNowMs + 4900) // T0+4900 — still inside the throttle window
    fireWatchSuccess(watchId, -34.599, -58.4, 5) // P — queued, pending timer targets T0+5000
    expect(pendingSendTimerCount()).toBe(1)

    setMockNow(mockNowMs + 200) // T0+5100 — past the throttle window, P's timer hasn't run yet
    fireWatchSuccess(watchId, -34.59, -58.4, 5) // H — newer, larger movement, sent immediately
    await act(async () => {
      await Promise.resolve()
    })
    expect(fetchCallCountFor("p1")).toBe(2) // initial(1) + H sent immediately(2)
    // The immediate send must cancel P's now-superseded pending timer.
    expect(pendingSendTimerCount()).toBe(0)

    await resolveNextFetch(200) // H's own POST succeeds
    expect(fetchCallCountFor("p1")).toBe(2) // P's stale pending timer never produced a 3rd POST

    // Advancing well past where P's original timer would have fired proves
    // it was genuinely cancelled, not merely still pending.
    advanceTime(10000)
    expect(fetchCallCountFor("p1")).toBe(2)
  })

  test("T55: sustained significant movement every 5s for over 60s never produces an extra heartbeat POST beyond the movement-driven sends", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId = lastWatchId()
    await sendInitialAndResolve("p1", watchId, -34.6, -58.4, 5) // 1 POST so far

    for (let i = 1; i <= 13; i++) {
      advanceTime(5000)
      fireWatchSuccess(watchId, -34.6, -58.4 - i * 0.02, 5) // always significant movement, always due
      await act(async () => {
        await Promise.resolve()
      })
      await resolveNextFetch(200)
    }

    // 13 cycles of exactly-due movement spanning 65s of continuous
    // movement — every single POST must be movement-driven; the heartbeat
    // (reset on every successful send) never gets a chance to fire on its
    // own.
    expect(fetchMock).toHaveBeenCalledTimes(14) // 1 initial + 13 movement-driven
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(0) // never needed a fresh one-shot
  })
})

// ============================================
// FG01-FG12 — Stage 6I: robust foreground-recovery model
// (FINDING_P2T02_STAGE6H_01 — a real Android device left the producer dead
// for 9+ minutes after a Home->Recientes background/foreground cycle,
// despite permission/eligibility staying intact; only a full reload
// recovered it)
// ============================================
function goHidden() {
  act(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true })
    document.dispatchEvent(new Event("visibilitychange"))
  })
}

// Foreground signals are coalesced onto a microtask (P2-T02 Stage 6I §18-19)
// — every helper that fires one must flush that microtask before the test
// inspects its effects.
async function goVisible() {
  await act(async () => {
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true })
    document.dispatchEvent(new Event("visibilitychange"))
    await Promise.resolve()
  })
}

async function fireWindowFocus() {
  await act(async () => {
    window.dispatchEvent(new Event("focus"))
    await Promise.resolve()
  })
}

async function firePersistedPageshow() {
  await act(async () => {
    const e = new Event("pageshow")
    Object.defineProperty(e, "persisted", { value: true, configurable: true })
    window.dispatchEvent(e)
    await Promise.resolve()
  })
}

describe("FG01-FG12 — robust foreground-recovery model", () => {
  test("FG01: hidden -> visible via visibilitychange forces exactly one recovery wave with exactly one new watch", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId1 = lastWatchId()
    await sendInitialAndResolve("p1", watchId1, -34.6, -58.4, 5)
    expect(watchPositionMock).toHaveBeenCalledTimes(1)

    goHidden()
    expect(activeWatchCount()).toBe(0)

    advanceTime(6000) // well past SAMPLE_REUSE_MAX_AGE_MS while hidden
    await goVisible()

    expect(watchPositionMock).toHaveBeenCalledTimes(2) // exactly one new watch (hard restart)
    expect(activeWatchCount()).toBe(1)
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1) // exactly one recovery fresh-acquisition attempt
  })

  test("FG02: focus alone recovers even if the visibilitychange 'visible' event never fires", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId1 = lastWatchId()
    await sendInitialAndResolve("p1", watchId1, -34.6, -58.4, 5)

    goHidden()
    expect(activeWatchCount()).toBe(0)
    advanceTime(6000)

    // document.visibilityState already reports "visible" but the
    // visibilitychange event itself never fires — only `focus` does.
    act(() => {
      Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true })
    })
    await fireWindowFocus()

    expect(watchPositionMock).toHaveBeenCalledTimes(2)
    expect(activeWatchCount()).toBe(1)
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1)
  })

  test("FG03: a persisted pageshow (bfcache restore) forces recovery even without a prior visibilitychange hidden event", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId1 = lastWatchId()
    await sendInitialAndResolve("p1", watchId1, -34.6, -58.4, 5)
    expect(watchPositionMock).toHaveBeenCalledTimes(1)

    advanceTime(6000) // never went hidden through our own handler

    await firePersistedPageshow()

    expect(clearWatchMock).toHaveBeenCalledTimes(1) // the still-registered old watch is discarded
    expect(watchPositionMock).toHaveBeenCalledTimes(2)
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1)
  })

  test("FG04: visibilitychange + focus + pageshow firing together in a burst collapse into exactly one recovery wave", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId1 = lastWatchId()
    await sendInitialAndResolve("p1", watchId1, -34.6, -58.4, 5)

    goHidden()
    advanceTime(6000)

    await act(async () => {
      Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true })
      document.dispatchEvent(new Event("visibilitychange"))
      window.dispatchEvent(new Event("focus"))
      const e = new Event("pageshow")
      Object.defineProperty(e, "persisted", { value: true, configurable: true })
      window.dispatchEvent(e)
      await Promise.resolve() // flush the single coalesced foreground-recovery microtask
    })

    expect(watchPositionMock).toHaveBeenCalledTimes(2) // exactly one new watch, not three
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1) // exactly one recovery fresh-acquisition
  })

  test("FG05: a watchId that belonged to a suspended generation is discarded, never left coexisting with the new one", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const oldWatchId = lastWatchId()
    await sendInitialAndResolve("p1", oldWatchId, -34.6, -58.4, 5)

    goHidden()
    advanceTime(6000)
    await goVisible()

    const newWatchId = lastWatchId()
    expect(newWatchId).not.toBe(oldWatchId)
    expect(activeWatchCount()).toBe(1) // never two concurrent watches
    expect(watchRegistrations.get(oldWatchId)).toBeUndefined() // cleared from the registry by clearWatch
  })

  test("FG06: after being hidden past the freshness window, recovery never sends the old cached sample directly — it must wait for a fresh acquisition", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId1 = lastWatchId()
    await sendInitialAndResolve("p1", watchId1, -34.6, -58.4, 5)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    goHidden()
    advanceTime(6000)
    await goVisible()

    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(1) // still just the original — recovery send not sent yet

    await resolveNextFreshAcquisitionAsync(-1, -1, 5)
    expect(fetchMock).toHaveBeenCalledTimes(2) // only now, with a genuinely fresh sample
  })

  test("FG07: a stationary repartidor (identical coordinates) still gets a recovery send — no movement threshold applies to foreground recovery", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId1 = lastWatchId()
    await sendInitialAndResolve("p1", watchId1, -34.6, -58.4, 5)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    goHidden()
    advanceTime(6000)
    await goVisible()

    // Identical coordinates to the pre-hidden send — would normally be
    // suppressed as non-significant movement, but recovery bypasses that.
    await resolveNextFreshAcquisitionAsync(-34.6, -58.4, 5)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  test("FG08: a successful recovery send rearms the heartbeat for a full new window", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId1 = lastWatchId()
    await sendInitialAndResolve("p1", watchId1, -34.6, -58.4, 5)

    goHidden()
    advanceTime(6000)
    await goVisible()

    await resolveNextFreshAcquisitionAsync(-1, -1, 5)
    await resolveNextFetch(200)
    expect(heartbeatTimerCount()).toBe(1)
  })

  test("FG09: a foreground signal with zero eligible deliveries produces zero watch/fresh-acquisition/POST activity", async () => {
    controller = createController()
    controller.render([delivery("p1", { trackingEligibleNow: false })])
    expect(watchPositionMock).toHaveBeenCalledTimes(0)

    goHidden()
    await goVisible()

    expect(watchPositionMock).toHaveBeenCalledTimes(0)
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(0)
    expect(fetchMock).toHaveBeenCalledTimes(0)
  })

  test("FG10: an incidental focus event on a page that was never hidden never churns the watcher", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId1 = lastWatchId()
    await sendInitialAndResolve("p1", watchId1, -34.6, -58.4, 5)
    expect(watchPositionMock).toHaveBeenCalledTimes(1)

    await fireWindowFocus()

    expect(watchPositionMock).toHaveBeenCalledTimes(1) // no new watch
    expect(clearWatchMock).toHaveBeenCalledTimes(0) // no restart at all
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(0) // no forced recovery send
  })

  test("FG11: a recovery one-shot racing a newer watch callback never produces a duplicate send — the newer sample wins", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId1 = lastWatchId()
    await sendInitialAndResolve("p1", watchId1, -34.6, -58.4, 5)

    goHidden()
    advanceTime(6000)
    await goVisible()
    const newWatchId = lastWatchId()
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1)
    const acquisitionStartedAt = mockNowMs

    // A newer watch callback lands BEFORE the recovery one-shot resolves —
    // significant movement vs. the pre-hidden baseline, sent immediately.
    advanceTime(500)
    fireWatchSuccess(newWatchId, -1, -1, 5)
    await act(async () => {
      await Promise.resolve()
    })

    // The one-shot now resolves with an OLDER timestamp than the watch
    // callback that already landed.
    const calls = getCurrentPositionMock.mock.calls
    const [success] = calls[calls.length - 1] as [(pos: unknown) => void, (err: unknown) => void]
    await act(async () => {
      success({ coords: { latitude: -34.6, longitude: -58.4, accuracy: 5 }, timestamp: acquisitionStartedAt })
      await Promise.resolve()
      await Promise.resolve()
    })

    // Exactly one recovery-driven send (the watch-triggered one) — the
    // stale one-shot result never produces a duplicate.
    expect(fetchCallCountFor("p1")).toBe(2) // initial(1) + the watch-triggered recovery send(2)
    const lastCall = fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as [string, { body: string }]
    const body = JSON.parse(lastCall[1].body) as { lat: number }
    expect(body.lat).toBe(-1)
  })

  test("FG12: going hidden again while a recovery fresh-acquisition is in flight discards it — no POST, no revived timers", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId1 = lastWatchId()
    await sendInitialAndResolve("p1", watchId1, -34.6, -58.4, 5)

    goHidden()
    advanceTime(6000)
    await goVisible()
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1) // recovery one-shot in flight

    // Hidden again before the recovery one-shot resolves.
    goHidden()
    expect(heartbeatTimerCount()).toBe(0)
    expect(pendingSendTimerCount()).toBe(0)

    // The stale one-shot now resolves.
    await resolveNextFreshAcquisitionAsync(-1, -1, 5)
    expect(fetchCallCountFor("p1")).toBe(1) // still just the original send — no revival
    expect(heartbeatTimerCount()).toBe(0)
  })
})

// ============================================
// J01-J16 — Stage 6J: adversarial pre-commit concurrency/lifecycle review
// of the Stage 6I foreground-recovery model, plus the watchdog added in
// this stage (justified by MISSED_HIDDEN_SIGNAL_DEAD_STATE_POSSIBLE=SI: if
// the hidden handler itself never runs — a real possibility if the OS
// freezes the page without dispatching any event — the multi-signal design
// alone provides zero protection, since pendingForegroundRecoveryRef would
// never be armed)
// ============================================
describe("J01-J16 — adversarial foreground-recovery pre-commit review", () => {
  test("J01: hidden processed, but the 'visible' visibilitychange event is lost — focus alone still recovers exactly once", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId1 = lastWatchId()
    await sendInitialAndResolve("p1", watchId1, -34.6, -58.4, 5)

    goHidden()
    advanceTime(6000)

    // The "visible" visibilitychange event is lost — only focus fires.
    act(() => {
      Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true })
    })
    await fireWindowFocus()

    expect(watchPositionMock).toHaveBeenCalledTimes(2)
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1)
  })

  test("J02: visibilitychange and focus arriving in separate macrotasks for the same resume never duplicate the forced recovery", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId1 = lastWatchId()
    await sendInitialAndResolve("p1", watchId1, -34.6, -58.4, 5)

    goHidden()
    advanceTime(6000)

    await goVisible() // own macrotask — consumes the pending flag
    expect(watchPositionMock).toHaveBeenCalledTimes(2)
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1)

    await fireWindowFocus() // separate macrotask, same resume — flag already consumed
    expect(watchPositionMock).toHaveBeenCalledTimes(2) // no duplicate forced recovery
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1) // no duplicate fresh acquisition
  })

  test("J03: a persisted pageshow arriving after recovery already completed for the same resume wave does not force a second recovery", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId1 = lastWatchId()
    await sendInitialAndResolve("p1", watchId1, -34.6, -58.4, 5)

    goHidden()
    advanceTime(6000)
    await goVisible() // recovery #1
    expect(watchPositionMock).toHaveBeenCalledTimes(2)
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1)

    // A late pageshow(persisted) for the same resume — well within the
    // dedupe window.
    await firePersistedPageshow()
    expect(watchPositionMock).toHaveBeenCalledTimes(2) // no second recovery
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1) // no second fresh acquisition
  })

  test("J04: with no hidden handler ever processed and a silently zombied watch, an incidental focus alone cannot recover — the watchdog eventually does", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId1 = lastWatchId()
    await sendInitialAndResolve("p1", watchId1, -34.6, -58.4, 5)
    expect(watchPositionMock).toHaveBeenCalledTimes(1)

    // Simulate the watch subscription silently dying WITHOUT any hidden
    // event ever firing — the exact real Android scenario Stage 6H
    // observed. No more watch callbacks arrive from here on.
    await fireWindowFocus() // incidental — the hook has no reason to suspect a suspend happened

    // The multi-signal design alone correctly does NOT force anything here
    // — nothing told it a suspend happened, and forcing on every incidental
    // focus would churn on healthy pages.
    expect(watchPositionMock).toHaveBeenCalledTimes(1)
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(0)

    // Only the watchdog, bounded and independent of any lifecycle signal,
    // eventually notices the silence and forces exactly one recovery. On
    // the way there, the stationary heartbeat (due at 60s) also honestly
    // tries and fails to get a fresh sample on its own (T45 bounded-retry
    // behavior) — that attempt never resolves and so never counts as
    // "activity", which is exactly why the watchdog is still needed at 75s.
    advanceTime(75000)
    expect(watchPositionMock).toHaveBeenCalledTimes(2) // exactly one NEW watch — only from the watchdog's forced restart
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(2) // heartbeat's own failed attempt(1) + the watchdog's(2)
  })

  test("J05: a foreground-recovery microtask still pending when the hook unmounts never mutates anything afterward", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId1 = lastWatchId()
    await sendInitialAndResolve("p1", watchId1, -34.6, -58.4, 5)

    goHidden()
    advanceTime(6000)

    // Schedule the recovery microtask (visible fires) but unmount BEFORE it
    // gets a chance to run.
    act(() => {
      Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true })
      document.dispatchEvent(new Event("visibilitychange"))
    })
    controller.unmount()
    controller = null

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(watchPositionMock).toHaveBeenCalledTimes(1) // never restarted after unmount
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(0) // no recovery fresh acquisition after unmount
    expect(fetchMock).toHaveBeenCalledTimes(1) // just the original initial send
  })

  test("J06: a foreground-recovery microtask still pending when the page goes hidden again never restarts the watcher", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId1 = lastWatchId()
    await sendInitialAndResolve("p1", watchId1, -34.6, -58.4, 5)

    goHidden()
    advanceTime(6000)

    act(() => {
      Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true })
      document.dispatchEvent(new Event("visibilitychange")) // schedules the recovery microtask
      Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true }) // hidden again before the microtask runs
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(watchPositionMock).toHaveBeenCalledTimes(1) // never restarted
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(0)
  })

  test("J07: two eligible deliveries resuming together produce exactly one physical watch and share a single fresh acquisition", async () => {
    controller = createController()
    controller.render([delivery("A"), delivery("B")])
    const watchId1 = lastWatchId()
    await sendInitialAndResolve("A", watchId1, -34.6, -58.4, 5)
    await sendInitialAndResolve("B", watchId1, -34.6, -58.4, 5)
    expect(watchPositionMock).toHaveBeenCalledTimes(1)

    goHidden()
    advanceTime(6000)
    await goVisible()

    expect(watchPositionMock).toHaveBeenCalledTimes(2) // exactly one new physical watch
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1) // shared single-flight fresh acquisition

    await resolveNextFreshAcquisitionAsync(-1, -1, 5)
    expect(fetchCallCountFor("A")).toBe(2)
    expect(fetchCallCountFor("B")).toBe(2)
  })

  test("J08: a pre-background POST resolving late during an active foreground recovery does not create stale timers or overwrite the newer recovery sample", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId1 = lastWatchId()
    fireWatchSuccess(watchId1, -34.6, -58.4, 5) // starts a POST -> postInFlight=true, never resolved yet
    await act(async () => {
      await Promise.resolve()
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    // The mount's own leftover one-shot (from ensureInitialSendForDelivery,
    // superseded by the watch-triggered send above) is irrelevant here.
    getCurrentPositionMock.mockClear()

    goHidden() // stopWatcher, pendingForegroundRecoveryRef=true — the in-flight POST is untouched
    advanceTime(6000)
    await goVisible() // forces recovery: new watch, new generation, recovery fresh-acquisition begins

    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1)

    // The recovery's fresh acquisition resolves and attempts a send — but
    // the pre-background POST is still in flight for this delivery
    // (single-flight), so it must be queued, never a second concurrent
    // POST.
    await resolveNextFreshAcquisitionAsync(-1, -1, 5)
    expect(fetchMock).toHaveBeenCalledTimes(1) // still just the original, in-flight

    // The pre-background POST now finally resolves successfully.
    await resolveNextFetch(200)
    // Must not have been treated as ineligible, no stale timers revived
    // from the old generation, and the queued recovery sample (newer) gets
    // its own turn, respecting MIN_SEND_INTERVAL_MS.
    expect(pendingSendTimerCount()).toBe(1)
    advanceTime(5000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  test("J09: a known-ineligible delivery is never recovered by focus/pageshow alone — only a fresh eligible mios can", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId1 = lastWatchId()
    fireWatchSuccess(watchId1, -34.6, -58.4, 5)
    await act(async () => {
      await Promise.resolve()
    })
    await resolveNextFetch(403) // fails -> knownIneligible, watcher stops (no eligible deliveries left)
    expect(activeWatchCount()).toBe(0)
    // The mount's own leftover one-shot is irrelevant here.
    getCurrentPositionMock.mockClear()

    // Foreground signals fire, but "p1" is still knownIneligible — nothing
    // should happen (zero eligible -> zero watch/GPS/POST activity).
    await goVisible()
    await fireWindowFocus()
    await firePersistedPageshow()

    expect(watchPositionMock).toHaveBeenCalledTimes(1) // never restarted for the ineligible delivery
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(0)
    expect(fetchCallCountFor("p1")).toBe(1) // just the failed attempt
  })

  test("J10: a short background (<=5s) still lets recovery reuse the still-fresh cached sample directly, per the frozen Stage 1B contract", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId1 = lastWatchId()
    await sendInitialAndResolve("p1", watchId1, -34.6, -58.4, 5)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    goHidden()
    advanceTime(2000) // well within SAMPLE_REUSE_MAX_AGE_MS=5000
    await goVisible()

    // The cached sample is still fresh — recovery must reuse it directly,
    // with no fresh one-shot acquisition needed.
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(0)
    expect(fetchMock).toHaveBeenCalledTimes(2) // sent immediately using the cached sample
  })

  test("J11: a long background (>5s) always requires a fresh acquisition before any recovery send — never the stale cached sample", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId1 = lastWatchId()
    await sendInitialAndResolve("p1", watchId1, -34.6, -58.4, 5)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    goHidden()
    advanceTime(10000) // well past SAMPLE_REUSE_MAX_AGE_MS
    await goVisible()

    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(1) // not sent yet — waiting for the fresh acquisition

    await resolveNextFreshAcquisitionAsync(-1, -1, 5)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  test("J12: a successful recovery send leaves exactly one heartbeat timer and becomes the new movement baseline", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId1 = lastWatchId()
    await sendInitialAndResolve("p1", watchId1, -34.6, -58.4, 5)

    goHidden()
    advanceTime(6000)
    await goVisible()
    const newWatchId = lastWatchId()
    await resolveNextFreshAcquisitionAsync(-1, -1, 5)
    await resolveNextFetch(200)

    expect(heartbeatTimerCount()).toBe(1)

    // The recovery sample is the new baseline — an identical-to-recovery
    // subsequent watch callback must be judged as non-significant (i.e.,
    // suppressed), proving lastSentSample really updated to it.
    fireWatchSuccess(newWatchId, -1, -1, 5)
    await act(async () => {
      await Promise.resolve()
    })
    expect(fetchCallCountFor("p1")).toBe(2) // still 2 — the identical follow-up was correctly suppressed as non-movement
  })

  test("J13: the watchdog performs exactly one recovery attempt per window when no activity is observed, never an immediate retry storm", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId1 = lastWatchId()
    await sendInitialAndResolve("p1", watchId1, -34.6, -58.4, 5)

    // No further activity at all — the watchdog is the only thing still
    // ticking (the stationary heartbeat, due at 60s, also honestly tries
    // and fails on its own — T45 bounded-retry — contributing one attempt
    // that never resolves and so never counts as "activity").
    advanceTime(75000) // first watchdog window elapses
    expect(watchPositionMock).toHaveBeenCalledTimes(2) // exactly one forced recovery — only from the watchdog
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(2) // heartbeat's own failed attempt(1) + the watchdog's(2)

    // Immediately after, no second attempt without a full new window.
    advanceTime(30000)
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(2) // no storm
  })

  test("J14: the watchdog never triggers while the watcher is genuinely healthy (regular heartbeat activity resets its liveness evidence)", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId1 = lastWatchId()
    await sendInitialAndResolve("p1", watchId1, -34.6, -58.4, 5)

    // A normal heartbeat cycle produces real watch activity well before the
    // watchdog's own (much longer) window would elapse.
    advanceTime(60000) // heartbeat due
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1) // heartbeat's own fresh acquisition
    await resolveNextFreshAcquisitionAsync(-34.6, -58.4, 5)
    await resolveNextFetch(200)

    getCurrentPositionMock.mockClear()
    watchPositionMock.mockClear()

    // Reaches exactly the original watchdog window from mount (75000ms),
    // but activity was refreshed by the heartbeat above — no forced
    // recovery should occur.
    advanceTime(15000) // total elapsed since mount: 75000ms
    expect(watchPositionMock).toHaveBeenCalledTimes(0)
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(0)
  })

  test("J15: the watchdog timer is cleared on hidden and on unmount — never fires afterward", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId1 = lastWatchId()
    await sendInitialAndResolve("p1", watchId1, -34.6, -58.4, 5)
    expect(watchdogTimerCount()).toBe(1)

    goHidden()
    expect(watchdogTimerCount()).toBe(0)

    advanceTime(6000)
    await goVisible()
    expect(watchdogTimerCount()).toBe(1)

    controller.unmount()
    controller = null
    expect(watchdogTimerCount()).toBe(0)

    // Advancing well past any watchdog window after unmount must never
    // produce runaway activity.
    advanceTime(200000)
    expect(watchPositionMock.mock.calls.length).toBeLessThanOrEqual(2)
  })

  test("J16: repeated foreground signals never accumulate more than one watchdog timer", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    const watchId1 = lastWatchId()
    await sendInitialAndResolve("p1", watchId1, -34.6, -58.4, 5)
    expect(watchdogTimerCount()).toBe(1)

    await fireWindowFocus()
    expect(watchdogTimerCount()).toBe(1)

    await fireWindowFocus()
    expect(watchdogTimerCount()).toBe(1)
  })
})
