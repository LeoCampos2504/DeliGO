// ============================================
// F9 — BarcodeScanner component (happy-dom, real detection loop)
// ============================================
// Real component + real scan lock + real timers. Only the platform edges are
// simulated: getUserMedia (fake tracks with stop spies), the video element's
// readiness, a 2D canvas, and the detector (scripted "what is in front of
// the camera right now").
import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { GlobalRegistrator } from "@happy-dom/global-registrator"

GlobalRegistrator.register()
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

afterAll(() => {
  GlobalRegistrator.unregister()
})

// What the camera "sees" on each analyzed frame.
let inView: Array<{ rawValue: string; format: string }> = []
let detectCalls = 0
mock.module("@/lib/barcode-detector-loader", () => ({
  ZXING_READER_WASM_URL: "/vendor/zxing-wasm/test/zxing_reader.wasm",
  loadBarcodeDetector: async () => ({
    engine: "wasm",
    detector: {
      detect: async () => {
        detectCalls++
        return inView
      },
    },
  }),
}))

const React = await import("react")
const { createRoot } = await import("react-dom/client")
const { act } = React
const { BarcodeScanner } = await import("./barcode-scanner")

const EAN13 = "7791234567898"

interface FakeTrack {
  stop: ReturnType<typeof mock>
  getCapabilities: () => Record<string, unknown>
  applyConstraints: () => Promise<void>
}
let tracks: FakeTrack[] = []
let getUserMediaImpl: () => Promise<unknown>
let getUserMediaCalls = 0

function fakeStream() {
  const track: FakeTrack = { stop: mock(() => {}), getCapabilities: () => ({}), applyConstraints: async () => {} }
  tracks.push(track)
  return { getTracks: () => [track], getVideoTracks: () => [track] }
}

Object.defineProperty(globalThis.navigator, "mediaDevices", {
  configurable: true,
  value: {
    getUserMedia: async () => {
      getUserMediaCalls++
      return getUserMediaImpl()
    },
  },
})
const videoProto = globalThis.HTMLVideoElement.prototype as unknown as Record<string, unknown>
Object.defineProperty(videoProto, "readyState", { configurable: true, get: () => 4 })
Object.defineProperty(videoProto, "videoWidth", { configurable: true, get: () => 1280 })
Object.defineProperty(videoProto, "videoHeight", { configurable: true, get: () => 720 })
videoProto.play = async () => {}
videoProto.pause = () => {}
Object.defineProperty(videoProto, "srcObject", { configurable: true, get: () => null, set: () => {} })
;(globalThis.HTMLCanvasElement.prototype as unknown as { getContext: () => unknown }).getContext = () => ({ drawImage: () => {} })

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
async function wait(ms: number) {
  await act(async () => {
    await sleep(ms)
  })
}

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

function render(element: React.ReactElement) {
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
  return act(async () => {
    root.render(element)
  })
}

beforeEach(() => {
  inView = []
  detectCalls = 0
  tracks = []
  getUserMediaCalls = 0
  getUserMediaImpl = async () => fakeStream()
})

afterEach(async () => {
  await act(async () => root?.unmount())
  container?.remove()
  document.body.innerHTML = ""
})

describe("BarcodeScanner — continuous (Caja)", () => {
  test("a code held in view adds ONE unit, the camera stays open, and a new presentation adds another", async () => {
    const onCode = mock((code: string) => ({ tone: "success" as const, title: `Agregado: ${code}` }))
    await render(<BarcodeScanner mode="continuous" title="Escanear productos" onClose={() => {}} onCode={onCode} />)
    inView = [{ rawValue: EAN13, format: "ean_13" }]
    await wait(1500) // ~10+ frames with the code still in front
    expect(onCode).toHaveBeenCalledTimes(1)
    expect(onCode.mock.calls[0]).toEqual([EAN13, "camera"])
    expect(document.body.textContent).toContain(`Agregado: ${EAN13}`)
    expect(tracks[0].stop).not.toHaveBeenCalled() // camera remains open between reads

    inView = []
    await wait(1000) // leaves the frame (> re-arm) …
    inView = [{ rawValue: EAN13, format: "ean_13" }]
    await wait(600) // … and comes back
    expect(onCode).toHaveBeenCalledTimes(2)
    expect(tracks).toHaveLength(1)
  })

  test("a misread with a wrong check digit is ignored", async () => {
    const onCode = mock(() => ({ tone: "success" as const, title: "x" }))
    await render(<BarcodeScanner mode="continuous" title="t" onClose={() => {}} onCode={onCode} />)
    inView = [{ rawValue: "7791234567890", format: "ean_13" }]
    await wait(700)
    expect(onCode).not.toHaveBeenCalled()
  })

  test("paused (variant selector open): nothing is added, and resuming with the same code in view adds nothing", async () => {
    const onCode = mock(() => ({ tone: "success" as const, title: "x" }))
    const ui = (paused: boolean) => <BarcodeScanner mode="continuous" title="t" onClose={() => {}} onCode={onCode} paused={paused} />
    await render(ui(true))
    inView = [{ rawValue: EAN13, format: "ean_13" }]
    await wait(600)
    expect(onCode).not.toHaveBeenCalled()
    await act(async () => root.render(ui(false)))
    await wait(600)
    expect(onCode).not.toHaveBeenCalled()
  })

  test("closing releases every camera track and stops the detection loop and listeners", async () => {
    const added: string[] = []
    const removed: string[] = []
    const origAdd = document.addEventListener.bind(document)
    const origRemove = document.removeEventListener.bind(document)
    document.addEventListener = ((type: string, ...rest: unknown[]) => {
      added.push(type)
      return (origAdd as (...a: unknown[]) => void)(type, ...rest)
    }) as typeof document.addEventListener
    document.removeEventListener = ((type: string, ...rest: unknown[]) => {
      removed.push(type)
      return (origRemove as (...a: unknown[]) => void)(type, ...rest)
    }) as typeof document.removeEventListener
    try {
      await render(<BarcodeScanner mode="continuous" title="t" onClose={() => {}} onCode={() => undefined} />)
      await wait(300)
      expect(detectCalls).toBeGreaterThan(0)
      await act(async () => root.unmount())
      expect(tracks.every((t) => t.stop.mock.calls.length > 0)).toBe(true)
      const callsAtClose = detectCalls
      await wait(400)
      expect(detectCalls).toBe(callsAtClose) // no loop left running
      expect(removed.filter((t) => t === "visibilitychange").length).toBe(added.filter((t) => t === "visibilitychange").length)
      expect(removed.filter((t) => t === "keydown").length).toBe(added.filter((t) => t === "keydown").length)
      expect(document.querySelector("[data-deligo-barcode-scanner]")).toBeNull()
    } finally {
      document.addEventListener = origAdd
      document.removeEventListener = origRemove
    }
  })

  test("closing while the permission prompt is still open never leaves the camera on", async () => {
    let resolveStream: (value: unknown) => void = () => {}
    getUserMediaImpl = () => new Promise((resolve) => (resolveStream = resolve))
    await render(<BarcodeScanner mode="continuous" title="t" onClose={() => {}} onCode={() => undefined} />)
    await act(async () => root.unmount())
    await act(async () => resolveStream(fakeStream()))
    expect(tracks[0].stop).toHaveBeenCalled()
  })

  test("reopening starts with a fresh lock (the same code is accepted right away)", async () => {
    const onCode = mock(() => ({ tone: "success" as const, title: "x" }))
    inView = [{ rawValue: EAN13, format: "ean_13" }]
    await render(<BarcodeScanner mode="continuous" title="t" onClose={() => {}} onCode={onCode} />)
    await wait(500)
    expect(onCode).toHaveBeenCalledTimes(1)
    await act(async () => root.unmount())
    container.remove()
    await render(<BarcodeScanner mode="continuous" title="t" onClose={() => {}} onCode={onCode} />)
    await wait(500)
    expect(onCode).toHaveBeenCalledTimes(2)
  })

  test("app in background releases the camera; returning restarts it", async () => {
    await render(<BarcodeScanner mode="continuous" title="t" onClose={() => {}} onCode={() => undefined} />)
    await wait(200)
    const visibility = { value: "hidden" }
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility.value })
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"))
    })
    expect(tracks[0].stop).toHaveBeenCalled()
    visibility.value = "visible"
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"))
    })
    await wait(200)
    expect(getUserMediaCalls).toBe(2)
    expect(tracks).toHaveLength(2)
  })

  test("permission denied: clear message, manual entry works without camera", async () => {
    getUserMediaImpl = async () => {
      throw Object.assign(new Error("denied"), { name: "NotAllowedError" })
    }
    const onCode = mock(() => ({ tone: "success" as const, title: "Agregado: manual" }))
    await render(<BarcodeScanner mode="continuous" title="t" onClose={() => {}} onCode={onCode} />)
    await wait(100)
    expect(document.body.textContent).toContain("Permiso de cámara denegado")
    const input = document.querySelector<HTMLInputElement>('input[aria-label="Código de barras manual"]')!
    expect(input).not.toBeNull()
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!
      setter.call(input, " INT-42 ")
      input.dispatchEvent(new Event("input", { bubbles: true }))
    })
    await act(async () => {
      input.form!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
    })
    await wait(50)
    expect(onCode).toHaveBeenCalledWith("INT-42", "manual")
  })
})

describe("BarcodeScanner — single-read (Inventario)", () => {
  test("first valid read calls onCode exactly once", async () => {
    const onCode = mock(() => undefined)
    await render(<BarcodeScanner mode="single" title="t" onClose={() => {}} onCode={onCode} />)
    inView = [{ rawValue: EAN13, format: "ean_13" }]
    await wait(400)
    inView = []
    await wait(900)
    inView = [{ rawValue: EAN13, format: "ean_13" }]
    await wait(400)
    expect(onCode).toHaveBeenCalledTimes(1)
    expect(onCode.mock.calls[0]).toEqual([EAN13, "camera"])
  })
})
