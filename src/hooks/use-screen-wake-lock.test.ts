import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { GlobalRegistrator } from "@happy-dom/global-registrator"

GlobalRegistrator.register()
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const React = await import("react")
const { createRoot } = await import("react-dom/client")
const { useScreenWakeLock } = await import("./use-screen-wake-lock")
const { act } = React

afterAll(() => GlobalRegistrator.unregister())

let originalWakeLock: unknown
let originalVisibilityDescriptor: PropertyDescriptor | undefined
let host: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  originalWakeLock = (navigator as Navigator & { wakeLock?: unknown }).wakeLock
  originalVisibilityDescriptor = Object.getOwnPropertyDescriptor(document, "visibilityState")
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" })
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  if (originalVisibilityDescriptor) Object.defineProperty(document, "visibilityState", originalVisibilityDescriptor)
  else Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" })
  Object.defineProperty(navigator, "wakeLock", { configurable: true, value: originalWakeLock })
})

function render(enabled: boolean) {
  function Harness() {
    useScreenWakeLock(enabled)
    return null
  }
  act(() => root.render(React.createElement(Harness)))
}

function setVisibility(value: "hidden" | "visible") {
  Object.defineProperty(document, "visibilityState", { configurable: true, value })
  act(() => document.dispatchEvent(new Event("visibilitychange")))
}

describe("useScreenWakeLock", () => {
  test("unsupported browser is a graceful no-op", async () => {
    Object.defineProperty(navigator, "wakeLock", { configurable: true, value: undefined })
    expect(() => render(true)).not.toThrow()
    await act(async () => Promise.resolve())
  })

  test("requests while visible, releases when hidden, and reacquires when visible", async () => {
    let releaseCount = 0
    const request = mock(async () => ({
      released: false,
      release: async () => { releaseCount += 1 },
      addEventListener: () => undefined,
    }))
    Object.defineProperty(navigator, "wakeLock", { configurable: true, value: { request } })

    render(true)
    await act(async () => Promise.resolve())
    expect(request).toHaveBeenCalledTimes(1)

    setVisibility("hidden")
    expect(releaseCount).toBe(1)
    setVisibility("visible")
    await act(async () => Promise.resolve())
    expect(request).toHaveBeenCalledTimes(2)
  })

  test("closing/unmounting releases and a rejected request never escapes", async () => {
    const release = mock(async () => undefined)
    const request = mock(async () => ({ released: false, release, addEventListener: () => undefined }))
    Object.defineProperty(navigator, "wakeLock", { configurable: true, value: { request } })
    render(true)
    await act(async () => Promise.resolve())
    act(() => root.unmount())
    expect(release).toHaveBeenCalledTimes(1)

    const rejectedRequest = mock(async () => { throw new Error("unsupported") })
    Object.defineProperty(navigator, "wakeLock", { configurable: true, value: { request: rejectedRequest } })
    root = createRoot(host)
    expect(() => render(true)).not.toThrow()
    await act(async () => Promise.resolve())
    expect(rejectedRequest).toHaveBeenCalledTimes(1)
  })
})
