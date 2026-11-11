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

// Sale detail as the shared dialog loads it (GET …/ventas/[id]/devoluciones).
const itemBase = (id: string, nombre: string, precio: number, cantidad: number) => ({ id, productoId: `p-${id}`, nombre, varianteNombre: null, precio, cantidad, subtotal: precio * cantidad, cantidadDevuelta: 0, cantidadRestante: cantidad, importeDevuelto: 0 })
const detalleBase = (id: string, nombre: string, total: number, cantidad: number) => ({
  id, referencia: id.slice(0, 8), createdAt: now, metodoPago: "TRANSFERENCIA", total, totalDevuelto: 0, totalNeto: total, estadoDevolucion: "VIGENTE",
  items: [itemBase("i-sopa", nombre, total / cantidad, cantidad)], devoluciones: [], correcciones: [], vinculo: null, cambiosComoOrigen: [], ventasAdicionales: [],
})
let detalles: Record<string, Record<string, unknown>> = {}
let ventasPayloadActual: Record<string, unknown> = ventasPayload
let posts: string[] = []
const devolucion = (id: string, importe: number, tipo = "DEVOLUCION_PARCIAL") => ({
  id, ventaId: "venta-orig", ventaReferencia: "venta-or", tipo, motivo: "Prueba", createdAt: now, importe, registradaPor: "Dueño", metodoPagoVenta: "TRANSFERENCIA",
  reintegroEstado: "PENDIENTE", reintegroMedio: null, reintegroRegistradoEn: null, reintegroRegistradoPor: null, reintegroDescripcion: "reintegro pendiente",
  items: [{ ventaItemId: "i-sopa", nombre: "Sopa", cantidad: 1, importe, stockResultado: "SIN_CONTROL_STOCK" }],
})
// The corrected sale as the shared detail loads it: CURRENT lines + its correction history.
const detalleCorregida = {
  ...detalleBase("venta-corr", "Gaseosa Lima", 9000, 3), metodoPago: "EFECTIVO", corregida: true, correccionSecuencia: 1,
  items: [
    { ...itemBase("i-cola", "Gaseosa Lima", 2000, 2), corregida: true, original: { productoId: "p-cola", productoVarianteId: null, nombre: "Gaseosa Cola", varianteNombre: null } },
    itemBase("i-yerba", "Yerba", 5000, 1),
  ],
  correcciones: [{ id: "c-1", secuencia: 1, motivo: "Se escaneó otro sabor", createdAt: now, registradaPor: "Dueño", total: 9000, cambios: [{ ventaItemId: "i-cola", precio: 2000, criterioPrecio: null, antes: { nombre: "Gaseosa Lima", cantidad: 2 }, despues: { nombre: "Gaseosa Lima", cantidad: 2 } }] }],
}
const dialogos = () => document.querySelectorAll('[data-slot="dialog-content"]')
const titulo = () => dialogos()[0]?.querySelector('[data-slot="dialog-title"]')?.textContent ?? ""

const originalFetch = globalThis.fetch
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
}
beforeEach(() => {
  window.sessionStorage.clear()
  window.localStorage.clear()
  detalles = { "venta-orig": detalleBase("venta-orig", "Sopa", 1200, 1), "venta-corr": detalleCorregida }
  ventasPayloadActual = ventasPayload
  posts = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (init?.method === "POST") { posts.push(url); return json({ ok: false, error: "no esperado" }, 400) }
    const detalle = url.match(/^\/api\/negocio\/caja\/ventas\/([^/]+)\/devoluciones$/)
    if (detalle && detalles[detalle[1]]) return json({ ok: true, venta: detalles[detalle[1]] })
    if (url === "/api/negocio/productos") return json([])
    if (url === "/api/negocio/categorias") return json({ categorias: [] })
    if (url === "/api/negocio/caja/cajas") return json({ cajas: [], modoTurnos: "OPCIONAL" })
    if (url === "/api/negocio/caja/ventas") return json(ventasPayloadActual)
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
  test("a corrected sale shows «Corregida» and its current products; its full detail keeps the history", async () => {
    const root = await renderResumen()
    const row = saleRow("9.000")!
    expect(row.textContent).toContain("Corregida")
    expect(row.textContent).toContain("3 unidades")
    await act(async () => { row.click() })
    await waitFor(() => text().includes("Correcciones del dueño"))
    expect(titulo()).toBe("Detalle de venta #venta-co")
    expect(text()).toContain("Gaseosa Lima")
    expect(text()).not.toContain("Gaseosa Cola")
    expect(text()).toContain("Corregida")
    expect(button("Gestionar venta")).toBeTruthy()
    await act(async () => root.unmount())
  })

  test("a never-corrected sale: no badge, the same full detail", async () => {
    const root = await renderResumen()
    const row = saleRow("1.200")!
    expect(row.textContent).not.toContain("Corregida")
    await act(async () => { row.click() })
    await waitFor(() => Boolean(button("Anular venta")))
    expect(text()).toContain("Sopa")
    expect(text()).not.toContain("Correcciones del dueño")
    await act(async () => root.unmount())
  })
})

// 2026-11-11 (operator): ONE sale detail. «Ventas recientes» opens the same full
// detail as «Ventas anteriores» (VentaDevolucionesDialog); the editor opens only
// from its «Gestionar venta» and «Volver» comes back to that detail.
describe("«Ventas recientes» opens the shared full sale detail", () => {
  async function abrir(total: string) {
    const root = await renderResumen()
    await act(async () => { saleRow(total)!.click() })
    await waitFor(() => titulo().startsWith("Detalle de venta #"))
    await waitFor(() => !text().includes("Cargando…"))
    return root
  }

  test("a normal sale: full detail (one dialog) → «Gestionar venta» → editor → «Volver» → detail → «Cerrar» → list; nothing is posted", async () => {
    const root = await abrir("1.200")
    expect(dialogos()).toHaveLength(1)
    expect(titulo()).toBe("Detalle de venta #venta-or")
    expect(text()).toContain("Total original")
    expect(button("Gestionar venta")).toBeTruthy()
    expect(button("Anular venta")).toBeTruthy()
    expect(button("Corregir un error de registro")).toBeTruthy() // owner host
    expect(text()).not.toContain("Productos de la venta") // the editor is NOT opened automatically
    await act(async () => { button("Gestionar venta")!.click() })
    await waitFor(() => text().includes("Productos de la venta"))
    expect(dialogos()).toHaveLength(1)
    expect(titulo()).toBe("Gestionar venta #venta-or")
    await act(async () => { button("Volver")!.click() })
    await waitFor(() => titulo() === "Detalle de venta #venta-or")
    await act(async () => { button("Cerrar")!.click() })
    await waitFor(() => dialogos().length === 0)
    expect(text()).toContain("Ventas recientes")
    expect(posts).toHaveLength(0)
    await act(async () => root.unmount())
  })

  test("a partially returned sale: its returns are listed and the editor shows only what is left", async () => {
    detalles["venta-orig"] = {
      ...detalleBase("venta-orig", "Sopa", 1200, 3),
      estadoDevolucion: "DEVOLUCION_PARCIAL", totalDevuelto: 400, totalNeto: 800,
      items: [{ ...itemBase("i-sopa", "Sopa", 400, 3), cantidadDevuelta: 1, cantidadRestante: 2, importeDevuelto: 400 }],
      devoluciones: [devolucion("dev-1", 400)],
    }
    const root = await abrir("1.200")
    expect(text()).toContain("Operaciones registradas")
    expect(button("Corregir un error de registro")).toBeUndefined() // F4-B: never after returns
    await act(async () => { button("Gestionar venta")!.click() })
    await waitFor(() => text().includes("Productos de la venta"))
    expect((document.querySelector('input[aria-label="Cantidad de Sopa"]') as HTMLInputElement).value).toBe("2")
    await act(async () => root.unmount())
  })

  test("a sale generated by an exchange shows its link and can be managed under the same rules", async () => {
    detalles["venta-orig"] = { ...detalleBase("venta-orig", "Sopa", 1200, 1), metodoPago: "CAMBIO", vinculo: { tipo: "CAMBIO", ventaOrigenId: "venta-0", ventaOrigenReferencia: "venta-0" } }
    const root = await abrir("1.200")
    expect(text()).toContain("Viene del cambio de la venta #venta-0")
    expect(button("Gestionar venta")).toBeTruthy()
    await act(async () => root.unmount())
  })

  test("a voided / fully returned sale: full detail with its history, no «Gestionar venta» nor «Anular venta»", async () => {
    detalles["venta-orig"] = {
      ...detalleBase("venta-orig", "Sopa", 1200, 1),
      estadoDevolucion: "ANULADA", totalDevuelto: 1200, totalNeto: 0,
      items: [{ ...itemBase("i-sopa", "Sopa", 1200, 1), cantidadDevuelta: 1, cantidadRestante: 0, importeDevuelto: 1200 }],
      devoluciones: [devolucion("dev-2", 1200, "ANULACION")],
    }
    const root = await abrir("1.200")
    expect(text()).toContain("No quedan productos por devolver")
    expect(text()).toContain("Anulación")
    expect(button("Gestionar venta")).toBeUndefined()
    expect(button("Anular venta")).toBeUndefined()
    await act(async () => { button("Cerrar")!.click() })
    await waitFor(() => dialogos().length === 0)
    await act(async () => root.unmount())
  })

  test("the simplified detail no longer exists: the same dialog component serves both lists", async () => {
    const root = await abrir("1.200")
    expect(button("Ver historial, anular o corregir")).toBeUndefined()
    expect(text()).not.toContain("Hora:")
    await act(async () => root.unmount())
  })
})
