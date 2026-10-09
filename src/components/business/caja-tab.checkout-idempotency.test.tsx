// ============================================
// F10-B0 — Caja checkout idempotency in the REAL CajaTab (happy-dom)
// ============================================
// fetch simulated per endpoint. Proves: every checkout sends a UUID
// Idempotency-Key; an uncertain outcome (network error) keeps the attempt and
// the retry reuses the SAME key (server replay → no double sale); a changed
// cart gets a NEW key; a reload restores cart + key; a reused-key 409 drops
// the attempt; offline never pretends a sale and sends nothing.
import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { GlobalRegistrator } from "@happy-dom/global-registrator"

GlobalRegistrator.register()
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterAll(() => {
  GlobalRegistrator.unregister()
})

const toastError = mock((_m: string) => {})
const toastSuccess = mock((_m: string) => {})
mock.module("sonner", () => ({ toast: { success: toastSuccess, error: toastError } }))
mock.module("@/components/business/barcode-scanner", () => ({ BarcodeScanner: () => null }))

const React = await import("react")
const { createRoot } = await import("react-dom/client")
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query")
const { act } = React
const { CajaTab } = await import("./caja-tab")

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const catalog = [
  { id: "p-arroz", nombre: "Arroz", precio: 1800, categoria: "Almacén", imagenUrl: null, eliminado: false, controlStock: false, stockCantidad: 0, stockMinimo: 0, variantes: [], marca: null, sku: null, codigoBarras: null },
  { id: "p-sopa", nombre: "Sopa", precio: 1200, categoria: "Almacén", imagenUrl: null, eliminado: false, controlStock: false, stockCantidad: 0, stockMinimo: 0, variantes: [], marca: null, sku: null, codigoBarras: null },
]
const venta = { id: "venta-1", total: 1800, metodoPago: "EFECTIVO", cantidadItems: 1, items: [], createdAt: new Date().toISOString() }

let posts: Array<{ key: string | null; body: { metodoPago: string; items: unknown[] } }> = []
let nextPost: Array<"network" | { status: number; body: unknown; replayed?: boolean }> = []
const originalFetch = globalThis.fetch

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } })
}

beforeEach(() => {
  window.sessionStorage.clear()
  posts = []
  nextPost = []
  toastError.mockClear()
  toastSuccess.mockClear()
  Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => true })
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url === "/api/negocio/productos") return json(catalog)
    if (url === "/api/negocio/categorias") return json({ categorias: [] })
    if (url === "/api/negocio/caja/ventas" && init?.method === "POST") {
      const headers = new Headers(init.headers)
      posts.push({ key: headers.get("Idempotency-Key"), body: JSON.parse(String(init.body)) })
      const next = nextPost.shift() ?? { status: 201, body: venta }
      if (next === "network") throw new TypeError("Failed to fetch")
      return json(next.body, next.status, next.replayed ? { "Idempotency-Replayed": "true" } : {})
    }
    if (url === "/api/negocio/caja/ventas") return json({ ventasHoy: [], resumenHoy: {} })
    throw new Error(`unexpected fetch ${url}`)
  }) as typeof fetch
})
afterEach(() => {
  globalThis.fetch = originalFetch
  document.body.innerHTML = ""
})

async function flush(ms = 40) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms))
  })
}
async function renderCaja() {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <CajaTab negocio={{ id: "neg-1" }} />
      </QueryClientProvider>
    )
  })
  await flush(60)
  return root
}
function buttonByText(text: string): HTMLButtonElement {
  const b = [...document.querySelectorAll("button")].find((el) => el.textContent?.trim().startsWith(text))
  if (!b) throw new Error(`button not found: ${text}`)
  return b as HTMLButtonElement
}
async function click(el: HTMLElement) {
  await act(async () => {
    el.click()
  })
  await flush()
}
async function tapProduct(nombre: string) {
  const p = [...document.querySelectorAll("button p")].find((el) => el.textContent === nombre)
  await click(p!.closest("button") as HTMLButtonElement)
}
async function cobrar() {
  await click(buttonByText("Cobrar"))
  await click(buttonByText("Confirmar venta"))
}

describe("F10-B0 — Caja checkout idempotency (client)", () => {
  test("every checkout sends a UUID Idempotency-Key; success leaves nothing pending", async () => {
    const root = await renderCaja()
    await tapProduct("Arroz")
    await cobrar()
    expect(posts).toHaveLength(1)
    expect(posts[0].key).toMatch(UUID)
    expect(window.sessionStorage.getItem("deligo:caja:checkout-attempt:v1:neg-1")).toBeNull()
    expect(document.body.textContent).toContain("Venta registrada")
    await act(async () => root.unmount())
  })

  test("network error → attempt kept (not reported as sold); retry reuses the SAME key and the server replay ends it", async () => {
    nextPost = ["network", { status: 200, body: venta, replayed: true }]
    const root = await renderCaja()
    await tapProduct("Arroz")
    await cobrar()
    expect(toastError.mock.calls.at(-1)?.[0]).toContain("No pudimos confirmar la venta")
    expect(document.body.textContent).not.toContain("Venta registrada")
    expect(window.sessionStorage.getItem("deligo:caja:checkout-attempt:v1:neg-1")).not.toBeNull()
    await click(buttonByText("Confirmar venta")) // dialog still open → retry same content
    expect(posts).toHaveLength(2)
    expect(posts[1].key).toBe(posts[0].key)
    expect(toastSuccess.mock.calls.at(-1)?.[0]).toContain("ya estaba registrada")
    expect(window.sessionStorage.getItem("deligo:caja:checkout-attempt:v1:neg-1")).toBeNull()
    await act(async () => root.unmount())
  })

  test("after an uncertain failure, changing the cart starts a NEW attempt (new key)", async () => {
    nextPost = ["network", { status: 201, body: venta }]
    const root = await renderCaja()
    await tapProduct("Arroz")
    await cobrar()
    await act(async () => {
      ;(document.querySelector('[data-slot="dialog-close"], button[aria-label="Close"]') as HTMLElement | null)?.click()
    })
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
    })
    await flush()
    await tapProduct("Sopa")
    await cobrar()
    expect(posts).toHaveLength(2)
    expect(posts[1].key).not.toBe(posts[0].key)
    await act(async () => root.unmount())
  })

  test("reload: the unconfirmed attempt restores cart + key and a banner; confirming reuses the key; it can be discarded", async () => {
    nextPost = ["network"]
    const first = await renderCaja()
    await tapProduct("Arroz")
    await cobrar()
    const storedKey = posts[0].key
    await act(async () => first.unmount())
    document.body.innerHTML = ""

    nextPost = [{ status: 200, body: venta, replayed: true }]
    const second = await renderCaja()
    expect(document.body.textContent).toContain("Hay un cobro sin confirmar")
    expect(document.body.textContent).toContain("Arroz")
    await cobrar()
    expect(posts[1].key).toBe(storedKey)
    await act(async () => second.unmount())
    document.body.innerHTML = ""

    // discard path
    window.sessionStorage.clear()
    nextPost = ["network"]
    const third = await renderCaja()
    await tapProduct("Sopa")
    await cobrar()
    await act(async () => third.unmount())
    document.body.innerHTML = ""
    const fourth = await renderCaja()
    await click(buttonByText("Descartar este intento"))
    expect(window.sessionStorage.getItem("deligo:caja:checkout-attempt:v1:neg-1")).toBeNull()
    expect(document.body.textContent).not.toContain("Hay un cobro sin confirmar")
    await act(async () => fourth.unmount())
  })

  test("reused-key 409 drops the attempt; definitive stock 409 is shown and nothing is reported as sold", async () => {
    nextPost = [
      { status: 409, body: { error: "Este intento de cobro ya se usó para otra venta. Volvé a intentar el cobro.", code: "IDEMPOTENCY_KEY_REUSED" } },
      { status: 409, body: { error: "\"Arroz\": no quedan unidades disponibles para vender", code: "STOCK_RESERVED_FOR_ORDERS" } },
    ]
    const root = await renderCaja()
    await tapProduct("Arroz")
    await cobrar()
    expect(window.sessionStorage.getItem("deligo:caja:checkout-attempt:v1:neg-1")).toBeNull()
    await click(buttonByText("Confirmar venta"))
    expect(posts[1].key).not.toBe(posts[0].key)
    expect(toastError.mock.calls.at(-1)?.[0]).toContain("no quedan unidades")
    expect(document.body.textContent).not.toContain("Venta registrada")
    await act(async () => root.unmount())
  })

  test("offline: nothing is sent and the user is told the sale was NOT registered", async () => {
    Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => false })
    const root = await renderCaja()
    await tapProduct("Arroz")
    await cobrar()
    expect(posts).toHaveLength(0)
    expect(toastError.mock.calls.at(-1)?.[0]).toContain("la venta NO se registró")
    await act(async () => root.unmount())
  })
})
