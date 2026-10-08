// ============================================
// P2-T56-R3A-I3 — UI: advertencia PREVIA de un AJUSTE deficitario (Decisión A)
// ============================================
// Render real de AjusteStockDialog (happy-dom) con fetch simulado:
//   1. AJUSTE → el servidor responde STOCK_ADJUSTMENT_CONFIRMATION_REQUIRED sin escribir;
//   2. la UI muestra stock actual / propuesto / reservas / faltante;
//   3. "Cancelar" cierra sin otra request;
//   4. "Confirmar ajuste" reenvía la huella del servidor;
//   5. una confirmación vencida muestra los valores actualizados y pide otra vez.
import { afterAll, afterEach, describe, expect, mock, test } from "bun:test"
import { GlobalRegistrator } from "@happy-dom/global-registrator"

GlobalRegistrator.register()
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

afterAll(() => {
  GlobalRegistrator.unregister()
})

const toastSuccess = mock(() => {})
const toastError = mock(() => {})
mock.module("sonner", () => ({ toast: { success: toastSuccess, error: toastError } }))

const React = await import("react")
const { createRoot } = await import("react-dom/client")
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query")
const { act } = React
const { AjusteStockDialog } = await import("./inventario-tab")

const originalFetch = globalThis.fetch
const HUELLA = "a".repeat(64)
const HUELLA_NUEVA = "b".repeat(64)

function response(body: unknown, status: number) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

const warning = (overrides: Record<string, unknown> = {}, vencida = false) =>
  response(
    {
      code: "STOCK_ADJUSTMENT_CONFIRMATION_REQUIRED",
      error: "Hay 7 unidades reservadas para pedidos pendientes.",
      confirmacion: { stockActual: 10, stockPropuesto: 5, reservasActivas: 7, deficitResultante: 2, huella: HUELLA, ...overrides },
      confirmacionVencida: vencida,
    },
    409
  )

async function flush() {
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  })
}

function setInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!
  setter.call(input, value)
  input.dispatchEvent(new window.Event("input", { bubbles: true }))
}

function buttonByText(text: string): HTMLButtonElement {
  const button = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === text)
  if (!button) throw new Error(`button "${text}" not found; buttons: ${[...document.querySelectorAll("button")].map((b) => b.textContent?.trim()).join(" | ")}`)
  return button as HTMLButtonElement
}

async function click(el: HTMLElement) {
  await act(async () => {
    el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }))
  })
  await flush()
}

let roots: Array<ReturnType<typeof createRoot>> = []

async function renderDialog(onAdjusted = mock(() => {})) {
  const host = document.createElement("div")
  document.body.appendChild(host)
  const root = createRoot(host)
  roots.push(root)
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  await act(async () => {
    root.render(
      React.createElement(
        QueryClientProvider,
        { client },
        React.createElement(AjusteStockDialog, {
          producto: { id: "p-coca", nombre: "Coca-Cola" } as never,
          onClose: () => {},
          onAdjusted,
        })
      )
    )
  })
  await flush()
  await click(buttonByText("Ajuste"))
  const input = document.querySelector<HTMLInputElement>("#ajuste-cantidad")!
  await act(async () => setInput(input, "5"))
  await flush()
  return { onAdjusted }
}

afterEach(async () => {
  globalThis.fetch = originalFetch
  for (const root of roots) await act(async () => root.unmount())
  roots = []
  document.body.innerHTML = ""
  toastSuccess.mockClear()
  toastError.mockClear()
})

describe("P2-T56-R3A-I3 — advertencia previa de AJUSTE deficitario", () => {
  test("muestra la advertencia con los 4 valores y NO guarda; Cancelar no hace otra request", async () => {
    const calls: Array<Record<string, unknown>> = []
    globalThis.fetch = mock(async (_url: string, init?: RequestInit) => {
      calls.push(JSON.parse(String(init?.body)))
      return warning()
    }) as unknown as typeof fetch
    const { onAdjusted } = await renderDialog()

    await click(buttonByText("Confirmar"))
    expect(calls).toHaveLength(1)
    expect(calls[0]).toEqual(expect.objectContaining({ tipo: "AJUSTE", cantidad: 5 }))
    expect(calls[0].confirmacionAjuste).toBeUndefined()

    expect(document.body.textContent).toContain("Advertencia de stock")
    expect(document.body.textContent).toContain("Hay 7 unidades reservadas para pedidos pendientes. Si cambiás el stock a 5, van a faltar 2 unidades para cubrir esos pedidos.")
    const valores = document.querySelector('[data-testid="ajuste-deficit-valores"]')!.textContent!
    expect(valores).toContain("Stock actual10")
    expect(valores).toContain("Stock propuesto5")
    expect(valores).toContain("Reservas activas7")
    expect(valores).toContain("Faltante resultante2")

    await click(buttonByText("Cancelar"))
    expect(calls).toHaveLength(1)
    expect(document.body.textContent).not.toContain("Advertencia de stock")
    expect(onAdjusted).not.toHaveBeenCalled()
    expect(toastSuccess).not.toHaveBeenCalled()
  })

  test("Confirmar ajuste reenvía la huella del servidor y, con 201, guarda", async () => {
    const calls: Array<Record<string, unknown>> = []
    globalThis.fetch = mock(async (_url: string, init?: RequestInit) => {
      calls.push(JSON.parse(String(init?.body)))
      return calls.length === 1 ? warning() : response({ producto: {}, variante: null, movimiento: {} }, 201)
    }) as unknown as typeof fetch
    const { onAdjusted } = await renderDialog()

    await click(buttonByText("Confirmar"))
    await click(buttonByText("Confirmar ajuste"))
    expect(calls).toHaveLength(2)
    expect(calls[1]).toEqual(expect.objectContaining({ tipo: "AJUSTE", cantidad: 5, confirmacionAjuste: { huella: HUELLA } }))
    expect(onAdjusted).toHaveBeenCalledTimes(1)
    expect(toastSuccess).toHaveBeenCalledWith("Stock actualizado")
  })

  test("confirmación vencida: muestra el aviso de cambio con valores nuevos y exige confirmar de nuevo", async () => {
    const calls: Array<Record<string, unknown>> = []
    globalThis.fetch = mock(async (_url: string, init?: RequestInit) => {
      calls.push(JSON.parse(String(init?.body)))
      if (calls.length === 1) return warning()
      if (calls.length === 2) return warning({ reservasActivas: 9, deficitResultante: 4, huella: HUELLA_NUEVA }, true)
      return response({ producto: {}, variante: null, movimiento: {} }, 201)
    }) as unknown as typeof fetch
    const { onAdjusted } = await renderDialog()

    await click(buttonByText("Confirmar"))
    await click(buttonByText("Confirmar ajuste"))
    expect(onAdjusted).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain("El stock o las reservas cambiaron mientras confirmabas")
    expect(document.querySelector('[data-testid="ajuste-deficit-valores"]')!.textContent).toContain("Reservas activas9")

    await click(buttonByText("Confirmar ajuste"))
    expect(calls[2]).toEqual(expect.objectContaining({ confirmacionAjuste: { huella: HUELLA_NUEVA } }))
    expect(onAdjusted).toHaveBeenCalledTimes(1)
  })

  test("SALIDA bloqueada por reservas: muestra el error del servidor, sin advertencia de ajuste", async () => {
    globalThis.fetch = mock(async () =>
      response({ code: "STOCK_RESERVED_FOR_ORDERS", error: "Hay 7 unidades reservadas para pedidos pendientes: con 10 en stock sólo podés retirar hasta 3." }, 409)
    ) as unknown as typeof fetch
    await renderDialog()
    await click(buttonByText("Salida"))
    await click(buttonByText("Confirmar"))
    expect(toastError).toHaveBeenCalledWith("Hay 7 unidades reservadas para pedidos pendientes: con 10 en stock sólo podés retirar hasta 3.")
    expect(document.body.textContent).not.toContain("Advertencia de stock")
  })
})
