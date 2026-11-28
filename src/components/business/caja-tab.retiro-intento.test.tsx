// T7-F1 — Caja (dueño) con un retiro personal de resultado incierto (happy-dom, CajaTab real):
// respuesta perdida → el intento queda guardado y el carrito no se vacía; cerrar y reabrir, o recargar, vuelve al
// MISMO intento (misma clave, mismo contenido); mientras exista, «Cobrar» no cobra una venta con ese carrito.
import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { GlobalRegistrator } from "@happy-dom/global-registrator"

GlobalRegistrator.register()
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterAll(() => GlobalRegistrator.unregister())

const toastError = mock((_m: string) => {})
const toastSuccess = mock((_m: string) => {})
mock.module("sonner", () => ({ toast: { success: toastSuccess, error: toastError } }))
mock.module("@/components/business/barcode-scanner", () => ({ BarcodeScanner: () => null }))

const React = await import("react")
const { createRoot } = await import("react-dom/client")
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query")
const { act } = React
const { CajaTab } = await import("./caja-tab")

const STORAGE = "deligo:caja:retiro-attempt:v1:neg-1"
const catalog = [{ id: "p-arroz", nombre: "Arroz", precio: 1800, categoria: "Almacén", imagenUrl: null, eliminado: false, controlStock: false, stockCantidad: 0, stockMinimo: 0, variantes: [], marca: null, sku: null, codigoBarras: null }]
let retiros: Array<{ key: string | null; body: string }> = []
let ventas = 0
let nextRetiro: Array<"network" | { status: number; body: unknown; replayed?: boolean }> = []
const originalFetch = globalThis.fetch
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } })

beforeEach(() => {
  window.sessionStorage.clear()
  retiros = []
  ventas = 0
  nextRetiro = []
  Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => true })
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url === "/api/negocio/productos") return json(catalog)
    if (url === "/api/negocio/categorias") return json({ categorias: [] })
    if (url === "/api/negocio/caja/cajas") return json({ cajas: [], modoTurnos: "OPCIONAL" })
    if (url === "/api/negocio/caja/ventas" && init?.method === "POST") { ventas++; return json({ id: "v1" }, 201) }
    if (url === "/api/negocio/caja/ventas") return json({ ventasHoy: [], resumenHoy: {} })
    if (url === "/api/negocio/caja/ventas/inicio" && init?.method === "POST") return json({ id: "inicio-1", expiraEn: new Date(Date.now() + 600000).toISOString() }, 201)
    if (url.startsWith("/api/negocio/caja/ventas/inicio/")) return json({ vencido: false, usado: false, precios: [] })
    if (url === "/api/negocio/caja/retiros-personales/contexto") return json({ ok: true, habilitado: true, propioEmpleadoId: null, empleados: [], familiares: [], dueno: { nombre: "Mi Negocio" } })
    if (url === "/api/negocio/caja/retiros-personales" && init?.method === "POST") {
      retiros.push({ key: new Headers(init.headers).get("Idempotency-Key"), body: String(init.body) })
      const next = nextRetiro.shift() ?? { status: 201, body: { ok: true, retiro: { id: "r1", beneficiarioNombre: "Mi Negocio", valorComercial: 1800, cantidadLineas: 1 } } }
      if (next === "network") throw new TypeError("Failed to fetch")
      return json(next.body, next.status, next.replayed ? { "Idempotency-Replayed": "true" } : {})
    }
    return json({}, 404)
  }) as typeof fetch
})
afterEach(() => { globalThis.fetch = originalFetch; document.body.innerHTML = "" })

async function flush(ms = 50) { await act(async () => { await new Promise((r) => setTimeout(r, ms)) }) }
async function renderCaja() {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await act(async () => { root.render(React.createElement(QueryClientProvider, { client }, React.createElement(CajaTab, { negocio: { id: "neg-1" } }))) })
  await flush(80)
  return root
}
const $ = (testId: string) => document.querySelector(`[data-testid="${testId}"]`) as HTMLElement | null
function buttonByText(text: string): HTMLButtonElement | null {
  return ([...document.querySelectorAll("button")].find((el) => el.textContent?.trim().startsWith(text)) as HTMLButtonElement) ?? null
}
async function click(el: Element | null) { await act(async () => { (el as HTMLElement).click() }); await flush() }
async function tapProduct(nombre: string) {
  const p = [...document.querySelectorAll("button p")].find((el) => el.textContent === nombre)
  await click(p!.closest("button"))
}
async function escape() {
  await act(async () => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })) })
  await flush()
}
async function iniciarRetiroDueno() {
  await click(buttonByText("Cobrar"))
  await click($("checkout-retiro-personal"))
  await click([...document.querySelectorAll('[role="radio"]')].find((b) => b.textContent === "Dueño") ?? null)
  await click($("retiro-confirmo"))
  await click($("retiro-confirmar"))
}

describe("T7-F1 — Caja: retiro personal de resultado incierto", () => {
  test("respuesta perdida, cierre y reapertura, recarga: siempre el mismo intento; Cobrar no lo convierte en venta", async () => {
    let root = await renderCaja()
    await tapProduct("Arroz")
    nextRetiro.push("network")
    await iniciarRetiroDueno()
    const guardado = JSON.parse(window.sessionStorage.getItem(STORAGE)!)
    expect(guardado.key).toBe(retiros[0].key)
    expect(guardado.canonical).toBe(retiros[0].body)
    expect(guardado.cart.map((l: { productoId: string }) => l.productoId)).toEqual(["p-arroz"])
    expect($("retiro-pendiente")).not.toBeNull()
    // cerrar y reabrir: el banner vuelve al mismo intento
    await escape()
    expect($("retiro-pendiente-banner")).not.toBeNull()
    await click(buttonByText("Revisar el retiro"))
    expect($("retiro-pendiente")).not.toBeNull()
    await escape()
    // «Cobrar» mientras hay un retiro incierto reabre el retiro, nunca el cobro de una venta
    await click(buttonByText("Cobrar"))
    expect($("retiro-pendiente")).not.toBeNull()
    expect(buttonByText("Confirmar venta")).toBeNull()
    await escape()
    // recarga: se restaura el carrito del intento y el mismo intento
    await act(async () => root.unmount())
    document.body.innerHTML = ""
    root = await renderCaja()
    expect($("retiro-pendiente-banner")).not.toBeNull()
    expect(buttonByText("Cobrar")).not.toBeNull() // el carrito restaurado
    await click(buttonByText("Cobrar"))
    nextRetiro.push({ status: 200, body: { ok: true, retiro: { id: "r1", beneficiarioNombre: "Mi Negocio", valorComercial: 1800, cantidadLineas: 1 } }, replayed: true })
    await click($("retiro-reintentar"))
    expect(retiros).toHaveLength(2)
    expect([retiros[1].key, retiros[1].body]).toEqual([retiros[0].key, retiros[0].body])
    expect(window.sessionStorage.getItem(STORAGE)).toBeNull()
    expect($("retiro-pendiente-banner")).toBeNull()
    expect(ventas).toBe(0)
    expect(toastSuccess).toHaveBeenCalled()
    await act(async () => root.unmount())
  })

  test("sin respuesta incierta no queda nada guardado; un rechazo definitivo permite corregir y reintentar con otra clave", async () => {
    const root = await renderCaja()
    await tapProduct("Arroz")
    nextRetiro.push({ status: 409, body: { ok: false, error: "No hay stock suficiente", code: "STOCK_INSUFFICIENT" } })
    await iniciarRetiroDueno()
    expect(window.sessionStorage.getItem(STORAGE)).toBeNull()
    expect(document.body.textContent).toContain("No hay stock suficiente")
    await click($("retiro-confirmar"))
    expect(retiros).toHaveLength(2)
    expect(retiros[1].key).not.toBe(retiros[0].key)
    expect(window.sessionStorage.getItem(STORAGE)).toBeNull()
    expect(ventas).toBe(0)
    await act(async () => root.unmount())
  })
})
