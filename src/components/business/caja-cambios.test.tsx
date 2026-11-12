// «Gestionar venta» (2026-11-11) — UI of commercial exchanges inside the single
// sale editor (owner host; the cashier host uses the same components with its
// own endpoints and context). The operation is inferred from what is edited:
// something back + something new = exchange (F4-C engine, one atomic server
// operation); only additions = nothing registered (a new sale in «Vender»).
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
const { inferirOperacion } = await import("./caja-cambios")

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
const catalogo = [{ id: "p-redmi", nombre: "Redmi", precio: 1000, eliminado: false, marca: null, sku: null, codigoBarras: null, controlStock: false, stockCantidad: 0, variantes: [] }]
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
    if (url === "/x/productos") return new Response(JSON.stringify(catalogo), { status: 200 })
    if (url.includes("/cadena")) return new Response(JSON.stringify({ ok: true, ventas: [{ id: "venta-0", referencia: "venta-0", createdAt: "2026-10-01T10:00:00.000Z", total: 4000, metodoPago: "EFECTIVO", vinculoTipo: null, ventaOrigenId: null, anulada: false }], cambios: [] }), { status: 200 })
    if (url.includes("/historial")) return new Response(JSON.stringify({ ok: true, ventas: [] }), { status: 200 })
    return new Response(JSON.stringify({ ok: true, venta }), { status: 200 })
  }) as typeof fetch
})
afterEach(() => { globalThis.fetch = originalFetch; document.body.innerHTML = "" })

const comercial = (actor = "NEGOCIO") => ({
  contexto: { negocioId: "neg-1", actor },
  cambioUrl: (id: string) => `/x/ventas/${id}/cambios`,
  cotizacionUrl: (id: string) => `/x/ventas/${id}/cambios/cotizacion`,
  verificarCambioUrl: (id: string) => `/x/ventas/${id}/cambios/verificacion`,
  verificarAdicionalUrl: (id: string) => `/x/ventas/${id}/adicionales/verificacion`,
  cadenaUrl: (id: string) => `/x/ventas/${id}/cadena`,
  catalogo: { productosUrl: "/x/productos", queryKey: ["test-cambios-catalogo"] },
})
let fueAVender = 0
const endpoints = (actor?: string) => ({
  historialUrl: "/x/historial",
  ventaUrl: (id: string) => `/x/ventas/${id}/devoluciones`,
  reintegroUrl: (id: string) => `/x/devoluciones/${id}/reintegro`,
  queryScope: ["test-cambios"],
  comercial: comercial(actor),
  irAVender: () => { fueAVender += 1 },
})

async function flush(ms = 40) { await act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)) }) }
let cerrado = 0
async function render(e = endpoints()) {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  await act(async () => root.render(
    <QueryClientProvider client={client}>
      <VentaDevolucionesDialog ventaId="venta-1" endpoints={e} onClose={() => { cerrado += 1 }} />
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
const cotizaciones = () => posts.filter((p) => p.url.endsWith("/cambios/cotizacion"))
const QUOTE_WAIT = 500 // the quote is requested automatically, debounced

async function agregarRedmi() {
  await type(document.querySelector('input[aria-label="Buscar producto para agregar"]') as HTMLInputElement, "red")
  await flush()
  await click(button("Agregar Redmi"))
}
/** Lower what comes back, add a replacement: the exchange is quoted automatically. */
async function hastaCotizar() {
  await click(button("Gestionar venta"))
  await flush()
  await click(button("Restar una unidad de Gaseosa"))
  await click(button("Vuelve al stock"))
  await agregarRedmi()
  expect(button("Confirmar cambio")!.disabled).toBe(true) // the quote is not back yet
  await flush(QUOTE_WAIT)
}
async function completarYConfirmar() {
  const radios = [...document.querySelectorAll('input[type="radio"]')] as HTMLInputElement[]
  await click(radios[1]) // «Queda pendiente»
  await type(document.querySelector('input[aria-label="Motivo"]') as HTMLInputElement, "Prefiere otro")
  await click(button("Confirmar cambio"))
  await flush()
}

describe("«Gestionar venta» — inferred operation", () => {
  test("pure rule: nothing / only additions / return / total return / exchange", () => {
    const items = [{ id: "a", cantidadRestante: 2 }, { id: "b", cantidadRestante: 1 }]
    expect(inferirOperacion(items, {}, 0)).toBe("VACIA")
    expect(inferirOperacion(items, {}, 1)).toBe("SOLO_AGREGA")
    expect(inferirOperacion(items, { a: 1 }, 0)).toBe("DEVOLUCION")
    expect(inferirOperacion(items, { a: 2, b: 1 }, 0)).toBe("DEVOLUCION_TOTAL")
    expect(inferirOperacion(items, { a: 2, b: 1 }, 1)).toBe("CAMBIO")
    expect(inferirOperacion(items, { b: 1 }, 2)).toBe("CAMBIO")
  })

  test("only additions: nothing can be confirmed nor quoted; it points to «Vender» and leaves the sale untouched", async () => {
    fueAVender = 0
    cerrado = 0
    const root = await render()
    await click(button("Gestionar venta"))
    await flush()
    await agregarRedmi()
    await flush(QUOTE_WAIT)
    expect(text()).toContain("es una venta nueva")
    expect(button("Confirmar")!.disabled).toBe(true)
    expect(posts).toHaveLength(0)
    await click(button("Ir a Vender"))
    expect(fueAVender).toBe(1)
    expect(cerrado).toBe(1)
    await act(async () => root.unmount())
  })

  test("the linked additional sale is no longer offered anywhere in the sale", async () => {
    const root = await render()
    expect(button("Agregar venta vinculada")).toBeUndefined()
    expect(button("Cambiar productos")).toBeUndefined()
    expect(button("Devolver productos")).toBeUndefined()
    await click(button("Gestionar venta"))
    await flush()
    expect(text()).not.toContain("venta vinculada")
    await act(async () => root.unmount())
  })
})

describe("F4-C5 — exchange inside «Gestionar venta»", () => {
  test("automatic quote, plain money summary, exact `esperado` strings, attempt stored BEFORE sending and removed after success", async () => {
    const root = await render()
    expect(text()).toContain("Cambio") // CAMBIO method label, «Por cambio» badge
    expect(text()).toContain("Viene del cambio de la venta #venta-0")
    await hastaCotizar()
    expect(cotizaciones()).toHaveLength(1)
    expect(cotizaciones()[0].body).toEqual({ salen: [{ ventaItemId: "item-gaseosa", cantidad: 1, reingresaStock: true }], entran: [{ productoId: "p-redmi", cantidad: 1 }] })
    expect(text()).toContain("Cambio de productos")
    expect(text()).toMatch(/Devolver al cliente\$\s?1\.000,00/)
    expect(text()).not.toContain("Crédito interno") // the compensation is only an optional detail, never money
    expect(text()).toContain("no es dinero que entra ni que sale")
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

  test("an undecided stock line is quoted (amounts do not depend on it) but cannot be confirmed", async () => {
    const root = await render()
    await click(button("Gestionar venta"))
    await flush()
    await click(button("Restar una unidad de Gaseosa"))
    await agregarRedmi()
    await flush(QUOTE_WAIT)
    expect(cotizaciones()).toHaveLength(1)
    expect(text()).toContain("Indicá si cada producto devuelto vuelve al stock")
    const radios = [...document.querySelectorAll('input[type="radio"]')] as HTMLInputElement[]
    await click(radios[1])
    await type(document.querySelector('input[aria-label="Motivo"]') as HTMLInputElement, "Prefiere otro")
    expect(button("Confirmar cambio")!.disabled).toBe(true)
    await click(button("No vuelve (dañado, abierto…)"))
    await flush(QUOTE_WAIT) // the decision is part of the request: it is quoted again
    expect(button("Confirmar cambio")!.disabled).toBe(false)
    await act(async () => root.unmount())
  })

  test("any change after quoting re-quotes automatically; double click sends ONE confirmation", async () => {
    const root = await render()
    await hastaCotizar()
    await click(button("Sumar una unidad de Redmi (nuevo)"))
    expect(text()).toContain("Calculando…")
    expect(button("Confirmar cambio")!.disabled).toBe(true)
    await flush(QUOTE_WAIT)
    expect(cotizaciones()).toHaveLength(2)
    expect(cotizaciones()[1].body.entran).toEqual([{ productoId: "p-redmi", cantidad: 2 }])
    const radios = [...document.querySelectorAll('input[type="radio"]')] as HTMLInputElement[]
    await click(radios[1])
    await type(document.querySelector('input[aria-label="Motivo"]') as HTMLInputElement, "Prefiere otro")
    const submit = button("Confirmar cambio")!
    await act(async () => { submit.click(); submit.click() })
    await flush()
    expect(posts.filter((p) => p.url.endsWith("/cambios"))).toHaveLength(1)
    await act(async () => root.unmount())
  })

  test("409 IMPORTES_CAMBIARON: nothing kept, error shown, a NEW quote is requested before anything else can be confirmed", async () => {
    responses = [{ status: 409, body: { ok: false, code: "IMPORTES_CAMBIARON", error: "Los importes del cambio ya no coinciden con la cotización. No se registró nada: pedí una nueva cotización." } }]
    const root = await render()
    await hastaCotizar()
    await completarYConfirmar()
    expect(text()).toContain("pedí una nueva cotización")
    expect(window.localStorage.getItem(CLAVE_OWNER)).toBeNull()
    expect(button("Confirmar cambio")!.disabled).toBe(true) // the quote was dropped
    await flush(QUOTE_WAIT)
    expect(cotizaciones()).toHaveLength(2)
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
    await click(button("Gestionar venta")) // opens the pending attempt, not a new editor
    expect(text()).toContain("Todavía no se conoce el resultado")
    expect(button("Restar una unidad de Gaseosa")).toBeUndefined()
    await click(button("Verificar operación"))
    await flush()
    expect(text()).toContain("Verificado: la operación NO se registró")
    expect(window.localStorage.getItem(CLAVE_OWNER)).toBeNull()
    await click(button("Restar una unidad de Gaseosa"))
    await click(button("Vuelve al stock"))
    await agregarRedmi()
    await flush(QUOTE_WAIT)
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

  test("P2 mirror: a sale with nothing left offers no «Gestionar venta» and points to a new sale", async () => {
    venta = { ...ventaBase, estadoDevolucion: "ANULADA", items: [{ ...ventaBase.items[0], cantidadDevuelta: 2, cantidadRestante: 0 }] }
    const root = await render()
    expect(button("Gestionar venta")).toBeUndefined()
    expect(button("Agregar venta vinculada")).toBeUndefined()
    expect(text()).toContain("registrá una venta nueva desde «Vender»")
    await act(async () => root.unmount())
  })
})

describe("Retired linked additional sale — attempts stored earlier are still verified", () => {
  test("an uncertain linked-sale attempt is verified on its own endpoint with the SAME key and body; no new one can be created", async () => {
    const intento = { v: 1, tipo: "ADICIONAL", negocioId: "neg-1", actor: "NEGOCIO", ventaOrigenId: "venta-1", ventaOrigenReferencia: "venta-1", key: "7a1c2c4e-8a1b-4d3e-9f2a-4b7c0d1e2f31", cuerpo: "{\"metodoPago\":\"TRANSFERENCIA\",\"items\":[{\"productoId\":\"p-redmi\",\"cantidad\":1}]}", resumen: { lineas: ["Agrega: 1 × Redmi"] }, estado: "INCIERTO", createdAt: Date.now(), updatedAt: Date.now() }
    window.localStorage.setItem(CLAVE_OWNER, JSON.stringify(intento))
    responses = [{ status: 200, body: { ok: true, estado: "REGISTRADO", replayed: true, venta: { referencia: "adic-1", total: 1000, metodoPago: "TRANSFERENCIA" } } }]
    const root = await render()
    expect(text()).toContain("registro de venta vinculada de esta venta sin resultado confirmado")
    await click(button("Verificar operación"))
    expect(text()).toContain("Todavía no se conoce el resultado de este registro de venta vinculada")
    await click(button("Verificar operación"))
    await flush()
    const v = posts.find((p) => p.url.endsWith("/adicionales/verificacion"))!
    expect([v.key, v.raw]).toEqual([intento.key, intento.cuerpo])
    expect(posts.filter((p) => p.url.endsWith("/adicionales"))).toHaveLength(0)
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
    expect(button("Confirmar reintegro")!.disabled).toBe(true) // no method preselected
    await click(button("Efectivo"))
    await click(button("Confirmar reintegro"))
    await flush()
    const pago = posts.find((p) => p.url === "/x/devoluciones/dev-1/reintegro")!
    expect(pago.body).toEqual({ medio: "EFECTIVO", confirmo: true }) // the server decides the amount (500): the client never sends one
    await act(async () => root.unmount())
  })
})
