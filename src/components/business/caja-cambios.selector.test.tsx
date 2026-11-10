// ============================================
// F4-C5 — the REAL product selector (VenderView in selection mode) inside the
// exchange dialog (happy-dom; own process: process-wide module mocks)
// ============================================
// Real VentaDevolucionesDialog → OperacionComercial → selectorProductos →
// VenderView. Only the camera component is replaced by a stand-in exposing the
// props Caja passes (so codes can be "scanned" through the exact onCode Caja
// wires) and sonner's toast. fetch is simulated per endpoint. Proves: search,
// tap to add, quantities (+/−), variants, scanner consolidation, the quote is
// asked with the selected cart, editing the cart invalidates the quote, the
// selection mode never posts a sale nor touches the checkout attempt, and the
// normal selling view keeps its checkout and its pending-attempt recovery.
import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { GlobalRegistrator } from "@happy-dom/global-registrator"

GlobalRegistrator.register()
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterAll(() => GlobalRegistrator.unregister())

mock.module("sonner", () => ({ toast: { success: mock(() => {}), error: mock((_m: string) => {}) } }))
interface ScannerProps { onCode: (code: string, source: "camera" | "manual") => unknown; onClose: () => void }
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
const { VentaDevolucionesDialog } = await import("./caja-devoluciones")
const { VenderView, ownerCajaSource, selectorProductos } = await import("./caja-tab")
const { writePendingAttempt, readPendingAttempt } = await import("@/lib/caja-checkout-attempt")

const REDMI = "7790000000017"
function producto(id: string, nombre: string, precio: number, extra: Record<string, unknown> = {}) {
  return { id, nombre, precio, categoria: "Celulares", imagenUrl: null, eliminado: false, controlStock: false, stockCantidad: 0, stockMinimo: 0, variantes: [], marca: null, sku: null, codigoBarras: null, ...extra }
}
const variante = (id: string, nombre: string, precio: number) => ({ id, nombre, precio, activo: true, controlStock: false, stockCantidad: 0, sku: null, codigoBarras: null })
const catalogo = [
  producto("p-redmi", "Redmi", 1000, { codigoBarras: REDMI }),
  producto("p-funda", "Funda", 0, { variantes: [variante("v-negra", "Negra", 1500), variante("v-roja", "Roja", 1500)] }),
  producto("p-cargador", "Cargador", 800),
]
const venta = {
  id: "venta-1", referencia: "venta-1", createdAt: "2026-11-10T10:00:00.000Z", metodoPago: "EFECTIVO", total: 4000, totalDevuelto: 0, totalNeto: 4000, estadoDevolucion: "VIGENTE",
  items: [{ id: "item-saphirus", nombre: "Saphirus", varianteNombre: null, precio: 2000, cantidad: 2, subtotal: 4000, cantidadDevuelta: 0, cantidadRestante: 2, importeDevuelto: 0 }],
  devoluciones: [], vinculo: null, cambiosComoOrigen: [], ventasAdicionales: [],
}
const cotizacion = (entrada: string) => ({
  ok: true,
  cotizacion: {
    importes: { salida: "2000.00", entrada, credito: "2000.00", diferenciaCobrada: "0.00", diferenciaReintegro: "0.00" },
    liquidacion: "SIN_DIFERENCIA", advertenciasTexto: [],
    salen: [{ ventaItemId: "item-saphirus", nombre: "Saphirus", cantidad: 1, importe: "2000.00" }],
    entran: [],
  },
})

let posts: Array<{ url: string; body: Record<string, unknown> }> = []
const originalFetch = globalThis.fetch
const respuesta = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body, headers: new Headers() }) as unknown as Response

beforeEach(() => {
  posts = []
  scanner = null
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
    adicionalUrl: (id: string) => `/x/ventas/${id}/adicionales`,
    verificarAdicionalUrl: (id: string) => `/x/ventas/${id}/adicionales/verificacion`,
    cadenaUrl: (id: string) => `/x/ventas/${id}/cadena`,
    Selector: selectorProductos(ownerCajaSource("neg-1")), // the REAL selling view
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
const tarjeta = (nombre: string) => botones().find((b) => b.querySelector("p")?.textContent?.trim() === nombre)
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
/** Cart line (desktop cart panel, rendered first) → its −, + buttons and the quantity shown. */
function lineaCarrito(nombre: string) {
  const p = [...document.querySelectorAll("p")].find((x) => x.textContent?.trim() === nombre && x.className.includes("truncate"))
  const fila = p?.closest("div.flex") as HTMLElement | null
  if (!fila) return null
  const [menos, mas] = [...fila.querySelectorAll("button")]
  return { menos, mas, cantidad: Number(fila.querySelector("span.tabular-nums")?.textContent) }
}
const texto = () => document.body.textContent ?? ""

describe("F4-C5 — real selector inside the exchange flow", () => {
  test("search, tap, quantities, variants and scanner build the cart; the quote uses it; editing it invalidates the quote; no sale is posted", async () => {
    const root = await montar(<VentaDevolucionesDialog ventaId="venta-1" endpoints={endpoints} onClose={() => {}} />)
    await click(boton("Cambiar productos"))
    await click(boton("Sumar una unidad de Saphirus"))
    await click(boton("Vuelve al stock"))
    await click(boton("Elegir lo que se lleva"))
    await flush(80)
    // the real selling view, in selection mode
    expect(boton("Escanear productos")).toBeTruthy()
    expect(texto()).not.toContain("Hay un cobro sin confirmar")
    expect(botones().some((b) => b.textContent?.trim() === "Cobrar")).toBe(false)

    // search filters the real catalog
    const buscador = document.querySelector('input[placeholder="Buscar producto…"]') as HTMLInputElement
    await escribir(buscador, "red")
    expect(tarjeta("Redmi")).toBeTruthy()
    expect(tarjeta("Cargador")).toBeUndefined()
    await click(tarjeta("Redmi"))
    expect(lineaCarrito("Redmi")?.cantidad).toBe(1)
    await click(lineaCarrito("Redmi")!.mas)
    expect(lineaCarrito("Redmi")?.cantidad).toBe(2)

    // variants: the real selector dialog
    await escribir(buscador, "")
    await click(tarjeta("Funda"))
    await click(botones().find((b) => b.textContent?.trim().startsWith("Negra")))
    expect(lineaCarrito("Funda — Negra")?.cantidad).toBe(1)

    // scanner (camera stand-in): the code consolidates into the same cart line
    await click(boton("Escanear productos"))
    expect(scanner).not.toBeNull()
    let lectura: { title?: string } = {}
    await act(async () => { lectura = (await scanner!.onCode(REDMI, "camera")) as { title?: string } })
    await flush()
    expect(lectura.title).toBe("Agregado: Redmi")
    expect(lineaCarrito("Redmi")?.cantidad).toBe(3)
    await act(async () => scanner!.onClose())
    await flush()

    // the selection goes to the exchange, and the quote asks for exactly that cart
    await click(boton("Usar estos productos"))
    await click(boton("Calcular cambio"))
    await flush()
    const cot = posts.find((p) => p.url.endsWith("/cambios/cotizacion"))!
    expect(cot.body.entran).toEqual([{ productoId: "p-redmi", cantidad: 3 }, { productoId: "p-funda", varianteId: "v-negra", cantidad: 1 }])
    expect(boton("Volver a calcular")).toBeTruthy()

    // editing quantities in the real cart invalidates the quote
    await click(boton("Cambiar lo que se lleva"))
    await flush(80)
    expect(lineaCarrito("Redmi")?.cantidad).toBe(3) // the selector opens with the chosen cart
    await click(lineaCarrito("Redmi")!.menos)
    await click(boton("Usar estos productos"))
    expect(texto()).toContain("Cambiaste los productos: pedí una nueva cotización.")
    expect(boton("Confirmar cambio")!.disabled).toBe(true)

    // the selection mode never sold, never stored a checkout attempt
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
    const Selector = endpoints.comercial.Selector
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
