// ============================================
// F9 S3 — camera capture in the 3 Inventario barcode fields (happy-dom)
// ============================================
// Real InventarioTab + real BarcodeField + real BarcodeScanner (single-read);
// only the platform edges are simulated (getUserMedia, video readiness,
// canvas, detector). Proves: a camera button next to each field, the read
// fills ONLY the field it was opened from, the scanner closes and the form
// stays open and editable, and the early duplicate warning.
import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { GlobalRegistrator } from "@happy-dom/global-registrator"

GlobalRegistrator.register()
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

afterAll(() => {
  GlobalRegistrator.unregister()
})

mock.module("sonner", () => ({ toast: { success: mock(() => {}), error: mock(() => {}) } }))

let inView: Array<{ rawValue: string; format: string }> = []
mock.module("@/lib/barcode-detector-loader", () => ({
  ZXING_READER_WASM_URL: "/vendor/zxing-wasm/test/zxing_reader.wasm",
  loadBarcodeDetector: async () => ({ engine: "wasm", detector: { detect: async () => inView } }),
}))

let stoppedTracks = 0
Object.defineProperty(globalThis.navigator, "mediaDevices", {
  configurable: true,
  value: {
    getUserMedia: async () => {
      const track = { stop: () => stoppedTracks++, getCapabilities: () => ({}), applyConstraints: async () => {} }
      return { getTracks: () => [track], getVideoTracks: () => [track] }
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

const React = await import("react")
const { createRoot } = await import("react-dom/client")
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query")
const { act } = React
const { InventarioTab } = await import("./inventario-tab")

const EAN13 = "7791234567898"
const SOPA_CODE = "7790000000016"

const catalog = [
  {
    id: "p-sopa", nombre: "Sopa", precio: 1200, categoria: "Almacén", imagenUrl: null, stock: true, eliminado: false,
    sku: null, codigoBarras: SOPA_CODE, costo: null, marca: null, unidadMedida: "unidad",
    controlStock: false, stockCantidad: 0, stockMinimo: 0, variantes: [],
  },
  {
    id: "p-gas", nombre: "Gaseosa", precio: 0, categoria: "Bebidas", imagenUrl: null, stock: true, eliminado: false,
    sku: null, codigoBarras: null, costo: null, marca: null, unidadMedida: "unidad",
    controlStock: false, stockCantidad: 0, stockMinimo: 0,
    variantes: [
      { id: "v-500", nombre: "500 ml", precio: 900, costo: null, sku: null, codigoBarras: "GAS-500", controlStock: false, stockCantidad: 0, stockMinimo: 0, activo: true },
    ],
  },
]

const originalFetch = globalThis.fetch
beforeEach(() => {
  inView = []
  stoppedTracks = 0
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response
    if (url === "/api/negocio/productos") return json(catalog)
    if (url === "/api/negocio/categorias") return json({ categorias: ["Almacén", "Bebidas"] })
    if (url.startsWith("/api/negocio/inventario/movimientos")) return json([])
    throw new Error(`unexpected fetch ${url}`)
  }) as typeof fetch
})
afterEach(() => {
  globalThis.fetch = originalFetch
  document.body.innerHTML = ""
})

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
async function wait(ms: number) {
  await act(async () => {
    await sleep(ms)
  })
}
async function click(el: Element) {
  await act(async () => {
    ;(el as HTMLElement).click()
  })
  await wait(20)
}
async function typeInto(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value)
    input.dispatchEvent(new Event("input", { bubbles: true }))
  })
}
const cameraButtons = () => [...document.querySelectorAll('button[aria-label="Escanear código de barras"]')]
const scannerOpen = () => document.querySelector("[data-deligo-barcode-scanner]") !== null
function byText(selector: string, text: string) {
  const el = [...document.querySelectorAll(selector)].find((e) => e.textContent?.trim() === text)
  if (!el) throw new Error(`not found: ${selector} "${text}"`)
  return el
}

async function renderInventario() {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <InventarioTab negocio={{ id: "neg-1" }} />
      </QueryClientProvider>
    )
  })
  await wait(60)
  return root
}

async function scanInto(button: Element, code: string) {
  await click(button)
  expect(scannerOpen()).toBe(true)
  inView = [{ rawValue: code, format: "ean_13" }]
  await wait(500)
  inView = []
}

describe("F9 S3 — Inventario barcode capture", () => {
  test("base product: camera fills the field, closes, the form stays open and editable; duplicate warning", async () => {
    const root = await renderInventario()
    await click(byText("button", "Nuevo producto"))
    await click(byText("button", "Detalles avanzados (opcional)")) // existing section, unchanged
    expect(cameraButtons()).toHaveLength(1)
    await scanInto(cameraButtons()[0], EAN13)
    expect(scannerOpen()).toBe(false)
    expect(stoppedTracks).toBeGreaterThan(0)
    const field = document.querySelector<HTMLInputElement>("#inv-barras")!
    expect(field.value).toBe(EAN13)
    expect(document.body.textContent).toContain("Nuevo producto") // form still open
    await typeInto(field, SOPA_CODE) // manual edit still works
    expect(field.value).toBe(SOPA_CODE)
    expect(document.body.textContent).toContain('Ese código de barras ya está asignado a "Sopa"')
    await act(async () => root.unmount())
  })

  test("inline variant rows: the read fills ONLY the row it was opened from; repeated code warning", async () => {
    const root = await renderInventario()
    await click(byText("button", "Nuevo producto"))
    await click(document.querySelector('button[role="switch"]')!)
    await click(byText("button", "Agregar variante"))
    for (const more of [...document.querySelectorAll("button")].filter((b) => b.textContent?.trim() === "Más opciones")) await click(more)
    const rowFields = () => [...document.querySelectorAll<HTMLInputElement>('input[placeholder="Código de barras"]')]
    expect(rowFields()).toHaveLength(2)
    expect(cameraButtons()).toHaveLength(2) // base field hidden once the product has variants
    await scanInto(cameraButtons()[1], EAN13)
    expect(rowFields()[0].value).toBe("")
    expect(rowFields()[1].value).toBe(EAN13)
    await typeInto(rowFields()[0], EAN13)
    expect(document.body.textContent).toContain("Este código está repetido en otra variante del formulario")
    await act(async () => root.unmount())
  })

  test("edit variant: camera fills the field; another article's code warns; its own code does not", async () => {
    const root = await renderInventario()
    await click(byText("p", "Gaseosa"))
    await click(byText("p", "500 ml"))
    expect(document.body.textContent).toContain("Editar variante")
    const field = document.querySelector<HTMLInputElement>("#var-barras")!
    expect(field.value).toBe("GAS-500")
    expect(document.body.textContent).not.toContain("ya está asignado")
    await scanInto(cameraButtons()[0], EAN13)
    expect(field.value).toBe(EAN13)
    expect(document.body.textContent).toContain("Editar variante")
    await typeInto(field, SOPA_CODE)
    expect(document.body.textContent).toContain('Ese código de barras ya está asignado a "Sopa"')
    await typeInto(field, "GAS-500")
    expect(document.body.textContent).not.toContain("ya está asignado")
    await act(async () => root.unmount())
  })
})
