// ============================================
// «Gestionar venta» — the compact catalog picker inside the sale editor, and
// the selling view's selection mode (happy-dom; own process: module mocks)
// ============================================
// Real VentaDevolucionesDialog → GestionarVenta → CatalogoCompacto, fed by the
// owner's real catalog endpoint. fetch is simulated per endpoint. Proves:
// search, tap to add, quantities (+/−), variants, an exact code + Enter (a
// keyboard barcode reader) consolidates into the same line, products without
// stock cannot be added, the quote asks for exactly the chosen products,
// editing them re-quotes, and the editor never posts a sale nor touches the
// checkout attempt. The selling view's selection mode (no longer used by the
// sale editor) keeps never touching the normal checkout.
import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { GlobalRegistrator } from "@happy-dom/global-registrator"

GlobalRegistrator.register()
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterAll(() => GlobalRegistrator.unregister())

mock.module("sonner", () => ({ toast: { success: mock(() => {}), error: mock((_m: string) => {}) } }))
interface ScannerProps { onCode: (code: string, source: "camera" | "manual") => unknown; onClose: () => void }
mock.module("@/components/business/barcode-scanner", () => ({
  BarcodeScanner: (_props: ScannerProps) => null,
}))

const React = await import("react")
const { createRoot } = await import("react-dom/client")
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query")
const { act } = React
const { VentaDevolucionesDialog } = await import("./caja-devoluciones")
const { VenderView, ownerCajaSource, selectorProductos } = await import("./caja-tab")
const { writePendingAttempt, readPendingAttempt } = await import("@/lib/caja-checkout-attempt")

const REDMI = "7790000000017"
function producto(id: string, nombre: string, precio: number, extra: Record<string, unknown> = {}) {
  return { id, nombre, precio, categoria: "Celulares", imagenUrl: null, eliminado: false, controlStock: false, stockCantidad: 0, stockMinimo: 0, variantes: [], marca: null, sku: null, codigoBarras: null, ...extra }
}
const variante = (id: string, nombre: string, precio: number, extra: Record<string, unknown> = {}) => ({ id, nombre, precio, activo: true, controlStock: false, stockCantidad: 0, sku: null, codigoBarras: null, ...extra })
const catalogo = [
  producto("p-redmi", "Redmi", 1000, { codigoBarras: REDMI }),
  producto("p-funda", "Funda", 0, { variantes: [variante("v-negra", "Negra", 1500), variante("v-roja", "Roja", 1500, { controlStock: true, stockCantidad: 0 })] }),
  producto("p-cargador", "Cargador", 800, { controlStock: true, stockCantidad: 0 }),
]
const venta = {
  id: "venta-1", referencia: "venta-1", createdAt: "2026-11-10T10:00:00.000Z", metodoPago: "EFECTIVO", total: 4000, totalDevuelto: 0, totalNeto: 4000, estadoDevolucion: "VIGENTE",
  items: [{ id: "item-saphirus", nombre: "Saphirus", varianteNombre: null, precio: 2000, cantidad: 2, subtotal: 4000, cantidadDevuelta: 0, cantidadRestante: 2, importeDevuelto: 0 }],
  devoluciones: [], vinculo: null, cambiosComoOrigen: [], ventasAdicionales: [],
}
const cotizacion = (entrada: string) => ({
  ok: true,
  cotizacion: {
    importes: { salida: "2000.00", entrada, credito: "2000.00", diferenciaCobrada: "1500.00", diferenciaReintegro: "0.00" },
    liquidacion: "COBRO", advertenciasTexto: [],
    salen: [{ ventaItemId: "item-saphirus", nombre: "Saphirus", cantidad: 1, importe: "2000.00" }],
    entran: [],
  },
})

let posts: Array<{ url: string; body: Record<string, unknown> }> = []
const originalFetch = globalThis.fetch
const respuesta = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body, headers: new Headers() }) as unknown as Response

beforeEach(() => {
  posts = []
  window.localStorage.clear()
  window.sessionStorage.clear()
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (init?.method === "POST") {
      posts.push({ url, body: JSON.parse(String(init.body)) })
      if (url.endsWith("/cambios/cotizacion")) return respuesta(cotizacion("3500.00"))
      return respuesta({ ok: false, error: "no esperado en esta prueba" }, 400)
    }
    if (url === "/api/negocio/productos") return respuesta(catalogo)
    if (url === "/api/negocio/categorias") return respuesta({ categorias: [] })
    if (url.includes("/x/ventas/venta-1/devoluciones")) return respuesta({ ok: true, venta })
    throw new Error(`unexpected fetch ${url}`)
  }) as typeof fetch
})
afterEach(() => {
  globalThis.fetch = originalFetch
  document.body.innerHTML = ""
})

const fuente = ownerCajaSource("neg-1")
const endpoints = {
  historialUrl: "/x/historial",
  ventaUrl: (id: string) => `/x/ventas/${id}/devoluciones`,
  reintegroUrl: (id: string) => `/x/devoluciones/${id}/reintegro`,
  queryScope: ["test-selector-real"],
  comercial: {
    contexto: { negocioId: "neg-1", actor: "NEGOCIO" },
    cambioUrl: (id: string) => `/x/ventas/${id}/cambios`,
    cotizacionUrl: (id: string) => `/x/ventas/${id}/cambios/cotizacion`,
    verificarCambioUrl: (id: string) => `/x/ventas/${id}/cambios/verificacion`,
    verificarAdicionalUrl: (id: string) => `/x/ventas/${id}/adicionales/verificacion`,
    cadenaUrl: (id: string) => `/x/ventas/${id}/cadena`,
    catalogo: { productosUrl: fuente.productosUrl, queryKey: fuente.productosQueryKey }, // the owner's REAL catalog endpoint
  },
}

async function flush(ms = 40) { await act(async () => { await new Promise((r) => setTimeout(r, ms)) }) }
async function montar(node: React.ReactNode) {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  await act(async () => root.render(<QueryClientProvider client={client}>{node}</QueryClientProvider>))
  await flush(80)
  return root
}
const botones = () => [...document.querySelectorAll("button")] as HTMLButtonElement[]
const boton = (texto: string) => botones().find((b) => b.textContent?.trim() === texto || b.getAttribute("aria-label") === texto)
async function click(el: Element | undefined) {
  if (!el) throw new Error("element not found")
  await act(async () => { (el as HTMLElement).click() })
  await flush()
}
async function escribir(input: HTMLInputElement, valor: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, valor)
    input.dispatchEvent(new Event("input", { bubbles: true }))
  })
  await flush()
}
async function enter(input: HTMLInputElement) {
  await act(async () => { input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })) })
  await flush()
}
/** New line of the editor → the quantity shown. */
const cantidadNueva = (nombre: string) => Number((document.querySelector(`input[aria-label="Cantidad de ${nombre} (nuevo)"]`) as HTMLInputElement | null)?.value ?? NaN)
const texto = () => document.body.textContent ?? ""
const QUOTE_WAIT = 500

describe("«Gestionar venta» — compact catalog inside the sale editor", () => {
  test("search, tap, quantities, variants and an exact code build the new lines; out of stock cannot be added; the quote uses them; editing re-quotes; no sale is posted", async () => {
    const root = await montar(<VentaDevolucionesDialog ventaId="venta-1" endpoints={endpoints} onClose={() => {}} />)
    await click(boton("Gestionar venta"))
    await click(boton("Restar una unidad de Saphirus"))
    await click(boton("Vuelve al stock"))
    // the picker lives inside the same dialog (no full-screen selling view, never «Cobrar»)
    expect(document.querySelector('[data-testid="catalogo-compacto"]')).toBeTruthy()
    expect(boton("Escanear productos")).toBeUndefined()
    expect(botones().some((b) => b.textContent?.trim() === "Cobrar")).toBe(false)

    // search filters the real catalog
    const buscador = document.querySelector('input[aria-label="Buscar producto para agregar"]') as HTMLInputElement
    await escribir(buscador, "red")
    expect(boton("Agregar Redmi")).toBeTruthy()
    expect(boton("Agregar Cargador")).toBeUndefined()
    await click(boton("Agregar Redmi"))
    expect(cantidadNueva("Redmi")).toBe(1)
    await click(boton("Sumar una unidad de Redmi (nuevo)"))
    expect(cantidadNueva("Redmi")).toBe(2)

    // variants: chips inside the result; one without stock cannot be added
    await escribir(buscador, "funda")
    expect(boton("Agregar Funda — Roja")!.disabled).toBe(true)
    await click(boton("Agregar Funda — Negra"))
    expect(cantidadNueva("Funda — Negra")).toBe(1)
    // a product without stock cannot be added either
    await escribir(buscador, "carg")
    expect(boton("Agregar Cargador")!.disabled).toBe(true)

    // an exact code + Enter (keyboard barcode reader) consolidates into the same line
    await escribir(buscador, REDMI)
    await enter(buscador)
    expect(cantidadNueva("Redmi")).toBe(3)
    expect(buscador.value).toBe("")

    // the quote (automatic) asks for exactly the chosen products
    await flush(QUOTE_WAIT)
    const cotizacionesHechas = () => posts.filter((p) => p.url.endsWith("/cambios/cotizacion"))
    expect(cotizacionesHechas().at(-1)!.body.entran).toEqual([{ productoId: "p-redmi", cantidad: 3 }, { productoId: "p-funda", varianteId: "v-negra", cantidad: 1 }])
    expect(texto()).toMatch(/Cobrar al cliente\$\s?1\.500,00/)
    expect(boton("Medio de cobro de la diferencia") ?? document.querySelector('[aria-label="Medio de cobro de la diferencia"]')).toBeTruthy()

    // editing a new line invalidates the quote and asks a new one
    const antes = cotizacionesHechas().length
    await click(boton("Restar una unidad de Redmi (nuevo)"))
    expect(boton("Confirmar cambio")!.disabled).toBe(true)
    await flush(QUOTE_WAIT)
    expect(cotizacionesHechas().length).toBe(antes + 1)
    expect(cotizacionesHechas().at(-1)!.body.entran).toEqual([{ productoId: "p-redmi", cantidad: 2 }, { productoId: "p-funda", varianteId: "v-negra", cantidad: 1 }])

    // the editor never sold, never stored a checkout attempt
    expect(posts.filter((p) => !p.url.endsWith("/cambios/cotizacion"))).toHaveLength(0)
    expect(readPendingAttempt("neg-1")).toBeNull()
    expect(Object.keys(window.sessionStorage).filter((k) => k.includes("checkout-attempt"))).toEqual([])
    await act(async () => root.unmount())
  })

  test("the normal selling view keeps its checkout and its pending-attempt recovery next to a selection-mode picker", async () => {
    writePendingAttempt("neg-1", {
      key: "6f1c2c4e-8a1b-4d3e-9f2a-4b7c0d1e2f30",
      canonical: "x",
      metodoPago: "EFECTIVO",
      cart: [{ productoId: "p-cargador", nombre: "Cargador", precio: 800, cantidad: 1 }],
      createdAt: Date.now(),
    })
    const Selector = selectorProductos(ownerCajaSource("neg-1"))
    let elegido: unknown = null
    const root = await montar(<>
      <section data-testid="venta-normal"><VenderView negocioId="neg-1" source={ownerCajaSource("neg-1")} /></section>
      <section data-testid="seleccion"><Selector etiqueta="Usar estos productos" inicial={[]} onConfirmar={(c) => { elegido = c }} /></section>
    </>)
    const normal = document.querySelector('[data-testid="venta-normal"]')!
    const seleccion = document.querySelector('[data-testid="seleccion"]')!
    expect(normal.textContent).toContain("Hay un cobro sin confirmar") // recovery of the normal checkout intact
    expect(seleccion.textContent).not.toContain("Hay un cobro sin confirmar")
    expect([...normal.querySelectorAll("button")].some((b) => b.textContent?.trim() === "Cobrar")).toBe(true)
    // selection mode: its own cart, its own label, never «Cobrar»
    await click([...seleccion.querySelectorAll("button")].find((b) => b.querySelector("p")?.textContent?.trim() === "Redmi"))
    await click([...seleccion.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Usar estos productos"))
    expect(elegido).toEqual([{ productoId: "p-redmi", nombre: "Redmi", precio: 1000, cantidad: 1 }])
    expect([...seleccion.querySelectorAll("button")].some((b) => b.textContent?.trim() === "Cobrar")).toBe(false)
    expect(readPendingAttempt("neg-1")?.key).toBe("6f1c2c4e-8a1b-4d3e-9f2a-4b7c0d1e2f30") // untouched by the picker
    expect(posts).toHaveLength(0)
    await act(async () => root.unmount())
  })
})
