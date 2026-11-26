// T1-02 — permisos temporales de catálogo: un permiso VENCIDO no deja casillas preseleccionadas (happy-dom).
import { afterAll, afterEach, beforeEach, describe, expect, test } from "bun:test"
import { GlobalRegistrator } from "@happy-dom/global-registrator"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

GlobalRegistrator.register()
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterAll(() => GlobalRegistrator.unregister())

const React = await import("react")
const { createRoot } = await import("react-dom/client")
const { act } = React
const { PermisosCatalogoEmpleados, casillasInicialesPermiso } = await import("./permisos-catalogo")
const originalFetch = globalThis.fetch

const ayer = new Date(Date.now() - 86_400_000).toISOString()
const enUnaSemana = new Date(Date.now() + 7 * 86_400_000).toISOString()
const todos = { crear: true, editar: true, proveedores: true, precios: true, costos: true, importar: true }
let puts: Array<Record<string, unknown>> = []

beforeEach(() => {
  puts = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url === "/api/negocio/empleados/permisos-catalogo" && (init?.method ?? "GET") === "GET") {
      return new Response(JSON.stringify({ empleados: [
        { id: "emp-vencido", nombre: "Bruno", hasta: ayer, vigente: false, ...todos },
        { id: "emp-vigente", nombre: "Carla", hasta: enUnaSemana, vigente: true, crear: true, editar: false, proveedores: false, precios: true, costos: false, importar: false },
      ] }), { status: 200 })
    }
    if (init?.method === "PUT") { puts.push(JSON.parse(String(init.body))); return new Response(JSON.stringify({ ok: true }), { status: 200 }) }
    throw new Error(`unexpected fetch ${url}`)
  }) as typeof fetch
})
afterEach(() => { globalThis.fetch = originalFetch; document.body.innerHTML = "" })

async function flush(ms = 40) { await act(async () => { await new Promise((r) => setTimeout(r, ms)) }) }
async function render() {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await act(async () => root.render(<QueryClientProvider client={client}><PermisosCatalogoEmpleados /></QueryClientProvider>))
  await flush()
  return root
}
const fila = (nombre: string) => [...document.querySelectorAll('[data-testid="fila-permiso-catalogo"]')].find((f) => f.textContent?.includes(nombre)) as HTMLElement
const casillas = (f: HTMLElement) => [...f.querySelectorAll('input[type="checkbox"]')] as HTMLInputElement[]

describe("T1-02 — permisos vencidos sin casillas preseleccionadas", () => {
  test("regla pura: vencido, revocado o inexistente → todo desmarcado; vigente → lo otorgado", () => {
    expect(Object.values(casillasInicialesPermiso({ vigente: false, ...todos }))).toEqual([false, false, false, false, false, false])
    expect(casillasInicialesPermiso({ vigente: true, ...todos, costos: false })).toEqual({ ...todos, costos: false })
  })

  test("un permiso vencido se muestra como vencido, informa lo que tenía y empieza con TODAS las casillas desmarcadas", async () => {
    const root = await render()
    const f = fila("Bruno")
    expect(f.querySelector('[data-testid="permiso-vencido"]')?.textContent).toContain("Vencido el")
    expect(f.querySelector('[data-testid="permisos-anteriores"]')?.textContent).toContain("Costos")
    expect(casillas(f).map((c) => c.checked)).toEqual([false, false, false, false, false, false])
    // Habilitar sin elegir nada no reenvía los permisos viejos.
    await act(async () => ([...f.querySelectorAll("button")].find((b) => b.textContent === "Habilitar") as HTMLButtonElement).click())
    await flush()
    expect(puts[0]).toMatchObject({ empleadoId: "emp-vencido", crear: false, editar: false, proveedores: false, precios: false, costos: false, importar: false })
    await act(async () => root.unmount())
  })

  test("un permiso vigente sigue mostrando lo otorgado para ampliarlo (sin cambios)", async () => {
    const root = await render()
    const f = fila("Carla")
    expect(f.querySelector('[data-testid="permiso-vencido"]')).toBeNull()
    expect(casillas(f).map((c) => c.checked)).toEqual([true, false, false, true, false, false])
    expect([...f.querySelectorAll("button")].some((b) => b.textContent === "Guardar / ampliar")).toBe(true)
    await act(async () => root.unmount())
  })
})
