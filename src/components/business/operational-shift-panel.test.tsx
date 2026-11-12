import { afterAll, afterEach, beforeEach, describe, expect, test } from "bun:test"
import { GlobalRegistrator } from "@happy-dom/global-registrator"

GlobalRegistrator.register()
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterAll(() => GlobalRegistrator.unregister())

const React = await import("react")
const { createRoot } = await import("react-dom/client")
const { act } = React
const { OperationalShiftPanel, AVISO_SEGUNDO_CIERRE, AVISO_CERRADO_EN_OTRA_PESTANA } = await import("./operational-shift-panel")
const originalFetch = globalThis.fetch
let enabled = false
let currentShift: unknown = null
let transferableFund: { turnoOrigenId: string; importe: string } | null = null
let postResults: Array<"network" | "success" | "server-error" | "fund-taken" | "slow-success"> = []
const openingKeys: Array<string | null> = []
const openingBodies: Array<Record<string, unknown>> = []
const closingKeys: Array<string | null> = []
let closeRecoveredByOwner = false
let closeResults: Array<"network" | "ok"> = []
let acceptedCloseKey: string | null = null
const acceptedCloses: string[] = []

beforeEach(() => {
  closeResults = []
  acceptedCloseKey = null
  acceptedCloses.length = 0
  enabled = false
  currentShift = null
  transferableFund = null
  postResults = []
  openingKeys.length = 0
  openingBodies.length = 0
  closingKeys.length = 0
  closeRecoveredByOwner = false
  window.sessionStorage.clear()
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.endsWith("/turno") && init?.method === "POST") {
      const body = JSON.parse(String(init.body ?? "{}")) as { action?: string }
      if (body.action === "close") {
        const key = new Headers(init.headers).get("Idempotency-Key")
        closingKeys.push(key)
        if (closeResults.shift() === "network") throw new TypeError("network lost")
        // Like the server: the same key replays the accepted close; a closed shift refuses any other attempt.
        if (key && key === acceptedCloseKey) return new Response(JSON.stringify({ ok: true, turno: { id: "turno-1", estado: "CERRADO_DECLARADO", cerradoEn: new Date().toISOString() } }), { status: 200, headers: { "Idempotency-Replayed": "true" } })
        if (!currentShift || closeRecoveredByOwner) {
          currentShift = null
          return new Response(JSON.stringify({ ok: false, error: "El turno ya no está abierto.", code: "TURNO_NO_ABIERTO" }), { status: 409 })
        }
        currentShift = null
        acceptedCloseKey = key
        acceptedCloses.push(String((body as { efectivoContado?: unknown }).efectivoContado))
        return new Response(JSON.stringify({ ok: true, turno: { id: "turno-1", estado: "CERRADO_DECLARADO", cerradoEn: new Date().toISOString() } }), { status: 200 })
      }
      openingKeys.push(new Headers(init.headers).get("Idempotency-Key"))
      openingBodies.push(body)
      const result = postResults.shift() ?? "success"
      if (result === "network") throw new TypeError("network lost")
      if (result === "server-error") return new Response(JSON.stringify({ ok: false, error: "Error al abrir el turno" }), { status: 500 })
      if (result === "fund-taken") {
        transferableFund = null
        return new Response(JSON.stringify({ ok: false, error: "Ese fondo ya fue recibido por otro turno.", code: "FONDO_REMANENTE_YA_TRANSFERIDO" }), { status: 409 })
      }
      if (result === "slow-success") await new Promise((resolve) => setTimeout(resolve, 40))
      currentShift = { id: "turno-1", caja: { id: "caja-1", nombre: "Caja principal" }, abiertoEn: new Date().toISOString(), fondoInicial: Number(body.fondoInicial ?? 300) }
      return new Response(JSON.stringify({ ok: true, turno: currentShift }), { status: 201 })
    }
    if (url.endsWith("/turno")) return new Response(JSON.stringify({
      ok: true,
      modoTurnos: "OPCIONAL",
      aperturaHabilitada: enabled,
      cajas: [
        { id: "caja-1", nombre: "Caja principal", esPredeterminada: true, ocupada: Boolean(currentShift), fondoTransferible: transferableFund },
        { id: "caja-2", nombre: "Caja secundaria", esPredeterminada: false, ocupada: true, fondoTransferible: null },
      ],
      turno: currentShift,
      ultimoCierre: !currentShift && closeRecoveredByOwner ? { id: "turno-1", caja: { id: "caja-1", nombre: "Caja principal" }, cerradoEn: new Date().toISOString(), cerradoPorAdministracion: true } : null,
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

  test("employee explicitly confirms the exact previous remainder before opening with it", async () => {
    enabled = true
    transferableFund = { turnoOrigenId: "turno-origen", importe: "5000.00" }
    const root = await renderPanel()
    const registerButton = [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("Caja principal")) as HTMLButtonElement
    await act(async () => registerButton.click())
    const checks = [...document.querySelectorAll('input[type="checkbox"]')] as HTMLInputElement[]
    expect(checks).toHaveLength(1)
    expect(document.body.textContent).toContain("5.000,00")
    await act(async () => checks[0].click())
    const confirmedChecks = [...document.querySelectorAll('input[type="checkbox"]')] as HTMLInputElement[]
    expect(confirmedChecks).toHaveLength(2)
    const submitBeforeConfirmation = [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("Abrir turno con fondo transferido")) as HTMLButtonElement
    expect(submitBeforeConfirmation.disabled).toBe(true)
    await act(async () => confirmedChecks[1].click())
    const submit = [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("Abrir turno con fondo transferido")) as HTMLButtonElement
    expect(submit.disabled).toBe(false)
    await act(async () => submit.click())
    await flush()
    expect(openingBodies).toHaveLength(1)
    expect(openingBodies[0]).toMatchObject({ cajaFisicaId: "caja-1", fondoInicial: "5000.00", transferirDesdeTurnoCajaId: "turno-origen", confirmoRecepcionFondo: true })
    expect(document.body.textContent).toContain("Turno iniciado con el fondo recibido del turno anterior.")
    expect(document.body.textContent).not.toMatch(/efectivo esperado|diferencia|efectivoEntregado|responsableNombre/i)
    await act(async () => root.unmount())
  })

  async function confirmTransferAndSubmit() {
    const registerButton = [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("Caja principal")) as HTMLButtonElement
    await act(async () => registerButton.click())
    await act(async () => (document.querySelectorAll('input[type="checkbox"]')[0] as HTMLInputElement).click())
    await act(async () => (document.querySelectorAll('input[type="checkbox"]')[1] as HTMLInputElement).click())
    return [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("Abrir turno con fondo transferido")) as HTMLButtonElement
  }

  test("transfer opening shows the open shift immediately and sends only one request on double click", async () => {
    enabled = true
    transferableFund = { turnoOrigenId: "turno-origen", importe: "1500.00" }
    postResults = ["slow-success"]
    const root = await renderPanel()
    const submit = await confirmTransferAndSubmit()
    await act(async () => { submit.click(); submit.click() })
    await flush(80)
    expect(openingBodies).toHaveLength(1)
    expect(document.body.textContent).toContain("Turno abierto")
    expect(document.body.textContent).toContain("Turno iniciado con el fondo recibido del turno anterior.")
    expect(document.body.textContent).not.toContain("Abrir turno con fondo transferido")
    await act(async () => root.unmount())
  })

  test("a remainder already received by another shift is explained and availability is refreshed", async () => {
    enabled = true
    transferableFund = { turnoOrigenId: "turno-origen", importe: "1500.00" }
    postResults = ["fund-taken"]
    const root = await renderPanel()
    const submit = await confirmTransferAndSubmit()
    await act(async () => submit.click())
    await flush()
    expect(document.body.textContent).toContain("Ese fondo ya fue recibido por otro turno.")
    expect(document.body.textContent).not.toContain("Fondo disponible del turno anterior")
    expect(document.body.textContent).not.toContain("Abrir turno con fondo transferido")
    expect(document.body.textContent).not.toContain("Turno abierto")
    await act(async () => root.unmount())
  })

  test("a server error keeps the form, shows a useful message and retries with the same key", async () => {
    enabled = true
    transferableFund = { turnoOrigenId: "turno-origen", importe: "1500.00" }
    postResults = ["server-error", "success"]
    const root = await renderPanel()
    const submit = await confirmTransferAndSubmit()
    await act(async () => submit.click())
    await flush()
    expect(document.body.textContent).toContain("No pudimos abrir el turno por un error del servidor.")
    expect(document.body.textContent).not.toContain("Turno abierto")
    const retry = [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("Abrir turno con fondo transferido")) as HTMLButtonElement
    await act(async () => retry.click())
    await flush()
    expect(openingKeys).toHaveLength(2)
    expect(openingKeys[1]).toBe(openingKeys[0])
    expect(document.body.textContent).toContain("Turno abierto")
    await act(async () => root.unmount())
  })

  test("manual opening stays available and does not claim the prior remainder was transferred", async () => {
    enabled = true
    transferableFund = { turnoOrigenId: "turno-origen", importe: "5000.00" }
    const root = await renderPanel()
    const registerButton = [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("Caja principal")) as HTMLButtonElement
    await act(async () => registerButton.click())
    expect(document.body.textContent).toContain("Si abrís manualmente, este remanente dejará de estar disponible")
    const submit = [...document.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Iniciar turno") as HTMLButtonElement
    await act(async () => submit.click())
    await flush()
    expect(openingBodies).toHaveLength(1)
    expect(openingBodies[0]).not.toHaveProperty("transferirDesdeTurnoCajaId")
    expect(openingBodies[0]).not.toHaveProperty("confirmoRecepcionFondo")
    await act(async () => root.unmount())
  })

  test("a shift recovered by the owner cannot be closed again: the panel refreshes and explains it without amounts", async () => {
    enabled = true
    closeRecoveredByOwner = true
    currentShift = { id: "turno-1", caja: { id: "caja-1", nombre: "Caja principal" }, abiertoEn: new Date().toISOString(), fondoInicial: 0 }
    const root = await renderPanel()
    await act(async () => ([...document.querySelectorAll("button")].find((button) => button.textContent?.includes("Cerrar turno")) as HTMLButtonElement).click())
    const input = document.querySelector("#efectivo-contado-turno") as HTMLInputElement
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "15.25")
      input.dispatchEvent(new Event("input", { bubbles: true }))
    })
    await act(async () => ([...document.querySelectorAll("button")].find((button) => button.textContent?.includes("Confirmar cierre")) as HTMLButtonElement).click())
    await flush()
    expect(document.querySelector('[data-testid="aviso-turno"]')?.textContent).toContain(AVISO_SEGUNDO_CIERRE)
    expect(document.body.textContent).toContain("cerrado por el responsable del negocio (recuperación administrativa)")
    expect(document.body.textContent).not.toContain("Turno abierto")
    expect(document.body.textContent).not.toMatch(/esperado|diferencia|15[.,]25/i)
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
    // The confirmation is shown at the TOP of the panel, before the opening form.
    const mensaje = document.querySelector('[data-testid="mensaje-turno"]') as HTMLElement
    expect(mensaje.textContent).toBe("Cierre declarado registrado.")
    expect(mensaje.compareDocumentPosition(openButton()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await act(async () => root.unmount())
  })
})

// Manual test 2026-11-12: a stale second tab confirmed the close of an already closed
// shift. The server refused it (409, nothing written) but the notice was easy to miss.
describe("closing from a stale tab: clear warning at the top, never a second close, never amounts", () => {
  const SHIFT = () => ({ id: "turno-1", caja: { id: "caja-2", nombre: "Caja secundaria" }, abiertoEn: new Date().toISOString(), fondoInicial: 1000 })
  async function pestana() {
    const container = document.createElement("div")
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => root.render(<OperationalShiftPanel slug="almacen" negocioId="neg-1" empleadoId="emp-1" empleadoNombre="Cajero 1" onAccessLost={() => {}} />))
    await flush()
    const boton = (texto: string) => [...container.querySelectorAll("button")].find((b) => b.textContent?.includes(texto)) as HTMLButtonElement
    const escribir = async (valor: string) => {
      const input = container.querySelector("#efectivo-contado-turno") as HTMLInputElement
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, valor)
        input.dispatchEvent(new Event("input", { bubbles: true }))
      })
    }
    const abrirCierre = async (valor: string) => { await act(async () => boton("Cerrar turno").click()); await escribir(valor) }
    const confirmar = async () => { await act(async () => boton("Confirmar cierre").click()); await flush() }
    const aviso = () => container.querySelector('[data-testid="aviso-turno"]') as HTMLElement | null
    return { root, container, boton, abrirCierre, confirmar, aviso }
  }
  const sinImportes = (texto: string) => expect(texto).not.toMatch(/esperado|diferencia|faltante|sobrante|950|900|1[.,]?000/i)

  test("two tabs: A closes with 950; B (form opened before) confirms 900 → refused, warning at the top, still visible after the refresh, no amounts", async () => {
    enabled = true
    currentShift = SHIFT()
    const a = await pestana()
    const b = await pestana()
    await b.abrirCierre("900") // B: form open and typed, never confirmed yet
    await a.abrirCierre("950")
    await a.confirmar()
    expect(a.container.textContent).toContain("Cierre declarado registrado.")
    expect(a.aviso()).toBeNull()

    await b.confirmar() // stale tab, different key
    expect(closingKeys).toHaveLength(2)
    expect(closingKeys[1]).not.toBe(closingKeys[0])
    expect(acceptedCloses).toEqual(["950"]) // the server accepted ONE close, never the 900
    const aviso = b.aviso()!
    expect(aviso.getAttribute("role")).toBe("alert")
    expect(aviso.textContent).toContain(AVISO_SEGUNDO_CIERRE)
    expect(aviso.className).toContain("amber")
    // At the top: before the opening form that replaced the close form.
    expect(aviso.compareDocumentPosition(b.boton("Iniciar turno")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(b.container.querySelector("#efectivo-contado-turno")).toBeNull()
    sinImportes(b.container.textContent ?? "")
    // A later refresh keeps the warning; «Entendido» dismisses it.
    await act(async () => ([...b.container.querySelectorAll("button")].find((x) => x.getAttribute("aria-label") === "Actualizar cajas") as HTMLButtonElement).click())
    await flush()
    expect(b.aviso()?.textContent).toContain(AVISO_SEGUNDO_CIERRE)
    await act(async () => b.boton("Entendido").click())
    expect(b.aviso()).toBeNull()
    await act(async () => { a.root.unmount(); b.root.unmount() })
  })

  test("back on a stale tab (focus): the real state is re-read silently; the closed shift's form disappears with a warning and nothing is sent", async () => {
    enabled = true
    currentShift = SHIFT()
    const b = await pestana()
    await b.abrirCierre("900")
    currentShift = null // closed meanwhile in another tab / device
    await act(async () => { window.dispatchEvent(new Event("focus")) })
    await flush()
    expect(closingKeys).toHaveLength(0) // nothing was sent by the stale tab
    expect(b.container.querySelector("#efectivo-contado-turno")).toBeNull()
    expect(b.aviso()?.textContent).toContain(AVISO_CERRADO_EN_OTRA_PESTANA)
    sinImportes(b.container.textContent ?? "")
    await act(async () => b.root.unmount())
  })

  test("back on the tab while the shift is still open: nothing changes, the typed count is kept, no warning", async () => {
    enabled = true
    currentShift = SHIFT()
    const b = await pestana()
    await b.abrirCierre("950")
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")) })
    await flush()
    expect((b.container.querySelector("#efectivo-contado-turno") as HTMLInputElement).value).toBe("950")
    expect(b.aviso()).toBeNull()
    expect(b.container.textContent).toContain("Turno abierto")
    await act(async () => b.root.unmount())
  })

  test("same idempotency key: a lost answer is retried with the SAME key and replays, never a second close", async () => {
    enabled = true
    currentShift = SHIFT()
    closeResults = ["network"]
    const a = await pestana()
    await a.abrirCierre("950")
    await a.confirmar() // network lost: nothing known
    expect(a.container.querySelector('[data-testid="mensaje-turno"]')?.textContent).toContain("Podés reintentar sin duplicarlo")
    await a.confirmar() // retry
    expect(closingKeys).toHaveLength(2)
    expect(closingKeys[1]).toBe(closingKeys[0])
    expect(acceptedCloses).toEqual(["950"])
    expect(a.container.textContent).toContain("Cierre declarado registrado.")
    expect(a.aviso()).toBeNull()
    await act(async () => a.root.unmount())
  })
})

