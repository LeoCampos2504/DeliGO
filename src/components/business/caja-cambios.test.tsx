// F4-C5 — UI of exchanges and linked additional sales (owner host; the cashier
// host uses the same components with its own endpoints and context).
import { afterAll, afterEach, beforeEach, describe, expect, test } from "bun:test"
import { GlobalRegistrator } from "@happy-dom/global-registrator"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

GlobalRegistrator.register()
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterAll(() => GlobalRegistrator.unregister())

const React = await import("react")
const { createRoot } = await import("react-dom/client")
const { act } = React
const { VentaDevolucionesDialog, CajaVentasHistorial } = await import("./caja-devoluciones")

const originalFetch = globalThis.fetch
const ventaBase = {
  id: "venta-1",
  referencia: "venta-1",
  createdAt: "2026-10-14T15:00:00.000Z",
  metodoPago: "CAMBIO",
  total: 4000,
  totalDevuelto: 0,
  totalNeto: 4000,
  estadoDevolucion: "VIGENTE",
  items: [{ id: "item-gaseosa", nombre: "Gaseosa", varianteNombre: null, precio: 2000, cantidad: 2, subtotal: 4000, cantidadDevuelta: 0, cantidadRestante: 2, importeDevuelto: 0 }],
  devoluciones: [],
  vinculo: { tipo: "CAMBIO", ventaOrigenId: "venta-0", ventaOrigenReferencia: "venta-0" },
  cambiosComoOrigen: [],
  ventasAdicionales: [],
}
let venta: Record<string, unknown> = ventaBase
const importes = { salida: "2000.00", entrada: "1000.00", credito: "1000.00", diferenciaCobrada: "0.00", diferenciaReintegro: "1000.00" }
const cotizacion = {
  importes,
  liquidacion: "REINTEGRO",
  advertencias: { version: 1, items: [] },
  advertenciasTexto: ["venta de hace 40 días"],
  salen: [{ ventaItemId: "item-gaseosa", nombre: "Gaseosa", cantidad: 1, importe: "2000.00" }],
  entran: [{ productoId: "p-redmi", productoVarianteId: null, nombre: "Redmi", varianteNombre: null, precio: 1000, cantidad: 1, subtotal: "1000.00" }],
}
const registrado = { ok: true, replayed: false, cambio: { ventaOrigenReferencia: "venta-1", ventaNuevaReferencia: "nueva-1", importes, liquidacion: "REINTEGRO", advertenciasTexto: [] } }

type Post = { url: string; key: string | null; raw: string; body: Record<string, unknown>; guardadoAntes: boolean }
let posts: Post[] = []
let responses: Array<{ status: number; body: Record<string, unknown> } | "network"> = []

const CLAVE_OWNER = "deligo:caja:intento-comercial:v1:neg-1:NEGOCIO:venta-1"

beforeEach(() => {
  posts = []
  responses = []
  venta = ventaBase
  window.localStorage.clear()
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (init?.method === "POST") {
      const key = new Headers(init.headers).get("Idempotency-Key")
      const raw = String(init.body)
      const stored = window.localStorage.getItem(CLAVE_OWNER)
      posts.push({ url, key, raw, body: JSON.parse(raw), guardadoAntes: Boolean(key && stored && stored.includes(key)) })
      await new Promise((resolve) => setTimeout(resolve, 10))
      if (url.endsWith("/cotizacion")) return new Response(JSON.stringify({ ok: true, cotizacion }), { status: 200 })
      const next = responses.shift() ?? { status: 201, body: registrado }
      if (next === "network") throw new TypeError("Failed to fetch")
      return new Response(JSON.stringify(next.body), { status: next.status })
    }
    if (url.includes("/cadena")) return new Response(JSON.stringify({ ok: true, ventas: [{ id: "venta-0", referencia: "venta-0", createdAt: "2026-10-01T10:00:00.000Z", total: 4000, metodoPago: "EFECTIVO", vinculoTipo: null, ventaOrigenId: null, anulada: false }], cambios: [] }), { status: 200 })
    if (url.includes("/historial")) return new Response(JSON.stringify({ ok: true, ventas: [] }), { status: 200 })
    return new Response(JSON.stringify({ ok: true, venta }), { status: 200 })
  }) as typeof fetch
})
afterEach(() => { globalThis.fetch = originalFetch; document.body.innerHTML = "" })

function SelectorFalso({ etiqueta, onConfirmar }: { etiqueta: string; onConfirmar: (cart: Array<{ productoId: string; nombre: string; precio: number; cantidad: number }>) => void }) {
  return <button type="button" onClick={() => onConfirmar([{ productoId: "p-redmi", nombre: "Redmi", precio: 1000, cantidad: 1 }])}>{etiqueta}</button>
}

const comercial = (actor = "NEGOCIO") => ({
  contexto: { negocioId: "neg-1", actor },
  cambioUrl: (id: string) => `/x/ventas/${id}/cambios`,
  cotizacionUrl: (id: string) => `/x/ventas/${id}/cambios/cotizacion`,
  verificarCambioUrl: (id: string) => `/x/ventas/${id}/cambios/verificacion`,
  adicionalUrl: (id: string) => `/x/ventas/${id}/adicionales`,
  verificarAdicionalUrl: (id: string) => `/x/ventas/${id}/adicionales/verificacion`,
  cadenaUrl: (id: string) => `/x/ventas/${id}/cadena`,
  Selector: SelectorFalso,
})
const endpoints = (actor?: string) => ({
  historialUrl: "/x/historial",
  ventaUrl: (id: string) => `/x/ventas/${id}/devoluciones`,
  reintegroUrl: (id: string) => `/x/devoluciones/${id}/reintegro`,
  queryScope: ["test-cambios"],
  comercial: comercial(actor),
})

async function flush(ms = 40) { await act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)) }) }
async function render(e = endpoints()) {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  await act(async () => root.render(
    <QueryClientProvider client={client}>
      <VentaDevolucionesDialog ventaId="venta-1" endpoints={e} onClose={() => {}} />
    </QueryClientProvider>
  ))
  await flush()
  return root
}
const button = (text: string) => [...document.querySelectorAll("button")].find((item) => item.textContent?.trim() === text || item.getAttribute("aria-label") === text) as HTMLButtonElement | undefined
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
const text = () => document.body.textContent ?? ""

/** Steps 1–2 and the quote of an exchange with the difference left PENDING. */
async function hastaCotizar() {
  await click(button("Cambiar productos"))
  await click(button("Sumar una unidad de Gaseosa"))
  await click(button("Vuelve al stock"))
  await click(button("Elegir lo que se lleva"))
  await click(button("Usar estos productos"))
  expect(button("Confirmar cambio")!.disabled).toBe(true) // no quote yet
  await click(button("Calcular cambio"))
  await flush()
}
async function completarYConfirmar() {
  const radios = [...document.querySelectorAll('input[type="radio"]')] as HTMLInputElement[]
  await click(radios[1]) // «Queda pendiente»
  await type(document.querySelector('input[aria-label="Motivo del cambio"]') as HTMLInputElement, "Prefiere otro")
  await click(document.querySelector('input[type="checkbox"]') as HTMLInputElement)
  await click(button("Confirmar cambio"))
  await flush()
}

describe("F4-C5 — exchange flow", () => {
  test("quote by button, exact `esperado` strings, attempt stored BEFORE sending and removed after success", async () => {
    const root = await render()
    expect(text()).toContain("Cambio") // CAMBIO method label, «Por cambio» badge
    expect(text()).toContain("Viene del cambio de la venta #venta-0")
    await hastaCotizar()
    expect(text()).toContain("Crédito interno (no es dinero)")
    expect(text()).toContain("Para tu información (no impide el cambio): venta de hace 40 días")
    await completarYConfirmar()
    const envio = posts.find((p) => p.url === "/x/ventas/venta-1/cambios")!
    expect(envio.guardadoAntes).toBe(true)
    expect(envio.body).toEqual({
      motivo: "Prefiere otro",
      salen: [{ ventaItemId: "item-gaseosa", cantidad: 1, reingresaStock: true }],
      entran: [{ productoId: "p-redmi", cantidad: 1 }],
      esperado: { salida: "2000.00", entrada: "1000.00" },
      confirmo: true,
      reintegro: { modo: "PENDIENTE" },
    })
    expect(text()).toContain("Cambio registrado: #venta-1 → #nueva-1")
    expect(window.localStorage.getItem(CLAVE_OWNER)).toBeNull()
    await act(async () => root.unmount())
  })

  test("any change after quoting invalidates it; double click sends ONE confirmation", async () => {
    const root = await render()
    await hastaCotizar()
    await click(button("Cambiar lo que vuelve"))
    await click(button("Sumar una unidad de Gaseosa"))
    await click(button("Vuelve al stock"))
    await click(button("Elegir lo que se lleva"))
    await click(button("Usar estos productos"))
    expect(text()).toContain("Cambiaste los productos: pedí una nueva cotización.")
    expect(button("Confirmar cambio")!.disabled).toBe(true)
    await click(button("Volver a calcular") ?? button("Calcular cambio"))
    await flush()
    const radios = [...document.querySelectorAll('input[type="radio"]')] as HTMLInputElement[]
    await click(radios[1])
    await type(document.querySelector('input[aria-label="Motivo del cambio"]') as HTMLInputElement, "Prefiere otro")
    await click(document.querySelector('input[type="checkbox"]') as HTMLInputElement)
    const submit = button("Confirmar cambio")!
    await act(async () => { submit.click(); submit.click() })
    await flush()
    expect(posts.filter((p) => p.url.endsWith("/cambios"))).toHaveLength(1)
    await act(async () => root.unmount())
  })

  test("409 IMPORTES_CAMBIARON: nothing kept, error shown, a NEW quote is required", async () => {
    responses = [{ status: 409, body: { ok: false, code: "IMPORTES_CAMBIARON", error: "Los importes del cambio ya no coinciden con la cotización. No se registró nada: pedí una nueva cotización." } }]
    const root = await render()
    await hastaCotizar()
    await completarYConfirmar()
    expect(text()).toContain("pedí una nueva cotización")
    expect(window.localStorage.getItem(CLAVE_OWNER)).toBeNull()
    expect(button("Calcular cambio")).toBeTruthy() // the quote was dropped
    expect(button("Confirmar cambio")!.disabled).toBe(true)
    await act(async () => root.unmount())
  })

  test("UNCERTAIN (500): kept, flow blocked, «Verificar» resends SAME key and body to the verification only; 503 stays uncertain; REGISTRADO shows the original", async () => {
    responses = [{ status: 500, body: { ok: false } }, { status: 503, body: { ok: false, code: "VERIFICACION_INCIERTA", error: "No pudimos verificar la operación todavía." } }, { status: 200, body: { ...registrado, estado: "REGISTRADO", replayed: true } }]
    const root = await render()
    await hastaCotizar()
    await completarYConfirmar()
    const original = posts.find((p) => p.url.endsWith("/cambios"))!
    expect(text()).toContain("Todavía no se conoce el resultado")
    expect(button("Descartar este intento")).toBeUndefined() // never a simple discard
    expect(JSON.parse(window.localStorage.getItem(CLAVE_OWNER)!).estado).toBe("INCIERTO")
    await click(button("Verificar operación"))
    await flush()
    expect(text()).toContain("Todavía no se conoce el resultado: el intento se conserva")
    expect(window.localStorage.getItem(CLAVE_OWNER)).not.toBeNull()
    await click(button("Verificar operación"))
    await flush()
    const verificaciones = posts.filter((p) => p.url.endsWith("/cambios/verificacion"))
    expect(verificaciones).toHaveLength(2)
    for (const v of verificaciones) expect([v.key, v.raw]).toEqual([original.key, original.raw])
    expect(posts.filter((p) => p.url.endsWith("/cambios"))).toHaveLength(1) // verifying never re-sent the operation
    expect(text()).toContain("Esta operación ya estaba registrada: no se aplicó dos veces.")
    expect(window.localStorage.getItem(CLAVE_OWNER)).toBeNull()
    await act(async () => root.unmount())
  })

  test("UNCERTAIN (network): reopening the sale keeps it blocked; NO_REGISTRADO allows a new quote and a NEW key", async () => {
    responses = ["network"]
    const first = await render()
    await hastaCotizar()
    await completarYConfirmar()
    const k1 = posts.find((p) => p.url.endsWith("/cambios"))!.key
    await act(async () => first.unmount())
    document.body.innerHTML = ""

    responses = [{ status: 200, body: { ok: true, estado: "NO_REGISTRADO", cerradoEn: "2026-11-10T10:00:00.000Z" } }]
    const root = await render()
    expect(text()).toContain("sin resultado confirmado")
    await click(button("Cambiar productos")) // opens the pending attempt, not a new form
    expect(text()).toContain("Todavía no se conoce el resultado")
    expect(button("Sumar una unidad de Gaseosa")).toBeUndefined()
    await click(button("Verificar operación"))
    await flush()
    expect(text()).toContain("Verificado: la operación NO se registró")
    expect(window.localStorage.getItem(CLAVE_OWNER)).toBeNull()
    await click(button("Sumar una unidad de Gaseosa"))
    await click(button("Vuelve al stock"))
    await click(button("Elegir lo que se lleva"))
    await click(button("Usar estos productos"))
    await click(button("Calcular cambio"))
    await flush()
    await completarYConfirmar()
    const envios = posts.filter((p) => p.url.endsWith("/cambios"))
    expect(envios).toHaveLength(2)
    expect(envios[1].key).not.toBe(k1)
    await act(async () => root.unmount())
  })

  test("another business/actor's attempt is never shown nor reused; storage unavailable → nothing sent", async () => {
    window.localStorage.setItem("deligo:caja:intento-comercial:v1:neg-1:EMPLEADO:otro:venta-1", JSON.stringify({ v: 1, tipo: "CAMBIO", negocioId: "neg-1", actor: "EMPLEADO:otro", ventaOrigenId: "venta-1", ventaOrigenReferencia: "venta-1", key: "6f1c2c4e-8a1b-4d3e-9f2a-4b7c0d1e2f30", cuerpo: "{}", resumen: { lineas: [] }, estado: "INCIERTO", createdAt: 1, updatedAt: 1 }))
    const root = await render()
    expect(text()).not.toContain("sin resultado confirmado")
    await hastaCotizar()
    // A device whose storage refuses writes (quota / blocked).
    const real = window.localStorage
    const roto = { length: 0, key: () => null, getItem: () => null, removeItem: () => {}, clear: () => {}, setItem: () => { throw new Error("quota") } }
    Object.defineProperty(window, "localStorage", { configurable: true, get: () => roto })
    try {
      await completarYConfirmar()
    } finally {
      Object.defineProperty(window, "localStorage", { configurable: true, get: () => real })
    }
    expect(text()).toContain("NO se envió nada")
    expect(posts.filter((p) => p.url.endsWith("/cambios"))).toHaveLength(0)
    await act(async () => root.unmount())
  })

  test("an attempt older than 7 days is flagged and kept; the history banner lists it", async () => {
    const viejo = { v: 1, tipo: "CAMBIO", negocioId: "neg-1", actor: "NEGOCIO", ventaOrigenId: "venta-1", ventaOrigenReferencia: "venta-1", key: "6f1c2c4e-8a1b-4d3e-9f2a-4b7c0d1e2f30", cuerpo: "{\"a\":1}", resumen: { lineas: ["Vuelve: 1 × Gaseosa"] }, estado: "INCIERTO", createdAt: Date.now() - 8 * 86_400_000, updatedAt: 1 }
    window.localStorage.setItem(CLAVE_OWNER, JSON.stringify(viejo))
    const container = document.createElement("div")
    document.body.appendChild(container)
    const root = createRoot(container)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    await act(async () => root.render(<QueryClientProvider client={client}><CajaVentasHistorial endpoints={endpoints()} /></QueryClientProvider>))
    await flush()
    expect(text()).toContain("Hay una operación sin resultado confirmado")
    expect(text()).toContain("más de 7 días sin resolver")
    await click(button("Revisar"))
    await flush()
    await click(button("Verificar operación")) // the sale's banner opens the pending attempt (it does not verify yet)
    expect(text()).toContain("lleva más de 7 días sin resolver")
    expect(window.localStorage.getItem(CLAVE_OWNER)).not.toBeNull()
    await act(async () => root.unmount())
  })

  test("P2 mirror: a sale with nothing left offers neither an exchange nor a linked sale", async () => {
    venta = { ...ventaBase, estadoDevolucion: "ANULADA", items: [{ ...ventaBase.items[0], cantidadDevuelta: 2, cantidadRestante: 0 }] }
    const root = await render()
    expect(button("Cambiar productos")).toBeUndefined()
    expect(button("Agregar venta vinculada")).toBeUndefined()
    expect(text()).toContain("registrá una venta nueva e independiente")
    await act(async () => root.unmount())
  })
})

describe("F4-C5 — linked additional sale", () => {
  test("selector → method → confirmation; uncertain → verification on the additional-sale endpoint with the same key", async () => {
    responses = [{ status: 502, body: {} }, { status: 200, body: { ok: true, estado: "REGISTRADO", replayed: true, venta: { referencia: "adic-1", total: 1000, metodoPago: "TRANSFERENCIA" } } }]
    const root = await render()
    await click(button("Agregar venta vinculada"))
    await click(button("Continuar"))
    expect(button("Confirmar venta vinculada")!.disabled).toBe(true)
    await click(button("Transferencia"))
    await click(document.querySelector('input[type="checkbox"]') as HTMLInputElement)
    await click(button("Confirmar venta vinculada"))
    await flush()
    const envio = posts.find((p) => p.url.endsWith("/adicionales"))!
    expect(envio.guardadoAntes).toBe(true)
    expect(envio.body).toEqual({ metodoPago: "TRANSFERENCIA", items: [{ productoId: "p-redmi", cantidad: 1 }] })
    expect(text()).toContain("Todavía no se conoce el resultado")
    await click(button("Verificar operación"))
    await flush()
    const v = posts.find((p) => p.url.endsWith("/adicionales/verificacion"))!
    expect([v.key, v.raw]).toEqual([envio.key, envio.raw])
    expect(text()).toContain("Venta vinculada registrada #adic-1")
    expect(window.localStorage.getItem(CLAVE_OWNER)).toBeNull()
    await act(async () => root.unmount())
  })
})

describe("F4-C5 — partial compensation in the UI", () => {
  test("a pending exchange difference shows and processes ONLY the refundable amount; the credit is never money handed back", async () => {
    venta = {
      ...ventaBase,
      estadoDevolucion: "DEVOLUCION_PARCIAL",
      totalDevuelto: 2000,
      totalNeto: 2000,
      items: [{ ...ventaBase.items[0], cantidadDevuelta: 1, cantidadRestante: 1, importeDevuelto: 2000 }],
      devoluciones: [{
        id: "dev-1", ventaId: "venta-1", ventaReferencia: "venta-1", tipo: "DEVOLUCION_PARCIAL", motivo: "Cambio", createdAt: "2026-11-10T12:00:00.000Z",
        importe: 2000, importeReintegrable: 500, cambioId: "cambio-1", registradaPor: "Dueño", metodoPagoVenta: "EFECTIVO",
        reintegroEstado: "PENDIENTE", reintegroMedio: null, reintegroRegistradoEn: null, reintegroRegistradoPor: null, reintegroDescripcion: "reintegro pendiente",
        items: [{ ventaItemId: "item-gaseosa", nombre: "Gaseosa", cantidad: 1, importe: 2000, stockResultado: "REINGRESADO" }],
      }],
    }
    const root = await render()
    expect(text()).toMatch(/Devolución por cambio · valor devuelto \$\s?2\.000,00/)
    expect(text()).toMatch(/Compensado con lo que se llevó \(crédito interno, no es dinero\): \$\s?1\.500,00\. A reintegrar en dinero: \$\s?500,00/)
    expect(text()).toContain("Dinero (diferencia del cambio): reintegro pendiente")
    expect(button("Registrar reintegro ($ 500,00)") ?? [...document.querySelectorAll("button")].find((b) => /Registrar reintegro \(\$\s?500,00\)/.test(b.textContent ?? ""))).toBeTruthy()
    expect(text()).not.toMatch(/Registrar reintegro \(\$\s?2\.000,00\)/)
    await click([...document.querySelectorAll("button")].find((b) => /Registrar reintegro/.test(b.textContent ?? "")))
    expect(text()).toMatch(/Confirmo que devolví \$\s?500,00 al cliente\./)
    expect(text()).not.toMatch(/devolví \$\s?(2\.000|1\.500),00/)
    const checks = [...document.querySelectorAll('input[type="checkbox"]')] as HTMLInputElement[]
    await click(checks[checks.length - 1])
    await click(button("Confirmar reintegro"))
    await flush()
    const pago = posts.find((p) => p.url === "/x/devoluciones/dev-1/reintegro")!
    expect(pago.body).toEqual({ medio: "EFECTIVO", confirmo: true }) // the server decides the amount (500): the client never sends one
    await act(async () => root.unmount())
  })
})
