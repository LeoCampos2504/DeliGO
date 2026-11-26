// ============================================
// T1-01 — Caja del cajero: orden de secciones según el turno confirmado (happy-dom)
// ============================================
// Con la VenderView REAL de la página: un carrito con productos y su inicio de venta
// sobreviven a la apertura y al cierre del turno, aunque la pantalla se reorganice. La
// sección de ventas es el MISMO nodo del DOM (se mueve, no se vuelve a montar) y el inicio
// de venta se registra UNA sola vez. Sin turno: Caja y turno primero; con turno: Ventas
// primero, indicador «Turno abierto · <Caja>» y el detalle del turno plegado (montado).
import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { GlobalRegistrator } from "@happy-dom/global-registrator"

GlobalRegistrator.register()
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterAll(() => {
  GlobalRegistrator.unregister()
})

const replace = mock((_href: string) => {})
const routerMock = { replace, push: replace, refresh: () => {} }
const navMock = { homeHref: "/operaciones/mi-panel", loginHref: "/operaciones/ingresar", noSessionMode: "redirect" }
mock.module("sonner", () => ({ toast: { success: () => {}, error: () => {}, message: () => {} } }))
mock.module("@/components/business/barcode-scanner", () => ({ BarcodeScanner: () => null }))
mock.module("next/navigation", () => ({ useParams: () => ({ slug: "kiosco-1" }), useRouter: () => routerMock }))
mock.module("@/components/operativo/use-operativo-nav", () => ({ useOperativoNav: () => navMock }))

const React = await import("react")
mock.module("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => React.createElement("a", { href, ...rest }, children),
}))
const { createRoot } = await import("react-dom/client")
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query")
const { act } = React
const { default: CajeroCajaPage } = await import("./page")

const producto = { id: "p-agua", nombre: "Agua", precio: 900, categoria: "Bebidas", imagenUrl: null, eliminado: false, controlStock: false, stockCantidad: 0, stockMinimo: 0, variantes: [], marca: null, sku: null, codigoBarras: null }
const INICIO_KEY = "deligo:caja:inicio-venta:v1:operativo:emp-1:neg-1"
let turnoAbierto = false
let calls: string[] = []
const originalFetch = globalThis.fetch

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
}
const caja = { id: "caja-1", nombre: "Caja principal", esPredeterminada: true }

beforeEach(() => {
  window.sessionStorage.clear()
  turnoAbierto = false
  calls = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? "GET"
    calls.push(`${method} ${url}`)
    if (url === "/api/operativo/caja/kiosco-1/productos") {
      return json({ ok: true, estado: "operativo", negocio: { id: "neg-1", nombre: "Kiosco Uno", slug: "kiosco-1", colorPrincipal: "#000", logoUrl: null }, empleado: { id: "emp-1", nombre: "Ana" }, productos: [producto] })
    }
    if (url === "/api/operativo/caja/kiosco-1/turno" && method === "GET") {
      return json({
        ok: true, modoTurnos: "OPCIONAL", aperturaHabilitada: true,
        cajas: [{ ...caja, ocupada: turnoAbierto, fondoTransferible: null }],
        turno: turnoAbierto ? { id: "turno-1", caja: { id: caja.id, nombre: caja.nombre }, abiertoEn: new Date().toISOString(), fondoInicial: 0 } : null,
        ultimoCierre: null,
      })
    }
    if (url === "/api/operativo/caja/kiosco-1/egresos" && method === "GET") return json({ ok: true, turnoAbierto, egresos: [] })
    if (url === "/api/operativo/caja/kiosco-1/ventas/inicio" && method === "POST") return json({ ok: true, inicio: { id: "inicio-1", expiraEn: new Date(Date.now() + 1_800_000).toISOString() } }, 201)
    if (url === "/api/operativo/caja/kiosco-1/ventas/inicio/inicio-1") return json({ ok: true, inicio: { vencido: false, usado: false, precios: [] } })
    if (url.startsWith("/api/operativo/caja/kiosco-1/etiquetas-precio")) return json({ pendientes: 0 })
    if (url.startsWith("/api/operativo/caja/kiosco-1/catalogo")) return json({ permisos: { vigente: false, hasta: null } })
    return json({ ok: false }, 404)
  }) as typeof fetch
})
afterEach(() => {
  globalThis.fetch = originalFetch
  document.body.innerHTML = ""
})

async function flush(ms = 60) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms))
  })
}
async function renderPage() {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <CajeroCajaPage />
      </QueryClientProvider>
    )
  })
  await flush(120)
  return root
}
const orden = () => [...document.querySelectorAll('[data-testid="caja-secciones"] > [data-seccion]')].map((el) => el.getAttribute("data-seccion"))
async function click(el: HTMLElement) {
  await act(async () => {
    el.click()
  })
  await flush()
}
async function tapProduct(nombre: string) {
  const p = [...document.querySelectorAll("#caja-vender button p")].find((el) => el.textContent === nombre)
  if (!p) throw new Error(`product not found: ${nombre}`)
  await click(p.closest("button") as HTMLButtonElement)
}
const cantidadEnCarrito = () => [...document.querySelectorAll("#caja-vender span.tabular-nums")].map((el) => el.textContent)
async function refrescarTurno() {
  await click(document.querySelector('button[aria-label="Actualizar cajas"]') as HTMLButtonElement)
  await flush(120)
}

describe("T1-01 — orden del punto de venta del cajero según el turno confirmado", () => {
  test("sin turno: Caja y turno → Ventas → Salidas → herramientas; sin indicador; el detalle de apertura visible", async () => {
    const root = await renderPage()
    expect(orden()).toEqual(["turno", "ventas", "salidas", "herramientas", "historial"])
    expect(document.querySelector('[data-testid="indicador-turno"]')).toBeNull()
    expect(document.body.textContent).toContain("Iniciar turno")
    await act(async () => root.unmount())
  })

  test("el carrito y el inicio de venta sobreviven a la apertura y al cierre del turno: la sección de ventas se MUEVE, no se vuelve a montar", async () => {
    const root = await renderPage()
    const ventasAntes = document.getElementById("caja-vender")
    await tapProduct("Agua")
    await tapProduct("Agua")
    expect(cantidadEnCarrito()).toEqual(["2"])
    expect(calls.filter((c) => c === "POST /api/operativo/caja/kiosco-1/ventas/inicio")).toHaveLength(1)
    const inicioGuardado = window.sessionStorage.getItem(INICIO_KEY)
    expect(inicioGuardado).toContain("inicio-1")

    // El servidor confirma un turno abierto → la pantalla se reorganiza.
    turnoAbierto = true
    await refrescarTurno()
    expect(orden()).toEqual(["ventas", "turno", "salidas", "herramientas", "historial"])
    expect(document.querySelector('[data-testid="indicador-turno"]')?.textContent).toContain("Turno abierto · Caja principal")
    expect(document.getElementById("caja-vender")).toBe(ventasAntes) // mismo nodo: movido, no recreado
    expect(cantidadEnCarrito()).toEqual(["2"])
    expect(window.sessionStorage.getItem(INICIO_KEY)).toBe(inicioGuardado)
    // Detalle del turno plegado pero MONTADO: el cierre sigue disponible al desplegarlo.
    const detalle = document.querySelector('[data-testid="detalle-turno"]') as HTMLElement
    expect(detalle.hidden).toBe(true)
    expect(detalle.textContent).toContain("Cerrar turno")
    const plegar = document.querySelector('[data-testid="plegar-turno"]') as HTMLButtonElement
    expect(plegar.getAttribute("aria-expanded")).toBe("false")
    await click(plegar)
    expect(detalle.hidden).toBe(false)
    // Un refresco del MISMO turno no vuelve a plegarlo.
    await refrescarTurno()
    expect((document.querySelector('[data-testid="detalle-turno"]') as HTMLElement).hidden).toBe(false)

    // El turno se cierra (en otro dispositivo) → vuelve el orden sin turno, con el mismo carrito.
    turnoAbierto = false
    await refrescarTurno()
    expect(orden()).toEqual(["turno", "ventas", "salidas", "herramientas", "historial"])
    expect(document.querySelector('[data-testid="indicador-turno"]')).toBeNull()
    expect(document.getElementById("caja-vender")).toBe(ventasAntes)
    expect(cantidadEnCarrito()).toEqual(["2"])
    expect(window.sessionStorage.getItem(INICIO_KEY)).toBe(inicioGuardado)
    // Ningún inicio nuevo ni relectura del catálogo por la reorganización.
    expect(calls.filter((c) => c === "POST /api/operativo/caja/kiosco-1/ventas/inicio")).toHaveLength(1)
    await act(async () => root.unmount())
  })

  test("el orden del DOM es el orden visual (teclado y lector de pantalla): con turno, el encabezado de Ventas va antes que el de Caja y turno", async () => {
    turnoAbierto = true
    const root = await renderPage()
    const ventas = document.getElementById("caja-vender-titulo") as HTMLElement
    const turno = document.getElementById("turno-caja-titulo") as HTMLElement
    expect(ventas.compareDocumentPosition(turno) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(document.getElementById("salidas-caja-titulo")!.compareDocumentPosition(document.querySelector('nav[aria-label="Herramientas de Caja"]')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // Historial de salidas plegado por defecto.
    expect((document.querySelector('[data-testid="historial-salidas-plegable"]') as HTMLDetailsElement).open).toBe(false)
    await act(async () => root.unmount())
  })
})
