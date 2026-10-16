import { afterAll, afterEach, beforeEach, describe, expect, test } from "bun:test"
import { GlobalRegistrator } from "@happy-dom/global-registrator"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

GlobalRegistrator.register()
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterAll(() => GlobalRegistrator.unregister())

const React = await import("react")
const { createRoot } = await import("react-dom/client")
const { act } = React
const { VentaDevolucionesDialog, subtotalCorreccion } = await import("./caja-devoluciones")

const originalFetch = globalThis.fetch
const baseVenta = {
  id: "venta-1",
  referencia: "venta-1",
  createdAt: "2026-10-14T15:00:00.000Z",
  metodoPago: "EFECTIVO",
  total: 9000,
  totalDevuelto: 0,
  totalNeto: 9000,
  estadoDevolucion: "VIGENTE",
  corregida: false,
  correccionSecuencia: 0,
  correcciones: [],
  items: [
    { id: "item-cola", productoId: "p-cola", productoVarianteId: null, nombre: "Gaseosa Cola", varianteNombre: null, precio: 2000, cantidad: 2, subtotal: 4000, cantidadDevuelta: 0, cantidadRestante: 2, importeDevuelto: 0 },
    { id: "item-yerba", productoId: "p-yerba", productoVarianteId: null, nombre: "Yerba", varianteNombre: null, precio: 5000, cantidad: 1, subtotal: 5000, cantidadDevuelta: 0, cantidadRestante: 1, importeDevuelto: 0 },
  ],
  devoluciones: [] as unknown[],
}
const catalogo = [
  { id: "p-cola", nombre: "Gaseosa Cola", variantes: [] },
  { id: "p-lima", nombre: "Gaseosa Lima", precio: 2200, variantes: [] },
  { id: "p-yerba", nombre: "Yerba", variantes: [] },
]
let venta = baseVenta
let posts: Array<{ url: string; key: string | null; body: Record<string, unknown> }> = []
let responses: Array<{ status: number; body: Record<string, unknown> }> = []

beforeEach(() => {
  venta = baseVenta
  posts = []
  responses = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (init?.method === "POST") {
      posts.push({ url, key: new Headers(init.headers).get("Idempotency-Key"), body: JSON.parse(String(init.body)) })
      await new Promise((resolve) => setTimeout(resolve, 10))
      const next = responses.shift() ?? { status: 201, body: { ok: true, venta } }
      return new Response(JSON.stringify(next.body), { status: next.status })
    }
    if (url === "/owner/productos") return new Response(JSON.stringify(catalogo), { status: 200 })
    return new Response(JSON.stringify({ ok: true, venta }), { status: 200 })
  }) as typeof fetch
})
afterEach(() => { globalThis.fetch = originalFetch; document.body.innerHTML = "" })

const ownerEndpoints = {
  historialUrl: "/x/historial",
  ventaUrl: (id: string) => `/x/ventas/${id}/devoluciones`,
  reintegroUrl: (id: string) => `/x/devoluciones/${id}/reintegro`,
  queryScope: ["test-correcciones"],
  correccionUrl: (id: string) => `/x/ventas/${id}/correcciones`,
  productosUrl: "/owner/productos",
}
const cashierEndpoints = { historialUrl: "/x/historial", ventaUrl: ownerEndpoints.ventaUrl, reintegroUrl: ownerEndpoints.reintegroUrl, queryScope: ["test-cajero"] }

async function waitFor(check: () => boolean, ms = 2000) {
  const start = Date.now()
  while (!check()) {
    if (Date.now() - start > ms) throw new Error("timeout waiting for UI")
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)) })
  }
}
async function render(endpoints: Record<string, unknown> = ownerEndpoints) {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  await act(async () => root.render(
    <QueryClientProvider client={client}>
      <VentaDevolucionesDialog ventaId="venta-1" endpoints={endpoints as typeof ownerEndpoints} onClose={() => {}} />
    </QueryClientProvider>
  ))
  await waitFor(() => (document.body.textContent ?? "").includes("Total original"))
  return root
}
const button = (text: string) => [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === text || b.getAttribute("aria-label") === text) as HTMLButtonElement | undefined
async function click(el: Element | undefined) { await act(async () => { (el as HTMLElement).click() }) }
async function choose(select: HTMLSelectElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(select, value)
    select.dispatchEvent(new Event("change", { bubbles: true }))
  })
}
async function type(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value)
    input.dispatchEvent(new Event("input", { bubbles: true }))
  })
}
async function openForm() {
  await click(button("Corregir venta"))
  await waitFor(() => document.querySelectorAll("select").length >= 2 && [...document.querySelectorAll("option")].some((o) => o.textContent === "Gaseosa Lima"))
}
async function fillSwap() {
  await openForm()
  await choose(document.querySelector('select[aria-label="Producto entregado en lugar de Gaseosa Cola"]') as HTMLSelectElement, "p-lima")
  await type(document.querySelector("#correccion-motivo-venta-1") as HTMLInputElement, "Se escaneó el sabor equivocado")
  await click(document.querySelector('form[aria-label="Corregir venta"] input[type="checkbox"]') as HTMLInputElement)
}

describe("F4-B — owner correction form", () => {
  test("only the owner host shows «Corregir venta»; never the cashier, never after returns", async () => {
    let root = await render(cashierEndpoints)
    expect(button("Corregir venta")).toBeUndefined()
    await act(async () => root.unmount())
    document.body.innerHTML = ""
    venta = { ...baseVenta, devoluciones: [{ id: "d1", ventaId: "venta-1", ventaReferencia: "venta-1", tipo: "DEVOLUCION_PARCIAL", motivo: "m", createdAt: baseVenta.createdAt, importe: 2000, registradaPor: "Vos", metodoPagoVenta: "EFECTIVO", reintegroEstado: "NO_CORRESPONDE", reintegroMedio: null, reintegroRegistradoEn: null, reintegroRegistradoPor: null, reintegroDescripcion: "sin devolución de dinero", items: [] }] }
    root = await render()
    expect(button("Corregir venta")).toBeUndefined()
    await act(async () => root.unmount())
    document.body.innerHTML = ""
    venta = baseVenta
    root = await render()
    expect(button("Corregir venta")).toBeTruthy()
    await act(async () => root.unmount())
  })

  test("a product swap keeps the charged price and total; a quantity change that alters the total is blocked", async () => {
    const root = await render()
    await openForm()
    expect(document.body.textContent).toContain("Cada línea conserva el precio que se cobró")
    await type(document.querySelector("#correccion-motivo-venta-1") as HTMLInputElement, "Motivo")
    await click(document.querySelector('form[aria-label="Corregir venta"] input[type="checkbox"]') as HTMLInputElement)
    expect(button("Confirmar corrección")!.disabled).toBe(true) // no changes yet
    await choose(document.querySelector('select[aria-label="Producto entregado en lugar de Gaseosa Cola"]') as HTMLSelectElement, "p-lima")
    expect(button("Confirmar corrección")!.disabled).toBe(false)
    expect(document.body.textContent).not.toContain("2.200") // never the catalog price
    await click(button("Sumar una unidad (Gaseosa Cola)"))
    expect(document.body.textContent).toContain("El total corregido debe ser igual al cobrado")
    expect(button("Confirmar corrección")!.disabled).toBe(true)
    await click(button("Restar una unidad (Gaseosa Cola)"))
    expect(button("Confirmar corrección")!.disabled).toBe(false)
    expect(posts).toHaveLength(0)
    await act(async () => root.unmount())
  })

  test("double click sends ONE request with product/variant/quantity only; success is explicit", async () => {
    const root = await render()
    await fillSwap()
    const submit = button("Confirmar corrección")!
    await act(async () => { submit.click(); submit.click() })
    await waitFor(() => (document.body.textContent ?? "").includes("Venta corregida"))
    expect(posts).toHaveLength(1)
    expect(posts[0].url).toBe("/x/ventas/venta-1/correcciones")
    expect(posts[0].key).toBeTruthy()
    expect(posts[0].body).toEqual({
      motivo: "Se escaneó el sabor equivocado",
      confirmo: true,
      secuenciaEsperada: 0,
      lineas: [
        { ventaItemId: "item-cola", productoId: "p-lima", varianteId: null, cantidad: 2 },
        { ventaItemId: "item-yerba", productoId: "p-yerba", varianteId: null, cantidad: 1 },
      ],
    })
    await act(async () => root.unmount())
  })

  test("a server error keeps the form and the retry reuses the same key", async () => {
    responses = [{ status: 500, body: { ok: false, error: "internal" } }]
    const root = await render()
    await fillSwap()
    await click(button("Confirmar corrección"))
    await waitFor(() => (document.body.textContent ?? "").includes("Podés reintentar sin duplicarla"))
    expect(document.body.textContent).not.toContain("internal")
    expect((document.querySelector("#correccion-motivo-venta-1") as HTMLInputElement).value).toBe("Se escaneó el sabor equivocado")
    await click(button("Confirmar corrección"))
    await waitFor(() => (document.body.textContent ?? "").includes("Venta corregida"))
    expect(posts).toHaveLength(2)
    expect(posts[1].key).toBe(posts[0].key)
    await act(async () => root.unmount())
  })

  test("actions are stacked full width and wrap (phones)", async () => {
    const root = await render()
    await openForm()
    const actions = document.querySelector('[data-testid="correccion-acciones"]') as HTMLDivElement
    expect(actions.className).toContain("flex-col")
    for (const cls of ["w-full", "whitespace-normal", "h-auto", "min-h-11"]) expect(actions.querySelector('button[type="submit"]')!.className).toContain(cls)
    await act(async () => root.unmount())
  })

  test("preview uses the charged price × quantity (same rule as the server)", () => {
    expect(subtotalCorreccion(2000, 2)).toBe(4000)
    expect(subtotalCorreccion(3.33, 3)).toBe(9.99)
  })
})
