// ============================================
// F9 — Caja continuous scanning → EXISTING cart → EXISTING checkout (happy-dom)
// ============================================
// Real CajaTab/VenderView. Only the camera component is replaced by a stand-in
// that exposes the props Caja passes to it, so the test can "scan" codes
// through the exact onCode Caja wires. fetch is simulated per endpoint.
// Proves: scans add through the shared cart (consolidated by product/variant
// identity), quantities are edited in the existing CartPanel, scanning never
// posts a sale, the existing checkout posts exactly once, its 409 is surfaced
// and the cart is kept, D4 variant selection, D5 warnings, stale-catalog
// refetch once per code.
import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { GlobalRegistrator } from "@happy-dom/global-registrator"

GlobalRegistrator.register()
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

afterAll(() => {
  GlobalRegistrator.unregister()
})

const toastError = mock((_message: string) => {})
mock.module("sonner", () => ({ toast: { success: mock(() => {}), error: toastError } }))

interface ScannerProps {
  mode: string
  onCode: (code: string, source: "camera" | "manual") => unknown
  onClose: () => void
  paused?: boolean
  announcement?: { id: number; title: string; tone: string } | null
  footer?: unknown
}
let scanner: ScannerProps | null = null
mock.module("@/components/business/barcode-scanner", () => ({
  BarcodeScanner: (props: ScannerProps) => {
    scanner = props
    return null
  },
}))

const React = await import("react")
const { createRoot } = await import("react-dom/client")
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query")
const { act } = React
const { CajaTab } = await import("./caja-tab")

const SOPA = "7791234567898"
const ARROZ = "036000291452" // UPC-A
const FIDEOS = "96385074" // EAN-8

function variante(id: string, nombre: string, precio: number, codigoBarras: string | null) {
  return { id, nombre, precio, activo: true, controlStock: false, stockCantidad: 0, sku: null, codigoBarras }
}
function producto(id: string, nombre: string, precio: number, extra: Record<string, unknown> = {}) {
  return {
    id, nombre, precio, categoria: "Almacén", imagenUrl: null, eliminado: false,
    controlStock: false, stockCantidad: 0, stockMinimo: 0, variantes: [], marca: null, sku: null, codigoBarras: null,
    ...extra,
  }
}

let catalog: unknown[] = []
let catalogGets = 0
let ventaPosts: Array<{ metodoPago: string; items: Array<{ productoId: string; varianteId?: string; cantidad: number }> }> = []
let ventaResponse: { status: number; body: unknown } = { status: 201, body: {} }
const originalFetch = globalThis.fetch

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

beforeEach(() => {
  scanner = null
  catalogGets = 0
  ventaPosts = []
  toastError.mockClear()
  catalog = [
    producto("p-sopa", "Sopa", 1200, { codigoBarras: SOPA, controlStock: true, stockCantidad: 10, stockDisponible: 10 }),
    producto("p-arroz", "Arroz", 1800, { codigoBarras: ARROZ }),
    producto("p-fideos", "Fideos", 950, { codigoBarras: FIDEOS }),
    producto("p-gaseosa", "Gaseosa", 0, {
      codigoBarras: "PARENT-GAS",
      variantes: [variante("v-500", "500 ml", 900, "GAS-500"), variante("v-1l", "1 L", 1500, "GAS-1L")],
    }),
    producto("p-reservado", "Yerba", 3000, { codigoBarras: "YERBA", controlStock: true, stockCantidad: 1, stockDisponible: 0 }),
  ]
  ventaResponse = {
    status: 201,
    body: { id: "venta-1", total: 0, metodoPago: "EFECTIVO", cantidadItems: 0, items: [], createdAt: new Date().toISOString() },
  }
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url === "/api/negocio/productos") {
      catalogGets++
      return jsonResponse(catalog)
    }
    if (url === "/api/negocio/categorias") return jsonResponse({ categorias: [] })
    if (url === "/api/negocio/caja/cajas") return jsonResponse({ modoTurnos: "OPCIONAL", cajas: [] })
    if (url === "/api/negocio/caja/ventas" && init?.method === "POST") {
      ventaPosts.push(JSON.parse(String(init.body)))
      return jsonResponse(ventaResponse.body, ventaResponse.status)
    }
    if (url === "/api/negocio/caja/ventas") return jsonResponse({ ventasHoy: [], resumenHoy: {} })
    throw new Error(`unexpected fetch ${url}`)
  }) as typeof fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
  document.body.innerHTML = ""
})

async function flush(ms = 30) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms))
  })
}

async function renderCaja() {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const root = createRoot(container)
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <CajaTab negocio={{ id: "neg-1" }} />
      </QueryClientProvider>
    )
  })
  await flush(60)
  return { root }
}

function buttonByText(text: string): HTMLButtonElement {
  const button = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim().startsWith(text))
  if (!button) throw new Error(`button not found: ${text}`)
  return button as HTMLButtonElement
}

async function click(el: HTMLElement) {
  await act(async () => {
    el.click()
  })
  await flush()
}

async function scan(code: string) {
  let result: unknown
  await act(async () => {
    result = await scanner!.onCode(code, "camera")
  })
  await flush()
  return result as { tone: string; title: string; detail?: string }
}

describe("F9 — Caja scanning uses the existing cart and checkout", () => {
  test("one tap opens the continuous scanner; sopa, arroz, fideos are added without posting any sale", async () => {
    const { root } = await renderCaja()
    await click(buttonByText("Escanear productos"))
    expect(scanner?.mode).toBe("continuous")
    expect((await scan(SOPA)).title).toBe("Agregado: Sopa")
    expect((await scan(`0${ARROZ}`)).title).toBe("Agregado: Arroz") // EAN-13 form of the UPC-A
    expect((await scan(FIDEOS)).title).toBe("Agregado: Fideos")
    expect(ventaPosts).toHaveLength(0)
    expect(scanner).not.toBeNull() // still open between reads
    await act(async () => root.unmount())
  })

  test("repeated scans consolidate one line; quantity edited with the existing +; checkout posts exactly once", async () => {
    const { root } = await renderCaja()
    await click(buttonByText("Escanear productos"))
    await scan(SOPA)
    const again = await scan(SOPA)
    expect(again.detail).toContain("Cantidad en carrito: 2")
    await scan(ARROZ)
    // close the scanner and use the existing CartPanel
    await act(async () => scanner!.onClose())
    await flush()
    const arrozRow = [...document.querySelectorAll("p.truncate")].find((p) => p.textContent === "Arroz")!.closest("div.flex")!
    const plus = arrozRow.querySelectorAll("button")[1] as HTMLButtonElement
    await click(plus)
    expect(ventaPosts).toHaveLength(0)
    await click(buttonByText("Cobrar"))
    await click(buttonByText("Confirmar venta"))
    expect(ventaPosts).toHaveLength(1)
    expect(ventaPosts[0].items).toEqual([
      { productoId: "p-sopa", cantidad: 2 },
      { productoId: "p-arroz", cantidad: 2 },
    ])
    await act(async () => root.unmount())
  })

  test("D4: parent code with several variants pauses the scanner and opens the existing selector; the pick is announced", async () => {
    const { root } = await renderCaja()
    await click(buttonByText("Escanear productos"))
    const feedback = await scan("PARENT-GAS")
    expect(feedback.title).toBe("Elegí la variante")
    expect(scanner?.paused).toBe(true)
    expect(document.body.textContent).toContain("Elegí una variante — Gaseosa")
    await click(buttonByText("1 L"))
    expect(scanner?.paused).toBe(false)
    expect(scanner?.announcement?.title).toBe("Agregado: Gaseosa — 1 L")
    // exact variant code: no selector
    expect((await scan("GAS-500")).title).toBe("Agregado: Gaseosa — 500 ml")
    await act(async () => scanner!.onClose())
    await flush()
    await click(buttonByText("Cobrar"))
    await click(buttonByText("Confirmar venta"))
    expect(ventaPosts[0].items).toEqual([
      { productoId: "p-gaseosa", varianteId: "v-1l", cantidad: 1 },
      { productoId: "p-gaseosa", varianteId: "v-500", cantidad: 1 },
    ])
    await act(async () => root.unmount())
  })

  test("unknown code: catalog refetched ONCE for that code, then 'Producto no encontrado'; nothing added", async () => {
    const { root } = await renderCaja()
    await click(buttonByText("Escanear productos"))
    const before = catalogGets
    const first = await scan("0000000000000")
    expect(first.title).toBe("Producto no encontrado")
    expect(catalogGets).toBe(before + 1)
    await scan("0000000000000")
    expect(catalogGets).toBe(before + 1)
    expect(document.body.textContent).toContain("Agregá productos para empezar una venta")
    await act(async () => root.unmount())
  })

  test("stale catalog: a product created after opening Caja is found after the single refetch", async () => {
    const { root } = await renderCaja()
    await click(buttonByText("Escanear productos"))
    catalog = [...catalog, producto("p-nuevo", "Galletitas", 700, { codigoBarras: "NUEVO-1" })]
    expect((await scan("NUEVO-1")).title).toBe("Agregado: Galletitas")
    await act(async () => root.unmount())
  })

  test("D5: units reserved for orders → added with a warning that defers to checkout", async () => {
    const { root } = await renderCaja()
    await click(buttonByText("Escanear productos"))
    const feedback = await scan("YERBA")
    expect(feedback.tone).toBe("warning")
    expect(feedback.title).toBe("Agregado: Yerba (×1)")
    expect(feedback.detail).toContain("reservadas para pedidos")
    await act(async () => root.unmount())
  })

  test("checkout 409 (stock reserved) is surfaced by the existing flow and the cart is kept", async () => {
    ventaResponse = { status: 409, body: { error: "\"Yerba\": no quedan unidades disponibles para vender", code: "STOCK_RESERVED_FOR_ORDERS" } }
    const { root } = await renderCaja()
    await click(buttonByText("Escanear productos"))
    await scan("YERBA")
    await act(async () => scanner!.onClose())
    await flush()
    await click(buttonByText("Cobrar"))
    await click(buttonByText("Confirmar venta"))
    expect(ventaPosts).toHaveLength(1)
    expect(toastError).toHaveBeenCalledWith("\"Yerba\": no quedan unidades disponibles para vender")
    expect(document.body.textContent).toContain("Yerba")
    expect(document.body.textContent).not.toContain("Venta registrada")
    await act(async () => root.unmount())
  })
})
