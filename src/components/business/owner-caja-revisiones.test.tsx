import { afterAll, afterEach, beforeEach, describe, expect, test } from "bun:test"
import { GlobalRegistrator } from "@happy-dom/global-registrator"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

GlobalRegistrator.register()
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterAll(() => GlobalRegistrator.unregister())

const React = await import("react")
const { createRoot } = await import("react-dom/client")
const { act } = React
const { OwnerCajaRevisiones } = await import("./owner-caja-revisiones")
const originalFetch = globalThis.fetch
const reviewKeys: Array<string | null> = []
let submittedNote = ""

beforeEach(() => {
  reviewKeys.length = 0
  submittedNote = ""
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.endsWith("/turnos/cerrados")) return new Response(JSON.stringify({ turnos: [{
      id: "turno-d-1", caja: { id: "caja-1", nombre: "Caja principal" }, responsableNombre: "Cristian",
      abiertoEn: "2026-10-13T12:00:00.000Z", cerradoEn: "2026-10-13T18:00:00.000Z", estado: "CERRADO_DECLARADO",
      fondoInicial: 10, efectivoEsperado: 30, efectivoContado: 29.99, diferencia: -0.01,
      resultado: "FALTANTE", estadoRevision: "PENDIENTE_REVISION",
    }] }), { status: 200 })
    if (url.endsWith("/revisiones") && init?.method === "POST") {
      reviewKeys.push(new Headers(init.headers).get("Idempotency-Key"))
      submittedNote = (JSON.parse(String(init.body)) as { observacion: string }).observacion
      return new Response(JSON.stringify({ replayed: false, revision: { id: "revision-1" } }), { status: 201 })
    }
    if (url.endsWith("/revisiones")) return new Response(JSON.stringify({ revisiones: [] }), { status: 200 })
    throw new Error(`unexpected fetch ${url}`)
  }) as typeof fetch
})
afterEach(() => { globalThis.fetch = originalFetch; document.body.innerHTML = "" })

async function flush(ms = 40) { await act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)) }) }
async function renderPanel() {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  await act(async () => root.render(<QueryClientProvider client={client}><OwnerCajaRevisiones negocioId="neg-1" /></QueryClientProvider>))
  await flush()
  return root
}

describe("F10-B2.2-D — owner review interface", () => {
  test("shows exact owner figures and requires a note before reviewing a difference", async () => {
    const root = await renderPanel()
    expect(document.body.textContent).toContain("Pendiente de revisión")
    expect(document.body.textContent).toContain("Faltante")
    expect(document.body.textContent).toContain("29,99")
    const details = [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("Ver detalle")) as HTMLButtonElement
    await act(async () => details.click())
    await flush()
    const form = document.querySelector("form") as HTMLFormElement
    const submit = form.querySelector('button[type="submit"]') as HTMLButtonElement
    expect(submit.disabled).toBe(true)
    const input = form.querySelector("input") as HTMLInputElement
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "Conteo verificado")
      input.dispatchEvent(new Event("input", { bubbles: true }))
      input.dispatchEvent(new Event("change", { bubbles: true }))
    })
    await flush()
    expect(submit.disabled).toBe(false)
    await act(async () => submit.click())
    await flush()
    expect(reviewKeys).toHaveLength(1)
    expect(reviewKeys[0]).toBeTruthy()
    expect(submittedNote).toBe("Conteo verificado")
    await act(async () => root.unmount())
  })
})
