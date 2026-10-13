import { afterAll, afterEach, beforeEach, describe, expect, test } from "bun:test"
import { GlobalRegistrator } from "@happy-dom/global-registrator"

GlobalRegistrator.register()
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterAll(() => GlobalRegistrator.unregister())

const React = await import("react")
const { createRoot } = await import("react-dom/client")
const { act } = React
const { OperationalShiftPanel } = await import("./operational-shift-panel")
const originalFetch = globalThis.fetch
let enabled = false
let currentShift: unknown = null
let postResults: Array<"network" | "success"> = []
const openingKeys: Array<string | null> = []
const closingKeys: Array<string | null> = []

beforeEach(() => {
  enabled = false
  currentShift = null
  postResults = []
  openingKeys.length = 0
  closingKeys.length = 0
  window.sessionStorage.clear()
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.endsWith("/turno") && init?.method === "POST") {
      const body = JSON.parse(String(init.body ?? "{}")) as { action?: string }
      if (body.action === "close") {
        closingKeys.push(new Headers(init.headers).get("Idempotency-Key"))
        currentShift = null
        return new Response(JSON.stringify({ ok: true, turno: { id: "turno-1", estado: "CERRADO_DECLARADO", cerradoEn: new Date().toISOString() } }), { status: 200 })
      }
      openingKeys.push(new Headers(init.headers).get("Idempotency-Key"))
      const result = postResults.shift() ?? "success"
      if (result === "network") throw new TypeError("network lost")
      currentShift = { id: "turno-1", caja: { id: "caja-1", nombre: "Caja principal" }, abiertoEn: new Date().toISOString(), fondoInicial: 300 }
      return new Response(JSON.stringify({ ok: true, turno: currentShift }), { status: 201 })
    }
    if (url.endsWith("/turno")) return new Response(JSON.stringify({
      ok: true,
      modoTurnos: "OPCIONAL",
      aperturaHabilitada: enabled,
      cajas: [
        { id: "caja-1", nombre: "Caja principal", esPredeterminada: true, ocupada: Boolean(currentShift) },
        { id: "caja-2", nombre: "Caja secundaria", esPredeterminada: false, ocupada: true },
      ],
      turno: currentShift,
    }), { status: 200 })
    throw new Error(`unexpected fetch ${url}`)
  }) as typeof fetch
})
afterEach(() => { globalThis.fetch = originalFetch; document.body.innerHTML = "" })

async function flush(ms = 30) { await act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)) }) }
async function renderPanel() {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => root.render(<OperationalShiftPanel slug="kiosco" negocioId="neg-1" empleadoId="emp-1" empleadoNombre="Cristian" onAccessLost={() => {}} />))
  await flush()
  return root
}
function openButton() { return [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("Iniciar turno")) as HTMLButtonElement }

describe("F10-B2.2-B — employee shift interface", () => {
  test("general operational users see availability, but shift opening is disabled", async () => {
    const root = await renderPanel()
    expect(document.body.textContent).toContain("Caja principal")
    expect(document.body.textContent).toContain("Disponible")
    expect(document.body.textContent).toContain("Ocupada")
    expect(openButton().disabled).toBe(true)
    expect(document.body.textContent).not.toContain("efectivo esperado")
    expect(document.body.textContent).not.toContain("$300")
    await act(async () => root.unmount())
  })

  test("controlled employee retains the same idempotency key after connection loss", async () => {
    enabled = true
    postResults = ["network", "success"]
    const root = await renderPanel()
    await act(async () => { openButton().click() })
    await flush()
    await act(async () => { openButton().click() })
    await flush()
    expect(openingKeys).toHaveLength(2)
    expect(openingKeys[0]).toBeTruthy()
    expect(openingKeys[1]).toBe(openingKeys[0])
    expect(document.body.textContent).toContain("Turno abierto")
    expect(document.body.textContent).toContain("Responsable: Cristian")
    expect(document.body.textContent).not.toContain("$300")
    await act(async () => root.unmount())
  })

  test("employee confirms blind count, then sees terminal closure without a cash summary", async () => {
    enabled = true
    currentShift = { id: "turno-1", caja: { id: "caja-1", nombre: "Caja principal" }, abiertoEn: new Date().toISOString(), fondoInicial: 0 }
    const root = await renderPanel()
    const closeButton = [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("Cerrar turno")) as HTMLButtonElement
    await act(async () => closeButton.click())
    const input = document.querySelector("#efectivo-contado-turno") as HTMLInputElement
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "15.25")
      input.dispatchEvent(new Event("input", { bubbles: true }))
      input.dispatchEvent(new Event("change", { bubbles: true }))
    })
    const confirm = [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("Confirmar cierre")) as HTMLButtonElement
    await act(async () => confirm.click())
    await flush()
    expect(closingKeys).toHaveLength(1)
    expect(closingKeys[0]).toBeTruthy()
    expect(document.body.textContent).toContain("Cierre declarado registrado.")
    expect(document.body.textContent).not.toContain("esperado")
    expect(document.body.textContent).not.toContain("diferencia")
    expect(document.body.textContent).not.toContain("15.25")
    await act(async () => root.unmount())
  })
})
