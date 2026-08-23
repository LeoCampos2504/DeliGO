// ============================================
// P2-T01 — useRepartidorTracking: eligibility gate + in-flight guard
// ============================================
// Real DOM (happy-dom) + a real React commit cycle, following the exact
// pattern already established in
// use-chat-message-presentation-commit.test.ts (registered per-file, not
// repo-wide, and restored in afterAll so no other test file is affected).
//
// setInterval/clearInterval are replaced with a controllable stand-in (an
// id -> callback map, fired manually by the test) so ticks can be driven
// deterministically without a real 5000ms wait — this is not Bun's own
// fake-timer API (Bun has none for this); it works because the hook always
// calls the GLOBAL setInterval/clearInterval, which are ordinary,
// overridable JS bindings.
//
// navigator.geolocation.getCurrentPosition and global fetch are similarly
// replaced with controllable mocks so GPS acquisition and the POST's
// resolution can each be held pending independently — this is exactly what
// P2T01-24 (the in-flight guard test) needs: a POST that stays pending
// across multiple simulated ticks.
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

// --- Controllable global setInterval/clearInterval -------------------------
let intervalCallbacks: Map<number, () => void>
let nextIntervalId: number
const realSetInterval = globalThis.setInterval
const realClearInterval = globalThis.clearInterval

function fireAllIntervals() {
  act(() => {
    for (const cb of [...intervalCallbacks.values()]) cb()
  })
}

// --- Controllable navigator.geolocation.getCurrentPosition -----------------
let getCurrentPositionMock: ReturnType<typeof mock>

function resolveNextGeo(lat = -34.6, lng = -58.4) {
  const calls = getCurrentPositionMock.mock.calls
  const [success] = calls[calls.length - 1] as [(pos: { coords: { latitude: number; longitude: number } }) => void]
  act(() => {
    success({ coords: { latitude: lat, longitude: lng } })
  })
}

// --- Controllable global fetch ----------------------------------------------
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

beforeEach(() => {
  intervalCallbacks = new Map()
  nextIntervalId = 1
  globalThis.setInterval = ((cb: () => void) => {
    const id = nextIntervalId++
    intervalCallbacks.set(id, cb)
    return id as unknown as ReturnType<typeof setInterval>
  }) as unknown as typeof setInterval
  globalThis.clearInterval = ((id: unknown) => {
    intervalCallbacks.delete(id as number)
  }) as unknown as typeof clearInterval

  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true })

  getCurrentPositionMock = mock(() => {})
  Object.defineProperty(globalThis, "navigator", {
    value: { geolocation: { getCurrentPosition: getCurrentPositionMock } },
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
  globalThis.setInterval = realSetInterval
  globalThis.clearInterval = realClearInterval
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

describe("useRepartidorTracking — P2-T01 eligibility gate", () => {
  test("P2T01-06/16: zero eligible deliveries -> zero geolocation acquisitions", () => {
    controller = createController()
    controller.render([delivery("p1", { trackingEligibleNow: false })])
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(0)
  })

  test("eligible delivery on mount triggers exactly one GPS acquisition and one POST with the resolved coordinates", () => {
    controller = createController()
    controller.render([delivery("p1")])
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1)

    resolveNextGeo(-1, -2)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchedPedidoIds()).toEqual(["p1"])
  })

  test("P2T01-15: mixed deliveries — only the eligible one is POSTed", () => {
    controller = createController()
    controller.render([delivery("eligible", { trackingEligibleNow: true }), delivery("ineligible", { trackingEligibleNow: false })])
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1)

    resolveNextGeo()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchedPedidoIds()).toEqual(["eligible"])
  })

  test("estado/repartidorId still gate eligibility even when trackingEligibleNow is true (defensive — should never diverge from the server, but the hook must not trust it blindly)", () => {
    controller = createController()
    controller.render([delivery("p1", { estado: "listo_para_retirar" })])
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(0)

    controller.render([delivery("p1", { repartidorId: null })])
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(0)
  })
})

describe("P2T01-21/24 — non-2xx / network-error suppression and the per-pedido in-flight guard", () => {
  test("P2T01-21: any non-2xx response suppresses the pedido locally until a fresh eligible 'mios'", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    resolveNextGeo()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await resolveNextFetch(403)

    // Next tick: still suppressed, no new GPS/POST.
    fireAllIntervals()
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // A fresh, successful "mios" re-reporting eligibility clears the
    // suppression — proven by a NEW array reference (a real prop update),
    // never by mutating the old one in place. The eligibility-restoring
    // render itself re-runs the producer-start effect (the same "decisión
    // de iniciar productor" gate, section 16) and ticks immediately —
    // recovery does not wait for the next 5s interval.
    controller.render([delivery("p1")])
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(2)
  })

  test("Stage 3 precommit review §14: a re-render with the SAME array reference (React Query v5 never mutates `data` on a failed background refetch — it keeps the last-successful reference) does NOT clear the suppression, because the clearing effect depends on activeDeliveries by reference and React skips it when the reference is unchanged", async () => {
    controller = createController()
    const mios = [delivery("p1")]
    controller.render(mios)
    resolveNextGeo()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await resolveNextFetch(403)
    fireAllIntervals()
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1) // still suppressed

    // Re-render with the EXACT SAME array object — simulating a component
    // re-render that carries React Query's untouched, last-successful
    // `data` (e.g. after a failed background refetch, or any unrelated
    // parent re-render). This must NOT be mistaken for a fresh, eligible
    // "mios" confirmation.
    controller.render(mios)
    fireAllIntervals()
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1) // still suppressed, not 2

    // Only a genuinely NEW array (a real fresh fetch) can clear it.
    controller.render([delivery("p1")])
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(2)
  })

  test("P2T01-24: while a POST is pending, no second GPS acquisition or POST fires for the same pedido across multiple simulated ticks; resolving it non-2xx suppresses until a fresh eligible mios", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1)

    resolveNextGeo()
    expect(fetchMock).toHaveBeenCalledTimes(1) // POST now deliberately left pending

    // Advance several simulated 5s intervals while the POST is still pending.
    fireAllIntervals()
    fireAllIntervals()
    fireAllIntervals()
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1) // no second acquisition
    expect(fetchMock).toHaveBeenCalledTimes(1) // no second POST

    await resolveNextFetch(403)

    // Still suppressed (now via knownIneligible, not pendingLocationRequests).
    fireAllIntervals()
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // Fresh eligible mios clears the suppression (the producer-start effect
    // re-runs on the new array reference and ticks immediately).
    controller!.render([delivery("p1")])
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(2)
    resolveNextGeo()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await resolveNextFetch(200)
  })

  test("P2T01-24 variant: a network error (fetch throws) suppresses exactly like a non-2xx, until a fresh eligible mios", async () => {
    controller = createController()
    controller.render([delivery("p1")])
    resolveNextGeo()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await rejectNextFetch()

    fireAllIntervals()
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    controller!.render([delivery("p1")])
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(2)
  })

  test("a delivery removed while GPS is in flight never POSTs (re-filtered against current refs after acquisition resolves)", () => {
    controller = createController()
    controller.render([delivery("p1")])
    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1)

    // Delivery disappears (e.g. reassigned/cancelled) before GPS resolves.
    controller.render([])
    resolveNextGeo()
    expect(fetchMock).toHaveBeenCalledTimes(0)
  })
})
