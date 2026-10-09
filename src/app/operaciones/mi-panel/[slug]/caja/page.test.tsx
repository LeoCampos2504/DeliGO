// ============================================
// F10-B1 — Cashier PWA page /operaciones/mi-panel/[slug]/caja (happy-dom)
// ============================================
// fetch simulated per endpoint. Proves: the page renders the SAME VenderView
// pointed at the cashier endpoints only (never /api/negocio/*); every checkout
// sends a UUID Idempotency-Key to POST /api/operativo/caja/[slug]/ventas; the
// pending attempt is scoped to employee + business (never recovered by another
// employee or by the owner's Caja); session/área loss follows the server.
import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { GlobalRegistrator } from "@happy-dom/global-registrator"

GlobalRegistrator.register()
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterAll(() => {
  GlobalRegistrator.unregister()
})

const toastError = mock((_m: string) => {})
const toastSuccess = mock((_m: string) => {})
const replace = mock((_href: string) => {})
// Next's app-router useRouter() is referentially stable — the mock must be too.
const routerMock = { replace, push: replace, refresh: () => {} }
const navMock = { homeHref: "/operaciones/mi-panel", loginHref: "/operaciones/ingresar", noSessionMode: "redirect" }
mock.module("sonner", () => ({ toast: { success: toastSuccess, error: toastError } }))
mock.module("@/components/business/barcode-scanner", () => ({ BarcodeScanner: () => null }))
mock.module("next/navigation", () => ({
  useParams: () => ({ slug: "kiosco-1" }),
  useRouter: () => routerMock,
}))
mock.module("@/components/operativo/use-operativo-nav", () => ({
  useOperativoNav: () => navMock,
}))

const React = await import("react")
mock.module("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => React.createElement("a", { href, ...rest }, children),
}))
const { createRoot } = await import("react-dom/client")
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query")
const { act } = React
const { default: CajeroCajaPage } = await import("./page")

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const producto = { id: "p-agua", nombre: "Agua", precio: 900, categoria: "Bebidas", imagenUrl: null, eliminado: false, controlStock: false, stockCantidad: 0, stockMinimo: 0, variantes: [], marca: null, sku: null, codigoBarras: null }
const venta = { id: "venta-1", total: 900, metodoPago: "EFECTIVO", cantidadItems: 1, items: [], createdAt: new Date().toISOString() }

let empleadoId = "emp-1"
let catalogResponse: { status: number; body: unknown } | null = null
let calls: string[] = []
let posts: Array<{ url: string; key: string | null }> = []
let nextPost: Array<"network" | { status: number; body: unknown }> = []
const originalFetch = globalThis.fetch

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
}

beforeEach(() => {
  window.sessionStorage.clear()
  empleadoId = "emp-1"
  catalogResponse = null
  calls = []
  posts = []
  nextPost = []
  replace.mockClear()
  toastError.mockClear()
  toastSuccess.mockClear()
  Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => true })
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push(`${init?.method ?? "GET"} ${url}`)
    if (url === "/api/operativo/caja/kiosco-1/productos") {
      if (catalogResponse) return json(catalogResponse.body, catalogResponse.status)
      return json({
        ok: true,
        estado: "operativo",
        negocio: { id: "neg-1", nombre: "Kiosco Uno", slug: "kiosco-1", colorPrincipal: "#000", logoUrl: null },
        empleado: { id: empleadoId, nombre: "Ana" },
        productos: [producto],
      })
    }
    if (url === "/api/operativo/caja/kiosco-1/ventas" && init?.method === "POST") {
      posts.push({ url, key: new Headers(init.headers).get("Idempotency-Key") })
      const next = nextPost.shift() ?? { status: 201, body: venta }
      if (next === "network") throw new TypeError("Failed to fetch")
      return json(next.body, next.status)
    }
    throw new Error(`unexpected fetch ${url}`)
  }) as typeof fetch
})
afterEach(() => {
  globalThis.fetch = originalFetch
  document.body.innerHTML = ""
})

async function flush(ms = 50) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms))
  })
}
async function renderPage() {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <CajeroCajaPage />
      </QueryClientProvider>
    )
  })
  await flush(80)
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
  if (!p) throw new Error(`product not found: ${nombre}`)
  await click(p.closest("button") as HTMLButtonElement)
}
async function cobrar() {
  await click(buttonByText("Cobrar"))
  await click(buttonByText("Confirmar venta"))
}

const CASHIER_ATTEMPT = "deligo:caja:checkout-attempt:v1:operativo:emp-1:neg-1"
const OWNER_ATTEMPT = "deligo:caja:checkout-attempt:v1:neg-1"

describe("F10-B1 — cashier PWA page", () => {
  test("renders the selling view for the cashier and posts ONLY to the operativo sale endpoint with a UUID key", async () => {
    const root = await renderPage()
    expect(document.body.textContent).toContain("Kiosco Uno")
    expect(document.body.textContent).toContain("Vendiendo como Ana")
    await tapProduct("Agua")
    await cobrar()
    expect(posts).toHaveLength(1)
    expect(posts[0].url).toBe("/api/operativo/caja/kiosco-1/ventas")
    expect(posts[0].key).toMatch(UUID)
    expect(document.body.textContent).toContain("Venta registrada")
    // never an owner endpoint (no owner catalog with cost, no categories admin, no daily summary)
    expect(calls.some((c) => c.includes("/api/negocio/"))).toBe(false)
    expect(window.sessionStorage.getItem(CASHIER_ATTEMPT)).toBeNull()
    await act(async () => root.unmount())
  })

  test("uncertain sale: attempt scoped to employee + business; retry reuses the key; another employee and the owner never recover it", async () => {
    nextPost = ["network"]
    const first = await renderPage()
    await tapProduct("Agua")
    await cobrar()
    expect(document.body.textContent).not.toContain("Venta registrada")
    expect(window.sessionStorage.getItem(CASHIER_ATTEMPT)).not.toBeNull()
    expect(window.sessionStorage.getItem(OWNER_ATTEMPT)).toBeNull()
    const key = posts[0].key
    await act(async () => first.unmount())
    document.body.innerHTML = ""

    // same employee reloads → banner + same key on confirm
    nextPost = [{ status: 200, body: venta }]
    const second = await renderPage()
    expect(document.body.textContent).toContain("Hay un cobro sin confirmar")
    await cobrar()
    expect(posts[1].key).toBe(key)
    await act(async () => second.unmount())
    document.body.innerHTML = ""

    // another employee on the same device/business never sees it
    window.sessionStorage.setItem(CASHIER_ATTEMPT, JSON.stringify({ key, metodoPago: "EFECTIVO", lines: [] }))
    empleadoId = "emp-2"
    const third = await renderPage()
    expect(document.body.textContent).not.toContain("Hay un cobro sin confirmar")
    await act(async () => third.unmount())
  })

  test("no session (401) → personal login; área lost → personal home; business unavailable → message, no selling view", async () => {
    catalogResponse = { status: 401, body: { ok: false, estado: "sin_sesion" } }
    let root = await renderPage()
    expect(replace.mock.calls.at(-1)?.[0]).toBe("/operaciones/ingresar")
    await act(async () => root.unmount())
    document.body.innerHTML = ""

    catalogResponse = { status: 403, body: { ok: false, estado: "area_no_habilitada" } }
    root = await renderPage()
    expect(replace.mock.calls.at(-1)?.[0]).toBe("/operaciones/mi-panel")
    await act(async () => root.unmount())
    document.body.innerHTML = ""

    replace.mockClear()
    catalogResponse = { status: 403, body: { ok: false, estado: "acceso_no_disponible" } }
    root = await renderPage()
    expect(replace).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain("La Caja no está disponible")
    expect(document.body.textContent).not.toContain("Cobrar")
    await act(async () => root.unmount())
  })

  test("access lost during checkout (403) → leaves the selling view", async () => {
    nextPost = [{ status: 403, body: { ok: false, estado: "area_no_habilitada", error: "Acceso no disponible" } }]
    const root = await renderPage()
    await tapProduct("Agua")
    await cobrar()
    expect(document.body.textContent).not.toContain("Venta registrada")
    // VenderView reports only the status; the page leaves the selling view (no cart left usable)
    expect(document.body.textContent).toContain("La Caja no está disponible")
    expect(document.body.textContent).not.toContain("Confirmar venta")
    await act(async () => root.unmount())
  })
})
