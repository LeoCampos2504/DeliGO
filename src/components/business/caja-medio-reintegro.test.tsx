// Refund method: always an EXPLICIT choice (2026-11-11).
// Manual test: a $100 refund meant to be paid in cash was recorded as a
// TRANSFER because the form preselected the sale's own method. Every place
// where money is handed back now starts with NO method, shows the sale's method
// only as a reference, cannot be confirmed until a method is chosen, never
// changes the choice on its own, says what each method does to the register,
// and sends exactly the chosen method.
import { afterAll, afterEach, beforeEach, describe, expect, test } from "bun:test"
import { GlobalRegistrator } from "@happy-dom/global-registrator"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

GlobalRegistrator.register()
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterAll(() => GlobalRegistrator.unregister())

const React = await import("react")
const { createRoot } = await import("react-dom/client")
const { act } = React
const { VentaDevolucionesDialog } = await import("./caja-devoluciones")

const originalFetch = globalThis.fetch
const item = { id: "item-gaseosa", nombre: "Gaseosa", varianteNombre: null, precio: 2000, cantidad: 2, subtotal: 4000, cantidadDevuelta: 0, cantidadRestante: 2, importeDevuelto: 0 }
const ventaCon = (metodoPago: string, extra: Record<string, unknown> = {}) => ({
  id: "venta-1", referencia: "venta-1", createdAt: "2026-11-11T15:00:00.000Z", metodoPago, total: 4000, totalDevuelto: 0, totalNeto: 4000,
  estadoDevolucion: "VIGENTE", items: [item], devoluciones: [], vinculo: null, cambiosComoOrigen: [], ventasAdicionales: [], ...extra,
})
const pendiente = (metodoPagoVenta: string) => ventaCon(metodoPagoVenta, {
  estadoDevolucion: "DEVOLUCION_PARCIAL", totalDevuelto: 2000, totalNeto: 2000,
  items: [{ ...item, cantidadDevuelta: 1, cantidadRestante: 1, importeDevuelto: 2000 }],
  devoluciones: [{
    id: "dev-1", ventaId: "venta-1", ventaReferencia: "venta-1", tipo: "DEVOLUCION_PARCIAL", motivo: "No le gustó", createdAt: "2026-11-11T16:00:00.000Z",
    importe: 2000, importeReintegrable: 2000, cambioId: null, registradaPor: "Dueño", metodoPagoVenta,
    reintegroEstado: "PENDIENTE", reintegroMedio: null, reintegroRegistradoEn: null, reintegroRegistradoPor: null, reintegroDescripcion: "reintegro pendiente",
    items: [{ ventaItemId: "item-gaseosa", nombre: "Gaseosa", cantidad: 1, importe: 2000, stockResultado: "REINGRESADO" }],
  }],
})
const catalogo = [{ id: "p-agua", nombre: "Agua", precio: 1000, eliminado: false, marca: null, sku: null, codigoBarras: null, controlStock: false, stockCantidad: 0, variantes: [] }]
const cotizacion = {
  importes: { salida: "2000.00", entrada: "1000.00", credito: "1000.00", diferenciaCobrada: "0.00", diferenciaReintegro: "1000.00" },
  liquidacion: "REINTEGRO",
  advertencias: { version: 1, items: [] },
  advertenciasTexto: [],
  salen: [{ ventaItemId: "item-gaseosa", nombre: "Gaseosa", cantidad: 1, importe: "2000.00" }],
  entran: [{ productoId: "p-agua", productoVarianteId: null, nombre: "Agua", varianteNombre: null, precio: 1000, cantidad: 1, subtotal: "1000.00" }],
}

let venta: Record<string, unknown> = ventaCon("TRANSFERENCIA")
let cajas: Array<{ id: string; nombre: string; turnoAbierto: { responsableNombre: string } | null }> = []
let posts: Array<{ url: string; body: Record<string, unknown> }> = []

beforeEach(() => {
  posts = []
  cajas = []
  window.localStorage.clear()
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (init?.method === "POST") {
      const body = JSON.parse(String(init.body))
      posts.push({ url, body })
      await new Promise((resolve) => setTimeout(resolve, 10))
      if (url.endsWith("/cotizacion")) return new Response(JSON.stringify({ ok: true, cotizacion }), { status: 200 })
      if (url.endsWith("/cambios")) return new Response(JSON.stringify({ ok: true, replayed: false, cambio: { ventaOrigenReferencia: "venta-1", ventaNuevaReferencia: "nueva-1", importes: cotizacion.importes, liquidacion: "REINTEGRO", advertenciasTexto: [] } }), { status: 201 })
      return new Response(JSON.stringify({ ok: true, devolucion: { importe: 2000, reintegroDescripcion: "registrado" }, venta }), { status: 201 })
    }
    if (url === "/x/cajas") return new Response(JSON.stringify({ cajas }), { status: 200 })
    if (url === "/x/productos") return new Response(JSON.stringify(catalogo), { status: 200 })
    if (url.includes("/cadena")) return new Response(JSON.stringify({ ok: true, ventas: [], cambios: [] }), { status: 200 })
    return new Response(JSON.stringify({ ok: true, venta }), { status: 200 })
  }) as typeof fetch
})
afterEach(() => { globalThis.fetch = originalFetch; document.body.innerHTML = "" })

type Host = "cajero" | "dueño"
const endpoints = (host: Host) => ({
  historialUrl: "/x/historial",
  ventaUrl: (id: string) => `/x/ventas/${id}/devoluciones`,
  reintegroUrl: (id: string) => `/x/devoluciones/${id}/reintegro`,
  queryScope: ["test-medio-reintegro"],
  ...(host === "dueño" ? { ownerRegistersUrl: "/x/cajas" } : {}),
  comercial: {
    contexto: { negocioId: "neg-1", actor: host === "dueño" ? "NEGOCIO" : "EMPLEADO:e-1" },
    ...(host === "dueño" ? { ownerRegistersUrl: "/x/cajas" } : {}),
    cambioUrl: (id: string) => `/x/ventas/${id}/cambios`,
    cotizacionUrl: (id: string) => `/x/ventas/${id}/cambios/cotizacion`,
    verificarCambioUrl: (id: string) => `/x/ventas/${id}/cambios/verificacion`,
    verificarAdicionalUrl: (id: string) => `/x/ventas/${id}/adicionales/verificacion`,
    cadenaUrl: (id: string) => `/x/ventas/${id}/cadena`,
    catalogo: { productosUrl: "/x/productos", queryKey: ["test-medio-catalogo"] },
  },
})

async function flush(ms = 40) { await act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)) }) }
async function render(host: Host = "cajero") {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  await act(async () => root.render(
    <QueryClientProvider client={client}>
      <VentaDevolucionesDialog ventaId="venta-1" endpoints={endpoints(host)} onClose={() => {}} />
    </QueryClientProvider>
  ))
  await flush()
  return root
}
const button = (label: string) => [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === label || b.getAttribute("aria-label") === label) as HTMLButtonElement | undefined
const medio = (label: string) => [...document.querySelectorAll('[data-testid="medio-reintegro"] button')].find((b) => b.textContent?.trim() === label) as HTMLButtonElement | undefined
const presionados = () => [...document.querySelectorAll('[data-testid="medio-reintegro"] button[aria-pressed="true"]')].map((b) => b.textContent?.trim())
const consecuencia = () => document.querySelector('[data-testid="consecuencia-reintegro"]')?.textContent ?? ""
const text = () => document.body.textContent ?? ""
async function click(el: Element | undefined) {
  if (!el) throw new Error("element not found")
  await act(async () => { (el as HTMLElement).click() })
}
async function type(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value)
    input.dispatchEvent(new Event("input", { bubbles: true }))
  })
}
async function elegir(select: HTMLSelectElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(select, value)
    select.dispatchEvent(new Event("change", { bubbles: true }))
  })
}
const radio = (label: string) => [...document.querySelectorAll("label")].find((l) => l.textContent?.trim() === label)?.querySelector('input[type="radio"]') as HTMLInputElement | undefined

/** «Gestionar venta»: one unit back, back to stock, reason, money handed back now. */
async function devolucionInmediata() {
  await click(button("Gestionar venta"))
  await flush()
  await click(button("Restar una unidad de Gaseosa"))
  await click(button("Vuelve al stock"))
  await type(document.querySelector('input[aria-label="Motivo"]') as HTMLInputElement, "No le gustó")
  await click(radio("Lo devuelvo ahora"))
}

describe("A. immediate return («Gestionar venta»)", () => {
  test("sale charged by TRANSFER, refund chosen in CASH: nothing preselected, confirmation blocked until chosen, exactly EFECTIVO is sent", async () => {
    venta = ventaCon("TRANSFERENCIA")
    const root = await render("cajero")
    await devolucionInmediata()
    expect(presionados()).toEqual([]) // never the sale's own method
    expect(text()).toContain("La venta se cobró con transferencia. Es solo una referencia")
    expect(consecuencia()).toContain("Elegí un medio para continuar.")
    expect(button("Confirmar devolución")!.disabled).toBe(true)
    await click(medio("Efectivo"))
    expect(presionados()).toEqual(["Efectivo"])
    expect(consecuencia()).toContain("Sale efectivo de Caja")
    expect(consecuencia()).toContain("Sale de la caja de tu turno abierto") // cashier: her own shift
    expect(consecuencia()).not.toMatch(/esperad/i) // blind close: no register amounts on the cashier side
    expect(button("Confirmar devolución")!.disabled).toBe(false)
    await click(button("Confirmar devolución"))
    await flush()
    expect(posts).toHaveLength(1)
    expect(posts[0].body.reintegro).toEqual({ modo: "REALIZADO", medio: "EFECTIVO" })
    expect(posts[0].body).not.toHaveProperty("cajaFisicaId")
    await act(async () => root.unmount())
  })

  test("sale charged in CASH, refund chosen by TRANSFER: says no cash leaves and DeliGO does not transfer; exactly TRANSFERENCIA is sent", async () => {
    venta = ventaCon("EFECTIVO")
    const root = await render("cajero")
    await devolucionInmediata()
    expect(presionados()).toEqual([])
    expect(text()).toContain("La venta se cobró con efectivo.")
    await click(medio("Transferencia"))
    expect(consecuencia()).toContain("No se descuenta efectivo de Caja")
    expect(consecuencia()).toContain("DeliGO registra la transferencia, pero no la realiza")
    await click(button("Confirmar devolución"))
    await flush()
    expect(posts[0].body.reintegro).toEqual({ modo: "REALIZADO", medio: "TRANSFERENCIA" })
    await act(async () => root.unmount())
  })

  test("the choice is never changed on its own (switching what happens with the money and back keeps it); no method when no money moves", async () => {
    venta = ventaCon("EFECTIVO")
    const root = await render("cajero")
    await devolucionInmediata()
    await click(medio("Otro medio"))
    await click(radio("Queda pendiente de devolver"))
    expect(document.querySelector('[data-testid="medio-reintegro"]')).toBeNull() // pending: no method asked
    await click(radio("Lo devuelvo ahora"))
    expect(presionados()).toEqual(["Otro medio"])
    await click(radio("No corresponde devolver dinero"))
    await click(button("Confirmar devolución"))
    await flush()
    expect(posts[0].body.reintegro).toEqual({ modo: "NO_CORRESPONDE" }) // no method introduced when no money moves
    await act(async () => root.unmount())
  })

  test("owner with SEVERAL open registers: cash also requires choosing the register; the chosen one is sent", async () => {
    venta = ventaCon("TRANSFERENCIA")
    cajas = [
      { id: "caja-a", nombre: "Caja principal", turnoAbierto: { responsableNombre: "Ana" } },
      { id: "caja-b", nombre: "Caja 2", turnoAbierto: { responsableNombre: "Beto" } },
    ]
    const root = await render("dueño")
    await devolucionInmediata()
    await click(medio("Efectivo"))
    await flush()
    expect(consecuencia()).toContain("Hay varias cajas abiertas: elegí de cuál sale el efectivo.")
    expect(button("Confirmar devolución")!.disabled).toBe(true)
    await elegir(document.querySelector('select[aria-label="Caja del efectivo"]') as HTMLSelectElement, "caja-b")
    expect(button("Confirmar devolución")!.disabled).toBe(false)
    await click(button("Confirmar devolución"))
    await flush()
    expect(posts[0].body).toMatchObject({ reintegro: { modo: "REALIZADO", medio: "EFECTIVO" }, cajaFisicaId: "caja-b" })
    await act(async () => root.unmount())
  })
})

describe("B. exchange with a difference refunded NOW", () => {
  test("«La devuelvo ahora» selects no method; confirmation blocked until one is chosen; exactly the chosen method is sent", async () => {
    venta = ventaCon("EFECTIVO")
    const root = await render("cajero")
    await click(button("Gestionar venta"))
    await flush()
    await click(button("Restar una unidad de Gaseosa"))
    await click(button("Vuelve al stock"))
    await type(document.querySelector('input[aria-label="Buscar producto para agregar"]') as HTMLInputElement, "agu")
    await flush()
    await click(button("Agregar Agua"))
    await flush(500) // automatic quote
    await type(document.querySelector('input[aria-label="Motivo"]') as HTMLInputElement, "Prefiere agua")
    await click(radio("La devuelvo ahora"))
    expect(presionados()).toEqual([]) // used to be EFECTIVO by default
    expect(text()).toContain("La venta se cobró con efectivo.")
    expect(button("Confirmar cambio")!.disabled).toBe(true)
    await click(medio("Transferencia"))
    expect(consecuencia()).toContain("No se descuenta efectivo de Caja")
    expect(button("Confirmar cambio")!.disabled).toBe(false)
    await click(radio("Queda pendiente"))
    await click(radio("La devuelvo ahora"))
    expect(presionados()).toEqual(["Transferencia"]) // kept
    await click(button("Confirmar cambio"))
    await flush()
    const envio = posts.find((p) => p.url === "/x/ventas/venta-1/cambios")!
    expect(envio.body.reintegro).toEqual({ modo: "REALIZADO", medio: "TRANSFERENCIA" })
    await act(async () => root.unmount())
  })
})

describe("C. later payment of a pending refund", () => {
  test("sale charged by TRANSFER, paid in CASH from the only open register: named, blocked until chosen, exactly EFECTIVO", async () => {
    venta = pendiente("TRANSFERENCIA")
    cajas = [{ id: "caja-a", nombre: "Caja principal", turnoAbierto: { responsableNombre: "Ana" } }]
    const root = await render("dueño")
    await click([...document.querySelectorAll("button")].find((b) => /Registrar reintegro/.test(b.textContent ?? "")))
    expect(presionados()).toEqual([])
    expect(text()).toContain("La venta se cobró con transferencia.")
    const checks = [...document.querySelectorAll('input[type="checkbox"]')] as HTMLInputElement[]
    await click(checks[checks.length - 1])
    expect(button("Confirmar reintegro")!.disabled).toBe(true) // confirmed the money, but no method yet
    await click(medio("Efectivo"))
    await flush()
    expect(consecuencia()).toContain("Sale de Caja principal (turno de Ana).")
    expect(button("Confirmar reintegro")!.disabled).toBe(false)
    await click(button("Confirmar reintegro"))
    await flush()
    expect(posts).toEqual([{ url: "/x/devoluciones/dev-1/reintegro", body: { medio: "EFECTIVO", confirmo: true } }])
    await act(async () => root.unmount())
  })

  test("sale charged in CASH, paid by TRANSFER: no register involved, exactly TRANSFERENCIA (no register id sent)", async () => {
    venta = pendiente("EFECTIVO")
    cajas = [
      { id: "caja-a", nombre: "Caja principal", turnoAbierto: { responsableNombre: "Ana" } },
      { id: "caja-b", nombre: "Caja 2", turnoAbierto: { responsableNombre: "Beto" } },
    ]
    const root = await render("dueño")
    await click([...document.querySelectorAll("button")].find((b) => /Registrar reintegro/.test(b.textContent ?? "")))
    // A register picked for cash and then a switch to transfer never sends that register.
    await click(medio("Efectivo"))
    await flush()
    const select = [...document.querySelectorAll("select")].find((s) => s.closest("label")?.textContent?.includes("¿De qué caja sale el efectivo?")) as HTMLSelectElement
    await elegir(select, "caja-a")
    await click(medio("Transferencia"))
    expect(consecuencia()).toContain("DeliGO registra la transferencia, pero no la realiza")
    const checks = [...document.querySelectorAll('input[type="checkbox"]')] as HTMLInputElement[]
    await click(checks[checks.length - 1])
    await click(button("Confirmar reintegro"))
    await flush()
    expect(posts).toEqual([{ url: "/x/devoluciones/dev-1/reintegro", body: { medio: "TRANSFERENCIA", confirmo: true } }])
    await act(async () => root.unmount())
  })

  test("owner with no open shift: cash is announced as leaving without an assigned register", async () => {
    venta = pendiente("TRANSFERENCIA")
    cajas = []
    const root = await render("dueño")
    await click([...document.querySelectorAll("button")].find((b) => /Registrar reintegro/.test(b.textContent ?? "")))
    await click(medio("Efectivo"))
    await flush()
    expect(consecuencia()).toContain("No hay turnos abiertos: la salida se registra en el efectivo sin caja asignada.")
    await act(async () => root.unmount())
  })
})

describe("explicit void («Anular venta») with money handed back now", () => {
  test("no method preselected; blocked until chosen; exactly the chosen method is sent", async () => {
    venta = ventaCon("TRANSFERENCIA")
    const root = await render("cajero")
    await click(button("Anular venta"))
    await flush()
    for (const b of [...document.querySelectorAll("button")].filter((x) => x.textContent?.trim() === "Vuelve al stock")) await click(b)
    await type(document.querySelector('input[id^="devolucion-motivo-"]') as HTMLInputElement, "Error del cliente")
    await click(radio("Devolví el dinero ahora"))
    const checks = [...document.querySelectorAll('input[type="checkbox"]')] as HTMLInputElement[]
    await click(checks[checks.length - 1])
    expect(presionados()).toEqual([])
    expect(button("Confirmar anulación")!.disabled).toBe(true)
    await click(medio("Efectivo"))
    expect(button("Confirmar anulación")!.disabled).toBe(false)
    await click(button("Confirmar anulación"))
    await flush()
    expect(posts[0].body).toMatchObject({ tipo: "ANULACION", reintegro: { modo: "REALIZADO", medio: "EFECTIVO" } })
    await act(async () => root.unmount())
  })
})
