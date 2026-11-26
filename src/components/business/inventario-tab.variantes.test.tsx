// ============================================
// T1-03 — Inventario: el cuadro de variantes muestra el precio GUARDADO sin cerrarlo y reabrirlo (happy-dom)
// ============================================
// Real InventarioTab: se abre el detalle de un producto con variantes, se edita el precio de una variante y, con la
// respuesta exitosa del servidor, el detalle (todavía abierto) muestra el precio nuevo que devuelve la relectura del
// catálogo. Si el servidor rechaza el cambio, el detalle sigue mostrando el precio vigente.
import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { GlobalRegistrator } from "@happy-dom/global-registrator"

GlobalRegistrator.register()
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterAll(() => {
  GlobalRegistrator.unregister()
})

mock.module("sonner", () => ({ toast: { success: mock(() => {}), error: mock(() => {}) } }))

const React = await import("react")
const { createRoot } = await import("react-dom/client")
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query")
const { act } = React
const { InventarioTab } = await import("./inventario-tab")

let precioServidor = 1100
let rechazar = false
let puts = 0
const producto = () => ({
  id: "p-gas", nombre: "Gaseosa", precio: 0, categoria: "Bebidas", imagenUrl: null, stock: true, eliminado: false,
  sku: null, codigoBarras: null, costo: null, marca: null, unidadMedida: "unidad", controlStock: false, stockCantidad: 0, stockMinimo: 0,
  variantes: [
    { id: "v-1", nombre: "Variante 1", precio: precioServidor, costo: null, sku: null, codigoBarras: null, controlStock: false, stockCantidad: 0, stockMinimo: 0, activo: true },
    { id: "v-2", nombre: "Variante 2", precio: 1200, costo: null, sku: null, codigoBarras: null, controlStock: false, stockCantidad: 0, stockMinimo: 0, activo: true },
  ],
})

const originalFetch = globalThis.fetch
beforeEach(() => {
  precioServidor = 1100
  rechazar = false
  puts = 0
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
    if (url === "/api/negocio/productos") return json([producto()])
    if (url === "/api/negocio/categorias") return json({ categorias: ["Bebidas"] })
    if (url.startsWith("/api/negocio/inventario/movimientos")) return json([])
    if (url === "/api/negocio/productos/p-gas/variantes/v-1" && init?.method === "PUT") {
      puts++
      if (rechazar) return json({ error: "No se pudo guardar el precio" }, 400)
      precioServidor = Number(JSON.parse(String(init.body)).precio)
      return json({ ok: true })
    }
    return json({}, 404)
  }) as typeof fetch
})
afterEach(() => {
  globalThis.fetch = originalFetch
  document.body.innerHTML = ""
})

async function wait(ms: number) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms))
  })
}
async function click(el: Element) {
  await act(async () => {
    ;(el as HTMLElement).click()
  })
  await wait(40)
}
async function typeInto(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value)
    input.dispatchEvent(new Event("input", { bubbles: true }))
  })
}
async function render() {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <InventarioTab negocio={{ id: "neg-1" }} />
      </QueryClientProvider>
    )
  })
  await wait(80)
  return root
}
const plano = (t: string | null | undefined) => (t ?? "").replace(/\s+/g, " ")
const filaVariante = (nombre: string) => [...document.querySelectorAll('[role="dialog"] button')].find((b) => b.querySelector("p")?.textContent?.startsWith(nombre)) as HTMLButtonElement

async function abrirDetalleYEditar(nuevoPrecio: string) {
  // Tarjeta móvil del producto (un <button>) o su fila de la tabla de escritorio.
  const tarjeta = ([...document.querySelectorAll("button")].find((b) => b.textContent?.includes("Gaseosa") && b.className.includes("rounded-2xl"))
    ?? [...document.querySelectorAll("tr")].find((tr) => tr.textContent?.includes("Gaseosa"))) as HTMLElement
  await click(tarjeta)
  expect(plano(filaVariante("Variante 1").textContent)).toContain("1.100")
  await click(filaVariante("Variante 1"))
  await typeInto(document.getElementById("var-precio") as HTMLInputElement, nuevoPrecio)
  const guardar = [...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent?.trim() === "Guardar cambios") as HTMLButtonElement
  await click(guardar)
  await wait(120)
}

describe("T1-03 — refresco del cuadro de variantes", () => {
  test("después de guardar, el detalle abierto muestra el precio nuevo del servidor; la otra variante no cambia", async () => {
    const root = await render()
    await abrirDetalleYEditar("1150")
    expect(puts).toBe(1)
    expect(document.querySelector("#var-precio")).toBeNull() // el formulario de la variante se cerró
    expect(plano(filaVariante("Variante 1").textContent)).toContain("1.150")
    expect(plano(filaVariante("Variante 1").textContent)).not.toContain("1.100")
    expect(plano(filaVariante("Variante 2").textContent)).toContain("1.200")
    await act(async () => root.unmount())
  })

  test("si el servidor rechaza el cambio, el detalle sigue mostrando el precio vigente (nunca uno sin confirmar)", async () => {
    rechazar = true
    const root = await render()
    await abrirDetalleYEditar("1150")
    expect(puts).toBe(1)
    expect(plano(filaVariante("Variante 1").textContent)).toContain("1.100")
    await act(async () => root.unmount())
  })
})
