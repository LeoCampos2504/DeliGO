// ============================================
// F4-B (P2-A) — owner's "Ventas recientes" shows the CURRENT lines of a
// corrected sale, in the REAL CajaTab (happy-dom, fetch simulated per endpoint).
// Never-corrected sales keep exactly their previous rendering.
// ============================================
import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { GlobalRegistrator } from "@happy-dom/global-registrator"

GlobalRegistrator.register()
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterAll(() => {
  GlobalRegistrator.unregister()
})

mock.module("sonner", () => ({ toast: { success: () => {}, error: () => {} } }))
mock.module("@/components/business/barcode-scanner", () => ({ BarcodeScanner: () => null }))

const React = await import("react")
const { act } = React
const { createRoot } = await import("react-dom/client")
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query")
const { CajaTab } = await import("./caja-tab")

const now = new Date().toISOString()
const corregida = {
  id: "venta-corr", total: 9000, metodoPago: "EFECTIVO", cantidadItems: 3, createdAt: now,
  items: [
    { id: "i-cola", productoId: "p-cola", nombre: "Gaseosa Cola", varianteNombre: null, precio: 2000, cantidad: 2, subtotal: 4000 },
    { id: "i-yerba", productoId: "p-yerba", nombre: "Yerba", varianteNombre: null, precio: 5000, cantidad: 1, subtotal: 5000 },
  ],
}
const original = {
  id: "venta-orig", total: 1200, metodoPago: "TRANSFERENCIA", cantidadItems: 1, createdAt: now,
  items: [{ id: "i-sopa", productoId: "p-sopa", nombre: "Sopa", varianteNombre: null, precio: 1200, cantidad: 1, subtotal: 1200 }],
}
const ventasPayload = {
  ventasHoy: [corregida, original],
  resumenHoy: { cantidadVentas: 2, totalVendido: 10200, totalEfectivo: 9000, totalTransferencia: 1200, totalOtro: 0, totalDevuelto: 0, totalNeto: 10200 },
  devolucionesPorVenta: {},
  correccionesPorVenta: {
    "venta-corr": {
      secuencia: 1,
      items: [
        { id: "i-cola", productoId: "p-lima", nombre: "Gaseosa Lima", varianteNombre: null, precio: 2000, cantidad: 2, subtotal: 4000 },
        { id: "i-yerba", productoId: "p-yerba", nombre: "Yerba", varianteNombre: null, precio: 5000, cantidad: 1, subtotal: 5000 },
      ],
    },
  },
}

const originalFetch = globalThis.fetch
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
}
beforeEach(() => {
  window.sessionStorage.clear()
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url === "/api/negocio/productos") return json([])
    if (url === "/api/negocio/categorias") return json({ categorias: [] })
    if (url === "/api/negocio/caja/cajas") return json({ cajas: [], modoTurnos: "OPCIONAL" })
    if (url === "/api/negocio/caja/ventas") return json(ventasPayload)
    if (url.startsWith("/api/negocio/caja/ventas/historial")) return json({ ok: true, ventas: [] })
    if (url.startsWith("/api/negocio/caja/devoluciones")) return json({ ok: true, devoluciones: [] })
    throw new Error(`unexpected fetch ${url}`)
  }) as typeof fetch
})
afterEach(() => {
  globalThis.fetch = originalFetch
  document.body.innerHTML = ""
})

async function waitFor(check: () => boolean, ms = 3000) {
  const start = Date.now()
  while (!check()) {
    if (Date.now() - start > ms) throw new Error("timeout waiting for UI")
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 15)) })
  }
}
const text = () => document.body.textContent ?? ""
const button = (label: string) => [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === label) as HTMLButtonElement | undefined
const saleRow = (total: string) => [...document.querySelectorAll("button")].find((b) => b.textContent?.includes(total) && b.textContent?.includes("·")) as HTMLButtonElement | undefined

async function renderResumen() {
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
  await waitFor(() => Boolean(button("Resumen")))
  await act(async () => { button("Resumen")!.click() })
  await waitFor(() => text().includes("Ventas recientes") && text().includes("Gaseosa") === false && document.querySelectorAll("button").length > 4)
  return root
}

describe("F4-B P2-A — recent sales show the current lines of corrected sales", () => {
  test("a corrected sale shows «Corregida» and its current products; the history stays reachable", async () => {
    const root = await renderResumen()
    const row = saleRow("9.000")!
    expect(row.textContent).toContain("Corregida")
    expect(row.textContent).toContain("3 unidades")
    await act(async () => { row.click() })
    await waitFor(() => text().includes("Detalle de venta"))
    expect(text()).toContain("Gaseosa Lima")
    expect(text()).not.toContain("Gaseosa Cola")
    expect(text()).toContain("Venta corregida por el dueño: se muestran los productos vigentes")
    expect(button("Ver historial, anular o devolver")).toBeTruthy()
    await act(async () => root.unmount())
  })

  test("a never-corrected sale renders exactly as before (original lines, no badge, same button)", async () => {
    const root = await renderResumen()
    const row = saleRow("1.200")!
    expect(row.textContent).not.toContain("Corregida")
    await act(async () => { row.click() })
    await waitFor(() => text().includes("Detalle de venta"))
    expect(text()).toContain("Sopa")
    expect(text()).not.toContain("Venta corregida por el dueño")
    expect(button("Anular o devolver productos")).toBeTruthy()
    expect(button("Ver historial, anular o devolver")).toBeUndefined()
    await act(async () => root.unmount())
  })
})
