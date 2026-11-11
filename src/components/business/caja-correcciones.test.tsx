import { afterAll, afterEach, beforeEach, describe, expect, test } from "bun:test"
import { GlobalRegistrator } from "@happy-dom/global-registrator"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

GlobalRegistrator.register()
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterAll(() => GlobalRegistrator.unregister())

const React = await import("react")
const { createRoot } = await import("react-dom/client")
const { act } = React
const { VentaDevolucionesDialog, subtotalCorreccion, opcionesCorreccion, entradasCatalogo } = await import("./caja-devoluciones")
const { formatPrice } = await import("@/lib/utils")

// F4-B (price rule revised 2026-11-05, operator decision 2026-11-04): a line may
// name its own product, another product of the SAME sale charged at exactly the
// same unit price, or a product/variant enabled in the catalog whose CURRENT
// price equals the charged price exactly (shown as a coincidence, not as proof).
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
let catalogoStatus = 200
const catalogo = [
  { id: "p-cola", nombre: "Gaseosa Cola", precio: 2000, variantes: [] },
  { id: "p-lima", nombre: "Gaseosa Lima", precio: 2500, variantes: [] }, // catalog changed after the sale
  { id: "p-yerba", nombre: "Yerba", precio: 5000, variantes: [] },
  { id: "p-naranja", nombre: "Gaseosa Naranja", precio: 2000, variantes: [] }, // not in the sale, same price
  { id: "p-redmi", nombre: "Redmi", precio: 1000, variantes: [] }, // cheaper: never offered
  { id: "p-borrado", nombre: "Borrado", precio: 2000, eliminado: true, variantes: [] },
  { id: "p-mate", nombre: "Mate", precio: 5000, variantes: [] },
  { id: "p-remera", nombre: "Remera", precio: 9999, variantes: [{ id: "v-roja", nombre: "Roja", precio: 2000, activo: true }, { id: "v-azul", nombre: "Azul", precio: 2000, activo: false }] },
]

beforeEach(() => {
  venta = baseVenta
  posts = []
  responses = []
  fetchedUrls = []
  catalogoStatus = 200
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    fetchedUrls.push(url)
    if (init?.method === "POST") {
      posts.push({ url, key: new Headers(init.headers).get("Idempotency-Key"), body: JSON.parse(String(init.body)) })
      await new Promise((resolve) => setTimeout(resolve, 10))
      const next = responses.shift() ?? { status: 201, body: { ok: true, venta } }
      return new Response(JSON.stringify(next.body), { status: next.status })
    }
    if (url.includes("/x/productos")) return new Response(JSON.stringify(catalogoStatus === 200 ? catalogo : { error: "x" }), { status: catalogoStatus })
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
  productosUrl: "/x/productos",
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
  await click(button("Corregir un error de registro"))
  await waitFor(() => document.querySelectorAll('form[aria-label="Corregir venta"] select').length === 3)
}
async function confirmar(motivo = "Se escaneó el sabor equivocado") {
  await type(document.querySelector("#correccion-motivo-venta-1") as HTMLInputElement, motivo)
  await click(document.querySelector('form[aria-label="Corregir venta"] input[type="checkbox"]') as HTMLInputElement)
}

describe("F4-B — owner correction form (justified prices)", () => {
  test("only the owner host shows the secondary «Corregir un error de registro»; never the cashier, never after returns", async () => {
    let root = await render(cashierEndpoints)
    expect(button("Corregir un error de registro")).toBeUndefined()
    await act(async () => root.unmount())
    document.body.innerHTML = ""
    venta = { ...baseVenta, devoluciones: [{ id: "d1", ventaId: "venta-1", ventaReferencia: "venta-1", tipo: "DEVOLUCION_PARCIAL", motivo: "m", createdAt: baseVenta.createdAt, importe: 2000, registradaPor: "Vos", metodoPagoVenta: "EFECTIVO", reintegroEstado: "NO_CORRESPONDE", reintegroMedio: null, reintegroRegistradoEn: null, reintegroRegistradoPor: null, reintegroDescripcion: "sin devolución de dinero", items: [] }] }
    root = await render()
    expect(button("Corregir un error de registro")).toBeUndefined()
    await act(async () => root.unmount())
    document.body.innerHTML = ""
    venta = baseVenta
    root = await render()
    expect(button("Corregir un error de registro")).toBeTruthy()
    await act(async () => root.unmount())
  })

  test("each line offers same-sale products at its price and catalog products whose CURRENT price is exactly the charged one", async () => {
    const root = await render()
    await openForm()
    await waitFor(() => optionsOf(selectFor("Gaseosa Cola")).length > 2)
    expect(text()).toContain("uno cuyo precio de catálogo actual sea exactamente el cobrado")
    const cat = (nombre: string, precio: number) => `${nombre} (catálogo actual ${formatPrice(precio)})`
    // Lima stays offered from the sale ($2.000 charged) although its catalog price is now $2.500;
    // Redmi ($1.000), the deleted product and the inactive variant are never offered.
    expect(optionsOf(selectFor("Gaseosa Cola"))).toEqual(["Gaseosa Cola", "Gaseosa Lima", cat("Gaseosa Naranja", 2000), cat("Remera — Roja", 2000)])
    expect(optionsOf(selectFor("Gaseosa Lima"))).toEqual(["Gaseosa Lima", "Gaseosa Cola", cat("Gaseosa Naranja", 2000), cat("Remera — Roja", 2000)])
    expect(optionsOf(selectFor("Yerba"))).toEqual(["Yerba", cat("Mate", 5000)])
    expect(text()).not.toContain("Sólo se puede corregir la cantidad")
    // Choosing a catalog match says plainly what it proves and what it does not.
    await choose(selectFor("Gaseosa Cola"), "p-naranja|")
    expect(text()).toContain("Su precio de catálogo actual coincide con el cobrado")
    expect(text()).toContain("no demuestra el precio que tenía al momento de la venta")
    await confirmar()
    await click(button("Confirmar corrección"))
    await waitFor(() => text().includes("Venta corregida"))
    expect(posts[0].body.lineas).toEqual([
      { ventaItemId: "item-cola", productoId: "p-naranja", varianteId: null, cantidad: 2 },
      { ventaItemId: "item-lima", productoId: "p-lima", varianteId: null, cantidad: 1 },
      { ventaItemId: "item-yerba", productoId: "p-yerba", varianteId: null, cantidad: 1 },
    ])
    await act(async () => root.unmount())
  })

  test("if the catalog cannot be loaded only same-sale products are offered", async () => {
    catalogoStatus = 500
    const root = await render()
    await openForm()
    await waitFor(() => text().includes("No se pudo cargar el catálogo"))
    expect(optionsOf(selectFor("Gaseosa Cola"))).toEqual(["Gaseosa Cola", "Gaseosa Lima"])
    expect(optionsOf(selectFor("Yerba"))).toEqual(["Yerba"])
    expect(text()).toContain("Sólo se puede corregir la cantidad")
    await act(async () => root.unmount())
  })

  test("the history shows the catalog price consulted and when, as a coincidence — never as proof", async () => {
    venta = {
      ...baseVenta,
      corregida: true,
      correccionSecuencia: 1,
      correcciones: [{ id: "c1", secuencia: 1, motivo: "m", createdAt: "2026-11-04T12:00:00.000Z", registradaPor: "Dueño", total: 11000, cambios: [{ ventaItemId: "item-cola", precio: 2000, criterioPrecio: "PRECIO_CATALOGO_ACTUAL", verificacionCatalogo: { precio: 2000, consultadoEn: "2026-11-04T12:00:00.000Z" }, antes: { nombre: "Gaseosa Cola", cantidad: 2 }, despues: { nombre: "Gaseosa Naranja", cantidad: 2 } }] }],
    } as unknown as typeof baseVenta
    const root = await render()
    await waitFor(() => text().includes("Corrección 1"))
    expect(text()).toContain(`precio de catálogo al corregir: ${formatPrice(2000)}`)
    expect(text()).toContain("coincidencia en ese momento, no prueba el precio al vender")
    expect(text()).not.toContain("precio heredado (regla anterior)")
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
    await waitFor(() => optionsOf(selectFor("Redmi")).length > 3)
    // Redmi's own catalog price ($1.000) does not justify it at $2.000.
    expect(optionsOf(selectFor("Redmi"))).toEqual(["Redmi (precio heredado: elegí otro)", "Gaseosa Cola", "Gaseosa Lima", `Gaseosa Naranja (catálogo actual ${formatPrice(2000)})`, `Remera — Roja (catálogo actual ${formatPrice(2000)})`])
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

  test("pure helpers: preview = charged price × quantity; options follow the justified-price rule", () => {
    expect(subtotalCorreccion(2000, 2)).toBe(4000)
    expect(subtotalCorreccion(3.33, 3)).toBe(9.99)
    const items = baseVenta.items as Parameters<typeof opcionesCorreccion>[0]
    expect(opcionesCorreccion(items, items[2]).map((o) => o.etiqueta)).toEqual(["Yerba"])
    expect(opcionesCorreccion(items, items[0]).map((o) => o.key)).toEqual(["p-cola|", "p-lima|"])
    // Catalog entries: deleted products and inactive variants excluded; a product with active variants only by variant.
    const entradas = entradasCatalogo(catalogo)
    expect(entradas.map((e) => e.key)).toEqual(["p-cola|", "p-lima|", "p-naranja|", "p-mate|", "p-redmi|", "p-remera|v-roja", "p-yerba|"])
    const conCatalogo = opcionesCorreccion(items, items[0], entradas)
    expect(conCatalogo.map((o) => [o.key, o.fuente])).toEqual([["p-cola|", "VENTA"], ["p-lima|", "VENTA"], ["p-naranja|", "CATALOGO"], ["p-remera|v-roja", "CATALOGO"]])
    // Exact equality only: $1.999,99 is not $2.000.
    expect(opcionesCorreccion(items, items[0], [{ key: "p-x|", nombre: "X", varianteNombre: null, precio: 1999.99 }]).map((o) => o.key)).toEqual(["p-cola|", "p-lima|"])
    // A line already verified against the catalog by an earlier correction stays valid even if the price changed since.
    const verificada = { ...items[0], productoId: "p-naranja", nombre: "Gaseosa Naranja", corregida: true, criterioPrecio: "PRECIO_CATALOGO_ACTUAL" }
    expect(opcionesCorreccion(items, verificada, []).map((o) => [o.key, o.fuente])).toEqual([["p-cola|", "VENTA"], ["p-lima|", "VENTA"], ["p-naranja|", "VERIFICADO"]])
  })
})
