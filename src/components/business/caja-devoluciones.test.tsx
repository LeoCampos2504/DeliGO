import { afterAll, afterEach, beforeEach, describe, expect, test } from "bun:test"
import { GlobalRegistrator } from "@happy-dom/global-registrator"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

GlobalRegistrator.register()
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterAll(() => GlobalRegistrator.unregister())

const React = await import("react")
const { createRoot } = await import("react-dom/client")
const { act } = React
const { VentaDevolucionesDialog, importeEstimado } = await import("./caja-devoluciones")

const originalFetch = globalThis.fetch
const venta = {
  id: "venta-1",
  referencia: "venta-1",
  createdAt: "2026-10-14T15:00:00.000Z",
  metodoPago: "EFECTIVO",
  total: 9000,
  totalDevuelto: 0,
  totalNeto: 9000,
  estadoDevolucion: "VIGENTE",
  items: [
    { id: "item-gaseosa", nombre: "Gaseosa", varianteNombre: null, precio: 2000, cantidad: 2, subtotal: 4000, cantidadDevuelta: 0, cantidadRestante: 2, importeDevuelto: 0 },
    { id: "item-yerba", nombre: "Yerba", varianteNombre: null, precio: 5000, cantidad: 1, subtotal: 5000, cantidadDevuelta: 0, cantidadRestante: 1, importeDevuelto: 0 },
  ],
  devoluciones: [],
}
let posts: Array<{ url: string; key: string | null; body: Record<string, unknown> }> = []
let responses: Array<{ status: number; body: Record<string, unknown> }> = []

beforeEach(() => {
  posts = []
  responses = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (init?.method === "POST") {
      posts.push({ url, key: new Headers(init.headers).get("Idempotency-Key"), body: JSON.parse(String(init.body)) })
      await new Promise((resolve) => setTimeout(resolve, 10))
      const next = responses.shift() ?? { status: 201, body: { ok: true, devolucion: { importe: 2000, reintegroDescripcion: "reintegrado en efectivo" }, venta } }
      return new Response(JSON.stringify(next.body), { status: next.status })
    }
    return new Response(JSON.stringify({ ok: true, venta }), { status: 200 })
  }) as typeof fetch
})
afterEach(() => { globalThis.fetch = originalFetch; document.body.innerHTML = "" })

const endpoints = {
  historialUrl: "/x/historial",
  ventaUrl: (id: string) => `/x/ventas/${id}/devoluciones`,
  reintegroUrl: (id: string) => `/x/devoluciones/${id}/reintegro`,
  queryScope: ["test-devoluciones"],
}

async function flush(ms = 40) { await act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)) }) }
async function render() {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  await act(async () => root.render(
    <QueryClientProvider client={client}>
      <VentaDevolucionesDialog ventaId="venta-1" endpoints={endpoints} onClose={() => {}} />
    </QueryClientProvider>
  ))
  await flush()
  return root
}
const button = (text: string) => [...document.querySelectorAll("button")].find((item) => item.textContent?.trim() === text || item.getAttribute("aria-label") === text) as HTMLButtonElement | undefined
async function click(el: Element | undefined) { await act(async () => { (el as HTMLElement).click() }) }
async function type(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value)
    input.dispatchEvent(new Event("input", { bubbles: true }))
  })
}
async function fillPartial() {
  await click(button("Gestionar venta"))
  await click(button("Restar una unidad de Gaseosa"))
  await click(button("Vuelve al stock"))
  await type(document.querySelector('input[aria-label="Motivo"]') as HTMLInputElement, "El cliente devolvió una gaseosa")
  const radios = [...document.querySelectorAll('input[type="radio"]')] as HTMLInputElement[]
  await click(radios[0])
  // The refund method is never preselected: it must be chosen explicitly.
  expect(button("Confirmar devolución")!.disabled).toBe(true)
  await click(button("Efectivo"))
}

// 2026-11-11: returns are registered from «Gestionar venta» (lower what comes
// back); «Anular venta» stays an explicit, separate action.
describe("F4-A — returns from «Gestionar venta» and the explicit void", () => {
  test("shows the sale and requires quantity, stock decision, reason and refund (no confirmation box)", async () => {
    const root = await render()
    expect(document.body.textContent).toContain("Gaseosa")
    expect(document.body.textContent).toContain("Total original")
    await click(button("Gestionar venta"))
    expect(button("Confirmar")!.disabled).toBe(true) // nothing edited: nothing to confirm
    await click(button("Restar una unidad de Gaseosa"))
    expect(document.body.textContent).toContain("Devolución")
    expect(document.body.textContent).toMatch(/Valor de lo que devuelve\$\s?2\.000,00/)
    await type(document.querySelector('input[aria-label="Motivo"]') as HTMLInputElement, "Motivo")
    await click((document.querySelectorAll('input[type="radio"]')[1]) as HTMLInputElement)
    expect(button("Confirmar devolución")!.disabled).toBe(true) // stock decision still missing
    await click(button("No vuelve (dañado, abierto…)"))
    expect(button("Confirmar devolución")!.disabled).toBe(false)
    // Never more than what is left (the kept quantity cannot go below zero nor above what was sold).
    await click(button("Restar una unidad de Gaseosa"))
    expect(button("Restar una unidad de Gaseosa")!.disabled).toBe(true)
    expect(button("Sumar una unidad de Gaseosa")!.disabled).toBe(false)
    expect(posts).toHaveLength(0)
    await act(async () => root.unmount())
  })

  test("double click sends ONE request with server-side amounts only; success is explicit", async () => {
    const root = await render()
    await fillPartial()
    const submit = button("Confirmar devolución")!
    await act(async () => { submit.click(); submit.click() })
    await flush()
    expect(posts).toHaveLength(1)
    expect(posts[0].url).toBe("/x/ventas/venta-1/devoluciones")
    expect(posts[0].key).toBeTruthy()
    expect(posts[0].body).toEqual({
      tipo: "DEVOLUCION_PARCIAL",
      motivo: "El cliente devolvió una gaseosa",
      confirmo: true,
      reintegro: { modo: "REALIZADO", medio: "EFECTIVO" },
      items: [{ ventaItemId: "item-gaseosa", cantidad: 1, reingresaStock: true }],
    })
    expect(document.body.textContent).toMatch(/Devolución registrada por \$\s?2\.000,00\. Dinero: reintegrado en efectivo/)
    await act(async () => root.unmount())
  })

  test("a server error keeps every field and the retry reuses the same key", async () => {
    responses = [{ status: 500, body: { ok: false, error: "internal" } }]
    const root = await render()
    await fillPartial()
    await click(button("Confirmar devolución"))
    await flush()
    expect(document.body.textContent).toContain("Podés reintentar sin duplicarla")
    expect(document.body.textContent).not.toContain("internal")
    expect((document.querySelector('input[aria-label="Motivo"]') as HTMLInputElement).value).toBe("El cliente devolvió una gaseosa")
    await click(button("Confirmar devolución"))
    await flush()
    expect(posts).toHaveLength(2)
    expect(posts[1].key).toBe(posts[0].key)
    expect(document.body.textContent).toContain("Devolución registrada")
    await act(async () => root.unmount())
  })

  test("everything back without replacements is a TOTAL RETURN (a partial return of every unit), never an automatic void", async () => {
    const root = await render()
    await click(button("Gestionar venta"))
    await click(button("Restar una unidad de Gaseosa"))
    await click(button("Restar una unidad de Gaseosa"))
    await click(button("Restar una unidad de Yerba"))
    expect(document.body.textContent).toContain("Devolución total")
    expect(document.body.textContent).toContain("no es una anulación")
    for (const group of document.querySelectorAll('[role="group"][aria-label*="vuelve al stock"]')) await click(group.querySelector("button") as HTMLButtonElement)
    await type(document.querySelector('input[aria-label="Motivo"]') as HTMLInputElement, "Devuelve todo")
    await click((document.querySelectorAll('input[type="radio"]')[1]) as HTMLInputElement)
    await click(button("Confirmar devolución"))
    await flush()
    expect(posts).toHaveLength(1)
    expect(posts[0].body.tipo).toBe("DEVOLUCION_PARCIAL")
    expect(posts[0].body.items).toEqual([
      { ventaItemId: "item-gaseosa", cantidad: 2, reingresaStock: true },
      { ventaItemId: "item-yerba", cantidad: 1, reingresaStock: true },
    ])
    expect(document.body.textContent).toContain("Devolución total registrada")
    await act(async () => root.unmount())
  })

  test("without exchange endpoints there is no product picker (returns only)", async () => {
    const root = await render()
    await click(button("Gestionar venta"))
    expect(document.querySelector('[data-testid="catalogo-compacto"]')).toBeNull()
    expect(document.body.textContent).not.toContain("Agregar venta vinculada")
    await act(async () => root.unmount())
  })

  test("void lists every remaining unit and asks the stock decision per product", async () => {
    const root = await render()
    await click(button("Anular venta"))
    expect(document.body.textContent).toContain("Se devuelven todas las unidades que todavía no fueron devueltas")
    expect(document.querySelectorAll('[role="group"]')).toHaveLength(2)
    expect(document.body.textContent).toMatch(/Dinero \(\$\s?9\.000,00\)/)
    expect(document.querySelector('input[type="checkbox"]')).toBeTruthy() // explicit confirmation kept for a void
    await act(async () => root.unmount())
  })

  test("actions are stacked full width and wrap, so nothing overflows on a phone", async () => {
    const root = await render()
    const actions = document.querySelector('[data-testid="venta-acciones"]') as HTMLDivElement
    expect(actions.className).toContain("flex-col")
    for (const b of actions.querySelectorAll("button")) for (const cls of ["w-full", "whitespace-normal", "h-auto", "min-h-11"]) expect(b.className).toContain(cls)
    await click(button("Gestionar venta"))
    const formActions = document.querySelector('[data-testid="gestionar-acciones"]') as HTMLDivElement
    expect(formActions.className).toContain("flex-col")
    expect(formActions.querySelector('button[type="submit"]')!.className).toContain("whitespace-normal")
    // compact dialog, never a full-screen page
    const dialog = document.querySelector('[data-slot="dialog-content"]') as HTMLElement
    expect(dialog.className).toContain("max-w-xl")
    expect(dialog.className).not.toContain("h-[100dvh]")
    await act(async () => root.unmount())
  })

  test("preview mirrors the server rule (cumulative, exact last unit)", () => {
    const item = { id: "i", nombre: "C", varianteNombre: null, precio: 3.33, cantidad: 3, subtotal: 9.99, cantidadDevuelta: 2, cantidadRestante: 1, importeDevuelto: 6.66 }
    expect(importeEstimado(item, 1)).toBe(3.33)
    expect(importeEstimado({ ...item, cantidadDevuelta: 0, importeDevuelto: 0, cantidadRestante: 3 }, 1)).toBe(3.33)
  })
})
