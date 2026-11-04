import { afterAll, afterEach, beforeEach, describe, expect, test } from "bun:test"
import { GlobalRegistrator } from "@happy-dom/global-registrator"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

GlobalRegistrator.register()
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterAll(() => GlobalRegistrator.unregister())

const React = await import("react")
const { createRoot } = await import("react-dom/client")
const { act } = React
const { VentaDevolucionesDialog, subtotalCorreccion, opcionesCorreccion } = await import("./caja-devoluciones")

// F4-B (price rule revised 2026-11-05): a line may only name its own product or
// another product of the SAME sale charged at exactly the same unit price; the
// catalog is never consulted for prices.
const originalFetch = globalThis.fetch
const linea = (id: string, productoId: string, nombre: string, precio: number, cantidad: number, extra: Record<string, unknown> = {}) => ({
  id, productoId, productoVarianteId: null, nombre, varianteNombre: null, precio, cantidad, subtotal: precio * cantidad,
  cantidadDevuelta: 0, cantidadRestante: cantidad, importeDevuelto: 0,
  original: { productoId, productoVarianteId: null, nombre, varianteNombre: null },
  ...extra,
})
const baseVenta = {
  id: "venta-1",
  referencia: "venta-1",
  createdAt: "2026-10-14T15:00:00.000Z",
  metodoPago: "EFECTIVO",
  total: 11000,
  totalDevuelto: 0,
  totalNeto: 11000,
  estadoDevolucion: "VIGENTE",
  corregida: false,
  correccionSecuencia: 0,
  correcciones: [],
  items: [
    linea("item-cola", "p-cola", "Gaseosa Cola", 2000, 2),
    linea("item-lima", "p-lima", "Gaseosa Lima", 2000, 1),
    linea("item-yerba", "p-yerba", "Yerba", 5000, 1),
  ],
  devoluciones: [] as unknown[],
}
let venta = baseVenta
let posts: Array<{ url: string; key: string | null; body: Record<string, unknown> }> = []
let responses: Array<{ status: number; body: Record<string, unknown> }> = []
let fetchedUrls: string[] = []

beforeEach(() => {
  venta = baseVenta
  posts = []
  responses = []
  fetchedUrls = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    fetchedUrls.push(url)
    if (init?.method === "POST") {
      posts.push({ url, key: new Headers(init.headers).get("Idempotency-Key"), body: JSON.parse(String(init.body)) })
      await new Promise((resolve) => setTimeout(resolve, 10))
      const next = responses.shift() ?? { status: 201, body: { ok: true, venta } }
      return new Response(JSON.stringify(next.body), { status: next.status })
    }
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
const text = () => document.body.textContent ?? ""
const button = (label: string) => [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === label || b.getAttribute("aria-label") === label) as HTMLButtonElement | undefined
const selectFor = (nombre: string) => document.querySelector(`select[aria-label="Producto entregado en lugar de ${nombre}"]`) as HTMLSelectElement
const optionsOf = (select: HTMLSelectElement) => [...select.querySelectorAll("option")].map((o) => o.textContent)
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
  await waitFor(() => document.querySelectorAll('form[aria-label="Corregir venta"] select').length === 3)
}
async function confirmar(motivo = "Se escaneó el sabor equivocado") {
  await type(document.querySelector("#correccion-motivo-venta-1") as HTMLInputElement, motivo)
  await click(document.querySelector('form[aria-label="Corregir venta"] input[type="checkbox"]') as HTMLInputElement)
}

describe("F4-B — owner correction form (justified prices)", () => {
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

  test("each line only offers products of the same sale charged at its price; the catalog is never fetched", async () => {
    const root = await render()
    await openForm()
    expect(text()).toContain("sólo puede tomar un producto de esta venta cobrado a ese mismo precio")
    expect(optionsOf(selectFor("Gaseosa Cola"))).toEqual(["Gaseosa Cola", "Gaseosa Lima"])
    expect(optionsOf(selectFor("Gaseosa Lima"))).toEqual(["Gaseosa Lima", "Gaseosa Cola"])
    expect(optionsOf(selectFor("Yerba"))).toEqual(["Yerba"]) // $5.000: nothing else in the sale at that price
    expect(text()).toContain("Sólo se puede corregir la cantidad")
    expect(fetchedUrls.some((url) => url.includes("productos"))).toBe(false)
    await act(async () => root.unmount())
  })

  test("swap to a same-price product of the sale keeps the total; a quantity change that alters it is blocked", async () => {
    const root = await render()
    await openForm()
    await confirmar("Motivo")
    expect(button("Confirmar corrección")!.disabled).toBe(true) // no changes yet
    await choose(selectFor("Gaseosa Cola"), "p-lima|")
    expect(button("Confirmar corrección")!.disabled).toBe(false)
    await click(button("Sumar una unidad (Gaseosa Cola)"))
    expect(text()).toContain("El total corregido debe ser igual al cobrado")
    expect(button("Confirmar corrección")!.disabled).toBe(true)
    // Redistribution at the charged prices keeps the total: 1 Cola-line + 2 Lima-line = $6.000 again.
    await click(button("Restar una unidad (Gaseosa Cola)"))
    await click(button("Restar una unidad (Gaseosa Cola)"))
    await click(button("Sumar una unidad (Gaseosa Lima)"))
    expect(button("Confirmar corrección")!.disabled).toBe(false)
    expect(posts).toHaveLength(0)
    await act(async () => root.unmount())
  })

  test("double click sends ONE request with product/variant/quantity only; success is explicit", async () => {
    const root = await render()
    await openForm()
    await choose(selectFor("Gaseosa Cola"), "p-lima|")
    await confirmar()
    const submit = button("Confirmar corrección")!
    await act(async () => { submit.click(); submit.click() })
    await waitFor(() => text().includes("Venta corregida"))
    expect(posts).toHaveLength(1)
    expect(posts[0].url).toBe("/x/ventas/venta-1/correcciones")
    expect(posts[0].key).toBeTruthy()
    expect(posts[0].body).toEqual({
      motivo: "Se escaneó el sabor equivocado",
      confirmo: true,
      secuenciaEsperada: 0,
      lineas: [
        { ventaItemId: "item-cola", productoId: "p-lima", varianteId: null, cantidad: 2 },
        { ventaItemId: "item-lima", productoId: "p-lima", varianteId: null, cantidad: 1 },
        { ventaItemId: "item-yerba", productoId: "p-yerba", varianteId: null, cantidad: 1 },
      ],
    })
    await act(async () => root.unmount())
  })

  test("a line inherited from the earlier rule is flagged and must be fixed before saving", async () => {
    venta = {
      ...baseVenta,
      corregida: true,
      correccionSecuencia: 1,
      items: [
        linea("item-cola", "p-redmi", "Redmi", 2000, 2, { corregida: true, precioHeredado: true, original: { productoId: "p-cola", productoVarianteId: null, nombre: "Gaseosa Cola", varianteNombre: null } }),
        linea("item-lima", "p-lima", "Gaseosa Lima", 2000, 1),
        linea("item-yerba", "p-yerba", "Yerba", 5000, 1),
      ],
    }
    const root = await render()
    expect(text()).toContain("Precio heredado de Gaseosa Cola")
    await openForm()
    expect(optionsOf(selectFor("Redmi"))).toEqual(["Redmi (precio heredado: elegí otro)", "Gaseosa Cola", "Gaseosa Lima"])
    expect(text()).toContain("no corresponde a su precio cobrado")
    await click(button("Restar una unidad (Gaseosa Lima)"))
    await click(button("Sumar una unidad (Redmi)"))
    await click(button("Restar una unidad (Redmi)"))
    await click(button("Sumar una unidad (Gaseosa Lima)"))
    await confirmar()
    expect(button("Confirmar corrección")!.disabled).toBe(true) // still names Redmi at Cola's price
    await choose(selectFor("Redmi"), "p-cola|")
    expect(button("Confirmar corrección")!.disabled).toBe(false)
    await act(async () => root.unmount())
  })

  test("a server error keeps the form and the retry reuses the same key", async () => {
    responses = [{ status: 500, body: { ok: false, error: "internal" } }]
    const root = await render()
    await openForm()
    await choose(selectFor("Gaseosa Cola"), "p-lima|")
    await confirmar()
    await click(button("Confirmar corrección"))
    await waitFor(() => text().includes("Podés reintentar sin duplicarla"))
    expect(text()).not.toContain("internal")
    expect((document.querySelector("#correccion-motivo-venta-1") as HTMLInputElement).value).toBe("Se escaneó el sabor equivocado")
    await click(button("Confirmar corrección"))
    await waitFor(() => text().includes("Venta corregida"))
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

  test("pure helpers: preview = charged price × quantity; options follow the same-sale same-price rule", () => {
    expect(subtotalCorreccion(2000, 2)).toBe(4000)
    expect(subtotalCorreccion(3.33, 3)).toBe(9.99)
    const items = baseVenta.items as Parameters<typeof opcionesCorreccion>[0]
    expect(opcionesCorreccion(items, items[2]).map((o) => o.etiqueta)).toEqual(["Yerba"])
    expect(opcionesCorreccion(items, items[0]).map((o) => o.key)).toEqual(["p-cola|", "p-lima|"])
  })
})
